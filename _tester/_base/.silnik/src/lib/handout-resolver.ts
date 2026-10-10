/**
 * Deterministyczny resolver handoutow (Issue #649 - Milestone M3).
 *
 * Pobiera autentyczne dane rekwizytu (tytul, nienaruszony tekst RAW, obraz, audio)
 * bezposrednio z bazy danych scenariusza na podstawie identyfikatora slug.
 *
 * Przestrzega inwariantu typograficznego: wylacznie standardowy znak myslnika (-).
 */

import type { AdventureHandout } from '@/lib/adventures-data';
import type { AdventureContext as CoreAdventureContext } from '@/lib/types';
import type { AdventureContext as DataAdventureContext } from '@/lib/adventures-data';
import {
  getAdventureById,
  STREFA_11_ADVENTURES,
  AMERICAN_COLD_CASES_ADVENTURES,
  BUILT_IN_ADVENTURES,
} from '@/lib/adventures-data';
import { STARTER_HAUNTING_ADVENTURE } from '@/lib/starter-haunting-data';

export type AnyAdventureContext = CoreAdventureContext | DataAdventureContext;

/**
 * Normalizuje slug do formatu malych liter z myslnikami.
 */
function normalizeSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9\u0080-\uFFFF-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Usuwa typowe prefiksy kategorii (clue-, handout-, audio-, map-, dok-, item-).
 */
function stripPrefix(slug: string): string {
  const norm = normalizeSlug(slug);
  return norm
    .replace(/^(clue|handout|audio|map|dok|item|rek|akt)-+/, '')
    .replace(/^-+/, '');
}

/**
 * Wyszukuje handout w tablicy z tolerancja dopasowania:
 * 1. Dokladne dopasowanie slug
 * 2. Case-insensitive
 * 3. Znormalizowany slug (usuniecie znakow specjalnych, myslniki)
 * 4. Dopasowanie bez prefiksu (clue-, audio-, map-, handout-)
 * 5. Podciag (gdy slug jest czescia nazwy lub odwrotnie)
 */
function findInList(
  handouts: AdventureHandout[] | undefined | null,
  targetSlug: string
): AdventureHandout | null {
  if (!handouts || handouts.length === 0 || !targetSlug) {
    return null;
  }

  const rawTarget = targetSlug.trim();
  if (!rawTarget) return null;

  // Poziom 1: Dokladne dopasowanie
  const exact = handouts.find((h) => h.slug === rawTarget);
  if (exact) return exact;

  // Poziom 2: Case-insensitive
  const lowerTarget = rawTarget.toLowerCase();
  const caseInsensitive = handouts.find(
    (h) => h.slug && h.slug.toLowerCase() === lowerTarget
  );
  if (caseInsensitive) return caseInsensitive;

  // Poziom 3: Znormalizowany slug
  const normTarget = normalizeSlug(rawTarget);
  const normalized = handouts.find(
    (h) => h.slug && normalizeSlug(h.slug) === normTarget
  );
  if (normalized) return normalized;

  // Poziom 4: Dopasowanie bez prefiksu
  const strippedTarget = stripPrefix(rawTarget);
  if (strippedTarget.length > 2) {
    const strippedMatch = handouts.find((h) => {
      if (!h.slug) return false;
      return stripPrefix(h.slug) === strippedTarget;
    });
    if (strippedMatch) return strippedMatch;
  }

  // Poziom 5: Zawieranie podciagu (minimum 4 znaki)
  if (normTarget.length >= 4) {
    const partialMatch = handouts.find((h) => {
      if (!h.slug) return false;
      const hNorm = normalizeSlug(h.slug);
      return hNorm.includes(normTarget) || normTarget.includes(hNorm);
    });
    if (partialMatch) return partialMatch;
  }

  return null;
}

/**
 * Deterministycznie rozwiazuje slug rekwizytu przeszukujac w scislej kolejnosci:
 * 1. adventureContext.handouts (aktywny scenariusz / custom)
 * 2. adventureContext.id via getAdventureById
 * 3. Wszechswiat autorskich przygod STREFA_11_ADVENTURES
 * 4. Wbudowany katalog BUILT_IN_ADVENTURES
 */
