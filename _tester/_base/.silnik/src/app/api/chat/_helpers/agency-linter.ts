/**
 * Runtime Linter i Detektor Naruszeń Sprawczości Badacza (CoC 7e RAW)
 *
 * Wykrywa naruszenia Fizycznego Immunitetu i sprawczości graczy:
 * 1. Samowolne przemieszczanie badaczy (ruch bez deklaracji: wchodzicie, zeskakuje, wsiadacie).
 * 2. Sięganie do ekwipunku (dobycie broni, wyciągnięcie apteczki bez deklaracji).
 * 3. Samowolne badania, oględziny i badanie ran (bada rany, bada zwłoki, przeszukuje).
 * 4. Narzucanie motoryki ciała (chwyta za lejce, zaciska dłoń).
 * 5. Wkładanie słów w usta badacza (generowanie dialogów dla postaci gracza).
 */

import type { StreamChunk } from '@/lib/ai-providers/types';

export type AgencyViolationType =
  | 'movement'
  | 'inventory'
  | 'examination'
  | 'motorics'
  | 'dialogue';

export interface AgencyViolation {
  characterName?: string;
  type: AgencyViolationType;
  matchedSnippet: string;
  reason: string;
  index: number;
}

export interface AgencyLintResult {
  hasViolation: boolean;
  violations: AgencyViolation[];
  suggestedTruncationIndex?: number;
  sanitizedText?: string;
}

export interface AgencyLintOptions {
  isDuet?: boolean;
  locale?: 'pl' | 'en';
  /** Exact current human declaration, never assistant text or history. */
  declaredAction?: {characterName:string;text:string};
}

