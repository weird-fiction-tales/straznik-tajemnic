import { isRuntimeAuthorizedDossierRecord } from './runtime-authorization';
import { mapDifficultyToRequired, meetsDifficulty } from '../dice-utils';
import type { SkillRollResolution, SkillTestData } from '../parsers/types';
import { normalizeDossierLocation } from './inventory-state';
import { isReviewedDossierCheck } from './reviewed-check';
import { type DossierRagPayload, type DossierWorldObjectBinding } from './rag-schema';

export interface DossierWorldStateBinding {
  playthroughId: string;
  adventureId: string;
  editionFingerprint: string;
}

export interface DossierWorldObjectEntry {
  entityId: string;
  state: string;
  updatedByTurnId?: string;
  lastTransitionId?: string;
  lastResolutionId?: string;
}

export interface DossierWorldState extends DossierWorldStateBinding {
  schemaVersion: 1;
  objects: DossierWorldObjectEntry[];
  appliedTurnIds: string[];
  /** Persisted consumption history; optional only for older saves. */
  usedResolutionIds?: string[];
}

export type DossierWorldStateProjection = DossierWorldStateBinding & {
  objects: Array<Pick<DossierWorldObjectEntry, 'entityId' | 'state'>>;
};

const id = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(value);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const storageKey = (playthroughId: string) => `zew-dossier-world-state:${playthroughId}`;
const bindingsFor = (payload: DossierRagPayload) => payload.records.flatMap(record => {
  if (!record.world_object_binding || !isRuntimeAuthorizedDossierRecord(record)) return [];
  return [
    { record, binding: record.world_object_binding },
    ...(record.world_object_binding.instances ?? []).map(binding => ({ record, binding })),
  ];
});

export function isDossierWorldState(value: unknown): value is DossierWorldState {
  if (!object(value) || value.schemaVersion !== 1 || !id(value.playthroughId) || !id(value.adventureId) ||
    typeof value.editionFingerprint !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value.editionFingerprint) ||
    !Array.isArray(value.objects) || value.objects.length > 256 || !Array.isArray(value.appliedTurnIds) ||
    value.appliedTurnIds.length > 10000 || !value.appliedTurnIds.every(id) || new Set(value.appliedTurnIds).size !== value.appliedTurnIds.length) return false;
  if (value.usedResolutionIds !== undefined && (!Array.isArray(value.usedResolutionIds) ||
    value.usedResolutionIds.length > 10000 || !value.usedResolutionIds.every(id) ||
    new Set(value.usedResolutionIds).size !== value.usedResolutionIds.length)) return false;
  return value.objects.every(entry => object(entry) && id(entry.entityId) && id(entry.state) &&
    (entry.updatedByTurnId === undefined || id(entry.updatedByTurnId)) &&
    (entry.lastTransitionId === undefined || id(entry.lastTransitionId)) &&
    (entry.lastResolutionId === undefined || id(entry.lastResolutionId))) &&
    new Set(value.objects.map(entry => (entry as DossierWorldObjectEntry).entityId)).size === value.objects.length;
}

export function isDossierWorldStateProjection(value: unknown): value is DossierWorldStateProjection {
  if (!object(value) || !id(value.playthroughId) || !id(value.adventureId) ||
    typeof value.editionFingerprint !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value.editionFingerprint) ||
    !Array.isArray(value.objects) || value.objects.length > 256) return false;
  return value.objects.every(entry => object(entry) && id(entry.entityId) && id(entry.state) &&
    Object.keys(entry).every(key => key === 'entityId' || key === 'state')) &&
    new Set(value.objects.map(entry => (entry as DossierWorldObjectEntry).entityId)).size === value.objects.length;
}

export function isDossierWorldStateForPayload(value: unknown, payload: DossierRagPayload): value is DossierWorldStateProjection {
  if (!isDossierWorldStateProjection(value) || value.adventureId !== payload.adventure_id ||
    value.editionFingerprint !== payload.edition_fingerprint) return false;
  const definitions = new Map(bindingsFor(payload).map(({ binding }) => [binding.entity_id, binding]));
  return value.objects.length === definitions.size && value.objects.every(entry => {
    const definition = definitions.get(entry.entityId);
    return !!definition && definition.states.includes(entry.state);
  });
}

export function projectDossierWorldState(state: DossierWorldState): DossierWorldStateProjection {
  return {
    playthroughId: state.playthroughId,
    adventureId: state.adventureId,
    editionFingerprint: state.editionFingerprint,
    objects: state.objects.map(({ entityId, state: value }) => ({ entityId, state: value })),
  };
}

