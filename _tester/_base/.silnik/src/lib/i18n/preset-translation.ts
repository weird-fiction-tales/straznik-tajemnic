import type { Character } from '@/lib/types';
import { STREFA_11_CHARACTERS } from '@/lib/immersion/strefa-11-characters';
import { buildPredefinedEquipment } from '@/lib/immersion/predefined-equipment';
import enMessages from '../../../messages/en.json';

/**
 * Nakładka tłumaczeń presetów postaci (SSOT: messages/*.json ->
 * PredefinedCharacters.characters.<sourcePresetId>).
 *
 * Zapisane pola postaci (localStorage) pozostają NIEZMIENIONE - nakładka działa
 * wyłącznie na warstwę wyświetlania, więc przełączenie języka nie mutuje danych
 * gracza. Pola bez tłumaczenia w słowniku spadają do wartości zapisanej.
 */

interface PresetEquipmentTranslation {
  name?: string;
  description?: string;
}

interface PresetTranslation {
  occupation?: string;
  equipment?: Record<string, PresetEquipmentTranslation>;
  data?: {
    occupation?: string;
    background?: string;
    birthplace?: string;
    residence?: string;
    characterConcept?: string;
    ideology?: string;
    significantPerson?: string;
    meaningfulLocation?: string;
    treasuredPossession?: string;
    description?: string;
    backstory?: string;
    tacticalNotes?: string;
    traits?: string[];
    skills?: Record<string, string>;
  };
}

type MessagesBag = {
  PredefinedCharacters?: {
    characters?: Record<string, PresetTranslation>;
    systemEquipment?: Record<string, PresetEquipmentTranslation>;
  };
};

export function localizeSystemEquipment<T extends { id: string; name: string; description?: string }>(
  item: T,
  messages: unknown
): T {
  const translated = (messages as MessagesBag)?.PredefinedCharacters?.systemEquipment?.[item.id];
  return translated ? { ...item, name: translated.name ?? item.name, description: translated.description ?? item.description } : item;
}

export function applyPresetTranslation(
  character: Character,
  messages: unknown
): Character {
  const presetId = character.sourcePresetId;
  if (!presetId) return character;

  const dict = (messages as MessagesBag)?.PredefinedCharacters?.characters?.[
    presetId
  ];
  if (!dict) return character;

  const data = dict.data ?? {};
  // The 1973 correction applies to new Prabuty investigators. An older save or
  // a player's edit is authoritative even in the display-only translation layer.
  const canonical = STREFA_11_CHARACTERS.find(preset =>
    preset.id === presetId && preset.scenarioIds?.includes('cien-nad-prabutami'));
  const canonicalEquipment = canonical ? buildPredefinedEquipment(canonical, 'prl-1970s') : [];
  const english = (enMessages as MessagesBag).PredefinedCharacters?.characters?.[presetId];
  type TextField = Exclude<keyof NonNullable<PresetTranslation['data']>, 'traits' | 'skills'>;
  const pick = (field: TextField, translated: string | undefined, current: string | undefined) => {
    if (canonical && current !== canonical[field] && current !== english?.data?.[field]) {
      return current ?? '';
    }
    return translated ?? current ?? '';
  };

  return {
    ...character,
    occupation: pick('occupation', dict.occupation ?? data.occupation, character.occupation),
    background: pick('background', data.background, character.background),
    backstory: pick('backstory', data.backstory, character.backstory),
    birthplace: pick('birthplace', data.birthplace, character.birthplace),
    residence: pick('residence', data.residence, character.residence),
    characterConcept: pick('characterConcept', data.characterConcept, character.characterConcept),
    ideology: pick('ideology', data.ideology, character.ideology),
    significantPerson: pick(
      'significantPerson',
      data.significantPerson,
      character.significantPerson
    ),
    meaningfulLocation: pick(
      'meaningfulLocation',
      data.meaningfulLocation,
      character.meaningfulLocation
    ),
    treasuredPossession: pick(
      'treasuredPossession',
      data.treasuredPossession,
      character.treasuredPossession
    ),
    description: pick('description', data.description, character.description),
    tacticalNotes: pick('tacticalNotes', data.tacticalNotes, character.tacticalNotes),
    traits:
      Array.isArray(data.traits) && data.traits.length > 0
        ? data.traits
        : character.traits,
    equipment: Array.isArray(character.equipment) ? character.equipment.map((item) => {
      const system = localizeSystemEquipment(item, messages);
      const personal = dict.equipment?.[item.id];
      if (canonical) {
        const original = canonicalEquipment.find(candidate => candidate.id === item.id);
        if (!original) return item;
        const englishItem = english?.equipment?.[item.id] ??
          (enMessages as MessagesBag).PredefinedCharacters?.systemEquipment?.[item.id];
        return {
          ...item,
          name: item.name === original.name || item.name === englishItem?.name
            ? personal?.name ?? system.name : item.name,
          description: item.description === original.description || item.description === englishItem?.description
            ? personal?.description ?? system.description : item.description,
        };
      }
      return { ...system, name: personal?.name ?? system.name, description: personal?.description ?? system.description };
    }) : [],
  };
}

/** Labels only: game rules keep canonical skill keys in saved Character data. */
export function getPresetSkillLabels(
  character: Character,
  messages: unknown
): Record<string, string> {
  const presetId = character.sourcePresetId;
  if (!presetId) return {};
  return (messages as MessagesBag)?.PredefinedCharacters?.characters?.[presetId]
    ?.data?.skills ?? {};
}
