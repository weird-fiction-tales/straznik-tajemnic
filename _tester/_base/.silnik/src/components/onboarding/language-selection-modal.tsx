'use client';

import '@/components/ui/deco-window.css';

import { useState } from 'react';
import { usePathname, useRouter } from '@/i18n/routing';
import type { MeasurementSystem } from '@/lib/types';
import { syncLocaleStorageAndCookie } from '@/lib/i18n/session-locale';
import { Globe, Compass } from 'lucide-react';

export function LanguageSelectionContent({
  onSelectLanguage
}: {
  onSelectLanguage: (locale: 'pl' | 'en', measurementSystem?: MeasurementSystem) => void;
}) {
  const [enMeasurement, setEnMeasurement] = useState<MeasurementSystem>('imperial');

  return (
    <div className="relative w-full max-w-4xl text-center z-20 flex flex-col items-center justify-center">
      {/* Płomień świecy CSS */}
      <div className="mb-1.5 animate-candle-flicker">
        <div className="deco-candle scale-90" />
      </div>

      {/* Subtelny nadtytuł */}
      <p className="font-special-elite text-[11px] sm:text-xs uppercase tracking-[0.3em] text-primary mb-1">
        ZANIM ROZPOCZNIE SIĘ ŚLEDZTWO &bull; BEFORE THE INVESTIGATION BEGINS
      </p>

      {/* Główny nagłówek Cinzel Decorative */}
      <h1
        id="language-selection-title"
        className="font-display-decorative font-black text-2xl sm:text-3xl md:text-4xl uppercase tracking-[0.08em] leading-tight text-foreground"
        style={{ textShadow: '0 0 35px rgba(201,162,39,0.2)' }}
      >
        STRAŻNIK TAJEMNIC
        <br />
        <span className="text-lg sm:text-xl md:text-2xl text-brass font-normal">
          WYBIERZ JĘZYK <span className="text-brass/40 font-sans font-light mx-1 sm:mx-2">/</span> CHOOSE LANGUAGE
        </span>
      </h1>

      {/* Déco-divider z diamentami */}
      <div className="flex items-center gap-3 my-2.5 w-[min(460px,85vw)]">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gold" />
        <span className="w-1.5 h-1.5 bg-brass rotate-45" />
        <span className="font-display text-[11px] sm:text-xs tracking-[0.24em] uppercase text-brass whitespace-nowrap">
          WIRTUALNY MISTRZ GRY &bull; VIRTUAL GAME MASTER
        </span>
        <span className="w-1.5 h-1.5 bg-brass rotate-45" />
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gold" />
      </div>

      {/* Dwujęzyczny opis pomocniczy */}
      <div className="space-y-0.5 mb-5">
        <p className="font-serif text-sm sm:text-base italic text-foreground/90">
          Ten wybór ustala język rozgrywki, dialogów oraz styl narracji.
        </p>
        <p className="font-serif text-xs sm:text-sm italic text-muted-foreground/80">
          This choice sets the game, dialogue, and narrative language.
        </p>
      </div>

      {/* 2 w 100% symetryczne i spójne kafle wyboru języka */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-3xl px-2 items-stretch">
        {/* Kafel: Polski */}
        <div className="deco-corners relative flex flex-col items-start justify-between p-5 sm:p-6 border border-brass/50 bg-gradient-to-br from-[#1a1610]/95 to-[#100d09]/95 shadow-[0_0_30px_rgba(201,162,39,0.08)] backdrop-blur-sm hover:border-brass/70 hover:shadow-[0_0_40px_rgba(201,162,39,0.18)] transition-all text-left">
          <div className="w-full">
            <div className="flex items-center gap-4 w-full">
              <Globe className="w-8 h-8 sm:w-9 sm:h-9 text-primary transition-transform shrink-0" />
              <div>
                <h2 className="font-display font-bold text-xl sm:text-2xl text-foreground uppercase tracking-[0.08em] text-brass">
                  POLSKI
                </h2>
                <span className="font-serif text-xs sm:text-sm text-brass/80 italic">
                  Pełna narracja po polsku
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-brass/20 w-full flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-sans uppercase tracking-wider text-brass/80">
              <span>SYSTEM MIAR:</span>
              <span className="font-mono text-[10px] text-muted-foreground">DOMYŚLNY</span>
            </div>
            <div className="w-full py-1.5 px-3 rounded bg-black/40 border border-brass/30 text-center font-mono text-xs text-brass/90">
              Metryczny (m, kg)
            </div>
            <button
              type="button"
              data-testid="btn-language-pl"
              onClick={() => onSelectLanguage('pl', 'metric')}
              className="mt-1 w-full py-2.5 bg-primary hover:bg-primary/90 border border-primary text-primary-foreground font-display text-xs sm:text-sm uppercase tracking-[0.14em] font-bold rounded-sm transition-all text-center cursor-pointer shadow-sm hover:shadow-[0_0_20px_rgba(20,184,166,0.3)] active:scale-[0.99]"
            >
              ROZPOCZNIJ PO POLSKU &rarr;
            </button>
          </div>
        </div>

        {/* Kafel: English */}
        <div className="deco-corners relative flex flex-col items-start justify-between p-5 sm:p-6 border border-brass/50 bg-gradient-to-br from-[#1a1610]/95 to-[#100d09]/95 shadow-[0_0_30px_rgba(201,162,39,0.08)] backdrop-blur-sm hover:border-brass/70 hover:shadow-[0_0_40px_rgba(201,162,39,0.18)] transition-all text-left">
          <div className="w-full">
            <div className="flex items-center gap-4 w-full">
              <Compass className="w-8 h-8 sm:w-9 sm:h-9 text-primary transition-transform shrink-0" />
              <div>
                <h2 className="font-display font-bold text-xl sm:text-2xl text-foreground uppercase tracking-[0.08em] text-brass">
                  ENGLISH
                </h2>
                <span className="font-serif text-xs sm:text-sm text-brass/80 italic">
                  Complete English narration
                </span>
              </div>
            </div>
          </div>
          <div className="mt-5 pt-3 border-t border-brass/20 w-full flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-sans uppercase tracking-wider text-brass/80">
              <span>UNITS / SYSTEM:</span>
              <span className="font-mono text-[10px] text-muted-foreground">SELECT BEFORE START</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 w-full">
              <button
                type="button"
                onClick={() => setEnMeasurement('imperial')}
                className={`py-1.5 px-2 text-xs font-mono rounded transition-all cursor-pointer ${
                  enMeasurement === 'imperial'
                    ? 'bg-primary/10 text-foreground font-bold border border-primary shadow-glow'
                    : 'bg-black/40 text-muted-foreground hover:text-foreground border border-brass/20 hover:bg-white/5'
                }`}
              >
                Imperial (ft, lbs)
              </button>
              <button
                type="button"
                onClick={() => setEnMeasurement('metric')}
                className={`py-1.5 px-2 text-xs font-mono rounded transition-all cursor-pointer ${
                  enMeasurement === 'metric'
                    ? 'bg-primary/10 text-foreground font-bold border border-primary shadow-glow'
                    : 'bg-black/40 text-muted-foreground hover:text-foreground border border-brass/20 hover:bg-white/5'
                }`}
              >
                Metric (m, kg)
              </button>
            </div>
            <button
              type="button"
              data-testid="btn-language-en"
              onClick={() => onSelectLanguage('en', enMeasurement)}
              className="mt-1 w-full py-2.5 bg-primary hover:bg-primary/90 border border-primary text-primary-foreground font-display text-xs sm:text-sm uppercase tracking-[0.14em] font-bold rounded-sm transition-all text-center cursor-pointer shadow-sm hover:shadow-[0_0_20px_rgba(20,184,166,0.3)] active:scale-[0.99]"
            >
              LAUNCH IN ENGLISH &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Stylizowana ramka ostrzegawcza 18+ (Mature Content Warning) */}
      <div
        className="mt-5 w-full max-w-3xl rounded border border-destructive/50 bg-destructive/10 px-4 py-3 sm:px-5 sm:py-3.5 text-left shadow-[0_0_25px_rgba(179,50,44,0.12)] relative overflow-hidden backdrop-blur-sm"
        role="note"
        aria-label="Content Warning 18+"
      >
        <div className="absolute top-0 left-0 w-1.5 h-full bg-destructive/80" />
        <div className="flex items-center gap-2.5 mb-1">
          <span className="inline-block px-2 py-0.5 text-[10px] sm:text-xs font-mono font-bold tracking-widest uppercase bg-destructive/30 text-destructive-foreground border border-destructive/60 rounded-sm shadow-sm">
            18+ &bull; MATURE AUDIENCE
          </span>
          <span className="font-display text-xs sm:text-sm uppercase tracking-wider text-brass font-semibold">
            Ostrzeżenie o zawartości / Content Warning
          </span>
        </div>
        <p className="font-serif text-xs sm:text-sm leading-snug text-foreground/90">
          Gra porusza tematy drażliwe, kontrowersyjne, szaleństwo oraz sceny brutalne i grozę. Doświadczenie przeznaczone jest dla osób pełnoletnich.
        </p>
        <p className="mt-0.5 font-serif text-[11px] sm:text-xs leading-snug text-muted-foreground/80 italic">
          This game contains sensitive themes, controversial topics, madness, depictions of violence, and horror. Intended for mature audiences only.
        </p>
      </div>

      {/* Stopka z hołdem dla H.P. Lovecrafta: Słynne epitafium "I AM PROVIDENCE" */}
      <div className="mt-5 text-center max-w-2xl px-4 pointer-events-none">
        <p className="font-serif italic text-sm sm:text-base text-brass/90 tracking-wide">
          „I AM PROVIDENCE” (Jestem Providence)
        </p>
        <p className="font-special-elite text-[10px] sm:text-xs text-muted-foreground/75 uppercase tracking-[0.18em] mt-0.5">
          W hołdzie twórczości H.P. Lovecrafta (1890–1937) &bull; Słynne epitafium wyryte na nagrobku pisarza
        </p>
        <p className="font-special-elite text-[9px] sm:text-[11px] text-muted-foreground/60 uppercase tracking-[0.15em] mt-0.5 italic">
          In tribute to the work of H.P. Lovecraft (1890–1937) &bull; Famous epitaph engraved on the author&apos;s gravestone
        </p>
      </div>
    </div>
  );
}

