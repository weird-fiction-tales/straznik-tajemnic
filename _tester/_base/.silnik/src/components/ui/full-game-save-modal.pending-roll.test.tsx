import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FullGameSaveModal } from './full-game-save-modal';
import { stagePendingSkillRoll } from '@/lib/adventure-dossier/pending-skill-roll';
import { storeCampaignMemoryScope } from '@/core/memory/campaign-scope';
import { PREDEFINED_CHARACTERS } from '@/lib/immersion/predefined-characters';
import { defaultAISettings } from '@/lib/ai-settings/defaults';
import { toast } from './use-toast';
import type { Message } from '@/lib/types';
import pl from '../../../messages/pl.json';
import en from '../../../messages/en.json';

jest.mock('./use-toast', () => ({ toast: jest.fn() }));
const binding = { playthroughId: 'save-roll-scope', adventureId: 'cien-nad-prabutami', editionFingerprint: `sha256:${'a'.repeat(64)}` };
const character = { ...PREDEFINED_CHARACTERS[0], id: 'ui-character' };
const source: Message = {
  id: 'dex-source', role: 'assistant', content: 'Przeskocz przeszkodę.', timestamp: new Date(0),
  skillTests: [{ id: 'dex-test', characterId: character.id, skillName: 'Zręczność', skillValue: 57, difficulty: 'zwykly', modifiers: [], justification: 'Przeszkoda.' }],
};
const currentData = {
  messages: [], characters: [character], campaigns: [], npcs: [], locations: [], aiSettings: defaultAISettings,
  pdfMemory: { adventureId: binding.adventureId, adventureDossierFingerprint: binding.editionFingerprint },
};
const queueKey = `zew-dossier-skill-roll:${binding.playthroughId}`;
function stage() {
  const history: Message[] = JSON.parse(JSON.stringify([source]));
  localStorage.setItem('zew_chat_messages', JSON.stringify(history));
  return stagePendingSkillRoll(localStorage, binding, 'Wynik rzutu: 57.', { skillRolls: [{
    testId: 'dex-test', resolutionId: 'roll-57', characterId: character.id, skillNames: ['Zręczność'],
    requiredDifficulty: 'regular', passedRequirement: true, outcome: 'regular', luckSpent: 0,
  }] }, history, [character.id]);
}
async function save(locale: 'pl' | 'en', legacy = false) {
  process.env.NEXT_INTL_TEST_LOCALE = locale;
  const copy = locale === 'pl' ? pl : en;
  const onClose = jest.fn(), onSaved = jest.fn();
  render(<FullGameSaveModal isOpen mode="save" onClose={onClose} onSaved={onSaved}
    currentData={legacy ? { ...currentData, pdfMemory: undefined } : currentData} />);
  fireEvent.change(screen.getByPlaceholderText(copy.FullGameSaveModal.namePlaceholder), { target: { value: 'Save with roll' } });
  fireEvent.click(screen.getByRole('button', { name: copy.FullGameSaveModal.saveTitle }));
  return { onClose, onSaved };
}
describe('manual save keeps the scoped typed roll outbox out of snapshots', () => {
  beforeEach(() => {
    jest.clearAllMocks(); localStorage.clear();
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => 'pending-roll' });
    storeCampaignMemoryScope({ schemaVersion: 1, campaignDefinitionId: 'scenario:prabuty', kind: 'scenario', ...binding });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, saveId: 'saved', formattedSize: '1 KB', messageCount: 0, imageCount: 0 }) });
  });
  afterEach(() => { delete process.env.NEXT_INTL_TEST_LOCALE; });
  it.each(['pl', 'en'] as const)('blocks the %s manual save using durable source tests and UI character IDs', async locale => {
    stage(); const before = localStorage.getItem(queueKey);
    const callbacks = await save(locale);
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      description: locale === 'en' ? 'Send the saved roll result again before saving the game.' : 'Wyślij zapisany wynik rzutu ponownie przed zapisaniem gry.',
    })));
    expect(fetch).not.toHaveBeenCalled(); expect(callbacks.onClose).not.toHaveBeenCalled(); expect(callbacks.onSaved).not.toHaveBeenCalled();
    expect(localStorage.getItem(queueKey)).toBe(before);
  });
  it.each(['corrupt', 'foreign'] as const)('fails closed for a %s existing record without deleting it', async mode => {
    const pending = stage();
    localStorage.setItem(queueKey, mode === 'corrupt' ? '{broken' : JSON.stringify({ ...pending, editionFingerprint: `sha256:${'b'.repeat(64)}` }));
    const before = localStorage.getItem(queueKey); await save('pl');
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(fetch).not.toHaveBeenCalled(); expect(localStorage.getItem(queueKey)).toBe(before);
  });
  it.each([false, true])('keeps the existing save path when no queue exists (legacy=%s)', async legacy => {
    const callbacks = await save('pl', legacy);
    await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith('/api/game-save', expect.objectContaining({ method: 'POST' }));
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(JSON.parse(jest.mocked(fetch).mock.calls[0][1]!.body as string))).not.toContain('mechanicsContext');
  });
});
