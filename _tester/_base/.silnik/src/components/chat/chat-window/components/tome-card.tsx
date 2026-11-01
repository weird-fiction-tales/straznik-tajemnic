'use client';

import '@/components/ui/deco-window.css';

/**
 * @file tome-card.tsx
 * Karta badania i lektury tomisk Mitów w oknie czatu narracji (CoC 7e RAW & Poradniki MG).
 * Estetyka: Dark Art Déco Fiction First.
 */

import React, { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMagicLabels } from '@/components/ui/use-magic-labels';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Search,
  Brain,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Bookmark,
  ShieldAlert,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Dices,
  XCircle,
} from 'lucide-react';
import {
  getTomeDefinition,
  findTomeByAnyName,
  tomeEngine,
  type TomeDefinition,
  type InitialReadingResolution,
  type FullStudyResolution,
  type ReferenceCheckResolution,
  type BeliefConversionResolution,
} from '@/lib/magic';
import type { Character, TomeStudyEventData, SkillData } from '@/lib/types';
import { getSkillValue } from '@/lib/types';
import type { RollOutcome } from '@/lib/dice-utils';

export interface TomeCardProps {
  tomeEvent: TomeStudyEventData;
  activeCharacter?: Character | null;
  characters?: Character[];
  completed?: boolean;
  onCharacterUpdate?: (char: Character) => void;
  onSendChat?: (message: string) => void;
}

