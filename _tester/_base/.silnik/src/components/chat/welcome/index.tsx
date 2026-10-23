'use client';

/**
 * WelcomeScreen - ekran powitalny w stylu Dark Art Déco (makieta karta 02/05/06).
 * Warstwy tła (radial + sunburst od dołu + mgła emerald + winieta) + 4 złote narożniki,
 * świeca CSS, "Anno Domini" (rok z gry), tytuł Cinzel Decorative, déco-divider,
 * karta "Wznów sesję" (quick-win z realnych danych), onboarding, cytat na dole.
 *
 * Warstwa wyłącznie prezentacyjna - prop-kontrakt WelcomeScreenProps bez zmian.
 * Quick-winy czytają read-only z localStorage (rok zegara, lista zapisów).
 */

import type { FC } from 'react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import type { WelcomeScreenProps } from './types';
import { WELCOME_QUOTES, WELCOME_QUOTES_EN } from './data/quotes';
import { useTypewriterSound } from './hooks/use-typewriter-sound';
import { StartModeCards } from './components/start-mode-cards';
import { StartQualityPresets } from './components/start-quality-presets';
import { ManualSetupPanel } from './components/manual-setup-panel';
import { BottomLinks } from './components/bottom-links';
import { FullGameSaveManager } from '@/lib/full-game-save-manager';
import { timeManager } from '@/lib/time-manager';
import { hasRequiredKeys } from '@/lib/api-keys-service';
import { useLocalPlaytestTransport } from '@/hooks/useLocalPlaytestTransport';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/** Metadane najświeższego zapisu (synchronicznie z localStorage). */
interface RecentSave {
  id: string;
  name: string;
  lastUpdated: string;
  messageCount: number;
  imageCount: number;
}

/** Rok arabski -> rzymski (Anno Domini). Zakres lat gry (1890-2000+). */
function toRoman(year: number): string {
  const map: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let n = Math.max(1, Math.floor(year));
  let out = '';
  for (const [value, numeral] of map) {
    while (n >= value) {
      out += numeral;
      n -= value;
    }
  }
  return out;
}

/** Relatywny opis czasu zapisu ("dziś" / "wczoraj" / "N dni temu"). */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'dziś';
  if (days === 1) return 'wczoraj';
  return `${days} dni temu`;
}

/** Karta wznowienia ostatniej sesji (styl déco z makiety karta 06). */
const ResumeCard: FC<{
  save: RecentSave;
  onResume?: () => void;
  t: ReturnType<typeof useTranslations>;
}> = ({ save, onResume, t }) => (
  <div
    data-testid="welcome-screen"
    className="deco-corners relative w-[min(420px,90vw)] mb-6 p-4 border border-brass/50 bg-gradient-to-br from-[#1a1610] to-[#100d09] shadow-[0_0_22px_rgba(13,148,136,0.08)] z-20"
  >
    <div className="font-special-elite text-[14px] text-primary tracking-[0.22em] uppercase mb-1">
      ● {t('lastSession')}
    </div>
    <div className="font-display font-bold text-lg text-foreground uppercase tracking-[0.06em] truncate">
      {save.name}
    </div>
    <div className="flex items-center gap-4 mt-2 font-special-elite text-[14px] text-muted-foreground tracking-[0.06em]">
      <span>{t('entries', { count: save.messageCount })}</span>
      {save.imageCount > 0 && (
        <span>{t('images', { count: save.imageCount })}</span>
      )}
      <span className="text-brass/90">{relativeTime(save.lastUpdated)}</span>
    </div>
    {onResume && (
      <button
        onClick={onResume}
        className="mt-4 w-full font-display font-semibold uppercase tracking-[0.16em] text-sm py-3 text-[#04110f] bg-primary border border-primary hover:brightness-110 transition-all cursor-pointer"
      >
        {t('resume')}
      </button>
    )}
  </div>
);

