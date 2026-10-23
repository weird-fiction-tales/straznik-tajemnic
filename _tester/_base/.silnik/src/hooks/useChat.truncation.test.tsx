import { ensureLocalDossierSession, loadRuntimeDossierPayload } from '@/lib/adventure-dossier/client-activation';
import type { DossierRagPayload } from '@/lib/adventure-dossier/rag-schema';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useChat } from './useChat';
import { fetchWithApiKeys } from '@/lib/api-keys-service';
import { parseSSEStream } from '@/lib/sse-parser';
import type { GameTime, Message } from '@/lib/types';
import * as autoSaveService from '@/lib/save/auto-save-service';
import { defaultAISettings } from '@/lib/ai-settings/defaults';

jest.mock('@/lib/api-keys-service', () => ({
  fetchWithApiKeys: jest.fn(),
}));

jest.mock('@/lib/sse-parser', () => ({
  parseSSEStream: jest.fn(),
  createSseParseErrorHandler: jest.fn(() => jest.fn()),
}));

jest.mock('@/lib/adventure-dossier/client-activation', () => ({
  ensureLocalDossierSession: jest.fn(), loadRuntimeDossierPayload: jest.fn(),
}));

jest.mock('@/lib/posthog', () => ({
  trackEvent: jest.fn(),
}));

jest.mock('@/lib/time-manager', () => ({
  isGameTime: jest.requireActual('@/lib/time-manager').isGameTime,
  timeManager: {
    getTime: jest.fn(() => ({
      year: 1920,
      month: 10,
      day: 1,
      hour: 20,
      minute: 0,
    })),
    setTime: jest.fn(),
    getSnapshot: jest.fn(() => ({ time: partialGameTime, weather: '', deadline: null, deadlineTotalHours: 24 })),
  },
}));

jest.mock('@/lib/persistent-media-cache', () => ({
  persistentMediaCache: {
    isAvailable: jest.fn(() => false),
  },
}));

// Capture the native method once: a failed case must not become the next spy's delegate.
const storageSetItem = Storage.prototype.setItem;
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  localStorage.clear();
});

const partialGameTime: GameTime = {
  year: 1920,
  month: 10,
  day: 1,
  hour: 20,
  minute: 5,
};

const defaultOptions: Parameters<typeof useChat>[0] = {
  pdfMemory: {},
  activeCharacter: null,
  characters: [],
  setCharacters: jest.fn(),
  setActiveCharacter: jest.fn(),
  voiceEnabled: false,
  isTTSEnabled: false,
  generateVoiceForMessage: jest.fn().mockResolvedValue(undefined),
  addToQueue: jest.fn(),
  aiSettings: { ...defaultAISettings, imageGenerationEnabled: false },
};

describe('useChat - finishReason', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.mocked(fetchWithApiKeys).mockResolvedValue({ ok: true } as Response);
  });

  it.each(['MAX_TOKENS', 'STOP'])(
    'zapisuje %s na właściwej wiadomości i zachowuje efekty partialu',
    async (finishReason) => {
      jest.mocked(parseSSEStream).mockImplementation(async (_response, callbacks) => {
        callbacks?.onText?.('Urwany fragment narracji');
        callbacks?.onMetadata?.({
          type: 'metadata',
          finishReason,
          timeUpdate: partialGameTime,
        });
        return 'Urwany fragment narracji';
      });

      const { result } = renderHook(() => useChat(defaultOptions));

      await act(async () => {
        await result.current.handleSendMessage('Rozglądam się.');
      });

      const userMessage = result.current.messages.find(
        (message) => message.role === 'user'
      );
      const assistantMessage = result.current.messages.find(
        (message) => message.role === 'assistant'
      );

      expect(userMessage?.finishReason).toBeUndefined();
      expect(assistantMessage).toMatchObject({
        content: 'Urwany fragment narracji',
        finishReason,
        gameTime: partialGameTime,
      });

      await waitFor(() => {
        const persisted = JSON.parse(
          localStorage.getItem('zew_chat_messages') ?? '[]'
        ) as Array<Record<string, unknown>>;
        expect(
          persisted.find((message) => message.role === 'assistant')
        ).toMatchObject({
          content: 'Urwany fragment narracji',
          finishReason,
        });
      });
    }
  );

  it('odtwarza status ucięcia ze starego localStorage bez migracji', () => {
    localStorage.setItem(
      'zew_chat_messages',
      JSON.stringify([
        {
          id: 'assistant-partial',
          role: 'assistant',
          content: 'Niedokończona scena',
          timestamp: '2026-08-23T12:00:00.000Z',
          finishReason: 'MAX_TOKENS',
          continuationRequested: false,
        },
      ])
    );

    const { result } = renderHook(() => useChat(defaultOptions));

    expect(result.current.messages[0]).toMatchObject({
      id: 'assistant-partial',
      finishReason: 'MAX_TOKENS',
      continuationRequested: false,
    });
    expect(result.current.messages[0].timestamp).toBeInstanceOf(Date);
  });

  it('wysyła jedną ukrytą kontynuację bez dymku gracza i nie czyta partialu ponownie', async () => {
    const currentNpc = { id: 'npc-neutral', name: 'Witness', status: 'alive', locationId: 'shelter', location: 'Shelter', tags: [], statusEffects: [{ id: 'freed', name: 'Freed', type: 'other', description: 'Released earlier', timestamp: '2026-10-19T12:00:00Z' }] };
    localStorage.setItem('gm_npcs', JSON.stringify([currentNpc]));
    localStorage.setItem(
      'zew_chat_messages',
      JSON.stringify([
        {
          id: 'assistant-partial',
          role: 'assistant',
          content: 'Stary urwany fragment',
          timestamp: '2026-08-23T12:00:00.000Z',
          finishReason: 'MAX_TOKENS',
        },
      ])
    );

    jest.mocked(parseSSEStream).mockImplementation(async (_response, callbacks) => {
      callbacks?.onText?.('Nowe dokończenie sceny.');
      callbacks?.onMetadata?.({ type: 'metadata', finishReason: 'STOP' });
      return 'Nowe dokończenie sceny.';
    });

    const generateVoiceForMessage = jest
      .fn()
      .mockResolvedValue(undefined);
    const addToQueue = jest.fn();
    const options: Parameters<typeof useChat>[0] = {
      ...defaultOptions,
      voiceEnabled: true,
      isTTSEnabled: true,
      generateVoiceForMessage,
      addToQueue,
    };
    const { result } = renderHook(() => useChat(options));

    await act(async () => {
      await Promise.all([
        result.current.handleContinueNarration?.('assistant-partial'),
        result.current.handleContinueNarration?.('assistant-partial'),
      ]);
    });

    expect(fetchWithApiKeys).toHaveBeenCalledTimes(1);
    const request = jest.mocked(fetchWithApiKeys).mock.calls[0][1];
    const body = JSON.parse(String(request?.body)) as {
      message: string;
      npcs?: Array<Record<string, unknown>>;
      messages: Array<Record<string, unknown>>;
    };

    expect(body.npcs).toEqual([currentNpc]);
    expect(body.message).toContain('Dokończ poprzednią, urwaną wypowiedź');
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]).toMatchObject({
      id: 'assistant-partial',
      role: 'assistant',
      content: 'Stary urwany fragment',
      continuationRequested: true,
    });
    expect(body.messages[0].content).not.toContain(
      'Dokończ poprzednią, urwaną wypowiedź'
    );

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages.filter((message) => message.role === 'user')).toHaveLength(0);
    expect(result.current.messages[0].continuationRequested).toBe(true);
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Nowe dokończenie sceny.',
      finishReason: 'STOP',
    });
    expect(generateVoiceForMessage).toHaveBeenCalledTimes(1);
    expect(generateVoiceForMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Nowe dokończenie sceny.' }),
      expect.arrayContaining([
        expect.objectContaining({ content: 'Stary urwany fragment' }),
      ])
    );
    expect(addToQueue).toHaveBeenCalledWith(
      'Nowe dokończenie sceny.',
      result.current.messages[1].id
    );
    expect(addToQueue).not.toHaveBeenCalledWith(
      'Stary urwany fragment',
      expect.any(String)
    );
  });
});


