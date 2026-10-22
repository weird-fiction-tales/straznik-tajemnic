import type { NPC } from '../types';
import { applyAuthoredScenarioTurn } from './authored-scenario-turn';
import { applyDossierActorTurn } from './actor-turn';
import { applyDossierInventoryTurn, resolveDossierAccessChecks } from './apply-inventory-turn';
import { isDossierInventoryState } from './inventory-state';
import { applyDossierWorldObjectTurn, getDossierWorldObjectBindings, isDossierWorldState } from './world-object-state';

type Actor = Pick<NPC, 'id' | 'status' | 'locationId' | 'location' | 'statusEffects' | 'tags'>;
type InventoryInput = Parameters<typeof applyDossierInventoryTurn>[0];
type WorldInput = Parameters<typeof applyDossierWorldObjectTurn>[0];
type ActorInput = Parameters<typeof applyDossierActorTurn>[0];
export type DossierTurnPreviewInput<T extends Actor = Actor> = Omit<InventoryInput, 'state' | 'activeCharacter'> &
  Omit<ActorInput, 'npcs'> & {
    npcs: T[];
    /** Exact human input, never assistant narration; needed for explicit withdrawal. */
    playerMessage?: string;
    activeCharacter: InventoryInput['activeCharacter'] | null;
    inventory: InventoryInput['state'];
    world: WorldInput['state'];
  };

/** Calculate one candidate using existing adapters. Never expose a partial candidate or write storage. */
export function previewDossierTurn<T extends Actor>(input: DossierTurnPreviewInput<T>) {
  const reject = (rejected: string[]) => ({ ok: false as const, rejected });
  const sameBinding = (state: InventoryInput['state'] | WorldInput['state']) =>
    state.playthroughId === input.playthroughId && state.adventureId === input.adventureId &&
    state.editionFingerprint === input.editionFingerprint;
  if (!isDossierInventoryState(input.inventory) || !isDossierWorldState(input.world) ||
    !sameBinding(input.inventory) || !sameBinding(input.world) ||
    input.payload.adventure_id !== input.adventureId || input.payload.edition_fingerprint !== input.editionFingerprint) {
    return reject(['DOSSIER_TURN_BINDING_INVALID']);
  }
  const stateTag = /\[TECZKA_STANU:\s*([^|\]]+)\|([^\]]+)\]/gi;
  const stateTags = [...input.rawText.matchAll(stateTag)];
  const residue = input.rawText.replace(stateTag, '');
  if (/\[TECZKA_STANU\b/i.test(residue) ||
    /\[EKWIPUNEK\b/i.test(residue.replace(/\[EKWIPUNEK(?::@([^:\]]+))?:\s*([^|\]]+)\|([^\]]+)\]/gi, ''))) {
    return reject(['DOSSIER_TURN_INCOMPLETE_ACTION']);
  }
  if (!input.writesAllowed && (stateTags.length || /\[EKWIPUNEK\b/i.test(input.rawText))) {
    return reject(['DOSSIER_TURN_WRITES_DISABLED']);
  }
  const worldBindings = getDossierWorldObjectBindings(input.payload);
  const actorTags: string[] = [], worldTags: string[] = [];
  for (const tag of stateTags) {
    const entity = tag[1].trim();
    const actors = input.payload.records.filter(r => r.actor_binding?.entity_id === entity);
    const objects = worldBindings.filter(b => b.entity_id === entity);
    if (actors.length + objects.length !== 1) return reject([entity]);
    (actors.length ? actorTags : worldTags).push(tag[0]);
  }
  const actor = applyDossierActorTurn({ ...input, rawText: actorTags.join(' ') });
  const discovered = resolveDossierAccessChecks(input.payload, input.inventory, input.skillRolls,
    input.location, input.characters);
  if (!input.activeCharacter && /\[EKWIPUNEK\b/i.test(input.rawText)) return reject(['DOSSIER_CHARACTER_REQUIRED']);
  const inventory = input.activeCharacter
    ? applyDossierInventoryTurn({ ...input, activeCharacter: input.activeCharacter, state: discovered, applyLegacy: input.applyLegacy })
    : { state: discovered, characters: input.characters, activeCharacter: null, notifications: [], changed: false, rejected: [] };
  const authored = applyAuthoredScenarioTurn({...input,state:input.world,inventory:inventory.state});
  const world = authored.applicable ? authored :
    applyDossierWorldObjectTurn({ ...input, state: input.world, rawText: worldTags.join(' ') });
  const rejected = [...actor.rejected, ...world.rejected, ...inventory.rejected];
  if (rejected.length) return reject(rejected);
  return {
    ok: true as const,
    next: { npcs: actor.npcs, world: world.state, inventory: inventory.state,
      characters: inventory.characters, activeCharacter: inventory.activeCharacter },
    changed: { actors: actor.changed, world: world.changed, inventory: inventory.changed },
    ...(authored.applicable?{codeEvidence:{adventureId:input.adventureId,editionFingerprint:input.editionFingerprint,
      ending:authored.ending,events:authored.events}}:{}),
    notifications: inventory.notifications,
    cleanText: residue.trimEnd(),
  };
}
