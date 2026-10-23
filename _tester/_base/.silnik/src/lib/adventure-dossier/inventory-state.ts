import type { EquipmentItem } from '../types';

export interface DossierInventoryBinding {
  playthroughId: string;
  adventureId: string;
  editionFingerprint: string;
}

export interface DossierInventoryEntry {
  recordId: string;
  placement: 'character' | 'location' | 'removed';
  holderId: string | null;
  location: string | null;
  /** The same instance survives a transfer/drop, including ammunition and damage. */
  item: EquipmentItem;
}

export interface DossierAccessCheckState {
  testId: string;
  conditionId: string;
  characterId: string;
  location: string;
  skillName: string;
  requiredDifficulty: 'regular' | 'hard' | 'extreme';
  resolution?: { id: string; outcome: import('../dice-utils').RollOutcome };
}

export interface DossierInventoryState extends DossierInventoryBinding {
  schemaVersion: 1;
  entries: DossierInventoryEntry[];
  appliedTurnIds: string[];
  /** Absent in older saves: no discovery has been proven. */
  accessChecks?: DossierAccessCheckState[];
}

export type DossierInventoryProjection = DossierInventoryBinding & {
  accessChecks?: DossierAccessCheckState[];
  entries: Array<Pick<DossierInventoryEntry, 'recordId' | 'placement' | 'holderId' | 'location'>>;
};

const key = (playthroughId: string) => `zew-dossier-inventory:${playthroughId}`;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 250;
const uniqueIds = (xs: string[]) => new Set(xs).size === xs.length;

function validAccessChecks(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 1024) return false;
  return value.every(c => object(c) && [c.testId, c.conditionId, c.characterId, c.location, c.skillName].every(id) &&
    ['regular', 'hard', 'extreme'].includes(String(c.requiredDifficulty)) &&
    (c.resolution === undefined || (object(c.resolution) && id(c.resolution.id) &&
      ['critical', 'extreme', 'hard', 'regular', 'fail', 'fumble'].includes(String(c.resolution.outcome))))) &&
    uniqueIds(value.map(c => c.testId)) && uniqueIds(value.filter(c => c.resolution).map(c => c.resolution.id));
}

export function isDossierInventoryProjection(value: unknown): value is DossierInventoryProjection {
  if (!object(value) || !id(value.playthroughId) || !id(value.adventureId) ||
    typeof value.editionFingerprint !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value.editionFingerprint) ||
    !Array.isArray(value.entries) || value.entries.length > 256 || !validAccessChecks(value.accessChecks)) return false;
  return value.entries.every(e => object(e) && id(e.recordId) &&
    (e.placement === 'character' ? id(e.holderId) && e.location === null
      : e.placement === 'location' ? e.holderId === null && id(e.location)
        : e.placement === 'removed' && e.holderId === null && e.location === null)) &&
    uniqueIds(value.entries.map(e => e.recordId));
}

export function isDossierInventoryState(value: unknown): value is DossierInventoryState {
  if (!object(value) || !isDossierInventoryProjection(value) || value.schemaVersion !== 1 ||
    !Array.isArray(value.appliedTurnIds) || value.appliedTurnIds.length > 10000 ||
    !value.appliedTurnIds.every(id) || !uniqueIds(value.appliedTurnIds)) return false;
  const entries = value.entries as unknown as Array<Record<string, unknown>>;
  return entries.every(e => object(e.item) && id(e.item.id) && id(e.item.name) &&
    typeof e.item.category === 'string' && object(e.item.dossierBinding) &&
    e.item.dossierBinding.recordId === e.recordId && e.item.dossierBinding.adventureId === value.adventureId &&
    e.item.dossierBinding.editionFingerprint === value.editionFingerprint) &&
    uniqueIds(entries.map(e => (e.item as EquipmentItem).id));
}

function compactInventory(state:DossierInventoryState):DossierInventoryState {
 return {schemaVersion:1,playthroughId:state.playthroughId,adventureId:state.adventureId,editionFingerprint:state.editionFingerprint,
 entries:state.entries.map(e=>({recordId:e.recordId,placement:e.placement,holderId:e.holderId,location:e.location,item:e.item})),
 appliedTurnIds:[...state.appliedTurnIds],...(state.accessChecks?{accessChecks:state.accessChecks}:{})};
}

export function emptyDossierInventory(binding: DossierInventoryBinding): DossierInventoryState {
  return { schemaVersion: 1, playthroughId:binding.playthroughId,adventureId:binding.adventureId,editionFingerprint:binding.editionFingerprint, entries: [], appliedTurnIds: [] };
}

/** Missing is an empty campaign. Corruption/mismatched editions must not respawn objects. */
export function loadDossierInventory(binding: DossierInventoryBinding): DossierInventoryState {
  const raw = window.localStorage.getItem(key(binding.playthroughId));
  if (!raw) return emptyDossierInventory(binding);
  const value: unknown = JSON.parse(raw);
  if (!isDossierInventoryState(value) || value.playthroughId !== binding.playthroughId ||
    value.adventureId !== binding.adventureId || value.editionFingerprint !== binding.editionFingerprint) {
    throw new Error('DOSSIER_INVENTORY_INVALID');
  }
  return compactInventory(value);
}

export function storeDossierInventory(state: DossierInventoryState): void {
  if (!isDossierInventoryState(state)) throw new Error('DOSSIER_INVENTORY_INVALID');
  const json = JSON.stringify(compactInventory(state));
  if (json.length > 2 * 1024 * 1024) throw new Error('DOSSIER_INVENTORY_TOO_LARGE');
  window.localStorage.setItem(key(state.playthroughId), json);
}

/** Saves own campaign changes only, never a copy of the prepared GM dossier or PDF. */
export function readDossierInventoryForSave(playthroughId?: string): DossierInventoryState | undefined {
  if (!playthroughId || typeof window === 'undefined') return undefined;
  const raw = window.localStorage.getItem(key(playthroughId));
  if (!raw) return undefined;
  const state: unknown = JSON.parse(raw);
  if (!isDossierInventoryState(state) || state.playthroughId !== playthroughId) throw new Error('DOSSIER_INVENTORY_INVALID');
  return compactInventory(state);
}

export function projectDossierInventory(state: DossierInventoryState): DossierInventoryProjection {
  return { playthroughId: state.playthroughId, adventureId: state.adventureId, editionFingerprint: state.editionFingerprint,
    accessChecks: state.accessChecks ?? [],
    entries: state.entries.map(({ recordId, placement, holderId, location }) => ({ recordId, placement, holderId, location })) };
}

export function normalizeDossierLocation(value: string): string {
  return value.trim().toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
