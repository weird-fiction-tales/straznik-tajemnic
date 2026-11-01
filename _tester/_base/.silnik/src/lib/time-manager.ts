/**
 * Time Manager Service
 *
 * Deterministyczny zegar kampanii zarządzający datą i czasem w grze.
 * Oblicza upływ czasu, fazę księżyca, dzień tygodnia.
 * Przechowuje stan w localStorage i synchronizuje z GameContext.
 */

import { GameTime, MoonPhase } from './types';

/** Snapshot of the existing clock, not a second event scheduler. */
export interface CampaignClockSnapshot {
  time: GameTime;
  weather: string;
  deadline: GameTime | null;
  deadlineTotalHours: number;
}

export function isGameTime(value: unknown): value is GameTime {
  if (!value || typeof value !== 'object') return false;
  const t = value as GameTime;
  return [t.year, t.month, t.day, t.hour, t.minute].every(Number.isInteger) &&
    t.year >= 1 && t.year <= 9999 && t.month >= 0 && t.month <= 11 &&
    t.day >= 1 && t.day <= daysInMonth(t.year, t.month) &&
    t.hour >= 0 && t.hour <= 23 && t.minute >= 0 && t.minute <= 59;
}

export function isCampaignClockSnapshot(value: unknown): value is CampaignClockSnapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as CampaignClockSnapshot;
  return isGameTime(s.time) && (s.deadline === null || isGameTime(s.deadline)) &&
    typeof s.weather === 'string' && s.weather.length <= 4000 &&
    Number.isFinite(s.deadlineTotalHours) && s.deadlineTotalHours > 0;
}


// ============================================================================
// DOOM CLOCK TYPES & CONSTANTS (Issue #648 Faza 1 R1)
// ============================================================================

export type DoomClockPhase = 0 | 1 | 2 | 3;

export interface DoomClockStageInfo {
  phase: DoomClockPhase;
  namePl: string;
  nameEn: string;
  descriptionPl: string;
  descriptionEn: string;
  directivePl: string;
  directiveEn: string;
}

