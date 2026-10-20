import { act, renderHook } from '@testing-library/react';
import {
  getGMProtocolPrompt,
  getCompactGMProtocolPrompt,
  getReactiveInitiativeProtocol,
  getContextAwareGMProtocol,
} from '@/lib/prompts/gm-protocol';
import { buildAdditionalContext } from '@/app/api/chat/_helpers/build-context';
import { sanitizeAgencyViolations } from '@/app/api/chat/_helpers/agency-linter';
import { extractLatestTagLocation } from '@/lib/parsers/event-parser';
import { extractJournalTags } from '@/lib/parsers/journal-parser';
import { useGameStart } from '@/hooks/useGameStart';
import { fetchWithApiKeys } from '@/lib/api-keys-service';
import { parseSSEStream } from '@/lib/sse-parser';
import { defaultAISettings } from '@/lib/ai-settings/defaults';
import type { Character, Message } from '@/lib/types';
import type { GameContext } from '@/lib/prompt-section-parser';

// Mocks for useGameStart
jest.mock('@/lib/api-keys-service', () => ({
  fetchWithApiKeys: jest.fn(),
  getApiKeyHeaders: jest.fn(() => ({})),
}));

jest.mock('@/lib/sse-parser', () => ({
  parseSSEStream: jest.fn(),
  createSseParseErrorHandler: jest.fn(() => jest.fn()),
}));

jest.mock('@/lib/posthog', () => ({
  trackEvent: jest.fn(),
}));

jest.mock('@/lib/ai-settings/cost-control', () => ({
  resetSessionTokens: jest.fn(),
}));

jest.mock('@/lib/time-manager', () => ({
  timeManager: {
    getTime: jest.fn(() => ({
      year: 1920,
      month: 9,
      day: 15,
      hour: 20,
      minute: 0,
    })),
    formatDateTime: jest.fn((loc: string) =>
      loc === 'en' ? '15 October 1920, 20:00' : '15 Października 1920, 20:00'
    ),
    getWeather: jest.fn(() => 'Chilly autumn evening with harbor mist'),
    resetForAdventure: jest.fn(),
  },
}));

jest.mock('@/hooks/useEquipmentThumbnails', () => ({
  useEquipmentThumbnails: jest.fn(() => ({
    generateThumbnailsInBackground: jest.fn(),
  })),
}));

