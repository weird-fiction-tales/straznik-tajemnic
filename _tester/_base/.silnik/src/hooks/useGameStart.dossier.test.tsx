import { act, renderHook } from '@testing-library/react';
import { useGameStart } from './useGameStart';
import { fetchWithApiKeys } from '@/lib/api-keys-service';
import { parseSSEStream, type SSEMetadataEvent } from '@/lib/sse-parser';
import { loadRuntimeDossierPayload } from '@/lib/adventure-dossier/client-activation';
import { loadCampaignMemoryScope } from '@/core/memory/campaign-scope';
import { resumeDossierTurnTransaction } from '@/lib/adventure-dossier/turn-transaction';
import { defaultAISettings } from '@/lib/ai-settings/defaults';
import type { Character, Message } from '@/lib/types';
const fingerprint='sha256:'+'a'.repeat(64);
jest.mock('@/lib/api-keys-service',()=>({fetchWithApiKeys:jest.fn(),getApiKeyHeaders:()=>({}),isPureTextMode:()=>true}));
jest.mock('@/lib/sse-parser',()=>({parseSSEStream:jest.fn(),createSseParseErrorHandler:()=>jest.fn()}));
jest.mock('@/lib/adventure-dossier/client-activation',()=>({loadRuntimeDossierPayload:jest.fn()}));
jest.mock('@/lib/posthog',()=>({trackEvent:jest.fn()}));
jest.mock('@/lib/ai-settings/cost-control',()=>({resetSessionTokens:jest.fn()}));
jest.mock('@/lib/time-manager',()=>({isGameTime:jest.requireActual('@/lib/time-manager').isGameTime,timeManager:{getTime:()=>({year:1973,month:9,day:18,hour:19,minute:30}),resetForAdventure:jest.fn()}}));
jest.mock('./useEquipmentThumbnails',()=>({useEquipmentThumbnails:()=>({generateThumbnailsInBackground:jest.fn()})}));
const payload={schema_version:1 as const,adventure_id:'cien-nad-prabutami',edition_fingerprint:fingerprint,records:[]};
let text:string,metadata:SSEMetadataEvent;
let messages:Message[];
function setup(character:Character|null=null){
 const props:Parameters<typeof useGameStart>[0]={setHasStartedGame:jest.fn(),activeCharacter:character,characters:character?[character]:[],setActiveCharacter:jest.fn(),setCharacters:jest.fn(),
  pdfMemory:{adventureDossierFingerprint:fingerprint},activateDossierForSession:jest.fn(async()=>({ok:true,adventureDossierFingerprint:fingerprint})),
  adventureContext:{id:'cien-nad-prabutami',title:'Cień nad Prabutami',yearRange:'1973-1974',country:'Polska',location:'Warszawa'},hotSeatConfig:{enabled:false,players:[]},
  setMessages:update=>{messages=typeof update==='function'?update(messages):update;},
  tts:{voiceEnabled:true,isTTSEnabled:true,generateVoiceForMessage:jest.fn(async()=>{}),addToQueue:jest.fn(),startInitialBuffering:jest.fn(),stopCurrentAudio:jest.fn()},
  aiSettings:{...defaultAISettings,imageGenerationEnabled:false}};
 return {props,...renderHook(()=>useGameStart(props))};
}
beforeEach(()=>{
 jest.clearAllMocks();localStorage.clear();messages=[];text='A quiet opening.';
 metadata={type:'metadata',dossierFinalizationToken:'opening-token',dossierInventoryWritesAllowed:true,dossierHandoutRecordIds:['not-retrieved-media']};
 jest.mocked(loadRuntimeDossierPayload).mockResolvedValue(payload);
 jest.mocked(fetchWithApiKeys).mockResolvedValue({ok:true} as Response);
 jest.mocked(parseSSEStream).mockImplementation(async(_response,callbacks)=>{callbacks?.onText?.(text);callbacks?.onMetadata?.(metadata);return text;});
 global.fetch=jest.fn(async(_url,init)=>{
  const body=JSON.parse(String(init?.body));
  return {ok:true,json:async()=>body.phase==='prepare'?{prepared:true}:{accepted:body.accepted}} as Response;
 });
});
test('opening rejects inventory actions before UI, TTS, journal or accepted memory',async()=>{
 text='Secret draft. [EKWIPUNEK: DODAJ | @photo]';
 const {result,props}=setup();
 await act(async()=>{await result.current.handleStartGame();});
 expect(props.tts.addToQueue).not.toHaveBeenCalled();
 expect(props.tts.generateVoiceForMessage).not.toHaveBeenCalled();
 expect(messages.some(message=>message.content.includes('Secret draft'))).toBe(false);
 expect(jest.mocked(fetch).mock.calls.map(([,init])=>JSON.parse(String(init?.body)))).toEqual([{dossierFinalizationToken:'opening-token',accepted:false}]);
 expect(localStorage.getItem('characters')).toBeNull();
});
test('opening prepares and acknowledges before publishing accepted text or voice',async()=>{
 const {result,props}=setup();
 jest.mocked(fetch).mockImplementation(async(_url,init)=>{
  expect(props.tts.addToQueue).not.toHaveBeenCalled();
  expect(messages.some(message=>message.content==='A quiet opening.')).toBe(false);
  const body=JSON.parse(String(init?.body));
  return {ok:true,json:async()=>body.phase==='prepare'?{prepared:true}:{accepted:true}} as Response;
 });
 await act(async()=>{await result.current.handleStartGame();});
 expect(jest.mocked(fetch).mock.calls.map(([,init])=>JSON.parse(String(init?.body)))).toEqual([
  {dossierFinalizationToken:'opening-token',phase:'prepare'}, {dossierFinalizationToken:'opening-token',accepted:true}]);
 expect(messages).toEqual([expect.objectContaining({content:text,dossierHandoutBinding:{adventureId:payload.adventure_id,editionFingerprint:fingerprint},dossierHandoutRecordIds:[],dossierInventoryWritesAllowed:false})]);
 expect(props.tts.addToQueue).toHaveBeenCalledWith(text,expect.any(String));
 expect(JSON.parse(localStorage.getItem('zew_chat_messages')!)[0].content).toBe(text);
});
test('missing finalization token never exposes a dossier opening',async()=>{
 delete metadata.dossierFinalizationToken;
 const {result,props}=setup();await act(async()=>{await result.current.handleStartGame();});
 expect(props.tts.addToQueue).not.toHaveBeenCalled();
 expect(messages.some(message=>message.content===text)).toBe(false);
});
test('failed acknowledgement retains the ordinary transaction for next-turn recovery without playing voice',async()=>{
 const {result,props}=setup();
 jest.mocked(fetch).mockImplementation(async(_url,init)=>{
  const body=JSON.parse(String(init?.body));
  return {ok:body.phase==='prepare',json:async()=>body.phase==='prepare'?{prepared:true}:{accepted:false}} as Response;
 });
 await act(async()=>{await result.current.handleStartGame();});
 expect(props.tts.addToQueue).not.toHaveBeenCalled();
 const scope=loadCampaignMemoryScope()!;
 const key='zew-dossier-turn:'+scope.playthroughId;
 expect(JSON.parse(localStorage.getItem(key)!).phase).toBe('applied');
 await resumeDossierTurnTransaction(localStorage,{playthroughId:scope.playthroughId,adventureId:payload.adventure_id,editionFingerprint:fingerprint},
  {prepare:jest.fn(),accept:async()=>({accepted:true}),isCurrent:()=>true});
 expect(localStorage.getItem(key)).toBeNull();
 expect(JSON.parse(localStorage.getItem('zew_chat_messages')!)[0].content).toBe(text);
});


