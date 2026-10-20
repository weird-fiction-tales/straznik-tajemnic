// Ciało tagu odporne na 1 poziom zagnieżdżenia [...]. AI bywa wplata audio-tag
// emocji (np. [serious], [trembling]) w środek [NASTRÓJ: ...]; naiwne [^\]]*
// ucinałoby na pierwszym wewnętrznym `]` i ogon treści przeciekał do lektora.
// Bliźniacza stała w narrative/cleanup.ts (warstwa display). `[^\[\]]` matchuje
// też `\n`, więc multiline tagi są zachowane.
const NESTED_TAG_BODY = '(?:[^\\[\\]]|\\[[^\\]]*\\])*';

export const GEMINI_TTS_EMOTION_TAGS = [
  // English emotion/delivery tags
  'whispers',
  'whispering',
  'whisper',
  'trembling',
  'trembles',
  'gasp',
  'gasps',
  'gasping',
  'panicked',
  'panic',
  'serious',
  'seriously',
  'curious',
  'curiously',
  'sarcastic',
  'sarcastically',
  'tired',
  'exhausted',
  'weary',
  'crying',
  'sobbing',
  'weeping',
  'amazed',
  'astonished',
  'excited',
  'excitedly',
  'mischievously',
  'mischievous',
  'sighs',
  'sigh',
  'sighing',
  'giggles',
  'giggle',
  'giggling',
  'laughs',
  'laugh',
  'laughing',
  'shouting',
  'shouts',
  'shout',
  'screaming',
  'screams',
  'very fast',
  'very slow',
  // Polish emotion/delivery tags (Issue #562)
  'szept',
  'szeptem',
  'szepcze',
  'szepcząc',
  'cicho',
  'drżący głos',
  'drżącym głosem',
  'drżący',
  'drżenie',
  'z drżeniem',
  'wstrzymany oddech',
  'westchnienie grozy',
  'łapie oddech',
  'jęk',
  'zachłyśnięcie',
  'panika',
  'panicznie',
  'w panice',
  'przerażenie',
  'przerażony',
  'przerażonym głosem',
  'poważnie',
  'poważny',
  'poważnym głosem',
  'grobowym głosem',
  'surowo',
  'zaciekawiony',
  'zaciekawienie',
  'z zaciekawieniem',
  'ciekawie',
  'sarkastycznie',
  'sarkastyczny',
  'sarkazm',
  'ironicznie',
  'kpina',
  'zmęczony',
  'zmęczonym głosem',
  'zmęczenie',
  'wycieńczony',
  'ospale',
  'płacz',
  'płacze',
  'płacząc',
  'szloch',
  'szlochając',
  'przez łzy',
  'zdumiony',
  'zdumienie',
  'ze zdumieniem',
  'zaskoczony',
  'podekscytowany',
  'ekscytacja',
  'z ekscytacją',
  'gorączkowo',
  'podstępnie',
  'psotnie',
  'złowieszczo',
  'zjadliwie',
  'ciężkie westchnienie',
  'westchnienie',
  'wzdycha',
  'wzdychając',
  'nerwowy śmiech',
  'chichot',
  'chichocze',
  'śmieje się',
  'śmiejąc się',
  'śmiech',
  'krzyk',
  'krzyczy',
  'krzycząc',
  'wrzask',
  'wołanie',
  'głośno',
  'bardzo szybko',
  'szybko',
  'bardzo wolno',
  'wolno',
  'powoli',
].join('|');

export interface ExtractedAudioMood {
  tag: string;
  audioDirection: string;
}

/**
 * Mapuje tag emocji na instrukcję reżyserską dla Gemini TTS (Issue #544 + Issue #562).
 */
