import { TextEncoder } from 'node:util';
import type { NextRequest } from 'next/server';
import type { ChatCompletionRequest, StreamingChatResult } from '@/lib/ai-providers/types';
import { STREFA_11_ADVENTURES } from '@/lib/adventures-data';
import { runChatPipeline } from './run-chat-pipeline';
import { createSseStream } from './create-sse-stream';

const mockStreamChat = jest.fn<Promise<StreamingChatResult>, [ChatCompletionRequest]>();
Object.assign(globalThis, { TextEncoder, Response: class { status = 200; } });
jest.mock('next/server', () => ({ NextResponse: { json: (body: unknown, init?: ResponseInit) => ({ status: init?.status ?? 200, json: async () => body }) } }));
jest.mock('@/lib/ai-providers', () => ({ GeminiChatProvider: jest.fn(() => ({ streamChat: mockStreamChat })) }));
jest.mock('@/lib/embedding-service', () => ({ getEmbeddingDimensions: () => 1024 }));
jest.mock('./resolve-gemini-cache', () => ({ resolveGeminiCache: jest.fn(async () => null) }));
jest.mock('./run-rag-summary', () => ({ runRAGAndSummary: jest.fn(async () => ({ ragSection: '', summarySection: null, ragMeta: null, contextMessages: [], campaignMemorySection: '' })) }));
jest.mock('./build-immersion-context', () => ({ fetchImmersionContext: jest.fn(async () => '') }));
jest.mock('@/core/memory/context-engine', () => ({ fitContext: (context: unknown) => context }));
jest.mock('./create-sse-stream', () => ({ createSseStream: jest.fn() }));
jest.mock('@/lib/auth-user', () => ({ resolveUserId: async () => 'opening-test', scopeSessionId: () => 'opening-test' }));

const adventure = STREFA_11_ADVENTURES.find(a => a.id === 'cien-nad-prabutami')!;
const place = "Redakcja 'Sygnałów Nieznanego' (RTV Warszawa)";
function draft(text: string): StreamingChatResult {
  return { stream: (async function* () { yield { text }; })(), getUsage: async () => null, getFinishReason: () => 'STOP' };
}
async function start(locale: 'pl' | 'en', isGameStart = true, hotSeat = false) {
  const request = { headers: { get: (name: string) => name === 'X-Gemini-Api-Key' ? 'synthetic-opening-test' : null } } as unknown as NextRequest;
  return runChatPipeline({ request, traceId: 'opening-test', timer: { elapsed: () => 0 }, body: {
    message: 'Zaczynamy przygodę', messages: [], locale, isGameStart,
    currentLocation: 'Elbląg', activeNodeId: 'node-elblag-klasztor',
    adventureContext: { ...adventure, activeNodeId: 'node-elblag-klasztor' },
    aiSettings: { geminiSettings: { enableCache: false } },
    ...(hotSeat ? { hotSeatConfig: { enabled: true, players: [{ name: 'Alice' }, { name: 'Bob' }] } } : {}),
  } });
}
describe('opening gate before SSE and campaign-memory writes', () => {
  beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); mockStreamChat.mockReset(); });
  it.each(['pl', 'en'] as const)('%s: blocks the exact Elblag regression before publishing anything', async locale => {
    mockStreamChat.mockResolvedValue(draft('[LOKACJA: Klasztor w Elblągu | Zimno.] Czwartkowy zmierzch nad Elblągiem.'));
    const response = await start(locale);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'OPENING_LOCATION_MISMATCH' });
    expect(createSseStream).not.toHaveBeenCalled();
    expect(mockStreamChat.mock.calls[0][0].geminiOptions?.additionalContext?.join('\n')).toContain(place);
  });
  it.each(['pl', 'en'] as const)('%s: publishes a valid solo or Hot Seat opening', async locale => {
    mockStreamChat.mockResolvedValue(draft(`[${locale === 'en' ? 'LOCATION' : 'LOKACJA'}: ${place} | Dym.] Helena czeka.`));
    const response = await start(locale, true, locale === 'en');
    expect(response.status).toBe(200);
    expect(createSseStream).toHaveBeenCalledTimes(1);
  });
  it('does not relocate subsequent turns or resumed games', async () => {
    mockStreamChat.mockResolvedValue(draft('[LOKACJA: Elbląg | Zimno.]'));
    expect((await start('pl', false)).status).toBe(200);
    expect(createSseStream).toHaveBeenCalledTimes(1);
    expect(mockStreamChat.mock.calls[0][0].geminiOptions?.additionalContext?.join('\n')).not.toContain('OBOWIĄZKOWA SCENA OTWARCIA');
  });
  it('also checks the final draft after agency retry', async () => {
    mockStreamChat.mockResolvedValueOnce(draft(`[LOKACJA: ${place} | Dym.] Wchodzisz do gabinetu.`))
      .mockResolvedValueOnce(draft('[LOKACJA: Elbląg | Fog.]'));
    // The existing linter sees this explicit player movement and regenerates the draft.
    const response = await start('pl');
    expect(response.status).toBe(422);
    expect(mockStreamChat).toHaveBeenCalledTimes(2);
    expect(createSseStream).not.toHaveBeenCalled();
  });
});


beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); mockStreamChat.mockReset(); });

it.each(['MAX_TOKENS', undefined])('rejects an incomplete opening (%s) before SSE or memory finalization', async reason => {
  mockStreamChat.mockResolvedValue({ ...draft('Helena waits at her desk.'), getFinishReason: () => reason });
  await expect(start('pl')).rejects.toThrow('OPENING_TEXT_INCOMPLETE');
  expect(createSseStream).not.toHaveBeenCalled();
});

it('rejects a mid-stream timeout before publishing or committing a partial opening', async () => {
  mockStreamChat.mockResolvedValue({stream: (async function* () {
    yield {text: 'Partial opening.'}; throw new Error('GEMINI_REQUEST_TIMEOUT');
  })(), getUsage: async () => null, getFinishReason: () => undefined });
  await expect(start('pl')).rejects.toThrow('GEMINI_REQUEST_TIMEOUT');
  expect(createSseStream).not.toHaveBeenCalled();
});
