import { bindDossierActors, renderDossierActorState } from './actor-binding';
import { acquiredHandoutsFromTurn } from './local-handouts';
import { applyDossierInventoryTurn } from './apply-inventory-turn';
import { emptyDossierInventory } from './inventory-state';
import type { DossierRagPayload,DossierRagRecord } from './rag-schema';
import type { Character } from '../types';
const fingerprint='sha256:'+'c'.repeat(64);
const card=(id:string):DossierRagRecord=>({schema_version:1,record_id:id,record_type:'fact',adventure_id:'audit-neutral',edition_fingerprint:fingerprint,language:'pl',content:'Autorski neutralny przykład audytu.',tags:{entities:['actor-a'],scenes:['room'],mechanics:[],topics:[],triggers:[]},retrieval:{visibility:'gm_only',availability:'always',condition:null,priority:1},evidence:{provenance:'approved_design',source_ref:'neutral author fixture',status:'set',approval:'approved',approved_by:'test',approved_at:'2026-10-16T00:00:00Z'},links:[]});
const actor=card('actor');actor.actor_binding={entity_id:'actor-a',name:'Neutralny Aktor'};
const handout=card('handout');handout.local_handout={kind:'embedded_image',pdf_page:1,width:1,height:1,rgba_sha256:'a'.repeat(64),title:'Autorski arkusz',audience:'party'};
const item=card('item');item.inventory_item={entity_id:'object-a',name:'Autorski klucz',category:'story',source_location:'room'};
const payload:DossierRagPayload={schema_version:1,adventure_id:'audit-neutral',edition_fingerprint:fingerprint,records:[actor,handout,item]};
const character:Character={id:'pc-a',name:'Ada',occupation:'Detektyw',age:35,str:50,con:50,siz:50,dex:50,app:50,int:50,pow:50,edu:50,skills:{},hp:10,san:50,maxSan:99,luck:50,mp:10,equipment:[],background:'',playerName:'Gracz',isActive:true,lastUsed:new Date('2026-01-01'),notes:'',experience:{totalXP:0,availableXP:0,earnedThisSession:0,maxEarnedThisSession:0},developmentHistory:[]};
test('NPC canonical binding projects campaign state without rewriting authoring',()=>{
 const before=JSON.stringify(payload);const bound=bindDossierActors(payload.records,[{id:'actor-a',name:'Neutralny Aktor',status:'dead',locationId:'elsewhere'}]);
 expect(bound.stateByEntityId.get('actor-a')?.status).toBe('dead');expect(renderDossierActorState(actor,bound)).toContain('dead');expect(JSON.stringify(payload)).toBe(before);
 const ambiguous=bindDossierActors(payload.records,[{id:'runtime-1',name:'Neutralny Aktor'},{id:'runtime-2',name:'Neutralny Aktor'}]);expect(ambiguous.stateByEntityId.size).toBe(0);
 const pending={...actor,evidence:{...actor.evidence,approval:'pending' as const}};expect(bindDossierActors([pending],[{id:'actor-a',name:'Neutralny Aktor'}]).stateByEntityId.size).toBe(0);
});
test('handout needs eligible locator and explicit acquisition; repeats do not duplicate',()=>{
 expect(acquiredHandoutsFromTurn('Opis dokumentu', ['handout'],payload)).toEqual([]);
 expect(acquiredHandoutsFromTurn('[HANDOUT:handout]', [],payload)).toEqual([]);
 expect(acquiredHandoutsFromTurn('[HANDOUT:handout] [HANDOUT:handout] [HANDOUT:unknown]', ['handout','unknown'],payload)).toEqual(['handout']);
});
test('transfer and drop preserve unique object instance and ownership',()=>{
 const second={...character,id:'pc-b',name:'Jan'};
 const start=emptyDossierInventory({playthroughId:'audit-only',adventureId:payload.adventure_id,editionFingerprint:fingerprint});
 const base={payload,state:start,characters:[character,second],activeCharacter:character,location:'room',writesAllowed:true,era:'1920s' as const};
 const take=applyDossierInventoryTurn({...base,turnId:'take',rawText:'[EKWIPUNEK: DODAJ | @item]'});
 expect(take.state.entries).toHaveLength(1);
 const give=applyDossierInventoryTurn({...base,state:take.state,characters:take.characters,activeCharacter:take.activeCharacter,turnId:'give',rawText:'[EKWIPUNEK:@Ada: PRZEKAZ | @item | Jan]'});
 expect(give.state.entries[0].holderId).toBe(second.id);expect(give.state.entries[0].item.id).toBe(take.state.entries[0].item.id);
 const drop=applyDossierInventoryTurn({...base,state:give.state,characters:give.characters,activeCharacter:give.characters.find(c=>c.id===second.id)!,turnId:'drop',rawText:'[EKWIPUNEK: ODLOZ | @item]'});
 expect(drop.state.entries[0]).toMatchObject({placement:'location',holderId:null,location:'room'});
 expect(drop.state.entries[0].item.id).toBe(take.state.entries[0].item.id);
});

