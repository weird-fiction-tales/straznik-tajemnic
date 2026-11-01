'use client';

/**
 * @file SkillTestCard - tacka testu umiejętności CoC 7e renderowana z tagu [TEST:...].
 *
 * Odtworzony z gita (commit 30c9a44^, skasowany jako dead code w IND-140 - był odłączony
 * od początku). Przywrócony 2026-06-17 (Bug 2 playtest: "testy się nie inicjują") z pełnym
 * wiringiem: parsed.skillTests → metadata SSE → useChat (resolucja skillValue z karty) →
 * MessageCard render.
 *
 * Karta PREZENTACYJNA: pokazuje próg (wartość / ½ / ⅕ wg trudności), kości premii/kary,
 * uzasadnienie. `onRoll` opcjonalny - gdy podany, renderuje przycisk "Rzuć kością"
 * (Faza 2: otwiera DiceDialog z preselectem). Bez onRoll = gracz rzuca ręczną tacką.
 *
 * Typy canonical z @/lib/parsers/types (NIE redefiniujemy - unika driftu, TS strict).
 */

import React, { useState } from 'react';
import type { SkillTestData, SkillTestModifier } from '@/lib/parsers/types';
import {getLocalizedSkillName} from '@/lib/data/character/skills';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Check, Dices, Swords } from 'lucide-react';
import { OpposedRollModal } from '@/components/dialogs/OpposedRollModal';

/** Kształt funkcji t() z next-intl potrzebnej helperom modułu. */
type TranslateFn = ReturnType<typeof useTranslations>;

export interface OpposedTestConfig {
  opponentName: string;
  opponentSkillName?: string;
  opponentSkillValue: number;
  opponentBonusDice?: number;
}

interface SkillTestCardProps extends SkillTestData {
  onRoll?: (testData: SkillTestData) => void;
  completed?: boolean;
  opposed?: OpposedTestConfig;
  onSendChat?: (message: string, systemContext: string) => void;
}

// === HELPERS ===

/** Oblicza próg sukcesu CoC 7e na podstawie trudności */
function calculateThreshold(
  skillValue: number,
  difficulty: SkillTestData['difficulty']
): number {
  switch (difficulty) {
    case 'zwykly':
      return skillValue;
    case 'trudny':
      return Math.floor(skillValue / 2);
    case 'ekstremalny':
      return Math.floor(skillValue / 5);
    default:
      return skillValue;
  }
}

/** Bilans kości premii/kary (bonus dodatnie, kara ujemne) */
function calculateDiceBalance(modifiers: SkillTestModifier[]): number {
  return modifiers.reduce((balance, mod) => {
    return balance + (mod.type === 'bonus' ? mod.count : -mod.count);
  }, 0);
}

/** Czytelna instrukcja rzutu wg bilansu kości */
function getDiceInstruction(t: TranslateFn, balance: number): string {
  if (balance === 0) {
    return t('rollNormal');
  } else if (balance > 0) {
    const extra =
      balance === 1
        ? t('extraTensOne')
        : t('extraTensMany', { count: balance });
    return t('rollBetter', { extra });
  } else {
    const extra =
      balance === -1
        ? t('extraTensOne')
        : t('extraTensMany', { count: Math.abs(balance) });
    return t('rollWorse', { extra });
  }
}

/** Konfiguracja badge'a trudności */
function getDifficultyBadge(
  t: TranslateFn,
  difficulty: SkillTestData['difficulty']
): {
  label: string;
  className: string;
} {
  switch (difficulty) {
    case 'zwykly':
      return { label: t('difficultyRegular'), className: 'bg-primary/20 text-primary border border-primary/40' };
    case 'trudny':
      return { label: t('difficultyHard'), className: 'bg-brass/20 text-brass border border-brass/40' };
    case 'ekstremalny':
      return { label: t('difficultyExtreme'), className: 'bg-destructive/20 text-destructive-foreground border border-destructive/50' };
    default:
      return { label: t('difficultyRegular'), className: 'bg-primary/20 text-primary border border-primary/40' };
  }
}

// === COMPONENT ===

