import { act, renderHook } from '@testing-library/react';
import { useGameStart } from '@/hooks/useGameStart';
import { sanitizeAgencyViolations } from '@/app/api/chat/_helpers/agency-linter';
import { extractLatestTagLocation, sanitizeLocationName } from '@/lib/parsers/event-parser';
import { cleanupContent } from '@/components/chat/narrative/cleanup';
import { parseIntoSections } from '@/components/chat/narrative/parse-sections';
import { fetchWithApiKeys } from '@/lib/api-keys-service';
import { parseSSEStream } from '@/lib/sse-parser';
import { defaultAISettings } from '@/lib/ai-settings/defaults';
import type { Character, Message } from '@/lib/types';

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
    getWeather: jest.fn(() => 'Foggy drizzle'),
    resetForAdventure: jest.fn(),
  },
}));

jest.mock('@/hooks/useEquipmentThumbnails', () => ({
  useEquipmentThumbnails: jest.fn(() => ({
    generateThumbnailsInBackground: jest.fn(),
  })),
}));

describe('ADVERSARIAL BOUNDARY & CONCURRENCY VERIFICATION', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  const baseChar: Character = {
    id: 'char-1',
    name: 'Arthur "Two-Guns" Pendelton',
    age: 38,
    str: 60, dex: 70, con: 50, app: 45, pow: 65, edu: 70, siz: 65, int: 75, luck: 50, hp: 11, san: 65, mp: 13,
    skills: {}, developmentHistory: [], notes: '',
    occupation: 'Prywatny detektyw',
    characterConcept: 'Cynical WWI veteran & ex-Pinkerton <investigator> with a scarred face',
    background: 'Family died during the Spanish Flu epidemic.',
    playerName: 'Player1',
    isActive: true,
    lastUsed: new Date(),
    experience: { totalXP: 0, availableXP: 0, earnedThisSession: 0, maxEarnedThisSession: 10 },
    journal: [],
  };

  const advContext = {
    id: 'the-haunting',
    title: 'The Haunting',
    yearRange: '1920',
    country: 'USA',
    location: 'Boston',
    hook: 'Mr. Knott wants the old Corbitt house inspected.',
    isCustom: false,
  };

  // =========================================================================
  // 1. useGameStart: Multi-character parties (2, 3, 4 players) & extreme concepts
  // =========================================================================
  describe('1. useGameStart opening prompts with multi-character parties and extreme inputs', () => {
    it('handles 2-player party (Duet / Hot Seat) with correct scaffolding and plural whisper', async () => {
      const char2: Character = {
        ...baseChar,
        id: 'char-2',
        name: 'Sister Beatrice O\'Connor',
        occupation: 'Lekarz',
        playerName: 'Player2',
        characterConcept: 'Franciscan nun & nurse with uncanny medical insights',
      };

      jest.mocked(fetchWithApiKeys).mockResolvedValueOnce({ ok: true } as Response);
      jest.mocked(parseSSEStream).mockImplementation(async (_resp, cb) => {
        cb?.onText?.('Party narration...');
        return 'Party narration...';
      });

      let messages: Message[] = [];
      const props: Parameters<typeof useGameStart>[0] = {
        setHasStartedGame: jest.fn(),
        activeCharacter: baseChar,
        characters: [baseChar, char2],
        setActiveCharacter: jest.fn(),
        setCharacters: jest.fn(),
        pdfMemory: {},
        adventureContext: advContext,
        hotSeatConfig: {
          enabled: true,
          players: [
            { id: 'p1', name: 'Player1', color: '#111', characterId: 'char-1', isActive: true, turnCount: 0 },
            { id: 'p2', name: 'Player2', color: '#222', characterId: 'char-2', isActive: false, turnCount: 0 },
          ],
        },
        setMessages: (u) => { messages = typeof u === 'function' ? u(messages) : u; },
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
      await act(async () => { await result.current.handleStartGame(); });

      const chatCall = jest.mocked(fetchWithApiKeys).mock.calls.find((c) => c[0] === '/api/chat');
      const body = JSON.parse(chatCall![1]?.body as string);
      const prompt: string = body.message;

      expect(prompt).toContain('**IMPORTANT: This is a Hot Seat game for 2 players.**');
      expect(prompt).toContain('**Player 1 - Arthur "Two-Guns" Pendelton:**');
      expect(prompt).toContain('**Player 2 - Sister Beatrice O\'Connor:**');
      expect(prompt).toContain('1. NARRATION & FORM: Address the investigators in the plural ("You see...", "You enter...")');
      expect(prompt).toContain('Conclude with [What do you all do?] on its own separate line.');
      expect(prompt).not.toContain('Conclude with the open question [What do you do?]');
    });

    it('handles 3-player and 4-player parties in Hot Seat mode without corruption', async () => {
      const char2: Character = { ...baseChar, id: 'char-2', name: 'Char 2', playerName: 'P2' };
      const char3: Character = { ...baseChar, id: 'char-3', name: 'Char 3', playerName: 'P3' };
      const char4: Character = { ...baseChar, id: 'char-4', name: 'Char 4', playerName: 'P4' };

      jest.mocked(fetchWithApiKeys).mockResolvedValueOnce({ ok: true } as Response);
      jest.mocked(parseSSEStream).mockImplementation(async (_resp, cb) => {
        cb?.onText?.('Narration...');
        return 'Narration...';
      });

      let messages: Message[] = [];
      const props: Parameters<typeof useGameStart>[0] = {
        setHasStartedGame: jest.fn(),
        activeCharacter: baseChar,
        characters: [baseChar, char2, char3, char4],
        setActiveCharacter: jest.fn(),
        setCharacters: jest.fn(),
        pdfMemory: {},
        adventureContext: advContext,
        hotSeatConfig: {
          enabled: true,
          players: [
            { id: 'p1', name: 'P1', color: '#111', characterId: 'char-1', isActive: true, turnCount: 0 },
            { id: 'p2', name: 'P2', color: '#222', characterId: 'char-2', isActive: false, turnCount: 0 },
            { id: 'p3', name: 'P3', color: '#333', characterId: 'char-3', isActive: false, turnCount: 0 },
            { id: 'p4', name: 'P4', color: '#444', characterId: 'char-4', isActive: false, turnCount: 0 },
          ],
        },
        setMessages: (u) => { messages = typeof u === 'function' ? u(messages) : u; },
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
      await act(async () => { await result.current.handleStartGame(); });

      const chatCall = jest.mocked(fetchWithApiKeys).mock.calls.find((c) => c[0] === '/api/chat');
      const body = JSON.parse(chatCall![1]?.body as string);
      const prompt: string = body.message;

      expect(prompt).toContain('**IMPORTANT: This is a Hot Seat game for 4 players.**');
      expect(prompt).toContain('**Player 1 - Arthur "Two-Guns" Pendelton:**');
      expect(prompt).toContain('**Player 2 - Char 2:**');
      expect(prompt).toContain('**Player 3 - Char 3:**');
      expect(prompt).toContain('**Player 4 - Char 4:**');
      expect(prompt).toContain('Conclude with [What do you all do?] on its own separate line.');
    });

    it('handles extreme concept strings with quotes, HTML tags, and missing fields', async () => {
      const weirdChar: Character = {
        ...baseChar,
        name: 'Prof. <Special> "Void" \'Alchemist\'',
        occupation: '' as unknown as string,
        age: undefined as unknown as number,
        characterConcept: 'Concept with "quotes" and | pipes | and [brackets]',
        background: '',
      };

      jest.mocked(fetchWithApiKeys).mockResolvedValueOnce({ ok: true } as Response);
      jest.mocked(parseSSEStream).mockImplementation(async (_resp, cb) => {
        cb?.onText?.('Narration...');
        return 'Narration...';
      });

      let messages: Message[] = [];
      const props: Parameters<typeof useGameStart>[0] = {
        setHasStartedGame: jest.fn(),
        activeCharacter: weirdChar,
        characters: [weirdChar],
        setActiveCharacter: jest.fn(),
        setCharacters: jest.fn(),
        pdfMemory: {},
        adventureContext: advContext,
        hotSeatConfig: { enabled: false, players: [] },
        setMessages: (u) => { messages = typeof u === 'function' ? u(messages) : u; },
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
      await act(async () => { await result.current.handleStartGame(); });

      const chatCall = jest.mocked(fetchWithApiKeys).mock.calls.find((c) => c[0] === '/api/chat');
      const body = JSON.parse(chatCall![1]?.body as string);
      const prompt: string = body.message;

      expect(prompt).toContain('Prof. <Special> "Void" \'Alchemist\'');
      expect(prompt).toContain('Concept: Concept with "quotes" and | pipes | and [brackets]');
      expect(prompt).toContain('Age: unknown');
      expect(prompt).toContain('Conclude with the open question [What do you do?] on its own separate line.');
    });
  });

  // =========================================================================
  // 2. Trailing Whisper & Agency Linter Placement
  // =========================================================================
  describe('2. Trailing whisper placement & agency-linter behavior', () => {
    it('appends [What do you do?] when agency-linter truncates solo narrative without question', () => {
      const text = 'The door swings open. Thomas steps inside without waiting.';
      const sanitized = sanitizeAgencyViolations(text, ['Thomas'], { isDuet: false, locale: 'en' });

      expect(sanitized).toMatch(/\[What do you do\?\]\s*$/);
      expect(sanitized).not.toContain('[What do you all do?]');
    });

    it('appends [What do you all do?] when agency-linter truncates duet narrative without question', () => {
      const text = 'The door swings open. Thomas steps inside without waiting.';
      const sanitized = sanitizeAgencyViolations(text, ['Thomas'], { isDuet: true, locale: 'en' });

      expect(sanitized).toMatch(/\[What do you all do\?\]\s*$/);
      expect(sanitized).not.toContain('[What do you do?]');
    });

    it('preserves trailing tags after whisper during sanitization', () => {
      const text =
        'The hallway is silent.\n' +
        'Thomas steps forward into the gloom.\n\n' +
        '[LOCATION: Basement | pitch darkness]\n' +
        '[JOURNAL:case:Desc]Body[/JOURNAL]\n' +
        '[What do you all do?]';

      const sanitized = sanitizeAgencyViolations(text, ['Thomas'], { isDuet: true, locale: 'en' });
      expect(sanitized).toContain('[LOCATION: Basement | pitch darkness]');
      expect(sanitized).toContain('[JOURNAL:case:Desc]Body[/JOURNAL]');
      expect(sanitized).toContain('[What do you all do?]');
    });
  });

  // =========================================================================
  // 3. extractLatestTagLocation: Special characters, quotes, trailing pipes
  // =========================================================================
  describe('3. extractLatestTagLocation handling of complex location strings', () => {
    it('handles locations with quotes, trailing pipes, and atmosphere descriptions', () => {
      const text = '[LOCATION: The Old "Drowned Rat" Tavern | Dark & dingy | extra details]';
      const parsed = extractLatestTagLocation(text);

      expect(parsed).not.toBeNull();
      // Quotes should be stripped safely, name sanitized
      expect(parsed?.name).toBe('The Old Drowned Rat Tavern');
      // Description captures the remainder after the first pipe
      expect(parsed?.description).toBe('Dark & dingy | extra details');
    });

    it('handles location with parenthesis and numbers: St. Mary\'s Cemetery (Section #4)', () => {
      const text = '[LOCATION: St. Mary\'s Cemetery (Section #4) | overgrown tombstones, heavy fog]';
      const parsed = extractLatestTagLocation(text);

      expect(parsed).not.toBeNull();
      expect(parsed?.name).toBe('St. Marys Cemetery (Section #4)');
      expect(parsed?.description).toBe('overgrown tombstones, heavy fog');
    });

    it('picks the latest location tag when multiple are present in message', () => {
      const text =
        'First we were at [LOCATION: Boston Harbor | cold wind].\n' +
        'Then we walked to [LOCATION: Commercial Wharf | fish crates and lamps].';
      const parsed = extractLatestTagLocation(text);

      expect(parsed).not.toBeNull();
      expect(parsed?.name).toBe('Commercial Wharf');
      expect(parsed?.description).toBe('fish crates and lamps');
    });

    it('truncates extremely long location names cleanly at word boundary without breaking', () => {
      const text = '[LOCATION: Extremely Long And Convoluted Name Of A Secret Masonic Temple In Arkham | dark marble columns]';
      const parsed = extractLatestTagLocation(text);

      expect(parsed).not.toBeNull();
      expect(parsed!.name.length).toBeLessThanOrEqual(45);
      expect(parsed!.name).not.toContain('|');
    });
  });

  // =========================================================================
  // 4. cleanupContent: Stripping [LOCATION: ...] without touching player/GM dialog
  // =========================================================================
  describe('4. cleanupContent strips [LOCATION: ...] and preserves valid dialog', () => {
    it('strips English [LOCATION: ...] cleanly from narration', () => {
      const text =
        'You step out of the cab.\n' +
        '[LOCATION: Boston Harbor | cold morning mist rising over dark water]\n' +
        'The water laps against the wooden piers.\n\n' +
        '[What do you do?]';

      const cleaned = cleanupContent(text);
      expect(cleaned).not.toContain('[LOCATION:');
      expect(cleaned).not.toContain('Boston Harbor');
      expect(cleaned).toContain('You step out of the cab.');
      expect(cleaned).toContain('The water laps against the wooden piers.');
      expect(cleaned).toContain('[What do you do?]');
    });

    it('does not strip legitimate player or NPC dialog containing the word "location" or bracketed words', () => {
      const text =
        'Constance looks at the map.\n\n' +
        'Constance: „The exact location of the ritual is marked right here.”\n\n' +
        'Thomas: „Are you sure about that [strange symbol] near the river?”\n\n' +
        '[What do you all do?]';

      const cleaned = cleanupContent(text);
      expect(cleaned).toContain('The exact location of the ritual is marked right here.');
      expect(cleaned).toContain('Are you sure about that [strange symbol] near the river?');
      expect(cleaned).toContain('[What do you all do?]');
    });
  });

  // =========================================================================
  // 5. parseIntoSections: Handout termination and whisper separation
  // =========================================================================
  describe('5. parseIntoSections handout termination and call-to-action whisper separation', () => {
    it('separates [Co robisz?] into whisper when following a newspaper handout', () => {
      const text = [
        '📰 KURIER WARSZAWSKI',
        'Tajemniczy nieznajomy widziany w porcie.',
        '[Co robisz?]',
      ].join('\n');

      const sections = parseIntoSections(text);
      expect(sections.some((s) => s.type === 'whisper' && s.content === 'Co robisz?')).toBe(true);
    });

    it('separates [What do you do?] into whisper when following an English newspaper handout', () => {
      const text = [
        '📰 THE BOSTON GLOBE',
        'A mysterious stranger was seen in the harbor.',
        '[What do you do?]',
      ].join('\n');

      const sections = parseIntoSections(text);
      // Adversarial probe: does parseIntoSections terminate the handout and produce a whisper section?
      const whisper = sections.find((s) => s.type === 'whisper');
      expect(whisper).toBeDefined();
      expect(whisper?.content).toBe('What do you do?');
    });

    it('separates [What do you all do?] into whisper when following an English newspaper handout', () => {
      const text = [
        '📰 THE BOSTON GLOBE',
        'A mysterious stranger was seen in the harbor.',
        '[What do you all do?]',
      ].join('\n');

      const sections = parseIntoSections(text);
      // Adversarial probe: does parseIntoSections terminate the handout and produce a whisper section?
      const whisper = sections.find((s) => s.type === 'whisper');
      expect(whisper).toBeDefined();
      expect(whisper?.content).toBe('What do you all do?');
    });
  });
});
