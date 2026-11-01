'use client';

import '@/components/ui/deco-window.css';

/**
 * @file spell-card.tsx
 * Karta rzucania czarów i rytuałów w oknie czatu narracji (CoC 7e RAW & Poradniki MG).
 * Estetyka: Dark Art Déco Fiction First.
 */

import React, { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMagicLabels } from '@/components/ui/use-magic-labels';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Dices,
  Skull,
  HeartPulse,
  ShieldAlert,
  Swords,
  XCircle,
} from 'lucide-react';
import {
  getSpellDefinition,
  findSpellByAnyName,
  magicEngine,
  type SpellDefinition,
  type CastingResolution,
} from '@/lib/magic';
import type { Character, SpellCastEventData } from '@/lib/types';
import type { RollOutcome } from '@/lib/dice-utils';

export interface SpellCardProps {
  spellEvent: SpellCastEventData;
  activeCharacter?: Character | null;
  characters?: Character[];
  completed?: boolean;
  onCharacterUpdate?: (char: Character) => void;
  onSendChat?: (message: string) => void;
}

export function SpellCard({
  spellEvent,
  activeCharacter,
  characters = [],
  completed = false,
  onCharacterUpdate,
  onSendChat,
}: SpellCardProps) {
  const t = useTranslations('Magic');
  const labels = useMagicLabels();
  const locale = useLocale() === 'en' ? 'en' : 'pl';

  const [isResolved, setIsResolved] = useState<boolean>(completed);
  const [resolution, setResolution] = useState<CastingResolution | null>(null);
  const [allowHpConversion, setAllowHpConversion] = useState<boolean>(false);
  const [canPush, setCanPush] = useState<boolean>(false);
  const [isCasting, setIsCasting] = useState<boolean>(false);
  const [showLoreGuide, setShowLoreGuide] = useState<boolean>(false);

  // Znajdź docelową postać (rzucającego)
  const normalizeName = (val: string) => val.trim().toLowerCase().replace(/\s+/g, ' ');
  const characterPool = activeCharacter
    ? [activeCharacter, ...characters.filter((c) => c.id !== activeCharacter.id)]
    : characters;

  const caster = spellEvent.characterId
    ? characterPool.find((c) => c.id === spellEvent.characterId)
    : spellEvent.characterName
    ? characterPool.find((c) => normalizeName(c.name) === normalizeName(spellEvent.characterName || ''))
    : activeCharacter;

  // Znajdź definicję zaklęcia w katalogu
  const spell: SpellDefinition | undefined =
    getSpellDefinition(spellEvent.spellId) || findSpellByAnyName(spellEvent.spellId);
  const isUnknownSpell = !spell;

  // Jeśli brak w katalogu, utwórz definicję awaryjną na podstawie danych zdarzenia
  const effectiveSpell: SpellDefinition = spell || {
    id: spellEvent.spellId,
    name: spellEvent.alias || spellEvent.spellId,
    namePl: spellEvent.alias || spellEvent.spellId,
    nameEn: spellEvent.alias || spellEvent.spellId,
    diegeticNames: {
      pl: [spellEvent.alias || spellEvent.spellId],
      en: [spellEvent.alias || spellEvent.spellId],
    },
    category: 'other',
    mpCost: 0,
    sanCost: '0',
    castingTime: {
      type: 'rounds',
      rounds: 1,
      value: { pl: '1 runda', en: '1 round' },
    },
    range: { pl: 'Nieznany', en: 'Unknown' },
    duration: { pl: 'Nieznany', en: 'Unknown' },
    description: {
      pl: spellEvent.description || 'Nieznana inkantacja spoza rejestru Mitów Cthulhu.',
      en: spellEvent.description || 'Unknown incantation outside Cthulhu Mythos records.',
    },
    source: {
      sourceId: 'custom',
      title: 'Nieznany rejestr',
      edition: '7e',
      page: 0,
      language: 'pl',
    },
    definitionVersion: 1,
  };

  const isSkeptic = (caster?.magic?.belief ?? 'skeptic') === 'skeptic';
  const knownEntry = caster?.magic?.knownSpells?.[effectiveSpell.id];
  const isFirstCast = !knownEntry?.isFirstCastDone;
  const casterPow = caster?.pow ?? 50;
  const hardPow = Math.floor(casterPow / 2);
  const extremePow = Math.floor(casterPow / 5);

  const mpCostNumeric =
    typeof effectiveSpell.mpCost === 'number'
      ? effectiveSpell.mpCost
      : parseInt(String(effectiveSpell.mpCost), 10) || 5;

  const casterMp = caster?.mp ?? 0;
  const casterSan = caster?.san ?? 50;
  const casterHp = caster?.hp ?? 10;
  const hasEnoughMp = casterMp >= mpCostNumeric;
  const missingMp = Math.max(0, mpCostNumeric - casterMp);
  const targetPow = spellEvent.targetPow ?? 50;

  // Tytuł diegetyczny i kanoniczny
  const diegeticTitle =
    spellEvent.alias ||
    effectiveSpell.diegeticNames[locale][0] ||
    (locale === 'en' ? effectiveSpell.nameEn : effectiveSpell.namePl);
  const canonicalName = locale === 'en' ? effectiveSpell.nameEn : effectiveSpell.namePl;

  const getOutcomeBadge = (outcome?: RollOutcome) => {
    switch (outcome) {
      case 'critical':
        return <Badge className="bg-brass/10 text-brass border-brass/30">{t('outcomeCritical')}</Badge>;
      case 'extreme':
        return <Badge className="bg-primary/10 text-primary border-primary/30">{t('outcomeExtreme')}</Badge>;
      case 'hard':
        return <Badge className="bg-primary/10 text-primary border-primary/30">{t('outcomeHard')}</Badge>;
      case 'regular':
        return <Badge variant="outline" className="border-border text-muted-foreground">{t('outcomeRegular')}</Badge>;
      case 'fail':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/40">{t('outcomeFail')}</Badge>;
      case 'fumble':
      default:
        return <Badge className="bg-destructive/30 text-destructive-foreground border-destructive/50">{t('outcomeFumble')}</Badge>;
    }
  };

  const handleCast = (isPush = false) => {
    if (!caster || isUnknownSpell || (isResolved && !isPush) || isCasting) return;
    if (isSkeptic) return;
    if (!isPush && !hasEnoughMp && !allowHpConversion) return;

    setIsCasting(true);

    try {
      const res = magicEngine.resolveCasting(
        {
          casterId: caster.id,
          casterName: caster.name,
          casterPow: caster.pow,
          casterMp: caster.mp,
          casterHp: caster.hp,
          casterSan: caster.san,
          belief: caster.magic?.belief ?? 'skeptic',
          spellId: effectiveSpell.id,
          isFirstCastOverride: isFirstCast,
          isPush,
          allowHpConversion,
          target:
            spellEvent.targetName
              ? { name: spellEvent.targetName, pow: targetPow }
              : undefined,
        },
        effectiveSpell
      );

      setResolution(res);
      setIsResolved(true);

      if (!res.success && res.isFirstCast && !isPush) {
        setCanPush(true);
      } else {
        setCanPush(false);
      }

      // Aktualizacja postaci
      if (onCharacterUpdate) {
        const newMp = Math.max(0, caster.mp + res.statChanges.mpDelta);
        const newHp = Math.max(0, caster.hp + res.statChanges.hpDelta);
        const newSan = Math.max(0, caster.san + res.statChanges.sanDelta);
        const newPow = Math.max(0, caster.pow + res.statChanges.powDelta);

        const currentKnownSpells = caster.magic?.knownSpells ?? {};
        const updatedKnownEntry = {
          spellId: effectiveSpell.id,
          learnedAt: knownEntry?.learnedAt ?? new Date().toISOString(),
          source: knownEntry?.source ?? ('preset' as const),
          isFirstCastDone: knownEntry?.isFirstCastDone || res.characterUpdates.isFirstCastDone,
          pushedRollUsed: isPush ? true : knownEntry?.pushedRollUsed,
          deeperUnlocked: knownEntry?.deeperUnlocked || Boolean(res.deeperUnlockedNow),
          knownAlias: diegeticTitle,
          definitionVersion: effectiveSpell.definitionVersion,
        };

        const updatedMagic: NonNullable<typeof caster.magic> = {
          schemaVersion: caster.magic?.schemaVersion ?? 1,
          belief: caster.magic?.belief ?? 'skeptic',
          deferredSanLoss: caster.magic?.deferredSanLoss ?? 0,
          knownSpells: {
            ...currentKnownSpells,
            [effectiveSpell.id]: updatedKnownEntry,
          },
          tomeStudies: caster.magic?.tomeStudies ?? {},
        };

        onCharacterUpdate({
          ...caster,
          mp: newMp,
          hp: newHp,
          san: newSan,
          pow: newPow,
          magic: updatedMagic,
        });
      }

      // Wysłanie raportu rzutu do czatu (Fiction First z czyszczeniem tagu przed graczem)
      if (onSendChat) {
        const resultTag = `[WYNIK_CZARU: id=${spellEvent.id} | spell=${effectiveSpell.id} | nazwa=${canonicalName} | rzucajacy=${caster.name} | sukces=${res.success} | mp=${res.costPaid.mp} | hp=${res.costPaid.hpFromMp} | san=${res.costPaid.san} | pow=${res.costPaid.powPermanent}${res.firstCastRoll ? ` | rzut=${res.firstCastRoll.roll}/${res.firstCastRoll.threshold}` : ''}${res.opposedRoll ? ` | starcie=${res.opposedRoll.casterRoll}vs${res.opposedRoll.targetRoll} | zwyciezca=${res.opposedRoll.winner}` : ''}${res.firstCastRoll?.pushedFailedCatastrophe ? ' | KATASTROFA' : ''}]`;
        const narrativeMessage = locale === 'en' ? res.message.en : res.message.pl;
        onSendChat(`${resultTag}\n\n${narrativeMessage}`);
      }
    } finally {
      setIsCasting(false);
    }
  };

  return (
    <Card data-testid="spell-card" className="deco-window my-3 overflow-hidden border border-brass/30 bg-card text-foreground shadow-deco">
      {/* Nagłówek klimatyczny Dark Art Déco */}
      <div className="border-b border-brass/30 bg-gradient-to-r from-background via-card to-background px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <div className="shrink-0 rounded-sm border border-brass/30 bg-brass/10 p-1">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-serif text-base font-semibold tracking-wide text-foreground">
                {diegeticTitle}
              </span>
              <Badge variant="outline" className="text-sm border-brass/30 text-brass font-mono">
                {canonicalName}
              </Badge>
              {effectiveSpell.source && (
                <Badge variant="outline" className="h-auto max-w-full whitespace-normal break-words text-left text-sm leading-5 border-border/50 text-muted-foreground">
                  <BookOpen className="mr-1 h-3 w-3 shrink-0" />
                  {labels.source(effectiveSpell.source.title)}, {t('sourcePageLabel')} {effectiveSpell.source.pagePl ?? effectiveSpell.source.page} {t('polishEdition')}{effectiveSpell.source.pageEn ? ` / ${t('englishEdition')} ${effectiveSpell.source.pageEn}` : ''}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLoreGuide(!showLoreGuide)}
              className="flex min-h-10 min-w-10 items-center justify-center gap-1 rounded border border-transparent px-2 text-sm font-mono text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title={showLoreGuide ? t('hideLoreGuide') : t('showLoreGuide')}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('toggleLoreGuide')}</span>
              {showLoreGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {isResolved ? (
              <Badge className="border-brass/30 bg-brass/10 font-mono text-sm text-brass">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {t('btnCompleted')}
              </Badge>
            ) : (
              <Badge className="border-primary/30 bg-primary/10 font-mono text-sm text-primary">
                ⏳ {effectiveSpell.castingTime.value[locale]}
              </Badge>
            )}
          </div>
        </div>

        {/* Lorowy opis zaklęcia w fikcji gry */}
        <p className="mt-2 text-lg font-serif text-foreground leading-relaxed">
          {effectiveSpell.description[locale]}
        </p>

        {/* Zwijany mini-przewodnik zasad magii CoC 7e RAW */}
        {showLoreGuide && (
          <div className="mt-3 space-y-2 rounded border border-brass/30 bg-background/70 p-3 text-base text-foreground">
            <p className="flex items-center gap-1.5 font-display font-semibold text-brass">
              <BookOpen className="w-3.5 h-3.5" />
              {t('spellLoreTitle')}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t('spellLorePhilosophy')}
            </p>
            <ul className="list-inside list-disc space-y-1 text-base text-foreground">
              <li>{t('spellLoreFirstCast')}</li>
              <li>{t('spellLoreSubsequent')}</li>
              <li>{t('spellLorePush')}</li>
              <li>{t('spellLoreOpposed')}</li>
            </ul>
          </div>
        )}
      </div>

      <CardContent className="space-y-4 p-4">
        {/* Stan 1: Przed rzuceniem – Bilans zasobów i stawki */}
        {!isResolved && (
          <div className="space-y-3">
            {isUnknownSpell && (
              <div className="flex items-center gap-2 p-3 rounded border border-brass/30 bg-brass/10 text-brass text-sm font-serif">
                <AlertTriangle className="w-4 h-4 shrink-0 text-brass" />
                <span>{t('unknownSpellWarning')}</span>
              </div>
            )}

            {/* Siatka zasobów (Pre-flight cost preview) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm font-mono">
              {/* PM */}
              <div className={`space-y-1 rounded border p-2.5 ${hasEnoughMp ? 'border-primary/30 bg-primary/10' : 'border-destructive/40 bg-destructive/10'}`}>
                <div className="flex items-center justify-between text-muted-foreground text-sm">
                  <span>{t('preflightMp')}</span>
                  <span>🔮 -{mpCostNumeric}</span>
                </div>
                <div className="flex items-center justify-between font-bold">
                  <span className={hasEnoughMp ? 'text-primary' : 'text-destructive'}>
                    {casterMp} {t('mpLabel')}
                  </span>
                  <span className="text-muted-foreground">➔</span>
                  <span className={hasEnoughMp ? 'text-primary' : 'text-destructive'}>
                    {Math.max(0, casterMp - mpCostNumeric)} {t('mpLabel')}
                  </span>
                </div>
              </div>

              {/* SAN */}
              <div className="p-2.5 rounded border border-border/50 bg-card/60 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground text-sm">
                  <span>{t('preflightSan')}</span>
                  <span className="text-destructive">🧠 -{labels.dice(effectiveSpell.sanCost)}</span>
                </div>
                <div className="flex items-center justify-between font-bold">
                  <span className="text-foreground">{casterSan} SAN</span>
                  <span className="text-muted-foreground">➔</span>
                  <span className="text-destructive">
                    {effectiveSpell.sanCost === '1k4' ? `${casterSan - 4}..${casterSan - 1}` : `${casterSan - 6}..${casterSan - 1}`}
                  </span>
                </div>
              </div>

              {/* MOC trwale / HP */}
              {effectiveSpell.powCost ? (
                <div className="col-span-2 space-y-1 rounded border border-destructive/40 bg-destructive/10 p-2.5 sm:col-span-1">
                  <div className="flex items-center justify-between text-muted-foreground text-sm">
                    <span>{t('preflightPow')}</span>
                    <span className="font-bold text-destructive">⚡ -{effectiveSpell.powCost}</span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-foreground">{casterPow}</span>
                    <span className="text-muted-foreground">➔</span>
                    <span className="text-destructive">{casterPow - effectiveSpell.powCost} POW</span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded border border-border/50 bg-card/60 space-y-1 col-span-2 sm:col-span-1">
                  <div className="flex items-center justify-between text-muted-foreground text-sm">
                    <span>{t('preflightHp')}</span>
                    <span>❤️ 0</span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-foreground">{casterHp} HP</span>
                    <span className="text-muted-foreground">➔</span>
                    <span className="text-primary">{casterHp} HP</span>
                  </div>
                </div>
              )}
            </div>

            {/* Krwawa ofiara (gdy brakuje PM) */}
            {!hasEnoughMp && !isSkeptic && (
              <div className="p-3 rounded border border-destructive/50 bg-destructive/15 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-destructive font-semibold">
                  <HeartPulse className="w-4 h-4 animate-pulse flex-shrink-0" />
                  <span>{t('bloodSacrificeBanner', { cost: missingMp })}</span>
                </div>
                <p className="text-sm text-destructive-foreground leading-relaxed">
                  {t('bloodSacrificeWarning', {
                    cost: missingMp,
                    beforeHp: casterHp,
                    afterHp: Math.max(0, casterHp - missingMp),
                  })}
                </p>
                <label className="flex items-center gap-2 cursor-pointer pt-1 font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={allowHpConversion}
                    onChange={(e) => setAllowHpConversion(e.target.checked)}
                    className="rounded border-destructive text-destructive focus:ring-destructive"
                  />
                  <span className="text-sm">{t('bloodSacrificeConsent')}</span>
                </label>
              </div>
            )}

            {/* Blokada Sceptyka */}
            {isSkeptic && (
              <div className="p-3 rounded border border-destructive/50 bg-destructive/10 text-destructive text-sm space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <ShieldAlert className="w-4 h-4" />
                  <span>{t('skepticBlocked')}</span>
                </div>
              </div>
            )}

            {/* Baner stawek i trudności rzutu */}
            <div className="space-y-2 rounded border border-brass/30 bg-card p-3 text-base">
              {isFirstCast ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-brass font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {t('firstCastStakes', { threshold: hardPow })}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {t('regularThreshold', { threshold: casterPow })} | {t('hardThreshold', { threshold: hardPow })} | {t('extremeThreshold', { threshold: extremePow })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed font-serif">
                    {t('spellLoreFirstCast')}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-primary font-mono">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('knownCastStakes')}</span>
                </div>
              )}

              {/* Starcie woli z celem */}
              {effectiveSpell.opposedRoll === 'pow' && spellEvent.targetName && (
                <div className="pt-2 border-t border-border/40 space-y-1">
                  <div className="flex items-center justify-between font-mono text-primary font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Swords className="w-3.5 h-3.5" />
                      {t('opposedStakes', {
                        casterPow,
                        target: spellEvent.targetName,
                        targetPow,
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground font-serif leading-relaxed">
                    {t('opposedStakesDescription')}
                  </p>
                </div>
              )}
            </div>

            {/* Przycisk rzucenia zaklęcia */}
            <div className="flex justify-end pt-1">
              <Button
                onClick={() => handleCast(false)}
                disabled={
                  isUnknownSpell ||
                  isSkeptic ||
                  (!hasEnoughMp && !allowHpConversion) ||
                  isCasting
                }
                className="min-h-10 gap-2 bg-primary px-5 py-2.5 font-serif text-base text-primary-foreground shadow-deco hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Sparkles className="w-4 h-4" />
                {t('btnCast')}
              </Button>
            </div>
          </div>
        )}

        {/* Stan 2: Po rzuceniu – Tabela kości, rzuty K100 i werdykt */}
        {isResolved && resolution && (
          <div className="space-y-3 rounded-lg border border-brass/30 bg-background/60 p-4 text-base font-mono">
            {/* Werdykt główny */}
            <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/40">
              <div className="flex items-center gap-2 font-display text-sm font-semibold">
                {resolution.success ? (
                  <div className="flex items-center gap-1.5 text-primary">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>
                      {resolution.isFirstCast
                        ? t('firstCastSuccessSummary')
                        : resolution.opposedRoll
                        ? t('opposedVictoryCaster')
                        : t('automaticSuccessSummary')}
                    </span>
                  </div>
                ) : resolution.firstCastRoll?.pushedFailedCatastrophe ? (
                  <div className="flex items-center gap-1.5 text-destructive font-black">
                    <Skull className="h-5 w-5 animate-pulse" />
                    <span>{t('pushedCatastropheSummary')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-destructive font-semibold">
                    <XCircle className="h-5 w-5" />
                    <span>
                      {resolution.opposedRoll && resolution.opposedRoll.winner === 'target'
                        ? t('opposedVictoryTarget')
                        : t('firstCastFailureSummary')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Tabela kości K100 (Dice Breakdown) */}
            <div className="space-y-2.5">
              {/* Rzut na pierwsze rzucenie (Hard POW) */}
              {resolution.firstCastRoll && (
                <div className="p-3 rounded border border-primary/30 bg-card/60 space-y-1.5">
                  <div className="flex items-center justify-between text-muted-foreground text-sm">
                    <span className="font-serif">{t('rollHardPow', { threshold: resolution.firstCastRoll.threshold })}</span>
                    <span>POW: {casterPow}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Dices className="h-4 w-4 text-primary" />
                    <span className="text-base font-bold text-foreground">
                      K100: {resolution.firstCastRoll.roll} / {resolution.firstCastRoll.threshold}
                    </span>
                    {getOutcomeBadge(resolution.firstCastRoll.outcome)}
                  </div>
                </div>
              )}

              {/* Rzut sporny (Opposed POW) */}
              {resolution.opposedRoll && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded border border-primary/30 bg-card/60">
                  {/* Badacz */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground text-sm">
                      <span className="font-serif">{resolution.opposedRoll.casterName || caster?.name}</span>
                      <span>MOC {resolution.opposedRoll.casterPow ?? casterPow}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Dices className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold text-foreground">
                        K100: {resolution.opposedRoll.casterRoll}
                      </span>
                      {getOutcomeBadge(resolution.opposedRoll.casterOutcome)}
                    </div>
                  </div>

                  {/* Cel */}
                  <div className="space-y-1 border-t border-border/40 pt-2 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-3">
                    <div className="flex items-center justify-between text-muted-foreground text-sm">
                      <span className="font-serif">{resolution.opposedRoll.targetName || spellEvent.targetName}</span>
                      <span>MOC {resolution.opposedRoll.targetPow ?? targetPow}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Dices className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-bold text-foreground">
                        K100: {resolution.opposedRoll.targetRoll}
                      </span>
                      {getOutcomeBadge(resolution.opposedRoll.targetOutcome)}
                    </div>
                  </div>

                  {/* Werdykt starcia woli */}
                  <div className="col-span-1 sm:col-span-2 pt-2 border-t border-border/30 text-sm font-serif">
                    {resolution.opposedRoll.winner === 'caster' ? (
                      <p className="text-primary font-medium">
                        ✓ {t('opposedVictoryCaster')}
                        {resolution.opposedRoll.casterPowImprovementEligible && (
                          <span className="block text-primary font-mono text-sm pt-0.5">
                            ★ {t('casterPowImprovementNotice')}
                          </span>
                        )}
                      </p>
                    ) : resolution.opposedRoll.winner === 'target' ? (
                      <p className="text-destructive font-medium">
                        ✕ {t('opposedVictoryTarget')}
                      </p>
                    ) : (
                      <p className="text-muted-foreground font-medium">
                        {resolution.opposedRoll.casterPow && resolution.opposedRoll.targetPow && resolution.opposedRoll.casterPow > resolution.opposedRoll.targetPow
                          ? t('opposedTieCaster')
                          : t('opposedTieTarget')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Kolejne rzucenie bez testu kości */}
              {!resolution.firstCastRoll && !resolution.opposedRoll && (
                <div className="p-2.5 rounded border border-border/40 bg-card/40 text-muted-foreground text-sm font-serif">
                  {t('automaticSuccessSummary')}
                </div>
              )}

              {/* Katastrofa forsowania CoC 7e RAW */}
              {resolution.catastrophe && (
                <div className="p-3 rounded border border-destructive/40 bg-destructive/10 text-destructive text-sm font-serif space-y-1.5 shadow-deco">
                  <div className="flex items-center gap-2 font-bold text-destructive">
                    <Skull className="w-4 h-4 text-destructive animate-pulse" />
                    <span>
                      {t('catastropheTitle')}: {resolution.catastrophe.effect.name[locale]}
                    </span>
                    <Badge variant="destructive" className="ml-auto text-sm">
                      ×{resolution.catastrophe.costMultiplier} 1K6
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-destructive">
                    {resolution.catastrophe.effect.description[locale]}
                  </p>
                  {resolution.catastrophe.mpDeficitPaidWithHp > 0 && (
                    <p className="text-sm text-brass font-mono">
                      🩸 {t('catastropheHpPaid', { hp: resolution.catastrophe.mpDeficitPaidWithHp })}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Podsumowanie zużytych zasobów */}
            <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground font-serif">{t('costsDeducted')}</span>
              <div className="flex flex-wrap gap-2 font-mono">
                <Badge variant="outline" className="text-primary border-primary/30">
                  -{resolution.costPaid.mp} {t('mpLabel')}
                </Badge>
                <Badge variant="outline" className="text-destructive border-destructive/40">
                  -{resolution.costPaid.san} SAN
                </Badge>
                {resolution.costPaid.hpFromMp > 0 && (
                  <Badge variant="outline" className="text-destructive font-bold border-destructive">
                    🩸 -{resolution.costPaid.hpFromMp} HP
                  </Badge>
                )}
                {resolution.costPaid.powPermanent > 0 && (
                  <Badge variant="outline" className="text-brass font-bold border-brass/30">
                    ⚡ -{resolution.costPaid.powPermanent} POW
                  </Badge>
                )}
              </div>
            </div>

            {/* Opcja forsowania przy porażce */}
            {canPush && (
              <div className="pt-2 flex items-center justify-between gap-3 bg-destructive/10 p-3 rounded border border-destructive/30">
                <div className="space-y-0.5 font-serif">
                  <p className="text-destructive font-semibold text-sm flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {t('pushedWarning')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleCast(true)}
                  disabled={isCasting}
                  className="text-sm font-serif shadow-deco shrink-0"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 animate-bounce" />
                  {t('btnPush')}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SpellCard;
