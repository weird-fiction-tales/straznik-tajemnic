import type { Message } from '../types';
import type { SkillRollResolution, SkillTestData } from '../parsers/types';
import { mapDifficultyToRequired, meetsDifficulty } from '../dice-utils';
import { normalizeSkillName } from '../skill-test-resolver';

export interface PendingSkillRollBinding { playthroughId:string; adventureId:string; editionFingerprint:string }
export interface PendingSkillRoll extends PendingSkillRollBinding {
  schemaVersion:1; id:string; message:string;
  mechanicsContext:{skillRolls:SkillRollResolution[]};
  sources:{messageId:string;test:SkillTestData}[];
}
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const key=(scope:PendingSkillRollBinding)=>`zew-dossier-skill-roll:${encodeURIComponent(scope.playthroughId)}`;
const fail=():never=>{throw new Error('DOSSIER_SKILL_ROLL_RETRY_INVALID');};
const id=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9._:/-]{1,200}$/.test(value);
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function sourcesFor(history:readonly Message[],rolls:SkillRollResolution[],characterIds:readonly string[]) {
  if(!Array.isArray(rolls)||!rolls.length||rolls.length>20)return fail();
  const seen=new Set<string>(),resolutions=new Set<string>();
  return rolls.map(roll=>{
    if(!roll||!id(roll.testId)||!id(roll.resolutionId)||!id(roll.characterId)||
      seen.has(roll.testId)||resolutions.has(roll.resolutionId)||!characterIds.includes(roll.characterId))return fail();
    seen.add(roll.testId);resolutions.add(roll.resolutionId);
    const matches=history.filter(message=>message.role==='assistant').flatMap(message=>(message.skillTests??[])
      .filter(test=>test.id===roll.testId).map(test=>({messageId:message.id,test})));
    if(matches.length!==1)return fail();
    const source=matches[0],test=source.test;
    if(!id(source.messageId)||test.characterId!==roll.characterId||test.targetNpcId!==roll.targetNpcId||
      roll.requiredDifficulty!==mapDifficultyToRequired(test.difficulty)||
      !['critical','extreme','hard','regular','fail','fumble'].includes(roll.outcome)||
      !Number.isFinite(roll.luckSpent)||roll.luckSpent<0||!Array.isArray(roll.skillNames)||
      !roll.skillNames.every(name=>typeof name==='string'))return fail();
    const names=(test.combined?.skills.map(skill=>skill.skillName)??[test.skillName]).map(normalizeSkillName).sort();
    if(!equal(names,roll.skillNames.map(normalizeSkillName).sort())||
      roll.passedRequirement!==meetsDifficulty(roll.outcome,roll.requiredDifficulty))return fail();
    return source;
  });
}
function validate(value:PendingSkillRoll,binding:PendingSkillRollBinding,history:readonly Message[],characterIds:readonly string[]) {
  if(!value||value.schemaVersion!==1||!id(value.id)||!id(binding.playthroughId)||!id(binding.adventureId)||
    !/^sha256:[a-f0-9]{64}$/.test(binding.editionFingerprint)||
    value.playthroughId!==binding.playthroughId||value.adventureId!==binding.adventureId||value.editionFingerprint!==binding.editionFingerprint||
    typeof value.message!=='string'||!value.message.trim()||value.message.length>30000||
    !value.mechanicsContext||!Array.isArray(value.sources))return fail();
  const sources=sourcesFor(history,value.mechanicsContext.skillRolls,characterIds);
  if(!equal(sources,value.sources))return fail();
  return value;
}
/** Outbox only: neither an accepted narrative nor a campaign-memory snapshot. */
export function readPendingSkillRoll(storage:Store,binding:PendingSkillRollBinding,history:readonly Message[],characterIds:readonly string[]):PendingSkillRoll|null {
  const raw=storage.getItem(key(binding));if(raw===null)return null;
  if(raw.length>200000)return fail();
  let value:PendingSkillRoll;try{value=JSON.parse(raw);}catch{return fail();}
  return validate(value,binding,history,characterIds);
}
export function isPendingSkillRollAccepted(pending:PendingSkillRoll,history:readonly Message[]):boolean {
  return pending.mechanicsContext.skillRolls.every(roll=>history.some(message=>message.role==='user'&&
    message.mechanicsContext?.skillRollScope?.playthroughId===pending.playthroughId&&
    message.mechanicsContext.skillRollScope.adventureId===pending.adventureId&&
    message.mechanicsContext.skillRolls?.some(saved=>equal(saved,roll))));
}
export function stagePendingSkillRoll(storage:Store,binding:PendingSkillRollBinding,message:string,
  mechanicsContext:{skillRolls:SkillRollResolution[]},history:readonly Message[],characterIds:readonly string[]):PendingSkillRoll {
  const copy=JSON.parse(JSON.stringify({schemaVersion:1,id:crypto.randomUUID(),...binding,message,mechanicsContext,
    sources:sourcesFor(history,mechanicsContext.skillRolls,characterIds)})) as PendingSkillRoll;
  validate(copy,binding,history,characterIds);
  if(isPendingSkillRollAccepted(copy,history)||storage.getItem(key(binding))!==null)return fail();
  storage.setItem(key(binding),JSON.stringify(copy));return copy;
}
/** Delete only this exact acknowledged outbox; never discard foreign/stale records. */
export function clearPendingSkillRoll(storage:Store,pending:PendingSkillRoll):void {
  const raw=storage.getItem(key(pending));if(raw===null)return;
  const current:unknown=JSON.parse(raw);
  if(!equal(current,pending))return fail();
  storage.removeItem(key(pending));
}
