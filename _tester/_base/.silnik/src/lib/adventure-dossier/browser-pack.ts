import { isIndexableDossierRecord, validateDossierRagPayload, type DossierRagPayload } from './rag-schema';

const MAX_PDF_BYTES = 250 * 1024 * 1024;
const MAX_PACK_BYTES = 32 * 1024 * 1024;
const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;
const HEADER_BYTES = 49;

export async function fingerprintLocalPdf(pdf: Blob): Promise<string> {
  if (!pdf.size || pdf.size > MAX_PDF_BYTES) throw new Error('DOSSIER_PDF_INVALID');
  const header = await pdf.slice(0, 1024).text();
  if (!/%PDF-\d\.\d/.test(header)) throw new Error('DOSSIER_PDF_INVALID');
  const digest = await crypto.subtle.digest('SHA-256', await pdf.arrayBuffer());
  return `sha256:${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Same STDP v1 format as the authoring packer. PDF bytes never cross the browser boundary. */
export async function openDossierInBrowser(
  pdf: Blob, encryptedPack: Blob, expectedFingerprint: string,
): Promise<DossierRagPayload> {
  try {
    if (await fingerprintLocalPdf(pdf) !== expectedFingerprint) throw new Error();
    if (encryptedPack.size <= HEADER_BYTES || encryptedPack.size > MAX_PACK_BYTES) throw new Error();
    const pack = new Uint8Array(await encryptedPack.arrayBuffer());
    if (new TextDecoder().decode(pack.slice(0, 4)) !== 'STDP' || pack[4] !== 1) throw new Error();
    const material = await crypto.subtle.importKey('raw', await pdf.arrayBuffer(), 'HKDF', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({
      name: 'HKDF', hash: 'SHA-256', salt: pack.slice(5, 21),
      info: new TextEncoder().encode('straznik-tajemnic/adventure-dossier/schema-v1'),
    }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    // Node's container stores tag before ciphertext; WebCrypto expects it after ciphertext.
    const ciphertext = new Uint8Array(pack.length - 33);
    ciphertext.set(pack.subarray(HEADER_BYTES));
    ciphertext.set(pack.subarray(33, HEADER_BYTES), pack.length - HEADER_BYTES);
    const compressed = await crypto.subtle.decrypt({
      name: 'AES-GCM', iv: pack.slice(21, 33), additionalData: pack.slice(0, 5), tagLength: 128,
    }, key, ciphertext);
    const reader = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_PAYLOAD_BYTES) { await reader.cancel(); throw new Error(); }
        chunks.push(new Uint8Array(value));
      }
    } finally { reader.releaseLock(); }
    const result = validateDossierRagPayload(JSON.parse(await new Blob(chunks).text()));
    if (!result.ok || !result.payload || result.payload.edition_fingerprint !== expectedFingerprint ||
      !result.payload.records.length || !result.payload.records.every(isIndexableDossierRecord)) throw new Error();
    return result.payload;
  } catch { throw new Error('DOSSIER_PACK_REJECTED'); }
}
