'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Loader2,
  Play,
  Scroll,
  MapPin,
  Sparkles,
  Compass,
  BookOpen,
  AlertTriangle,
  RotateCcw,
  ArrowLeft,
  Key,
  ChevronDown,
  Volume2,
  VolumeX,
  Pause,
  Headphones,
} from 'lucide-react';
import type { AdventureContext } from '@/lib/types';
import type { ResolvedEraContext } from '@/lib/era';
import { getSettingTrivia, getSafeDossierIntro } from '@/lib/era/setting-trivia';
import { getBriefingAudio } from '@/lib/audio/briefing-audio-resolver';
import type { GameStartError } from '@/hooks/useGameStart';

export interface TTSHardLoadingScreenProps {
  isBuffering?: boolean;
  isStarting?: boolean;
  isReadyToEnter?: boolean;
  startProgress?: number;
  startStatus?: string;
  onConfirmEnterGame?: () => void;
  adventureTitle?: string;
  adventureDescription?: string;
  region?: string;
  eraContext?: ResolvedEraContext | null;
  adventureContext?: AdventureContext | null;
  activeCharacter?: { name?: string; occupation?: string } | null;
  characters?: Array<{ name?: string; occupation?: string }> | null;
  startError?: GameStartError | null;
  onRetry?: () => void;
  onCancel?: () => void;
}