describe('dossier NPC continuation persistence', () => {
  it.each([[true,true,false,false,false],[false,true,false,false,false],[true,false,false,false,false],[true,true,true,false,false],[true,true,false,true,false],[true,true,false,true,true],[true,true,false,false,true],[true,true,false,false,false,true],[true,true,false,true,false,true],[true,true,false,true,false,false,true],[true,true,false,false,false,false,true]])('requires gates, current turn and prior result (%s, %s, %s, normal=%s, foreign=%s)', async (originalGate, responseGate, laterPlayerTurn, ordinaryTurn, foreignResult, interruptedSave = false, corrected = false) => {
    jest.clearAllMocks(); localStorage.clear();
    const fingerprint='sha256:'+'a'.repeat(64);
    const payload:DossierRagPayload={schema_version:1,adventure_id:'neutral',edition_fingerprint:fingerprint,records:[{
      schema_version:1,record_id:'actor',record_type:'actor',adventure_id:'neutral',edition_fingerprint:fingerprint,language:'pl',content:'Neutral fixture',
      tags:{entities:['npc-a'],scenes:[],mechanics:[],topics:[],triggers:[]},retrieval:{visibility:'gm_only',availability:'always',condition:null,priority:1},
      evidence:{provenance:'approved_design',source_ref:'fixture',status:'set',approval:'approved',approved_by:'fixture',approved_at:'2026-10-20'},links:[],
      actor_binding:{entity_id:'npc-a',name:'Neutral',transitions:[{id:'rescue',from_effect_id:'bound',to_effect:{id:'freed',name:'Freed',description:'Rescued'},source_location_id:'cell',
        access_check:{id:'rescue-check',skill_names:['Dexterity'],difficulty:'hard'}}]}
    }]};
    payload.records.push({...payload.records[0],record_id:'door',record_type:'fact',
      tags:{entities:['obj-door'],scenes:[],mechanics:[],topics:[],triggers:[]},actor_binding:undefined,
      world_object_binding:{entity_id:'obj-door',initial_state:'closed',states:['closed','open'],transitions:[{id:'open',from:'closed',to:'open',condition_id:'open-check',access_check:{id:'open-check',skill_names:['Dexterity'],difficulty:'hard'}}]}});
    const test={id:'test-old',dossierConditionId:'rescue-check',targetNpcId:'npc-a',characterId:'pc-a',skillName:'Dexterity',skillValue:50,difficulty:'trudny',modifiers:[],justification:'fixture'};
    const roll={testId:test.id,targetNpcId:'npc-a',characterId:'pc-a',resolutionId:'roll-old',requiredDifficulty:'hard' as const,passedRequirement:true,outcome:'hard' as const,luckSpent:0,skillNames:['Dexterity']};
    const worldTest={...test,id:'test-world',dossierConditionId:'open-check',targetNpcId:undefined};
    const worldRoll={...roll,testId:worldTest.id,resolutionId:'roll-world',targetNpcId:undefined,characterId:foreignResult?'other-pc':roll.characterId};
    localStorage.setItem('zew-campaign-memory-scope',JSON.stringify({schemaVersion:1,campaignDefinitionId:'scenario:neutral',kind:'scenario',playthroughId:'run-test',adventureId:'neutral'}));
    localStorage.setItem('gm_npcs',JSON.stringify([{id:'npc-a',status:'alive',locationId:'cell',location:'Cell',tags:[],statusEffects:[{id:'bound',name:'Bound',type:'other',description:'Captive'}]}]));
    localStorage.setItem('zew_chat_messages',JSON.stringify([
      {id:'question',role:'assistant',content:'Test',timestamp:'2026-10-20T00:00:00Z',skillTests:[test,worldTest]},
      {id:'answer',role:'user',content:'Result',timestamp:'2026-10-20T00:01:00Z',mechanicsContext:{skillRolls:[roll,worldRoll]}},
      {id:'partial',role:'assistant',content:'Partial',timestamp:'2026-10-20T00:02:00Z',finishReason:'MAX_TOKENS',dossierInventoryWritesAllowed:originalGate}
    ]));
    jest.mocked(ensureLocalDossierSession).mockResolvedValue({ok:true});
    jest.mocked(loadRuntimeDossierPayload).mockResolvedValue(payload);
    jest.mocked(fetchWithApiKeys).mockResolvedValue({ok:true} as Response);
    let draftNumber=0;
    jest.mocked(parseSSEStream).mockImplementation(async(_response,callbacks)=>{
      const invalidDraft=corrected && draftNumber++===0;
      const text=(invalidDraft?'[TECZKA_STANU: missing | invalid] ':'')+'Released. [TECZKA_STANU: npc-a | rescue] [TECZKA_STANU: obj-door | open]';
      callbacks?.onText?.(text);callbacks?.onMetadata?.({type:'metadata',finishReason:'STOP',dossierInventoryWritesAllowed:responseGate,dossierFinalizationToken:'test-token',...(ordinaryTurn ? {timeUpdate:partialGameTime} : {})});return text;
    });
    if (ordinaryTurn) {
      const history=JSON.parse(localStorage.getItem('zew_chat_messages')!);
      localStorage.setItem('zew_chat_messages',JSON.stringify(history.filter((m:Message)=>m.id!=='answer')));
    }
    if (laterPlayerTurn) {
      const history=JSON.parse(localStorage.getItem('zew_chat_messages')!);
      history.push({id:'later',role:'user',content:'I leave',timestamp:'2026-10-20T00:03:00Z'});
      localStorage.setItem('zew_chat_messages',JSON.stringify(history));
    }
    const order:string[]=[];
    const memoryFetch = jest.spyOn(globalThis, 'fetch').mockImplementation(async(_url, options) => {
      const request=JSON.parse(String(options?.body));
      if(request.phase==='prepare')return {ok:true,json:async()=>({prepared:true})} as Response;
      const accepted=request.accepted;
      if(accepted){
        expect(JSON.parse(localStorage.getItem('gm_npcs')!)[0].statusEffects[0].id).toBe('freed');
        expect(JSON.parse(localStorage.getItem('zew-dossier-world-state:run-test')!).objects[0].state).toBe('open');
        order.push('memory');
      }
      return {ok:true,json:async()=>({accepted})} as Response;
    });
    const voiceQueue=jest.fn(()=>{order.push('voice');});
    const expectedRejection=jest.spyOn(console,'error').mockImplementation(()=>{});
    const {PREDEFINED_CHARACTERS}=await import('@/lib/immersion/predefined-characters');
    const fixtureCharacter={...PREDEFINED_CHARACTERS[0],id:'pc-a'};
    const hookOptions = {...defaultOptions,activeCharacter:fixtureCharacter,characters:[fixtureCharacter],voiceEnabled:true,isTTSEnabled:true,addToQueue:voiceQueue,pdfMemory:{adventureDossierFingerprint:fingerprint},adventureContext:{id:'neutral',title:'Neutral',yearRange:'1925-1925',country:'USA'}};
    const mounted=renderHook(()=>useChat(hookOptions));
    let result=mounted.result;
    let failOnce=interruptedSave;
    const storageWrite=jest.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key,value){
      if(failOnce && key==='gm_npcs'){failOnce=false;throw new Error('simulated interruption');}
      return storageSetItem.call(this,key,value);
    });
    await act(async()=>{
      if(ordinaryTurn) await result.current.handleSendMessage('Wynik testu.',{skillRolls:[roll,worldRoll]});
      else await result.current.handleContinueNarration?.('partial');
    });
    if (ordinaryTurn && foreignResult) {
      expect(fetchWithApiKeys).not.toHaveBeenCalled();
      expect(localStorage.getItem('zew-dossier-world-state:run-test')).toBeNull();
      storageWrite.mockRestore();memoryFetch.mockRestore();expectedRejection.mockRestore();mounted.unmount();return;
    }
    if (ordinaryTurn) {
      const request = JSON.parse(String(jest.mocked(fetchWithApiKeys).mock.calls[0][1]?.body)) as {messages:Message[]};
      const sent = request.messages.find(m => m.role === 'user' && m.content === 'Wynik testu.');
      expect(sent?.mechanicsContext?.skillRollScope).toEqual({playthroughId:'run-test',adventureId:'neutral'});
    }
    if(interruptedSave){
      expect(localStorage.getItem('zew-dossier-turn:run-test')).not.toBeNull();
      expect(voiceQueue).not.toHaveBeenCalled();
      mounted.unmount();
      result=renderHook(()=>useChat(hookOptions)).result;
      await waitFor(()=>expect(localStorage.getItem('zew-dossier-turn:run-test')).toBeNull());
      expect(result.current.messages.some(m=>m.content.includes('Released.'))).toBe(true);
      expect(fetchWithApiKeys).toHaveBeenCalledTimes(1);
      if(ordinaryTurn) expect(JSON.parse(localStorage.getItem('coc7_game_time')!)).toMatchObject(partialGameTime);
    }
    if(corrected){
      expect(fetchWithApiKeys).toHaveBeenCalledTimes(2);
      const original=JSON.parse(String(jest.mocked(fetchWithApiKeys).mock.calls[0][1]?.body));
      const retry=JSON.parse(String(jest.mocked(fetchWithApiKeys).mock.calls[1][1]?.body));
      expect(retry.dossierCorrection).toEqual({token:'test-token',rejectedIds:['missing']});
      delete retry.dossierCorrection;expect(retry).toEqual(original);
    }
    storageWrite.mockRestore();
    const saved=JSON.parse(localStorage.getItem('gm_npcs')!);
    expect(saved[0].statusEffects[0].id).toBe(originalGate && responseGate && !laterPlayerTurn && !foreignResult ? 'freed' : 'bound');
    expect(result.current.messages.at(-1)?.content).not.toContain('TECZKA_STANU');
    const accepted = originalGate && responseGate && !laterPlayerTurn && !foreignResult;
    if (!accepted) {
      expect(result.current.messages.some(m => m.content.includes('Released.'))).toBe(false);
      expect(voiceQueue).not.toHaveBeenCalled();
      expect(memoryFetch.mock.calls.some(([,opts]) => JSON.parse(String(opts?.body)).accepted === true)).toBe(false);
    } else if(interruptedSave) { expect(voiceQueue).not.toHaveBeenCalled();expect(order).toEqual(['memory']); } else { expect(voiceQueue).toHaveBeenCalledTimes(1);expect(order).toEqual(['memory','voice']); }
    const body=JSON.parse(String(jest.mocked(fetchWithApiKeys).mock.calls[0][1]?.body));
    expect(body.dossierWorldState.objects).toEqual([{entityId:'obj-door',state:'closed'}]);
    const world=localStorage.getItem('zew-dossier-world-state:run-test');
    if(originalGate && responseGate && !laterPlayerTurn && !foreignResult) expect(JSON.parse(world!).objects[0].state).toBe('open');
    else if(ordinaryTurn) expect(JSON.parse(world!).objects[0].state).toBe('closed');
    else expect(world).toBeNull();
    const snapshot=localStorage.getItem('gm_npcs');
    await act(async()=>{await result.current.handleContinueNarration?.('partial');});
    expect(localStorage.getItem('gm_npcs')).toBe(snapshot);
    expect(localStorage.getItem('zew-dossier-world-state:run-test')).toBe(world);
    memoryFetch.mockRestore(); expectedRejection.mockRestore();
  });
});


