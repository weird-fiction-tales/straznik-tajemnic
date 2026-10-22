'use client';

import type { FC } from 'react';
import {getLocalizedSkillName} from '@/lib/data/character/skills';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dices, Sparkles, Send } from 'lucide-react';
import {
  type DiceRoll,
  getOutcomeInfo,
  isSuccess,
  REQUIRED_DIFFICULTY_LABELS,
} from '@/lib/dice-utils';
import type { RollTestData } from './RollTestModal';
import { ArtDecoDice3D, type ArtDecoDiceBreakdown } from './ArtDecoDice3D';
import type { CombinedRollResolution } from '@/lib/combined-skill-rolls';

interface RollTestResultProps {
  test: RollTestData;
  phase: 'idle' | 'rolling' | 'done';
  animValue: number;
  roll: DiceRoll | null;
  breakdown?: ArtDecoDiceBreakdown | null;
  /** Dostępne pkt Szczęścia (CoC 7e Faza 5B); null luckNeeded = nie wolno / nie trzeba. */
  availableLuck: number;
  luckNeeded: number | null;
  combinedResolution?: CombinedRollResolution | null;
  onRoll: () => void;
  onSpendLuck: () => void;
  onSend: () => void;
  onClose: () => void;
}

/**
 * Panel ciała modalu Tacki [TEST:]: podsumowanie trudności → animowana kość + werdykt
 * → akcje (Rzuć / Wydaj Szczęście / Do czatu / Zamknij). Wydzielony z RollTestModal.
 */
