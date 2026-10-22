import { acquiredAuthoredMedia } from './authored-media';
import type { DossierRagPayload } from './rag-schema';
import type { LocalDossierImage } from './local-library';

/** Decode only the authored image pages. No OCR, inferred crop, redraw, model or remote PDF upload. */
export async function extractLocalDossierImages(pdfFile: Blob, payload: DossierRagPayload): Promise<LocalDossierImage[]> {
  const records = payload.records.filter(r => r.local_handout);
  if (!records.length) return [];
  const { getDocumentProxy, extractImages, definePDFJSModule, getResolvedPDFJS } = await import('unpdf');
  // unpdf's reduced serverless bundle omits the JPX WASM loader. Use the matching full build,
  // served by this application, including its worker and OpenJPEG (no CDN requests).
  const moduleUrl = `${window.location.origin}/pdfjs/6.1.200/pdf.min.mjs`;
  await definePDFJSModule(() => import(/* webpackIgnore: true */ moduleUrl));
  const pdfjs = await getResolvedPDFJS();
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdfjs/6.1.200/pdf.worker.min.mjs`;
  const pdf = await getDocumentProxy(new Uint8Array(await pdfFile.arrayBuffer()), {
    isOffscreenCanvasSupported: false, isImageDecoderSupported: false,
    maxImageSize: 16777216, wasmUrl: `${window.location.origin}/pdfjs/6.1.200/`,
  });
  const images: LocalDossierImage[] = [];
  try {
    for (const page of [...new Set(records.map(r => r.local_handout!.pdf_page))]) {
      const extracted = await extractImages(pdf, page);
      for (const record of records.filter(r => r.local_handout!.pdf_page === page)) {
        const locator = record.local_handout!;
        let matched: Uint8ClampedArray<ArrayBuffer> | undefined;
        for (const image of extracted.filter(i => i.width === locator.width && i.height === locator.height)) {
          const rgba = new Uint8ClampedArray(image.width * image.height * 4);
          for (let p = 0; p < image.width * image.height; p++) {
            const s = p * image.channels, d = p * 4;
            rgba[d] = image.data[s];
            rgba[d + 1] = image.data[s + (image.channels === 1 ? 0 : 1)];
            rgba[d + 2] = image.data[s + (image.channels === 1 ? 0 : 2)];
            rgba[d + 3] = image.channels === 4 ? image.data[s + 3] : 255;
          }
          const digest = await crypto.subtle.digest('SHA-256', rgba);
          const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
          if (hash === locator.rgba_sha256) matched = rgba;
        }
        if (!matched) throw new Error('DOSSIER_HANDOUT_PIXEL_MISMATCH');
        const canvas = document.createElement('canvas');
        canvas.width = locator.width; canvas.height = locator.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('DOSSIER_HANDOUT_CANVAS_UNAVAILABLE');
        context.putImageData(new ImageData(matched, locator.width, locator.height), 0, 0);
        const image = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('DOSSIER_HANDOUT_EXPORT_FAILED')), 'image/png'));
        images.push({ recordId: record.record_id, image, title: locator.title, width: locator.width, height: locator.height });
      }
    }
    return images;
  } finally { await pdf.loadingTask.destroy(); }
}

export interface DossierHandoutBinding { adventureId: string; editionFingerprint: string }

/** A retrieved locator is not acquisition. Only an explicit GM handout tag can commit this party event. */
export function acquiredHandoutsFromTurn(text: string, eligibleIds: string[], payload: DossierRagPayload): string[] {
  const eligible = new Set(eligibleIds);
  const local = new Set(payload.records.filter(r => r.local_handout).map(r => r.record_id));
  const originals = [...new Set([...text.matchAll(/\[HANDOUT:([^\]\s]+)\]/g)].map(m => m[1]))]
    .filter(id => eligible.has(id) && local.has(id));
  return [...new Set([...originals, ...acquiredAuthoredMedia(text, eligibleIds, payload)])];
}