export const DOOM_CLOCK_STAGES: Record<DoomClockPhase, DoomClockStageInfo> = {
  0: {
    phase: 0,
    namePl: 'Faza 0: Cisza (Eksploracja)',
    nameEn: 'Phase 0: Silence (Exploration)',
    descriptionPl: 'Brak bezpośredniej presji czasu. Antagoniści działają w cieniu, badacz swobodnie bada poszlaki.',
    descriptionEn: 'No immediate time pressure. Adversaries act in shadows, investigator freely gathers clues.',
    directivePl: 'Utrzymuj naturalne, swobodne tempo śledztwa. Nie przyspieszaj sztucznie akcji. Pozwól graczowi na metodyczną eksplorację otoczenia.',
    directiveEn: 'Maintain a natural, unhurried pace. Do not artificially accelerate events. Allow methodical exploration.',
  },
  1: {
    phase: 1,
    namePl: 'Faza 1: Narastająca presja (Zwiastuny)',
    nameEn: 'Phase 1: Rising Pressure (Omens)',
    descriptionPl: 'Upływ czasu staje się zauważalny. Zamykane urzędy, gasnące światła, zmęczenie, bicie zegarów.',
    descriptionEn: 'Time passing becomes noticeable. Closing offices, fading lights, fatigue, ticking clocks.',
    directivePl: 'Wprowadzaj zmysłowe zwiastuny upływającego czasu (bicie zegara, chłód nocy, zamykane okiennice, zmęczenie). Przypominaj subtelnie o uciekających godzinach.',
    directiveEn: 'Introduce sensory omens of passing time (chiming clocks, night chill, shuttered windows, fatigue). Subtly remind the player that hours are slipping away.',
  },
  2: {
    phase: 2,
    namePl: 'Faza 2: Bezpośrednie zagrożenie (Tykanie zegara)',
    nameEn: 'Phase 2: Direct Threat (Ticking Clock)',
    descriptionPl: 'Zegar tyka głośno. Antagoniści przyspieszają plany, noc potęguje izolację, zwłoka niesie realne straty.',
    descriptionEn: 'Clock is ticking loudly. Adversaries accelerate plans, night isolates the investigator, delays bring real costs.',
    directivePl: 'Aktywnie wywieraj presję czasu na decyzje badacza. Każda godzina bezczynności przybliża zagrożenie. Podkreślaj pośpiech i izolację nocy.',
    directiveEn: 'Actively apply time pressure to decisions. Every idle hour advances danger. Emphasize urgency and night isolation.',
  },
  3: {
    phase: 3,
    namePl: 'Faza 3: Punkt kulminacyjny (Apogeum)',
    nameEn: 'Phase 3: Climax (Apogee)',
    descriptionPl: 'Punkt bez powrotu. Termin nadszedł lub mija, rytuał osiąga apogeum, bezpośrednia konfrontacja lub nieodwracalne konsekwencje.',
    descriptionEn: 'Point of no return. Deadline has arrived or expired, ritual reaches apogee, immediate confrontation or irreversible consequences.',
    directivePl: 'Kulminacja! Stawka dramatyczna osiąga szczyt. Ostateczne odliczanie: konfrontacja lub nieodwracalne skutki rytuału. Brak możliwości cofnięcia czasu.',
    directiveEn: 'Climax! Dramatic stakes peak. Final countdown: confrontation or irreversible consequences. No turning back.',
  },
};

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'coc7_game_time';
const WEATHER_STORAGE_KEY = 'coc7_game_weather';
const MONTHS_PL = [
  'Stycznia',
  'Lutego',
  'Marca',
  'Kwietnia',
  'Maja',
  'Czerwca',
  'Lipca',
  'Sierpnia',
  'Września',
  'Października',
  'Listopada',
  'Grudnia',
];
const DAYS_PL = [
  'Niedziela',
  'Poniedziałek',
  'Wtorek',
  'Środa',
  'Czwartek',
  'Piątek',
  'Sobota',
];
const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAYS_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MOON_PHASES: MoonPhase[] = [
  'new',
  'waxing_crescent',
  'first_quarter',
  'waxing_gibbous',
  'full',
  'waning_gibbous',
  'last_quarter',
  'waning_crescent',
];

const MOON_PHASE_NAMES_PL: Record<MoonPhase, string> = {
  new: 'Nów 🌑',
  waxing_crescent: 'Rosnący Sierp 🌒',
  first_quarter: 'Pierwsza Kwadra 🌓',
  waxing_gibbous: 'Rosnący Garbaty 🌔',
  full: 'Pełnia 🌕',
  waning_gibbous: 'Malejący Garbaty 🌖',
  last_quarter: 'Ostatnia Kwadra 🌗',
  waning_crescent: 'Malejący Sierp 🌘',
};

const MOON_PHASE_NAMES_EN: Record<MoonPhase, string> = {
  new: 'New Moon 🌑',
  waxing_crescent: 'Waxing Crescent 🌒',
  first_quarter: 'First Quarter 🌓',
  waxing_gibbous: 'Waxing Gibbous 🌔',
  full: 'Full Moon 🌕',
  waning_gibbous: 'Waning Gibbous 🌖',
  last_quarter: 'Last Quarter 🌗',
  waning_crescent: 'Waning Crescent 🌘',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Czy rok jest przestępny */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Liczba dni w danym miesiącu */
function daysInMonth(year: number, month: number): number {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 1 && isLeapYear(year)) return 29;
  return days[month];
}

/** Oblicz dzień tygodnia (0 = Niedziela) dla daty */
function getDayOfWeekIndex(year: number, month: number, day: number): number {
  // Algorytm Zeller'a zmodyfikowany
  const date = new Date(year, month, day);
  return date.getDay();
}

/**
 * Oblicz fazę księżyca dla danej daty.
 * Używa przybliżonej formuły opartej na znanej nowiu (np. 6 Stycznia 1920).
 */