describe('authored deadline atomic ending',()=>{
 it.each(['turn','continuation','recovery','restore','snapshot'] as const)('sets ended only after accepted %s state',async(mode)=>{
  jest.clearAllMocks();localStorage.clear();
  const {TextEncoder}=await import('node:util');const {webcrypto}=await import('node:crypto');
  Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});
  const {createAuthoredPrabutyPayload}=await import('@/lib/adventure-dossier/authored-prabuty');
  const {authorizeLocalDraftPayload,fingerprintLocalDraftPayload}=await import('@/lib/adventure-dossier/runtime-authorization');
  const {STREFA_11_ADVENTURES}=await import('@/lib/adventures-data');
  const {timeManager}=await import('@/lib/time-manager');
  const {emptyDossierWorldState}=await import('@/lib/adventure-dossier/world-object-state');
  const {advanceAuthoredPrabutyClock}=await import('@/lib/adventure-dossier/authored-prabuty-turn');
  const deadline=STREFA_11_ADVENTURES.find(a=>a.id==='cien-nad-prabutami')!.doomClock!.deadline!;
 const {isGameTime}=await import('@/lib/time-manager');
 if(!isGameTime(deadline)) throw new Error('Fixture deadline must be complete');
  const saveSpy=jest.spyOn(autoSaveService,'performFullGameSave').mockImplementation(async options=>{
    expect(timeManager.getTime()).toEqual(deadline);
    expect((options.data!.messages.at(-1) as {gameTime:unknown}).gameTime).toEqual(deadline);
    expect(options.data!.currentLocationId).toBe('Stara Plebania i Cmentarz w Prabutach');
    return {success:true,saveId:'saved',saveName:'saved',size:1,formattedSize:'1',messageCount:1,imageCount:0};
  });
  jest.mocked(timeManager.setTime).mockImplementation(time=>{const next={...timeManager.getTime(),...time};jest.mocked(timeManager.getTime).mockReturnValue(next);return next;});
  const fp=await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload('sha256:'+'0'.repeat(64)));
  const payload=await authorizeLocalDraftPayload(createAuthoredPrabutyPayload(fp),{adventureId:'cien-nad-prabutami',editionFingerprint:fp});
  const prev=new Date(Date.UTC(deadline.year,deadline.month,deadline.day,deadline.hour,deadline.minute)-60000);
  const before={year:prev.getUTCFullYear(),month:prev.getUTCMonth(),day:prev.getUTCDate(),hour:prev.getUTCHours(),minute:prev.getUTCMinutes()};
  jest.mocked(timeManager.getTime).mockReturnValue(before);
  const binding={playthroughId:'deadline-play',adventureId:payload.adventure_id,editionFingerprint:fp};
  localStorage.setItem('zew-campaign-memory-scope',JSON.stringify({schemaVersion:1,campaignDefinitionId:'scenario:prabuty',kind:'scenario',...binding}));
  localStorage.setItem('zew_chat_messages',JSON.stringify([{id:'partial',role:'assistant',content:'Earlier.',timestamp:new Date(0),finishReason:'MAX_TOKENS',dossierInventoryWritesAllowed:true}]));
  if(mode==='restore') {
    const terminal=advanceAuthoredPrabutyClock({payload,state:emptyDossierWorldState(binding,payload),turnId:'saved',gameTime:deadline,writesAllowed:true});
    localStorage.setItem('zew-dossier-world-state:deadline-play',JSON.stringify(terminal.state));
  }
  jest.mocked(ensureLocalDossierSession).mockImplementation(async()=>{if(mode==='snapshot')jest.mocked(timeManager.getTime).mockReturnValue(deadline);return {ok:true};});jest.mocked(loadRuntimeDossierPayload).mockResolvedValue(payload);
  jest.mocked(fetchWithApiKeys).mockResolvedValue({ok:true} as Response);
  jest.mocked(parseSSEStream).mockImplementation(async(_response,callbacks)=>{
    const text='The deadline has arrived. [LOKACJA: Stara Plebania i Cmentarz w Prabutach]';callbacks?.onText?.(text);callbacks?.onMetadata?.({type:'metadata',dossierFinalizationToken:'deadline-token',dossierInventoryWritesAllowed:true,...(mode==='snapshot'?{timeUpdate:null}:{timeUpdate:deadline})});return text;
  });
  let rejectAck=mode==='recovery';let ui:ReturnType<typeof renderHook<ReturnType<typeof useChat>,unknown>>['result']|undefined;
  jest.spyOn(globalThis,'fetch').mockImplementation(async(_url,init)=>{
    const body=JSON.parse(String(init?.body));
    if(body.accepted===true) {expect(ui?.current.isSessionEnded).not.toBe(true);if(rejectAck)return {ok:false,json:async()=>({accepted:false})} as Response;}
    return {ok:true,json:async()=>body.phase==='prepare'?{prepared:true}:{accepted:body.accepted}} as Response;
  });
  const options={...defaultOptions,pdfMemory:{adventureDossierFingerprint:fp},adventureContext:{id:payload.adventure_id,title:'Prabuty',country:'Polska',yearRange:'1973-1974'}};
  let mounted=renderHook(()=>useChat(options));ui=mounted.result;
  if(mode==='restore') {await waitFor(()=>expect(mounted.result.current.isSessionEnded).toBe(true));return;}
  await act(async()=>{if(mode==='continuation')await mounted.result.current.handleContinueNarration?.('partial');else await mounted.result.current.handleSendMessage('Czekam minutę.');});
  if(mode==='snapshot') {
    const request=JSON.parse(String(jest.mocked(fetchWithApiKeys).mock.calls[0][1]?.body));
    expect(request.gameTime).toEqual(before);
    expect(request.dossierWorldState.objects.find((o:{entityId:string})=>o.entityId==='obj-prabuty-generator').state).toBe('active');
    expect(request.dossierWorldState.objects.find((o:{entityId:string})=>o.entityId==='obj-prabuty-ending').state).toBe('ongoing');
    expect(JSON.parse(localStorage.getItem('zew-dossier-world-state:deadline-play')!).objects.find((o:{entityId:string})=>o.entityId==='obj-prabuty-ending').state).toBe('ongoing');
    expect(mounted.result.current.isSessionEnded).toBe(false);return;
  }
  if(mode==='recovery') {
    expect(mounted.result.current.isSessionEnded).toBe(false);expect(localStorage.getItem('zew-dossier-turn:deadline-play')).not.toBeNull();
    mounted.unmount();rejectAck=false;mounted=renderHook(()=>useChat(options));ui=mounted.result;
  }
  await waitFor(()=>expect(mounted.result.current.isSessionEnded).toBe(true));
  expect(mounted.result.current.sessionEndStatus).toBe('ended');
  if(mode==='turn') {expect(saveSpy).toHaveBeenCalledTimes(1);expect(mounted.result.current.sessionSaveStatus).toBe('saved');}
  expect(JSON.parse(localStorage.getItem('zew-dossier-world-state:deadline-play')!).objects.find((o:{entityId:string})=>o.entityId==='obj-prabuty-ending').state).toBe('operation-completed');
  expect(JSON.parse(localStorage.getItem('coc7_game_time')!)).toMatchObject(deadline);
 });
});

