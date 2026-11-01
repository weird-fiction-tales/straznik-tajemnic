import type { Character, SkillTestData } from '../types';
import { findEquipmentTemplate } from '../equipment-catalog';
import type { DiceRoll } from '../dice-utils';
import { evaluateSkillCheck, meetsDifficulty } from '../dice-utils';
import { resolveTestValue, resolveSkillBaseValue } from '../skill-test-resolver';
import { OUTCOME_RANKS, calculateMeleeDamage, normalizeDiceFormula } from '../combat/combat-resolver';
import { inferWeaponDamage, inferWeaponSkill } from '../combat/weapon-context';
import { getDamageAndBuild } from '../character/derived-stats';
import { getHauntingDossier, resolveHauntingConsequence } from './starter-dossier';
import { eligibleDossierHandouts, type DossierLocale } from './prepared-dossier';

export const STARTER_EDITION = 'blackmonk-2019-v1.3-prepared-1';
export interface StarterRoll {
  testId: string;
  characterId: string;
  roll: Pick<DiceRoll, 'id' | 'total' | 'targetValue' | 'luckSpent'>;
}
export interface StarterMechanics {
  rolls?: StarterRoll[];
  action?: { kind: 'take' | 'transfer' | 'study' | 'push' | 'attack' | 'guard' | 'confirm'; slug?: string; characterId: string; checkId?: string; weaponId?: string; choiceId?: string };
}
export interface StarterEffect {
  id: string;
  characterId: string;
  hp?: number;
  san?: number;
  mythos?: number;
  maxSan?: number;
  ammo?: { weaponId: string; delta: number };
  reason: string;
}
export interface StarterPending extends SkillTestData {
  starter: { checkId: string; sceneId: string; pushed: boolean;
    attack?: { weaponId: string; damage: string; bonus: string; impaling: boolean; firearm: boolean };
    enemy?: { kind: 'flying-knife' | 'claws' | 'domination' | 'rats'; roll: number; skill: number; duration?: number } };
}
export interface StarterState {
  schemaVersion: 1;
  editionId: typeof STARTER_EDITION;
  playthroughId: string;
  revision: number;
  participantIds: string[];
  currentSceneId: string;
  visitedSceneIds: string[];
  discoveredRoomIds: string[];
  discoveredHandouts: string[];
  owners: Record<string, string>;
  completedChecks: string[];
  failedChecks: string[];
  pendingTests: StarterPending[];
  resolvedRollIds: string[];
  effects: StarterEffect[];
  elapsedMinutes: number;
  corbitt: { hp: number; mp: number; ward: number; destroyed: boolean };
  ending: 'success' | 'false-clearance' | 'withdrawal' | 'defeat' | null;
  notes: string[];
  pendingActions?: Array<{ id: string; sceneId: string; kind: 'move' | 'room' | 'look' | 'report' | 'withdrawal' | 'interact'; value: string }>;
  combatRound?: number;
  actedThisRound?: string[];
  corbittActedRound?: number;
  animatedUntilRound?: number;
  dominatedUntilRound?: Record<string, number>;
}
export const isStarterAdventure = (a?: { id?: string; sourceBookId?: string } | null) =>
  a?.id === 'nawiedzony-dom' || a?.sourceBookId === 'starter-d100';

export function createStarterState(playthroughId: string, participantIds: string[]): StarterState {
  return { schemaVersion: 1, editionId: STARTER_EDITION, playthroughId, revision: 0,
    participantIds: [...new Set(participantIds)], currentSceneId: 'node-knott-office',
    visitedSceneIds: ['node-knott-office'], discoveredRoomIds: [], discoveredHandouts: [],
    owners: {}, completedChecks: [], failedChecks: [], pendingTests: [], resolvedRollIds: [],
    effects: [], elapsedMinutes: 0, corbitt: { hp: 16, mp: 18, ward: 0, destroyed: false }, ending: null, notes: [] };
}

