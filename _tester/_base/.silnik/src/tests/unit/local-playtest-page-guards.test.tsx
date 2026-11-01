import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import RootPage from '@/app/page';
import LocalePage from '@/app/[locale]/page';
import { getAdventureById } from '@/lib/adventures-data';
import { hasRequiredKeys } from '@/lib/api-keys-service';

let mockRealChat = false;
let mockRealSave = false;
let mockRealPdf = false;
let mockPdfState: import("@/hooks/usePdfMemory").PdfMemory = {};
let mockChatApi: ReturnType<typeof import('@/hooks/useChat').useChat>;
let mockSaveApi: import('@/hooks/useFullSave').UseFullSaveReturn;

let mockTransport = { serverConfigured: true, serverHasBaseRules: true, loading: false };
const mockStart = jest.fn();
const mockRetryDossierSkillRoll = jest.fn().mockResolvedValue(false);
const mockNoop = jest.fn();
const mockRouter = { replace: jest.fn(), push: jest.fn() };
const mockCharacters: import('@/lib/types').Character[] = [{id:'player',name:'Test player',playerName:'Player',str:50,dex:50,con:50,app:50,pow:50,edu:50,siz:50,int:50,luck:50,hp:10,san:50,mp:10,skills:{},occupation:'Reporter',age:30,background:'',isActive:true,lastUsed:new Date(0),notes:'',equipment:[],experience:{totalXP:0,availableXP:0,earnedThisSession:0,maxEarnedThisSession:10},developmentHistory:[]}];
const mockHooks = {
  useTTS: { setVoiceEnabled: mockNoop, setIsTTSEnabled: mockNoop },
  useCharacterManagement: { characters: mockCharacters, activeCharacter: mockCharacters[0], setCharacters: mockNoop, setActiveCharacter: mockNoop, setActiveGameState: mockNoop },
  usePdfMemory: { pdfMemory: {}, setPdfMemory: mockNoop },
  useChat: { messages: [], pendingDeclarations: [], playersAwaitingDeclaration: [], pendingDossierSkillRollRetry: null as {testIds:string[]}|null, retryDossierSkillRoll:mockRetryDossierSkillRoll },
  useFullSave: {},
  useSkillMarking: {},
  useCustomAdventures: { customAdventures: [] },
  useCutscene: {},
  useFullReset: {},
  useSceneSummary: {},
  useGameStart: { handleStartGame: mockStart },
  useHealthCheck: { runHealthCheck: mockNoop },
};
jest.mock('@/lib/ai-settings', () => ({ ...jest.requireActual('@/lib/ai-settings'), initializeDefaultPrompt: jest.fn().mockResolvedValue(true) }));
jest.mock('@/hooks/useLocalPlaytestTransport', () => ({ useLocalPlaytestTransport: () => mockTransport }));
jest.mock('@/lib/local-playtest-transport', () => ({
  hasLocalPlaytestTransport: () => mockTransport.serverConfigured,
  hasLocalPlaytestRules: () => mockTransport.serverConfigured && mockTransport.serverHasBaseRules,
}));
jest.mock('@/lib/api-keys-service', () => ({ hasRequiredKeys: jest.fn(() => false), getApiKeyHeaders: () => ({}), fetchWithApiKeys: jest.fn() }));
jest.mock('@/i18n/routing', () => ({ useRouter: () => mockRouter, usePathname: () => '/' }));
jest.mock('@/hooks/useRulesStatus', () => ({ useRulesStatus: () => ({ loading: false, hasRules: false }) }));
jest.mock('@/components/ui/player-switcher', () => ({ useHotSeat: () => ({ config: { enabled: false, players: [] } }) }));
jest.mock('@/components/chat/ChatLayout', () => ({ ChatLayout: ({ children, modals }: { children: React.ReactNode; modals: React.ReactNode }) => <>{modals}{children}</> }));
jest.mock('@/components/chat/welcome/hooks/use-typewriter-sound', () => ({ useTypewriterSound: () => ({ displayedText: '', isTyping: false }) }));
jest.mock('next/dynamic', () => (loader: () => unknown) => {
  const name = String(loader);
  if (name.includes('ChatWindow')) {
    const { WelcomeScreen } = jest.requireActual('@/components/chat/welcome');
    return function MockChat(props: React.ComponentProps<typeof WelcomeScreen> & {messages?: import('@/lib/types').Message[]; adventureContext?: import('@/lib/types').AdventureContext; currentLocation?: string; hasStartedGame?: boolean; pendingDossierSkillRollRetry?:{testIds:string[]}|null; retryDossierSkillRoll?:()=>Promise<boolean>}) {
      const { renderHandout } = jest.requireActual('@/components/chat/narrative/render-handout');
      return <><pre data-testid="page-pending-skill-retry">{JSON.stringify(props.pendingDossierSkillRollRetry)}</pre><button onClick={()=>{void props.retryDossierSkillRoll?.();}}>invoke-saved-skill-retry</button><span data-testid="page-adventure">{props.adventureContext?.title}</span>{props.messages?.flatMap((message: import('@/lib/types').Message, index: number) => message.dossierHandoutRecordIds?.map((recordId: string) => renderHandout({type:'handout',content:'',handoutSlug:recordId},index,props.adventureContext,message.dossierHandoutRecordIds,message.dossierHandoutBinding)) ?? [])}<pre data-testid="page-messages">{JSON.stringify(props.messages)}</pre><span data-testid="page-location">{props.currentLocation}</span>{props.hasStartedGame ? <div data-testid="page-playing" /> : <WelcomeScreen {...props} />}<button onClick={props.onStartGame}>invoke-page-start</button></>;
    };
  }
  if (name.includes('ApiKeysModal')) return function Keys({ open }: { open: boolean }) { return open ? <div data-testid="page-api-modal" /> : null; };
  if (name.includes('rulebook-onboarding-modal')) return function Rules({ open }: { open: boolean }) { return open ? <div data-testid="page-rules-modal" /> : null; };
  return () => null;
});
jest.mock('@/components/chat/narrative/runtime-dossier-handout', () => ({RuntimeDossierHandout: ({recordId}: {recordId:string}) => <span data-testid="restored-dossier-photo">{recordId}</span>}));
jest.mock('@/hooks/useTTS', () => ({ useTTS: () => mockHooks.useTTS }));
jest.mock('@/hooks/useCharacterManagement', () => ({ useCharacterManagement: () => mockHooks.useCharacterManagement }));
jest.mock('@/hooks/usePdfMemory', () => ({ ...jest.requireActual('@/hooks/usePdfMemory'), usePdfMemory: (options: unknown) => { if (!mockRealPdf) return mockHooks.usePdfMemory; const result = jest.requireActual('@/hooks/usePdfMemory').usePdfMemory(options); mockPdfState=result.pdfMemory; return result; } }));
jest.mock('@/hooks/useChat', () => ({ useChat: (options: unknown) => {if(!mockRealChat)return mockHooks.useChat;mockChatApi=jest.requireActual('@/hooks/useChat').useChat(options);return mockChatApi;} }));
jest.mock('@/hooks/useFullSave', () => ({ useFullSave: (options: unknown) => { if (!mockRealSave) return mockHooks.useFullSave; mockSaveApi = jest.requireActual('@/hooks/useFullSave').useFullSave(options); return mockSaveApi; } }));
jest.mock('@/hooks/useSkillMarking', () => ({ useSkillMarking: () => mockHooks.useSkillMarking }));
jest.mock('@/hooks/useCustomAdventures', () => ({ useCustomAdventures: () => mockHooks.useCustomAdventures }));
jest.mock('@/hooks/useCutscene', () => ({ useCutscene: () => mockHooks.useCutscene }));
jest.mock('@/hooks/useFullReset', () => ({ useFullReset: () => mockHooks.useFullReset }));
jest.mock('@/hooks/useSceneSummary', () => ({ useSceneSummary: () => mockHooks.useSceneSummary }));
jest.mock('@/hooks/useGameStart', () => ({ useGameStart: () => mockHooks.useGameStart }));
jest.mock('@/hooks/useHealthCheck', () => ({ useHealthCheck: () => mockHooks.useHealthCheck }));
jest.mock('@/components/sidebar/CthulhuSidebar', () => ({ CthulhuSidebar: () => null }));
jest.mock('@/components/ui/api-usage-counter', () => ({ APIUsageCounter: () => null }));
jest.mock('@/components/ui/hot-seat-setup', () => ({ HotSeatSetup: () => null }));
jest.mock('@/components/ui/cutscene-player', () => ({ CutscenePlayer: () => null }));
jest.mock('@/components/ui/character-wizard', () => ({ CharacterWizardV2: () => null }));
jest.mock('@/components/onboarding/language-selection-modal', () => ({ LanguageSelectionModal: () => null }));

