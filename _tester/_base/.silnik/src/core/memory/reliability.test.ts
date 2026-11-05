import fs from 'fs';
import os from 'os';
import path from 'path';
import { CampaignMemoryLedgerStore } from './ledger-store';
import { searchCampaignMemory } from './retrieval';
import { buildLegacySnapshot, validateMemorySnapshot } from './snapshot';
import { extractRevealedTurn } from './revealed-facts';
import type { CampaignMemoryScope } from './types';
import type { Character } from '@/lib/types';
import { localVectorStore } from '@/lib/vector-db/local-vector-store';

jest.mock('@/lib/embedding-service', () => ({ embeddingService: { generateEmbedding: jest.fn(async () => null) }, getEmbeddingDimensions: () => 2 }));
jest.mock('@/lib/vector-db/local-vector-store', () => ({ localVectorStore: { query: jest.fn(async () => []) } }));

const scope: CampaignMemoryScope = { schemaVersion: 1, campaignDefinitionId: 'campaign', playthroughId: 'run-benchmark', adventureId: 'peru', kind: 'custom' };
const character: Character = {
  id: 'alice', name: 'Alice Brown', str: 50, dex: 50, con: 50, app: 50, pow: 50,
  edu: 50, siz: 50, int: 70, luck: 50, hp: 10, san: 50, mp: 10, skills: {},
  occupation: 'Detektyw', age: 35, background: '', playerName: 'Test', isActive: true,
  lastUsed: new Date(0), notes: '', experience: { totalXP: 0, availableXP: 0, earnedThisSession: 0, maxEarnedThisSession: 10 }, developmentHistory: [], journal: [],
};

// Fixed bilingual lexical baseline. These measure named-evidence recall, not
// embedding quality or free-form paraphrases; no external model is called.
const cases = [
  ['Elias', 'Elias zostawił list w hotelu.', 'Elias left a letter at the hotel.'],
  ['Carlyle', 'Carlyle zamówił bilet do portu.', 'Carlyle booked a ticket to the port.'],
  ['Armitage', 'Armitage schował klucz w szufladzie.', 'Armitage hid the key in a drawer.'],
  ['Corbitt', 'Corbitt kupił dom nad rzeką.', 'Corbitt bought the house by the river.'],
  ['Vance', 'Vance widziała samochód o północy.', 'Vance saw the car at midnight.'],
  ['Blackwood', 'Blackwood podpisał rachunek.', 'Blackwood signed the receipt.'],
  ['Miskatonic', 'Miskatonic przechowuje katalog ksiąg.', 'Miskatonic keeps the book catalogue.'],
  ['Arkham', 'Arkham figuruje na odwrocie fotografii.', 'Arkham appears on the back of the photograph.'],
  ['Dunwich', 'Dunwich zaznaczono czerwonym atramentem.', 'Dunwich is marked in red ink.'],
  ['Innsmouth', 'Innsmouth wysłało telegram o sztormie.', 'Innsmouth sent a telegram about the storm.'],
  ['Kingsport', 'Kingsport zamknęło latarnię.', 'Kingsport closed the lighthouse.'],
  ['Lavinia', 'Lavinia zgubiła srebrny medalion.', 'Lavinia lost a silver locket.'],
  ['Wilbur', 'Wilbur przyniósł pustą skrzynię.', 'Wilbur brought an empty crate.'],
  ['Pickman', 'Pickman wynajął pracownię.', 'Pickman rented a studio.'],
  ['Delapore', 'Delapore sprzedał stary zegar.', 'Delapore sold an old clock.'],
  ['Peaslee', 'Peaslee zanotował datę zaćmienia.', 'Peaslee recorded the eclipse date.'],
  ['Gilman', 'Gilman zostawił otwarte okno.', 'Gilman left the window open.'],
  ['Keane', 'Keane przesunęła spotkanie na wtorek.', 'Keane moved the meeting to Tuesday.'],
  ['Marsh', 'Marsh ukrył dziennik okrętowy.', 'Marsh hid the ship log.'],
  ['Orne', 'Orne odebrał paczkę z dworca.', 'Orne collected a parcel from the station.'],
] as const;