test.each(['pl','en'] as const)('actual pending authored opening %s retains an eligible photo without granting an inventory item',async(locale)=>{
 const {TextEncoder}=await import('node:util');const {webcrypto}=await import('node:crypto');
 Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});
 Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});
 const {createAuthoredPrabutyPayload}=await import('@/lib/adventure-dossier/authored-prabuty');
 const {authorizeLocalDraftPayload,fingerprintLocalDraftPayload}=await import('@/lib/adventure-dossier/runtime-authorization');
 const fp=await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload(fingerprint));
 const authored=await authorizeLocalDraftPayload(createAuthoredPrabutyPayload(fp),{adventureId:payload.adventure_id,editionFingerprint:fp});
 const media=authored.records.find(record=>record.record_type==='media')!;
 jest.mocked(loadRuntimeDossierPayload).mockResolvedValue(authored);
 text='A photograph lies on the desk. [HANDOUT:'+media.record_id+']';metadata.dossierHandoutRecordIds=[media.record_id];
 const {result,props,rerender}=setup();
 props.locale=locale;props.pdfMemory={adventureDossierFingerprint:fp};props.activateDossierForSession=jest.fn(async()=>({ok:true,adventureDossierFingerprint:fp}));rerender();
 await act(async()=>{await result.current.handleStartGame();});
 expect(messages[0]).toMatchObject({dossierHandoutRecordIds:[media.record_id],dossierInventoryWritesAllowed:false});
 const scope=loadCampaignMemoryScope()!;
 expect(JSON.parse(localStorage.getItem('zew-dossier-inventory:'+scope.playthroughId)!).entries).toEqual([]);
 expect(media.evidence.approval).toBe('pending');
 const saved=JSON.parse(localStorage.getItem('zew_chat_messages')!)[0];
 expect(saved.generatedImages).toEqual(locale==='pl'?['/handouts/cien-nad-prabutami/playtest/newsroom-1973.png']:undefined);
 expect(saved.generatedImageTypes).toEqual(locale==='pl'?['scene']:undefined);
 expect(messages[0].generatedImages).toEqual(saved.generatedImages);
});

