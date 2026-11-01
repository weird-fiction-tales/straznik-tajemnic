/** Acceptance matrix replacing the historical diagnostic that intentionally asserted defects.
 * Exact original retained in test-results/deterministic-triggers/historical-diagnostic.test.ts.source.
 */
import { TextEncoder } from 'node:util';
import { webcrypto } from 'node:crypto';
import { createAuthoredEdition } from './authored-editions';
import { createDossierResponseGate } from './response-gate';
import { emptyDossierInventory } from './inventory-state';
import { emptyDossierWorldState } from './world-object-state';
import { planPrabutyTurn } from './prabuty-action-plan';
import { appendJournalToParty } from '../journal/apply-journal-tags';
import type { Character } from '../types';
import type { DossierRagPayload } from './rag-schema';
let payload:DossierRagPayload;
const character:Character={id:'pc-a',name:'Ada',occupation:'Detective',age:35,str:50,con:50,siz:50,dex:50,app:50,int:50,pow:50,edu:50,
 skills:{},hp:10,san:50,maxSan:99,luck:50,mp:10,equipment:[],background:'',playerName:'Player',isActive:true,
 lastUsed:new Date(0),notes:'',experience:{totalXP:0,availableXP:0,earnedThisSession:0,maxEarnedThisSession:0},developmentHistory:[]};
const time={year:1973,month:9,day:18,hour:19,minute:40};
const targets:Record<string,string>={
 'clue-photo-prabuty':'photograph','clue-prague-delegation-list':'delegation list','clue-skrzynski-psychotronic-report':"Skrzynski's report",
 'clue-herbal-recipe-152':'herbal recipe','clue-wiretap-bug-elblag':'wiretap bug','clue-klimuszko-vision-crypt':'vision',
 'clue-amber-ashes':'amber ashes','clue-polak-testimony-monk':'Polak about the monk','clue-military-tire-tracks':'tire tracks',
 'clue-sb-file-klin':'KLIN file','clue-sb-wiretap-elblag-log':'reel-to-reel tape','clue-msw-excavation-order':'excavation order',
};
beforeAll(async()=>{Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});payload=(await createAuthoredEdition('cien-nad-prabutami')).payload;});
beforeEach(()=>localStorage.clear());
function input(index:number,message:string){
 const card=payload.records.filter(r=>r.record_type==='clue')[index];
 const binding={adventureId:payload.adventure_id,editionFingerprint:payload.edition_fingerprint,playthroughId:'matrix'};
 return {payload,...binding,turnId:'matrix-'+index,playerMessage:message,location:card.tags.scenes.find(s=>s.startsWith('loc-'))!,gameTime:time,
  world:emptyDossierWorldState(binding,payload),inventory:emptyDossierInventory(binding),characters:[character],activeCharacter:character,
  skillTests:[],skillRolls:[],now:new Date(0),era:'prl-1970s',ordinaryTurn:true,isCurrent:()=>true};
}
const metadata=()=>({type:'metadata' as const,dossierFinalizationToken:'test',dossierInventoryWritesAllowed:true});
test.each(Array.from({length:12},(_,i)=>i))('source %i records its actual bound journal clue with no AI tag or retrieval ID',index=>{
 const card=payload.records.filter(r=>r.record_type==='clue')[index],id=card.record_id.replace('prabuty.clue.','');
 const gate=createDossierResponseGate(input(index,'I examine the '+targets[id]+'.'));
 gate.validate('You examine the source.',metadata());
 const result=appendJournalToParty([character],character,gate.candidate!.cleanText,'matrix-'+index,undefined,gate.actionPlan!.clueIds);
 expect(result.activeCharacter.investigatorDossier?.clues).toHaveLength(1);
 expect(result.activeCharacter.investigatorDossier!.clues[0].dossierRecordId).toBe(card.record_id);
 const repeated=appendJournalToParty(result.characters,result.activeCharacter,gate.candidate!.cleanText,'repeat-'+index,undefined,gate.actionPlan!.clueIds);
 expect(repeated.activeCharacter.investigatorDossier?.clues).toHaveLength(1);
});
test.each(Array.from({length:12},(_,i)=>i))('source %i requests its own bonus and discloses extra content only after the matching local success',index=>{
 const card=payload.records.filter(r=>r.record_type==='clue')[index],id=card.record_id.replace('prabuty.clue.','');
 const ctx=input(index,'I study the '+targets[id]+'.'),request=planPrabutyTurn(ctx)!;
 expect(request.skillTests).toHaveLength(1);const test={...request.skillTests[0],skillValue:60};
 const roll={testId:test.id,resolutionId:'resolved-'+index,characterId:character.id,skillNames:[test.skillName],requiredDifficulty:'regular' as const,outcome:'regular' as const,passedRequirement:true,luckSpent:0};
 const content=JSON.parse(card.content) as {sourceDescription:string};
 const success=planPrabutyTurn({...ctx,playerMessage:'Local result.',skillTests:[test],skillRolls:[roll]})!;
 expect(success.journalText).toContain(content.sourceDescription);
 const failure=planPrabutyTurn({...ctx,playerMessage:'Local result.',skillTests:[test],skillRolls:[{...roll,outcome:'fail',passedRequirement:false}]})!;
 expect(failure.clueIds).toEqual([card.record_id]);expect(failure.journalText).not.toContain(content.sourceDescription);expect(failure.inventoryText).toBe('');
 const wrong=planPrabutyTurn({...ctx,playerMessage:'Local result.',skillTests:[test],skillRolls:[{...roll,characterId:'someone-else'}]})!;
 expect(wrong.clueIds).toEqual([]);expect(wrong.worldText).toBe('');
});
test('retrieval and narrator aliases alone cannot create any discovered clue',()=>{
 const ctx=input(0,'I wait.');const gate=createDossierResponseGate(ctx);
 gate.validate('[JOURNAL:trop:Secret]Unknown source[/JOURNAL] [ITEM: Secret: Unknown source]',{...metadata(),dossierClueRecordIds:payload.records.filter(r=>r.record_type==='clue').map(r=>r.record_id)});
 const result=appendJournalToParty([character],character,gate.candidate!.cleanText,'not-acquired',undefined,gate.actionPlan!.clueIds);
 expect(result.activeCharacter.investigatorDossier?.clues??[]).toEqual([]);
});
