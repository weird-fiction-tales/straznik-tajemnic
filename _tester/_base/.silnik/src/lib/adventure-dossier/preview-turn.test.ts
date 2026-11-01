import { previewDossierTurn } from './preview-turn';
import { emptyDossierInventory } from './inventory-state';
import { emptyDossierWorldState } from './world-object-state';
import type { DossierRagPayload, DossierRagRecord } from './rag-schema';
import type { Character } from '../types';
const fingerprint='sha256:'+'a'.repeat(64);
const binding={playthroughId:'play',adventureId:'fixture',editionFingerprint:fingerprint};
const card=(record_id:string):DossierRagRecord=>({schema_version:1,record_id,record_type:'fact',adventure_id:'fixture',edition_fingerprint:fingerprint,language:'pl',content:'Neutral fixture',tags:{entities:[record_id],scenes:['cell'],mechanics:[],topics:[],triggers:[]},retrieval:{visibility:'gm_only',availability:'always',condition:null,priority:1},evidence:{provenance:'approved_design',source_ref:'fixture',status:'set',approval:'approved',approved_by:'fixture',approved_at:'2026-10-20'},links:[]});
const payload:DossierRagPayload={schema_version:1,adventure_id:'fixture',edition_fingerprint:fingerprint,records:[
 {...card('npc'),record_type:'actor',actor_binding:{entity_id:'npc',name:'Witness',transitions:[{id:'free',from_effect_id:'bound',to_effect:{id:'free',name:'Free',description:'Unbound'},source_location_id:'cell'}]}},
 {...card('door'),world_object_binding:{entity_id:'door',initial_state:'closed',states:['closed','open'],transitions:[{id:'open',from:'closed',to:'open'}]}},
 {...card('key'),inventory_item:{entity_id:'key',name:'Key',category:'story',source_location:'cell'}},
]};
const character:Character={id:'pc',name:'Ada',occupation:'Detective',age:30,str:50,con:50,siz:50,dex:50,app:50,int:50,pow:50,edu:50,skills:{},hp:10,san:50,maxSan:99,luck:50,mp:10,equipment:[],background:'',playerName:'Player',isActive:true,lastUsed:new Date(0),notes:'',experience:{totalXP:0,availableXP:0,earnedThisSession:0,maxEarnedThisSession:0},developmentHistory:[]};
const input=()=>({payload,...binding,turnId:'turn',rawText:'Result. [TECZKA_STANU: npc | free] [TECZKA_STANU: door | open] [EKWIPUNEK: DODAJ | @key]',location:'cell',writesAllowed:true,now:new Date(0),gameTime:{year:1925,month:5,day:20,hour:10,minute:0},era:'1920s',skillTests:[],skillRolls:[],characters:[character],activeCharacter:character,inventory:emptyDossierInventory(binding),world:emptyDossierWorldState(binding,payload),npcs:[{id:'npc',status:'alive' as const,locationId:'cell',location:'Cell',tags:[],statusEffects:[{id:'bound',name:'Bound',description:'Captive',type:'other' as const,timestamp:new Date(0)}]}]});
test('previews all three existing adapters without mutating input or storage',()=>{
 const x=input(),before=JSON.stringify(x);const write=jest.spyOn(Storage.prototype,'setItem');
 const result=previewDossierTurn(x);expect(result.ok).toBe(true);
 if(!result.ok)throw new Error('Expected accepted preview');
 expect(result.next.npcs[0].statusEffects[0].id).toBe('free');
 expect(result.next.world.objects[0].state).toBe('open');
 expect(result.next.inventory.entries[0].holderId).toBe('pc');
 expect(JSON.stringify(x)).toBe(before);expect(write).not.toHaveBeenCalled();write.mockRestore();
});
test('one rejection exposes no partially applicable candidate',()=>{
 const x=input();x.rawText+=' [TECZKA_STANU: door | absent]';
 const before=JSON.stringify(x);const result=previewDossierTurn(x);
 expect(result.ok).toBe(false);expect(result).not.toHaveProperty('next');expect(JSON.stringify(x)).toBe(before);
});
test.each(['[TECZKA_STANU: unknown | change]','[TECZKA_STANU: npc |','[EKWIPUNEK: DODAJ | @missing]'])('rejects unknown or incomplete action %s',rawText=>{
 expect(previewDossierTurn({...input(),rawText}).ok).toBe(false);
});
test('rejects write gate and mismatched campaign before preparing a commit',()=>{
 expect(previewDossierTurn({...input(),writesAllowed:false}).ok).toBe(false);
 const x=input();x.world.playthroughId='other';expect(previewDossierTurn(x).ok).toBe(false);
});

import {TextEncoder} from 'node:util';
import {webcrypto} from 'node:crypto';
import {createAuthoredPrabutyPayload,PRABUTY_WORLD_IDS} from './authored-prabuty';
import {authorizeLocalDraftPayload,fingerprintLocalDraftPayload} from './runtime-authorization';
beforeAll(()=>{Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});});
async function authoredInput(){
 const editionFingerprint=await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload('sha256:'+'0'.repeat(64)));
 const payload=await authorizeLocalDraftPayload(createAuthoredPrabutyPayload(editionFingerprint),{adventureId:'cien-nad-prabutami',editionFingerprint});
 const binding={playthroughId:'authored-play',adventureId:payload.adventure_id,editionFingerprint};
 return {...input(),...binding,payload,rawText:'Neutral narration.',location:'loc-warszawa-redakcja',npcs:[],
  gameTime:{year:1973,month:9,day:18,hour:19,minute:30},
  inventory:emptyDossierInventory(binding),world:emptyDossierWorldState(binding,payload)};
}
test('authored preview rejects narrator-only ending and requires human withdrawal intent',async()=>{
 const x=await authoredInput();x.rawText='[KONIEC_SESJI:POTWIERDZENIE]';
 expect(previewDossierTurn(x)).toMatchObject({ok:false,rejected:['PRABUTY_ENDING_REQUIRED']});
 const before=JSON.stringify(x),accepted=previewDossierTurn({...x,playerMessage:'/wycofaj'});
 expect(accepted).toMatchObject({ok:true,codeEvidence:{ending:'withdrawn'}});
 expect(JSON.stringify(x)).toBe(before);
});
test('authored preview stages remote clock events and terminal evidence without committing any storage',async()=>{
 const x=await authoredInput();x.gameTime={...x.gameTime,day:19,hour:23,minute:59};
 const before=JSON.stringify(x),write=jest.spyOn(Storage.prototype,'setItem');
 const candidate=previewDossierTurn(x);expect(candidate.ok).toBe(true);
 if(!candidate.ok)throw Error('Expected code-owned clock candidate');
 expect(candidate.next.world.objects.find(o=>o.entityId===PRABUTY_WORLD_IDS.ending)!.state).toBe('operation-completed');
 expect(candidate).toMatchObject({codeEvidence:{adventureId:'cien-nad-prabutami',editionFingerprint:x.editionFingerprint,ending:'operation-completed'}});
 expect(JSON.stringify(x)).toBe(before);expect(write).not.toHaveBeenCalled();write.mockRestore();
});
