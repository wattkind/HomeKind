import { useEffect, useRef, useState } from 'react';

import type { PDFDocumentProxy, RenderTask } from './pdfjs';

/** Highest backing-store scale per CSS pixel; higher costs memory for little gain. */
const MAX_DPR = 2;
/**
 * Upper bound on canvas pixels across all pages (about 200 MB of RGBA). iOS
 * WebKit kills pages that hold too much canvas memory, so long manuals render
 * at a lower backing scale instead of crashing the viewer.
 */
const TOTAL_PIXEL_BUDGET = 50_000_000;
const RESIZE_DEBOUNCE_MS = 150;

/**
 * Renders every page of a PDF to a stacked `<canvas>` inside a scrollable
 * wrapper. Replaces an `<iframe>`, which WKWebView shows as a single
 * unscrollable page.
 */
export function PdfPages({
  bytes,
  label,
  onError,
}: {
  bytes: Uint8Array;
  label: string;
  onError: (err: unknown) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [width, setWidth] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Load the document from the bytes already in memory.
  useEffect(() => {
    let cancelled = false;
    let destroy: (() => Promise<void>) | null = null;
    setDoc(null);
    setCurrentPage(1);
    import('./pdfjs')
      .then(({ getDocument }) => {
        if (cancelled) return;
        // pdf.js transfers the buffer to its worker, so hand it a copy; the
        // original bytes are still needed for Share.
        const task = getDocument({ data: new Uint8Array(bytes) });
        destroy = () => task.destroy();
        return task.promise.then((loaded) => {
          if (!cancelled) setDoc(loaded);
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) onErrorRef.current(err);
      });
    return () => {
      cancelled = true;
      // Destroying the loading task also destroys the document and its worker.
      void destroy?.();
    };
  }, [bytes]);

  // Track the wrapper's content width, debounced, so pages re-render on resize.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => setWidth(Math.floor(wrap.clientWidth));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(wrap);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  // Render every page, one at a time, at the current width.
  useEffect(() => {
    if (!doc || width <= 0) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    const canvases = canvasRefs.current;

    const run = async () => {
      const first = await doc.getPage(1);
      const base = first.getViewport({ scale: 1 });
      // Estimate total pixels at 1x from the first page to pick a safe scale.
      const cssHeight = (width / base.width) * base.height;
      const budgetDpr = Math.sqrt(TOTAL_PIXEL_BUDGET / (width * cssHeight * doc.numPages));
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, MAX_DPR, budgetDpr));

      for (let n = 1; n <= doc.numPages; n += 1) {
        if (cancelled) return;
        const page = n === 1 ? first : await doc.getPage(n);
        const canvas = canvases[n - 1];
        if (cancelled || !canvas) return;
        const cssScale = width / page.getViewport({ scale: 1 }).width;
        const viewport = page.getViewport({ scale: cssScale * dpr });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        task = page.render({ canvas, viewport });
        await task.promise;
        task = null;
      }
    };

    run().catch((err: unknown) => {
      // A cancelled render rejects with RenderingCancelledException; ignore it.
      if (!cancelled) onErrorRef.current(err);
    });

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, width]);

  // Free canvas backing stores on unmount; WebKit holds them until GC otherwise.
  useEffect(() => {
    const canvases = canvasRefs.current;
    return () => {
      for (const canvas of canvases) {
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
        }
      }
    };
  }, []);

  const onScroll = () => {
    const wrap = wrapRef.current;
    if (!wrap || !doc) return;
    const probe = wrap.scrollTop + wrap.clientHeight / 3;
    let page = 1;
    canvasRefs.current.forEach((canvas, index) => {
      if (canvas && canvas.offsetTop <= probe) page = index + 1;
    });
    if (page !== currentPage) setCurrentPage(page);
  };

  const pageCount = doc?.numPages ?? 0;

  return (
    <>
      <div
        ref={wrapRef}
        className="viewer__pdf-wrap"
        role="document"
        aria-label={
          pageCount > 0 ? `${label}, ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}` : label
        }
        onScroll={onScroll}
      >
        {doc ? (
          Array.from({ length: pageCount }, (_, index) => (
            <canvas
              key={index}
              ref={(el) => {
                canvasRefs.current[index] = el;
              }}
              className="viewer__pdf-page"
              aria-hidden="true"
            />
          ))
        ) : (
          <p className="muted viewer__pdf-status" role="status">
            Opening
          </p>
        )}
      </div>
      {pageCount > 0 ? (
        <p className="muted viewer__pdf-caption" aria-hidden="true">
          Page {currentPage} of {pageCount}
        </p>
      ) : null}
    </>
  );
}
