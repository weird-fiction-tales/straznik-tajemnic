import { createSseStream } from './create-sse-stream';
import { TextDecoder, TextEncoder } from 'node:util';
import { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { parseAIResponse } from '@/lib/response-parser';
import { logApiEvent } from '@/lib/telemetry';
import type { ParsedResponse } from '@/lib/parsers/types';
import type { StreamChunk } from '@/lib/ai-providers/types';
import { updateDirectorState } from '@/lib/director-state';
import { commitMemoryTurn } from '@/core/memory/commit-turn';
import { conversationMemory } from '@/lib/vector-db/conversation-memory';

Object.assign(globalThis, {
  TextDecoder,
  TextEncoder,
  ReadableStream: NodeReadableStream,
});

jest.mock('@/lib/response-parser', () => ({
  parseAIResponse: jest.fn(),
}));

jest.mock('@/lib/telemetry', () => ({
  logApiEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/vector-db/conversation-memory', () => ({
  conversationMemory: { saveConversationTurn: jest.fn().mockResolvedValue({ success: true }) },
}));

jest.mock('@/lib/director-state', () => ({
  updateDirectorState: jest.fn(),
}));

jest.mock('@/lib/user-usage', () => ({
  recordUserUsage: jest.fn().mockResolvedValue(undefined),
}));

const mockRecordCompletedTurn = jest.fn();
const mockStageDossierTurn = jest.fn();
jest.mock('@/core/memory/commit-turn', () => ({
  commitMemoryTurn: (turn:unknown) => mockRecordCompletedTurn(turn),
  retainFailedTurn:jest.fn(()=>'retry-token'),
  stageDossierTurn:(commit:unknown)=>mockStageDossierTurn(commit),
}));

function parsedResponse(rawText: string): ParsedResponse {
  return {
    events: [],
    combat: null,
    dialogues: [],
    illustrations: [],
    sfx: [],
    journalEntries: [],
    skillTests: [],
    skillResults: [],
    meleeAttacks: [],
    equipmentEvents: [],
    timeUpdate: null,
    rawText,
  };
}

async function* streamChunks(...texts: string[]): AsyncGenerator<StreamChunk> {
  for (const text of texts) {
    yield { text };
  }
}

async function readStream(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) return output;
    output += decoder.decode(value, { stream: true });
  }
}