export function validateStarterState(value: unknown): asserts value is StarterState {
  if (!value || typeof value !== 'object') throw new Error('INVALID_STARTER_STATE');
  const s = value as StarterState;
  const d = getHauntingDossier('pl');
  const arrays = [s.participantIds, s.visitedSceneIds, s.discoveredRoomIds, s.discoveredHandouts,
    s.completedChecks, s.failedChecks, s.resolvedRollIds, s.notes];
  if (s.schemaVersion !== 1 || s.editionId !== STARTER_EDITION || typeof s.playthroughId !== 'string'
    || !Number.isSafeInteger(s.revision) || s.revision < 0
    || arrays.some(a => !Array.isArray(a) || !a.every(x => typeof x === 'string'))
    || !d.scenes.some(x => x.id === s.currentSceneId)
    || s.visitedSceneIds.some(id => !d.scenes.some(x => x.id === id))
    || s.discoveredHandouts.some(id => !d.handouts.some(x => x.slug === id))
    || s.discoveredRoomIds.some(id => !d.rooms.some(x => x.id === id))
    || !s.owners || typeof s.owners !== 'object' || Object.entries(s.owners).some(([slug, id]) => !s.discoveredHandouts.includes(slug) || !s.participantIds.includes(id))
    || !Array.isArray(s.pendingTests) || s.pendingTests.some(t => !t.starter || !s.participantIds.includes(t.characterId || '') || typeof t.id !== 'string' || !Number.isFinite(t.skillValue))
    || !Array.isArray(s.effects) || s.effects.some(e => !s.participantIds.includes(e.characterId) || !e.id || [e.hp, e.san, e.mythos, e.maxSan].some(n => n !== undefined && !Number.isFinite(n)))
    || !s.corbitt || [s.corbitt.hp, s.corbitt.mp, s.corbitt.ward, s.elapsedMinutes].some(n => !Number.isFinite(n) || n < 0)
    || ![null, 'success', 'false-clearance', 'withdrawal', 'defeat'].includes(s.ending)) throw new Error('INVALID_STARTER_STATE');
}

const skills: Record<string, string[]> = {
  'globe-access': ['Perswazja', 'Gadanina', 'Urok osobisty', 'Zastraszanie'],
  'archives-search': ['Korzystanie z Bibliotek'], 'court-access': ['Perswazja', 'Gadanina', 'Urok osobisty', 'Zastraszanie', 'Ślusarstwo', 'Ukrywanie'],
  'dooley-first': ['Wygląd', 'Majętność'], 'dooley-social': ['Perswazja', 'Gadanina', 'Urok osobisty'],
  'chapel-floor': ['Szczęście'], 'chapel-jump': ['Skakanie'], 'chapel-search': ['Spostrzegawczość'],
  'open-journal-cabinet': ['Siła'], 'bed-warning': ['Spostrzegawczość'], 'bed-dodge': ['Unik'],
  'stairs-descent': ['Zręczność', 'Wspinaczka'], 'knife-discovery': ['Spostrzegawczość'],
  'crypt-open': ['Spostrzegawczość'], 'corbitt-sight': ['Poczytalność'],
  'bed-sight': ['Poczytalność'], 'knife-sight': ['Poczytalność'], 'knife-dodge': ['Unik'], 'knife-capture': ['Walka wręcz (Bijatyka)'], 'knife-hold': ['Siła'],
  'corbitt-domination': ['Moc'], 'corbitt-attack': ['Walka wręcz (Bijatyka)'],
  'latin-reading': ['Język obcy (Łacina)'],
  'rats-attack': ['Walka wręcz (Bijatyka)'],
};
export function starterCheckSkills(id: string): string[] {
  return /^library-[1-4]$/.test(id) ? ['Korzystanie z Bibliotek'] : skills[id] || [];
}
const specialScenes: Record<string, string> = {
  'dooley-first': 'node-neighbourhood', 'dooley-social': 'node-neighbourhood',
  'chapel-jump': 'node-chapel-ruins', 'bed-sight': 'node-corbitt-upper', 'knife-sight': 'node-corbitt-basement', 'bed-dodge': 'node-corbitt-upper',
  'crypt-open': 'node-between-walls', 'corbitt-sight': 'node-corbitt-crypt',
  'knife-dodge': 'node-corbitt-basement', 'knife-capture': 'node-corbitt-basement', 'knife-hold': 'node-corbitt-basement',
  'corbitt-domination': 'node-corbitt-crypt', 'corbitt-attack': 'node-corbitt-crypt',
  'rats-attack': 'node-between-walls',
};
export const STARTER_PUSHABLE = new Set(['library-1', 'library-2', 'library-3', 'library-4', 'archives-search', 'globe-access', 'court-access', 'chapel-search', 'knife-discovery', 'stairs-descent', 'open-journal-cabinet']);
const englishSkill: Record<string, string> = { 'Perswazja': 'Persuade', 'Gadanina': 'Fast Talk', 'Urok osobisty': 'Charm', 'Zastraszanie': 'Intimidate', 'Korzystanie z Bibliotek': 'Library Use', 'Spostrzegawczość': 'Spot Hidden', 'Szczęście': 'Luck', 'Skakanie': 'Jump', 'Siła': 'STR', 'Zręczność': 'DEX', 'Moc': 'POW', 'Poczytalność': 'SAN', 'Wygląd': 'APP', 'Majętność': 'Credit Rating', 'Unik': 'Dodge', 'Wspinaczka': 'Climb', 'Walka wręcz (Bijatyka)': 'Fighting (Brawl)', 'Ślusarstwo': 'Locksmith', 'Ukrywanie': 'Stealth', 'Język obcy (Łacina)': 'Other Language (Latin)' };
const normalize = (s: string) => s.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const append = (a: string[], v: string) => { if (!a.includes(v)) a.push(v); };
const portable = new Set(['clue-01-knott-keys', 'clue-09-corbitt-journal', 'item-corbitt-dagger', 'item-liber-ivonis', 'clue-chapel-cult-journal']);

