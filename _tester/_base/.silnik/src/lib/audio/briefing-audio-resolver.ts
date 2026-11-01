/**
 * src/lib/audio/briefing-audio-resolver.ts
 *
 * Deterministyczny resolver pre-baked nagrań audio zapowiedzi spraw (Aktowe Intro)
 * na podstawie kontekstu scenariusza i języka.
 */

import type { AdventureContext } from '@/lib/types';

export interface BriefingAudioInfo {
  audioUrl: string;
  title: string;
  durationEstimateSeconds: number;
}

const BRIEFING_REGISTRY: Record<string, { pl?: string; en?: string; duration?: number }> = {
  // Starter Podręcznikowy
  'the-haunting': {
    pl: '/audio/briefings/the-haunting/briefing-pl.mp3',
    en: '/audio/briefings/the-haunting/briefing-en.mp3',
    duration: 38,
  },
  'case-s11-01': {
    pl: '/audio/briefings/the-haunting/briefing-pl.mp3',
    en: '/audio/briefings/the-haunting/briefing-en.mp3',
    duration: 38,
  },
  // Polskie Quick Adventures (Strefa 11)
  'cien-nad-prabutami': {
    pl: '/audio/briefings/cien-nad-prabutami/briefing-pl.mp3',
    duration: 30,
  },
  'tajemnica-dzieci-z-traszyna': {
    pl: '/audio/briefings/tajemnica-dzieci-z-traszyna/briefing-pl.mp3',
    duration: 39,
  },
  'tajemnica-pendnika-lagiewki': {
    pl: '/audio/briefings/tajemnica-pendnika-lagiewki/briefing-pl.mp3',
    duration: 38,
  },
  'przybysz-z-matriksa-glogow': {
    pl: '/audio/briefings/przybysz-z-matriksa-glogow/briefing-pl.mp3',
    duration: 35,
  },
  // Amerykańskie Cold Cases (USA)
  'englewood-murder-castle-1893': {
    en: '/audio/briefings/englewood-murder-castle-1893/briefing-en.mp3',
    duration: 39,
  },
  'almer-coe-spectacles-1924': {
    en: '/audio/briefings/almer-coe-spectacles-1924/briefing-en.mp3',
    duration: 36,
  },
  'circleville-letters-1983': {
    en: '/audio/briefings/circleville-letters-1983/briefing-en.mp3',
    duration: 38,
  },
  'ovidhall-lake-anomaly-2005': {
    en: '/audio/briefings/ovidhall-lake-anomaly-2005/briefing-en.mp3',
    duration: 38,
  },
};

/**
 * Rozpoznaje slug scenariusza na podstawie AdventureContext lub podanego tytułu.
 */
export function resolveScenarioSlug(context?: AdventureContext | null, title?: string): string | null {
  if (context?.id && BRIEFING_REGISTRY[context.id]) {
    return context.id;
  }

  // Dopasowanie po tytule lub słowach kluczowych
  const haystack = `${title || ''} ${context?.title || ''}`.toLowerCase();

  if (/nawiedzony\s+dom|haunting|corbitt/i.test(haystack)) return 'the-haunting';
  if (/prabut|klimuszko/i.test(haystack)) return 'cien-nad-prabutami';
  if (/traszyn/i.test(haystack)) return 'tajemnica-dzieci-z-traszyna';
  if (/pędnik|pednik|łągiewk|lagiewk|kowar/i.test(haystack)) return 'tajemnica-pendnika-lagiewki';
  if (/głogów|glogow|matriks|matrix/i.test(haystack)) return 'przybysz-z-matriksa-glogow';
  if (/englewood|holmes|murder\s+castle/i.test(haystack)) return 'englewood-murder-castle-1893';
  if (/almer\s+coe|franks|leopold/i.test(haystack)) return 'almer-coe-spectacles-1924';
  if (/circleville|gillespie/i.test(haystack)) return 'circleville-letters-1983';
  if (/ovidhall/i.test(haystack)) return 'ovidhall-lake-anomaly-2005';

  return null;
}

/**
 * Zwraca informacje o pliku audio zapowiedzi sprawy, jeśli istnieje w rejestrze.
 */
export function getBriefingAudio(
  context?: AdventureContext | null,
  options?: { title?: string; locale?: string }
): BriefingAudioInfo | null {
  const slug = resolveScenarioSlug(context, options?.title);
  if (!slug) return null;
  if (slug === 'the-haunting' || slug === 'case-s11-01') return null;

  const entry = BRIEFING_REGISTRY[slug];
  if (!entry) return null;

  const locale = options?.locale || 'pl';
  const url = locale === 'en' ? (entry.en || entry.pl) : (entry.pl || entry.en);

  if (!url) return null;

  return {
    audioUrl: url,
    title: options?.title || context?.title || 'Zapowiedź sprawy',
    durationEstimateSeconds: entry.duration || 40,
  };
}
