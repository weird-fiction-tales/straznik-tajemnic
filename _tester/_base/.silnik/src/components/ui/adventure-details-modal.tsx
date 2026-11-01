'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './dialog';
import { Button } from './button';
import { HelpIcon } from './tooltip';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './accordion';
import { MapPin, Clock, ScrollText, Lock, BookOpen } from 'lucide-react';
import type { AdventureContext } from '@/lib/adventures-data';
import {
  TONE_STYLES,
  ERA_STYLES,
  DIFFICULTY_STYLES,
} from '@/lib/data/adventure-styles';

interface AdventureDetailsModalProps {
  adventure: AdventureContext | null;
  open: boolean;
  onClose: () => void;
  /** Wybór tej przygody (zaznacza ją na liście) i zamknięcie modala. */
  onChoose: (adventure: AdventureContext) => void;
}

/**
 * Modal "Szczegóły scenariusza" (Dark Art Déco - standard 75% powierzchni ekranu).
 *
 * Prezentuje zwięzły, klimatyczny zarys sprawy (haczyk narracyjny) bez spoilerów
 * oraz czytelną siatkę metadanych śledztwa (miejsce, epoka, styl, czas i trudność).
 *
 * Pełna intryga, motywy i sugerowana obsada dla Mistrza Gry są ukryte
 * pod rozwijanymi aktami poufnymi ze spoiler-tagiem.
 */
