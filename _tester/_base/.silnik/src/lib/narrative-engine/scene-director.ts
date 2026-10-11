/**
 * Dynamiczny Reżyser Pacingu i Selektor Technik (Scene Director & Technique Dispatcher)
 *
 * Odpowiada za:
 * 1. Hybrydową klasyfikację stanu sceny na CPU (reguły deklaracji gracza + pamięć poprzedniego stanu).
 * 2. Dynamiczny dobór 1-2 technik z Kodeksu Technik MG (#535) z rotacją cooldownu (żadna technika 2 tury z rzędu).
 * 3. Nastrojowe sugestie pacingu i dynamiki narracji (pozostawiając modelowi pełną swobodę objętościową).
 *
 * @module narrative-engine/scene-director
 */

import {
  getTechniquesForSceneState,
  getTechniqueDirective,
  getTechnique,
} from './techniques/playbook';
import type {
  TechniqueDefinition,
  TechniqueId,
  SceneState,
  CadenceGear,
  Locale,
} from './techniques/types';

export interface SceneContext {
  playerMessage?: string | null;
  previousSceneState?: SceneState | null;
  isInCombat?: boolean;
  hasChaseContext?: boolean;
  hasSanityLossOrRoll?: boolean;
  hasOccultElements?: boolean;
  npcsPresent?: boolean;
  npcs?: Array<{ id?: string; name: string }>;
  currentLocation?: string | null;
  locationChanged?: boolean;
  turnIndex?: number;
  ordinaryWorldInterrupted?: boolean;
}

export interface TechniqueSelectionParams {
  turnIndex?: number;
  ordinaryWorldInterrupted?: boolean;
  sceneState: SceneState;
  recentTechniqueIds?: TechniqueId[];
  playerMessage?: string | null;
  hasNPCInteraction?: boolean;
  hasDirectDanger?: boolean;
  isCosmicHorror?: boolean;
  isLocationTransition?: boolean;
}

export interface SceneTechniqueSelection {
  sceneState: SceneState;
  cadenceGear: CadenceGear;
  primaryTechnique: TechniqueDefinition;
  secondaryTechnique?: TechniqueDefinition;
  pacingMoodSuggestion: {
    pl: string;
    en: string;
  };
}

/**
 * Hybrydowa klasyfikacja stanu sceny na CPU
 * Łączy natychmiastową analizę intencji gracza i flag mechanicznych z pamięcią poprzedniego stanu.
 */