export function mapEmotionToAudioDirection(emotion: string): string {
  const normalized = emotion.toLowerCase().trim();
  switch (normalized) {
    case 'whispers':
    case 'whispering':
    case 'whisper':
    case 'szept':
    case 'szeptem':
    case 'szepcze':
    case 'szepcząc':
    case 'cicho':
      return 'Read the following in a soft, urgent, and tense whisper:';
    case 'trembling':
    case 'trembles':
    case 'drżący':
    case 'drżący głos':
    case 'drżącym głosem':
    case 'drżenie':
    case 'z drżeniem':
      return 'Read the following in a terrified, trembling, and emotional voice:';
    case 'gasp':
    case 'gasps':
    case 'gasping':
    case 'wstrzymany oddech':
    case 'westchnienie grozy':
    case 'łapie oddech':
    case 'jęk':
    case 'zachłyśnięcie':
      return 'Read the following in a gasping, breathless voice:';
    case 'panicked':
    case 'panic':
    case 'panika':
    case 'panicznie':
    case 'w panice':
    case 'przerażenie':
    case 'przerażony':
    case 'przerażonym głosem':
      return 'Read the following in a panicked, terrified, and breathless voice:';
    case 'serious':
    case 'seriously':
    case 'poważnie':
    case 'poważny':
    case 'poważnym głosem':
    case 'grobowym głosem':
    case 'surowo':
      return 'Read the following in a grave, serious, and measured tone:';
    case 'curious':
    case 'curiously':
    case 'zaciekawiony':
    case 'zaciekawienie':
    case 'z zaciekawieniem':
    case 'ciekawie':
      return 'Read the following in an inquisitive and curious tone:';
    case 'sarcastic':
    case 'sarcastically':
    case 'sarkastycznie':
    case 'sarkastyczny':
    case 'sarkazm':
    case 'ironicznie':
    case 'kpina':
      return 'Read the following in a dry, sarcastic, and cynical tone:';
    case 'tired':
    case 'exhausted':
    case 'weary':
    case 'zmęczony':
    case 'zmęczonym głosem':
    case 'zmęczenie':
    case 'wycieńczony':
    case 'ospale':
      return 'Read the following in a weary, exhausted, and slow voice:';
    case 'crying':
    case 'sobbing':
    case 'weeping':
    case 'płacz':
    case 'płacze':
    case 'płacząc':
    case 'szloch':
    case 'szlochając':
    case 'przez łzy':
      return 'Read the following in a tearful, weeping, and trembling voice:';
    case 'amazed':
    case 'astonished':
    case 'zdumiony':
    case 'zdumienie':
    case 'ze zdumieniem':
    case 'zaskoczony':
      return 'Read the following in an amazed and awestruck tone:';
    case 'excited':
    case 'excitedly':
    case 'podekscytowany':
    case 'ekscytacja':
    case 'z ekscytacją':
    case 'gorączkowo':
      return 'Read the following in an excited, high-energy tone:';
    case 'mischievously':
    case 'mischievous':
    case 'podstępnie':
    case 'psotnie':
    case 'złowieszczo':
    case 'zjadliwie':
      return 'Read the following in a sly, mischievous tone:';
    case 'sighs':
    case 'sigh':
    case 'sighing':
    case 'westchnienie':
    case 'ciężkie westchnienie':
    case 'wzdycha':
    case 'wzdychając':
      return 'Read the following with an audible, heavy sigh:';
    case 'giggles':
    case 'giggle':
    case 'giggling':
    case 'chichot':
    case 'chichocze':
    case 'nerwowy śmiech':
      return 'Read the following with a nervous giggle:';
    case 'laughs':
    case 'laugh':
    case 'laughing':
    case 'śmiech':
    case 'śmieje się':
    case 'śmiejąc się':
      return 'Read the following while laughing or chuckling:';
    case 'shouting':
    case 'shouts':
    case 'shout':
    case 'screaming':
    case 'screams':
    case 'krzyk':
    case 'krzyczy':
    case 'krzycząc':
    case 'wrzask':
    case 'wołanie':
    case 'głośno':
      return 'Read the following shouting in a loud, urgent voice:';
    case 'very fast':
    case 'szybko':
    case 'bardzo szybko':
      return 'Read the following at a very fast, rushed, and panicked pace:';
    case 'very slow':
    case 'wolno':
    case 'powoli':
    case 'bardzo wolno':
      return 'Read the following at a very slow, deliberate, and ominous pace:';
    default:
      return `Read the following in an expressive voice reflecting ${normalized}:`;
  }
}

/**
 * Wyciąga tag emocji/nastroju z tekstu (np. [whispers], [trembling], [szept], [panika])
 * i mapuje go na dyrektywę audioDirection dla Gemini TTS (Issue #544 + Issue #562).
 */
export function extractEmotionTag(text: string): ExtractedAudioMood | null {
  if (!text) return null;
  const match = text.match(
    new RegExp(`\\[\\s*(${GEMINI_TTS_EMOTION_TAGS})\\s*\\]`, 'i')
  );
  if (!match) return null;
  const tag = match[1].toLowerCase().trim();
  return {
    tag,
    audioDirection: mapEmotionToAudioDirection(tag),
  };
}

/**
 * Helper zwracający samą dyrektywę audioDirection wyekstrahowaną z tagów emocji (Issue #544).
 */
export function extractEmotionAudioDirection(text: string): string | undefined {
  const extracted = extractEmotionTag(text);
  return extracted ? extracted.audioDirection : undefined;
}

export const extractEmotionFromText = extractEmotionTag;
export const extractMoodTagToAudioDirection = extractEmotionAudioDirection;

/**
 * Ekstrahuje tag nastroju do audioDirection i zwraca oczyszczony tekst (Issue #544).
 */
export function extractAudioDirectionAndClean(text: string): {
  text: string;
  audioDirection?: string;
} {
  const audioDirection = extractEmotionAudioDirection(text);
  const clean = cleanResponseText(text);
  return {
    text: clean,
    audioDirection,
  };
}

/** Removes blocks that are never allowed to enter campaign memory. */
export function stripHiddenMemoryContent(text: string): string {
  return text
    .replace(/\[(?:OBSERWACJA|OBSERVATION)(?::[^\]]*)?\][\s\S]*?\[\/(?:OBSERWACJA|OBSERVATION)\]/gi, '')
    .replace(/\[(?:SEKRETY_MG|KEEPER_SECRETS)(?::[^\]]*)?\][\s\S]*?\[\/(?:SEKRETY_MG|KEEPER_SECRETS)\]/gi, '');
}

export interface DiegeticProseOptions {
  /** Czy wymuszać formatowanie dialogów myślnikiem maszynopisu lat 20. (- ) */
  normalizeDialogues?: boolean;
  /** Czy usuwać wycieki nagłówków formularzy i baz danych (np. "Cechy fizyczne:", "Wymiar:") */
  stripFormHeaders?: boolean;
  /** Czy czyścić zbędne nawiasy klamrowe {} */
  cleanBraces?: boolean;
}