it('restores a saved structured sublocation instead of replacing it with the adventure macro location', () => {
  localStorage.setItem('zew_chat_messages', JSON.stringify([{id:'saved-location',role:'assistant',content:'Scena. [LOKACJA: Prabuty - cmentarz]',timestamp:new Date(0),gameTime:partialGameTime}]));
  const {result}=renderHook(()=>useChat({...defaultOptions,adventureContext:{id:'cien-nad-prabutami',title:'Prabuty',location:'Warszawa',yearRange:'1973-1974',country:'Polska'}}));
  expect(result.current.currentLocation).toBe('Prabuty - cmentarz');
  expect(result.current.messages[0].gameTime).toEqual(partialGameTime);
});


it.each(['name','node','location'] as const)('retains canonical crypt %s through a committed response, prose/foreign events, F5 and real close-rift execution', async (referenceKind) => {
  jest.clearAllMocks(); localStorage.clear();
  const {TextEncoder}=await import('node:util'); const {webcrypto}=await import('node:crypto');
  Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});
  Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});
  const {createAuthoredPrabutyPayload,PRABUTY_WORLD_IDS}=await import('@/lib/adventure-dossier/authored-prabuty');
  const {authorizeLocalDraftPayload,fingerprintLocalDraftPayload}=await import('@/lib/adventure-dossier/runtime-authorization');
  const {emptyDossierWorldState}=await import('@/lib/adventure-dossier/world-object-state');
  const {timeManager}=await import('@/lib/time-manager');
  const {getAdventureById}=await import('@/lib/adventures-data');
  const crypt=getAdventureById('cien-nad-prabutami')!.graph!.locations.find(l=>l.id==='loc-prabuty-krypta')!.name;
  expect(crypt.length).toBeGreaterThan(45);
  const fp=await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload('sha256:'+'0'.repeat(64)));
  const payload=await authorizeLocalDraftPayload(createAuthoredPrabutyPayload(fp),{adventureId:'cien-nad-prabutami',editionFingerprint:fp});
  const binding={playthroughId:'crypt-play',adventureId:payload.adventure_id,editionFingerprint:fp};
  const state=emptyDossierWorldState(binding,payload);
  state.objects=state.objects.map(o=>o.entityId===PRABUTY_WORLD_IDS.generator?{...o,state:'disabled'}:o.entityId===PRABUTY_WORLD_IDS.rift?{...o,state:'open'}:o);
  localStorage.setItem('zew-campaign-memory-scope',JSON.stringify({schemaVersion:1,campaignDefinitionId:'scenario:prabuty',kind:'scenario',...binding}));
  localStorage.setItem('zew-dossier-world-state:crypt-play',JSON.stringify(state));
  const clock={year:1973,month:9,day:19,hour:18,minute:0};
  jest.mocked(timeManager.getTime).mockReturnValue(clock);
  jest.mocked(ensureLocalDossierSession).mockResolvedValue({ok:true});
  jest.mocked(loadRuntimeDossierPayload).mockResolvedValue(payload);
  jest.mocked(fetchWithApiKeys).mockResolvedValue({ok:true} as Response);
  jest.spyOn(autoSaveService,'performFullGameSave').mockResolvedValue({success:true,saveId:'saved',saveName:'saved',size:1,formattedSize:'1',messageCount:1,imageCount:0});
  jest.spyOn(globalThis,'fetch').mockImplementation(async(_url,init)=>{const b=JSON.parse(String(init?.body));return {ok:true,json:async()=>b.phase==='prepare'?{prepared:true}:{accepted:b.accepted}} as Response;});
  let closing=false; let stray=false; let foreign=false;
  jest.mocked(parseSSEStream).mockImplementation(async(_r,callbacks)=>{
    const reference=referenceKind==='node'?'node-prabuty-krypta-climax':referenceKind==='location'?'loc-prabuty-krypta':crypt;
    const text=closing?'[TECZKA_STANU: '+PRABUTY_WORLD_IDS.rift+' | close-rift]':stray?'Znajdujesz się w niskiej, ciasnej przybudówce.'+(foreign?' [LOKACJA: foreign-room]':''):'Jesteś w krypcie. [LOKACJA: '+reference+']';
    callbacks?.onText?.(text);callbacks?.onMetadata?.({type:'metadata',dossierFinalizationToken:closing?'close-token':'entry-token',dossierInventoryWritesAllowed:true,timeUpdate:clock,...(stray?{parsedEvents:[{type:'location',title:'Lokacja: niskiej',description:'Odwiedzone miejsce'}]}:{})});return text;
  });
  const options={...defaultOptions,pdfMemory:{adventureDossierFingerprint:fp},adventureContext:{id:payload.adventure_id,title:'Prabuty',location:'Prabuty',country:'Polska',yearRange:'1973-1974'}};
  let mounted=renderHook(()=>useChat(options));
  await act(async()=>{await mounted.result.current.handleSendMessage('Wchodzę do krypty.');});
  expect(mounted.result.current.currentLocation).toBe(crypt);
  stray=true;
  await act(async()=>{await mounted.result.current.handleSendMessage('Badam wyłom.');});
  expect(mounted.result.current.currentLocation).toBe(crypt);
  const request=JSON.parse(String(jest.mocked(fetchWithApiKeys).mock.calls.at(-1)![1]?.body));
  expect(request.activeLocationId).toBe('loc-prabuty-krypta');
  expect(request.activeNodeId).toBe('node-prabuty-krypta-climax');
  foreign=true;
  await act(async()=>{await mounted.result.current.handleSendMessage('Sprawdzam obramowanie.');});
  expect(mounted.result.current.currentLocation).toBe(crypt);
  mounted.unmount();mounted=renderHook(()=>useChat(options));
  expect(mounted.result.current.currentLocation).toBe(crypt);
  closing=true;
  await act(async()=>{await mounted.result.current.handleSendMessage('Zamykam szczelinę.');});
  expect(mounted.result.current.isSessionEnded).toBe(true);
  const saved=JSON.parse(localStorage.getItem('zew-dossier-world-state:crypt-play')!);
  expect(saved.objects.find((o:{entityId:string})=>o.entityId===PRABUTY_WORLD_IDS.rift).state).toBe('closed');
  expect(saved.objects.find((o:{entityId:string})=>o.entityId===PRABUTY_WORLD_IDS.ending).state).toBe('interrupted');
});


