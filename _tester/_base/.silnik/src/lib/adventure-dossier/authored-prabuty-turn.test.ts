import {TextEncoder} from 'node:util';
import {webcrypto} from 'node:crypto';
import {createAuthoredPrabutyPayload,PRABUTY_WORLD_IDS} from './authored-prabuty';
import {authorizeLocalDraftPayload,fingerprintLocalDraftPayload} from './runtime-authorization';
import {emptyDossierWorldState} from './world-object-state';
import {advanceAuthoredPrabutyClock,applyAuthoredPrabutyTurn,isAuthoredPrabutyPlaytest} from './authored-prabuty-turn';
import type {SkillTestData,SkillRollResolution} from '../parsers/types';
beforeAll(()=>{Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});});
async function fixture(){
 const hash=await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload('sha256:'+'0'.repeat(64)));
 const payload=await authorizeLocalDraftPayload(createAuthoredPrabutyPayload(hash),{adventureId:'cien-nad-prabutami',editionFingerprint:hash});
 const state=emptyDossierWorldState({playthroughId:'play',adventureId:payload.adventure_id,editionFingerprint:hash},payload);
 return {payload,state,turnId:'turn',gameTime:{year:1973,month:9,day:18,hour:19,minute:30},writesAllowed:true};
}
test('only exact frozen enrolled factory/version receives authored playtest behavior',async()=>{
 const x=await fixture();expect(isAuthoredPrabutyPlaytest(x.payload)).toBe(true);
 const clone=JSON.parse(JSON.stringify(x.payload));expect(isAuthoredPrabutyPlaytest(clone)).toBe(false);
 const result=advanceAuthoredPrabutyClock({...x,payload:clone,gameTime:{...x.gameTime,day:19,hour:23,minute:59}});
 expect(result.applicable).toBe(false);expect(result.state).toBe(x.state);
});
test('clock projection is pure and distinguishes activation from the final deadline regardless of player location',async()=>{
 const x=await fixture(),before=JSON.stringify(x),write=jest.spyOn(Storage.prototype,'setItem');
 const early=advanceAuthoredPrabutyClock({...x,gameTime:{...x.gameTime,day:19,hour:16,minute:58}});
 expect(early.changed).toBe(false);expect(early.ending).toBeNull();
 const late=advanceAuthoredPrabutyClock({...x,gameTime:{...x.gameTime,day:19,hour:23,minute:59}});
 expect(late.rejected).toEqual([]);expect(late.ending).toBe('operation-completed');
 expect(late.events).toHaveLength(3);expect(JSON.stringify(x)).toBe(before);expect(write).not.toHaveBeenCalled();write.mockRestore();
 const repeated=advanceAuthoredPrabutyClock({...x,state:late.state,gameTime:{...x.gameTime,day:20,hour:0,minute:0}});
 expect(repeated.changed).toBe(false);expect(repeated.state).toEqual(late.state);
});
test('clock never respawns a disabled generator or reopens a closed rift',async()=>{
 const x=await fixture();x.state.objects=x.state.objects.map(o=>o.entityId===PRABUTY_WORLD_IDS.generator?{...o,state:'disabled'}:o.entityId===PRABUTY_WORLD_IDS.rift?{...o,state:'closed'}:o);
 const result=advanceAuthoredPrabutyClock({...x,gameTime:{...x.gameTime,day:20,hour:1}});
 expect(result.ending).toBe('interrupted');expect(result.state.objects.find(o=>o.entityId===PRABUTY_WORLD_IDS.generator)!.state).toBe('disabled');
 expect(result.state.objects.find(o=>o.entityId===PRABUTY_WORLD_IDS.rift)!.state).toBe('closed');
});
test.each(['start-generators','open-rift','complete-operation'])('rejects early player proposal %s without partial candidate',async transitionId=>{
 const x=await fixture(),entityId=transitionId==='start-generators'?PRABUTY_WORLD_IDS.generator:transitionId==='open-rift'?PRABUTY_WORLD_IDS.rift:PRABUTY_WORLD_IDS.ending;
 const result=applyAuthoredPrabutyTurn({...x,location:'loc-warszawa-redakcja',rawText:'[TECZKA_STANU: '+entityId+' | '+transitionId+']',skillTests:[],skillRolls:[]});
 expect(result.rejected.length).toBeGreaterThan(0);expect(result.state).toBe(x.state);expect(result.changed).toBe(false);
});
test('withdrawal requires explicit human message and cannot be asserted by narrator tags alone',async()=>{
 const x=await fixture(),tag='[TECZKA_STANU: '+PRABUTY_WORLD_IDS.ending+' | withdraw]';
 const no=applyAuthoredPrabutyTurn({...x,location:'loc-warszawa-redakcja',rawText:tag,playerMessage:'Co widzę?',skillTests:[],skillRolls:[]});
 expect(no.rejected.length).toBeGreaterThan(0);
 const yes=applyAuthoredPrabutyTurn({...x,location:'loc-warszawa-redakcja',rawText:'Kończysz śledztwo.',playerMessage:'/wycofaj',skillTests:[],skillRolls:[]});
 expect(yes.ending).toBe('withdrawn');expect(yes.rejected).toEqual([]);
});
test('sequential player transitions consume only real matching local dice then code derives the terminal result',async()=>{
 const x=await fixture();
 const test:SkillTestData={id:'test',characterId:'pc',skillName:'Naprawa elektryczna',skillValue:40,difficulty:'trudny',modifiers:[],justification:'Declared action',dossierConditionId:'prabuty-disable-preparing'};
 const roll:SkillRollResolution={testId:'test',resolutionId:'roll',characterId:'pc',skillNames:[test.skillName],requiredDifficulty:'hard',outcome:'hard',passedRequirement:true,luckSpent:0};
 const input={...x,location:'loc-prabuty-wykopaliska',rawText:'[TECZKA_STANU: '+PRABUTY_WORLD_IDS.generator+' | disable-preparing]',skillTests:[test],skillRolls:[roll]};
 // Use the exact source location, rather than guessing a location alias.
 input.location=x.payload.records.find(r=>r.world_object_binding?.entity_id===PRABUTY_WORLD_IDS.generator)!.tags.scenes[1];
 const accepted=applyAuthoredPrabutyTurn(input);expect(accepted.rejected).toEqual([]);expect(accepted.ending).toBe('interrupted');
 const failed=applyAuthoredPrabutyTurn({...input,skillRolls:[{...roll,outcome:'fail',passedRequirement:false}]});
 expect(failed.changed).toBe(false);expect(failed.state).toBe(x.state);
});
test('failed attempt that advances to the activation cutoff preserves the clock event',async()=>{
 const x=await fixture();
 const check:SkillTestData={id:'cutoff-check',characterId:'pc',skillName:'Naprawa elektryczna',skillValue:40,
  difficulty:'trudny',modifiers:[],justification:'Declared action',dossierConditionId:'prabuty-disable-preparing'};
 const failure:SkillRollResolution={testId:check.id,resolutionId:'cutoff-roll',characterId:'pc',skillNames:[check.skillName],
  requiredDifficulty:'hard',outcome:'fail',passedRequirement:false,luckSpent:0};
 const location=x.payload.records.find(r=>r.world_object_binding?.entity_id===PRABUTY_WORLD_IDS.generator)!.tags.scenes[1];
 const result=applyAuthoredPrabutyTurn({...x,gameTime:{...x.gameTime,day:19,hour:16,minute:59},location,
  rawText:'Nie udaje mi się zatrzymać przygotowań.',playerMessage:'Próbuję unieruchomić generatory.',
  skillTests:[check],skillRolls:[failure]});
 expect(result.rejected).toEqual([]);
 expect(result.events).toEqual([PRABUTY_WORLD_IDS.generator+'/start-generators',PRABUTY_WORLD_IDS.rift+'/open-rift']);
 expect(result.state.objects.find(o=>o.entityId===PRABUTY_WORLD_IDS.generator)?.state).toBe('active');
 expect(result.state.objects.find(o=>o.entityId===PRABUTY_WORLD_IDS.rift)?.state).toBe('open');
 expect(result.ending).toBeNull();
});
test('session end is rejected before terminal state and allowed after code-owned terminal result',async()=>{
 const x=await fixture(),base={...x,location:'loc-warszawa-redakcja',rawText:'[KONIEC_SESJI:POTWIERDZENIE]',skillTests:[],skillRolls:[]};
 expect(applyAuthoredPrabutyTurn(base).rejected).toContain('PRABUTY_ENDING_REQUIRED');
 expect(applyAuthoredPrabutyTurn({...base,playerMessage:'/wycofaj'}).ending).toBe('withdrawn');
});

