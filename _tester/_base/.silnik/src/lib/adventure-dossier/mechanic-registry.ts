/** Stable dossier mechanic IDs. `auditArea` is a cross-reference, not part of the ID. */
export const DOSSIER_MECHANICS = [
  { id: 'coc7:investigator-characteristics', auditArea: 1 },
  { id: 'coc7:damage-bonus-build', auditArea: 2 },
  { id: 'coc7:magic-points-sanity', auditArea: 3 },
  { id: 'coc7:investigator-creation', auditArea: 4 },
  { id: 'coc7:characteristics-age', auditArea: 5 },
  { id: 'coc7:occupations-skill-points', auditArea: 6 },
  { id: 'coc7:wealth-assets', auditArea: 7 },
  { id: 'coc7:alternate-investigator-creation', auditArea: 8 },
  { id: 'coc7:difficulty-levels', auditArea: 9 },
  { id: 'coc7:skill-values', auditArea: 10 },
  { id: 'coc7:skill-catalog', auditArea: 11 },
  { id: 'coc7:optional-skills-specializations', auditArea: 12 },
  { id: 'coc7:skill-tests', auditArea: 13 },
  { id: 'coc7:percentile-rolls', auditArea: 14 },
  { id: 'coc7:pushed-rolls', auditArea: 15 },
  { id: 'coc7:failure-complications', auditArea: 16 },
  { id: 'coc7:group-tests', auditArea: 17 },
  { id: 'coc7:criticals-fumbles', auditArea: 18 },
  { id: 'coc7:luck-points', auditArea: 19 },
  { id: 'coc7:idea-roll', auditArea: 20 },
  { id: 'coc7:knowledge-roll', auditArea: 21 },
  { id: 'coc7:opposed-rolls', auditArea: 22 },
  { id: 'coc7:bonus-penalty-dice', auditArea: 23 },
  { id: 'coc7:combined-skill-tests', auditArea: 24 },
  { id: 'coc7:social-resistance', auditArea: 25 },
  { id: 'coc7:investigator-development', auditArea: 26 },
  { id: 'coc7:credit-rating-purchases', auditArea: 27 },
  { id: 'coc7:event-adjudication', auditArea: 28 },
  { id: 'coc7:combat-round', auditArea: 29 },
  { id: 'coc7:melee-combat', auditArea: 30 },
  { id: 'coc7:combat-maneuver', auditArea: 31 },
  { id: 'coc7:combat-defense', auditArea: 32 },
  { id: 'coc7:armor', auditArea: 33 },
  { id: 'coc7:firearms-range', auditArea: 34 },
  { id: 'coc7:automatic-fire', auditArea: 35 },
  { id: 'coc7:weapon-malfunction', auditArea: 36 },
  { id: 'coc7:wounds', auditArea: 37 },
  { id: 'coc7:other-damage', auditArea: 38 },
  { id: 'coc7:chase-movement', auditArea: 39 },
  { id: 'coc7:chase-obstacles', auditArea: 40 },
  { id: 'coc7:chase-maneuvers', auditArea: 41 },
  { id: 'coc7:vehicle-collisions', auditArea: 42 },
  { id: 'coc7:sanity-tests', auditArea: 43 },
  { id: 'coc7:madness-bouts', auditArea: 44 },
  { id: 'coc7:sanity-recovery-therapy', auditArea: 45 },
  { id: 'coc7:mythos-book-reading', auditArea: 46 },
  { id: 'coc7:spell-casting', auditArea: 47 },
  { id: 'coc7:magical-catastrophes', auditArea: 48 },
  { id: 'coc7:npc-profiles-resistance', auditArea: 49 },
  { id: 'coc7:dice-adjudication', auditArea: 50 },
  { id: 'coc7:clues-fail-forward', auditArea: 51 },
  { id: 'coc7:action-scenes-suspense', auditArea: 52 },
  { id: 'coc7:mythos-tome-study', auditArea: 53 },
  { id: 'coc7:opposed-magic', auditArea: 54 },
  { id: 'coc7:monster-combat', auditArea: 55 },
  { id: 'coc7:legacy-edition-conversion', auditArea: 56 },
  { id: 'coc7:weapons-catalog', auditArea: 57 },
  { id: 'coc7:rules-summaries', auditArea: 58 },
] as const;

export type DossierMechanicId = (typeof DOSSIER_MECHANICS)[number]['id'];

