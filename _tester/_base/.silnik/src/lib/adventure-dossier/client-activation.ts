import { loadAuthoredPrabutyEdition, activateAuthoredPrabutySession } from './authored-client';
import { initializeDossierActors } from './actor-initialization';
import { fingerprintLocalPdf, openDossierInBrowser } from './browser-pack';
import { loadLocalDossier } from './local-library';
import type { DossierRagPayload } from './rag-schema';

export interface DossierClientActivationInput {
  sessionId: string;
  adventureId: string;
  expectedFingerprint: string;
  sourcePdf: File;
  encryptedPack: Blob;
}

export type DossierClientActivationResult =
  | { ok: true }
  | { ok: false; reason: 'pdf_mismatch' | 'activation_failed' | 'local_runtime_required' };

export interface PreparedDossierPack {
  adventureId: string;
  expectedFingerprint: string;
  sourcePdf: File;
  encryptedPack: Blob;
}

export type DossierPackLookupResult =
  | { ok: true; prepared: PreparedDossierPack }
  | { ok: false; reason: 'pack_not_found' | 'lookup_failed' };

/** Opaque lookup key also used by the local release publisher. */
export async function dossierPackKey(adventureId: string, fingerprint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${adventureId}\0${fingerprint}`));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export function hasLocalDossierRuntime(): boolean {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname);
}

// Plaintext lasts only for the current page. IndexedDB retains PDF + ciphertext.
let opened: { prepared: PreparedDossierPack; payload: DossierRagPayload } | null = null;
export async function openPreparedDossier(prepared: PreparedDossierPack): Promise<DossierRagPayload> {
  if (opened?.prepared === prepared) return opened.payload;
  const payload = await openDossierInBrowser(prepared.sourcePdf, prepared.encryptedPack, prepared.expectedFingerprint);
  if (payload.adventure_id !== prepared.adventureId) throw new Error('DOSSIER_PACK_REJECTED');
  opened = { prepared, payload };
  return payload;
}

export async function restorePreparedDossier(adventureId: string, fingerprint: string): Promise<PreparedDossierPack | null> {
  if (opened?.prepared.adventureId === adventureId && opened.prepared.expectedFingerprint === fingerprint) return opened.prepared;
  return loadLocalDossier(adventureId, fingerprint);
}

/** Finds a release pack by exact local PDF fingerprint; the path contains no title or record data. */
export async function findReleasedDossierPack(
  adventureId: string,
  sourcePdf: File,
  fetcher: typeof fetch = fetch,
): Promise<DossierPackLookupResult> {
  if (!adventureId.trim()) return { ok: false, reason: 'lookup_failed' };
  try {
    const digest = await fingerprintLocalPdf(sourcePdf);
    const packKey = await dossierPackKey(adventureId, digest);
    const response = await fetcher(
      `/adventure-dossier-packs/${packKey}.stpack`,
      { method: 'GET', cache: 'no-store' },
    );
    if (response.status === 404) return { ok: false, reason: 'pack_not_found' };
    if (!response.ok) return { ok: false, reason: 'lookup_failed' };
    const encryptedPack = await response.blob();
    if (encryptedPack.size === 0 || encryptedPack.size > 32 * 1024 * 1024) {
      return { ok: false, reason: 'lookup_failed' };
    }
    return {
      ok: true,
      prepared: {
        adventureId,
        expectedFingerprint: digest,
        sourcePdf,
        encryptedPack,
      },
    };
  } catch {
    return { ok: false, reason: 'lookup_failed' };
  }
}

/** Only approved operational data goes to the loopback app process. Never PDF/OCR/handout bytes. */
export async function activateLocalDossierPack(
  input: DossierClientActivationInput,
  fetcher: typeof fetch = fetch,
): Promise<DossierClientActivationResult> {
  if (!hasLocalDossierRuntime()) return { ok: false, reason: 'local_runtime_required' };
  try {
    const payload = await openPreparedDossier(input);
    const response = await fetcher('/api/adventure-dossier/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: input.sessionId, adventureId: input.adventureId,
        editionFingerprint: input.expectedFingerprint, payload }),
    });
    if (!response.ok) return { ok: false, reason: 'activation_failed' };
    const result = await response.json().catch(() => null);
    if (result?.success !== true || result?.activated !== true) return {ok:false,reason:'activation_failed'};
    initializeDossierActors({payload,sessionId:input.sessionId,adventureId:input.adventureId,
      editionFingerprint:input.expectedFingerprint,now:new Date(),storage:window.localStorage});
    return {ok:true};
  } catch { return { ok: false, reason: 'activation_failed' }; }
}

/** Rebinds the locally stored edition after refresh or a restart/expiry of the local RAG process. */
export async function ensureLocalDossierSession(
  sessionId: string, adventureId: string, expectedFingerprint: string,
): Promise<DossierClientActivationResult> {
  if (!hasLocalDossierRuntime()) return { ok: false, reason: 'local_runtime_required' };
  try {
    const authored = await activateAuthoredPrabutySession(sessionId, adventureId, expectedFingerprint);
    if (authored) return { ok: true };
    const params = new URLSearchParams({ sessionId, adventureId, editionFingerprint: expectedFingerprint });
    const response = await fetch(`/api/adventure-dossier/activate?${params}`, { cache: 'no-store' });
    const active=response.ok && (await response.json()).activated === true;
    const prepared = await restorePreparedDossier(adventureId, expectedFingerprint);
    if (!prepared) return { ok: false, reason: 'activation_failed' };
    if(active) {
      const payload=await openPreparedDossier(prepared);
      initializeDossierActors({payload,sessionId,adventureId,editionFingerprint:expectedFingerprint,
        now:new Date(),storage:window.localStorage});
      return {ok:true};
    }
    return activateLocalDossierPack({ ...prepared, sessionId });
  } catch { return { ok: false, reason: 'activation_failed' }; }
}

/** Resolves the active local edition without treating authored data as a purchased PDF. */
export async function loadRuntimeDossierPayload(adventureId: string, fingerprint: string): Promise<DossierRagPayload> {
  const authored = await loadAuthoredPrabutyEdition(adventureId, fingerprint);
  if (authored) return authored.payload;
  const prepared = await restorePreparedDossier(adventureId, fingerprint);
  if (!prepared) throw new Error('DOSSIER_SESSION_UNAVAILABLE');
  return openPreparedDossier(prepared);
}