test('opening journal is included in the same committed character snapshot',async()=>{
 const character:Character={id:'pc',name:'Ada',occupation:'Detective',age:30,str:50,con:50,siz:50,dex:50,app:50,int:50,pow:50,edu:50,skills:{},hp:10,san:50,maxSan:99,luck:50,mp:10,equipment:[],background:'',playerName:'Player',isActive:true,lastUsed:new Date(0),notes:'',experience:{totalXP:0,availableXP:0,earnedThisSession:0,maxEarnedThisSession:0},developmentHistory:[]};
 text='A quiet opening. [DZIENNIK:sprawa:Początek śledztwa]Przybyłam do redakcji.[/DZIENNIK]';
 const {result,props}=setup(character);
 await act(async()=>{await result.current.handleStartGame();});
 expect(JSON.stringify(JSON.parse(localStorage.getItem('characters')!))).toContain('Przybyłam do redakcji.');
 expect(props.setCharacters).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({id:'pc'})]));
 expect(localStorage.getItem('zew-dossier-turn:'+loadCampaignMemoryScope()!.playthroughId)).toBeNull();
});


test('null clock metadata is a valid unchanged opening clock',async()=>{
 metadata.timeUpdate=null;
 const {result}=setup();await act(async()=>{await result.current.handleStartGame();});
 expect(messages[0].content).toBe(text);
 expect(jest.mocked(fetch).mock.calls.some(([,init])=>JSON.parse(String(init?.body)).accepted===true)).toBe(true);
 expect(localStorage.getItem('coc7_game_time')).toBeNull();
});

test('menu prewarms only the GET health endpoint, not the POST-only key validator',async()=>{
 jest.useFakeTimers();
 const originalFetch=global.fetch;
 const fetchMock=jest.fn().mockResolvedValue({ok:true} as Response);
 global.fetch=fetchMock;
 try {
  setup();
  await act(async()=>{jest.advanceTimersByTime(1200);await Promise.resolve();});
  expect(fetchMock).toHaveBeenCalledWith('/api/health/gemini',{method:'GET'});
  expect(fetchMock).not.toHaveBeenCalledWith('/api/chat-test',{method:'GET'});
 } finally {
  jest.useRealTimers();
  global.fetch=originalFetch;
 }
});