describe('createSseStream', () => {
  beforeEach(() => {
    jest.mocked(parseAIResponse).mockImplementation(parsedResponse);
    jest.mocked(logApiEvent).mockClear();
    jest.mocked(conversationMemory.saveConversationTurn).mockClear();
    mockRecordCompletedTurn.mockClear();
  });

  it('returns only the dossier clue IDs retrieved for this turn in SSE metadata', async () => {
    const stream = createSseStream({
      providerStream: streamChunks('A clue is revealed.'),
      getUsage: async () => null,
      getFinishReason: () => 'STOP',
      message: 'Investigate the archive.',
      modelId: 'gemini-test',
      traceId: 'trace-dossier',
      timer: { elapsed: () => 0 },
      embeddingDim: 768,
      ragVersion: 'v1',
      userId: 'local',
      dossierClueRecordIds: ['dossier.clue.archive'],
      dossierHandoutRecordIds: ['dossier.handout.archive-letter'],
    });

    const events = (await readStream(stream))
      .trim()
      .split('\n\n')
      .map((event) => JSON.parse(event.slice('data: '.length)) as Record<string, unknown>);

    expect(events.at(-1)).toMatchObject({
      type: 'metadata',
      dossierClueRecordIds: ['dossier.clue.archive'],
      dossierHandoutRecordIds: ['dossier.handout.archive-letter'],
    });
  });

  it('reports failed durable memory while retaining the streamed narration and a retry token', async () => {
    mockRecordCompletedTurn.mockImplementationOnce(() => { throw new Error('disk failure'); });
    const stream = createSseStream({
      providerStream: streamChunks('Narration survives.'), getUsage: async () => null,
      getFinishReason: () => 'STOP', sessionId: 'run-one', message: 'Look',
      modelId: 'gemini-test', traceId: 'trace-test', timer: { elapsed: () => 0 },
      ragVersion: 'v1', embeddingDim: 768, userId: 'local', assistantMessageId: 'assistant-failure',
      memoryScope: { schemaVersion: 1, campaignDefinitionId: 'c', playthroughId: 'run-one', adventureId: 'a', kind: 'custom' },
    });
    const output = await readStream(stream);
    expect(output).toContain('Narration survives.');
    expect(output).toContain('"status":"failed"');
    expect(output).toContain('"retryToken":"retry-token"');
    expect(output).not.toContain('"status":"saved"');
  });

  it.each([
    ['MAX_TOKENS', 'MAX_TOKENS'],
    ['STOP', 'STOP'],
    ['brak finishReason', undefined],
  ])(
    'dodaje %s do końcowych metadanych bez utraty częściowego tekstu',
    async (_label, finishReason) => {
      const getFinishReason = jest.fn(() => finishReason);
      const stream = createSseStream({
        providerStream: streamChunks('Urwany ', 'fragment'),
        getUsage: async () => ({
          totalTokens: 62,
          thinkingTokens: 20,
          promptTokens: 12,
          completionTokens: 30,
          model: 'gemini-test',
        }),
        getFinishReason,
        message: 'Kontynuuj scenę.',
        modelId: 'gemini-test',
        traceId: 'trace-test',
        timer: { elapsed: () => 123 },
        embeddingDim: 768,
        ragVersion: 'v1',
        userId: 'local',
      });

      const events = (await readStream(stream))
        .trim()
        .split('\n\n')
        .map((event) => JSON.parse(event.slice('data: '.length)) as Record<string, unknown>);

      expect(events).toEqual(
        expect.arrayContaining([
          { type: 'text', content: 'Urwany ' },
          { type: 'text', content: 'fragment' },
        ])
      );

      const metadata = events.at(-1);
      expect(metadata).toMatchObject({ type: 'metadata' });
      if (finishReason) {
        expect(metadata).toMatchObject({
          finishReason,
          telemetry: { finishReason },
        });
      } else {
        expect(metadata).not.toHaveProperty('finishReason');
        expect(metadata).not.toHaveProperty('telemetry.finishReason');
      }
      expect(getFinishReason).toHaveBeenCalledTimes(1);
      expect(logApiEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          costUsd: expect.closeTo(0.0000318, 10),
          meta: expect.objectContaining({ finishReason: finishReason ?? null, thinkingTokens: 20 }),
        })
      );
    }
  );

  it('records only revealed narration and structured revealed facts', async () => {
    jest.mocked(parseAIResponse).mockReturnValue({
      ...parsedResponse('raw'),
      events: [{ type: 'location', title: 'Hotel', description: 'Hol hotelowy', timestamp: new Date().toISOString() }],
      journalEntries: [{ type: 'clue', title: 'List', content: 'Elias wskazał Londyn.' }],
    });
    const stream = createSseStream({
      providerStream: streamChunks('Widzisz list. [LOKACJA: Hotel: Hol hotelowy] [DZIENNIK:clue:List]Elias wskazał Londyn.[/DZIENNIK] [SEKRETY_MG]Kultysta żyje.[/SEKRETY_MG]'),
      getUsage: async () => null,
      getFinishReason: () => 'STOP',
      sessionId: 'run-one',
      message: 'Czytam list.',
      modelId: 'gemini-test',
      traceId: 'trace-memory',
      timer: { elapsed: () => 1 },
      embeddingDim: 768,
      ragVersion: 'v1',
      userId: 'local',
      assistantMessageId: 'assistant-one',
      memoryScope: {
        schemaVersion: 1,
        campaignDefinitionId: 'masks-of-nyarlathotep',
        playthroughId: 'run-one',
        adventureId: 'peru',
        kind: 'official',
      },
    });
    await readStream(stream);
    expect(mockRecordCompletedTurn).toHaveBeenCalledWith(expect.objectContaining({
      assistantText: 'Widzisz list.',
      facts: expect.arrayContaining([
        expect.objectContaining({ kind: 'location', text: 'Hotel: Hol hotelowy' }),
        expect.objectContaining({ kind: 'clue', text: 'Elias wskazał Londyn.' }),
      ]),
    }));
    expect(conversationMemory.saveConversationTurn).not.toHaveBeenCalled();
  });

  it('does not derive campaign facts from a hidden secret block', async () => {
    jest.mocked(parseAIResponse).mockImplementation((text) => ({
      ...parsedResponse(text),
      events: text.includes('Tajna krypta')
        ? [{ type: 'location', title: 'Krypta', description: 'Tajna krypta', timestamp: new Date().toISOString() }]
        : [],
    }));
    const stream = createSseStream({
      providerStream: streamChunks('Drzwi są zamknięte. [SEKRETY_MG][LOKACJA: Krypta: Tajna krypta][/SEKRETY_MG]'),
      getUsage: async () => null,
      getFinishReason: () => 'STOP',
      sessionId: 'run-one',
      message: 'Oglądam drzwi.',
      modelId: 'gemini-test',
      traceId: 'trace-hidden-fact',
      timer: { elapsed: () => 1 },
      embeddingDim: 768,
      ragVersion: 'v1',
      userId: 'local',
      assistantMessageId: 'assistant-hidden-fact',
      memoryScope: {
        schemaVersion: 1,
        campaignDefinitionId: 'masks-of-nyarlathotep',
        playthroughId: 'run-one',
        adventureId: 'peru',
        kind: 'official',
      },
    });
    await readStream(stream);
    expect(mockRecordCompletedTurn).toHaveBeenCalledWith(expect.objectContaining({
      assistantText: 'Drzwi są zamknięte.',
      facts: [],
    }));
  });

  it('records the full player utterance even when the provider returns no text', async () => {
    const stream = createSseStream({
      providerStream: streamChunks(),
      getUsage: async () => null,
      getFinishReason: () => 'STOP',
      sessionId: 'run-one',
      message: 'Przeszukuję pusty pokój bardzo dokładnie.',
      modelId: 'gemini-test',
      traceId: 'trace-empty-response',
      timer: { elapsed: () => 1 },
      embeddingDim: 768,
      ragVersion: 'v1',
      userId: 'local',
      assistantMessageId: 'assistant-empty',
      userMessageId: 'user-empty',
      memoryScope: {
        schemaVersion: 1,
        campaignDefinitionId: 'masks-of-nyarlathotep',
        playthroughId: 'run-one',
        adventureId: 'peru',
        kind: 'official',
      },
    });
    await readStream(stream);
    expect(mockRecordCompletedTurn).toHaveBeenCalledWith(expect.objectContaining({
      userMessageId: 'user-empty',
      userText: 'Przeszukuję pusty pokój bardzo dokładnie.',
      assistantText: '',
    }));
  });

  it('emituje wyłącznie wzbogacony, zaufany atak wręcz w metadanych', async () => {
    jest.mocked(parseAIResponse).mockReturnValue({
      ...parsedResponse('Atak'),
      meleeAttacks: [{
        attackerNpcId: 'npc-1',
        targetCharacterName: 'Anna',
        attackOptionId: 'fist',
        intent: 'cios',
      }],
    });
    const stream = createSseStream({
      providerStream: streamChunks('Atak'),
      getUsage: async () => null,
      getFinishReason: () => 'STOP',
      message: 'Czekam.',
      modelId: 'gemini-test',
      traceId: 'trace-combat',
      timer: { elapsed: () => 1 },
      embeddingDim: 768,
      ragVersion: 'v1',
      userId: 'local',
      assistantMessageId: 'assistant-1',
      combatMechanicsEnabled: true,
      characters: [{ id: 'char-1', name: 'Anna', hp: 10, maxHp: 10, skills: {} } as never],
      npcs: [{
        id: 'npc-1', name: 'Kultysta', str: 50, siz: 50, hp: 10, maxHp: 10,
        skills: { 'Walka Wręcz': 50 },
        combatProfile: {
          schemaVersion: 1,
          attacksPerRound: 1,
          attackOptions: [{
            kind: 'natural', attackOptionId: 'fist', name: 'Pięść',
            combatSkillId: 'Walka Wręcz', skillValue: 50,
            damageFormula: '1d3', damageClass: 'non_impaling',
          }],
        },
      } as never],
    });

    const events = (await readStream(stream)).trim().split('\n\n')
      .map((event) => JSON.parse(event.slice('data: '.length)) as Record<string, unknown>);
    expect(events.at(-1)).toMatchObject({
      pendingMeleeAttacks: [{
        eventId: 'assistant-1:melee:0',
        target: { characterId: 'char-1' },
        weapon: { damageFormula: '1d3' },
      }],
    });
  });
});