describe('actual root and locale page auth guards', () => {
  beforeEach(() => {
    jest.clearAllMocks(); localStorage.clear(); mockRealChat = false;
    localStorage.setItem('language_selected', 'pl');
    localStorage.setItem('straznik_beta_welcome_dismissed', 'true');
    localStorage.setItem('adventure_context', JSON.stringify(getAdventureById('cien-nad-prabutami')));
    mockTransport = { serverConfigured: true, serverHasBaseRules: true, loading: false };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  });
  afterEach(() => { cleanup(); delete process.env.NEXT_INTL_TEST_LOCALE; });
  it.each([
    ['root', RootPage, 'pl'], ['locale PL', LocalePage, 'pl'], ['locale EN', LocalePage, 'en'],
  ] as const)('%s renders modes and passes the actual start callback without client credentials', (_name, Page, locale) => {
    process.env.NEXT_INTL_TEST_LOCALE = locale;
    render(<Page />);
    expect(screen.getByTestId('btn-manual-setup')).toHaveTextContent(locale === 'en' ? 'Manual Setup' : 'Ustawienia Ręczne');
    expect(screen.queryByTestId('page-api-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('page-rules-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('invoke-page-start'));
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(hasRequiredKeys()).toBe(false);
    expect(localStorage.getItem('zew-app-api-keys')).toBeNull();
    expect(localStorage.getItem('rules_onboarding_completed')).toBeNull();
  });
  it.each([['root', RootPage], ['locale', LocalePage]] as const)('%s blocks start without the local transport handshake', (_name, Page) => {
    mockTransport.serverConfigured = false;
    render(<Page />);
    expect(screen.getByTestId('page-api-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('invoke-page-start'));
    expect(mockStart).not.toHaveBeenCalled();
  });
  it.each([['root', RootPage], ['locale', LocalePage]] as const)('%s waits for handshake completion before opening a credentials modal', (_name, Page) => {
    mockTransport = { serverConfigured: false, serverHasBaseRules: false, loading: true };
    const { rerender } = render(<Page />);
    expect(screen.queryByTestId('page-api-modal')).not.toBeInTheDocument();
    mockTransport = { serverConfigured: true, serverHasBaseRules: true, loading: false };
    rerender(<Page />);
    expect(screen.queryByTestId('page-api-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('page-rules-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('btn-manual-setup')).toBeVisible();
  });
  it('keeps the locale rules onboarding and start block when no server base rules are confirmed', () => {
    mockTransport.serverHasBaseRules = false;
    render(<LocalePage />);
    expect(screen.queryByTestId('btn-manual-setup')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('invoke-page-start'));
    expect(mockStart).not.toHaveBeenCalled();
  });
});

describe('real page + useChat F5 persistence', () => {
  afterEach(() => { cleanup(); mockRealChat = false; localStorage.clear(); delete process.env.NEXT_INTL_TEST_LOCALE; });
  it.each([['root',RootPage,'pl',false],['locale PL',LocalePage,'pl',false],['locale EN',LocalePage,'en',false],['root legacy fallback',RootPage,'pl',true],['locale legacy fallback',LocalePage,'pl',true]] as const)('%s retains canonical game time, media and tests over degraded legacy wall-clock history',(_name,Page,locale,legacyOnly)=>{
    localStorage.clear();mockRealChat=true;process.env.NEXT_INTL_TEST_LOCALE=locale;
    mockTransport={serverConfigured:true,serverHasBaseRules:true,loading:false};
    localStorage.setItem('language_selected',locale);localStorage.setItem('straznik_beta_welcome_dismissed','true');
    const canonical={id:'canonical',role:'assistant',content:'Scena. [LOKACJA: Prabuty - cmentarz]',timestamp:'2026-10-20T15:09:00Z',gameTime:{year:1973,month:9,day:19,hour:23,minute:55},generatedImages:['/handouts/cien-nad-prabutami/playtest/newsroom-1973.png'],skillTests:[{id:'check',skillName:'Spostrzegawczość'}]};
    if(!legacyOnly) localStorage.setItem('zew_chat_messages',JSON.stringify([canonical]));
    localStorage.setItem('chat-messages',JSON.stringify([legacyOnly ? canonical : {id:canonical.id,role:canonical.role,content:canonical.content,timestamp:canonical.timestamp}]));
    localStorage.setItem('adventure_context',JSON.stringify(getAdventureById('cien-nad-prabutami')));
    global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({})});
    render(<Page/>);
    const visible=JSON.parse(screen.getByTestId('page-messages').textContent!)[0];
    expect(visible.gameTime).toEqual(canonical.gameTime);
    expect(visible.generatedImages).toEqual(canonical.generatedImages);
    expect(visible.skillTests).toEqual(canonical.skillTests);
    expect(screen.getByTestId('page-location')).toHaveTextContent('Prabuty - cmentarz');
    expect(JSON.parse(localStorage.getItem('zew_chat_messages')!)[0].gameTime).toEqual(canonical.gameTime);
    expect(localStorage.getItem('chat-messages')).not.toBeNull();
  });
});


describe('manual full save resumes the actual page and survives F5', () => {
  afterEach(() => { cleanup(); mockRealChat=false; mockRealSave=false; localStorage.clear(); delete process.env.NEXT_INTL_TEST_LOCALE; });
  it.each([['root',RootPage,'pl'],['locale PL',LocalePage,'pl'],['locale EN',LocalePage,'en']] as const)('%s leaves welcome only after a successful saved session restore', async (_name, Page, locale) => {
    const {FullGameSaveManager}=await import('@/lib/full-game-save-manager');
    const {defaultAISettings}=await import('@/lib/ai-settings/defaults');
    localStorage.clear();mockRealChat=true;mockRealSave=true;process.env.NEXT_INTL_TEST_LOCALE=locale;
    mockTransport={serverConfigured:true,serverHasBaseRules:true,loading:false};
    localStorage.setItem('language_selected',locale);localStorage.setItem('straznik_beta_welcome_dismissed','true');
    const scope={schemaVersion:1,campaignDefinitionId:'scenario:test',playthroughId:'restored-manual',adventureId:'test',kind:'scenario'};
    global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({scope})});
    const save=FullGameSaveManager.createFullSave({name:'Manual opening',userId:'local',locale,
      messages:[{id:'opening',role:'assistant',content:'Saved scene. [LOCATION: Office]',timestamp:new Date(),gameTime:{year:1973,month:9,day:18,hour:19,minute:30}}],
      activeCharacterId:'player',characters:mockCharacters,campaigns:[],npcs:[],locations:[],gameSettings:{aiSettings:defaultAISettings}});
    let mounted=render(<Page/>);
    expect(screen.queryByTestId('page-playing')).not.toBeInTheDocument();
    expect(localStorage.getItem('has_started_game')).toBeNull();
    await act(async()=>{expect(await mockSaveApi.handleLoadFullSave(save)).toBe(true);});
    expect(screen.getByTestId('page-playing')).toBeInTheDocument();
    expect(localStorage.getItem('has_started_game')).toBe('true');
    expect(JSON.parse(localStorage.getItem('zew_chat_messages')!)[0].id).toBe('opening');
    mounted.unmount();mounted=render(<Page/>);
    expect(screen.getByTestId('page-playing')).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('page-messages').textContent!)[0].gameTime).toEqual(save.messages[0].gameTime);
    expect(localStorage.getItem('zew-app-api-keys')).toBeNull();
    expect(localStorage.getItem('rules_onboarding_completed')).toBeNull();
  });
});