describe('ordinary dossier protocol correction',()=>{
 it.each(['valid','missing','foreign','mechanical','http409'] as const)('publishes only one validated correction: %s',async second=>{
  jest.clearAllMocks();localStorage.clear();
  const {TextEncoder}=await import('node:util');const {webcrypto}=await import('node:crypto');
  Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});
  const {createAuthoredPrabutyPayload}=await import('@/lib/adventure-dossier/authored-prabuty');
  const {authorizeLocalDraftPayload,fingerprintLocalDraftPayload}=await import('@/lib/adventure-dossier/runtime-authorization');
  const {emptyDossierWorldState}=await import('@/lib/adventure-dossier/world-object-state');
  const {timeManager}=await import('@/lib/time-manager');
  const fp=await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload('sha256:'+'0'.repeat(64)));
  const payload=await authorizeLocalDraftPayload(createAuthoredPrabutyPayload(fp),{adventureId:'cien-nad-prabutami',editionFingerprint:fp});
  const binding={playthroughId:'protocol-play',adventureId:payload.adventure_id,editionFingerprint:fp};
  const clock={year:1973,month:9,day:19,hour:3,minute:0};jest.mocked(timeManager.getTime).mockReturnValue(clock);
  const history=JSON.stringify([{id:'prior',role:'assistant',content:'Earlier.',timestamp:new Date(0),gameTime:clock}]);
  const world=JSON.stringify(emptyDossierWorldState(binding,payload));
  localStorage.setItem('zew-campaign-memory-scope',JSON.stringify({schemaVersion:1,campaignDefinitionId:'scenario:prabuty',kind:'scenario',...binding}));
  localStorage.setItem('zew_chat_messages',history);localStorage.setItem('zew-dossier-world-state:protocol-play',world);localStorage.setItem('coc7_game_time',JSON.stringify(clock));
  jest.mocked(ensureLocalDossierSession).mockResolvedValue({ok:true});jest.mocked(loadRuntimeDossierPayload).mockResolvedValue(payload);
  jest.mocked(fetchWithApiKeys).mockResolvedValue({ok:true} as Response);
  if(second==='http409')jest.mocked(fetchWithApiKeys).mockResolvedValueOnce({ok:true} as Response).mockResolvedValueOnce({ok:false,status:409,json:async()=>({code:'DOSSIER_CORRECTION_REJECTED'})} as Response);
  const ack=jest.spyOn(globalThis,'fetch').mockImplementation(async(_url,init)=>{const b=JSON.parse(String(init?.body));return {ok:true,json:async()=>b.phase==='prepare'?{prepared:true}:{accepted:b.accepted}} as Response;});
  let attempt=0;
  jest.mocked(parseSSEStream).mockImplementation(async(_r,callbacks)=>{
   attempt++;const valid=attempt===2&&second==='valid';
   const text=valid?'Confirmed scene. [LOKACJA: loc-prabuty-krypta]':second==='missing'?'Unvalidated scene.':'Unvalidated scene. [LOKACJA: foreign-room]';
   callbacks?.onText?.(text);callbacks?.onMetadata?.({type:'metadata',dossierFinalizationToken:'protocol-token-'+attempt,dossierInventoryWritesAllowed:true,timeUpdate:valid?clock:null});return text;
  });
  const voice=jest.fn();const options={...defaultOptions,voiceEnabled:true,isTTSEnabled:true,addToQueue:voice,pdfMemory:{adventureDossierFingerprint:fp},adventureContext:{id:payload.adventure_id,title:'Prabuty',location:'niskiej',country:'Polska',yearRange:'1973-1974'}};
  const mounted=renderHook(()=>useChat(options));const {result}=mounted;let accepted:unknown;
  await act(async()=>{accepted=await result.current.handleSendMessage('Wracam do potwierdzonego miejsca.',second==='mechanical'?{skillRolls:[]}:undefined);});
  expect(fetchWithApiKeys).toHaveBeenCalledTimes(2);expect(attempt).toBe(second==='http409'?1:2);
  const retry=JSON.parse(String(jest.mocked(fetchWithApiKeys).mock.calls[1][1]?.body));
  expect(retry.dossierCorrection.rejectedIds).toContain('DOSSIER_TIME_REQUIRED');
  expect(retry.dossierCorrection.rejectedIds).toContain('DOSSIER_LOCATION_REQUIRED');
  expect(result.current.messages.some(m=>m.content.includes('Unvalidated scene.'))).toBe(false);
  expect(result.current.messages.at(-1)?.content).not.toContain('foreign-room');
  if(second==='valid') {
   expect(accepted).toBe(true);expect(result.current.currentLocation).toBe('Zawalona Krypta pod Ruinami Kościoła w Prabutach');
   expect(JSON.parse(localStorage.getItem('zew_chat_messages')!).at(-1).content).toContain('Confirmed scene.');
   expect(voice).toHaveBeenCalledTimes(1);
  }else{
   expect(accepted).toBe(false);expect(result.current.currentLocation).toBe('niskiej');
   expect(result.current.dossierProtocolFailure).toEqual(second==='mechanical'?null:{code:'DOSSIER_PROTOCOL_REJECTED',declaration:'Wracam do potwierdzonego miejsca.'});
   expect(localStorage.getItem('zew_chat_messages')).toBe(history);expect(localStorage.getItem('zew-dossier-world-state:protocol-play')).toBe(world);expect(localStorage.getItem('coc7_game_time')).toBe(JSON.stringify(clock));
   expect(voice).not.toHaveBeenCalled();expect(timeManager.setTime).not.toHaveBeenCalled();
   expect(ack.mock.calls.some(([,init])=>JSON.parse(String(init?.body)).accepted===true)).toBe(false);
   expect(localStorage.getItem('zew-dossier-turn:protocol-play')).toBeNull();
   localStorage.setItem('zew-campaign-memory-scope',JSON.stringify({schemaVersion:1,campaignDefinitionId:'scenario:prabuty',kind:'scenario',...binding,playthroughId:'other-play'}));
   mounted.rerender();expect(result.current.dossierProtocolFailure).toBeNull();
  }
 });
});