function calculateMoonPhase(
  year: number,
  month: number,
  day: number
): MoonPhase {
  // Nów księżyca 6 Stycznia 1920 jako punkt odniesienia
  const referenceDate = new Date(1920, 0, 6);
  const targetDate = new Date(year, month, day);

  const diffMs = targetDate.getTime() - referenceDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Cykl księżycowy ≈ 29.53 dni
  const lunarCycle = 29.53;
  const dayInCycle = ((diffDays % lunarCycle) + lunarCycle) % lunarCycle;

  // Podziel cykl na 8 faz
  const phaseIndex = Math.floor(dayInCycle / (lunarCycle / 8));
  return MOON_PHASES[phaseIndex % 8];
}

/**
 * Interfejs wejściowy do wyznaczania czasu startowego z przygody
 */
export interface AdventureTimeInput {
  id?: string;
  title?: string;
  era?: string;
  yearRange?: string;
  activeSceneYear?: number;
  startDate?: string | Partial<GameTime>;
  initialWeather?: string;
  hook?: string;
  description?: string;
  tone?: 'purist' | 'pulp' | 'noir' | string;
  themes?: string[];
  doomClock?: {
    deadline?: Partial<GameTime>;
    totalHours?: number;
    stages?: Array<{
      phase: 0 | 1 | 2 | 3;
      title: string;
      description: string;
    }>;
  };
}

/**
 * Wyznacza rok startowy gry z przygody:
 * priorytet startDate -> activeSceneYear -> yearRange -> fallback wg era, ostatecznie 1925.
 */
export function deriveStartYear(
  adventure: AdventureTimeInput | null | undefined
): number {
  if (adventure?.startDate) {
    if (typeof adventure.startDate === 'object' && typeof adventure.startDate.year === 'number') {
      return adventure.startDate.year;
    }
    if (typeof adventure.startDate === 'string') {
      const match = adventure.startDate.match(/^(\d{4})/);
      if (match) return parseInt(match[1], 10);
    }
  }

  if (typeof adventure?.activeSceneYear === 'number') {
    return adventure.activeSceneYear;
  }

  const match = adventure?.yearRange?.match(/\d{4}/);
  if (match) return parseInt(match[0], 10);

  switch (adventure?.era) {
    case 'modern':
      return 2024;
    case 'gaslight':
      return 1890;
    case 'classic':
      return 1925;
    case 'noir':
      return 1946;
    case 'prl':
      return 1974;
    default:
      return 1925;
  }
}

const POLISH_MONTH_NAMES_MAP: Record<string, number> = {
  stycznia: 0,
  styczeń: 0,
  styczen: 0,
  lutego: 1,
  luty: 1,
  marca: 2,
  marzec: 2,
  kwietnia: 3,
  kwiecień: 3,
  kwiecien: 3,
  maja: 4,
  maj: 4,
  czerwca: 5,
  czerwiec: 5,
  lipca: 6,
  lipiec: 6,
  sierpnia: 7,
  sierpień: 7,
  sierpien: 7,
  września: 8,
  wrzesnia: 8,
  wrzesień: 8,
  wrzesien: 8,
  października: 9,
  pazdziernika: 9,
  październik: 9,
  pazdziernik: 9,
  listopada: 10,
  listopad: 10,
  grudnia: 11,
  grudzień: 11,
  grudzien: 11,
};

const ENGLISH_MONTH_NAMES_MAP: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

/**
 * Wyznacza początkową godzinę i minutę na podstawie tonu oraz wskazówek z tekstu.
 */
function deriveStartHourAndMinute(
  adventure: AdventureTimeInput | null | undefined,
  text: string
): { hour: number; minute: number } {
  // Skanowanie słów kluczowych pory dnia w tekście
  if (/\b(noc|nocy|nocą|północ|północy|midnight)\b/i.test(text)) {
    return { hour: 22, minute: 0 };
  }
  if (/\b(wieczór|wieczorem|wieczor|zmierzch|zmierzchem|dusk|evening)\b/i.test(text)) {
    return { hour: 19, minute: 0 };
  }
  if (/\b(popołudnie|popołudniu|popoludnie|afternoon)\b/i.test(text)) {
    return { hour: 14, minute: 30 };
  }
  if (/\b(rano|poranek|poranku|porankiem|poranne|świt|świtem|dawn|morning)\b/i.test(text)) {
    return { hour: 9, minute: 30 };
  }

  // Fallback oparty na tonie przygody
  if (adventure?.tone === 'pulp') {
    return { hour: 9, minute: 30 };
  }
  if (adventure?.tone === 'noir' || adventure?.tone === 'purist') {
    return { hour: 19, minute: 0 };
  }

  return { hour: 10, minute: 0 };
}