export const FORM_HEADER_REGEX =
  /^[ \t]*[-*•_]*[ \t]*(?:[*_]{1,2})?(?:Cechy fizyczne(?: i manieryzm)?|Wymiar fizjologiczny|Pozycja społeczna|Wymiar socjologiczny|Ukryty cel|Wymiar psychologiczny|Status relacji|Nastawienie psychologiczne|Agenda|Stan zdrowia|Ekwipunek|Statystyki|Opis postaci|Osobowość(?: i cechy)?|Ważne miejsce|Cenne posiadanie|Kluczowa osoba|Ideologia(?: i przekonania)?|Rany i blizny|Fobie i manie|Pierwsze wrażenie|Kluczowa informacja|Poszlaka|Trop|Notatka śledcza|Wiarygodność|Pochodzenie|Atmosfera sceny|Cel narracyjny|Pacing i kadencja|Rygor CoC 7e RAW|Physical traits|Physiological dimension|Social status|Sociological dimension|Hidden agenda|Psychological dimension|Relationship status|Psychological disposition|Health status|Equipment|Stats|Character description|Personality(?: and traits)?|Meaningful location|Treasured possession|Significant person|Ideology(?: and beliefs)?|Injuries and scars|Phobias and manias|First impression|Key information|Clue|Lead|Investigative note|Credibility|Provenance|Atmosphere|Scene Goal|Pacing & Cadence|CoC 7e RAW)[ \t]*[*_]{0,2}[ \t]*[:–—-][ \t]*[*_]{0,2}[ \t]*/gim;

/**
 * Sanitizuje wszelkie techniczne i mechaniczne znaczniki silnika RPG / CoC 7e,
 * gwarantując brak wycieków tagów [TEST:], [DZIENNIK:], [NPC:], [STAN:], [WALKA:] itp.
 */