export function determineSceneState(context: SceneContext): SceneState {
  const rawMsg = (context.playerMessage ?? '').trim().toLowerCase();

  // 1. Akcja fizyczna / walka / pościg (najwyższy priorytet mechaniczny)
  if (context.isInCombat || context.hasChaseContext) {
    return 'action';
  }

  const isActionIntent =
    /\b(strzel|atakuj|bij|uderz|uciek|biegn|bieg|szarż|szarz|rzucam się|rzucam sie|walcz|zasłan|zaslan|unik|przeładow|przeladow|shoot|attack|hit|strike|flee|run|charge|fight|dodge|reload)[a-ząćęłńóśźż]*/i.test(
      rawMsg
    );
  if (isActionIntent) {
    return 'action';
  }

  // 2. Skok napięcia / zagrożenie bezpośrednie / utrata SAN
  if (context.hasSanityLossOrRoll) {
    return 'tension_spike';
  }

  const isPanicOrAmbush =
    /\b(panik|krzyk|pułapk|pulapk|zasadzk|alarm|kryj się|kryj sie|pomocy|dopada mnie|wpadam w panikę|panic|scream|trap|ambush|alarm|help|take cover)[a-ząćęłńóśźż]*/i.test(
      rawMsg
    );
  if (isPanicOrAmbush) {
    return 'tension_spike';
  }

  // 3. Objawienie zgrozy kosmicznej / okultyzm
  const isEldritchIntent =
    /\b(dagon|cthulhu|bóstw|bostw|mack[ai]|anomali|nieeuklidesow|obłęd|obled|szaleństw|szalenstw|monstrum|potwór|potwor|rytuał|rytual|czar|inkantacj|eldritch|mythos|abyss|insanity|cosmic|entity|tentacle)[a-ząćęłńóśźż]*/i.test(
      rawMsg
    );
  if (Boolean(context.hasOccultElements && isEldritchIntent)) {
    return 'abyssal_reveal';
  }

  // 4. Dialog / interakcja z NPC (Issue #546: ulepszona detekcja pytań, cudzysłowów i wołaczy NPC)
  const isExplicitSocialVerb =
    /\b(mówi|mowie|rozmawia|pyta|szept|krzycz|zagad|odpowiada|tłumacz|tlumacz|błaga|blaga|negocj|przekon|grozi|panie|pani|dzień dobry|dzien dobry|cześć|czesc|witam|wypytuj|talk|speak|ask|whisper|shout|tell|interrogate|greet|inquire)[a-ząćęłńóśźż]*/i.test(
      rawMsg
    );

  const hasQuestion = /[?？]/.test(rawMsg);
  const hasDialogueFormatting =
    /^[ \t]*["„»“”‘'-]/.test(rawMsg) ||
    /["„»“”‘][^"”»“”’]+["”»“”’]/.test(rawMsg);

  const isInvestigativeOnly =
    /\b(szukam|badam|przeszukuj|oglądam|ogladam|czytam|otwieram|rozglądam|rozgladam|search|inspect|examine|read|open|look around)\b/i.test(
      rawMsg
    );

  const mentionsNpcStem = (() => {
    if (!context.npcsPresent) return false;
    if (context.npcs && context.npcs.length > 0) {
      return context.npcs.some((npc) => {
        const parts = npc.name.toLowerCase().split(/\s+/).filter((p) => p.length >= 3);
        return parts.some((p) => {
          if (rawMsg.includes(p)) return true;
          const stem = p.length >= 4 ? p.slice(0, 4) : p;
          return stem.length >= 4 && rawMsg.includes(stem);
        });
      });
    }
    // Popularne polskie wołacze i zdrobnienia obecnych towarzyszy / postaci
    return /\b(waldek|waldku|piotrek|piotrze|kasiu|kasia|doktorze|profesorze|januszu|janusz)\b/i.test(rawMsg);
  })();

  const isDialogueIntent =
    isExplicitSocialVerb ||
    (context.npcsPresent && (mentionsNpcStem || hasDialogueFormatting || (hasQuestion && !isInvestigativeOnly)));

  if (context.npcsPresent && isDialogueIntent) {
    return 'dialogue';
  }

  // 5. Pamięć stanu z poprzedniej tury (Smooth Pacing Continuity)
  if (context.previousSceneState === 'dialogue' && context.npcsPresent) {
    // Jeśli gracz kontynuuje wypowiedź w obecności NPC bez deklaracji badania lub walki
    if (!isInvestigativeOnly) {
      return 'dialogue';
    }
  }

  if (context.previousSceneState === 'action' && !rawMsg) {
    // Cisza w trakcie walki utrzymuje napięcie
    return 'tension_spike';
  }

  // 6. Domyślny stan śledztwa i eksploracji
  return 'investigation';
}

/**
 * Zwraca sugestię nastroju sceny z zachowaniem pełnej swobody objętościowej modelu
 */
export function getPacingMoodSuggestion(state: SceneState): {
  pl: string;
  en: string;
} {
  switch (state) {
    case 'action':
      return {
        pl: 'Nastrój akcji: dynamiczny rytm, wysoka presja bezpośredniego zagrożenia, ostre reakcje świata.',
        en: 'Action mood: dynamic rhythm, high immediate threat pressure, sharp world reactions.',
      };
    case 'dialogue':
      return {
        pl: 'Nastrój dialogu (Zasada Dialog-First): natychmiastowa odpowiedź NPC na początku posta (max 1 zwięzły gest), skupienie na intencji rozmówcy i tarciu społecznym bez zbędnych wstępów sensorycznych.',
        en: 'Dialogue mood (Dialog-First Rule): immediate NPC response at the beginning of the post (max 1 concise gesture), focus on speaker intent and social friction without redundant environmental sensory preambles.',
      };
    case 'tension_spike':
      return {
        pl: 'Nastrój zagrożenia: narastający niepokój, niepewność i wyczekiwanie na zbliżający się cios.',
        en: 'Tension spike mood: rising dread, uncertainty, and anticipation of the impending strike.',
      };
    case 'abyssal_reveal':
      return {
        pl: 'Nastrój grozy kosmicznej: zderzenie z nienazwanym, deficyt racjonalnych punktów odniesienia, chłód i pustka.',
        en: 'Abyssal reveal mood: collision with the unnameable, deficit of rational reference points, coldness and the void.',
      };
    case 'investigation':
    default:
      return {
        pl: 'Nastrój śledztwa: analityczna uwaga, wyrazisty detal otoczenia i logiczne łączenie poszlak.',
        en: 'Investigation mood: analytical attentiveness, evocative environmental detail, and logical clue synthesis.',
      };
  }
}

/**
 * Przypisuje dominujący bieg kadencji do stanu sceny
 */
/** Explicit player declarations, not NPC speech, movement or a mention of weapons. */
export function isPlayerAggression(message: string): boolean {
  const declaration = message.toLowerCase().replace(/"[^"]*"|„[^”]*”/g, '');
  const clauses = declaration.split(/[,.!?;\n]|\b(?:ale|but)\b/);
  return clauses.some((clause) => {
    if (/\b(?:nie|don't|do not|won't|will not|czy|pytam|ask|if)\b/.test(clause))
      return false;
    return (
      /\b(?:strzelam|strzelę|strzele|atakuję|atakuje|uderzam|biję|bije|wyważam|wywazam|oddaję strzał|oddaje strzal)(?=$|[^a-ząćęłńóśźż])/.test(
        clause
      ) ||
      /\bi\s+(?:shoot|fire|attack|hit|strike|punch|kick down|break down|force open)\b/.test(
        clause
      )
    );
  });
}

export function getCadenceForSceneState(
  state: SceneState,
  context: SceneContext = {}
): CadenceGear {
  if (isPlayerAggression(context.playerMessage ?? '')) return 3;
  if (
    context.turnIndex !== undefined &&
    context.turnIndex >= 0 &&
    context.turnIndex < 6 &&
    !context.ordinaryWorldInterrupted
  )
    return 0;
  switch (state) {
    case 'action':
      return 1; // Staccato
    case 'dialogue':
      return 1; // Ping-Pong
    case 'tension_spike':
      return 3; // Przełamanie / Cios
    case 'abyssal_reveal':
      return 4; // Zawieszenie / Pustka
    case 'investigation':
    default:
      return 2; // Szeroki Kadr
  }
}

/**
 * Selekcjoner technik z puli stanu sceny z rotacją cooldownu (anty-powtórzenia)
 */
export function selectSceneTechniques(
  params: TechniqueSelectionParams
): SceneTechniqueSelection {
  const candidateTechniques = getTechniquesForSceneState(params.sceneState);
  const recentSet = new Set(params.recentTechniqueIds ?? []);

  // 1. Filtruj kandydatów wolnych od natychmiastowego cooldownu
  let available = candidateTechniques.filter((t) => !recentSet.has(t.id));

  // Fallback: jeśli wszystkie techniki ze stanu były niedawno użyte, odblokuj pełną pulę
  if (available.length === 0) {
    available = candidateTechniques;
  }

  // 2. Punktacja heurystyczna w zależności od kontekstu deklaracji
  const scored = available.map((tech) => {
    let score = 1.0;
    const rawMsg = (params.playerMessage ?? '').toLowerCase();

    // Preferencje dla dialogu
    if (params.sceneState === 'dialogue') {
      if (tech.id === 'social_leverage' && /\b(chcę|daj|powiedz|żądam|pieniądze|informacj|want|give|tell|demand)\b/i.test(rawMsg)) {
        score += 3.0;
      }
      if (tech.id === 'prep_situations' && /\b(ugoda|frakcj|stron|konflikt|dlaczego|kto za tym stoi|faction|side|deal|who is behind)\b/i.test(rawMsg)) {
        score += 3.5;
      }
      if (tech.id === 'distinct_voice') {
        score += 2.0;
      }
      if (tech.id === 'agenda_first') {
        score += 2.5;
      }
    }

    // Preferencje dla akcji
    if (params.sceneState === 'action') {
      if (tech.id === 'bang_hard_move' && params.hasDirectDanger) {
        score += 3.0;
      }
      if (tech.id === 'cut_to_action') {
        score += 2.5;
      }
      if (tech.id === 'value_charge_shift') {
        score += 2.0;
      }
      if (tech.id === 'referee_veto' && /\b(skaczę z dachu|zabijam jednym ciosem|nieśmierteln)\b/i.test(rawMsg)) {
        score += 5.0;
      }
    }

    // Preferencje dla śledztwa
    if (params.sceneState === 'investigation') {
      if (tech.id === 'exposition_through_action' && /\b(artykuł|gazet|archiwum|wycinek|mikrofilm|kronik|rejestr|księg|tomy|czytam|kwerend|newspaper|archive|clipping|record|ledger|book|read)\b/i.test(rawMsg)) {
        score += 4.5;
      }
      if (tech.id === 'threshold_shift' && params.isLocationTransition) {
        score += 4.0;
      }
      if (tech.id === 'cognitive_anchor' && /\b(list|papier|biurko|szuflada|monogram|symbol|ślad)\b/i.test(rawMsg)) {
        score += 3.0;
      }
      if (tech.id === 'value_charge_shift' && /\b(utknąłem|co teraz|brak tropu|rozczarowani|sukces|przełom|stuck|dead end|now what)\b/i.test(rawMsg)) {
        score += 3.5;
      }
      if (tech.id === 'three_clue_rule') {
        score += 2.0;
      }
      if (tech.id === 'single_sensory_anchor') {
        score += 1.5;
      }
    }

    // Preferencje dla grozy kosmicznej
    if (params.sceneState === 'abyssal_reveal') {
      if (tech.id === 'vacuum_variable') {
        score += 3.5;
      }
      if (tech.id === 'value_charge_shift') {
        score += 2.5;
      }
    }

    // Preferencje dla skoku napięcia
    if (params.sceneState === 'tension_spike') {
      if (tech.id === 'soft_move') {
        score += 2.5;
      }
      if (tech.id === 'value_charge_shift') {
        score += 3.0;
      }
      if (tech.id === 'vacuum_variable') {
        score += 2.0;
      }
    }

    return { tech, score };
  });

  // Sortuj malejąco wg trafności
  scored.sort((a, b) => b.score - a.score);

  const primaryTechnique = scored[0]?.tech ?? candidateTechniques[0];

  // 3. Wybór techniki wspomagającej (Secondary) - z innej kategorii, jeśli dostępna
  let secondaryTechnique: TechniqueDefinition | undefined;
  for (let i = 1; i < scored.length; i++) {
    const candidate = scored[i].tech;
    if (candidate.category !== primaryTechnique.category) {
      secondaryTechnique = candidate;
      break;
    }
  }

  return {
    sceneState: params.sceneState,
    cadenceGear: getCadenceForSceneState(params.sceneState, params),
    primaryTechnique,
    secondaryTechnique,
    pacingMoodSuggestion: getPacingMoodSuggestion(params.sceneState),
  };
}

export interface CadenceWordBudget {
  min: number;
  max: number;
  description: {
    pl: string;
    en: string;
  };
}

/**
 * Zwraca twarde widełki budżetu słów per Bieg Kadencji (Issue #757)
 */
export function getCadenceWordBudget(gear: CadenceGear): CadenceWordBudget {
  switch (gear) {
    case 0:
      return {
        min: 120,
        max: 190,
        description: {
          pl: 'Bieg 0: Otwarcie Przygody / Szeroki Kadr Otwarcia (120-190 słów)',
          en: 'Gear 0: Adventure Opening / Broad Framing (120-190 words)',
        },
      };
    case 1:
      return {
        min: 25,
        max: 60,
        description: {
          pl: 'Bieg 1: Ping-Pong / Dialog / Szybka akcja (25-60 słów; max 60 słów w dialogu)',
          en: 'Gear 1: Ping-Pong / Dialogue / Fast action (25-60 words; max 60 words in dialogue)',
        },
      };
    case 2:
      return {
        min: 90,
        max: 150,
        description: {
          pl: 'Bieg 2: Szeroki Kadr / Śledztwo / Nowa lokacja (90-150 słów)',
          en: 'Gear 2: Broad Shot / Investigation / New location (90-150 words)',
        },
      };
    case 3:
      return {
        min: 30,
        max: 55,
        description: {
          pl: 'Bieg 3: Przełamanie / Cios / Zagrożenie (30-55 słów)',
          en: 'Gear 3: Breakthrough / Strike / Threat (30-55 words)',
        },
      };
    case 4:
    default:
      return {
        min: 40,
        max: 80,
        description: {
          pl: 'Bieg 4: Zawieszenie / Pustka / Szok (40-80 słów)',
          en: 'Gear 4: Suspension / Void / Shock (40-80 words)',
        },
      };
  }
}

/**
 * Formatuje zwięzłą dyrektywę promptową Reżysera Sceny dla Gemini (Issue #757)
 */
export function formatSceneDirective(
  selection: SceneTechniqueSelection,
  locale: Locale = 'pl'
): string {
  const isPl = locale === 'pl';
  const stateLabel = isPl ? 'Stan Sceny' : 'Scene State';
  const cadenceLabel = isPl ? 'Bieg Kadencji' : 'Cadence Gear';
  const moodLabel = isPl ? 'Rytm Narracji' : 'Narrative Rhythm';
  const mood = isPl
    ? selection.pacingMoodSuggestion.pl
    : selection.pacingMoodSuggestion.en;

  const budget = getCadenceWordBudget(selection.cadenceGear);
  const budgetDesc = isPl ? budget.description.pl : budget.description.en;

  const primaryName = isPl
    ? selection.primaryTechnique.name.pl
    : selection.primaryTechnique.name.en;
  const primaryDir = getTechniqueDirective(
    selection.primaryTechnique.id,
    locale
  );

  const wordLimitDirective = isPl
    ? `[LIMIT_SŁÓW: ${budget.min}-${budget.max} słów | ${budgetDesc}]`
    : `[WORD_LIMIT: ${budget.min}-${budget.max} words | ${budgetDesc}]`;

  const asymmetryDirective = isPl
    ? `[KSIĄŻKOWA_ASYMETRIA: Bezwzględny zakaz monotonnych, symetrycznych akapitów o równej liczbie zdań (kopyto AI). Wymóg naturalnej zmienności rytmu powieściowego: kontrastuj krótki, uderzeniowy akapit (1-2 zdania) z akapitem opisowym lub zwięzłą ripostą NPC bez zbędnych wstępów.]`
    : `[BOOK_ASYMMETRY: Strictly forbid monotonous, symmetrical paragraphs of equal length (AI pattern). Enforce natural novelistic rhythm variation: contrast a punchy short paragraph (1-2 sentences) with descriptive detail or a concise NPC response without redundant preambles.]`;

  const activePassengerDirective = isPl
    ? `[ZASADA_AKTYWNEGO_PASAŻERA: Bezwzględny zakaz monologów ekspozycyjnych NPC dłuższych niż 2-3 zdania bez oddania głosu graczowi. W scenach podróży i przemieszczania ZAKAZ streszczania całej trasy w jednym poście - zatrzymaj akcję na progu mikrodecyzji lub reakcji otoczenia (spojrzenie w lusterko, deszcz za szybą, korek) z pytaniem [Co robisz?].]`
    : `[ACTIVE_PASSENGER_RULE: Strictly forbid NPC exposition monologues longer than 2-3 sentences without handing the turn back to the player. In travel and transit scenes, NEVER summarize the entire journey in a single post - pause the action at a micro-decision threshold or environmental cue (mirror glance, rain against the window, traffic) with the prompt [What do you do?].]`;

  let directiveStr = isPl
    ? `[REŻYSER_SCENY: ${stateLabel}: ${selection.sceneState} | ${cadenceLabel}: ${selection.cadenceGear} | ${moodLabel}: ${mood}]\n` +
      `${wordLimitDirective}\n` +
      `${asymmetryDirective}\n` +
      `${activePassengerDirective}\n` +
      `[TECHNIKA_MG: ${primaryName}] ${primaryDir}`
    : `[SCENE_DIRECTOR: ${stateLabel}: ${selection.sceneState} | ${cadenceLabel}: ${selection.cadenceGear} | ${moodLabel}: ${mood}]\n` +
      `${wordLimitDirective}\n` +
      `${asymmetryDirective}\n` +
      `${activePassengerDirective}\n` +
      `[GM_TECHNIQUE: ${primaryName}] ${primaryDir}`;

  if (selection.secondaryTechnique) {
    const secName = isPl
      ? selection.secondaryTechnique.name.pl
      : selection.secondaryTechnique.name.en;
    const secDir = getTechniqueDirective(
      selection.secondaryTechnique.id,
      locale
    );
    directiveStr += isPl
      ? `\n[TECHNIKA_WSPOMAGAJĄCA: ${secName}] ${secDir}`
      : `\n[SUPPORTING_TECHNIQUE: ${secName}] ${secDir}`;
  }

  // Issue #546 & #757: Żelazna dyrektywa Dialog-First dla scen dialogowych z limitem do 60 słów
  if (selection.sceneState === 'dialogue') {
    directiveStr += isPl
      ? '\n[ZASADA DIALOG-FIRST: Odpowiedź NPC musi paść NATYCHMIAST na początku Twojego posta (max 1 zwięzły mikrogest przed wypowiedzią). ZAKAZ otwierania tury od wieloakapitowych opisów zapachów, mebli, kurzu czy atmosfery pomieszczenia. Twardy limit wypowiedzi NPC: do 60 słów.]'
      : '\n[DIALOG-FIRST RULE: The NPC response must appear IMMEDIATELY at the start of your post (max 1 concise micro-gesture before dialogue). FORBIDDEN: Opening the post with descriptive paragraphs about environmental smells, furniture, dust, or room atmosphere. Hard limit on NPC speech: up to 60 words.]';
  }

  return directiveStr;
}

/** A continuation resumes an existing response; a history slice is not a new adventure. */
export function getNarrativeTurnCadence(
  state: SceneState,
  playerMessage: string,
  messages: ReadonlyArray<{
    role: string;
    content: string;
    continuationRequested?: boolean;
  }>
): CadenceGear | undefined {
  if (messages.length === 1 && messages[0].continuationRequested) return undefined;
  return getCadenceForSceneState(state, {
    playerMessage,
    turnIndex: messages.filter((message) => message.role === 'assistant')
      .length,
    ordinaryWorldInterrupted: messages.some(
      (message) =>
        message.role === 'user' && isPlayerAggression(message.content)
    ),
  });
}
