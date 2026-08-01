"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createSignedUrl } from "@/lib/storage";

/**
 * Renders a PDF document from its storage path. Fetches a signed URL client
 * side (so the request — and the service worker's offline manuals cache —
 * see the real Supabase Storage response) then embeds it in an iframe.
 */
export function PdfViewer({ storagePath, title }: { storagePath: string; title: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    async function load() {
      const supabase = createClient();
      const signedUrl = await createSignedUrl(supabase, storagePath);
      if (cancelled) return;
      if (!signedUrl) {
        setError(true);
      } else {
        setUrl(signedUrl);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  if (loading) {
    return <p className="hint">Loading {title}…</p>;
  }

  if (error || !url) {
    return <p className="hint">We couldn&apos;t open this document. Try again shortly.</p>;
  }

  return (
    <div style={{ display: "grid", gap: "10px" }}>
      <iframe title={title} src={url} className="pdf-frame" />
      <a href={url} target="_blank" rel="noreferrer" className="text-link">
        Open in a new tab
      </a>
    </div>
  );
}
