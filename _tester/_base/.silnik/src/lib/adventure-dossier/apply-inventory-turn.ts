import { isRuntimeAuthorizedDossierRecord } from './runtime-authorization';
import { mapDifficultyToRequired, meetsDifficulty } from '../dice-utils';
import { normalizeSkillName } from '../skill-test-resolver';
import type { SkillRollResolution, SkillTestData } from '../parsers/types';
import type { Character, EquipmentVisualEra, EquipmentItem } from '../types';
import { applyEquipmentEventsToParty, type EquipmentNotification } from '../character/apply-equipment-events';
import { extractEquipmentEvents } from '../parsers/equipment-parser';
import { createEquipmentItem } from '../equipment-data';
import { safeResolveVisualEra } from '../equipment-catalog';
import { type DossierRagPayload } from './rag-schema';
import { normalizeDossierLocation, type DossierInventoryState } from './inventory-state';

/** Typed identity/ownership adapter around the existing equipment resolver; no dice or new item stats. */
export function applyDossierInventoryTurn(input: {
  payload: DossierRagPayload; state: DossierInventoryState; turnId: string;
  characters: Character[]; activeCharacter: Character; rawText: string;
  location: string; writesAllowed: boolean; era: EquipmentVisualEra | string;
  applyLegacy?: boolean;
  skillTests?: SkillTestData[];
}) {
  const { payload, state, turnId, activeCharacter } = input;
  if (state.adventureId !== payload.adventure_id || state.editionFingerprint !== payload.edition_fingerprint) {
    throw new Error('DOSSIER_INVENTORY_EDITION_MISMATCH');
  }
  if (state.appliedTurnIds.includes(turnId)) return {
    characters: input.characters, activeCharacter, changed: false, notifications: [] as EquipmentNotification[], state, rejected: [] as string[],
  };
  const cards = payload.records.filter(r => r.inventory_item && isRuntimeAuthorizedDossierRecord(r));
  const roster = new Map([...input.characters, activeCharacter].map(c => [c.id, { ...c, equipment: [...(c.equipment ?? [])] }]));
  const entries = new Map(state.entries.map(e => [e.recordId, { ...e }]));
  const rejected: string[] = [], notifications: EquipmentNotification[] = [];
  let changed = false, handled = false;
  const same = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
  const actor = (name?: string) => {
    if (!name) return roster.get(activeCharacter.id);
    const matches = [...roster.values()].filter(c => same(c.name, name) || c.id === name);
    return matches.length === 1 ? matches[0] : undefined;
  };
  const takeFromRoster = (itemId: string) => {
    for (const c of roster.values()) c.equipment = c.equipment.filter(e => e.id !== itemId);
  };
  // Consume dossier references before legacy parsing, so an invalid ID can never become an item name.
  const legacyText = input.rawText.replace(/\[EKWIPUNEK(?::@([^:\]]+))?:\s*([^|\]]+)\|([^\]]+)\]/gi,
    (tag, name: string | undefined, operation: string, tail: string) => {
      const parts = tail.split('|').map(s => s.trim()), reference = parts[0];
      const matches = cards.filter(r => reference === `@${r.record_id}` || same(reference, r.inventory_item!.name));
      if (!matches.length && !reference.startsWith('@')) return tag;
      handled = true;
      const card = matches.length === 1 ? matches[0] : undefined, owner = actor(name?.trim());
      if (!card || !owner || !input.writesAllowed) { rejected.push(card?.record_id ?? 'unknown-item'); return ''; }
      const def = card.inventory_item!, before = entries.get(card.record_id);
      const op = operation.trim().toLocaleLowerCase();
      const current = before?.placement === 'character' && before.holderId === owner.id
        ? owner.equipment.find(e => e.id === before.item.id) : undefined;
      if (['dodaj', 'add'].includes(op)) {
        const atSource = card.tags.scenes.some(s => normalizeDossierLocation(s) === normalizeDossierLocation(input.location));
        const atDrop = before?.placement === 'location' && normalizeDossierLocation(before.location ?? '') === normalizeDossierLocation(input.location);
        if (!input.location || (before ? !atDrop : !atSource || !hasDossierItemAccess(payload, state, card.record_id))) { rejected.push(card.record_id); return ''; }
        // Never generate readableContent for a narrative summary or pretend to reproduce a source document.
        const item: EquipmentItem = before ? { ...before.item } : {
          ...createEquipmentItem({ name: def.name, category: def.category,
            condition: def.initial_state?.condition, isJammed: def.initial_state?.is_jammed,
            dossierBinding: { adventureId: state.adventureId, editionFingerprint: state.editionFingerprint, recordId: card.record_id },
          }, 'found', safeResolveVisualEra(input.era)),
          id: `dossier:${state.playthroughId}:${card.record_id}`,
          dossierBinding: { adventureId: state.adventureId, editionFingerprint: state.editionFingerprint, recordId: card.record_id },
        };
        takeFromRoster(item.id); owner.equipment.push(item);
        entries.set(card.record_id, { recordId: card.record_id, placement: 'character', holderId: owner.id, location: null, item });
        notifications.push({ type: 'add', itemName: item.name, characterName: owner.name }); changed = true;
      } else if (['przekaz', 'przekaż', 'give', 'transfer'].includes(op)) {
        const recipient = actor(parts[1]?.replace(/^@/, ''));
        if (!current || !parts[1] || !recipient || recipient.id === owner.id) { rejected.push(card.record_id); return ''; }
        takeFromRoster(current.id); recipient.equipment.push(current);
        entries.set(card.record_id, { recordId: card.record_id, placement: 'character', holderId: recipient.id, location: null, item: current });
        notifications.push({ type: 'remove', itemName: current.name, characterName: owner.name },
          { type: 'add', itemName: current.name, characterName: recipient.name }); changed = true;
      } else if (['odloz', 'odłóż', 'drop'].includes(op)) {
        if (!current || !input.location) { rejected.push(card.record_id); return ''; }
        takeFromRoster(current.id);
        entries.set(card.record_id, { recordId: card.record_id, placement: 'location', holderId: null, location: input.location, item: current });
        notifications.push({ type: 'remove', itemName: current.name, characterName: owner.name }); changed = true;
      } else {
        const event = extractEquipmentEvents(tag)[0];
        if (!current || !event || event.action === 'add') { rejected.push(card.record_id); return ''; }
        // The shared resolver owns charges, ammunition, depletion and removal.
        const result = applyEquipmentEventsToParty([owner], owner, '', undefined, input.era,
          { events: [{ ...event, characterName: undefined, itemId: current.id, itemName: current.name }] });
        roster.set(owner.id, { ...result.activeCharacter, equipment: result.activeCharacter.equipment ?? [] });
        const remaining = result.activeCharacter.equipment?.find(e => e.id === current.id);
        entries.set(card.record_id, { recordId: card.record_id, placement: remaining ? 'character' : 'removed',
          holderId: remaining ? owner.id : null, location: null, item: remaining ?? current });
        notifications.push(...result.notifications); changed ||= result.changed;
      }
      return '';
    });
  const protectedItemIds = new Set([...entries.values()].map(e => e.item.id));
  const legacy = applyEquipmentEventsToParty([...roster.values()], roster.get(activeCharacter.id)!, input.applyLegacy === false ? '' : legacyText,
    undefined, input.era, { protectedItemIds });
  const registered = registerDossierAccessTests(payload, state, input.skillTests ?? [], input.location, [...roster.values()]);
  const nextState: DossierInventoryState = { ...registered, entries: [...entries.values()],
    appliedTurnIds: handled ? [...state.appliedTurnIds, turnId] : state.appliedTurnIds };
  return { ...legacy, changed: changed || legacy.changed, notifications: [...notifications, ...legacy.notifications], state: nextState, rejected };
}

