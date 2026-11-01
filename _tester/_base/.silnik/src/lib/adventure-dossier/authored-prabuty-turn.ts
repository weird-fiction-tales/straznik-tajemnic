import {createAuthoredPrabutyPayload,PRABUTY_AUTHORING_VERSION,PRABUTY_WORLD_IDS,
 canApplyPrabutyWorldTransition,getPrabutyEnding,type PrabutyEnding} from './authored-prabuty';
import {isRuntimeAuthorizedDossierRecord} from './runtime-authorization';
import {applyDossierWorldObjectTurn,isDossierWorldState,isDossierWorldStateForPayload,projectDossierWorldState,
 type DossierWorldState} from './world-object-state';
import {isGameTime} from '../time-manager';
import type {GameTime} from '../types';
import type {DossierRagPayload} from './rag-schema';
import type {SkillRollResolution,SkillTestData} from '../parsers/types';

const recognized=new WeakSet<DossierRagPayload>();
/** Only the exact enrolled factory copy gets this scenario's executable policy. */
export function isAuthoredPrabutyPlaytest(payload:DossierRagPayload):boolean{
 if(recognized.has(payload))return true;
 if(payload.adventure_id!=='cien-nad-prabutami'||!/^sha256:[a-f0-9]{64}$/.test(payload.edition_fingerprint)||!Object.isFrozen(payload)||!payload.records.length||
  payload.records.some(record=>record.evidence.approval!=='pending'||!isRuntimeAuthorizedDossierRecord(record)||
   !record.tags.topics.includes(PRABUTY_AUTHORING_VERSION)))return false;
 if(JSON.stringify(payload)!==JSON.stringify(createAuthoredPrabutyPayload(payload.edition_fingerprint)))return false;
 recognized.add(payload);return true;
}
export interface AuthoredPrabutyClockInput {
 payload:DossierRagPayload;state:DossierWorldState;turnId:string;gameTime:GameTime;writesAllowed:boolean;
}
export interface AuthoredPrabutyTurnInput extends AuthoredPrabutyClockInput {
 location:string;rawText:string;playerMessage?:string;skillTests:SkillTestData[];skillRolls:SkillRollResolution[];
}
export interface AuthoredPrabutyTurnResult {
 applicable:boolean;state:DossierWorldState;changed:boolean;ending:PrabutyEnding|null;events:string[];rejected:string[];
}
const objectState=(state:DossierWorldState,id:string)=>state.objects.find(object=>object.entityId===id)?.state||'';
const terminal=(state:DossierWorldState):PrabutyEnding|null=>{
 const value=objectState(state,PRABUTY_WORLD_IDS.ending);
 return value==='interrupted'||value==='operation-completed'||value==='withdrawn'?value:null;
};
/** Recognize a direct player decision, never quoted dialogue, a question or conditional intent. */
export function isExplicitPrabutyWithdrawal(message?:string):boolean{
 if(!message)return false;
 const text=message.normalize('NFKC').trim().toLocaleLowerCase();
 if(text==='/wycofaj')return true;
 if(/[?\'`"„”«»“”\[\]]/.test(text)||/\b(?:if|would|said|unless)\b|(?:jeśli|jeżeli|gdyby|gdy |o ile|w razie|pod warunkiem|powiedział|mówi:|cytat:|nie wycofuję|nie kończę)/u.test(text))return false;
 const decisions=new Set(['wycofuję się z przygody','wycofuję się ze śledztwa',
  'decyduję, że na tym kończę tę wyprawę','i withdraw from the investigation']);
 return text.split(/[.!\n]/).some(sentence=>{
  const statement=sentence.trim();
  return [...decisions].some(decision=>statement===decision||statement.startsWith(decision+':'));
 });
}
function execute(input:AuthoredPrabutyClockInput,player?:AuthoredPrabutyTurnInput):AuthoredPrabutyTurnResult{
 const unchanged=(applicable:boolean,rejected:string[]=[]):AuthoredPrabutyTurnResult=>
  ({applicable,state:input.state,changed:false,ending:null,events:[],rejected});
 if(!isAuthoredPrabutyPlaytest(input.payload))return unchanged(false);
 if(!isGameTime(input.gameTime)||!isDossierWorldState(input.state)||!isDossierWorldStateForPayload(projectDossierWorldState(input.state),input.payload)||
  !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(input.turnId))return unchanged(true,['PRABUTY_TURN_CONTEXT_INVALID']);
 let state=input.state,changed=false;
 const events:string[]=[],rejected:string[]=[];
 const context=()=>({gameTime:input.gameTime,generator:objectState(state,PRABUTY_WORLD_IDS.generator),
  rift:objectState(state,PRABUTY_WORLD_IDS.rift),withdrawalDeclared:isExplicitPrabutyWithdrawal(player?.playerMessage)});
 function apply(entityId:string,transitionId:string,system:boolean){
  if(!canApplyPrabutyWorldTransition({...context(),entityId,transitionId})){rejected.push('PRABUTY_TRANSITION_DENIED:'+entityId+'/'+transitionId);return;}
  if(!input.writesAllowed){rejected.push('DOSSIER_TURN_WRITES_DISABLED');return;}
  const record=input.payload.records.find(card=>card.world_object_binding?.entity_id===entityId)!;
  // Clock events happen at their authored source location even when the investigator is elsewhere.
  const location=system?(record.tags.scenes[0]||''):player!.location;
  const result=applyDossierWorldObjectTurn({payload:input.payload,state,turnId:input.turnId+':prabuty:'+events.length,
   rawText:'[TECZKA_STANU: '+entityId+' | '+transitionId+']',location,writesAllowed:input.writesAllowed,
   skillTests:system?[]:player!.skillTests,skillRolls:system?[]:player!.skillRolls});
  if(result.rejected.length){rejected.push(...result.rejected);return;}
  state=result.state;changed||=result.changed;
  if(result.changed)events.push(entityId+'/'+transitionId);
 }
 if(!terminal(state)){
  if(objectState(state,PRABUTY_WORLD_IDS.generator)==='preparing'&&
   canApplyPrabutyWorldTransition({...context(),entityId:PRABUTY_WORLD_IDS.generator,transitionId:'start-generators'}))
   apply(PRABUTY_WORLD_IDS.generator,'start-generators',true);
  if(!rejected.length&&objectState(state,PRABUTY_WORLD_IDS.rift)==='latent'&&
   canApplyPrabutyWorldTransition({...context(),entityId:PRABUTY_WORLD_IDS.rift,transitionId:'open-rift'}))
   apply(PRABUTY_WORLD_IDS.rift,'open-rift',true);
 }
 function finalize(includeWithdrawal:boolean){
  if(rejected.length||terminal(state))return;
  const ending=getPrabutyEnding({...context(),withdrawalDeclared:includeWithdrawal&&isExplicitPrabutyWithdrawal(player?.playerMessage)});
  if(!ending)return;
  const transition=ending==='interrupted'?(context().rift==='latent'?'prevent-experiment':'interrupt-experiment'):
   ending==='operation-completed'?'complete-operation':'withdraw';
  apply(PRABUTY_WORLD_IDS.ending,transition,true);
 }
 // The request projector and final preview must resolve the same deadline outcome
 // before considering player effects from the generated response.
 finalize(false);
 if(player&&!rejected.length){
  const tags=[...player.rawText.matchAll(/\[TECZKA_STANU:\s*([^|\]]+)\|([^\]]+)\]/gi)];
  for(const tag of tags){
   const entityId=tag[1].trim(),transitionId=tag[2].trim();
   if(!Object.values(PRABUTY_WORLD_IDS).some(id=>id===entityId))continue;
   if(terminal(state)){rejected.push('PRABUTY_ALREADY_ENDED');break;}
   apply(entityId,transitionId,false);
   if(rejected.length)break;
  }
 }
 finalize(true);
 const ending=terminal(state);
 if(player&&/\[(?:KONIEC_SESJI|END_SESSION)(?::[^\]]*)?\]/i.test(player.rawText)&&!ending)rejected.push('PRABUTY_ENDING_REQUIRED');
 if(rejected.length)return unchanged(true,rejected);
 return {applicable:true,state,changed,ending,events,rejected:[]};
}
/** Pure projector for GM context. The candidate must still pass the normal atomic commit gate. */
export function advanceAuthoredPrabutyClock(input:AuthoredPrabutyClockInput):AuthoredPrabutyTurnResult{return execute(input);}
export function applyAuthoredPrabutyTurn(input:AuthoredPrabutyTurnInput):AuthoredPrabutyTurnResult{return execute(input,input);}
