import type { DossierRagPayload, DossierRagRecord } from './rag-schema';

// Next route bundles must recognize the exact same enrolled object. This versioned
// process/page capability stays weak, private and never serialized.
const authorizationRegistryKey = Symbol.for('straznik.adventure-dossier.local-draft-records.v1');
const processRegistry = globalThis as typeof globalThis & {
  [authorizationRegistryKey]?: WeakSet<DossierRagRecord>;
};
const localDraftRecords = processRegistry[authorizationRegistryKey] ?? new WeakSet<DossierRagRecord>();
if (!processRegistry[authorizationRegistryKey]) {
  Object.defineProperty(processRegistry, authorizationRegistryKey, { value: localDraftRecords });
}

/** Runtime permission only. Release packaging keeps using isIndexableDossierRecord. */
export function isRuntimeAuthorizedDossierRecord(record: DossierRagRecord): boolean {
  // Keep this strict branch equivalent to rag-schema's release predicate. A runtime
  // schema import here would cycle through the schema's actor-transition validator.
  return (record.evidence.status === 'set' && record.evidence.approval === 'approved') ||
    localDraftRecords.has(record);
}

function jsonCopy(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(object[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

/**
 * Version of operational JSON, including evidence, bindings and conditions.
 * Only the top-level and per-record edition_fingerprint fields are normalized to
 * empty strings to avoid a self-referential hash. Object keys sort recursively;
 * array order and every other value retain their JSON transport semantics.
 */
export async function fingerprintLocalDraftPayload(payload: DossierRagPayload): Promise<string> {
  const copy = jsonCopy(payload) as DossierRagPayload;
  if (!copy || typeof copy !== 'object' || !Array.isArray(copy.records) ||
    copy.records.some(record => !record || typeof record !== 'object' || Array.isArray(record))) {
    throw new Error('DOSSIER_LOCAL_DRAFT_INVALID');
  }
  copy.edition_fingerprint = '';
  for (const record of copy.records) record.edition_fingerprint = '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(copy)));
  return 'sha256:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function freezeJson(value: unknown): void {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeJson(child);
    Object.freeze(value);
  }
}

/**
 * INTERNAL enrollment after a trusted fixed local author factory, or its verified
 * loopback response. A matching hash proves integrity, not the source's authority:
 * never call this for arbitrary uploaded JSON, paths, saves or released PDF packs.
 * Callers enforce local-only access and bind the returned version to a campaign.
 * Returns a fresh frozen copy; JSON roundtrips must re-fetch/re-enroll trusted data.
 */
export async function authorizeLocalDraftPayload(input: unknown, expected: {
  adventureId: string; editionFingerprint: string;
}): Promise<DossierRagPayload> {
  // Capture before the first await; callers cannot mutate records while hashing.
  const copy = jsonCopy(input);
  const { validateDossierRagPayload } = await import('./rag-schema');
  const validation = validateDossierRagPayload(copy);
  if (!validation.ok || !validation.payload || !/^sha256:[a-f0-9]{64}$/.test(expected.editionFingerprint)) {
    throw new Error('DOSSIER_LOCAL_DRAFT_INVALID');
  }
  const payload = validation.payload;
  if (payload.adventure_id !== expected.adventureId || payload.edition_fingerprint !== expected.editionFingerprint ||
    !payload.records.length || payload.records.some(record => record.adventure_id !== expected.adventureId ||
      record.edition_fingerprint !== expected.editionFingerprint || record.evidence.status !== 'set')) {
    throw new Error('DOSSIER_LOCAL_DRAFT_BINDING');
  }
  if (await fingerprintLocalDraftPayload(payload) !== expected.editionFingerprint) {
    throw new Error('DOSSIER_LOCAL_DRAFT_HASH');
  }
  freezeJson(payload);
  for (const record of payload.records) if (record.evidence.approval === 'pending') localDraftRecords.add(record);
  return payload;
}
