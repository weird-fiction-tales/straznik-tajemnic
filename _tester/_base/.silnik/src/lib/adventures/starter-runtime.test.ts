import { serialize, deserialize } from 'node:v8';
import { getStrefa11CharactersForAdventure } from '../immersion/strefa-11-characters';
import {
  createStarterState,
  applyStarterInput,
  publishStarterTurn,
  type StarterPending,
} from './starter-runtime';
import { applyStarterStateToCharacters } from './starter-client';

Object.assign(globalThis, {
  structuredClone: <T>(value: T): T => deserialize(serialize(value)),
});

const actor = {
  ...getStrefa11CharactersForAdventure('cien-nad-prabutami')[0],
  id: 'alice',
  hp: 12,
  san: 60,
};
const pending: StarterPending = {
  id: 'san-check',
  skillName: 'SAN',
  skillValue: 60,
  characterId: 'alice',
  difficulty: 'zwykly',
  modifiers: [],
  justification: 'source sight',
  starter: {
    checkId: 'corbitt-sight',
    sceneId: 'node-corbitt-crypt',
    pushed: false,
  },
};

it('uses the submitted local roll, applies SAN once to its recipient and ignores replayed or foreign rolls', () => {
  const initial = {
    ...createStarterState('run', ['alice']),
    currentSceneId: 'node-corbitt-crypt',
    pendingTests: [pending],
  };
  const input = {
    rolls: [
      {
        testId: pending.id!,
        characterId: 'alice',
        roll: { id: 'roll-1', total: 90, targetValue: 60 },
      },
    ],
  };
  const applied = applyStarterInput(
    initial,
    input,
    [actor],
    'turn-1',
    'pl',
    () => 4
  );
  expect(applied.effects).toEqual([
    expect.objectContaining({ characterId: 'alice', san: -4 }),
  ]);
  const once = applyStarterStateToCharacters([actor], applied, 'pl');
  expect(once[0].san).toBe(56);
  expect(applyStarterStateToCharacters(once, applied, 'pl')[0].san).toBe(56);
  expect(
    applyStarterInput(applied, input, [actor], 'turn-2', 'pl', () => 8).effects
  ).toEqual(applied.effects);
  expect(
    applyStarterInput(
      initial,
      { rolls: [{ ...input.rolls[0], characterId: 'outsider' }] },
      [actor],
      'foreign',
      'pl',
      () => 8
    ).effects
  ).toEqual([]);
});

it('rejects invented evidence and jumping straight from the office to the final chamber', () => {
  const state = createStarterState('run', ['alice']);
  const result = publishStarterTurn(
    state,
    '[TECZKA:move|node-corbitt-crypt][TECZKA:discover|clue-09-corbitt-journal]',
    {
      turnId: 'turn',
      message: 'I look around',
      roster: [actor],
      activeCharacterId: actor.id,
      locale: 'en',
    },
    () => 1
  );
  expect(result.state.currentSceneId).toBe('node-knott-office');
  expect(result.state.discoveredHandouts).toEqual([]);
  expect(result.text).not.toContain('[TECZKA:');
});
