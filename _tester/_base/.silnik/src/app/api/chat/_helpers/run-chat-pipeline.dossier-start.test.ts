import { NextResponse, type NextRequest } from 'next/server';
import { TextDecoder, TextEncoder } from 'node:util';
import { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { defaultAISettings } from '@/lib/ai-settings/defaults';
import { runChatPipeline } from './run-chat-pipeline';
import { createSseStream } from './create-sse-stream';
import { getDossierRagBinding, renderDossierWorldStateSection } from '@/lib/adventure-dossier/rag-runtime';
import { retrieveDossierTurnContext } from '@/lib/adventure-dossier/turn-context';
import { GeminiChatProvider } from '@/lib/ai-providers';
import * as models from '@/lib/model-registry';
import * as agency from './agency-linter';

jest.mock('next/server', () => ({ NextResponse: { json: jest.fn() } }));
jest.mock('@/lib/ai-settings', () => ({
  loadAISettings: () => jest.requireActual('@/lib/ai-settings/defaults').defaultAISettings,
  getGameMasterPrompt: () => 'Test GM prompt.',
}));
jest.mock('@/lib/ai-providers', () => ({ GeminiChatProvider: jest.fn() }));
jest.mock('@/lib/auth-user', () => ({ resolveUserId: async () => 'local', scopeSessionId: (_user: string, session: string) => session }));
jest.mock('@/lib/embedding-service', () => ({ getEmbeddingDimensions: () => 3 }));
jest.mock('@/lib/adventure-dossier/rag-runtime', () => ({
  getDossierRagBinding: jest.fn(),
  renderDossierWorldStateSection: jest.fn(() => 'MANDATORY_WORLD_STATE_SENTINEL'),
}));
jest.mock('@/lib/adventure-dossier/turn-context', () => ({
  ...jest.requireActual('@/lib/adventure-dossier/turn-context'),
  retrieveDossierTurnContext: jest.fn(async () => ({ context: '', clueRecordIds: [], handoutLocatorIds: [] })),
}));
jest.mock('./resolve-gemini-cache', () => ({ resolveGeminiCache: async () => null }));
jest.mock('./run-rag-summary', () => ({ runRAGAndSummary: async () => ({ ragSection: '', summarySection: '', campaignMemorySection: '', contextMessages: [], ragMeta: {} }) }));
jest.mock('./build-immersion-context', () => ({ fetchImmersionContext: async () => '' }));
jest.mock('./create-sse-stream', () => ({ createSseStream: jest.fn() }));

const fingerprint = 'sha256:' + 'a'.repeat(64);
const scope = { schemaVersion: 1, campaignDefinitionId: 'scenario:cien-nad-prabutami',
  playthroughId: 'opening-wiring-test', adventureId: 'cien-nad-prabutami', kind: 'scenario' };
const originalResponse = globalThis.Response;

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(globalThis, { TextEncoder, TextDecoder, ReadableStream: NodeReadableStream });
  // Only the outer HTTP envelope is replaced. The production orchestrator runs to its actual SSE call.
  globalThis.Response = jest.fn((body, init) => ({ body, status: init?.status ?? 200 })) as unknown as typeof Response;
  jest.mocked(global.fetch).mockRejectedValue(new Error('Network forbidden in pipeline wiring regression'));
  jest.mocked(getDossierRagBinding).mockReturnValue({ adventureId: scope.adventureId, editionFingerprint: fingerprint });
  jest.mocked(GeminiChatProvider).mockImplementation(() => ({
    streamChat: jest.fn(async () => ({
      stream: (async function* () { yield { text: 'Gabinet jest cichy. [Co robisz?]' }; })(),
      getUsage: async () => null, getFinishReason: () => 'STOP',
    })),
  }) as unknown as InstanceType<typeof GeminiChatProvider>);
  jest.mocked(createSseStream).mockReturnValue(new globalThis.ReadableStream({ start(controller) { controller.close(); } }));
});
afterEach(() => { globalThis.Response = originalResponse; });