describe('memory reliability with real SQLite', () => {
  let directory: string;
  let ledger: CampaignMemoryLedgerStore;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-reliability-'));
    ledger = new CampaignMemoryLedgerStore(path.join(directory, 'test.sqlite3'));
    jest.mocked(localVectorStore.query).mockResolvedValue([]);
  });
  afterEach(() => { ledger.close(); fs.rmSync(directory, { recursive: true, force: true }); });

  it.each(['pl', 'en'] as const)('retrieves all 20 fixed %s cases across chapters after restart', async locale => {
    for (const [index, [name, pl, en]] of cases.entries()) {
      ledger.recordConversationTurn({ scope, sessionId: 's', messageId: `m${index}`, userText: 'Sprawdzam dokument.', assistantText: locale === 'pl' ? pl : en,
        facts: [{ kind: 'clue', entityId: name, text: locale === 'pl' ? pl : en, status: 'confirmed' }] });
    }
    ledger.close();
    ledger = new CampaignMemoryLedgerStore(path.join(directory, 'test.sqlite3'));
    let hits = 0;
    for (const [name] of cases) {
      const result = await searchCampaignMemory({ ...scope, adventureId: 'london' }, locale === 'pl' ? `Co wiadomo o ${name}?` : `What do we know about ${name}?`, ledger, { queryEmbedding: null, locale });
      if (result.results.some(e => e.entityId === name)) hits++;
      expect(result.results.length).toBeLessThanOrEqual(8);
      expect(Math.ceil(result.promptSection.length / 4)).toBeLessThanOrEqual(1200);
    }
    expect(hits).toBe(20);
  });

  it('shares an attributed discovery with the whole party', async () => {
    const other = { ...character, id: 'bob', name: 'Bob Green' };
    const turn = extractRevealedTurn('[JOURNAL:@Alice:clue:Password]Orchid opens the safe.[/JOURNAL]', 'private', [character, other], character);
    // Simulate an older ledger that copied a private tag into public narration.
    ledger.recordConversationTurn({ scope, sessionId: 's', messageId: 'private', userText: 'Listen', assistantText: 'Orchid opens the safe.', facts: turn.facts });
    expect((await searchCampaignMemory(scope, 'Orchid', ledger, { queryEmbedding: null, recipientIds: ['bob'] })).promptSection).toContain('Orchid');
    expect((await searchCampaignMemory(scope, 'Orchid', ledger, { queryEmbedding: null, recipientIds: ['alice'] })).promptSection).toContain('Orchid');
  });

  it('rejects orphan vectors and does not resurrect refuted conversation text', async () => {
    ledger.recordConversationTurn({ scope, sessionId: 's', messageId: 'old', userText: 'Pytam', assistantText: 'Alibi dozorcy', facts: [{ kind: 'clue', entityId: 'alibi', text: 'Alibi dozorcy', status: 'confirmed' }] });
    ledger.recordConversationTurn({ scope, sessionId: 's', messageId: 'new', userText: 'Weryfikuję', assistantText: 'Dozorca kłamał', facts: [{ kind: 'clue', entityId: 'alibi', text: 'Alibi dozorcy', status: 'disproven' }] });
    jest.mocked(localVectorStore.query).mockResolvedValue([{ id: 'orphan', text: 'Secret', score: 1, metadata: { contentType: 'clue', summary: '', gameTimestamp: '', realTimestamp: '', tags: '', sessionId: '', messageRange: '' } }]);
    const result = await searchCampaignMemory(scope, 'Alibi', ledger, { queryEmbedding: [1, 0] });
    expect(result.results.some(e => e.id.includes('old:assistant') || e.id === 'orphan')).toBe(false);
    expect(result.results.find(e => e.entityId === 'alibi')?.status).toBe('disproven');
    expect(result.promptSection).toContain('obalone');
  });

  it('imports dossier-only evidence and corrections but excludes Keeper secrets', () => {
    const savedCharacter: Character = { ...character, investigatorDossier: {
      clues: [
        { id: 'known', title: 'Alibi', description: 'False testimony', category: 'testimony', status: 'disproven', sourceJournalEntryId: 'j1' },
        { id: 'secret', title: 'Culprit', description: 'Never revealed', category: 'testimony', status: 'confirmed', epistemicLayer: 'keeper_truth' },
      ], npcs: [{ id: 'n', name: 'Witness', firstImpression: 'Nervous', relationshipStatus: 'unknown', secret: 'Hidden cultist', psychologicalAgenda: 'Private motive' }], locations: [], notes: [],
    } };
    const snapshot = buildLegacySnapshot(scope, [], [savedCharacter]);
    validateMemorySnapshot(snapshot);
    const restored = ledger.restoreSnapshot(snapshot, 'legacy-load');
    expect(ledger.list(restored).find(e => e.entityId === 'known')?.status).toBe('disproven');
    expect(ledger.list(restored).every(e => e.recipients?.[0] === 'alice')).toBe(true);
    expect(JSON.stringify(snapshot)).not.toMatch(/Never revealed|Hidden cultist|Private motive/);
    expect(ledger.createSnapshot(restored, []).entries).toHaveLength(2);
  });

  it('queues old canonical entries again when the embedding model changes', () => {
    ledger.recordConversationTurn({ scope, sessionId: 's', messageId: 'a', userText: 'Question', assistantText: 'Answer' });
    ledger.ensureIndexSignature(scope, 'model-a:2:v1');
    ledger.pendingIndexEntries(scope).forEach(e => ledger.finishIndexJob(e.id, true));
    ledger.ensureIndexSignature(scope, 'model-a:2:v1');
    expect(ledger.pendingIndexEntries(scope)).toEqual([]);
    ledger.ensureIndexSignature(scope, 'model-b:2:v1');
    expect(ledger.pendingIndexEntries(scope)).toHaveLength(2);
  });
});