function formulaTotal(formula: string, roll: (sides: number) => number): number {
  const f = normalizeDiceFormula(formula);
  const m = /^([+-]?)(\d*)d(\d+)([+-]\d+)?$/i.exec(f);
  if (!m) return Number(f);
  const count = Number(m[2] || 1), sides = Number(m[3]);
  if (count > 20 || sides < 1 || sides > 100) throw new Error('INVALID_STARTER_DAMAGE');
  return (m[1] === '-' ? -1 : 1) * Array.from({ length: count }, () => roll(sides)).reduce((a, b) => a + b, 0) + Number(m[4] || 0);
}

function markCombatAction(s: StarterState, actorId: string) {
  const acted = s.actedThisRound || [];
  if (s.participantIds.every(id => acted.includes(id))) { s.combatRound = (s.combatRound || 0) + 1; s.actedThisRound = [actorId]; }
  else { append(acted, actorId); s.actedThisRound = acted; }
}

function queueStarterThreat(s: StarterState, kind: string, actor: Character, turn: string, locale: DossierLocale, roll: (sides: number) => number) {
  const inHouse = ['node-corbitt-house', 'node-corbitt-upper', 'node-basement-stairs', 'node-corbitt-basement', 'node-between-walls', 'node-corbitt-crypt'].includes(s.currentSceneId);
  if (!inHouse || s.corbitt.destroyed || !s.participantIds.includes(actor.id)) return;
  if (kind === 'flesh-ward') {
    // Five rounds of preparation fit an unopposed house exploration interval;
    // the spell cannot be granted instantaneously during the crypt confrontation.
    if (s.currentSceneId === 'node-corbitt-crypt' || s.corbitt.ward || s.corbitt.mp < 2 || s.pendingTests.length) return;
    s.corbitt.mp -= 2; s.corbitt.ward = roll(6) + roll(6); s.elapsedMinutes += 1;
    s.notes.push('Flesh Ward: 5 rounds preparation, 2MP, 2d6 absorption; no recast while active.'); return;
  }
  if (!['flying-knife', 'claws', 'domination', 'rats'].includes(kind) || s.pendingTests.some(p => p.starter.enemy)
    || s.corbittActedRound === (s.combatRound || 0)) return;
  if (kind === 'rats' && (s.currentSceneId !== 'node-between-walls' || s.completedChecks.includes('rats-dispersed'))) return;
  if (kind === 'claws' && s.currentSceneId !== 'node-corbitt-crypt') return;
  if (kind === 'flying-knife' && !['node-corbitt-basement', 'node-corbitt-crypt'].includes(s.currentSceneId)) return;
  const cost = kind === 'rats' ? 0 : kind === 'claws' ? ((s.animatedUntilRound || 0) > (s.combatRound || 0) ? 0 : 2) : 1;
  if (s.corbitt.mp < cost) return;
  s.corbitt.mp -= cost;
  if (kind === 'claws' && cost) s.animatedUntilRound = (s.combatRound || 0) + 5;
  const magic = kind === 'domination', skillName = magic ? 'Moc' : 'Unik';
  s.pendingTests.push({ id: `starter:${turn}:${kind}:${actor.id}`, skillName, skillValue: resolveTestValue(skillName, actor) ?? 1,
    characterId: actor.id, characterName: actor.name, difficulty: 'zwykly', modifiers: [],
    justification: locale === 'pl' ? (magic ? 'Oprzyj się obcej woli.' : 'Reagujesz na bezpośrednie zagrożenie.') : (magic ? 'Resist the alien will.' : 'React to an immediate threat.'),
    starter: { checkId: 'threat:' + kind, sceneId: s.currentSceneId, pushed: false,
      enemy: { kind: kind as 'flying-knife' | 'claws' | 'domination' | 'rats', roll: roll(100), skill: magic || kind === 'flying-knife' ? 90 : kind === 'claws' ? 50 : 40, duration: magic ? roll(6) + 1 : undefined } } });
  s.corbittActedRound = s.combatRound || 0;
  if (kind === 'flying-knife') for (const c of s.participantIds) s.notes.push(`Witness SAN 1/1d4 pending for ${c}.`);
}

