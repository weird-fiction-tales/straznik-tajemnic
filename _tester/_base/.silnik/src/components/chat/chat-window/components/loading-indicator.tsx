'use client';

/**
 * @file LoadingIndicator - Diegetyczny Pacer Dark Art Déco z rotującymi mikrostadiami śledczymi (Issue #757).
 *
 * Wizualia: pulsujące Oko Horusa (ArtDecoEye), szmaragdowe romby oraz rotujący ticker stanów fabularnych.
 * 100% symetria i18n ze słowników NarrativePacer w messages/pl.json i messages/en.json.
 */

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArtDecoEye } from '@/components/ui/art-deco-eye';

export const PACER_MESSAGES = {
  pl: {
    phase0: 'Odczytywanie intencji Badacza...',
    phase1: 'Nadsłuchiwanie kroków w mroku...',
    phase2: 'Układanie scenerii w kadrze...',
    phase3: 'Spisywanie kroniki zdarzeń...',
    phase4: 'Mistrz Gry waży słowa w ciszy...',
  },
  en: {
    phase0: "Reading the Investigator's intent...",
    phase1: 'Listening for footsteps in the dark...',
    phase2: 'Framing the scene...',
    phase3: 'Recording the investigative chronicle...',
    phase4: 'The Game Master weighs their words in silence...',
  },
} as const;

export type PacerPhaseKey = keyof typeof PACER_MESSAGES['pl'];

/**
 * Zwraca diegetyczny komunikat statusu na podstawie upływu sekund (Issue #757).
 */
export function labelForSeconds(
  seconds: number,
  locale: 'pl' | 'en' = 'pl',
  t?: (key: PacerPhaseKey) => string
): string {
  const loc = locale === 'en' ? 'en' : 'pl';
  const phaseKey: PacerPhaseKey =
    seconds >= 12
      ? 'phase4'
      : seconds >= 8
      ? 'phase3'
      : seconds >= 5
      ? 'phase2'
      : seconds >= 2
      ? 'phase1'
      : 'phase0';

  if (t) {
    try {
      const translated = t(phaseKey);
      if (translated) return translated;
    } catch {
      // fallback
    }
  }

  return PACER_MESSAGES[loc][phaseKey];
}

export function LoadingIndicator() {
  const [seconds, setSeconds] = useState(0);
  const locale = useLocale();
  const t = useTranslations('NarrativePacer');

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const loc = locale === 'en' ? 'en' : 'pl';
  const label = labelForSeconds(seconds, loc, (key) => t(key));

  return (
    <div
      className="flex items-center justify-center gap-3 py-4 select-none animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <ArtDecoEye size={22} mode="gentle" className="shadow-[0_0_10px_rgba(17,179,163,0.35)] shrink-0" />
      <div className="flex gap-1.5 items-center">
        <div
          className="w-1.5 h-1.5 bg-primary rotate-45 shadow-[0_0_8px_rgba(13,148,136,0.6)] animate-bounce"
          style={{ animationDelay: '0ms', animationDuration: '0.6s' }}
        />
        <div
          className="w-1.5 h-1.5 bg-primary rotate-45 shadow-[0_0_8px_rgba(13,148,136,0.6)] animate-bounce"
          style={{ animationDelay: '200ms', animationDuration: '0.6s' }}
        />
        <div
          className="w-1.5 h-1.5 bg-primary rotate-45 shadow-[0_0_8px_rgba(13,148,136,0.6)] animate-bounce"
          style={{ animationDelay: '400ms', animationDuration: '0.6s' }}
        />
      </div>
      <span className="text-xs sm:text-sm text-brass font-special-elite uppercase tracking-[0.12em] animate-pulse">
        {label}
      </span>
    </div>
  );
}
