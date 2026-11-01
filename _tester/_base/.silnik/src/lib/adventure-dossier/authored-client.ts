import type { DossierRagPayload } from './rag-schema';
import { isAuthoredAdventureId } from './authored-scenarios';
import { authorizeLocalDraftPayload } from './runtime-authorization';
import { initializeDossierActors } from './actor-initialization';

export interface AuthoredPlaytestEdition { adventureId: string; editionFingerprint: string; payload: DossierRagPayload }
const editions = new Map<string, AuthoredPlaytestEdition>();
const isLocal = () => typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname);

/** Fixed same-origin fixture only. Never restores GM plaintext or approval flags from a save. */
export async function loadAuthoredPrabutyEdition(adventureId: string, expectedFingerprint?: string): Promise<AuthoredPlaytestEdition | null> {
  if (!isLocal() || !isAuthoredAdventureId(adventureId)) return null;
  const cached = editions.get(adventureId);
  if (cached && expectedFingerprint === cached.editionFingerprint) return cached;
  const response = await fetch('/api/adventure-dossier/playtest?' + new URLSearchParams({ adventureId }), { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('LOCAL_PLAYTEST_UNAVAILABLE');
  const value: unknown = await response.json();
  if (!value || typeof value !== 'object') throw new Error('LOCAL_PLAYTEST_INVALID');
  const data = value as Record<string, unknown>;
  if (data.mode !== 'local_playtest' || data.humanApproval !== 'pending' || data.adventureId !== adventureId ||
    typeof data.editionFingerprint !== 'string') throw new Error('LOCAL_PLAYTEST_INVALID');
  if (expectedFingerprint && data.editionFingerprint !== expectedFingerprint) return null;
  const payload = await authorizeLocalDraftPayload(data.payload, { adventureId, editionFingerprint: data.editionFingerprint });
  const prepared = { adventureId, editionFingerprint: data.editionFingerprint, payload };
  editions.set(adventureId, prepared);
  return prepared;
}

export async function activateAuthoredPrabutySession(sessionId: string, adventureId: string, expectedFingerprint?: string, options?: { freshSession?: boolean }): Promise<AuthoredPlaytestEdition | null> {
  const prepared = await loadAuthoredPrabutyEdition(adventureId, expectedFingerprint);
  if (!prepared) return null;
  const params = new URLSearchParams({ sessionId, adventureId, editionFingerprint: prepared.editionFingerprint });
  const status = await fetch(`/api/adventure-dossier/activate?${params}`, { cache: 'no-store' });
  const active = status.ok && (await status.json()).activated === true;
  if (!active) {
    const response = await fetch('/api/adventure-dossier/playtest', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, adventureId, editionFingerprint: prepared.editionFingerprint }),
    });
    if (!response.ok || (await response.json()).activated !== true) throw new Error('LOCAL_PLAYTEST_ACTIVATION_FAILED');
  }
  initializeDossierActors({ payload: prepared.payload, sessionId, adventureId,
    editionFingerprint: prepared.editionFingerprint, freshSession: options?.freshSession, now: new Date(), storage: window.localStorage });
  return prepared;
}
