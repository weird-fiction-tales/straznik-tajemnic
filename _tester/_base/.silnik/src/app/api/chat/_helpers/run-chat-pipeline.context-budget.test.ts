import fs from 'fs';
import os from 'os';
import path from 'path';
import { TextDecoder, TextEncoder } from 'node:util';
import { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type { NextRequest } from 'next/server';
import type { Character } from '@/lib/types';
import type {
  ChatCompletionRequest,
  StreamingChatResult,
} from '@/lib/ai-providers/types';
import type { CampaignMemoryScope } from '@/core/memory/types';
import { CampaignMemoryLedgerStore } from '@/core/memory/ledger-store';
import {
  CampaignContextEngine,
  getCampaignContextEngine,
} from '@/core/memory/context-engine';
import { resolveGeminiCache } from './resolve-gemini-cache';
import { createSseStream } from './create-sse-stream';
import { estimateRequestTokens } from '@/lib/ai-providers/context-budget';
import { DEFAULT_GEMINI_MODEL } from '@/lib/ai-providers/constants';
import { getGeminiClient } from '@/lib/gemini-client-pool';
import { getContextLimit } from '@/lib/model-registry';
import { runChatPipeline } from './run-chat-pipeline';

const mockStreamChat = jest.fn<
  Promise<StreamingChatResult>,
  [ChatCompletionRequest]
>();

class TestResponse {
  readonly status: number;
  constructor(
    readonly body: unknown,
    init?: ResponseInit
  ) {
    this.status = init?.status ?? 200;
  }
}

Object.assign(globalThis, {
  TextDecoder,
  TextEncoder,
  ReadableStream: NodeReadableStream,
  Response: TestResponse,
});

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock('@/lib/ai-providers', () => ({
  GeminiChatProvider: jest
    .fn()
    .mockImplementation(() => ({ streamChat: mockStreamChat })),
}));

jest.mock('@/lib/gemini-client-pool', () => ({ getGeminiClient: jest.fn() }));

jest.mock('@/lib/embedding-service', () => ({
  embeddingService: {
    initialize: jest.fn(),
    generateEmbedding: jest.fn(async () => null),
  },
  getEmbeddingDimensions: () => 1024,
}));

jest.mock('@/lib/vector-db/local-vector-store', () => ({
  localVectorStore: { query: jest.fn(async () => []) },
}));

jest.mock('@/lib/vector-db/retrieval-service', () => ({
  retrievalService: {
    retrieve: jest.fn(async () => ({
      promptSection: '',
      results: [],
      source: 'none',
      durationMs: 0,
    })),
  },
}));

jest.mock('@/core/memory/index-queue', () => ({
  drainMemoryIndex: jest.fn(async () => {}),
  embeddingSignature: () => 'memory-recipients-test:1024',
}));

// Keep prepareContext, compaction and retrieval real, with an isolated ledger.
jest.mock('@/core/memory/context-engine', () => ({
  ...jest.requireActual<typeof import('@/core/memory/context-engine')>(
    '@/core/memory/context-engine'
  ),
  getCampaignContextEngine: jest.fn(),
}));

jest.mock('./resolve-gemini-cache', () => ({
  resolveGeminiCache: jest.fn(async () => null),
}));
jest.mock('./build-immersion-context', () => ({
  fetchImmersionContext: jest.fn(async () => ''),
}));
jest.mock('./create-sse-stream', () => ({
  createSseStream: jest.fn(
    () =>
      new ReadableStream({
        start(controller) {
          controller.close();
        },
      })
  ),
}));
jest.mock('@/lib/auth-user', () => ({
  resolveUserId: jest.fn(async () => 'memory-test-user'),
  scopeSessionId: (user: string, session?: string) =>
    `${user}:${session ?? 'session'}`,
}));

const scope: CampaignMemoryScope = {
  schemaVersion: 1,
  campaignDefinitionId: 'memory-recipients-campaign',
  playthroughId: 'memory-recipients-run',
  adventureId: 'test-adventure',
  kind: 'custom',
};
function investigator(id: string, name: string): Character {
  return {
    id,
    name,
    str: 50,
    dex: 50,
    con: 50,
    app: 50,
    pow: 50,
    edu: 50,
    siz: 50,
    int: 70,
    luck: 50,
    hp: 10,
    san: 50,
    mp: 10,
    skills: {},
    occupation: 'Detective',
    age: 35,
    background: '',
    playerName: name,
    isActive: true,
    lastUsed: new Date(0),
    notes: '',
    experience: {
      totalXP: 0,
      availableXP: 0,
      earnedThisSession: 0,
      maxEarnedThisSession: 10,
    },
    developmentHistory: [],
    journal: [],
    investigatorDossier: {
      adventureId: scope.adventureId,
      clues: [],
      npcs: [],
      locations: [],
      notes: [],
    },
  };
}

const alice = investigator('investigator-alice', 'Alice Brown');
jest.mock('@/lib/model-registry', () => ({
  ...jest.requireActual('@/lib/model-registry'),
  getContextLimit: jest.fn(() => 1_048_576),
}));

describe('chat pipeline context budget', () => {
  let directory: string;
  let ledger: CampaignMemoryLedgerStore;
  const compress = jest.fn(async ({ contents }: { contents: string }) => ({
    text: JSON.stringify({ sourceIds: (JSON.parse(contents) as Array<{id: string}>).map(e => e.id) }),
  }));
  const messages = Array.from({ length: 41 }, (_, i) => ({
    id: `history-${i}`,
    role: i % 2 ? 'assistant' : 'user',
    content: `MARKER_${i} ${'x'.repeat(600)}`,
    timestamp: new Date(i),
  }));

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-context-budget-'));
    ledger = new CampaignMemoryLedgerStore(
      path.join(directory, 'memory.sqlite3')
    );
    jest
      .mocked(getCampaignContextEngine)
      .mockReturnValue(new CampaignContextEngine(ledger));
    jest.mocked(getContextLimit).mockReturnValue(1_048_576);
    jest
      .mocked(getGeminiClient)
      .mockReturnValue({
        models: { generateContent: compress },
      } as unknown as NonNullable<ReturnType<typeof getGeminiClient>>);
    for (const [i, message] of messages.entries()) ledger.append({
      id: `fact-${i}`, scope, sessionId: 's', sequence: i + 1, role: 'assistant', kind: 'clue',
      text: `MARKER_${i}`, sourceMessageIds: [message.id], tags: [], active: true, revealedAt: new Date(0).toISOString(),
    });
    compress.mockClear();
    jest.mocked(resolveGeminiCache).mockResolvedValue(null);
    jest.mocked(createSseStream).mockClear();
    mockStreamChat.mockReset();
    mockStreamChat.mockImplementation(async () => ({
      stream: (async function* () {
        yield { text: 'The librarian waits.' };
      })(),
      getUsage: async () => null,
      getFinishReason: () => 'STOP',
    }));
  });
  afterEach(() => {
    ledger.close();
    fs.rmSync(directory, { recursive: true, force: true });
    localStorage.clear();
  });

  async function ask(
    locale: 'pl' | 'en',
    history = messages,
    memoryScope: CampaignMemoryScope | null = scope
  ) {
    return runChatPipeline({
      request: {
        headers: {
          get: (key: string) =>
            key === 'X-Gemini-Api-Key' ? 'synthetic-key' : null,
        },
      } as unknown as NextRequest,
      body: {
        message: history.at(-1)?.content ?? 'I wait.',
        messages: history,
        locale,
        character: alice,
        characters: [alice],
        memoryScope,
        currentLocation: 'Library',
        eraContext: {
          schemaVersion: 1,
          sceneDate: '1925-01-14',
          effectiveYear: 1925,
          countryCode: 'US',
          regionProfile: 'US',
          source: 'user-selection',
          rulesVersion: '1.0.0',
        },
        aiSettings: {
          geminiSettings: {
            model: 'gemini-budget-test',
            enableCache: false,
            maxOutputTokens: 1024,
          },
        },
      },
      traceId: 'context-budget',
      timer: { elapsed: () => 0 },
    });
  }

  it.each(['pl', 'en'] as const)(
    'never loses a message outside the summarized source range (%s)',
    async (locale) => {
      // Calibrate fixed instructions without mocking their real composition.
      await ask(locale);
      const initial = mockStreamChat.mock.calls[0][0];
      const estimate = (s: string) => Math.ceil(s.length / 4);
      const sections = initial.geminiOptions?.additionalContext ?? [];
      const summary =
        sections.find(
          (s) =>
            s.includes('KONTEKSTU KAMPANII') ||
            s.includes('CAMPAIGN CONTEXT SUMMARY')
        ) ?? '';
      const fixed =
        estimate(initial.systemPrompt) +
        sections.reduce((n, s) => n + estimate(s), 0) -
        estimate(summary) +
        estimate(initial.userMessage);
      jest
        .mocked(getContextLimit)
        .mockReturnValue(
          Math.ceil((fixed + 1200 + initial.maxOutputTokens!) / 0.9)
        );
      mockStreamChat.mockClear();
      await ask(locale);
      const request = mockStreamChat.mock.calls[0][0];
      const outbound = JSON.stringify(request);
      const present = new Set(outbound.match(/MARKER_\d+/g));
      const checkpoint = ledger.getLatestCheckpoint(scope.playthroughId)!;
      expect(checkpoint.sourceMessageIds).toEqual(
        messages
          .slice(
            checkpoint.sourceStartSequence,
            checkpoint.sourceEndSequence + 1
          )
          .map((m) => m.id)
      );
      for (let i = 0; i < messages.length; i++)
        expect(present.has(`MARKER_${i}`)).toBe(true);
      expect(request.messages?.slice(-2)).toEqual(
        messages.slice(-2).map(({ role, content }) => ({ role, content }))
      );
    }
  );

  it('rejects overflow without a campaign instead of dropping older messages', async () => {
    await ask('en', messages, null);
    const initial = mockStreamChat.mock.calls[0][0];
    const fixed =
      Math.ceil(initial.systemPrompt.length / 4) +
      (initial.geminiOptions?.additionalContext ?? []).reduce(
        (n, s) => n + Math.ceil(s.length / 4),
        0
      ) +
      Math.ceil(initial.userMessage.length / 4);
    jest
      .mocked(getContextLimit)
      .mockReturnValue(
        Math.ceil((fixed + 1200 + initial.maxOutputTokens!) / 0.9)
      );
    mockStreamChat.mockClear();
    await expect(ask('en', messages, null)).rejects.toMatchObject({
      code: 'CAMPAIGN_CONTEXT_BUDGET_EXCEEDED',
    });
    expect(mockStreamChat).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    'counts active cached instructions in the real request (metadata=%s)',
    async (metadata) => {
      jest
        .mocked(resolveGeminiCache)
        .mockResolvedValue({
          name: 'synthetic-cache',
          ...(metadata ? { usageMetadata: { totalTokenCount: 30_000 } } : {}),
        });
      await ask('en');
      const initial = mockStreamChat.mock.calls[0][0];
      const cacheOpts = jest.mocked(resolveGeminiCache).mock.calls[0][0];
      const used = estimateRequestTokens(
        initial,
        [cacheOpts.eraRules, cacheOpts.gmProtocol].join('\n\n')
      );
      jest
        .mocked(getContextLimit)
        .mockReturnValue(Math.ceil((used - 300 + 1024) / 0.9));
      mockStreamChat.mockClear();
      await ask('en');
      const request = mockStreamChat.mock.calls[0][0];
      const present = new Set(JSON.stringify(request).match(/MARKER_\d+/g));
      for (let i = 0; i < messages.length; i++)
        expect(present.has(`MARKER_${i}`)).toBe(true);
    }
  );

  it.each(['offline', 'invalid-json', 'oversized', 'cooldown'])(
    'stops before narration when compression cannot fit: %s',
    async (failure) => {
      await ask('en');
      const initial = mockStreamChat.mock.calls[0][0];
      const summary = initial.geminiOptions!.additionalContext!.find((s) =>
        s.includes('CAMPAIGN CONTEXT SUMMARY')
      )!;
      const fixed =
        estimateRequestTokens({ ...initial, messages: [] }) -
        Math.ceil(summary.length / 4);
      jest
        .mocked(getContextLimit)
        .mockReturnValue(Math.ceil((fixed + 700 + 1024) / 0.9));
      if (failure === 'offline')
        compress.mockImplementationOnce(async () => {
          throw new Error('offline');
        });
      if (failure === 'invalid-json')
        compress.mockResolvedValueOnce({ text: '{bad' });
      if (failure === 'oversized')
        compress.mockResolvedValueOnce({
          text: JSON.stringify({ events: ['x'.repeat(10000)] }),
        });
      if (failure === 'cooldown')
        ledger.recordCompressionFailure(scope.playthroughId);
      mockStreamChat.mockClear();
      jest.mocked(createSseStream).mockClear();
      await expect(ask('en')).rejects.toMatchObject({
        code: 'CAMPAIGN_CONTEXT_BUDGET_EXCEEDED',
      });
      expect(mockStreamChat).not.toHaveBeenCalled();
      expect(createSseStream).not.toHaveBeenCalled();
    }
  );

  it('checks the smaller effective model before fallback', async () => {
    mockStreamChat.mockRejectedValueOnce({ status: 404 });
    jest
      .mocked(getContextLimit)
      .mockImplementation((id) =>
        id === DEFAULT_GEMINI_MODEL ? 100 : 1_048_576
      );
    await expect(ask('en')).rejects.toMatchObject({
      code: 'CAMPAIGN_CONTEXT_BUDGET_EXCEEDED',
    });
    expect(mockStreamChat).toHaveBeenCalledTimes(1);
    expect(createSseStream).not.toHaveBeenCalled();
  });

  it('checks the additional correction directive before a second narrator call', async () => {
    await ask('pl', messages.slice(-1));
    const initial = mockStreamChat.mock.calls[0][0];
    // Leave enough space for this exact request, but none for the correction.
    jest
      .mocked(getContextLimit)
      .mockReturnValue(
        Math.ceil((estimateRequestTokens(initial) + 1024 + 5) / 0.9)
      );
    mockStreamChat.mockClear();
    jest.mocked(createSseStream).mockClear();
    mockStreamChat.mockResolvedValueOnce({
      stream: (async function* () {
        yield { text: 'Alice Brown otwiera drzwi i wchodzi do środka.' };
      })(),
      getUsage: async () => null,
      getFinishReason: () => 'STOP',
    });
    await expect(ask('pl', messages.slice(-1))).rejects.toMatchObject({
      code: 'CAMPAIGN_CONTEXT_BUDGET_EXCEEDED',
    });
    expect(mockStreamChat).toHaveBeenCalledTimes(1);
    expect(createSseStream).not.toHaveBeenCalled();
  });
});
