import type { Message } from '@/lib/types';
import type { SkillTestData } from '@/lib/parsers/types';
import { mapDifficultyToRequired, meetsDifficulty } from '@/lib/dice-utils';
import { normalizeSkillName } from '@/lib/skill-test-resolver';

type RollScope = { playthroughId: string; adventureId: string };
/** Derive display completion from this loaded history only. Never award success or replay effects. */
export function completedSkillTestsFromHistory(messages: Message[], scope: RollScope | null): Set<string> {
  const completed = new Set<string>();
  const tests = new Map<string, SkillTestData>();
  const ambiguous = new Set<string>();
  const resolutions = new Set<string>();
  for (const message of messages) {
    if (message.role === 'assistant') {
      for (const test of message.skillTests ?? []) {
        if (tests.has(test.id)) ambiguous.add(test.id);
        tests.set(test.id, test);
      }
      continue;
    }
    if (message.role !== 'user') continue;
    const bound = message.mechanicsContext?.skillRollScope;
    if (bound && (!scope || bound.playthroughId !== scope.playthroughId || bound.adventureId !== scope.adventureId)) continue;
    // Legacy typed results are read only from the currently loaded history; never migrate or merge them globally.
    for (const roll of message.mechanicsContext?.skillRolls ?? []) {
      const test = roll.testId ? tests.get(roll.testId) : undefined;
      if (!test || ambiguous.has(test.id) || !roll.resolutionId || resolutions.has(roll.resolutionId) ||
        !test.characterId || roll.characterId !== test.characterId ||
        roll.targetNpcId !== test.targetNpcId || roll.requiredDifficulty !== mapDifficultyToRequired(test.difficulty) ||
        !['critical','extreme','hard','regular','fail','fumble'].includes(roll.outcome) ||
        !Number.isFinite(roll.luckSpent) || roll.luckSpent < 0 || !Array.isArray(roll.skillNames)) continue;
      const expected = (test.combined?.skills.map(skill => skill.skillName) ?? [test.skillName]).map(normalizeSkillName).sort();
      const actual = roll.skillNames.map(normalizeSkillName).sort();
      if (JSON.stringify(expected) !== JSON.stringify(actual) ||
        roll.passedRequirement !== meetsDifficulty(roll.outcome, roll.requiredDifficulty)) continue;
      resolutions.add(roll.resolutionId);
      completed.add(test.id);
    }
  }
  for (const id of ambiguous) completed.delete(id);
  return completed;
}
