import { isRuntimeAuthorizedDossierRecord } from './runtime-authorization';
import type { NPC, GameTime } from '../types';
import type { SkillTestData, SkillRollResolution } from '../parsers/types';
import { type DossierRagPayload } from './rag-schema';
import { applyDossierActorTransition } from './actor-transition';

type Actor = Pick<NPC,'id'|'status'|'locationId'|'location'|'statusEffects'|'tags'>;
interface ActorTurnInput {
  payload: DossierRagPayload;
  adventureId: string;
  editionFingerprint: string;
  playthroughId: string;
  turnId: string;
  rawText: string;
  location?: string;
  writesAllowed: boolean;
  gameTime: GameTime;
  now: Date;
  skillTests: SkillTestData[];
  skillRolls: SkillRollResolution[];
}
/** Reuses the existing state tag. Object and actor handlers receive the same original text. */
export function applyDossierActorTurn<T extends Actor>(input: ActorTurnInput & {npcs:T[]}) {
  let npcs=input.npcs;
  let changed=false;
  const rejected:string[]=[];
  const matchesEdition=input.payload.adventure_id===input.adventureId && input.payload.edition_fingerprint===input.editionFingerprint;
  const cleanText=input.rawText.replace(/\[TECZKA_STANU:\s*([^|\]]+)\|([^\]]+)\]/gi,(_tag,entity:string,transition:string)=>{
    const entityId=entity.trim();
    const records=input.payload.records.filter(r=>r.actor_binding?.entity_id===entityId);
    // World-object tags are handled by their existing adapter, not rejected as NPCs.
    if(records.length===0) return '';
    if(!matchesEdition || records.length!==1){rejected.push(entityId);return '';}
    const result=applyDossierActorTransition({...input,record:records[0],npcs,entityId,transitionId:transition.trim()});
    if(result.applied){npcs=result.npcs;changed=true;}
    else if(result.reason!=='replayed') rejected.push(entityId);
    return '';
  }).trimEnd();
  return {npcs,changed,rejected,cleanText};
}
/** Single synchronous write retains NPC fields and replay markers in the existing full-save source. */
export function persistDossierActorTurn(input:ActorTurnInput) {
  const requested=[...input.rawText.matchAll(/\[TECZKA_STANU:\s*([^|\]]+)\|([^\]]+)\]/gi)];
  if(!requested.some(match=>input.payload.records.some(r=>r.actor_binding?.entity_id===match[1].trim()))) {
    return applyDossierActorTurn({...input,npcs:[]});
  }
  const raw=window.localStorage.getItem('gm_npcs');
  let value:unknown;
  try{value=raw===null?[]:JSON.parse(raw);}catch{throw new Error('DOSSIER_NPC_STORAGE_INVALID');}
  if(!Array.isArray(value) || value.some(n=>!n || typeof n!=='object' || typeof n.id!=='string' ||
    !['alive','dead','unknown'].includes(n.status) || typeof n.location!=='string' || !Array.isArray(n.tags) ||
    !n.tags.every((t:unknown)=>typeof t==='string') || !Array.isArray(n.statusEffects) ||
    n.statusEffects.some((e:unknown)=>!e || typeof e!=='object' || !('id' in e) || typeof e.id!=='string'))) {
    throw new Error('DOSSIER_NPC_STORAGE_INVALID');
  }
  const result=applyDossierActorTurn({...input,npcs:value as Actor[]});
  if(result.changed)window.localStorage.setItem('gm_npcs',JSON.stringify(result.npcs));
  return result;
}


/** Resolve only tests already emitted by the assistant, before the current response starts. */
export function selectDossierActorResolvedTests(
  messages: readonly {role:string;skillTests?:SkillTestData[]}[],
  rolls: readonly SkillRollResolution[],
): SkillTestData[] {
  const requestedIds=new Set(rolls.map(r=>r.testId).filter((id):id is string=>!!id));
  const tests=messages.filter(m=>m.role==='assistant').flatMap(m=>m.skillTests ?? []);
  return tests.filter(test=>requestedIds.has(test.id) && !!test.dossierConditionId &&
    tests.filter(candidate=>candidate.id===test.id).length===1);
}


/** A unique reviewed condition supplies the NPC identity before the dice modal opens. */
export function bindDossierActorTests(payload:DossierRagPayload | undefined, tests:SkillTestData[]):SkillTestData[] {
  if (!payload) return tests;
  return tests.map(test=>{
    if (!test.dossierConditionId || test.targetNpcId) return test;
    const matches=payload.records.filter(record=>record.record_type==='actor' && isRuntimeAuthorizedDossierRecord(record) &&
      record.adventure_id===payload.adventure_id && record.edition_fingerprint===payload.edition_fingerprint &&
      record.actor_binding?.transitions?.some(t=>t.access_check?.id===test.dossierConditionId));
    return matches.length===1 ? {...test,targetNpcId:matches[0].actor_binding!.entity_id} : test;
  });
}
