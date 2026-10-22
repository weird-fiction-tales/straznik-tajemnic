import { applyDossierActorTransition, isDossierActorTransition } from './actor-transition';
import type { NPC } from '../types';
import { validateDossierRagPayload, type DossierRagRecord } from './rag-schema';
const rule={id:'rescue',from_effect_id:'bound',to_effect:{id:'freed',name:'Uwolniony',description:'Uwolnienie z niewoli'},source_location_id:'cell',target_location_id:'shelter',target_location_name:'Shelter'};
const card:DossierRagRecord={schema_version:1,record_id:'npc-card',record_type:'actor',adventure_id:'neutral',edition_fingerprint:'sha256:'+'a'.repeat(64),language:'pl',content:'Neutral authored fixture',tags:{entities:['npc-a'],scenes:[],mechanics:[],topics:[],triggers:[]},retrieval:{visibility:'gm_only',availability:'always',condition:null,priority:1},evidence:{provenance:'approved_design',source_ref:'fixture',status:'set',approval:'approved',approved_by:'fixture',approved_at:'2026-10-18'},links:[],actor_binding:{entity_id:'npc-a',name:'Neutral',transitions:[rule]}};
const npc=():Pick<NPC,'id'|'status'|'locationId'|'location'|'tags'|'statusEffects'|'hp'>=>({id:'npc-a',status:'alive' as const,locationId:'cell',location:'Cell',tags:[] as string[],statusEffects:[{id:'bound',name:'Bound',type:'other' as const,description:'Captive',timestamp:new Date(0)}],hp:5});
const input=()=>({record:card,npcs:[npc()],entityId:'npc-a',transitionId:'rescue',playthroughId:'play-a',turnId:'turn-a',writesAllowed:true,now:new Date('2026-10-18'),gameTime:{year:1925,month:5,day:22,hour:23,minute:0},skillTests:[],skillRolls:[]});
test('applies only the reviewed transition, preserves unrelated fields and input',()=>{
 const x=input();const before=JSON.stringify(x.npcs);const result=applyDossierActorTransition(x);
 expect(result.applied).toBe(true);expect(result.npcs[0]).toMatchObject({hp:5,locationId:'shelter'});
 expect(result.npcs[0].statusEffects.map(e=>e.id)).toEqual(['freed']);expect(JSON.stringify(x.npcs)).toBe(before);
 const replay=applyDossierActorTransition({...x,npcs:JSON.parse(JSON.stringify(result.npcs))});expect(replay.applied).toBe(false);
});
test('rejects missing identity, duplicate identities, dead, rescued, wrong location and pending cards',()=>{
 const x=input();
 for(const patch of [{entityId:'other'},{npcs:[npc(),npc()]},{npcs:[{...npc(),status:'dead' as const}]},{npcs:[{...npc(),statusEffects:[]}]},{npcs:[{...npc(),locationId:'other'}]},{writesAllowed:false},{record:{...card,evidence:{...card.evidence,approval:'pending' as const}}}]) expect(applyDossierActorTransition({...x,...patch}).applied).toBe(false);
});
test('rejects premature time and wrong target/test; accepts a matching successful local result',()=>{
 const timed={...rule,access_check:{id:'rescue-test',skill_names:['Dexterity'],difficulty:'hard' as const},not_before:{year:1925,month:5,day:23,hour:0,minute:0}};
 const x={...input(),record:{...card,actor_binding:{...card.actor_binding!,transitions:[timed]}}};
 expect(applyDossierActorTransition(x).applied).toBe(false);
 const later={...x,gameTime:timed.not_before};expect(applyDossierActorTransition(later).applied).toBe(false);
 const test={id:'test-1',dossierConditionId:'rescue-test',targetNpcId:'npc-a',characterId:'pc-a',skillName:'Dexterity',skillValue:50,difficulty:'trudny' as const,modifiers:[],justification:'fixture'};
 const roll={testId:'test-1',targetNpcId:'npc-a',resolutionId:'roll-1',characterId:'pc-a',outcome:'hard' as const,passedRequirement:true,requiredDifficulty:'hard' as const,luckSpent:0,skillNames:['Dexterity']};
 expect(applyDossierActorTransition({...later,skillTests:[test],skillRolls:[{...roll,targetNpcId:'other'}]}).applied).toBe(false);
 expect(applyDossierActorTransition({...later,skillTests:[test],skillRolls:[roll]}).applied).toBe(true);
 for(const patch of [{characterId:'other'},{requiredDifficulty:'regular' as const},{skillNames:['Persuade']},{outcome:'regular' as const}]) {
  expect(applyDossierActorTransition({...later,skillTests:[test],skillRolls:[{...roll,...patch}]}).applied).toBe(false);
 }

});

test('rejects replay after a cycle and does not reuse one roll for another turn',()=>{
 const x=input();const first=applyDossierActorTransition(x);
 const restored={...first.npcs[0],locationId:'cell',statusEffects:npc().statusEffects};
 expect(applyDossierActorTransition({...x,npcs:[restored]}).reason).toBe('replayed');
 const gated={...card,actor_binding:{...card.actor_binding!,transitions:[{...rule,access_check:{id:'check',skill_names:['Dexterity'],difficulty:'hard' as const}}]}};
 const test={id:'t',dossierConditionId:'check',targetNpcId:'npc-a',characterId:'pc-a',skillName:'Dexterity',skillValue:50,difficulty:'trudny' as const,modifiers:[],justification:'fixture'};
 const roll={testId:'t',targetNpcId:'npc-a',resolutionId:'r',characterId:'pc-a',outcome:'hard' as const,passedRequirement:true,requiredDifficulty:'hard' as const,luckSpent:0,skillNames:['Dexterity']};
 const firstRoll=applyDossierActorTransition({...x,record:gated,skillTests:[test],skillRolls:[roll]});
 const reset={...firstRoll.npcs[0],locationId:'cell',statusEffects:npc().statusEffects};
 expect(applyDossierActorTransition({...x,record:gated,npcs:[reset],turnId:'new-turn',skillTests:[test],skillRolls:[roll]}).reason).toBe('resolution-replayed');
 expect(applyDossierActorTransition({...x,record:gated,skillTests:[test],skillRolls:[{...roll,outcome:'fail',passedRequirement:false}]}).applied).toBe(false);
});

