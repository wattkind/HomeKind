/**
 * pdf.js entry, loaded only through a dynamic `import()` from PdfPages so the
 * library lands in its own chunk and the main bundle does not grow.
 *
 * The legacy build is used on purpose: the modern build calls very new APIs
 * (for example `Map.prototype.getOrInsertComputed`) that iOS WebKit does not
 * ship yet, while the legacy build carries its own polyfills.
 *
 * The worker is bundled by Vite (`?url`) and served from the app itself. No CDN,
 * no network: documents are always loaded from bytes already on the phone.
 */
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerSrc;

export { getDocument };
export type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