export const WelcomeScreen: FC<WelcomeScreenProps> = ({
  onUploadRules,
  onSelectAdventure,
  onSessionZero,
  onCreateCharacter,
  onPickPredefinedCharacter,
  onPickCharacter,
  onStartGame,
  onQuickStart,
  onChoosePlayMode,
  onLoadSave,
  onOpenApiKeys,
  onOpenHelp,
  onOpenBetaStatus,
  onOpenBetaFeedback,
  onColdStart,
  hasRules = false,
  hasAdventure = false,
  adventureTitle,
  hasSessionZero = false,
  hasCharacter = false,
  activeCharacter = null,
  hasSavedCharacters = false,
  isDuet = false,
  duetCharacterSlots = [],
  onOpenCharacterSheet,
  characters = [],
  isStarting = false,
  startProgress = 0,
  startStatus = '',
  quoteActive = true,
}) => {
  const t = useTranslations('WelcomeStart');
  const locale = useLocale();
  const [quote] = useState(() => {
    const quotes = locale === 'en' ? WELCOME_QUOTES_EN : WELCOME_QUOTES;
    return quotes[Math.floor(Math.random() * quotes.length)];
  });
  // Quick-winy (read-only, po mount - unika hydration mismatch):
  const [gameYear, setGameYear] = useState<number | null>(null);
  const [recentSave, setRecentSave] = useState<RecentSave | null>(null);
  const [hasKey, setHasKey] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return hasRequiredKeys();
  });
  const localTransport = useLocalPlaytestTransport();
  const canUseModel = hasKey || localTransport.serverConfigured;
  const [isManualMode, setIsManualMode] = useState<boolean>(false);

  const isQuoteVisible = Boolean(quoteActive && canUseModel && !isManualMode);
  const { displayedText, isTyping } = useTypewriterSound(
    quote.greeting,
    isQuoteVisible
  );

  const handleSetManualMode = useCallback((manual: boolean) => {
    setIsManualMode(manual);
    try {
      if (manual) {
        localStorage.setItem('welcome_manual_mode', 'true');
      } else {
        localStorage.removeItem('welcome_manual_mode');
      }
    } catch {
      /* localStorage niedostępny */
    }
  }, []);

  useEffect(() => {
    // Sprawdzanie po mount by uniknąć hydration mismatch
    setHasKey(hasRequiredKeys());
    try {
      if (localStorage.getItem('welcome_manual_mode') === 'true') {
        setIsManualMode(true);
      }
    } catch {
      /* brak dostępu do storage */
    }

    // Nasłuchuj na zmiany kluczy by automatycznie odświeżyć ekran po zapisie
    const onKeysChanged = () => setHasKey(hasRequiredKeys());
    window.addEventListener('api-keys-changed', onKeysChanged);

    // Rok do "Anno Domini" - ze źródła zegara kampanii (timeManager, klucz coc7_game_time),
    // czytany po mount (klient) by uniknąć hydration mismatch. Jedno źródło prawdy z
    // CampaignClock: pokazuje aktualny rok gry (po upływie czasu), nie tylko startowy.
    setGameYear(timeManager.getTime().year);
    // Najświeższy zapis do karty "Wznów sesję".
    try {
      const list = FullGameSaveManager.getSavesList();
      if (list.length > 0) {
        const s = list[0];
        setRecentSave({
          id: s.id,
          name: s.name,
          lastUpdated: s.lastUpdated,
          messageCount: s.messageCount,
          imageCount: s.imageCount,
        });
      }
    } catch {
      /* brak zapisów - karta wznowienia po prostu się nie pokaże */
    }

    return () => {
      window.removeEventListener('api-keys-changed', onKeysChanged);
    };
  }, []);

  // Filtrowanie autorskich postaci (bez sourcePresetId) dla trybu manualnego
  const manualCustomCharacters = useMemo(
    () => characters.filter((c) => !c.sourcePresetId),
    [characters]
  );
  const manualHasSavedCharacters = manualCustomCharacters.length > 0;
  const manualActiveCharacter =
    activeCharacter && !activeCharacter.sourcePresetId ? activeCharacter : null;
  const manualDuetSlots = useMemo(
    () =>
      duetCharacterSlots.map((slot) => ({
        ...slot,
        character: slot.character?.sourcePresetId ? undefined : slot.character,
      })),
    [duetCharacterSlots]
  );
  const manualHasCharacter = isDuet
    ? manualDuetSlots.length > 0 &&
      manualDuetSlots.every((s) => Boolean(s.character))
    : Boolean(manualActiveCharacter);

  return (
    <div
      data-testid="welcome-screen"
      className="relative h-full w-full overflow-hidden bg-background"
    >
      {/* === Warstwy tła (makieta karta 02) === */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(80% 60% at 50% 38%, #1c1812 0%, #0c0d0a 55%, #060708 100%)',
          }}
        />
        <div className="absolute inset-0 deco-sunburst-bottom" />
        <div className="deco-mist" />
        <div
          className="absolute inset-0"
          style={{ boxShadow: 'inset 0 0 220px 70px rgba(0,0,0,0.85)' }}
        />
      </div>

      {/* === 4 złote narożniki kanwy Art Déco === */}
      <span className="pointer-events-none absolute top-4 left-4 w-10 h-10 border-t-2 border-l-2 border-brass/60 z-30" />
      <span className="pointer-events-none absolute top-4 right-4 w-10 h-10 border-t-2 border-r-2 border-brass/60 z-30" />
      <span className="pointer-events-none absolute bottom-4 left-4 w-10 h-10 border-b-2 border-l-2 border-brass/60 z-30" />
      <span className="pointer-events-none absolute bottom-4 right-4 w-10 h-10 border-b-2 border-r-2 border-brass/60 z-30" />

      {/* === Centrum === */}
      <div
        className={`relative z-20 h-full flex flex-col items-center py-6 px-4 md:px-8 text-center overflow-y-auto journal-scroll ${
          isManualMode
            ? 'justify-start pb-16'
            : 'justify-start md:justify-center pb-28'
        }`}
      >
        {!isManualMode && (
          <>
            {/* świeca CSS */}
            <div className="mb-2 animate-candle-flicker">
              <div className="deco-candle" />
            </div>

            {/* Anno Domini (rok z gry) */}
            <div className="font-special-elite text-xs text-primary uppercase tracking-[0.5em] mb-2">
              Anno Domini {toRoman(gameYear ?? 1925)}
            </div>

            {/* tytuł */}
            <h1
              className="font-display-decorative font-black text-4xl sm:text-5xl md:text-6xl uppercase tracking-[0.08em] leading-none text-foreground"
              style={{ textShadow: '0 0 40px rgba(201,162,39,0.18)' }}
            >
              {t('titleLine1')}
              <br />
              {t('titleLine2')}
            </h1>

            {/* déco-divider z diamentami */}
            <div className="flex items-center gap-4 my-5 w-[min(520px,90vw)]">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gold" />
              <span className="w-2 h-2 bg-brass rotate-45" />
              <span className="font-display text-[13px] tracking-[0.34em] uppercase text-brass whitespace-nowrap">
                {t('virtualGm')}
              </span>
              <span className="w-2 h-2 bg-brass rotate-45" />
              <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gold" />
            </div>

            {/* karta wznowienia (quick-win, tylko gdy istnieje zapis i nie jesteśmy w trybie manualnym) */}
            {recentSave && (
              <ResumeCard save={recentSave} onResume={onLoadSave} t={t} />
            )}
          </>
        )}

        {/* Krok 3 - Autoryzacja, Zasady i Start */}
        <div
          id="start-mode-cards-container"
          className={cn(
            'gap-6 w-full justify-center z-20 mt-2',
            isManualMode
              ? 'flex flex-col items-center max-w-none px-2 md:px-4'
              : 'grid grid-cols-1 md:grid-cols-2 items-stretch max-w-5xl'
          )}
        >
          {!canUseModel ? (
            <div className="bg-black/60 border border-brass/50 p-6 rounded-md shadow-[0_0_40px_rgba(201,162,39,0.1)] max-w-lg w-full relative z-30">
              <div className="mb-4 text-center font-display uppercase tracking-[0.2em] text-primary text-sm">
                {t('authorizationRequired')}
              </div>
              <button
                type="button"
                onClick={onOpenApiKeys}
                className="w-full font-display uppercase tracking-[0.14em] text-sm py-3 text-[#04110f] bg-primary border border-primary hover:brightness-110 transition-all cursor-pointer"
              >
                {t('openApiKeys')}
              </button>
            </div>
          ) : !hasRules ? (
            <div className="bg-black/70 border border-brass/60 p-6 rounded-lg shadow-[0_0_40px_rgba(201,162,39,0.15)] max-w-xl w-full relative z-30 text-left">
              <div className="mb-2 text-center font-display uppercase tracking-[0.2em] text-primary text-sm font-semibold">
                {t('bookRequiredTitle')}
              </div>
              <p className="text-xs text-muted-foreground text-center mb-4 leading-relaxed font-sans">
                {t('bookRequiredDesc')}
              </p>
              <div className="mb-4 p-3 bg-card/60 border border-brass/30 rounded-md text-xs text-brass/90 space-y-1.5">
                <div className="font-semibold text-primary">
                  📜 {t('starterOrCoreAccepted')}
                </div>
                <div className="text-[11px] text-muted-foreground leading-normal">
                  {t('legalDisclaimerNotice')}
                </div>
              </div>
              <button
                type="button"
                onClick={onUploadRules}
                className="w-full font-display uppercase tracking-[0.14em] text-sm py-3 text-[#04110f] bg-primary border border-primary hover:brightness-110 transition-all cursor-pointer font-bold"
              >
                {t('openRulebook')}
              </button>
            </div>
          ) : isManualMode ? (
            <ManualSetupPanel
              onBack={() => handleSetManualMode(false)}
              onChoosePlayMode={onChoosePlayMode}
              onSelectAdventure={onSelectAdventure}
              hasAdventure={hasAdventure}
              adventureTitle={adventureTitle}
              onCreateCharacter={onCreateCharacter}
              onPickCharacter={onPickCharacter}
              hasCharacter={manualHasCharacter}
              activeCharacter={manualActiveCharacter}
              hasSavedCharacters={manualHasSavedCharacters}
              isDuet={isDuet}
              duetCharacterSlots={manualDuetSlots}
              onSessionZero={onSessionZero}
              hasSessionZero={hasSessionZero}
              onStartGame={onStartGame}
              isStarting={isStarting}
              startProgress={startProgress}
              startStatus={startStatus}
            />
          ) : (
            <>
              <StartModeCards
                onQuickStart={(adv, char, mode, p2) =>
                  onQuickStart?.(adv, char, mode, p2)
                }
                onManualStart={() => handleSetManualMode(true)}
                isStarting={isStarting}
                startProgress={startProgress}
                startStatus={startStatus}
              />
              <StartQualityPresets disabled={isStarting} />
            </>
          )}
        </div>

        {/* dolne linki (wczytaj / klucze / zimny start) */}
        {!isManualMode && (
          <div className="mt-4">
            <BottomLinks
              onLoadSave={onLoadSave}
              onOpenApiKeys={onOpenApiKeys}
              onOpenRulebook={onUploadRules}
              onOpenHelp={onOpenHelp}
              onOpenBetaStatus={onOpenBetaStatus}
              onOpenBetaFeedback={onOpenBetaFeedback}
              onColdStart={onColdStart}
            />
          </div>
        )}
      </div>

      {/* === Cytat na dole (efekt maszyny do pisania) === */}
      {!isManualMode && (
        <div className="pointer-events-none absolute left-0 right-0 bottom-8 px-10 text-center z-20 hidden md:block">
          <p className="font-serif italic text-base md:text-lg text-muted-foreground leading-relaxed max-w-3xl mx-auto">
            „{displayedText}
            {isTyping && <span className="animate-pulse">|</span>}&rdquo;
          </p>
          <div className="font-special-elite text-[13px] tracking-[0.24em] uppercase text-muted-foreground/70 mt-2">
            - H.P. Lovecraft, „{quote.work}&rdquo;
          </div>
        </div>
      )}
    </div>
  );
};