export function sanitizeMechanicalTags(text: string): string {
  if (!text) return '';
  return text
    // Dziennik bloki z zawartością i pojedyncze tagi
    .replace(/\[\s*(?:DZIENNIK|JOURNAL):[^\]]*\][\s\S]*?\[\s*\/\s*(?:DZIENNIK|JOURNAL)[^\]]*\]/gi, '')
    .replace(/\[\s*(?:DZIENNIK|JOURNAL)\s*:[^\]]*\]/gi, '')
    .replace(/\[\s*\/\s*(?:DZIENNIK|JOURNAL)[^\]]*\]/gi, '')
    // Sceny i Karta Akt (Issue #402)
    .replace(/\[\s*(?:KARTA_SCENY|SCENE_CARD):?[^\]]*\][\s\S]*?\[\s*\/\s*(?:KARTA_SCENY|SCENE_CARD)[^\]]*\]/gi, '')
    .replace(/\[\s*(?:ZMIANA_SCENY|SCENE_CHANGE)\s*:[^\]]*\]/gi, '')
    .replace(/\[\s*\/\s*(?:KARTA_SCENY|SCENE_CARD)[^\]]*\]/gi, '')
    // Bloki obserwacji i sekretów MG
    .replace(/\[\s*(?:OBSERWACJA|OBSERVATION)(?::[^\]]*)?\][\s\S]*?\[\s*\/\s*(?:OBSERWACJA|OBSERVATION)[^\]]*\]/gi, '')
    .replace(/\[\s*(?:SEKRETY_MG|KEEPER_SECRETS)(?::[^\]]*)?\][\s\S]*?\[\s*\/\s*(?:SEKRETY_MG|KEEPER_SECRETS)[^\]]*\]/gi, '')
    .replace(/\[\s*(?:OBSERWACJA|OBSERVATION)(?::[^\]]*)?\]/gi, '')
    .replace(/\[\s*(?:SEKRETY_MG|KEEPER_SECRETS)(?::[^\]]*)?\]/gi, '')
    .replace(/\[\s*\/\s*(?:OBSERWACJA|OBSERVATION|SEKRETY_MG|KEEPER_SECRETS)[^\]]*\]/gi, '')
    // Testy kości i wyników oraz stawki testów (Issue #737)
    .replace(/\[\s*(?:TEST|WYNIK|KOŚĆ|KOSC|DICE|ROLL|STAWKA|STAKE)\s*:[^\]]*\]/gi, '')
    .replace(/\[🎲[^\]]*\]/gi, '')
    .replace(/test:\s*[^\]]*\]/gi, '')
    .replace(/\[Test:[^\]]*\]/gi, '')
    .replace(/Wynik:\s*\d+\s*→[^.!\n]*/gi, '')
    .replace(/Progi:[^\n]*/gi, '')
    .replace(/\(Rzut\s+(?:ręczny|automatyczny)\)/gi, '')
    // Postacie, relacje, obecność NPC
    .replace(/\[\s*(?:NPC|OBECNI_NPC|PRESENT_NPCS|POSTAĆ|POSTAC|CHARACTER|RELACJA)\s*:[^\]]*\]/gi, '')
    // Lokacje i sceny
    .replace(/\[\s*(?:LOKACJA|LOCATION|MIEJSCE|SCENA|SCENE)\s*:[^\]]*\]/gi, '')
    // Przedmioty i ekwipunek
    .replace(/\[\s*(?:PRZEDMIOT|ITEM|ZDOBYTY_PRZEDMIOT|EKWIPUNEK|EQUIPMENT)\s*:[^\]]*\]/gi, '')
    // Mechanika stanu, ran, guardrails i cech
    .replace(/\[\s*(?:STAN|STAN_POSTACI|HP|MP|SANITY|SAN|POCZYTALNOŚĆ|POCZYTALNOSC|UTRATA_SAN|OBRAŻENIA|OBRAZENIA|RANY|SZCZĘŚCIE|SZCZESCIE|LUCK|GAME_OVER|KONIEC_GRY|WETO_SEDZIEGO|WETO|REFEREE_VETO|GUARDRAIL_LEVEL|GUARDRAIL)\s*:[^\]]*\]/gi, '')
    // Walka, obrona, pościgi, magia, tomy, sny i wizje
    .replace(/\[\s*(?:WALKA|WALKA_ATAK|OBRONA_WALKA|ATAK_WALKA|COMBAT|ATAK_WRĘCZ|ATAK_WRECZ|MELEE_ATTACK|OPPOSED_MELEE|MELEE_DEFENSE|DIVE_FOR_COVER|RZUT_ZA_OSŁONĘ|RZUT_ZA_OSLONE|OBRONA|DEFENSE|POŚCIG|POSCIG|CHASE|KONIEC_POŚCIGU|KONIEC_POSCIGU|CHASE_END|ZAGROŻENIE|ZAGROZENIE|HAZARD|CZAR|SPELL|MAGIA|TOM|TOME|KSIĘGA|KSIEGA|STUDIUM|OBRONA_MAGIA|MAGIA_OBRONA|OPPOSED_MAGIC|MAGIA_SPONTANICZNA|SPONTANEOUS_MAGIC|SEN|SENNE_WEZWANIE|DREAM|DREAM_VISION)\s*:[^\]]*\]/gi, '')
    .replace(/\[\s*(?:WYNIK_WALKI|COMBAT_RESULT|WYNIK_CZARU|SPELL_RESULT|WYNIK_OBRONY_MAGII|OPPOSED_MAGIC_RESULT|WYNIK_TOMU|TOME_RESULT|WYNIK_POŚCIGU|WYNIK_POSCIGU|CHASE_RESULT|WYNIK_ZAGROŻENIA|WYNIK_ZAGROZENIA|HAZARD_RESULT)\s*:[^\]]*\]/gi, '')
    // GM thoughts, mood, narrative goal, scene director, techniques, act report
    .replace(new RegExp(`\\[\\s*(?:MYŚLI_MG|MYSLI_MG|THOUGHTS|NASTRÓJ|NASTROJ|MOOD|CEL_NARRACYJNY|NARRATIVE_GOAL|REŻYSER_SCENY|SCENE_DIRECTOR|TECHNIKA_MG|MG_TECHNIQUE|RAPORT_AKTU|ACT_REPORT)\\s*:${NESTED_TAG_BODY}\\]`, 'gi'), '')
    // Depth Injection / Pacing / Author's Note tags (SillyTavern Adaptation - bloki multiline, bloki unclosed z liniami dyrektyw oraz tagi pojedyncze)
    .replace(/\[\s*(?:PRZYPOMNIENIE DLA MG|GM DIRECTIVE|DYNAMIC SCENE|DYNAMIC SCENE & PACING INJECTION|PACING INJECTION|AUTHOR'?S? NOTE|NOTATKA AUTORA)[^\]]*\][\s\S]*?\[\s*\/\s*(?:PRZYPOMNIENIE DLA MG|PRZYPOMNIENIE|GM DIRECTIVE|DIRECTIVE|DYNAMIC SCENE|DYNAMIC SCENE & PACING INJECTION|PACING INJECTION|AUTHOR'?S? NOTE|NOTATKA AUTORA|PACING)[^\]]*\]/gi, '')
    .replace(/\[\s*(?:PRZYPOMNIENIE DLA MG|GM DIRECTIVE|DYNAMIC SCENE|DYNAMIC SCENE & PACING INJECTION|PACING INJECTION|AUTHOR'?S? NOTE|NOTATKA AUTORA)[^\]]*\](?:\s*\n\s*(?:Atmosfera(?: sceny)?|Atmosphere|Cel narracyjny|Scene Goal|Pacing(?: i kadencja| & Cadence)?|Ton|Tone|Rygor CoC 7e RAW|CoC 7e RAW|RAW|BIEG|GEAR|Dynamic Cadence|Zmienna kadencja)\s*:[^\n]*)+/gi, '')
    .replace(/\[\s*(?:DYNAMIC SCENE & PACING INJECTION|DYNAMIC SCENE|PACING INJECTION|AUTHOR'?S? NOTE|NOTATKA AUTORA|PRZYPOMNIENIE DLA MG|GM DIRECTIVE|PACING)[^\]]*\]/gi, '')
    .replace(/\[\s*\/\s*(?:DYNAMIC SCENE & PACING INJECTION|DYNAMIC SCENE|PACING INJECTION|AUTHOR'?S? NOTE|NOTATKA AUTORA|PRZYPOMNIENIE DLA MG|GM DIRECTIVE|PACING|DIRECTIVE|PRZYPOMNIENIE)[^\]]*\]/gi, '')
    // Tagi multimedialne i ilustracje
    .replace(/\[\s*(?:ILUSTRACJA|OBRAZ|GRAFIKA|RYSUNEK|ZDJĘCIE|ZDJECIE|PORTRET|WIZUALIZACJA|IMAGE|PICTURE|ILLUSTRATION|SHOW|VISUALIZE|PORTRAIT|SFX|DŹWIĘK|DZWIEK|AUDIO|NAGRANIE|PROMPT)[^\]]*\]/gi, '')
    // Czas i pogoda
    .replace(new RegExp(`\\[\\s*(?:POGODA|WEATHER|AKTUALNY CZAS|AKTUALNY_CZAS|CURRENT TIME|CURRENT_TIME|TIME|KONIEC_SESJI|END_SESSION)\\s*:${NESTED_TAG_BODY}\\]`, 'gi'), '')
    // Catch-all dla halucynowanych wielkich tagów z dwukropkiem lub kreską (np. [ZAGROZENIE_RAW: ...])
    .replace(new RegExp(`\\[[A-ZŁŚŻŹĆŃ_]{2,}\\s*(?::|\\|)${NESTED_TAG_BODY}\\]`, 'gi'), '')
    // Niedomknięty tag techniczny na końcu uciętego streamu
    .replace(/\[[A-ZŁŚŻŹĆŃ_]{2,}(?::[^\]]*)?$/g, '');
}

/**
 * Diegetic Prose Cleaner (adaptacja Regex Scripts z SillyTavern)
 * Gwarantuje brak wycieków tagów technicznych i nagłówków bazodanowych
 * oraz formatuje tekst do estetyki maszynopisu lat 20. XX wieku.
 */
export function sanitizeDiegeticProse(
  text: string,
  options: DiegeticProseOptions = {}
): string {
  if (!text) return '';

  const {
    normalizeDialogues = true,
    stripFormHeaders = true,
    cleanBraces = true,
  } = options;

  let cleaned = stripHiddenMemoryContent(text);
  cleaned = sanitizeMechanicalTags(cleaned);

  // Usuwanie prefiksów asystenta/MG
  cleaned = cleaned
    .replace(/^(?:MG|GM|AI|Assistant|Mistrz Gry|Game Master):\s*(?:Assistant:\s*)?/gim, '')
    .replace(/^Assistant:\s*/gim, '')
    .trim();

  // Issue #551: Usuwanie linii i nagłówków GM Protocol bez nawiasów lub z nawiasami (Anti-Leak)
  cleaned = cleaned
    .replace(
      /^\s*\[?(?:MYŚLI_MG|MYSLI_MG|THOUGHTS|CEL_NARRACYJNY|NARRATIVE_GOAL|NASTRÓJ|NASTROJ|MOOD|REŻYSER_SCENY|SCENE_DIRECTOR|TECHNIKA_MG|MG_TECHNIQUE|DZIENNIK|JOURNAL|OBSERWACJA|OBSERVATION|SEKRETY_MG|KEEPER_SECRETS|RAPORT_AKTU|ACT_REPORT)\s*:[^\n]*/gim,
      ''
    )
    .trim();

  // Usuwanie bloków kodu i JSON
  cleaned = cleaned
    .replace(/```(?:json|javascript|typescript)?\s*[\s\S]*?(?:```|$)/gi, '')
    .replace(/\{\s*"[^"]*"[\s\S]*?\}/g, '');

  // Czyszczenie wycieków formularzy/bazy danych (Anti-Form Leakage)
  if (stripFormHeaders) {
    cleaned = cleaned.replace(FORM_HEADER_REGEX, '');
  }

  // Zamiana didaskaliów w klamrach {Didaskalia...} -> Didaskalia...
  if (cleanBraces) {
    cleaned = cleaned.replace(/\{([^}]+)\}/g, '$1');
  }

  // Normalizacja dialogów lat 20. (styl maszynopisu: pojedynczy myślnik "- ")
  if (normalizeDialogues) {
    // Zamiana półpauz/pauz (—, –) na zwykły myślnik (-)
    cleaned = cleaned.replace(/[—–]/g, '-');
    // Normalizacja dialogów z kwestią mówioną i atrybucją narracyjną ("Tekst" - rzekł / „Tekst” - dodał / “Tekst” - said / ‘Tekst’ - said)
    cleaned = cleaned.replace(
      /^[ \t]*["„»“”‘]([^"”«“”’\n]+)["”«“”’](?:[ \t]*-?[ \t]*([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]))/gm,
      '- $1 - $2'
    );
    // Normalizacja dialogów rozpoczynających się od cudzysłowu na początku linii (samodzielna kwestia)
    cleaned = cleaned.replace(/^[ \t]*["„»“”‘]([^"”«“”’\n]+)["”«“”’][ \t]*$/gm, '- $1');
  }

  // Usuwanie podwójnych spacji
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');
  // Usuwanie nadmiarowych pustych linii (> 2 -> 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Czyści tekst odpowiedzi AI z artefaktów technicznych, przygotowując go do TTS
 */
export function cleanResponseText(text: string): string {
  if (!text) return '';

  // Wyciszenie komunikatów technicznych Guardraila przed syntezą mowy TTS (Issue #528)
  if (
    /\[(?:STRAŻNIK TAJEMNIC — KOREKTA REALIZMU EPOKI|KEEPER OF ARCANE LORE — ERA REALITY CHECK)\]/i.test(
      text
    ) ||
    /Zasady testów i rzutów kośćmi|Skill Tests & Dice Rules/i.test(text) ||
    /Zasięg i parametry broni|Weapons & Combat Ranges/i.test(text)
  ) {
    return '';
  }

  const diegeticClean = sanitizeDiegeticProse(text, { normalizeDialogues: false });

  return (
    diegeticClean
      // JSON Artifacts
      .replace(/```(?:json|javascript|typescript)?\s*[\s\S]*?```/gi, '')
      .replace(/\{\s*"[^"]+"\s*:\s*[^\}]*\}/g, '')
      // Technical orders
      .replace(/Order\s*#\d+/gi, '')
      .replace(/iOrder\s*#\d+/gi, '')
      .replace(/SkillCheckRequest\s*\{[^\}]*\}/gi, '')
      // Didaskalia w klamrach (do odczytu: {Budzisz się...} -> Budzisz się...)
      .replace(/\{([^}]*)\}/g, '$1')
      // Testy kości i wyniki - USUWAMY z TTS
      .replace(/\[🎲[^\]]*\]/g, '')
      .replace(/test:\s*[^\]]*\]/gi, '')
      .replace(/\[Test:[^\]]*\]/gi, '')
      .replace(/Wynik:\s*\d+\s*→[^.!\n]*/gi, '')
      .replace(/Progi:[^\n]*/gi, '')
      .replace(/\(Rzut\s+(ręczny|automatyczny)\)/gi, '')
      .replace(/^ℹ️\s*🎲\s*Test:[^\n]*/gm, '')
      .replace(/^MG:\s*/gm, '')
      // GM Protocol & Media tags
      .replace(
        /\[(?:ILUSTRACJA|OBRAZ|GRAFIKA|RYSUNEK|ZDJĘCIE|SCENA|PORTRET|WIZUALIZACJA|IMAGE|PICTURE|ILLUSTRATION|SHOW|VISUALIZE|SCENE|PORTRAIT)[^\]]*\]/gi,
        ''
      )
      // GM Protocol & dyrektywy sceny (zamknięte w nawiasach oraz warianty bez nawiasów)
      .replace(
        new RegExp(
          `\\[\\s*(?:MYŚLI_MG|MYSLI_MG|THOUGHTS|NASTRÓJ|NASTROJ|MOOD|CEL_NARRACYJNY|NARRATIVE_GOAL|REŻYSER_SCENY|SCENE_DIRECTOR|TECHNIKA_MG|MG_TECHNIQUE|RAPORT_AKTU|ACT_REPORT)\\s*:${NESTED_TAG_BODY}\\]`,
          'gi'
        ),
        ''
      )
      .replace(
        /^\s*\[?(?:MYŚLI_MG|MYSLI_MG|THOUGHTS|CEL_NARRACYJNY|NARRATIVE_GOAL|NASTRÓJ|NASTROJ|MOOD|REŻYSER_SCENY|SCENE_DIRECTOR|TECHNIKA_MG|MG_TECHNIQUE|RAPORT_AKTU|ACT_REPORT)\s*:[^\n]*/gim,
        ''
      )
      .replace(/\[NPC:[^\]]*\]/gi, '')
      .replace(/\[(?:OBECNI_NPC|PRESENT_NPCS):[^\]]*\]/gi, '')
      .replace(/\[POSTAĆ:[^\]]*\]/gi, '')
      .replace(/\[(?:LOKACJA|LOCATION):[^\]]*\]/gi, '')
      .replace(/\[PRZEDMIOT:[^\]]*\]/gi, '')
      .replace(/\[ZDOBYTY_PRZEDMIOT:[^\]]*\]/gi, '')
      .replace(/\[WALKA:[^\]]*\]/gi, '')
      .replace(/\[(?:ATAK_WRĘCZ|ATAK_WRECZ|MELEE_ATTACK):[^\]]*\]/gi, '')
      .replace(/\[(?:WYNIK_WALKI|COMBAT_RESULT):[^\]]*\]/gi, '')
      .replace(/\[(?:OBRONA|DEFENSE):[^\]]*\]/gi, '')
      .replace(/\[(?:COMBAT):[^\]]*\]/gi, '')
      .replace(/\[(?:ZAGROŻENIE|ZAGROZENIE|HAZARD):[^\]]*\]/gi, '')
      .replace(/\[(?:CZAR|SPELL|MAGIA|OBRONA_MAGIA|MAGIA_OBRONA|OPPOSED_MAGIC|MAGIA_SPONTANICZNA|SPONTANEOUS_MAGIC):[^\]]*\]/gi, '')
      .replace(/\[(?:WYNIK_CZARU|SPELL_RESULT|WYNIK_OBRONY_MAGII|OPPOSED_MAGIC_RESULT):[^\]]*\]/gi, '')
      .replace(/\[(?:TOM|TOME|KSIĘGA|KSIEGA|STUDIUM):[^\]]*\]/gi, '')
      .replace(/\[(?:WYNIK_TOMU|TOME_RESULT):[^\]]*\]/gi, '')
      .replace(/\[(?:POŚCIG|POSCIG|CHASE):[^\]]*\]/gi, '')
      .replace(/\[(?:WYNIK_POŚCIGU|WYNIK_POSCIGU|CHASE_RESULT):[^\]]*\]/gi, '')
      .replace(/\[(?:WYNIK_ZAGROŻENIA|WYNIK_ZAGROZENIA|HAZARD_RESULT):[^\]]*\]/gi, '')
      .replace(/\[SANITY:[^\]]*\]/gi, '')
      .replace(/\[(?:OBSERWACJA|OBSERVATION):[^\]]*\]/gi, '')
      .replace(/\[(?:SEKRETY_MG|KEEPER_SECRETS):[^\]]*\]/gi, '')
      .replace(/\[\/(?:OBSERWACJA|OBSERVATION|SEKRETY_MG|KEEPER_SECRETS)\]/gi, '')
      .replace(/\[(?:DZIENNIK|JOURNAL):[^\]]*\]/gi, '')
      .replace(/\[\/(?:DZIENNIK|JOURNAL)\]/gi, '')
      .replace(/\[EKSPOZYCJA:[^\]]*\]/gi, '')
      .replace(/\[KLIMAT:[^\]]*\]/gi, '')
      .replace(/\[(?:SFX|DŹWIĘK|DZWIEK):[^\]]*\]/gi, '')
      .replace(/\[(?:AUDIO|NAGRANIE):[^\]]*\]/gi, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      // Twardy filtr (Issue #544 + Issue #562): wycina wszelkie znaczniki w nawiasach kwadratowych \[.*?\] przed wysyłką do bufora audio
      .replace(/\[[\s\S]*?\]/g, '')
      .replace(/\[[^\]]*\]/g, '')
      // Usunięcie wszelkich pozostałych nawiasów kwadratowych z tekstu lektora
      .replace(/[\[\]]/g, '')
      // Markdown removal
      .replace(/\*\*/g, '')
      .replace(/\*([^*]+?)\*/g, '$1')
      .replace(/__/g, '')
      .replace(/_([^_]+?)_/g, '$1')
      .replace(/`/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      // Usunięcie cudzysłowów (zapobiega czytaniu "cudzysłów")
      .replace(/["„“”«»]/g, '')
      // Emojis
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      // Spaces
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export interface StripMultilineOptions {
  /**
   * Gdy true (używane w useTTS przed podziałem na zdania), zachowuje tagi emocji
   * ([whispers], [szept], [panika] itp.) oraz [SFX:...], aby per-zdanie extractEmotionTag(raw)
   * mógł wyznaczyć dyrektywę audioDirection, po czym cleanResponseText wycina wszystkie [...].
   */
  preserveEmotionTags?: boolean;
}

/**
 * IND-193: usuwa bloki TECHNICZNE mogące obejmować wiele zdań/linii (tagi [TAG:...],
 * DZIENNIK z treścią, code fences ```, multiline JSON {"..."}) z CAŁEGO tekstu PRZED
 * cięciem na zdania. W przeciwieństwie do cleanResponseText ZACHOWUJE `\n`/whitespace -
 * kluczowe, by split zdań po `\n` (multi-voice TTS) nadal działał. Czyszczenie per-zdanie
 * (markdown, emoji, cudzysłowy, single-line tagi) robi cleanResponseText na pojedynczych zdaniach.
 *
 * `{narration}` (bez cudzysłowu) NIE jest usuwane - per-zdanie cleanResponseText wyciągnie treść.
 */