test('anonymous actors sharing a label bind by canonical ID but never by ambiguous name alone',()=>{
 const second={...actor,record_id:'actor-2',actor_binding:{entity_id:'actor-b',name:actor.actor_binding!.name}};
 const records=[actor,second];
 const bound=bindDossierActors(records,[{id:'actor-a',name:'Neutralny Aktor',status:'dead'},{id:'actor-b',name:'Neutralny Aktor',status:'alive'}]);
 expect(bound.stateByEntityId.get('actor-a')?.status).toBe('dead');expect(bound.stateByEntityId.get('actor-b')?.status).toBe('alive');
 expect(bindDossierActors(records,[{id:'runtime-new',name:'Neutralny Aktor'}]).stateByEntityId.size).toBe(0);
});

it('preserves current NPC effects in dossier context without interpreting them as automatic transitions',()=>{
 const observation={id:'actor-a',name:'Neutralny Aktor',status:'alive' as const,
  locationId:'safe-place',statusEffects:[{id:'rescued',name:'Uwolniony',type:'other' as const,description:'Uratowany z niewoli',timestamp:new Date('2026-01-01')} ]};
 const bound=bindDossierActors([actor],[observation]);
 const rendered=renderDossierActorState(actor,bound);
 expect(rendered).toContain('rescued');
 expect(rendered).toContain('safe-place');
 expect(rendered).not.toContain('timestamp');
 expect(JSON.stringify(observation.statusEffects)).toContain('2026-01-01');
});

it('bounds NPC effect projection and omits malformed effects and unreviewed identities',()=>{
 const effect={id:'rescued',name:'Uwolniony',type:'other',description:'Uratowany',extra:'must-not-project'};
 const observation={id:'actor-a',name:'Neutralny Aktor',statusEffects:[{...effect,id:''},{...effect,type:'invented'},effect]};
 const projected=bindDossierActors([actor],[observation]).stateByEntityId.get('actor-a');
 expect(projected?.statusEffects).toEqual([{id:'rescued',name:'Uwolniony',type:'other',description:'Uratowany'}]);
 expect(bindDossierActors([actor],[{...observation,statusEffects:Array.from({length:100},(_,i)=>({...effect,id:`effect-${i}`}))}]).stateByEntityId.get('actor-a')?.statusEffects).toHaveLength(32);
 const pending={...actor,evidence:{...actor.evidence,approval:'pending' as const}};
 expect(bindDossierActors([pending],[observation]).stateByEntityId.size).toBe(0);
});

test('offers an authored NPC transition only for matching current state and location',()=>{
 const reviewed={...actor,actor_binding:{...actor.actor_binding!,transitions:[{id:'rescue',from_effect_id:'bound',to_effect:{id:'freed',name:'Freed',description:'Rescued'},source_location_id:'cell'}]}};
 const observed={id:'actor-a',name:'Neutralny Aktor',status:'alive' as const,locationId:'cell',statusEffects:[{id:'bound',name:'Bound',type:'other',description:'Captive'}]};
 expect(renderDossierActorState(reviewed,bindDossierActors([reviewed],[observed]))).toContain('[TECZKA_STANU: actor-a | ID_PRZEJSCIA]');
 expect(renderDossierActorState(reviewed,bindDossierActors([reviewed],[{...observed,statusEffects:[]}]))).not.toContain('ID_PRZEJSCIA');
 expect(renderDossierActorState(reviewed,bindDossierActors([reviewed],[{...observed,locationId:'elsewhere'}]))).not.toContain('ID_PRZEJSCIA');
});