test('off-graph departure is atomic, survives F5, returns exactly and lets the deadline finish outside',async()=>{
 jest.clearAllMocks();localStorage.clear();
 const {TextEncoder}=await import('node:util');const {webcrypto}=await import('node:crypto');
 Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});
 const {createAuthoredPrabutyPayload,PRABUTY_WORLD_IDS}=await import('@/lib/adventure-dossier/authored-prabuty');
 const {authorizeLocalDraftPayload,fingerprintLocalDraftPayload}=await import('@/lib/adventure-dossier/runtime-authorization');
 const {emptyDossierWorldState}=await import('@/lib/adventure-dossier/world-object-state');
 const {timeManager}=await import('@/lib/time-manager');
 const {getAdventureById}=await import('@/lib/adventures-data');
 const fp=await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload('sha256:'+'0'.repeat(64)));
 const payload=await authorizeLocalDraftPayload(createAuthoredPrabutyPayload(fp),{adventureId:'cien-nad-prabutami',editionFingerprint:fp});
 const binding={playthroughId:'outside-play',adventureId:payload.adventure_id,editionFingerprint:fp};
 const initialClock={year:1973,month:9,day:19,hour:3,minute:0};let responseClock={...initialClock};
 jest.mocked(timeManager.getTime).mockReturnValue(initialClock);
 jest.mocked(timeManager.setTime).mockImplementation(time=>{const next={...timeManager.getTime(),...time};jest.mocked(timeManager.getTime).mockReturnValue(next);return next;});
 const history=JSON.stringify([{id:'prior',role:'assistant',content:'Krypta. [LOKACJA: loc-prabuty-krypta]',timestamp:new Date(0),gameTime:initialClock}]);
 const world=JSON.stringify(emptyDossierWorldState(binding,payload));
 localStorage.setItem('zew-campaign-memory-scope',JSON.stringify({schemaVersion:1,campaignDefinitionId:'scenario:prabuty',kind:'scenario',...binding}));
 localStorage.setItem('zew_chat_messages',history);localStorage.setItem('zew-dossier-world-state:outside-play',world);localStorage.setItem('coc7_game_time',JSON.stringify(initialClock));
 jest.mocked(ensureLocalDossierSession).mockResolvedValue({ok:true});jest.mocked(loadRuntimeDossierPayload).mockResolvedValue(payload);
 jest.mocked(fetchWithApiKeys).mockResolvedValue({ok:true} as Response);
 jest.spyOn(autoSaveService,'performFullGameSave').mockResolvedValue({success:true,saveId:'saved',saveName:'saved',size:1,formattedSize:'1',messageCount:1,imageCount:0});
 jest.spyOn(globalThis,'fetch').mockImplementation(async(_url,init)=>{const b=JSON.parse(String(init?.body));return {ok:true,json:async()=>b.phase==='prepare'?{prepared:true}:{accepted:b.accepted}} as Response;});
 let text='[TECZKA_STANU: '+PRABUTY_WORLD_IDS.generator+' | start-generator] [LOKACJA: OFF_GRAPH | Telefon przy szosie]';
 jest.mocked(parseSSEStream).mockImplementation(async(_r,callbacks)=>{callbacks?.onText?.(text);callbacks?.onMetadata?.({type:'metadata',dossierFinalizationToken:'outside-token',dossierInventoryWritesAllowed:true,timeUpdate:responseClock});return text;});
 const options={...defaultOptions,pdfMemory:{adventureDossierFingerprint:fp},adventureContext:{id:payload.adventure_id,title:'Prabuty',location:'Prabuty',country:'Polska',yearRange:'1973-1974'}};
 let mounted=renderHook(()=>useChat(options));
 await act(async()=>{expect(await mounted.result.current.handleSendMessage('Odjeżdżam do telefonu.')).toBe(false);});
 expect(fetchWithApiKeys).toHaveBeenCalledTimes(2);expect(localStorage.getItem('zew_chat_messages')).toBe(history);expect(localStorage.getItem('zew-dossier-world-state:outside-play')).toBe(world);
 text='Jadę do telefonu. [LOKACJA: OFF_GRAPH | Telefon przy szosie]';responseClock={...initialClock,minute:10};
 await act(async()=>{expect(await mounted.result.current.handleSendMessage('Odjeżdżam do telefonu.')).toBe(true);});
 expect(mounted.result.current.dossierProtocolFailure).toBeNull();expect(mounted.result.current.currentLocation).toBe('Telefon przy szosie');
 expect(JSON.parse(localStorage.getItem('zew_chat_messages')!).at(-1).content).toContain('[LOKACJA: OFF_GRAPH | Telefon przy szosie]');
 mounted.unmount();
 // Real F5: history is synchronous, while fingerprint and adventure hydrate later.
 const hydratingOptions:Parameters<typeof useChat>[0]={...options,pdfMemory:{},adventureContext:undefined};
 mounted=renderHook(()=>useChat(hydratingOptions));
 hydratingOptions.pdfMemory=options.pdfMemory;mounted.rerender();
 hydratingOptions.adventureContext=options.adventureContext;mounted.rerender();
 expect(mounted.result.current.currentLocation).toBe('Telefon przy szosie');
 text='Rozmawiam przez telefon.';
 await act(async()=>{expect(await mounted.result.current.handleSendMessage('Zgłaszam zagrożenie straży.')).toBe(true);});
 let request=JSON.parse(String(jest.mocked(fetchWithApiKeys).mock.calls.at(-1)![1]?.body));
 expect(request.dossierLocation).toEqual({mode:'off_graph',label:'Telefon przy szosie',adventureId:payload.adventure_id,playthroughId:'outside-play'});expect(request.activeLocationId).toBeNull();expect(request.activeNodeId).toBeNull();
 text='Wracasz. [LOKACJA: loc-prabuty-krypta]';
 await act(async()=>{expect(await mounted.result.current.handleSendMessage('Wracam do krypty.')).toBe(true);});
 expect(mounted.result.current.currentLocation).toBe('Zawalona Krypta pod Ruinami Kościoła w Prabutach');
 text='Oglądasz otoczenie.';
 await act(async()=>{expect(await mounted.result.current.handleSendMessage('Rozglądam się.')).toBe(true);});
 request=JSON.parse(String(jest.mocked(fetchWithApiKeys).mock.calls.at(-1)![1]?.body));expect(request.dossierLocation).toBeUndefined();expect(request.activeLocationId).toBe('loc-prabuty-krypta');expect(request.activeNodeId).toBe('node-prabuty-krypta-climax');
 const deadline=getAdventureById(payload.adventure_id)!.doomClock!.deadline!;responseClock=deadline as typeof initialClock;
 text='Czekasz poza ruinami. [LOKACJA: OFF_GRAPH | Strażnica]';
 await act(async()=>{expect(await mounted.result.current.handleSendMessage('Odjeżdżam do strażnicy i czekam.')).toBe(true);});
 expect(mounted.result.current.isSessionEnded).toBe(true);expect(mounted.result.current.currentLocation).toBe('Strażnica');
 const finalWorld=JSON.parse(localStorage.getItem('zew-dossier-world-state:outside-play')!);expect(finalWorld.objects.find((o:{entityId:string})=>o.entityId===PRABUTY_WORLD_IDS.ending).state).toBe('operation-completed');expect(timeManager.getTime()).toEqual(deadline);
});


