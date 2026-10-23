import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultAISettings } from '../ai-settings/defaults';
import { getGameMasterPrompt } from '../ai-settings/prompts-generator';
import { createAuthoredPrabutyPayload } from '../adventure-dossier/authored-prabuty';
import { createAuthoredEnglewoodPayload } from '../adventure-dossier/authored-englewood';
import { emptyDossierWorldState } from '../adventure-dossier/world-object-state';
import { emptyDossierInventory } from '../adventure-dossier/inventory-state';
import { PREDEFINED_CHARACTERS } from '../immersion/predefined-characters';
import { applyStatChangesFromText } from '../character/apply-stat-changes';
import { processCharacterJournalAndDossier } from '../journal/apply-journal-tags';
import { extractJournalTags } from '../parsers/journal-parser';
import { extractSkillTests, extractSkillResults } from '../parsers/mechanics-parser';
import { FullGameSaveManager } from '../full-game-save-manager';
import type { Character } from '../types';

it.each(['pl', 'en'] as const)('%s compact contract preserves mechanics and campaign data through a disk save', locale => {
  const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Offline test'));
  const folder = mkdtempSync(join(tmpdir(), 'straznik-compact-'));
  try {
    const fingerprint = `sha256:${'a'.repeat(64)}`;
    const payload = locale === 'pl' ? createAuthoredPrabutyPayload(fingerprint) : createAuthoredEnglewoodPayload(fingerprint);
    const payloadBefore = JSON.stringify(payload);
    const scope = { schemaVersion: 1 as const, kind: 'scenario' as const,
      playthroughId: `offline-${locale}`, campaignDefinitionId: payload.adventure_id,
      adventureId: payload.adventure_id, editionFingerprint: fingerprint };
    const name = locale === 'pl' ? 'Tomasz' : 'Thomas';
    const skill = locale === 'pl' ? 'Mechanika' : 'Mechanical Repair';
    const character: Character = { ...PREDEFINED_CHARACTERS[0], id: 'offline-investigator', name,
      hp: 13, maxHp: 13, san: 70, maxSan: 99,
      journal: [], investigatorDossier: { clues: [], npcs: [], locations: [], notes: [] } };
    const condition = payload.records.find(r => r.world_object_binding?.transitions.some(t => t.condition_id))
      ?.world_object_binding?.transitions.find(t => t.condition_id)?.condition_id ?? 'offline-access';
    const testText = `[TEST: @${name}: ${skill} | hard | | Inspect | DOSSIER_ACCESS: ${condition}]\n[STAWKA: Alarm]`;
    const tests = extractSkillTests(testText).map(t => ({ ...t, characterId: character.id }));
    expect(tests).toHaveLength(1);
    expect(tests[0]).toMatchObject({ characterName: name, dossierConditionId: condition, difficulty: 'trudny', stake: 'Alarm' });
    expect(extractSkillResults(`[WYNIK: @${name}: ${skill} | 75 ≤ 40 | FAILURE]`)[0].result).toBe('failure');
    const updated = applyStatChangesFromText(character, `[HP: @${name}: -2: injury]\n[SANITY: @${name}: -1: horror]`);
    expect(updated.hp).toBe(11);
    expect(updated.san).toBe(69);
    const tag = locale === 'pl' ? 'DZIENNIK' : 'JOURNAL';
    const journal = extractJournalTags(`[${tag}:${locale === 'pl' ? 'trop' : 'clue'}:Letter]The letter contains an address. | source:handout | I | archive[/${tag}]`);
    const withJournal = processCharacterJournalAndDossier(updated, journal, [], null, 'offline-message').character;
    expect(withJournal.investigatorDossier?.clues).toHaveLength(1);
    const world = emptyDossierWorldState(scope, payload);
    const inventory = emptyDossierInventory(scope);
    expect(getGameMasterPrompt(defaultAISettings, locale)).toContain('DOSSIER_ACCESS:');
    const save = FullGameSaveManager.createFullSave({ name: 'Offline compact roundtrip', userId: 'offline-test', locale,
      gameSettings: { aiSettings: defaultAISettings }, characters: [withJournal], activeCharacterId: character.id,
      campaigns: [], npcs: [], locations: [], campaignMemory: scope,
      memorySnapshot: { schemaVersion: 1, scope, revision: 1, entries: [], checkpoints: [] },
      dossierWorldState: world, dossierInventory: inventory,
      messages: [{ id: 'offline-message', role: 'assistant', content: testText, timestamp: new Date(), skillTests: tests,
        dossierHandoutBinding: { adventureId: payload.adventure_id, editionFingerprint: fingerprint } }],
    });
    const path = join(folder, 'save.json');
    writeFileSync(path, FullGameSaveManager.compressSave(save), 'utf8');
    const loaded = FullGameSaveManager.decompressSave(readFileSync(path, 'utf8'));
    expect(loaded).not.toBeNull();
    expect(loaded?.locale).toBe(locale);
    expect(loaded?.characters[0]).toMatchObject({ hp: 11, san: 69 });
    expect(loaded?.characters[0].investigatorDossier?.clues).toEqual(withJournal.investigatorDossier?.clues);
    expect(loaded?.messages[0].skillTests).toEqual(tests);
    expect(loaded?.messages[0].dossierHandoutBinding?.adventureId).toBe(payload.adventure_id);
    expect(loaded?.dossierWorldState).toEqual(world);
    expect(loaded?.dossierInventory).toEqual(inventory);
    expect(loaded?.campaignMemory).toEqual(scope);
    expect(loaded?.memorySnapshot).toEqual(save.memorySnapshot);
    expect(JSON.stringify(payload)).toBe(payloadBefore);
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    fetchSpy.mockRestore();
    rmSync(folder, { recursive: true, force: true });
  }
});
