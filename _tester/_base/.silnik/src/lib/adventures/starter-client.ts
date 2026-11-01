import type { Character } from '../types';
import { getSkillValue } from '../types';
import { loadCampaignMemoryScope } from '@/core/memory/campaign-scope';
import { applyStatChangesToParty } from '../character/apply-stat-changes';
import { createAcquiredEquipmentSeed } from '../acquired-equipment';
import { getHauntingHandouts } from './starter-dossier';
import { validateStarterState, type StarterState } from './starter-runtime';

const key = (run: string) => 'zew-starter-dossier:' + run;
export function readStarterState(run = loadCampaignMemoryScope()?.playthroughId): StarterState | null {
  if (typeof window === 'undefined' || !run) return null;
  try { const s: unknown = JSON.parse(localStorage.getItem(key(run)) || 'null'); validateStarterState(s); return s.playthroughId === run ? s : null; } catch { return null; }
}
export function storeStarterState(s: StarterState): void {
  validateStarterState(s);
  if (typeof window === 'undefined') return;
  localStorage.setItem(key(s.playthroughId), JSON.stringify(s));
  window.dispatchEvent(new Event('starter-dossier-changed'));
}

/** A committed effect is applied at most once per recipient, including restored saves. */
export function applyStarterStateToCharacters(roster: Character[], s: StarterState, locale: 'pl' | 'en'): Character[] {
  const handouts = getHauntingHandouts(locale);
  return roster.map(original => {
    if (!s.participantIds.includes(original.id)) return original;
    let c = original;
    const applied = new Set(c.appliedStarterEffects || []);
    for (const e of s.effects.filter(e => e.characterId === c.id && !applied.has(e.id))) {
      const tags = [e.hp ? `[HP:${e.hp}:${e.reason}]` : '', e.san ? `[SANITY:${e.san}:${e.reason}]` : ''].join('\n');
      c = applyStatChangesToParty([c], c, tags).activeCharacter;
      if (e.ammo) c = { ...c, equipment: c.equipment?.map(item => item.id === e.ammo!.weaponId ? { ...item, currentAmmo: Math.max(0, (item.currentAmmo || 0) + e.ammo!.delta) } : item) };
      if (e.mythos) {
        const name = Object.keys(c.skills).find(k => /mity.*cthulhu|cthulhu.*mythos/i.test(k)) || 'Mity Cthulhu';
        const old = c.skills[name] ?? 0, value = Math.min(99, getSkillValue(old) + e.mythos);
        c = { ...c, skills: { ...c.skills, [name]: typeof old === 'number' ? value : { ...old, value } } };
      }
      if (e.maxSan) c = { ...c, maxSan: Math.max(0, (c.maxSan ?? 99) + e.maxSan) };
      applied.add(e.id);
    }
    const equipment = (c.equipment || []).filter(item => !item.id.startsWith('starter-item:') || s.owners[item.id.slice('starter-item:'.length)] === c.id);
    for (const [slug, owner] of Object.entries(s.owners)) {
      if (owner !== c.id || equipment.some(e => e.id === 'starter-item:' + slug)) continue;
      const h = handouts.find(h => h.slug === slug); if (!h) continue;
      const seed = createAcquiredEquipmentSeed({ id: 'starter-item:' + slug, name: h.title, description: h.textContent || '', visualTreatment: 'mundane', status: 'accepted', category: slug === 'item-corbitt-dagger' ? 'weapon' : 'story' });
      equipment.push({ ...seed, id: 'starter-item:' + slug, name: h.title, category: slug === 'item-corbitt-dagger' ? 'weapon' : 'story', description: h.textContent, imageUrl: h.image,
        ...(slug === 'item-corbitt-dagger' ? { combatProfile: { schemaVersion: 1 as const, kind: 'melee_weapon' as const, combatSkillId: 'brawl', damageFormula: '1d4+2', damageClass: 'impaling' as const }, modifiers: { damage: '1d4+2', skill: 'Walka wręcz (Bijatyka)' } } : {}) });
    }
    return { ...c, appliedStarterEffects: [...applied], equipment };
  });
}