it.each([
  ['local dossier', { adventureDossierFingerprint: fingerprint }, true],
  ['legacy adventure', {}, false],
])('wires %s opening through the correct SSE finalization mode', async (_label, pdfMemory, deferred) => {
  const request = { headers: { get: (name: string) => name === 'X-Gemini-Api-Key' ? 'synthetic-test-key' : null } } as unknown as NextRequest;
  const response = await runChatPipeline({ request, traceId: 'opening-wiring', timer: { elapsed: () => 0 }, body: {
    message: 'Zaczynamy przygodę. Opisz gabinet i zapytaj o mój zamiar.',
    isGameStart: true, pdfMemory, memoryScope: scope, assistantMessageId: 'opening-message',
    adventureContext: { id: scope.adventureId, yearRange: '1973-1974', country: 'Polska' },
    aiSettings: { ...defaultAISettings, imageGenerationEnabled: false },
    messages: [], characters: [], npcs: [], locale: 'pl',
  } });
  expect(response.status).toBe(200);
  expect(createSseStream).toHaveBeenCalledTimes(1);
  expect(createSseStream).toHaveBeenCalledWith(expect.objectContaining({
    deferDossierFinalization: deferred, dossierInventoryWritesAllowed: false,
    memoryScope: scope, assistantMessageId: 'opening-message', sessionId: scope.playthroughId,
  }));
  expect(GeminiChatProvider).toHaveBeenCalledTimes(1);
  expect(global.fetch).not.toHaveBeenCalled();
});


it.each(['Zawalona Krypta pod Ruinami Kościoła w Prabutach','node-prabuty-krypta-climax','loc-prabuty-krypta','niskiej'])('uses exact current binding instead of static initial scene: %s',async currentLocation=>{
 const request={headers:{get:(name:string)=>name==='X-Gemini-Api-Key'?'synthetic-test-key':null}} as unknown as NextRequest;
 await runChatPipeline({request,traceId:'location-wiring',timer:{elapsed:()=>0},body:{
  message:'Badam pomieszczenie.',pdfMemory:{adventureDossierFingerprint:fingerprint},memoryScope:scope,assistantMessageId:'turn',
  adventureContext:{id:scope.adventureId,activeNodeId:'node-warszawa-redakcja',activeLocationId:'loc-warszawa-redakcja',yearRange:'1973-1974',country:'Polska'},
  activeNodeId:'node-warszawa-redakcja',activeLocationId:'loc-warszawa-redakcja',currentLocation,
  aiSettings:{...defaultAISettings,imageGenerationEnabled:false},messages:[],characters:[],locale:'pl',
  npcs:[{id:'npc-crypt',name:'Crypt NPC',locationId:'loc-prabuty-krypta',status:'alive'},{id:'npc-office',name:'Office NPC',locationId:'loc-warszawa-redakcja',status:'alive'}],
 }});
 const provider=jest.mocked(GeminiChatProvider).mock.results[0].value;
 const prompt=JSON.stringify(jest.mocked(provider.streamChat).mock.calls);
 expect(prompt).toContain('KANONICZNA BIEŻĄCA LOKACJA');
 expect(prompt).toContain('loc-prabuty-krypta');
 const retrieval=jest.mocked(retrieveDossierTurnContext).mock.calls.at(-1)![0];
 expect(retrieval.activeSceneIds).toEqual(currentLocation==='niskiej'?[]:['node-prabuty-krypta-climax','loc-prabuty-krypta','Zawalona Krypta pod Ruinami Kościoła w Prabutach']);
 expect(retrieval.presentEntityIds).toEqual(currentLocation==='niskiej'?[]:['npc-crypt']);
});


test('budget trimming drops optional RAG but retains mandatory source and world state',async()=>{
 const limit=jest.spyOn(models,'getContextLimit').mockReturnValue(50000);
 jest.mocked(retrieveDossierTurnContext).mockResolvedValueOnce({context:'OPTIONAL_RAG_SENTINEL'+'.'.repeat(200000),clueRecordIds:[],handoutLocatorIds:[]});
 try {
  const request={headers:{get:(name:string)=>name==='X-Gemini-Api-Key'?'synthetic-test-key':null}} as unknown as NextRequest;
  await runChatPipeline({request,traceId:'trim',timer:{elapsed:()=>0},body:{message:'Badam pomieszczenie.',pdfMemory:{adventureDossierFingerprint:fingerprint},dossierWorldState:{playthroughId:scope.playthroughId,adventureId:scope.adventureId,editionFingerprint:fingerprint,objects:[{entityId:'obj-generator',state:'preparing'}]},memoryScope:scope,assistantMessageId:'trim-turn',adventureContext:{id:scope.adventureId,yearRange:'1973-1974',country:'Polska'},currentLocation:'niskiej',gameTime:{year:1973,month:9,day:19,hour:3,minute:0},aiSettings:{...defaultAISettings,imageGenerationEnabled:false},messages:[],characters:[],npcs:[],locale:'pl'}});
  const provider=jest.mocked(GeminiChatProvider).mock.results[0].value;
  const prompt=JSON.stringify(jest.mocked(provider.streamChat).mock.calls);
  expect(prompt).not.toContain('OPTIONAL_RAG_SENTINEL');
  expect(prompt).toContain('KANONICZNA BIEŻĄCA LOKACJA');expect(prompt).toContain('loc-prabuty-krypta');
  expect(prompt).toContain('[AKTUALNY CZAS: 19 Października 1973, 03:00]');
  expect(renderDossierWorldStateSection).toHaveBeenCalledWith(expect.objectContaining({
    activationId: scope.playthroughId, adventureId: scope.adventureId, editionFingerprint: fingerprint,
    locale: 'pl', worldObjectState: expect.objectContaining({ objects: [{ entityId: 'obj-generator', state: 'preparing' }] }),
  }));
  expect(prompt).toContain('MANDATORY_WORLD_STATE_SENTINEL');
 }finally{limit.mockRestore();}
});


