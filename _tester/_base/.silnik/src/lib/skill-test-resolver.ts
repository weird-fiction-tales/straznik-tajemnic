/**
 * skill-test-resolver (IND-229)
 *
 * Rozwiązuje WARTOŚĆ % testu z karty postaci na podstawie nazwy podanej przez AI.
 * Wcześniej resolver szukał tylko w `character.skills{}`, więc:
 *  - testy Poczytalności (SAN) → 0% (to stat nadrzędny `character.san`, nie skill),
 *  - testy cech (Siła/Inteligencja/Moc…) → 0% (to charakterystyki, nie skille),
 *  - warianty nazw umiejętności ("Komputerologia" vs klucz "Komputery") → 0%.
 * Każdy taki test pokazywał 0% i auto-failował (rdzeń mechaniki CoC 7e dla SAN).
 *
 * Kolejność dopasowania: SAN → charakterystyka → exact skill → fuzzy skill → 0.
 * W CoC 7e zarówno charakterystyki, jak i Poczytalność są na skali percentylowej
 * (rzut d100 ≤ wartość), więc zwracamy wartość pola wprost.
 */

import type { Character } from '@/lib/types';
import { getSkillValue } from '@/lib/types';
import { BASE_SKILLS } from '@/lib/data/character/skills';

/**
 * Wartość % dla umiejętności, której NIE da się dopasować ani do karty, ani do
 * BASE_SKILLS (AI wymyśliło nazwę spoza systemu). Zwracamy trudny, ale MOŻLIWY
 * rzut - nigdy 0% (które daje próg ≤0 = gwarantowana porażka, absurdalna Tacka).
 */
export const UNKNOWN_SKILL_BASE = 15;

/** lowercase + usuń diakrytyki PL + złóż wielokrotne spacje + trim. */
export function normalizeSkillName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, 'l') // ł nie rozkłada się przez NFD
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Synonimy Poczytalności → character.san. */
const SAN_SYNONYMS = new Set([
  'poczytalnosc',
  'san',
  'sanity',
  'rozsadek',
  'punkty rozsadku',
  'zdrowie psychiczne',
]);

type StatKey =
  | 'str'
  | 'dex'
  | 'con'
  | 'app'
  | 'pow'
  | 'edu'
  | 'siz'
  | 'int'
  | 'luck';

/** Synonimy charakterystyk → klucz pola w Character. */
const STAT_SYNONYMS: Record<string, StatKey> = {
  strength: 'str', dexterity: 'dex', constitution: 'con', appearance: 'app',
  power: 'pow', education: 'edu', size: 'siz', intelligence: 'int',
  sila: 'str',
  str: 'str',
  zrecznosc: 'dex',
  zrec: 'dex',
  dex: 'dex',
  kondycja: 'con',
  con: 'con',
  wyglad: 'app',
  app: 'app',
  moc: 'pow',
  wola: 'pow',
  'sila woli': 'pow',
  pow: 'pow',
  wyksztalcenie: 'edu',
  edukacja: 'edu',
  edu: 'edu',
  budowa: 'siz',
  'budowa ciala': 'siz',
  siz: 'siz',
  inteligencja: 'int',
  int: 'int',
  szczescie: 'luck',
  fart: 'luck',
  luck: 'luck',
};

/**
 * Grupy synonimów umiejętności CoC 7e - gdy nazwa od AI i klucz w karcie należą do
 * tej samej grupy, traktujemy je jako tę samą umiejętność (znormalizowane formy).
 * Domyka przypadki, których nie złapie prefiks/includes (różne rdzenie).
 */
const SKILL_SYNONYM_GROUPS: string[][] = [
  [
    'komputery',
    'komputerologia',
    'obsluga komputera',
    'informatyka',
    'korzystanie z komputerow',
  ],
  ['biegle poslugiwanie sie', 'walka wrecz', 'walka', 'walka wreczna'],
  ['pierwsza pomoc', 'medycyna ratunkowa'],
  ['spostrzegawczosc', 'spostrzeganie', 'obserwacja'],
  ['psychologia', 'czytanie ludzi'],
  ['elektryka', 'elektronika'],
  ['mechanika', 'naprawa mechaniczna'],
  // Rozjazd słownika generatora (random-character-generator) vs BASE_SKILLS/szablony/prompt MG.
  [
    'biblioteka',
    'bibliotekarstwo',
    'korzystanie z bibliotek',
    'biblioteki',
    'bibliotekarz',
  ],
  ['nasluchiwanie', 'sluchanie', 'sluch'],
  ['bron palna', 'strzelanie', 'palna'],
  ['skok', 'skakanie'],
  ['tropienie', 'sledztwo', 'sledzenie'],
  ['majetnosc', 'kredyt', 'zamoznosc'],
  ['prowadzenie samochodu', 'prowadzenie pojazdu', 'kierowanie'],
  // R4: Dywersyfikacja Umiejętności - Czwórmecz Społeczny i rzadkie umiejętności badawcze CoC 7e RAW
  ['urok', 'urok osobisty', 'czar', 'wdziek', 'charm'],
  ['gadanina', 'bajerowanie', 'nawijka', 'szybka gadka', 'fast talk'],
  ['zastraszanie', 'grozba', 'grozby', 'grozenie', 'intymidacja', 'intimidate'],
  ['slusarstwo', 'wytrychy', 'otwieranie zamkow', 'wlamywanie', 'locksmith'],
  ['ksiegowosc', 'rachunkowosc', 'finanse', 'audyt', 'accounting'],
  ['prawo', 'znajomosc prawa', 'przepisy prawne', 'law'],
  ['medycyna', 'sztuka lekarska', 'diagnostyka', 'leczenie', 'medicine'],
];

