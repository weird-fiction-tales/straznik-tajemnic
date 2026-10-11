'use client';

/**
 * @file stat-change-card.tsx
 * Diegetyczna karta zmian statystyk Badacza (HP, SAN, Szczęście) w czacie (Issue #763).
 * Estetyka: Dark Art Déco 1920s (zgodna z docs/DESIGN-SYSTEM-ART-DECO.md).
 *
 * Prezentuje:
 * 1. Zmianę wartości (delta) ze znakiem i jednostką.
 * 2. Diegetyczne uzasadnienie fabularne (powód z narracji MG).
 * 3. Stan przed i po modyfikacji.
 * 4. Sygnalizację progów krytycznych CoC 7e RAW (Szok Mitów / Test INT, Ciężka Rana, Utrata Przytomności).
 */

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Heart,
  Brain,
  Sparkles,
  AlertTriangle,
  Skull,
  Activity,
  CheckCircle2,
  Dice5,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Character, SkillTestData, StatChangeEventData, StatChangeItem } from '@/lib/types';

export interface StatChangeCardProps {
  statEvent: StatChangeEventData;
  activeCharacter?: Character | null;
  characters?: Character[];
  onRollTest?: (test: SkillTestData) => void;
  completed?: boolean;
}

export function StatChangeCard({
  statEvent,
  activeCharacter,
  characters,
  onRollTest,
  completed = false,
}: StatChangeCardProps) {
  const t = useTranslations('StatChangeCard');
  const [hasRolledIntCheck, setHasRolledIntCheck] = useState(false);

  // Znajdź właściwego Badacza dla testu Inteligencji
  const targetCharacter =
    characters?.find((c) => c.id === statEvent.characterId) ||
    (activeCharacter?.id === statEvent.characterId ? activeCharacter : activeCharacter);

  const handleRollIntCheck = () => {
    if (!onRollTest || hasRolledIntCheck) return;

    const rawSkill =
      targetCharacter?.skills?.['Inteligencja'] ??
      targetCharacter?.skills?.['Intelligence'];
    const intSkillValue =
      typeof rawSkill === 'number'
        ? rawSkill
        : typeof rawSkill === 'object' && rawSkill !== null && 'value' in rawSkill
        ? Number(rawSkill.value)
        : targetCharacter?.int ?? 50;

    const testData: SkillTestData = {
      id: `test-int-${Date.now()}-${statEvent.characterId}`,
      skillName: 'Inteligencja',
      skillValue: intSkillValue,
      difficulty: 'zwykly',
      modifiers: [],
      justification: statEvent.changes.find((c) => c.type === 'san')?.reason || 'Szok Mitów (strata ≥ 5 SAN)',
      characterName: statEvent.characterName,
      characterId: statEvent.characterId,
    };

    onRollTest(testData);
    setHasRolledIntCheck(true);
  };

  const renderChangeItem = (change: StatChangeItem, index: number) => {
    const isLoss = change.delta < 0;

    if (change.type === 'hp') {
      return (
        <div key={`hp-${index}`} className="flex flex-col gap-1 py-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Heart
                className={`h-4 w-4 ${isLoss ? 'text-destructive' : 'text-primary'}`}
                aria-hidden="true"
              />
              <span className="font-sans text-sm font-medium text-foreground">
                {isLoss ? t('hpLoss') : t('hpGain')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`font-special-elite text-xs ${
                  isLoss
                    ? 'border-destructive/40 bg-destructive/15 text-destructive'
                    : 'border-primary/40 bg-primary/15 text-primary'
                }`}
              >
                {change.delta > 0 ? `+${change.delta}` : change.delta} PŻ
              </Badge>
              <span className="font-special-elite text-xs text-muted-foreground">
                {t('currentHp', {
                  current: change.currentValue,
                  max: change.maxValue ?? 10,
                })}
              </span>
            </div>
          </div>
          {change.reason && (
            <p className="font-serif italic text-sm text-[#e6ede8] pl-6">
              „{change.reason}”
            </p>
          )}
        </div>
      );
    }

    if (change.type === 'san') {
      return (
        <div key={`san-${index}`} className="flex flex-col gap-1 py-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Brain
                className={`h-4 w-4 ${isLoss ? 'text-[#c084fc]' : 'text-primary'}`}
                aria-hidden="true"
              />
              <span className="font-sans text-sm font-medium text-foreground">
                {isLoss ? t('sanLoss') : t('sanGain')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`font-special-elite text-xs ${
                  isLoss
                    ? 'border-[#a855f7]/40 bg-[#701a75]/25 text-[#c084fc]'
                    : 'border-primary/40 bg-primary/15 text-primary'
                }`}
              >
                {change.delta > 0 ? `+${change.delta}` : change.delta} SAN
              </Badge>
              <span className="font-special-elite text-xs text-muted-foreground">
                {t('currentSan', {
                  current: change.currentValue,
                  max: change.maxValue ?? 99,
                })}
              </span>
            </div>
          </div>
          {change.reason && (
            <p className="font-serif italic text-sm text-[#e6ede8] pl-6">
              „{change.reason}”
            </p>
          )}
        </div>
      );
    }

    if (change.type === 'luck') {
      return (
        <div key={`luck-${index}`} className="flex flex-col gap-1 py-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles
                className="h-4 w-4 text-[#fbbf24]"
                aria-hidden="true"
              />
              <span className="font-sans text-sm font-medium text-foreground">
                {isLoss ? t('luckLoss') : t('luckGain')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`font-special-elite text-xs ${
                  isLoss
                    ? 'border-[#d97706]/40 bg-[#b45309]/20 text-[#fbbf24]'
                    : 'border-[#eab308]/40 bg-[#ca8a04]/20 text-[#fde047]'
                }`}
              >
                {change.delta > 0 ? `+${change.delta}` : change.delta}
              </Badge>
              <span className="font-special-elite text-xs text-muted-foreground">
                {t('currentLuck', { current: change.currentValue })}
              </span>
            </div>
          </div>
          {change.reason && (
            <p className="font-serif italic text-sm text-[#e6ede8] pl-6">
              „{change.reason}”
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div
      data-testid="stat-change-card"
      className="my-3 relative overflow-hidden rounded-md border border-brass/40 bg-gradient-to-b from-[#14110c] to-[#0a0c0f] p-4 text-foreground shadow-deco"
    >
      {/* Ozdobne narożniki Art Déco */}
      <div className="absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2 border-brass/30 pointer-events-none" />
      <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-brass/30 pointer-events-none" />

      {/* Nagłówek karty */}
      <div className="flex items-center justify-between border-b border-brass/20 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brass" aria-hidden="true" />
          <span className="font-cinzel text-xs font-bold tracking-widest uppercase text-brass">
            {t('headerTitle')}
          </span>
        </div>
        {statEvent.characterName && (
          <span className="font-special-elite text-xs text-muted-foreground bg-brass/10 border border-brass/20 px-2 py-0.5 rounded-sm">
            {statEvent.characterName}
          </span>
        )}
      </div>

      {/* Pozycje zmian */}
      <div className="space-y-2 divide-y divide-border/20">
        {statEvent.changes.map((change, index) => renderChangeItem(change, index))}
      </div>

      {/* Sygnalizacje progów krytycznych */}
      {statEvent.majorWound && (
        <div className="mt-2.5 flex items-center gap-2 rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive font-sans">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{t('majorWoundAlert')}</span>
        </div>
      )}

      {statEvent.unconscious && (
        <div className="mt-2.5 flex items-center gap-2 rounded-sm border border-destructive/40 bg-destructive/15 px-3 py-1.5 text-xs text-destructive font-sans font-bold">
          <Skull className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{t('unconsciousAlert')}</span>
        </div>
      )}

      {statEvent.dying && (
        <div className="mt-2.5 flex items-center gap-2 rounded-sm border border-destructive/50 bg-destructive/20 px-3 py-1.5 text-xs text-destructive font-sans font-bold animate-pulse">
          <Skull className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{t('dyingAlert')}</span>
        </div>
      )}

      {/* Próg Szoku Mitów (utrata >= 5 SAN) z procedurą testu INT CoC 7e RAW */}
      {statEvent.intCheckRequired && (
        <div className="mt-3 pt-3 border-t border-brass/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-sm border border-[#a855f7]/30 bg-[#701a75]/15 p-2.5">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-[#c084fc] flex-shrink-0" />
            <span className="font-cinzel text-xs font-semibold text-[#e9d5ff]">
              {t('intCheckRequired')}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={hasRolledIntCheck || completed}
            onClick={handleRollIntCheck}
            className="font-cinzel text-xs border-[#a855f7]/50 text-[#e9d5ff] hover:bg-[#701a75]/30 hover:border-[#c084fc] focus-visible:ring-primary flex items-center gap-1.5"
          >
            {hasRolledIntCheck ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                {t('intCheckDone')}
              </>
            ) : (
              <>
                <Dice5 className="h-3.5 w-3.5 text-[#c084fc]" />
                {t('intCheckButton')}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