export function queueStarterAttack(s: StarterState, actor: Character, weaponId: string, turn: string, locale: DossierLocale): void {
  if (s.currentSceneId !== 'node-corbitt-crypt' || s.corbitt.destroyed || !s.participantIds.includes(actor.id)
    || s.pendingTests.some(t => t.starter.attack)) return;
  const weapon = actor.equipment?.find(e => e.id === weaponId && e.category === 'weapon' && e.condition !== 'broken' && !e.isJammed);
  if (!weapon) return;
  const firearm = /bro[nń].*pal|firearm|handgun|rifle|shotgun/i.test(inferWeaponSkill(weapon));
  if (firearm && weapon.currentAmmo !== undefined && weapon.currentAmmo < 1) return;
  if (weaponId === 'starter-item:item-corbitt-dagger' && s.owners['item-corbitt-dagger'] !== actor.id) return;
  const profile = findEquipmentTemplate(weapon.templateId ?? weapon.name)?.combatProfile;
  const skillName = inferWeaponSkill(weapon);
  const damage = profile?.kind === 'melee_weapon' ? profile.damageFormula : weapon.modifiers?.damage || inferWeaponDamage(weapon)?.damage;
  if (!damage) return;
  normalizeDiceFormula(damage);
  const bonus = firearm ? '0' : getDamageAndBuild(actor.str, actor.siz).damageBonus;
  s.pendingTests.push({ id: `starter:${turn}:attack:${actor.id}`, characterId: actor.id, characterName: actor.name,
    skillName, skillValue: resolveTestValue(skillName, actor) ?? resolveSkillBaseValue(skillName) ?? 1,
    difficulty: 'zwykly', modifiers: [], justification: locale === 'pl' ? `Atak: ${weapon.name}` : `Attack: ${weapon.name}`,
    starter: { checkId: 'corbitt-attack', sceneId: s.currentSceneId, pushed: false,
      attack: { weaponId, damage, bonus, firearm, impaling: profile?.kind === 'melee_weapon' ? profile.damageClass === 'impaling' : true } } });
}

export function requestStarterCheck(s: StarterState, id: string, actor: Character, turnId: string, locale: DossierLocale, pushed = false, preferredSkill?: string): void {
  const d = getHauntingDossier(locale);
  const scene = id === 'latin-reading' && s.owners['item-liber-ivonis'] === actor.id ? s.currentSceneId : d.scenes.find(x => x.checks.some(c => c.id === id))?.id || specialScenes[id];
  const perActor = ['latin-reading', 'corbitt-sight', 'bed-sight', 'knife-sight', 'stairs-descent', 'chapel-floor', 'chapel-jump', 'bed-warning', 'bed-dodge'].includes(id);
  const completion = perActor ? `${id}@${actor.id}` : id;
  if (!s.participantIds.includes(actor.id) || scene !== s.currentSceneId || !starterCheckSkills(id).length
    || s.completedChecks.includes(completion) || s.pendingTests.some(t => t.starter.checkId === id && (!perActor || t.characterId === actor.id))
    || (pushed && (!STARTER_PUSHABLE.has(id) || !s.failedChecks.includes(`${id}@${actor.id}`)))) return;
  if (/^library-[2-4]$/.test(id) && !s.completedChecks.includes('library-' + (Number(id.slice(-1)) - 1))) return;
  if (id === 'chapel-jump' && !s.failedChecks.includes(`chapel-floor@${actor.id}`)) return;
  if (id === 'bed-dodge' && !s.completedChecks.includes(`bed-warning@${actor.id}`)) return;
  if (id === 'dooley-social' && (!s.failedChecks.includes('dooley-first') || (s.participantIds.length > 1 && s.failedChecks.includes(`dooley-first@${actor.id}`)))) return;
  const choices = starterCheckSkills(id).map(skillName => ({ skillName, value: resolveTestValue(skillName, actor) ?? resolveSkillBaseValue(skillName) ?? 1 }));
  const wanted = preferredSkill && choices.find(x => normalize(x.skillName) === normalize(preferredSkill) || normalize(englishSkill[x.skillName] || '') === normalize(preferredSkill));
  if (preferredSkill && !wanted) return;
  const best = wanted || choices.reduce((a, b) => a.value >= b.value ? a : b);
  const prepared = d.scenes.find(x => x.id === scene)?.checks.find(c => c.id === id);
  const justification = prepared?.test || (locale === 'pl' ? 'Rozstrzygnij zadeklarowane działanie.' : 'Resolve the declared action.');
  s.pendingTests.push({ id: `starter:${turnId}:${id}:${actor.id}`, skillName: locale === 'en' ? englishSkill[best.skillName] || best.skillName : best.skillName, skillValue: best.value,
    characterId: actor.id, characterName: actor.name, difficulty: 'zwykly', modifiers: [], justification,
    stake: prepared ? `${prepared.success} / ${pushed ? prepared.pushedFailure || prepared.failure : prepared.failure}` : undefined,
    starter: { checkId: id, sceneId: scene, pushed } });
}

