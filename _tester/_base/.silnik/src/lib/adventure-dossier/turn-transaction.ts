import type { StorageLike } from '../combat/combat-transaction';
import type { DossierInventoryBinding } from './inventory-state';

interface StoragePatch { key: string; before: string | null; after: string | null }
interface DossierTurnTransaction extends DossierInventoryBinding {
  schemaVersion: 1;
  turnId: string;
  token: string;
  phase: 'ready' | 'prepared' | 'applied' | 'acknowledged';
  writes: StoragePatch[];
  publication: StoragePatch;
}
type TransactionInput = Omit<DossierTurnTransaction, 'schemaVersion' | 'phase'>;
const key = (binding: DossierInventoryBinding) => `zew-dossier-turn:${binding.playthroughId}`;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 250;
const patch = (v: unknown): v is StoragePatch => object(v) && text(v.key) &&
  (v.before === null || typeof v.before === 'string') && (v.after === null || typeof v.after === 'string');
function valid(value: unknown): value is DossierTurnTransaction {
  if (!object(value) || value.schemaVersion !== 1 || !text(value.playthroughId) || !text(value.adventureId) ||
    !text(value.editionFingerprint) || !/^sha256:[a-f0-9]{64}$/.test(value.editionFingerprint) ||
    !text(value.turnId) || !text(value.token) || !['ready','prepared','applied','acknowledged'].includes(String(value.phase)) ||
    !Array.isArray(value.writes) || value.writes.length > 7 || !value.writes.every(patch) ||
    !patch(value.publication) || value.publication.key !== 'zew_chat_messages') return false;
  const allowed = new Set(['gm_npcs', 'characters', 'coc7_game_time', 'zew_active_chase_state', 'combat_round_journal_v1',
    `zew-dossier-world-state:${value.playthroughId}`, `zew-dossier-inventory:${value.playthroughId}`]);
  return value.writes.every(p => allowed.has(p.key)) && new Set(value.writes.map(p => p.key)).size === value.writes.length;
}
function assertBinding(tx: DossierTurnTransaction, binding: DossierInventoryBinding): void {
  if (tx.playthroughId !== binding.playthroughId || tx.adventureId !== binding.adventureId ||
    tx.editionFingerprint !== binding.editionFingerprint) throw new Error('DOSSIER_TRANSACTION_SCOPE_CHANGED');
}
export function loadDossierTurnTransaction(storage: StorageLike, binding: DossierInventoryBinding): DossierTurnTransaction | null {
  const raw = storage.getItem(key(binding));
  if (raw === null) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('DOSSIER_TRANSACTION_INVALID'); }
  if (!valid(value)) throw new Error('DOSSIER_TRANSACTION_INVALID');
  assertBinding(value,binding);
  return value;
}
function save(storage: StorageLike, tx: DossierTurnTransaction): void {
  const serialized = JSON.stringify(tx);
  if (serialized.length > 4 * 1024 * 1024) throw new Error('DOSSIER_TRANSACTION_TOO_LARGE');
  storage.setItem(key(tx), serialized);
}
export function beginDossierTurnTransaction(storage: StorageLike, input: TransactionInput): void {
  const tx: DossierTurnTransaction = {...input,schemaVersion:1,phase:'ready'};
  if (!valid(tx)) throw new Error('DOSSIER_TRANSACTION_INVALID');
  if (storage.getItem(key(tx)) !== null) throw new Error('DOSSIER_TRANSACTION_PENDING');
  if ([...tx.writes,tx.publication].some(p=>storage.getItem(p.key)!==p.before)) throw new Error('DOSSIER_TRANSACTION_CONFLICT');
  // Single write precedes every campaign mutation. Quota failure leaves the old campaign intact.
  save(storage,tx);
}

interface RecoveryPorts {
  prepare: (token:string)=>Promise<void>;
  accept: (token:string)=>Promise<Record<string,unknown>>;
  isCurrent: ()=>boolean;
}
const recoveries=new WeakMap<StorageLike,Map<string,Promise<Record<string,unknown>|null>>>();
/** Join repeated calls in this application instance. External writes still require the conflict checks below. */
export function resumeDossierTurnTransaction(storage: StorageLike, binding: DossierInventoryBinding, ports: RecoveryPorts): Promise<Record<string,unknown>|null> {
  if(!ports.isCurrent()) return Promise.reject(new Error('DOSSIER_TRANSACTION_SCOPE_CHANGED'));
  const id=JSON.stringify(binding);
  let byBinding=recoveries.get(storage);
  if(!byBinding){byBinding=new Map();recoveries.set(storage,byBinding);}
  const running=byBinding.get(id);
  if(running)return running;
  const promise=resume(storage,binding,ports).finally(()=>{byBinding.delete(id);});
  byBinding.set(id,promise);
  return promise;
}

/** Replay exact accepted values, never run dice/adapters again and never roll back unrelated storage. */
async function resume(storage: StorageLike, binding: DossierInventoryBinding, ports: RecoveryPorts): Promise<Record<string,unknown>|null> {
  const tx=loadDossierTurnTransaction(storage,binding);
  if(!tx) return null;
  const assertCurrent=()=>{
    if(!ports.isCurrent()) throw new Error('DOSSIER_TRANSACTION_SCOPE_CHANGED');
    const stored=loadDossierTurnTransaction(storage,binding);
    if(!stored || stored.turnId!==tx.turnId || stored.token!==tx.token) throw new Error('DOSSIER_TRANSACTION_CONFLICT');
    for(const p of [...tx.writes,tx.publication]) {
      const current=storage.getItem(p.key);
      if(current!==p.before && current!==p.after) throw new Error('DOSSIER_TRANSACTION_CONFLICT');
    }
  };
  assertCurrent();
  if(tx.phase==='ready') {
    await ports.prepare(tx.token);
    assertCurrent();
    tx.phase='prepared';save(storage,tx);
  }
  if(tx.phase==='prepared') {
    for(const p of tx.writes) {
      if(storage.getItem(p.key)!==p.after) {
        if(p.after===null)storage.removeItem(p.key);else storage.setItem(p.key,p.after);
      }
    }
    tx.phase='applied';save(storage,tx);
  }
  let result:Record<string,unknown>={accepted:true};
  if(tx.phase==='applied') {
    assertCurrent();
    result=await ports.accept(tx.token);
    if(result.accepted!==true) throw new Error('DOSSIER_FINALIZATION_FAILED');
    assertCurrent();
    tx.phase='acknowledged';save(storage,tx);
  }
  assertCurrent();
  if(storage.getItem(tx.publication.key)!==tx.publication.after) {
    if(tx.publication.after===null)storage.removeItem(tx.publication.key);
    else storage.setItem(tx.publication.key,tx.publication.after);
  }
  storage.removeItem(key(tx));
  return result;
}
