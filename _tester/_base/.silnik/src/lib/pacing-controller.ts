/**
 * Pacing Controller - Matryca 4 Biegów Kadencji (Dynamic Cadence)
 *
 * Zapobiega zjawisku Narrative Cold Death i habituacji sensorycznej.
 * Zamiast jednego powtarzalnego schematu tury, generuje dynamiczne
 * dyrektywy pacingu oparte na 4 Biegach Kadencji:
 * - Bieg 1: Ping-Pong (Staccato / Dialog)
 * - Bieg 2: Szeroki Kadr (Establishing Shot)
 * - Bieg 3: Przełamanie / Cios (Hard Move & Fail-Forward)
 * - Bieg 4: Zawieszenie / Pustka (The Void & Vacuum Variable)
 */

import type { GameContext } from './prompt-section-parser';

export type CadenceGear = 'ordinary_world' | 'staccato' | 'establishing' | 'hard_move' | 'void';

interface PacingConfig {
  gear: CadenceGear;
  tempo: 'fast' | 'normal' | 'slow';
  wordRange: [number, number];
  directivePl: string;
  directiveEn: string;
}

const PACING_MAP: Record<GameContext['mode'], PacingConfig> = {
  combat: {
    gear: 'hard_move',
    tempo: 'fast',
    wordRange: [30, 70],
    directivePl: 'BIEG 3 (PRZEŁAMANIE / WALKA): do 30-70 słów. Krótkie, urwane zdania. Czysta akcja, bezpośrednie zagrożenie. Świat uderza bez pytania.',
    directiveEn: 'GEAR 3 (HARD MOVE / COMBAT): up to 30-70 words. Short, terse sentences. Pure action, immediate threat. The world strikes without asking.',
  },
  chase: {
    gear: 'hard_move',
    tempo: 'fast',
    wordRange: [30, 70],
    directivePl: 'BIEG 3 (PRZEŁAMANIE / POŚCIG): do 30-70 słów. Dynamika, oddech, pośpiech, nagłe przeszkody terenowe.',
    directiveEn: 'GEAR 3 (HARD MOVE / CHASE): up to 30-70 words. Momentum, breathless haste, sudden terrain obstacles.',
  },
  exploration: {
    gear: 'establishing',
    tempo: 'normal',
    wordRange: [70, 150],
    directivePl: 'BIEG 2 (SZEROKI KADR / EKSPLORACJA): 70-150 słów. Realizm topograficzny, 2-3 zmysły, jeden niepokojący detal anomalii.',
    directiveEn: 'GEAR 2 (ESTABLISHING SHOT / EXPLORATION): 70-150 words. Topographical realism, 2-3 senses, one unsettling anomaly detail.',
  },
  investigation: {
    gear: 'establishing',
    tempo: 'normal',
    wordRange: [60, 140],
    directivePl: 'BIEG 2 (SZEROKI KADR / ŚLEDZTWO): 60-140 słów. Wskazówki materialne wplecione w przestrzeń (Fair Play), zwięzłość.',
    directiveEn: 'GEAR 2 (ESTABLISHING SHOT / INVESTIGATION): 60-140 words. Tangible clues embedded in setting (Fair Play), concise.',
  },
  social: {
    gear: 'staccato',
    tempo: 'fast',
    wordRange: [20, 60],
    directivePl: 'BIEG 1 (PING-PONG / DIALOG): 20-60 słów (1-2 zdania). Cięta replika NPC, podwójna maska (fasada vs skaza). ZAKAZ powtórnego opisywania tła.',
    directiveEn: 'GEAR 1 (PING-PONG / DIALOGUE): 20-60 words (1-2 sentences). Sharp NPC reply, dual mask (facade vs flaw). FORBIDDEN to re-describe scenery.',
  },
  dream: {
    gear: 'establishing',
    tempo: 'slow',
    wordRange: [120, 220],
    directivePl: 'BIEG 2 (SZEROKI KADR / ONIRYZM): 120-220 słów. Hipnotyczny, zmysłowy opis sprzecznej geometrii i odrealnienia.',
    directiveEn: 'GEAR 2 (ESTABLISHING SHOT / ONIRISM): 120-220 words. Hypnotic, sensory description of contradictory geometry and derealization.',
  },
  ritual: {
    gear: 'establishing',
    tempo: 'slow',
    wordRange: [120, 220],
    directivePl: 'BIEG 2 (SZEROKI KADR / RYTUAŁ): 120-220 słów. Narastający chłód, dźwięk akuzmatyczny, ceremonialna groza.',
    directiveEn: 'GEAR 2 (ESTABLISHING SHOT / RITUAL): 120-220 words. Deepening chill, acousmatic sound, ceremonial dread.',
  },
};

const VOID_CONFIG: PacingConfig = {
  gear: 'void',
  tempo: 'slow',
  wordRange: [40, 90],
  directivePl: 'BIEG 4 (ZAWIESZENIE / PUSTKA): 40-90 słów. Cisza po szoku, somatyczne odruchy ciała, zmienna próżni (brakujący element), chłodne zdania.',
  directiveEn: 'GEAR 4 (THE VOID / POST-SHOCK): 40-90 words. Silence after shock, somatic body reflexes, vacuum variable (missing element), cold sentences.',
};

const PULP_SANITY_RUSH_CONFIG: PacingConfig = {
  gear: 'hard_move',
  tempo: 'fast',
  wordRange: [30, 70],
  directivePl: 'BIEG 3 (SZOK ADRENALINY / PULP SANITY RUSH): 30-70 słów. Utrata Poczytalności wyzwala heroiczny szał, brawurowy zryw lub nagłą manię walki. Czyste działanie pod wpływem adrenaliny!',
  directiveEn: 'GEAR 3 (ADRENALINE RUSH / PULP SANITY RUSH): 30-70 words. Sanity loss triggers heroic rage, reckless bravado, or sudden action mania. Pure adrenaline-fueled momentum!',
};

