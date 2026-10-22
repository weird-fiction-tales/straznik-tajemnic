import type { EquipmentCategory, HazardEventData, HazardType, OpposedMagicEventData, OpposedMeleeEventData, SpellCastEventData, TomeStudyEventData } from '../types';
export type { HazardEventData, HazardType, OpposedMagicEventData, OpposedMeleeEventData, SpellCastEventData, TomeStudyEventData };

export type EquipmentEventAction = 'use' | 'remove' | 'add';

export interface EquipmentEvent {
  action: EquipmentEventAction;
  itemName: string;
  /** Exact instance selected by application code, never fuzzy-matched. */
  itemId?: string;
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
  /** Stabilny identyfikator zatwierdzonej poszlaki teczki, dozwolony przez RAG w tej turze. */
  dossierRecordId?: string;
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

/** Final result from the existing dice modal. Dossier access requires all identity fields. */
export interface SkillRollResolution {
  outcome: import('../dice-utils').RollOutcome;
  luckSpent: number;
  skillNames: string[];
  targetNpcId?: string;
  testId?: string;
  resolutionId?: string;
  characterId?: string;
  requiredDifficulty?: import('../dice-utils').RequiredDifficulty;
  passedRequirement?: boolean;
}

export interface SkillTestData {
  /** Proposal only. The local dossier validates this ID before binding the test. */
  dossierConditionId?: string;
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
  /** NPC explicitly selected as the target of a social influence test. */
  targetNpcId?: string;
  /** Wspólna grupa testów z jednej odpowiedzi MG. */
  groupId?: string;
  /** Test należy do aktywnego starcia; forsowanie jest wtedy zablokowane. */
  isCombat?: boolean;
  /** Test łączony (RAW s. 103): operator 'OR' (LUB) lub 'AND' (I) oraz lista umiejętności */
  combined?: {
    operator: 'OR' | 'AND';
    skills: CombinedSkillSubtest[];
  };
}

/** Resolved normal pushed roll; the stake was shown and accepted before reroll. */
export interface PushedRollResolutionContext {
  source: 'chat_skill_test';
  originalTestId: string;
  pushedRollId: string;
  skillName: string;
  initialOutcome: 'critical' | 'extreme' | 'hard' | 'regular' | 'fail' | 'fumble';
  initialTestFailed: true;
  outcome: 'critical' | 'extreme' | 'hard' | 'regular' | 'fail' | 'fumble';
  requiredDifficulty: 'regular' | 'hard' | 'extreme';
  passedRequirement: boolean;
  failureStake: string;
  stakePresented: true;
  playerAcceptedStake: true;
}

/** Initial failed roll awaiting a Keeper-proposed pushed-roll stake. */
export interface PushedRollStakeRequestContext {
  source: 'chat_skill_test';
  testId: string;
  skillName: string;
  initialOutcome: 'critical' | 'extreme' | 'hard' | 'regular' | 'fail' | 'fumble';
  initialTestFailed: true;
  initialRoll: number;
  targetValue: number;
  requiredDifficulty: 'regular' | 'hard' | 'extreme';
}

/** Completed local sanity-recovery procedure; used only to select dossier guidance. */
export interface SanityRecoveryResolutionContext {
  source: 'local_sanity_recovery';
  resolutionId: string;
  characterId: string;
  procedure: 'anchor' | 'self_help' | 'hospitalization';
  outcome: 'critical' | 'extreme' | 'hard' | 'regular' | 'fail' | 'fumble' | 'success' | 'failure';
  sanityDelta: number;
}

/** Completed medical-care expense from the local recovery resolver. */
export interface MedicalExpenseResolutionContext {
  source: 'local_medical_care';
  resolutionId: string;
  characterId: string;
  facility: 'public_hospital' | 'private_clinic' | 'home' | 'poor_conditions';
  period: '1_day' | '3_days' | '1_week' | '2_weeks' | '1_month';
  totalCost: number;
  cashBefore: number | null;
  cashAfter: number | null;
}

/** Saved investigator setup/change; carries field names only, never character values. */
export interface InvestigatorChangeResolutionContext {
  source: 'local_investigator_change';
  resolutionId: string;
  characterId: string;
  operation: 'created' | 'updated';
  changedFields: Array<'characteristics' | 'age' | 'occupation' | 'skills' | 'wealth' | 'alternate_creation' | 'weapons'>;
}

/** Local firearm resolver output used to select adventure-specific weapon guidance. */
export interface FirearmResolutionContext {
  source: 'local_firearm_resolution';
  resolutionId: string;
  attackerId: string;
  targetName?: string;
  weaponName: string;
  roll: number;
  distanceMeters?: number;
  distanceCategory?: 'point_blank' | 'base_range' | 'long_range' | 'extreme_range' | 'out_of_range';
  requiredDifficulty?: 'regular' | 'hard' | 'extreme' | 'critical' | 'impossible';
  malfunctionThreshold: number;
  isMalfunction: boolean;
  malfunctionEffect?: 'dud_round' | 'jam';
  fireMode: 'single' | 'burst' | 'fixed_burst' | 'continuous';
  bulletsFired: number;
  bulletsHit: number;
  penaltyDice?: number;
  difficultyIncrease?: number;
  targetSwitched?: boolean;
  targetSwitchAmmoCost?: number;
}

/** Completed firearm repair; sent to the dossier after its combat-round delay. */
export interface JamClearingResolutionContext {
  source: 'local_jam_clearing';
  resolutionId: string;
  actorId: string;
  weaponName: string;
  weaponCategory: 'handgun' | 'rifle' | 'shotgun' | 'smg' | 'machine_gun';
  malfunctionEffect: 'dud_round' | 'jam';
  roundsRequired: number;
  skillName?: string;
  skillValue?: number;
  skillRoll?: number;
  skillOutcome?: 'critical' | 'extreme' | 'hard' | 'regular' | 'fail' | 'fumble';
  cleared: boolean;
}

export interface VehicleCollisionPassengerResolution {
  characterId: string;
  damage: number;
  killedInstantly: boolean;
}

/** Local vehicle-collision result used to select adventure-specific guidance. */
export interface VehicleCollisionResolutionContext {
  source: 'local_vehicle_collision';
  resolutionId: string;
  vehicleId: string;
  severity: 'minor' | 'moderate' | 'major' | 'catastrophic' | 'road_kill';
  initialBuild: number;
  maxBuild: number;
  buildDamage: number;
  remainingBuild: number;
  passengers: VehicleCollisionPassengerResolution[];
  destroyedInSingleEvent: boolean;
}

/** A locally generated reroll from a narrative dice card, sent to chat and dossier retrieval. */
export interface DiceRollResolutionContext {
  source: 'local_dice_card_reroll' | 'local_chat_command';
  originalEventId: string;
  resolutionId: string;
  formula: string;
  diceValues: number[];
  modifier: number;
  total: number;
  characterName?: string;
  label?: string;
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
