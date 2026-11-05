import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'crypto';
import { getWritableDataDir } from '@/lib/paths';
import { isCampaignMemoryScope } from './campaign-scope';
import { validateMemorySnapshot } from './snapshot';
import { extractRevealedTurn } from './revealed-facts';
import type {
  CampaignMemoryScope,
  CampaignMemorySearchResult,
  CampaignCompressionCheckpoint,
  CampaignCompressionFailureState,
  MemoryLedgerEntry,
  MemoryLedgerKind,
  MemoryLedgerRole,
  RevealedMemoryFact,
  CampaignMemorySnapshot,
  MemoryFactMetadata,
} from './types';

const DB_FILE = 'campaign-memory.sqlite3';

type LedgerRow = {
  id: string;
  playthrough_id: string;
  campaign_definition_id: string;
  adventure_id: string;
  memory_kind: MemoryLedgerKind;
  session_id: string;
  sequence_no: number;
  role: MemoryLedgerRole;
  text: string;
  tags_json: string;
  source_message_ids_json: string;
  revealed_at: string;
  active: number;
  fact_json: string;
};

function parseJsonArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Normalizes and strips system directives (such as [KONIEC_SESJI:FINAL], [KONIEC_SESJI], [END_SESSION:FINAL])
 * from message or entry text for ledger comparison and persistent storage (Issue #560).
 */
export function stripSystemDirectivesForLedger(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[\s*(?:KONIEC_SESJI|END_SESSION)[^\]]*\]/gi, '')
    .replace(/\[\s*(?:INSTRUKCJA|SYSTEM|DIRECTIVE|GM_DIRECTIVE|GM\s+DIRECTIVE)(?::|[\s_\-])[^\]]*\]/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export class CampaignMemoryLedgerStore {
  private db: Database.Database;
  private ftsAvailable = true;

  constructor(filePath: string = path.join(getWritableDataDir(), 'memory', DB_FILE)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new Database(filePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    const version = this.db.pragma('user_version', { simple: true }) as number;
    if (version > 2) { this.db.close(); throw new Error('Unsupported memory schema'); }
    if (version < 2 && this.db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'memory_entries'").get()) {
      // VACUUM INTO produces a consistent snapshot including committed WAL pages.
      this.db.prepare('VACUUM INTO ?').run(`${filePath}.before-v2-${randomUUID()}.backup`);
    }
    this.initializeSchema();
    if (version < 2) {
      this.db.exec('INSERT OR IGNORE INTO memory_index_jobs(entry_id) SELECT id FROM memory_entries');
      this.rebuildFts();
    }
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memory_entries (
        rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        playthrough_id TEXT NOT NULL,
        campaign_definition_id TEXT NOT NULL,
        adventure_id TEXT NOT NULL,
        memory_kind TEXT NOT NULL,
        session_id TEXT NOT NULL,
        sequence_no INTEGER NOT NULL,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        tags_json TEXT NOT NULL DEFAULT '[]',
        source_message_ids_json TEXT NOT NULL DEFAULT '[]',
        revealed_at TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        UNIQUE(playthrough_id, session_id, sequence_no, role, memory_kind)
      );
      CREATE INDEX IF NOT EXISTS idx_memory_scope_sequence
        ON memory_entries(playthrough_id, sequence_no DESC);
      CREATE TABLE IF NOT EXISTS compression_checkpoints (
        id TEXT PRIMARY KEY,
        playthrough_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        source_start_sequence INTEGER NOT NULL,
        source_end_sequence INTEGER NOT NULL,
        source_message_ids_json TEXT NOT NULL DEFAULT '[]',
        summary TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_compression_scope_version
        ON compression_checkpoints(playthrough_id, version DESC);
      CREATE TABLE IF NOT EXISTS compression_failures (
        playthrough_id TEXT PRIMARY KEY,
        failure_count INTEGER NOT NULL,
        retry_after TEXT
      );
      CREATE TABLE IF NOT EXISTS memory_runs (
        playthrough_id TEXT PRIMARY KEY, campaign_definition_id TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memory_turns (
        playthrough_id TEXT NOT NULL, message_id TEXT NOT NULL, content_hash TEXT NOT NULL,
        PRIMARY KEY(playthrough_id, message_id)
      );
      CREATE TABLE IF NOT EXISTS memory_index_jobs (
        entry_id TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0,
        retry_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS memory_restores (
        request_id TEXT PRIMARY KEY, snapshot_hash TEXT NOT NULL, scope_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memory_links (
        entry_id TEXT NOT NULL, entity_id TEXT NOT NULL,
        PRIMARY KEY(entry_id, entity_id)
      );
    `);
    const entryColumns = this.db.pragma('table_info(memory_entries)') as Array<{name: string}>;
    if (!entryColumns.some(c => c.name === 'fact_json')) {
      this.db.exec("ALTER TABLE memory_entries ADD COLUMN fact_json TEXT NOT NULL DEFAULT '{}'");
    }
    const checkpointColumns = this.db.pragma('table_info(compression_checkpoints)') as Array<{ name: string }>;
    if (!checkpointColumns.some((column) => column.name === 'source_message_ids_json')) {
      this.db.exec("ALTER TABLE compression_checkpoints ADD COLUMN source_message_ids_json TEXT NOT NULL DEFAULT '[]'");
    }
    for (const column of ['source_hash', 'locale', 'model_id', 'knowledge_policy', 'knowledge_hash']) {
      if (!checkpointColumns.some(c => c.name === column)) this.db.exec(`ALTER TABLE compression_checkpoints ADD COLUMN ${column} TEXT`);
    }
    this.db.exec(`INSERT OR IGNORE INTO memory_runs SELECT playthrough_id, campaign_definition_id FROM memory_entries GROUP BY playthrough_id`);
    this.ensureFts();
    this.db.pragma('user_version = 2');
  }

  assertScope(scope: CampaignMemoryScope): void {
    if (!isCampaignMemoryScope(scope) || !/^[a-zA-Z0-9_-]{1,160}$/.test(scope.playthroughId)) throw new Error('Invalid memory scope');
    const run = this.db.prepare('SELECT campaign_definition_id FROM memory_runs WHERE playthrough_id = ?').get(scope.playthroughId) as {campaign_definition_id:string} | undefined;
    if (run && run.campaign_definition_id !== scope.campaignDefinitionId) throw new Error('Campaign scope conflict');
  }

  private ensureFts(): void {
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memory_entries_fts USING fts5(
          text,
          tags_json,
          content='memory_entries',
          content_rowid='rowid',
          tokenize='unicode61 remove_diacritics 2'
        );
        CREATE TRIGGER IF NOT EXISTS memory_entries_ai AFTER INSERT ON memory_entries BEGIN
          INSERT INTO memory_entries_fts(rowid, text, tags_json)
          VALUES (new.rowid, new.text, new.tags_json);
        END;
        CREATE TRIGGER IF NOT EXISTS memory_entries_ad AFTER DELETE ON memory_entries BEGIN
          INSERT INTO memory_entries_fts(memory_entries_fts, rowid, text, tags_json)
          VALUES ('delete', old.rowid, old.text, old.tags_json);
        END;
        CREATE TRIGGER IF NOT EXISTS memory_entries_au AFTER UPDATE ON memory_entries BEGIN
          INSERT INTO memory_entries_fts(memory_entries_fts, rowid, text, tags_json)
          VALUES ('delete', old.rowid, old.text, old.tags_json);
          INSERT INTO memory_entries_fts(rowid, text, tags_json)
          VALUES (new.rowid, new.text, new.tags_json);
        END;
      `);
      this.ftsAvailable = true;
      this.setMeta('fts_stale', '0');
    } catch (error) {
      this.ftsAvailable = false;
      this.setMeta('fts_stale', '1');
      console.warn('Campaign memory FTS unavailable, using LIKE fallback:', error);
    }
  }

  private setMeta(key: string, value: string): void {
    this.db.prepare(`
      INSERT INTO memory_meta(key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  }

  append(entry: MemoryLedgerEntry): boolean {
    this.assertScope(entry.scope);
    this.db.prepare('INSERT OR IGNORE INTO memory_runs VALUES (?, ?)').run(entry.scope.playthroughId, entry.scope.campaignDefinitionId);
    const {entityId, status, recipients, sourceJournalEntryId, supersededBy, relatedEntityIds, provenance} = entry;
    const fact: MemoryFactMetadata = {entityId, status, recipients, sourceJournalEntryId, supersededBy, relatedEntityIds, provenance};
    const storedText = entry.kind === 'conversation' ? (stripSystemDirectivesForLedger(entry.text) || entry.text) : entry.text;
    const insert = () => this.db.prepare(`
      INSERT OR IGNORE INTO memory_entries (
        id, playthrough_id, campaign_definition_id, adventure_id, memory_kind,
        session_id, sequence_no, role, text, tags_json,
        source_message_ids_json, revealed_at, active, fact_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id,
      entry.scope.playthroughId,
      entry.scope.campaignDefinitionId,
      entry.scope.adventureId,
      entry.kind,
      entry.sessionId,
      entry.sequence,
      entry.role,
      storedText,
      JSON.stringify(entry.tags),
      JSON.stringify(entry.sourceMessageIds),
      entry.revealedAt,
      entry.active ? 1 : 0,
      JSON.stringify(fact)
    );
    let result: Database.RunResult;
    try {
      result = insert();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/fts|memory_entries_fts|malformed/i.test(message)) throw error;
      // The canonical table must remain writable even if a derived trigger or
      // virtual table is corrupt. Remove only the derived write hooks and retry.
      this.db.exec(`
        DROP TRIGGER IF EXISTS memory_entries_ai;
        DROP TRIGGER IF EXISTS memory_entries_ad;
        DROP TRIGGER IF EXISTS memory_entries_au;
      `);
      this.ftsAvailable = false;
      this.setMeta('fts_stale', '1');
      console.warn('Campaign memory FTS write failed, preserving canonical ledger:', error);
      result = insert();
    }
    if (result.changes > 0) {
      this.db.prepare('INSERT OR IGNORE INTO memory_index_jobs(entry_id) VALUES (?)').run(entry.id);
      for (const entity of new Set([entityId, supersededBy, ...(relatedEntityIds ?? [])].filter((id): id is string => Boolean(id)))) {
        this.db.prepare('INSERT OR IGNORE INTO memory_links VALUES (?, ?)').run(entry.id, entity);
      }
    }
    return result.changes > 0;
  }

  appendMany(entries: MemoryLedgerEntry[]): number {
    const append = this.db.transaction((items: MemoryLedgerEntry[]) => {
      let inserted = 0;
      for (const entry of items) inserted += this.append(entry) ? 1 : 0;
      return inserted;
    });
    return append(entries);
  }

  recordConversationTurn(input: {
    scope: CampaignMemoryScope;
    sessionId: string;
    messageId: string;
    userMessageId?: string;
    recipientIds?: string[];
    userText: string;
    assistantText: string;
    revealedAt?: string;
    facts?: RevealedMemoryFact[];
  }): number {
    return this.db.transaction(() => {
      this.assertScope(input.scope);
      const cleanUserText = stripSystemDirectivesForLedger(input.userText) || input.userText;
      const cleanAssistantText = stripSystemDirectivesForLedger(input.assistantText) || input.assistantText;
      const hash = createHash('sha256').update(JSON.stringify([cleanUserText,cleanAssistantText])).digest('hex');
      const previous = this.db.prepare('SELECT content_hash FROM memory_turns WHERE playthrough_id = ? AND message_id = ?').get(input.scope.playthroughId,input.messageId) as {content_hash:string} | undefined;
      if (previous) {
        if (previous.content_hash !== hash) throw new Error('Memory turn content conflict');
        return 0;
      }
      const prefix = `${input.scope.playthroughId}::${input.messageId}`;
      const legacy = this.db.prepare('SELECT 1 FROM memory_entries WHERE playthrough_id = ? AND id IN (?, ?)').get(input.scope.playthroughId,`${input.messageId}:user`,`${prefix}:user`);
      if (legacy) return 0;
      const nextSequence = (
        this.db.prepare(
          'SELECT COALESCE(MAX(sequence_no), 0) + 1 AS next_sequence FROM memory_entries WHERE playthrough_id = ?'
        ).get(input.scope.playthroughId) as { next_sequence: number }
      ).next_sequence;
      const revealedAt = input.revealedAt ?? new Date().toISOString();
      const entries: MemoryLedgerEntry[] = [{
        id: `${prefix}:user`,
        scope: input.scope,
        sessionId: input.sessionId,
        sequence: nextSequence,
        role: 'user',
        kind: 'conversation',
        text: cleanUserText,
        tags: [],
        sourceMessageIds: [input.userMessageId ?? `${input.messageId}:user`],
        revealedAt,
        active: true,
        recipients: input.recipientIds,
      }];
      if (cleanAssistantText.trim()) {
        entries.push({
          id: `${prefix}:assistant`,
          scope: input.scope,
          sessionId: input.sessionId,
          sequence: nextSequence + entries.length,
          role: 'assistant',
          kind: 'conversation',
          text: cleanAssistantText,
          tags: [],
          sourceMessageIds: [input.messageId],
          revealedAt,
          active: true,
          recipients: input.recipientIds,
        });
      }
      for (const [index, fact] of (input.facts ?? []).entries()) {
        const text = fact.text.trim();
        if (!text) continue;
        entries.push({
          ...fact,
          id: `${prefix}:${fact.kind}:${index}`,
          scope: input.scope,
          sessionId: input.sessionId,
          sequence: nextSequence + entries.length,
          role: 'assistant',
          kind: fact.kind,
          text,
          tags: fact.tags ?? [],
          sourceMessageIds: [input.messageId],
          revealedAt,
          active: true,
        });
      }
      let inserted = 0;
      for (const entry of entries) inserted += this.append(entry) ? 1 : 0;
      this.db.prepare('INSERT INTO memory_turns VALUES (?, ?, ?)').run(input.scope.playthroughId,input.messageId,hash);
      return inserted;
    })();
  }

  search(scope: CampaignMemoryScope, query: string, limit = 20): CampaignMemorySearchResult[] {
    this.assertScope(scope);
    const trimmed = query.trim();
    if (!trimmed) return [];

    const tokens = trimmed.match(/[\p{L}\p{N}]+/gu)?.slice(0, 12) ?? [];
    const ftsQuery = tokens.map((token) => `"${token}"`).join(' OR ');
    if (this.ftsAvailable && ftsQuery) {
      try {
        const rows = this.db.prepare(`
          SELECT e.*, bm25(memory_entries_fts) AS rank
          FROM memory_entries_fts
          JOIN memory_entries e ON e.rowid = memory_entries_fts.rowid
          WHERE memory_entries_fts MATCH ? AND e.playthrough_id = ? AND e.campaign_definition_id = ?
          ORDER BY rank ASC, e.sequence_no DESC
          LIMIT ?
        `).all(ftsQuery, scope.playthroughId, scope.campaignDefinitionId, limit) as Array<LedgerRow & { rank: number }>;
        return rows.map((row) => this.toSearchResult(row, 1 / (1 + Math.max(0, row.rank)), 'fts'));
      } catch (error) {
        this.ftsAvailable = false;
        this.setMeta('fts_stale', '1');
        console.warn('Campaign memory FTS query failed, using LIKE fallback:', error);
      }
    }

    const likeTokens = tokens.length > 0 ? tokens.slice(0, 8) : [trimmed];
    const clauses = likeTokens.map(() => `text LIKE ? ESCAPE '\\'`).join(' OR ');
    const patterns = likeTokens.map((token) => `%${token.replace(/[\\%_]/g, '\\$&')}%`);
    const rows = this.db.prepare(`
      SELECT * FROM memory_entries
      WHERE playthrough_id = ? AND campaign_definition_id = ? AND (${clauses})
      ORDER BY sequence_no DESC
      LIMIT ?
    `).all(scope.playthroughId, scope.campaignDefinitionId, ...patterns, limit) as LedgerRow[];
    return rows.map((row, index) => this.toSearchResult(row, 1 / (index + 1), 'like'));
  }

  rebuildFts(): boolean {
    try {
      // FTS is a derived index. Recreate the complete FTS schema so recovery
      // also works after a corrupt or manually removed virtual table.
      this.db.exec(`
        DROP TRIGGER IF EXISTS memory_entries_ai;
        DROP TRIGGER IF EXISTS memory_entries_ad;
        DROP TRIGGER IF EXISTS memory_entries_au;
        DROP TABLE IF EXISTS memory_entries_fts;
      `);
      this.ensureFts();
      if (!this.ftsAvailable) return false;
      this.db.exec(`INSERT INTO memory_entries_fts(memory_entries_fts) VALUES ('rebuild')`);
      this.ftsAvailable = true;
      this.setMeta('fts_stale', '0');
      return true;
    } catch (error) {
      this.ftsAvailable = false;
      this.setMeta('fts_stale', '1');
      console.warn('Campaign memory FTS rebuild failed:', error);
      return false;
    }
  }

  list(scope: CampaignMemoryScope): MemoryLedgerEntry[] {
    this.assertScope(scope);
    const rows = this.db.prepare(`
      SELECT * FROM memory_entries
      WHERE playthrough_id = ? AND campaign_definition_id = ?
      ORDER BY sequence_no ASC, rowid ASC
    `).all(scope.playthroughId,scope.campaignDefinitionId) as LedgerRow[];
    return rows.map((row) => this.toEntry(row, scope));
  }

  revision(scope: CampaignMemoryScope): number {
    this.assertScope(scope);
    return (this.db.prepare('SELECT COALESCE(MAX(sequence_no),0) AS revision FROM memory_entries WHERE playthrough_id = ? AND campaign_definition_id = ?').get(scope.playthroughId,scope.campaignDefinitionId) as {revision:number}).revision;
  }

  getEntry(scope: CampaignMemoryScope, id: string): MemoryLedgerEntry | null {
    this.assertScope(scope);
    const row = this.db.prepare('SELECT * FROM memory_entries WHERE playthrough_id = ? AND campaign_definition_id = ? AND id = ?').get(scope.playthroughId,scope.campaignDefinitionId,id) as LedgerRow | undefined;
    return row ? this.toEntry(row,scope) : null;
  }

  related(scope: CampaignMemoryScope, entityIds: string[], limit = 8): MemoryLedgerEntry[] {
    this.assertScope(scope);
    const ids = [...new Set(entityIds)].slice(0,32);
    if (!ids.length) return [];
    const rows = this.db.prepare(`SELECT DISTINCT e.* FROM memory_entries e JOIN memory_links l ON l.entry_id = e.id
      WHERE e.playthrough_id = ? AND e.campaign_definition_id = ? AND l.entity_id IN (${ids.map(()=>'?').join(',')})
      ORDER BY e.sequence_no DESC LIMIT ?`).all(scope.playthroughId,scope.campaignDefinitionId,...ids,limit) as LedgerRow[];
    return rows.map(row=>this.toEntry(row,scope));
  }

  pendingIndexEntries(scope: CampaignMemoryScope, limit = 16): MemoryLedgerEntry[] {
    this.assertScope(scope);
    const rows = this.db.prepare(`SELECT e.* FROM memory_entries e JOIN memory_index_jobs j ON e.id = j.entry_id
      WHERE e.playthrough_id = ? AND e.campaign_definition_id = ? AND j.retry_at <= ?
      ORDER BY e.sequence_no LIMIT ?`).all(scope.playthroughId,scope.campaignDefinitionId,Date.now(),limit) as LedgerRow[];
    return rows.map(row=>this.toEntry(row,scope));
  }

  ensureIndexSignature(scope: CampaignMemoryScope, signature: string): void {
    this.assertScope(scope);
    const key = `embedding:${scope.playthroughId}`;
    this.db.transaction(() => {
      const previous = this.db.prepare('SELECT value FROM memory_meta WHERE key = ?').get(key) as { value: string } | undefined;
      if (previous?.value === signature) return;
      this.db.prepare(`INSERT OR IGNORE INTO memory_index_jobs(entry_id)
        SELECT id FROM memory_entries WHERE playthrough_id = ? AND campaign_definition_id = ?`)
        .run(scope.playthroughId, scope.campaignDefinitionId);
      this.setMeta(key, signature);
    })();
  }

  finishIndexJob(id: string, success: boolean): void {
    if (success) this.db.prepare('DELETE FROM memory_index_jobs WHERE entry_id = ?').run(id);
    else this.db.prepare('UPDATE memory_index_jobs SET attempts = attempts + 1, retry_at = ? WHERE entry_id = ?').run(Date.now()+60_000,id);
  }

  createSnapshot(scope: CampaignMemoryScope, messages: Array<{id:string;role:string;content:string}>): CampaignMemorySnapshot {
    const entries = this.list(scope);
    const byMessage = new Map(messages.map(message=>[message.id,message]));
    const committedMessages = new Set(entries.filter(entry => entry.kind === 'conversation')
      .flatMap(entry => entry.sourceMessageIds));
    for (const message of messages) {
      if (message.role === 'assistant' && extractRevealedTurn(message.content, message.id).narrative.trim()
        && !committedMessages.has(message.id)) {
        throw new Error('Save contains a response that has not been committed to memory');
      }
    }
    let cutoff = 0;
    for (const entry of entries) {
      if (entry.kind !== 'conversation') continue;
      for (const id of entry.sourceMessageIds) {
        const message = byMessage.get(id);
        if (!message) continue;
        const text = message.role === 'assistant' ? extractRevealedTurn(message.content, message.id).narrative : message.content;
        const normalizedMessageText = stripSystemDirectivesForLedger(text).trim();
        const normalizedEntryText = stripSystemDirectivesForLedger(entry.text).trim();
        if (message.role !== entry.role || normalizedMessageText !== normalizedEntryText) throw new Error('Save history conflicts with committed memory');
        cutoff = Math.max(cutoff,entry.sequence);
      }
    }
    // Include structured records from the selected turn, but never later turns.
    const selected = entries.filter(entry=>entry.sequence <= cutoff ||
      (entry.kind !== 'conversation' && (!entry.sourceMessageIds.length || entry.sourceMessageIds.some(id=>byMessage.has(id)))));
    const cleanSelected = selected.map(entry => {
      if (entry.kind === 'conversation') {
        const cleanText = stripSystemDirectivesForLedger(entry.text);
        if (cleanText && cleanText !== entry.text) {
          return { ...entry, text: cleanText };
        }
      }
      return entry;
    });
    const checkpoint = this.getLatestCheckpoint(scope.playthroughId);
    return {schemaVersion:1,scope,revision:Math.max(0,...cleanSelected.map(e=>e.sequence)),entries:cleanSelected,
      checkpoints:checkpoint && checkpoint.sourceMessageIds.every(id=>byMessage.has(id)) ? [checkpoint] : []};
  }

  restoreSnapshot(snapshot: CampaignMemorySnapshot, requestId: string): CampaignMemoryScope {
    validateMemorySnapshot(snapshot);
    if (!/^[a-zA-Z0-9_-]{1,160}$/.test(requestId)) throw new Error('Invalid restore request');
    const hash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    return this.db.transaction(()=>{
      const previous = this.db.prepare('SELECT * FROM memory_restores WHERE request_id = ?').get(requestId) as {snapshot_hash:string;scope_json:string} | undefined;
      if (previous) {
        if (previous.snapshot_hash !== hash) throw new Error('Restore request conflict');
        return JSON.parse(previous.scope_json) as CampaignMemoryScope;
      }
      const scope = {...snapshot.scope,playthroughId:`run-${randomUUID()}`};
      this.db.prepare('INSERT INTO memory_runs VALUES (?, ?)').run(scope.playthroughId,scope.campaignDefinitionId);
      for (const entry of snapshot.entries) this.append({...entry,
        id:`${scope.playthroughId}::${createHash('sha256').update(entry.id).digest('hex')}`,
        scope:{...scope,adventureId:entry.scope.adventureId},sessionId:scope.playthroughId});
      for (const checkpoint of snapshot.checkpoints) this.saveCheckpoint({...checkpoint,id:`${scope.playthroughId}::${checkpoint.id}`,playthroughId:scope.playthroughId});
      this.db.prepare('INSERT INTO memory_restores VALUES (?, ?, ?)').run(requestId,hash,JSON.stringify(scope));
      return scope;
    })();
  }

  getLatestCheckpoint(playthroughId: string): CampaignCompressionCheckpoint | null {
    const row = this.db.prepare(`
      SELECT * FROM compression_checkpoints
      WHERE playthrough_id = ? ORDER BY version DESC LIMIT 1
    `).get(playthroughId) as {
      id: string;
      playthrough_id: string;
      version: number;
      source_start_sequence: number;
      source_end_sequence: number;
      source_message_ids_json: string;
      summary: string;
      created_at: string;
      source_hash: string | null;
      locale: 'pl' | 'en' | null;
      model_id: string | null;
      knowledge_policy: string | null;
      knowledge_hash: string | null;
    } | undefined;
    if (!row) return null;
    const failure = this.getCompressionFailure(playthroughId);
    return {
      id: row.id,
      playthroughId: row.playthrough_id,
      version: row.version,
      sourceStartSequence: row.source_start_sequence,
      sourceEndSequence: row.source_end_sequence,
      sourceMessageIds: parseJsonArray(row.source_message_ids_json),
      summary: row.summary,
      createdAt: row.created_at,
      failureCount: failure.failureCount,
      retryAfter: failure.retryAfter,
      sourceHash: row.source_hash ?? undefined,
      locale: row.locale ?? undefined,
      modelId: row.model_id ?? undefined,
      knowledgePolicy: row.knowledge_policy ?? undefined,
      knowledgeHash: row.knowledge_hash ?? undefined,
    };
  }

  saveCheckpoint(input: Omit<CampaignCompressionCheckpoint, 'failureCount' | 'retryAfter'>): void {
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT OR IGNORE INTO compression_checkpoints (
          id, playthrough_id, version, source_start_sequence,
          source_end_sequence, source_message_ids_json, summary, created_at, source_hash, locale, model_id, knowledge_policy, knowledge_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.id,
        input.playthroughId,
        input.version,
        input.sourceStartSequence,
        input.sourceEndSequence,
        JSON.stringify(input.sourceMessageIds),
        input.summary,
        input.createdAt,
        input.sourceHash ?? null, input.locale ?? null, input.modelId ?? null, input.knowledgePolicy ?? null, input.knowledgeHash ?? null
      );
      const sourceIds = new Set(input.sourceMessageIds);
      if (sourceIds.size > 0) {
        const candidates = this.db.prepare(`
          SELECT id, source_message_ids_json FROM memory_entries WHERE playthrough_id = ?
        `).all(input.playthroughId) as Array<{ id: string; source_message_ids_json: string }>;
        const entryIds = candidates
          .filter((entry) => parseJsonArray(entry.source_message_ids_json).some((id) => sourceIds.has(id)))
          .map((entry) => entry.id);
        if (entryIds.length > 0) {
          const placeholders = entryIds.map(() => '?').join(', ');
          this.db.prepare(`UPDATE memory_entries SET active = 0 WHERE id IN (${placeholders})`).run(...entryIds);
        }
      }
      this.clearCompressionFailure(input.playthroughId);
    })();
  }

  getCompressionFailure(playthroughId: string): CampaignCompressionFailureState {
    const row = this.db.prepare(`
      SELECT failure_count, retry_after FROM compression_failures WHERE playthrough_id = ?
    `).get(playthroughId) as { failure_count: number; retry_after: string | null } | undefined;
    return {
      playthroughId,
      failureCount: row?.failure_count ?? 0,
      retryAfter: row?.retry_after ?? null,
    };
  }

  recordCompressionFailure(playthroughId: string, now = Date.now()): CampaignCompressionFailureState {
    const previous = this.getCompressionFailure(playthroughId);
    const failureCount = previous.failureCount + 1;
    const delays = [60, 300, 900];
    const delaySeconds = delays[Math.min(failureCount - 1, delays.length - 1)];
    const retryAfter = new Date(now + delaySeconds * 1000).toISOString();
    this.db.prepare(`
      INSERT INTO compression_failures(playthrough_id, failure_count, retry_after)
      VALUES (?, ?, ?)
      ON CONFLICT(playthrough_id) DO UPDATE SET
        failure_count = excluded.failure_count,
        retry_after = excluded.retry_after
    `).run(playthroughId, failureCount, retryAfter);
    return { playthroughId, failureCount, retryAfter };
  }

  clearCompressionFailure(playthroughId: string): void {
    this.db.prepare('DELETE FROM compression_failures WHERE playthrough_id = ?').run(playthroughId);
  }

  close(): void {
    this.db.close();
  }

  private toEntry(row: LedgerRow, scope: CampaignMemoryScope): MemoryLedgerEntry {
    return {
      ...JSON.parse(row.fact_json || '{}') as MemoryFactMetadata,
      id: row.id,
      scope: {...scope, adventureId: row.adventure_id, campaignDefinitionId: row.campaign_definition_id},
      sessionId: row.session_id,
      sequence: row.sequence_no,
      role: row.role,
      kind: row.memory_kind,
      text: row.memory_kind === 'conversation' ? (stripSystemDirectivesForLedger(row.text) || row.text) : row.text,
      tags: parseJsonArray(row.tags_json),
      sourceMessageIds: parseJsonArray(row.source_message_ids_json),
      revealedAt: row.revealed_at,
      active: row.active === 1,
    };
  }

  private toSearchResult(
    row: LedgerRow,
    score: number,
    source: 'fts' | 'like'
  ): CampaignMemorySearchResult {
    return {
      ...JSON.parse(row.fact_json || '{}') as MemoryFactMetadata,
      id: row.id,
      text: row.memory_kind === 'conversation' ? (stripSystemDirectivesForLedger(row.text) || row.text) : row.text,
      score,
      kind: row.memory_kind,
      role: row.role,
      sequence: row.sequence_no,
      tags: parseJsonArray(row.tags_json),
      source,
    };
  }
}

let singleton: CampaignMemoryLedgerStore | null = null;

export function getCampaignMemoryLedgerStore(): CampaignMemoryLedgerStore {
  if (!singleton) singleton = new CampaignMemoryLedgerStore();
  return singleton;
}

export function _resetCampaignMemoryLedgerStore(): void {
  singleton?.close();
  singleton = null;
}