export const TTSHardLoadingScreen: React.FC<TTSHardLoadingScreenProps> = ({
  isBuffering = false,
  isStarting = false,
  isReadyToEnter = false,
  startProgress = 0,
  startStatus = '',
  onConfirmEnterGame,
  adventureTitle,
  adventureDescription,
  region,
  eraContext,
  adventureContext,
  activeCharacter,
  characters,
  startError,
  onRetry,
  onCancel,
}) => {
  const t = useTranslations('TtsHardLoadingScreen');
  const rawLocale = useLocale?.() || 'pl';
  const locale = rawLocale === 'en' ? 'en' : 'pl';

  const isActive = isStarting || isBuffering || isReadyToEnter || !!startError;
  const [shouldRender, setShouldRender] = useState(isActive);
  const [isVisible, setIsVisible] = useState(isActive);

  // Natychmiastowe zsynchronizowanie stanu po zmianie isActive (Issue #429)
  useEffect(() => {
    if (isActive) {
      setShouldRender(true);
      setIsVisible(true);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  // Autostart muzyki YouTube w tle przy pojawieniu się ekranu (Issue #157)
  useEffect(() => {
    if (isVisible && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zew:start-music'));
    }
  }, [isVisible]);

  // Dynamiczne dane przygody
  const title = adventureTitle || adventureContext?.title || t('chronicleDossier');
  const location = region || adventureContext?.location || adventureContext?.country;
  const eraLabel = eraContext?.effectiveYear ? String(eraContext.effectiveYear) : undefined;

  // Rejestr zapowiedzi lektorskiej (Briefing Audio / Audiobook)
  const briefingAudio = useMemo(() => {
    return getBriefingAudio(adventureContext, { title, locale });
  }, [adventureContext, title, locale]);

  const [briefingState, setBriefingState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const briefingAudioRef = useRef<HTMLAudioElement | null>(null);
  const briefingRequestedRef = useRef(false);
  const briefingRequestRef = useRef(0);
  const briefingUrl = briefingAudio?.audioUrl;
  const isPlayingBriefing = briefingState === 'playing';
  const isLoadingBriefing = briefingState === 'loading';
  const isBriefingRequested = isPlayingBriefing || isLoadingBriefing;

  useEffect(() => {
    setBriefingState('idle');
    if (!isActive || !briefingUrl) return;

    // Przygotuj lokalne nagranie podczas ładowania sesji; play wymaga kliknięcia.
    const audio = new Audio(briefingUrl);
    audio.preload = 'auto';
    briefingAudioRef.current = audio;
    audio.onplaying = () => {
      if (briefingRequestedRef.current) setBriefingState('playing');
    };
    audio.onwaiting = () => {
      if (briefingRequestedRef.current) setBriefingState('loading');
    };
    audio.onended = audio.onpause = () => {
      briefingRequestedRef.current = false;
      briefingRequestRef.current += 1;
      setBriefingState('idle');
    };
    audio.onerror = () => {
      briefingRequestedRef.current = false;
      briefingRequestRef.current += 1;
      setBriefingState('error');
    };
    audio.load();

    return () => {
      briefingAudioRef.current = null;
      briefingRequestedRef.current = false;
      briefingRequestRef.current += 1;
      audio.onplaying = audio.onwaiting = audio.onended = audio.onpause = audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    };
  }, [isActive, briefingUrl, locale]);

  const stopBriefingAudio = () => {
    briefingRequestedRef.current = false;
    briefingRequestRef.current += 1;
    briefingAudioRef.current?.pause();
    setBriefingState('idle');
  };

  const toggleBriefingAudio = () => {
    const audio = briefingAudioRef.current;
    if (!audio) return;

    if (briefingRequestedRef.current) {
      stopBriefingAudio();
      return;
    }

    if (briefingState === 'error') audio.load();
    briefingRequestedRef.current = true;
    const request = ++briefingRequestRef.current;
    setBriefingState('loading');
    audio.play().then(() => {
      if (briefingAudioRef.current === audio && briefingRequestRef.current === request && briefingRequestedRef.current) {
        setBriefingState('playing');
      }
    }).catch(() => {
      if (briefingAudioRef.current === audio && briefingRequestRef.current === request) {
        briefingRequestedRef.current = false;
        setBriefingState('error');
      }
    });
  };

  // Lewy panel: Bezspoilerowe Dossier dla Badacza (Issue #482 & #612)
  const storyDossier = useMemo(() => {
    return getSafeDossierIntro(adventureContext, {
      character: activeCharacter,
      characters,
      locale,
      fallbackDefault: adventureDescription?.trim() || t('defaultChronicleIntro'),
    });
  }, [adventureContext, activeCharacter, characters, locale, adventureDescription, t]);

  // Prawy panel: Realia Epoki i Świata (Issue #482)
  const settingTrivia = useMemo(() => {
    return getSettingTrivia(adventureContext, eraContext, locale);
  }, [adventureContext, eraContext, locale]);

  const handleConfirm = () => {
    if (!isReadyToEnter || startError) return;
    stopBriefingAudio();
    if (onConfirmEnterGame) {
      onConfirmEnterGame();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zew:confirm-enter-game'));
    }
  };

  if (!shouldRender) return null;

  const isCompleted = !startError && isReadyToEnter;
  const displayProgress = isCompleted ? 100 : Math.min(99, Math.max(startProgress, 5));

  return (
    <div
      data-testid="tts-hard-loading-screen"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050604]/98 backdrop-blur-2xl overflow-y-auto overflow-x-hidden transition-opacity duration-500 ease-out px-4 py-6 md:p-8 select-none ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Tło Dark Art Déco: głęboki radialny mosiężno-szmaragdowy glow i winieta gabinetowa */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(13,148,136,0.14)_0%,rgba(201,169,74,0.08)_35%,rgba(14,16,12,0.94)_60%,rgba(5,6,4,0.99)_100%)] pointer-events-none" />
      <div className="absolute inset-0 shadow-[inset_0_0_180px_rgba(0,0,0,0.98)] pointer-events-none" />

      {/* Zewnętrzne geometryczne narożniki Art Déco */}
      <div className="absolute top-5 left-5 w-16 h-16 border-t-2 border-l-2 border-brass/50 pointer-events-none hidden sm:block">
        <div className="absolute top-1.5 left-1.5 w-2.5 h-2.5 bg-brass/80 rotate-45" />
      </div>
      <div className="absolute top-5 right-5 w-16 h-16 border-t-2 border-r-2 border-brass/50 pointer-events-none hidden sm:block">
        <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-brass/80 rotate-45" />
      </div>
      <div className="absolute bottom-5 left-5 w-16 h-16 border-b-2 border-l-2 border-brass/50 pointer-events-none hidden sm:block">
        <div className="absolute bottom-1.5 left-1.5 w-2.5 h-2.5 bg-brass/80 rotate-45" />
      </div>
      <div className="absolute bottom-5 right-5 w-16 h-16 border-b-2 border-r-2 border-brass/50 pointer-events-none hidden sm:block">
        <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 bg-brass/80 rotate-45" />
      </div>

      <div className="w-full max-w-5xl text-center space-y-6 md:space-y-8 relative z-10 my-auto">
        {/* Górny badge statusu i geolokalizacja */}
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-black/80 border border-brass/60 text-xs font-special-elite text-brass tracking-[0.16em] uppercase shadow-[0_0_20px_rgba(201,169,74,0.2)]">
            <Compass className="w-4 h-4 text-brass animate-spin-slow" />
            <span>{t('preparingSession')}</span>
          </div>

          {(location || eraLabel) && (
            <div className="flex items-center justify-center gap-3 text-xs md:text-sm font-mono text-foreground/80 tracking-wider">
              {location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gold" />
                  <span className="text-foreground font-semibold">{location}</span>
                </span>
              )}
              {location && eraLabel && <span className="text-brass/50 font-bold">·</span>}
              {eraLabel && (
                <span className="px-2.5 py-0.5 bg-brass/10 border border-brass/40 text-brass font-bold">
                  {eraLabel}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 2-kolumnowy panel główny: Lewa = Akta Śledztwa (bez spoilerów i bez tagów), Prawa = Realia Epoki i Świata */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6 text-left items-stretch">
          {/* Lewa kolumna: Dossier Przygody (7 kolumn) - Dark Art Déco z narożnikami */}
          <div className="lg:col-span-7 border border-brass/50 bg-card/95 p-6 md:p-8 shadow-[0_0_45px_rgba(0,0,0,0.95)] relative overflow-hidden backdrop-blur-lg flex flex-col justify-between h-full min-h-[340px]">
            {/* Wewnętrzne narożniki Art Déco */}
            <span className="pointer-events-none absolute left-2 top-2 h-4 w-4 border-l-2 border-t-2 border-brass/70" />
            <span className="pointer-events-none absolute right-2 top-2 h-4 w-4 border-r-2 border-t-2 border-brass/70" />
            <span className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-brass/70" />
            <span className="pointer-events-none absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 border-brass/70" />

            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brass to-transparent" />

            <div>
              <div className="flex items-center justify-between border-b border-brass/25 pb-3 mb-4">
                <span className="inline-flex items-center gap-2.5 text-xs font-mono uppercase tracking-widest text-brass font-bold">
                  <Scroll className="w-4 h-4 text-gold" />
                  {t('chronicleDossier')}
                </span>
                {eraLabel && (
                  <span className="text-xs font-mono text-muted-foreground">
                    {eraLabel}
                  </span>
                )}
              </div>

              <h3 className="font-display text-2xl md:text-3xl font-bold text-gold tracking-wide mb-4 not-italic leading-tight">
                {title}
              </h3>

              <div className="relative pl-4 border-l-2 border-gold/40 my-2">
                <p className="font-special-elite text-base md:text-lg text-foreground/95 leading-relaxed max-h-60 overflow-y-auto pr-2">
                  {storyDossier}
                </p>
              </div>

              {/* Odtwarzacz zapowiedzi sprawy (Narrator Audiobook / Leo) */}
              {briefingAudio && (
                <div className="mt-4 pt-3 border-t border-brass/25">
                  <button
                    type="button"
                    data-testid="briefing-audio-toggle"
                    data-state={briefingState}
                    aria-pressed={isBriefingRequested}
                    aria-busy={isLoadingBriefing}
                    onClick={toggleBriefingAudio}
                    className={`w-full group flex items-center justify-between px-3.5 py-2.5 rounded border transition-all duration-300 text-xs font-mono uppercase tracking-wider ${
                      isBriefingRequested
                        ? 'bg-primary/20 border-primary text-gold-light shadow-[0_0_15px_rgba(17,179,163,0.3)]'
                        : 'bg-black/40 border-brass/40 text-gold-light hover:border-gold hover:bg-black/60 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                          isBriefingRequested
                            ? 'bg-primary text-black'
                            : 'bg-gold/20 text-gold group-hover:bg-gold group-hover:text-black'
                        }`}
                      >
                        {isLoadingBriefing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isPlayingBriefing ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </span>
                      <div className="flex flex-col text-left">
                        <span className="font-semibold text-xs tracking-wide">
                          {isLoadingBriefing ? t('cancelBriefing') : isPlayingBriefing ? t('pauseBriefing') : t('playBriefing')}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono lowercase opacity-80">
                          {isLoadingBriefing ? t('startingBriefing') : isPlayingBriefing ? t('playingBriefing') : briefingState === 'error' ? t('briefingPlaybackError') : `${t('briefingAudioTitle')} • ~0:${briefingAudio.durationEstimateSeconds}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-brass">
                      <Headphones className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Dolna belka lewej karty: subtelny status śledztwa zamiast zbędnych tagów motywów */}
            <div className="mt-4 pt-3 border-t border-brass/20 flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span className="text-brass/70 tracking-wider uppercase font-semibold">
                {t('investigationStatus')}
              </span>
              <span className="text-muted-foreground/80 tracking-widest">
                {t('confidential')}
              </span>
            </div>
          </div>

          {/* Prawa kolumna: Realia Epoki i Świata (5 kolumn) - Dark Art Déco z narożnikami */}
          <div className="lg:col-span-5 border border-brass/50 bg-gradient-to-b from-[#141611]/95 via-[#0e100c]/95 to-[#070806]/98 p-6 md:p-7 shadow-[0_0_40px_rgba(0,0,0,0.9)] relative overflow-hidden backdrop-blur-md flex flex-col justify-between h-full min-h-[340px]">
            {/* Wewnętrzne narożniki Art Déco */}
            <span className="pointer-events-none absolute left-2 top-2 h-4 w-4 border-l-2 border-t-2 border-brass/70" />
            <span className="pointer-events-none absolute right-2 top-2 h-4 w-4 border-r-2 border-t-2 border-brass/70" />
            <span className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-brass/70" />
            <span className="pointer-events-none absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 border-brass/70" />

            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-brass/30 via-gold/60 to-brass/30" />

            <div>
              <div className="flex items-center justify-between border-b border-brass/25 pb-3 mb-2">
                <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-brass/95 font-bold">
                  <BookOpen className="w-3.5 h-3.5 text-gold" />
                  {t('settingTriviaHeader')}
                </span>
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(13,148,136,0.8)]" />
              </div>

              {settingTrivia.subtitle && (
                <p className="text-xs font-serif italic text-gold/80 mb-4 tracking-wide">
                  {settingTrivia.subtitle}
                </p>
              )}

              <div className="space-y-3.5 my-auto max-h-60 overflow-y-auto pr-2">
                {settingTrivia.facts.map((fact, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs md:text-sm text-foreground/90 font-serif leading-relaxed">
                    <span className="text-gold font-bold select-none mt-0.5 shrink-0">◆</span>
                    <p>{fact}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-brass/20 flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span className="text-gold/90 font-semibold tracking-wider">
                {t('spoilerFree')}
              </span>
              <span className="text-brass/70 font-semibold tracking-wider">
                {t('periodKnowledgeBadge')}
              </span>
            </div>
          </div>
        </div>

        {/* Pasek Postępu Art Déco (0-100%) - geometryczny z mosiężną ramką */}
        <div className="w-full max-w-3xl mx-auto space-y-3">
          <div className="flex items-center justify-between text-sm md:text-base font-special-elite text-brass tracking-[0.08em] px-1">
            <span className="flex items-center gap-2.5 truncate text-left">
              {startError ? (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-bounce" />
              ) : !isCompleted ? (
                <Loader2 className="w-4 h-4 animate-spin text-gold shrink-0" />
              ) : null}
              <span className={`truncate ${startError ? 'text-red-300 font-semibold' : 'text-foreground/95'}`}>
                {startError ? startError.title : isCompleted ? t('chronicleReady') : startStatus || t('generatingStory')}
              </span>
            </span>
            <span className={`font-mono font-bold ml-3 shrink-0 text-sm md:text-base ${startError ? 'text-red-400' : 'text-gold'}`}>
              {startError ? t('errorTitle') : `${displayProgress}%`}
            </span>
          </div>

          <div
            className={`w-full h-4 bg-black/95 border relative shadow-[inset_0_2px_8px_rgba(0,0,0,0.95)] p-[2px] ${
              startError ? 'border-red-500/70 shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 'border-brass/70'
            }`}
          >
            <div
              data-testid="loading-screen-progress-bar"
              className={`h-full transition-all duration-500 ease-out relative ${
                startError
                  ? 'bg-gradient-to-r from-red-900 via-red-600 to-amber-700 shadow-[0_0_20px_rgba(220,38,38,0.7)]'
                  : 'bg-gradient-to-r from-[#997a38] via-primary to-emerald-400 shadow-[0_0_20px_rgba(13,148,136,0.6)]'
              }`}
              style={{ width: startError ? '100%' : `${displayProgress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Dolna strefa: Błąd lub Hero CTA */}
        <div className="pt-2 flex flex-col items-center justify-center min-h-[84px]">
          {startError ? (
            <div
              data-testid="loading-screen-error-container"
              className="w-full max-w-2xl bg-black/90 border border-red-500/50 p-5 shadow-[0_0_35px_rgba(220,38,38,0.25)] relative text-left space-y-3.5 animate-in fade-in zoom-in-95 duration-300"
            >
              {/* Narożniki */}
              <span className="pointer-events-none absolute left-1.5 top-1.5 h-3 w-3 border-l-2 border-t-2 border-red-400/70" />
              <span className="pointer-events-none absolute right-1.5 top-1.5 h-3 w-3 border-r-2 border-t-2 border-red-400/70" />
              <span className="pointer-events-none absolute bottom-1.5 left-1.5 h-3 w-3 border-b-2 border-l-2 border-red-400/70" />
              <span className="pointer-events-none absolute bottom-1.5 right-1.5 h-3 w-3 border-b-2 border-r-2 border-red-400/70" />

              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <h4 className="text-sm font-display font-bold uppercase tracking-wider text-red-200">
                    {startError.title}
                  </h4>
                  <p className="text-xs font-serif text-foreground/90 leading-relaxed">
                    {startError.userAdvice}
                  </p>
                </div>
              </div>

              {startError.technicalDetails && (
                <details className="text-[11px] font-mono text-muted-foreground bg-black/60 border border-brass/20 p-2.5 rounded group">
                  <summary className="cursor-pointer text-brass/80 hover:text-gold select-none font-semibold flex items-center justify-between">
                    <span>{t('technicalDetails')}</span>
                    <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
                  </summary>
                  <pre className="mt-2 text-red-300/80 whitespace-pre-wrap break-all max-h-28 overflow-y-auto leading-tight font-mono text-[10px]">
                    {startError.technicalDetails}
                  </pre>
                </details>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-brass/20">
                <button
                  type="button"
                  onClick={onCancel}
                  data-testid="loading-screen-cancel-btn"
                  className="px-4 py-2 border border-brass/40 hover:border-brass bg-black/60 hover:bg-brass/10 text-xs font-display uppercase tracking-widest text-brass transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{t('cancelButton')}</span>
                </button>

                <div className="flex items-center gap-2.5 ml-auto">
                  {(startError.category === 'auth_error' || startError.category === 'server_overloaded' || startError.category === 'quota_exceeded') && (
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('open-api-keys-modal'));
                        }
                      }}
                      data-testid="loading-screen-api-settings-btn"
                      className="px-3.5 py-2 border border-brass/30 hover:border-gold/60 bg-black/50 text-[11px] font-display uppercase tracking-wider text-gold hover:text-yellow-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>{t('openApiSettings')}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onRetry}
                    data-testid="loading-screen-retry-btn"
                    className="px-6 py-2 bg-gradient-to-r from-red-900 via-amber-700 to-yellow-600 hover:brightness-110 border border-gold/70 text-foreground font-display font-bold text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(201,169,74,0.4)] flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('retryButton')}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : isCompleted ? (
            <div className="flex flex-col items-center gap-2.5 animate-in fade-in zoom-in-95 duration-300">
              <button
                type="button"
                onClick={handleConfirm}
                data-testid="loading-screen-enter-cta"
                className="group relative px-10 py-4 bg-gradient-to-r from-[#0d9488]/90 via-[#10b981] to-[#0d9488]/90 hover:from-[#0f766e] hover:via-[#34d399] hover:to-[#0f766e] text-primary-foreground font-display font-bold text-base md:text-lg uppercase tracking-[0.22em] border-2 border-gold shadow-[0_0_40px_rgba(13,148,136,0.6)] hover:shadow-[0_0_60px_rgba(13,148,136,0.95),0_0_25px_rgba(201,169,74,0.7)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-primary-foreground text-primary-foreground transition-transform group-hover:scale-125" />
                <span>{t('enterAdventure')}</span>
                <Sparkles className="w-5 h-5 text-gold animate-pulse" />
              </button>
              <p className="text-xs font-special-elite text-emerald-400/90 tracking-widest uppercase animate-pulse">
                {t('awaitingAccept')}
              </p>
            </div>
          ) : onCancel ? (
            <button type="button" onClick={onCancel} data-testid="loading-screen-cancel-btn"
              className="min-h-11 px-4 py-2 border border-brass/40 text-brass font-display text-sm uppercase focus-visible:ring-2 focus-visible:ring-primary">
              {t('cancelButton')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