/**
 * Trzypoziomowe wyznaczanie początkowej daty i godziny gry:
 * 1. Dokładna data z pola startDate (obiekt lub ISO/formatowany string).
 * 2. Naturalna ekstrakcja z tekstu przygody (dzień + miesiąc lub pora roku).
 * 3. Nastrojowy fallback dopasowany do tonu przygody (zamiast wiecznego 14 stycznia).
 */
export function deriveStartGameTime(
  adventure: AdventureTimeInput | null | undefined
): GameTime {
  const year = deriveStartYear(adventure);
  const text = `${adventure?.title ?? ''} ${adventure?.hook ?? ''} ${adventure?.description ?? ''}`.toLowerCase();
  const { hour, minute } = deriveStartHourAndMinute(adventure, text);

  // 1. Jawny obiekt startDate
  if (adventure?.startDate && typeof adventure.startDate === 'object') {
    const s = adventure.startDate;
    return {
      year: typeof s.year === 'number' ? s.year : year,
      month: typeof s.month === 'number' ? Math.max(0, Math.min(11, s.month)) : 9,
      day: typeof s.day === 'number' ? Math.max(1, Math.min(31, s.day)) : 15,
      hour: typeof s.hour === 'number' ? Math.max(0, Math.min(23, s.hour)) : hour,
      minute: typeof s.minute === 'number' ? Math.max(0, Math.min(59, s.minute)) : minute,
    };
  }

  // 2. Jawny string startDate (np. "1973-10-18T19:30" lub "1996-05-12")
  if (adventure?.startDate && typeof adventure.startDate === 'string') {
    const match = adventure.startDate
      .trim()
      .match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2}))?/);
    if (match) {
      const parsedYear = parseInt(match[1], 10);
      const parsedMonth = Math.max(0, Math.min(11, parseInt(match[2], 10) - 1));
      const parsedDay = Math.max(1, Math.min(31, parseInt(match[3], 10)));
      const parsedHour = match[4] !== undefined ? Math.max(0, Math.min(23, parseInt(match[4], 10))) : hour;
      const parsedMinute = match[5] !== undefined ? Math.max(0, Math.min(59, parseInt(match[5], 10))) : minute;

      return {
        year: parsedYear,
        month: parsedMonth,
        day: parsedDay,
        hour: parsedHour,
        minute: parsedMinute,
      };
    }
  }

  // 3. Ekstrakcja dnia i miesiąca z tekstu
  const dayMonthMatch = text.match(
    /\b(\d{1,2})\s+(stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|wrzesnia|października|pazdziernika|listopada|grudnia)\b/i
  );
  if (dayMonthMatch) {
    const d = parseInt(dayMonthMatch[1], 10);
    const m = POLISH_MONTH_NAMES_MAP[dayMonthMatch[2].toLowerCase()];
    if (m !== undefined && d >= 1 && d <= 31) {
      return { year, month: m, day: d, hour, minute };
    }
  }

  // 4. Ekstrakcja samego miesiąca z tekstu (z bezpieczną granicą słów uwzględniającą polskie znaki)
  for (const [mName, mIdx] of Object.entries(POLISH_MONTH_NAMES_MAP)) {
    if (new RegExp(`(?:^|[^a-ząćęłńóśźż0-9])${mName}(?:$|[^a-ząćęłńóśźż0-9])`, 'i').test(text)) {
      return { year, month: mIdx, day: 15, hour, minute };
    }
  }
  for (const [mName, mIdx] of Object.entries(ENGLISH_MONTH_NAMES_MAP)) {
    if (new RegExp(`\\b${mName}\\b`, 'i').test(text)) {
      return { year, month: mIdx, day: 15, hour, minute };
    }
  }

  // 5. Ekstrakcja pory roku z tekstu
  if (/(?:^|[^a-ząćęłńóśźż0-9])(jesie[ńn]|jesienn|autumn|fall)(?:$|[^a-ząćęłńóśźż0-9])/i.test(text)) {
    return { year, month: 9, day: 15, hour, minute }; // Październik
  }
  if (/(?:^|[^a-ząćęłńóśźż0-9])(wiosn|wiosenn|spring)(?:$|[^a-ząćęłńóśźż0-9])/i.test(text)) {
    return { year, month: 4, day: 12, hour, minute }; // Maj
  }
  if (/(?:^|[^a-ząćęłńóśźż0-9])(lato|letni|letnie|letnia|summer)(?:$|[^a-ząćęłńóśźż0-9])/i.test(text)) {
    return { year, month: 6, day: 15, hour, minute }; // Lipiec
  }
  if (/(?:^|[^a-ząćęłńóśźż0-9])(zima|zimow|winter)(?:$|[^a-ząćęłńóśźż0-9])/i.test(text)) {
    return { year, month: 0, day: 15, hour, minute }; // Styczeń
  }

  // 6. Trzypoziomowy fallback dopasowany do tonu
  if (adventure?.tone === 'pulp') {
    return { year, month: 4, day: 18, hour, minute }; // Ciepły majowy start wyprawy
  }
  if (adventure?.tone === 'noir') {
    return { year, month: 10, day: 12, hour, minute }; // Listopadowy chłód
  }

  // Klasyczny purystowski Lovecraft: chłodny październik
  return { year, month: 9, day: 15, hour, minute };
}