/** Narrow permission: a declared entry authorizes that investigator and that literal destination only. */
function isDeclaredEntry(text:string,index:number,options:AgencyLintOptions,characterName?:string):boolean {
  const declaration=options.declaredAction;
  if(!declaration?.text||!declaration.characterName)return false;
  if(characterName&&!extractNameVariants(declaration.characterName).some(name=>name.toLocaleLowerCase()===characterName.toLocaleLowerCase()))return false;
  if(!characterName&&options.isDuet)return false;
  const en=options.locale==='en';
  const response=text.slice(index).replace(/[*_]/g,'').toLocaleLowerCase();
  const destination=response.match(en
    ? /^(?:you\s+)?(?:enter(?:s|ed|ing)?|step(?:s|ped)?\s+(?:into|inside)|walk(?:s|ed)?\s+into)\s+(?:the\s+|a\s+)?([\p{L}\p{N}-]+)/u
    : /^(?:wchodzi(?:sz|cie)?|wszedł(?:eś)?|weszła(?:ś)?|weszli(?:ście)?)\s+(?:do|w)\s+([\p{L}\p{N}-]+)/u);
  const singleTargetTail=(value:string)=>/^(?:\s*$|\s*[,.;:!?\n]|\s+za zaproszeniem(?=\s*[,.;:!?\n]|\s*$))/u.test(value);
  const target=destination?.[1];
  if(!target||!singleTargetTail(response.slice(destination![0].length)))return false;
  // Quoted dialogue and hypothetical/negated actions do not authorize physical movement.
  const human=declaration.text.replace(/[„“"][^”"\n]*[”"]/g,'').replace(/(?<![\p{L}])'[^'\n]*'(?![\p{L}])/gu,'').toLocaleLowerCase();
  if(/(?<![\p{L}\p{N}])(?:jeżeli|jeśli|gdyby\w*|pod warunkiem|if|unless|would|could)(?![\p{L}\p{N}])/u.test(human))return false;
  const entry=en ? /\bi\s+(?:enter|step\s+(?:into|inside)|walk\s+into)\s+(?:the\s+|a\s+)?([\p{L}\p{N}-]+)/gu
    : /(?<![\p{L}\p{N}])(?:wchodzę|wejdę)\s+(?:do|w)\s+([\p{L}\p{N}-]+)/gu;
  for(const match of human.matchAll(entry)){
    if(human.slice(match.index!+match[0].length).match(/[.!?;\n]/)?.[0]==='?')continue;
    const prefix=human.slice(0,match.index).split(/[.!?;\n]/).at(-1)||'';
    if(match[1]===target&&singleTargetTail(human.slice(match.index!+match[0].length))&&!isNegatedBefore(prefix)&&!/(?:^|\s)(?:jeśli|gdyby\w*|czy|if|unless|would|could)(?:\s|$)/u.test(prefix))return true;
  }
  return false;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TITLES_TO_STRIP = [
  'dr', 'dr.', 'doktor', 'doctor',
  'prof', 'prof.', 'profesor', 'professor',
  'pan', 'pani', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.',
  'ks', 'ks.', 'ksiądz', 'father', 'ojciec',
  'det', 'det.', 'detektyw', 'detective',
  'inspektor', 'inspector',
];

/**
 * Generuje formy deklinacyjne dla polskich i spolszczonych imion/nazwisk (przypadki zależne i wołacz).
 */
export function generatePolishDeclensions(word: string): string[] {
  const trimmed = word?.trim();
  if (!trimmed || trimmed.length < 3) return [];

  const forms = new Set<string>();
  const lower = trimmed.toLowerCase();

  // Nazwiska na -ski, -cki, -dzki
  if (lower.endsWith('ski') || lower.endsWith('cki') || lower.endsWith('dzki')) {
    const stem = trimmed.slice(0, -1);
    forms.add(stem + 'iego');
    forms.add(stem + 'iemu');
    forms.add(stem + 'im');
    forms.add(stem + 'a');
    forms.add(stem + 'iej');
    forms.add(stem + 'ą');
    return Array.from(forms);
  }

  // Nazwiska żeńskie na -ska, -cka, -dzka
  if (lower.endsWith('ska') || lower.endsWith('cka') || lower.endsWith('dzka')) {
    const stem = trimmed.slice(0, -1);
    forms.add(stem + 'iej');
    forms.add(stem + 'ą');
    forms.add(stem + 'i');
    forms.add(stem + 'iego');
    return Array.from(forms);
  }

  const lastChar = lower[lower.length - 1];

  // Imiona żeńskie i męskie na -a (np. Katarzyna, Helena, Maria, Stanisława, Barnaba)
  if (lastChar === 'a') {
    const stem = trimmed.slice(0, -1);
    forms.add(stem + 'y');
    forms.add(stem + 'i');
    forms.add(stem + 'ie');
    forms.add(stem + 'e');
    forms.add(stem + 'ę');
    forms.add(stem + 'ą');
    forms.add(stem + 'o');
    return Array.from(forms);
  }

  // Imiona/nazwiska męskie zakończone spółgłoską (np. Stanisław, Arthur, Konrad, Edward, Piotr, Tomasz, Jan, Lovecraft)
  if (/[bcdfghjklłmnprstvwxzżźćńś]/i.test(lastChar)) {
    forms.add(trimmed + 'a');
    forms.add(trimmed + 'owi');
    forms.add(trimmed + 'em');
    forms.add(trimmed + 'u');
    forms.add(trimmed + 'ie');
    forms.add(trimmed + 'e');
    // Obcojęzyczne formy z apostrofem (np. Lovecraft'a)
    forms.add(trimmed + "'a");
    forms.add(trimmed + "'em");
    forms.add(trimmed + "'owi");
    return Array.from(forms);
  }

  // Obcojęzyczne nazwiska/imiona zakończone samogłoską (np. Poe, Crowley, Shelley)
  forms.add(trimmed + "'go");
  forms.add(trimmed + "'ego");
  forms.add(trimmed + "'mu");
  forms.add(trimmed + "'m");
  forms.add(trimmed + "'a");
  forms.add(trimmed + "go");
  forms.add(trimmed + "ego");
  forms.add(trimmed + "a");
  forms.add(trimmed + "em");
  forms.add(trimmed + "owi");

  return Array.from(forms);
}

/**
 * Ekstrahuje warianty imienia badacza (pełne imię, bez tytułu, pierwsze imię, nazwisko oraz formy deklinacyjne).
 */
export function extractNameVariants(name: string): string[] {
  const trimmed = name?.trim();
  if (!trimmed) return [];

  const variants = new Set<string>();

  // Dodaj pełną nazwę jeśli ma min. 2 znaki lub jest tagowana
  if (trimmed.length >= 2 || trimmed.startsWith('@')) {
    variants.add(trimmed);
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return Array.from(variants);

  const firstLower = parts[0].toLowerCase();
  const hasTitle = TITLES_TO_STRIP.includes(firstLower);
  const titlePart = hasTitle ? parts[0] : null;
  const contentParts = hasTitle ? parts.slice(1) : parts;

  if (hasTitle && contentParts.length > 0) {
    const withoutTitle = contentParts.join(' ');
    if (withoutTitle.length >= 2) {
      variants.add(withoutTitle);
    }
  }

  if (contentParts.length > 0) {
    const firstName = contentParts[0].replace(/\.$/, '');
    const lastName = contentParts[contentParts.length - 1].replace(/\.$/, '');

    if (firstName.length >= 3 && !TITLES_TO_STRIP.includes(firstName.toLowerCase())) {
      variants.add(firstName);
      for (const dec of generatePolishDeclensions(firstName)) {
        variants.add(dec);
      }
    }

    if (
      contentParts.length > 1 &&
      lastName.length >= 3 &&
      !TITLES_TO_STRIP.includes(lastName.toLowerCase())
    ) {
      variants.add(lastName);
      for (const dec of generatePolishDeclensions(lastName)) {
        variants.add(dec);
      }
      if (titlePart) {
        variants.add(`${titlePart} ${lastName}`);
        for (const dec of generatePolishDeclensions(lastName)) {
          variants.add(`${titlePart} ${dec}`);
        }
        if (titlePart.endsWith('.')) {
          const titleWithoutDot = titlePart.slice(0, -1);
          variants.add(`${titleWithoutDot} ${lastName}`);
          for (const dec of generatePolishDeclensions(lastName)) {
            variants.add(`${titleWithoutDot} ${dec}`);
          }
        }
      }
    }

    if (contentParts.length === 2 && firstName.length >= 3 && lastName.length >= 3) {
      const fDecs = generatePolishDeclensions(firstName);
      const lDecs = generatePolishDeclensions(lastName);
      if (fDecs.length > 0 && lDecs.length > 0) {
        variants.add(`${fDecs[0]} ${lDecs[0]}`);
      }
    }
  }

  return Array.from(variants);
}

/**
 * Buduje wzorzec regex dopasowujący imię badacza (z opcjonalnym @).
 */
function buildCharacterRegexPattern(names: string[]): string | null {
  const allVariants = new Set<string>();
  for (const n of names) {
    if (!n) continue;
    const variants = extractNameVariants(n);
    if (variants.length === 0 && n.trim().length === 1) {
      // Dla jednoliterowych imion wymuszaj tag @ aby nie dopasowywać losowych spójników
      allVariants.add(`@${n.trim()}`);
    } else {
      for (const v of variants) {
        allVariants.add(v);
      }
    }
  }

  if (allVariants.size === 0) return null;

  const sorted = Array.from(allVariants).sort((a, b) => b.length - a.length);
  const escaped = sorted
    .map((v) => {
      if (v.startsWith('@')) {
        return `@${escapeRegex(v.slice(1))}`;
      }
      return `@?${escapeRegex(v)}`;
    })
    .join('|');

  return `(?:${escaped})`;
}

const ABBREVIATIONS_PATTERN = /\b(?:dr|prof|mr|mrs|ms|ks|godz|np|itp|itd|ul|art|pw|jw|tel|str|st|[a-zA-Z])\.$/i;

interface SentenceSpan {
  text: string;
  start: number;
  end: number;
}

/**
 * Dzieli tekst na zdania z uwzględnieniem skrótów, inicjałów, wielokropków i myślników.
 */
function splitIntoSentenceSpans(text: string): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  if (!text) return spans;

  let currentStart = 0;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (ch === '\n') {
      const end = i;
      while (i < len && text[i] === '\n') i++;
      const segment = text.slice(currentStart, end);
      if (segment.trim().length > 0) {
        spans.push({ text: segment, start: currentStart, end });
      }
      currentStart = i;
      continue;
    }

    // Separator myślnikowy klauzul niezależnych: " — " lub " – "
    if ((ch === '—' || ch === '–') && i > currentStart && i + 1 < len) {
      if (text[i - 1] === ' ' && (text[i + 1] === ' ' || text[i + 1] === '\n')) {
        const segment = text.slice(currentStart, i - 1);
        if (segment.trim().length > 0) {
          spans.push({ text: segment, start: currentStart, end: i - 1 });
        }
        while (i < len && (text[i] === '—' || text[i] === '–' || text[i] === ' ' || text[i] === '\t')) i++;
        currentStart = i;
        continue;
      }
    }

    if (ch === ';' || ch === '.' || ch === '!' || ch === '?' || ch === '…') {
      if (ch === '.') {
        const precedingText = text.slice(currentStart, i + 1);
        if (ABBREVIATIONS_PATTERN.test(precedingText)) {
          if (text[i + 1] !== '.') {
            i++;
            continue;
          }
        }
      }

      let pEnd = i + 1;
      while (pEnd < len && /[.!?…;]/.test(text[pEnd])) pEnd++;
      while (pEnd < len && /[”"’'»\)]/.test(text[pEnd])) pEnd++;

      if (pEnd >= len || /\s/.test(text[pEnd])) {
        const segment = text.slice(currentStart, pEnd);
        if (segment.trim().length > 0) {
          spans.push({ text: segment, start: currentStart, end: pEnd });
        }
        i = pEnd;
        while (i < len && /[ \t]/.test(text[i])) i++;
        currentStart = i;
        continue;
      }
    }
    i++;
  }

  if (currentStart < len) {
    const remaining = text.slice(currentStart);
    if (remaining.trim().length > 0) {
      spans.push({ text: remaining, start: currentStart, end: len });
    }
  }

  return spans;
}

const OBJECT_PREPOSITIONS_PL =
  /\b(?:do|ku|na|z|ze|od|dla|o|w|we|u|koło|obok|przy|przeciwko|wobec|zza|spod|za|przed|nad|pod|między|pomiędzy|naprzeciw|naprzeciwko|w\s+stronę|w\s+kierunku|wokół|wkoło|dookoła|w\s+pobliżu|poprzez|przez|ponad|poniżej|powyżej)\s*$/i;
const OBJECT_PREPOSITIONS_EN =
  /\b(?:to|at|towards|toward|from|for|against|near|beside|by|with|behind|in\s+front\s+of|next\s+to|opposite|across\s+from|around|alongside|past|before|after|above|below|under|underneath|between|among|upon|onto|into|off)\s*$/i;

function isPrepositionalObject(textBeforeChar: string): boolean {
  const trimmed = textBeforeChar.trimEnd();
  return OBJECT_PREPOSITIONS_PL.test(trimmed) || OBJECT_PREPOSITIONS_EN.test(trimmed);
}

function isNegatedBefore(textBeforeVerb: string): boolean {
  const trimmed = textBeforeVerb.trimEnd();
  return (
    /(?:\b(?:nie|ani|wcale\s+nie|nigdzie\s+nie|nigdy\s+nie)\s*)$/i.test(trimmed) ||
    /(?:\b(?:not|never|don't|doesn't|didn't|do\s+not|does\s+not|did\s+not)\s*)$/i.test(trimmed)
  );
}

const PERCEPTION_VERBS_PL =
  `widzi|widzą|dostrzega|dostrzegają|słyszy|słyszą|czuje|czują|zauważa|zauważają|` +
  `spogląda|spoglądają|patrzy|patrzą|obserwuje|obserwują|` +
  `widzisz|widzicie|dostrzegasz|dostrzegacie|słyszysz|słyszycie|czujesz|czujecie|zauważasz|zauważacie`;
const PERCEPTION_VERBS_EN =
  `sees?|noticed?|notices?|hear(?:s|d)?|feels?|felt|spots?|spotted|watche[sd]?|looks?\\s+at`;

const PERCEPTION_REGEX = new RegExp(
  `^(?:,\\s*[^,]+,\\s*|\\s+)(?:${PERCEPTION_VERBS_PL}|${PERCEPTION_VERBS_EN})\\b`,
  'i'
);

const SUBORDINATE_NPC_BOUNDARY_REGEX =
  /(?:,\s*(?:ale|lecz|a|podczas\s+gdy|gdy|gdy\s+tymczasem|jak|kiedy|że|gdzie|który|która|które|chociaż|zanim|as|while|when|where|who|whom)\s+)(?:woźnica|stangret|mężczyzna|kobieta|szeryf|policjant|kultysta|karczmarz|kapłan|pastor|przeciwnik|wróg|postać|nieznajomy|nieznajoma|ofiara|ranny|ranna|zwłoki|ktoś|stwór|potwór|bestia|istota|driver|coachman|man|woman|sheriff|cultist|officer|stranger|figure|creature|beast|monster|[A-Z][a-z]+)\s+/i;

/**
 * Runtime Linter sprawdzający tekst odpowiedzi MG pod kątem naruszeń sprawczości badaczy.
 */
export function lintAgencyViolations(
  text: string,
  investigatorNames: string[] = [],
  options: AgencyLintOptions = {}
): AgencyLintResult {
  const violations: AgencyViolation[] = [];
  if (!text || typeof text !== 'string') {
    return { hasViolation: false, violations: [] };
  }

  const isEn = options.locale === 'en';
  const isDuet = Boolean(options.isDuet || investigatorNames.length > 1);

  const cleanInvestigatorNames = investigatorNames
    .map((n) => n?.trim())
    .filter((n): n is string => Boolean(n && n !== 'Nieznany'));

  const charPattern = buildCharacterRegexPattern(cleanInvestigatorNames);

  // Opcjonalne formatowanie Markdown wokół słów i spacji
  const MD_SP = '[*_]{0,3}\\s+[*_]{0,3}';
  const SPEECH_VERBS =
    'mówi|odpowiada|pyta|krzyczy|szepcze|stwierdza|rzuca|mówił(?:a)?|odpowiedział(?:a)?|zapytał(?:a)?|krzyknął|krzyknęła|szepnął|szepnęła|says|replies|asks|shouts|whispers|speaks|said|replied|asked|shouted|whispered|spoke|mutters|muttered|exclaims|exclaimed';

  // 1. Kwestie dialogowe wkładane w usta badacza
  if (charPattern) {
    // 1a. Format skryptowy / dwukropkowy: Dr Constance Ward [mówi]: „...” / **Constance**: "..."
    const dialogueColonRegex = new RegExp(
      `(?:^|\\n)\\s*[*_]{0,3}(${charPattern})[*_]{0,3}\\s*[*_]{0,3}(?:${SPEECH_VERBS})?[*_]{0,3}\\s*:\\s*([„"“\x27][^”"”\x27\\n]+[”"”\x27])`,
      'gui'
    );
    let match: RegExpExecArray | null;
    while ((match = dialogueColonRegex.exec(text)) !== null) {
      violations.push({
        characterName: match[1],
        type: 'dialogue',
        matchedSnippet: match[0].trim(),
        reason: `Niedozwolone przypisanie kwestii dialogowej postaci badacza (${match[1]}). Gracz decyduje co mówi jego postać.`,
        index: match.index,
      });
    }

    // 1b. Format myślnikowy (dialog polski i angielski): — ... — mówi Constance / - ... - Arthur replies
    const dialogueDashRegex = new RegExp(
      `(?:^|\\n)\\s*[-—–]\\s*([^-—–\\n]+?)\\s*[-—–]\\s*[*_]{0,3}(?:(?:${SPEECH_VERBS})\\s+[*_]{0,3}(${charPattern})[*_]{0,3}|(${charPattern})[*_]{0,3}\\s+[*_]{0,3}(?:${SPEECH_VERBS}))(?![\\p{L}\\p{N}])`,
      'gui'
    );
    while ((match = dialogueDashRegex.exec(text)) !== null) {
      const charName = match[2] || match[3];
      violations.push({
        characterName: charName,
        type: 'dialogue',
        matchedSnippet: match[0].trim(),
        reason: `Niedozwolone przypisanie kwestii dialogowej postaci badacza (${charName}). Gracz decyduje co mówi jego postać.`,
        index: match.index,
      });
    }

    // 1c. Format w cudzysłowie: "..." — mówi Constance / Constance says
    const dialogueQuoteRegex = new RegExp(
      `([„"“\x27][^”"”\x27\\n]+[”"”\x27])\\s*[-—–,]?\\s*[*_]{0,3}(?:(?:${SPEECH_VERBS})\\s+[*_]{0,3}(${charPattern})[*_]{0,3}|(${charPattern})[*_]{0,3}\\s+[*_]{0,3}(?:${SPEECH_VERBS}))(?![\\p{L}\\p{N}])`,
      'gui'
    );
    while ((match = dialogueQuoteRegex.exec(text)) !== null) {
      const charName = match[2] || match[3];
      violations.push({
        characterName: charName,
        type: 'dialogue',
        matchedSnippet: match[0].trim(),
        reason: `Niedozwolone przypisanie kwestii dialogowej postaci badacza (${charName}). Gracz decyduje co mówi jego postać.`,
        index: match.index,
      });
    }
  }

  // Definicje czasowników i fraz dla 3. osoby (przypisanych do badacza)
  const moveVerbsPl =
    `zeskakuje(?:${MD_SP}(?:z|na)|\\b)|zeskakują(?:${MD_SP}(?:z|na)|\\b)|zeskoczył(?:a|i|y)?(?:${MD_SP}(?:z|na)|\\b)|` +
    `zeskakując(?:${MD_SP}(?:z|na)|\\b)|zeskoczyć(?:${MD_SP}(?:z|na)|\\b)|` +
    `wsiada(?:${MD_SP}(?:do|na)|\\b)|wsiadają(?:${MD_SP}(?:do|na)|\\b)|wsiadł(?:a|y)?|wsiedli|` +
    `wsiadając(?:${MD_SP}(?:do|na)|\\b)|wsiąść(?:${MD_SP}(?:do|na)|\\b)|` +
    `wysiada(?:${MD_SP}(?:z)|\\b)|wysiadają(?:${MD_SP}(?:z)|\\b)|wysiadł(?:a|y)?|wsiedli|` +
    `wysiadając(?:${MD_SP}(?:z)|\\b)|wysiąść(?:${MD_SP}(?:z)|\\b)|` +
    `wchodzi(?:${MD_SP}(?:do|w)|\\b)|wchodzą(?:${MD_SP}(?:do|w)|\\b)|wszedł(?:${MD_SP}(?:do|w)|\\b)|weszł(?:a|i|y)(?:${MD_SP}(?:do|w)|\\b)|` +
    `wchodząc(?:${MD_SP}(?:do|w)|\\b)|wejść(?:${MD_SP}(?:do|w)|\\b)|` +
    `podchodzi(?:${MD_SP}do|\\b)|podchodzą(?:${MD_SP}do|\\b)|podszedł(?:${MD_SP}do|\\b)|podeszł(?:a|i|y)(?:${MD_SP}do|\\b)|` +
    `podchodząc(?:${MD_SP}do|\\b)|` +
    `podbiega(?:${MD_SP}do|\\b)|podbiegają(?:${MD_SP}do|\\b)|podbiegł(?:a|i|y)?(?:${MD_SP}do|\\b)|` +
    `podbiegając(?:${MD_SP}do|\\b)|podbiec(?:${MD_SP}do|\\b)|` +
    `biegnie(?:${MD_SP}do|\\b)|biegną(?:${MD_SP}do|\\b)|pobiegł(?:a|i|y)?(?:${MD_SP}do|\\b)|` +
    `biegnąc(?:${MD_SP}do|\\b)|pobiec(?:${MD_SP}do|\\b)|` +
    `rusza(?:${MD_SP}w|${MD_SP}do|${MD_SP}naprzód|\\b)|ruszają(?:${MD_SP}w|${MD_SP}do|${MD_SP}naprzód|\\b)|ruszył(?:a|i|y)?(?:${MD_SP}w|${MD_SP}do|${MD_SP}naprzód|\\b)|` +
    `ruszając(?:${MD_SP}w|${MD_SP}do|${MD_SP}naprzód|\\b)|ruszyć(?:${MD_SP}w|${MD_SP}do|${MD_SP}naprzód|\\b)|` +
    `zbliża${MD_SP}się|zbliżają${MD_SP}się|zbliżył(?:a|i|y)?${MD_SP}się|zbliżając${MD_SP}się|zbliżyć${MD_SP}się|` +
    `cofa${MD_SP}się|cofają${MD_SP}się|cofnął(?:a|i|y)?${MD_SP}się|cofając${MD_SP}się|cofnąć${MD_SP}się|` +
    `wkracza|wkraczają|wkroczył(?:a|i|y)?|wkraczając|wkroczyć|` +
    `przekracza${MD_SP}próg|przekraczają${MD_SP}próg|przekroczył(?:a|i|y)?${MD_SP}próg|przekraczając${MD_SP}próg|przekroczyć${MD_SP}próg|` +
    `(?:udaje\\s+się|zdołał(?:a|i|y)?|zdoła(?:ją)?|postanawia|postanawiają|postanowił(?:a|i|y)?|próbuje|próbują|spróbował(?:a|i|y)?)(?:[^.!?\\n]{0,80}?\\b(?:i|oraz)\\s+)?\\s*(?:zeskoczyć|wsiąść|wysiąść|wejść|podbiec|pobiec|ruszyć|zbliżyć\\s+się|cofnąć\\s+się|wkroczyć|przekroczyć\\s+próg)`;

  const moveVerbsEn =
    `jumps?${MD_SP}down|jumped${MD_SP}down|jumping${MD_SP}down|jump${MD_SP}down|hops?${MD_SP}off|hopped${MD_SP}off|hopping${MD_SP}off|hop${MD_SP}off|boards?|boarded|boarding|` +
    `enters?|entered|entering|approaches?|approached|approaching|` +
    `rushes?${MD_SP}to|rushed${MD_SP}to|rushing${MD_SP}to|rush${MD_SP}to|steps?${MD_SP}(?:into|inside)|stepped${MD_SP}(?:into|inside)|stepping${MD_SP}(?:into|inside)|step${MD_SP}(?:into|inside)|` +
    `walks?${MD_SP}into|walked${MD_SP}into|walking${MD_SP}into|walk${MD_SP}into|` +
    `(?:manages?\\s+to|managed\\s+to|decides?\\s+to|decided\\s+to|tries\\s+to|tried\\s+to)(?:[^.!?\\n]{0,80}?\\b(?:and)\\s+)?\\s*(?:jump\\s+down|hop\\s+off|board|enter|approach|rush\\s+to|step|walk)`;

  const invVerbsPl =
    `wyciąga|wyciągają|wyciągnął|wyciągnęła|wyciągnęli|wyciągnęły|wyciągając|wyciągnąć|` +
    `wyjmuje|wyjmują|wyjął|wyjęła|wyjęli|wyjęły|wyjmując|wyjąć|` +
    `sięga|sięgają|sięgnął|sięgnęła|sięgnęli|sięgnęły|sięgając|sięgnąć|` +
    `dobywa|dobywają|dobył|dobyła|dobyli|dobyły|dobywając|dobyć|` +
    `chowa|chowają|schował(?:a|i|y)?|chowając|schować|` +
    `otwiera${MD_SP}(?:torbę|plecak|walizkę|apteczkę|kieszeń)|otworzył(?:a|i|y)?${MD_SP}(?:torbę|plecak|walizkę|apteczkę|kieszeń)|otwierając${MD_SP}(?:torbę|plecak|walizkę|apteczkę|kieszeń)|otworzyć${MD_SP}(?:torbę|plecak|walizkę|apteczkę|kieszeń)|` +
    `przeładowuje|przeładował(?:a|i|y)?|przeładowując|przeładować|` +
    `grzebie${MD_SP}w${MD_SP}kieszeni|` +
    `(?:udaje\\s+się|zdołał(?:a|i|y)?|zdoła(?:ją)?|postanawia|postanawiają|postanowił(?:a|i|y)?|próbuje|próbują|spróbował(?:a|i|y)?)(?:[^.!?\\n]{0,80}?\\b(?:i|oraz)\\s+)?\\s*(?:wyciągnąć|wyjąć|sięgnąć|dobyć|schować|otworzyć|przeładować)`;

  const invVerbsEn =
    `pulls?${MD_SP}out|pulled${MD_SP}out|pulling${MD_SP}out|pull${MD_SP}out|takes?${MD_SP}out|took${MD_SP}out|taking${MD_SP}out|take${MD_SP}out|reaches?${MD_SP}(?:into|for)|reached${MD_SP}(?:into|for)|reaching${MD_SP}(?:into|for)|reach${MD_SP}(?:into|for)|` +
    `draws?${MD_SP}(?:his|her|their|a)${MD_SP}(?:gun|weapon|revolver|blade|pistol)|drew${MD_SP}(?:his|her|their|a)${MD_SP}(?:gun|weapon|revolver|blade|pistol)|drawing${MD_SP}(?:his|her|their|a)${MD_SP}(?:gun|weapon|revolver|blade|pistol)|draw${MD_SP}(?:his|her|their|a)${MD_SP}(?:gun|weapon|revolver|blade|pistol)|` +
    `opens?${MD_SP}(?:his|her|their|a)${MD_SP}(?:bag|kit|pack|pocket)|opened${MD_SP}(?:his|her|their|a)${MD_SP}(?:bag|kit|pack|pocket)|opening${MD_SP}(?:his|her|their|a)${MD_SP}(?:bag|kit|pack|pocket)|open${MD_SP}(?:his|her|their|a)${MD_SP}(?:bag|kit|pack|pocket)|` +
    `(?:manages?\\s+to|managed\\s+to|decides?\\s+to|decided\\s+to|tries\\s+to|tried\\s+to)(?:[^.!?\\n]{0,80}?\\b(?:and)\\s+)?\\s*(?:pull\\s+out|take\\s+out|reach|draw|open)`;

  const examVerbsPl =
    `(?:bada|badają|zbadał|zbadała|zbadali|zbadały|zbadać)${MD_SP}(?:rany|rannego|zwłoki|ciało|obrażenia|pacjenta|puls|oddech)|` +
    `badając${MD_SP}(?:rany|rannego|zwłoki|ciało|obrażenia|pacjenta|puls|oddech)|` +
    `opatruje|opatrują|opatrzył(?:a|i|y)?|opatrując|opatrzyć|` +
    `(?:zaczyna|zaczynają|zaczął|zaczęła|zaczęli|zaczęły)${MD_SP}opatrywać|` +
    `przystępuje${MD_SP}do${MD_SP}opatrywania|` +
    `reanimuje|reanimują|reanimował(?:a|i|y)?|reanimując|reanimować|` +
    `przeszukuje|przeszukują|przeszukał(?:a|i|y)?|przeszukując|przeszukać|` +
    `(?:ogląda|oglądają|obejrzał(?:a|i|y)?|obejrzeć)${MD_SP}(?:rany|obrażenia|zwłoki|ciało)|` +
    `oglądając${MD_SP}(?:rany|obrażenia|zwłoki|ciało)|` +
    `(?:udaje\\s+się|zdołał(?:a|i|y)?|zdoła(?:ją)?|postanawia|postanawiają|postanowił(?:a|i|y)?|próbuje|próbują|spróbował(?:a|i|y)?)(?:[^.!?\\n]{0,80}?\\b(?:i|oraz)\\s+)?\\s*(?:zbadać|opatrzyć|reanimować|przeszukać|obejrzeć)`;

  const examVerbsEn =
    `(?:examines?|examined|examining|examine)${MD_SP}(?:the${MD_SP})?(?:wounds|body|injured|corpse|pulse)|` +
    `(?:inspects?|inspected|inspecting|inspect)${MD_SP}(?:the${MD_SP})?(?:wounds|body|corpse)|` +
    `(?:treats?|treated|treating|treat)${MD_SP}(?:the${MD_SP})?(?:wounds|injured)|` +
    `(?:starts?|started|start)${MD_SP}bandaging|` +
    `(?:bandages?|bandaged|bandaging|bandage)${MD_SP}(?:the${MD_SP})?(?:wounds|injured)|` +
    `(?:searches?|searched|searching|search)${MD_SP}(?:the${MD_SP})?(?:desk|room|corpse|body)|` +
    `(?:checks?|checked|checking|check)${MD_SP}(?:the${MD_SP}|his${MD_SP}|her${MD_SP})?(?:pulse|wounds)|` +
    `(?:manages?\\s+to|managed\\s+to|decides?\\s+to|decided\\s+to|tries\\s+to|tried\\s+to)(?:[^.!?\\n]{0,80}?\\b(?:and)\\s+)?\\s*(?:examine|inspect|treat|bandage|search|check)`;

  const motorVerbsPl =
    `(?:chwyta|chwytają|chwycił(?:a|i)?)${MD_SP}za${MD_SP}(?:lejce|klamkę|broń)|` +
    `szarpie${MD_SP}za|szarpnął(?:a|i)?${MD_SP}za|pociąga${MD_SP}za|pociągnął(?:a|i)?${MD_SP}za|wyważa|wyważył(?:a|i)?|naciska${MD_SP}na${MD_SP}spust`;

  const motorVerbsEn =
    `(?:grabs?|grabbed|seizes?|seized)${MD_SP}(?:the${MD_SP})?(?:reins|handle|doorknob)|` +
    `(?:turns?|turned)${MD_SP}the${MD_SP}doorknob|` +
    `(?:forces?|forced)${MD_SP}the${MD_SP}door`;

  // 2. Akcje fizyczne przypisane konkretnemu badaczowi w zdaniach
  const sentenceSpans = splitIntoSentenceSpans(text);

  if (charPattern) {
    for (const span of sentenceSpans) {
      const sentenceText = span.text;
      const sentenceStart = span.start;

      // Szukaj wszystkich wystąpień badaczy w danym zdaniu
      const charInSentenceRegex = new RegExp(`(?<![\\p{L}\\p{N}])(${charPattern})(?![\\p{L}\\p{N}])`, 'gui');
      let charMatch: RegExpExecArray | null;

      while ((charMatch = charInSentenceRegex.exec(sentenceText)) !== null) {
        const charName = charMatch[1];
        const charIndexInSentence = charMatch.index;

        // Sprawdź czy badacz nie jest dopełnieniem w wyrażeniu przyimkowym (np. "podchodzi do Constance")
        const textBeforeChar = sentenceText.slice(0, charIndexInSentence);
        if (isPrepositionalObject(textBeforeChar)) {
          continue;
        }

        const afterCharIndex = charIndexInSentence + charMatch[0].length;
        const predicateText = sentenceText.slice(afterCharIndex);

        // Pomijamy jeśli bezpośrednio po imieniu występuje zwrot percepcyjny (badacz jest obserwatorem)
        if (PERCEPTION_REGEX.test(predicateText)) {
          continue;
        }

        const checkPredicates = [
          {
            type: 'movement' as AgencyViolationType,
            regex: new RegExp(`(?<![\\p{L}\\p{N}])(${isEn ? moveVerbsEn : moveVerbsPl})(?![\\p{L}\\p{N}])`, 'gui'),
            reason: (v: string) =>
              `Naruszenie Fizycznego Immunitetu: samowolne przemieszczenie badacza (${charName}: "${v}"). MG nie ma prawa poruszać postacią bez deklaracji.`,
          },
          {
            type: 'inventory' as AgencyViolationType,
            regex: new RegExp(`(?<![\\p{L}\\p{N}])(${isEn ? invVerbsEn : invVerbsPl})(?![\\p{L}\\p{N}])`, 'gui'),
            reason: (v: string) =>
              `Naruszenie Fizycznego Immunitetu: sięganie do ekwipunku badacza (${charName}: "${v}"). Tylko gracz zarządza swoim inwentarzem.`,
          },
          {
            type: 'examination' as AgencyViolationType,
            regex: new RegExp(`(?<![\\p{L}\\p{N}])(${isEn ? examVerbsEn : examVerbsPl})(?![\\p{L}\\p{N}])`, 'gui'),
            reason: (v: string) =>
              `Naruszenie Fizycznego Immunitetu: samowolne badanie ran/ciała przez badacza (${charName}: "${v}"). Wymaga wyraźnej deklaracji gracza.`,
          },
          {
            type: 'motorics' as AgencyViolationType,
            regex: new RegExp(`(?<![\\p{L}\\p{N}])(${isEn ? motorVerbsEn : motorVerbsPl})(?![\\p{L}\\p{N}])`, 'gui'),
            reason: (v: string) =>
              `Naruszenie Fizycznego Immunitetu: narzucenie motoryki ciała badacza (${charName}: "${v}").`,
          },
        ];

        for (const check of checkPredicates) {
          let pMatch: RegExpExecArray | null;
          while ((pMatch = check.regex.exec(predicateText)) !== null) {
            const globalOffset = sentenceStart + afterCharIndex + pMatch.index;
            const subClauseBefore = predicateText.slice(0, pMatch.index);

            // Sprawdź czy orzeczenie nie jest zanegowane
            if (isNegatedBefore(subClauseBefore)) {
              continue;
            }

            // Sprawdź czy między badaczem a orzeczeniem nie pojawił się inny podmiot (NPC)
            if (SUBORDINATE_NPC_BOUNDARY_REGEX.test(subClauseBefore)) {
              continue;
            }

            if(check.type==='movement'&&isDeclaredEntry(text,globalOffset,options,charName))continue;
            violations.push({
              characterName: charName,
              type: check.type,
              matchedSnippet: pMatch[0].trim(),
              reason: check.reason(pMatch[0].trim()),
              index: globalOffset,
            });
          }
        }
      }
    }
  }

  // 3. Naruszenia w 2. osobie (Solo i Hot Seat / Drużyna)
  const secondPersonMovePl =
    `podjeżdżacie${MD_SP}wozem|podjechaliście${MD_SP}wozem|` +
    `zeskakujesz(?:${MD_SP}(?:z|na)|\\b)|zeskakujecie(?:${MD_SP}(?:z|na)|\\b)|zeskoczyłeś(?:${MD_SP}(?:z|na)|\\b)|zeskoczyłaś(?:${MD_SP}(?:z|na)|\\b)|zeskoczyliście(?:${MD_SP}(?:z|na)|\\b)|` +
    `wsiadasz(?:${MD_SP}(?:do|na)|\\b)|wsiadacie(?:${MD_SP}(?:do|na)|\\b)|wsiadłeś(?:${MD_SP}(?:do|na)|\\b)|wsiadłaś(?:${MD_SP}(?:do|na)|\\b)|wsiedliście(?:${MD_SP}(?:do|na)|\\b)|` +
    `wysiadasz(?:${MD_SP}(?:z)|\\b)|wysiadacie(?:${MD_SP}(?:z)|\\b)|wysiadłeś(?:${MD_SP}(?:z)|\\b)|wysiadłaś(?:${MD_SP}(?:z)|\\b)|wysiedliście(?:${MD_SP}(?:z)|\\b)|` +
    `wchodzisz(?:${MD_SP}(?:do|w)|\\b)|wchodzicie(?:${MD_SP}(?:do|w)|\\b)|wszedłeś(?:${MD_SP}(?:do|w)|\\b)|weszłaś(?:${MD_SP}(?:do|w)|\\b)|weszliście(?:${MD_SP}(?:do|w)|\\b)|` +
    `podchodzisz(?:${MD_SP}do|\\b)|podchodzicie(?:${MD_SP}do|\\b)|podszedłeś(?:${MD_SP}do|\\b)|podeszłaś(?:${MD_SP}do|\\b)|podeszliście(?:${MD_SP}do|\\b)|` +
    `podbiegasz(?:${MD_SP}do|\\b)|podbiegacie(?:${MD_SP}do|\\b)|podbiegłeś(?:${MD_SP}do|\\b)|podbiegłaś(?:${MD_SP}do|\\b)|podbiegliście(?:${MD_SP}do|\\b)|` +
    `przekraczasz${MD_SP}próg|przekraczacie${MD_SP}próg|przekroczyłeś${MD_SP}próg|przekroczyłaś${MD_SP}próg|przekroczyliście${MD_SP}próg|` +
    `(?:udaje\\s+(?:ci|wam)\\s+się|zdołał(?:eś|aś|iście)|postanawiasz|postanawiacie|postanowił(?:eś|aś|iście)|próbujesz|próbujecie)(?:[^.!?\\n]{0,80}?\\b(?:i|oraz)\\s+)?\\s*(?:zeskoczyć|wsiąść|wysiąść|wejść|podbiec|pobiec|ruszyć|zbliżyć\\s+się|cofnąć\\s+się|wkroczyć|przekroczyć\\s+próg)`;

  const secondPersonMoveEn =
    `(?:you${MD_SP}|(?:and${MD_SP}))?(?:jump(?:ed)?${MD_SP}down|hop(?:ped)?${MD_SP}off|board(?:ed)?${MD_SP}the${MD_SP}wagon|enter(?:ed)?${MD_SP}the|step(?:ped)?${MD_SP}(?:into|inside)|walk(?:ed)?${MD_SP}into|approach(?:ed)?${MD_SP}the|` +
    `(?:manage(?:d)?\\s+to|decide(?:d)?\\s+to|tr(?:y|ied)\\s+to)(?:[^.!?\\n]{0,80}?\\b(?:and)\\s+)?\\s*(?:jump\\s+down|hop\\s+off|board|enter|approach|step|walk))`;

  function validateSecondPersonMatch(matchSnippet: string, textBeforeMatch: string): boolean {
    if (isNegatedBefore(textBeforeMatch)) {
      return false;
    }
    if (isEn && !/\byou\b/i.test(matchSnippet)) {
      const lastBoundary = Math.max(
        textBeforeMatch.lastIndexOf('.'),
        textBeforeMatch.lastIndexOf('\n'),
        textBeforeMatch.lastIndexOf(';')
      );
      const sentenceBefore = lastBoundary !== -1 ? textBeforeMatch.slice(lastBoundary) : textBeforeMatch;
      const hasYou = /\byou\b/i.test(sentenceBefore);
      const hasNpc = /\b(?:sheriff|driver|coachman|cultist|man|woman|officer|stranger|doctor|eleanor)\b/i.test(
        sentenceBefore
      );
      if (!hasYou || hasNpc) {
        return false;
      }
    }
    return true;
  }

  const secondPersonMoveRegex = new RegExp(
    `(?<![\\p{L}\\p{N}])(${isEn ? secondPersonMoveEn : secondPersonMovePl})(?![\\p{L}\\p{N}])`,
    'gui'
  );
  let match: RegExpExecArray | null;
  while ((match = secondPersonMoveRegex.exec(text)) !== null) {
    if (!validateSecondPersonMatch(match[0].trim(), text.slice(0, match.index))) {
      continue;
    }
    if(isDeclaredEntry(text,match.index,{...options,isDuet},undefined))continue;
    violations.push({
      type: 'movement',
      matchedSnippet: match[0].trim(),
      reason: `Naruszenie Fizycznego Immunitetu w 2. osobie: samowolne przemieszczenie ("${match[0]}"). MG nie decyduje o ruchu postaci.`,
      index: match.index,
    });
  }

  const secondPersonInvPl =
    `(?:wyciągasz|wyciągacie|wyciągnąłeś|wyciągnęłaś|wyciągnęliście)${MD_SP}(?:z|ze|swoją|swój|swoje|apteczkę|apteczki|broń|broni|rewolwer|rewolweru|pistolet|pistoletu|latarkę|latarki|notatnik|notatnika)|` +
    `(?:sięgasz|sięgacie|sięgnąłeś|sięgnęłaś|sięgnęliście)${MD_SP}(?:do|po)|` +
    `(?:wyjmujesz|wyjmujecie|wyjąłeś|wyjęłaś|wyjęliście)${MD_SP}(?:z|ze)|` +
    `(?:dobywasz|dobywacie|dobyłeś|dobyłaś|dobyliście)${MD_SP}(?:broni|rewolweru|miecza|sztyletu)|` +
    `(?:udaje\\s+(?:ci|wam)\\s+się|zdołał(?:eś|aś|iście)|postanawiasz|postanawiacie|postanowił(?:eś|aś|iście)|próbujesz|próbujecie)(?:[^.!?\\n]{0,80}?\\b(?:i|oraz)\\s+)?\\s*(?:wyciągnąć|wyjąć|sięgnąć|dobyć|schować|otworzyć|przeładować)`;

  const secondPersonInvEn =
    `(?:you${MD_SP}|(?:and${MD_SP}))?(?:pull(?:ed)?${MD_SP}out|reach(?:ed)?${MD_SP}(?:into|for)|dr(?:aw|ew)${MD_SP}(?:your|a)${MD_SP}(?:gun|weapon|revolver|blade|pistol)|t(?:ake|ook)${MD_SP}out${MD_SP}(?:your|a)|` +
    `(?:manage(?:d)?\\s+to|decide(?:d)?\\s+to|tr(?:y|ied)\\s+to)(?:[^.!?\\n]{0,80}?\\b(?:and)\\s+)?\\s*(?:pull\\s+out|take\\s+out|reach|draw))`;

  const secondPersonInvRegex = new RegExp(
    `(?<![\\p{L}\\p{N}])(${isEn ? secondPersonInvEn : secondPersonInvPl})(?![\\p{L}\\p{N}])`,
    'gui'
  );
  while ((match = secondPersonInvRegex.exec(text)) !== null) {
    if (!validateSecondPersonMatch(match[0].trim(), text.slice(0, match.index))) {
      continue;
    }
    violations.push({
      type: 'inventory',
      matchedSnippet: match[0].trim(),
      reason: `Naruszenie Fizycznego Immunitetu w 2. osobie: samowolne sięgnięcie do ekwipunku ("${match[0]}").`,
      index: match.index,
    });
  }

  const secondPersonExamPl =
    `(?:badasz|badacie|zbadałeś|zbadałaś|zbadaliście)${MD_SP}(?:rany|rannego|zwłoki|ciało|obrażenia|pacjenta|puls|oddech)|` +
    `opatrujesz|opatrujecie|opatrzyłeś|opatrzyłaś|opatrzyliście|` +
    `(?:zaczynasz|zaczynacie|zacząłeś|zaczęłaś|zaczęliście)${MD_SP}opatrywać|` +
    `przeszukujesz|przeszukujecie|przeszukałeś|przeszukałaś|przeszukaliście|` +
    `(?:udaje\\s+(?:ci|wam)\\s+się|zdołał(?:eś|aś|iście)|postanawiasz|postanawiacie|postanowił(?:eś|aś|iście)|próbujesz|próbujecie)(?:[^.!?\\n]{0,80}?\\b(?:i|oraz)\\s+)?\\s*(?:zbadać|opatrzyć|reanimować|przeszukać|obejrzeć)`;

  const secondPersonExamEn =
    `(?:you${MD_SP}|(?:and${MD_SP}))?(?:examine(?:d)?${MD_SP}(?:the${MD_SP})?(?:wounds|body|corpse|injured)|treat(?:ed)?${MD_SP}(?:the${MD_SP})?wounds|bandage(?:d)?${MD_SP}(?:the${MD_SP})?(?:wounds|injured)|search(?:ed)?${MD_SP}(?:the${MD_SP})?(?:desk|room)|check(?:ed)?${MD_SP}(?:the${MD_SP}|his${MD_SP}|her${MD_SP})?(?:pulse|wounds)|` +
    `(?:manage(?:d)?\\s+to|decide(?:d)?\\s+to|tr(?:y|ied)\\s+to)(?:[^.!?\\n]{0,80}?\\b(?:and)\\s+)?\\s*(?:examine|inspect|treat|bandage|search|check))`;

  const secondPersonExamRegex = new RegExp(
    `(?<![\\p{L}\\p{N}])(${isEn ? secondPersonExamEn : secondPersonExamPl})(?![\\p{L}\\p{N}])`,
    'gui'
  );
  while ((match = secondPersonExamRegex.exec(text)) !== null) {
    if (!validateSecondPersonMatch(match[0].trim(), text.slice(0, match.index))) {
      continue;
    }
    violations.push({
      type: 'examination',
      matchedSnippet: match[0].trim(),
      reason: `Naruszenie Fizycznego Immunitetu w 2. osobie: samowolne badanie/oględziny ("${match[0]}").`,
      index: match.index,
    });
  }

  const secondPersonMotorPl =
    `(?:chwytasz|chwytacie|chwyciłeś|chwyciłaś|chwyciliście)${MD_SP}za${MD_SP}(?:lejce|klamkę)|` +
    `(?:szarpiesz|szarpiecie|szarpnąłeś|szarpnęliście)${MD_SP}za${MD_SP}drzwi`;

  const secondPersonMotorEn =
    `(?:you${MD_SP}|(?:and${MD_SP}))?(?:grab(?:bed)?${MD_SP}(?:the${MD_SP})?reins|seiz(?:e|ed)${MD_SP}(?:the${MD_SP})?reins|turn(?:ed)?${MD_SP}(?:the${MD_SP})?doorknob)`;

  const secondPersonMotorRegex = new RegExp(
    `(?<![\\p{L}\\p{N}])(${isEn ? secondPersonMotorEn : secondPersonMotorPl})(?![\\p{L}\\p{N}])`,
    'gui'
  );
  while ((match = secondPersonMotorRegex.exec(text)) !== null) {
    if (!validateSecondPersonMatch(match[0].trim(), text.slice(0, match.index))) {
      continue;
    }
    violations.push({
      type: 'motorics',
      matchedSnippet: match[0].trim(),
      reason: `Naruszenie Fizycznego Immunitetu w 2. osobie: narzucenie motoryki ciała ("${match[0]}").`,
      index: match.index,
    });
  }

  const SECOND_PERSON_SPEECH_PL =
    'mówisz|mówicie|odpowiadasz|odpowiadacie|pytasz|pytacie|krzyczysz|krzyczycie|szepczesz|szepczecie|powiedziałeś|powiedziałaś|powiedzieliście|odpowiedziałeś|odpowiedziałaś|odpowiedzieliście|zapytałeś|zapytałaś|zapytaliście|krzyknąłeś|krzyknęłaś|krzyknęliście|szepnąłeś|szepnęłaś|szepnęliście';

  const secondPersonDialoguePl =
    `(?:${SECOND_PERSON_SPEECH_PL})\\s*[^:„"\\n]*:\\s*[„"][^”"\\n]+[”"]|` +
    `(?:^|\\n)\\s*[-—–]\\s*[^-—–\\n]+?\\s*[-—–]\\s*[*_]{0,3}(?:${SECOND_PERSON_SPEECH_PL})[*_]{0,3}(?![\\p{L}\\p{N}])`;

  const SECOND_PERSON_SPEECH_EN =
    'say|said|reply|replied|ask|asked|shout|shouted|whisper|whispered|speak|spoke|mutter|muttered|exclaim|exclaimed';

  const secondPersonDialogueEn =
    `(?:you${MD_SP})?(?:${SECOND_PERSON_SPEECH_EN})\\s*[^:\"'\n]*:\\s*["'][^"'\n]+["']|` +
    `(?:["'][^"'\n]+["']|(?:^|\\n)\\s*[-—–]\\s*[^-—–\\n]+?\\s*[-—–])\\s*[-—–,]?\\s*[*_]{0,3}(?:you${MD_SP})?(?:${SECOND_PERSON_SPEECH_EN})[*_]{0,3}(?![\\p{L}\\p{N}])`;

  const secondPersonDialogueRegex = new RegExp(
    `(?<![\\p{L}\\p{N}])(${isEn ? secondPersonDialogueEn : secondPersonDialoguePl})`,
    'gui'
  );
  while ((match = secondPersonDialogueRegex.exec(text)) !== null) {
    if (!validateSecondPersonMatch(match[0].trim(), text.slice(0, match.index))) {
      continue;
    }
    violations.push({
      type: 'dialogue',
      matchedSnippet: match[0].trim(),
      reason: `Naruszenie Fizycznego Immunitetu w 2. osobie: narzucenie kwestii dialogowej ("${match[0]}"). Gracz decyduje co mówi.`,
      index: match.index,
    });
  }

  if (violations.length === 0) {
    return { hasViolation: false, violations: [] };
  }

  // Usuń ewentualne duplikaty na tej samej pozycji
  const uniqueViolations: AgencyViolation[] = [];
  const seenKeys = new Set<string>();
  for (const v of violations) {
    const key = `${v.index}:${v.type}:${v.characterName || ""}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueViolations.push(v);
    }
  }

  uniqueViolations.sort((a, b) => a.index - b.index);

  const firstViolation = uniqueViolations[0];
  const truncationIndex = findSentenceBoundaryBefore(text, firstViolation.index, sentenceSpans);
  const sanitizedText = sanitizeTextAtBoundary(text, truncationIndex, isDuet, isEn);

  return {
    hasViolation: true,
    violations: uniqueViolations,
    suggestedTruncationIndex: truncationIndex,
    sanitizedText,
  };
}

/**
 * Wyszukuje granicę zdania tuż przed miejscem wystąpienia naruszenia.
 */
function findSentenceBoundaryBefore(
  text: string,
  index: number,
  spans?: SentenceSpan[]
): number {
  if (index <= 0) return 0;

  const effectiveSpans = spans ?? splitIntoSentenceSpans(text);

  // Znajdź span, w którym wystąpiło naruszenie
  for (const s of effectiveSpans) {
    if (index >= s.start && index <= s.end) {
      return s.start;
    }
  }

  // Fallback: szukaj ostatniej nowej linii lub kropki
  const candidateSub = text.slice(0, index);
  const lastDoubleNewline = candidateSub.lastIndexOf('\n\n');
  if (lastDoubleNewline !== -1) return lastDoubleNewline;

  const lastNewline = candidateSub.lastIndexOf('\n');
  if (lastNewline !== -1) return lastNewline;

  return 0;
}

/**
 * Ekstrahuje tagi systemowe z odciętej części, zachowując je w ostatecznej odpowiedzi.
 */
function extractTrailingTags(text: string): string[] {
  const trailingTags: string[] = [];

  // 1. Tagi sparowane: [DZIENNIK:...]...[/DZIENNIK], [JOURNAL:...]...[/JOURNAL], [KARTA_SCENY:...]...[/KARTA_SCENY]
  const pairedRegex = /\[(DZIENNIK|JOURNAL|KARTA_SCENY)(?::[^\]]*)?\][\s\S]*?\[\/\1\]/gi;
  let match: RegExpExecArray | null;

  while ((match = pairedRegex.exec(text)) !== null) {
    trailingTags.push(match[0]);
  }

  // 2. Tagi pojedyncze: [LOKACJA:...], [LOCATION:...], [OBECNI_NPC:...], [PRESENT_NPCS:...], [ZMIANA_SCENY], [SCENE_CHANGE], etc.
  const singleTagNames = [
    'AKTUALNY CZAS',
    'CURRENT TIME',
    'SFX',
    'SANITY',
    'HP',
    'LOKACJA',
    'LOCATION',
    'OBECNI_NPC',
    'PRESENT_NPCS',
    'ZMIANA_SCENY',
    'SCENE_CHANGE',
    'NPC',
    'PRZEDMIOT',
    'ITEM',
    'ZDOBYTY_PRZEDMIOT',
    'ZAGROŻENIE',
    'HAZARD',
    'WETO_SEDZIEGO',
    'REFEREE_VETO',
    'GAME_OVER',
    'NASTRÓJ',
    'CEL_NARRACYJNY',
    'MYŚLI_MG',
    'OBSERWACJA',
    'OBSERVATION',
    'CZAR',
    'SPELL',
    'OBRONA_MAGIA',
    'OPPOSED_MAGIC',
    'WALKA_ATAK',
    'OBRONA_WALKA',
    'OPPOSED_MELEE',
    'MAGIA_SPONTANICZNA',
    'SPONTANEOUS_MAGIC',
  ];
  const singleRegex = new RegExp(`\\[(${singleTagNames.join('|')})(?::[^\\]]*)?\\]`, 'gi');
  while ((match = singleRegex.exec(text)) !== null) {
    trailingTags.push(match[0]);
  }

  return trailingTags;
}

/**
 * Ucina tekst przed naruszeniem i zamyka go czysto markerem [Co robisz?] / [Co robicie?].
 */
function sanitizeTextAtBoundary(
  text: string,
  cutoffIndex: number,
  isDuet: boolean,
  isEn: boolean
): string {
  const questionMarker = isEn
    ? (isDuet ? '[What do you all do?]' : '[What do you do?]')
    : (isDuet ? '[Co robicie?]' : '[Co robisz?]');

  let baseText = text.slice(0, cutoffIndex).trimEnd();
  baseText = baseText.replace(/[—–,:]\s*$/, '').trimEnd();

  const trailingTags = extractTrailingTags(text.slice(cutoffIndex));
  const timeTag = trailingTags.find(
    (t) => t.includes('AKTUALNY CZAS') || t.includes('CURRENT TIME')
  );
  const otherSafeTags = trailingTags.filter(
    (t) =>
      !t.includes('AKTUALNY CZAS') &&
      !t.includes('CURRENT TIME') &&
      !baseText.includes(t)
  );

  const alreadyHasQuestion = /\[(Co robisz\?|Co robicie\?|What do you do\?|What do you all do\?)\]\s*$/i.test(baseText);

  if (!baseText) {
    baseText = isEn
      ? `You stand on the threshold, taking in your surroundings.`
      : (isDuet
          ? `Stoicie na progu zdarzenia, obserwując otoczenie.`
          : `Stoisz na progu zdarzenia, obserwując otoczenie.`);
  } else if (!alreadyHasQuestion && !/[.!?…\]]$/.test(baseText)) {
    baseText += '.';
  }

  let result = alreadyHasQuestion ? baseText : `${baseText}\n\n${questionMarker}`;

  if (otherSafeTags.length > 0) {
    result += `\n\n${otherSafeTags.join('\n')}`;
  }
  if (timeTag) {
    result += `\n\n${timeTag}`;
  }

  return result;
}

/**
 * Zwraca oczyszczony tekst jeśli wykryto jakiekolwiek naruszenie sprawczości.
 */
export function sanitizeAgencyViolations(
  text: string,
  investigatorNames: string[] = [],
  options: AgencyLintOptions = {}
): string {
  const lintResult = lintAgencyViolations(text, investigatorNames, options);
  if (!lintResult.hasViolation || !lintResult.sanitizedText) {
    return text;
  }
  return lintResult.sanitizedText;
}

/**
 * Buforuje i agreguje chunki ze strumienia dostawcy modelu, zwracając tablicę chunków i pełen tekst.
 */
export async function collectStreamChunks(
  stream: AsyncIterable<StreamChunk>
): Promise<{ chunks: StreamChunk[]; fullText: string }> {
  const chunks: StreamChunk[] = [];
  let fullText = '';
  try {
    for await (const chunk of stream) {
      chunks.push(chunk);
      if (chunk.text) {
        fullText += chunk.text;
      }
    }
  } catch (err) {
    if (chunks.length === 0) {
      throw err;
    }
    console.warn('⚠️ Strumień dostawcy został przerwany w trakcie, kontynuacja z zebranymi chunkami:', err);
  }
  return { chunks, fullText };
}

/**
 * Konwertuje tablicę chunków na AsyncGenerator zgodny z interfejsem SSE stream.
 */
export async function* chunksToAsyncStream(
  chunks: StreamChunk[]
): AsyncGenerator<StreamChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
}