function compactWorldState(state:DossierWorldState):DossierWorldState {
 return {schemaVersion:1,playthroughId:state.playthroughId,adventureId:state.adventureId,editionFingerprint:state.editionFingerprint,
  objects:state.objects.map(o=>({entityId:o.entityId,state:o.state,
   ...(o.updatedByTurnId?{updatedByTurnId:o.updatedByTurnId}:{}),...(o.lastTransitionId?{lastTransitionId:o.lastTransitionId}:{}),
   ...(o.lastResolutionId?{lastResolutionId:o.lastResolutionId}:{})})),appliedTurnIds:[...state.appliedTurnIds],
  ...(state.usedResolutionIds?{usedResolutionIds:[...state.usedResolutionIds]}:{})};
}

export function loadDossierWorldState(binding: DossierWorldStateBinding, payload: DossierRagPayload): DossierWorldState {
  if (typeof window === 'undefined') return emptyDossierWorldState(binding, payload);
  const raw = window.localStorage.getItem(storageKey(binding.playthroughId));
  if (!raw) return emptyDossierWorldState(binding, payload);
  const parsed: unknown = JSON.parse(raw);
  if (!isDossierWorldState(parsed) || parsed.playthroughId !== binding.playthroughId ||
    parsed.adventureId !== binding.adventureId || parsed.editionFingerprint !== binding.editionFingerprint ||
    !isDossierWorldStateForPayload(projectDossierWorldState(parsed), payload)) throw new Error('DOSSIER_WORLD_STATE_INVALID');
  return compactWorldState(parsed);
}

/** Seeds only explicit initial states. Future events are never executed during import. */
export function emptyDossierWorldState(binding: DossierWorldStateBinding, payload: DossierRagPayload): DossierWorldState {
  if (binding.adventureId !== payload.adventure_id || binding.editionFingerprint !== payload.edition_fingerprint) {
    throw new Error('DOSSIER_WORLD_STATE_EDITION_MISMATCH');
  }
  const objects = bindingsFor(payload).map(({ binding: def }) => ({ entityId: def.entity_id, state: def.initial_state }));
  if (new Set(objects.map(entry => entry.entityId)).size !== objects.length) throw new Error('DOSSIER_WORLD_STATE_DUPLICATE_OBJECT');
  return { schemaVersion: 1, playthroughId:binding.playthroughId,adventureId:binding.adventureId,editionFingerprint:binding.editionFingerprint, objects, appliedTurnIds: [] };
}

