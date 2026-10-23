import { open, unlink } from 'node:fs/promises';
import { loadDossierAuthoringDirectory } from './authoring-loader';
import { encryptDossierPack, fingerprintDossierPdf } from './pack-container';

export interface DossierPackageBuildResult {
  ok: boolean;
  pack?: Buffer;
  recordCount?: number;
  errors: string[];
}

export interface DossierPackageWriteResult {
  ok: boolean;
  outputPath?: string;
  recordCount?: number;
  errors: string[];
}

/** Compiles approved local YAML records directly into an opaque release pack. */
export async function buildEncryptedDossierPack(
  authoringDirectory: string,
  pdfBytes: Uint8Array,
): Promise<DossierPackageBuildResult> {
  let expectedFingerprint: string;
  try {
    expectedFingerprint = fingerprintDossierPdf(pdfBytes);
  } catch {
    return { ok: false, errors: ['source PDF is invalid or exceeds the supported size'] };
  }

  const loaded = await loadDossierAuthoringDirectory(authoringDirectory, expectedFingerprint);
  if (!loaded.ok || !loaded.releaseReady || !loaded.payload) {
    return {
      ok: false,
      ...(loaded.recordCount === undefined ? {} : { recordCount: loaded.recordCount }),
      errors: loaded.errors.length > 0 ? loaded.errors : ['dossier is not approved for release'],
    };
  }

  try {
    const pack = encryptDossierPack(loaded.payload, pdfBytes, expectedFingerprint);
    return { ok: true, pack, recordCount: loaded.payload.records.length, errors: [] };
  } catch {
    return { ok: false, errors: ['dossier could not be packaged for this source PDF'] };
  }
}

/** Writes ciphertext only; refuses overwrite and removes a partial file on failure. */
export async function writeEncryptedDossierPack(
  authoringDirectory: string,
  pdfBytes: Uint8Array,
  outputPath: string,
): Promise<DossierPackageWriteResult> {
  if (!outputPath.toLowerCase().endsWith('.stpack')) {
    return { ok: false, errors: ['release pack output must use the .stpack extension'] };
  }

  const built = await buildEncryptedDossierPack(authoringDirectory, pdfBytes);
  if (!built.ok || !built.pack) {
    return { ok: false, ...(built.recordCount === undefined ? {} : { recordCount: built.recordCount }), errors: built.errors };
  }

  let created = false;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(outputPath, 'wx', 0o600);
    created = true;
    await handle.writeFile(built.pack);
    await handle.sync();
    await handle.close();
    handle = undefined;
    return { ok: true, outputPath, recordCount: built.recordCount, errors: [] };
  } catch {
    await handle?.close().catch(() => undefined);
    if (created) await unlink(outputPath).catch(() => undefined);
    return { ok: false, errors: ['could not write the encrypted release pack'] };
  }
}
