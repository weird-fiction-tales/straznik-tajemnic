import type { MemoryLedgerEntry } from './types';

import { parseRevealedTags } from './revealed-facts';

export const SHARED_KNOWLEDGE_POLICY = 'party-revealed-v1';
export const publicMemoryText = (text: string): string => parseRevealedTags(text).text.trim();

/** The archive flag describes compression, never whether a fact remains true. */
export function currentMemoryEntries(entries:MemoryLedgerEntry[]):MemoryLedgerEntry[] {
  const latest = new Map<string,MemoryLedgerEntry>();
  for (const entry of entries) if(entry.entityId) {
    const key = entry.entityId;
    const old = latest.get(key);
    if (!old || old.sequence < entry.sequence) latest.set(key,entry);
  }
  const obsoleteMessages = new Set<string>();
  for (const entry of entries) if(entry.entityId) {
    const current = latest.get(entry.entityId);
    if(current?.id !== entry.id) entry.sourceMessageIds.forEach(id=>obsoleteMessages.add(id));
  }
  return entries.filter(e=>e.entityId
    ? latest.get(e.entityId)?.id === e.id
    : e.kind !== 'conversation' || !e.sourceMessageIds.some(id=>obsoleteMessages.has(id)));
}


/** Ledger facts are revealed evidence; recipients record attribution, not access. */
export function sharedKnowledge(entries: MemoryLedgerEntry[]): MemoryLedgerEntry[] {
  return currentMemoryEntries(entries).filter(e => e.kind !== 'summary').map(e => ({ ...e, text: publicMemoryText(e.text) })).filter(e => e.text.trim());
}