/**
 * Wyznacza początkową pogodę scenariusza dopasowaną do miesiąca i klimatu.
 */
export function deriveInitialWeather(
  adventure: AdventureTimeInput | null | undefined,
  gameTime: GameTime,
  locale?: 'pl' | 'en'
): string {
  if (adventure?.initialWeather && adventure.initialWeather.trim() !== '') {
    return adventure.initialWeather.trim();
  }

  const isEn = locale === 'en';
  const { month } = gameTime;

  // Zima (grudzień, styczeń, luty)
  if (month === 11 || month === 0 || month === 1) {
    return isEn
      ? 'Bitter frost, grey snow and freezing wind'
      : 'Przejmujący mróz, szary śnieg i lodowaty wiatr';
  }

  // Wiosna (marzec, kwiecień, maj)
  if (month >= 2 && month <= 4) {
    return isEn
      ? 'Crisp air after a spring shower'
      : 'Rześkie powietrze po wiosennym deszczu';
  }

  // Lato (czerwiec, lipiec, sierpień)
  if (month >= 5 && month <= 7) {
    return isEn
      ? 'Stifling, humid air brewing a thunderstorm'
      : 'Duszne, parne powietrze zwiastujące burzę';
  }

  // Jesień (wrzesień, październik, listopad)
  if (adventure?.tone === 'noir') {
    return isEn
      ? 'Dense autumn fog and cold rain'
      : 'Gęsta jesienna mgła i chłodny deszcz';
  }
  return isEn
    ? 'Cool wind, low hanging clouds and damp air'
    : 'Chłodny wiatr, nisko wiszące chmury i wilgotne powietrze';
}

// ============================================================================
// TIME MANAGER CLASS
// ============================================================================

class TimeManager {
  private currentTime: GameTime;
  private currentWeather: string = 'Lekka mgła, rześkie powietrze';
  private deadline: GameTime | null = null;
  private deadlineTotalHours: number = 24;
  private listeners: Array<(time: GameTime) => void> = [];

  constructor() {
    this.currentTime = this.loadFromStorage() || this.createDefaultTime();
    this.currentWeather = this.loadWeatherFromStorage() || 'Lekka mgła, rześkie powietrze';
  }

  private loadWeatherFromStorage(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(WEATHER_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private saveWeatherToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(WEATHER_STORAGE_KEY, this.currentWeather);
      this.notifyListeners();
    } catch (error) {
      console.error('❌ Error saving Weather:', error);
    }
  }

  // --- Inicjalizacja ---

