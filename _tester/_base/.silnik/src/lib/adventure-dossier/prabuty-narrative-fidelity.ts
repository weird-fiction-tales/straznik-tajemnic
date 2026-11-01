import type { GameTime } from '../types';

/** Presentation only. The canonical labels and edition fingerprint stay unchanged. */
export function publicPrabutyText(text: string): string {
  return text.replace(/\s*\((?:Finał|Finale)\)/gi, '');
}

/** This guard is called only for the exact authored Prabuty plan, before publication. */
export function enforcePrabutyNarrativeFacts(text: string, facts: {
  recipeNumber: string;
  gameTime: GameTime;
}, locale: 'pl' | 'en'): string {
  const clock = `${String(facts.gameTime.hour).padStart(2, '0')}:${String(facts.gameTime.minute).padStart(2, '0')}`;
  const clockStatement = locale === 'pl' ? `Zegar wskazuje ${clock}` : `The clock reads ${clock}`;
  // A numbered recipe reference, never a free-standing number, age or page count.
  const number = '(?:sto(?:\\s+(?:dziesięć|jedenaście|dwanaście|trzynaście|czternaście|piętnaście|szesnaście|siedemnaście|osiemnaście|dziewiętnaście|(?:dwadzieścia|trzydzieści|czterdzieści|pięćdziesiąt|sześćdziesiąt|siedemdziesiąt|osiemdziesiąt|dziewięćdziesiąt)(?:\\s+(?:jeden|dwa|trzy|cztery|pięć|sześć|siedem|osiem|dziewięć))?))?|\\d+)';
  const recipe = new RegExp('(\\b(?:receptur[ayęzeą]|receptury|mieszank[aięą]|mieszanki|recipe|mixture)(?:\\s+(?:ziołow[aeąyęj]+|herbal))?\\s+(?:nr\\.?|numer(?:em)?|number|no\\.?)\\s*)'+number+'(?![\\p{L}\\d])', 'giu');
  // Only standalone narrator assertions. Future plans, conditions and reported history
  // are not clock effects. A matching assertion is replaced with the saved clock.
  const elapsed = /(^|[.!?]\s+|\n+)((?:Mijają|Minęły|Minęło|Upłynęło|Upływają)\s+(?:(?:kolejne|długie|całe|kilka|kilkanaście|dwa|trzy|cztery|pięć|dziesięć|piętnaście|trzydzieści|sześćdziesiąt|\d+)\s+)?(?:kwadrans(?:e|y|ów)?|minut(?:a|y)?|godzin(?:a|y)?)(?!\p{L})|(?:Minutes|Hours|Quarter hours)\s+(?:pass|have passed))/giu;
  // Preserve protocol tags byte-for-byte; they carry identities, not display prose.
  return text.split(/(\[[^\]]*\])/g).map((part, index) => index % 2 ? part :
    publicPrabutyText(part)
      .replace(recipe, (_match, prefix: string) => prefix + facts.recipeNumber)
      .replace(elapsed, (_match, boundary: string) => boundary + clockStatement)
  ).join('');
}
