import type { AdventureHandout } from '../adventures-data';
import { AUTHORED_SCENARIOS, authoredScenarioSource, isAuthoredAdventureId } from './authored-scenarios';
import type { DossierRagPayload } from './rag-schema';
import { isRuntimeAuthorizedDossierRecord } from './runtime-authorization';

/** Exact authored identities, never a fuzzy search or a PDF page locator. */
export function authoredPrabutyMediaId(reference: string): string | null {
  for (const [adventureId, profile] of Object.entries(AUTHORED_SCENARIOS)) {
    const handout = authoredScenarioSource(adventureId)?.handouts?.find(h => reference === h.slug || reference === `${profile.prefix}.media.${h.slug}`);
    if (handout) return `${profile.prefix}.media.${handout.slug}`;
  }
  return null;
}
export function resolveAuthoredPrabutyMedia(payload: DossierRagPayload, reference: string): AdventureHandout | null {
  if (!isAuthoredAdventureId(payload.adventure_id)) return null;
  const prefix = AUTHORED_SCENARIOS[payload.adventure_id].prefix;
  const recordId = authoredPrabutyMediaId(reference);
  const record = payload.records.find(r => r.record_id === recordId && r.record_type === 'media');
  if (!record || !isRuntimeAuthorizedDossierRecord(record) || record.edition_fingerprint !== payload.edition_fingerprint) return null;
  const handout = authoredScenarioSource(payload.adventure_id)?.handouts?.find(h => `${prefix}.media.${h.slug}` === recordId);
  if (!handout || handout.keeperOnly || handout.isPlayerFacing === false) return null;
  return { ...handout };
}

export function acquiredAuthoredMedia(text: string, eligibleIds: string[], payload: DossierRagPayload): string[] {
  return [...new Set([...text.matchAll(/\[HANDOUT:([^\]\s]+)\]/g)].flatMap(match => {
    const id = authoredPrabutyMediaId(match[1]);
    return id && eligibleIds.includes(id) && resolveAuthoredPrabutyMedia(payload, id) ? [id] : [];
  }))];
}