test('dossier SSE stages memory and director until local effects are accepted', async () => {
  mockStageDossierTurn.mockReturnValue('volatile-token');
  mockRecordCompletedTurn.mockClear();
  jest.mocked(updateDirectorState).mockClear();
  jest.mocked(parseAIResponse).mockImplementation(text => ({...parsedResponse(text), gmMetadata: {tone:'quiet'} as ParsedResponse['gmMetadata']}));
  const stream = createSseStream({providerStream:streamChunks('An unverified consequence.'),getUsage:async()=>null,
    getFinishReason:()=> 'STOP',message:'Act',modelId:'test',traceId:'staged-test',timer:{elapsed:()=>0},
    embeddingDim:768,ragVersion:'v1',userId:'local',sessionId:'s',deferDossierFinalization:true,
    memoryScope:{schemaVersion:1,campaignDefinitionId:'c',playthroughId:'p',adventureId:'a',kind:'custom'}});
  const text = await readStream(stream);
  expect(text).toContain('"dossierFinalizationToken":"volatile-token"');
  expect(mockRecordCompletedTurn).not.toHaveBeenCalled();
  expect(updateDirectorState).not.toHaveBeenCalled();
  expect(mockStageDossierTurn).toHaveBeenCalledTimes(1);
  expect(mockStageDossierTurn.mock.calls[0][0]).toMatchObject({
    turn:{assistantText:'An unverified consequence.',messageId:'staged-test'},
    director:{sessionId:'s'},
  });
});