/** Applies only explicit, authored transitions. Test-gated transitions require the matching local result in this turn. */
export function applyDossierWorldObjectTurn(input: {
  payload: DossierRagPayload;
  state: DossierWorldState;
  turnId: string;
  rawText: string;
  location: string;
  writesAllowed: boolean;
  skillTests: SkillTestData[];
  skillRolls: SkillRollResolution[];
}): { state: DossierWorldState; cleanText: string; changed: boolean; rejected: string[] } {
  const { payload, state, turnId } = input;
  if (!isDossierWorldState(state) || state.adventureId !== payload.adventure_id || state.editionFingerprint !== payload.edition_fingerprint) {
    throw new Error('DOSSIER_WORLD_STATE_INVALID');
  }
  if (!id(turnId)) throw new Error('DOSSIER_WORLD_STATE_INVALID_TURN');
  if (state.appliedTurnIds.includes(turnId)) {
    const cleanText = input.rawText.replace(/\[TECZKA_STANU:\s*([^|\]]+)\|([^\]]+)\]/gi, '').trimEnd();
    return { state, cleanText, changed: false, rejected: [] };
  }

  const definitions = new Map(bindingsFor(payload).map(({ binding }) => [binding.entity_id, binding]));
  const objects = new Map(state.objects.map(entry => [entry.entityId, { ...entry }]));
  const usedResolutions = new Set([...(state.usedResolutionIds ?? []),
    ...state.objects.flatMap(entry => entry.lastResolutionId ? [entry.lastResolutionId] : [])]);
  const rejected: string[] = [];
  let handled = false, changed = false;
  const cleanText = input.rawText.replace(/\[TECZKA_STANU:\s*([^|\]]+)\|([^\]]+)\]/gi, (_tag, rawEntity: string, rawTransition: string) => {
    handled = true;
    const entityId = rawEntity.trim(), transitionId = rawTransition.trim();
    const definition = definitions.get(entityId);
    const record = bindingsFor(payload).find(candidate => candidate.binding.entity_id === entityId)?.record;
    const current = objects.get(entityId);
    const transition = definition?.transitions.find(candidate => candidate.id === transitionId);
    if (!input.writesAllowed || !definition || !record || !current || !transition || current.state !== transition.from ||
      (transition.requires ?? []).some(requirement => objects.get(requirement.entity_id)?.state !== requirement.state) ||
      (transition.access_check !== undefined && (!isReviewedDossierCheck(transition.access_check) || transition.condition_id !== transition.access_check.id)) ||
      (record.tags.scenes.length > 0 && !record.tags.scenes.some(scene => normalizeDossierLocation(scene) === normalizeDossierLocation(input.location)))) {
      rejected.push(entityId || 'unknown-object');
      return '';
    }

    let resolutionId: string | undefined;
    if (transition.condition_id) {
      const check=transition.access_check;
      const owners=bindingsFor(payload).flatMap(owner=>owner.binding.transitions
        .filter(candidate=>candidate.condition_id===transition.condition_id)
        .map(candidate=>({...owner,transition:candidate})));
      const sharedWithOtherAdapter=payload.records.some(candidate=>
        candidate.inventory_item?.access_check?.id===transition.condition_id ||
        candidate.actor_binding?.transitions?.some(candidateTransition=>candidateTransition.access_check?.id===transition.condition_id));
      if(!isReviewedDossierCheck(check) || check.id!==transition.condition_id ||
        record.adventure_id!==payload.adventure_id || record.edition_fingerprint!==payload.edition_fingerprint ||
        (record.evidence.approval === 'approved' && (!record.evidence.approved_by?.trim() || !record.evidence.approved_at || !Number.isFinite(Date.parse(record.evidence.approved_at)))) ||
        owners.length!==1 || owners[0].record.record_id!==record.record_id || owners[0].binding.entity_id!==entityId ||
        owners[0].transition.id!==transitionId || sharedWithOtherAdapter) {
        rejected.push(entityId);
        return '';
      }
      const eligibleTests = input.skillTests.filter(test => test.dossierConditionId === transition.condition_id);
      const results = eligibleTests.flatMap(test => {
        if (!id(test.id) || !id(test.characterId) || test.combined) return [];
        const requiredDifficulty = mapDifficultyToRequired(test.difficulty);
        if(test.targetNpcId!==undefined || !check.skill_names.includes(test.skillName) || requiredDifficulty!==check.difficulty) return [];
        return input.skillRolls.filter(roll => roll.testId === test.id &&
          roll.characterId === test.characterId && id(roll.resolutionId) &&
          roll.targetNpcId === test.targetNpcId &&
          roll.skillNames.length === 1 && roll.skillNames[0] === test.skillName &&
          roll.requiredDifficulty === requiredDifficulty && roll.passedRequirement === true &&
          meetsDifficulty(roll.outcome, requiredDifficulty)).map(roll => ({ test, roll }));
      });
      if (eligibleTests.length !== 1 || results.length !== 1) {
        rejected.push(entityId);
        return '';
      }
      resolutionId = results[0].roll.resolutionId;
      if (!resolutionId || usedResolutions.has(resolutionId) || usedResolutions.size >= 10000) {
        rejected.push(entityId);
        return '';
      }
      usedResolutions.add(resolutionId);
    }

    objects.set(entityId, {
      entityId,
      state: transition.to,
      updatedByTurnId: turnId,
      lastTransitionId: transition.id,
      ...(resolutionId ? { lastResolutionId: resolutionId } : {}),
    });
    changed = true;
    return '';
  });

  const nextState: DossierWorldState = {
    ...state,
    objects: [...objects.values()],
    usedResolutionIds: [...usedResolutions],
    appliedTurnIds: handled ? [...state.appliedTurnIds, turnId] : state.appliedTurnIds,
  };
  return { state: nextState, cleanText: handled ? cleanText.trimEnd() : cleanText, changed, rejected };
}

/** Projects the compact current state into a local save; no authored facts or source text are copied. */
export function readDossierWorldStateForSave(playthroughId?: string): DossierWorldState | undefined {
  if (!playthroughId || typeof window === 'undefined') return undefined;
  const raw = window.localStorage.getItem(storageKey(playthroughId));
  if (!raw) return undefined;
  const parsed: unknown = JSON.parse(raw);
  if (!isDossierWorldState(parsed) || parsed.playthroughId !== playthroughId) throw new Error('DOSSIER_WORLD_STATE_INVALID');
  return compactWorldState(parsed);
}

export function storeDossierWorldState(state: DossierWorldState): void {
  if (!isDossierWorldState(state)) throw new Error('DOSSIER_WORLD_STATE_INVALID');
  const serialized = JSON.stringify(compactWorldState(state));
  if (serialized.length > 256 * 1024) throw new Error('DOSSIER_WORLD_STATE_TOO_LARGE');
  window.localStorage.setItem(storageKey(state.playthroughId), serialized);
}

export function getDossierWorldObjectBindings(payload: DossierRagPayload): DossierWorldObjectBinding[] {
  return bindingsFor(payload).map(({ binding }) => binding);
}
