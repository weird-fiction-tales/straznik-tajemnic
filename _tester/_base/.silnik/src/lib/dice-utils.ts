import {getLocalizedSkillName} from '@/lib/data/character/skills';
/**
 * Utility functions for Call of Cthulhu 7e dice rolling system
 */

// === TYPES ===

export type RollOutcome =
  | 'critical' // 01 - zawsze sukces
  | 'extreme' // ≤ ⅕ wartości
  | 'hard' // ≤ ½ wartości
  | 'regular' // ≤ wartość
  | 'fail' // > wartość
  | 'fumble'; // 96-100 (przy umiejętności <50) lub 100

/**
 * Wymagany poziom trudności testu (CoC 7e).
 * Określa MINIMALNY poziom sukcesu potrzebny, by test zaliczyć:
 *  - regular: wystarczy zwykły sukces (≤ pełna wartość)
 *  - hard:    trzeba osiągnąć co najmniej ≤ ½ wartości
 *  - extreme: trzeba osiągnąć co najmniej ≤ ⅕ wartości
 */
export type RequiredDifficulty = 'regular' | 'hard' | 'extreme';

/** Mapowanie polskich nazw trudności (z tagu [TEST:]) na RequiredDifficulty. */
export function mapDifficultyToRequired(
  difficulty: 'zwykly' | 'trudny' | 'ekstremalny'
): RequiredDifficulty {
  switch (difficulty) {
    case 'trudny':
      return 'hard';
    case 'ekstremalny':
      return 'extreme';
    case 'zwykly':
    default:
      return 'regular';
  }
}

export interface DiceRoll {
  id: string;
  timestamp: Date;

  // Konfiguracja rzutu
  diceType: 'd100' | 'd10' | 'd6' | 'd4' | 'd8' | 'd20' | 'custom';
  diceFormula?: string; // np. "2d6+3"

  // Dla testu umiejętności
  skillName?: string; // np. "Ukrywanie"
  targetValue?: number; // Wartość umiejętności

  // Wynik
  rawResult: number[]; // Surowe wyniki kości
  total: number; // Suma
  bonusDice?: number; // Kości bonusowe (ujemne = karne)

  // Interpretacja (dla d100)
  outcome?: RollOutcome;

  // Wymagany poziom trudności (z tagu [TEST:]); gdy podany, success/porażka
  // liczona jest względem progu trudności, nie tylko pełnej wartości.
  requiredDifficulty?: RequiredDifficulty;
  passedRequirement?: boolean; // czy outcome spełnił wymóg requiredDifficulty
  luckSpent?: number; // ile pkt Szczęścia wydano, by obniżyć ten rzut do progu

  // Tryb
  isManual: boolean; // true = gracz wpisał wynik

  // Kontekst
  characterName?: string;
  sessionId?: string;
}

// === ROLL OUTCOME EVALUATION ===

/**
 * Evaluate the outcome of a d100 skill check according to CoC 7e rules
 *
 * Critical: 01
 * Extreme success: ≤ 1/5 of skill value
 * Hard success: ≤ 1/2 of skill value
 * Regular success: ≤ skill value
 * Failure: > skill value
 * Fumble: 96-100 if skill < 50, or 100 always
 */
export function evaluateSkillCheck(
  roll: number,
  targetValue: number
): RollOutcome {
  // Critical is always 01
  if (roll === 1) {
    return 'critical';
  }

  // Fumble check
  const fumbleThreshold = targetValue < 50 ? 96 : 100;
  if (roll >= fumbleThreshold) {
    return 'fumble';
  }

  // Calculate thresholds
  const extremeThreshold = Math.floor(targetValue / 5);
  const hardThreshold = Math.floor(targetValue / 2);

  if (roll <= extremeThreshold) {
    return 'extreme';
  }

  if (roll <= hardThreshold) {
    return 'hard';
  }

  if (roll <= targetValue) {
    return 'regular';
  }

  return 'fail';
}

// === OUTCOME FORMATTING ===

const OUTCOME_LABELS: Record<
  RollOutcome,
  { label: string; emoji: string; color: string }