export function AdventureDetailsModal({
  adventure,
  open,
  onClose,
  onChoose,
}: AdventureDetailsModalProps) {
  const t = useTranslations('AdventureDetailsModal');
  const tStyles = useTranslations('AdventureStyles');

  const toneStyle = TONE_STYLES[adventure?.tone || 'purist'] || TONE_STYLES.purist;
  const eraStyle = ERA_STYLES[adventure?.era || 'custom'] || ERA_STYLES.custom;
  const diffStyle =
    DIFFICULTY_STYLES[adventure?.difficulty || 'normal'] || DIFFICULTY_STYLES.normal;

  const ToneIcon = toneStyle.icon;
  const EraIcon = eraStyle.icon;

  const displayHook =
    adventure?.hook?.trim() ||
    adventure?.description?.split('.')[0]?.trim() + '.' ||
    '';

  // Czyste formatowanie lokacji bez duplikatów (np. "Polska, Polska")
  const displayLocation = useMemo(() => {
    if (!adventure?.location) return '-';
    const loc = adventure.location.trim();
    const country = adventure.country?.trim() || '';
    if (!country || loc.toLowerCase().includes(country.toLowerCase())) return loc;
    return `${loc}, ${country}`;
  }, [adventure?.location, adventure?.country]);

  // Czyste formatowanie epoki bez duplikatów lat
  const displayEra = useMemo(() => {
    if (!adventure) return '-';
    const era = tStyles(eraStyle.translationKey);
    const years = adventure.yearRange?.trim() || '';
    if (!years || era.includes(years)) return era;
    return `${era} (${years})`;
  }, [adventure, eraStyle, tStyles]);

  if (!adventure) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="wide"
        className="flex w-[80vw] h-[78vh] max-h-[85vh] flex-col overflow-hidden p-0 shadow-2xl"
      >
        {/* Narożniki déco */}
        <span className="pointer-events-none absolute left-2.5 top-2.5 h-5 w-5 border-l-2 border-t-2 border-brass/60" />
        <span className="pointer-events-none absolute right-2.5 top-2.5 h-5 w-5 border-r-2 border-t-2 border-brass/60" />
        <span className="pointer-events-none absolute bottom-2.5 left-2.5 h-5 w-5 border-b-2 border-l-2 border-brass/60" />
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 h-5 w-5 border-b-2 border-r-2 border-brass/60" />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 sm:p-10">
          <DialogHeader className="pt-2 pb-4">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-primary/60" />
              <span className="font-display text-xs sm:text-sm uppercase tracking-[0.35em] text-primary font-semibold">
                {t('eyebrow')}
              </span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-primary/60" />
            </div>

            <DialogTitle className="mx-auto mt-1 max-w-5xl break-words font-display text-2xl sm:text-4xl lg:text-5xl font-black uppercase tracking-[0.08em] text-foreground text-center leading-tight drop-shadow-md">
              {adventure.title}
            </DialogTitle>
            {adventure.source && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-brass/15 border border-brass/40 text-brass text-xs font-mono tracking-wider uppercase rounded-sm">
                  <BookOpen className="h-3.5 w-3.5 text-brass" />
                  Tom źródłowy: {adventure.source}
                </span>
              </div>
            )}
            <DialogDescription className="sr-only">
              {adventure.title}
            </DialogDescription>
          </DialogHeader>

          {/* Separator déco */}
          <div className="my-1 flex items-center justify-center gap-4">
            <div className="h-px flex-1 max-w-sm bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
            <span className="h-2.5 w-2.5 rotate-45 bg-brass border border-gold" />
            <div className="h-px flex-1 max-w-sm bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
          </div>

          {/* Haczyk narracyjny / lead (bez spoilerów) */}
          {displayHook && (
            <div className="relative mt-4 border border-brass/40 bg-card/75 p-6 sm:p-8 shadow-xl">
              <span className="pointer-events-none absolute -left-1 -top-1 h-3 w-3 border-l-2 border-t-2 border-gold" />
              <span className="pointer-events-none absolute -right-1 -top-1 h-3 w-3 border-r-2 border-t-2 border-gold" />
              <span className="pointer-events-none absolute -bottom-1 -left-1 h-3 w-3 border-b-2 border-l-2 border-gold" />
              <span className="pointer-events-none absolute -bottom-1 -right-1 h-3 w-3 border-b-2 border-r-2 border-gold" />

              <div className="flex items-center gap-2.5 mb-3">
                <ScrollText className="h-5 w-5 text-brass shrink-0" />
                <span className="font-display text-xs sm:text-sm uppercase tracking-[0.25em] text-brass font-bold">
                  {t('narrativeHookTitle')}
                </span>
              </div>
              <p className="font-serif text-xl sm:text-2xl italic leading-relaxed text-foreground/95 pl-1">
                {displayHook}
              </p>
            </div>
          )}

          {/* Siatka metadanych (4 przestronne karty 2x2 z dużymi fontami i pełnymi nazwami) */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Karta 1: Miejsce */}
            <div className="border border-brass/35 bg-card/50 p-5 sm:p-6 rounded-sm flex items-start gap-4.5 hover:border-gold/60 transition-colors">
              <div className="p-3 bg-brass/15 border border-brass/40 text-brass shrink-0 rounded-sm mt-0.5">
                <MapPin className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-display text-xs uppercase tracking-[0.18em] text-brass/90 block mb-1">
                  {t('metaLocation')}
                </span>
                <div
                  className="font-serif text-lg sm:text-xl font-bold text-foreground"
                  title={displayLocation}
                >
                  {displayLocation}
                </div>
              </div>
            </div>

            {/* Karta 2: Epoka */}
            <div className="border border-brass/35 bg-card/50 p-5 sm:p-6 rounded-sm flex items-start gap-4.5 hover:border-gold/60 transition-colors">
              <div className="p-3 bg-brass/15 border border-brass/40 text-brass shrink-0 rounded-sm mt-0.5">
                <EraIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-display text-xs uppercase tracking-[0.18em] text-brass/90">
                    {t('metaEra')}
                  </span>
                  <HelpIcon content={tStyles(eraStyle.descriptionKey)} />
                </div>
                <div className="font-serif text-lg sm:text-xl font-bold text-foreground">
                  {displayEra}
                </div>
              </div>
            </div>

            {/* Karta 3: Styl i nastrój */}
            <div className="border border-brass/35 bg-card/50 p-5 sm:p-6 rounded-sm flex items-start gap-4.5 hover:border-gold/60 transition-colors">
              <div className="p-3 bg-brass/15 border border-brass/40 text-brass shrink-0 rounded-sm mt-0.5">
                <ToneIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-display text-xs uppercase tracking-[0.18em] text-brass/90">
                    {t('metaTone')}
                  </span>
                  <HelpIcon content={tStyles(toneStyle.descriptionKey)} />
                </div>
                <div className="font-serif text-lg sm:text-xl font-bold text-foreground flex items-center gap-3">
                  <span>{tStyles(toneStyle.translationKey)}</span>
                  <span className="border border-brass/50 bg-brass/20 px-2.5 py-0.5 font-display text-xs uppercase tracking-wider text-brass">
                    {adventure.tone}
                  </span>
                </div>
              </div>
            </div>

            {/* Karta 4: Czas i wyzwanie */}
            <div className="border border-brass/35 bg-card/50 p-5 sm:p-6 rounded-sm flex items-start gap-4.5 hover:border-gold/60 transition-colors">
              <div className="p-3 bg-brass/15 border border-brass/40 text-brass shrink-0 rounded-sm mt-0.5">
                <Clock className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-display text-xs uppercase tracking-[0.18em] text-brass/90">
                    {t('metaDifficultySessions')}
                  </span>
                  <HelpIcon content={tStyles(diffStyle.descriptionKey)} />
                </div>
                <div className="font-serif text-lg sm:text-xl font-bold text-foreground flex items-center gap-3">
                  {adventure.estimatedSessions ? (
                    <>
                      <span>
                        {t('estimatedSessions', {
                          count: adventure.estimatedSessions,
                        })}
                      </span>
                      <span className="text-brass/60">·</span>
                    </>
                  ) : null}
                  <span className="text-emerald-400 font-semibold">
                    {tStyles(diffStyle.translationKey)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Akordeon akt poufnych dla Mistrza Gry (Spoilery) */}
          <div className="mt-6 border-t border-brass/25 pt-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem
                value="keeper-dossier"
                className="border border-brass/40 bg-card/40 rounded-none"
              >
                <AccordionTrigger className="p-5 sm:p-6 hover:no-underline group cursor-pointer">
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-11 h-11 bg-brass/15 border border-brass/40 rounded flex items-center justify-center text-brass text-xl shrink-0">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-display text-base sm:text-lg uppercase tracking-[0.16em] text-brass font-bold group-hover:text-foreground transition-colors flex items-center gap-3">
                        <span>{t('keeperDossierTitle')}</span>
                        <span className="bg-destructive/80 border border-destructive/50 text-destructive-foreground font-display text-[11px] font-bold uppercase px-2 py-0.5 tracking-wider">
                          MG only
                        </span>
                      </div>
                      <div className="font-serif text-sm italic text-muted-foreground mt-0.5">
                        {t('keeperDossierSubtitle')}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-6 px-5 sm:px-6 space-y-6">
                  {/* Pełny opis intrygi */}
                  {adventure.description && (
                    <div className="border-l-4 border-brass/60 pl-4 py-1">
                      <span className="font-display text-xs sm:text-sm font-bold uppercase tracking-[0.18em] text-brass block mb-2">
                        {t('keeperPlotTitle')}
                      </span>
                      <p className="font-serif text-base sm:text-lg leading-relaxed text-foreground/90 bg-card/50 p-4">
                        {adventure.description}
                      </p>
                    </div>
                  )}

                  {/* Sugerowane zawody i archetypy */}
                  {((adventure.suggestedOccupations &&
                    adventure.suggestedOccupations.length > 0) ||
                    (adventure.suggestedArchetypes &&
                      adventure.suggestedArchetypes.length > 0)) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                      {adventure.suggestedOccupations &&
                        adventure.suggestedOccupations.length > 0 && (
                          <div>
                            <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-brass block mb-2">
                              {t('suggestedOccupationsTitle')}
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {adventure.suggestedOccupations.map((occ) => (
                                <span
                                  key={occ}
                                  className="border border-border/80 bg-card/80 px-3 py-1 font-serif text-xs text-foreground/80"
                                >
                                  {occ}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      {adventure.suggestedArchetypes &&
                        adventure.suggestedArchetypes.length > 0 && (
                          <div>
                            <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-brass block mb-2">
                              {t('suggestedArchetypesTitle')}
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {adventure.suggestedArchetypes.map((arch) => (
                                <span
                                  key={arch}
                                  className="border border-border/80 bg-card/80 px-3 py-1 font-serif text-xs text-foreground/80"
                                >
                                  {arch}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Tagi klimatu */}
                  {adventure.themes && adventure.themes.length > 0 && (
                    <div className="pt-1">
                      <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-brass block mb-2">
                        {t('themesTitle')}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {adventure.themes.map((theme) => (
                          <span
                            key={theme}
                            className="border border-brass/40 bg-brass/10 px-3 py-1 font-display text-xs tracking-wider text-brass"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        {/* Przyciski akcji */}
        <div className="flex shrink-0 items-center justify-end gap-5 border-t border-brass/25 bg-card px-6 py-5 sm:px-10">
          <Button
            variant="outline"
            onClick={onClose}
            className="px-8 py-4 font-display font-bold uppercase tracking-[0.18em] text-xs sm:text-sm"
          >
            {t('close')}
          </Button>
          <Button
            onClick={() => {
              onChoose(adventure);
              onClose();
            }}
            className="px-10 py-4 font-display font-black uppercase tracking-[0.2em] text-sm sm:text-base bg-primary text-primary-foreground hover:brightness-110 shadow-[0_4px_18px_rgba(212,175,55,0.4)]"
          >
            {t('choose')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AdventureDetailsModal;
