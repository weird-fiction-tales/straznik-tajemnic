import { getContextAwareGMProtocol, getGMProtocolPrompt } from '@/lib/prompts/gm-protocol';
import { COMPACT_KEEPER_MARKER, getCompactKeeperReminder } from '@/lib/prompts/compact-keeper';

/** Remove only an exact duplicated full protocol, preserving reactive guidance and later reminders. */
export function resolveSupplementalGMProtocol(
  systemPrompt: string,
  messageCount: number,
  locale: 'pl' | 'en',
): string {
  if (systemPrompt.includes(COMPACT_KEEPER_MARKER)) return getCompactKeeperReminder(locale);
  const supplemental = getContextAwareGMProtocol(messageCount, 10, locale);
  const full = getGMProtocolPrompt(locale);
  return systemPrompt.includes(full) && supplemental.startsWith(full)
    ? supplemental.slice(full.length)
    : supplemental;
}
