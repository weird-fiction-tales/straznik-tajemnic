import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { getWritableDataDir } from '@/lib/paths';
import { getCampaignMemoryLedgerStore } from './ledger-store';
import { drainMemoryIndex } from './index-queue';
import type { MemoryCommit } from './types';
import { isCampaignMemoryScope } from './campaign-scope';
import { updateDirectorState } from '@/lib/director-state';

type Turn = Parameters<ReturnType<typeof getCampaignMemoryLedgerStore>['recordConversationTurn']>[0];
// Route bundles share the volatile fallback when persisting the retry file fails.
const retryGlobal = globalThis as typeof globalThis & {
  __zewPendingMemoryRetries?: Map<string, {turn:Turn;expires:number}>;
};
const pending = retryGlobal.__zewPendingMemoryRetries ??= new Map<string, {turn:Turn;expires:number}>();
const retryFile = (token: string) => {
  if (!/^[a-f0-9-]{36}$/i.test(token)) throw new Error('INVALID_RETRY_TOKEN');
  return path.join(getWritableDataDir(), 'memory', 'pending-turns', `${token}.json`);
};

export function commitMemoryTurn(turn: Turn): MemoryCommit {
  const ledger = getCampaignMemoryLedgerStore();
  ledger.recordConversationTurn(turn);
  const revision = ledger.revision(turn.scope);
  void drainMemoryIndex(turn.scope).catch(()=>{});
  return {messageId:turn.messageId,status:'saved',revision};
}

export function retainFailedTurn(turn:Turn): string {
  for (const [id,item] of pending) if (item.expires < Date.now()) pending.delete(id);
  if (pending.size >= 100) pending.delete(pending.keys().next().value!);
  const token = randomUUID();
  const item = {turn,expires:Date.now()+30*60_000};
  pending.set(token,item);
  // A SQLite-specific failure should survive a process restart. If the entire
  // disk is unavailable, keep the in-process copy and still report failure.
  const file = retryFile(token);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(item), { flag: 'wx', mode: 0o600 });
    fs.renameSync(`${file}.tmp`, file);
  } catch (error) {
    console.warn('Could not persist memory retry; retry is available in this process only:', error);
  }
  return token;
}

export function retryMemoryTurn(token:string): MemoryCommit {
  const file = retryFile(token);
  let item = pending.get(token);
  if (!item && fs.existsSync(file)) item = JSON.parse(fs.readFileSync(file, 'utf8')) as {turn:Turn;expires:number};
  if (!item || item.expires < Date.now()) throw new Error('MEMORY_RETRY_EXPIRED');
  // Keep the token until expiry: a lost HTTP response can safely be retried.
  return commitMemoryTurn(item.turn);
}