export function stripMultilineArtifacts(
  text: string,
  options?: StripMultilineOptions
): string {
  if (!text) return '';
  let intermediate = text
    .replace(/```(?:json|javascript|typescript)?\s*[\s\S]*?(?:```|$)/gi, '') // code fences
    .replace(/\[(?:DZIENNIK|JOURNAL):[^\]]*\][\s\S]*?(?:\[\/(?:DZIENNIK|JOURNAL)\]|$)/gi, '') // blok dziennika z treścią
    .replace(/\[(?:KARTA_SCENY|SCENE_CARD):?[^\]]*\][\s\S]*?(?:\[\/(?:KARTA_SCENY|SCENE_CARD)\]|$)/gi, '') // blok karty sceny
    .replace(/\[(?:ZMIANA_SCENY|SCENE_CHANGE):[^\]]*\]/gi, '') // tag zmiany sceny
    // Zamknięte bloki OBSERWACJA i SEKRETY_MG (z opcjonalnym nagłówkiem po dwukropku)
    .replace(/\[(?:OBSERWACJA|OBSERVATION)(?::[^\]]*)?\][\s\S]*?\[\/(?:OBSERWACJA|OBSERVATION)\]/gi, '')
    .replace(/\[(?:SEKRETY_MG|KEEPER_SECRETS)(?::[^\]]*)?\][\s\S]*?\[\/(?:SEKRETY_MG|KEEPER_SECRETS)\]/gi, '')
    // Niezamknięte bloki OBSERWACJA i SEKRETY_MG podczas streamingu (|$ na końcu)
    .replace(/\[(?:OBSERWACJA|OBSERVATION)\][\s\S]*$/gi, '')
    .replace(/\[(?:SEKRETY_MG|KEEPER_SECRETS)\][\s\S]*$/gi, '')
    // Issue #551: Zamknięte i wieloliniowe tagi GM Protocol (myśli, cele, nastrój, reżyseria, techniki)
    .replace(
      new RegExp(
        `\\[\\s*(?:MYŚLI_MG|MYSLI_MG|THOUGHTS|CEL_NARRACYJNY|NARRATIVE_GOAL|NASTRÓJ|NASTROJ|MOOD|REŻYSER_SCENY|SCENE_DIRECTOR|TECHNIKA_MG|MG_TECHNIQUE|RAPORT_AKTU|ACT_REPORT)\\s*:${NESTED_TAG_BODY}\\]`,
        'gi'
      ),
      ''
    )
    // Issue #551: Niezamknięte tagi GM Protocol na końcu strumienia (brak domknięcia `]`)
    .replace(
      /\[\s*(?:MYŚLI_MG|MYSLI_MG|THOUGHTS|CEL_NARRACYJNY|NARRATIVE_GOAL|NASTRÓJ|NASTROJ|MOOD|REŻYSER_SCENY|SCENE_DIRECTOR|TECHNIKA_MG|MG_TECHNIQUE|RAPORT_AKTU|ACT_REPORT)[^\]]*$/gi,
      ''
    )
    // Zamknięte bloki Depth Injection / Pacing Directive
    .replace(/\[\s*(?:PRZYPOMNIENIE DLA MG|GM DIRECTIVE|DYNAMIC SCENE|DYNAMIC SCENE & PACING INJECTION|PACING INJECTION|AUTHOR'?S? NOTE|NOTATKA AUTORA)[^\]]*\][\s\S]*?\[\s*\/\s*(?:PRZYPOMNIENIE DLA MG|PRZYPOMNIENIE|GM DIRECTIVE|DIRECTIVE|DYNAMIC SCENE|DYNAMIC SCENE & PACING INJECTION|PACING INJECTION|AUTHOR'?S? NOTE|NOTATKA AUTORA|PACING)[^\]]*\]/gi, '')
    // Niezamknięte bloki z liniami dyrektyw (nie połykają dalszej narracji fabularnej)
    .replace(/\[\s*(?:PRZYPOMNIENIE DLA MG|GM DIRECTIVE|DYNAMIC SCENE|DYNAMIC SCENE & PACING INJECTION|PACING INJECTION|AUTHOR'?S? NOTE|NOTATKA AUTORA)[^\]]*\](?:\s*\n\s*(?:Atmosfera(?: sceny)?|Atmosphere|Cel narracyjny|Scene Goal|Pacing(?: i kadencja| & Cadence)?|Ton|Tone|Rygor CoC 7e RAW|CoC 7e RAW|RAW|BIEG|GEAR|Dynamic Cadence|Zmienna kadencja)\s*:[^\n]*)+/gi, '')
    // Niezamknięte bloki Depth Injection podczas streamingu na samym końcu tekstu (|$ na końcu)
    .replace(/\[\s*(?:PRZYPOMNIENIE DLA MG|GM DIRECTIVE|DYNAMIC SCENE|DYNAMIC SCENE & PACING INJECTION|PACING INJECTION|AUTHOR'?S? NOTE|NOTATKA AUTORA)[^\]]*\][\s\S]*$/gi, '')
    // Pojedyncze tagi dyrektyw
    .replace(/\[\s*(?:DYNAMIC SCENE & PACING INJECTION|DYNAMIC SCENE|PACING INJECTION|AUTHOR'?S? NOTE|NOTATKA AUTORA|PRZYPOMNIENIE DLA MG|GM DIRECTIVE|PACING)[^\]]*\]/gi, '')
    .replace(/\[\s*\/\s*(?:DYNAMIC SCENE & PACING INJECTION|DYNAMIC SCENE|PACING INJECTION|AUTHOR'?S? NOTE|NOTATKA AUTORA|PRZYPOMNIENIE DLA MG|GM DIRECTIVE|PACING|DIRECTIVE|PRZYPOMNIENIE)[^\]]*\]/gi, '');

  if (options?.preserveEmotionTags) {
    intermediate = intermediate
      .replace(
        new RegExp(`\\[(\\s*(?:${GEMINI_TTS_EMOTION_TAGS})\\s*)\\]`, 'gi'),
        '⟪TTS_EMOTION:$1⟫'
      )
      .replace(
        /\[(\s*(?:SFX|DŹWIĘK|DZWIEK):\s*[a-zA-Z0-9_-]+\s*)\]/gi,
        '⟪TTS_SFX:$1⟫'
      );
  }

  intermediate = intermediate
    // Każdy zamknięty [TAG...], w tym tagi emocji lektora ([whispers], [trembling]), usuwany z tekstu TTS (Issue #544)
    .replace(new RegExp(`\\[${NESTED_TAG_BODY}\\]`, 'gi'), '')
    // Issue #551: Ogólny bezpiecznik: dowolny niedomknięty tag techniczny [UPPERCASE... na końcu strumienia
    .replace(/\[[A-ZŁŚŻŹĆŃ_]{2,}[^\]]*$/g, '')
    .replace(/\{\s*"[^"]*"[^}]{0,500}\}/g, ''); // multiline JSON {"..."}

  if (options?.preserveEmotionTags) {
    intermediate = intermediate
      .replace(/⟪TTS_EMOTION:([^⟫]+)⟫/g, '[$1]')
      .replace(/⟪TTS_SFX:([^⟫]+)⟫/g, '[$1]');
  }

  return intermediate;
}

/**
 * Lekki stripper tagów AI - usuwa TYLKO tagi w nawiasach kwadratowych.
 * W przeciwieństwie do cleanResponseText() NIE usuwa markdown, cudzysłowów, emoji.
 * Przeznaczony do czyszczenia opisów ekwipunku, lokacji itp.
 */
export function stripAITags(text: string): string {
  if (!text) return '';
  const mechanicallyCleaned = sanitizeMechanicalTags(text);
  return (
    mechanicallyCleaned
      // Catch-all: [UPPERCASE_TAG...] (min 3 wielkie litery/podkreślenia),
      // odporny na zagnieżdżony [...]
      .replace(new RegExp(`\\[[A-ZŁŚŻŹĆŃ_]{3,}${NESTED_TAG_BODY}\\]`, 'g'), '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  );
}

/**
 * Sprawdza czy słowo to typowe słowo (nie imię)
 */
export function isCommonWord(word: string): boolean {
  const commonWords = [
    'ten',
    'ta',
    'to',
    'on',
    'ona',
    'ono',
    'ty',
    'ja',
    'my',
    'wy',
    'oni',
    'one',
    'tak',
    'nie',
    'ale',
    'więc',
    'bo',
    'że',
    'czy',
    'jak',
    'co',
    'kto',
    'stary',
    'młody',
    'mały',
    'duży',
    'wysoki',
    'niski',
    'mężczyzna',
    'kobieta',
    'człowiek',
    'osoba',
    'postać',
    'chwilę',
    'nagle',
    'potem',
    'wtedy',
    'teraz',
    'zaraz',
  ];
  return commonWords.includes(word.toLowerCase());
}
