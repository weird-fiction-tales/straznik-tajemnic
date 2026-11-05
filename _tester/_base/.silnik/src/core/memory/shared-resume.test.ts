import fs from 'fs';
import os from 'os';
import path from 'path';
import { CampaignMemoryLedgerStore } from './ledger-store';
import { CampaignContextEngine } from './context-engine';
import { searchCampaignMemory } from './retrieval';
import { publicMemoryText, SHARED_KNOWLEDGE_POLICY } from './knowledge-policy';
import { getGeminiClient } from '@/lib/gemini-client-pool';
import type { CampaignMemoryScope } from './types';
import type { Message } from '@/lib/types';

jest.mock('@/lib/gemini-client-pool', () => ({ getGeminiClient: jest.fn() }));
jest.mock('@/lib/embedding-service', () => ({ embeddingService: { generateEmbedding: jest.fn(async () => null) }, getEmbeddingDimensions: () => 2 }));
jest.mock('@/lib/vector-db/local-vector-store', () => ({ localVectorStore: { query: jest.fn(async () => []) } }));
const scope: CampaignMemoryScope = { schemaVersion: 1, kind: 'custom', campaignDefinitionId: 'neutral', playthroughId: 'party', adventureId: 'archive' };

describe('shared revealed knowledge across resume', () => {
  let dir: string;
  let ledger: CampaignMemoryLedgerStore;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-resume-'));
    ledger = new CampaignMemoryLedgerStore(path.join(dir, 'memory.sqlite3'));
    jest.clearAllMocks();
  });
  afterEach(() => { ledger.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  it.each(['pl', 'en'] as const)('restores %s evidence after restart without future discoveries', async locale => {
    const text = locale === 'pl' ? 'Orchid: klucz jest w archiwum.' : 'Orchid: the key is in the archive.';
    ledger.recordConversationTurn({ scope, sessionId: 'first', messageId: 'answer', userMessageId: 'question', userText: 'Orchid?', assistantText: text,
      facts: [{ kind: 'clue', entityId: 'key', text, status: 'confirmed', recipients: ['alice'] }] });
    const snapshot = ledger.createSnapshot(scope, [{ id: 'question', role: 'user', content: 'Orchid?' }, { id: 'answer', role: 'assistant', content: text }]);
    ledger.recordConversationTurn({ scope, sessionId: 'later', messageId: 'future', userText: 'More?', assistantText: 'Future-only observatory', facts: [{ kind: 'clue', text: 'Future-only observatory' }] });
    ledger.close();
    ledger = new CampaignMemoryLedgerStore(path.join(dir, 'memory.sqlite3'));
    const restored = ledger.restoreSnapshot(snapshot, 'load-once');
    expect(ledger.restoreSnapshot(snapshot, 'load-once')).toEqual(restored);
    expect(restored.playthroughId).not.toBe(scope.playthroughId);
    const result = await searchCampaignMemory(restored, 'Orchid', ledger, { recipientIds: ['bob'], queryEmbedding: null, locale });
    expect(result.promptSection).toContain(text);
    expect(result.results.find(e => e.entityId === 'key')?.recipients).toEqual(['alice']);
    expect(JSON.stringify(ledger.list(restored))).not.toContain('Future-only');
  });

  it.each([
    '[KEEPER_SECRETS]HIDDEN[/KEEPER_SECRETS]',
    '[KEEPER_SECRETS]HIDDEN [JOURNAL:clue:Hidden]HIDDEN[/JOURNAL][/KEEPER_SECRETS]',
    '[KEEPER_SECRETS]HIDDEN',
    '[GM_THOUGHTS:HIDDEN [JOURNAL:clue:Hidden]HIDDEN[/JOURNAL]]',
  ])('removes private blocks before any context path: %s', secret => {
    expect(publicMemoryText('Visible. ' + secret)).toBe('Visible.');
  });

  it('sanitizes related facts even when the query does not match them', async () => {
    ledger.append({ id: 'related', scope, sessionId: 's', sequence: 1, entityId: 'room',
      kind: 'clue', role: 'assistant', text: 'Visible key. [KEEPER_SECRETS]HIDDEN[/KEEPER_SECRETS]',
      sourceMessageIds: ['m'], tags: [], revealedAt: new Date(0).toISOString(), active: true });
    const result = await searchCampaignMemory(scope, 'unrelatedquery', ledger, { queryEmbedding: null, sceneEntityIds: ['room'] });
    expect(result.promptSection).toContain('Visible key.');
    expect(result.promptSection).not.toContain('HIDDEN');
  });

  it.each(['valid', 'unknown', 'malformed'])('uses canonical facts for %s selection and never stores generated claims', async mode => {
    const messages: Message[] = Array.from({ length: 44 }, (_, i) => ({ id: `m${i}`, role: i % 2 ? 'assistant' : 'user', content: `Visible ${i} ${'x'.repeat(100)}`, timestamp: new Date(0) }));
    ledger.append({ id: 'known', scope, sessionId: 'first', sequence: 1, kind: 'clue', role: 'assistant', entityId: 'orchid', text: 'Orchid is disproven. [KEEPER_SECRETS]HIDDEN[/KEEPER_SECRETS]', status: 'disproven', recipients: ['alice'], sourceMessageIds: ['m20'], tags: [], revealedAt: new Date(0).toISOString(), active: true });
    const generateContent = jest.fn(async (request: { contents: string }) => {
      expect(request.contents).not.toContain('HIDDEN');
      return { text: mode === 'malformed' ? 'INVENTED invalid JSON' : JSON.stringify({ sourceIds: [mode === 'valid' ? 'known' : 'unknown'], events: ['INVENTED'] }) };
    });
    jest.mocked(getGeminiClient).mockReturnValue({ models: { generateContent } } as unknown as NonNullable<ReturnType<typeof getGeminiClient>>);
    const input = { messages, modelId: 'test', apiKey: 'key', scope, locale: 'en' as const, query: 'Orchid', availableContextTokens: 60000 };
    const engine = new CampaignContextEngine(ledger);
    const first = await engine.prepareContext({ ...input, recipientIds: ['alice'] });
    expect(first.summarySection).toContain('Orchid is disproven.');
    expect(first.summarySection).not.toMatch(/INVENTED|HIDDEN/);
    expect(ledger.getLatestCheckpoint(scope.playthroughId)?.knowledgePolicy).toBe(SHARED_KNOWLEDGE_POLICY);
    ledger.recordConversationTurn({ scope, sessionId: 'next', messageId: 'next', userText: 'Continue', assistantText: 'The wind blows.' });
    const second = await engine.prepareContext({ ...input, recipientIds: ['bob'] });
    expect(second.summarySection).toEqual(first.summarySection);
    expect(generateContent).toHaveBeenCalledTimes(1);
    ledger.recordConversationTurn({ scope, sessionId: 'next', messageId: 'correction', userText: 'Verify', assistantText: 'Orchid replaced.',
      facts: [{ kind: 'clue', entityId: 'orchid', text: 'Orchid replaced.', status: 'superseded', recipients: ['bob'] }] });
    const corrected = await engine.prepareContext({ ...input, recipientIds: ['alice'] });
    expect(corrected.summarySection ?? '').not.toContain('Orchid is disproven.');
    expect(corrected.memorySection).toContain('Orchid replaced.');
    expect(generateContent).toHaveBeenCalledTimes(2);
    ledger.close();
    ledger = new CampaignMemoryLedgerStore(path.join(dir, 'memory.sqlite3'));
    expect(ledger.getLatestCheckpoint(scope.playthroughId)?.knowledgePolicy).toBe(SHARED_KNOWLEDGE_POLICY);
    expect(JSON.stringify(ledger.list(scope))).not.toContain('INVENTED');
  });
});