export function SkillTestCard({
  id,
  skillName,
  skillValue,
  difficulty,
  modifiers,
  justification,
  stake,
  characterName,
  characterId,
  targetNpcId,
  dossierConditionId,
  isCombat,
  groupId,
  combined,
  onRoll,
  completed = false,
  opposed,
  onSendChat,
}: SkillTestCardProps) {
  const t = useTranslations('SkillTestCard');
  const locale=useLocale();
  const displaySkillName=combined?combined.skills.map(s=>getLocalizedSkillName(s.skillName,locale)).join(' '+combined.operator+' '):getLocalizedSkillName(skillName,locale);
  const [isOpposedModalOpen, setIsOpposedModalOpen] = useState(false);

  const threshold = calculateThreshold(skillValue, difficulty);
  const diceBalance = calculateDiceBalance(modifiers);
  const diceInstruction = getDiceInstruction(t, diceBalance);
  const difficultyBadge = getDifficultyBadge(t, difficulty);

  const isOpposed = Boolean(opposed);

  const handleRollClick = () => {
    if (isOpposed) {
      setIsOpposedModalOpen(true);
      return;
    }

    if (onRoll) {
      onRoll({
        id,
        skillName,
        skillValue,
        difficulty,
        modifiers,
        justification,
        stake,
        characterName,
        characterId,
        targetNpcId,
        dossierConditionId,
        isCombat,
        groupId,
        combined,
      });
    }
  };

  return (
    <div
      className={`my-4 backdrop-blur rounded-r-md overflow-hidden shadow-deco border-l-4 ${
        isOpposed
          ? 'bg-card/95 border-brass shadow-glow-brass'
          : 'bg-card/90 border-primary'
      }`}
    >
      {/* Nagłówek z nazwą umiejętności i trudnością / trybem przeciwstawnym */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b ${
          isOpposed
            ? 'bg-card border-brass/30'
            : 'bg-card/95 border-border'
        }`}
      >
        <div className="flex items-center gap-2">
          {isOpposed ? (
            <Swords className="w-5 h-5 text-brass" />
          ) : (
            <Dices className="w-5 h-5 text-primary" />
          )}
          <span
            className={`font-bold uppercase tracking-wide ${
              isOpposed ? 'text-brass font-display' : 'text-foreground font-display'
            }`}
          >
            {displaySkillName}
          </span>
          {characterName && (
            <span className="text-xs text-muted-foreground font-special-elite">@{characterName}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {combined && (
            <Badge className="bg-brass/20 text-brass border border-brass/40 font-mono text-xs">
              {combined.operator === 'OR' ? t('combinedOrBadge') : t('combinedAndBadge')}
            </Badge>
          )}
          {isOpposed ? (
            <Badge className="bg-brass/20 text-brass border-brass/40 font-mono text-xs">
              {t('opposedBadge')}
            </Badge>
          ) : (
            <Badge className={difficultyBadge.className}>{difficultyBadge.label}</Badge>
          )}
        </div>
      </div>

      {/* Wartość i próg */}
      <div className="px-4 py-2 border-b border-border/60 space-y-1 bg-card/60">
        {combined && combined.skills.length > 0 ? (
          <div className="space-y-1.5 py-0.5">
            <div className="text-xs text-muted-foreground italic">
              {combined.operator === 'OR' ? t('combinedOrDesc') : t('combinedAndDesc')}
            </div>
            {combined.skills.map((sub, idx) => {
              const subThreshold = calculateThreshold(sub.skillValue, difficulty);
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between text-sm border-t border-border/30 pt-1 first:border-none first:pt-0"
                >
                  <span className="text-foreground font-medium">{getLocalizedSkillName(sub.skillName,locale)}</span>
                  <span className="font-mono">
                    <span className="text-foreground font-bold">{sub.skillValue}%</span>
                    <span className="text-muted-foreground mx-2">→</span>
                    <span className="text-primary font-bold">
                      {t('threshold', { threshold: subThreshold })}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('yourValue')}</span>
            <span className="font-mono">
              <span className="text-foreground font-bold">{skillValue}%</span>
              {!isOpposed && (
                <>
                  <span className="text-muted-foreground mx-2">→</span>
                  <span className="text-primary font-bold">
                    {t('threshold', { threshold })}
                  </span>
                </>
              )}
            </span>
          </div>
        )}

        {/* Wartość przeciwnika przy teście przeciwstawnym */}
        {isOpposed && opposed && (
          <div className="flex items-center justify-between text-sm pt-1 border-t border-border/40">
            <span className="text-muted-foreground">
              {t('opponentValue')} <span className="text-foreground font-medium">{opposed.opponentName}</span>
              {opposed.opponentSkillName && opposed.opponentSkillName !== skillName && (
                <span className="text-xs text-muted-foreground ml-1">({opposed.opponentSkillName})</span>
              )}
            </span>
            <span className="font-mono text-destructive font-bold">
              {opposed.opponentSkillValue}%
            </span>
          </div>
        )}
      </div>

      {/* Modyfikatory */}
      {modifiers.length > 0 && (
        <div className="px-4 py-2 border-b border-border/60 bg-card/40">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-display">
            {t('modifiers')}
          </div>
          <div className="space-y-1">
            {modifiers.map((mod, index) => (
              <div
                key={index}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={
                      mod.type === 'bonus' ? 'text-green-400' : 'text-red-400'
                    }
                  >
                    {mod.type === 'bonus' ? '⬆️' : '⬇️'}
                  </span>
                  <span className="text-foreground/80">{mod.reason}</span>
                </span>
                <span
                  className={`font-mono ${mod.type === 'bonus' ? 'text-primary' : 'text-destructive'}`}
                >
                  {mod.type === 'bonus'
                    ? t('bonusDiceCount', { count: mod.count })
                    : t('penaltyDiceCount', { count: mod.count })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instrukcja rzutu */}
      {!isOpposed && (
        <div className="px-4 py-3 bg-card/80 border-b border-border/60">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-brass">🎯</span>
            <span className="font-medium text-brass">{diceInstruction}</span>
          </div>
        </div>
      )}

      {/* Stawka testu (Issue #737) */}
      {stake && (
        <div className="px-4 py-2.5 border-b border-border/60 bg-card border-l-2 border-l-brass">
          <div className="flex items-start gap-2.5 text-sm">
            <span className="text-brass mt-0.5 text-base">⚖️</span>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-brass font-display font-semibold block mb-0.5">
                {t('stakeLabel')}
              </span>
              <span className="text-foreground/90 font-serif italic text-xs leading-relaxed">
                {stake}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Uzasadnienie fabularne */}
      {justification && (
        <div className="px-4 py-2 border-b border-border/60 bg-card/40">
          <div className="flex items-start gap-2 text-sm">
            <span className="text-brass mt-0.5">💡</span>
            <span className="text-muted-foreground italic font-serif">{justification}</span>
          </div>
        </div>
      )}

      {/* Przycisk Rzuć / Test Przeciwstawny */}
      {(onRoll || isOpposed) && (
        <div className="px-4 py-3 flex justify-center bg-card/50">
          <Button
            onClick={handleRollClick}
            disabled={completed}
            className={
              isOpposed
                ? 'bg-brass hover:bg-brass/80 text-background font-display font-semibold px-6 flex items-center gap-2 shadow-deco'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-6 shadow-deco'
            }
          >
            {completed ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                {t('resultSaved')}
              </>
            ) : isOpposed ? (
              <>
                <Swords className="w-4 h-4 mr-2" />
                {t('opposedRollButton')}
              </>
            ) : (
              <>
                <Dices className="w-4 h-4 mr-2" />
                {t('rollDiceButton')}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Modal testu przeciwstawnego */}
      {isOpposed && opposed && (
        <OpposedRollModal
          open={isOpposedModalOpen}
          onOpenChange={setIsOpposedModalOpen}
          data={{
            id,
            testId: id,
            groupId,
            characterId,
            playerName: characterName || 'Badacz',
            playerSkillName: skillName,
            playerSkillValue: skillValue,
            playerBonusDice: diceBalance,
            opponentName: opposed.opponentName,
            opponentSkillName: opposed.opponentSkillName || skillName,
            opponentSkillValue: opposed.opponentSkillValue,
            opponentBonusDice: opposed.opponentBonusDice || 0,
            justification,
          }}
          onSendToChat={onSendChat}
          onComplete={() => {
            if (onRoll) {
              onRoll({
                id,
                skillName,
                skillValue,
                difficulty,
                modifiers,
                justification,
                characterName,
                characterId,
                targetNpcId,
                dossierConditionId,
                isCombat,
                groupId,
              });
            }
          }}
        />
      )}
    </div>
  );
}