const INVESTIGATIVE_SKILLS = new Set([
  'spostrzegawczość', 'spostrzegawczosc', 'szukanie', 'bibliotekoznawstwo', 'tropienie',
  'spot hidden', 'library use', 'track',
]);

const INVESTIGATOR_CHARACTERISTICS = new Set([
  'str', 'strength', 'sila',
  'con', 'constitution', 'kondycja',
  'siz', 'size', 'budowa', 'budowa ciala',
  'dex', 'dexterity', 'zrecznosc',
  'app', 'appearance', 'wyglad',
  'int', 'intelligence', 'inteligencja',
  'pow', 'power', 'will power', 'willpower', 'moc', 'sila woli',
  'edu', 'education', 'wyksztalcenie',
]);

export function isInvestigatorCharacteristicName(value: string): boolean {
  const normalized = value.normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLocaleLowerCase();
  const withoutCodeSuffix = normalized.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return INVESTIGATOR_CHARACTERISTICS.has(normalized) ||
    INVESTIGATOR_CHARACTERISTICS.has(withoutCodeSuffix);
}

export function hasResolvedClueFailForwardTrigger(input: {
  ideaRollResolved?: boolean;
  ideaRollOutcome?: 'critical' | 'extreme' | 'hard' | 'regular' | 'fail' | 'fumble';
  skillRolls?: Array<{
    outcome?: 'critical' | 'extreme' | 'hard' | 'regular' | 'fail' | 'fumble';
    skillNames?: string[];
  }>;
}): boolean {
  if (input.ideaRollResolved && (input.ideaRollOutcome === 'fail' || input.ideaRollOutcome === 'fumble')) {
    return true;
  }
  return (input.skillRolls ?? []).some((roll) =>
    (roll.outcome === 'fail' || roll.outcome === 'fumble') &&
    (roll.skillNames ?? []).some((name) => INVESTIGATIVE_SKILLS.has(name.trim().toLowerCase())),
  );
}

const DOSSIER_MECHANIC_IDS = new Set<string>(DOSSIER_MECHANICS.map(({ id }) => id));
const SOCIAL_INFLUENCE_SKILLS = new Set([
  'perswazja', 'urok osobisty', 'gadanina', 'zastraszanie',
  'persuasion', 'charm', 'fast talk', 'intimidate', 'threatening',
]);

export function isSocialInfluenceSkillName(value: string): boolean {
  return SOCIAL_INFLUENCE_SKILLS.has(value.trim().toLocaleLowerCase());
}

export function isDossierMechanicId(value: unknown): value is DossierMechanicId {
  return typeof value === 'string' && DOSSIER_MECHANIC_IDS.has(value);
}

export function getDossierMechanicIdForAuditArea(area: number): DossierMechanicId | undefined {
  return DOSSIER_MECHANICS.find((mechanic) => mechanic.auditArea === area)?.id;
}

