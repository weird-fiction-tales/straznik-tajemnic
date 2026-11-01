import { initializeDossierActors } from './actor-initialization';
import type { DossierRagPayload } from './rag-schema';
const fingerprint='sha256:'+'a'.repeat(64);
const payload:DossierRagPayload={schema_version:1,adventure_id:'fixture',edition_fingerprint:fingerprint,records:[{
 schema_version:1,record_id:'actor-card',record_type:'actor',adventure_id:'fixture',edition_fingerprint:fingerprint,language:'pl',content:'Neutral',tags:{entities:['npc-a'],scenes:[],mechanics:[],topics:[],triggers:[]},links:[],retrieval:{visibility:'gm_only',availability:'always',condition:null,priority:1},evidence:{status:'set',approval:'approved',approved_by:'fixture',approved_at:'2026-10-19',provenance:'approved_design',source_ref:'fixture'},
 actor_binding:{entity_id:'npc-a',name:'Neutral NPC',initial_state:{status:'alive',location_id:'cell',location_name:'Cell',effects:[{id:'captive',name:'Captive',description:'Held'}],source_ref:'fixture opening'}}
}]};
const input=()=>({payload,sessionId:'play-a',adventureId:'fixture',editionFingerprint:fingerprint,now:new Date(0),storage:localStorage});
beforeEach(()=>localStorage.clear());
test('initializes only declared state and retains existing voice/profile without inventing statistics',()=>{
 localStorage.setItem('gm_npcs',JSON.stringify([{id:'npc-a',name:'Neutral NPC',voiceConfig:{voiceId:'voice-a'},description:'existing'}]));
 expect(initializeDossierActors(input()).initialized).toEqual(['npc-a']);
 const saved=JSON.parse(localStorage.getItem('gm_npcs')!)[0];
 expect(saved).toMatchObject({status:'alive',locationId:'cell',sessionId:'play-a',description:'existing',voiceConfig:{voiceId:'voice-a'}});
 expect(saved.statusEffects[0].id).toBe('captive');expect(saved.hp).toBeUndefined();
});
test('reload never restores a dead, moved, freed or deliberately empty state',()=>{
 initializeDossierActors(input());
 const saved=JSON.parse(localStorage.getItem('gm_npcs')!);Object.assign(saved[0],{status:'dead',locationId:'outside',statusEffects:[],tags:[]});
 localStorage.setItem('gm_npcs',JSON.stringify(saved));const before=localStorage.getItem('gm_npcs');
 expect(initializeDossierActors(input()).initialized).toEqual([]);expect(localStorage.getItem('gm_npcs')).toBe(before);
});
test('preserves existing campaign state even when it predates dossier initialization',()=>{
 localStorage.setItem('gm_npcs',JSON.stringify([{id:'npc-a',status:'unknown',statusEffects:[],location:'Elsewhere',tags:[]} ]));
 const before=localStorage.getItem('gm_npcs');initializeDossierActors(input());expect(localStorage.getItem('gm_npcs')).toBe(before);
});
test('rejects wrong edition, another session, duplicates and corrupt storage without writes',()=>{
 for(const raw of ['broken','{}',JSON.stringify([{id:'npc-a',sessionId:'other'}]),JSON.stringify([{id:'npc-a'},{id:'npc-a'}])]) {
  localStorage.setItem('gm_npcs',raw);expect(()=>initializeDossierActors(input())).toThrow();expect(localStorage.getItem('gm_npcs')).toBe(raw);
 }
 localStorage.clear();expect(()=>initializeDossierActors({...input(),editionFingerprint:'foreign'})).toThrow();expect(localStorage.getItem('gm_npcs')).toBeNull();
});
test('does not initialize pending cards or execute declared future transitions',()=>{
 const data:DossierRagPayload=JSON.parse(JSON.stringify(payload));data.records[0].evidence.approval='pending';
 expect(initializeDossierActors({...input(),payload:data}).initialized).toEqual([]);expect(localStorage.getItem('gm_npcs')).toBeNull();
 data.records[0].evidence.approval='approved';data.records[0].actor_binding!.transitions=[{id:'future',from_effect_id:'captive',to_effect:{id:'freed',name:'Freed',description:'Future'},source_location_id:'cell'}];
 initializeDossierActors({...input(),payload:data});expect(JSON.parse(localStorage.getItem('gm_npcs')!)[0].statusEffects[0].id).toBe('captive');
});


