import {getLocalizedSkillName} from '@/lib/data/character/skills';
import type { CombinedSkillSubtest, SkillTestData } from './parsers/types';
import {
  type RollOutcome,
  evaluateSkillCheck,
  isSuccess,
} from './dice-utils';

export interface CombinedSubtestResult {
  skillName: string;
  targetValue: number;
  threshold: number;
  outcome: RollOutcome;
  isSuccess: boolean;
  shouldMark: boolean;
}

export interface CombinedRollResolution {
  operator: 'OR' | 'AND';
  rollValue: number;
  bonusDice: number;
  difficulty: SkillTestData['difficulty'];
  subtests: CombinedSubtestResult[];
  overallSuccess: boolean;
  overallOutcome: RollOutcome;
}

export interface EvaluateCombinedParams {
  roll: number;
  subtests: { skillName: string; skillValue: number }[];
  operator: 'OR' | 'AND';
  difficulty?: SkillTestData['difficulty'];
  bonusDice?: number;
  usedLuck?: boolean;
}

/** Oblicza próg punktowy dla trudności CoC 7e RAW */
export function calculateSkillThreshold(
  value: number,
  difficulty: SkillTestData['difficulty'] = 'zwykly'
): number {
  switch (difficulty) {
    case 'trudny':
      return Math.floor(value / 2);
    case 'ekstremalny':
      return Math.floor(value / 5);
    case 'zwykly':
    default:
      return value;
  }
}

/**
 * Rozstrzyga łączony test umiejętności (CoC 7e RAW s. 103 & s. 105).
 * Pojedynczy rzut d100 jest porównywany z progami każdej z umiejętności.
 */
export function evaluateCombinedSkillCheck(
  params: EvaluateCombinedParams
): CombinedRollResolution {
  const {
    roll,
    subtests,
    operator,
    difficulty = 'zwykly',
    bonusDice = 0,
    usedLuck = false,
  } = params;

  const subResults: CombinedSubtestResult[] = subtests.map((sub) => {
    const threshold = calculateSkillThreshold(sub.skillValue, difficulty);
    const outcome = evaluateSkillCheck(roll, threshold);
    const subSuccess = isSuccess(outcome);
    // RAW s. 105: Do rozwoju zaznacza się tylko umiejętność faktycznie zdaną,
    // wykluczając rzuty z kością premiową oraz wydanie Szczęścia.
    const shouldMark = subSuccess && bonusDice <= 0 && !usedLuck;

    return {
      skillName: sub.skillName,
      targetValue: sub.skillValue,
      threshold,
      outcome,
      isSuccess: subSuccess,
      shouldMark,
    };
  });

  const overallSuccess =
    operator === 'OR'
      ? subResults.some((s) => s.isSuccess)
      : subResults.every((s) => s.isSuccess);

  // Wyznaczamy reprezentatywny outcome dla całego testu
  const bestOutcome = subResults.reduce((best, cur) => {
    if (cur.outcome === 'critical') return 'critical';
    if (best === 'critical') return best;
    if (cur.outcome === 'extreme') return 'extreme';
    if (best === 'extreme') return best;
    if (cur.outcome === 'hard') return 'hard';
    if (best === 'hard') return best;
    if (cur.outcome === 'regular') return 'regular';
    if (best === 'regular') return best;
    return cur.outcome;
  }, subResults[0]?.outcome || 'fail');

  return {
    operator,
    rollValue: roll,
    bonusDice,
    difficulty,
    subtests: subResults,
    overallSuccess,
    overallOutcome: overallSuccess ? bestOutcome : 'fail',
  };
}

/**
 * Generuje tagi [WYNIK:] dla każdej ze składowych testu łączonego.
 * Dzięki temu system oznaczania rozwoju (useSkillMarking) automatycznie
 * oznacza wyłącznie te umiejętności, które faktycznie zdały rzut (RAW s. 105).
 */
export function generateCombinedResultTags(
  resolution: CombinedRollResolution,
  characterName?: string,
  usedLuck: boolean = false
): string[] {
  const prefix = characterName ? `@${characterName}: ` : '';
  const bonusNote = resolution.bonusDice > 0 ? ' | BONUS' : '';
  const luckNote = usedLuck ? ' | LUCK' : '';

  return resolution.subtests.map((sub) => {
    const verdict = sub.isSuccess ? 'SUKCES' : 'PORAŻKA';
    return `[WYNIK:${prefix}${sub.skillName} | ${resolution.rollValue} ≤ ${sub.threshold} | ${verdict}${bonusNote}${luckNote}]`;
  });
}

/**
 * Formatuje wynik łączonego rzutu dla czatu narracyjnego.
 */
export function formatCombinedRollForChat(
  resolution: CombinedRollResolution,
  characterName?: string,
  locale: string = 'pl'
): string {
  if(locale==='en')return '[🎲 Combined test: '+resolution.operator+']\nD100: '+resolution.rollValue+'\n'+
    resolution.subtests.map(s=>'• '+getLocalizedSkillName(s.skillName,'en')+' ('+s.targetValue+'% → ≤'+s.threshold+'): '+(s.isSuccess?'SUCCESS':'FAILURE')).join('\n')+
    '\nOverall result: '+(resolution.overallSuccess?'SUCCESS':'FAILURE');
  const opLabel = resolution.operator === 'OR' ? 'LUB (dowolny sukces)' : 'I (wymagane oba)';
  const bonusLabel =
    resolution.bonusDice !== 0
      ? resolution.bonusDice > 0
        ? ` [+${resolution.bonusDice} kość bonusowa]`
        : ` [${resolution.bonusDice} kość karna]`
      : '';

  const header = `[🎲 Test łączony: ${opLabel}${bonusLabel}]`;
  const rollLine = `Rzut d100: **${resolution.rollValue}**`;
  const subLines = resolution.subtests
    .map(
      (s) =>
        `• ${s.skillName} (${s.targetValue}% → próg ≤${s.threshold}): ${s.isSuccess ? '✅ SUKCES' : '❌ PORAŻKA'}`
    )
    .join('\n');

  const overallLine = resolution.overallSuccess
    ? `Wynik ogólny: ✅ **SUKCES**`
    : `Wynik ogólny: ❌ **PORAŻKA**`;

  return `${header}\n${rollLine}\n${subLines}\n${overallLine}`;
}

/**
 * Formatuje wynik łączonego rzutu jako system message dla LLM.
 */
export function formatCombinedRollForAI(
  resolution: CombinedRollResolution,
  characterName?: string
): string {
  const charPrefix = characterName ? `${characterName} wykonał ` : '';
  const opStr = resolution.operator === 'OR' ? 'LUB' : 'I';
  const subStr = resolution.subtests
    .map((s) => `"${s.skillName}": ${s.isSuccess ? 'SUKCES' : 'PORAŻKA'} (próg ${s.threshold}%)`)
    .join(', ');

  const overall = resolution.overallSuccess ? 'SUKCES' : 'PORAŻKA';
  return `[DICE_ROLL] ${charPrefix}łączony test umiejętności (${opStr}): wynik ${resolution.rollValue}, szczegóły: ${subStr} - WYNIK KOŃCOWY: ${overall}`;
}
