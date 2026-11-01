import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { getWritableDataDir } from '../paths';
import {
  createStarterState,
  validateStarterState,
  type StarterState,
} from './starter-runtime';

export interface StarterCommit {
  state: StarterState;
  text: string;
}
export class StarterStore {
  private db: Database.Database;
  constructor(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS starter_state (run TEXT PRIMARY KEY, revision INTEGER NOT NULL, state TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS starter_turn (run TEXT NOT NULL, turn TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(run, turn));`);
  }
  load(run: string, participantIds: string[]): StarterState {
    const row = this.db
      .prepare('SELECT state FROM starter_state WHERE run=?')
      .get(run) as { state: string } | undefined;
    if (!row) return createStarterState(run, participantIds);
    const s: unknown = JSON.parse(row.state);
    validateStarterState(s);
    return s;
  }
  replay(run: string, turn: string): StarterCommit | null {
    const row = this.db
      .prepare('SELECT result FROM starter_turn WHERE run=? AND turn=?')
      .get(run, turn) as { result: string } | undefined;
    return row ? (JSON.parse(row.result) as StarterCommit) : null;
  }
  commit(
    run: string,
    turn: string,
    previousRevision: number,
    result: StarterCommit
  ): StarterCommit {
    validateStarterState(result.state);
    if (result.state.playthroughId !== run)
      throw new Error('STARTER_SCOPE_MISMATCH');
    return this.db.transaction(() => {
      const replay = this.replay(run, turn);
      if (replay) return replay;
      const row = this.db
        .prepare('SELECT revision FROM starter_state WHERE run=?')
        .get(run) as { revision: number } | undefined;
      if ((row?.revision ?? 0) !== previousRevision)
        throw new Error('STARTER_CONCURRENT_TURN');
      this.db
        .prepare(
          'INSERT INTO starter_state(run,revision,state) VALUES(?,?,?) ON CONFLICT(run) DO UPDATE SET revision=excluded.revision,state=excluded.state'
        )
        .run(run, result.state.revision, JSON.stringify(result.state));
      this.db
        .prepare('INSERT INTO starter_turn(run,turn,result) VALUES(?,?,?)')
        .run(run, turn, JSON.stringify(result));
      return result;
    })();
  }
  restore(run: string, snapshot: StarterState): StarterState {
    validateStarterState(snapshot);
    const state = structuredClone(snapshot);
    state.playthroughId = run;
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM starter_turn WHERE run=?').run(run);
      this.db
        .prepare(
          'INSERT INTO starter_state(run,revision,state) VALUES(?,?,?) ON CONFLICT(run) DO UPDATE SET revision=excluded.revision,state=excluded.state'
        )
        .run(run, state.revision, JSON.stringify(state));
    })();
    return state;
  }
  close() {
    this.db.close();
  }
}
const stores = new Map<string, StarterStore>();
export function getStarterStore(): StarterStore {
  const file = path.join(
    getWritableDataDir(),
    'memory',
    'starter-dossier.sqlite3'
  );
  let store = stores.get(file);
  if (!store) {
    store = new StarterStore(file);
    stores.set(file, store);
  }
  return store;
}