export function TomeCard({
  tomeEvent,
  activeCharacter,
  characters = [],
  completed = false,
  onCharacterUpdate,
  onSendChat,
}: TomeCardProps) {
  const t = useTranslations('Magic');
  const labels = useMagicLabels();
  const locale = useLocale() === 'en' ? 'en' : 'pl';

  const [isResolved, setIsResolved] = useState<boolean>(completed);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [showLoreGuide, setShowLoreGuide] = useState<boolean>(false);

  const [initialRes, setInitialRes] = useState<InitialReadingResolution | null>(null);
  const [fullStudyRes, setFullStudyRes] = useState<FullStudyResolution | null>(null);
  const [refRes, setRefRes] = useState<ReferenceCheckResolution | null>(null);
  const [conversionRes, setConversionRes] = useState<BeliefConversionResolution | null>(null);

  // Znajdź czytelnika/badacza
  const normalizeName = (val: string) => val.trim().toLowerCase().replace(/\s+/g, ' ');
  const characterPool = activeCharacter
    ? [activeCharacter, ...characters.filter((c) => c.id !== activeCharacter.id)]
    : characters;

  const reader = tomeEvent.characterId
    ? characterPool.find((c) => c.id === tomeEvent.characterId)
    : tomeEvent.characterName
    ? characterPool.find((c) => normalizeName(c.name) === normalizeName(tomeEvent.characterName || ''))
    : activeCharacter;

  // Znajdź definicję tomu w katalogu
  const tome: TomeDefinition | undefined =
    getTomeDefinition(tomeEvent.tomeId) || findTomeByAnyName(tomeEvent.tomeId);

  // Awaryjna definicja jeśli tom nie figuruje w podręcznikowym katalogu
  const effectiveTome: TomeDefinition = tome || {
    id: tomeEvent.tomeId,
    title: tomeEvent.title || tomeEvent.tomeId,
    titlePl: tomeEvent.title || tomeEvent.tomeId,
    titleEn: tomeEvent.title || tomeEvent.tomeId,
    author: 'Nieznany okultysta',
    language: 'Angielski',
    languageDifficulty: 'regular',
    initialReading: {
      hours: 12,
      sanCost: '1k4',
      cmi: 2,
    },
    fullStudy: {
      weeks: 24,
      sanCost: '1k6',
      cmf: 5,
      mr: 20,
    },
    spells: [],
    source: {
      sourceId: 'custom',
      title: 'Nieopisany manuskrypt',
      edition: '7e',
      page: 1,
      language: 'pl',
    },
    definitionVersion: 1,
  };

  // Stan badania tomu u badacza
  const tomeStudy = reader?.magic?.tomeStudies?.[effectiveTome.id];
  const isSkeptic = (reader?.magic?.belief ?? 'skeptic') === 'skeptic';
  const deferredSan = reader?.magic?.deferredSanLoss ?? 0;
  const initialDone = Boolean(tomeStudy?.initialReadingDone);
  const studyCount = tomeStudy?.studyCount ?? 0;
  const fullStudyDone = Boolean(tomeStudy?.fullStudyDone);
  const readerSan = reader?.san ?? 50;

  // Pobierz umiejętność językową badacza
  const findLanguageSkill = (lang: string): number => {
    if (!reader?.skills) return 50;
    const l = lang.toLowerCase();
    for (const [sName, sVal] of Object.entries(reader.skills)) {
      const nameL = sName.toLowerCase();
      if (nameL.includes(l) || (l.includes('łacin') && nameL.includes('latin')) || (l.includes('latin') && nameL.includes('łacin'))) {
        return getSkillValue(sVal);
      }
      if (l.includes('angielski') && (nameL.includes('ojczysty') || nameL.includes('own') || nameL.includes('angielski'))) {
        return getSkillValue(sVal);
      }
    }
    return l.includes('angielski') || l.includes('polski') ? 60 : 10;
  };

  const languageSkill = findLanguageSkill(effectiveTome.language);

  // Bieżące Mity Cthulhu
  const getMythosSkill = (): number => {
    if (!reader?.skills) return 0;
    for (const [sName, sVal] of Object.entries(reader.skills)) {
      if (/mit|mythos|cthulhu/i.test(sName)) {
        return getSkillValue(sVal);
      }
    }
    return 0;
  };
  const currentMythos = getMythosSkill();

  const getOutcomeBadge = (outcome?: RollOutcome) => {
    switch (outcome) {
      case 'critical':
        return <Badge className="bg-brass/10 text-brass border-brass/40">{t('outcomeCritical')}</Badge>;
      case 'extreme':
        return <Badge className="bg-primary/15 text-primary border-primary/40">{t('outcomeExtreme')}</Badge>;
      case 'hard':
        return <Badge className="bg-primary/10 text-primary border-primary/30">{t('outcomeHard')}</Badge>;
      case 'regular':
        return <Badge className="bg-muted text-muted-foreground border-border">{t('outcomeRegular')}</Badge>;
      case 'fail':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/40">{t('outcomeFail')}</Badge>;
      case 'fumble':
      default:
        return <Badge className="bg-destructive/30 text-destructive-foreground border-destructive/50">{t('outcomeFumble')}</Badge>;
    }
  };

  // 1. Wstępny przegląd (Initial Reading / Skimming)
  const handleInitialReading = () => {
    if (!reader || isResolved || isBusy) return;
    setIsBusy(true);

    try {
      const res = tomeEngine.resolveInitialReading(
        {
          tomeId: effectiveTome.id,
          investigatorLanguageSkill: languageSkill,
          languageDifficulty: effectiveTome.languageDifficulty,
          belief: reader.magic?.belief ?? 'skeptic',
        },
        effectiveTome
      );

      setInitialRes(res);
      setIsResolved(true);

      if (onCharacterUpdate) {
        const newSan = Math.max(0, (reader.san || 0) - res.sanLoss);
        const updatedSkills = { ...reader.skills };

        if (res.cmiGained > 0) {
          const mythosKey = Object.keys(updatedSkills).find((k) => /mit|mythos|cthulhu/i.test(k)) || 'Mity Cthulhu';
          const currentVal = getSkillValue(updatedSkills[mythosKey] ?? 0);
          const currentObj: SkillData =
            typeof updatedSkills[mythosKey] === 'object' && updatedSkills[mythosKey] !== null
              ? (updatedSkills[mythosKey] as SkillData)
              : { value: currentVal, markedForImprovement: false };

          updatedSkills[mythosKey] = {
            ...currentObj,
            value: currentVal + res.cmiGained,
          };
        }

        const currentTomes = reader.magic?.tomeStudies ?? {};
        const currentKnownSpells = reader.magic?.knownSpells ?? {};

        const updatedSpells = { ...currentKnownSpells };
        if (res.success && res.spellsDiscovered.length > 0) {
          for (const spId of res.spellsDiscovered) {
            if (!updatedSpells[spId]) {
              updatedSpells[spId] = {
                spellId: spId,
                learnedAt: new Date().toISOString(),
                source: 'tome',
                sourceId: effectiveTome.id,
                isFirstCastDone: false,
                deeperUnlocked: false,
                definitionVersion: 1,
              };
            }
          }
        }

        const updatedMagic: NonNullable<typeof reader.magic> = {
          schemaVersion: reader.magic?.schemaVersion ?? 1,
          belief: reader.magic?.belief ?? 'skeptic',
          deferredSanLoss: (reader.magic?.deferredSanLoss ?? 0) + res.deferredSanLoss,
          knownSpells: updatedSpells,
          tomeStudies: {
            ...currentTomes,
            [effectiveTome.id]: {
              tomeId: effectiveTome.id,
              initialReadingDone: res.success ? true : Boolean(tomeStudy?.initialReadingDone),
              fullStudyDone: Boolean(tomeStudy?.fullStudyDone),
              studyCount: tomeStudy?.studyCount ?? 0,
              completedWeeks: tomeStudy?.completedWeeks ?? 0,
              cmiAwarded: (tomeStudy?.cmiAwarded ?? 0) + res.cmiGained,
              cmfAwarded: tomeStudy?.cmfAwarded ?? 0,
              sanLossPaid: (tomeStudy?.sanLossPaid ?? 0) + res.sanLoss,
              definitionVersion: effectiveTome.definitionVersion,
            },
          },
        };

        onCharacterUpdate({
          ...reader,
          san: newSan,
          skills: updatedSkills,
          magic: updatedMagic,
        });
      }

      if (onSendChat) {
        const resultTag = `[WYNIK_TOMU: id=${tomeEvent.id} | tome=${effectiveTome.id} | akcja=skimming | badacz=${reader.name} | sukces=${res.success} | godziny=${res.hoursSpent} | san=${res.sanLoss} | deferred_san=${res.deferredSanLoss} | cmi=${res.cmiGained} | rzut=${res.languageRoll.roll}/${res.languageRoll.threshold}]`;
        const narrativeMessage = locale === 'en' ? res.message.en : res.message.pl;
        onSendChat(`${resultTag}\n\n${narrativeMessage}`);
      }
    } finally {
      setIsBusy(false);
    }
  };

  // 2. Sprawdzenie referencyjne (Reference Check: 1k4 h, rzut d100 vs MR)
  const handleReferenceCheck = () => {
    if (!reader || isResolved || isBusy) return;
    setIsBusy(true);

    try {
      const res = tomeEngine.resolveReferenceCheck(
        {
          tomeId: effectiveTome.id,
          topic: tomeEvent.topic,
        },
        effectiveTome
      );

      setRefRes(res);
      setIsResolved(true);

      if (onSendChat) {
        const resultTag = `[WYNIK_TOMU: id=${tomeEvent.id} | tome=${effectiveTome.id} | akcja=reference | badacz=${reader.name} | sukces=${res.success} | godziny=${res.hoursSpent} | rzut=${res.roll} | mr=${res.mythosRating}]`;
        const narrativeMessage = locale === 'en' ? res.message.en : res.message.pl;
        onSendChat(`${resultTag}\n\n${narrativeMessage}`);
      }
    } finally {
      setIsBusy(false);
    }
  };

  // 3. Pełne studium (Full Study)
  const handleFullStudy = () => {
    if (!reader || isResolved || isBusy) return;
    setIsBusy(true);

    try {
      const res = tomeEngine.resolveFullStudy(
        {
          tomeId: effectiveTome.id,
          investigatorSan: reader.san ?? 50,
          investigatorMythos: currentMythos,
          studyCount,
          belief: reader.magic?.belief ?? 'skeptic',
        },
        effectiveTome
      );

      setFullStudyRes(res);
      setIsResolved(true);

      if (onCharacterUpdate) {
        const newSan = Math.max(0, (reader.san || 0) - res.sanLoss);
        const updatedSkills = { ...reader.skills };

        if (res.cmfGained > 0) {
          const mythosKey = Object.keys(updatedSkills).find((k) => /mit|mythos|cthulhu/i.test(k)) || 'Mity Cthulhu';
          const currentVal = getSkillValue(updatedSkills[mythosKey] ?? 0);
          const currentObj: SkillData =
            typeof updatedSkills[mythosKey] === 'object' && updatedSkills[mythosKey] !== null
              ? (updatedSkills[mythosKey] as SkillData)
              : { value: currentVal, markedForImprovement: false };

          updatedSkills[mythosKey] = {
            ...currentObj,
            value: currentVal + res.cmfGained,
          };
        }

        const currentTomes = reader.magic?.tomeStudies ?? {};
        const updatedMagic: NonNullable<typeof reader.magic> = {
          schemaVersion: reader.magic?.schemaVersion ?? 1,
          belief: reader.magic?.belief ?? 'skeptic',
          deferredSanLoss: (reader.magic?.deferredSanLoss ?? 0) + res.deferredSanLoss,
          knownSpells: reader.magic?.knownSpells ?? {},
          tomeStudies: {
            ...currentTomes,
            [effectiveTome.id]: {
              tomeId: effectiveTome.id,
              initialReadingDone: Boolean(tomeStudy?.initialReadingDone),
              fullStudyDone: true,
              studyCount: studyCount + 1,
              completedWeeks: (tomeStudy?.completedWeeks ?? 0) + res.weeksRequired,
              cmiAwarded: tomeStudy?.cmiAwarded ?? 0,
              cmfAwarded: (tomeStudy?.cmfAwarded ?? 0) + res.cmfGained,
              sanLossPaid: (tomeStudy?.sanLossPaid ?? 0) + res.sanLoss,
              definitionVersion: effectiveTome.definitionVersion,
            },
          },
        };

        onCharacterUpdate({
          ...reader,
          san: newSan,
          skills: updatedSkills,
          magic: updatedMagic,
        });
      }

      if (onSendChat) {
        const resultTag = `[WYNIK_TOMU: id=${tomeEvent.id} | tome=${effectiveTome.id} | akcja=study | badacz=${reader.name} | sukces=${res.sanRoll.success} | tygodnie=${res.weeksRequired} | san=${res.sanLoss} | cmf=${res.cmfGained} | rzut=${res.sanRoll.roll}/${res.sanRoll.sanTarget}]`;
        const narrativeMessage = locale === 'en' ? res.message.en : res.message.pl;
        onSendChat(`${resultTag}\n\n${narrativeMessage}`);
      }
    } finally {
      setIsBusy(false);
    }
  };

  // 4. Przełamanie sceptycyzmu
  const handleConvertBelief = () => {
    if (!reader || isBusy) return;
    setIsBusy(true);

    try {
      const conv = tomeEngine.convertBeliefToBeliever(
        reader.name,
        deferredSan,
        currentMythos
      );

      setConversionRes(conv);

      if (onCharacterUpdate) {
        const newSan = Math.max(0, (reader.san || 0) - conv.sanLossApplied);
        const updatedMagic: NonNullable<typeof reader.magic> = {
          schemaVersion: reader.magic?.schemaVersion ?? 1,
          belief: 'believer',
          beliefConversionDate: new Date().toISOString(),
          beliefConversionReason: 'Zderzenie z prawdą Mitów i przełamanie sceptycyzmu',
          deferredSanLoss: 0,
          knownSpells: reader.magic?.knownSpells ?? {},
          tomeStudies: reader.magic?.tomeStudies ?? {},
        };

        onCharacterUpdate({
          ...reader,
          san: newSan,
          magic: updatedMagic,
        });
      }

      if (onSendChat) {
        const resultTag = `[WYNIK_TOMU: id=${tomeEvent.id} | akcja=belief_conversion | badacz=${reader.name} | san=${conv.sanLossApplied} | int_check=${conv.intCheckRequired}]`;
        const narrativeMessage = locale === 'en' ? conv.message.en : conv.message.pl;
        onSendChat(`${resultTag}\n\n${narrativeMessage}`);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const tomeTitle = locale === 'en' ? effectiveTome.titleEn : effectiveTome.titlePl;

  return (
    <Card className="deco-window my-3 overflow-hidden border border-brass/30 bg-card text-foreground shadow-deco">
      {/* Nagłówek klimatyczny Dark Art Déco */}
      <div className="border-b border-brass/20 bg-background px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-sm border border-brass/40 bg-brass/10 p-1">
              <BookOpen className="h-4 w-4 text-brass" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-serif text-base font-semibold tracking-wide text-foreground">
                {tomeTitle}
              </span>
              <Badge variant="outline" className="text-sm border-brass/40 text-brass font-mono whitespace-normal">
                {labels.language(effectiveTome.language)} ({t(`languageDifficulty.${effectiveTome.languageDifficulty}`)})
              </Badge>
              {effectiveTome.source && (
                <Badge variant="outline" className="text-sm border-border/50 text-muted-foreground whitespace-normal">
                  <Bookmark className="w-3 h-3 mr-1 inline" />
                  {labels.source(effectiveTome.source.title)}, {t('sourcePageLabel')} {effectiveTome.source.page}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLoreGuide(!showLoreGuide)}
              className="min-h-10 flex items-center gap-1 text-sm font-mono text-primary hover:text-foreground transition-colors px-2 rounded-md hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title={showLoreGuide ? t('hideLoreGuide') : t('showLoreGuide')}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('toggleTomeGuide')}</span>
              {showLoreGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {isResolved && (
              <Badge className="border-primary/40 bg-primary/10 font-mono text-sm text-primary">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {t('btnTomeResolved')}
              </Badge>
            )}
          </div>
        </div>

        {effectiveTome.author && (
          <p className="mt-1 text-sm text-muted-foreground italic font-serif">
            {t('authorLabel')} {labels.author(effectiveTome.author)}
          </p>
        )}

        {/* Zwijany mini-przewodnik zasad badania tomów CoC 7e RAW */}
        {showLoreGuide && (
          <div className="mt-3 rounded-md border border-brass/30 bg-background p-3 space-y-2 text-sm text-foreground">
            <p className="font-display text-base font-semibold text-brass flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              {t('tomeLoreTitle')}
            </p>
            <ul className="space-y-1 text-sm list-disc list-inside text-foreground">
              <li>{t('tomeLoreSkimming')}</li>
              <li>{t('tomeLoreReference')}</li>
              <li>{t('tomeLoreFullStudy')}</li>
            </ul>
            <div className="pt-2 border-t border-brass/30 space-y-1 text-sm font-mono text-muted-foreground">
              <p>• {t('tomeGlossaryCmi')}</p>
              <p>• {t('tomeGlossaryCmf')}</p>
              <p>• {t('tomeGlossaryMr')}</p>
            </div>
          </div>
        )}

        {/* Ostrzeżenie / status Wiary dla sceptyka */}
        {isSkeptic && (
          <div className="mt-2 flex items-start gap-1.5 text-sm text-brass font-mono">
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{t('skepticTomeNotice')}</span>
          </div>
        )}

        {deferredSan > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-brass flex-shrink-0" />
              <span>{t('deferredSanDebtNotice', { san: deferredSan })}</span>
            </div>
            {isSkeptic && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleConvertBelief}
                disabled={isBusy}
                className="min-h-10 text-sm border-destructive/50 text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t('btnConvertBelief')}
              </Button>
            )}
          </div>
        )}

        {/* Statusy wcześniejszego ukończenia */}
        {(initialDone || fullStudyDone) && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-mono text-primary">
            {initialDone && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {t('initialReadingDoneNotice', { cmi: tomeStudy?.cmiAwarded ?? effectiveTome.initialReading.cmi })}
              </span>
            )}
            {fullStudyDone && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {t('fullStudyDoneNotice', { cmf: tomeStudy?.cmfAwarded ?? effectiveTome.fullStudy.cmf })}
              </span>
            )}
          </div>
        )}
      </div>

      <CardContent className="space-y-4 p-4">
        {/* Stan 1: Przed wykonaniem akcji – 3 czytelne kafle Fiction First */}
        {!isResolved && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Panel 1: Pobieżny przegląd */}
            <div className="flex flex-col justify-between rounded-md border border-brass/30 bg-background p-4 space-y-3 hover:border-primary/50 transition-colors">
              <div className="space-y-1.5">
                <div className="flex min-w-0 flex-col items-start gap-2">
                  <span className="font-display text-base font-semibold text-brass flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    {t('panelSkimmingTitle')}
                  </span>
                  <Badge variant="outline" className="text-sm font-mono border-brass/40 text-brass max-w-full whitespace-normal break-words">
                    {t('panelSkimmingTime', { hours: effectiveTome.initialReading.hours })}
                  </Badge>
                </div>
                <p className="text-sm font-mono text-muted-foreground">
                  {t('panelSkimmingTest', { lang: labels.language(effectiveTome.language), val: languageSkill })}
                </p>
                <div className="space-y-1 text-sm font-mono pt-1">
                  <p className="text-primary">✓ {t('panelSkimmingGain', { cmi: effectiveTome.initialReading.cmi })}</p>
                  <p className="text-destructive">🧠 -{labels.dice(effectiveTome.initialReading.sanCost)} SAN</p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={handleInitialReading}
                disabled={isBusy || initialDone}
                className="mt-2 min-h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 font-serif text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
              >
                {initialDone ? t('btnCompleted') : t('btnInitialReading', { hours: effectiveTome.initialReading.hours })}
              </Button>
            </div>

            {/* Panel 2: Wyszukanie w księdze (Reference Check w śledztwie) */}
            <div className="flex flex-col justify-between rounded-md border border-brass/30 bg-background p-4 space-y-3 hover:border-primary/50 transition-colors">
              <div className="space-y-1.5">
                <div className="flex min-w-0 flex-col items-start gap-2">
                  <span className="font-display text-base font-semibold text-brass flex items-center gap-1">
                    <Search className="w-3.5 h-3.5" />
                    {t('panelReferenceTitle')}
                  </span>
                  <Badge variant="outline" className="text-sm font-mono border-brass/40 text-brass max-w-full whitespace-normal break-words">
                    {t('panelReferenceTime')}
                  </Badge>
                </div>
                <p className="text-sm font-mono text-muted-foreground">
                  {t('panelReferenceTest', { mr: effectiveTome.fullStudy.mr })}
                </p>
                <div className="space-y-1 text-sm font-mono pt-1">
                  <p className="text-primary">✓ {t('panelReferenceGain')}</p>
                  <p className="text-primary">{t('panelReferenceNoSan')}</p>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleReferenceCheck}
                disabled={isBusy}
                className="mt-2 min-h-10 w-full border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 font-serif text-sm focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t('btnReferenceCheck')}
              </Button>
            </div>

            {/* Panel 3: Pełne studia (Full Study w downtime) */}
            <div className="flex flex-col justify-between rounded-md border border-brass/30 bg-background p-4 space-y-3 hover:border-primary/50 transition-colors">
              <div className="space-y-1.5">
                <div className="flex min-w-0 flex-col items-start gap-2">
                  <span className="font-display text-base font-semibold text-brass flex items-center gap-1">
                    <Brain className="w-3.5 h-3.5" />
                    {t('panelFullStudyTitle')}
                  </span>
                  <Badge variant="outline" className="text-sm font-mono border-brass/40 text-brass max-w-full whitespace-normal break-words">
                    {t('panelFullStudyTime', { weeks: effectiveTome.fullStudy.weeks * Math.pow(2, studyCount) })}
                  </Badge>
                </div>
                <p className="text-sm font-mono text-muted-foreground">
                  {t('panelFullStudyTest', { san: readerSan })}
                </p>
                <div className="space-y-1 text-sm font-mono pt-1">
                  <p className="text-primary">✓ {t('panelFullStudyGain', { cmf: effectiveTome.fullStudy.cmf, mr: effectiveTome.fullStudy.mr })}</p>
                  <p className="text-destructive">🧠 -{labels.dice(effectiveTome.fullStudy.sanCost)} SAN ({t('sanSaveHalf')})</p>
                </div>
              </div>

              <Button
                size="sm"
                variant="secondary"
                onClick={handleFullStudy}
                disabled={isBusy}
                className="mt-2 min-h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 font-serif text-sm border border-primary/60 focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t('btnFullStudy', { weeks: effectiveTome.fullStudy.weeks * Math.pow(2, studyCount) })}
              </Button>
            </div>
          </div>
        )}

        {/* Stan 2: Po wykonaniu akcji – Wynik rzutów kośćmi K100 */}
        {isResolved && (
          <div className="space-y-3 rounded-lg border border-brass/30 bg-background/60 p-4 text-sm font-mono">
            {initialRes && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-muted-foreground text-sm">
                  <span className="font-serif">
                    {t('rollLanguageCheck', { lang: labels.language(effectiveTome.language), threshold: initialRes.languageRoll.threshold })}
                  </span>
                  <span>{initialRes.hoursSpent}h</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Dices className="h-4 w-4 text-brass" />
                  <span className="text-base font-bold text-foreground">
                    K100: {initialRes.languageRoll.roll} / {initialRes.languageRoll.threshold}
                  </span>
                  {getOutcomeBadge(initialRes.languageRoll.outcome)}
                </div>
                <p className="text-muted-foreground font-serif text-sm leading-relaxed pt-1">
                  {locale === 'en' ? initialRes.message.en : initialRes.message.pl}
                </p>
              </div>
            )}

            {refRes && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-muted-foreground text-sm">
                  <span className="font-serif">
                    {t('rollReferenceCheck', { mr: refRes.mythosRating })}
                  </span>
                  <span>{refRes.hoursSpent}h</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Dices className="h-4 w-4 text-primary" />
                  <span className="text-base font-bold text-foreground">
                    K100: {refRes.roll} / {refRes.mythosRating}
                  </span>
                  {getOutcomeBadge(refRes.outcome)}
                </div>
                <p className="text-muted-foreground font-serif text-sm leading-relaxed pt-1">
                  {locale === 'en' ? refRes.message.en : refRes.message.pl}
                </p>
              </div>
            )}

            {fullStudyRes && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-muted-foreground text-sm">
                  <span className="font-serif">
                    {t('rollSanDefense', { target: fullStudyRes.sanRoll.sanTarget })}
                  </span>
                  <span>{fullStudyRes.weeksRequired} tyg.</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Dices className="h-4 w-4 text-primary" />
                  <span className="text-base font-bold text-foreground">
                    K100: {fullStudyRes.sanRoll.roll} / {fullStudyRes.sanRoll.sanTarget}
                  </span>
                  {getOutcomeBadge(fullStudyRes.sanRoll.outcome)}
                </div>
                <p className="text-muted-foreground font-serif text-sm leading-relaxed pt-1">
                  {locale === 'en' ? fullStudyRes.message.en : fullStudyRes.message.pl}
                </p>
              </div>
            )}

            {conversionRes && (
              <div className="p-3 rounded border border-destructive/50 bg-destructive/15 space-y-1 text-destructive">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{t('beliefConvertedNotice', { san: conversionRes.sanLossApplied })}</span>
                </div>
                {conversionRes.intCheckRequired && (
                  <p className="text-sm font-mono">
                    {t('intCheckRequiredNotice')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TomeCard;