test('a later conflicting actor prevents all writes in the initialization batch',()=>{
 const data:DossierRagPayload=JSON.parse(JSON.stringify(payload));
 const second=JSON.parse(JSON.stringify(data.records[0]));second.record_id='second';second.tags.entities=['npc-b'];second.actor_binding.entity_id='npc-b';data.records.push(second);
 localStorage.setItem('gm_npcs',JSON.stringify([{id:'npc-b',sessionId:'foreign'}]));const before=localStorage.getItem('gm_npcs');
 expect(()=>initializeDossierActors({...input(),payload:data})).toThrow('DOSSIER_NPC_SESSION_CONFLICT');
 expect(localStorage.getItem('gm_npcs')).toBe(before);
});


test('explicit fresh session archives played actors and seeds only its own canonical actors', () => {
 initializeDossierActors(input());
 const played = JSON.parse(localStorage.getItem('gm_npcs')!);
 Object.assign(played[0], {status:'dead',locationId:'outside',statusEffects:[],hp:0});
 const unrelated = {id:'other-adventure-npc',sessionId:'unrelated',status:'alive'};
 played.push(unrelated);
 localStorage.setItem('gm_npcs',JSON.stringify(played));
 initializeDossierActors({...input(),sessionId:'play-b',freshSession:true});
 const current = JSON.parse(localStorage.getItem('gm_npcs')!);
 expect(current.find((npc:{id:string})=>npc.id==='npc-a')).toMatchObject({sessionId:'play-b',status:'alive',locationId:'cell'});
 expect(current.find((npc:{id:string})=>npc.id==='npc-a').hp).toBeUndefined();
 expect(current.find((npc:{id:string})=>npc.id===unrelated.id)).toEqual(unrelated);
 expect(JSON.parse(localStorage.getItem('dossier_npcs_session:play-a')!).npcs).toEqual(played);
 // Restoring A retrieves its played state, never the factory opening.
 initializeDossierActors(input());
 expect(JSON.parse(localStorage.getItem('gm_npcs')!).find((npc:{id:string})=>npc.id==='npc-a')).toEqual(played[0]);
 expect(localStorage.getItem('dossier_npcs_session:play-b')).not.toBeNull();
});

test('fresh session validates every actor before archiving or changing current NPCs', () => {
 initializeDossierActors(input());
 const data:DossierRagPayload=JSON.parse(JSON.stringify(payload));
 const second=JSON.parse(JSON.stringify(data.records[0]));second.record_id='invalid-second';second.actor_binding.entity_id='npc-b';
 data.records.push(second);
 const before = Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)]));
 expect(()=>initializeDossierActors({...input(),sessionId:'play-b',payload:data,freshSession:true})).toThrow('DOSSIER_NPC_INITIALIZATION_CARD');
 expect(Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)]))).toEqual(before);
});

test('restore rejects an archive from another edition without writing', () => {
 initializeDossierActors(input());
 initializeDossierActors({...input(),sessionId:'play-b',freshSession:true});
 const key='dossier_npcs_session:play-a';
 const archive=JSON.parse(localStorage.getItem(key)!);archive.editionFingerprint='sha256:'+'b'.repeat(64);
 localStorage.setItem(key,JSON.stringify(archive));
 const before=localStorage.getItem('gm_npcs');
 expect(()=>initializeDossierActors(input())).toThrow('DOSSIER_NPC_ARCHIVE_BINDING');
 expect(localStorage.getItem('gm_npcs')).toBe(before);
});


test('archive storage failure preserves the entire active played state', () => {
 initializeDossierActors(input());
 const before=localStorage.getItem('gm_npcs');
 const storage={getItem:(key:string)=>localStorage.getItem(key),setItem:(key:string,value:string)=>{
   if(key==='dossier_npcs_session:play-a') throw new Error('quota');
   localStorage.setItem(key,value);
 }};
 expect(()=>initializeDossierActors({...input(),sessionId:'play-b',freshSession:true,storage})).toThrow('quota');
 expect(localStorage.getItem('gm_npcs')).toBe(before);
 expect(localStorage.getItem('dossier_npcs_session:play-b')).toBeNull();
});

test('a foreign legacy session is preserved without inventing a restorable edition binding', () => {
 const legacy=[{id:'npc-a',sessionId:'legacy',status:'dead'}];
 localStorage.setItem('gm_npcs',JSON.stringify(legacy));
 initializeDossierActors({...input(),freshSession:true});
 const archive=JSON.parse(localStorage.getItem('dossier_npcs_session:legacy')!);
 expect(archive).toMatchObject({adventureId:null,editionFingerprint:null,npcs:legacy});
 const before=localStorage.getItem('gm_npcs');
 expect(()=>initializeDossierActors({...input(),sessionId:'legacy'})).toThrow('DOSSIER_NPC_ARCHIVE_BINDING');
 expect(localStorage.getItem('gm_npcs')).toBe(before);
});