interface DossierFinalizationResult {
  memoryCommit?: MemoryCommit & { retryToken?: string };
}
export interface DossierNarrativeTurn {
  correctionContextHash?: string;
  correctionAttempt?: boolean;
  turn: Turn;
  director?: {
    sessionId: string;
    metadata: Parameters<typeof updateDirectorState>[1];
    journalEntries?: Parameters<typeof updateDirectorState>[2];
  };
}
type StagedDossierTurn = {
  expires: number;
  commit?: () => DossierFinalizationResult | void;
  data?: DossierNarrativeTurn;
  prepared?: boolean;
  decision?: boolean;
  result?: DossierFinalizationResult;
  directorApplied?: boolean;
  correction?: DossierNarrativeTurn;
};
// Unvalidated drafts stay volatile. Only prepareDossierTurn, called after the
// local preview accepts every effect, may write a recovery record.
const serverGlobal = globalThis as typeof globalThis & {
  __zewStagedDossierTurns?: Map<string, StagedDossierTurn>;
};
const stagedDossierTurns = serverGlobal.__zewStagedDossierTurns ??= new Map<string, StagedDossierTurn>();
const dossierFile = (token: string) => {
  if (!/^[a-f0-9-]{36}$/i.test(token)) throw new Error('INVALID_FINALIZATION_TOKEN');
  return path.join(getWritableDataDir(), 'memory', 'dossier-turns', `${token}.json`);
};
function writeDossierReceipt(token: string, record: object): void {
  const file = dossierFile(token), temporary = `${file}.${randomUUID()}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    fs.writeFileSync(temporary, JSON.stringify({schemaVersion:1,token,...record}), {flag:'wx',mode:0o600});
    const fd=fs.openSync(temporary,'r');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temporary,file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
function loadDossierTurn(token: string): StagedDossierTurn {
  const cached=stagedDossierTurns.get(token);
  if (cached && (cached.prepared || cached.expires >= Date.now())) return cached;
  const file=dossierFile(token);
  if (!fs.existsSync(file)) throw new Error('DOSSIER_FINALIZATION_EXPIRED');
  const saved=JSON.parse(fs.readFileSync(file,'utf8')) as {
    schemaVersion?:number;token?:string;phase?:string;data?:DossierNarrativeTurn;result?:DossierFinalizationResult;
  };
  if(saved.schemaVersion!==1 || saved.token!==token || !['prepared','accepted','rejected'].includes(saved.phase ?? '')) {
    throw new Error('DOSSIER_FINALIZATION_CORRUPT');
  }
  if(saved.phase==='prepared' && (!saved.data || !isCampaignMemoryScope(saved.data.turn?.scope) ||
    typeof saved.data.turn.messageId!=='string' || typeof saved.data.turn.sessionId!=='string' ||
    typeof saved.data.turn.userText!=='string' || typeof saved.data.turn.assistantText!=='string')) {
    throw new Error('DOSSIER_FINALIZATION_CORRUPT');
  }
  const item:StagedDossierTurn={expires:Date.now()+30*60_000,prepared:true,
    ...(saved.phase==='prepared'?{data:saved.data}:{decision:saved.phase==='accepted',result:saved.result})};
  stagedDossierTurns.set(token,item);
  return item;
}
export function stageDossierTurn(data: DossierNarrativeTurn | NonNullable<StagedDossierTurn['commit']>): string {
  for (const [token, item] of stagedDossierTurns) {
    if (item.expires < Date.now()) stagedDossierTurns.delete(token);
  }
  if (stagedDossierTurns.size >= 100) throw new Error('DOSSIER_FINALIZATION_CAPACITY');
  const token = randomUUID();
  stagedDossierTurns.set(token, { expires: Date.now() + 30 * 60_000,
    ...(typeof data==='function'?{commit:data}:{data:JSON.parse(JSON.stringify(data)) as DossierNarrativeTurn}) });
  return token;
}

/** Durable recovery only, never a ledger/director commit. The client has accepted the local preview. */
export function prepareDossierTurn(token:string): {prepared:true} {
  const item=loadDossierTurn(token);
  if(item.decision===false) throw new Error('DOSSIER_TURN_REJECTED');
  if(item.prepared) return {prepared:true};
  if(!item.data) throw new Error('DOSSIER_RECOVERY_DATA_REQUIRED');
  writeDossierReceipt(token,{phase:'prepared',data:item.data});
  item.prepared=true;
  return {prepared:true};
}

export function finalizeDossierTurn(token: string, accepted: boolean): DossierFinalizationResult & { accepted: boolean } {
  const item = loadDossierTurn(token);
  if (item.decision === false && accepted) throw new Error('DOSSIER_TURN_REJECTED');
  if (item.decision === true && !accepted) throw new Error('DOSSIER_TURN_ALREADY_ACCEPTED');
  if (item.decision === undefined) {
    let result:DossierFinalizationResult={};
    if(accepted && item.data) {
      if(!item.prepared) throw new Error('DOSSIER_TURN_NOT_PREPARED');
      // The ledger deduplicates by campaign+message and rejects different content.
      result={memoryCommit:commitMemoryTurn(item.data.turn)};
      if(item.data.director && !item.directorApplied) {
        const director=item.data.director;
        updateDirectorState(director.sessionId,director.metadata,director.journalEntries);
        item.directorApplied=true;
      }
    } else if(accepted && item.commit) result=item.commit() ?? {};
    if(item.prepared) writeDossierReceipt(token,{phase:accepted?'accepted':'rejected',...(accepted?{result}: {})});
    if (!accepted && !item.prepared && item.data?.correctionContextHash && !item.data.correctionAttempt) {
      item.correction = item.data;
    }
    item.result=result;
    item.decision=accepted;
    item.data=undefined;
    item.commit=undefined;
  }
  return { accepted, ...item.result };
}


/** One volatile correction slot. Never restore rejected drafts from disk or write them to campaign memory. */
export function consumeDossierCorrection(token: string, identity: {
  scope: Turn['scope']; sessionId: string; messageId: string; userText: string; contextHash: string;
}): string {
  const item = loadDossierTurn(token);
  const draft = item.correction;
  if (item.decision !== false || item.prepared || !draft) throw new Error('DOSSIER_CORRECTION_UNAVAILABLE');
  const original = draft.turn;
  if (original.scope.playthroughId !== identity.scope.playthroughId ||
    original.scope.campaignDefinitionId !== identity.scope.campaignDefinitionId ||
    original.scope.adventureId !== identity.scope.adventureId || original.scope.kind !== identity.scope.kind ||
    original.sessionId !== identity.sessionId || original.messageId !== identity.messageId ||
    original.userText !== identity.userText || draft.correctionContextHash !== identity.contextHash) {
    throw new Error('DOSSIER_CORRECTION_SCOPE');
  }
  item.correction = undefined;
  return original.assistantText;
}
