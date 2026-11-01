import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  CampaignContextEngine,
  CampaignContextBudgetError,
  countConversationTurns,
} from './context-engine';
import { CampaignMemoryLedgerStore } from './ledger-store';
import type { CampaignMemoryScope } from './types';
import type { Message } from '@/lib/types';
import { getGeminiClient } from '@/lib/gemini-client-pool';
import { searchCampaignMemory } from './retrieval';

jest.mock('@/lib/gemini-client-pool', () => ({ getGeminiClient: jest.fn() }));
jest.mock('./retrieval', () => ({
  searchCampaignMemory: jest.fn(async () => ({ results: [], promptSection: '', source: 'none' })),
}));

const scope: CampaignMemoryScope = {
  schemaVersion: 1,
  campaignDefinitionId: 'masks-of-nyarlathotep',
  playthroughId: 'run-context-test',
  adventureId: 'peru',
  kind: 'official',
};

function messages(count: number, chars = 120) {
  return Array.from({ length: count }, (_, index) => ({
    id: `m-${index}`,
    role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
    content: `${index}: ${'x'.repeat(chars)}`,
    timestamp: new Date(index * 1000),
  }));
}

describe('CampaignContextEngine', () => {
  let dir: string;
  let ledger: CampaignMemoryLedgerStore;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'campaign-context-'));
    ledger = new CampaignMemoryLedgerStore(path.join(dir, 'memory.sqlite3'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    ledger.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('does not compact before 50 percent of the model context', async () => {
    const input = messages(4, 20);
    const result = await new CampaignContextEngine(ledger).compactIfNeeded({
      messages: input,
      modelId: 'test',
      apiKey: 'key',
      scope,
      locale: 'pl',
      contextLimitOverride: 1000,
    });
    expect(result.messages).toEqual(input);
    expect(result.compacted).toBe(false);
    expect(getGeminiClient).not.toHaveBeenCalled();
  });

  it('preserves the beginning and end and stores the exact compacted range', async () => {
    (getGeminiClient as jest.Mock).mockReturnValue({
      models: {
        generateContent: jest.fn(async () => ({
          text: JSON.stringify({
            events: ['Odkryto przejście.'],
            investigatorDecisions: ['Badacze weszli do środka.'],
            revealedClues: ['Znak na drzwiach.'],
            npcStatus: [],
            consequences: ['Strażnik ich zauważył.'],
            unresolvedThreads: ['Kto zostawił znak?'],
          }),
        })),
      },
    });
    const input = messages(12);
    for (let index = 0; index < 6; index += 1) {
      ledger.recordConversationTurn({
        scope,
        sessionId: 'session-context',
        messageId: input[index * 2 + 1].id,
        userMessageId: input[index * 2].id,
        userText: input[index * 2].content,
        assistantText: input[index * 2 + 1].content,
      });
    }
    const rawIds = ledger.list(scope).map((entry) => entry.id);
    const result = await new CampaignContextEngine(ledger).compactIfNeeded({
      messages: input,
      modelId: 'test',
      apiKey: 'key',
      scope,
      locale: 'pl',
      contextLimitOverride: 600,
    });
    expect(result.compacted).toBe(true);
    expect(result.messages[0].id).toBe('m-0');
    expect(result.messages.at(-1)?.id).toBe('m-11');
    const checkpoint = ledger.getLatestCheckpoint(scope.playthroughId);
    expect(checkpoint).not.toBeNull();
    expect(checkpoint?.sourceStartSequence).toBeGreaterThanOrEqual(1);
    expect(checkpoint?.sourceEndSequence).toBeLessThan(11);
    expect(ledger.list(scope).map((entry) => entry.id)).toEqual(rawIds);
    expect(ledger.list(scope).some((entry) => !entry.active)).toBe(true);
    const compactedIds = new Set(checkpoint?.sourceMessageIds ?? []);
    expect(ledger.list(scope).filter((entry) => !entry.active).every((entry) =>
      entry.sourceMessageIds.some((id) => compactedIds.has(id))
    )).toBe(true);
  });

  it('keeps context unchanged after an AI failure and applies cooldown', async () => {
    const generateContent = jest.fn(async () => { throw new Error('offline'); });
    (getGeminiClient as jest.Mock).mockReturnValue({ models: { generateContent } });
    const input = messages(12);
    const engine = new CampaignContextEngine(ledger);
    const first = await engine.compactIfNeeded({
      messages: input,
      modelId: 'test',
      apiKey: 'key',
      scope,
      locale: 'pl',
      contextLimitOverride: 600,
    });
    const second = await engine.compactIfNeeded({
      messages: input,
      modelId: 'test',
      apiKey: 'key',
      scope,
      locale: 'pl',
      contextLimitOverride: 600,
    });
    expect(first.messages).toEqual(input);
    expect(second.messages).toEqual(input);
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(ledger.getCompressionFailure(scope.playthroughId).failureCount).toBe(1);
  });

  it('keeps newly uncovered middle messages when reusing a recent checkpoint', async () => {
    const generateContent = jest.fn(async (_request: { contents: string }) => ({
      text: JSON.stringify({
        events: ['Odkryto przejście.'],
        investigatorDecisions: [],
        revealedClues: [],
        npcStatus: [],
        consequences: [],
        unresolvedThreads: [],
      }),
    }));
    (getGeminiClient as jest.Mock).mockReturnValue({ models: { generateContent } });
    const engine = new CampaignContextEngine(ledger);
    const saved = jest.spyOn(ledger, 'saveCheckpoint');
    const initial = messages(12);
    await engine.compactIfNeeded({
      messages: initial,
      modelId: 'test',
      apiKey: 'key',
      scope,
      locale: 'pl',
      contextLimitOverride: 600,
    });
    const checkpoint = ledger.getLatestCheckpoint(scope.playthroughId);
    expect(checkpoint).not.toBeNull();
    // Persistence of the new optional fields belongs to the ledger workstream.
    jest.spyOn(ledger, 'getLatestCheckpoint').mockReturnValue({ ...checkpoint!, ...saved.mock.calls[0][0] });

    const expanded = messages(14);
    const reused = await engine.compactIfNeeded({
      messages: expanded,
      modelId: 'test',
      apiKey: 'key',
      scope,
      locale: 'pl',
      contextLimitOverride: 600,
    });

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(reused.messages.map((message) => message.id)).toContain(`m-${checkpoint!.sourceEndSequence + 1}`);
    const covered = new Set(checkpoint!.sourceMessageIds);
    expect(reused.messages.map((message) => message.id)).toEqual(expanded.filter((message) => !covered.has(message.id)).map((message) => message.id));
  });

  const base = { modelId: 'test', apiKey: 'key', scope, locale: 'pl' as const, contextLimitOverride: 600 };

  async function checkpointFixture() {
    const generateContent = jest.fn(async () => ({ text: JSON.stringify({ events: ['A door was found.'] }) }));
    (getGeminiClient as jest.Mock).mockReturnValue({ models: { generateContent } });
    const engine = new CampaignContextEngine(ledger);
    const initial = messages(12);
    const save = jest.spyOn(ledger, 'saveCheckpoint');
    await engine.compactIfNeeded({ ...base, messages: initial });
    const checkpoint = { ...ledger.getLatestCheckpoint(scope.playthroughId)!, ...save.mock.calls[0][0] };
    const read = jest.spyOn(ledger, 'getLatestCheckpoint').mockReturnValue(checkpoint);
    return { engine, initial, checkpoint, read, generateContent, save };
  }

  it.each(['edited text', 'id', 'role', 'locale', 'model', 'rewind', 'legacy checkpoint', 'different playthrough'])(
    'rejects checkpoint reuse after %s', async (change) => {
      const fixture = await checkpointFixture();
      const input = { ...base, messages: fixture.initial.map((message) => ({ ...message })), locale: 'pl' as 'pl' | 'en' };
      const index = fixture.checkpoint.sourceStartSequence;
      if (change === 'edited text') input.messages[index].content += ' changed';
      if (change === 'id') input.messages[index].id = 'replacement';
      if (change === 'role') input.messages[index].role = input.messages[index].role === 'user' ? 'assistant' : 'user';
      if (change === 'locale') input.locale = 'en';
      if (change === 'model') input.modelId = 'other-model';
      if (change === 'rewind') input.messages = input.messages.slice(0, 10);
      if (change === 'legacy checkpoint') fixture.read.mockReturnValue({ ...fixture.checkpoint, sourceHash: undefined, locale: undefined, modelId: undefined });
      if (change === 'different playthrough') fixture.read.mockReturnValue({ ...fixture.checkpoint, playthroughId: 'another-run' });
      await fixture.engine.compactIfNeeded(input);
      expect(fixture.generateContent).toHaveBeenCalledTimes(2);
    },
  );

  it('hashes full source content beyond any summary-sized prefix', async () => {
    const fixture = await checkpointFixture();
    expect(fixture.checkpoint.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    const input = fixture.initial.map((message) => ({ ...message }));
    input[3].content += 'z'.repeat(8000);
    await fixture.engine.compactIfNeeded({ ...base, messages: input, contextLimitOverride: 10000 });
    // Directly verify the hash input independently, including order, IDs and roles.
    const { createHash } = await import('crypto');
    const { cleanResponseText } = await import('@/lib/parsers/text-cleaner');
    const range = fixture.initial.slice(fixture.checkpoint.sourceStartSequence, fixture.checkpoint.sourceEndSequence + 1);
    expect(fixture.checkpoint.sourceHash).toBe(createHash('sha256').update(JSON.stringify(range.map((message) => ({
      id: message.id, role: message.role,
      content: message.role === 'assistant' ? cleanResponseText(message.content) : message.content,
    })))).digest('hex'));
  });

  it('ignores changes confined to cleaned hidden assistant content', async () => {
    const fixture = await checkpointFixture();
    const input = fixture.initial.map((message) => ({ ...message }));
    input[3].content = '[SEKRETY_MG]Hidden fact[/SEKRETY_MG]' + input[3].content;
    await fixture.engine.compactIfNeeded({ ...base, messages: input });
    expect(fixture.generateContent).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('rejects overflow on compressor failure (cooldown=%s) without changing history', async (cooldown) => {
    const generateContent = jest.fn(async () => { throw new Error('offline'); });
    (getGeminiClient as jest.Mock).mockReturnValue({ models: { generateContent } });
    if (cooldown) ledger.recordCompressionFailure(scope.playthroughId);
    const input = messages(12);
    const before = JSON.stringify(input);
    await expect(new CampaignContextEngine(ledger).compactIfNeeded({ ...base, messages: input, availableContextTokens: 150 })).rejects.toBeInstanceOf(CampaignContextBudgetError);
    expect(JSON.stringify(input)).toBe(before);
    expect(ledger.getLatestCheckpoint(scope.playthroughId)).toBeNull();
    expect(generateContent).toHaveBeenCalledTimes(cooldown ? 0 : 1);
  });

  it('rejects protected input before calling the compressor', async () => {
    await expect(new CampaignContextEngine(ledger).compactIfNeeded({ ...base, messages: messages(12), availableContextTokens: 20 }))
      .rejects.toMatchObject({ name: 'CampaignContextBudgetError', code: 'CAMPAIGN_CONTEXT_BUDGET_EXCEEDED', availableTokens: 20 });
    expect(getGeminiClient).not.toHaveBeenCalled();
    expect(ledger.getCompressionFailure(scope.playthroughId).failureCount).toBe(0);
  });

  it('enforces the same preflight without a campaign scope', async () => {
    await expect(new CampaignContextEngine(ledger).compactIfNeeded({ ...base, scope: null, messages: messages(2), availableContextTokens: 1 }))
      .rejects.toBeInstanceOf(CampaignContextBudgetError);
  });

  it('uses the explicit remaining budget without reserving the margin twice', async () => {
    const input = messages(4, 20);
    const exact = input.reduce((sum, message) => sum + Math.ceil(message.content.length / 4) + 8, 0);
    const result = await new CampaignContextEngine(ledger).compactIfNeeded({ ...base, messages: input, availableContextTokens: exact });
    expect(result.messages).toEqual(input);
    expect(getGeminiClient).not.toHaveBeenCalled();
  });

  it.each([null, [0.1, 0.2]])('forwards queryEmbedding=%s and locale in the fourth retrieval argument', async (queryEmbedding) => {
    await new CampaignContextEngine(ledger).prepareContext({ ...base, messages: [], query: 'door', queryEmbedding });
    expect(searchCampaignMemory).toHaveBeenCalledWith(scope, 'door', ledger, { queryEmbedding, locale: 'pl' });
  });

  it('includes retrieved memory in the outbound token budget', async () => {
    (searchCampaignMemory as jest.Mock).mockResolvedValueOnce({ results: [], source: 'fts', promptSection: '\n## Memory\n- ' + 'x'.repeat(400) });
    const result = await new CampaignContextEngine(ledger).prepareContext({ ...base, messages: messages(2, 20), query: 'door', availableContextTokens: 40 });
    expect(result.memorySection).toBe('');
    expect(result.messages).toHaveLength(2);
  });

  it('never sends hidden GM content to the compressor or stores it in a checkpoint', async () => {
    const generateContent = jest.fn(async (_request: { contents: string }) => ({
      text: JSON.stringify({
        events: ['[MYŚLI_MG: ukryty sekret] Odkryto zamknięte drzwi.'],
        investigatorDecisions: [],
        revealedClues: [],
        npcStatus: [],
        consequences: [],
        unresolvedThreads: [],
      }),
    }));
    (getGeminiClient as jest.Mock).mockReturnValue({ models: { generateContent } });
    const input = messages(12);
    input[5] = {
      ...input[5],
      content: '[SEKRETY_MG]Kultysta nadal żyje.[/SEKRETY_MG] Gracze widzą zamknięte drzwi. ' + 'x'.repeat(120),
    };
    await new CampaignContextEngine(ledger).compactIfNeeded({
      messages: input,
      modelId: 'test',
      apiKey: 'key',
      scope,
      locale: 'pl',
      contextLimitOverride: 600,
    });
    const request = generateContent.mock.calls[0][0];
    expect(request.contents).not.toContain('Kultysta nadal żyje');
    expect(ledger.getLatestCheckpoint(scope.playthroughId)?.summary).toContain('Odkryto zamknięte drzwi.');
    expect(ledger.getLatestCheckpoint(scope.playthroughId)?.summary).not.toContain('ukryty sekret');
  });

  describe('OPT-C02 Adaptive Context Window Compression', () => {
    it('does not compact long-context model sessions under turn and token thresholds', async () => {
      const input = messages(20, 50); // 10 turns, ~340 tokens
      const result = await new CampaignContextEngine(ledger).compactIfNeeded({
        messages: input,
        modelId: 'gemini-2.5-flash',
        apiKey: 'key',
        scope,
        locale: 'pl',
      });
      expect(result.messages).toEqual(input);
      expect(result.compacted).toBe(false);
      expect(getGeminiClient).not.toHaveBeenCalled();
    });

    it('compacts sessions exceeding turn threshold (> 20 turns) on models with 1M context limit', async () => {
      (getGeminiClient as jest.Mock).mockReturnValue({
        models: {
          generateContent: jest.fn(async () => ({
            text: JSON.stringify({
              events: ['Rozpoczęto śledztwo w Arkham.'],
              investigatorDecisions: ['Badacze zbadali stary dom.'],
              revealedClues: ['Dziwny symbol na ścianie.'],
              npcStatus: ['Profesor Armitage jest bezpieczny.'],
              consequences: ['Świadkowie uciekli.'],
              unresolvedThreads: ['Kto wybił okno?'],
            }),
          })),
        },
      });

      const input = messages(44, 100); // 22 turns
      const result = await new CampaignContextEngine(ledger).compactIfNeeded({
        messages: input,
        modelId: 'gemini-2.5-flash',
        apiKey: 'key',
        scope,
        locale: 'pl',
      });

      expect(result.compacted).toBe(true);
      expect(result.summarySection).toContain('PODSUMOWANIE KONTEKSTU KAMPANII');
      expect(result.summarySection).toContain('Rozpoczęto śledztwo w Arkham.');
      expect(getGeminiClient).toHaveBeenCalledTimes(1);

      // Verify outbound messages are bounded
      expect(result.messages.length).toBeLessThan(input.length);
      expect(result.messages[0].id).toBe('m-0');
      expect(result.messages.at(-1)?.id).toBe('m-43');

      // Verify checkpoint saved in SQLite ledger
      const checkpoint = ledger.getLatestCheckpoint(scope.playthroughId);
      expect(checkpoint).not.toBeNull();
      expect(checkpoint?.summary).toContain('Rozpoczęto śledztwo w Arkham.');
      expect(checkpoint?.sourceStartSequence).toBeGreaterThanOrEqual(1);
      expect(checkpoint?.sourceEndSequence).toBeLessThan(43);
    });

    it('compacts sessions exceeding token threshold (> 20,000 tokens) even with fewer turns', async () => {
      (getGeminiClient as jest.Mock).mockReturnValue({
        models: {
          generateContent: jest.fn(async () => ({
            text: JSON.stringify({
              events: ['Długa naracja o rytuale.'],
              investigatorDecisions: ['Przerwanie obrzędu.'],
              revealedClues: ['Księga Eibona.'],
              npcStatus: [],
              consequences: ['Mgła opadła.'],
              unresolvedThreads: [],
            }),
          })),
        },
      });

      // 8 turns (16 messages), each with 6,000 characters (~1,508 tokens * 16 = ~24,128 tokens)
      const input = messages(16, 6000);
      const result = await new CampaignContextEngine(ledger).compactIfNeeded({
        messages: input,
        modelId: 'gemini-2.5-flash',
        apiKey: 'key',
        scope,
        locale: 'pl',
      });

      expect(result.compacted).toBe(true);
      expect(result.summarySection).toContain('Długa naracja o rytuale.');
      expect(getGeminiClient).toHaveBeenCalledTimes(1);
    });

    it('reuses ledger checkpoint on subsequent turns in adaptive context window without redundant AI calls', async () => {
      const generateContent = jest.fn(async () => ({
        text: JSON.stringify({
          events: ['Przeszukanie archiwum.'],
          investigatorDecisions: [],
          revealedClues: ['Stara mapa bagniska.'],
          npcStatus: [],
          consequences: [],
          unresolvedThreads: [],
        }),
      }));
      (getGeminiClient as jest.Mock).mockReturnValue({ models: { generateContent } });

      const engine = new CampaignContextEngine(ledger);
      const initial = messages(44, 100); // 22 turns
      const first = await engine.compactIfNeeded({
        messages: initial,
        modelId: 'gemini-2.5-flash',
        apiKey: 'key',
        scope,
        locale: 'pl',
      });
      expect(first.compacted).toBe(true);
      expect(generateContent).toHaveBeenCalledTimes(1);

      // Next turn: 23 turns (46 messages)
      const expanded = messages(46, 100);
      const second = await engine.compactIfNeeded({
        messages: expanded,
        modelId: 'gemini-2.5-flash',
        apiKey: 'key',
        scope,
        locale: 'pl',
      });

      expect(second.compacted).toBe(true);
      // generateContent should NOT be called again - checkpoint must be reused!
      expect(generateContent).toHaveBeenCalledTimes(1);
      expect(second.summarySection).toContain('Przeszukanie archiwum.');
      expect(second.messages.at(-1)?.id).toBe('m-45');
    });

    it('respects custom adaptiveTurnThreshold and adaptiveTokenThreshold overrides in prepareContext', async () => {
      (getGeminiClient as jest.Mock).mockReturnValue({
        models: {
          generateContent: jest.fn(async () => ({
            text: JSON.stringify({
              events: ['Wczesne podsumowanie po 8 turach.'],
              investigatorDecisions: [],
              revealedClues: [],
              npcStatus: [],
              consequences: [],
              unresolvedThreads: [],
            }),
          })),
        },
      });

      const input = messages(16, 50); // 8 turns
      const result = await new CampaignContextEngine(ledger).prepareContext({
        messages: input,
        query: 'archiwum',
        modelId: 'gemini-2.5-flash',
        apiKey: 'key',
        scope,
        locale: 'pl',
        adaptiveTurnThreshold: 6, // override to trigger at 6 turns
      });

      expect(result.compacted).toBe(true);
      expect(result.summarySection).toContain('Wczesne podsumowanie po 8 turach.');
      expect(getGeminiClient).toHaveBeenCalledTimes(1);
    });

    it('correctly calculates conversation turns even with sparse or irregular user messages', () => {
      expect(countConversationTurns([])).toBe(0);
      expect(countConversationTurns(messages(40, 10))).toBe(20);

      // 1 user message, 25 assistant messages -> total 26 messages -> Math.max(1, 13) = 13 turns
      const irregular: Message[] = [
        { id: 'm-0', role: 'user', content: 'Cześć', timestamp: new Date() },
        ...Array.from({ length: 25 }, (_, i) => ({
          id: `a-${i}`,
          role: 'assistant' as const,
          content: `Odpowiedź ${i}`,
          timestamp: new Date(),
        })),
      ];
      expect(countConversationTurns(irregular)).toBe(13);
    });

    it('compacts sessions exceeding turn threshold even when availableContextTokens is explicitly passed', async () => {
      (getGeminiClient as jest.Mock).mockReturnValue({
        models: {
          generateContent: jest.fn(async () => ({
            text: JSON.stringify({
              events: ['Podsumowanie z dostępnym budżetem tokenów.'],
              investigatorDecisions: [],
              revealedClues: [],
              npcStatus: [],
              consequences: [],
              unresolvedThreads: [],
            }),
          })),
        },
      });

      const input = messages(44, 100); // 22 turns
      const result = await new CampaignContextEngine(ledger).compactIfNeeded({
        messages: input,
        modelId: 'gemini-2.5-flash',
        apiKey: 'key',
        scope,
        locale: 'pl',
        availableContextTokens: 60_000, // Explicit token budget > adaptive threshold
      });

      expect(result.compacted).toBe(true);
      expect(result.summarySection).toContain('Podsumowanie z dostępnym budżetem tokenów.');
      expect(getGeminiClient).toHaveBeenCalledTimes(1);
    });

    it('gracefully returns fallback when all messages fit into head and tail without middle segment', async () => {
      const input = messages(8, 50); // 4 turns: 4 head + 4 tail -> no middle
      const result = await new CampaignContextEngine(ledger).compactIfNeeded({
        messages: input,
        modelId: 'gemini-2.5-flash',
        apiKey: 'key',
        scope,
        locale: 'pl',
        adaptiveTurnThreshold: 2, // low threshold to force evaluation
      });

      expect(result.compacted).toBe(false);
      expect(result.messages).toEqual(input);
      expect(result.summarySection).toBeNull();
      expect(getGeminiClient).not.toHaveBeenCalled();
    });

    it('refreshes checkpoint when appended uncovered messages exceed effective adaptive budget', async () => {
      let callCount = 0;
      const generateContent = jest.fn(async () => {
        callCount += 1;
        return {
          text: JSON.stringify({
            events: [`Podsumowanie #${callCount}`],
            investigatorDecisions: [],
            revealedClues: [],
            npcStatus: [],
            consequences: [],
            unresolvedThreads: [],
          }),
        };
      });
      (getGeminiClient as jest.Mock).mockReturnValue({ models: { generateContent } });

      const engine = new CampaignContextEngine(ledger);
      const initial = messages(44, 100); // 22 turns
      const first = await engine.compactIfNeeded({
        messages: initial,
        modelId: 'gemini-2.5-flash',
        apiKey: 'key',
        scope,
        locale: 'pl',
        adaptiveTokenThreshold: 3_000,
      });
      expect(first.compacted).toBe(true);
      expect(generateContent).toHaveBeenCalledTimes(1);

      // Add messages where uncovered middle is heavy (exceeds adaptiveTokenThreshold of 3,000)
      const expanded = [
        ...initial,
        // Huge messages in middle that cause reusedCost to exceed 3,000 tokens
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `m-extra-${i}`,
          role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
          content: 'x'.repeat(4000), // ~1008 tokens each
          timestamp: new Date(),
        })),
      ];

      const second = await engine.compactIfNeeded({
        messages: expanded,
        modelId: 'gemini-2.5-flash',
        apiKey: 'key',
        scope,
        locale: 'pl',
        adaptiveTokenThreshold: 3_000,
      });

      expect(second.compacted).toBe(true);
      // Checkpoint must NOT be blindly reused; it must refresh!
      expect(generateContent).toHaveBeenCalledTimes(2);
      expect(second.summarySection).toContain('Podsumowanie #2');
    });
  });
});