test.each([
  ['pl', 'NIEZALICZONY', 'Możliwy skutek nie jest zdarzeniem potwierdzonym'],
  ['en', 'FAILED', 'A possible consequence is not a confirmed event'],
] as const)('passes resolved dossier skill outcome and world state to the narrator: %s', async (locale, expectedResult, expectedGuard) => {
  const request = { headers: { get: (name: string) => name === 'X-Gemini-Api-Key' ? 'synthetic-test-key' : null } } as unknown as NextRequest;
  await runChatPipeline({ request, traceId: 'resolved-skill-context', timer: { elapsed: () => 0 }, body: {
    message: locale === 'en' ? 'I try to disable the generators.' : 'Próbuję wyłączyć generatory.',
    pdfMemory: { adventureDossierFingerprint: fingerprint }, memoryScope: scope, assistantMessageId: 'resolved-roll-turn',
    dossierWorldState: {
      playthroughId: scope.playthroughId, adventureId: scope.adventureId, editionFingerprint: fingerprint,
      objects: [{ entityId: 'obj-generator', state: 'preparing' }, { entityId: 'obj-rift', state: 'latent' }],
    },
    mechanicsContext: { skillRolls: [{
      testId: 'electrical-repair', resolutionId: 'resolved-electrical-repair', skillNames: ['Naprawa elektryczna'],
      requiredDifficulty: 'hard', passedRequirement: false, outcome: 'fail', luckSpent: 0,
    }] },
    adventureContext: { id: scope.adventureId, yearRange: '1973-1974', country: 'Polska' },
    currentLocation: 'loc-prabuty-krypta', gameTime: { year: 1973, month: 9, day: 19, hour: 12, minute: 15 },
    aiSettings: { ...defaultAISettings, imageGenerationEnabled: false }, messages: [], characters: [], npcs: [], locale,
  } });
  const provider = jest.mocked(GeminiChatProvider).mock.results[0].value;
  expect(jest.mocked(provider.streamChat)).toHaveBeenCalledTimes(1);
  const prompt = JSON.stringify(jest.mocked(provider.streamChat).mock.calls);
  expect(prompt).toContain('MANDATORY_WORLD_STATE_SENTINEL');
  expect(prompt).toContain(expectedResult);
  expect(prompt).toContain(expectedGuard);
});

test('explicit off-graph request has no source-local RAG or NPC even if display label equals a source name',async()=>{
 const request={headers:{get:(name:string)=>name==='X-Gemini-Api-Key'?'synthetic-test-key':null}} as unknown as NextRequest;
 await runChatPipeline({request,traceId:'offgraph',timer:{elapsed:()=>0},body:{message:'Telefonuję.',pdfMemory:{adventureDossierFingerprint:fingerprint},memoryScope:scope,assistantMessageId:'offgraph-turn',adventureContext:{id:scope.adventureId,yearRange:'1973-1974',country:'Polska'},currentLocation:'Zawalona Krypta pod Ruinami Kościoła w Prabutach',dossierLocation:{mode:'off_graph',label:'Zawalona Krypta pod Ruinami Kościoła w Prabutach',adventureId:scope.adventureId,playthroughId:scope.playthroughId},aiSettings:{...defaultAISettings,imageGenerationEnabled:false},messages:[],characters:[],npcs:[{id:'npc-local',name:'Local',locationId:'loc-prabuty-krypta',status:'alive'}],locale:'pl'}});
 const retrieval=jest.mocked(retrieveDossierTurnContext).mock.calls.at(-1)![0];expect(retrieval.activeSceneIds).toEqual([]);expect(retrieval.presentEntityIds).toEqual([]);
 const provider=jest.mocked(GeminiChatProvider).mock.results[0].value;expect(JSON.stringify(jest.mocked(provider.streamChat).mock.calls)).toContain('off_graph');
});


