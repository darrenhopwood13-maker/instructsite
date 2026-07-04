// Client-side PDF → per-page JPEG splitter using pdfjs-dist.
// Renders each page onto a canvas, then exports a JPEG Blob.

import * as pdfjs from "pdfjs-dist";
// pdfjs 6 ships an ESM worker; Vite serves it as a URL.
// eslint-disable-next-line import/no-unresolved
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

// Configure once.
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export type PdfPageImage = {
  pageNumber: number;
  blob: Blob;
  width: number;
  height: number;
};

/**
 * Explode a PDF file into per-page JPEG blobs on the main thread.
 * Uses a fixed render scale to keep title-block text legible for Gemini.
 */
export async function splitPdfToPageImages(
  file: File,
  opts: { scale?: number; quality?: number } = {},
): Promise<PdfPageImage[]> {
  const scale = opts.scale ?? 2.0;
  const quality = opts.quality ?? 0.85;
  const buf = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: buf });
  const pdf = await loadingTask.promise;
  const out: PdfPageImage[] = [];

  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");
      // Fill white background for JPEG (no alpha).
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // pdfjs 6: renderer takes { canvas, canvasContext, viewport }
      await page.render({ canvas, canvasContext: ctx, viewport } as never).promise;
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/jpeg",
          quality,
        );
      });
      out.push({ pageNumber: i, blob, width: canvas.width, height: canvas.height });
      // Free memory ASAP for large packs.
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }

  return out;
}
