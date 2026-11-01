import {buildAuthoredPrabutyWithdrawal} from './authored-prabuty-withdrawal';
import {applyAuthoredScenarioTurn,isAuthoredEnglewood} from './authored-scenario-turn';
import {isExplicitPrabutyWithdrawal} from './authored-prabuty-turn';
import {isDossierWorldStateForPayload} from './world-object-state';
import {ENGLEWOOD_WORLD_IDS} from './authored-englewood';
type Input=Parameters<typeof buildAuthoredPrabutyWithdrawal>[0];
export function buildAuthoredScenarioWithdrawal(input:Input):string|null {
 if(input.payload.adventure_id!=='englewood-murder-castle-1893')return buildAuthoredPrabutyWithdrawal(input);
 if(!isExplicitPrabutyWithdrawal(input.message)||!isAuthoredEnglewood(input.payload)||
 !isDossierWorldStateForPayload(input.world,input.payload)||
 input.world.objects.find(o=>o.entityId===ENGLEWOOD_WORLD_IDS.ending)?.state!=='ongoing')return null;
 const result=applyAuthoredScenarioTurn({...input,state:{...input.world,schemaVersion:1,appliedTurnIds:[]},turnId:'withdrawal-preview',
 writesAllowed:true,location:'',rawText:'',playerMessage:input.message,skillTests:[],skillRolls:[]});
 if(result.rejected.length||!result.ending)return null;
 const text=result.ending==='lost'?'The deadline has passed while the kiln’s anchor remains intact. The investigation ends with the threat uncontained.':
 'You end this investigation by your own decision. The mystery remains unresolved. Your confirmed findings remain in the case file.';
 const months=['Stycznia','Lutego','Marca','Kwietnia','Maja','Czerwca','Lipca','Sierpnia','Września','Października','Listopada','Grudnia'];
 const t=input.gameTime;
 return text+'\n[AKTUALNY CZAS: '+t.day+' '+months[t.month]+' '+t.year+', '+String(t.hour).padStart(2,'0')+':'+String(t.minute).padStart(2,'0')+']\n[KONIEC_SESJI:POTWIERDZENIE]';
}