/** The current edition and reviewed card remain authoritative after save/restore. */
export function hasDossierItemAccess(payload: DossierRagPayload, state: Pick<DossierInventoryState, 'adventureId' | 'editionFingerprint' | 'accessChecks'>, recordId: string): boolean {
  if (state.adventureId !== payload.adventure_id || state.editionFingerprint !== payload.edition_fingerprint) return false;
  const card = payload.records.find(r => r.record_id === recordId && isRuntimeAuthorizedDossierRecord(r));
  const item = card?.inventory_item;
  if (!item) return false;
  const check = item.access_check;
  if (!check) return true;
  return (state.accessChecks ?? []).some(c => c.conditionId === check.id &&
    normalizeDossierLocation(c.location) === normalizeDossierLocation(item.source_location) &&
    check.skill_names.some(n => normalizeSkillName(n) === normalizeSkillName(c.skillName)) &&
    !!c.resolution && meetsDifficulty(c.resolution.outcome, check.difficulty) &&
    meetsDifficulty(c.resolution.outcome, c.requiredDifficulty));
}

/** Bind the requested check once, in the actual scene, to the resolved investigator. */
export function registerDossierAccessTests(payload: DossierRagPayload, state: DossierInventoryState,
  tests: SkillTestData[], location: string, characters: Character[]): DossierInventoryState {
  if (state.adventureId !== payload.adventure_id || state.editionFingerprint !== payload.edition_fingerprint) return state;
  const checks = [...(state.accessChecks ?? [])];
  for (const test of tests) {
    if (!test.dossierConditionId || test.combined || !test.characterId || !characters.some(c => c.id === test.characterId) ||
      checks.some(c => c.testId === test.id) || checks.length >= 1024) continue;
    const card = payload.records.find(r => isRuntimeAuthorizedDossierRecord(r) && r.inventory_item?.access_check?.id === test.dossierConditionId);
    const item = card?.inventory_item;
    const check = item?.access_check;
    const requiredDifficulty = mapDifficultyToRequired(test.difficulty);
    if (!item || !check || !card!.tags.scenes.some(scene => normalizeDossierLocation(scene) === normalizeDossierLocation(location)) ||
      !check.skill_names.some(n => normalizeSkillName(n) === normalizeSkillName(test.skillName)) ||
      !meetsDifficulty(requiredDifficulty, check.difficulty)) continue;
    checks.push({ testId: test.id, conditionId: check.id, characterId: test.characterId, location: item.source_location,
      skillName: test.skillName, requiredDifficulty });
  }
  return { ...state, accessChecks: checks };
}