export function applyStarterInput(state: StarterState, input: StarterMechanics | undefined, roster: Character[], turnId: string, locale: DossierLocale, roll: (sides: number) => number): StarterState {
  const s: StarterState = structuredClone(state);
  const effect = (actor: string, key: string, delta: Omit<StarterEffect, 'id' | 'characterId' | 'reason'>) => {
    const id = `${turnId}:${key}:${actor}`;
    if (!s.effects.some(e => e.id === id)) s.effects.push({ id, characterId: actor, reason: key, ...delta });
  };
  for (const result of input?.rolls || []) {
    const p = s.pendingTests.find(t => t.id === result.testId && t.characterId === result.characterId);
    if (!p || p.starter.sceneId !== s.currentSceneId || s.resolvedRollIds.includes(result.roll.id)
      || !Number.isInteger(result.roll.total) || result.roll.total < 1 || result.roll.total > 100
      || result.roll.targetValue !== p.skillValue) continue;
    const actor = roster.find(c => c.id === result.characterId);
    if (!actor || !s.participantIds.includes(actor.id)) continue;
    const success = meetsDifficulty(evaluateSkillCheck(result.roll.total, p.skillValue), 'regular');
    const id = p.starter.checkId;
    s.pendingTests = s.pendingTests.filter(t => t.id !== p.id);
    append(s.resolvedRollIds, result.roll.id);
    append(success ? s.completedChecks : s.failedChecks, id);
    append(success ? s.completedChecks : s.failedChecks, `${id}@${actor.id}`);
    s.notes.push(`${id}: ${actor.id}: ${result.roll.total}/${p.skillValue}: ${success ? 'success' : 'failure'}`);
    if (/^library-[1-4]$/.test(id) || id === 'archives-search') s.elapsedMinutes += 720;
    if (id === 'chapel-floor' && !success) requestStarterCheck(s, 'chapel-jump', actor, turnId, locale);
    if (id === 'chapel-jump' && !success) effect(actor.id, id, { hp: -roll(6) });
    if (id === 'bed-warning') {
      for (const c of roster.filter(c => s.participantIds.includes(c.id))) requestStarterCheck(s, 'bed-sight', c, turnId, locale);
      if (success) requestStarterCheck(s, 'bed-dodge', actor, turnId, locale);
      else effect(actor.id, 'bed-impact', { hp: -(roll(6) + 2) });
    }
    if (id === 'bed-dodge' && !success) effect(actor.id, 'bed-impact', { hp: -(roll(6) + 2) });
    if (id === 'stairs-descent') {
      const r = resolveHauntingConsequence({ event: 'stairs', success, pushed: p.starter.pushed, roll: roll(6) });
      if (r.hpLoss) effect(actor.id, id, { hp: -r.hpLoss });
    }
    if (id === 'knife-discovery' && !success && p.starter.pushed) effect(actor.id, id, { hp: -(roll(4) + 2) });
    if (['corbitt-sight', 'bed-sight', 'knife-sight'].includes(id)) {
      effect(actor.id, id, { san: -(success ? 1 : roll(id === 'corbitt-sight' ? 8 : 4)) });
      append(s.completedChecks, `${id}@${actor.id}`);
    }
    if (id === 'dooley-first' && !success) s.notes.push('Dooley: another investigator may try a social approach.');
    if (p.starter.attack) {
      markCombatAction(s, actor.id);
      const a = p.starter.attack;
      if (a.firearm) effect(actor.id, 'ammunition:' + result.roll.id, { ammo: { weaponId: a.weaponId, delta: -1 } });
      const dodge = a.firearm ? 'fail' : evaluateSkillCheck(roll(100), 17);
      const hit = success && (a.firearm || OUTCOME_RANKS[evaluateSkillCheck(result.roll.total, p.skillValue)] > OUTCOME_RANKS[dodge]);
      if (hit) {
        const damage = calculateMeleeDamage({ weaponDamageFormula: a.damage, damageBonusFormula: a.bonus,
          damageType: a.impaling ? 'impaling' : 'non_impaling', outcome: evaluateSkillCheck(result.roll.total, p.skillValue), rollFn: f => formulaTotal(f, roll) });
        const r = resolveHauntingConsequence({ event: 'corbitt-hit', damage: damage.rawDamage, armour: s.corbitt.ward, hp: s.corbitt.hp,
          ownKnife: a.weaponId === 'starter-item:item-corbitt-dagger' && s.owners['item-corbitt-dagger'] === actor.id });
        s.corbitt = { ...s.corbitt, hp: r.hp, ward: r.armour, destroyed: r.destroyed };
        s.notes.push(`Corbitt: damage=${damage.rawDamage}, ward=${r.armour}, HP=${r.hp}, destroyed=${r.destroyed}`);
      } else s.notes.push('Corbitt: attack missed or was dodged.');
    }
    if (p.starter.enemy) {
      const enemy = p.starter.enemy;
      const enemyOutcome = evaluateSkillCheck(enemy.roll, enemy.skill);
      const defenderOutcome = evaluateSkillCheck(result.roll.total, p.skillValue);
      // Dodge wins equal success levels. Opposed POW uses higher skill to break ties.
      const hits = OUTCOME_RANKS[enemyOutcome] >= OUTCOME_RANKS.regular
        && (OUTCOME_RANKS[enemyOutcome] > OUTCOME_RANKS[defenderOutcome]
          || (enemy.kind === 'domination' && OUTCOME_RANKS[enemyOutcome] === OUTCOME_RANKS[defenderOutcome] && enemy.skill > p.skillValue));
      if (hits && enemy.kind === 'domination') {
        s.dominatedUntilRound = { ...s.dominatedUntilRound, [actor.id]: (s.combatRound || 0) + (enemy.duration || 2) };
        s.notes.push(`Domination: ${actor.id}, ${enemy.duration} rounds; no suicidal orders. Casting uses one round (spell card p29).`);
      } else if (hits) {
        const damage = calculateMeleeDamage({ weaponDamageFormula: enemy.kind === 'flying-knife' ? '1d4+2' : enemy.kind === 'claws' ? '1d3' : '1d3',
          damageBonusFormula: enemy.kind === 'claws' ? '1d4' : '0', damageType: enemy.kind === 'flying-knife' ? 'impaling' : 'non_impaling', outcome: enemyOutcome, rollFn: f => formulaTotal(f, roll) });
        effect(actor.id, 'threat:' + result.roll.id, { hp: -Math.max(0, damage.rawDamage - (actor.armor || 0)) });
      }
      if (enemy.kind === 'flying-knife') for (const c of roster.filter(c => s.participantIds.includes(c.id))) requestStarterCheck(s, 'knife-sight', c, turnId, locale);
    }
    if (id === 'rats-attack' && success) append(s.completedChecks, 'rats-dispersed');
  }
  const action = input?.action;
  if (action && s.participantIds.includes(action.characterId)) {
    const actor = roster.find(c => c.id === action.characterId);
    const slug = action.slug || '';
    if (action.kind === 'guard' && actor) markCombatAction(s, actor.id);
    if (action.kind === 'attack' && actor && action.weaponId) queueStarterAttack(s, actor, action.weaponId, turnId, locale);
    if (action.kind === 'push' && actor && action.checkId) requestStarterCheck(s, action.checkId, actor, turnId, locale, true);
    if (action.kind === 'take' && portable.has(slug) && s.discoveredHandouts.includes(slug)
      && getHauntingDossier(locale).handouts.find(h => h.slug === slug)?.nodeId === s.currentSceneId && !s.owners[slug]) s.owners[slug] = action.characterId;
    if (action.kind === 'transfer' && s.owners[slug]) s.owners[slug] = action.characterId;
    if (action.kind === 'study' && actor && s.owners[slug] === actor.id && !s.completedChecks.includes(`study:${slug}@${actor.id}`)) {
      if (slug === 'item-liber-ivonis' && (resolveTestValue('Język obcy (Łacina)', actor) ?? 0) < 50 && !s.completedChecks.includes(`latin-reading@${actor.id}`)) {
        // Study never grants comprehension for free.
        requestStarterCheck(s, 'latin-reading', actor, turnId, locale);
        s.notes.push('Latin 50 or a resolved Latin test is required.');
      } else if (slug === 'item-liber-ivonis' || slug === 'clue-09-corbitt-journal') {
        append(s.completedChecks, `study:${slug}@${actor.id}`);
        const journal = slug === 'clue-09-corbitt-journal';
        s.elapsedMinutes += journal ? 2880 : 180;
        effect(actor.id, 'study:' + slug, { mythos: journal ? 4 : 2, san: journal ? -roll(4) : 0, maxSan: journal ? -4 : -2 });
      }
    }
  }
  s.corbitt.mp = Math.min(18, s.corbitt.mp + Math.floor((s.elapsedMinutes - state.elapsedMinutes) / 60));
  return s;
}

