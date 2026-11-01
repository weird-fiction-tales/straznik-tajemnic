import { serialize, deserialize } from 'node:v8';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StarterStore } from './starter-store';
import { createStarterState } from './starter-runtime';

Object.assign(globalThis, {
  structuredClone: <T>(value: T): T => deserialize(serialize(value)),
});

describe('Starter save and turn boundaries', () => {
  let dir: string;
  let store: StarterStore;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'starter-'));
    store = new StarterStore(join(dir, 'state.sqlite'));
  });
  afterEach(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  it('does not replay a later turn after restoring an earlier save in the same run', () => {
    const saved = createStarterState('run', ['alice']);
    const later = { ...saved, revision: 1, notes: ['later revelation'] };
    store.commit('run', 'later-turn', 0, {
      state: later,
      text: 'later narrative',
    });
    store.restore('run', saved);
    expect(store.replay('run', 'later-turn')).toBeNull();
    expect(store.load('run', ['alice'])).toEqual(saved);
  });
  it('retries committed turns without applying a second revision and rejects stale parallel writes', () => {
    const initial = createStarterState('run', ['alice']);
    const result = { state: { ...initial, revision: 1 }, text: 'accepted' };
    expect(store.commit('run', 'turn', 0, result)).toEqual(result);
    expect(
      store.commit('run', 'turn', 0, { ...result, text: 'duplicate' })
    ).toEqual(result);
    expect(() => store.commit('run', 'other-turn', 0, result)).toThrow(
      'STARTER_CONCURRENT_TURN'
    );
    expect(store.load('other-run', ['bob']).notes).toEqual([]);
  });
});