describe('fresh profile restores the saved adventure before its dossier edition', () => {
  afterEach(() => {cleanup();mockRealChat=false;mockRealSave=false;mockRealPdf=false;localStorage.clear();delete process.env.NEXT_INTL_TEST_LOCALE;});
  it.each([['root',RootPage,'pl'],['locale PL',LocalePage,'pl'],['locale EN',LocalePage,'en']] as const)('%s preserves exact adventure title, acquired handout and edition on load and F5', async (_name,Page,locale)=>{
    const {FullGameSaveManager}=await import('@/lib/full-game-save-manager');
    const {defaultAISettings}=await import('@/lib/ai-settings/defaults');
    localStorage.clear();mockRealChat=true;mockRealSave=true;mockRealPdf=true;process.env.NEXT_INTL_TEST_LOCALE=locale;
    mockTransport={serverConfigured:true,serverHasBaseRules:true,loading:false};
    localStorage.setItem('language_selected',locale);localStorage.setItem('straznik_beta_welcome_dismissed','true');
    const adventureId='cien-nad-prabutami';const fingerprint=`sha256:${'a'.repeat(64)}`;
    const scope={schemaVersion:1 as const,campaignDefinitionId:`scenario:${adventureId}`,playthroughId:'saved-opening',adventureId,kind:'scenario' as const};
    const recordId='prabuty.media.clue-photo-prabuty-1947';
    const pdfMemory={adventureId,adventureDossierFingerprint:fingerprint,adventureDossierStatus:'ready' as const};
    global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({scope:{...scope,playthroughId:'restored-opening'}})});
    const save=FullGameSaveManager.createFullSave({name:'Saved opening',userId:'local',locale,campaignMemory:scope,pdfMemory,
      messages:[{id:'opening',role:'assistant',content:`[HANDOUT: ${recordId}]`,timestamp:new Date(),gameTime:{year:1973,month:9,day:18,hour:19,minute:30},dossierHandoutRecordIds:[recordId],dossierHandoutBinding:{adventureId,editionFingerprint:fingerprint}}],
      activeCharacterId:'player',characters:mockCharacters,campaigns:[],npcs:[],locations:[],gameSettings:{aiSettings:defaultAISettings}});
    let mounted=render(<Page/>);
    expect(localStorage.getItem('adventure_context')).toBeNull();
    await act(async()=>{expect(await mockSaveApi.handleLoadFullSave(JSON.parse(JSON.stringify(save)))).toBe(true);});
    for(let round=0;round<2;round++){
      expect(screen.getByTestId('page-adventure')).toHaveTextContent(getAdventureById(adventureId)!.title);
      expect(screen.getByTestId('restored-dossier-photo')).toHaveTextContent(recordId);
      expect(mockPdfState).toMatchObject(pdfMemory);
      expect(JSON.parse(localStorage.getItem('adventure_context')!).id).toBe(adventureId);
      expect(JSON.parse(localStorage.getItem('pdf_memory')!)).toMatchObject(pdfMemory);
      expect(screen.getByTestId('page-playing')).toBeInTheDocument();
      if(round===0){mounted.unmount();await act(async()=>{mounted=render(<Page/>);});}
    }
    expect(localStorage.getItem('zew-app-api-keys')).toBeNull();expect(localStorage.getItem('rules_onboarding_completed')).toBeNull();
  });
});


