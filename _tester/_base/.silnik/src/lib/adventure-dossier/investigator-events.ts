import type { Character } from '@/lib/types';
import { isWeapon } from '@/lib/combat/weapon-context';
import type { InvestigatorChangeResolutionContext } from '@/lib/parsers/types';

const CHARACTERISTIC_KEYS = ['str', 'dex', 'con', 'app', 'pow', 'edu', 'siz', 'int'] as const;

function sameSkillValues(left: Character['skills'], right: Character['skills']): boolean {
  const leftKeys = Object.keys(left ?? {}).sort();
  const rightKeys = Object.keys(right ?? {}).sort();
  if (leftKeys.length !== rightKeys.length || leftKeys.some((key, index) => key !== rightKeys[index])) return false;
  return leftKeys.every((key) => JSON.stringify(left[key]) === JSON.stringify(right[key]));
}

function creditRatingSkill(character: Character): unknown {
  const entry = Object.entries(character.skills ?? {}).find(([name]) => {
    const normalized = name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().trim();
    return normalized === 'majetnosc' || normalized === 'credit rating';
  });
  return entry?.[1];
}

function hasWealthData(character: Character): boolean {
  return character.creditRating !== undefined || character.cash !== undefined ||
    Boolean(character.assets?.trim()) || creditRatingSkill(character) !== undefined;
}

function weaponProfiles(character: Character): string {
  return JSON.stringify(
    (character.equipment ?? [])
      .filter(isWeapon)
      .map(({ id, templateId, name, category, modifiers, condition, currentAmmo, maxAmmo, isJammed }) => ({
        id,
        templateId: templateId ?? null,
        name,
        category,
        modifiers: modifiers ?? null,
        condition: condition ?? null,
        currentAmmo: currentAmmo ?? null,
        maxAmmo: maxAmmo ?? null,
        isJammed: isJammed ?? false,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
}

export function buildInvestigatorChangeResolutionContext(
  previous: Character | null | undefined,
  next: Character,
): InvestigatorChangeResolutionContext | null {
  const created = !previous;
  const changedFields: InvestigatorChangeResolutionContext['changedFields'] = [];

  if (created || CHARACTERISTIC_KEYS.some((key) => previous?.[key] !== next[key])) {
    changedFields.push('characteristics');
  }
  if (created || previous?.age !== next.age) changedFields.push('age');
  if (created || previous?.occupation !== next.occupation) changedFields.push('occupation');
  if (created || !sameSkillValues(previous?.skills ?? {}, next.skills ?? {})) changedFields.push('skills');
  if (created
    ? next.creationMethod === 'alternate'
    : previous?.creationMethod !== next.creationMethod &&
      (previous?.creationMethod === 'alternate' || next.creationMethod === 'alternate')) {
    changedFields.push('alternate_creation');
  }
  if (created ? hasWealthData(next) : (
    previous?.creditRating !== next.creditRating || previous?.cash !== next.cash ||
    previous?.assets !== next.assets || JSON.stringify(creditRatingSkill(previous!)) !== JSON.stringify(creditRatingSkill(next))
  )) {
    changedFields.push('wealth');
  }
  if (created
    ? (next.equipment ?? []).some(isWeapon)
    : weaponProfiles(previous!) !== weaponProfiles(next)) {
    changedFields.push('weapons');
  }

  if (changedFields.length === 0) return null;
  return {
    source: 'local_investigator_change',
    resolutionId: crypto.randomUUID(),
    characterId: next.id,
    operation: created ? 'created' : 'updated',
    changedFields,
  };
}