/** Czy dwie znormalizowane nazwy są w tej samej grupie synonimów. */
function inSameSynonymGroup(a: string, b: string): boolean {
  return SKILL_SYNONYM_GROUPS.some((g) => g.includes(a) && g.includes(b));
}

/** Łączniki PL pomijane przy tokenizacji nazw umiejętności. */
const SKILL_STOPWORDS = new Set([
  'z',
  'ze',
  'w',
  'we',
  'i',
  'na',
  'do',
  'sie',
  'po',
]);

/** Istotne tokeny nazwy (po normalizacji): słowa ≥5 znaków, bez łączników. */
function significantTokens(s: string): string[] {
  return s.split(' ').filter((t) => t.length >= 5 && !SKILL_STOPWORDS.has(t));
}

/** Dwa tokeny dzielą rdzeń, gdy mają wspólny prefiks ≥6 znaków (bibliotek* ↔ biblioteka/bibliotekarstwo). */
function tokensShareStem(a: string, b: string): boolean {
  const min = Math.min(a.length, b.length);
  let i = 0;
  while (i < min && a[i] === b[i]) i++;
  return i >= 6;
}

/**
 * Dopasowanie po wspólnym rdzeniu tokenowym - ogólna siatka na warianty nazw,
 * których nie wymieniono w grupach synonimów. Prefiks ≥6 chroni przed kolizjami
 * typu "psychologia"/"psychiatria" (wspólne "psych" = 5 < 6).
 */
function tokenStemOverlap(a: string, b: string): boolean {
  const ta = significantTokens(a);
  const tb = significantTokens(b);
  return ta.some((x) => tb.some((y) => tokensShareStem(x, y)));
}

/** Pełna reguła "te same umiejętności" - wspólna dla karty postaci i BASE_SKILLS. */
function namesMatch(key: string, target: string): boolean {
  return (
    key === target ||
    inSameSynonymGroup(key, target) ||
    key.includes(target) ||
    target.includes(key) ||
    sharedPrefixMatch(key, target) ||
    tokenStemOverlap(key, target)
  );
}

/**
 * Dopasowanie rozmyte nazw umiejętności - wspólny prefiks o długości ≥5 znaków,
 * stanowiący ≥70% krótszej nazwy. Łapie "komputerologia" ↔ "komputery"
 * (prefiks "komputer" = 8) bez fałszywych trafień typu "psychologia"/"psychiatria".
 */
function sharedPrefixMatch(a: string, b: string): boolean {
  const min = Math.min(a.length, b.length);
  let i = 0;
  while (i < min && a[i] === b[i]) i++;
  if (i < 5) return false;
  return i >= 0.7 * min;
}

/**
 * Zwraca wartość % testu dla danej nazwy. Null gdy nic nie pasuje (caller decyduje
 * o fallbacku - obecnie 0, co zachowuje dotychczasowe zachowanie dla nieznanych nazw).
 */
export function resolveTestValue(
  name: string,
  character: Character | null
): number | null {
  if (!character || !name) return null;
  const target = normalizeSkillName(name);

  // 1. Poczytalność / SAN.
  if (SAN_SYNONYMS.has(target)) return character.san;

  // 2. Charakterystyka (Siła/Inteligencja/Moc…).
  const stat = STAT_SYNONYMS[target];
  if (stat) return character[stat];

  // 3-5. Umiejętności.
  const skills = character.skills ?? {};
  const entries = Object.entries(skills).map(
    ([key, value]) => [normalizeSkillName(key), value] as const
  );

  // 3. exact.
  const exact = entries.find(([key]) => key === target);
  if (exact) return getSkillValue(exact[1]);

  // 4. synonimy + includes (oba kierunki) + wspólny prefiks + rdzeń tokenowy.
  const fuzzy = entries.find(([key]) => namesMatch(key, target));
  if (fuzzy) return getSkillValue(fuzzy[1]);

  return null;
}

/**
 * Fallback gdy umiejętności NIE ma na karcie postaci: dopasuj nazwę do bazowej
 * tabeli CoC 7e (`BASE_SKILLS`) tym samym robustnym matcherem i zwróć wartość
 * bazową (np. "Korzystanie z bibliotek" → "Biblioteka" → 20). Dzięki temu nawet
 * umiejętność spoza karty rozwiązuje się do sensownego progu, nie do 0%.
 * Null gdy nazwa nie pasuje do żadnej umiejętności bazowej.
 */
export function resolveSkillBaseValue(name: string): number | null {
  if (!name) return null;
  const target = normalizeSkillName(name);
  for (const [key, value] of Object.entries(BASE_SKILLS)) {
    if (namesMatch(normalizeSkillName(key), target)) return value;
  }
  return null;
}