test('schema rejects duplicate transitions, impossible dates and unnamed destinations',()=>{
 const payload=(record:DossierRagRecord)=>({schema_version:1,adventure_id:card.adventure_id,edition_fingerprint:card.edition_fingerprint,records:[record]});
 expect(validateDossierRagPayload(payload(card)).ok).toBe(true);
 for(const transitions of [[rule,rule],[{...rule,not_before:{year:1925,month:1,day:31,hour:0,minute:0}}],[{...rule,target_location_name:undefined}]]) {
  expect(validateDossierRagPayload(payload({...card,actor_binding:{...card.actor_binding!,transitions}})).ok).toBe(false);
 }
});


test('requires the authored skill and minimum difficulty even when roll matches its requested test',()=>{
 const check={id:'rescue-test',skill_names:['Dexterity'],difficulty:'hard' as const};
 const record={...card,actor_binding:{...card.actor_binding!,transitions:[{...rule,access_check:check}]}};
 const test={id:'test',dossierConditionId:check.id,targetNpcId:'npc-a',characterId:'pc-a',skillName:'Dexterity',skillValue:50,difficulty:'trudny' as const,modifiers:[],justification:'fixture'};
 const roll={testId:test.id,targetNpcId:'npc-a',characterId:'pc-a',resolutionId:'roll',requiredDifficulty:'hard' as const,passedRequirement:true,outcome:'hard' as const,luckSpent:0,skillNames:['Dexterity']};
 const x={...input(),record,skillTests:[test],skillRolls:[roll]};
 expect(applyDossierActorTransition(x).applied).toBe(true);
 expect(applyDossierActorTransition({...x,skillTests:[{...test,skillName:'Persuade'}],skillRolls:[{...roll,skillNames:['Persuade']}]}).applied).toBe(false);
 expect(applyDossierActorTransition({...x,skillTests:[{...test,difficulty:'zwykly'}],skillRolls:[{...roll,requiredDifficulty:'regular',outcome:'regular'}]}).applied).toBe(false);
});


test('rejects incomplete or obsolete authored test declarations',()=>{
 for(const access_check of [{id:'check',skill_names:[],difficulty:'hard'},{id:'check',skill_names:[' '],difficulty:'hard'},{id:'check',skill_names:['Dexterity'],difficulty:'easy'},{id:'check',skill_names:['Dexterity'],difficulty:'hard',success:true}]) {
  expect(isDossierActorTransition({...rule,access_check})).toBe(false);
 }
 expect(isDossierActorTransition({...rule,condition_id:'legacy-unconstrained'})).toBe(false);
});


test('validates explicit opening state independently of future transitions',()=>{
 const initial={status:'alive',location_id:'cell',location_name:'Cell',effects:[{id:'captive',name:'Captive',description:'Held in custody'}],source_ref:'fixture opening'};
 const check=(state:unknown)=>validateDossierRagPayload({schema_version:1,adventure_id:card.adventure_id,edition_fingerprint:card.edition_fingerprint,records:[{...card,actor_binding:{...card.actor_binding,initial_state:state}}]}).ok;
 expect(check(initial)).toBe(true);
 for(const state of [{...initial,status:'undead'},{...initial,source_ref:''},{...initial,effects:[...initial.effects,...initial.effects]},{...initial,hp:999}]) expect(check(state)).toBe(false);
});


test('an interaction cannot change an NPC remotely or without a known player location',()=>{
 const record={...card,actor_binding:{...card.actor_binding!,transitions:[{...rule,requires_presence:true}]}};
 const x={...input(),record};
 expect(applyDossierActorTransition(x).applied).toBe(false);
 expect(applyDossierActorTransition({...x,location:'elsewhere'}).applied).toBe(false);
 expect(applyDossierActorTransition({...x,location:'cell'}).applied).toBe(true);
 expect(applyDossierActorTransition({...x,location:'Cell'}).applied).toBe(true);
});


test('an explicitly lethal consequence persists death and cannot be replayed as rescue',()=>{
 const death={...rule,id:'remove-hazard',to_effect:{id:'fatal',name:'Fatal consequence',description:'Explicit authored consequence'},target_location_id:undefined,target_location_name:undefined,result_status:'dead' as const};
 const record={...card,actor_binding:{...card.actor_binding!,transitions:[death,rule]}};
 const x={...input(),record,transitionId:death.id};
 const result=applyDossierActorTransition(x);expect(result.applied).toBe(true);
 expect(result.npcs[0].status).toBe('dead');expect(result.npcs[0].locationId).toBe('cell');
 const reloaded=JSON.parse(JSON.stringify(result.npcs));
 expect(applyDossierActorTransition({...x,npcs:reloaded,transitionId:rule.id}).applied).toBe(false);
 expect(isDossierActorTransition({...death,result_status:'alive'})).toBe(false);
});
