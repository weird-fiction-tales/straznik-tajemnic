'use client';

import type { ChangeEvent, MouseEvent } from 'react';
import { useMemo, useState, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
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
  BUILT_IN_ADVENTURES,
  AdventureContext,
  CustomAdventure,
} from '@/lib/adventures-data';
import {
  ERA_STYLES,
  DIFFICULTY_STYLES,
} from '@/lib/data/adventure-styles';
import {
  Trash2,
  Upload,
  Loader2,
  FileText,
  Info,
  MapPin,
  Clock,
  Book,
  BookOpen,
  Library,
  BookmarkCheck,
  Lock,
  AlertCircle,
  Check,
  Users,
} from 'lucide-react';

/**
 * Wbudowane scenariusze pokazujemy TYLKO w trybie pełnym/prywatnym
 * (NEXT_PUBLIC_LOCAL_MODE=true). W wersji publicznej gracz wnosi własny scenariusz.
 */
const SHOW_BUILT_IN_ADVENTURES = process.env.NEXT_PUBLIC_LOCAL_MODE === 'true';

interface AdventureSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (adventure: AdventureContext) => void;
  customAdventures?: CustomAdventure[];
  onUploadAdventure?: (file: File) => Promise<CustomAdventure | null>;
  onDeleteAdventure?: (id: string) => Promise<void>;
  onToggleAttachLorebook?: (adventureId: string, lorebookId: string) => Promise<void>;
  isUploading?: boolean;
  uploadProgress?: number;
  loadingStatus?: string;
  uploadError?: string | null;
  onClearUploadError?: () => void;
}