> = {
  critical: {
    label: 'KRYTYCZNY SUKCES',
    emoji: '🌟',
    color: 'text-yellow-500',
  },
  extreme: {
    label: 'SUKCES EKSTREMALNY',
    emoji: '✨',
    color: 'text-gold',
  },
  hard: { label: 'TRUDNY SUKCES', emoji: '✅', color: 'text-green-500' },
  regular: { label: 'SUKCES', emoji: '👍', color: 'text-brass' },
  fail: { label: 'PORAŻKA', emoji: '❌', color: 'text-red-400' },
  fumble: { label: 'FUMBLE!', emoji: '💀', color: 'text-red-600' },
};

export function getOutcomeInfo(outcome: RollOutcome, locale: string = 'pl') {
  const labels:Record<RollOutcome,string>={critical:'CRITICAL SUCCESS',extreme:'EXTREME SUCCESS',hard:'HARD SUCCESS',regular:'SUCCESS',fail:'FAILURE',fumble:'FUMBLE!'};
  return locale==='en'?{...OUTCOME_LABELS[outcome],label:labels[outcome]}:OUTCOME_LABELS[outcome];
}

export function isSuccess(outcome: RollOutcome): boolean {
  return ['critical', 'extreme', 'hard', 'regular'].includes(outcome);
}

/** Ranking poziomów sukcesu - im wyżej, tym lepszy wynik. */
const OUTCOME_RANK: Record<RollOutcome, number> = {
  fumble: 0,
  fail: 1,
  regular: 2,
  hard: 3,
  extreme: 4,
  critical: 5,
};

/** Minimalny ranking wymagany przez daną trudność testu. */
const REQUIRED_RANK: Record<RequiredDifficulty, number> = {
  regular: OUTCOME_RANK.regular, // 2
  hard: OUTCOME_RANK.hard, // 3
  extreme: OUTCOME_RANK.extreme, // 4
};

/** Czytelne polskie etykiety wymaganej trudności (do komunikatów). */
export const REQUIRED_DIFFICULTY_LABELS: Record<RequiredDifficulty, string> = {
  regular: 'zwykły',
  hard: 'trudny (≤½)',
  extreme: 'ekstremalny (≤⅕)',
};

/**
 * Liczbowy próg, w jaki rzut musi się zmieścić, by zaliczyć daną trudność.
 * Używane przy wydawaniu Szczęścia (Luck): gracz obniża rzut do tego progu.
 *  - regular → pełna wartość, hard → ½ (floor), extreme → ⅕ (floor).
 */
export function requiredThreshold(
  targetValue: number,
  required: RequiredDifficulty
): number {
  switch (required) {
    case 'hard':
      return Math.floor(targetValue / 2);
    case 'extreme':
      return Math.floor(targetValue / 5);
    case 'regular':
    default:
      return targetValue;
  }
}

/**
 * Czy wynik rzutu spełnia wymóg trudności testu (CoC 7e).
 *
 * Trudność określa minimalny poziom sukcesu: test trudny zalicza tylko rzut
 * o jakości ≥ ½ wartości (hard), test ekstremalny ≥ ⅕ (extreme).
 *  - 01 (critical) zalicza KAŻDĄ trudność (zawsze sukces wg RAW),
 *  - fumble/fail nigdy nie zaliczają,
 *  - reszta wg rankingu poziomów.
 *
 * @example meetsDifficulty('regular', 'hard') === false  // 45/60 przy teście trudnym
 * @example meetsDifficulty('hard', 'hard') === true       // 28/60 przy teście trudnym
 * @example meetsDifficulty('critical', 'extreme') === true // rzut 01 zalicza zawsze
 */
export function meetsDifficulty(
  outcome: RollOutcome,
  required: RequiredDifficulty
): boolean {
  if (outcome === 'critical') return true;
  if (outcome === 'fumble' || outcome === 'fail') return false;
  return OUTCOME_RANK[outcome] >= REQUIRED_RANK[required];
}

// === DICE ROLLING ===

/**
 * Roll a d100 (percentile dice)
 */
export function rollD100(): number {
  return Math.floor(Math.random() * 100) + 1;
}

/**
 * Roll a d100 with bonus/penalty dice
 * @param bonusDice Positive = bonus dice (take lower), Negative = penalty dice (take higher)
 */
