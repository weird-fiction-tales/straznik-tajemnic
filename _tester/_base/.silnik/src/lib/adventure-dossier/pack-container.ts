import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import {
  isIndexableDossierRecord,
  validateDossierRagPayload,
  type DossierRagPayload,
} from './rag-schema';

const MAGIC = Buffer.from('STDP', 'ascii');
const VERSION = 1;
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const HEADER_BYTES = MAGIC.length + 1 + SALT_BYTES + NONCE_BYTES + TAG_BYTES;
const MAX_PDF_BYTES = 250 * 1024 * 1024;
const MAX_CONTAINER_BYTES = 32 * 1024 * 1024;
const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;
const KDF_CONTEXT = Buffer.from('straznik-tajemnic/adventure-dossier/schema-v1', 'utf8');

export function fingerprintDossierPdf(pdfBytes: Uint8Array): string {
  if (!pdfBytes || typeof pdfBytes !== 'object' || pdfBytes.length === 0 || pdfBytes.length > MAX_PDF_BYTES) {
    throw new DossierPackError();
  }
  const header = Buffer.from(pdfBytes).subarray(0, 1024).toString('latin1');
  if (!/%PDF-\d\.\d/.test(header)) throw new DossierPackError();
  return `sha256:${createHash('sha256').update(pdfBytes).digest('hex')}`;
}

export class DossierPackError extends Error {
  constructor() {
    super('Adventure dossier pack could not be opened or does not match this PDF.');
    this.name = 'DossierPackError';
  }
}

function fingerprintPdf(pdfBytes: Uint8Array): string {
  return fingerprintDossierPdf(pdfBytes);
}

function assertPdf(pdfBytes: Uint8Array, expectedFingerprint: string): void {
  if (
    !pdfBytes ||
    typeof pdfBytes !== 'object' ||
    pdfBytes.length === 0 ||
    pdfBytes.length > MAX_PDF_BYTES ||
    !expectedFingerprint ||
    fingerprintPdf(pdfBytes) !== expectedFingerprint
  ) {
    throw new DossierPackError();
  }
}

function deriveKey(pdfBytes: Uint8Array, salt: Uint8Array): Buffer {
  return Buffer.from(hkdfSync('sha256', pdfBytes, salt, KDF_CONTEXT, KEY_BYTES));
}

function isFullyApprovedPayload(value: unknown): value is DossierRagPayload {
  const validation = validateDossierRagPayload(value);
  return Boolean(
    validation.ok &&
      validation.payload &&
      validation.payload.records.length > 0 &&
      validation.payload.records.every(isIndexableDossierRecord),
  );
}

/** Encrypts an approved, authored dossier payload without writing plaintext to disk. */
export function encryptDossierPack(
  payload: unknown,
  pdfBytes: Uint8Array,
  expectedFingerprint: string,
): Buffer {
  assertPdf(pdfBytes, expectedFingerprint);
  if (!isFullyApprovedPayload(payload) || payload.edition_fingerprint !== expectedFingerprint) {
    throw new DossierPackError();
  }

  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  if (plaintext.length > MAX_PAYLOAD_BYTES) throw new DossierPackError();

  const salt = randomBytes(SALT_BYTES);
  const nonce = randomBytes(NONCE_BYTES);
  const aad = Buffer.concat([MAGIC, Buffer.from([VERSION])]);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(pdfBytes, salt), nonce);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(gzipSync(plaintext)), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([aad, salt, nonce, tag, ciphertext]);
}

/** Decrypts and validates a pack in memory; failures intentionally reveal no mismatch detail. */
export function decryptDossierPack(
  container: Uint8Array,
  pdfBytes: Uint8Array,
  expectedFingerprint: string,
): DossierRagPayload {
  try {
    assertPdf(pdfBytes, expectedFingerprint);
    const pack = Buffer.from(container);
    if (
      !container ||
      typeof container !== 'object' ||
      pack.length < HEADER_BYTES + 1 ||
      pack.length > MAX_CONTAINER_BYTES ||
      !pack.subarray(0, MAGIC.length).equals(MAGIC) ||
      pack[4] !== VERSION
    ) {
      throw new DossierPackError();
    }

    const saltStart = MAGIC.length + 1;
    const nonceStart = saltStart + SALT_BYTES;
    const tagStart = nonceStart + NONCE_BYTES;
    const ciphertextStart = tagStart + TAG_BYTES;
    const salt = pack.subarray(saltStart, nonceStart);
    const nonce = pack.subarray(nonceStart, tagStart);
    const tag = pack.subarray(tagStart, ciphertextStart);
    const ciphertext = pack.subarray(ciphertextStart);
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(pdfBytes, salt), nonce);
    decipher.setAAD(Buffer.concat([MAGIC, Buffer.from([VERSION])]));
    decipher.setAuthTag(tag);
    const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const plaintext = gunzipSync(compressed, { maxOutputLength: MAX_PAYLOAD_BYTES });
    const decoded: unknown = JSON.parse(plaintext.toString('utf8'));
    if (!isFullyApprovedPayload(decoded) || decoded.edition_fingerprint !== expectedFingerprint) {
      throw new DossierPackError();
    }
    return decoded;
  } catch {
    throw new DossierPackError();
  }
}
