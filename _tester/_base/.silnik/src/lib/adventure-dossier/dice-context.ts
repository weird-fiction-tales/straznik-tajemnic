import type { DiceRollResolutionContext } from '@/lib/parsers/types';

/** Keep queued chat-command rolls out of unrelated turns and retrieval queries. */
export function isDiceRollResolutionRelevantToMessage(
  event: DiceRollResolutionContext,
  message: string,
): boolean {
  if (event.source !== 'local_chat_command') return true;
  const normalize = (value: string) => value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const normalizedMessage = normalize(message);
  if (!normalizedMessage) return false;
  const formula = normalize(event.formula);
  const label = event.label ? normalize(event.label) : '';
  if ((formula.length >= 3 && normalizedMessage.includes(formula)) ||
    (label.length >= 4 && normalizedMessage.includes(label))) return true;
  return /\b(ten|poprzedni|moj|moja|moje)\s+(rzut|rzutu|kostk[aie]|kosc[iy]?|roll)\b|\b(wynik|rezultat)\s+(rzutu|kostek|kosc[iy]?|dice|roll)\b|\b(rzucilem|rzucilam|i rolled|my roll|that roll|previous roll|dice result)\b/.test(normalizedMessage);
}