/**
 * Generuje dyrektywę tempa narracji na podstawie kontekstu gry i Matrycy 4 Biegów.
 *
 * Modyfikatory:
 * - recentSANLoss → Bieg 4 (Pustka / The Void) lub Bieg 3 (Pulp Sanity Rush w pulpie)
 * - nightTime → +15% do limitu słów
 * - isStuck → War-room bodziec zewnętrzny / Prawo Chandlera w pulpie
 */
export function getPacingDirective(
  context: GameContext,
  locale: 'pl' | 'en' = 'pl'
): string {
  const isEn = locale === 'en';
  const isPulp = context.rulesetVariant === 'pulp' || context.tone === 'pulp';
  let config = PACING_MAP[context.mode];

  // Horror reveal po utracie SAN -> przeskocz natychmiast na Bieg 4 (Pustka) lub Bieg 3 (Pulp Sanity Rush)
  if (context.recentSANLoss) {
    config = isPulp ? PULP_SANITY_RUSH_CONFIG : VOID_CONFIG;
  }

  const min = config.wordRange[0];
  let max = config.wordRange[1];

  if (context.nightTime) {
    max = Math.round(max * 1.15);
  }

  const directiveText = isEn ? config.directiveEn : config.directivePl;
  const rangeStr = directiveText.replace(/\d+-\d+ (słów|words)/, `${min}-${max} ${isEn ? 'words' : 'słów'}`);

  const antiMonotony = isEn
    ? `\n**ANTI-MONOTONY RULE (CADENCE VARIANCE):** Never repeat the same opening sentence pattern or paragraph length across consecutive turns. Switch gears actively.`
    : `\n**ZASADA ZMIENNEJ KADENCJI (ZAKAZ MONOTONII):** Nigdy nie powtarzaj tego samego schematu zdania otwierającego ani identycznej długości akapitów w dwóch kolejnych turach. Płynnie przełączaj biegi.`;

  const failForward = isEn
    ? `\n**FAIL-FORWARD DIRECTIVE (CoC 7e RAW):** When a roll fails, NEVER stall ("you failed, what do you do?"). Immediately trigger GEAR 3 (Hard Move): apply success at a cost, time loss, gear damage, or an alerting consequence that drives the story forward.`
    : `\n**DYREKTYWA FAIL-FORWARD (CoC 7e RAW):** Gdy rzut gracza zakończy się porażką, NIGDY nie zatrzymuj gry ("nie udało się, co robisz?"). Natychmiast zastosuj BIEG 3 (Przełamanie): sukces za cenę, strata cennego czasu, uszkodzenie sprzętu lub alarm naruszający równowagę sceny.`;

  const base = isEn
    ? `**NARRATIVE PACING & CADENCE GEAR:** ${rangeStr}${antiMonotony}${failForward}`
    : `**PACING NARRACJI I BIEG KADENCJI:** ${rangeStr}${antiMonotony}${failForward}`;

  if (context.isStuck) {
    const stuckNote = isPulp
      ? (isEn
          ? `\n**PACING - CHANDLER'S LAW (Pulp Cthulhu RAW):** The heroes are stalling or over-planning. Apply Chandler's Law immediately: a man bursts through the door with a gun, cult assassins attack, or an explosion rocks the room. Force immediate action under fire!`
          : `\n**TEMPO - PRAWO CHANDLERA (Pulp Cthulhu RAW):** Badacze tkwią w martwym punkcie lub debacie bez akcji. Zastosuj natychmiast Prawo Chandlera: do pokoju wpada facet z rewolwerem, atakują zabójcy kultu lub następuje eksplozja. Wymuś natychmiastową reakcję pod ostrzałem!`)
      : (isEn
          ? `\n**PACING - WAR-ROOM STALL:** Players are trapped in planning without taking action. Inject an immediate external catalyst: a sudden threat tied to their bonds/motivation, or a startling ambient event. Force an immediate decision under pressure.`
          : `\n**TEMPO - WAR-ROOM (Uchwała III):** Gracze grzęzną w planowaniu bez ruchu. Wprowadź natychmiastowy bodziec zewnętrzny: bezpośrednie zagrożenie powiązane z więzią postaci lub nagłe zjawisko otoczenia. Wymuś decyzję pod presją czasu.`);
    return base + stuckNote;
  }

  return base;
}

/** Opening directives outrank all ambient horror and automatic hard moves. */
export function getOrdinaryWorldDirective(locale: 'pl' | 'en'): string {
  return locale === 'en'
    ? 'GEAR 0 (ORDINARY WORLD): Calm investigation during turns 0-5. Let the player meet NPCs, explore and collect leads (70% ordinary rumours, 30% subtle unease). No physical attacks, monsters or sudden panic. Describe the present state, answer the player and wait: [What do you do?]. This overrides any instruction to force a twist, hostile move or climax. Only explicit physical violence initiated by the player interrupts this protection.'
    : 'BIEG 0 (ORDINARY WORLD): Spokojne śledztwo w turach 0-5. Daj graczowi poznać NPC, teren i tropy (70% zwykłych plotek, 30% subtelnego niepokoju). Zakaz ataków fizycznych, potworów i nagłej paniki. Opisz stan obecny, odpowiedz graczowi i czekaj: [Co robisz?]. Ta zasada ma pierwszeństwo przed nakazami zwrotu, ruchu wroga i kulminacji. Ochronę przerywa wyłącznie jawna przemoc fizyczna zainicjowana przez gracza.';
}