export function publishStarterTurn(state: StarterState, text: string, input: { turnId: string; message: string; roster: Character[]; activeCharacterId: string; locale: DossierLocale }, roll: (sides: number) => number): { state: StarterState; text: string } {
  const s: StarterState = structuredClone(state), d = getHauntingDossier(input.locale);
  const declaration = normalize(input.message);
  const actor = input.roster.find(c => c.id === input.activeCharacterId);
  const scene = () => d.scenes.find(x => x.id === s.currentSceneId)!;
  const reveal = (slug: string) => {
    const eligible = eligibleDossierHandouts(d, { sceneId: s.currentSceneId, acquired: s.discoveredHandouts, checks: s.completedChecks });
    if (eligible.some(h => h.slug === slug)) append(s.discoveredHandouts, slug);
  };
  // These directives are proposals. Only code decides movement, checks and reveals.
  let output = text.replace(/\[TECZKA:([^\]]+)\]/gi, (_, raw: string) => {
    const [kind, value, who, skill] = raw.split('|').map(x => x.trim());
    if (kind === 'move' && (scene().exits.includes(value) || (value === 'node-knott-office' && !s.currentSceneId.startsWith('node-corbitt-') && s.currentSceneId !== 'node-between-walls' && s.currentSceneId !== 'node-basement-stairs')) && (value !== 'node-corbitt-crypt' || s.completedChecks.includes('crypt-open')) && (value !== 'node-corbitt-basement' || s.currentSceneId !== 'node-basement-stairs' || s.participantIds.every(id => s.completedChecks.includes(`stairs-descent@${id}`)))) {
      s.currentSceneId = value; append(s.visitedSceneIds, value); s.pendingTests = [];
      if (value === 'node-corbitt-crypt') for (const c of input.roster.filter(c => s.participantIds.includes(c.id))) requestStarterCheck(s, 'corbitt-sight', c, input.turnId, input.locale);
      if (s.ending === 'withdrawal') s.ending = null;
    }
    if (kind === 'room' && d.rooms.some(r => r.id === value && r.sceneId === s.currentSceneId)) append(s.discoveredRoomIds, value);
    if (kind === 'check') {
      const target = who ? input.roster.find(c => c.id === who) : actor;
      if (target && value !== 'corbitt-attack') requestStarterCheck(s, value, target, input.turnId, input.locale, false, skill);
    }
    if (kind === 'attack' && /atak|uderz|strzel|tn[eę]|dzga|attack|shoot|hit|stab|strike/.test(declaration)) {
      const target = who ? input.roster.find(c => c.id === who) : actor;
      if (target) queueStarterAttack(s, target, value, input.turnId, input.locale);
    }
    if (kind === 'threat') {
      const target = who ? input.roster.find(c => c.id === who) : actor;
      if (target) queueStarterThreat(s, value, target, input.turnId, input.locale, roll);
    }
    if (kind === 'discover') reveal(value);
    if (kind === 'action' && value === 'under-cabinet' && s.currentSceneId === 'node-chapel-ruins'
      && /(?:pod\s+szaf|under\s+(?:the\s+)?cabinet)/.test(declaration)) append(s.completedChecks, 'chapel-search');
    if (kind === 'action' && value === 'open-cabinet' && s.currentSceneId === 'node-corbitt-house'
      && /(?:szaf|cabinet)/.test(declaration) && /(?:otw|wywaz|mlot|lom|open|pry|hammer|crowbar)/.test(declaration)) append(s.completedChecks, 'open-journal-cabinet');
    if (kind === 'ending' && value === 'withdrawal' && /wycof|uciek|odchod|opuszcz|retreat|withdraw|leave|escape/.test(declaration)) s.ending = 'withdrawal';
    if (kind === 'ending' && value === 'report' && s.currentSceneId === 'node-knott-office' && /bezpiecz|zakoncz|zniszcz|safe|clear|destroy|report/.test(declaration)) {
      s.ending = s.corbitt.destroyed ? 'success' : 'false-clearance';
      if (s.ending === 'success' && !s.completedChecks.includes('success-reward')) {
        append(s.completedChecks, 'success-reward');
        for (const c of input.roster.filter(c => s.participantIds.includes(c.id) && c.hp > 0)) s.effects.push({ id: `${input.turnId}:success:${c.id}`, characterId: c.id, san: roll(6), reason: 'success' });
      }
    }
    return '';
  });
  // The source location is authoritative; a prose tag cannot bypass movement checks.
  output = output.replace(/\[(?:LOKACJA|LOCATION):[^\]]*\]/gi, '');
  // Unresolved checks never become successes because a model printed a result tag.
  output = output.replace(/\[(?:TEST|WYNIK|RESULT|ZAGROŻENIE|ZAGROZENIE|HAZARD|UTRATA_SAN|OBRAŻENIA|OBRAZENIA|RANY|LECZENIE|ODZYSKANIE_SAN|ZYSK_SAN|AUDIO|NAGRANIE|DŹWIĘK|DZWIEK|ZDOBYTY_PRZEDMIOT|PRZEDMIOT|DICE|KOSCI|EQUIPMENT|AMUNICJA|SZCZĘŚCIE|SZCZESCIE|HP|SAN):[^\]]*\]/gi, '');
  output = output.replace(/\[HANDOUT:\s*([^\]]+)\]/gi, (_, slug: string) => { reveal(slug.trim()); return ''; });
  // Research outcomes hand over their actual material even when the narrator forgets.
  for (const h of eligibleDossierHandouts(d, { sceneId: s.currentSceneId, acquired: s.discoveredHandouts, checks: s.completedChecks })) {
    if (h.reveal.checks.length && h.reveal.checks.every(id => s.completedChecks.includes(id))) reveal(h.slug);
  }
  if (input.roster.length && input.roster.filter(c => s.participantIds.includes(c.id)).every(c => c.hp <= 0 || c.san <= 0)) s.ending = 'defeat';
  output = output.replace(/\[(?:KONIEC_SESJI|END_SESSION|CZAS|TIME|CZAR|TOM|OBRONA_MAGIA|WALKA_ATAK|OBRONA_WALKA|WALKA_STRZAL|GAME_OVER):[^\]]*\]/gi, '');
  output = output.replace(/!\[[^\]]*\]\([^\n]*\)/g, '');
  const newlyRevealed = s.discoveredHandouts.filter(id => !state.discoveredHandouts.includes(id));
  for (const slug of newlyRevealed) output += `\n\n[HANDOUT:${slug}]`;
  output += `\n\n[LOKACJA:${scene().title.slice(0, 44)}]`;
  if (s.ending && s.ending !== 'withdrawal') output += '\n[KONIEC_SESJI:FINAL]';
  s.revision++;
  return { state: s, text: output.trim() };
}

