import { act, renderHook } from '@testing-library/react';
import { useFullSave } from './useFullSave';
import { FullGameSaveManager } from '@/lib/full-game-save-manager';
import { defaultAISettings } from '@/lib/ai-settings/defaults';
import { persistCharacters } from '@/lib/character-cloud-sync';
import type { Message, Character } from '@/lib/types';
import { resolveEraContext } from '@/lib/era';
import type { WorldSetupBundleV1 } from '@/lib/world-setup';
import { toast } from '@/components/ui/use-toast';

const restoredScope = { schemaVersion: 1, campaignDefinitionId: 'scenario:test',
  playthroughId: 'run-restored', adventureId: 'test', kind: 'scenario' };

jest.mock('@/lib/character-cloud-sync', () => ({
  persistCharacters: jest.fn(),
}));

jest.mock('@/components/ui/use-toast', () => ({
  toast: jest.fn(),
}));

describe('useFullSave - status urwanej narracji', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.alert = jest.fn();
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: jest.fn(() => 'restore-request') });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ scope: restoredScope }) });
  });

  it('odtwarza finishReason i continuationRequested podczas pełnego loadu', async () => {
    const setMessages = jest.fn();
    const save = FullGameSaveManager.createFullSave({
      name: 'Partial',
      userId: 'local',
      messages: [
        {
          id: 'assistant-partial',
          role: 'assistant',
          content: 'Urwany fragment',
          timestamp: new Date('2026-08-23T12:00:00.000Z'),
          finishReason: 'MAX_TOKENS',
          continuationRequested: false,
        },
      ],
      gameSettings: { aiSettings: defaultAISettings },
      characters: [],
      campaigns: [],
      npcs: [],
      locations: [],
    });

    const { result } = renderHook(() =>
      useFullSave({
        setMessages,
        setCharacters: jest.fn(),
        setActiveCharacter: jest.fn(),
        setCampaigns: jest.fn(),
        setPdfMemory: jest.fn(),
        setActiveGameState: jest.fn(),
        setAiSettings: jest.fn(),
        stopCurrentAudio: jest.fn(),
      })
    );

    await act(async () => { await result.current.handleLoadFullSave(save); });

    expect(setMessages).toHaveBeenCalledTimes(1);
    const loaded = setMessages.mock.calls[0][0] as Message[];
    expect(loaded[0]).toMatchObject({
      id: 'assistant-partial',
      role: 'assistant',
      content: 'Urwany fragment',
      finishReason: 'MAX_TOKENS',
      continuationRequested: false,
    });
    expect(loaded[0].timestamp).toBeInstanceOf(Date);
    expect(persistCharacters).toHaveBeenCalledWith([]);
  });

  it('preserves the existing pending dossier check and typed media across a JSON save/load roundtrip', async () => {
    const setMessages = jest.fn();
    const check: import('@/lib/parsers/types').SkillTestData = {id:'repair',characterId:'pc',skillName:'Naprawa elektryczna',skillValue:40,difficulty:'trudny',modifiers:[],justification:'Generator',dossierConditionId:'prabuty-disable-active'};
    const message: Message = {
      id:'pending-check', role:'assistant', content:'[LOKACJA: Prabuty - cmentarz]', timestamp:new Date('2026-10-20T15:09:00Z'),
      gameTime:{year:1973,month:9,day:19,hour:23,minute:55},
      skillTests:[check],
      generatedImages:['/handouts/cien-nad-prabutami/playtest/newsroom-1973.png'],generatedImageTypes:['scene'],generatedImageCacheIds:['cached-scene'],
    };
    const scope={schemaVersion:1 as const,campaignDefinitionId:'scenario:prabuty',kind:'scenario' as const,playthroughId:'roll-save',adventureId:'cien-nad-prabutami'};
    const restoredRollScope={...scope,playthroughId:'roll-restored'};
    jest.mocked(fetch).mockResolvedValue({ok:true,json:async()=>({scope:restoredRollScope})} as Response);
    const rolled:Message={id:'rolled',role:'user',content:'Rzut 17.',timestamp:new Date(),mechanicsContext:{skillRollScope:{playthroughId:scope.playthroughId,adventureId:scope.adventureId},skillRolls:[{testId:check.id,resolutionId:'real-roll-17',characterId:'pc',skillNames:[check.skillName],requiredDifficulty:'hard',passedRequirement:true,outcome:'hard',luckSpent:0}]}};
    const save=FullGameSaveManager.createFullSave({name:'Pending repair',userId:'local',campaignMemory:scope,messages:[message,rolled,{...rolled,id:'foreign-roll',mechanicsContext:{...rolled.mechanicsContext,skillRollScope:{playthroughId:'foreign',adventureId:scope.adventureId}}}],gameSettings:{aiSettings:defaultAISettings},characters:[],campaigns:[],npcs:[],locations:[]});
    const {result}=renderHook(()=>useFullSave({setMessages,setCharacters:jest.fn(),setActiveCharacter:jest.fn(),setCampaigns:jest.fn(),setPdfMemory:jest.fn(),setActiveGameState:jest.fn(),setAiSettings:jest.fn(),stopCurrentAudio:jest.fn()}));
    await act(async()=>{expect(await result.current.handleLoadFullSave(JSON.parse(JSON.stringify(save)))).toBe(true);});
    const restored=setMessages.mock.calls[0][0][0] as Message;
    expect(restored.skillTests).toEqual(message.skillTests);
    expect(restored.generatedImageTypes).toEqual(message.generatedImageTypes);
    expect(restored.generatedImageCacheIds).toEqual(message.generatedImageCacheIds);
    expect(restored.gameTime).toEqual(message.gameTime);
    expect(setMessages.mock.calls[0][0][1].mechanicsContext).toEqual({...rolled.mechanicsContext,skillRollScope:{playthroughId:restoredRollScope.playthroughId,adventureId:scope.adventureId}});
    expect(setMessages.mock.calls[0][0][2].mechanicsContext.skillRollScope.playthroughId).toBe('foreign');
    const {completedSkillTestsFromHistory}=await import('@/components/chat/chat-window/utils/completed-skill-tests');
    const {loadCampaignMemoryScope}=await import('@/core/memory/campaign-scope');
    expect(completedSkillTestsFromHistory(setMessages.mock.calls[0][0],loadCampaignMemoryScope()).has(check.id)).toBe(true);

  });

  it('odtwarza worldSetup do kanonicznego magazynu klienta', async () => {
    const worldSetup: WorldSetupBundleV1 = {
      schemaVersion: 1,
      id: 'world-save',
      scenarioId: 'scenario',
      adventureTitle: 'Przygoda',
      createdAt: '2026-09-01T10:00:00.000Z',
      canonRevision: 1,
      eraContext: resolveEraContext({
        userSelection: { year: 1973, country: 'Polska' },
      }),
      eraManifestId: 'pl-1973-1974',
      adventureGraph: {},
      factions: [],
      npcs: [],
      locations: [],
      items: [],
      events: [],
      openingScene: {},
      nearestBranches: [],
      adventureContent: 'Treść',
      supplementalInformation: [],
      sources: [],
      knowledgeGaps: [],
      exceptions: [],
      phaseResults: [],
    };
    const save = FullGameSaveManager.createFullSave({
      name: 'World',
      userId: 'local',
      messages: [],
      gameSettings: { aiSettings: defaultAISettings },
      worldSetup,
      characters: [],
      campaigns: [],
      npcs: [],
      locations: [],
    });
    const { result } = renderHook(() =>
      useFullSave({
        setMessages: jest.fn(),
        setCharacters: jest.fn(),
        setActiveCharacter: jest.fn(),
        setCampaigns: jest.fn(),
        setPdfMemory: jest.fn(),
        setActiveGameState: jest.fn(),
        setAiSettings: jest.fn(),
        stopCurrentAudio: jest.fn(),
      })
    );

    await act(async () => { await result.current.handleLoadFullSave(save); });

    expect(JSON.parse(localStorage.getItem('world_setup_v1') || '{}')).toMatchObject({
      id: 'world-save',
      eraContext: { effectiveYear: 1973, countryCode: 'PL' },
    });
  });

  it('migrates characters to ensure valid investigatorDossier and triggers toast instead of alert', async () => {
    const setCharacters = jest.fn();
    const character: Partial<Character> = {
      id: 'char-legacy',
      name: 'Dr Harvey',
      chronicleSession: { playthroughId: 'run-restored', campaignDefinitionId: 'scenario:test', adventureId: 'test', sessionId: 'session-2', sessionNumber: 2, closedByMessageId: 'end' },
      journal: [
        {
          id: 'note-1',
          title: 'Notatka o rytuale',
          content: 'Zapiski w starym tomie',
          type: 'clue',
          tags: ['okultyzm'],
          isBookmarked: false,
          timestamp: new Date(),
        },
      ],
    };

    const save = FullGameSaveManager.createFullSave({
      name: 'Legacy Dossier Save',
      userId: 'local',
      messages: [],
      gameSettings: { aiSettings: defaultAISettings },
      characters: [character as Character],
      campaigns: [],
      npcs: [],
      locations: [],
    });

    const { result } = renderHook(() =>
      useFullSave({
        setMessages: jest.fn(),
        setCharacters,
        setActiveCharacter: jest.fn(),
        setCampaigns: jest.fn(),
        setPdfMemory: jest.fn(),
        setActiveGameState: jest.fn(),
        setAiSettings: jest.fn(),
        stopCurrentAudio: jest.fn(),
      })
    );

    await act(async () => { await result.current.handleLoadFullSave(save); });

    expect(setCharacters).toHaveBeenCalledTimes(1);
    const loadedChars = setCharacters.mock.calls[0][0] as Character[];
    expect(loadedChars[0].investigatorDossier).toBeDefined();
    expect(loadedChars[0].chronicleSession).toEqual(character.chronicleSession);
    expect(loadedChars[0].investigatorDossier?.clues).toHaveLength(1);
    expect(loadedChars[0].investigatorDossier?.clues[0].title).toBe('Notatka o rytuale');

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Wczytano: Legacy Dossier Save',
      })
    );
  });

  it('keeps existing state while restoring and after failure; retries with the same request', async () => {
    const options = { setMessages: jest.fn(), setCharacters: jest.fn(), setActiveCharacter: jest.fn(),
      setCampaigns: jest.fn(), setPdfMemory: jest.fn(), setActiveGameState: jest.fn(),
      setAiSettings: jest.fn(), stopCurrentAudio: jest.fn(), clearDeclarations: jest.fn() };
    const save = FullGameSaveManager.createFullSave({ name: 'Earlier', userId: 'local', messages: [],
      gameSettings: { aiSettings: defaultAISettings }, characters: [], campaigns: [], npcs: [], locations: [] });
    localStorage.setItem('gm_npcs', '["future"]');
    localStorage.setItem('gm_locations', '["future"]');
    let resolve!: (value: unknown) => void;
    (fetch as jest.Mock).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const { result } = renderHook(() => useFullSave(options));
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.handleLoadFullSave(save); });
    expect(options.setMessages).not.toHaveBeenCalled();
    await act(async () => { resolve({ ok: false, json: async () => ({ error: 'Disk error' }) }); expect(await pending).toBe(false); });
    for (const setter of Object.values(options)) expect(setter).not.toHaveBeenCalled();
    expect(localStorage.getItem('gm_npcs')).toBe('["future"]');
    await act(async () => { expect(await result.current.handleLoadFullSave(save)).toBe(true); });
    const requests = (fetch as jest.Mock).mock.calls.map((call) => JSON.parse(call[1].body));
    expect(requests[0].requestId).toBe(requests[1].requestId);
    expect(options.setAiSettings).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'run-restored' }));
    expect(localStorage.getItem('gm_npcs')).toBe('[]');
    expect(localStorage.getItem('gm_locations')).toBe('[]');
    expect(JSON.parse(localStorage.getItem('zew-campaign-memory-scope')!)).toEqual(restoredScope);
  });

  describe('saved session lifecycle', () => {
    const savedCharacter:Character={id:'pc',name:'Test player',playerName:'Player',str:50,dex:50,con:50,app:50,pow:50,edu:50,siz:50,int:50,luck:50,hp:10,san:50,mp:10,skills:{},occupation:'Reporter',age:30,background:'',isActive:true,lastUsed:new Date(0),notes:'',equipment:[],experience:{totalXP:0,availableXP:0,earnedThisSession:0,maxEarnedThisSession:10},developmentHistory:[]};
    const options = () => ({setMessages:jest.fn(),setHasStartedGame:jest.fn(),setCharacters:jest.fn(),setActiveCharacter:jest.fn(),setCampaigns:jest.fn(),setPdfMemory:jest.fn(),setActiveGameState:jest.fn(),setAiSettings:jest.fn(),stopCurrentAudio:jest.fn()});
    it.each(['missing-active-character','empty-history'] as const)('keeps setup-only save at welcome: %s',async kind=>{
      const opts=options();localStorage.setItem('has_started_game','true');
      const save=FullGameSaveManager.createFullSave({name:'Setup',userId:'local',messages:kind==='empty-history'?[]:[{id:'msg',role:'assistant',content:'A scene',timestamp:new Date()}],characters:kind==='empty-history'?[savedCharacter]:[],activeCharacterId:'pc',campaigns:[],npcs:[],locations:[],gameSettings:{aiSettings:defaultAISettings}});
      const {result}=renderHook(()=>useFullSave(opts));
      await act(async()=>{expect(await result.current.handleLoadFullSave(save)).toBe(true);});
      expect(opts.setHasStartedGame).toHaveBeenCalledWith(false);
      expect(localStorage.getItem('has_started_game')).toBe('false');
    });
    it('does not mark a failed restore as started and leaves the existing lifecycle unchanged',async()=>{
      const opts=options();localStorage.setItem('has_started_game','false');
      const save=FullGameSaveManager.createFullSave({name:'Failed',userId:'local',messages:[],characters:[],campaigns:[],npcs:[],locations:[],gameSettings:{aiSettings:defaultAISettings}});
      jest.mocked(fetch).mockResolvedValueOnce({ok:false,json:async()=>({error:'restore failed'})} as Response);
      const {result}=renderHook(()=>useFullSave(opts));
      await act(async()=>{expect(await result.current.handleLoadFullSave(save)).toBe(false);});
      expect(opts.setHasStartedGame).not.toHaveBeenCalled();
      expect(localStorage.getItem('has_started_game')).toBe('false');
    });
    it('new game returns to welcome and persists that state',()=>{
      const opts=options();localStorage.setItem('has_started_game','true');window.confirm=jest.fn(()=>true);
      const {result}=renderHook(()=>useFullSave(opts));act(()=>result.current.handleStartNewGame());
      expect(opts.setHasStartedGame).toHaveBeenCalledWith(false);
      expect(localStorage.getItem('has_started_game')).toBe('false');
    });
  });

  describe('locale auto-synchronization (Issue #490 / TASK-I18N-02)', () => {
    const baseOptions = {
      setMessages: jest.fn(),
      setCharacters: jest.fn(),
      setActiveCharacter: jest.fn(),
      setCampaigns: jest.fn(),
      setPdfMemory: jest.fn(),
      setActiveGameState: jest.fn(),
      setAiSettings: jest.fn(),
      stopCurrentAudio: jest.fn(),
    };

    it('synchronizes locale and calls router.replace when save.locale differs from currentLocale', async () => {
      const router = { replace: jest.fn() };
      const save = FullGameSaveManager.createFullSave({
        name: 'English Session',
        userId: 'local',
        locale: 'en',
        messages: [],
        gameSettings: { aiSettings: defaultAISettings },
        characters: [],
        campaigns: [],
        npcs: [],
        locations: [],
      });

      localStorage.setItem('language_selected', 'pl');

      const { result } = renderHook(() =>
        useFullSave({
          ...baseOptions,
          currentLocale: 'pl',
          router,
          pathname: '/adventures/strefa-11',
        })
      );

      await act(async () => {
        const success = await result.current.handleLoadFullSave(save);
        expect(success).toBe(true);
      });

      expect(localStorage.getItem('language_selected')).toBe('en');
      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith('/adventures/strefa-11', { locale: 'en' });
    });

    it('does not call router.replace when save.locale matches active currentLocale', async () => {
      const router = { replace: jest.fn() };
      const save = FullGameSaveManager.createFullSave({
        name: 'Matching Polish Session',
        userId: 'local',
        locale: 'pl',
        messages: [],
        gameSettings: { aiSettings: defaultAISettings },
        characters: [],
        campaigns: [],
        npcs: [],
        locations: [],
      });

      localStorage.setItem('language_selected', 'pl');

      const { result } = renderHook(() =>
        useFullSave({
          ...baseOptions,
          currentLocale: 'pl',
          router,
          pathname: '/',
        })
      );

      await act(async () => {
        const success = await result.current.handleLoadFullSave(save);
        expect(success).toBe(true);
      });

      expect(router.replace).not.toHaveBeenCalled();
      expect(localStorage.getItem('language_selected')).toBe('pl');
    });

    it('preserves current locale and does not call router.replace for legacy saves without locale', async () => {
      const router = { replace: jest.fn() };
      const save = FullGameSaveManager.createFullSave({
        name: 'Legacy Save',
        userId: 'local',
        messages: [],
        gameSettings: { aiSettings: defaultAISettings },
        characters: [],
        campaigns: [],
        npcs: [],
        locations: [],
      });
      delete save.locale;

      localStorage.setItem('language_selected', 'pl');

      const { result } = renderHook(() =>
        useFullSave({
          ...baseOptions,
          currentLocale: 'pl',
          router,
          pathname: '/play',
        })
      );

      await act(async () => {
        const success = await result.current.handleLoadFullSave(save);
        expect(success).toBe(true);
      });

      expect(router.replace).not.toHaveBeenCalled();
      expect(localStorage.getItem('language_selected')).toBe('pl');
    });

    it('updates localStorage safely when router is not provided in options', async () => {
      const save = FullGameSaveManager.createFullSave({
        name: 'Save without router',
        userId: 'local',
        locale: 'en',
        messages: [],
        gameSettings: { aiSettings: defaultAISettings },
        characters: [],
        campaigns: [],
        npcs: [],
        locations: [],
      });

      localStorage.setItem('language_selected', 'pl');

      const { result } = renderHook(() =>
        useFullSave({
          ...baseOptions,
          currentLocale: 'pl',
        })
      );

      await act(async () => {
        const success = await result.current.handleLoadFullSave(save);
        expect(success).toBe(true);
      });

      expect(localStorage.getItem('language_selected')).toBe('en');
    });

    it('falls back to localStorage language_selected when currentLocale option is omitted', async () => {
      const router = { replace: jest.fn() };
      const save = FullGameSaveManager.createFullSave({
        name: 'Fallback locale save',
        userId: 'local',
        locale: 'en',
        messages: [],
        gameSettings: { aiSettings: defaultAISettings },
        characters: [],
        campaigns: [],
        npcs: [],
        locations: [],
      });

      localStorage.setItem('language_selected', 'pl');

      const { result } = renderHook(() =>
        useFullSave({
          ...baseOptions,
          router,
        })
      );

      await act(async () => {
        const success = await result.current.handleLoadFullSave(save);
        expect(success).toBe(true);
      });

      expect(localStorage.getItem('language_selected')).toBe('en');
      expect(router.replace).toHaveBeenCalledWith('/', { locale: 'en' });
    });

    it('synchronizes NEXT_LOCALE cookie when save.locale switches', async () => {
      const router = { replace: jest.fn() };
      const save = FullGameSaveManager.createFullSave({
        name: 'Cookie Sync Save',
        userId: 'local',
        locale: 'en',
        messages: [],
        gameSettings: { aiSettings: defaultAISettings },
        characters: [],
        campaigns: [],
        npcs: [],
        locations: [],
      });

      localStorage.setItem('language_selected', 'pl');
      document.cookie = 'NEXT_LOCALE=pl;path=/';

      const { result } = renderHook(() =>
        useFullSave({
          ...baseOptions,
          currentLocale: 'pl',
          router,
        })
      );

      await act(async () => {
        const success = await result.current.handleLoadFullSave(save);
        expect(success).toBe(true);
      });

      expect(localStorage.getItem('language_selected')).toBe('en');
      expect(document.cookie).toContain('NEXT_LOCALE=en');
      expect(router.replace).toHaveBeenCalledWith('/', { locale: 'en' });
    });

    it('safely ignores invalid save.locale and does not pollute localStorage or invoke router', async () => {
      const router = { replace: jest.fn() };
      const baseSave = FullGameSaveManager.createFullSave({
        name: 'Invalid Locale Save',
        userId: 'local',
        locale: 'en',
        messages: [],
        gameSettings: { aiSettings: defaultAISettings },
        characters: [],
        campaigns: [],
        npcs: [],
        locations: [],
      });

      // Artificially corrupt the save object's locale
      const corruptedSave = { ...baseSave, locale: 'de' as unknown as 'en' };
      localStorage.setItem('language_selected', 'pl');

      const { result } = renderHook(() =>
        useFullSave({
          ...baseOptions,
          currentLocale: 'pl',
          router,
        })
      );

      await act(async () => {
        const success = await result.current.handleLoadFullSave(corruptedSave);
        expect(success).toBe(true);
      });

      expect(localStorage.getItem('language_selected')).toBe('pl');
      expect(router.replace).not.toHaveBeenCalled();
    });
  });

  describe('unblocking chat / session reset (Issue #643)', () => {
    it('wywołuje resetSessionEndState podczas pełnego wczytywania save', async () => {
      const resetSessionEndState = jest.fn();
      const save = FullGameSaveManager.createFullSave({
        name: 'Unblock Save',
        userId: 'local',
        messages: [
          {
            id: 'msg-1',
            role: 'assistant',
            content: 'Koniec sesji',
            timestamp: new Date('2026-10-04T20:00:00.000Z'),
          },
        ],
        gameSettings: { aiSettings: defaultAISettings },
        characters: [],
        campaigns: [],
        npcs: [],
        locations: [],
      });

      const { result } = renderHook(() =>
        useFullSave({
          setMessages: jest.fn(),
          setCharacters: jest.fn(),
          setActiveCharacter: jest.fn(),
          setCampaigns: jest.fn(),
          setPdfMemory: jest.fn(),
          setActiveGameState: jest.fn(),
          setAiSettings: jest.fn(),
          stopCurrentAudio: jest.fn(),
          resetSessionEndState,
        })
      );

      await act(async () => {
        const success = await result.current.handleLoadFullSave(save);
        expect(success).toBe(true);
      });

      expect(resetSessionEndState).toHaveBeenCalledTimes(1);
    });

    it('wywołuje resetSessionEndState podczas startu nowej gry (handleStartNewGame)', () => {
      const resetSessionEndState = jest.fn();
      window.confirm = jest.fn(() => true);

      const { result } = renderHook(() =>
        useFullSave({
          setMessages: jest.fn(),
          setCharacters: jest.fn(),
          setActiveCharacter: jest.fn(),
          setCampaigns: jest.fn(),
          setPdfMemory: jest.fn(),
          setActiveGameState: jest.fn(),
          setAiSettings: jest.fn(),
          stopCurrentAudio: jest.fn(),
          resetSessionEndState,
        })
      );

      act(() => {
        result.current.handleStartNewGame();
      });

      expect(resetSessionEndState).toHaveBeenCalledTimes(1);
    });

    it('usuwa tag [KONIEC_SESJI:POTWIERDZENIE] z wczytywanych wiadomości', async () => {
      const setMessages = jest.fn();
      const save = FullGameSaveManager.createFullSave({
        name: 'Legacy End Save',
        userId: 'local',
        messages: [
          {
            id: 'msg-end',
            role: 'assistant',
            content: 'Mrok ogarnia Arkham.\n[KONIEC_SESJI:POTWIERDZENIE]',
            timestamp: new Date('2026-10-04T20:00:00.000Z'),
          },
        ],
        gameSettings: { aiSettings: defaultAISettings },
        characters: [],
        campaigns: [],
        npcs: [],
        locations: [],
      });

      const { result } = renderHook(() =>
        useFullSave({
          setMessages,
          setCharacters: jest.fn(),
          setActiveCharacter: jest.fn(),
          setCampaigns: jest.fn(),
          setPdfMemory: jest.fn(),
          setActiveGameState: jest.fn(),
          setAiSettings: jest.fn(),
          stopCurrentAudio: jest.fn(),
          resetSessionEndState: jest.fn(),
        })
      );

      await act(async () => {
        const success = await result.current.handleLoadFullSave(save);
        expect(success).toBe(true);
      });

      expect(setMessages).toHaveBeenCalledTimes(1);
      const loaded = setMessages.mock.calls[0][0];
      expect(loaded[0].content).toBe('Mrok ogarnia Arkham.');
      expect(loaded[0].content).not.toContain('[KONIEC_SESJI:POTWIERDZENIE]');
    });
  });
});