function findHandoutBySlug(
  slug: string,
  adventureContext?: AnyAdventureContext | null
): AdventureHandout | null {
  if (!slug || typeof slug !== 'string') {
    return null;
  }

  const cleanSlug = slug.trim();
  if (!cleanSlug) {
    return null;
  }

  // 1. Sprawdz bezposrednie handouty w przekazanym kontekscie
  if (adventureContext?.handouts && adventureContext.handouts.length > 0) {
    const match = findInList(adventureContext.handouts, cleanSlug);
    if (match) return match;
  }

  // 2. Sprawdz przygode dopasowana po ID z kontekstu
  if (adventureContext?.id) {
    const adventure = adventureContext.id === STARTER_HAUNTING_ADVENTURE.id
      ? STARTER_HAUNTING_ADVENTURE
      : getAdventureById(adventureContext.id);
    if (adventure?.handouts && adventure.handouts.length > 0) {
      const match = findInList(adventure.handouts, cleanSlug);
      if (match) return match;
    }
  }

  // An active adventure cannot borrow evidence from a different scenario.
  if (adventureContext) return null;

  // 3. Przeszukaj wszystkie przygody STREFA_11_ADVENTURES, AMERICAN_COLD_CASES_ADVENTURES oraz Starter
  for (const adv of [...STREFA_11_ADVENTURES, ...AMERICAN_COLD_CASES_ADVENTURES, STARTER_HAUNTING_ADVENTURE]) {
    if (adv.handouts && adv.handouts.length > 0) {
      const match = findInList(adv.handouts, cleanSlug);
      if (match) return match;
    }
  }

  // 4. Przeszukaj wbudowany katalog BUILT_IN_ADVENTURES
  for (const adv of BUILT_IN_ADVENTURES) {
    if (adv.handouts && adv.handouts.length > 0) {
      const match = findInList(adv.handouts, cleanSlug);
      if (match) return match;
    }
  }

  return null;
}


/** Only recordings verified on disk have a language/carrier override. */
const AUDIO_VARIANTS: Record<string, { language: 'pl' | 'en'; reelType: NonNullable<AdventureHandout['reelType']> }> = {
  '/audio/handouts/cien-nad-prabutami/tasma-sb-elblag.mp3': { language: 'pl', reelType: 'reel_to_reel' },
  '/audio/handouts/tajemnica-pendnika-lagiewki/proba-zderzeniowa-kowary.mp3': { language: 'pl', reelType: 'cassette' },
  '/audio/handouts/tajemnica-dzieci-z-traszyna/wywiad-dziecko-1983.mp3': { language: 'pl', reelType: 'cassette' },
  '/audio/handouts/przybysz-z-matriksa-glogow/sygnal-vhs-glogow.mp3': { language: 'pl', reelType: 'radio' },
  '/audio/handouts/englewood-murder-castle-1893/edison-wax-cylinder-1893.mp3': { language: 'en', reelType: 'gramophone' },
  '/audio/handouts/almer-coe-spectacles-1924/crowe-interrogation-1924.mp3': { language: 'en', reelType: 'gramophone' },
  '/audio/handouts/circleville-letters-1983/gillespie-wiretap-1977.mp3': { language: 'en', reelType: 'cassette' },
  '/audio/handouts/ovidhall-lake-anomaly-2005/voicemail-in-a-field-2005.mp3': { language: 'en', reelType: 'radio' },
};

export function resolveHandoutBySlug(
  slug: string,
  adventureContext?: AnyAdventureContext | null
): AdventureHandout | null {
  const handout = findHandoutBySlug(slug, adventureContext);
  if (!handout) return null;
  const baseUrl = handout.audioUrl;
  const audio = baseUrl && AUDIO_VARIANTS[baseUrl];
  if (!audio || !baseUrl) return handout;
  const translated = baseUrl.replace(/\.mp3$/, audio.language === 'pl' ? '-en.mp3' : '-pl.mp3');
  return {
    ...handout,
    audioUrlPl: handout.audioUrlPl || (audio.language === 'pl' ? handout.audioUrl : translated),
    audioUrlEn: handout.audioUrlEn || (audio.language === 'en' ? handout.audioUrl : translated),
    reelType: handout.reelType || audio.reelType,
  };
}
