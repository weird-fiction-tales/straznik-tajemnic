'use client';

import { SafeImage } from '@/components/ui/safe-image';
import { Fragment, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import * as Sentry from '@sentry/nextjs';
import { Button } from './button';
import { Badge } from './badge';
import { HelpIcon } from './tooltip';
import { Skull, Zap, Sparkles, Users, RotateCcw, AlertTriangle } from 'lucide-react';
import { ImageLightbox } from './image-lightbox';
import { WizardEquipmentView } from './wizard-equipment-view';
import { PregenCharacterSelector } from './pregen-character-selector';
import {
  RETRO_PORTRAITS,
  getRetroPortraitForOccupation,
  isRetroPortraitUrl,
} from '@/lib/data/character/retro-portraits';
import {
  Character,
  EquipmentItem,
  EquipmentCategory,
  AdventureContext as TypeAdventureContext,
} from '@/lib/types';
import {
  AdventureContext,
  CHARACTER_ARCHETYPES,
  getAdventureContextPrompt,
} from '@/lib/adventures-data';
import { fetchWithApiKeys, isPureTextMode } from '@/lib/api-keys-service';
import {
  findEquipmentByName,
  createEquipmentItem,
  splitTopLevel,
  withEquipmentDefaults,
  getStartingEquipmentForOccupation,
} from '@/lib/equipment-data';
import { collectSSEText } from '@/lib/sse-parser';
import { STAT_FULL_NAMES } from '@/components/ui/character-sheet/types';
import {
  buildRecommendedSkills,
  normalizeSkillName,
} from '@/lib/character/normalize-skill-name';
import {
  distributeRecommendedSkillPoints,
  fillRemainingSkillPoints,
  calculateSkillPointsUsage,
} from '@/lib/character/distribute-skill-points';
import { toast } from '@/components/ui/use-toast';
import { resolveEraVisualProfile } from '@/lib/era-visual-style';
import {
  type CharacterStats,
  type DerivedStats,
  STAT_DESCRIPTIONS,
  DERIVED_DESCRIPTIONS,
  OCCUPATIONS,
  OCCUPATION_DESCRIPTIONS,
  getLocalizedOccupationName,
  getLocalizedOccupationDescription,
  SKILL_DESCRIPTIONS,
  BASE_SKILLS,
  SKILL_CREATION_LIMIT,
  SKILL_LIMIT_EXCEPTIONS,
  AGE_MODIFIERS,
  FIELD_PROMPTS,
  PULP_ARCHETYPES,
} from '@/lib/data/character';
import {
  roll3d6x5,
  roll2d6plus6x5,
  roll3d6x5WithResults,
  roll2d6plus6x5WithResults,
  half,
  fifth,
  calculateDerived as libCalculateDerived,
  getWealthInfo as libGetWealthInfo,
  calculateOccupationPoints as libCalculateOccupationPoints,
  distributePhysPenalty,
  applyTeenPenalty,
  generateItemLore,
  categorizeItem,
  estimateWeight,
} from '@/lib/character';
import { PhysicalDiceScene } from '@/components/dice/physical-dice-scene';
import { traceForDice, type DiceRollTrace } from '@/lib/dice-roll-trace';

// ============================================================================
// DANE REKOMENDACJI
// ============================================================================

/**
 * Mapowanie archetypów na kluczowe umiejętności CoC 7e. Module-level, by render
 * (highlight zielonych rekomendacji w kroku Umiejętności) i autoDistributeSkillsAI
 * korzystały z jednego źródła. Zero zmian logiki - wyniesione 1:1.
 */
/**
 * Nazwy umiejętności są kluczami danych aplikacji (BASE_SKILLS/OCCUPATIONS w
 * lib/data/character) i pozostają po polsku niezależnie od locale UI. Dlatego
 * literale zapisujemy z ucieczkami unicode - wartości runtime identyczne.
 */
const ARCHETYPE_SKILL_MAP: Record<string, string[]> = {
  investigator: [
    'Spostrzegawczo\u015b\u0107',
    'Biblioteka',
    'Psychologia',
    'Perswazja',
  ],
  scholar: ['Biblioteka', 'Historia', 'J\u0119zyk Obcy', 'Nauka'],
  action: ['Walka Wr\u0119cz', 'Bro\u0144 Palna', 'Unik', 'Skok'],
  trickster: ['Ukrywanie', 'Perswazja', 'Psychologia', 'Skradanie'],
  mystic: ['Okultyzm', 'Psychologia', 'Historia', 'Nas\u0142uchiwanie'],
  healer: ['Medycyna', 'Pierwsza Pomoc', 'Psychologia', 'Nauka (Biologia)'],
  custom: [],
};

const PULP_ARCHETYPE_ICONS: Record<string, string> = {
  outsider: '🌲',
  adventurer: '🧭',
  cold_blooded: '🧊',
  crusader: '🛡️',
  bon_vivant: '🥂',
  rogue: '🃏',
  femme_fatale: '💄',
  fixer: '🤝',
  hunter: '🏹',
  dreamer: '💭',
  mystic: '🔮',
  egghead: '💡',
  explorer: '🗺️',
  beefcake: '🏋️',
  sidekick: '👥',
  seeker: '🔍',
  daredevil: '🏎️',
  hard_boiled: '🕵️',
  scholar: '📚',
  heavy: '🥊',
  swashbuckler: '⚔️',
  grease_monkey: '🔧',
};

function getArchetypeSkills(
  archetypeId: string | null,
  rulesetVariant: 'classic' | 'pulp' = 'classic'
): string[] {
  if (!archetypeId) return [];
  if (rulesetVariant === 'pulp') {
    const found = PULP_ARCHETYPES.find((a) => a.id === archetypeId);
    return found?.bonusSkills || [];
  }
  return ARCHETYPE_SKILL_MAP[archetypeId] || [];
}

/** Stabilne identyfikatory umiejętności specjalnych (dane aplikacji, nie UI). */
const NATIVE_LANGUAGE_SKILL = 'J\u0119zyk Ojczysty';
const CREDIT_RATING_SKILL = 'Maj\u0119tno\u015b\u0107';

// ============================================================================
// LOSOWANIE CECH (krok po kroku)
// ============================================================================

/** Klucze 9 cech CoC 7e w stałej kolejności wyświetlania. */
const STAT_KEYS = [
  'str',
  'con',
  'siz',
  'dex',
  'app',
  'int',
  'pow',
  'edu',
  'luck',
] as const;
type StatKey = (typeof STAT_KEYS)[number];

/**
 * Mapa cecha -> wzór rzutu (CoC 7e). SIZ/INT/EDU używają 2K6+6×5, reszta 3K6×5.
 * Spójne z generateRandomStats w @/lib/character/dice (jedno źródło logiki rzutu
 * - tutaj tylko etykieta wzoru i wybór funkcji per pojedynczą cechę).
 */
const STAT_DICE: Record<StatKey, { label: string; roll: () => number; detailed: () => { results: number[]; modifier: number; total: number } }> = {
  str: { label: '3K6×5', roll: roll3d6x5, detailed: roll3d6x5WithResults },
  con: { label: '3K6×5', roll: roll3d6x5, detailed: roll3d6x5WithResults },
  siz: { label: '2K6+6×5', roll: roll2d6plus6x5, detailed: roll2d6plus6x5WithResults },
  dex: { label: '3K6×5', roll: roll3d6x5, detailed: roll3d6x5WithResults },
  app: { label: '3K6×5', roll: roll3d6x5, detailed: roll3d6x5WithResults },
  int: { label: '2K6+6×5', roll: roll2d6plus6x5, detailed: roll2d6plus6x5WithResults },
  pow: { label: '3K6×5', roll: roll3d6x5, detailed: roll3d6x5WithResults },
  edu: { label: '2K6+6×5', roll: roll2d6plus6x5, detailed: roll2d6plus6x5WithResults },
  luck: { label: '3K6×5', roll: roll3d6x5, detailed: roll3d6x5WithResults },
};

/** Stan losowania jednej cechy: czy rzucono i czy zużyto jednorazowy przerzut. */
type StatRollState = { rolled: boolean; rerollUsed: boolean };
type StatRollMap = Record<StatKey, StatRollState>;

/**
 * Spłaszcza wartość pola tła od AI do czytelnego tekstu.
 * AI (Gemini) mimo prośby o string czasem zwraca obiekt/tablicę
 * (np. importantPeople jako [{name, relationship, whyImportant}]).
 * Taka wartość trafiałaby do pola string state i crashowała render
 * karty postaci (React #31 - obiekt jako dziecko JSX). Tu normalizujemy.
 */
function coerceFieldToText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (Array.isArray(value))
    return value
      .map((v) => coerceFieldToText(v))
      .filter(Boolean)
      .join('; ');
  if (typeof value === 'object')
    return Object.values(value as Record<string, unknown>)
      .map((v) => coerceFieldToText(v))
      .filter(Boolean)
      .join(', ');
  return '';
}

function isOracleOverloadedError(errOrStatus: unknown): boolean {
  if (typeof errOrStatus === 'number') {
    return errOrStatus === 429 || errOrStatus === 502 || errOrStatus === 503 || errOrStatus === 504;
  }
  const msg = errOrStatus instanceof Error ? errOrStatus.message : String(errOrStatus ?? '');
  return (
    msg.includes('429') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota') ||
    msg.includes('overloaded') ||
    msg.includes('Service Unavailable')
  );
}

/** Świeża mapa stanu losowania - wszystkie cechy nierzucone, przerzut wolny. */
function createStatRollMap(): StatRollMap {
  return STAT_KEYS.reduce((acc, key) => {
    acc[key] = { rolled: false, rerollUsed: false };
    return acc;
  }, {} as StatRollMap);
}

// ============================================================================
// TYPY
// ============================================================================

interface WizardState {
  step: number;
  rulesetVariant?: 'classic' | 'pulp';
  archetype?: string;
  pulpTalents?: string[];
  // Krok 1
  stats: CharacterStats;
  /**
   * Metoda przydziału charakterystyk (CoC 7e):
   * - 'roll'     - rzut kośćmi (3K6×5 / 2K6+6×5), suma BEZ sztucznego capa, brak
   *                walidacji przeciw budżetowi ~460.
   * - 'pointbuy' - rozdział punktów z TWARDYM capem sumy = 460 (zestaw RAW
   *                40/50/50/50/60/60/70/80), z walidacją.
   */
  statMethod: 'roll' | 'pointbuy';
  age: number;
  derived: DerivedStats;
  // Krok 2
  occupationId: string | null;
  occupationPoints: number;
  // Krok 3
  skills: Record<string, number>;
  occupationPointsUsed: number;
  interestPoints: number;
  interestPointsUsed: number;
  creditRating: number;
  // Krok 4
  name: string;
  gender: string;
  birthplace: string;
  description: string;
  ideology: string;
  importantPeople: string;
  significantPlaces: string;
  personalItems: string;
  traits: string;
  keyConnection: string;
  backstory: string;
  portraitUrl: string | null;
  isGeneratingPortrait: boolean;
  isGeneratingBackstory: boolean;
  isGeneratingNarrative: boolean;
  // Krok 5
  equipment: string;
}

interface WizardArchetype {
  id: string;
  name: string;
  icon: string;
  description: string;
  suggestedOccupations: string[];
  suggestedTraits: string[];
  suggestedMotivations: string[];
  bonusSkills: string[];
  coreCharacteristics: string[];
}

interface Props {
  onCharacterCreated: (character: Character) => void;
  onClose: () => void;
  adventureContext?: AdventureContext | TypeAdventureContext; // Kontekst przygody dla AI
  /**
   * Re-roll: istniejąca postać do "rozdania statystyk od nowa". Zachowuje
   * imię/zawód/historię/dziennik (id), ale gracz rozdaje cechy i umiejętności
   * jeszcze raz. Gdy undefined - tryb tworzenia nowej postaci (bez zmian).
   */
  initialCharacter?: Character;
}

// ============================================================================
// GŁÓWNY KOMPONENT
// ============================================================================

