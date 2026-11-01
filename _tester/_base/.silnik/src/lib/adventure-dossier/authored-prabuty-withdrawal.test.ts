import {TextEncoder} from 'node:util';
import {webcrypto} from 'node:crypto';
import {createAuthoredPrabutyPayload,PRABUTY_WORLD_IDS} from './authored-prabuty';
import {authorizeLocalDraftPayload,fingerprintLocalDraftPayload} from './runtime-authorization';
import {emptyDossierWorldState,projectDossierWorldState} from './world-object-state';
import {applyAuthoredPrabutyTurn,isExplicitPrabutyWithdrawal} from './authored-prabuty-turn';
import {buildAuthoredPrabutyWithdrawal} from './authored-prabuty-withdrawal';
import {parseAIResponse} from '../response-parser';

beforeAll(()=>{Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});});
const declaration='Odkładam słuchawkę. Notuję dokładnie odmowę interwencji i godzinę rozmowy, bez dopisywania teorii. Decyduję, że na tym kończę tę wyprawę: nie wracam samotnie do otwartego szybu pod grożącym zawaleniem murem. Wracam fiatem do Warszawy z teczką i aparatem.';
async function fixture(){
 const hash=await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload('sha256:'+'0'.repeat(64)));
 const payload=await authorizeLocalDraftPayload(createAuthoredPrabutyPayload(hash),{adventureId:'cien-nad-prabutami',editionFingerprint:hash});
 const state=emptyDossierWorldState({playthroughId:'play',adventureId:payload.adventure_id,editionFingerprint:hash},payload);
 return {payload,state,world:projectDossierWorldState(state),message:declaration,locale:'pl' as const,
 gameTime:{year:1973,month:9,day:19,hour:3,minute:55}};
}
test('the real unambiguous multi-sentence decision is recognized without treating arbitrary travel as withdrawal',()=>{
 expect(isExplicitPrabutyWithdrawal(declaration)).toBe(true);
 for(const message of ['Wracam do Warszawy.','Nie wycofuję się ze śledztwa.','Czy wycofuję się ze śledztwa?',
 'Jeśli zabraknie tropów, wycofuję się ze śledztwa.','Helena mówi: „wycofuję się ze śledztwa”.',
 'Powiedziałem: "Wycofuję się ze śledztwa."','Gdybym powiedział: wycofuję się ze śledztwa.',
 "Cytat: 'Nie wiem. Wycofuję się ze śledztwa. To wszystko.'",
 'Jeżeli to konieczne: Wycofuję się ze śledztwa.',
 'O ile będzie trzeba: Wycofuję się ze śledztwa.',
 'Rozważam opcję: wycofuję się ze śledztwa.',
 'W notatce czytam: wycofuję się ze śledztwa.',
 'Kiedy zabraknie tropów: wycofuję się ze śledztwa.',
 'To nie jest moja decyzja: wycofuję się ze śledztwa.',
 'Rozważam, czy kończę tę wyprawę.' ,'Kończę sesję na dziś.','Nie. Wycofuję się ze śledztwa?']){
 expect(isExplicitPrabutyWithdrawal(message)).toBe(false);
 }
 expect(isExplicitPrabutyWithdrawal('Wycofuję się ze śledztwa.')).toBe(true);
});
test('code-authored withdrawal has a terminal marker and exact unchanged clock, with no invented test, movement or item mutation',async()=>{
 const x=await fixture(),before=JSON.stringify(x);
 const text=buildAuthoredPrabutyWithdrawal(x);expect(text).not.toBeNull();
 const parsed=parseAIResponse(text!);expect(parsed.skillTests??[]).toHaveLength(0);
 expect(parsed.timeUpdate).toEqual(x.gameTime);
 expect(text).toContain('[KONIEC_SESJI:POTWIERDZENIE]');
 expect(text).not.toMatch(/\[(?:LOKACJA|LOCATION|EKWIPUNEK|TECZKA_STANU|TEST):/);
 expect(JSON.stringify(x)).toBe(before);
 const result=applyAuthoredPrabutyTurn({...x,turnId:'withdraw-real',writesAllowed:true,location:'',rawText:text!,
 playerMessage:x.message,skillTests:[],skillRolls:[]});
 expect(result.rejected).toEqual([]);expect(result.ending).toBe('withdrawn');
 expect(result.events).toEqual([PRABUTY_WORLD_IDS.ending+'/withdraw']);
});
test('no deterministic response for unbound, modified, terminal or ordinary game data',async()=>{
 const x=await fixture();
 expect(buildAuthoredPrabutyWithdrawal({...x,payload:JSON.parse(JSON.stringify(x.payload))})).toBeNull();
 expect(buildAuthoredPrabutyWithdrawal({...x,message:'Badam szyb.'})).toBeNull();
 expect(buildAuthoredPrabutyWithdrawal({...x,world:{...x.world,editionFingerprint:'sha256:'+'f'.repeat(64)}})).toBeNull();
 expect(buildAuthoredPrabutyWithdrawal({...x,world:{...x.world,objects:[]}})).toBeNull();
 expect(buildAuthoredPrabutyWithdrawal({...x,world:{...x.world,objects:x.world.objects.map(o=>o.entityId===PRABUTY_WORLD_IDS.ending?{...o,state:'withdrawn'}:o)}})).toBeNull();
});
test('the authored deadline remains authoritative over a late withdrawal',async()=>{
 const x=await fixture(),gameTime={...x.gameTime,hour:23,minute:59};
 const text=buildAuthoredPrabutyWithdrawal({...x,gameTime})!;
 const result=applyAuthoredPrabutyTurn({...x,gameTime,turnId:'late-withdraw',writesAllowed:true,location:'',
 rawText:text,playerMessage:x.message,skillTests:[],skillRolls:[]});
 expect(result.ending).toBe('operation-completed');
 expect(text).toContain('Czas na powstrzymanie operacji minął.');
 expect(text).not.toContain('Wycofanie ze śledztwa');
});


test('the real ordinary response gate stages off-graph withdrawal without writes and rejects unknown location or a missing finalization token',async()=>{
 const {createDossierResponseGate}=await import('./response-gate');
 const x=await fixture(),text=buildAuthoredPrabutyWithdrawal(x)!;
 localStorage.clear();
 const base={payload:x.payload,adventureId:x.payload.adventure_id,editionFingerprint:x.payload.edition_fingerprint,
  playthroughId:x.world.playthroughId,turnId:'withdraw-actual-gate',location:'OFF_GRAPH',offGraph:true,ordinaryTurn:true,
  now:new Date(0),gameTime:x.gameTime,era:'1970s',characters:[],activeCharacter:null,skillTests:[],skillRolls:[],
  playerMessage:x.message,isCurrent:()=>true};
 const metadata={type:'metadata' as const,dossierFinalizationToken:'staged-token',dossierInventoryWritesAllowed:true,timeUpdate:x.gameTime};
 const gate=createDossierResponseGate(base);gate.validate(text,metadata);
 expect(gate.candidate?.codeEvidence?.ending).toBe('withdrawn');expect(gate.token).toBe('staged-token');
 expect(gate.gameTime).toEqual(x.gameTime);expect(localStorage.length).toBe(0);
 const unknown=createDossierResponseGate({...base,offGraph:false,location:'unknown'});
 expect(()=>unknown.validate(text,metadata)).toThrow('DOSSIER_LOCATION_REQUIRED');expect(unknown.candidate).toBeUndefined();
 const missing=createDossierResponseGate(base);
 expect(()=>missing.validate(text,{...metadata,dossierFinalizationToken:undefined})).toThrow('DOSSIER_FINALIZATION_REQUIRED');
 expect(missing.candidate).toBeUndefined();expect(localStorage.length).toBe(0);
});
