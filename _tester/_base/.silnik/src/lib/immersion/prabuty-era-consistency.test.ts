import pl from '../../../messages/pl.json';
import en from '../../../messages/en.json';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { STREFA_11_ADVENTURES } from '@/lib/adventures-data';
import { findEquipmentTemplate, getEraEquipmentCatalog, migrateEquipmentCatalog } from '@/lib/equipment-catalog';
import { normalizeStoredCharacters } from '@/lib/character-storage-normalizer';
import { applyPresetTranslation } from '@/lib/i18n/preset-translation';
import { FullGameSaveManager } from '@/lib/full-game-save-manager';
import type { AISettings } from '@/lib/ai-settings';
import { getStrefa11CharactersForAdventure } from './strefa-11-characters';
import { localizePredefinedCharacter } from './localize-predefined-character';
import { buildPredefinedEquipment } from './predefined-equipment';

const characters = getStrefa11CharactersForAdventure('cien-nad-prabutami');
const future = /komórk|cell\s*phone|mobile phone|NightVision|night.vision|lata 90|1990s|latach 80|1980s|1989|Niva|Polonez|wolnej Polski|free Poland|betonowych blokowisk|concrete blocks/i;

describe('Prabuty investigators in October 1973', () => {
  it('uses the exact scenario year rather than the broad preset label', () => {
    expect(STREFA_11_ADVENTURES.find(a => a.id === 'cien-nad-prabutami')).toMatchObject({
      activeSceneYear: 1973, startDate: '1973-10-18T19:30',
    });
    expect(characters.map(c => [c.id, c.age])).toEqual([
      ['strefa11_tomasz_nowicki', 42], ['strefa11_helena_krawczyk', 38],
      ['strefa11_barbara_zawadzka', 45], ['strefa11_ryszard_klucznik', 55],
    ]);
    for (const character of characters) {
      expect(character.era).toBe('prl-1970s');
      expect(JSON.stringify(character)).not.toMatch(future);
      for (const item of character.equipment ?? []) {
        const template = findEquipmentTemplate(item.templateId);
        expect(template).toBeDefined();
        expect(template?.availableIn).toContain('prl-1970s');
        expect(item.imageUrl).toMatch(/^\/equipment\/.+\.(webp|svg)$/);
        expect(existsSync(join(process.cwd(), 'public', item.imageUrl!))).toBe(true);
      }
    }
  });

  it.each([['pl', pl], ['en', en]] as const)('keeps every narrative and duplicate equipment label consistent in %s', (locale, messages) => {
    const entries = messages.PredefinedCharacters.characters;
    for (const character of characters) {
      const entry = entries[character.id as keyof typeof entries];
      expect(JSON.stringify(entry)).not.toMatch(future);
      const translate = Object.assign((key: string): string => {
        const value = key.split('.').reduce<unknown>((node, part) =>
          node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
        messages.PredefinedCharacters);
        if (typeof value !== 'string') throw new Error(`Missing message: ${locale}:${key}`);
        return value;
      }, { has: () => true });
      const localized = localizePredefinedCharacter(character, character.id, locale, translate);
      expect(JSON.stringify(localized)).not.toMatch(future);
      expect(localized.skills).toEqual(character.skills);
    }
  });

  it('replaces the two anachronistic personal objects rather than relabeling their IDs', () => {
    const helena = characters.find(c => c.id === 'strefa11_helena_krawczyk')!;
    const barbara = characters.find(c => c.id === 'strefa11_barbara_zawadzka')!;
    const ryszard = characters.find(c => c.id === 'strefa11_ryszard_klucznik')!;
    expect(helena.equipment).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'eq_hel_przepustki', templateId: 'document.letter' }),
      expect.objectContaining({ id: 'eq_hel_notes' }),
    ]));
    expect(barbara.equipment).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'eq_barb_aparat', templateId: 'tool.camera', imageUrl: '/equipment/catalog/camera-prl-1970s.webp' }),
      expect.objectContaining({ id: 'eq_barb_emf', name: 'Analogowy miernik pola elektromagnetycznego' }),
    ]));
    expect(ryszard.meaningfulLocation).toContain('Warszawa');
    expect(ryszard.backstory).toContain('latach 60.');
    expect(helena.backstory).toContain('telefonów stacjonarnych');
  });

  it.each(['tool.brick-cellphone-prl', 'tool.nightvision-camera-modern'])('excludes %s only from the incorrect PRL era', id => {
    expect(getEraEquipmentCatalog('prl-1970s').map(item => item.baseTemplateId)).not.toContain(id);
    const laterEras = id === 'tool.brick-cellphone-prl'
      ? ['1980s', '1990s', '2000s'] : ['1980s', '1990s', '2000s', 'modern'];
    for (const era of laterEras) {
      expect(getEraEquipmentCatalog(era).map(item => item.baseTemplateId)).toContain(id);
    }
  });

  it('preserves a player-edited legacy investigator through storage and full save/load', () => {
    const legacy = {
      ...characters[1], id: 'existing-helena', sourcePresetId: 'strefa11_helena_krawczyk',
      backstory: 'Moja własna historia po 1989 roku.', notes: 'Zmiany gracza',
      equipment: [{ id: 'eq_hel_telefon', name: 'Telefon komórkowy (wielki)', category: 'tool' as const,
        templateId: 'tool.brick-cellphone-prl', description: 'Pamiątka gracza', quantity: 2 }],
    };
    const [restored] = normalizeStoredCharacters(JSON.parse(JSON.stringify([legacy])));
    expect(restored.backstory).toBe(legacy.backstory);
    expect(restored.equipment).toEqual(legacy.equipment);
    const save = FullGameSaveManager.createFullSave({ name: 'Legacy Prabuty', userId: 'local',
      messages: [], gameSettings: { aiSettings: {} as AISettings }, characters: [restored], campaigns: [], npcs: [], locations: [] });
    const loaded = FullGameSaveManager.decompressSave(FullGameSaveManager.compressSave(save))!;
    expect(loaded.characters[0].backstory).toBe(legacy.backstory);
    expect(loaded.characters[0].equipment).toEqual(legacy.equipment);
    const migrated = migrateEquipmentCatalog(loaded.characters[0].equipment, 'prl-1970s');
    expect(migrated).toEqual([expect.objectContaining(legacy.equipment[0])]);
    expect(loaded.characters[0].notes).toBe('Zmiany gracza');
    for (const messages of [pl, en]) {
      expect(applyPresetTranslation(loaded.characters[0], messages).backstory).toBe(legacy.backstory);
    }
  });

  it.each([pl, en])('preserves every legacy or edited narrative field when displaying a save', messages => {
    const legacy = { ...characters[1], sourcePresetId: characters[1].id,
      background: 'Moje tło', backstory: 'Historia po 1989 roku.', description: 'Telefon w dłoni.',
      treasuredPossession: 'Komórka gracza', meaningfulLocation: 'Własny samochód' };
    const displayed = applyPresetTranslation(legacy, messages);
    for (const field of ['background', 'backstory', 'description', 'treasuredPossession', 'meaningfulLocation'] as const) {
      expect(displayed[field]).toBe(legacy[field]);
    }
    const barbara = { ...characters[2], sourcePresetId: characters[2].id,
      equipment: [{ id: 'eq_barb_emf', name: 'Miernik pola elektromagnetycznego', category: 'tool' as const, description: 'Notatka gracza o aparaturze' }] };
    expect(applyPresetTranslation(barbara, messages).equipment).toEqual(barbara.equipment);
  });

  it('still switches current Polish and English preset biographies in both directions', () => {
    for (const character of characters) {
      const current = { ...character, sourcePresetId: character.id };
      const english = applyPresetTranslation(current, en);
      expect(english.backstory).toBe(en.PredefinedCharacters.characters[character.id as keyof typeof en.PredefinedCharacters.characters].data.backstory);
      expect(applyPresetTranslation(english, pl).backstory).toBe(character.backstory);
    }
  });

  it('keeps the complete new-game equipment kit localized in both directions', () => {
    for (const character of characters) {
      const current = { ...character, sourcePresetId: character.id, equipment: buildPredefinedEquipment(character, 'prl-1970s') };
      const english = applyPresetTranslation(current, en);
      for (const item of english.equipment!) {
        const personal = en.PredefinedCharacters.characters[character.id as keyof typeof en.PredefinedCharacters.characters].data.equipment;
        const label = (personal as Record<string, { name: string }>)[item.id] ??
          (en.PredefinedCharacters.systemEquipment as Record<string, { name: string }>)[item.id];
        expect(item.name).toBe(label.name);
      }
      const polish = applyPresetTranslation(english, pl);
      expect(polish.equipment!.map(item => [item.id, item.name, item.description]))
        .toEqual(current.equipment.map(item => [item.id, item.name, item.description]));
    }
  });
});
