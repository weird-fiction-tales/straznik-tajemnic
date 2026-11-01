import { isRuntimeAuthorizedDossierRecord } from './runtime-authorization';
import type { DossierRagRecord } from './rag-schema';

/** A bounded projection of the existing NPC manager, never another NPC store. */
export interface DossierActorObservation {
  id: string;
  name: string;
  status?: 'alive' | 'dead' | 'unknown';
  hp?: number;
  location?: string;
  locationId?: string;
  disposition?: 'friendly' | 'neutral' | 'suspicious' | 'hostile' | 'fanatical';
  relationshipWithPlayer?: string;
  /** Existing campaign effects, projected as data; never inferred from narration. */
  statusEffects?: Array<{ id: string; name: string; type: string; description: string }>;
}

export interface BoundDossierActors {
  entityIdByRuntimeId: Map<string, string>;
  stateByEntityId: Map<string, DossierActorObservation>;
}

const exactName = (value: string) => value.trim().normalize('NFC').toLocaleLowerCase();
const shortText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;

/** Full, unique name or canonical ID only. Similar names never merge actors. */
export function bindDossierActors(
  records: DossierRagRecord[], observations: DossierActorObservation[],
): BoundDossierActors {
  const names = new Map<string, Set<string>>();
  const entityIds = new Set<string>();
  for (const record of records) {
    const binding = record.actor_binding;
    if (!binding || !isRuntimeAuthorizedDossierRecord(record)) continue;
    entityIds.add(binding.entity_id);
    const key = exactName(binding.name);
    const owners = names.get(key) ?? new Set<string>();
    owners.add(binding.entity_id);
    names.set(key, owners);
  }
  const candidates = new Map<string, DossierActorObservation[]>();
  const runtimeCounts = new Map<string, number>();
  for (const observation of observations.slice(0, 256)) {
    if (observation && shortText(observation.id, 250)) runtimeCounts.set(observation.id, (runtimeCounts.get(observation.id) ?? 0) + 1);
  }
  for (const observation of observations.slice(0, 256)) {
    if (!observation || !shortText(observation.id, 250) || !shortText(observation.name, 200)) continue;
    if (runtimeCounts.get(observation.id) !== 1) continue;
    const byName = names.get(exactName(observation.name));
    const entityId = entityIds.has(observation.id) ? observation.id : byName?.size === 1 ? [...byName][0] : undefined;
    if (!entityId) continue;
    const safe: DossierActorObservation = { id: observation.id, name: observation.name };
    if (['alive', 'dead', 'unknown'].includes(String(observation.status))) safe.status = observation.status;
    if (Number.isFinite(observation.hp) && observation.hp! >= 0 && observation.hp! <= 100000) safe.hp = observation.hp;
    if (shortText(observation.location, 250)) safe.location = observation.location;
    if (shortText(observation.locationId, 250)) safe.locationId = observation.locationId;
    if (['friendly', 'neutral', 'suspicious', 'hostile', 'fanatical'].includes(String(observation.disposition))) safe.disposition = observation.disposition;
    if (shortText(observation.relationshipWithPlayer, 1000)) safe.relationshipWithPlayer = observation.relationshipWithPlayer;
    if (Array.isArray(observation.statusEffects)) {
      safe.statusEffects = observation.statusEffects.slice(0, 32).flatMap(effect => {
        if (!effect || !shortText(effect.id, 200) || !shortText(effect.name, 200) ||
          !['injury', 'disease', 'madness', 'other'].includes(effect.type) ||
          typeof effect.description !== 'string' || effect.description.length > 1000) return [];
        return [{ id: effect.id, name: effect.name, type: effect.type, description: effect.description }];
      });
    }
    const list = candidates.get(entityId) ?? [];
    list.push(safe);
    candidates.set(entityId, list);
  }
  const result: BoundDossierActors = { entityIdByRuntimeId: new Map(), stateByEntityId: new Map() };
  // Two current NPC instances claiming one authored identity are a conflict.
  // Never pick one arbitrary state (or silently resurrect a dead duplicate).
  for (const [entityId, list] of candidates) {
    if (list.length !== 1) continue;
    result.entityIdByRuntimeId.set(list[0].id, entityId);
    result.stateByEntityId.set(entityId, list[0]);
  }
  return result;
}

export function renderDossierActorState(record: DossierRagRecord, actors?: BoundDossierActors): string {
  const states = record.tags.entities.flatMap(entityId => {
    const state = actors?.stateByEntityId.get(entityId);
    return state ? [{ entityId, ...state }] : [];
  });
  const actor = record.actor_binding && actors?.stateByEntityId.get(record.actor_binding.entity_id);
  const transitions = actor?.status === 'alive' ? (record.actor_binding?.transitions ?? []).filter(t =>
    actor.locationId === t.source_location_id && actor.statusEffects?.some(e => e.id === t.from_effect_id) &&
    !actor.statusEffects?.some(e => e.id === t.to_effect.id)) : [];
  const transitionNote = transitions.length ? '\nJawne propozycje zmiany stanu NPC: ' + JSON.stringify(transitions) +
    `. Po spełnieniu warunków użyj [TECZKA_STANU: ${record.actor_binding!.entity_id} | ID_PRZEJSCIA]. Jeśli przejście ma access_check, zleć test przez [TEST: ... | DOSSIER_ACCESS: ID_WARUNKU] z umiejętnością i trudnością z access_check; cel NPC przypisze aplikacja. Poczekaj na wynik rzutu. Kod sprawdzi stan, termin i wynik właściwego testu. Nie uznawaj zmiany za wykonaną na podstawie samej propozycji.` : '';
  return states.length ? '\nAktualny zapis NPC z kampanii: ' + JSON.stringify(states) +
    '. Ten zapis zastępuje początkowy stan tylko w podanych polach. Nie przywracaj martwej postaci ani poprzedniego położenia. Status unknown nie potwierdza życia ani śmierci. Informacja w karcie nie oznacza wiedzy Badaczy.' + transitionNote : '';
}