describe('full save adventure identity is explicit and scoped', () => {
  const adventureId='cien-nad-prabutami';
  const fingerprint=`sha256:${'a'.repeat(64)}`;
  const scope={schemaVersion:1 as const,campaignDefinitionId:`scenario:${adventureId}`,adventureId,playthroughId:'saved',kind:'scenario' as const};
  function fixture(){return FullGameSaveManager.createFullSave({name:'Not a source identifier',userId:'local',campaignMemory:scope,
    pdfMemory:{adventureId,adventureDossierFingerprint:fingerprint} as import('./usePdfMemory').PdfMemory,
    messages:[],characters:[],campaigns:[],npcs:[],locations:[],gameSettings:{aiSettings:defaultAISettings}});}
  function setup(){const setters={setMessages:jest.fn(),setAdventureContext:jest.fn(),setCharacters:jest.fn(),setActiveCharacter:jest.fn(),setCampaigns:jest.fn(),setPdfMemory:jest.fn(),setActiveGameState:jest.fn(),setAiSettings:jest.fn(),stopCurrentAudio:jest.fn()};return{...renderHook(()=>useFullSave(setters)),setters};}
  beforeEach(()=>{jest.clearAllMocks();localStorage.clear();global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({scope:{...scope,playthroughId:'restored'}})});});
  it('restores exact catalog context before PDF memory without changing its edition',async()=>{
    const {result,setters}=setup();await act(async()=>{expect(await result.current.handleLoadFullSave(fixture())).toBe(true);});
    const {getAdventureById}=await import('@/lib/adventures-data');
    expect(setters.setAdventureContext).toHaveBeenCalledWith(getAdventureById(adventureId));
    expect(setters.setAdventureContext.mock.invocationCallOrder[0]).toBeLessThan(setters.setPdfMemory.mock.invocationCallOrder[0]);
    expect(JSON.parse(localStorage.getItem('adventure_context')!).id).toBe(adventureId);
    expect(setters.setPdfMemory).toHaveBeenCalledWith(expect.objectContaining({adventureId,adventureDossierFingerprint:fingerprint}));
    expect(fetch).toHaveBeenCalledTimes(1);expect(fetch).toHaveBeenCalledWith('/api/memory/restore',expect.anything());
  });
  it.each(['missing','unknown','conflicting','foreign-handout'] as const)('rejects %s dossier identity before HTTP or any setters',async(kind)=>{
    const save=fixture();const pdf=save.pdfMemory as import('./usePdfMemory').PdfMemory;
    if(kind==='missing'){delete pdf.adventureId;delete save.campaignMemory;}
    if(kind==='unknown'){pdf.adventureId='unknown-source';save.campaignMemory={...scope,adventureId:'unknown-source'};}
    if(kind==='conflicting')save.campaignMemory={...scope,adventureId:'foreign-source'};
    if(kind==='foreign-handout')save.messages=[{id:'foreign',role:'assistant',content:'[HANDOUT: photo]',timestamp:new Date(),dossierHandoutBinding:{adventureId:'foreign-source',editionFingerprint:fingerprint}}];
    const {result,setters}=setup();await act(async()=>{expect(await result.current.handleLoadFullSave(save)).toBe(false);});
    expect(fetch).not.toHaveBeenCalled();for(const setter of Object.values(setters))expect(setter).not.toHaveBeenCalled();
  });
  it('rejects a foreign server restore scope before changing client state',async()=>{
    jest.mocked(fetch).mockResolvedValue({ok:true,json:async()=>({scope:{...scope,adventureId:'foreign'}})} as Response);
    const {result,setters}=setup();await act(async()=>{expect(await result.current.handleLoadFullSave(fixture())).toBe(false);});
    for(const setter of Object.values(setters))expect(setter).not.toHaveBeenCalled();
  });
  it('does not infer a legacy adventure from its save name or retain the previous profile context',async()=>{
    const save=fixture();save.pdfMemory={};delete save.campaignMemory;save.name='Cień nad Prabutami';
    localStorage.setItem('adventure_context',JSON.stringify({id:adventureId,title:save.name}));
    const {result,setters}=setup();await act(async()=>{expect(await result.current.handleLoadFullSave(save)).toBe(true);});
    expect(setters.setAdventureContext).toHaveBeenCalledWith(null);
    expect(JSON.parse(localStorage.getItem('adventure_context')!)).toBeNull();
  });
});
