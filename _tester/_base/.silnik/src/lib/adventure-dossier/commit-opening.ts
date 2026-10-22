import type { Message } from '../types';
import type { SSEMetadataEvent } from '../sse-parser';
import { createDossierResponseGate } from './response-gate';
import { parseValidatedDossierStream, acknowledgeDossierTurn, prepareDossierTurnOnServer } from './validated-stream';
import { beginDossierTurnTransaction, resumeDossierTurnTransaction } from './turn-transaction';
import { acquiredHandoutsFromTurn } from './local-handouts';
import { appendJournalToParty } from '../journal/apply-journal-tags';
import { stripCharacterImages } from '../character-image-store';
import { sanitizeHistoryForApi } from '../chat-history-sanitizer';
import { isGameTime, timeManager } from '../time-manager';
import type {DossierRagPayload} from './rag-schema';
import {isAuthoredPrabutyPlaytest} from './authored-prabuty-turn';
import {resolveAuthoredPrabutyMedia} from './authored-media';

/** Opening access reveals a photograph on the desk, never physical ownership or keeper materials. */
export function composeOpeningPresentation(payload:DossierRagPayload,content:string,handouts:string[],isNewsroomOpening:boolean){
  const photo='prabuty.media.clue-photo-prabuty-1947';
  if(!isNewsroomOpening||!isAuthoredPrabutyPlaytest(payload)||!resolveAuthoredPrabutyMedia(payload,photo))return {content,handouts};
  const shown=content.includes('[HANDOUT:'+photo+']')||content.includes('[HANDOUT:clue-photo-prabuty-1947]');
  return {content:shown?content:content+'\n\n[HANDOUT:'+photo+']',handouts:[...new Set([...handouts,photo])]};
}

/** Capture before fetching. Opening has no player action authorizing inventory or actor transitions. */
export function createDossierOpeningCommit(input: Parameters<typeof createDossierResponseGate>[0], sceneImage?: string) {
  const gate=createDossierResponseGate({...input,writesAllowed:false,playerMessage:''});
  return async (response:Response) => {
    let metadata:SSEMetadataEvent|undefined;
    const rawText=await parseValidatedDossierStream(response,{onMetadata:value=>{metadata=value;}}, {
      validate:gate.validate,reject:async token=>{await acknowledgeDossierTurn(token,false);},
    });
    gate.assertCurrent();
    const candidate=gate.candidate;
    if(!candidate || !metadata || !gate.token) throw new Error('DOSSIER_FINALIZATION_REQUIRED');
    const ids=(values:unknown)=>Array.isArray(values)?values.filter((value):value is string=>typeof value==='string'):[];
    const handouts=acquiredHandoutsFromTurn(rawText,ids(metadata.dossierHandoutRecordIds),input.payload);
    const journal=candidate.next.activeCharacter ? appendJournalToParty(candidate.next.characters,candidate.next.activeCharacter,
      candidate.cleanText,input.turnId,undefined,ids(metadata.dossierClueRecordIds)) : null;
    const characters=journal?.characters ?? candidate.next.characters;
    const activeCharacter=journal?.activeCharacter ?? candidate.next.activeCharacter;
    const presentation=composeOpeningPresentation(input.payload,candidate.cleanText,handouts,Boolean(sceneImage));
    const nextTime=metadata.timeUpdate ?? undefined;
    if(nextTime!==undefined && !isGameTime(nextTime)) throw new Error('DOSSIER_TIME_INVALID');
    const message:Message={id:input.turnId,role:'assistant',content:presentation.content,timestamp:input.now,
      dossierHandoutBinding:{adventureId:input.adventureId,editionFingerprint:input.editionFingerprint},
      dossierHandoutRecordIds:presentation.handouts,dossierInventoryWritesAllowed:false,
      ...(sceneImage?{generatedImages:[sceneImage],generatedImageTypes:['scene' as const]}:{}),
      ...(typeof metadata.finishReason==='string'?{finishReason:metadata.finishReason}:{}),
      ...(metadata.costData?{costData:metadata.costData}:{}),
      ...(isGameTime(nextTime)?{gameTime:nextTime}:{})};
    const patch=(key:string,value:unknown)=>({key,before:localStorage.getItem(key),after:JSON.stringify(value)});
    const writes=[patch(`zew-dossier-inventory:${input.playthroughId}`,candidate.next.inventory),
      patch(`zew-dossier-world-state:${input.playthroughId}`,candidate.next.world)];
    if(candidate.changed.actors) writes.push(patch('gm_npcs',candidate.next.npcs));
    const rosterChanged=Boolean(journal?.changed || candidate.changed.inventory);
    if(rosterChanged) writes.push(patch('characters',stripCharacterImages(characters)));
    if(isGameTime(nextTime)) {
      const clock=timeManager.getSnapshot();
      writes.push(patch('coc7_game_time',{...nextTime,deadline:clock.deadline,deadlineTotalHours:clock.deadlineTotalHours}));
    }
    beginDossierTurnTransaction(localStorage,{playthroughId:input.playthroughId,adventureId:input.adventureId,
      editionFingerprint:input.editionFingerprint,turnId:input.turnId,token:gate.token,writes,
      publication:patch('zew_chat_messages',sanitizeHistoryForApi([message]))});
    const memory=await resumeDossierTurnTransaction(localStorage,input,{
      prepare:prepareDossierTurnOnServer,accept:token=>acknowledgeDossierTurn(token,true),isCurrent:input.isCurrent});
    if(isGameTime(nextTime)) timeManager.setTime(nextTime);
    return {text:presentation.content,metadata,message,characters,activeCharacter,rosterChanged,memory};
  };
}
