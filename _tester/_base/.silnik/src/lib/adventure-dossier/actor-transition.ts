import { isRuntimeAuthorizedDossierRecord } from './runtime-authorization';
import { normalizeDossierLocation } from './inventory-state';
import { isReviewedDossierCheck, type DossierItemAccessCheck } from './reviewed-check';
import type { GameTime, NPC } from '../types';
import type { SkillTestData, SkillRollResolution } from '../parsers/types';
import { mapDifficultyToRequired, meetsDifficulty } from '../dice-utils';
import { isGameTime } from '../time-manager';
import type { DossierRagRecord } from './rag-schema';

/** Authored data for an existing NPC, not a script or a second NPC store. */
export interface DossierActorTransition {
  id: string;
  from_effect_id: string;
  to_effect: { id: string; name: string; description: string };
  source_location_id: string;
  requires_presence?: boolean;
  result_status?: 'dead';
  target_location_id?: string;
  target_location_name?: string;
  access_check?: DossierItemAccessCheck;
  not_before?: GameTime;
}
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(v);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
export function isDossierActorTransition(v: unknown): v is DossierActorTransition {
  if (!object(v) || Object.keys(v).some(k => !['id','from_effect_id','to_effect','source_location_id','requires_presence','result_status','target_location_id','target_location_name','access_check','not_before'].includes(k))) return false;
  return (v.result_status === undefined || v.result_status === 'dead') && (v.requires_presence === undefined || v.requires_presence === true) && id(v.id) && id(v.from_effect_id) && id(v.source_location_id) && object(v.to_effect) &&
    Object.keys(v.to_effect).every(k => ['id','name','description'].includes(k)) &&
    id(v.to_effect.id) && v.to_effect.id !== v.from_effect_id && text(v.to_effect.name,200) && text(v.to_effect.description,1000) &&
    (v.target_location_id === undefined ? v.target_location_name === undefined : id(v.target_location_id) && text(v.target_location_name,250)) &&
    (v.access_check === undefined || isReviewedDossierCheck(v.access_check)) && (v.not_before === undefined || isGameTime(v.not_before));
}
export interface DossierActorInitialState {
  status: NPC['status'];
  location_id: string;
  location_name: string;
  effects: Array<{id:string;name:string;description:string}>;
  source_ref: string;
}
export function isDossierActorInitialState(v:unknown):v is DossierActorInitialState {
  return object(v) && Object.keys(v).every(k=>['status','location_id','location_name','effects','source_ref'].includes(k)) &&
    ['alive','dead','unknown'].includes(String(v.status)) && id(v.location_id) && text(v.location_name,250) && text(v.source_ref,1000) &&
    Array.isArray(v.effects) && v.effects.length<=32 && v.effects.every(e=>object(e) &&
      Object.keys(e).every(k=>['id','name','description'].includes(k)) && id(e.id) && text(e.name,200) && text(e.description,1000)) &&
    new Set(v.effects.map(e=>e.id)).size===v.effects.length;
}
type Actor = Pick<NPC,'id'|'status'|'locationId'|'location'|'statusEffects'|'tags'>;
/** Pure mutation proposal. The caller persists returned NPCs atomically via the existing save path. */
export function applyDossierActorTransition<T extends Actor>(input: {
  record: DossierRagRecord; npcs: T[]; entityId: string; transitionId: string;
  playthroughId: string; turnId: string; writesAllowed: boolean; now: Date;
  location?: string;
  gameTime: GameTime; skillTests: SkillTestData[]; skillRolls: SkillRollResolution[];
}): { npcs: T[]; applied: boolean; reason: string } {
  const reject = (reason: string) => ({npcs: input.npcs, applied:false, reason});
  const {record} = input;
  if (!input.writesAllowed || record.record_type !== 'actor' || !isRuntimeAuthorizedDossierRecord(record) ||
    (record.evidence.approval === 'approved' && (!record.evidence.approved_by || !record.evidence.approved_at)) || record.actor_binding?.entity_id !== input.entityId ||
    record.tags.entities.length !== 1 || record.tags.entities[0] !== input.entityId ||
    !id(input.playthroughId) || !id(input.turnId) || !Number.isFinite(input.now.getTime())) return reject('unauthorized');
  const candidates = record.actor_binding.transitions?.filter(t => t.id === input.transitionId) ?? [];
  if (candidates.length !== 1 || !isDossierActorTransition(candidates[0])) return reject('unknown-transition');
  const rule = candidates[0];
  const matches = input.npcs.filter(n => n.id === input.entityId);
  if (matches.length !== 1) return reject('ambiguous-or-missing-actor');
  const npc = matches[0];
  if (!Array.isArray(npc.tags) || !npc.tags.every(t => typeof t === 'string') || npc.tags.length >= 10000 || !Array.isArray(npc.statusEffects) || !npc.statusEffects.every(e => e && id(e.id))) return reject('invalid-actor-state');
  const eventKey = `dossier-event:${record.adventure_id}:${record.edition_fingerprint}:${input.playthroughId}:${input.turnId}:${rule.id}`;
  if (npc.tags.includes(eventKey)) return reject('replayed');
  if (npc.status !== 'alive' || npc.locationId !== rule.source_location_id ||
    npc.statusEffects.filter(e => e.id === rule.from_effect_id).length !== 1 ||
    npc.statusEffects.some(e => e.id === rule.to_effect.id)) return reject('state-precondition');
  if (rule.requires_presence && (!input.location ||
    ![rule.source_location_id,npc.location].some(location=>normalizeDossierLocation(location)===normalizeDossierLocation(input.location!)))) {
    return reject('actor-not-present');
  }
  if (rule.not_before) {
    if (!isGameTime(input.gameTime)) return reject('invalid-clock');
    const keys = ['year','month','day','hour','minute'] as const;
    const difference = keys.map(k => input.gameTime[k] - rule.not_before![k]).find(n => n !== 0) ?? 0;
    if (difference < 0) return reject('too-early');
  }
  if (rule.access_check) {
    const tests = input.skillTests.filter(t => t.dossierConditionId === rule.access_check!.id && t.targetNpcId === input.entityId);
    if (tests.length !== 1) return reject('missing-matching-test');
    const test = tests[0];
    if (!id(test.characterId) || test.combined) return reject('invalid-matching-test');
    const requiredDifficulty = mapDifficultyToRequired(test.difficulty);
    if (!rule.access_check.skill_names.includes(test.skillName) ||
      !meetsDifficulty(requiredDifficulty, rule.access_check.difficulty)) return reject('authored-check-mismatch');
    const rolls = input.skillRolls.filter(r => r.testId === tests[0].id && r.targetNpcId === input.entityId &&
      r.characterId === test.characterId && id(r.resolutionId) && r.requiredDifficulty === requiredDifficulty &&
      r.skillNames.length === 1 && r.skillNames[0] === test.skillName &&
      r.passedRequirement === true && meetsDifficulty(r.outcome, requiredDifficulty));
    if (rolls.length !== 1) return reject('missing-matching-success');
    const resolutionKey = `dossier-resolution:${record.adventure_id}:${record.edition_fingerprint}:${input.playthroughId}:${rolls[0].resolutionId}`;
    if (input.npcs.some(n => !Array.isArray(n.tags) || n.tags.includes(resolutionKey))) return reject('resolution-replayed');
    const updated = update(npc, rule, input.now, [eventKey,resolutionKey]);
    return {npcs:input.npcs.map(n => n === npc ? updated : n),applied:true,reason:'applied'};
  }
  return {npcs:input.npcs.map(n => n === npc ? update(npc,rule,input.now,[eventKey]) : n),applied:true,reason:'applied'};
}
function update<T extends Actor>(npc:T,rule:DossierActorTransition,now:Date,markers:string[]):T {
  return {...npc,
    ...(rule.result_status ? {status:rule.result_status} : {}),
    ...(rule.target_location_id ? {locationId:rule.target_location_id,location:rule.target_location_name!} : {}),
    statusEffects:[...npc.statusEffects.filter(e=>e.id!==rule.from_effect_id),{...rule.to_effect,type:'other' as const,timestamp:now}],
    tags:[...npc.tags,...markers]};
}