const RULE_QUERY_AREA_ALIASES: Array<{ areas: number[]; terms: string[] }> = [
  { areas: [], terms: ['zasad', 'regul', 'mechanik', 'rules', 'rule', 'dice'] },
  { areas: [1, 2], terms: ['cechy badacza', 'cechy badaczy', 'sila', 'kondycja', 'budowa ciala', 'szybkosc', 'zrecznosc', 'wyglad', 'moc', 'wola', 'damage bonus', 'build'] },
  { areas: [3], terms: ['punkty magii', 'punkty poczytalnosci', 'magic points', 'sanity points'] },
  { areas: [4, 8], terms: ['tworzenie badacza', 'stworzyc badacza', 'karta badacza', 'investigator creation', 'alternate investigator creation'] },
  { areas: [5], terms: ['wiek badacza', 'wiek postaci', 'starzenie', 'age characteristics'] },
  { areas: [6], terms: ['zawod badacza', 'punkty zawodowe', 'punkty umiejetnosci zawodowych', 'occupation skill points'] },
  { areas: [7, 27], terms: ['majetnosc', 'majetny', 'pieniadze badacza', 'gotowka', 'aktywa', 'zakup', 'kupowac', 'kupic', 'sprzedac', 'credit rating', 'wealth'] },
  { areas: [9], terms: ['poziom trudnosci', 'test latwy', 'test trudny', 'test ekstremalny', 'difficulty level'] },
  { areas: [10, 11, 12], terms: ['wartosc umiejetnosci', 'katalog umiejetnosci', 'specjalizacja umiejetnosci', 'skill value', 'skill catalog', 'skill specialization'] },
  { areas: [13, 14], terms: ['test umiejetnosci', 'rzut k100', 'rzut procentowy', 'skill test', 'percentile roll'] },
  { areas: [15, 16], terms: ['forsowanie', 'forsowac test', 'wymusic test', 'wymuszony test', 'pushed roll'] },
  { areas: [17], terms: ['test grupowy', 'testy grupowe', 'group roll'] },
  { areas: [18], terms: ['pech', 'krytyk', 'fumble', 'critical success'] },
  { areas: [19], terms: ['szczescie', 'wydac szczescie', 'luck points'] },
  { areas: [20], terms: ['test pomyslowosci', 'idea roll'] },
  { areas: [21], terms: ['test wiedzy', 'knowledge roll'] },
  { areas: [22], terms: ['test przeciwstawny', 'opposed roll'] },
  { areas: [23], terms: ['kosc premiowa', 'kosc karna', 'bonus die', 'penalty die'] },
  { areas: [24], terms: ['test laczony', 'combined skill test'] },
  { areas: [25, 49], terms: ['perswazja', 'urok osobisty', 'gadanina', 'zastraszanie', 'opór npc', 'opory npc', 'social resistance'] },
  { areas: [26], terms: ['rozwoj badacza', 'punkty rozwoju', 'investigator development'] },
  { areas: [27], terms: ['majetnosc', 'zakup', 'kupowanie', 'credit rating'] },
  { areas: [28], terms: ['arbitraz zdarzenia', 'rozstrzygnac zdarzenie', 'niejednoznaczne zdarzenie', 'event adjudication'] },
  { areas: [29, 30, 31, 32, 33, 37], terms: ['walka', 'atak', 'obrona', 'unik', 'dodge', 'armor', 'pancerz'] },
  { areas: [34, 35, 36, 57], terms: ['bron', 'weapon', 'amunicja', 'magazynek', 'strzelanie', 'strzal', 'zasieg broni', 'ogień automatyczny', 'ogień ciagly', 'zaciecie', 'awaria broni', 'weapon malfunction'] },
  { areas: [37, 38], terms: ['obrazenia', 'rana', 'rany', 'leczenie ran', 'rana ciezka', 'zagrozenie srodowiskowe', 'environmental damage', 'wound', 'healing'] },
  { areas: [39, 40, 41, 42], terms: ['poscig', 'przeszkoda w poscigu', 'manewr w poscigu', 'kolizja pojazdu', 'chase'] },
  { areas: [43, 44, 45], terms: ['poczytalnosc', 'sanity', 'obled', 'terapia', 'odzyskiwanie poczytalnosci'] },
  { areas: [46, 53], terms: ['czytanie tomu', 'studiowanie tomu', 'ksiegi mitow', 'mythos tome'] },
  { areas: [47, 48, 54], terms: ['rzucanie czaru', 'magia', 'katastrofa magiczna', 'obrona przed magia', 'spell casting'] },
  { areas: [50], terms: ['rozstrzyganie rzutu', 'arbiter kosci', 'dice adjudication'] },
  { areas: [51], terms: ['niepowodzenie sledztwa', 'fail forward', 'pchniecie sledztwa'] },
  { areas: [52], terms: ['tempo sceny', 'napięcie sceny', 'napiecie sceny', 'pacing'] },
  { areas: [55], terms: ['walka z potworem', 'walka z potworami', 'zdolnosc potwora', 'monster combat'] },
  { areas: [56], terms: ['konwersja wydania', 'konwersja zasad', 'edition conversion'] },
];

/**
 * Recognizes only explicit rules questions. The returned IDs are retrieval hints,
 * not active game mechanics, and must never satisfy a `mechanic_active` gate.
 */
export function getDossierRuleQueryMechanicIds(query: string): DossierMechanicId[] {
  const normalized = query
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [];

  const asksQuestion = /\b(jak|jakie|jakich|jakimi|czy|co|kiedy|ile|ktory|ktora|ktore|dlaczego|skad|what|how|when|which|why|where|can i)\b/.test(normalized);
  if (!asksQuestion) return [];

  const areas = new Set<number>([58]);
  let matchedRuleTerm = false;
  for (const entry of RULE_QUERY_AREA_ALIASES) {
    if (entry.terms.some((term) => normalized.includes(term.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase()))) {
      matchedRuleTerm = true;
      entry.areas.forEach((area) => areas.add(area));
    }
  }
  if (!matchedRuleTerm) return [];
  return [...areas]
    .map(getDossierMechanicIdForAuditArea)
    .filter((id): id is DossierMechanicId => Boolean(id));
}