export function AdventureSelector({
  open,
  onClose,
  onSelect,
  customAdventures = [],
  onUploadAdventure,
  onDeleteAdventure,
  onToggleAttachLorebook,
  isUploading = false,
  uploadProgress = 0,
  loadingStatus = '',
  uploadError = null,
  onClearUploadError,
}: AdventureSelectorProps) {
  const t = useTranslations('AdventureSelector');
  const locale = useLocale() === 'en' ? 'en' : 'pl';
  const tStyles = useTranslations('AdventureStyles');

  const [activeTab, setActiveTab] = useState<'scenarios' | 'lorebooks'>('scenarios');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loreFileInputRef = useRef<HTMLInputElement>(null);

  // Podział własnych materiałów na scenariusze śledcze i księgi wiedzy / kompendia
  const customScenarios = useMemo(
    () => customAdventures.filter((a) => !a.documentType || a.documentType === 'scenario'),
    [customAdventures]
  );
  const customLorebooks = useMemo(
    () => customAdventures.filter((a) => a.documentType === 'setting' || a.documentType === 'compendium'),
    [customAdventures]
  );

  const handleSelect = (adventure: AdventureContext) => {
    setSelectedId(adventure.id);
  };

  const handleConfirm = () => {
    if (selectedId) {
      const selected =
        customAdventures.find((a) => a.id === selectedId) ||
        (SHOW_BUILT_IN_ADVENTURES ? BUILT_IN_ADVENTURES.find((a) => a.id === selectedId) : null);
      if (selected) {
        onSelect(selected);
      }
    }
    onClose();
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadAdventure) return;

    const newAdventure = await onUploadAdventure(file);
    if (newAdventure) {
      setSelectedId(newAdventure.id);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (loreFileInputRef.current) {
      loreFileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string, e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!onDeleteAdventure) return;

    const target = e.currentTarget as HTMLElement;
    target.blur();
    document.body.focus();

    await new Promise((resolve) => setTimeout(resolve, 100));

    const confirmed = window.confirm(t('deleteConfirm'));
    if (!confirmed) return;

    setDeletingId(id);
    await onDeleteAdventure(id);
    setDeletingId(null);

    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const selectedAdventure = selectedId
    ? BUILT_IN_ADVENTURES.find((a) => a.id === selectedId) ||
      customAdventures.find((a) => a.id === selectedId)
    : null;

  // Komponent karty przygody (DRY)
  const AdventureCard = ({
    adventure,
    isCustom = false,
    isLorebook = false,
  }: {
    adventure: AdventureContext | CustomAdventure;
    isCustom?: boolean;
    isLorebook?: boolean;
  }) => {
    const eraStyle = ERA_STYLES[adventure.era] || ERA_STYLES.custom;
    const diffStyle =
      DIFFICULTY_STYLES[adventure.difficulty] || DIFFICULTY_STYLES.normal;
    const isSelected = selectedId === adventure.id;
    const isDeleting = deletingId === adventure.id;
    const customAdv = adventure as CustomAdventure;

    const EraIcon = eraStyle.icon;
    const DiffIcon = diffStyle.icon;

    // Czyste formatowanie lokacji bez duplikatów (np. "Polska, Polska")
    const displayLocation = useMemo(() => {
      const loc = adventure.location?.trim() || '';
      const country = adventure.country?.trim() || '';
      if (!loc) return country || 'Nieznana lokacja';
      if (!country || loc.toLowerCase().includes(country.toLowerCase())) return loc;
      return `${loc}, ${country}`;
    }, [adventure.location, adventure.country]);

    // Czyste formatowanie epoki i lat bez duplikatów (np. "(1981) (1981)")
    const displayEra = useMemo(() => {
      const era = adventure.eraLabel?.trim() || 'Klasyczna';
      const years = adventure.yearRange?.trim() || '';
      if (!years || era.includes(years)) return era;
      return `${era} (${years})`;
    }, [adventure.eraLabel, adventure.yearRange]);

    // 1-5 gwiazdek trudności wg oficjalnej legendy Black Monk / Chaosium
    const starsCount =
      adventure.difficultyStars ||
      (adventure.difficulty === 'easy' ? 2 : adventure.difficulty === 'hard' ? 4 : 3);
    const difficultyLabel = useMemo(() => {
      if (adventure.difficultyStars === 1) return t('difficultyStar1');
      if (adventure.difficultyStars === 2) return t('difficultyStar2');
      if (adventure.difficultyStars === 3) return t('difficultyStar3');
      if (adventure.difficultyStars === 4) return t('difficultyStar4');
      if (adventure.difficultyStars === 5) return t('difficultyStar5');
      return tStyles(diffStyle.translationKey);
    }, [adventure.difficultyStars, adventure.difficulty, diffStyle, tStyles, t]);

    const sessions = adventure.estimatedSessions || '2-3';
    const plural = new Intl.PluralRules(locale).select(Number(sessions));
    const sessionKey = /^\d+$/.test(sessions) && plural === 'one'
      ? 'singleSession'
      : /^\d+$/.test(sessions) && plural === 'few' ? 'fewSessions' : 'sessionsCount';

    return (
      <div
        onClick={() => {
          handleSelect(adventure);
        }}
        className={`group relative p-4 text-left cursor-pointer transition-all duration-300 select-none rounded-sm ${
          isSelected && !isLorebook
            ? 'border-2 border-primary bg-[#0f1715] shadow-[0_0_22px_rgba(13,148,136,0.3)] ring-1 ring-primary/60'
            : 'border border-brass/30 bg-[#16130f] hover:border-brass/65 hover:bg-[#1a1612]'
        } ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {/* Narożniki déco */}
        <span
          className={`pointer-events-none absolute left-1.5 top-1.5 h-3 w-3 border-l-2 border-t-2 ${
            isSelected && !isLorebook ? 'border-primary' : 'border-brass/45'
          }`}
        />
        <span
          className={`pointer-events-none absolute right-1.5 bottom-1.5 h-3 w-3 border-r-2 border-b-2 ${
            isSelected && !isLorebook ? 'border-primary' : 'border-brass/45'
          }`}
        />

        {/* Źródło / Tom zbioru jeśli dotyczy */}
        {adventure.source && (
          <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-mono font-medium uppercase tracking-wider text-brass bg-brass/10 px-2 py-0.5 rounded border border-brass/50">
            <BookOpen className="h-3 w-3 text-brass shrink-0" />
            <span>Z tomu: {adventure.source}</span>
          </div>
        )}

        {/* Header: Tytuł w naturalnym casing + wskaźnik wyboru / typ */}
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3
            className="font-display text-lg font-bold text-brass leading-snug tracking-wide group-hover:text-white transition-colors"
            title={adventure.title}
          >
            {adventure.title}
          </h3>

          <div className="flex shrink-0 items-center gap-2">
            {isLorebook && adventure.documentType && (
              <span className="inline-flex items-center gap-1 border border-brass/40 bg-brass/10 px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-brass">
                <Book className="h-3 w-3 text-brass" />
                {adventure.documentType === 'setting' ? t('docTypeSetting') : t('docTypeCompendium')}
              </span>
            )}
            {isSelected && !isLorebook && (
              <span
                aria-label={t('selectedAria')}
                className="flex items-center gap-1 bg-primary/20 text-primary border border-primary px-2 py-0.5 text-xs font-display font-semibold uppercase tracking-wider shadow-[0_0_12px_rgba(13,148,136,0.3)] rounded-sm"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{t('selectedCard')}</span>
              </span>
            )}
          </div>
        </div>

        {/* Meta info: Epoka i Czysta Lokacja */}
        <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-serif text-sm text-muted-foreground">
          <span className={`inline-flex items-center gap-1 ${eraStyle.color}`}>
            <EraIcon className="h-3.5 w-3.5 shrink-0 text-brass/70" />
            {displayEra}
          </span>
          <span className="text-brass/40 not-italic">·</span>
          <span className="inline-flex items-center gap-1 text-foreground/90">
            <MapPin className="h-3.5 w-3.5 text-brass/70 shrink-0" />
            {displayLocation}
          </span>
          {adventure.lorebookData?.regionOrTheme && (
            <>
              <span className="text-brass/40 not-italic">·</span>
              <span className="text-gold font-sans text-xs not-italic">
                {t('loreRegionLabel')} {adventure.lorebookData.regionOrTheme}
              </span>
            </>
          )}
        </div>

        {/* Haczyk narracyjny - zarys fabuły */}
        <p className="mb-3 line-clamp-3 font-sans text-sm text-foreground/85 leading-relaxed">
          {adventure.hook || adventure.description?.slice(0, 180)}
        </p>

        {/* Wymogi Badaczy (jeśli scenariusz definiuje np. wiek, postacie pregen) */}
        {adventure.investigatorRequirements && (
          <div className="mb-2.5 inline-flex items-center gap-1.5 text-xs font-serif bg-brass/10 text-brass border border-brass/50 px-2.5 py-1 rounded-sm w-full">
            <Users className="h-3.5 w-3.5 text-brass shrink-0" />
            <span className="font-semibold uppercase tracking-wider text-[11px] text-brass shrink-0">
              Wymogi:
            </span>
            <span className="line-clamp-1">{adventure.investigatorRequirements.summary}</span>
          </div>
        )}

        {/* Zagadki i Handouty */}
        {(adventure.puzzles?.length || adventure.handouts?.length) ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-mono">
            {adventure.puzzles && adventure.puzzles.length > 0 && (
              <span className="inline-flex items-center gap-1 bg-brass/10 text-brass border border-brass/40 px-2 py-0.5 rounded">
                <span>🧩 Zagadka: {adventure.puzzles[0].title}</span>
              </span>
            )}
            {adventure.handouts && adventure.handouts.length > 0 && (
              <span className="inline-flex items-center gap-1 bg-emerald-950/30 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded">
                <span>📜 {adventure.handouts.length} pomocy dla graczy</span>
              </span>
            )}
          </div>
        ) : null}

        {/* Footer */}
        <div className="flex items-center justify-between font-display text-xs uppercase tracking-wider text-muted-foreground border-t border-brass/20 pt-2.5 mt-auto">
          {!isLorebook ? (
            <span className="inline-flex items-center gap-1 text-brass/80">
              <Clock className="h-3.5 w-3.5 text-brass/70 shrink-0" />
              <span>
                {t(sessionKey, { count: sessions })}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-brass/80">
              <Book className="h-3.5 w-3.5 text-brass/70 shrink-0" />
              <span>Kompendium wiedzy</span>
            </span>
          )}

          <div className="flex items-center gap-2.5">
            {!isLorebook && (
              <span className={`inline-flex items-center gap-1.5 ${diffStyle.color}`}>
                <span className="text-brass font-mono tracking-tighter text-sm">
                  {'★'.repeat(starsCount)}
                  {'☆'.repeat(Math.max(0, 5 - starsCount))}
                </span>
                <span>{difficultyLabel}</span>
              </span>
            )}

            {/* Przycisk wyboru dla scenariuszy */}
            {!isLorebook && (
              <Button
                type="button"
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(adventure);
                }}
                className={`h-7 px-3 text-xs font-display uppercase tracking-wider transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-[0_0_12px_rgba(13,148,136,0.4)]'
                    : 'border-brass/35 text-brass hover:text-foreground hover:border-brass'
                }`}
              >
                {isSelected ? t('selectedCard') : t('selectCard')}
              </Button>
            )}

            {/* Przycisk usuwania dla własnych materiałów */}
            {isCustom && onDeleteAdventure && (
              <button
                type="button"
                onClick={(e) => handleDelete(adventure.id, e)}
                disabled={isDeleting}
                className="inline-flex items-center gap-1 text-destructive/80 hover:text-red-300 transition-colors p-1 ml-1"
                title={t('deleteAdventureTitle')}
                aria-label={t('deleteButton')}
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* PDF Badge dla własnych plików */}
        {isCustom && customAdv.fileName && (
          <div className="mt-2 flex items-center gap-1.5 font-mono text-xs text-muted-foreground/80">
            <FileText className="h-3 w-3 shrink-0 text-brass/60" />
            <span className="max-w-[240px] truncate">{customAdv.fileName}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent size="screen">
          {/* Narożniki déco */}
          <span className="pointer-events-none absolute left-2 top-2 h-4 w-4 border-l-2 border-t-2 border-brass/55" />
          <span className="pointer-events-none absolute right-2 top-2 h-4 w-4 border-r-2 border-t-2 border-brass/55" />
          <span className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-brass/55" />
          <span className="pointer-events-none absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 border-brass/55" />

          <DialogHeader className="text-center sm:text-center">
            <div className="font-special-elite text-[14px] uppercase tracking-[0.4em] text-primary">
              {t('eyebrow')}
            </div>
            <DialogTitle className="mt-1 justify-center text-center font-display-decorative text-3xl font-black uppercase tracking-[0.12em] text-foreground">
              {t('title')}
            </DialogTitle>
            <DialogDescription className="text-center font-serif text-base italic text-muted-foreground">
              {t('description')}
              {customAdventures.length > 0 &&
                ` ${t('customCountSuffix', { count: customAdventures.length })}`}
            </DialogDescription>
          </DialogHeader>

          {/* Separator déco */}
          <div className="mt-3 flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold" />
            <span className="h-2 w-2 rotate-45 bg-brass" />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold" />
          </div>

          {/* Pasek zakładek Dark Art Déco: Scenariusze vs Lorebooki */}
          <div className="mt-4 flex items-center justify-center gap-2 border-b border-brass/25 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('scenarios')}
              className={`flex items-center gap-2 px-4 py-2 font-display text-xs font-semibold uppercase tracking-[0.16em] transition-all duration-200 ${
                activeTab === 'scenarios'
                  ? 'border-b-2 border-primary text-primary bg-primary/10 shadow-[0_0_12px_rgba(13,148,136,0.2)]'
                  : 'text-muted-foreground hover:text-brass hover:bg-brass/5'
              }`}
            >
              <Library className="h-4 w-4" />
              {t('tabScenarios')}
              <span className="font-special-elite text-xs text-brass/70">
                ({(SHOW_BUILT_IN_ADVENTURES ? BUILT_IN_ADVENTURES.length : 0) + customScenarios.length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('lorebooks')}
              className={`flex items-center gap-2 px-4 py-2 font-display text-xs font-semibold uppercase tracking-[0.16em] transition-all duration-200 ${
                activeTab === 'lorebooks'
                  ? 'border-b-2 border-primary text-primary bg-primary/10 shadow-[0_0_12px_rgba(13,148,136,0.2)]'
                  : 'text-muted-foreground hover:text-brass hover:bg-brass/5'
              }`}
            >
              <Book className="h-4 w-4" />
              {t('tabLorebooks')}
              <span className="font-special-elite text-xs text-brass/70">
                ({customLorebooks.length})
              </span>
            </button>
          </div>

          {/* ZAKŁADKA 1: SCENARIUSZE ŚLEDCZE */}
          {activeTab === 'scenarios' && (
            <div className="mt-4 space-y-6">
              {/* Sekcja uploadu PDF scenariusza */}
              {onUploadAdventure && (
                <div className="space-y-3">
                  {uploadError && (
                    <div className="relative border border-destructive/60 bg-destructive/10 p-4 font-serif rounded-sm flex items-start justify-between gap-3 text-destructive-foreground">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-destructive">
                            {t('uploadErrorTitle')}
                          </h4>
                          <p className="text-xs text-foreground/90 mt-1 font-sans">{uploadError}</p>
                        </div>
                      </div>
                      {onClearUploadError && (
                        <button
                          type="button"
                          onClick={onClearUploadError}
                          className="text-muted-foreground hover:text-foreground text-xs uppercase tracking-wider px-2 py-1 border border-brass/20 hover:border-brass/50 rounded-sm transition-colors shrink-0"
                        >
                          {t('dismiss')}
                        </button>
                      )}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {!isUploading ? (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                      className="group relative cursor-pointer border-2 border-dashed border-primary/50 bg-[#120f0c] hover:border-primary hover:bg-primary/5 p-6 text-center transition-all duration-300 rounded-sm"
                    >
                      <span className="pointer-events-none absolute left-2 top-2 h-2.5 w-2.5 border-l border-t border-primary/40 group-hover:border-primary" />
                      <span className="pointer-events-none absolute right-2 top-2 h-2.5 w-2.5 border-r border-t border-primary/40 group-hover:border-primary" />
                      <span className="pointer-events-none absolute bottom-2 left-2 h-2.5 w-2.5 border-b border-l border-primary/40 group-hover:border-primary" />
                      <span className="pointer-events-none absolute bottom-2 right-2 h-2.5 w-2.5 border-b border-r border-primary/40 group-hover:border-primary" />

                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-[0_0_15px_rgba(13,148,136,0.2)]">
                          <Upload className="h-6 w-6" />
                        </div>
                        <h3 className="font-display text-base font-semibold uppercase tracking-[0.14em] text-foreground">
                          {t('uploadButton')}
                        </h3>
                        <p className="max-w-md font-serif text-sm italic text-muted-foreground">
                          {t('uploadHint')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative border border-brass/40 bg-[#16130f] p-4 font-serif rounded-sm">
                      <span className="pointer-events-none absolute left-1 top-1 h-2 w-2 border-l border-t border-brass/50" />
                      <span className="pointer-events-none absolute bottom-1 right-1 h-2 w-2 border-b border-r border-brass/50" />

                      <div className="flex justify-between items-center mb-2 text-sm font-semibold tracking-wider text-brass uppercase font-display">
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          {t('processingBook')}
                        </span>
                        <span>{uploadProgress}%</span>
                      </div>

                      <div className="w-full h-3 border border-primary/30 bg-[#0e0c0a] p-[1.5px] rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-primary rounded-full shadow-[0_0_10px_hsl(var(--primary)/0.6)] transition-all duration-500 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>

                      <p className="text-center font-special-elite text-xs uppercase tracking-wider text-muted-foreground animate-pulse">
                        {loadingStatus || t('aiAnalyzing')}
                      </p>
                    </div>
                  )}

                  {/* Wyszarzony Kreator Przygód & Pakiet MG (W przygotowaniu) */}
                  <Button
                    disabled
                    variant="outline"
                    className="w-full border border-brass/30 bg-[#120f0c]/60 opacity-50 cursor-not-allowed py-3 font-display font-semibold uppercase tracking-[0.16em] text-muted-foreground flex items-center justify-center gap-2"
                  >
                    <Lock className="h-4 w-4 text-brass/50" />
                    <span>{t('openBuilderButton')}</span>
                  </Button>
                </div>
              )}

              {/* Lista wgranych scenariuszy gracza */}
              {customScenarios.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.24em] text-brass">
                    {t('yourAdventures')}
                    <span className="font-special-elite text-[14px] tracking-[0.1em] text-muted-foreground">
                      ({customScenarios.length})
                    </span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customScenarios.map((adventure) => (
                      <AdventureCard
                        key={adventure.id}
                        adventure={adventure}
                        isCustom
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Wbudowane scenariusze w trybie deweloperskim */}
              {SHOW_BUILT_IN_ADVENTURES && BUILT_IN_ADVENTURES.length > 0 && (
                <div>
                  <h3 className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.24em] text-brass">
                    {t('selectScenarioTitle')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {BUILT_IN_ADVENTURES.map((adventure) => (
                      <AdventureCard key={adventure.id} adventure={adventure} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ZAKŁADKA 2: KSIĘGI WIEDZY I LOREBOOKI */}
          {activeTab === 'lorebooks' && (
            <div className="mt-4 space-y-6">
              <div className="p-4 border border-brass/40 bg-gradient-to-r from-[#1b1713] to-[#120f0c] rounded-md shadow-md">
                <div className="flex items-center gap-2 font-display text-sm uppercase tracking-[0.15em] text-brass font-bold">
                  <Book className="h-4 w-4 text-brass shrink-0" />
                  {t('lorebooksTitle')}
                </div>
                <p className="font-serif text-xs italic text-muted-foreground mt-1 leading-relaxed">
                  {t('lorebooksIntro')}
                </p>
              </div>

              {/* Sekcja uploadu PDF lorebooka */}
              {onUploadAdventure && (
                <div className="space-y-3">
                  <input
                    ref={loreFileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {!isUploading ? (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => loreFileInputRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          loreFileInputRef.current?.click();
                        }
                      }}
                      className="group relative cursor-pointer border-2 border-dashed border-brass/40 bg-[#120f0c] hover:border-brass hover:bg-brass/5 p-6 text-center transition-all duration-300 rounded-sm"
                    >
                      <span className="pointer-events-none absolute left-2 top-2 h-2.5 w-2.5 border-l border-t border-brass/30 group-hover:border-brass" />
                      <span className="pointer-events-none absolute right-2 top-2 h-2.5 w-2.5 border-r border-t border-brass/30 group-hover:border-brass" />
                      <span className="pointer-events-none absolute bottom-2 left-2 h-2.5 w-2.5 border-b border-l border-brass/30 group-hover:border-brass" />
                      <span className="pointer-events-none absolute bottom-2 right-2 h-2.5 w-2.5 border-b border-r border-brass/30 group-hover:border-brass" />

                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-brass/40 bg-brass/10 text-brass shadow-[0_0_15px_rgba(202,138,4,0.15)]">
                          <Book className="h-6 w-6" />
                        </div>
                        <h3 className="font-display text-base font-semibold uppercase tracking-[0.14em] text-foreground">
                          {t('uploadLorebookButton')}
                        </h3>
                        <p className="max-w-md font-serif text-sm italic text-muted-foreground">
                          {t('lorebooksEmpty')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative border border-brass/40 bg-[#16130f] p-4 font-serif rounded-sm">
                      <div className="flex justify-between items-center mb-2 text-sm font-semibold tracking-wider text-brass uppercase font-display">
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          {t('processingBook')}
                        </span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-3 border border-primary/30 bg-[#0e0c0a] p-[1.5px] rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-primary rounded-full shadow-[0_0_10px_hsl(var(--primary)/0.6)] transition-all duration-500 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Wyszarzony Kreator Ksiąg Wiedzy (W przygotowaniu) */}
                  <Button
                    disabled
                    variant="outline"
                    className="w-full border border-brass/30 bg-[#120f0c]/60 opacity-50 cursor-not-allowed py-3 font-display font-semibold uppercase tracking-[0.16em] text-muted-foreground flex items-center justify-center gap-2"
                  >
                    <Lock className="h-4 w-4 text-brass/50" />
                    <span>{t('loreBuilderButton')}</span>
                  </Button>
                </div>
              )}

              {/* Lista wgranych ksiąg lore */}
              {customLorebooks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customLorebooks.map((lorebook) => (
                    <AdventureCard
                      key={lorebook.id}
                      adventure={lorebook}
                      isCustom
                      isLorebook
                    />
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-brass/35 p-6 text-center">
                  <p className="font-serif text-sm italic text-muted-foreground">
                    {t('lorebooksEmpty')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Szczegóły wybranej przygody */}
          {selectedAdventure && !selectedAdventure.isCustom && (
            <div className="relative mt-6 border border-brass/30 bg-card p-4">
              <span className="absolute left-2 top-2 h-3 w-3 border-l-[1.5px] border-t-[1.5px] border-brass/50" />
              <span className="absolute bottom-2 right-2 h-3 w-3 border-b-[1.5px] border-r-[1.5px] border-brass/50" />
              <h4 className="mb-2 flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.24em] text-brass">
                {t('detailsTitle')}
                <HelpIcon content={t('detailsHelp')} />
              </h4>
              <p className="mb-3 font-serif text-base italic leading-relaxed text-foreground/90">
                {selectedAdventure.description}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-special-elite text-[14px] uppercase tracking-[0.12em] text-muted-foreground">
                    {t('themesLabel')}{' '}
                  </span>
                  <span className="font-serif text-base italic text-foreground">
                    {selectedAdventure.themes.slice(0, 4).join(', ')}
                  </span>
                </div>
                <div>
                  <span className="font-special-elite text-[14px] uppercase tracking-[0.12em] text-muted-foreground">
                    {t('suggestedOccupationsLabel')}{' '}
                  </span>
                  <span className="font-serif text-base italic text-foreground">
                    {selectedAdventure.suggestedOccupations.slice(0, 3).join(', ')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Podpinanie Lorebooków do wybranej przygody */}
          {selectedAdventure && customLorebooks.length > 0 && (
            <div className="relative mt-6 border border-brass/30 bg-card p-4">
              <span className="absolute left-2 top-2 h-3 w-3 border-l-[1.5px] border-t-[1.5px] border-brass/50" />
              <span className="absolute bottom-2 right-2 h-3 w-3 border-b-[1.5px] border-r-[1.5px] border-brass/50" />
              <div className="mb-3 flex items-center justify-between">
                <h4 className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.24em] text-brass">
                  <Book className="h-4 w-4 text-brass" />
                  {t('attachedLorebooksLabel')}
                </h4>
                <span className="font-special-elite text-xs text-muted-foreground">
                  {t('attachedLorebooksCount', {
                    count: selectedAdventure.attachedLorebookIds?.length || 0,
                  })}
                </span>
              </div>

              <div className="space-y-2">
                {customLorebooks.map((lorebook) => {
                  const isAttached = Boolean(
                    selectedAdventure.attachedLorebookIds?.includes(lorebook.id)
                  );
                  return (
                    <div
                      key={lorebook.id}
                      className={`flex items-center justify-between p-3 border transition-colors ${
                        isAttached
                          ? 'border-brass/50 bg-brass/10'
                          : 'border-brass/20 bg-[#120f0c]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-brass">
                          {lorebook.documentType === 'compendium' ? '📜' : '🗺️'}
                        </span>
                        <div>
                          <div className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
                            {lorebook.title}
                            {isAttached && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-sans tracking-wider bg-brass/20 text-brass px-1.5 py-0.5 border border-brass/40 rounded">
                                <BookmarkCheck className="h-3 w-3" />
                                {t('attachedBadge')}
                              </span>
                            )}
                          </div>
                          <div className="font-serif text-xs italic text-muted-foreground">
                            {lorebook.lorebookData?.regionOrTheme || lorebook.location}
                          </div>
                        </div>
                      </div>

                      {selectedAdventure.isCustom && onToggleAttachLorebook && (
                        <Button
                          type="button"
                          variant={isAttached ? 'destructive' : 'outline'}
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await onToggleAttachLorebook(selectedAdventure.id, lorebook.id);
                          }}
                          className="font-display text-xs uppercase tracking-wider"
                        >
                          {isAttached ? t('detachLorebookButton') : t('attachLorebookButton')}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nawigacja i stopka */}
          <div className="mt-6 flex justify-between border-t border-brass/20 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="font-display font-semibold uppercase tracking-[0.16em]"
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedId}
              className="font-display font-semibold uppercase tracking-[0.16em]"
            >
              {t('chooseAndContinue')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AdventureSelector;
