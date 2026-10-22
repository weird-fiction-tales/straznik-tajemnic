import {applyAuthoredPrabutyTurn,advanceAuthoredPrabutyClock,isExplicitPrabutyWithdrawal,
 type AuthoredPrabutyClockInput,type AuthoredPrabutyTurnInput} from './authored-prabuty-turn';
import {createAuthoredEnglewoodPayload,ENGLEWOOD_AUTHORING_VERSION,ENGLEWOOD_WORLD_IDS as ids} from './authored-englewood';
import {isRuntimeAuthorizedDossierRecord} from './runtime-authorization';
import {applyDossierWorldObjectTurn,isDossierWorldState,isDossierWorldStateForPayload,projectDossierWorldState} from './world-object-state';
import {isDossierInventoryProjection,type DossierInventoryProjection} from './inventory-state';
import {isGameTime} from '../time-manager';
import {authoredScenarioSource} from './authored-scenarios';
import type {DossierRagPayload} from './rag-schema';
const recognized=new WeakSet<DossierRagPayload>();
export function isAuthoredEnglewood(payload:DossierRagPayload){
 if(recognized.has(payload))return true;
 if(payload.adventure_id!=='englewood-murder-castle-1893'||!Object.isFrozen(payload)||!payload.records.length||
 payload.records.some(r=>!isRuntimeAuthorizedDossierRecord(r)||!r.tags.topics.includes(ENGLEWOOD_AUTHORING_VERSION))||
 JSON.stringify(payload)!==JSON.stringify(createAuthoredEnglewoodPayload(payload.edition_fingerprint)))return false;
 recognized.add(payload);return true;
}
type ClockInput=AuthoredPrabutyClockInput & {inventory?:DossierInventoryProjection};
type TurnInput=AuthoredPrabutyTurnInput & {inventory?:DossierInventoryProjection};
function execute(input:ClockInput,player?:TurnInput){
 const unchanged=(applicable:boolean,rejected:string[]=[])=>({applicable,state:input.state,changed:false,ending:null as string|null,events:[] as string[],rejected});
 if(!isAuthoredEnglewood(input.payload))return unchanged(false);
 if(!isGameTime(input.gameTime)||!isDossierWorldState(input.state)||
 !isDossierWorldStateForPayload(projectDossierWorldState(input.state),input.payload)||
 !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(input.turnId))return unchanged(true,['ENGLEWOOD_CONTEXT_INVALID']);
 let state=input.state,changed=false;const events:string[]=[],rejected:string[]=[];
 const value=(id:string)=>state.objects.find(o=>o.entityId===id)?.state;
 const terminal=()=>{const v=value(ids.ending);return v&&v!=='ongoing'?v:null;};
 const deadline=authoredScenarioSource(input.payload.adventure_id)!.doomClock!.deadline!;
 if(!isGameTime(deadline))return unchanged(true,['ENGLEWOOD_DEADLINE_INVALID']);
 const stamp=(t:typeof input.gameTime)=>Date.UTC(t.year,t.month,t.day,t.hour,t.minute);
 const letters=()=>{const i=input.inventory;return !!i&&isDossierInventoryProjection(i)&&
 i.playthroughId===state.playthroughId&&i.adventureId===state.adventureId&&i.editionFingerprint===state.editionFingerprint&&
 i.entries.some(e=>e.recordId==='englewood.item.letter-alice-pitezel-tin'&&e.placement==='character');};
 const derive=(withdraw:boolean)=>value(ids.keystone)==='broken'&&letters()?'secured':
 stamp(input.gameTime)>=stamp(deadline)&&(value(ids.keystone)!=='broken'||!letters())?'lost':
 withdraw&&isExplicitPrabutyWithdrawal(player?.playerMessage)?'withdrawn':null;
 function apply(entity:string,transition:string,system:boolean){
  if(!input.writesAllowed){rejected.push('DOSSIER_TURN_WRITES_DISABLED');return;}
  const card=input.payload.records.find(r=>r.world_object_binding?.entity_id===entity)!;
  const result=applyDossierWorldObjectTurn({payload:input.payload,state,turnId:input.turnId+':englewood:'+events.length,
   rawText:'[TECZKA_STANU: '+entity+' | '+transition+']',location:system?(card.tags.scenes[0]||''):player!.location,
   writesAllowed:true,skillTests:player?.skillTests??[],skillRolls:player?.skillRolls??[]});
  rejected.push(...result.rejected);if(!result.rejected.length){state=result.state;changed ||= result.changed;if(result.changed)events.push(entity+'/'+transition);}
 }
 function finalize(withdraw:boolean){if(terminal()||rejected.length)return;const end=derive(withdraw);
 if(end)apply(ids.ending,end==='secured'?'secure':end==='lost'?'deadline':'withdraw',true);}
 finalize(false);
 if(player&&!rejected.length){
  for(const tag of player.rawText.matchAll(/\[TECZKA_STANU:\s*([^|\]]+)\|([^\]]+)\]/gi)){
   const entity=tag[1].trim(),transition=tag[2].trim();
   if(entity!==ids.keystone&&entity!==ids.ending)continue;
   if(terminal()){rejected.push('ENGLEWOOD_ALREADY_ENDED');break;}
   if(entity===ids.ending){const expected=derive(true);const actual=transition==='secure'?'secured':transition==='deadline'?'lost':transition==='withdraw'?'withdrawn':null;
    if(!expected||actual!==expected){rejected.push('ENGLEWOOD_TRANSITION_DENIED');break;}}
   // A pending or failed local test cannot be narrated as physical success.
   if(entity===ids.keystone&&player.skillTests.some(t=>!player.skillRolls.some(r=>r.testId===t.id&&r.passedRequirement))){rejected.push('ENGLEWOOD_UNRESOLVED_ACTION');break;}
   apply(entity,transition,false);if(rejected.length)break;
  }
 }
 finalize(true);
 if(player&&/\[(?:KONIEC_SESJI|END_SESSION)(?::[^\]]*)?\]/i.test(player.rawText)&&!terminal())rejected.push('ENGLEWOOD_ENDING_REQUIRED');
 if(rejected.length)return unchanged(true,rejected);
 return {applicable:true,state,changed,ending:terminal(),events,rejected};
}
/** Scenario exceptions share the existing world adapter and atomic turn gate. */
export function applyAuthoredScenarioTurn(input:TurnInput){
 return input.payload.adventure_id==='englewood-murder-castle-1893'?execute(input,input):applyAuthoredPrabutyTurn(input);
}
export function advanceAuthoredScenarioClock(input:ClockInput){
 return input.payload.adventure_id==='englewood-murder-castle-1893'?execute(input):advanceAuthoredPrabutyClock(input);
}