/** Called only with final dice-modal results, never with result tags parsed from narration. */
export function resolveDossierAccessChecks(payload: DossierRagPayload, state: DossierInventoryState,
  rolls: SkillRollResolution[], location: string, characters: Character[]): DossierInventoryState {
  if (state.adventureId !== payload.adventure_id || state.editionFingerprint !== payload.edition_fingerprint) return state;
  const checks = (state.accessChecks ?? []).map(c => ({ ...c }));
  for (const roll of rolls) {
    const pending = checks.find(c => c.testId === roll.testId && !c.resolution);
    if (!pending || !roll.resolutionId || checks.some(c => c.resolution?.id === roll.resolutionId) ||
      roll.characterId !== pending.characterId || !characters.some(c => c.id === pending.characterId) ||
      roll.requiredDifficulty !== pending.requiredDifficulty || roll.skillNames.length !== 1 ||
      normalizeSkillName(roll.skillNames[0]) !== normalizeSkillName(pending.skillName) ||
      roll.passedRequirement !== meetsDifficulty(roll.outcome, pending.requiredDifficulty)) continue;
    const approved = payload.records.some(r => isRuntimeAuthorizedDossierRecord(r) &&
      r.inventory_item?.access_check?.id === pending.conditionId &&
      r.inventory_item.source_location === pending.location &&
      r.tags.scenes.some(scene => normalizeDossierLocation(scene) === normalizeDossierLocation(location)));
    if (approved) pending.resolution = { id: roll.resolutionId, outcome: roll.outcome };
  }
  return { ...state, accessChecks: checks };
}
