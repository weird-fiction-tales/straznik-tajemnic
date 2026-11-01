'use client';

/**
 * @file sheet-magic.tsx
 * Sekcja Wiedza Tajemna, Tomy Mitów i Magia w Karcie Postaci (Dark Art Déco, CoC 7e RAW).
 */

import React from 'react';
import { useMagicLabels } from '@/components/ui/use-magic-labels';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Bookmark,
  ShieldAlert,
  Brain,
} from 'lucide-react';
import {
  getSpellDefinition,
  getTomeDefinition,
  tomeEngine,
} from '@/lib/magic';
import type { Character } from '@/lib/types';
import { getSkillValue } from '@/lib/types';

export interface SheetMagicProps {
  character: Character;
  onCharacterUpdate?: (char: Character) => void;
}

export function SheetMagic({ character, onCharacterUpdate }: SheetMagicProps) {
  const t = useTranslations('Magic');
  const labels = useMagicLabels();
  const locale = useLocale() === 'en' ? 'en' : 'pl';

  const magic = character.magic;
  const isSkeptic = magic?.belief === 'skeptic';
  const deferredSan = magic?.deferredSanLoss ?? 0;
  const knownSpells = Object.values(magic?.knownSpells ?? {});
  const studiedTomes = Object.values(magic?.tomeStudies ?? {});

  // Pobierz Mity Cthulhu
  let currentMythos = 0;
  if (character.skills) {
    for (const [sName, sVal] of Object.entries(character.skills)) {
      if (/mit|mythos|cthulhu/i.test(sName)) {
        currentMythos = getSkillValue(sVal);
        break;
      }
    }
  }

  // Dobrowolne przełamanie sceptycyzmu
  const handleConvertBelief = () => {
    if (!isSkeptic || !onCharacterUpdate) return;
    const conv = tomeEngine.convertBeliefToBeliever(
      character.name,
      deferredSan,
      currentMythos
    );

    const newSan = Math.max(0, (character.san || 0) - conv.sanLossApplied);
    const updatedMagic: NonNullable<typeof character.magic> = {
      schemaVersion: magic?.schemaVersion ?? 1,
      belief: 'believer',
      beliefConversionDate: new Date().toISOString(),
      beliefConversionReason: 'Dobrowolne uznanie faktów Mitów Cthulhu',
      deferredSanLoss: 0,
      knownSpells: magic?.knownSpells ?? {},
      tomeStudies: magic?.tomeStudies ?? {},
    };

    onCharacterUpdate({
      ...character,
      san: newSan,
      magic: updatedMagic,
    });
  };

  return (
    <div className="space-y-4 pt-2 border-t border-brass/20">
      {/* Nagłówek sekcji */}
      <h3 className="font-display uppercase tracking-[0.24em] text-brass text-xs font-semibold flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        {t('sheetMagicTitle')}
      </h3>

      {/* Pasek statusu wiary i długu psychicznego */}
      <div className="p-3 rounded-sm bg-card/60 border border-border/60 flex flex-col gap-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('sheetBeliefLabel')}</span>
            {isSkeptic ? (
              <Badge
                variant="outline"
                className="border-brass/50 text-brass font-mono cursor-help"
                title={t('beliefTooltipSkeptic')}
              >
                <ShieldAlert className="w-3 h-3 mr-1 inline" />
                {t('sheetBeliefSkeptic')}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-brass/40 text-primary font-mono cursor-help"
                title={t('beliefTooltipBeliever')}
              >
                <Brain className="w-3 h-3 mr-1 inline" />
                {t('sheetBeliefBeliever')}
              </Badge>
            )}
          </div>

          {deferredSan > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-destructive font-mono flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {t('sheetDeferredSan')} -{deferredSan} SAN
              </span>
              {isSkeptic && onCharacterUpdate && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleConvertBelief}
                  className="text-[11px] h-6 border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  {t('btnConvertBelief')}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Diegetyczne objaśnienie reguły CoC 7e RAW */}
        <p className="text-[11px] font-serif italic text-muted-foreground/80 leading-relaxed border-t border-border/40 pt-1.5">
          {isSkeptic ? t('beliefTooltipSkeptic') : t('beliefTooltipBeliever')}
        </p>
      </div>

      {/* Lista przestudiowanych tomów */}
      <div className="space-y-2">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          {t('sheetStudiedTomes')} ({studiedTomes.length})
        </div>

        {studiedTomes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {studiedTomes.map((entry) => {
              const tomeDef = getTomeDefinition(entry.tomeId);
              const title = tomeDef
                ? locale === 'en'
                  ? tomeDef.titleEn
                  : tomeDef.titlePl
                : entry.tomeId;

              return (
                <div
                  key={entry.tomeId}
                  className="p-2.5 rounded-sm bg-card/40 border border-brass/50 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-serif font-semibold text-foreground truncate">
                      {title}
                    </span>
                    {tomeDef?.language && (
                      <Badge variant="outline" className="text-[10px] border-border/40 text-muted-foreground">
                        {labels.language(tomeDef.language)}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px] font-mono text-muted-foreground">
                    {entry.initialReadingDone && (
                      <span className="text-emerald-400">✓ {t('sheetInitialReading', { gain: entry.cmiAwarded })}</span>
                    )}
                    {entry.fullStudyDone && (
                      <span className="text-brass">
                        ✓ {t('sheetFullStudy', { weeks: entry.completedWeeks, gain: entry.cmfAwarded })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/70 italic font-mono py-1">
            {t('sheetNoTomes')}
          </p>
        )}
      </div>

      {/* Lista poznanych zaklęć */}
      <div className="space-y-2">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          {t('sheetKnownSpells')} ({knownSpells.length})
        </div>

        {knownSpells.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {knownSpells.map((sp) => {
              const spellDef = getSpellDefinition(sp.spellId);
              const name = sp.knownAlias || (spellDef ? (locale === 'en' ? spellDef.nameEn : spellDef.namePl) : sp.spellId);
              const canonical = spellDef ? (locale === 'en' ? spellDef.nameEn : spellDef.namePl) : sp.spellId;

              return (
                <div
                  key={sp.spellId}
                  className="p-2.5 rounded-sm bg-card/40 border border-brass/40 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-serif font-semibold text-foreground truncate">
                      {name}
                    </span>
                    <Badge variant="outline" className="text-[10px] border-brass/40 text-primary font-mono">
                      {canonical}
                    </Badge>
                  </div>

                  {spellDef && (
                    <div className="flex flex-wrap gap-2 text-[11px] font-mono text-muted-foreground">
                      <span className="text-primary">🔮 {spellDef.mpCost} {t('mpLabel')}</span>
                      <span className="text-destructive">🧠 {labels.dice(spellDef.sanCost)} SAN</span>
                      <span>⏱️ {spellDef.castingTime.value[locale]}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-0.5 text-[10px] font-mono">
                    {sp.isFirstCastDone ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {t('sheetCastDone')}
                      </span>
                    ) : (
                      <span className="text-brass flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {t('sheetCastPending')}
                      </span>
                    )}
                    {sp.deeperUnlocked && (
                      <Badge className="bg-primary/10 text-primary text-[9px] border-none py-0">
                        {t('sheetDeeperStatus')}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/70 italic font-mono py-1">
            {t('sheetNoSpells')}
          </p>
        )}
      </div>
    </div>
  );
}
