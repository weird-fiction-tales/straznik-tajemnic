import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultAISettings } from '@/lib/ai-settings/defaults';
import { getGameMasterPrompt } from '@/lib/ai-settings/prompts-generator';
import { getContextAwareGMProtocol, getGMProtocolPrompt, getReactiveInitiativeProtocol } from '@/lib/prompts/gm-protocol';
import { resolveSupplementalGMProtocol } from '../resolve-gm-protocol';
import { COMPACT_KEEPER_MARKER, getCompactKeeperReminder } from '@/lib/prompts/compact-keeper';

jest.mock('@/lib/document-model-policy', () => ({ isDocumentModelUseBlocked: () => false }));

it.each(['pl', 'en'] as const)('%s uses the compact protocol in both cached and uncached requests', (locale) => {
  const mainPrompt = readFileSync(join(process.cwd(), 'public', locale === 'pl' ? 'default-gm-prompt.md' : 'default-gm-prompt-en.md'), 'utf8');
  const settings = {
    ...defaultAISettings,
    gameMasterNarration: {
      ...defaultAISettings.gameMasterNarration,
      prompts: { mainPrompt },
    },
  };
  const system = getGameMasterPrompt(settings, locale);
  const complete = getGMProtocolPrompt(locale);
  expect(system).toContain(mainPrompt);
  expect(system).toContain(COMPACT_KEEPER_MARKER);
  expect(system).not.toContain(complete);
  for (const messageCount of [0, 24]) {
    const supplemental = resolveSupplementalGMProtocol(system, messageCount, locale);
    expect(supplemental).toBe(getCompactKeeperReminder(locale));
    expect((system + supplemental).split(COMPACT_KEEPER_MARKER)).toHaveLength(2);
  }
  const duplicateCharsRemoved = complete.length;
  expect(duplicateCharsRemoved).toBeGreaterThan(10000);
  console.log(JSON.stringify({ locale, systemChars: system.length, duplicateCharsRemoved,
    reductionPercent: Math.round(100 * duplicateCharsRemoved / (system.length + duplicateCharsRemoved)) }));
});

it.each(['pl', 'en'] as const)('%s still removes the exact legacy duplicate for custom integrations', locale => {
  const full = getGMProtocolPrompt(locale);
  expect(resolveSupplementalGMProtocol(full, 0, locale)).toBe(getReactiveInitiativeProtocol(locale));
});

it.each(['pl', 'en'] as const)('%s preserves the legacy supplemental path when the system lacks the full protocol', (locale) => {
  for (const messageCount of [0, 24]) {
    expect(resolveSupplementalGMProtocol('Custom system instruction.', messageCount, locale))
      .toBe(getContextAwareGMProtocol(messageCount, 10, locale));
  }
});
