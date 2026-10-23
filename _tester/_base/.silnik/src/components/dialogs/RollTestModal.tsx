'use client';

import {useLocale,useTranslations} from 'next-intl';
import {getLocalizedSkillName} from '@/lib/data/character/skills';
import type { FC } from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import type { Character } from '@/lib/types';
import {
  type DiceRoll,
  rollD100,
  rollD100WithBonus,
  createSkillRoll,
  formatRollForChat,
  formatRollForAI,
  saveRollToHistory,
  mapDifficultyToRequired,
  isSuccess,
} from '@/lib/dice-utils';
import { useLuckSpend } from './use-luck-spend';
import { RollTestResult } from './roll-test-result';
import type { ArtDecoDiceBreakdown } from './ArtDecoDice3D';
import type { CombinedSkillSubtest, SkillRollResolution } from '@/lib/parsers/types';
import {
  evaluateCombinedSkillCheck,
  formatCombinedRollForChat,
  formatCombinedRollForAI,
  generateCombinedResultTags,
  type CombinedRollResolution,
} from '@/lib/combined-skill-rolls';

/**
 * Dane testu z tagu [TEST:] przekazane do modalu (z SkillTestCard po kliknięciu "Rzuć").
 */
export interface RollTestData {
  testId: string;
  groupId?: string;
  characterId?: string;
  targetNpcId?: string;
  isCombat?: boolean;
  skill: string;
  value: number;
  difficulty: 'zwykly' | 'trudny' | 'ekstremalny';
  /** Bilans kości premii/kary (dodatnie = premia, ujemne = kara). */
  bonusDice: number;
  /** Uzasadnienie / okoliczności testu (do dziennika). */
  justification?: string;
  /** Test łączony (RAW s. 103): operator 'OR' / 'AND' oraz lista umiejętności */
  combined?: {
    operator: 'OR' | 'AND';
    skills: CombinedSkillSubtest[];
  };
}

interface RollTestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  test: RollTestData | null;
  activeCharacter?: Character;
  /** Wysyła wynik rzutu do czatu (istniejąca ścieżka handleSendMessage). */
  onRollSendToChat?: (
    message: string,
    systemContext: string,
    mechanicsContext?: { skillRolls: SkillRollResolution[] },
  ) => void;
  /** Zapisuje rzut do dziennika postaci (most appendRollToJournal w page.tsx). */
  onJournalRoll?: (
    roll: DiceRoll,
    justification?: string,
    characterId?: string
  ) => void;
  /** Odejmuje wydane pkt Szczęścia z karty postaci (CoC 7e Faza 5B). */
  onSpendLuck?: (amount: number, characterId?: string) => void;
}

const ANIM_DURATION_MS = 700;

/**
 * Mały modal Tacki sterowany WYŁĄCZNIE tagiem [TEST:] (D1 - uproszczenie Tacki).
 *
 * Przebieg: podsumowanie testu → animacja kości → wynik. Po nieudanym rzucie gracz może
 * wydać Szczęście (CoC 7e Faza 5B), by obniżyć wynik do progu, a potem RĘCZNIE wysłać
 * finalny rzut do czatu + dziennika ("Do czatu"). Rozdzielenie rzutu od wysyłki jest
 * konieczne - Szczęście wydaje się PO zobaczeniu nieudanego rzutu. Cała ocena idzie przez
 * kanoniczny silnik `dice-utils` (single source of truth - próg ½/⅕, fumble RAW, premia/kara).
 */