describe('English Narrative Engine Parity Master Suite (Milestone M4)', () => {
  const POLISH_DIACRITICS_REGEX = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  // ==========================================================================
  // 1. GM Protocol Parity & Polish Character Cleanliness
  // ==========================================================================
  describe('1. GM Protocol Parity & Polish Character Cleanliness', () => {
    it('getGMProtocolPrompt("en") contains zero Polish diacritics and zero residual Polish headers', () => {
      const promptEn = getGMProtocolPrompt('en');

      // Zero Polish diacritics
      expect(POLISH_DIACRITICS_REGEX.test(promptEn)).toBe(false);

      // Zero Polish residual headers or sections
      expect(promptEn).not.toContain('## PROTOKÓŁ MG');
      expect(promptEn).not.toContain('## PROTOKÓŁ MISTRZA GRY');
      expect(promptEn).not.toContain('STRUKTURA OTWARCIA');
      expect(promptEn).not.toContain('ŻELAZNE DYREKTYWY PODRĘCZNIKA BADACZA');
      expect(promptEn).not.toContain('KSIĄŻKOWA ASYMETRIA');
      expect(promptEn).not.toContain('ZASADA DIALOG-FIRST');
      expect(promptEn).not.toContain('ZAMKNIĘTA KOPERTA');
      expect(promptEn).not.toContain('PULA SEKRETÓW');
      expect(promptEn).not.toContain('ZAMKNIĘTY KRĄG');
      expect(promptEn).not.toContain('TWARDE WETO SĘDZIEGO');

      // Zero hardcoded Polish action tags
      expect(promptEn).not.toContain('[Co robisz?]');
      expect(promptEn).not.toContain('[Co robicie?]');

      // English headers and tags present
      expect(promptEn).toContain('## GAME MASTER PROTOCOL (KEEPER PROTOCOL)');
      expect(promptEn).toContain('[What do you do?]');
      expect(promptEn).toContain('[What do you all do?]');
      expect(promptEn).toContain('[LOCATION: Place Name | Atmosphere description and visual prompt]');
      expect(promptEn).toContain('[CURRENT TIME: DD Month YYYY, HH:MM]');
      expect(promptEn).toContain('[JOURNAL:type:title]content[/JOURNAL]');
    });

    it('getCompactGMProtocolPrompt("en") contains zero Polish diacritics and zero Polish tags', () => {
      const compactEn = getCompactGMProtocolPrompt('en');

      // Zero Polish diacritics
      expect(POLISH_DIACRITICS_REGEX.test(compactEn)).toBe(false);

      // Zero residual Polish headers or tags
      expect(compactEn).not.toContain('## PROTOKÓŁ MG (PRZYPOMNIENIE)');
      expect(compactEn).not.toContain('[Co robisz?]');
      expect(compactEn).not.toContain('[Co robicie?]');

      // English content verified
      expect(compactEn).toContain('## GM PROTOCOL (REMEMBRANCE)');
      expect(compactEn).toContain('[What do you do?]');
      expect(compactEn).toContain('[What do you all do?]');
      expect(compactEn).toContain('[LOCATION: Place Name | Atmosphere description and visual prompt]');
    });

    it('getReactiveInitiativeProtocol("en") contains zero Polish diacritics and pure English directive', () => {
      const reactiveEn = getReactiveInitiativeProtocol('en');

      // Zero Polish diacritics
      expect(POLISH_DIACRITICS_REGEX.test(reactiveEn)).toBe(false);

      // Polish section title and strings absent
      expect(reactiveEn).not.toContain('## ZASADA INICJATYWY REAKTYWNEJ');
      expect(reactiveEn).not.toContain('[Co robisz?]');

      // English section title and tags present
      expect(reactiveEn).toContain('## REACTIVE INITIATIVE DIRECTIVE');
      expect(reactiveEn).toContain('[What do you do?]');
      expect(reactiveEn).toContain('Never push the plot forward autonomously');
    });

    it('getContextAwareGMProtocol returns clean English prompts for both early and late turns', () => {
      // Early turn (<= 10 turns) uses full prompt + reactive initiative
      const earlyEn = getContextAwareGMProtocol(0, 10, 'en');
      expect(POLISH_DIACRITICS_REGEX.test(earlyEn)).toBe(false);
      expect(earlyEn).not.toContain('[Co robisz?]');
      expect(earlyEn).toContain('[What do you do?]');
      expect(earlyEn).toContain('## REACTIVE INITIATIVE DIRECTIVE');

      // Late turn (> 10 turns) uses compact prompt + reactive initiative
      const lateEn = getContextAwareGMProtocol(15, 10, 'en');
      expect(POLISH_DIACRITICS_REGEX.test(lateEn)).toBe(false);
      expect(lateEn).not.toContain('[Co robisz?]');
      expect(lateEn).toContain('## GM PROTOCOL (REMEMBRANCE)');
      expect(lateEn).toContain('## REACTIVE INITIATIVE DIRECTIVE');
    });

    it('preserves 100% Polish protocol and backward compatibility when locale is "pl"', () => {
      const fullPl = getGMProtocolPrompt('pl');
      expect(fullPl).toContain('## PROTOKÓŁ MISTRZA GRY (GM PROTOCOL)');
      expect(fullPl).toContain('[Co robisz?]');

      const compactPl = getCompactGMProtocolPrompt('pl');
      expect(compactPl).toContain('## PROTOKÓŁ MG (PRZYPOMNIENIE)');
      expect(compactPl).toContain('[Co robisz?]');

      const reactivePl = getReactiveInitiativeProtocol('pl');
      expect(reactivePl).toContain('## ZASADA INICJATYWY REAKTYWNEJ');
      expect(reactivePl).toContain('[Co robisz?]');
    });
  });

  // ==========================================================================
  // 2. Opening Prompts & Game Start Scaffolding (useGameStart)
  // ==========================================================================
  describe('2. Opening Prompts & Game Start Scaffolding (useGameStart)', () => {
    const singleCharacter: Character = {
      id: 'char_single',
      name: 'Thomas Malone',
      age: 32,
      str: 50, dex: 50, con: 50, app: 50, pow: 50, edu: 50, siz: 50, int: 70, luck: 50, hp: 10, san: 50, mp: 10,
      skills: {}, developmentHistory: [], notes: '',
      occupation: 'Detektyw',
      characterConcept: 'Hardboiled police detective haunted by Chinatown horrors',
      background: 'Born in Brooklyn, served during the war.',
      playerName: 'Jakub',
      isActive: true,
      lastUsed: new Date(),
      experience: { totalXP: 0, availableXP: 0, earnedThisSession: 0, maxEarnedThisSession: 10 },
      journal: [],
    };

    const adventureContext = {
      id: 'the-haunting',
      title: 'The Haunting',
      yearRange: '1920',
      country: 'USA',
      location: 'Boston',
      hook: 'Mr. Steven Knott hires investigators to inspect the Corbitt house.',
      isCustom: false,
    };

    it('generates English Solo opening prompt with 4-step ordinary world rules, negative constraints, and trailing [What do you do?]', async () => {
      jest.mocked(fetchWithApiKeys).mockResolvedValueOnce({ ok: true } as Response);
      jest.mocked(parseSSEStream).mockImplementation(async (_resp, callbacks) => {
        callbacks?.onText?.('Opening narration text...');
        return 'Opening narration text...';
      });

      let messages: Message[] = [];
      const setMessages: Parameters<typeof useGameStart>[0]['setMessages'] = (update) => {
        messages = typeof update === 'function' ? update(messages) : update;
      };

      const props: Parameters<typeof useGameStart>[0] = {
        setHasStartedGame: jest.fn(),
        activeCharacter: singleCharacter,
        characters: [singleCharacter],
        setActiveCharacter: jest.fn(),
        setCharacters: jest.fn(),
        pdfMemory: {},
        adventureContext,
        hotSeatConfig: { enabled: false, players: [] },
        setMessages,
        tts: {
          voiceEnabled: false,
          isTTSEnabled: false,
          generateVoiceForMessage: jest.fn().mockResolvedValue(undefined),
          addToQueue: jest.fn(),
          startInitialBuffering: jest.fn(),
          stopCurrentAudio: jest.fn(),
        },
        aiSettings: { ...defaultAISettings, imageGenerationEnabled: false },
        locale: 'en',
      };

      const { result } = renderHook(() => useGameStart(props));

      await act(async () => {
        await result.current.handleStartGame();
      });

      expect(fetchWithApiKeys).toHaveBeenCalled();
      const chatCall = jest.mocked(fetchWithApiKeys).mock.calls.find((c) => c[0] === '/api/chat');
      expect(chatCall).toBeDefined();

      const body = JSON.parse(chatCall![1]?.body as string);
      const prompt: string = body.message;

      // 1. Basic greeting
      expect(prompt).toContain('We are beginning the adventure!\n\n');
      expect(prompt).toContain('This is the OPENING TURN of the game.');

      // 2. 4-step ordinary world rules
      expect(prompt).toContain('ORGANIC WORLD INTRODUCTION - INSTRUCTIONS:');
      expect(prompt).toContain('1. OPENING SCENE: DO NOT throw the player into deep water and DO NOT thrust the quest hook in the very first sentence.');
      expect(prompt).toContain('drinking morning coffee, discussing mundane matters with a familiar NPC, browsing the daily press, or having dinner');
      expect(prompt).toContain('2. SENSORY WORLD DISCOVERY: Build the period atmosphere and setting naturally.');
      expect(prompt).toContain('3. GRADUAL PLOT HOOK INTRODUCTION: Only after establishing the setting and mundane routine, sow the first subtle unease');
      expect(prompt).toContain('4. LITERARY STYLE & AGENCY: Write in second person ("You see...", "You smell..."), cultivate slow-burn dread without cheap monster jumpscares');

      // 3. Structural tags
      expect(prompt).toContain('[LOCATION: Place Name | Atmosphere & Visual Prompt]');
      expect(prompt).toContain('[JOURNAL:case:Beginning the investigation]1-2 sentences about where I am and what brings me here.[/JOURNAL]');

      // 4. Concluding whisper on its own separate line
      expect(prompt).toContain('Conclude with the open question [What do you do?] on its own separate line.');

      // 5. Zero Polish text
      expect(prompt).not.toContain('To jest TURA WPROWADZAJĄCA');
      expect(prompt).not.toContain('[Co robisz?]');
      expect(prompt).not.toContain('[LOKACJA: Nazwa miejsca: krótka atmosfera]');
    });

    it('generates English Party opening prompt with 4-step party scaffolding, plural address, negative constraints, and trailing [What do you all do?]', async () => {
      const secondCharacter: Character = {
        ...singleCharacter,
        id: 'char_party_2',
        name: 'Dr. Constance Ward',
        occupation: 'Lekarz',
        playerName: 'Anna',
      };

      jest.mocked(fetchWithApiKeys).mockResolvedValueOnce({ ok: true } as Response);
      jest.mocked(parseSSEStream).mockImplementation(async (_resp, callbacks) => {
        callbacks?.onText?.('Party opening narration...');
        return 'Party opening narration...';
      });

      let messages: Message[] = [];
      const setMessages: Parameters<typeof useGameStart>[0]['setMessages'] = (update) => {
        messages = typeof update === 'function' ? update(messages) : update;
      };

      const props: Parameters<typeof useGameStart>[0] = {
        setHasStartedGame: jest.fn(),
        activeCharacter: singleCharacter,
        characters: [singleCharacter, secondCharacter],
        setActiveCharacter: jest.fn(),
        setCharacters: jest.fn(),
        pdfMemory: {},
        adventureContext,
        hotSeatConfig: {
          enabled: true,
          players: [
            { id: 'p1', name: 'Jakub', color: '#4ade80', characterId: 'char_single', isActive: true, turnCount: 0 },
            { id: 'p2', name: 'Anna', color: '#f472b6', characterId: 'char_party_2', isActive: false, turnCount: 0 },
          ],
        },
        setMessages,
        tts: {
          voiceEnabled: false,
          isTTSEnabled: false,
          generateVoiceForMessage: jest.fn().mockResolvedValue(undefined),
          addToQueue: jest.fn(),
          startInitialBuffering: jest.fn(),
          stopCurrentAudio: jest.fn(),
        },
        aiSettings: { ...defaultAISettings, imageGenerationEnabled: false },
        locale: 'en',
      };

      const { result } = renderHook(() => useGameStart(props));

      await act(async () => {
        await result.current.handleStartGame();
      });

      const chatCall = jest.mocked(fetchWithApiKeys).mock.calls.find((c) => c[0] === '/api/chat');
      expect(chatCall).toBeDefined();

      const body = JSON.parse(chatCall![1]?.body as string);
      const prompt: string = body.message;

      // 1. Party mode header
      expect(prompt).toContain('This is the OPENING TURN for the party (Hot Seat mode).');
      expect(prompt).toContain('PARTY INTRODUCTION - ORGANIC PLOT START:');

      // 2. 4-step party scaffolding
      expect(prompt).toContain('1. NARRATION & FORM: Address the investigators in the plural ("You see...", "You enter...")');
      expect(prompt).toContain('2. ORGANIC OPENING SCENE: DO NOT throw the players into a violent quest or direct threat immediately.');
      expect(prompt).toContain('3. EXPOSITION & ATMOSPHERE: Allow the players to take in the time, place, and period atmosphere.');
      expect(prompt).toContain('(NEVER force players to debate among themselves in chat).');
      expect(prompt).toContain('4. TURN CONCLUSION: Conclude the turn with an open question directed to the whole party: [What do you all do?] on its own separate line.');

      // 3. Structural tags
      expect(prompt).toContain('[LOCATION: Place Name | Atmosphere & Visual Prompt]');
      expect(prompt).toContain('[JOURNAL:case:Beginning the investigation]1-2 sentences about what brings our party to this place.[/JOURNAL]');

      // 4. Trailing question strictly in plural
      expect(prompt).toContain('Conclude with [What do you all do?] on its own separate line.');
      expect(prompt).not.toContain('Conclude with [What do you do?].');
    });
  });

  // ==========================================================================
  // 3. Duet Mode Context Parity (build-context.ts)
  // ==========================================================================
  describe('3. Duet Mode Context Parity (build-context.ts)', () => {
    const dummyGameContext: GameContext = {
      mode: 'investigation',
      hasNPCs: false,
      recentSANLoss: false,
      findingDocument: false,
      inDarkness: false,
      nightTime: false,
    };

    const duetCharacters = [
      {
        id: 'c1',
        name: 'Thomas Malone',
        occupation: 'Detektyw',
        characterConcept: 'Former NYPD officer',
        traits: ['observant', 'stubborn'],
        personality: 'Quiet and calculating',
        significantPerson: 'Captain O’Malley',
        meaningfulLocation: 'St. Patrick’s Cathedral',
        treasuredPossession: 'Silver police badge',
        backstory: 'Investigated cult activities in Red Hook.',
      },
      {
        id: 'c2',
        name: 'Dr. Constance Ward',
        occupation: 'Lekarz',
        characterConcept: 'Alienist at Arkham Sanitarium',
        traits: ['empathic', 'analytical'],
        personality: 'Composed under pressure',
        significantPerson: 'Prof. Armitage',
        meaningfulLocation: 'Miskatonic Medical Wing',
        treasuredPossession: 'Father’s leather stethoscope',
        backstory: 'Researches hysteria and inexplicable amnesia.',
      },
    ] as unknown as Character[];

    it('injects English duet guidelines and translated rules when locale is "en"', () => {
      const result = buildAdditionalContext({
        timePromptSection: 'TIME',
        gmProtocol: 'PROTOCOL',
        resolvedCachedContent: null,
        gameContext: dummyGameContext,
        locale: 'en',
        hotSeatConfig: {
          enabled: true,
          players: [
            { playerId: 'p1', characterName: 'Thomas Malone' },
            { playerId: 'p2', characterName: 'Dr. Constance Ward' },
          ],
        },
      }).join('\n');

      // English Header
      expect(result).toContain('## TWO-PLAYER MODE (HOT SEAT / DUET)');
      expect(result).not.toContain('## TRYB GRY DLA DWÓCH OSÓB (HOT SEAT / DRUŻYNA)');

      // Extract the DUET section specifically to verify English guidelines
      const duetSection = result.split('## TWO-PLAYER MODE (HOT SEAT / DUET)')[1];
      expect(duetSection).toBeDefined();
      expect(duetSection).toContain('CRITICAL ROLE OVERRIDE: This game is NOT solo. A TEAM of investigators is participating: Thomas Malone, Dr. Constance Ward.');
      expect(duetSection).toContain('1. NARRATIVE FORM: Describe the world and scenes in the plural ("You see...", "You stand before...", "You hear...")');
      expect(duetSection).toContain('2. RELATIONSHIP & COMMON GOAL: Run the game recognizing that the investigators are cooperating.');
      expect(duetSection).toContain('NEVER force players to debate among themselves in chat.');
      expect(duetSection).toContain('ALWAYS end with a simple question addressed to the party: [What do you all do?].');
      expect(duetSection).not.toContain('[Co robicie?]');

      // Tag examples in English
      expect(duetSection).toContain('[JOURNAL:@Thomas Malone:clue:title]content[/JOURNAL]');
      expect(duetSection).not.toContain('[DZIENNIK:@Thomas Malone:trop:tytuł]');
    });

    it('injects English DUET INTRODUCTION for game start with localized occupations and field labels', () => {
      const result = buildAdditionalContext({
        timePromptSection: 'TIME',
        gmProtocol: 'PROTOCOL',
        resolvedCachedContent: null,
        gameContext: dummyGameContext,
        locale: 'en',
        isGameStart: true,
        characters: duetCharacters,
        hotSeatConfig: {
          enabled: true,
          players: [
            { playerId: 'p1', characterName: 'Thomas Malone' },
            { playerId: 'p2', characterName: 'Dr. Constance Ward' },
          ],
        },
      }).join('\n');

      // Game start section header
      expect(result).toContain('### DUET INTRODUCTION (GAME START)');
      expect(result).not.toContain('### WPROWADZENIE DLA DUETU (ROZPOCZĘCIE GRY)');

      // English section description
      expect(result).toContain('You are opening the game for two players. Your first turn must sketch a shared beginning');
      expect(result).toContain('1. DESCRIBE RELATIONSHIP & MEETING:');
      expect(result).toContain('2. PARTY HOOK:');
      expect(result).toContain('3. FORM: Address both characters directly and simultaneously in the plural.');

      // Localized character occupations
      expect(result).toContain('**Thomas Malone** (Private Investigator):');
      expect(result).toContain('**Dr. Constance Ward** (Doctor of Medicine):');

      // English field labels
      expect(result).toContain('* Concept:');
      expect(result).toContain('* Personality & Traits:');
      expect(result).toContain('* Significant Person:');
      expect(result).toContain('* Meaningful Location:');
      expect(result).toContain('* Treasured Possession:');
      expect(result).toContain('* Backstory:');

      // Absence of Polish field labels
      expect(result).not.toContain('* Koncept:');
      expect(result).not.toContain('* Osobowość i Cechy:');
      expect(result).not.toContain('* Kluczowa osoba:');
      expect(result).not.toContain('* Ważne miejsce:');
    });
  });

  // ==========================================================================
  // 4. Agency Linter English Call-to-Action & System Tag Preservation
  // ==========================================================================
  describe('4. Agency Linter English Call-to-Action & System Tag Preservation', () => {
    it('appends [What do you all do?] when sanitizing English party / duet narrative', () => {
      const violatingText =
        'The carriage stops at the iron gate. ' +
        'Thomas Malone hops off the wagon, pulls out his medical kit, and examines the wounds of the driver.';

      const sanitized = sanitizeAgencyViolations(violatingText, ['Thomas Malone'], {
        isDuet: true,
        locale: 'en',
      });

      expect(sanitized).toContain('The carriage stops at the iron gate.');
      expect(sanitized).not.toContain('hops off');
      expect(sanitized).not.toContain('pulls out');

      // In Duet mode, English ending marker must be [What do you all do?]
      expect(sanitized).toContain('[What do you all do?]');
      expect(sanitized).not.toContain('[What do you do?]');
      expect(sanitized).not.toContain('[Co robicie?]');
    });

    it('appends [What do you do?] when sanitizing English solo narrative', () => {
      const violatingText =
        'Shadows flicker across the hallway. ' +
        'Thomas Malone enters the dark cellar and draws his revolver.';

      const sanitized = sanitizeAgencyViolations(violatingText, ['Thomas Malone'], {
        isDuet: false,
        locale: 'en',
      });

      expect(sanitized).toContain('Shadows flicker across the hallway.');
      expect(sanitized).not.toContain('enters the dark cellar');

      // In Solo mode, English ending marker must be [What do you do?]
      expect(sanitized).toContain('[What do you do?]');
      expect(sanitized).not.toContain('[What do you all do?]');
      expect(sanitized).not.toContain('[Co robisz?]');
    });

    it('does not duplicate question marker if already ending with [What do you all do?]', () => {
      const textWithQuestion =
        'Fog rolls across the wharf. A bell tolls in the distance.\n\n' +
        'Thomas Malone hops off the wagon.\n\n' +
        '[What do you all do?]';

      const sanitized = sanitizeAgencyViolations(textWithQuestion, ['Thomas Malone'], {
        isDuet: true,
        locale: 'en',
      });

      expect(sanitized).toContain('[What do you all do?]');
      expect(sanitized).not.toContain('[What do you all do?]\n\n[What do you all do?]');
    });

    it('preserves English system tags (JOURNAL, LOCATION, PRESENT_NPCS, SCENE_CHANGE) across cutoff', () => {
      const rawText =
        'Cold sea wind blows off the Atlantic.\n' +
        'Thomas Malone hops off the wagon and draws his revolver.\n\n' +
        '[JOURNAL:case:Beginning the investigation]\n' +
        'Arrived at the Boston harbor to inspect the warehouse.\n' +
        '[/JOURNAL]\n' +
        '[LOCATION: Boston Harbor | cold morning mist rising over dark water]\n' +
        '[PRESENT_NPCS: Harbormaster]\n' +
        '[SCENE_CHANGE: Pier 4]\n' +
        '[What do you all do?]';

      const sanitized = sanitizeAgencyViolations(rawText, ['Thomas Malone'], {
        isDuet: true,
        locale: 'en',
      });

      // Narracja ucięta przed naruszeniem
      expect(sanitized).toContain('Cold sea wind blows off the Atlantic.');
      expect(sanitized).not.toContain('hops off');

      // Tagi systemowe zachowane
      expect(sanitized).toContain('[JOURNAL:case:Beginning the investigation]');
      expect(sanitized).toContain('Arrived at the Boston harbor to inspect the warehouse.');
      expect(sanitized).toContain('[/JOURNAL]');
      expect(sanitized).toContain('[LOCATION: Boston Harbor | cold morning mist rising over dark water]');
      expect(sanitized).toContain('[PRESENT_NPCS: Harbormaster]');
      expect(sanitized).toContain('[SCENE_CHANGE: Pier 4]');
      expect(sanitized).toContain('[What do you all do?]');
    });
  });

  // ==========================================================================
  // 5. Structural Tag Parsing & Pipe Separator Consistency
  // ==========================================================================
  describe('5. Structural Tag Parsing & Pipe Separator Consistency', () => {
    it('extractLatestTagLocation extracts name and description cleanly from pipe separator', () => {
      const text =
        'You step out into the rain. ' +
        '[LOCATION: Miskatonic University Library | towering gothic bookshelves, dust motes dancing in shafts of pale sunlight] ' +
        'What do you do?';

      const parsed = extractLatestTagLocation(text);
      expect(parsed).toEqual({
        name: 'Miskatonic University Library',
        description: 'towering gothic bookshelves, dust motes dancing in shafts of pale sunlight',
      });

      // Name does not leak description or prompt keywords
      expect(parsed?.name).not.toContain('|');
      expect(parsed?.name).not.toContain('bookshelves');
      expect(parsed?.name.length).toBeLessThanOrEqual(45);
    });

    it('extractJournalTags correctly parses [JOURNAL:case:...] to type "case" without fallback to "note"', () => {
      const text =
        'You review your notes on the case.\n' +
        '[JOURNAL:case:Beginning the investigation]\n' +
        'Mr. Steven Knott hired us to inspect the Corbitt house.\n' +
        '[/JOURNAL]';

      const tags = extractJournalTags(text);
      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual(
        expect.objectContaining({
          type: 'case',
          title: 'Beginning the investigation',
          content: 'Mr. Steven Knott hired us to inspect the Corbitt house.',
        })
      );
      expect(tags[0].type).not.toBe('note');
    });
  });
});