export function rollD100WithBonus(bonusDice: number): {
  total: number;
  tensResults: number[];
  unitsResult: number;
} {
  const numTensDice = Math.abs(bonusDice) + 1;
  const tensResults: number[] = [];

  // Roll all tens dice
  for (let i = 0; i < numTensDice; i++) {
    tensResults.push(Math.floor(Math.random() * 10) * 10);
  }

  // Roll units
  const unitsResult = Math.floor(Math.random() * 10);

  // Select best/worst tens based on bonus/penalty
  let selectedTens: number;
  if (bonusDice > 0) {
    // Bonus: take lowest tens
    selectedTens = Math.min(...tensResults);
  } else if (bonusDice < 0) {
    // Penalty: take highest tens
    selectedTens = Math.max(...tensResults);
  } else {
    selectedTens = tensResults[0];
  }

  // Special case: 00 + 0 = 100, not 0
  let total = selectedTens + unitsResult;
  if (total === 0) total = 100;

  return { total, tensResults, unitsResult };
}

/**
 * Roll dice with formula like "2d6+3"
 */
export function rollDiceFormula(
  formula: string
): { results: number[]; total: number } | null {
  const match = formula.match(/(\d+)[dk](\d+)([+-]\d+)?/i);
  if (!match) return null;

  const numDice = parseInt(match[1]);
  const diceSize = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;

  const results: number[] = [];
  for (let i = 0; i < numDice; i++) {
    results.push(Math.floor(Math.random() * diceSize) + 1);
  }

  const total = results.reduce((sum, roll) => sum + roll, 0) + modifier;

  return { results, total };
}

// === CHAT FORMATTING ===

/**
 * Perform a complete skill check with bonus/penalty dice (CoC 7e standard)
 * @param targetValue Skill value
 * @param bonusDice Positive = bonus dice (advantage), Negative = penalty dice (disadvantage)
 * @returns Roll result with outcome evaluation
 */
export function rollSkillCheck(
  targetValue: number,
  bonusDice: number = 0
): {
  total: number;
  outcome: RollOutcome;
  tensResults: number[];
  unitsResult: number;
  bonusDice: number;
} {
  if (bonusDice === 0) {
    const total = rollD100();
    return {
      total,
      outcome: evaluateSkillCheck(total, targetValue),
      tensResults: [],
      unitsResult: 0,
      bonusDice: 0,
    };
  }
  const { total, tensResults, unitsResult } = rollD100WithBonus(bonusDice);
  return {
    total,
    outcome: evaluateSkillCheck(total, targetValue),
    tensResults,
    unitsResult,
    bonusDice,
  };
}

/**
 * Format a dice roll for the chat message
 */
export function formatRollForChat(roll: DiceRoll, locale: string = 'pl'): string {
  if(locale==='en') {
    if(roll.skillName && roll.targetValue!==undefined && roll.outcome){
      const info=getOutcomeInfo(roll.outcome,'en');
      const level=roll.requiredDifficulty?{regular:'Regular',hard:'Hard',extreme:'Extreme'}[roll.requiredDifficulty]:null;
      const requirement=level&&roll.passedRequirement!==undefined?'\n'+level+' check: '+(roll.passedRequirement?'PASSED':'FAILED'):'';
      const bonus=roll.bonusDice?' ['+Math.abs(roll.bonusDice)+(roll.bonusDice>0?' bonus dice]':' penalty dice]'):'';
      return '[🎲 Test: '+getLocalizedSkillName(roll.skillName,'en')+' ('+roll.targetValue+'%)'+bonus+']\nResult: '+roll.total+' → '+info.emoji+' '+info.label+
        '\nThresholds: Regular ≤'+roll.targetValue+' | Hard ≤'+Math.floor(roll.targetValue/2)+' | Extreme ≤'+Math.floor(roll.targetValue/5)+requirement+
        '\n'+(roll.isManual?'(Manual roll)':'(Virtual roll)');
    }
    return '[🎲 Roll: '+(roll.diceFormula??roll.diceType)+'] Result: '+roll.total;
  }
  if (roll.skillName && roll.targetValue !== undefined && roll.outcome) {
    const outcomeInfo = getOutcomeInfo(roll.outcome);
    const hardThreshold = Math.floor(roll.targetValue / 2);
    const extremeThreshold = Math.floor(roll.targetValue / 5);

    const bonusLabel = roll.bonusDice
      ? roll.bonusDice > 0
        ? ` [+${roll.bonusDice} kość bonusowa]`
        : ` [${roll.bonusDice} kość karna]`
      : '';

    // Werdykt względem wymaganej trudności testu (gdy podana z tagu [TEST:]).
    const requirementLine =
      roll.requiredDifficulty && roll.passedRequirement !== undefined
        ? `\nTest ${REQUIRED_DIFFICULTY_LABELS[roll.requiredDifficulty]}: ${roll.passedRequirement ? '✅ ZDANY' : '❌ NIEZDANY'}`
        : '';

    return `[🎲 Test: ${roll.skillName} (${roll.targetValue}%)${bonusLabel}]
Wynik: ${roll.total} → ${outcomeInfo.emoji} ${outcomeInfo.label}
Progi: Zwykły ≤${roll.targetValue} | Trudny ≤${hardThreshold} | Ekstremalny ≤${extremeThreshold}${requirementLine}
${roll.isManual ? '(Rzut ręczny)' : '(Rzut wirtualny)'}`;
  }

  // Generic dice roll
  if (roll.diceFormula) {
    return `[🎲 Rzut: ${roll.diceFormula}]
Wynik: [${roll.rawResult.join(', ')}] = ${roll.total}
${roll.isManual ? '(Rzut ręczny)' : '(Rzut wirtualny)'}`;
  }

  return `[🎲 Rzut ${roll.diceType}] Wynik: ${roll.total}`;
}

