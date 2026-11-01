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
import { dispatchWorldEngines } from '@/lib/world-engine/dispatcher';
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
const otherScope = { ...scope, playthroughId: 'other-memory-recipients-run' };
const markers = {
  alice: 'ORCHIDEA_ALICE_ONLY',
  bob: 'LILIA_BOB_ONLY',
  otherRun: 'IRYS_OTHER_RUN_ONLY',
  public: 'PUBLIC_GABINET_ONLY',
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
const bob = investigator('investigator-bob', 'Bob Green');
const npc = {
  id: 'npc-armitage',
  name: 'Henry Armitage',
  description: 'A librarian.',
  status: 'alive',
};

describe('chat pipeline campaign-memory recipients', () => {
  let directory: string;
  let ledger: CampaignMemoryLedgerStore;
  let engine: CampaignContextEngine;
  let prepareContext: jest.SpyInstance<
    ReturnType<CampaignContextEngine['prepareContext']>,
    Parameters<CampaignContextEngine['prepareContext']>
  >;

  beforeEach(() => {
    localStorage.clear();
    directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'chat-memory-recipients-')
    );
    ledger = new CampaignMemoryLedgerStore(
      path.join(directory, 'memory.sqlite3')
    );
    engine = new CampaignContextEngine(ledger);
    prepareContext = jest.spyOn(engine, 'prepareContext');
    jest.mocked(getCampaignContextEngine).mockReturnValue(engine);
    mockStreamChat.mockReset();
    mockStreamChat.mockImplementation(async () => ({
      stream: (async function* () {
        yield { text: 'The librarian waits.' };
      })(),
      getUsage: async () => null,
      getFinishReason: () => 'STOP',
    }));

    for (const [owner, marker, entryScope] of [
      [alice.id, markers.alice, scope],
      [bob.id, markers.bob, scope],
      [alice.id, markers.otherRun, otherScope],
    ] as const) {
      const text = `Armitage podał hasło do sejfu. Armitage gave the safe password: ${marker}.`;
      ledger.recordConversationTurn({
        scope: entryScope,
        sessionId: entryScope.playthroughId,
        messageId: `private-${marker}`,
        userText: 'An earlier question.',
        assistantText: text,
        recipientIds: [owner],
        facts: [
          {
            kind: 'clue',
            entityId: `password-${owner}`,
            text,
            status: 'confirmed',
            recipients: [owner],
          },
        ],
      });
    }
    ledger.recordConversationTurn({
      scope,
      sessionId: scope.playthroughId,
      messageId: 'public-fact',
      userText: 'An earlier public question.',
      assistantText: `Armitage hasło password ${markers.public}.`,
      facts: [
        {
          kind: 'clue',
          entityId: 'public-office',
          text: `Armitage hasło password ${markers.public}.`,
          status: 'confirmed',
        },
      ],
    });
  });

  afterEach(() => {
    prepareContext.mockRestore();
    ledger.close();
    fs.rmSync(directory, { recursive: true, force: true });
    localStorage.clear();
  });

  async function ask(options: {
    locale: 'pl' | 'en';
    character: Character | null;
    named?: boolean;
    npcs?: (typeof npc)[];
    memoryScope?: CampaignMemoryScope;
    hotSeat?: boolean;
  }) {
    const message =
      options.locale === 'pl'
        ? options.named === false
          ? 'Pytam o hasło do sejfu.'
          : 'Pytam Armitage o hasło do sejfu.'
        : options.named === false
          ? 'I ask about the safe password.'
          : 'I ask Armitage about the safe password.';
    const npcs = options.npcs ?? [npc];
    const decision = dispatchWorldEngines({ playerMessage: message, npcs });
    expect(decision.recipientIds).toEqual(npcs.length ? [npc.id] : []);

    const body = {
      message,
      locale: options.locale,
      character: options.character,
      characters: [alice, bob],
      npcs,
      memoryScope: options.memoryScope ?? scope,
      currentLocation: 'Library',
      // No remembered fact is present in client history, dossier or NPC data.
      messages: [
        {
          id: 'current-user',
          role: 'user',
          content: message,
          timestamp: new Date(0),
        },
      ],
      eraContext: {
        schemaVersion: 1,
        sceneDate: '1925-01-14',
        effectiveYear: 1925,
        countryCode: 'US',
        regionProfile: 'US',
        source: 'user-selection',
        rulesVersion: '1.0.0',
      },
      aiSettings: { geminiSettings: { enableCache: false } },
      ...(options.hotSeat
        ? {
            hotSeatConfig: {
              enabled: true,
              players: [
                {
                  id: 'player-alice',
                  characterId: alice.id,
                  characterName: alice.name,
                },
                {
                  id: 'player-bob',
                  characterId: bob.id,
                  characterName: bob.name,
                },
              ],
            },
          }
        : {}),
    };
    for (const marker of Object.values(markers))
      expect(JSON.stringify(body)).not.toContain(marker);
    const request = {
      headers: {
        get: (name: string) =>
          name === 'X-Gemini-Api-Key' ? 'synthetic-test-key' : null,
      },
    } as unknown as NextRequest;
    const response = await runChatPipeline({
      request,
      body,
      traceId: 'memory-recipients',
      timer: { elapsed: () => 0 },
    });
    expect(response.status).toBe(200);
    expect(mockStreamChat).toHaveBeenCalledTimes(1);
    const context =
      mockStreamChat.mock.calls[0][0].geminiOptions?.additionalContext?.join(
        '\n'
      ) ?? '';
    return {
      context,
      recipients: prepareContext.mock.calls[0][0].recipientIds,
    };
  }

  describe.each(['pl', 'en'] as const)('%s', (locale) => {
    it('recalls the active investigator fact when the NPC is named', async () => {
      const { context, recipients } = await ask({ locale, character: alice });
      expect(context).toContain(markers.alice);
      expect(context).not.toContain(markers.bob);
      expect(context).not.toContain(markers.otherRun);
      expect(context).toContain(markers.public);
      expect(recipients).toEqual([alice.id]);
    });

    it('recalls the investigator fact when the dispatcher selects the interlocutor implicitly', async () => {
      const { context, recipients } = await ask({
        locale,
        character: alice,
        named: false,
      });
      expect(context).toContain(markers.alice);
      expect(context).not.toContain(markers.bob);
      expect(recipients).toEqual([alice.id]);
    });

    it('preserves recall without an NPC', async () => {
      const { context, recipients } = await ask({
        locale,
        character: alice,
        npcs: [],
        named: false,
      });
      expect(context).toContain(markers.alice);
      expect(context).not.toContain(markers.bob);
      expect(recipients).toEqual([alice.id]);
    });

    it('uses Bob in Hot Seat even while Alice remains first in the party', async () => {
      const { context, recipients } = await ask({
        locale,
        character: bob,
        hotSeat: true,
      });
      expect(context).toContain(markers.bob);
      expect(context).not.toContain(markers.alice);
      expect(context).not.toContain(markers.otherRun);
      expect(recipients).toEqual([bob.id]);
    });

    it('keeps public facts without guessing a private audience when no investigator is active', async () => {
      const { context, recipients } = await ask({ locale, character: null });
      expect(context).toContain(markers.public);
      expect(context).not.toContain(markers.alice);
      expect(context).not.toContain(markers.bob);
      expect(recipients).toEqual([]);
    });

    it('does not retrieve facts from another playthrough', async () => {
      const { context, recipients } = await ask({
        locale,
        character: alice,
        memoryScope: otherScope,
      });
      expect(context).toContain(markers.otherRun);
      expect(context).not.toContain(markers.alice);
      expect(context).not.toContain(markers.bob);
      expect(context).not.toContain(markers.public);
      expect(recipients).toEqual([alice.id]);
    });
  });
});