test.each(['foreign-adventure','foreign-session','oversized-label'])('rejects invalid explicit off-graph request binding: %s',async mode=>{
 const request={headers:{get:(name:string)=>name==='X-Gemini-Api-Key'?'synthetic-test-key':null}} as unknown as NextRequest;
 const binding={mode:'off_graph',label:mode==='oversized-label'?'x'.repeat(121):'Telefon',adventureId:mode==='foreign-adventure'?'other':scope.adventureId,playthroughId:mode==='foreign-session'?'other':scope.playthroughId};
 await runChatPipeline({request,traceId:'bad-offgraph',timer:{elapsed:()=>0},body:{message:'Telefonuję.',pdfMemory:{adventureDossierFingerprint:fingerprint},memoryScope:scope,assistantMessageId:'bad-turn',adventureContext:{id:scope.adventureId},dossierLocation:binding,aiSettings:defaultAISettings,locale:'pl'}});
 expect(NextResponse.json).toHaveBeenCalledWith({code:'DOSSIER_LOCATION_BINDING_INVALID'},{status:400});expect(GeminiChatProvider).not.toHaveBeenCalled();
});


test('local protocol diagnostic reports initial, retry, sanitized and final counts without prose',async()=>{
 const env=jest.replaceProperty(process,'env',{...process.env,ZEW_LOCAL_PLAYTEST:'prabuty-tomasz'});
 const info=jest.spyOn(console,'info').mockImplementation(()=>{});const warn=jest.spyOn(console,'warn').mockImplementation(()=>{});
 const lint=jest.spyOn(agency,'lintAgencyViolations').mockReturnValue({hasViolation:true,violations:[{type:'movement',matchedSnippet:'PRIVATE_SNIPPET',reason:'PRIVATE_REASON',index:0}],sanitizedText:'[LOKACJA: OFF_GRAPH | PRIVATE_LABEL] [AKTUALNY CZAS: 19 Października 1973, 03:20]'});
 try{
  const request={headers:{get:(name:string)=>name==='X-Gemini-Api-Key'?'synthetic-test-key':null}} as unknown as NextRequest;
  await runChatPipeline({request,traceId:'diagnostic',timer:{elapsed:()=>0},body:{message:'Badam otoczenie.',pdfMemory:{adventureDossierFingerprint:fingerprint},memoryScope:scope,assistantMessageId:'diagnostic-turn',adventureContext:{id:scope.adventureId,yearRange:'1973-1974',country:'Polska'},aiSettings:defaultAISettings,messages:[],characters:[],npcs:[],locale:'pl'}});
  const entries=info.mock.calls.filter(([label])=>label==='[local-dossier-protocol]').map(([,value])=>value);
  expect(entries.map(e=>e.stage)).toEqual(['initial','retry','sanitized','final']);
  expect(entries[0]).toMatchObject({correction:false,violationTypes:['movement'],counts:{locationPl:0,locationEn:0,offGraph:0,time:0}});
  expect(entries.at(-1)).toMatchObject({counts:{locationPl:1,locationEn:0,offGraph:1,time:1}});
  expect(JSON.stringify(entries)).not.toMatch(/PRIVATE_|Gabinet|synthetic-test-key/);
 }finally{lint.mockRestore();info.mockRestore();warn.mockRestore();env.restore();}
});