export function starterDirectorContext(s: StarterState, locale: DossierLocale): string {
  const d = getHauntingDossier(locale), scene = d.scenes.find(x => x.id === s.currentSceneId)!;
  const actors = d.actors.filter(a => scene.actorIds.includes(a.id));
  return `\n## STARTER DOSSIER - AUTHORITATIVE, RETAIN IN CONTEXT\n${JSON.stringify({
    editionId: s.editionId, scene: { id: scene.id, title: scene.title, entry: scene.entry, atmosphere: scene.atmosphere, director: scene.director, actions: scene.actions, exits: scene.exits },
    handouts: d.handouts.filter(h => h.nodeId === s.currentSceneId).map(h => ({ slug: h.slug, title: h.title, reveal: h.reveal, text: s.discoveredHandouts.includes(h.slug) ? h.textContent : undefined })),
    rooms: d.rooms.filter(r => r.sceneId === s.currentSceneId).map(r => ({ id: r.id, description: r.description })),
    checks: [...scene.checks.map(c => c.id), ...Object.keys(specialScenes).filter(k => specialScenes[k] === s.currentSceneId)],
    cast: actors, party: s.participantIds, discoveries: s.discoveredHandouts, owners: s.owners,
    completedChecks: s.completedChecks, failedChecks: s.failedChecks, pending: s.pendingTests,
    recentResolutions: s.notes.slice(-12), corbitt: s.corbitt, ending: s.ending,
    rules: d.rules, endings: d.endings, audio: 'No approved new audio assets. Never invent recordings or play unapproved files.',
  })}\nNarrate in ${locale}. This state is determined by code. Never calculate dice, HP, SAN or awards. Do not invent secrets, people, documents or source facts. Do not describe an unresolved check as a success. Use [TECZKA:move|exact scene ID] only after the party declares travel and only along an exit. Use [TECZKA:room|room ID] only when the party actually enters that room. Request [TECZKA:check|check ID|participant ID|skill name] for source checks. Library research must proceed library-1 through library-4, one half-day attempt per check. Use [TECZKA:discover|exact handout slug] or [HANDOUT:slug] only when investigating that material; code enforces prerequisites. Direct search under the chapel cabinet: [TECZKA:action|under-cabinet]. Pry open the storeroom cabinet: [TECZKA:action|open-cabinet]. Never turn discovery into possession. For a declared retreat use [TECZKA:ending|withdrawal]. Reporting to Knott uses [TECZKA:ending|report]. Only code chooses the ending. Use no raw TEST, RESULT, damage, SAN, item-acquisition or end-session tags. Ordinary conversation remains free. Knott may ask about delays after more than one research day. Dooley requires dooley-first (APP or Credit Rating) then dooley-social by another investigator on failure. Return to Knott is possible from outside the house. Keep every instruction internal.\n`;
}