describe('fresh full save first declaration activates the forked NPC session',()=>{
 afterEach(()=>{cleanup();mockRealChat=false;mockRealSave=false;mockRealPdf=false;localStorage.clear();jest.restoreAllMocks();});
 it.each([['root',RootPage,false],['locale',LocalePage,false],['foreign canonical NPC',RootPage,true]] as const)('%s keeps the actor scope boundary on first send after actual activation',async(_name,Page,foreign)=>{
  const {TextEncoder}=await import('node:util');const {webcrypto}=await import('node:crypto');
  Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});
  const {createAuthoredPrabutyPayload}=await import('@/lib/adventure-dossier/authored-prabuty');
  const {fingerprintLocalDraftPayload,authorizeLocalDraftPayload}=await import('@/lib/adventure-dossier/runtime-authorization');
  const {initializeDossierActors}=await import('@/lib/adventure-dossier/actor-initialization');
  const {FullGameSaveManager}=await import('@/lib/full-game-save-manager');const {defaultAISettings}=await import('@/lib/ai-settings/defaults');
  const {fetchWithApiKeys}=await import('@/lib/api-keys-service');
  const fingerprint=await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload(`sha256:${'0'.repeat(64)}`));
  const adventureId='cien-nad-prabutami';const payload=await authorizeLocalDraftPayload(createAuthoredPrabutyPayload(fingerprint),{adventureId,editionFingerprint:fingerprint});
  localStorage.clear();jest.clearAllMocks();mockRealChat=true;mockRealSave=true;mockRealPdf=true;
  mockTransport={serverConfigured:true,serverHasBaseRules:true,loading:false};
  const savedScope={schemaVersion:1 as const,campaignDefinitionId:`scenario:${adventureId}`,playthroughId:'original-session',adventureId,kind:'scenario' as const};
  const restoredScope={...savedScope,playthroughId:'forked-session'};
  initializeDossierActors({payload,sessionId:savedScope.playthroughId,adventureId,editionFingerprint:fingerprint,now:new Date(0),storage:localStorage});
  const npcs=JSON.parse(localStorage.getItem('gm_npcs')!);npcs[0]={...npcs[0],...(foreign?{sessionId:'foreign-session'}:{}),status:'dead',location:'Played location',statusEffects:[],hp:0,customPlayedFact:'kept'};
  const save=FullGameSaveManager.createFullSave({name:'Played opening',userId:'local',campaignMemory:savedScope,
   pdfMemory:{adventureId,adventureDossierFingerprint:fingerprint,adventureDossierStatus:'ready'},
   messages:[{id:'opening',role:'assistant',content:'[LOKACJA: loc-warszawa-redakcja]',timestamp:new Date(),gameTime:{year:1973,month:9,day:18,hour:19,minute:30}}],
   activeCharacterId:'player',characters:mockCharacters,campaigns:[],npcs,locations:[],gameSettings:{aiSettings:defaultAISettings}});
  localStorage.clear();localStorage.setItem('language_selected','pl');localStorage.setItem('straznik_beta_welcome_dismissed','true');
  global.fetch=jest.fn(async(input,init)=>{
   const url=String(input);
   if(url==='/api/memory/restore')return {ok:true,status:200,json:async()=>({scope:restoredScope})} as Response;
   if(url.startsWith('/api/adventure-dossier/playtest'))return {ok:true,status:200,json:async()=>init?.method==='POST'?{activated:true}:{mode:'local_playtest',humanApproval:'pending',adventureId,editionFingerprint:fingerprint,payload}} as Response;
   if(url.startsWith('/api/adventure-dossier/activate?'))return {ok:true,status:200,json:async()=>({activated:false})} as Response;
   return {ok:true,status:200,json:async()=>({})} as Response;
  });
  jest.mocked(fetchWithApiKeys).mockResolvedValue({ok:false,status:503,json:async()=>({error:'Synthetic transport stop after activation'})} as Response);
  render(<Page/>);await act(async()=>{expect(await mockSaveApi.handleLoadFullSave(JSON.parse(JSON.stringify(save)))).toBe(true);});
  await act(async()=>{await mockChatApi.handleSendMessage('Oglądam okno.');});
  if(foreign){
   expect(fetchWithApiKeys).not.toHaveBeenCalled();
   expect(JSON.parse(localStorage.getItem('gm_npcs')!)[0]).toEqual(npcs[0]);
   return;
  }
  expect(fetchWithApiKeys).toHaveBeenCalledWith('/api/chat',expect.anything());
  expect(jest.mocked(fetch).mock.calls.some(([url,init])=>url==='/api/adventure-dossier/playtest'&&init?.method==='POST')).toBe(true);
  const restored=JSON.parse(localStorage.getItem('gm_npcs')!);
  expect(restored).toEqual(npcs.map((npc:import('@/lib/types').NPC)=>({...npc,sessionId:restoredScope.playthroughId})));
  const archive=JSON.parse(localStorage.getItem('dossier_npcs_session:forked-session')!);
  expect(archive).toMatchObject({sessionId:restoredScope.playthroughId,adventureId,editionFingerprint:fingerprint,npcs:restored});
  expect(save.npcs[0].sessionId).toBe(savedScope.playthroughId);
 });
});


describe('both pages forward the exact pending typed roll retry contract',()=>{
 afterEach(()=>{cleanup();mockHooks.useChat.pendingDossierSkillRollRetry=null;localStorage.clear();});
 it.each([['root',RootPage],['locale',LocalePage]] as const)('%s forwards pending IDs and only the retry callback',(_name,Page)=>{
  jest.clearAllMocks();mockRealChat=false;mockRealSave=false;mockRealPdf=false;localStorage.clear();
  mockTransport={serverConfigured:true,serverHasBaseRules:true,loading:false};
  localStorage.setItem('language_selected','pl');localStorage.setItem('straznik_beta_welcome_dismissed','true');
  mockHooks.useChat.pendingDossierSkillRollRetry={testIds:['dex-test']};
  global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({})});
  render(<Page/>);
  expect(JSON.parse(screen.getByTestId('page-pending-skill-retry').textContent!)).toEqual({testIds:['dex-test']});
  fireEvent.click(screen.getByRole('button',{name:'invoke-saved-skill-retry'}));expect(mockRetryDossierSkillRoll).toHaveBeenCalledTimes(1);
 });
});
