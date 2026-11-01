import {TextEncoder} from 'node:util';
import {webcrypto} from 'node:crypto';
import {createAuthoredEnglewoodPayload,ENGLEWOOD_WORLD_IDS as ids} from './authored-englewood';
import {authorizeLocalDraftPayload,fingerprintLocalDraftPayload} from './runtime-authorization';
import {emptyDossierWorldState} from './world-object-state';
import {applyAuthoredScenarioTurn,advanceAuthoredScenarioClock} from './authored-scenario-turn';
beforeAll(()=>{Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});});
async function fixture(){
 const hash=await fingerprintLocalDraftPayload(createAuthoredEnglewoodPayload('sha256:'+'0'.repeat(64)));
 const payload=await authorizeLocalDraftPayload(createAuthoredEnglewoodPayload(hash),{adventureId:'englewood-murder-castle-1893',editionFingerprint:hash});
 const state=emptyDossierWorldState({playthroughId:'play',adventureId:payload.adventure_id,editionFingerprint:hash},payload);
 return {payload,state,turnId:'turn',gameTime:{year:1894,month:10,day:19,hour:19,minute:0},writesAllowed:true,
 location:payload.records.find(r=>r.world_object_binding?.entity_id===ids.keystone)!.tags.scenes[1],rawText:'',skillTests:[],skillRolls:[]};
}
test('does not accept narrator-only victory or withdrawal, nor a deadline early',async()=>{
 const x=await fixture();
 for(const transition of ['secure','withdraw','deadline']){
 const result=applyAuthoredScenarioTurn({...x,rawText:'[TECZKA_STANU: '+ids.ending+' | '+transition+']'});
 expect(result.rejected.length).toBeGreaterThan(0);expect(result.state).toBe(x.state);
 }
 expect(applyAuthoredScenarioTurn({...x,rawText:'[KONIEC_SESJI:POTWIERDZENIE]'}).rejected.length).toBeGreaterThan(0);
});
test('deadline derives from canonical time and is idempotent; explicit human withdrawal remains available',async()=>{
 const x=await fixture();
 const late=advanceAuthoredScenarioClock({...x,gameTime:{...x.gameTime,day:20,hour:2}});
 expect(late.ending).toBe('lost');expect(late.changed).toBe(true);
 expect(advanceAuthoredScenarioClock({...x,state:late.state}).changed).toBe(false);
 expect(applyAuthoredScenarioTurn({...x,playerMessage:'i withdraw from the investigation'}).ending).toBe('withdrawn');
 expect(applyAuthoredScenarioTurn({...x,playerMessage:'What if I withdraw from the investigation?'}).ending).toBeNull();
});
test('victory requires both accepted anchor destruction and physically acquired letters',async()=>{
 const x=await fixture();
 const test={id:'break-test',characterId:'frank',skillName:'Strength',skillValue:60,difficulty:'zwykly' as const,modifiers:[],justification:'Destroy anchor',dossierConditionId:'englewood-break-keystone'};
 const roll={testId:test.id,resolutionId:'break-roll',characterId:'frank',skillNames:['Strength'],requiredDifficulty:'regular' as const,outcome:'regular' as const,passedRequirement:true,luckSpent:0};
 const broken=applyAuthoredScenarioTurn({...x,skillTests:[test],skillRolls:[roll],rawText:'[TECZKA_STANU: '+ids.keystone+' | break-keystone]'});
 expect(applyAuthoredScenarioTurn({...x,skillTests:[test],skillRolls:[{...roll,outcome:'fail',passedRequirement:false}],rawText:'[TECZKA_STANU: '+ids.keystone+' | break-keystone]'}).rejected.length).toBeGreaterThan(0);
 expect(broken.rejected).toEqual([]);expect(broken.ending).toBeNull();
 const inventory={playthroughId:'play',adventureId:x.payload.adventure_id,editionFingerprint:x.payload.edition_fingerprint,
 entries:[{recordId:'englewood.item.letter-alice-pitezel-tin',placement:'character' as const,holderId:'frank',location:null}]};
 const won=applyAuthoredScenarioTurn({...x,turnId:'next',state:broken.state,inventory});
 expect(won.ending).toBe('secured');
 const mismatch=applyAuthoredScenarioTurn({...x,turnId:'next',state:broken.state,inventory:{...inventory,playthroughId:'other'}});
 expect(mismatch.ending).toBeNull();
 expect(applyAuthoredScenarioTurn({...x,location:'wrong',rawText:'[TECZKA_STANU: '+ids.keystone+' | break-keystone]'}).rejected.length).toBeGreaterThan(0);
});


test('deadline loses the case if the anchor is broken but the letters were not acquired',async()=>{
 const x=await fixture();
 const test={id:'break-test',characterId:'frank',skillName:'Strength',skillValue:60,difficulty:'zwykly' as const,modifiers:[],justification:'Destroy anchor',dossierConditionId:'englewood-break-keystone'};
 const roll={testId:test.id,resolutionId:'break-roll',characterId:'frank',skillNames:['Strength'],requiredDifficulty:'regular' as const,outcome:'regular' as const,passedRequirement:true,luckSpent:0};
 const broken=applyAuthoredScenarioTurn({...x,skillTests:[test],skillRolls:[roll],rawText:'[TECZKA_STANU: '+ids.keystone+' | break-keystone]'});
 expect(broken.rejected).toEqual([]);
 const late=advanceAuthoredScenarioClock({...x,turnId:'deadline-after-break',state:broken.state,gameTime:{...x.gameTime,day:20,hour:2}});
 expect(late.ending).toBe('lost');
});

test('a narrator cannot destroy the anchor without the matching resolved physical action',async()=>{
 const x=await fixture();
 const result=applyAuthoredScenarioTurn({...x,playerMessage:'I examine the room without touching anything.',rawText:'[TECZKA_STANU: '+ids.keystone+' | break-keystone]'});
 expect(result.rejected.length).toBeGreaterThan(0);expect(result.state).toBe(x.state);
});