test('request projector and final preview agree on terminal deadline state before accepting player effects',async()=>{
 const x=await fixture(),late={...x,gameTime:{...x.gameTime,day:19,hour:23,minute:59}};
 const projection=advanceAuthoredPrabutyClock(late);
 const narration=applyAuthoredPrabutyTurn({...late,location:'loc-warszawa-redakcja',rawText:'Opis potwierdzonego finału.',skillTests:[],skillRolls:[]});
 expect(narration.state).toEqual(projection.state);expect(narration.ending).toBe(projection.ending);
 const check:SkillTestData={id:'late-check',characterId:'pc',skillName:'Naprawa elektryczna',skillValue:40,
  difficulty:'trudny',modifiers:[],justification:'Late action',dossierConditionId:'prabuty-disable-active'};
 const result:SkillRollResolution={testId:check.id,resolutionId:'late-roll',characterId:'pc',skillNames:[check.skillName],
  requiredDifficulty:'hard',outcome:'hard',passedRequirement:true,luckSpent:0};
 const overridden=applyAuthoredPrabutyTurn({...late,location:x.payload.records.find(r=>r.world_object_binding?.entity_id===PRABUTY_WORLD_IDS.generator)!.tags.scenes[0],
  rawText:'[TECZKA_STANU: '+PRABUTY_WORLD_IDS.generator+' | disable-active]',skillTests:[check],skillRolls:[result]});
 expect(overridden.rejected).toContain('PRABUTY_ALREADY_ENDED');expect(overridden.state).toBe(x.state);
});