export const RollTestResult: FC<RollTestResultProps> = ({
  test,
  phase,
  animValue,
  roll,
  breakdown,
  availableLuck,
  luckNeeded,
  combinedResolution,
  onRoll,
  onSpendLuck,
  onSend,
  onClose,
}) => {
  const t = useTranslations('RollTestResult');
  const locale=useLocale();
  const target = test.value;
  const hardThreshold = Math.floor(target / 2);
  const extremeThreshold = Math.floor(target / 5);
  const MUTED = 'text-muted-foreground';
  const thClass = (key: RollTestData['difficulty'], active: string) =>
    test.difficulty === key ? `${active} font-semibold` : MUTED;

  const succeeded = roll
    ? roll.requiredDifficulty && roll.passedRequirement !== undefined
      ? roll.passedRequirement
      : roll.outcome
        ? isSuccess(roll.outcome)
        : false
    : false;
  // Test z USTAWIONĄ trudnością (½/⅕): "zwykły sukces" nie spełniający progu jest dla
  // TEGO testu porażką. Synchronizujemy główny werdykt z `succeeded`, by uniknąć
  // sprzeczności "👍 SUKCES | ✗ test trudny" (np. rzut 58 przy progu trudnym ≤37).
  const hasSetDifficulty =
    !!roll?.requiredDifficulty &&
    roll.requiredDifficulty !== 'regular' &&
    roll.passedRequirement !== undefined;
  const rawOutcomeInfo = roll?.outcome ? getOutcomeInfo(roll.outcome,locale) : null;
  const outcomeInfo =
    hasSetDifficulty && !succeeded && roll?.outcome && isSuccess(roll.outcome)
      ? getOutcomeInfo('fail',locale)
      : rawOutcomeInfo;

  const bonusLabel =
    test.bonusDice > 0
      ? t('bonusDicePlus', { count: test.bonusDice })
      : test.bonusDice < 0
        ? t('bonusDiceMinus', { count: Math.abs(test.bonusDice) })
        : null;

  const canSpendLuck =
    phase === 'done' && luckNeeded !== null && luckNeeded <= availableLuck;

  return (
    <div
      data-testid={phase === 'done' ? 'roll-test-result' : undefined}
      className="space-y-4 py-2"
    >
      {/* Podsumowanie testu: próg trudności + kości premii/kary */}
      <div className="border border-brass/28 bg-[#16130f] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-special-elite text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {t('difficulty')}
            </span>
            {test.combined && (
              <Badge className="bg-brass/20 text-brass border-brass/40 font-mono text-xs">
                {test.combined.operator === 'OR' ? t('combinedOrTag') : t('combinedAndTag')}
              </Badge>
            )}
          </div>
          <Badge variant="secondary">
            {test.difficulty === 'zwykly'
              ? t('difficultyRegular')
              : test.difficulty === 'trudny'
                ? t('difficultyHard')
                : t('difficultyExtreme')}
          </Badge>
        </div>

        {test.combined ? (
          <div className="space-y-1.5 pt-1">
            {test.combined.skills.map((sub, idx) => {
              const subTarget = sub.skillValue;
              const subHard = Math.floor(subTarget / 2);
              const subExtreme = Math.floor(subTarget / 5);
              return (
                <div
                  key={idx}
                  className="flex flex-wrap items-center justify-between text-xs border-b border-border/30 pb-1 last:border-none"
                >
                  <span className="font-bold text-foreground">{getLocalizedSkillName(sub.skillName,locale)}</span>
                  <div className="flex gap-2 font-mono">
                    <span className={thClass('zwykly', 'text-foreground')}>≤{subTarget}</span>
                    <span className={thClass('trudny', 'text-brass')}>½ ≤{subHard}</span>
                    <span className={thClass('ekstremalny', 'text-primary')}>⅕ ≤{subExtreme}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-special-elite text-xs uppercase tracking-[0.06em]">
            <span className={thClass('zwykly', 'text-foreground')}>
              {t('thresholdRegular', { value: target })}
            </span>
            <span className={thClass('trudny', 'text-brass')}>
              {t('thresholdHard', { value: hardThreshold })}
            </span>
            <span className={thClass('ekstremalny', 'text-primary')}>
              {t('thresholdExtreme', { value: extremeThreshold })}
            </span>
          </div>
        )}

        {bonusLabel && (
          <div className="text-center">
            <Badge
              variant="outline"
              className={
                test.bonusDice > 0
                  ? 'border-primary/50 text-primary'
                  : 'border-destructive/50 text-destructive'
              }
            >
              🎲 {bonusLabel}
            </Badge>
          </div>
        )}
      </div>

      {/* Trójwymiarowa fasetowana tacka kości Art Déco */}
      <ArtDecoDice3D
        phase={phase}
        animValue={animValue}
        total={roll?.total}
        breakdown={breakdown}
        bonusDice={test.bonusDice}
        luckSpent={roll?.luckSpent}
        outcome={roll?.outcome}
      />

      {/* Werdykt po ustabilizowaniu rzutu */}
      {phase === 'done' && (
        <div className="flex flex-col items-center justify-center pt-0.5 space-y-1">
          {combinedResolution ? (
            <div className="w-full text-center space-y-1">
              <div
                className={`font-display text-lg uppercase tracking-[0.16em] ${
                  combinedResolution.overallSuccess ? 'text-primary font-bold' : 'text-destructive font-bold'
                }`}
              >
                {combinedResolution.overallSuccess
                  ? `✅ ${t('combinedOverallSuccess')}`
                  : `❌ ${t('combinedOverallFailure')}`}
              </div>
              <div className="space-y-0.5 text-xs font-mono text-muted-foreground">
                {combinedResolution.subtests.map((sub, idx) => (
                  <div key={idx} className="flex justify-center gap-2">
                    <span className="text-foreground">{getLocalizedSkillName(sub.skillName,locale)}:</span>
                    <span className={sub.isSuccess ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                      {sub.isSuccess ? '✓ '+t('passed') : '✗ '+t('failed')} (≤{sub.threshold})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {outcomeInfo && (
                <div
                  className={`relative font-display text-lg uppercase tracking-[0.16em] ${outcomeInfo.color}`}
                >
                  {outcomeInfo.emoji} {outcomeInfo.label}
                </div>
              )}
              {roll?.requiredDifficulty &&
                roll.requiredDifficulty !== 'regular' &&
                roll.passedRequirement !== undefined && (
                  <div
                    className={`relative mt-1 font-special-elite text-xs tracking-[0.1em] ${succeeded ? 'text-primary' : 'text-destructive'}`}
                  >
                    {succeeded ? '✓' : '✗'}{' '}
                    {t('requiredLevelTag', {
                      level:locale==='en'?{regular:'Regular',hard:'Hard',extreme:'Extreme'}[roll.requiredDifficulty]:REQUIRED_DIFFICULTY_LABELS[roll.requiredDifficulty],
                    })}
                  </div>
                )}
            </>
          )}
        </div>
      )}

      {/* Akcje */}
      <div className="flex items-center justify-center gap-3 pt-1">
        {phase === 'idle' ? (
          <Button
            onClick={onRoll}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-display uppercase tracking-[0.12em] px-8"
          >
            <Dices className="w-4 h-4 mr-2" />
            {t('roll')}
          </Button>
        ) : (
          <>
            {canSpendLuck && (
              <Button
                variant="outline"
                onClick={onSpendLuck}
                className="border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/10 font-display uppercase tracking-[0.1em]"
                title={t('spendLuckTitle', {
                  needed: luckNeeded,
                  available: availableLuck,
                })}
              >
                <Sparkles className="w-4 h-4 mr-1" />{' '}
                {t('luckButton', { needed: luckNeeded })}
              </Button>
            )}
            {phase === 'done' && (
              <Button
                onClick={onSend}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-display uppercase tracking-[0.12em]"
              >
                <Send className="w-4 h-4 mr-2" /> {t('sendToChat')}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={phase === 'rolling'}
              className="font-display uppercase tracking-[0.1em] text-muted-foreground"
            >
              {t('close')}
            </Button>
          </>
        )}
      </div>
      {phase === 'done' && (
        <p className="text-center font-serif italic text-xs text-muted-foreground/80">
          {t('luckHint')}
        </p>
      )}
    </div>
  );
};