interface LanguageSelectionModalProps {
  open: boolean;
  onSelected: () => void;
}

export function LanguageSelectionModal({
  open,
  onSelected,
}: LanguageSelectionModalProps) {
  const router = useRouter();
  const pathname = usePathname();

  if (!open) return null;

  const selectLanguage = (locale: 'pl' | 'en', measurementSystem: MeasurementSystem = 'metric') => {
    syncLocaleStorageAndCookie(locale);
    localStorage.setItem('measurement_system', measurementSystem);
    onSelected();
    router.replace(pathname, { locale });
  };

  return (
    <div
      className="deco-window fixed inset-0 z-[1000] flex flex-col items-center justify-center overflow-hidden lg:justify-start lg:overflow-y-auto bg-background p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-selection-title"
    >
      {/* === Warstwy tła Dark Art Déco 1:1 z WelcomeScreen === */}
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

      {/* 4 złote narożniki kanwy Art Déco */}
      <span className="pointer-events-none absolute top-4 left-4 w-10 h-10 border-t-2 border-l-2 border-brass/60 z-30" />
      <span className="pointer-events-none absolute top-4 right-4 w-10 h-10 border-t-2 border-r-2 border-brass/60 z-30" />
      <span className="pointer-events-none absolute bottom-4 left-4 w-10 h-10 border-b-2 border-l-2 border-brass/60 z-30" />
      <span className="pointer-events-none absolute bottom-4 right-4 w-10 h-10 border-b-2 border-r-2 border-brass/60 z-30" />

      {/* Zawartość wyboru języka */}
      <LanguageSelectionContent onSelectLanguage={selectLanguage} />
    </div>
  );
}