test('generator activation leaves a playable climax window before the final deadline',async()=>{
 const x=await fixture(),gameTime={...x.gameTime,day:19,hour:16,minute:59};
 const active=advanceAuthoredPrabutyClock({...x,gameTime});
 expect(active.rejected).toEqual([]);expect(active.ending).toBeNull();
 expect(active.state.objects.find(o=>o.entityId===PRABUTY_WORLD_IDS.generator)!.state).toBe('active');
 expect(active.state.objects.find(o=>o.entityId===PRABUTY_WORLD_IDS.rift)!.state).toBe('open');
 const check:SkillTestData={id:'climax-check',characterId:'pc',skillName:'Naprawa elektryczna',skillValue:40,
  difficulty:'trudny',modifiers:[],justification:'Declared sabotage',dossierConditionId:'prabuty-disable-active'};
 const roll:SkillRollResolution={testId:check.id,resolutionId:'climax-roll',characterId:'pc',skillNames:[check.skillName],
  requiredDifficulty:'hard',outcome:'hard',passedRequirement:true,luckSpent:0};
 const location=x.payload.records.find(r=>r.world_object_binding?.entity_id===PRABUTY_WORLD_IDS.rift)!.tags.scenes[0];
 const rawText='[TECZKA_STANU: '+PRABUTY_WORLD_IDS.generator+' | disable-active]'+
  '[TECZKA_STANU: '+PRABUTY_WORLD_IDS.rift+' | close-rift]';
 const closed=applyAuthoredPrabutyTurn({...x,turnId:'climax-action',state:active.state,gameTime,location,rawText,skillTests:[check],skillRolls:[roll]});
 expect(closed.rejected).toEqual([]);expect(closed.ending).toBe('interrupted');
});