/**
 * Format roll as a system message for AI context
 */
export function formatRollForAI(
  roll: DiceRoll,
  characterName?: string
): string {
  const charPrefix = characterName ? `${characterName} wykonał ` : '';

  if (roll.skillName && roll.outcome) {
    // Werdykt wg wymaganej trudności (gdy podana), inaczej wg samego poziomu.
    const success =
      roll.requiredDifficulty && roll.passedRequirement !== undefined
        ? roll.passedRequirement
        : isSuccess(roll.outcome);
    const reqLabel = roll.requiredDifficulty
      ? `, wymagany poziom: ${REQUIRED_DIFFICULTY_LABELS[roll.requiredDifficulty]}`
      : '';
    return `[DICE_ROLL] ${charPrefix}test umiejętności "${roll.skillName}" (${roll.targetValue}%): wynik ${roll.total}, ${roll.outcome.toUpperCase()}${reqLabel}${success ? ' - SUKCES' : ' - PORAŻKA'}`;
  }

  return `[DICE_ROLL] ${charPrefix}rzut ${roll.diceFormula || roll.diceType}: ${roll.total}`;
}

// === LOCAL STORAGE ===

const ROLL_HISTORY_KEY = 'cthulhu_dice_history';
const MAX_HISTORY_SIZE = 100;

export function saveRollToHistory(roll: DiceRoll): void {
  try {
    const history = getRollHistory();
    history.unshift(roll);

    // Trim to max size
    if (history.length > MAX_HISTORY_SIZE) {
      history.length = MAX_HISTORY_SIZE;
    }

    localStorage.setItem(ROLL_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save roll to history:', e);
  }
}

export function getRollHistory(): DiceRoll[] {
  try {
    const stored = localStorage.getItem(ROLL_HISTORY_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    // Reconstruct Date objects
    return parsed.map((roll: DiceRoll) => ({
      ...roll,
      timestamp: new Date(roll.timestamp),
    }));
  } catch (e) {
    console.error('Failed to load roll history:', e);
    return [];
  }
}

export function clearRollHistory(): void {
  localStorage.removeItem(ROLL_HISTORY_KEY);
}

// === ROLL CREATION HELPERS ===

export function createSkillRoll(
  skillName: string,
  targetValue: number,
  result: number,
  isManual: boolean,
  characterName?: string,
  bonusDice: number = 0,
  requiredDifficulty?: RequiredDifficulty
): DiceRoll {
  const outcome = evaluateSkillCheck(result, targetValue);

  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    diceType: 'd100',
    skillName,
    targetValue,
    rawResult: [result],
    total: result,
    bonusDice,
    outcome,
    requiredDifficulty,
    passedRequirement: requiredDifficulty
      ? meetsDifficulty(outcome, requiredDifficulty)
      : undefined,
    isManual,
    characterName,
  };
}

export function createGenericRoll(
  formula: string,
  results: number[],
  total: number,
  isManual: boolean,
  characterName?: string
): DiceRoll {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    diceType: 'custom',
    diceFormula: formula,
    rawResult: results,
    total,
    isManual,
    characterName,
  };
}