test.each(['pl','en'] as const)('agency correction preserves declared travel consequences and required markers: %s',async locale=>{
 const lint=jest.spyOn(agency,'lintAgencyViolations').mockReturnValueOnce({hasViolation:true,violations:[{type:'movement',matchedSnippet:'movement',reason:'movement',index:0}],sanitizedText:'Threshold.'}).mockReturnValue({hasViolation:false,violations:[]});
 const warn=jest.spyOn(console,'warn').mockImplementation(()=>{});
 try{
  const declaration=locale==='pl'?'Jadę do strażnicy i zgłaszam zagrożenie.':'I drive to the fire station and report the hazard.';
  const request={headers:{get:(name:string)=>name==='X-Gemini-Api-Key'?'synthetic-test-key':null}} as unknown as NextRequest;
  await runChatPipeline({request,traceId:'declared-travel',timer:{elapsed:()=>0},body:{message:declaration,pdfMemory:{adventureDossierFingerprint:fingerprint},memoryScope:scope,assistantMessageId:'travel-turn',adventureContext:{id:scope.adventureId,yearRange:'1973-1974',country:'Polska'},currentLocation:'niskiej',gameTime:{year:1973,month:9,day:19,hour:3,minute:0},aiSettings:defaultAISettings,messages:[],characters:[],npcs:[],locale}});
  const provider=jest.mocked(GeminiChatProvider).mock.results[0].value;const calls=jest.mocked(provider.streamChat).mock.calls;
  expect(calls).toHaveLength(2);expect(calls[1][0]).toMatchObject({userMessage:declaration});
  const context=JSON.stringify((calls[1][0] as {geminiOptions:{additionalContext:string[]}}).geminiOptions.additionalContext);
  expect(context).toContain('[DECLARED ACTION CONSEQUENCES]');expect(context).toContain('OFF_GRAPH');expect(context).toContain('AKTUALNY CZAS');
  expect(context).toContain(locale==='pl'?'Nie anuluj już zadeklarowanej podróży':'Do not cancel already declared travel');
  expect(context).not.toContain(locale==='pl'?'NIGDY nie poruszaj badaczami':'NEVER move investigators');
 }finally{lint.mockRestore();warn.mockRestore();}
});


test('local explicit withdrawal stages a deterministic ending through the ordinary atomic dossier gate without calling a model',async()=>{
 const {webcrypto}=await import('node:crypto');
 Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});
 const {createAuthoredPrabutyPayload}=await import('@/lib/adventure-dossier/authored-prabuty');
 const {authorizeLocalDraftPayload,fingerprintLocalDraftPayload}=await import('@/lib/adventure-dossier/runtime-authorization');
 const {emptyDossierWorldState,projectDossierWorldState}=await import('@/lib/adventure-dossier/world-object-state');
 const hash=await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload('sha256:'+'0'.repeat(64)));
 const payload=await authorizeLocalDraftPayload(createAuthoredPrabutyPayload(hash),{adventureId:scope.adventureId,editionFingerprint:hash});
 const world=projectDossierWorldState(emptyDossierWorldState({playthroughId:scope.playthroughId,adventureId:scope.adventureId,editionFingerprint:hash},payload));
 jest.mocked(getDossierRagBinding).mockReturnValue({adventureId:scope.adventureId,editionFingerprint:hash});
 const old=process.env.ZEW_LOCAL_PLAYTEST;process.env.ZEW_LOCAL_PLAYTEST='prabuty-tomasz';
 try{
 const request={nextUrl:new URL('http://127.0.0.1:3818/api/chat'),headers:{get:(name:string)=>name==='host'?'127.0.0.1:3818':name==='origin'?'http://127.0.0.1:3818':name==='X-Gemini-Api-Key'?'synthetic-test-key':null}} as unknown as NextRequest;
 await runChatPipeline({request,traceId:'withdrawal',timer:{elapsed:()=>0},body:{
  message:'Odkładam słuchawkę. Decyduję, że na tym kończę tę wyprawę: nie wracam do szybu.',
  gameTime:{year:1973,month:9,day:19,hour:3,minute:55},pdfMemory:{adventureDossierFingerprint:hash},
  currentLocation:'loc-warszawa-redakcja',
  dossierWorldState:world,memoryScope:scope,assistantMessageId:'withdraw-final',userMessageId:'withdraw-user',
  adventureContext:{id:scope.adventureId,yearRange:'1973-1974',country:'Polska'},
  aiSettings:{...defaultAISettings,imageGenerationEnabled:false},messages:[],characters:[],locale:'pl',
 }});
 expect(GeminiChatProvider).not.toHaveBeenCalled();expect(global.fetch).not.toHaveBeenCalled();
 expect(createSseStream).toHaveBeenCalledTimes(1);
 const opts=jest.mocked(createSseStream).mock.calls[0][0];
 expect(opts).toMatchObject({deferDossierFinalization:true,dossierInventoryWritesAllowed:true,
 memoryScope:scope,assistantMessageId:'withdraw-final',userMessageId:'withdraw-user',sessionId:scope.playthroughId,dossierCorrectionAttempt:false});
 let text='';for await(const chunk of opts.providerStream)text+=chunk.text;
 expect(text).toContain('[KONIEC_SESJI:POTWIERDZENIE]');expect(text).not.toContain('[TEST:');
 }finally{if(old===undefined)delete process.env.ZEW_LOCAL_PLAYTEST;else process.env.ZEW_LOCAL_PLAYTEST=old;}
});