describe('dossier transport failures preserve committed history',()=>{
 it.each(['network','503','401','tts','ack','legacy','occupied','mechanical','tagged'] as const)('keeps transaction boundaries for %s',async failure=>{
  jest.clearAllMocks();localStorage.clear();
  jest.spyOn(console,'error').mockImplementation(()=>{});jest.spyOn(console,'warn').mockImplementation(()=>{});
  const {TextEncoder}=await import('node:util');const {webcrypto}=await import('node:crypto');
  Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});
  const {createAuthoredPrabutyPayload}=await import('@/lib/adventure-dossier/authored-prabuty');
  const {authorizeLocalDraftPayload,fingerprintLocalDraftPayload}=await import('@/lib/adventure-dossier/runtime-authorization');
  const {emptyDossierWorldState}=await import('@/lib/adventure-dossier/world-object-state');
  const {timeManager}=await import('@/lib/time-manager');
  const fp=await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload('sha256:'+'0'.repeat(64)));
  const payload=await authorizeLocalDraftPayload(createAuthoredPrabutyPayload(fp),{adventureId:'cien-nad-prabutami',editionFingerprint:fp});
  const binding={playthroughId:'transport-play',adventureId:payload.adventure_id,editionFingerprint:fp};
  const clock={year:1973,month:9,day:19,hour:3,minute:0};jest.mocked(timeManager.getTime).mockReturnValue(clock);
  const prior={id:'accepted-prior',role:'assistant',content:'Earlier accepted scene. [LOKACJA: loc-prabuty-krypta]',timestamp:new Date(0),gameTime:clock};
  const history=JSON.stringify([prior]);const world=JSON.stringify(emptyDossierWorldState(binding,payload));
  localStorage.setItem('zew-campaign-memory-scope',JSON.stringify({schemaVersion:1,campaignDefinitionId:'scenario:prabuty',kind:'scenario',...binding}));
  localStorage.setItem('zew_chat_messages',history);localStorage.setItem('zew-dossier-world-state:transport-play',world);localStorage.setItem('coc7_game_time',JSON.stringify(clock));
  jest.mocked(ensureLocalDossierSession).mockResolvedValue({ok:true});jest.mocked(loadRuntimeDossierPayload).mockResolvedValue(payload);
  const api=jest.mocked(fetchWithApiKeys);
  if(failure==='network')api.mockRejectedValue(new TypeError('Failed to fetch'));
  else if(['tts','ack'].includes(failure))api.mockResolvedValue({ok:true} as Response);
  else api.mockResolvedValue({ok:false,status:failure==='401'?401:503,json:async()=>({error:'Provider unavailable'})} as Response);
  const ack=jest.spyOn(globalThis,'fetch').mockImplementation(async(_url,init)=>{const body=JSON.parse(String(init?.body));if(failure==='ack'&&body.accepted===true)throw new TypeError('ACK connection lost');return {ok:true,json:async()=>body.phase==='prepare'?{prepared:true}:{accepted:body.accepted}} as Response;});
  jest.mocked(parseSSEStream).mockImplementation(async(_response,callbacks)=>{const text='Accepted follow-up.';callbacks?.onText?.(text);callbacks?.onMetadata?.({type:'metadata',dossierFinalizationToken:'transport-token',dossierInventoryWritesAllowed:true,timeUpdate:clock});return text;});
  const voice=jest.fn(()=>{if(failure==='tts')throw new Error('TTS player failed');});
  const options={...defaultOptions,voiceEnabled:true,isTTSEnabled:true,addToQueue:voice,pdfMemory:failure==='legacy'?{}:{adventureDossierFingerprint:fp},adventureContext:{id:payload.adventure_id,title:'Prabuty',location:'Prabuty',country:'Polska',yearRange:'1973-1974'}};
  const {result}=renderHook(()=>useChat(options));
  const declaration=failure==='tagged'?'Sprawdzam drzwi. [TEST: 42]':'Badam framugę.';let accepted:unknown;
  await act(async()=>{const pending=result.current.handleSendMessage(declaration,failure==='mechanical'?{skillRolls:[]}:undefined);result.current.setNewMessage(failure==='occupied'?'Nowa deklaracja.':'');accepted=await pending;});
  expect(result.current.messages[0]).toMatchObject({id:prior.id,content:prior.content});
  if(failure==='tts'){
   expect(accepted).toBe(true);expect(voice).toHaveBeenCalledTimes(1);
   expect(result.current.messages.at(-1)?.content).toBe('Accepted follow-up.');
   expect(JSON.parse(localStorage.getItem('zew_chat_messages')!).at(-1).content).toBe('Accepted follow-up.');
   expect(ack.mock.calls.some(([,init])=>JSON.parse(String(init?.body)).accepted===true)).toBe(true);
  }else if(failure==='ack'){
   expect(accepted).toBe(false);expect(localStorage.getItem('zew-dossier-turn:transport-play')).not.toBeNull();
   expect(localStorage.getItem('zew_chat_messages')).toBe(history);expect(result.current.messages).toHaveLength(3);
  }else if(failure==='legacy'){
   expect(accepted).toBe(false);expect(result.current.messages).toHaveLength(3);expect(result.current.messages.at(-1)?.content).toContain('błąd');
  }else{
   expect(accepted).toBe(false);expect(result.current.messages).toHaveLength(1);
   expect(localStorage.getItem('zew_chat_messages')).toBe(history);expect(localStorage.getItem('zew-dossier-world-state:transport-play')).toBe(world);
   expect(localStorage.getItem('coc7_game_time')).toBe(JSON.stringify(clock));expect(localStorage.getItem('zew-dossier-turn:transport-play')).toBeNull();
   expect(result.current.dossierProtocolFailure).toBeNull();
   expect(result.current.newMessage).toBe(failure==='occupied'?'Nowa deklaracja.':['mechanical','tagged'].includes(failure)?'':declaration);
   api.mockResolvedValue({ok:true} as Response);
   await act(async()=>{expect(await result.current.handleSendMessage('Oglądam zawias.')).toBe(true);});
   const persisted=JSON.parse(localStorage.getItem('zew_chat_messages')!);
   expect(persisted.map((m:{content:string})=>m.content)).toEqual([prior.content,'Oglądam zawias.','Accepted follow-up.']);
  }
 });
});


describe('ordinary send uses current settings without requiring a history change',()=>{
 it.each([false,true])('sends the newly selected model and current image flag %s after a settings-only rerender',async imageGenerationEnabled=>{
  jest.clearAllMocks();localStorage.clear();
  jest.spyOn(console,'error').mockImplementation(()=>{});
  jest.mocked(fetchWithApiKeys).mockResolvedValue({ok:false,status:503,json:async()=>({error:'Synthetic transport boundary'})} as Response);
  const oldSettings={...defaultAISettings,geminiSettings:{...defaultAISettings.geminiSettings,model:'gemini-flash-lite-latest' as const},imageGenerationEnabled:!imageGenerationEnabled};
  const currentSettings={...oldSettings,geminiSettings:{...oldSettings.geminiSettings,model:'gemini-3.1-flash-lite' as const},imageGenerationEnabled};
  const {result,rerender}=renderHook(({aiSettings})=>useChat({...defaultOptions,aiSettings}),{initialProps:{aiSettings:oldSettings as typeof defaultAISettings}});
  const history=result.current.messages;
  rerender({aiSettings:currentSettings});
  expect(result.current.messages).toBe(history);
  const updatedSend=result.current.handleSendMessage;
  rerender({aiSettings:currentSettings});
  expect(result.current.handleSendMessage).toBe(updatedSend);
  expect(fetchWithApiKeys).not.toHaveBeenCalled();
  await act(async()=>{await result.current.handleSendMessage('Oglądam framugę.');});
  expect(fetchWithApiKeys).toHaveBeenCalledTimes(1);
  const request=JSON.parse(String(jest.mocked(fetchWithApiKeys).mock.calls[0][1]?.body));
  expect(request.aiSettings.geminiSettings.model).toBe(currentSettings.geminiSettings.model);
  expect(request.aiSettings.imageGenerationEnabled).toBe(imageGenerationEnabled);
 });
});


