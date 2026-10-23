import {applyAuthoredPrabutyTurn,isAuthoredPrabutyPlaytest,isExplicitPrabutyWithdrawal} from './authored-prabuty-turn';
import {isDossierWorldStateForPayload,type DossierWorldStateProjection} from './world-object-state';
import {PRABUTY_WORLD_IDS} from './authored-prabuty';
import {isGameTime} from '../time-manager';
import type {GameTime} from '../types';
import type {DossierRagPayload} from './rag-schema';

/** A code-owned epilogue candidate. It must still pass the normal dossier transaction. */
export function buildAuthoredPrabutyWithdrawal(input:{
 payload:DossierRagPayload;world:DossierWorldStateProjection;message:string;gameTime:GameTime;locale:'pl'|'en';
}):string|null{
 if(!isExplicitPrabutyWithdrawal(input.message)||!isAuthoredPrabutyPlaytest(input.payload)||
  !isGameTime(input.gameTime)||!isDossierWorldStateForPayload(input.world,input.payload)||
  input.world.objects.find(o=>o.entityId===PRABUTY_WORLD_IDS.ending)?.state!=='ongoing')return null;
 const result=applyAuthoredPrabutyTurn({...input,state:{...input.world,schemaVersion:1,appliedTurnIds:[]},
  turnId:'withdrawal-preview',writesAllowed:true,location:'',rawText:'',playerMessage:input.message,skillTests:[],skillRolls:[]});
 if(result.rejected.length||!result.ending)return null;
 const epilogues={
  withdrawn:input.locale==='pl'
   ? 'Wycofanie ze śledztwa kończy tę wyprawę zgodnie z Twoją decyzją. Tajemnica pozostaje nierozwiązana. Dotychczasowe ustalenia pozostają w aktach.'
   : 'Your decision to withdraw ends this investigation. The mystery remains unresolved. Your findings remain in the case file.',
  interrupted:input.locale==='pl'
   ? 'Potwierdzony stan urządzeń oznacza przerwanie operacji. Ta wyprawa dobiega końca.'
   : 'The confirmed state of the equipment means the operation has been interrupted. This investigation ends here.',
  'operation-completed':input.locale==='pl'
   ? 'Czas na powstrzymanie operacji minął. Zapisany stan urządzeń potwierdza, że operacja dobiegła końca.'
   : 'The time to stop the operation has run out. The recorded state of the equipment confirms that the operation has completed.',
 };
 const months=['Stycznia','Lutego','Marca','Kwietnia','Maja','Czerwca','Lipca','Sierpnia','Września','Października','Listopada','Grudnia'];
 const t=input.gameTime;
 return epilogues[result.ending]+'\n[AKTUALNY CZAS: '+t.day+' '+months[t.month]+' '+t.year+', '+String(t.hour).padStart(2,'0')+':'+String(t.minute).padStart(2,'0')+']\n[KONIEC_SESJI:POTWIERDZENIE]';
}