export function CharacterWizardV2({
  onCharacterCreated,
  onClose,
  adventureContext,
  initialCharacter,
}: Props) {
  const t = useTranslations('CharacterWizard');
  const locale = useLocale();
  const dynamicT = t as unknown as ((key: string) => string) & { has?: (key: string) => boolean };
  const statShortDesc: Record<string, string> = {
    str: t('statShort.str'),
    con: t('statShort.con'),
    siz: t('statShort.siz'),
    dex: t('statShort.dex'),
    app: t('statShort.app'),
    int: t('statShort.int'),
    pow: t('statShort.pow'),
    edu: t('statShort.edu'),
    luck: t('statShort.luck'),
  };

  // Funkcja do obliczania umiejętności dynamicznych (Język Ojczysty = WYK, Unik = ZR/2)
  const getInitialSkills = (edu: number, dex: number) => ({
    ...BASE_SKILLS,
    [NATIVE_LANGUAGE_SKILL]: edu, // Język Ojczysty = WYK (zgodnie z CoC7)
    Unik: Math.floor(dex / 2), // Unik = ZR/2 (zgodnie z CoC7)
  });

  // Buduje stan startowy kreatora. Bez `char` - czysta nowa postać.
  // Z `char` (re-roll) - seed koncepcji/historii, statystyki rozdawane od nowa
  // (krok 1, cechy bazowe; zawód wybierany ponownie w kroku 2).
  const buildInitialState = (char?: Character): WizardState => {
    const initialRuleset = char?.rulesetVariant || (adventureContext?.tone === 'pulp' || adventureContext?.rulesetVariant === 'pulp' ? 'pulp' : 'classic');
    const minReqAge = adventureContext?.investigatorRequirements?.minAge ?? 15;
    const maxReqAge = adventureContext?.investigatorRequirements?.maxAge ?? 90;
    const initialAge = char?.age
      ? Math.min(Math.max(char.age, minReqAge), maxReqAge)
      : Math.min(Math.max(25, minReqAge), maxReqAge);

    const base: WizardState = {
      step: 1,
      rulesetVariant: initialRuleset,
      archetype: char?.archetype,
      pulpTalents: char?.pulpTalents ? [...char.pulpTalents] : undefined,
      stats: {
        str: 50,
        con: 50,
        siz: 50,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
        luck: 50,
      },
      statMethod: 'roll',
      age: initialAge,
      derived: libCalculateDerived({ str: 50, con: 50, siz: 50, dex: 50, app: 50, int: 50, pow: 50, edu: 50, luck: 50 }, initialAge, initialRuleset),
      occupationId: null,
      occupationPoints: 0,
      skills: getInitialSkills(50, 50), // Dynamiczne wartości Język Ojczysty i Unik
      occupationPointsUsed: 0,
      interestPoints: 0,
      interestPointsUsed: 0,
      creditRating: 0,
      name: '',
      gender: '',
      birthplace: '',
      description: '',
      ideology: '',
      importantPeople: '',
      significantPlaces: '',
      personalItems: '',
      traits: '',
      keyConnection: '',
      backstory: '',
      portraitUrl: null,
      isGeneratingPortrait: false,
      isGeneratingBackstory: false,
      isGeneratingNarrative: false,
      equipment: '',
    };
    if (!char) return base;
    return {
      ...base,
      age: initialAge,
      name: char.name ?? '',
      gender: char.gender ?? '',
      birthplace: char.birthplace ?? '',
      description: char.description ?? '',
      ideology: char.ideology ?? '',
      importantPeople: char.significantPerson ?? '',
      significantPlaces: char.meaningfulLocation ?? '',
      personalItems: char.treasuredPossession ?? '',
      traits: Array.isArray(char.traits) ? char.traits.join(', ') : '',
      keyConnection: char.background ?? '',
      backstory: char.backstory ?? '',
      portraitUrl: char.portraitUrl ?? null,
    };
  };

  const [state, setState] = useState<WizardState>(() =>
    buildInitialState(initialCharacter)
  );

  const availablePregens = adventureContext?.investigatorRequirements?.pregenCharacters;
  const [showPregenSelector, setShowPregenSelector] = useState<boolean>(() => {
    return Boolean(!initialCharacter && availablePregens && availablePregens.length > 0);
  });

  // Stan dla wybranego archetypu postaci
  const [selectedArchetypeId, setSelectedArchetypeId] = useState<string | null>(
    () => {
      if (initialCharacter?.archetype) {
        const classic = CHARACTER_ARCHETYPES.find(
          (a) => a.id === initialCharacter.archetype || a.name === initialCharacter.archetype
        );
        if (classic) return classic.id;
        const pulp = PULP_ARCHETYPES.find(
          (a) =>
            a.id === initialCharacter.archetype ||
            a.name.pl === initialCharacter.archetype ||
            a.name.en === initialCharacter.archetype
        );
        if (pulp) return pulp.id;
      }
      return null;
    }
  );

  const activeArchetypes = useMemo(() => {
    if (state.rulesetVariant === 'pulp') {
      return PULP_ARCHETYPES.map((a) => ({
        id: a.id,
        name: a.name[locale === 'en' ? 'en' : 'pl'] || a.name.pl,
        icon: PULP_ARCHETYPE_ICONS[a.id] || '⚡',
        description: a.description[locale === 'en' ? 'en' : 'pl'] || a.description.pl,
        suggestedOccupations: a.suggestedOccupations,
        suggestedTraits: a.suggestedTraits,
        suggestedMotivations: [] as string[],
        bonusSkills: a.bonusSkills,
        coreCharacteristics: a.coreCharacteristics,
      }));
    }
    return CHARACTER_ARCHETYPES.map((a) => {
      const localizedName = dynamicT.has?.(`archetypes.${a.id}.name`)
        ? dynamicT(`archetypes.${a.id}.name`)
        : a.name;
      const localizedDesc = dynamicT.has?.(`archetypes.${a.id}.description`)
        ? dynamicT(`archetypes.${a.id}.description`)
        : a.description;
      return {
        id: a.id,
        name: localizedName,
        icon: a.icon,
        description: localizedDesc,
        suggestedOccupations: a.suggestedOccupations,
        suggestedTraits: a.suggestedTraits,
        suggestedMotivations: a.suggestedMotivations || [],
        bonusSkills: ARCHETYPE_SKILL_MAP[a.id] || [],
        coreCharacteristics: [] as string[],
      };
    });
  }, [state.rulesetVariant, locale, dynamicT]);

  // Stan wyszukiwarki i filtra profesji (Krok 3)
  const [occupationSearchQuery, setOccupationSearchQuery] = useState('');
  const [occupationFilter, setOccupationFilter] = useState<
    'all' | 'recommended'
  >('all');

  // State for per-field AI generation
  const [generatingField, setGeneratingField] = useState<string | null>(null);

  // State for preventing double-click on character creation
  const [isCreating, setIsCreating] = useState(false);

  // Krok 2 (Cechy): wybrana metoda przydziału charakterystyk. JEDNO źródło prawdy =
  // `state.statMethod` (część głównego stanu kreatora, używana też przez walidację/zapis).
  // 'roll' = rzut kośćmi krok po kroku, 'pointbuy' = ręczny rozdział z puli 460.
  const statMethod = state.statMethod;
  const setStatMethod = useCallback(
    (method: 'roll' | 'pointbuy') =>
      setState((prev) => ({ ...prev, statMethod: method })),
    []
  );

  // Stan losowania per cecha (czy rzucona + czy zużyto jednorazowy przerzut).
  // Używany tylko w trybie statMethod === 'roll'.
  const [statRolls, setStatRolls] = useState<StatRollMap>(() =>
    createStatRollMap()
  );
  const [visibleDiceTrace, setVisibleDiceTrace] = useState<DiceRollTrace | null>(null);
  const [isDiceAnimating, setIsDiceAnimating] = useState(false);

  // Zarządzanie karami wieku i testami rozwoju WYK (CoC 7e RAW)
  const initialAgeBracket =
    AGE_MODIFIERS.find((m) => state.age >= m.min && state.age <= m.max) ||
    AGE_MODIFIERS[1];
  const [currentAgeBracketKey, setCurrentAgeBracketKey] = useState<string>(
    initialAgeBracket.key
  );
  const [appliedAgePenaltiesKey, setAppliedAgePenaltiesKey] = useState<
    string | null
  >(null);
  const [performedEduChecks, setPerformedEduChecks] = useState<number>(0);
  const [teenLuckRerolled, setTeenLuckRerolled] = useState<boolean>(false);

  const TOTAL_STEPS = 6;

  // ============================================================================
  // FUNKCJE POMOCNICZE
  // ============================================================================

  // IND-178 (sesja 92) - pure helpers przeniesione do @/lib/character
  // (roll/roll3d6x5/roll2d6plus6x5/half/fifth/getDamageAndBuild/getMovement/calculateDerived/calculateOccupationPoints).
  // calculateDerived useCallback wrapper zachowuje stable reference dla useEffect deps.

  const calculateDerived = useCallback(
    (stats: CharacterStats, age: number, ruleset?: 'classic' | 'pulp'): DerivedStats =>
      libCalculateDerived(stats, age, ruleset ?? state.rulesetVariant ?? 'classic'),
    [state.rulesetVariant]
  );

  // Zapisuje nową wartość JEDNEJ cechy + przelicza cechy pochodne i dynamiczne
  // umiejętności (Język Ojczysty = WYK, Unik = ZR/2). Wspólna ścieżka dla rzutu,
  // przerzutu i ręcznej edycji - jedno miejsce trzyma spójność stanu.
  const applyStatValue = useCallback(
    (stat: StatKey, value: number) => {
      setState((prev) => {
        const stats = { ...prev.stats, [stat]: value };
        const derived = calculateDerived(stats, prev.age, prev.rulesetVariant);
        const skills = { ...prev.skills };
        if (stat === 'edu') skills[NATIVE_LANGUAGE_SKILL] = stats.edu;
        if (stat === 'dex') skills.Unik = Math.floor(stats.dex / 2);
        return { ...prev, stats, derived, skills };
      });
    },
    [calculateDerived]
  );

  // 1C: pierwszy rzut dla jednej cechy. Oznacza ją jako rzuconą.
  const rollSingleStat = useCallback(
    (stat: StatKey) => {
      if (isDiceAnimating) return;
      const detail = STAT_DICE[stat].detailed();
      applyStatValue(stat, detail.total);
      setVisibleDiceTrace(traceForDice('d6', detail.results, detail.total, `character-${stat}`, detail.modifier));
      setIsDiceAnimating(true);
      window.setTimeout(() => setIsDiceAnimating(false), 720);
      setStatRolls((prev) => ({
        ...prev,
        [stat]: { ...prev[stat], rolled: true },
      }));
    },
    [applyStatValue, isDiceAnimating]
  );

  // 1D: jednorazowy przerzut cechy - dozwolony tylko po pierwszym rzucie i tylko
  // raz. Po użyciu cecha zostaje zablokowana (rerollUsed).
  const rerollSingleStat = useCallback(
    (stat: StatKey) => {
      const current = statRolls[stat];
      if (!current.rolled || current.rerollUsed) return;
      if (isDiceAnimating) return;
      const detail = STAT_DICE[stat].detailed();
      applyStatValue(stat, detail.total);
      setVisibleDiceTrace(traceForDice('d6', detail.results, detail.total, `character-${stat}-reroll`, detail.modifier));
      setIsDiceAnimating(true);
      window.setTimeout(() => setIsDiceAnimating(false), 720);
      setStatRolls((prev) => ({
        ...prev,
        [stat]: { ...prev[stat], rerollUsed: true },
      }));
    },
    [statRolls, applyStatValue, isDiceAnimating]
  );

  // 1C: skrót "rzuć wszystkie naraz" - losuje TYLKO cechy jeszcze nierzucone.
  // NIE konsumuje przerzutów (te działają wyłącznie na już rzucone cechy).
  const generateStats = useCallback(() => {
    // Wylosuj nowe wartości tylko dla nierzuconych cech (na podstawie aktualnego
    // statRolls z domknięcia). Setter stanu liczy z prev, więc nadpisuje punktowo.
    const rolledValues: Partial<Record<StatKey, number>> = {};
    for (const key of STAT_KEYS) {
      if (!statRolls[key].rolled) rolledValues[key] = STAT_DICE[key].roll();
    }
    if (Object.keys(rolledValues).length === 0) return;

    setState((prev) => {
      const stats = { ...prev.stats };
      for (const key of STAT_KEYS) {
        const v = rolledValues[key];
        if (v !== undefined) stats[key] = v;
      }
      const derived = calculateDerived(stats, prev.age);
      const skills = {
        ...prev.skills,
        [NATIVE_LANGUAGE_SKILL]: stats.edu,
        Unik: Math.floor(stats.dex / 2),
      };
      return { ...prev, stats, derived, skills };
    });
    setStatRolls((prev) => {
      const next = { ...prev };
      for (const key of STAT_KEYS) {
        if (rolledValues[key] !== undefined) {
          next[key] = { ...prev[key], rolled: true };
        }
      }
      return next;
    });
  }, [statRolls, calculateDerived]);

  const selectOccupation = (occupationId: string) => {
    const occ = OCCUPATIONS.find((o) => o.id === occupationId);
    if (!occ) return;
    const points = libCalculateOccupationPoints(occupationId, state.stats);
    // Ekwipunek startowy "na sztywno" wg zawodu (CoC 7e) - deterministycznie,
    // bez AI. Wybór zawodu wstawia jego standardowy zestaw przedmiotów.
    const startingEquipment =
      getStartingEquipmentForOccupation(occupationId).join(', ');
    setState((prev) => ({
      ...prev,
      occupationId,
      occupationPoints: points,
      occupationPointsUsed: 0,
      interestPointsUsed: 0,
      equipment: startingEquipment,
      // RAW: minimalna Majętność zawodu. Kosztuje z puli (creditMin punktów),
      // dlatego trzymamy też kopię w skills dla spójnego wyświetlania.
      creditRating: occ.creditMin,
      skills: { ...prev.skills, [CREDIT_RATING_SKILL]: occ.creditMin },
      interestPoints: prev.stats.int * 2,
    }));
  };

  const updateSkill = (skillName: string, value: number) => {
    // Mity Cthulhu sa zablokowane podczas tworzenia postaci (CoC 7e RAW: 00%)
    if (skillName === 'Mity Cthulhu') return;

    // Dynamiczne wartości bazowe dla Język Ojczysty i Unik
    let baseValue = BASE_SKILLS[skillName] || 0;
    if (skillName === NATIVE_LANGUAGE_SKILL) baseValue = state.stats.edu;
    if (skillName === 'Unik') baseValue = Math.floor(state.stats.dex / 2);

    // Limit 75% podczas tworzenia postaci (wyjątki: Język Ojczysty, Majętność)
    const maxValue = SKILL_LIMIT_EXCEPTIONS.includes(skillName)
      ? 99
      : SKILL_CREATION_LIMIT;
    const newValue = Math.max(baseValue, Math.min(maxValue, value));
    const diff = newValue - (state.skills[skillName] || baseValue);

    const selectedOcc = OCCUPATIONS.find((o) => o.id === state.occupationId);
    const archetypeSkills = getArchetypeSkills(
      selectedArchetypeId,
      state.rulesetVariant
    );
    const occupationalSkills = selectedOcc?.skills || [];
    const recommended = buildRecommendedSkills(
      archetypeSkills,
      occupationalSkills
    );

    const resolveBaseValue = (s: string): number => {
      if (s === NATIVE_LANGUAGE_SKILL) return state.stats.edu;
      if (s === 'Unik') return Math.floor(state.stats.dex / 2);
      return BASE_SKILLS[s] || 1;
    };

    const nextSkills = { ...state.skills, [skillName]: newValue };
    const nextUsage = calculateSkillPointsUsage({
      skills: nextSkills,
      recommendedSkills: recommended,
      creditRating: state.creditRating,
      occupationPoints: state.occupationPoints,
      interestPoints: state.interestPoints,
      getBaseValue: resolveBaseValue,
    });

    // Jeśli zmiana zwiększa wartość i przekracza limity: blokujemy
    if (
      diff > 0 &&
      (nextUsage.isTotalOverLimit ||
        nextUsage.isInterestOverLimit ||
        nextUsage.isOccupationOverLimit)
    ) {
      return;
    }

    setState((prev) => ({
      ...prev,
      skills: nextSkills,
      occupationPointsUsed: nextUsage.occupationPointsUsed,
      interestPointsUsed: nextUsage.interestPointsUsed,
    }));
  };

  // Stan dla automatycznego rozdzielania punktów
  const [isDistributingSkills, setIsDistributingSkills] = useState(false);
  // Stan dla modala potwierdzenia resetu punktów
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  // Stan dla błędu przeciążenia Wyroczni (429/503) w kreatorze
  const [oracleOverloaded, setOracleOverloaded] = useState<{ step: 'skills' | 'biography' } | null>(null);

  const renderOracleOverloadedBanner = (testId: string, onRetryAction: () => void) => (
    <div
      data-testid={testId}
      className="border border-amber-500/50 bg-black/90 p-4 shadow-[0_0_25px_rgba(245,158,11,0.2)] relative space-y-3 animate-in fade-in zoom-in-95"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 flex-1">
          <h4 className="text-sm font-display font-bold uppercase tracking-wider text-amber-200">
            {t('oracleOverloadedTitle')}
          </h4>
          <p className="text-xs font-serif text-foreground/90 leading-relaxed">
            {t('oracleOverloadedDesc')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1 border-t border-brass/20">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setOracleOverloaded(null);
            onRetryAction();
          }}
          className="bg-amber-600 hover:bg-amber-500 text-black font-display font-semibold text-xs uppercase tracking-wider"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          {t('oracleRetry')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOracleOverloaded(null)}
          className="border-brass/30 text-brass text-xs font-display uppercase tracking-wider hover:bg-brass/10"
        >
          {t('oracleDismiss')}
        </Button>
      </div>
    </div>
  );

  useEffect(() => {
    if (!isResetConfirmOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsResetConfirmOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isResetConfirmOpen]);

  // Funkcja AI do automatycznego rozdzielania punktów umiejętności
  const autoDistributeSkillsAI = async () => {
    if (isDistributingSkills) return;
    setIsDistributingSkills(true);

    const selectedOcc = OCCUPATIONS.find((o) => o.id === state.occupationId);
    const selectedArchetype = activeArchetypes.find(
      (a) => a.id === selectedArchetypeId
    );
    // Majętność jest już opłacona z puli zawodowej (creditRating punktów) -
    // punkty zawodowe (RAW) idą deterministycznie na umiejętności zawodowe i archetypu.
    // Punkty zainteresowań (interestPoints = INT × 2) są ZAWSZE dedykowane AI,
    // by zgodnie z tłem i opisem postaci rozdało je na hobby/umiejętności poboczne.
    const occupationalPool = Math.max(
      0,
      state.occupationPoints - state.creditRating
    );
    const interestPool = Math.max(0, state.interestPoints);
    const totalPoints = occupationalPool + interestPool;
    const occupationalSkills = selectedOcc?.skills || [];

    // Mapowanie archetypów na kluczowe umiejętności
    const archetypeSkills = getArchetypeSkills(
      selectedArchetypeId,
      state.rulesetVariant
    );

    // JEDNO źródło prawdy dla rekomendowanych (highlight ★ ORAZ przydział):
    // archetyp ∪ zawód, specjalizacje znormalizowane (`Nauka (Biologia)` →
    // `Nauka`), `Dowolna` odrzucona. Bez tego punkty uciekały do kluczy-widm.
    const recommendedSkills = buildRecommendedSkills(
      archetypeSkills,
      occupationalSkills
    );

    // Helpery wartości bazowej / limitu - spójne z resztą funkcji.
    const resolveBaseValue = (skill: string): number => {
      if (skill === NATIVE_LANGUAGE_SKILL) return state.stats.edu;
      if (skill === 'Unik') return Math.floor(state.stats.dex / 2);
      return BASE_SKILLS[skill] || 1;
    };
    const resolveMaxValue = (skill: string): number =>
      SKILL_LIMIT_EXCEPTIONS.includes(skill) ? 99 : SKILL_CREATION_LIMIT;

    // KROK 1 (DETERMINISTYCZNY): zaspokój rekomendowane NAJPIERW z puli zawodowej,
    // równo do limitu 75%. Resztę z puli zawodowej + pełną pulę zainteresowań (INT × 2)
    // przekazujemy do AI na umiejętności pasujące do tła postaci.
    const deterministic = distributeRecommendedSkillPoints({
      recommendedSkills,
      currentSkills: state.skills,
      totalPoints: occupationalPool,
      getBaseValue: resolveBaseValue,
      getMaxValue: resolveMaxValue,
    });
    // Floor: po rozdaniu deterministycznym rekomendowane nie mogą zostać
    // obcięte przez normalizację nadmiaru AI poniżej tych wartości.
    const recommendedFloor: Record<string, number> = {};
    for (const skill of recommendedSkills) {
      recommendedFloor[skill] =
        deterministic.skills[skill] ?? resolveBaseValue(skill);
    }
    // Punkty pozostałe do rozdania przez AI: niewykorzystane zawodowe + cała pula zainteresowań.
    const remainingForAI = deterministic.remainingPoints + interestPool;

    // Jeśli łączna pula do rozdania wynosi 0 (np. postać o skrajnych cechach bez punktów):
    if (remainingForAI <= 0) {
      const zeroUsage = calculateSkillPointsUsage({
        skills: deterministic.skills,
        recommendedSkills,
        creditRating: state.creditRating,
        occupationPoints: state.occupationPoints,
        interestPoints: state.interestPoints,
        getBaseValue: resolveBaseValue,
      });
      setState((prev) => ({
        ...prev,
        skills: deterministic.skills,
        occupationPointsUsed: zeroUsage.occupationPointsUsed,
        interestPointsUsed: zeroUsage.interestPointsUsed,
      }));
      toast({
        variant: 'success',
        title: t('toasts.skillsAllocatedTitle'),
        description: t('toasts.skillsAllocatedDescription', {
          used: deterministic.pointsUsed,
          total: totalPoints,
        }),
      });
      setIsDistributingSkills(false);
      return;
    }

    // Kontekst postaci dla AI
    const characterContext = [
      selectedArchetype &&
        t('ctxArchetype', {
          value: `${selectedArchetype.name} - ${selectedArchetype.description}`,
        }),
      state.name && t('ctxName', { value: state.name }),
      selectedOcc && t('ctxOccupation', { value: selectedOcc.name }),
      state.description && t('ctxDescription', { value: state.description }),
      state.traits && t('ctxTraits', { value: state.traits }),
      state.ideology && t('ctxIdeology', { value: state.ideology }),
    ]
      .filter(Boolean)
      .join('\n');

    const prompt = t('prompts.skills', {
      context: characterContext || t('investigator'),
      occupation: selectedOcc?.name || t('unknown'),
      occSkills: occupationalSkills.join(', '),
      archetypeBlock:
        archetypeSkills.length > 0
          ? t('archetypeKeySkills', {
              archetype: selectedArchetype?.name ?? '',
              skills: archetypeSkills.join(', '),
            })
          : '',
      recommended: recommendedSkills.join(', ') || t('noneFallback'),
      remaining: remainingForAI,
      limit: SKILL_CREATION_LIMIT,
      skillsList: Object.entries(BASE_SKILLS)
        .filter(
          ([name]) =>
            name !== CREDIT_RATING_SKILL &&
            name !== NATIVE_LANGUAGE_SKILL &&
            name !== 'Unik' &&
            name !== 'Mity Cthulhu'
        )
        .map(([name, base]) => `${name}: ${base}%`)
        .join('\n'),
      recommendedTop:
        recommendedSkills.slice(0, 8).join(', ') || t('noneFallback'),
    });

    try {
      const response = await fetchWithApiKeys('/api/ai/utility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          messages: [],
          json: true,
          responseMimeType: 'application/json',
        }),
      });

      if (!response.ok) {
        Sentry.captureMessage(
          `Character wizard skills API error: ${response.status} ${response.statusText}`,
          'error'
        );
        if (response.status === 429 || response.status === 502 || response.status === 503) {
          setOracleOverloaded({ step: 'skills' });
        } else {
          toast({
            variant: 'destructive',
            title: t('toasts.apiError'),
            description: `${response.status} ${response.statusText}`,
          });
        }
        setIsDistributingSkills(false);
        return;
      }

      // === NOWA OBSŁUGA STRUMIENIOWANIA (SSE) ===
      const fullContent = await collectSSEText(response);

      // Odporny parser JSON
      let parsed: unknown = null;
      if (fullContent) {
        let jsonStr = fullContent
          .replace(/```(?:json)?\n?/gi, '')
          .replace(/```\n?/g, '')
          .trim();

        const jsonMatch = jsonStr.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0].trim();
        }
        jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

        try {
          parsed = JSON.parse(jsonStr);
        } catch (parseErr) {
          Sentry.captureException(parseErr, {
            extra: { rawResponse: fullContent.substring(0, 500) },
          });
        }
      }

      // Wyciągnij mapę umiejętności z różnych formatów odpowiedzi AI
      let skillsMap: Record<string, unknown> = {};

      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        if (
          obj.skills &&
          typeof obj.skills === 'object' &&
          !Array.isArray(obj.skills)
        ) {
          skillsMap = obj.skills as Record<string, unknown>;
        } else if (
          obj['umiejętności'] &&
          typeof obj['umiejętności'] === 'object' &&
          !Array.isArray(obj['umiejętności'])
        ) {
          skillsMap = obj['umiejętności'] as Record<string, unknown>;
        } else if (
          obj['umiejetnosci'] &&
          typeof obj['umiejetnosci'] === 'object' &&
          !Array.isArray(obj['umiejetnosci'])
        ) {
          skillsMap = obj['umiejetnosci'] as Record<string, unknown>;
        } else if (
          obj.skills_distribution &&
          typeof obj.skills_distribution === 'object' &&
          !Array.isArray(obj.skills_distribution)
        ) {
          skillsMap = obj.skills_distribution as Record<string, unknown>;
        } else if (Array.isArray(obj.skills)) {
          for (const item of obj.skills) {
            if (item && typeof item === 'object') {
              const k = (item.skill || item.name || item.nazwa) as string;
              const v =
                item.value ?? item.points ?? item.punkty ?? item.nowaWartość;
              if (k && v !== undefined) skillsMap[k] = v;
            }
          }
        } else if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && typeof item === 'object') {
              const k = (item.skill || item.name || item.nazwa) as string;
              const v =
                item.value ?? item.points ?? item.punkty ?? item.nowaWartość;
              if (k && v !== undefined) skillsMap[k] = v;
            }
          }
        } else {
          // Bezpośrednia mapa: { "Spostrzegawczość": 50, ... }
          const hasNumericValues = Object.values(obj).some(
            (v) =>
              typeof v === 'number' ||
              (typeof v === 'string' && !isNaN(Number(v)))
          );
          if (hasNumericValues) {
            skillsMap = obj;
          }
        }
      }

      // Oblicz zużyte punkty - START od deterministycznego rozdania
      // rekomendowanych (KROK 1). AI dokłada na pozostałe, nie ruszając ich.
      let pointsUsed = deterministic.pointsUsed;
      const newSkills = { ...deterministic.skills };
      const touchedSkills: string[] = [];

      for (const [rawSkillName, rawValue] of Object.entries(skillsMap)) {
        const numValue =
          typeof rawValue === 'number' ? rawValue : Number(rawValue);
        if (isNaN(numValue) || numValue <= 0) continue;

        const skillName = normalizeSkillName(rawSkillName);
        if (
          !skillName ||
          skillName === CREDIT_RATING_SKILL ||
          skillName === 'Mity Cthulhu'
        ) {
          continue; // Ignoruj nieznane umiejętności, Majętność i Mity Cthulhu
        }

        let baseValue = BASE_SKILLS[skillName] || 0;
        if (skillName === NATIVE_LANGUAGE_SKILL) baseValue = state.stats.edu;
        if (skillName === 'Unik') baseValue = Math.floor(state.stats.dex / 2);

        // Floor: nie pozwól AI obniżyć rekomendowanej poniżej jej
        // deterministycznej wartości (highlight ↔ przydział = ten sam zbiór).
        const lowerBound = recommendedFloor[skillName] ?? baseValue;

        const maxValue = SKILL_LIMIT_EXCEPTIONS.includes(skillName)
          ? 99
          : SKILL_CREATION_LIMIT;
        const clampedValue = Math.max(
          lowerBound,
          Math.min(maxValue, numValue)
        );

        const previousValue = newSkills[skillName] ?? baseValue;
        if (clampedValue > previousValue) {
          pointsUsed += clampedValue - previousValue;
          newSkills[skillName] = clampedValue;
          touchedSkills.push(skillName);
        }
      }

      // Sprawdź czy nie przekroczono limitu
      if (pointsUsed <= totalPoints) {
        // Dopełnij brakujące punkty deterministycznie (np. gdy AI rozdało mniej niż remainingForAI)
        const remainingPoints = totalPoints - pointsUsed;
        if (remainingPoints > 0) {
          const fillResult = fillRemainingSkillPoints({
            skills: newSkills,
            remainingPoints,
            prioritySkills:
              touchedSkills.length > 0 ? touchedSkills : recommendedSkills,
            getBaseValue: resolveBaseValue,
            getMaxValue: resolveMaxValue,
          });
          pointsUsed += fillResult.pointsUsed;
          Object.assign(newSkills, fillResult.skills);
        }

        const finalUsage = calculateSkillPointsUsage({
          skills: newSkills,
          recommendedSkills,
          creditRating: state.creditRating,
          occupationPoints: state.occupationPoints,
          interestPoints: state.interestPoints,
          getBaseValue: resolveBaseValue,
        });

        setState((prev) => ({
          ...prev,
          skills: newSkills,
          occupationPointsUsed: finalUsage.occupationPointsUsed,
          interestPointsUsed: finalUsage.interestPointsUsed,
        }));
        // Sukces - pokaż krótki komunikat
        toast({
          variant: 'success',
          title: t('toasts.skillsAllocatedTitle'),
          description: t('toasts.skillsAllocatedDescription', {
            used: pointsUsed,
            total: totalPoints,
          }),
        });
      } else {
        // === AI przydzieliło za dużo - obetnij nadmiarowe punkty proporcjonalnie ===
        const excessPoints = pointsUsed - totalPoints;
        let pointsToRemove = excessPoints;

        // Sortuj umiejętności według wartości dodanej (od największej).
        // `floor` chroni rekomendowane przed obcięciem poniżej deterministyki:
        // dla nie-rekomendowanych floor = baza, więc reducible = pełne `added`.
        const skillsSortedByValue = Object.entries(newSkills)
          .map(([name, value]) => {
            let baseValue = BASE_SKILLS[name] || 0;
            if (name === NATIVE_LANGUAGE_SKILL) baseValue = state.stats.edu;
            if (name === 'Unik') baseValue = Math.floor(state.stats.dex / 2);
            const floor = recommendedFloor[name] ?? baseValue;
            return {
              name,
              value,
              floor,
              // Tylko punkty powyżej floor wolno obciąć (chroni rekomendowane).
              reducible: Math.max(0, (value as number) - floor),
            };
          })
          .filter((s) => s.reducible > 0)
          .sort((a, b) => b.reducible - a.reducible);

        // Obcinaj punkty od umiejętności z największą liczbą obcinalnych punktów
        for (const skill of skillsSortedByValue) {
          if (pointsToRemove <= 0) break;

          const reduction = Math.min(pointsToRemove, skill.reducible);
          newSkills[skill.name] = (skill.value as number) - reduction;
          pointsToRemove -= reduction;
          pointsUsed -= reduction;
        }

        const finalUsageAfterReduction = calculateSkillPointsUsage({
          skills: newSkills,
          recommendedSkills,
          creditRating: state.creditRating,
          occupationPoints: state.occupationPoints,
          interestPoints: state.interestPoints,
          getBaseValue: resolveBaseValue,
        });

        setState((prev) => ({
          ...prev,
          skills: newSkills,
          occupationPointsUsed: finalUsageAfterReduction.occupationPointsUsed,
          interestPointsUsed: finalUsageAfterReduction.interestPointsUsed,
        }));
        toast({
          variant: 'success',
          title: t('toasts.skillsAllocatedTitle'),
          // Po normalizacji suma = pełna pula, więc nie straszymy gracza
          // "obcięciem" - z jego perspektywy wszystkie punkty są wydane.
          description: t('toasts.skillsAllocatedDescription', {
            used: pointsUsed,
            total: totalPoints,
          }),
        });
      }
    } catch (err) {
      Sentry.captureException(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (
        errMsg.includes('429') ||
        errMsg.includes('502') ||
        errMsg.includes('503') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('quota')
      ) {
        setOracleOverloaded({ step: 'skills' });
      } else {
        toast({
          variant: 'destructive',
          title: t('toasts.aiConnectionErrorTitle'),
          description: err instanceof Error ? err.message : t('toasts.unknownError'),
        });
      }
    }

    setIsDistributingSkills(false);
  };

  // Powiększenie portretu (lightbox) - klik na miniaturę otwiera pełny widok.
  const [showPortraitZoom, setShowPortraitZoom] = useState(false);
  // Modal wyboru retro-ryciny z epoki (Issue #442)
  const [showRetroPortraitPicker, setShowRetroPortraitPicker] = useState(false);
  // Filtr widoku umiejętności w Kroku 4 (Issue #414)
  const [skillFilter, setSkillFilter] = useState<'all' | 'occupational' | 'invested'>('all');

  const generatePortrait = async () => {
    // Zabezpieczenie: nie uruchamiaj w trybie tekstowym lub gdy już trwa generowanie
    if (isPureTextMode() || state.isGeneratingPortrait) {
      return;
    }

    setState((prev) => ({ ...prev, isGeneratingPortrait: true }));
    const { name, gender, age, description } = state;
    const occupation =
      getLocalizedOccupationName(
        OCCUPATIONS.find((o) => o.id === state.occupationId),
        'en'
      ) || '';

    // Era z kontekstu przygody lub domyślna
    const rawEra = adventureContext
      ? (adventureContext.yearRange || adventureContext.eraLabel || adventureContext.era || '1920s')
      : '1920s';

    const prompt = `Portrait of a ${age} year old ${gender || 'person'}, ${occupation}, ${description || 'mysterious appearance'}, ${rawEra} period-accurate portrait, realistic, dramatic lighting, authentic period photograph aesthetic`;

    // A5: gdy portret JUŻ istnieje, to "Generuj ponownie" - dołączamy losowy
    // seed, by ominąć cache /api/imagen (klucz = md5(prompt+style+seed)).
    // Bez tego identyczny prompt dawał cache hit → ten sam obraz ("nie działa").
    // Pierwsza generacja (brak portretu) idzie bez seed - normalny cache.
    const isRegenerate = state.portraitUrl != null;
    const seed = isRegenerate
      ? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      : undefined;

    try {
      const response = await fetchWithApiKeys('/api/imagen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style: 'portrait',
          era: rawEra,
          ...(seed && { seed }),
        }),
      });

      const data = await response.json();

      if (data.success && data.imageUrl) {
        setState((prev) => ({ ...prev, portraitUrl: data.imageUrl }));
      } else if (data.error) {
        Sentry.captureMessage(
          `Character wizard portrait error: ${data.error}`,
          'error'
        );
        toast({
          variant: 'destructive',
          title: t('toasts.portraitErrorTitle'),
          description: data.error,
        });
      } else {
        Sentry.captureMessage(
          'Character wizard: unknown portrait response',
          'error'
        );
        toast({
          variant: 'destructive',
          title: t('toasts.portraitErrorTitle'),
          description: t('toasts.portraitUnknownError'),
        });
      }
    } catch (err) {
      Sentry.captureException(err);
      toast({
        variant: 'destructive',
        title: t('toasts.connectionErrorTitle'),
        description: t('toasts.portraitConnectionError'),
      });
    } finally {
      // Zawsze resetuj stan, nawet przy niespodziewanych błędach
      setState((prev) => ({ ...prev, isGeneratingPortrait: false }));
    }
  };

  // AI Backstory Generation
  const generateBackstory = async () => {
    setState((prev) => ({ ...prev, isGeneratingBackstory: true }));

    const occupation = OCCUPATIONS.find((o) => o.id === state.occupationId);
    const occupationName = getLocalizedOccupationName(occupation, locale) || t('researcherLowercase');

    // Buduj kontekst przygody dla promptu
    const adventurePrompt = adventureContext
      ? getAdventureContextPrompt(adventureContext as AdventureContext)
      : t('defaultAdventureEra');

    // === LOSOWE ELEMENTY DLA RÓŻNORODNOŚCI (słowniki w messages/*.json) ===
    const personalitySeeds = t.raw('personalitySeeds') as string[];
    const backgroundFlavors = t.raw('backgroundFlavors') as string[];
    const motivations = t.raw('motivationSeeds') as string[];

    // Wybierz losowe elementy
    const randomPersonality =
      personalitySeeds[Math.floor(Math.random() * personalitySeeds.length)];
    const randomBackground =
      backgroundFlavors[Math.floor(Math.random() * backgroundFlavors.length)];
    const randomMotivation =
      motivations[Math.floor(Math.random() * motivations.length)];
    const randomSeed = Math.floor(Math.random() * 10000);

    const prompt = t('prompts.backstory', {
      adventure: adventurePrompt,
      gender: state.gender || t('person'),
      age: state.age,
      occupation: occupationName,
      personality: randomPersonality,
      background: randomBackground,
      motivation: randomMotivation,
      seed: randomSeed,
    });

    /* ORYGINALNA STRUKTURA PROMPTU (JSON schema w treści) - przeniesiona do
       messages/*.json (CharacterWizard.prompts.backstory). */


    try {
      const response = await fetchWithApiKeys('/api/ai/utility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          messages: [],
          json: true,
          responseMimeType: 'application/json',
        }),
      });

      if (!response.ok) {
        if (response.status === 429 || response.status === 502 || response.status === 503) {
          setOracleOverloaded({ step: 'biography' });
          setState((prev) => ({ ...prev, isGeneratingBackstory: false }));
          return;
        }
        throw new Error(
          t('apiErrorWithStatus', {
            status: response.status,
            statusText: response.statusText,
          })
        );
      }

      // === NOWA OBSŁUGA STRUMIENIOWANIA (SSE) ===
      const fullContent = await collectSSEText(response);

      if (fullContent) {
        try {
          // Extract JSON from response - ulepszony parser
          let jsonStr = fullContent
            .replace(/```(?:json)?\n?/gi, '')
            .replace(/```\n?/g, '')
            .trim();

          // 2. Znajdź JSON w odpowiedzi (od { do })
          const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonStr = jsonMatch[0].trim();
          }
          if (!jsonStr.startsWith('{')) {
            throw new Error(t('jsonNotFound'));
          }

          // 3. Napraw typowe błędy JSON
          jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

          const parsed = JSON.parse(jsonStr);

          setState((prev) => ({
            ...prev,
            // Walidacja nazwy: tylko imię i nazwisko (max 4 słowa)
            name: (() => {
              if (!parsed.name) return prev.name;
              // Usuń nadmiarowe spacje i znaki specjalne
              let cleanName = parsed.name
                .trim()
                .replace(/[\n\r\t]+/g, ' ')
                .replace(/\s+/g, ' ');
              // Jeśli nazwa ma więcej niż 4 słowa, prawdopodobnie AI wstawiło opis
              const words = cleanName.split(' ');
              if (words.length > 4) {
                cleanName = words.slice(0, 3).join(' ');
              }
              // Usuń znaki specjalne oprócz liter polskich, spacji i myślników
              cleanName = cleanName.replace(
                /[^a-zA-Z\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c\u0104\u0106\u0118\u0141\u0143\u00d3\u015a\u0179\u017b\s-]/g,
                ''
              );
              return cleanName || prev.name;
            })(),
            birthplace: coerceFieldToText(parsed.birthplace) || prev.birthplace,
            description:
              coerceFieldToText(parsed.description) || prev.description,
            ideology: coerceFieldToText(parsed.ideology) || prev.ideology,
            importantPeople:
              coerceFieldToText(parsed.importantPeople) || prev.importantPeople,
            significantPlaces:
              coerceFieldToText(parsed.significantPlaces) ||
              prev.significantPlaces,
            personalItems:
              coerceFieldToText(parsed.personalItems) || prev.personalItems,
            traits: coerceFieldToText(parsed.traits) || prev.traits,
            keyConnection:
              coerceFieldToText(parsed.keyConnection) || prev.keyConnection,
            isGeneratingBackstory: false,
          }));
        } catch (parseErr) {
          Sentry.captureException(parseErr);
          toast({
            variant: 'destructive',
            title: t('toasts.parseErrorTitle'),
            description: t('toasts.tryAgain'),
          });
          setState((prev) => ({ ...prev, isGeneratingBackstory: false }));
        }
      } else {
        Sentry.captureMessage(
          'Character wizard: empty AI response (backstory)',
          'error'
        );
        setState((prev) => ({ ...prev, isGeneratingBackstory: false }));
      }
    } catch (err) {
      Sentry.captureException(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (
        errMsg.includes('429') ||
        errMsg.includes('502') ||
        errMsg.includes('503') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('quota')
      ) {
        setOracleOverloaded({ step: 'biography' });
      } else {
        toast({
          variant: 'destructive',
          title: t('toasts.aiConnectionErrorTitle'),
          description: t('toasts.tryAgain'),
        });
      }
      setState((prev) => ({ ...prev, isGeneratingBackstory: false }));
    }
  };

  const generateNarrativeBiography = async () => {
    setState((prev) => ({ ...prev, isGeneratingNarrative: true }));
    const occupation = OCCUPATIONS.find((o) => o.id === state.occupationId);
    const occupationName = getLocalizedOccupationName(occupation, locale) || t('researcherLowercase');
    const adventurePrompt = adventureContext
      ? getAdventureContextPrompt(adventureContext as AdventureContext)
      : t('defaultAdventureEra');

    const prompt = t('prompts.biography', {
      adventure: adventurePrompt,
      name: state.name,
      gender: state.gender,
      age: state.age,
      occupation: occupationName,
      birthplace: state.birthplace,
      appearance: state.description,
      ideology: state.ideology,
      people: state.importantPeople,
      places: state.significantPlaces,
      items: state.personalItems,
      traits: state.traits,
      connection: state.keyConnection,
    });

    try {
      const response = await fetchWithApiKeys('/api/ai/utility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          messages: [],
        }),
      });

      if (!response.ok) throw new Error('API Error');

      let fullContent = await collectSSEText(response);
      if (fullContent) {
        fullContent = fullContent.replace(/```(markdown|text)?\n?/gi, '').replace(/```\n?/g, '').trim();
        setState((prev) => ({ ...prev, backstory: fullContent, isGeneratingNarrative: false }));
      }
    } catch (err) {
      console.error(err);
      setState((prev) => ({ ...prev, isGeneratingNarrative: false }));
    }
  };

  const generateSingleField = async (fieldName: string) => {
    if (generatingField) return;
    setGeneratingField(fieldName);

    // Buduj kontekst z istniejących pól
    const contextParts: string[] = [];
    const occupation = OCCUPATIONS.find((o) => o.id === state.occupationId);
    if (occupation)
      contextParts.push(t('ctxOccupation', { value: getLocalizedOccupationName(occupation, locale) }));
    if (state.age) contextParts.push(t('ctxAge', { value: state.age }));
    if (state.gender) contextParts.push(t('ctxGender', { value: state.gender }));
    if (state.name && fieldName !== 'name')
      contextParts.push(t('ctxName', { value: state.name }));
    if (state.birthplace && fieldName !== 'birthplace')
      contextParts.push(t('ctxOrigin', { value: state.birthplace }));
    if (state.description && fieldName !== 'description')
      contextParts.push(t('ctxAppearance', { value: state.description }));
    if (state.ideology && fieldName !== 'ideology')
      contextParts.push(t('ctxIdeology', { value: state.ideology }));
    if (state.traits && fieldName !== 'traits')
      contextParts.push(t('ctxTraits', { value: state.traits }));
    if (state.importantPeople && fieldName !== 'importantPeople')
      contextParts.push(t('ctxImportantPeople', { value: state.importantPeople }));

    // Dodaj kontekst przygody jeśli dostępny
    const adventureInfo = adventureContext
      ? `\n\nKONTEKST PRZYGODY:\n- Lokalizacja: ${adventureContext.location || ''}\n- Era: ${adventureContext.eraLabel || ''} (${adventureContext.yearRange || ''})\n- Motywy: ${adventureContext.themes?.join(', ') || ''}`
      : '';

    const prompt = t('prompts.field', {
      context:
        contextParts.length > 0
          ? contextParts.join('\n')
          : t('noAdditionalContext'),
      adventure: adventureInfo,
      field: FIELD_PROMPTS[fieldName] || fieldName,
      style: adventureContext
        ? t('fieldStyleAdventure', {
            location: adventureContext.location || '',
            years: adventureContext.yearRange || '',
          })
        : t('fieldStyleDefault'),
    });

    try {
      const response = await fetchWithApiKeys('/api/ai/utility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, messages: [] }),
      });

      if (!response.ok) {
        throw new Error(
          t('apiErrorWithStatus', {
            status: response.status,
            statusText: response.statusText,
          })
        );
      }

      // === NOWA OBSŁUGA STRUMIENIOWANIA (SSE) ===
      const fullContent = await collectSSEText(response);

      if (fullContent) {
        // Wyczyść odpowiedź z markdown artifacts
        const cleanValue = fullContent
          .replace(/```[a-z]*\n?|\n?```/gi, '')
          .replace(/^["']|["']$/g, '')
          .trim();

        // Ustaw wartość pola
        setState((prev) => ({ ...prev, [fieldName]: cleanValue }));
      }
    } catch (err) {
      Sentry.captureException(err);
    }

    setGeneratingField(null);
  };

  const getWealthInfo = () =>
    libGetWealthInfo(
      state.creditRating,
      {
        era: adventureContext?.yearRange || adventureContext?.era,
        country: adventureContext?.country,
        location: adventureContext?.location,
      },
      locale as 'pl' | 'en'
    );

  const CORE_STATS = [
    'str',
    'con',
    'siz',
    'dex',
    'app',
    'int',
    'pow',
    'edu',
  ] as const;

  const isStepValid = () => {
    if (state.step === 1) {
      return !!selectedArchetypeId;
    }
    if (state.step === 2) {
      if (statMethod === 'pointbuy') {
        const statSum = CORE_STATS.reduce(
          (sum, key) => sum + (state.stats[key] || 0),
          0
        );
        return statSum <= 460;
      }
      return STAT_KEYS.every((k) => statRolls[k].rolled);
    }
    if (state.step === 3) {
      return !!state.occupationId;
    }
    if (state.step === 4) {
      const selectedOcc = OCCUPATIONS.find((o) => o.id === state.occupationId);
      const archetypeSkills = getArchetypeSkills(
        selectedArchetypeId,
        state.rulesetVariant
      );
      const occupationalSkills = selectedOcc?.skills || [];
      const recommended = buildRecommendedSkills(
        archetypeSkills,
        occupationalSkills
      );
      const usage = calculateSkillPointsUsage({
        skills: state.skills,
        recommendedSkills: recommended,
        creditRating: state.creditRating,
        occupationPoints: state.occupationPoints,
        interestPoints: state.interestPoints,
        getBaseValue: (s: string) => {
          if (s === NATIVE_LANGUAGE_SKILL) return state.stats.edu;
          if (s === 'Unik') return Math.floor(state.stats.dex / 2);
          return BASE_SKILLS[s] || 1;
        },
      });
      return (
        !usage.isOccupationOverLimit &&
        !usage.isInterestOverLimit &&
        !usage.isTotalOverLimit
      );
    }
    return true;
  };

  const nextStep = () => {
    if (!isStepValid()) return;
    // Kolejność: 1=Koncepcja, 2=Cechy, 3=Zawód, 4=Umiejętności, 5=Historia, 6=Wyposażenie
    if (state.step === 2) {
      // Po Cechach: przelicz cechy pochodne przed przejściem do Zawodu
      const derived = calculateDerived(state.stats, state.age);
      setState((prev) => ({ ...prev, derived, step: 3 }));
    } else if (state.step === 3) {
      // WALIDACJA: Nie pozwól przejść bez wyboru zawodu
      if (!state.occupationId) {
        toast({
          variant: 'destructive',
          title: t('toasts.chooseOccupationTitle'),
          description: t('toasts.chooseOccupationDescription'),
        });
        return;
      }
      // Po Zawodzie: przelicz punkty zawodowe (na wypadek zmiany cech) i punkty zainteresowań
      const occupationPoints = libCalculateOccupationPoints(
        state.occupationId,
        state.stats
      );
      const interestPoints = state.stats.int * 2;
      const defaultPortrait = getRetroPortraitForOccupation(state.occupationId).svgPath;
      setState((prev) => ({
        ...prev,
        occupationPoints,
        interestPoints,
        portraitUrl: (!prev.portraitUrl || isRetroPortraitUrl(prev.portraitUrl)) ? defaultPortrait : prev.portraitUrl,
        step: 4,
      }));
    } else if (state.step === 4) {
      const defaultPortrait = getRetroPortraitForOccupation(state.occupationId).svgPath;
      setState((prev) => ({
        ...prev,
        portraitUrl: prev.portraitUrl || defaultPortrait,
        step: 5,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        step: Math.min(prev.step + 1, TOTAL_STEPS),
      }));
    }
  };

  const prevStep = () => {
    setState((prev) => ({ ...prev, step: Math.max(prev.step - 1, 1) }));
  };

  const finishCreation = () => {
    // Zabezpieczenie przed podwójnym kliknięciem
    if (isCreating) {
      return;
    }
    setIsCreating(true);

    const occupation = OCCUPATIONS.find((o) => o.id === state.occupationId);

    // Konwersja equipment string na EquipmentItem[]
    const equipmentItems: EquipmentItem[] = [];
    if (state.equipment?.trim()) {
      // IND-233: split top-level (przecinki w nawiasach nie tną nazwy).
      const itemNames = splitTopLevel(state.equipment).map((s) =>
        s.replace(/\s+/g, ' ').trim()
      );

      itemNames.forEach((itemName) => {
        const template = findEquipmentByName(itemName);
        if (template) {
          equipmentItems.push(
            createEquipmentItem(
              template,
              'starting',
              resolveEraVisualProfile(adventureContext?.yearRange || '1920s')
            )
          );
        } else {
          // Stwórz podstawowy przedmiot jeśli nie ma w bazie
          const category: EquipmentCategory = categorizeItem(
            itemName
          ) as EquipmentCategory;
          equipmentItems.push({
            id: `eq_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            name: itemName,
            category: [
              'weapon',
              'armor',
              'tool',
              'document',
              'artifact',
              'personal',
              'medical',
              'occult',
            ].includes(category)
              ? category
              : 'personal',
            description: generateItemLore(itemName),
            // Faza 4 (ekonomia RAW): waga NIE jest dopisywana (CoC 7e nie ma udźwigu).
            // value uzupełni withEquipmentDefaults przy zapisie (cena referencyjna).
            condition: 'used',
            source: 'starting',
            obtainedAt: new Date(),
          });
        }
      });
    }

    // Znajdź wybrany archetyp
    const selectedArchetype = activeArchetypes.find(
      (a) => a.id === selectedArchetypeId
    );

    const wealth = getWealthInfo();

    const newCharacter: Character = {
      id: `char_${Date.now()}`,
      name: state.name || t('defaultCharacterName'),
      cash: wealth.cashAmount,
      spendingLevel: wealth.spendingAmount,
      currency: wealth.currency,
      era: wealth.era,
      assets:
        wealth.key === 'pauper' || wealth.assetsAmount === 0
          ? undefined
          : wealth.assets,
      str: state.stats.str,
      con: state.stats.con,
      siz: state.stats.siz,
      dex: state.stats.dex,
      app: state.stats.app,
      int: state.stats.int,
      pow: state.stats.pow,
      edu: state.stats.edu,
      luck: state.stats.luck,
      hp: state.derived.hp,
      san: state.derived.san,
      mp: state.derived.mp,
      maxHp: state.derived.hp,
      maxSan: Math.min(99 - (state.skills['Mity Cthulhu'] ?? 0), 99),
      maxMp: state.derived.mp,
      move: state.derived.movement,
      damageBonus: state.derived.damageBonus,
      build: state.derived.build,
      dayStartSan: state.derived.san,
      dailySanLoss: 0,
      insanityState: 'none',
      underlyingInsanity: false,
      activeBoutOfMadness: null,
      skills: state.skills,
      occupation: getLocalizedOccupationName(occupation, locale) || t('unknown'),
      age: state.age,
      portraitUrl: state.portraitUrl || getRetroPortraitForOccupation(state.occupationId).svgPath,
      // === NOWE: Dedykowane pola biografii ===
      gender:
        state.gender === 'male'
          ? 'male'
          : state.gender === 'female'
            ? 'female'
            : undefined,
      birthplace: state.birthplace || undefined,
      description: state.description || undefined,
      ideology: state.ideology || undefined,
      significantPerson: state.importantPeople || undefined,
      meaningfulLocation: state.significantPlaces || undefined,
      treasuredPossession: state.personalItems || undefined,
      traits: Array.isArray(state.traits)
        ? state.traits
        : state.traits
          ? state.traits
              .split(/[,;]+/)
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      backstory: state.backstory || state.keyConnection || undefined,
      characterConcept: selectedArchetype
        ? `${selectedArchetype.name}: ${selectedArchetype.description}`
        : undefined,
      // Background jako fallback pełny tekst
      background: [
        state.description || '',
        t('bgIdeology', { value: state.ideology || t('noneFallback') }),
        t('bgImportantPeople', {
          value: state.importantPeople || t('noneFallback'),
        }),
        t('bgSignificantPlaces', {
          value: state.significantPlaces || t('noneFallback'),
        }),
        t('bgTraits', { value: state.traits || t('noneFallback') }),
        t('bgKeyConnection', {
          value: state.keyConnection || t('noneFallback'),
        }),
      ].join('\n\n'),
      playerName: '',
      isActive: true,
      lastUsed: new Date(),
      notes: '',
      experience: {
        totalXP: 0,
        availableXP: 0,
        earnedThisSession: 0,
        maxEarnedThisSession: 6,
      },
      developmentHistory: [],
      // IND-233: withEquipmentDefaults gwarantuje weight/value > 0 (modal nie pokazuje "-").
      equipment:
        equipmentItems.length > 0
          ? withEquipmentDefaults(equipmentItems)
          : undefined,
      rulesetVariant: state.rulesetVariant,
      archetype: state.archetype,
      pulpTalents: state.pulpTalents,
    };

    // Re-roll: scal NOWE statystyki z istniejącą postacią. Zachowuje id, dziennik,
    // doświadczenie, historię i ekwipunek; nadpisuje tylko mechanikę (cechy/umiejętności).
    const finalCharacter: Character = initialCharacter
      ? {
          ...initialCharacter,
          rulesetVariant: state.rulesetVariant ?? initialCharacter.rulesetVariant,
          archetype: state.archetype ?? initialCharacter.archetype,
          pulpTalents: state.pulpTalents ?? initialCharacter.pulpTalents,
          str: state.stats.str,
          con: state.stats.con,
          siz: state.stats.siz,
          dex: state.stats.dex,
          app: state.stats.app,
          int: state.stats.int,
          pow: state.stats.pow,
          edu: state.stats.edu,
          luck: state.stats.luck,
          hp: state.derived.hp,
          san: state.derived.san,
          mp: state.derived.mp,
          maxHp: state.derived.hp,
          maxSan: Math.min(99 - (state.skills['Mity Cthulhu'] ?? 0), 99),
          maxMp: state.derived.mp,
          move: state.derived.movement,
          damageBonus: state.derived.damageBonus,
          build: state.derived.build,
          dayStartSan: initialCharacter.dayStartSan ?? state.derived.san,
          dailySanLoss: initialCharacter.dailySanLoss ?? 0,
          insanityState: initialCharacter.insanityState ?? 'none',
          underlyingInsanity: initialCharacter.underlyingInsanity ?? false,
          activeBoutOfMadness: initialCharacter.activeBoutOfMadness ?? null,
          skills: state.skills,
          occupation: occupation?.name || initialCharacter.occupation,
          cash: initialCharacter.cash ?? wealth.cashAmount,
          spendingLevel: initialCharacter.spendingLevel ?? wealth.spendingAmount,
          currency: initialCharacter.currency ?? wealth.currency,
          era: initialCharacter.era ?? wealth.era,
          luckSpentThisSession: 0,
          lastUsed: new Date(),
        }
      : newCharacter;
    onCharacterCreated(finalCharacter);
  };

  // ============================================================================
  // RENDEROWANIE KROKÓW
  // ============================================================================

  // Nagłówek kroku w stylu déco: zwięzły tytuł + opis
  // + opcjonalna akcja po prawej stronie.
  const StepHeading = ({
    title,
    subtitle,
    action,
  }: {
    title: string;
    subtitle?: string;
    action?: ReactNode;
  }) => (
    <div className="flex items-start justify-between gap-4 mb-3 flex-shrink-0">
      <div>
        <div className="font-display font-semibold uppercase tracking-[0.08em] text-lg text-brass">
          {title}
        </div>
        {subtitle && (
          <div className="font-serif italic text-sm text-muted-foreground mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
      {action && <div className="flex gap-2 flex-shrink-0">{action}</div>}
    </div>
  );

  // NOWY KROK: Koncepcja postaci - wybór archetypu
  const renderStepConcept = () => {
    const selectedArchetype = activeArchetypes.find(
      (a) => a.id === selectedArchetypeId
    );
    const archetypeDetails = (t.raw('archetypeDetails') || {}) as Record<string, {
      suggestedOccupations: string[];
      suggestedTraits: string[];
      suggestedMotivations: string[];
    }>;
    const selectedDetails = selectedArchetype && archetypeDetails[selectedArchetype.id]
      ? archetypeDetails[selectedArchetype.id]
      : undefined;

    return (
      <div className="space-y-6">
        <StepHeading
          title={t('stepConceptTitle')}
          subtitle={t('stepConceptSubtitle')}
        />
        {adventureContext && (
          <p className="font-special-elite text-sm uppercase tracking-[0.1em] text-brass -mt-2">
            {t('adventureLabel', {
              title: adventureContext.title || '',
              location: adventureContext.location || '',
            })}
          </p>
        )}

        {adventureContext?.investigatorRequirements && (
          <div className="border border-amber-500/40 bg-amber-950/25 p-3.5 rounded-sm flex items-start gap-3">
            <Users className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-sm">
              <span className="font-display uppercase tracking-wider font-semibold text-amber-200">
                Wymogi scenariusza dotyczące Badaczy
              </span>
              <p className="text-amber-100/90 font-serif leading-relaxed">
                {adventureContext.investigatorRequirements.summary}
              </p>
              {adventureContext.investigatorRequirements.minAge !== undefined && (
                <p className="font-mono text-amber-300/90 font-medium">
                  Dozwolony wiek: {adventureContext.investigatorRequirements.minAge} - {adventureContext.investigatorRequirements.maxAge || 90} lat.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Odziedziczona konwencja z opcją zmiany */}
        <div className="flex flex-col gap-2 border border-brass/30 bg-[#120f0c] px-4 py-3 rounded-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-special-elite text-sm uppercase tracking-[0.14em] text-brass/90 font-semibold">
                {t('rulesetConventionLabel')}
              </span>
              <span className="inline-flex items-center gap-1.5 font-display text-sm uppercase font-semibold tracking-wider text-brass">
                {state.rulesetVariant === 'pulp' ? (
                  <>
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    {t('rulesetPulp')}
                  </>
                ) : (
                  <>
                    <Skull className="h-3.5 w-3.5 text-brass" />
                    {t('rulesetClassic')}
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedArchetypeId(null);
                  setState((prev) => ({
                    ...prev,
                    archetype: '',
                    rulesetVariant: 'classic',
                    derived: calculateDerived(prev.stats, prev.age, 'classic'),
                  }));
                }}
                className={`px-3 py-1.5 text-xs sm:text-sm font-display uppercase tracking-wider transition-colors border cursor-pointer ${
                  state.rulesetVariant === 'classic'
                    ? 'border-brass bg-brass/20 text-brass font-bold'
                    : 'border-brass/25 text-muted-foreground hover:text-brass hover:bg-brass/5'
                }`}
              >
                <span className="flex items-center gap-1">
                  <Skull className="h-3.5 w-3.5" />
                  {t('rulesetClassicShort')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedArchetypeId(null);
                  setState((prev) => ({
                    ...prev,
                    archetype: '',
                    rulesetVariant: 'pulp',
                    derived: calculateDerived(prev.stats, prev.age, 'pulp'),
                  }));
                }}
                className={`px-3 py-1.5 text-xs sm:text-sm font-display uppercase tracking-wider transition-colors border cursor-pointer ${
                  state.rulesetVariant === 'pulp'
                    ? 'border-primary bg-primary/20 text-primary font-bold shadow-[0_0_8px_rgba(13,148,136,0.3)]'
                    : 'border-brass/25 text-muted-foreground hover:text-primary hover:bg-primary/5'
                }`}
              >
                <span className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  {t('rulesetPulpShort')}
                </span>
              </button>
            </div>
          </div>
          <p className="font-serif italic text-sm text-foreground/80 border-t border-brass/15 pt-2">
            {state.rulesetVariant === 'pulp'
              ? t('rulesetPulpExplanation')
              : t('rulesetClassicExplanation')}
          </p>
        </div>

        {/* Siatka archetypów */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {activeArchetypes.map((archetype) => {
            const isSelected = selectedArchetypeId === archetype.id;
            return (
              <button
                key={archetype.id}
                type="button"
                onClick={() => {
                  setSelectedArchetypeId(archetype.id);
                  setState((prev) => ({
                    ...prev,
                    archetype: archetype.name,
                  }));
                }}
                className={`p-4 border text-left transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'border-brass/50 bg-[#0e1413] shadow-[0_0_14px_rgba(13,148,136,.18)]'
                    : 'border-brass/28 bg-[#16130f] hover:border-brass/50'
                }`}
              >
                <div className="text-2xl mb-2">{archetype.icon}</div>
                <h4 className="font-display uppercase tracking-[0.08em] text-base text-foreground">
                  {archetype.name}
                </h4>
                <p className="font-serif italic text-sm text-muted-foreground line-clamp-2 mt-1">
                  {archetype.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Szczegóły wybranego archetypu */}
        {selectedArchetype && selectedArchetype.id !== 'custom' && (
          <div className="border border-brass/30 bg-[#0e1413] p-4">
            <h4 className="font-display uppercase tracking-[0.1em] text-base text-brass font-semibold mb-2 flex items-center gap-2">
              {selectedArchetype.icon} {selectedArchetype.name}
            </h4>
            <p className="font-serif italic text-sm text-foreground/85 mb-3">
              {selectedArchetype.description}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="font-special-elite text-xs sm:text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold block mb-0.5">
                  {t('suggestedOccupations')}
                </span>
                <div className="text-foreground font-medium">
                  {((selectedDetails?.suggestedOccupations || selectedArchetype?.suggestedOccupations) || [])
                    .slice(0, 3)
                    .join(', ')}
                </div>
              </div>
              <div>
                <span className="font-special-elite text-xs sm:text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold block mb-0.5">
                  {t('traits')}
                </span>
                <div className="text-foreground font-medium">
                  {((selectedDetails?.suggestedTraits || selectedArchetype?.suggestedTraits) || []).join(', ')}
                </div>
              </div>
              <div>
                <span className="font-special-elite text-xs sm:text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold block mb-0.5">
                  {selectedArchetype?.suggestedMotivations?.length
                    ? t('motivations')
                    : state.rulesetVariant === 'pulp'
                      ? (locale === 'en' ? 'Core characteristics:' : 'Cechy kluczowe:')
                      : t('motivations')}
                </span>
                <div className="text-foreground">
                  {(selectedArchetype?.suggestedMotivations?.length ?? 0) > 0
                    ? (selectedDetails?.suggestedMotivations || selectedArchetype?.suggestedMotivations || [])
                        .slice(0, 2)
                        .join(', ')
                    : (selectedArchetype?.coreCharacteristics?.length ?? 0) > 0
                      ? (selectedArchetype?.coreCharacteristics || []).map((c: string) => c.toUpperCase()).join(', ')
                      : '—'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info gdy nie wybrano archetypu */}
        {!selectedArchetypeId && (
          <div className="font-serif italic text-center text-muted-foreground text-sm p-4 border border-brass/20 bg-[#16130f]">
            {t('selectArchetypeHint')}
          </div>
        )}
      </div>
    );
  };

  const renderStep1 = () => {
    const minReqAge = adventureContext?.investigatorRequirements?.minAge ?? 15;
    const maxReqAge = adventureContext?.investigatorRequirements?.maxAge ?? 90;
    const ageModifier =
      AGE_MODIFIERS.find((m) => state.age >= m.min && state.age <= m.max) ||
      (state.age < 15 ? AGE_MODIFIERS[0] : AGE_MODIFIERS[1]);

    // CoC 7e: metoda "Rozdziel punkty" ma budżet sumy = 460 punktów na 8 cech
    // (zestaw 40/50/50/50/60/60/70/80). Szczęście jest losowane osobno (3K6×5)
    // i NIE wlicza się do budżetu. Budżet egzekwujemy WYŁĄCZNIE w trybie
    // 'pointbuy'. W trybie 'roll' suma rzutów może być dowolna (RAW).
    const STAT_POINT_BUDGET = 460;
    const CORE_STATS = [
      'str',
      'con',
      'siz',
      'dex',
      'app',
      'int',
      'pow',
      'edu',
    ] as const;
    const statSum = CORE_STATS.reduce(
      (sum, key) => sum + (state.stats[key] || 0),
      0
    );
    const statBudgetLeft = STAT_POINT_BUDGET - statSum;

    const allRolled = STAT_KEYS.every((k) => statRolls[k].rolled);

    return (
      <div className="space-y-6">
        <StepHeading
          title={t('stepStatsTitle')}
          subtitle={t('stepStatsSubtitle')}
        />

        {/* Onboarding: czym są cechy (własny opis, bez cytatów z podręcznika) */}
        <div className="border border-brass/20 bg-[#16130f] px-4 py-3">
          <p className="font-serif italic text-sm leading-relaxed text-muted-foreground">
            {t('statsIntro')}
          </p>
        </div>

        {/* Dwie karty metody przydziału charakterystyk */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Karta: rzut kośćmi (div - zawiera zagnieżdżony przycisk akcji) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setStatMethod('roll')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setStatMethod('roll');
            }}
            className={`p-4 border text-left cursor-pointer transition-all duration-200 ${
              statMethod === 'roll'
                ? 'border-brass/30 bg-primary/15 shadow-[0_0_14px_rgba(13,148,136,.18)]'
                : 'border-brass/28 bg-[#16130f] hover:border-brass/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🎲</span>
              <h4 className="font-display uppercase tracking-[0.08em] text-base text-foreground">
                {t('rollDice')}
              </h4>
              <span className="font-special-elite text-[14px] uppercase tracking-[0.12em] text-brass/80 border border-brass/30 px-1.5 py-0.5">
                ✦ {t('recommended')}
              </span>
            </div>
            <p className="font-serif italic text-sm text-muted-foreground">
              {t('rollDiceDescription')}
            </p>
            {statMethod === 'roll' && (
              <div className="mt-3 flex items-center gap-3">
                <Button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    generateStats();
                  }}
                  disabled={allRolled}
                  size="sm"
                  className="font-display font-semibold uppercase tracking-[0.14em] text-[#04110f] bg-primary border border-brass/30 hover:brightness-110 shadow-[0_0_16px_rgba(13,148,136,.3)] px-4 py-2.5 disabled:opacity-50"
                >
                  {t('rollAll')}
                </Button>
                {allRolled && (
                  <span className="font-serif italic text-sm text-muted-foreground">
                    {t('allStatsRolled')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Karta: rozdział punktów */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setStatMethod('pointbuy')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setStatMethod('pointbuy');
            }}
            className={`p-4 border text-left cursor-pointer transition-all duration-200 ${
              statMethod === 'pointbuy'
                ? 'border-brass/30 bg-primary/15 shadow-[0_0_14px_rgba(13,148,136,.18)]'
                : 'border-brass/28 bg-[#16130f] hover:border-brass/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🔢</span>
              <h4 className="font-display uppercase tracking-[0.08em] text-base text-foreground">
                {t('allocatePoints')}
              </h4>
            </div>
            <p className="font-serif italic text-sm text-muted-foreground">
              {t('allocatePointsDescription')}
            </p>
            {statMethod === 'pointbuy' && (
              <div className="mt-3 flex items-center gap-3">
                <span className="font-special-elite text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold">
                  {t('pointPool')}
                </span>
                <span
                  className={`font-display text-lg font-bold ${
                    statBudgetLeft < 0 ? 'text-destructive' : 'text-brass/80'
                  }`}
                >
                  {statSum} / {STAT_POINT_BUDGET}
                </span>
                {statBudgetLeft < 0 && (
                  <span className="text-destructive text-sm">
                    {t('overBudget', { count: -statBudgetLeft })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="font-serif italic text-sm text-muted-foreground text-center max-w-md mx-auto">
          {t.rich('halfFifthHint', {
            half: (chunks) => (
              <span className="text-foreground">{chunks}</span>
            ),
            fifth: (chunks) => (
              <span className="text-foreground">{chunks}</span>
            ),
          })}
        </div>

        {visibleDiceTrace && statMethod === 'roll' && (
          <div className="mx-auto w-full max-w-md" aria-live="polite">
            <PhysicalDiceScene
              dice={visibleDiceTrace.dice}
              rolling={isDiceAnimating}
              label={visibleDiceTrace.source}
            />
          </div>
        )}

        {/* Główne cechy */}
        {/*
          Highlight zielonych rekomendacji POMINIĘTY na kroku Cechy: brak danych
          mapujących archetyp -> sugerowaną cechę w kodzie (suggestedTraits to
          cechy osobowości, nie statystyki CoC). Nie wymyślamy mapowania.
        */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {STAT_KEYS.map((stat) => {
            const value = state.stats[stat];
            const rollState = statRolls[stat];
            return (
              <div
                key={stat}
                className="border border-brass/28 bg-[#16130f] p-4 text-center"
              >
                <label className="flex items-center justify-center font-display text-base uppercase tracking-[0.08em] text-foreground mb-1">
                  {STAT_FULL_NAMES[stat] || stat.toUpperCase()}
                  <HelpIcon
                    content={
                      t.has(`statTooltips.${stat}`)
                        ? t(`statTooltips.${stat}`)
                        : STAT_DESCRIPTIONS[stat]
                    }
                    position="top"
                  />
                </label>

                {statMethod === 'roll' ? (
                  <>
                    {/* Wartość: '-' dopóki nie rzucono */}
                    <div className="font-display text-[34px] leading-tight font-bold text-foreground py-1">
                      {rollState.rolled ? value : '-'}
                    </div>
                    {/* Wzór rzutu (mono detal - zostaje drobny) */}
                    <div className="font-special-elite text-[14px] tracking-[0.06em] text-brass mb-2">
                      {STAT_DICE[stat].label}
                    </div>
                    {!rollState.rolled ? (
                      <Button
                        type="button"
                        onClick={() => rollSingleStat(stat)}
                        disabled={isDiceAnimating}
                        size="sm"
                        className="w-full font-display font-semibold uppercase tracking-[0.1em] text-[#04110f] bg-primary border border-brass/30 hover:brightness-110 text-xs px-2 py-1.5"
                      >
                        {t('rollOne')}
                      </Button>
                    ) : !rollState.rerollUsed ? (
                      <Button
                        type="button"
                        onClick={() => rerollSingleStat(stat)}
                        disabled={isDiceAnimating}
                        size="sm"
                        variant="outline"
                        className="w-full font-display uppercase tracking-[0.1em] border-brass/50 text-foreground hover:border-brass text-xs px-2 py-1.5"
                      >
                        {t('rerollOnce')}
                      </Button>
                    ) : (
                      <div className="font-serif italic text-[14px] text-muted-foreground py-1.5">
                        {t('rerollUsed')}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => {
                        let nextVal = parseInt(e.target.value) || 0;
                        // Szczęście jest poza budżetem (losowane osobno). Dla 8
                        // cech głównych: zakres 15-90 i suma nie może przekroczyć
                        // 460.
                        if (stat !== 'luck') {
                          nextVal = Math.max(15, Math.min(90, nextVal));
                          const sumOthers = statSum - (state.stats[stat] || 0);
                          const maxForThis = STAT_POINT_BUDGET - sumOthers;
                          nextVal = Math.max(15, Math.min(nextVal, maxForThis));
                        }
                        const newStats = {
                          ...state.stats,
                          [stat]: nextVal,
                        };
                        const derived = calculateDerived(newStats, state.age);
                        // Aktualizuj dynamiczne umiejętności (Język Ojczysty =
                        // WYK, Unik = ZR/2)
                        const updatedSkills = { ...state.skills };
                        if (stat === 'edu')
                          updatedSkills[NATIVE_LANGUAGE_SKILL] = newStats.edu;
                        if (stat === 'dex')
                          updatedSkills['Unik'] = Math.floor(newStats.dex / 2);
                        setState((prev) => ({
                          ...prev,
                          stats: newStats,
                          derived,
                          skills: updatedSkills,
                        }));
                      }}
                      className="w-full bg-transparent border-none px-2 py-1 text-center font-display text-[34px] leading-tight font-bold text-foreground focus:outline-none"
                      min={15}
                      max={stat === 'luck' ? 99 : 90}
                    />
                  </>
                )}

                {(statMethod === 'pointbuy' || rollState.rolled) && (
                  <div className="font-special-elite text-sm tracking-[0.08em] font-semibold text-brass mt-1">
                    ½:{half(value)} ⅕:{fifth(value)}
                  </div>
                )}

                {/* Onboarding: krótki opis cechy własnymi słowami (P2) */}
                <p className="font-serif text-sm leading-snug text-foreground/80 mt-2">
                  {statShortDesc[stat]}
                </p>
              </div>
            );
          })}
        </div>

        {/* Onboarding: niskie cechy to nie wada (własny opis) */}
        <div className="flex items-start gap-3 border border-brass/30 bg-primary/5 px-4 py-3">
          <span aria-hidden="true" className="text-lg leading-none mt-0.5">
            🕯️
          </span>
          <p className="font-serif text-sm leading-relaxed text-muted-foreground">
            <span className="text-foreground">{t('lowStatHintTitle')}</span>{' '}
            {t('lowStatHintBody')}
          </p>
        </div>

        {/* Wiek */}
        <div className="border border-brass/28 bg-[#16130f] p-4">
          <label className="block font-special-elite text-xs uppercase tracking-[0.1em] text-foreground mb-2">
            {t('ageLabel', { age: state.age })}
          </label>
          <input
            type="range"
            min={minReqAge}
            max={maxReqAge}
            value={state.age}
            onChange={(e) => {
              const age = parseInt(e.target.value);
              const derived = calculateDerived(state.stats, age);
              const newBracket =
                AGE_MODIFIERS.find((m) => age >= m.min && age <= m.max) ||
                (age < 15 ? AGE_MODIFIERS[0] : AGE_MODIFIERS[1]);
              if (newBracket && newBracket.key !== currentAgeBracketKey) {
                setCurrentAgeBracketKey(newBracket.key);
                setPerformedEduChecks(0);
                setAppliedAgePenaltiesKey(null);
                setTeenLuckRerolled(false);
              }
              setState((prev) => ({ ...prev, age, derived }));
            }}
            className="w-full"
          />
          {adventureContext?.investigatorRequirements?.minAge !== undefined && (
            <p className="mt-1.5 font-mono text-[11px] text-amber-400/90">
              Wymóg scenariusza: wiek Badacza ograniczony do {minReqAge}-{maxReqAge} lat.
            </p>
          )}
          {ageModifier && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-brass/80 font-medium">
                  {t.has(`ageBrackets.${ageModifier.key}`)
                    ? t(`ageBrackets.${ageModifier.key}`)
                    : ageModifier.label}
                </span>
                {ageModifier.physPenalty > 0 && (
                  <span className="text-destructive text-sm">
                    {t('physPenalty', { count: ageModifier.physPenalty })}
                  </span>
                )}
                {ageModifier.appPenalty > 0 && (
                  <span className="text-destructive text-sm">
                    {t('appPenalty', { count: ageModifier.appPenalty })}
                  </span>
                )}
                {ageModifier.eduChecks > 0 && (
                  <span className="text-brass/80 text-sm">
                    {t('eduChecksBonus', { count: ageModifier.eduChecks })}
                  </span>
                )}
                {ageModifier.luckReroll && (
                  <span className="text-muted-foreground text-sm">
                    {t('luckReroll')}
                  </span>
                )}
              </div>

              {/* Modyfikatory nastolatka (15-19 lat wg CoC 7e RAW) */}
              {ageModifier.key === 'age_15_19' && (
                <div className="border border-destructive/50 bg-[#16130f] p-3 mt-2 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-sm">
                      <span className="text-destructive font-medium">
                        {t('teenPenaltiesWarning')}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        {appliedAgePenaltiesKey === ageModifier.key
                          ? t('agePenaltiesApplied')
                          : t('teenPenaltiesPending')}
                      </span>
                    </div>
                    <Button
                      onClick={() => {
                        const teenResult = applyTeenPenalty({
                          str: state.stats.str,
                          siz: state.stats.siz,
                          edu: state.stats.edu,
                        });
                        const newStats = {
                          ...state.stats,
                          str: teenResult.str,
                          siz: teenResult.siz,
                          edu: teenResult.edu,
                        };
                        const derived = calculateDerived(newStats, state.age);
                        const updatedSkills = {
                          ...state.skills,
                          [NATIVE_LANGUAGE_SKILL]: newStats.edu,
                        };
                        setState((prev) => ({
                          ...prev,
                          stats: newStats,
                          derived,
                          skills: updatedSkills,
                        }));
                        setAppliedAgePenaltiesKey(ageModifier.key);
                      }}
                      disabled={appliedAgePenaltiesKey === ageModifier.key}
                      size="sm"
                      className={`font-display font-semibold uppercase tracking-[0.1em] ${
                        appliedAgePenaltiesKey === ageModifier.key
                          ? 'bg-primary/20 text-primary border border-primary/40'
                          : 'bg-destructive hover:brightness-110 text-white'
                      }`}
                    >
                      {appliedAgePenaltiesKey === ageModifier.key
                        ? t('agePenaltiesAppliedBtn')
                        : t('applyTeenPenalties')}
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('teenPenaltiesPreview')}
                  </div>
                  <div className="flex items-center justify-between border-t border-brass/20 pt-2 flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground">
                      {teenLuckRerolled
                        ? t('teenLuckRerollUsed')
                        : t('luckReroll')}
                    </span>
                    <Button
                      onClick={() => {
                        const roll =
                          (Math.floor(Math.random() * 6) +
                            1 +
                            Math.floor(Math.random() * 6) +
                            1 +
                            Math.floor(Math.random() * 6) +
                            1) *
                          5;
                        const oldLuck = state.stats.luck;
                        const newLuck = Math.max(oldLuck, roll);
                        if (newLuck > oldLuck) {
                          setState((prev) => ({
                            ...prev,
                            stats: { ...prev.stats, luck: newLuck },
                          }));
                          toast({
                            variant: 'success',
                            title: t('luckReroll'),
                            description: t('teenLuckSuccess', {
                              oldLuck,
                              newLuck,
                            }),
                          });
                        } else {
                          toast({
                            title: t('luckReroll'),
                            description: t('teenLuckNoChange', {
                              roll,
                              oldLuck,
                            }),
                          });
                        }
                        setTeenLuckRerolled(true);
                      }}
                      disabled={teenLuckRerolled}
                      size="sm"
                      variant="outline"
                      className="font-display font-semibold uppercase tracking-[0.1em] text-brass border-brass/40 hover:bg-brass/10"
                    >
                      {teenLuckRerolled
                        ? t('teenLuckRerollUsed')
                        : t('teenLuckReroll')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Przycisk aplikowania modyfikatorów wieku (40+ lat) */}
              {(ageModifier.physPenalty > 0 || ageModifier.appPenalty > 0) && (
                <div className="border border-destructive/50 bg-[#16130f] p-3 mt-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-sm">
                      <span className="text-destructive font-medium">
                        {t('ageModifiersWarning')}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        {appliedAgePenaltiesKey === ageModifier.key
                          ? t('agePenaltiesApplied')
                          : t('agePenaltiesPending')}
                      </span>
                    </div>
                    <Button
                      onClick={() => {
                        // Aplikuj kary wieku do cech zgodnie z CoC 7e RAW:
                        // Łączna kara fizyczna rozdzielana na STR, CON, DEX
                        const penalty = ageModifier.physPenalty;
                        const appPenalty = ageModifier.appPenalty;
                        const distributed = distributePhysPenalty(
                          {
                            str: state.stats.str,
                            con: state.stats.con,
                            dex: state.stats.dex,
                          },
                          penalty
                        );
                        const newStats = {
                          ...state.stats,
                          str: distributed.str,
                          con: distributed.con,
                          dex: distributed.dex,
                          app: Math.max(15, state.stats.app - appPenalty),
                        };
                        const derived = calculateDerived(newStats, state.age);
                        // Aktualizuj Unik bo ZR mogło się zmienić
                        const updatedSkills = {
                          ...state.skills,
                          Unik: Math.floor(newStats.dex / 2),
                        };
                        setState((prev) => ({
                          ...prev,
                          stats: newStats,
                          derived,
                          skills: updatedSkills,
                        }));
                        setAppliedAgePenaltiesKey(ageModifier.key);
                      }}
                      disabled={appliedAgePenaltiesKey === ageModifier.key}
                      size="sm"
                      className={`font-display font-semibold uppercase tracking-[0.1em] ${
                        appliedAgePenaltiesKey === ageModifier.key
                          ? 'bg-primary/20 text-primary border border-primary/40'
                          : 'bg-destructive hover:brightness-110 text-white'
                      }`}
                    >
                      {appliedAgePenaltiesKey === ageModifier.key
                        ? t('agePenaltiesAppliedBtn')
                        : t('applyAgePenalties')}
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {t('agePenaltiesPreview', {
                      str: ageModifier.physPenalty,
                      con: ageModifier.physPenalty,
                      dex: ageModifier.physPenalty,
                      app: ageModifier.appPenalty,
                    })}
                  </div>
                </div>
              )}

              {/* Testy rozwoju WYK dla starszych postaci */}
              {ageModifier.eduChecks > 0 && (
                <div className="border border-brass/20 bg-[#0e1413] p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-sm max-w-xl">
                      <span className="text-brass/80 font-medium">
                        {t('eduDevelopmentTest')}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        {t('eduDevelopmentDescription', {
                          count: ageModifier.eduChecks,
                        })}
                      </span>
                      <span className="text-brass/90 text-xs block mt-1 font-semibold">
                        {t('eduChecksLeft', {
                          count: Math.max(
                            0,
                            ageModifier.eduChecks - performedEduChecks
                          ),
                        })}
                      </span>
                    </div>
                    <Button
                      onClick={() => {
                        if (performedEduChecks >= ageModifier.eduChecks) return;
                        setPerformedEduChecks((prev) => prev + 1);

                        // Wykonaj test rozwoju WYK: rzut K% > WYK = +1K10
                        const roll = Math.floor(Math.random() * 100) + 1;
                        if (roll > state.stats.edu) {
                          const bonus = Math.floor(Math.random() * 10) + 1;
                          const newEdu = Math.min(99, state.stats.edu + bonus);
                          const newStats = { ...state.stats, edu: newEdu };
                          const updatedSkills = {
                            ...state.skills,
                            [NATIVE_LANGUAGE_SKILL]: newEdu,
                          };
                          setState((prev) => ({
                            ...prev,
                            stats: newStats,
                            skills: updatedSkills,
                          }));
                          toast({
                            variant: 'success',
                            title: t('eduSuccess'),
                            description: t('eduRollSuccess', {
                              roll,
                              edu: state.stats.edu,
                              bonus,
                              newEdu,
                            }),
                          });
                        } else {
                          toast({
                            title: t('statShort.failure'),
                            description: t('eduRollFailure', {
                              roll,
                              edu: state.stats.edu,
                            }),
                          });
                        }
                      }}
                      disabled={performedEduChecks >= ageModifier.eduChecks}
                      size="sm"
                      className="font-display font-semibold uppercase tracking-[0.1em] text-[#04110f] bg-primary border border-brass/30 hover:brightness-110 shadow-[0_0_16px_rgba(13,148,136,.3)] disabled:opacity-40"
                    >
                      {performedEduChecks >= ageModifier.eduChecks
                        ? t('eduChecksExhausted')
                        : t('rollEduTest')}
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground mt-2 font-serif italic">
                    {t('eduTestHint')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cechy pochodne */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="border border-[#b3322c]/40 bg-[#16130f] p-3 text-center">
            <div className="flex items-center justify-center font-special-elite text-sm uppercase tracking-[0.12em] font-semibold text-[#d9685f]">
              ❤️ {t('hpAbbr')}{' '}
              <HelpIcon
                content={
                  t.has('derivedTooltips.hp')
                    ? t('derivedTooltips.hp')
                    : DERIVED_DESCRIPTIONS.hp
                }
                position="top"
              />
            </div>
            <div className="font-display text-2xl font-bold text-foreground">
              {state.derived.hp}
            </div>
          </div>
          <div className="border border-brass/40 bg-[#16130f] p-3 text-center">
            <div className="flex items-center justify-center font-special-elite text-sm uppercase tracking-[0.12em] font-semibold text-brass">
              🧠 {t('sanAbbr')}{' '}
              <HelpIcon
                content={
                  t.has('derivedTooltips.san')
                    ? t('derivedTooltips.san')
                    : DERIVED_DESCRIPTIONS.san
                }
                position="top"
              />
            </div>
            <div className="font-display text-2xl font-bold text-foreground">
              {state.derived.san}
            </div>
          </div>
          <div className="border border-brass/30 bg-[#0e1413] p-3 text-center shadow-[0_0_14px_rgba(13,148,136,.14)]">
            <div className="flex items-center justify-center font-special-elite text-sm uppercase tracking-[0.12em] font-semibold text-brass">
              ✨ {t('mpAbbr')}{' '}
              <HelpIcon
                content={
                  t.has('derivedTooltips.mp')
                    ? t('derivedTooltips.mp')
                    : DERIVED_DESCRIPTIONS.mp
                }
                position="top"
              />
            </div>
            <div className="font-display text-2xl font-bold text-foreground">
              {state.derived.mp}
            </div>
          </div>
          <div className="border border-brass/28 bg-[#16130f] p-3 text-center">
            <div className="flex items-center justify-center font-special-elite text-sm uppercase tracking-[0.12em] font-semibold text-brass/90">
              💪 {t('damageBonusAbbr')}{' '}
              <HelpIcon
                content={
                  t.has('derivedTooltips.damageBonus')
                    ? t('derivedTooltips.damageBonus')
                    : DERIVED_DESCRIPTIONS.damageBonus
                }
                position="top"
              />
            </div>
            <div className="font-display text-xl font-bold text-foreground">
              {state.derived.damageBonus}
            </div>
          </div>
          <div className="border border-brass/28 bg-[#16130f] p-3 text-center">
            <div className="flex items-center justify-center font-special-elite text-sm uppercase tracking-[0.12em] font-semibold text-brass/90">
              🏋️ {t('buildLabel')}{' '}
              <HelpIcon
                content={
                  t.has('derivedTooltips.build')
                    ? t('derivedTooltips.build')
                    : DERIVED_DESCRIPTIONS.build
                }
                position="top"
              />
            </div>
            <div className="font-display text-2xl font-bold text-foreground">
              {state.derived.build}
            </div>
          </div>
          <div className="border border-brass/28 bg-[#16130f] p-3 text-center">
            <div className="flex items-center justify-center font-special-elite text-sm uppercase tracking-[0.12em] font-semibold text-brass/90">
              🏃 {t('moveLabel')}{' '}
              <HelpIcon
                content={
                  t.has('derivedTooltips.movement')
                    ? t('derivedTooltips.movement')
                    : DERIVED_DESCRIPTIONS.movement
                }
                position="top"
              />
            </div>
            <div className="font-display text-2xl font-bold text-foreground">
              {state.derived.movement}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStep2 = () => {
    const selectedOcc = OCCUPATIONS.find((o) => o.id === state.occupationId);
    // Zielone rekomendacje: zawody sugerowane przez wybrany archetyp
    // (suggestedOccupations zawiera id zawodów, zgodne z occ.id).
    const selectedArchetype = activeArchetypes.find(
      (a) => a.id === selectedArchetypeId
    );
    const scenarioSuggestedOccs = [
      ...(adventureContext?.investigatorRequirements?.requiredOccupations || []),
      ...(adventureContext?.suggestedOccupations || []),
    ].map((o) => o.toLowerCase().trim());

    const scenarioMatchingOccIds = OCCUPATIONS.filter((o) =>
      scenarioSuggestedOccs.some(
        (s) =>
          o.name.toLowerCase().includes(s) ||
          (o.nameEn && o.nameEn.toLowerCase().includes(s)) ||
          o.id.toLowerCase().includes(s) ||
          s.includes(o.name.toLowerCase()) ||
          (o.nameEn && s.includes(o.nameEn.toLowerCase())) ||
          s.includes(o.id.toLowerCase())
      )
    ).map((o) => o.id);

    const archetypeSuggestedOccs = (selectedArchetype?.suggestedOccupations || []).map((s) =>
      s.toLowerCase().trim()
    );
    const archetypeMatchingOccIds = OCCUPATIONS.filter((o) =>
      archetypeSuggestedOccs.some(
        (s) =>
          o.name.toLowerCase().includes(s) ||
          (o.nameEn && o.nameEn.toLowerCase().includes(s)) ||
          o.id.toLowerCase().includes(s) ||
          s.includes(o.name.toLowerCase()) ||
          (o.nameEn && s.includes(o.nameEn.toLowerCase())) ||
          s.includes(o.id.toLowerCase())
      )
    ).map((o) => o.id);

    const recommendedOccupationIds = new Set([
      ...(selectedArchetype?.suggestedOccupations || []),
      ...archetypeMatchingOccIds,
      ...scenarioMatchingOccIds,
    ]);

    const startingEquipmentList = selectedOcc
      ? getStartingEquipmentForOccupation(selectedOcc.id)
      : [];

    const filteredOccupations = OCCUPATIONS.filter((occ) => {
      if (
        occupationFilter === 'recommended' &&
        !recommendedOccupationIds.has(occ.id)
      ) {
        return false;
      }
      if (occupationSearchQuery.trim()) {
        const q = occupationSearchQuery.toLowerCase().trim();
        const matchesName =
          occ.name.toLowerCase().includes(q) ||
          Boolean(occ.nameEn && occ.nameEn.toLowerCase().includes(q));
        const matchesSkill = occ.skills.some((s) =>
          s.toLowerCase().includes(q)
        );
        return matchesName || matchesSkill;
      }
      return true;
    });

    const recommendedCount = OCCUPATIONS.filter((o) =>
      recommendedOccupationIds.has(o.id)
    ).length;

    return (
      <div className="flex-1 min-h-0 flex flex-col space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 flex-shrink-0">
          <StepHeading
            title={t('stepOccupationTitle')}
            subtitle={t('stepOccupationSubtitle')}
          />

          {/* Filtry i wyszukiwarka */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center border border-brass/25 bg-[#120f0c] p-0.5">
              <button
                type="button"
                onClick={() => setOccupationFilter('all')}
                className={`font-special-elite text-xs uppercase tracking-[0.08em] px-3 py-1.5 transition-colors ${
                  occupationFilter === 'all'
                    ? 'bg-primary text-[#04110f] font-bold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('allFilter', { count: OCCUPATIONS.length })}
              </button>
              {recommendedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setOccupationFilter('recommended')}
                  className={`font-special-elite text-xs uppercase tracking-[0.08em] px-3 py-1.5 transition-colors ${
                    occupationFilter === 'recommended'
                      ? 'bg-primary text-[#04110f] font-bold shadow-sm'
                      : 'text-brass/90 hover:text-brass'
                  }`}
                >
                  {t('suggestedFilter', { count: recommendedCount })}
                </button>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={occupationSearchQuery}
                onChange={(e) => setOccupationSearchQuery(e.target.value)}
                placeholder={t('searchOccupationPlaceholder')}
                className="bg-[#120f0c] border border-brass/30 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-brass/80 font-special-elite w-56 tracking-[0.04em]"
              />
              {occupationSearchQuery && (
                <button
                  type="button"
                  onClick={() => setOccupationSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Układ Master-Detail: Siatka profesji (Lewa) + Akta Profesji (Prawa) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 max-lg:min-h-fit">
          {/* Lewa kolumna: przewijalna lista profesji */}
          <div className="lg:col-span-7 flex flex-col min-h-0 max-lg:h-[420px] border border-brass/25 bg-[#120f0c]/60 p-2.5">
            <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 p-1 custom-scrollbar scroll-py-2">
              {filteredOccupations.length === 0 ? (
                <div className="p-8 text-center font-serif italic text-sm text-muted-foreground">
                  {t('noOccupationsFound')}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {filteredOccupations.map((occ) => {
                    const isSelected = state.occupationId === occ.id;
                    const isRecommended =
                      !isSelected && recommendedOccupationIds.has(occ.id);
                    return (
                      <div
                        key={occ.id}
                        onClick={() => selectOccupation(occ.id)}
                        className={`p-3.5 border cursor-pointer transition-all duration-150 relative text-left flex flex-col justify-between ${
                          isSelected
                            ? 'border-brass bg-primary/20 shadow-[0_0_16px_rgba(13,148,136,.25)] ring-1 ring-brass/80'
                            : isRecommended
                              ? 'border-primary/50 bg-primary/[0.08] hover:border-primary/80 hover:bg-primary/[0.14] ring-1 ring-primary/30'
                              : 'border-brass/25 bg-[#16130f] hover:border-brass/50 hover:bg-[#1c1813]'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-display uppercase tracking-[0.08em] text-base text-foreground font-semibold">
                                {getLocalizedOccupationName(occ, locale)}
                              </span>
                              {isRecommended && (
                                <span
                                  className="text-brass text-sm"
                                  title={t('recommendedForArchetype')}
                                >
                                  ★
                                </span>
                              )}
                            </div>
                            <span className="font-special-elite text-[11px] text-brass/80 whitespace-nowrap bg-black/40 px-2 py-0.5 border border-brass/20">
                              CR: {occ.creditMin}-{occ.creditMax}
                            </span>
                          </div>
                          <div className="font-special-elite text-xs text-brass/90 mt-1.5">
                            {occ.formula}
                          </div>
                        </div>
                        <div className="font-special-elite text-[11px] text-muted-foreground/80 mt-2 flex items-center justify-between border-t border-brass/10 pt-1.5">
                          <span>
                            {occ.skills.length}{' '}
                            {t('skillsCount', { count: occ.skills.length })}
                          </span>
                          <span className="text-brass/60">
                            {isSelected ? '✓ ' + t('selected') : '›'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Prawa kolumna: Akta Profesji (Dossier) */}
          <div className="lg:col-span-5 flex flex-col min-h-0 max-lg:min-h-[300px] border border-brass/30 bg-[#15110d] p-5 overflow-y-auto custom-scrollbar">
            {selectedOcc ? (
              <div className="space-y-4">
                {/* Nagłówek akt */}
                <div>
                  <div className="font-special-elite uppercase tracking-[0.18em] text-[11px] text-brass/70">
                    {t('occupationDetailsEyebrow')}
                  </div>
                  <h3 className="font-display uppercase tracking-[0.08em] text-2xl text-foreground mt-0.5">
                    {getLocalizedOccupationName(selectedOcc, locale)}
                  </h3>
                  {recommendedOccupationIds.has(selectedOcc.id) && (
                    <div className="inline-flex items-center gap-1.5 mt-2 font-special-elite text-xs text-brass border border-primary/40 bg-primary/10 px-2.5 py-0.5">
                      ★ {t('recommendedByArchetypeOrOccupation')}
                      {selectedArchetype && ` (${selectedArchetype.name})`}
                    </div>
                  )}
                </div>

                <div className="h-px bg-brass/20" />

                {/* Opis fabularny */}
                <div className="bg-[#0c0a08]/70 border border-brass/20 p-3.5">
                  <div className="font-special-elite text-[11px] uppercase tracking-[0.1em] text-brass/70 mb-1">
                    {t('lore')}
                  </div>
                  <p className="font-serif italic text-sm text-foreground/90 leading-relaxed">
                    {getLocalizedOccupationDescription(selectedOcc.id, locale) ||
                      t('noDescription')}
                  </p>
                </div>

                {/* Metryka punktów i majętności */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-brass/25 bg-[#100d0a] p-3">
                    <div className="font-special-elite text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                      {t('occupationPointsLabel')}
                    </div>
                    <div className="font-display text-2xl font-bold text-brass/90 mt-0.5">
                      {state.occupationPoints}{' '}
                      <span className="text-xs text-muted-foreground font-normal">
                        pkt
                      </span>
                    </div>
                    <div className="font-special-elite text-[11px] text-brass/70 mt-1 truncate">
                      {selectedOcc.formula}
                    </div>
                  </div>

                  <div className="border border-brass/25 bg-[#100d0a] p-3">
                    <div className="font-special-elite text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                      {t('creditRating')}
                    </div>
                    <div className="font-display text-2xl font-bold text-foreground mt-0.5">
                      {selectedOcc.creditMin}-{selectedOcc.creditMax}%
                    </div>
                    <div className="font-special-elite text-[11px] text-muted-foreground mt-1">
                      {t('initialCreditRating', { val: selectedOcc.creditMin })}
                    </div>
                  </div>
                </div>

                {/* Umiejętności zawodowe */}
                <div>
                  <div className="font-special-elite text-xs uppercase tracking-[0.1em] text-brass/80 mb-2">
                    {t('occupationalSkillsList')} ({selectedOcc.skills.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedOcc.skills.map((skill, i) => (
                      <span
                        key={i}
                        className="font-special-elite text-xs uppercase tracking-[0.06em] px-2.5 py-1 bg-[#1a1611] border border-brass/30 text-brass/90 shadow-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Ekwipunek startowy */}
                {startingEquipmentList.length > 0 && (
                  <div>
                    <div className="font-special-elite text-xs uppercase tracking-[0.1em] text-brass/80 mb-2">
                      {t('startingEquipmentLabel')}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {startingEquipmentList.map((item, i) => (
                        <span
                          key={i}
                          className="font-special-elite text-xs px-2.5 py-1 bg-[#0a0c0f] border border-brass/20 text-muted-foreground"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 border border-dashed border-brass/20 min-h-[260px]">
                <span className="text-4xl mb-3 opacity-60">📜</span>
                <h4 className="font-display uppercase tracking-[0.08em] text-lg text-foreground mb-1">
                  {t('noOccupationSelectedTitle')}
                </h4>
                <p className="font-serif italic text-sm text-muted-foreground max-w-xs leading-relaxed">
                  {t('noOccupationSelectedHint')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderStep3 = () => {
    const selectedOcc = OCCUPATIONS.find((o) => o.id === state.occupationId);
    const totalPointsAvailable = state.occupationPoints + state.interestPoints;
    // Zielone rekomendacje umiejętności: znormalizowany zbiór (archetyp ∪ zawód)
    // identyczny z autoDistributeSkillsAI (buildRecommendedSkills).
    const archetypeSkills = getArchetypeSkills(
      selectedArchetypeId,
      state.rulesetVariant
    );
    const occupationalSkills = selectedOcc?.skills || [];
    const recommendedSkills = new Set<string>(
      buildRecommendedSkills(archetypeSkills, occupationalSkills)
    );
    const resolveBaseValue = (s: string): number => {
      if (s === NATIVE_LANGUAGE_SKILL) return state.stats.edu;
      if (s === 'Unik') return Math.floor(state.stats.dex / 2);
      return BASE_SKILLS[s] || 1;
    };

    const usage = calculateSkillPointsUsage({
      skills: state.skills,
      recommendedSkills,
      creditRating: state.creditRating,
      occupationPoints: state.occupationPoints,
      interestPoints: state.interestPoints,
      getBaseValue: resolveBaseValue,
    });

    const defaultCreditMin = selectedOcc?.creditMin ?? 0;
    const hasSkillPointsAllocated = Object.entries(state.skills).some(
      ([skillName, value]) => {
        if (skillName === CREDIT_RATING_SKILL || skillName === 'Mity Cthulhu') return false;
        return (value || 0) > resolveBaseValue(skillName);
      }
    );
    const hasCreditRatingAllocated = (state.creditRating ?? 0) > defaultCreditMin;
    const canReset = hasSkillPointsAllocated || hasCreditRatingAllocated;

    const handleResetSkills = () => {
      const initialSkills = getInitialSkills(state.stats.edu, state.stats.dex);
      const resetSkills = {
        ...initialSkills,
        [CREDIT_RATING_SKILL]: defaultCreditMin,
      };

      const nextUsage = calculateSkillPointsUsage({
        skills: resetSkills,
        recommendedSkills,
        creditRating: defaultCreditMin,
        occupationPoints: state.occupationPoints,
        interestPoints: state.interestPoints,
        getBaseValue: resolveBaseValue,
      });

      setState((prev) => ({
        ...prev,
        skills: resetSkills,
        creditRating: defaultCreditMin,
        occupationPointsUsed: nextUsage.occupationPointsUsed,
        interestPointsUsed: nextUsage.interestPointsUsed,
      }));
      setIsResetConfirmOpen(false);
    };

    return (
      <div className="space-y-4">
        {isResetConfirmOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-skills-title"
            data-testid="reset-skills-confirm-dialog"
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
            onClick={() => setIsResetConfirmOpen(false)}
          >
            <div
              className="relative bg-[#14110c] border-2 border-brass/50 p-6 max-w-md w-full shadow-[0_0_30px_rgba(0,0,0,.8)] space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Narożniki déco */}
              <span className="pointer-events-none absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-brass/70" />
              <span className="pointer-events-none absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-brass/70" />
              <span className="pointer-events-none absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-brass/70" />
              <span className="pointer-events-none absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-brass/70" />

              <div className="space-y-2 text-center">
                <h3
                  id="reset-skills-title"
                  className="font-display font-bold uppercase tracking-[0.1em] text-lg text-brass"
                >
                  {t('resetSkillsConfirmTitle')}
                </h3>
                <p className="font-serif italic text-sm text-muted-foreground leading-relaxed">
                  {t('resetSkillsConfirmDesc', { creditMin: defaultCreditMin })}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-brass/20">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="reset-skills-cancel-btn"
                  onClick={() => setIsResetConfirmOpen(false)}
                  className="font-display font-semibold uppercase tracking-[0.14em] text-muted-foreground border-brass/30 hover:border-brass/60 hover:text-brass px-4 py-2"
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  data-testid="reset-skills-confirm-btn"
                  onClick={handleResetSkills}
                  className="font-display font-semibold uppercase tracking-[0.14em] text-[#04110f] bg-primary border border-brass/30 hover:brightness-110 shadow-[0_0_16px_rgba(13,148,136,.3)] px-4 py-2 flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('resetSkillsConfirmAction')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Inline Banner przy przeciążeniu Wyroczni (Issue #691) */}
        {oracleOverloaded?.step === 'skills' &&
          renderOracleOverloadedBanner('oracle-overloaded-skills-banner', () => {
            void autoDistributeSkillsAI();
          })}

        <StepHeading
          title={t('stepSkillsTitle')}
          subtitle={t('stepSkillsSubtitle')}
          action={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                disabled={!canReset || isDistributingSkills}
                variant="outline"
                size="sm"
                data-testid="reset-skills-button"
                className="font-display font-semibold uppercase tracking-[0.14em] text-muted-foreground bg-transparent border-brass/30 hover:border-brass/60 hover:text-brass px-3.5 py-2.5 flex items-center gap-2 disabled:opacity-40"
              >
                <RotateCcw className="w-4 h-4" />
                {t('resetSkills')}
              </Button>
              <Button
                type="button"
                onClick={autoDistributeSkillsAI}
                disabled={isDistributingSkills || totalPointsAvailable === 0}
                size="sm"
                className="font-display font-semibold uppercase tracking-[0.14em] text-[#04110f] bg-primary border border-brass/30 hover:brightness-110 shadow-[0_0_16px_rgba(13,148,136,.3)] px-4 py-2.5 flex items-center gap-2"
              >
                <Sparkles
                  className={`w-4 h-4 text-[#04110f] ${
                    isDistributingSkills ? 'animate-spin' : ''
                  }`}
                />
                {isDistributingSkills
                  ? t('distributing')
                  : t('distributeWithAi')}
              </Button>
            </div>
          }
        />

        {/* LEGENDA - wyjaśnienie systemu */}
        <div className="border border-brass/28 bg-[#16130f] p-4 text-sm space-y-2">
          <div className="font-display uppercase tracking-[0.1em] text-brass text-xs font-semibold mb-2">
            {t('howItWorks')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-muted-foreground">
            <div>
              <span className="text-foreground font-special-elite text-xs uppercase tracking-[0.08em]">
                {t('occupationPointsLabel')}:
              </span>{' '}
              {state.occupationPoints} pkt
              <div className="font-serif italic text-sm mt-1">
                {selectedOcc
                  ? t('occupationFormula', { formula: selectedOcc.formula })
                  : t('occupationFormulaMissing')}
              </div>
            </div>
            <div>
              <span className="text-foreground font-special-elite text-xs uppercase tracking-[0.08em]">
                {t('interestPoints')}:
              </span>{' '}
              {state.interestPoints} pkt
              <div className="font-serif italic text-sm mt-1">
                {t('intFormula', { value: state.stats.int })}
              </div>
            </div>
          </div>
          <div className="border-t border-brass/20 pt-2 mt-1 font-serif italic text-sm text-muted-foreground">
            {t('aiSkillAllocationHelp')}
          </div>
          <div className="border-t border-brass/20 pt-2 mt-2 grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-brass/80">(X)</span> ={' '}
              {t('baseSkillValue')}
            </div>
            <div>
              <span className="text-foreground">25/12</span> ={' '}
              {t('halfAndFifth')}
            </div>
            <div>
              <span className="text-brass">★</span> ={' '}
              {t('aiRecommendedLegend')}
            </div>
          </div>
        </div>

        {/* Rozdzielone liczniki punktów CoC 7e RAW (Issue #411) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Kafelek 1: Punkty zawodowe */}
          <div
            className={`border p-4 transition-colors ${
              usage.isOccupationOverLimit
                ? 'border-destructive/60 bg-destructive/10'
                : 'border-brass/30 bg-[#1f1a14]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm uppercase tracking-[0.12em] text-brass font-semibold">
                  ★ {t('occupationPointsTitle')}
                </span>
                <span className="font-serif italic text-sm text-muted-foreground">
                  ({selectedOcc ? selectedOcc.formula : t('occupationUnknown')})
                </span>
              </div>
              <span className="font-special-elite text-sm text-brass/90 font-medium">
                {t('pointsSpentRatio', {
                  used: usage.occupationPointsUsed,
                  available: state.occupationPoints,
                })}
              </span>
            </div>

            <div className="flex items-baseline justify-between mb-2">
              <div>
                <span className="text-sm uppercase tracking-[0.08em] text-brass/90 font-special-elite mr-2">
                  {t('pointsRemainingShort')}:
                </span>
                <span
                  className={`font-display text-2xl font-bold ${
                    usage.isOccupationOverLimit
                      ? 'text-destructive'
                      : 'text-brass'
                  }`}
                >
                  {usage.occupationPointsRemaining}
                </span>
                <span className="font-special-elite text-sm text-brass/90 ml-1">
                  pkt
                </span>
              </div>
              {state.creditRating > 0 && (
                <span className="font-serif italic text-sm text-foreground/80">
                  {t('creditRatingIncluded', { count: state.creditRating })}
                </span>
              )}
            </div>

            {/* Pasek postępu - Pula zawodowa (złoty mosiądz) */}
            <div className="w-full bg-[#100d0a] h-2 border border-brass/20 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  usage.isOccupationOverLimit
                    ? 'bg-destructive'
                    : 'bg-gradient-to-r from-brass/60 to-brass'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      (usage.occupationPointsUsed /
                        (state.occupationPoints || 1)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
            {usage.isOccupationOverLimit && (
              <div className="text-destructive text-xs mt-1.5 font-special-elite">
                {t('overLimit')}
              </div>
            )}
          </div>

          {/* Kafelek 2: Punkty zainteresowań */}
          <div
            className={`border p-4 transition-colors ${
              usage.isInterestOverLimit
                ? 'border-destructive/60 bg-destructive/10'
                : 'border-brass/30 bg-[#1f1a14]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm uppercase tracking-[0.12em] text-teal-400 font-semibold">
                  ✦ {t('interestPointsTitle')}
                </span>
                <span className="font-serif italic text-sm text-muted-foreground">
                  ({t('intFormulaShort', { value: state.stats.int })})
                </span>
              </div>
              <span className="font-special-elite text-sm text-teal-300/90 font-medium">
                {t('pointsSpentRatio', {
                  used: usage.interestPointsUsed,
                  available: state.interestPoints,
                })}
              </span>
            </div>

            <div className="flex items-baseline justify-between mb-2">
              <div>
                <span className="text-sm uppercase tracking-[0.08em] text-teal-300/90 font-special-elite mr-2">
                  {t('pointsRemainingShort')}:
                </span>
                <span
                  className={`font-display text-2xl font-bold ${
                    usage.isInterestOverLimit
                      ? 'text-destructive'
                      : 'text-teal-300'
                  }`}
                >
                  {usage.interestPointsRemaining}
                </span>
                <span className="font-special-elite text-sm text-teal-300/90 ml-1">
                  pkt
                </span>
              </div>
              <span className="font-serif italic text-sm text-foreground/80">
                {t('hobbiesAndExcess')}
              </span>
            </div>

            {/* Pasek postępu - Pula zainteresowań (szmaragd / teal) */}
            <div className="w-full bg-[#100d0a] h-2 border border-brass/20 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  usage.isInterestOverLimit
                    ? 'bg-destructive'
                    : 'bg-gradient-to-r from-teal-700 to-teal-400'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      (usage.interestPointsUsed /
                        (state.interestPoints || 1)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
            {usage.isInterestOverLimit && (
              <div className="text-destructive text-xs mt-1.5 font-special-elite">
                {t('overLimit')}
              </div>
            )}
          </div>
        </div>

        {/* Majętność */}
        {selectedOcc && (
          <div className="border border-brass/20 bg-[#0e1413] p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <label className="block font-display uppercase tracking-[0.1em] text-sm text-brass/80 mb-1">
                  💰 {t('creditRating')} (Credit Rating)
                </label>
                <p className="font-serif italic text-xs text-muted-foreground">
                  {t('occupationDefinesRange', {
                    occupation: selectedOcc.name,
                  })}{' '}
                  <span className="text-brass/80 font-medium">
                    {selectedOcc.creditMin}-{selectedOcc.creditMax}
                  </span>
                </p>
              </div>
              <input
                type="number"
                value={state.creditRating}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 0;
                  // 1) trzymaj się zakresu zawodu (creditMin..creditMax)
                  const inRange = Math.max(
                    selectedOcc.creditMin,
                    Math.min(selectedOcc.creditMax, v)
                  );
                  // 2) Majętność płaci z puli zawodowej - nie pozwól wydać więcej niż
                  //    zostało po punktach już wydanych na umiejętności.
                  const spentOnSkills =
                    usage.occupationSkillPointsUsed + usage.interestPointsUsed;
                  const maxAffordable = totalPointsAvailable - spentOnSkills;
                  const clamped = Math.max(
                    selectedOcc.creditMin,
                    Math.min(inRange, maxAffordable)
                  );
                  const nextSkills = {
                    ...state.skills,
                    [CREDIT_RATING_SKILL]: clamped,
                  };
                  const nextUsage = calculateSkillPointsUsage({
                    skills: nextSkills,
                    recommendedSkills,
                    creditRating: clamped,
                    occupationPoints: state.occupationPoints,
                    interestPoints: state.interestPoints,
                    getBaseValue: resolveBaseValue,
                  });
                  setState((prev) => ({
                    ...prev,
                    creditRating: clamped,
                    skills: nextSkills,
                    occupationPointsUsed: nextUsage.occupationPointsUsed,
                    interestPointsUsed: nextUsage.interestPointsUsed,
                  }));
                }}
                className="w-24 bg-[#16130f] border border-brass/30 px-3 py-2 text-center font-display text-2xl font-bold text-foreground focus:outline-none"
                min={selectedOcc.creditMin}
                max={selectedOcc.creditMax}
              />
            </div>
          </div>
        )}

        {/* Obliczenia i filtrowanie umiejętności (Issue #414) */}
        {(() => {
          const allSkillsList = Object.entries(state.skills).filter(
            ([name]) => name !== CREDIT_RATING_SKILL
          );

          const totalCount = allSkillsList.length;
          const occupationalCount = allSkillsList.filter(([name]) =>
            recommendedSkills.has(name)
          ).length;
          const investedCount = allSkillsList.filter(
            ([name, val]) => val > (BASE_SKILLS[name] || 0)
          ).length;

          const filteredSkills = allSkillsList.filter(([name, val]) => {
            if (skillFilter === 'occupational') {
              return recommendedSkills.has(name);
            }
            if (skillFilter === 'invested') {
              return val > (BASE_SKILLS[name] || 0);
            }
            return true;
          });

          return (
            <div className="space-y-4">
              {/* Pasek przełączników filtrowania Deco */}
              <div className="flex flex-wrap items-center justify-between gap-3 border border-brass/25 bg-[#120f0c] p-2.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setSkillFilter('all')}
                    data-testid="skills-filter-all"
                    className={`px-3.5 py-1.5 text-xs sm:text-sm font-display uppercase tracking-[0.12em] font-semibold transition-all border ${
                      skillFilter === 'all'
                        ? 'border-brass bg-brass/20 text-brass font-bold shadow-[0_0_12px_rgba(201,162,39,0.2)] ring-1 ring-brass/50'
                        : 'border-brass/25 bg-[#0a0f0e] text-muted-foreground hover:border-brass/45 hover:text-foreground'
                    }`}
                  >
                    {t('skillsFilterAll')}{' '}
                    <span className="font-mono text-xs font-semibold opacity-90">({totalCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSkillFilter('occupational')}
                    data-testid="skills-filter-occupational"
                    className={`px-3.5 py-1.5 text-xs sm:text-sm font-display uppercase tracking-[0.12em] font-semibold transition-all border ${
                      skillFilter === 'occupational'
                        ? 'border-brass bg-brass/20 text-brass font-bold shadow-[0_0_12px_rgba(201,162,39,0.2)] ring-1 ring-brass/50'
                        : 'border-brass/25 bg-[#0a0f0e] text-muted-foreground hover:border-brass/45 hover:text-foreground'
                    }`}
                  >
                    ★ {t('skillsFilterOccupational')}{' '}
                    <span className="font-mono text-xs font-semibold opacity-90">({occupationalCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSkillFilter('invested')}
                    data-testid="skills-filter-invested"
                    className={`px-3.5 py-1.5 text-xs sm:text-sm font-display uppercase tracking-[0.12em] font-semibold transition-all border ${
                      skillFilter === 'invested'
                        ? 'border-brass bg-brass/20 text-brass font-bold shadow-[0_0_12px_rgba(201,162,39,0.2)] ring-1 ring-brass/50'
                        : 'border-brass/25 bg-[#0a0f0e] text-muted-foreground hover:border-brass/45 hover:text-foreground'
                    }`}
                  >
                    ✦ {t('skillsFilterInvested')}{' '}
                    <span className="font-mono text-xs font-semibold opacity-90">({investedCount})</span>
                  </button>
                </div>
              </div>

              {/* Siatka umiejętności lub Pusty Stan (Empty State) */}
              {filteredSkills.length === 0 ? (
                <div
                  data-testid="skills-filter-empty-state"
                  className="border border-brass/30 bg-[#16130f] p-8 text-center space-y-3"
                >
                  <div className="font-display uppercase tracking-[0.12em] text-brass text-base font-semibold">
                    {t('skillsFilterEmptyTitle')}
                  </div>
                  <p className="font-serif italic text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                    {t('skillsFilterEmptyDesc')}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSkillFilter('all')}
                    className="font-display font-semibold uppercase tracking-[0.14em] text-brass/90 border-brass/35 hover:border-brass hover:bg-brass/15 px-4 py-2 text-xs mt-2"
                  >
                    {t('skillsFilterShowAll')}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {filteredSkills.map(([skillName, value]) => {
                    const baseValue = BASE_SKILLS[skillName] || 0;
                    const pointsAdded = value - baseValue;
                    const isRecommended = recommendedSkills.has(skillName);
                    return (
                      <div
                        key={skillName}
                        data-testid={`skill-card-${skillName}`}
                        className={`border p-4 ${
                          isRecommended
                            ? 'ring-1 ring-primary border-brass/50 bg-primary/10'
                            : 'border-brass/28 bg-[#16130f]'
                        }`}
                      >
                        {/* Nazwa umiejętności */}
                        <div className="flex items-center gap-1 mb-2">
                          <span className="font-special-elite text-base uppercase tracking-[0.08em] text-foreground truncate">
                            {skillName}
                          </span>
                          {isRecommended && (
                            <span
                              className="text-brass/80"
                              title={t('recommendedByArchetypeOrOccupation')}
                            >
                              ★
                            </span>
                          )}
                          <HelpIcon
                            content={
                              SKILL_DESCRIPTIONS[skillName] ||
                              t('baseValue', { value: baseValue })
                            }
                            position="right"
                          />
                        </div>
                        {/* Wartości */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={value}
                              disabled={skillName === 'Mity Cthulhu'}
                              onChange={(e) =>
                                updateSkill(skillName, parseInt(e.target.value) || 0)
                              }
                              className={`w-16 bg-[#0a0c0f] border border-brass/30 px-2 py-1.5 text-center font-display text-lg font-bold text-foreground focus:outline-none focus:border-brass/30 ${
                                skillName === 'Mity Cthulhu'
                                  ? 'opacity-50 cursor-not-allowed'
                                  : ''
                              }`}
                              min={baseValue}
                              max={skillName === 'Mity Cthulhu' ? 0 : 99}
                            />
                            <div className="font-special-elite text-sm text-foreground/90 font-medium">
                              <div>
                                {t('baseShort')}{' '}
                                <span className="text-brass font-bold">{baseValue}</span>
                              </div>
                              <div className="text-brass-light font-semibold">
                                {half(value)}/{fifth(value)}
                              </div>
                            </div>
                          </div>
                          {pointsAdded > 0 && (
                            <span className="font-special-elite text-sm font-semibold text-brass">
                              +{t('pointsAdded', { count: pointsAdded })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  const renderStep4 = () => (
    <div className="space-y-4">
      {/* Inline Banner przy przeciążeniu Wyroczni (Issue #691) */}
      {oracleOverloaded?.step === 'biography' &&
        renderOracleOverloadedBanner('oracle-overloaded-biography-banner', () => {
          void generateBackstory();
        })}

      <StepHeading
        title={t('stepBiographyTitle')}
        subtitle={t('stepBiographySubtitle')}
        action={
          <Button
            onClick={generateBackstory}
            disabled={state.isGeneratingBackstory}
            size="sm"
            className="font-display font-semibold uppercase tracking-[0.14em] text-brass bg-brass/[0.06] border border-brass/40 hover:bg-brass/15 px-4 py-2.5"
          >
            {state.isGeneratingBackstory
              ? t('generating')
              : t('generateAiStory')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block font-special-elite text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold mb-1">
            {t('fullName')}
          </label>
          <input
            type="text"
            value={state.name}
            onChange={(e) =>
              setState((prev) => ({ ...prev, name: e.target.value }))
            }
            className="w-full bg-[#0a0c0f] border border-brass/30 px-3 py-2 text-base text-foreground focus:outline-none focus:border-brass/30"
            placeholder={t('namePlaceholder')}
          />
        </div>
        <div>
          <label className="block font-special-elite text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold mb-1">
            {t('gender')}
          </label>
          <select
            value={state.gender}
            onChange={(e) =>
              setState((prev) => ({ ...prev, gender: e.target.value }))
            }
            className="w-full bg-[#0a0c0f] border border-brass/30 px-3 py-2 text-base text-foreground focus:outline-none focus:border-brass/30"
          >
            <option value="">{t('selectPlaceholder')}</option>
            <option value="male">{t('male')}</option>
            <option value="female">{t('female')}</option>
          </select>
        </div>
        <div>
          <label className="block font-special-elite text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold mb-1">
            {t('birthplace')}
          </label>
          <input
            type="text"
            value={state.birthplace}
            onChange={(e) =>
              setState((prev) => ({ ...prev, birthplace: e.target.value }))
            }
            className="w-full bg-[#0a0c0f] border border-brass/30 px-3 py-2 text-base text-foreground focus:outline-none focus:border-brass/30"
            placeholder={t('birthplacePlaceholder')}
          />
        </div>
        <div>
          <label className="block font-special-elite text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold mb-1">
            {t('appearanceDescription')}
          </label>
          <input
            type="text"
            value={state.description}
            onChange={(e) =>
              setState((prev) => ({ ...prev, description: e.target.value }))
            }
            className="w-full bg-[#0a0c0f] border border-brass/30 px-3 py-2 text-base text-foreground focus:outline-none focus:border-brass/30"
            placeholder={t('appearancePlaceholder')}
          />
        </div>
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="font-special-elite text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold">
              {t('ideologyLabel')}
            </label>
            <button
              onClick={() => generateSingleField('ideology')}
              disabled={!!generatingField}
              className="font-display uppercase tracking-[0.1em] text-xs sm:text-sm px-2.5 py-1 text-brass bg-brass/[0.06] border border-brass/40 hover:bg-brass/15 disabled:opacity-50"
            >
              {generatingField === 'ideology' ? t('generatingEllipsis') : t('generateButton')}
            </button>
          </div>
          <textarea
            value={state.ideology}
            onChange={(e) =>
              setState((prev) => ({ ...prev, ideology: e.target.value }))
            }
            className="w-full bg-[#0a0c0f] border border-brass/30 px-3 py-2 text-base text-foreground h-24 2xl:h-36 focus:outline-none focus:border-brass/30"
            placeholder={t('ideologyPlaceholder')}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-special-elite text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold">
              {t('importantPeople')}
            </label>
            <button
              onClick={() => generateSingleField('importantPeople')}
              disabled={!!generatingField}
              className="font-display uppercase tracking-[0.1em] text-xs sm:text-sm px-2.5 py-1 text-brass bg-brass/[0.06] border border-brass/40 hover:bg-brass/15 disabled:opacity-50"
            >
              {generatingField === 'importantPeople' ? t('generatingEllipsis') : t('generateButton')}
            </button>
          </div>
          <textarea
            value={state.importantPeople}
            onChange={(e) =>
              setState((prev) => ({ ...prev, importantPeople: e.target.value }))
            }
            className="w-full bg-[#0a0c0f] border border-brass/30 px-3 py-2 text-base text-foreground h-24 2xl:h-36 focus:outline-none focus:border-brass/30"
            placeholder={t('importantPeoplePlaceholder')}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-special-elite text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold">
              {t('significantPlaces')}
            </label>
            <button
              onClick={() => generateSingleField('significantPlaces')}
              disabled={!!generatingField}
              className="font-display uppercase tracking-[0.1em] text-xs sm:text-sm px-2.5 py-1 text-brass bg-brass/[0.06] border border-brass/40 hover:bg-brass/15 disabled:opacity-50"
            >
              {generatingField === 'significantPlaces' ? t('generatingEllipsis') : t('generateButton')}
            </button>
          </div>
          <textarea
            value={state.significantPlaces}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                significantPlaces: e.target.value,
              }))
            }
            className="w-full bg-[#0a0c0f] border border-brass/30 px-3 py-2 text-base text-foreground h-24 2xl:h-36 focus:outline-none focus:border-brass/30"
            placeholder={t('significantPlacesPlaceholder')}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-special-elite text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold">
              {t('personalItems')}
            </label>
            <button
              onClick={() => generateSingleField('personalItems')}
              disabled={!!generatingField}
              className="font-display uppercase tracking-[0.1em] text-xs sm:text-sm px-2.5 py-1 text-brass bg-brass/[0.06] border border-brass/40 hover:bg-brass/15 disabled:opacity-50"
            >
              {generatingField === 'personalItems' ? t('generatingEllipsis') : t('generateButton')}
            </button>
          </div>
          <textarea
            value={state.personalItems}
            onChange={(e) =>
              setState((prev) => ({ ...prev, personalItems: e.target.value }))
            }
            className="w-full bg-[#0a0c0f] border border-brass/30 px-3 py-2 text-base text-foreground h-24 2xl:h-36 focus:outline-none focus:border-brass/30"
            placeholder={t('personalItemsPlaceholder')}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-special-elite text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold">
              {t('traitsLabel')}
            </label>
            <button
              onClick={() => generateSingleField('traits')}
              disabled={!!generatingField}
              className="font-display uppercase tracking-[0.1em] text-xs sm:text-sm px-2.5 py-1 text-brass bg-brass/[0.06] border border-brass/40 hover:bg-brass/15 disabled:opacity-50"
            >
              {generatingField === 'traits' ? t('generatingEllipsis') : t('generateButton')}
            </button>
          </div>
          <textarea
            value={state.traits}
            onChange={(e) =>
              setState((prev) => ({ ...prev, traits: e.target.value }))
            }
            className="w-full bg-[#0a0c0f] border border-brass/30 px-3 py-2 text-base text-foreground h-24 2xl:h-36 focus:outline-none focus:border-brass/30"
            placeholder={t('traitsPlaceholder')}
          />
        </div>
        <div className="md:col-span-2 border border-brass/20 bg-[#0e1413] p-3.5">
          <div className="flex items-center justify-between mb-1">
            <label className="font-display uppercase tracking-[0.1em] text-sm text-brass font-semibold">
              ★ {t('keyConnection')}
            </label>
            <button
              onClick={() => generateSingleField('keyConnection')}
              disabled={!!generatingField}
              className="font-display uppercase tracking-[0.1em] text-xs sm:text-sm px-2.5 py-1 text-brass bg-brass/[0.06] border border-brass/40 hover:bg-brass/15 disabled:opacity-50"
            >
              {generatingField === 'keyConnection' ? t('generatingEllipsis') : t('generateButton')}
            </button>
          </div>
          <textarea
            value={state.keyConnection}
            onChange={(e) =>
              setState((prev) => ({ ...prev, keyConnection: e.target.value }))
            }
            className="w-full bg-[#0a0c0f] border border-brass/30 px-3 py-2 text-base text-foreground h-24 2xl:h-36 focus:outline-none"
            placeholder={t('keyConnectionPlaceholder')}
          />
        </div>
        
        {/* NOWE POLE: NARRACYJNA BIOGRAFIA */}
        <div className="md:col-span-2 mt-6 pt-6 border-t border-brass/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <label className="font-display uppercase tracking-[0.14em] text-sm text-brass font-bold flex items-center gap-2">
                📜 {t('biographyHeading')}
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                {t('biographyDescription')}
              </p>
            </div>
            <button
              onClick={generateNarrativeBiography}
              disabled={state.isGeneratingNarrative}
              className="font-display uppercase tracking-[0.1em] text-xs px-4 py-2 text-brass bg-brass/[0.06] border border-brass/40 hover:bg-brass/15 disabled:opacity-50 flex-shrink-0"
            >
              {state.isGeneratingNarrative ? t('generating') : t('generateAiSummary')}
            </button>
          </div>
          <textarea
            value={state.backstory}
            onChange={(e) =>
              setState((prev) => ({ ...prev, backstory: e.target.value }))
            }
            className="w-full bg-[#0a0c0f] border border-brass/30 px-4 py-3 text-foreground min-h-[200px] 2xl:min-h-[280px] focus:outline-none leading-relaxed font-serif"
            placeholder={t('fullHistoryPlaceholder')}
          />
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => {
    const wealthInfo = getWealthInfo();

    return (
      <div className="space-y-6">
        <StepHeading
          title={t('stepEquipmentTitle')}
          subtitle={t('wealthSubtitle', { creditRating: state.creditRating })}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* LEWA KOLUMNA: Wizerunek i Akta Badacza */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Generator portretu */}
            <div className="border border-brass/28 bg-[#16130f] p-4">
              <label className="block font-display uppercase tracking-[0.1em] text-brass text-xs font-semibold mb-3">
                🎨 {t('characterPortrait')}
              </label>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                {(() => {
                  const activePortrait = state.portraitUrl || getRetroPortraitForOccupation(state.occupationId).svgPath;
                  return (
                    <button
                      type="button"
                      onClick={() => setShowPortraitZoom(true)}
                      title={t('enlargePortrait')}
                      className="relative w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0 border border-brass/50 overflow-hidden cursor-zoom-in group p-0 shadow-[0_4px_12px_rgba(0,0,0,0.5)] bg-[#0a0f0e]"
                    >
                      <SafeImage
                        src={activePortrait}
                        alt={t('portrait')}
                        className="w-full h-full object-cover"
                      />
                      <span
                        className="pointer-events-none absolute inset-0"
                        style={{
                          boxShadow: 'inset 0 0 70px 16px rgba(0,0,0,.7)',
                        }}
                      />
                      <span className="pointer-events-none absolute bottom-1 right-1 text-brass/90 text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-1 rounded">
                        🔍
                      </span>
                    </button>
                  );
                })()}
                {isPureTextMode() ? (
                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <Badge
                      variant="outline"
                      className="font-mono text-[11px] text-amber-400 border-amber-500/40 bg-amber-950/20 px-2.5 py-1"
                    >
                      📜 {t('pureTextDossierBadge')}
                    </Badge>
                    <p className="font-serif italic text-xs text-muted-foreground leading-snug">
                      {t('pureTextEngravingNotice')}
                    </p>
                    <Button
                      type="button"
                      onClick={() => setShowRetroPortraitPicker(true)}
                      size="sm"
                      className="w-full sm:w-auto font-display font-semibold uppercase tracking-[0.12em] text-brass bg-brass/[0.08] border border-brass/45 hover:bg-brass/20 px-3 py-2 text-xs"
                    >
                      🏛️ {t('changeRetroEngraving')}
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={generatePortrait}
                        disabled={state.isGeneratingPortrait}
                        size="sm"
                        className={
                          state.portraitUrl && !isRetroPortraitUrl(state.portraitUrl)
                            ? 'flex-1 font-display font-semibold uppercase tracking-[0.12em] text-brass bg-brass/[0.04] border border-brass/45 hover:bg-brass/10 px-3 py-2 text-xs'
                            : 'flex-1 font-display font-semibold uppercase tracking-[0.12em] text-[#04110f] bg-primary border border-brass/30 hover:brightness-110 shadow-[0_0_16px_rgba(13,148,136,.3)] px-3 py-2 text-xs'
                        }
                      >
                        {state.isGeneratingPortrait
                          ? t('generating')
                          : state.portraitUrl && !isRetroPortraitUrl(state.portraitUrl)
                            ? `🔄 ${t('generateAnotherPortrait')}`
                            : `🎨 ${t('generateAiPortrait')}`}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setShowRetroPortraitPicker(true)}
                        size="sm"
                        className="font-display font-semibold uppercase tracking-[0.12em] text-brass bg-brass/[0.06] border border-brass/40 hover:bg-brass/15 px-3 py-2 text-xs"
                      >
                        🏛️ {isRetroPortraitUrl(state.portraitUrl) ? t('changeRetroEngraving') : t('chooseRetroEngraving')}
                      </Button>
                    </div>
                    <p className="font-serif italic text-xs text-muted-foreground leading-snug">
                      {state.portraitUrl && !isRetroPortraitUrl(state.portraitUrl)
                        ? t('replacePortraitHint')
                        : isRetroPortraitUrl(state.portraitUrl)
                          ? t('pureTextEngravingNotice')
                          : t('portraitGenerationHint')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Podsumowanie postaci (Akta Badacza) */}
            <div className="border border-brass/20 bg-[#0e1413] p-4 shadow-[0_0_14px_rgba(13,148,136,.1)] flex-1 flex flex-col justify-between">
              <div>
                <div className="font-display uppercase tracking-[0.1em] text-brass text-sm font-semibold mb-2">
                  ✓ {t('summary')}
                </div>
                <div className="text-base text-foreground">
                  <strong className="text-brass text-lg">
                    {state.name || t('defaultCharacterName')}
                  </strong>
                  <span className="text-muted-foreground">
                    , {state.age} {t('yearsOld')},{' '}
                    {getLocalizedOccupationName(
                      OCCUPATIONS.find((o) => o.id === state.occupationId),
                      locale
                    ) || t('unknownOccupation')}
                  </span>
                </div>
              </div>

              {/* Siatka atrybutów */}
              <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-brass/20 text-center font-special-elite text-sm font-medium">
                {STAT_KEYS.map((stat) => (
                  <div
                    key={stat}
                    className="bg-[#14110c] border border-brass/20 py-1.5 px-1"
                  >
                    <span className="text-brass/80 text-xs font-semibold uppercase block tracking-wider">
                      {stat.toUpperCase()}
                    </span>
                    <span className="text-brass font-bold text-base">
                      {state.stats[stat]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PRAWA KOLUMNA: Status finansowy i Ekwipunek */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Tabela majątku */}
            <div className="border border-brass/28 bg-[#16130f] p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="font-special-elite text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold">
                    {t('level')}
                  </div>
                  <div className="font-display text-foreground font-bold text-base mt-1">
                    {t.has(`wealthLevels.${wealthInfo.key}`)
                      ? t(`wealthLevels.${wealthInfo.key}`)
                      : wealthInfo.level}
                  </div>
                </div>
                <div>
                  <div className="font-special-elite text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold">
                    {t('cash')}
                  </div>
                  <div className="font-display text-brass font-bold text-base mt-1">
                    {wealthInfo.cash}
                  </div>
                </div>
                <div>
                  <div className="font-special-elite text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold">
                    {t('assets')}
                  </div>
                  <div className="font-display text-muted-foreground font-bold text-base mt-1">
                    {wealthInfo.key === 'pauper' || wealthInfo.assets === 'Brak'
                      ? t('assetsNone')
                      : wealthInfo.assets}
                  </div>
                </div>
                <div>
                  <div className="font-special-elite text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold">
                    {t('spendingPerDay')}
                  </div>
                  <div className="font-display text-brass font-bold text-base mt-1">
                    {wealthInfo.spending}
                  </div>
                </div>
              </div>
              {wealthInfo.livingConditions && (
                <div className="mt-3 pt-3 border-t border-brass/15 text-left">
                  <div className="font-serif italic text-sm text-foreground/85 leading-relaxed">
                    <span className="font-semibold text-brass not-italic">🏠 {t('livingConditions')}:</span> {wealthInfo.livingConditions}
                  </div>
                </div>
              )}
            </div>

            {/* Prezentacja ekwipunku Art Déco */}
            <WizardEquipmentView
              equipmentStr={state.equipment}
              era={adventureContext?.yearRange}
            />
          </div>
        </div>

        {showPortraitZoom && state.portraitUrl && (
          <ImageLightbox
            src={state.portraitUrl}
            alt={t('characterPortrait')}
            onClose={() => setShowPortraitZoom(false)}
          />
        )}

        {showRetroPortraitPicker && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="retro-portrait-gallery-title"
            data-testid="retro-portrait-gallery-dialog"
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-150"
            onClick={() => setShowRetroPortraitPicker(false)}
          >
            <div
              className="relative bg-[#0e1413] border-2 border-brass/50 p-6 max-w-4xl w-full max-h-[90vh] shadow-[0_0_40px_rgba(0,0,0,.9)] flex flex-col space-y-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Narożniki déco */}
              <span className="pointer-events-none absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-brass/70" />
              <span className="pointer-events-none absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-brass/70" />
              <span className="pointer-events-none absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-brass/70" />
              <span className="pointer-events-none absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-brass/70" />

              {/* Nagłówek */}
              <div className="flex items-start justify-between border-b border-brass/20 pb-3">
                <div className="space-y-1">
                  <h3
                    id="retro-portrait-gallery-title"
                    className="font-display font-bold uppercase tracking-[0.1em] text-lg sm:text-xl text-brass flex items-center gap-2"
                  >
                    🏛️ {t('retroEngravingGalleryTitle')}
                  </h3>
                  <p className="font-serif italic text-xs sm:text-sm text-muted-foreground">
                    {t('retroEngravingGallerySubtitle')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRetroPortraitPicker(false)}
                  className="text-brass/70 hover:text-brass hover:bg-brass/10 -mr-2"
                  aria-label={t('close')}
                >
                  ✕
                </Button>
              </div>

              {/* Siatka 12 rycin */}
              <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 py-2">
                {RETRO_PORTRAITS.map((archetype) => {
                  const isCurrent =
                    state.portraitUrl === archetype.svgPath ||
                    (!state.portraitUrl &&
                      getRetroPortraitForOccupation(state.occupationId).svgPath === archetype.svgPath);

                  const localizedTitle =
                    locale === 'en' ? archetype.titleEn : archetype.titlePl;
                  const localizedDesc =
                    locale === 'en' ? archetype.descriptionEn : archetype.descriptionPl;

                  return (
                    <button
                      key={archetype.id}
                      type="button"
                      data-testid={`retro-portrait-card-${archetype.id}`}
                      onClick={() => {
                        setState((prev) => ({ ...prev, portraitUrl: archetype.svgPath }));
                        setShowRetroPortraitPicker(false);
                      }}
                      className={`group relative flex flex-col items-center text-left p-2.5 transition-all border ${
                        isCurrent
                          ? 'border-brass bg-brass/15 shadow-[0_0_15px_rgba(201,162,39,0.25)] ring-1 ring-brass/60'
                          : 'border-brass/25 bg-[#0a0f0e]/90 hover:border-brass/60 hover:bg-brass/[0.07]'
                      }`}
                    >
                      <div className="relative w-full aspect-square border border-brass/30 overflow-hidden bg-black/60 mb-2">
                        <SafeImage
                          src={archetype.svgPath}
                          alt={localizedTitle}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        {isCurrent && (
                          <span className="absolute top-1 right-1 font-mono text-[9px] uppercase tracking-wider text-black bg-brass px-1.5 py-0.5 font-bold shadow">
                            {t('activeEngraving')}
                          </span>
                        )}
                      </div>
                      <div className="w-full space-y-0.5">
                        <div className="font-display text-xs sm:text-sm font-semibold uppercase tracking-wider text-brass group-hover:text-brass/90 truncate">
                          {localizedTitle}
                        </div>
                        <p className="font-serif italic text-[10px] sm:text-xs text-muted-foreground/80 line-clamp-2 leading-tight">
                          {localizedDesc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Stopka */}
              <div className="flex justify-end pt-3 border-t border-brass/20">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRetroPortraitPicker(false)}
                  className="font-display font-semibold uppercase tracking-[0.14em] text-brass/80 border-brass/30 hover:border-brass hover:text-brass px-4 py-2 text-xs"
                >
                  {t('close')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // GŁÓWNY RENDER
  // ============================================================================

  // Kolejność: Koncepcja → Cechy → Zawód → Umiejętności → Historia → Wyposażenie
  const stepNames = [
    t('stepNameConcept'),
    t('stepNameStats'),
    t('stepNameOccupation'),
    t('stepNameSkills'),
    t('stepNameHistory'),
    t('stepNameEquipment'),
  ];

  const renderCurrentStep = () => {
    switch (state.step) {
      case 1:
        return renderStepConcept(); // Koncepcja postaci
      case 2:
        return renderStep1(); // Cechy
      case 3:
        return renderStep2(); // Zawód
      case 4:
        return renderStep3(); // Umiejętności
      case 5:
        return renderStep4(); // Historia (po mechanice)
      case 6:
        return renderStep5(); // Wyposażenie
      default:
        return null;
    }
  };

  return (
    <div
      data-testid="character-wizard"
      className="fixed inset-0 bg-black z-50 p-0 flex flex-col w-screen h-screen overflow-hidden"
    >
      <div
        data-testid="character-wizard-modal"
        className="relative bg-gradient-to-br from-[#14110c] to-[#0a0c0f] w-full h-full max-w-none max-h-none overflow-hidden flex flex-col"
      >
        {/* Narożniki déco */}
        <span className="pointer-events-none absolute top-3 left-3 w-7 h-7 border-t-2 border-l-2 border-brass/55" />
        <span className="pointer-events-none absolute top-3 right-3 w-7 h-7 border-t-2 border-r-2 border-brass/55" />
        <span className="pointer-events-none absolute bottom-3 left-3 w-7 h-7 border-b-2 border-l-2 border-brass/55" />
        <span className="pointer-events-none absolute bottom-3 right-3 w-7 h-7 border-b-2 border-r-2 border-brass/55" />

        {/* Header - kompaktowy zintegrowany pasek Deco ze stepperem */}
        <div className="px-6 py-3 flex-shrink-0 border-b border-brass/20 bg-[#120f0c] flex items-center justify-between gap-4">
          {/* Lewa strona: Krok i tytuł */}
          <div className="flex items-center gap-2.5">
            <span className="font-special-elite text-sm uppercase tracking-[0.2em] text-primary font-bold">
              {t('stepOf', { current: state.step, total: TOTAL_STEPS })}
            </span>
            <span className="text-brass/40 font-serif">·</span>
            <h2 className="font-display text-base sm:text-lg font-bold uppercase tracking-[0.08em] text-foreground">
              {stepNames[state.step - 1]}
            </h2>
          </div>

          {/* Środek: Ministepper */}
          <div className="hidden md:flex items-center gap-1.5">
            {stepNames.map((name, idx) => {
              const stepNo = idx + 1;
              const done = stepNo < state.step;
              const active = stepNo === state.step;
              return (
                <div
                  key={idx}
                  title={`${stepNo}. ${name}`}
                  className={`flex items-center justify-center font-display text-xs sm:text-sm transition-all ${
                    active
                      ? 'h-6 px-2.5 border border-primary bg-primary text-[#04110f] font-bold shadow-[0_0_10px_rgba(13,148,136,.4)]'
                      : done
                        ? 'h-6 w-6 border border-brass/40 bg-primary/10 text-primary font-semibold'
                        : 'h-6 w-6 border border-brass/20 text-muted-foreground/60'
                  }`}
                >
                  {done ? '✓' : active ? `${stepNo}. ${name}` : stepNo}
                </div>
              );
            })}
          </div>

          {/* Prawa strona: Przycisk zamknięcia */}
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-brass hover:bg-brass/10 h-8 w-8 p-0 rounded-full border border-brass/30 flex items-center justify-center"
            title={t('close')}
          >
            ✕
          </Button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 flex flex-col">
          {renderCurrentStep()}
        </div>

        {/* Footer - nawigacja */}
        <div className="flex-shrink-0 px-8 py-4 border-t border-brass/[0.22] bg-[#100d09] flex justify-between items-center">
          <Button
            onClick={prevStep}
            disabled={state.step === 1}
            variant="outline"
            size="sm"
            className="font-display font-semibold uppercase tracking-[0.16em] text-muted-foreground bg-transparent border-brass/30 hover:border-brass/60 hover:text-brass px-6 py-3 disabled:opacity-40"
          >
            ‹ {t('back')}
          </Button>

          <div className="font-special-elite text-sm uppercase tracking-[0.1em] text-brass/90 font-semibold">
            {t('stepOf', { current: state.step, total: TOTAL_STEPS })}
          </div>

          {state.step < TOTAL_STEPS ? (
            <Button
              onClick={nextStep}
              disabled={!isStepValid()}
              size="sm"
              className="font-display font-semibold uppercase tracking-[0.16em] text-[#04110f] bg-primary border border-brass/30 hover:brightness-110 shadow-[0_0_16px_rgba(13,148,136,.3)] px-7 py-3"
            >
              {t('next')} ›
            </Button>
          ) : (
            <Button
              onClick={finishCreation}
              disabled={isCreating}
              size="sm"
              className="font-display font-semibold uppercase tracking-[0.16em] text-[#04110f] bg-primary border border-brass/30 hover:brightness-110 shadow-[0_0_16px_rgba(13,148,136,.3)] px-7 py-3"
            >
              {isCreating ? t('creating') : `✓ ${t('finishAndSave')}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