describe('pending exact dossier skill-roll retry',()=>{
 it.each(['503','abort','ack','scope','stale','accepted'] as const)('preserves exact rolled result at the %s boundary',async boundary=>{
  jest.clearAllMocks();localStorage.clear();jest.spyOn(console,'error').mockImplementation(()=>{});jest.spyOn(console,'warn').mockImplementation(()=>{});
  const {TextEncoder}=await import('node:util');const {webcrypto}=await import('node:crypto');Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});
  const {createAuthoredPrabutyPayload}=await import('@/lib/adventure-dossier/authored-prabuty');const {fingerprintLocalDraftPayload,authorizeLocalDraftPayload}=await import('@/lib/adventure-dossier/runtime-authorization');
  const {PREDEFINED_CHARACTERS}=await import('@/lib/immersion/predefined-characters');
  const character={...PREDEFINED_CHARACTERS[0],id:'roll-pc',luck:26};
  const adventureId='cien-nad-prabutami',fp=await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload(`sha256:${'0'.repeat(64)}`));
  const payload=await authorizeLocalDraftPayload(createAuthoredPrabutyPayload(fp),{adventureId,editionFingerprint:fp});
  const scope={schemaVersion:1,campaignDefinitionId:'scenario:prabuty',kind:'scenario',playthroughId:'pending-roll-play',adventureId};
  localStorage.setItem('zew-campaign-memory-scope',JSON.stringify(scope));
  const test={id:'dex-exact',characterId:character.id,skillName:'Dexterity',skillValue:70,difficulty:'zwykly' as const,modifiers:[],justification:'Declared action'};
  const skillRoll={testId:test.id,resolutionId:'original-roll-57',characterId:character.id,requiredDifficulty:'regular' as const,passedRequirement:true,outcome:'regular' as const,luckSpent:29,skillNames:[test.skillName]};
  const clock={year:1973,month:9,day:19,hour:3,minute:0};const {timeManager}=await import('@/lib/time-manager');jest.mocked(timeManager.getTime).mockReturnValue(clock);
  const history=JSON.stringify([{id:'source-test',role:'assistant',content:'[LOKACJA: loc-warszawa-redakcja]',timestamp:new Date(0),skillTests:[test],gameTime:clock}]);
  localStorage.setItem('zew_chat_messages',history);
  jest.mocked(loadRuntimeDossierPayload).mockResolvedValue(payload);jest.mocked(ensureLocalDossierSession).mockResolvedValue({ok:true});
  const api=jest.mocked(fetchWithApiKeys);api.mockResolvedValue({ok:false,status:503,json:async()=>({error:'Provider unavailable'})} as Response);
  if(boundary==='abort')api.mockRejectedValue(new DOMException('Aborted','AbortError'));
  if(boundary==='ack'||boundary==='accepted')api.mockResolvedValue({ok:true} as Response);
  jest.mocked(parseSSEStream).mockImplementation(async(_response,callbacks)=>{const text='Accepted result. [LOKACJA: loc-warszawa-redakcja]';callbacks?.onText?.(text);callbacks?.onMetadata?.({type:'metadata',timeUpdate:clock,dossierInventoryWritesAllowed:true,dossierFinalizationToken:'roll-token'});return text;});
  let failAck=boundary==='ack';jest.spyOn(globalThis,'fetch').mockImplementation(async(_url,init)=>{const body=JSON.parse(String(init?.body));if(body.accepted===true&&failAck)throw new TypeError('ACK connection lost');return {ok:true,json:async()=>body.phase==='prepare'?{prepared:true}:{accepted:body.accepted}} as Response;});
  const options={...defaultOptions,activeCharacter:character,characters:[character],pdfMemory:{adventureDossierFingerprint:fp},adventureContext:{id:adventureId,title:'Prabuty',yearRange:'1973-1974',country:'Polska'}};
  let mounted=renderHook(()=>useChat(options));
  await act(async()=>{await mounted.result.current.handleSendMessage('Rzut 57 po wydaniu Szczęścia.',{skillRolls:[skillRoll]});});
  if(boundary==='accepted'){
   expect(mounted.result.current.pendingDossierSkillRollRetry).toBeNull();
   const calls=api.mock.calls.length;await act(async()=>{expect(await mounted.result.current.handleSendMessage('Rzut 57 po wydaniu Szczęścia.',{skillRolls:[skillRoll]})).toBe(false);});expect(api).toHaveBeenCalledTimes(calls);return;
  }
  expect(mounted.result.current.pendingDossierSkillRollRetry).toEqual({testIds:[test.id]});
  const key='zew-dossier-skill-roll:pending-roll-play',outbox=localStorage.getItem(key);expect(outbox).not.toBeNull();
  if(boundary!=='ack'){expect(localStorage.getItem('zew_chat_messages')).toBe(history);expect(mounted.result.current.messages).toHaveLength(1);expect(mounted.result.current.newMessage).toBe('');}
  const before=api.mock.calls.length;
  if(boundary==='ack'){
   failAck=false;await act(async()=>{await mounted.result.current.retryDossierSkillRoll();});
   expect(api).toHaveBeenCalledTimes(before);expect(localStorage.getItem(key)).toBeNull();expect(mounted.result.current.pendingDossierSkillRollRetry).toBeNull();return;
  }
  await act(async()=>{expect(await mounted.result.current.handleSendMessage('Nowa czynność.')).toBe(false);});expect(api).toHaveBeenCalledTimes(before);
  mounted.unmount();
  if(boundary==='scope')localStorage.setItem('zew-campaign-memory-scope',JSON.stringify({...scope,adventureId:'foreign'}));
  if(boundary==='stale')localStorage.setItem('zew_chat_messages',JSON.stringify([{id:'source-test',role:'assistant',content:'Changed',timestamp:new Date(0),skillTests:[{...test,skillValue:20}]}]));
  mounted=renderHook(()=>useChat(options));
  if(boundary==='scope'||boundary==='stale'){
   await act(async()=>{expect(await mounted.result.current.retryDossierSkillRoll()).toBe(false);});expect(api).toHaveBeenCalledTimes(before);expect(localStorage.getItem(key)).toBe(outbox);return;
  }
  expect(mounted.result.current.pendingDossierSkillRollRetry).toEqual({testIds:[test.id]});
  let release:((value:Response)=>void)|undefined;api.mockImplementation((url)=>url==='/api/chat'&&!release?new Promise(resolve=>{release=resolve;}):Promise.resolve({ok:true,json:async()=>({})} as Response));
  let retry:Promise<boolean>|undefined;
  await act(async()=>{retry=mounted.result.current.retryDossierSkillRoll();await Promise.resolve();});
  await act(async()=>{expect(await mounted.result.current.retryDossierSkillRoll()).toBe(false);});
  await waitFor(()=>expect(release).toBeDefined());
  expect(localStorage.getItem(key)).toBe(outbox);
  expect(JSON.parse(localStorage.getItem('zew_chat_messages')!)).toHaveLength(1);
  await act(async()=>{release!({ok:true} as Response);const ok=await retry;expect(ok).toBe(true);});
  const chatCalls=api.mock.calls.filter(([url])=>url==='/api/chat');
  expect(chatCalls).toHaveLength(2);
  const first=JSON.parse(String(chatCalls[0][1]?.body)),last=JSON.parse(String(chatCalls.at(-1)![1]?.body));
  expect(last.mechanicsContext.skillRolls).toEqual(first.mechanicsContext.skillRolls);expect(last.mechanicsContext.skillRolls).toEqual([skillRoll]);
  expect(localStorage.getItem(key)).toBeNull();expect(mounted.result.current.pendingDossierSkillRollRetry).toBeNull();
  expect(character.luck).toBe(26);expect(JSON.parse(localStorage.getItem('zew_chat_messages')!).filter((m:Message)=>m.role==='user')).toHaveLength(1);
 });
});
