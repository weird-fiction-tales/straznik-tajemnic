import { applyDossierActorTurn, persistDossierActorTurn, selectDossierActorResolvedTests, bindDossierActorTests } from './actor-turn';
import type { DossierRagPayload } from './rag-schema';
const payload:DossierRagPayload={schema_version:1,adventure_id:'fixture',edition_fingerprint:'sha256:'+'a'.repeat(64),records:[{schema_version:1,record_id:'actor',record_type:'actor',adventure_id:'fixture',edition_fingerprint:'sha256:'+'a'.repeat(64),language:'pl',content:'Neutral fixture',tags:{entities:['npc-a'],scenes:[],mechanics:[],topics:[],triggers:[]},retrieval:{visibility:'gm_only',availability:'always',condition:null,priority:1},evidence:{provenance:'approved_design',source_ref:'fixture',status:'set',approval:'approved',approved_by:'fixture',approved_at:'2026-10-18'},links:[],actor_binding:{entity_id:'npc-a',name:'Neutral',transitions:[{id:'rescue',from_effect_id:'bound',to_effect:{id:'freed',name:'Freed',description:'Rescued'},source_location_id:'cell'}]}}]};
const npcs=()=>[{id:'npc-a',status:'alive' as const,locationId:'cell',location:'Cell',statusEffects:[{id:'bound',name:'Bound',type:'other' as const,description:'Captive',timestamp:new Date(0)}],tags:[],hp:7}];
const input=()=>({payload,playthroughId:'play',adventureId:'fixture',editionFingerprint:payload.edition_fingerprint,turnId:'turn',rawText:'Opis [TECZKA_STANU: npc-a | rescue]',writesAllowed:true,gameTime:{year:1925,month:5,day:22,hour:12,minute:0},now:new Date(0),skillTests:[],skillRolls:[]});
beforeEach(()=>localStorage.clear());
test('applies and persists current NPCs once; reload preserves effect and replay marker',()=>{
 localStorage.setItem('gm_npcs',JSON.stringify(npcs()));const result=persistDossierActorTurn(input());
 expect(result.changed).toBe(true);expect(result.cleanText).toBe('Opis');
 const saved=JSON.parse(localStorage.getItem('gm_npcs')!);expect(saved[0].hp).toBe(7);expect(saved[0].statusEffects[0].id).toBe('freed');
 expect(persistDossierActorTurn(input()).changed).toBe(false);
});
test('denies foreign edition, pending actor, ambiguous cards and prohibited writes',()=>{
 const base={...input(),npcs:npcs()};
 expect(applyDossierActorTurn({...base,editionFingerprint:'sha256:'+'b'.repeat(64)}).changed).toBe(false);
 expect(applyDossierActorTurn({...base,writesAllowed:false}).changed).toBe(false);
 expect(applyDossierActorTurn({...base,payload:{...payload,records:[...payload.records,...payload.records]}}).changed).toBe(false);
 expect(applyDossierActorTurn({...base,payload:{...payload,records:[{...payload.records[0],evidence:{...payload.records[0].evidence,approval:'pending'}}]}}).changed).toBe(false);
});
test('does not overwrite malformed or absent NPC storage and strips unknown state tags',()=>{
 localStorage.setItem('gm_npcs','broken');expect(()=>persistDossierActorTurn(input())).toThrow('DOSSIER_NPC_STORAGE_INVALID');expect(localStorage.getItem('gm_npcs')).toBe('broken');
 localStorage.removeItem('gm_npcs');expect(persistDossierActorTurn(input()).changed).toBe(false);expect(localStorage.getItem('gm_npcs')).toBeNull();
 expect(applyDossierActorTurn({...input(),npcs:npcs(),rawText:'[TECZKA_STANU: missing | rescue]'}).cleanText).toBe('');
});

test('ordinary narration never opens or overwrites unrelated malformed NPC storage',()=>{
 localStorage.setItem('gm_npcs','broken');
 expect(persistDossierActorTurn({...input(),rawText:'Narration only'}).changed).toBe(false);
 expect(localStorage.getItem('gm_npcs')).toBe('broken');
});


test('uses the earlier assistant test when the following turn returns its roll',()=>{
 const test={id:'test-old',dossierConditionId:'rescue-check',targetNpcId:'npc-a',characterId:'pc-a',skillName:'Dexterity',skillValue:50,difficulty:'trudny' as const,modifiers:[],justification:'fixture'};
 const roll={testId:test.id,targetNpcId:'npc-a',characterId:'pc-a',resolutionId:'roll-old',requiredDifficulty:'hard' as const,passedRequirement:true,outcome:'hard' as const,luckSpent:0,skillNames:['Dexterity']};
 const history=[{role:'assistant',skillTests:[test]}];
 const gated:DossierRagPayload=JSON.parse(JSON.stringify(payload));
 gated.records[0].actor_binding!.transitions![0].access_check={id:'rescue-check',skill_names:['Dexterity'],difficulty:'hard'};
 localStorage.setItem('gm_npcs',JSON.stringify(npcs()));
 expect(persistDossierActorTurn({...input(),payload:gated,skillTests:[test]}).changed).toBe(false);
 const skillTests=selectDossierActorResolvedTests(history,[roll]);
 expect(skillTests).toEqual([test]);
 expect(persistDossierActorTurn({...input(),payload:gated,turnId:'next-turn',skillTests,skillRolls:[roll]}).changed).toBe(true);
 expect(JSON.parse(localStorage.getItem('gm_npcs')!)[0].statusEffects[0].id).toBe('freed');
 expect(selectDossierActorResolvedTests([{role:'user',skillTests:[test]}],[roll])).toEqual([]);
 expect(selectDossierActorResolvedTests([...history,...history],[roll])).toEqual([]);
 expect(selectDossierActorResolvedTests(history,[{...roll,testId:'unknown'}])).toEqual([]);
});


test('binds the authored NPC target before displaying a test, without asking the player',()=>{
 const gated:DossierRagPayload=JSON.parse(JSON.stringify(payload));
 gated.records[0].actor_binding!.transitions![0].access_check={id:'check',skill_names:['Dexterity'],difficulty:'hard'};
 const test={id:'t',dossierConditionId:'check',characterId:'pc',skillName:'Dexterity',skillValue:50,difficulty:'trudny' as const,modifiers:[],justification:'fixture'};
 expect(bindDossierActorTests(gated,[test])[0].targetNpcId).toBe('npc-a');
 expect(bindDossierActorTests({...gated,records:[...gated.records,...gated.records]},[test])[0].targetNpcId).toBeUndefined();
 expect(bindDossierActorTests(gated,[{...test,targetNpcId:'other'}])[0].targetNpcId).toBe('other');
 gated.records[0].evidence.approval='pending';
 expect(bindDossierActorTests(gated,[test])[0].targetNpcId).toBeUndefined();
});
