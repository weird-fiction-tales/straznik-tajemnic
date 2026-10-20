import type { EquipmentCategory, HazardEventData, HazardType, OpposedMagicEventData, OpposedMeleeEventData, SpellCastEventData, TomeStudyEventData } from '../types';
export type { HazardEventData, HazardType, OpposedMagicEventData, OpposedMeleeEventData, SpellCastEventData, TomeStudyEventData };

export type EquipmentEventAction = 'use' | 'remove' | 'add';

export interface EquipmentEvent {
  action: EquipmentEventAction;
  itemName: string;
  quantity?: number;
  category?: EquipmentCategory;
  description?: string;
  characterName?: string;
  rawText?: string;
}

export interface ParsedEvent {
  type:
    | 'npc'
    | 'location'
    | 'item'
    | 'combat'
    | 'sanity'
    | 'discovery'
    | 'death';
  title: string;
  description: string;
  timestamp: string;
}

export interface CombatState {
  isActive: boolean;
  trigger?: 'start' | 'damage_player' | 'damage_npc' | 'end';
  damage?: number;
  target?: string;
  description?: string;
}

export interface MeleeAttackReference {
  attackerNpcId: string;
  targetCharacterName: string;
  attackOptionId: string;
  intent: string;
}

export interface DialogueLine {
  speaker: string; // nazwa NPC lub "narrator"
  text: string;
  emotion?: 'neutral' | 'fear' | 'anger' | 'sadness' | 'joy' | 'mysterious';
  gender?: 'male' | 'female' | 'unknown';
  age?: 'young' | 'middle' | 'old' | 'unknown';
  context?: string; // kontekst przed dialogiem
  contextAfter?: string; // kontekst po dialogu
  audioTags?: string; // audio tags dla ElevenLabs v3 ([whispers], [angrily], etc.)
}

export type ImageType = 'portrait' | 'scene' | 'location' | 'item' | 'monster' | 'vision';

export interface ImageRequest {
  prompt: string;
  style?: 'horror' | 'vintage' | 'realistic' | 'artistic' | 'portrait' | 'item' | 'location';
  priority?: 'high' | 'normal';
  isMythos?: boolean;
  type?: ImageType;
  aspectRatio?: '16:9' | '3:4' | '1:1';
  portraitName?: string;
  itemName?: string;
  locationName?: string;
}

export interface SFXRequest {
  presetId?: string; // ID presetu z sfx-presets.ts
  category:
    | 'horror'
    | 'city_1920s'
    | 'nature'
    | 'combat'
    | 'supernatural'
    | 'ambient';
  prompt?: string; // Opis do dynamicznego generowania
  priority: 'high' | 'normal';
}

export interface JournalTagEntry {
  type:
    | 'case'
    | 'combat'
    | 'discovery'
    | 'npc'
    | 'sanity'
    | 'clue'
    | 'location'
    | 'ritual'
    | 'death'
    | 'bookmark'
    | 'note'
    | 'quest'
    | 'journal'
    | 'item';
  title: string;
  content: string;
  inGameDate?: string;
  /** Duet/Hot Seat: imię z prefiksu [DZIENNIK:@Imię:...] - właściciel wpisu (do mapowania na postać). */
  who?: string;
  /** Opcjonalny świadek / źródłowy NPC poszlaki */
  sourceNpc?: string;
  /** Opcjonalna lokacja odnalezienia poszlaki */
  foundLocation?: string;
}

// === SYSTEM ROZWOJU COC 7E ===

export interface SkillTestModifier {
  type: 'bonus' | 'penalty';
  reason: string;
  count: number;
}

export interface CombinedSkillSubtest {
  skillName: string;
  skillValue: number;
}

export interface SkillTestData {
  id: string;
  skillName: string;
  skillValue: number;
  difficulty: 'zwykly' | 'trudny' | 'ekstremalny';
  modifiers: SkillTestModifier[];
  justification: string;
  /** Stawka testu (konsekwencje sukcesu/porażki) wyodrębniona z tagu [STAWKA: ...] (Issue #737) */
  stake?: string;
  /** Adresat testu w duecie, zapisany w tagu jako `@Imię:`. */
  characterName?: string;
  /** Rozwiązane po stronie klienta ID postaci. */
  characterId?: string;
  /** Wspólna grupa testów z jednej odpowiedzi MG. */
  groupId?: string;
  /** Test łączony (RAW s. 103): operator 'OR' (LUB) lub 'AND' (I) oraz lista umiejętności */
  combined?: {
    operator: 'OR' | 'AND';
    skills: CombinedSkillSubtest[];
  };
}

export interface TimeUpdate {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface SkillTestResult {
  skillName: string; // Nazwa umiejętności
  characterName?: string; // Opcjonalna nazwa badacza w trybie Duet / Hot Seat (@Imię)
  result: 'critical' | 'extreme' | 'hard' | 'regular' | 'failure' | 'fumble';
  rollValue: number; // Wynik rzutu D100
  threshold: number; // Próg sukcesu
  usedLuck: boolean; // Czy użyto Luck (Szczęścia)
  luckSpent?: number; // Ile Luck wydano
  usedBonus?: boolean; // Czy rzut wykonano z kością premiową (s. 105 RAW wyklucza z rozwoju)
  shouldMark: boolean; // Czy oznaczyć do rozwoju
  reason?: string; // Powód (nie)oznaczenia
}

/** Pozycja tagu [NPC: Imię] w tekście odpowiedzi - do cross-reference z dialogami */
export interface NPCPosition {
  name: string;
  charIndex: number;
}

export interface ParsedResponse {
  events: ParsedEvent[];
  combat: CombatState | null;
  dialogues: DialogueLine[];
  illustrations: ImageRequest[];
  sfx: SFXRequest[];
  journalEntries: JournalTagEntry[];
  skillTests: SkillTestData[];
  skillResults: SkillTestResult[];
  hazardEvents?: HazardEventData[];
  spellCastEvents?: SpellCastEventData[];
  opposedMagicEvents?: OpposedMagicEventData[];
  opposedMeleeEvents?: OpposedMeleeEventData[];
  firearmsAttackEvents?: import('@/lib/types').FirearmsAttackEventData[];
  gameOverEvents?: import('@/lib/types').GameOverEventData[];
  refereeVetoEvents?: import('@/lib/types').RefereeVetoEventData[];
  tomeStudyEvents?: TomeStudyEventData[];
  meleeAttacks: MeleeAttackReference[];
  equipmentEvents: EquipmentEvent[];
  timeUpdate: TimeUpdate | null;
  gmMetadata?: { thoughts?: string; mood?: string; narrativeGoal?: string };
  locationGuardianEvent?: import('./journal-parser').ExtractedLocationGuardian | null;
  rawText: string;
}