  private createDefaultTime(): GameTime {
    // Domyślna data: 14 Stycznia 1925, 10:00 (typowa dla CoC 7e)
    return {
      year: 1925,
      month: 0, // Styczeń
      day: 14,
      hour: 10,
      minute: 0,
    };
  }

  private loadFromStorage(): GameTime | null {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!isGameTime(parsed)) return null;
        const stored = parsed as GameTime & { deadline?: unknown; deadlineTotalHours?: unknown };
        if (stored.deadline === null || isGameTime(stored.deadline)) {
          this.deadline = stored.deadline ? { ...stored.deadline } : null;
        }
        if (typeof stored.deadlineTotalHours === 'number' && Number.isFinite(stored.deadlineTotalHours) && stored.deadlineTotalHours > 0) {
          this.deadlineTotalHours = stored.deadlineTotalHours;
        }
        const { year, month, day, hour, minute } = parsed;
        return { year, month, day, hour, minute };
      }
    } catch (error) {
      console.error('❌ Error loading GameTime:', error);
    }
    return null;
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...this.currentTime,
        deadline: this.deadline, deadlineTotalHours: this.deadlineTotalHours }));
      this.notifyListeners();
    } catch (error) {
      console.error('❌ Error saving GameTime:', error);
    }
  }

  // --- Core Time Manipulation ---

  /**
   * Przesuwa czas o podaną liczbę minut.
   * Obsługuje przekroczenie godzin, dni, miesięcy i lat.
   */
  previewAdvanceTime(minutes: number): GameTime {
    let { year, month, day, hour, minute } = this.currentTime;

    minute += minutes;

    // Przelicz minuty na godziny
    while (minute >= 60) {
      minute -= 60;
      hour++;
    }
    while (minute < 0) {
      minute += 60;
      hour--;
    }

    // Przelicz godziny na dni
    while (hour >= 24) {
      hour -= 24;
      day++;
    }
    while (hour < 0) {
      hour += 24;
      day--;
    }

    // Przelicz dni na miesiące
    while (day > daysInMonth(year, month)) {
      day -= daysInMonth(year, month);
      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
    }
    while (day < 1) {
      month--;
      if (month < 0) {
        month = 11;
        year--;
      }
      day += daysInMonth(year, month);
    }

    return { year, month, day, hour, minute };
  }

  advanceTime(minutes: number): GameTime {
    this.currentTime = this.previewAdvanceTime(minutes);
    this.saveToStorage();

    console.log(
      `⏰ Time advanced by ${minutes} min -> ${this.formatDateTime()}`
    );
    return this.currentTime;
  }

  /**
   * Ustaw czas na konkretną wartość.
   */
  setTime(time: Partial<GameTime>): GameTime {
    this.currentTime = { ...this.currentTime, ...time };
    this.saveToStorage();
    return this.currentTime;
  }

  /**
   * Zresetuj czas do domyślnej wartości.
   */
  reset(): GameTime {
    this.currentTime = this.createDefaultTime();
    this.currentWeather = 'Lekka mgła, rześkie powietrze';
    this.deadline = null;
    this.saveToStorage();
    this.saveWeatherToStorage();
    return this.currentTime;
  }

  /**
   * Resetuje zegar na dynamiczną datę startową i pogodę dopasowaną do scenariusza
   * (dokładna data z przygody -> wykrycie pory roku z tekstu -> nastrojowy fallback).
   * Wołać TYLKO na świeży start gry - nadpisuje stary czas z localStorage;
   * NIE wołać na reload zapisanej sesji.
   */
  resetForAdventure(
    adventure: AdventureTimeInput | null | undefined,
    locale?: 'pl' | 'en'
  ): GameTime {
    this.currentTime = deriveStartGameTime(adventure);
    this.currentWeather = deriveInitialWeather(adventure, this.currentTime, locale);
    if (adventure?.doomClock?.deadline) {
      const dl = adventure.doomClock.deadline;
      this.setDeadline(
        {
          year: dl.year ?? this.currentTime.year,
          month: dl.month ?? this.currentTime.month,
          day: dl.day ?? this.currentTime.day,
          hour: dl.hour ?? 23,
          minute: dl.minute ?? 59,
        },
        adventure.doomClock.totalHours ?? 24
      );
    } else {
      this.deadline = null;
    }
    this.saveToStorage();
    this.saveWeatherToStorage();
    return this.currentTime;
  }

  // --- Getters ---

  getTime(): GameTime {
    return { ...this.currentTime };
  }

  getSnapshot(): CampaignClockSnapshot {
    return { time: this.getTime(), weather: this.currentWeather,
      deadline: this.getDeadline(), deadlineTotalHours: this.deadlineTotalHours };
  }

  restoreSnapshot(snapshot: CampaignClockSnapshot): void {
    if (!isCampaignClockSnapshot(snapshot)) throw new Error('Invalid campaign clock snapshot');
    this.currentTime = { ...snapshot.time };
    this.currentWeather = snapshot.weather;
    this.deadline = snapshot.deadline ? { ...snapshot.deadline } : null;
    this.deadlineTotalHours = snapshot.deadlineTotalHours;
    this.saveToStorage();
    this.saveWeatherToStorage();
  }

  getWeather(): string {
    return this.currentWeather;
  }

  setWeather(weather: string): void {
    if (!weather || weather.trim() === '') return;
    this.currentWeather = weather.trim();
    this.saveWeatherToStorage();
  }

  getMoonPhase(): MoonPhase {
    const { year, month, day } = this.currentTime;
    return calculateMoonPhase(year, month, day);
  }

  getDayOfWeek(locale: 'pl' | 'en' = 'pl'): string {
    const { year, month, day } = this.currentTime;
    const idx = getDayOfWeekIndex(year, month, day);
    return locale === 'en' ? DAYS_EN[idx] : DAYS_PL[idx];
  }

  isNight(): boolean {
    const { hour } = this.currentTime;
    return hour < 6 || hour >= 21;
  }

  // --- Formatting ---

  formatDate(locale: 'pl' | 'en' = 'pl'): string {
    const { year, month, day } = this.currentTime;
    if (locale === 'en') {
      return `${MONTHS_EN[month]} ${day}, ${year}`;
    }
    return `${day} ${MONTHS_PL[month]} ${year}`;
  }

  formatTime(): string {
    const { hour, minute } = this.currentTime;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  formatDateTime(locale: 'pl' | 'en' = 'pl'): string {
    return `${this.formatDate(locale)}, ${this.formatTime()}`;
  }

  formatForPrompt(locale: 'pl' | 'en' = 'pl'): string {
    const isEn = locale === 'en';
    const moonPhase = this.getMoonPhase();
    const moonPhaseName = isEn ? MOON_PHASE_NAMES_EN[moonPhase] : MOON_PHASE_NAMES_PL[moonPhase];
    const dayOfWeek = this.getDayOfWeek(locale);
    const timeOfDay = this.isNight() ? (isEn ? 'Night' : 'Noc') : (isEn ? 'Day' : 'Dzień');

    return isEn
      ? `[CURRENT TIME: ${this.formatDateTime(locale)}, ${dayOfWeek}, ${timeOfDay}, Moon Phase: ${moonPhaseName}]`
      : `[AKTUALNY CZAS: ${this.formatDateTime(locale)}, ${dayOfWeek}, ${timeOfDay}, Faza Księżyca: ${moonPhaseName}]`;
  }

  // --- Doom Clock (Zegar Zagłady / Presja Czasu CoC 7e RAW) ---

  /**
   * Ustawia opcjonalny diegetyczny termin scenariusza (np. godzina kolejnego ataku lub licytacji).
   * @param deadline Data i godzina graniczna lub null.
   * @param totalHours Całkowita liczba godzin na realizację terminu (domyślnie 24).
   */
  setDeadline(deadline: GameTime | null, totalHours: number = 24): void {
    this.deadline = deadline ? { ...deadline } : null;
    this.deadlineTotalHours = totalHours > 0 ? totalHours : 24;
    this.saveToStorage();
  }

  /**
   * Zwraca aktualnie skonfigurowany termin scenariusza lub null.
   */
  getDeadline(): GameTime | null {
    return this.deadline ? { ...this.deadline } : null;
  }

  /**
   * Pobiera metadane dla danej fazy Zegara Zagłady (0-3).
   */
  getDoomClockStage(phase: DoomClockPhase): DoomClockStageInfo {
    return DOOM_CLOCK_STAGES[phase] ?? DOOM_CLOCK_STAGES[0];
  }

  /**
   * Wyznacza fazę Zegara Zagłady (0: Cisza, 1: Narastająca presja, 2: Bezpośrednie zagrożenie, 3: Punkt kulminacyjny).
   * Jeśli zdefiniowano termin (deadline), oblicza postęp czasu względem terminu.
   * Jeśli brak terminu, fallback opiera się na upływie godzin nocy (21:00 -> 00:00 -> 03:00 -> 06:00).
   */
  getDoomClockPhase(options?: { deadline?: GameTime | null; totalHours?: number }): DoomClockPhase {
    const targetDeadline = options?.deadline !== undefined ? options.deadline : this.deadline;

    if (targetDeadline) {
      const currentMs = Date.UTC(
        this.currentTime.year,
        this.currentTime.month,
        this.currentTime.day,
        this.currentTime.hour,
        this.currentTime.minute
      );
      const deadlineMs = Date.UTC(
        targetDeadline.year,
        targetDeadline.month,
        targetDeadline.day,
        targetDeadline.hour,
        targetDeadline.minute
      );

      if (currentMs >= deadlineMs) {
        return 3;
      }

      const totalHours = options?.totalHours ?? this.deadlineTotalHours ?? 24;
      if (totalHours <= 0) {
        return 3;
      }
      const totalMs = totalHours * 60 * 60 * 1000;
      const startMs = deadlineMs - totalMs;
      const elapsedMs = currentMs - startMs;
      const progress = elapsedMs / totalMs;

      if (progress < 0.25) return 0;
      if (progress < 0.5) return 1;
      if (progress < 0.75) return 2;
      return 3;
    }

    // Natural night hours fallback:
    // 21:00 -> 00:00 -> 03:00 -> 06:00
    const hour = this.currentTime.hour;
    if (hour >= 21) return 1; // 21:00 - 23:59 (Faza 1: Narastająca presja)
    if (hour >= 0 && hour < 3) return 2; // 00:00 - 02:59 (Faza 2: Bezpośrednie zagrożenie)
    if (hour >= 3 && hour < 6) return 3; // 03:00 - 05:59 (Faza 3: Punkt kulminacyjny)
    return 0; // 06:00 - 20:59 (Faza 0: Cisza)
  }

  /**
   * Formatuje dyrektywę Zegara Zagłady do wstrzyknięcia w prompt MG.
   */
  formatDoomClockDirective(locale: 'pl' | 'en' = 'pl'): string {
    const phase = this.getDoomClockPhase();
    const stage = this.getDoomClockStage(phase);
    if (locale === 'en') {
      return `[DOOM CLOCK: ${stage.nameEn}] ${stage.directiveEn}`;
    }
    return `[ZEGAR ZAGŁADY: ${stage.namePl}] ${stage.directivePl}`;
  }

  // --- Listeners ---

  subscribe(callback: (time: GameTime) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => l(this.currentTime));
  }

  // --- Import/Export (dla save/load) ---

  export(): GameTime {
    return { ...this.currentTime };
  }

  import(time: Partial<GameTime>): void {
    // Defensive merge - jeśli klient wyśle niepełny GameTime (np. brak `minute` -
    // realny edge case z sesji 128 smoke /api/chat), zachowaj poprzednie wartości
    // zamiast nadpisywać undefined. Bez tego formatTime() rzuca "Cannot read
    // properties of undefined (reading 'toString')".
    this.currentTime = {
      year: time.year ?? this.currentTime.year,
      month: time.month ?? this.currentTime.month,
      day: time.day ?? this.currentTime.day,
      hour: time.hour ?? this.currentTime.hour,
      minute: time.minute ?? this.currentTime.minute,
    };
    this.saveToStorage();
    console.log('⏰ GameTime imported:', this.formatDateTime());
  }
}

// Singleton export
export const timeManager = new TimeManager();