export const RollTestModal: FC<RollTestModalProps> = ({
  open,
  onOpenChange,
  test,
  activeCharacter,
  onRollSendToChat,
  onJournalRoll,
  onSpendLuck,
}) => {
  const locale=useLocale();
  const t=useTranslations('RollTestResult');
  // 'idle' = przed rzutem, 'rolling' = animacja, 'done' = wynik gotowy (oczekuje wysłania).
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'done'>('idle');
  const [animValue, setAnimValue] = useState(0);
  const [roll, setRoll] = useState<DiceRoll | null>(null);
  const [breakdown, setBreakdown] = useState<ArtDecoDiceBreakdown | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { availableLuck, setAvailableLuck, luckNeeded, spendLuck } =
    useLuckSpend(activeCharacter?.luck ?? 0, roll, setRoll, (amount) =>
      onSpendLuck?.(amount, test?.characterId)
    );

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  // Reset stanu przy każdym otwarciu / zmianie testu / ZMIANIE POSTACI (po id).
  // Celowo zależymy od `activeCharacter?.id`, NIE całego obiektu: wydanie Szczęścia
  // odejmuje luck → rodzic tworzy nowy obiekt postaci (to samo id) → przy zależności
  // od `activeCharacter` useEffect resetował phase do 'idle' ("k100/RZUĆ") i chował
  // konwersję porażka→sukces. availableLuck synchronizuje sam hook (setAvailableLuck).
  useEffect(() => {
    if (open) {
      setPhase('idle');
      setRoll(null);
      setAnimValue(0);
      setBreakdown(null);
      setAvailableLuck(activeCharacter?.luck ?? 0);
    }
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, test?.testId, activeCharacter?.id, clearTimers, setAvailableLuck]);

  if (!test) return null;

  const requiredDifficulty = mapDifficultyToRequired(test.difficulty);

  const handleRoll = () => {
    if (phase !== 'idle') return;
    setPhase('rolling');

    // Wynik rzeczywisty generowany przez silnik (kości premii/kary uwzględnione).
    const isBonus = (test.bonusDice || 0) !== 0;
    const diceResult = isBonus
      ? (() => {
          const bRoll = rollD100WithBonus(test.bonusDice);
          const selectedTens =
            test.bonusDice > 0
              ? Math.min(...bRoll.tensResults)
              : Math.max(...bRoll.tensResults);
          return {
            total: bRoll.total,
            tensResults: bRoll.tensResults,
            unitsResult: bRoll.unitsResult,
            selectedTens,
          };
        })()
      : (() => {
          const total = rollD100();
          const tens = total === 100 ? 0 : Math.floor((total % 100) / 10) * 10;
          const units = total === 100 ? 0 : total % 10;
          return {
            total,
            tensResults: [tens],
            unitsResult: units,
            selectedTens: tens,
          };
        })();

    const finalRoll = createSkillRoll(
      test.skill,
      test.value,
      diceResult.total,
      false,
      activeCharacter?.name,
      test.bonusDice,
      requiredDifficulty
    );

    // Animacja: migające losowe liczby, potem ustalenie wyniku.
    setAnimValue(diceResult.total);

    const settle = setTimeout(() => {
      setAnimValue(diceResult.total);
      setBreakdown({
        tensResults: diceResult.tensResults,
        unitsResult: diceResult.unitsResult,
        selectedTens: diceResult.selectedTens,
        total: diceResult.total,
      });
      setRoll(finalRoll);
      setPhase('done');
      // Historia łapie każdy rzut (nawet niewysłany). Wysyłka do czatu + dziennika
      // następuje dopiero po ręcznym "Do czatu" (po ewentualnym wydaniu Szczęścia).
      saveRollToHistory(finalRoll);
    }, ANIM_DURATION_MS);
    timersRef.current.push(settle);
  };

  const combinedResolution: CombinedRollResolution | null =
    test?.combined && roll
      ? evaluateCombinedSkillCheck({
          roll: roll.total,
          subtests: test.combined.skills,
          operator: test.combined.operator,
          difficulty: test.difficulty,
          bonusDice: test.bonusDice,
          usedLuck: (roll.luckSpent ?? 0) > 0,
        })
      : null;

  // Wysyła FINALNY rzut (po ewentualnym wydaniu Szczęścia) do czatu + dziennika.
  const handleSend = () => {
    if (!roll) return;
    if (onRollSendToChat) {
      const mechanicsContext: { skillRolls: SkillRollResolution[] } | undefined = roll.outcome
        ? {
            skillRolls: [{
              testId: test.testId,
              resolutionId: roll.id,
              characterId: test.characterId ?? activeCharacter?.id,
              targetNpcId: test.targetNpcId,
              requiredDifficulty: roll.requiredDifficulty ?? requiredDifficulty,
              passedRequirement: roll.passedRequirement ?? isSuccess(roll.outcome),
              outcome: roll.outcome,
              luckSpent: roll.luckSpent ?? 0,
              skillNames: combinedResolution
                ? combinedResolution.subtests.map((subtest) => subtest.skillName)
                : [test.skill],
            }],
          }
        : undefined;
      if (combinedResolution) {
        const resultTags = generateCombinedResultTags(
          combinedResolution,
          activeCharacter?.name,
          (roll.luckSpent ?? 0) > 0
        ).join('\n');
        const chatText = `${formatCombinedRollForChat(combinedResolution, activeCharacter?.name,locale)}\n\n${resultTags}`;
        const aiText = formatCombinedRollForAI(combinedResolution, activeCharacter?.name);
        onRollSendToChat(chatText, aiText, mechanicsContext);
      } else {
        onRollSendToChat(
          formatRollForChat(roll,locale),
          formatRollForAI(roll, activeCharacter?.name),
          mechanicsContext,
        );
      }
    }
    onJournalRoll?.(roll, test.justification, test.characterId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="roll-test-modal" size="wide">
        <DialogHeader>
          <div className="text-center">
            <div className="font-special-elite text-[14px] uppercase tracking-[0.32em] text-primary">
              {t('fateKicker')}
            </div>
            <DialogTitle className="mt-1 justify-center font-display text-xl font-bold uppercase tracking-[0.1em] text-foreground">
              {t('testTitle',{skill:test.combined?test.combined.skills.map(s=>getLocalizedSkillName(s.skillName,locale)).join(' '+test.combined.operator+' '):getLocalizedSkillName(test.skill,locale)})}
            </DialogTitle>
          </div>
          <DialogDescription className="text-center font-serif italic text-muted-foreground">
            {test.justification || t('fallbackPrompt')}
          </DialogDescription>
        </DialogHeader>

        <RollTestResult
          test={test}
          phase={phase}
          animValue={animValue}
          roll={roll}
          breakdown={breakdown}
          availableLuck={availableLuck}
          luckNeeded={luckNeeded}
          combinedResolution={combinedResolution}
          onRoll={handleRoll}
          onSpendLuck={spendLuck}
          onSend={handleSend}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};
