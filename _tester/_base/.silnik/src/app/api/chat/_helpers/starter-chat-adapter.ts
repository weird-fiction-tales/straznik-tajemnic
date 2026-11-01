import { randomInt } from 'node:crypto';
import type { Character } from '@/lib/types';
import type { CampaignMemoryScope } from '@/core/memory/types';
import { getStarterStore } from '@/lib/adventures/starter-store';
import {
  isStarterAdventure,
  applyStarterInput,
  publishStarterTurn,
  starterDirectorContext,
  type StarterMechanics,
} from '@/lib/adventures/starter-runtime';

export function prepareStarterChat(input: {
  adventure?: { id?: string; sourceBookId?: string } | null;
  scope: CampaignMemoryScope | null;
  turnId?: string;
  character?: Character | null;
  characters: Character[];
  hotSeat?: { enabled?: boolean; players?: { characterId?: string }[] };
  mechanics?: StarterMechanics;
  locale: 'pl' | 'en';
}) {
  if (!isStarterAdventure(input.adventure)) return null;
  if (!input.scope || !input.turnId || !input.character)
    throw new Error('STARTER_SCOPE_REQUIRED');
  const ids = input.hotSeat?.enabled
    ? input.hotSeat.players?.map((p) => p.characterId).filter(Boolean)
    : [input.character.id];
  const roster = [...input.characters, input.character].filter(
    (c, i, all) =>
      ids?.includes(c.id) && all.findIndex((a) => a.id === c.id) === i
  );
  const store = getStarterStore(),
    run = input.scope.playthroughId;
  const before = store.load(
    run,
    roster.map((c) => c.id)
  );
  const random = (sides: number) => randomInt(1, sides + 1);
  const replay = store.replay(run, input.turnId);
  const state =
    replay?.state ??
    applyStarterInput(
      before,
      input.mechanics,
      roster,
      input.turnId,
      input.locale,
      random
    );
  return {
    before,
    state,
    replay,
    context: starterDirectorContext(state, input.locale),
    finish(text: string, message: string) {
      const result = publishStarterTurn(
        state,
        text,
        {
          turnId: input.turnId!,
          message,
          roster,
          activeCharacterId: input.character!.id,
          locale: input.locale,
        },
        random
      );
      return store.commit(run, input.turnId!, before.revision, result);
    },
  };
}

export function replayStarterResponse(
  result: NonNullable<ReturnType<typeof prepareStarterChat>>['replay']
): Response {
  if (!result) throw new Error('NO_STARTER_REPLAY');
  const text = `data: ${JSON.stringify({ type: 'text', content: result.text })}\n\n`;
  const metadata = `data: ${JSON.stringify({ type: 'metadata', starterState: result.state, skillTests: result.state.pendingTests })}\n\n`;
  return new Response(text + metadata, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
