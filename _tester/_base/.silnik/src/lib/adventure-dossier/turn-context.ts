import { authoredPrabutyMediaId } from './authored-media';
import { getDossierRagBinding, retrieveDossierRag } from './rag-runtime';
import type { DossierInventoryProjection } from './inventory-state';
import type { DossierWorldStateProjection } from './world-object-state';
import type { DossierActorObservation } from './actor-binding';
import {
  getDossierMechanicIdForAuditArea,
  hasResolvedClueFailForwardTrigger,
  isInvestigatorCharacteristicName,
  isSocialInfluenceSkillName,
  type DossierMechanicId,
} from './mechanic-registry';
import type { DossierRetrievalHit } from './rag-runtime';
import type { Character } from '@/lib/types';
import type {
  PushedRollResolutionContext,
  PushedRollStakeRequestContext,
  SanityRecoveryResolutionContext,
  MedicalExpenseResolutionContext,
  InvestigatorChangeResolutionContext,
  FirearmResolutionContext,
  JamClearingResolutionContext,
  VehicleCollisionResolutionContext,
  DiceRollResolutionContext,
} from '@/lib/parsers/types';

export function isPushedRollResolutionContext(
  value: unknown,
): value is PushedRollResolutionContext {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PushedRollResolutionContext>;
  const validOutcomes = ['critical', 'extreme', 'hard', 'regular', 'fail', 'fumble'];
  const isValidId = (id: unknown) =>
    typeof id === 'string' && id.trim().length > 0 && id.length <= 120;
  return candidate.source === 'chat_skill_test' &&
    isValidId(candidate.originalTestId) &&
    isValidId(candidate.pushedRollId) &&
    candidate.originalTestId !== candidate.pushedRollId &&
    typeof candidate.skillName === 'string' &&
    candidate.skillName.trim().length > 0 &&
    candidate.skillName.length <= 120 &&
    typeof candidate.failureStake === 'string' && candidate.failureStake.trim().length > 0 &&
    candidate.failureStake.length <= 1000 &&
    candidate.initialTestFailed === true &&
    validOutcomes.includes(String(candidate.initialOutcome)) &&
    validOutcomes.includes(String(candidate.outcome)) &&
    ['regular', 'hard', 'extreme'].includes(String(candidate.requiredDifficulty)) &&
    typeof candidate.passedRequirement === 'boolean' &&
    candidate.stakePresented === true &&
    candidate.playerAcceptedStake === true;
}

/** Accepts only a complete, bounded request from a failed ordinary skill test. */
export function isPushedRollStakeRequestContext(
  value: unknown,
): value is PushedRollStakeRequestContext {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PushedRollStakeRequestContext>;
  const validOutcomes = ['critical', 'extreme', 'hard', 'regular', 'fail', 'fumble'];
  return candidate.source === 'chat_skill_test' &&
    typeof candidate.testId === 'string' &&
    candidate.testId.trim().length > 0 &&
    candidate.testId.length <= 120 &&
    typeof candidate.skillName === 'string' &&
    candidate.skillName.trim().length > 0 &&
    candidate.skillName.length <= 120 &&
    validOutcomes.includes(String(candidate.initialOutcome)) &&
    candidate.initialTestFailed === true &&
    Number.isInteger(candidate.initialRoll) &&
    (candidate.initialRoll as number) >= 1 &&
    (candidate.initialRoll as number) <= 100 &&
    Number.isInteger(candidate.targetValue) &&
    (candidate.targetValue as number) >= 0 &&
    (candidate.targetValue as number) <= 100 &&
    ['regular', 'hard', 'extreme'].includes(String(candidate.requiredDifficulty));
}

/** Accepts only a bounded event emitted after a local recovery resolver returns. */
export function isSanityRecoveryResolutionContext(
  value: unknown,
): value is SanityRecoveryResolutionContext {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SanityRecoveryResolutionContext>;
  return candidate.source === 'local_sanity_recovery' &&
    typeof candidate.resolutionId === 'string' && candidate.resolutionId.trim().length > 0 && candidate.resolutionId.length <= 120 &&
    typeof candidate.characterId === 'string' && candidate.characterId.trim().length > 0 && candidate.characterId.length <= 120 &&
    ['anchor', 'self_help', 'hospitalization'].includes(String(candidate.procedure)) &&
    ['critical', 'extreme', 'hard', 'regular', 'fail', 'fumble', 'success', 'failure'].includes(String(candidate.outcome)) &&
    Number.isInteger(candidate.sanityDelta) && Math.abs(candidate.sanityDelta as number) <= 99;
}

/** Accepts only a bounded expense produced by the local medical-care resolver. */
export function isMedicalExpenseResolutionContext(
  value: unknown,
): value is MedicalExpenseResolutionContext {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MedicalExpenseResolutionContext>;
  const validId = (id: unknown) =>
    typeof id === 'string' && id.trim().length > 0 && id.length <= 120;
  const validMoney = (amount: unknown) =>
    amount === null || (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000_000);
  return candidate.source === 'local_medical_care' &&
    validId(candidate.resolutionId) &&
    validId(candidate.characterId) &&
    ['public_hospital', 'private_clinic', 'home', 'poor_conditions'].includes(String(candidate.facility)) &&
    ['1_day', '3_days', '1_week', '2_weeks', '1_month'].includes(String(candidate.period)) &&
    typeof candidate.totalCost === 'number' && Number.isFinite(candidate.totalCost) &&
    candidate.totalCost > 0 && candidate.totalCost <= 1_000_000_000 &&
    validMoney(candidate.cashBefore) && validMoney(candidate.cashAfter) &&
    !(typeof candidate.cashBefore === 'number' && typeof candidate.cashAfter === 'number' && candidate.cashAfter > candidate.cashBefore);
}

export function isInvestigatorChangeResolutionContext(
  value: unknown,
): value is InvestigatorChangeResolutionContext {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<InvestigatorChangeResolutionContext>;
  const fields = ['characteristics', 'age', 'occupation', 'skills', 'wealth', 'alternate_creation', 'weapons'];
  return candidate.source === 'local_investigator_change' &&
    typeof candidate.resolutionId === 'string' && candidate.resolutionId.trim().length > 0 && candidate.resolutionId.length <= 120 &&
    typeof candidate.characterId === 'string' && candidate.characterId.trim().length > 0 && candidate.characterId.length <= 120 &&
    ['created', 'updated'].includes(String(candidate.operation)) &&
    Array.isArray(candidate.changedFields) && candidate.changedFields.length > 0 && candidate.changedFields.length <= fields.length &&
    candidate.changedFields.every((field) => fields.includes(String(field)));
}

export function isFirearmResolutionContext(value: unknown): value is FirearmResolutionContext {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<FirearmResolutionContext>;
  const validId = (id: unknown) => typeof id === 'string' && id.trim().length > 0 && id.length <= 120;
  return event.source === 'local_firearm_resolution' && validId(event.resolutionId) &&
    validId(event.attackerId) && typeof event.weaponName === 'string' &&
    event.weaponName.trim().length > 0 && event.weaponName.length <= 120 &&
    (event.targetName === undefined || (typeof event.targetName === 'string' && event.targetName.trim().length > 0 && event.targetName.length <= 120)) &&
    (event.distanceMeters === undefined || (Number.isFinite(event.distanceMeters) && event.distanceMeters > 0 && event.distanceMeters <= 100000)) &&
    (event.distanceCategory === undefined || ['point_blank', 'base_range', 'long_range', 'extreme_range', 'out_of_range'].includes(event.distanceCategory)) &&
    (event.requiredDifficulty === undefined || ['regular', 'hard', 'extreme', 'critical', 'impossible'].includes(event.requiredDifficulty)) &&
    Number.isInteger(event.roll) && (event.roll as number) >= 1 && (event.roll as number) <= 100 &&
    Number.isInteger(event.malfunctionThreshold) && (event.malfunctionThreshold as number) >= 1 &&
    (event.malfunctionThreshold as number) <= 100 && typeof event.isMalfunction === 'boolean' &&
    ['single', 'burst', 'fixed_burst', 'continuous'].includes(String(event.fireMode)) &&
    Number.isInteger(event.bulletsFired) && (event.bulletsFired as number) >= 1 && (event.bulletsFired as number) <= 100 &&
    Number.isInteger(event.bulletsHit) && (event.bulletsHit as number) >= 0 && (event.bulletsHit as number) <= (event.bulletsFired as number) &&
    (event.penaltyDice === undefined || (Number.isInteger(event.penaltyDice) && event.penaltyDice >= 0 && event.penaltyDice <= 4)) &&
    (event.difficultyIncrease === undefined || (Number.isInteger(event.difficultyIncrease) && event.difficultyIncrease >= 0 && event.difficultyIncrease <= 4)) &&
    (event.targetSwitched === undefined || typeof event.targetSwitched === 'boolean') &&
    (event.targetSwitchAmmoCost === undefined || (Number.isInteger(event.targetSwitchAmmoCost) && event.targetSwitchAmmoCost >= 0 && event.targetSwitchAmmoCost <= 100)) &&
    (event.malfunctionEffect === undefined || ['dud_round', 'jam'].includes(event.malfunctionEffect));
}

export function isJamClearingResolutionContext(value: unknown): value is JamClearingResolutionContext {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<JamClearingResolutionContext>;
  const validId = (id: unknown) => typeof id === 'string' && id.trim().length > 0 && id.length <= 120;
  const validCommon = event.source === 'local_jam_clearing' && validId(event.resolutionId) && validId(event.actorId) &&
    typeof event.weaponName === 'string' && event.weaponName.trim().length > 0 && event.weaponName.length <= 120 &&
    ['handgun', 'rifle', 'shotgun', 'smg', 'machine_gun'].includes(String(event.weaponCategory)) &&
    Number.isInteger(event.roundsRequired) && (event.roundsRequired as number) >= 1 && (event.roundsRequired as number) <= 6 &&
    typeof event.cleared === 'boolean';
  if (!validCommon) return false;
  if (event.malfunctionEffect === 'dud_round') {
    return event.roundsRequired === 1 && event.cleared === true && event.skillName === undefined &&
      event.skillValue === undefined && event.skillRoll === undefined && event.skillOutcome === undefined;
  }
  return event.malfunctionEffect === 'jam' && typeof event.skillName === 'string' &&
    event.skillName.trim().length > 0 && event.skillName.length <= 120 &&
    Number.isInteger(event.skillValue) && (event.skillValue as number) >= 0 && (event.skillValue as number) <= 100 &&
    Number.isInteger(event.skillRoll) && (event.skillRoll as number) >= 1 && (event.skillRoll as number) <= 100 &&
    ['critical', 'extreme', 'hard', 'regular', 'fail', 'fumble'].includes(String(event.skillOutcome)) &&
    event.cleared === ['critical', 'extreme', 'hard', 'regular'].includes(String(event.skillOutcome));
}

/** Accepts only bounded fields emitted by the local vehicle-collision resolver. */
export function isVehicleCollisionResolutionContext(
  value: unknown,
): value is VehicleCollisionResolutionContext {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<VehicleCollisionResolutionContext>;
  const validId = (id: unknown) => typeof id === 'string' && id.trim().length > 0 && id.length <= 120;
  const boundedInteger = (number: unknown) => Number.isInteger(number) && (number as number) >= 0 && (number as number) <= 1000;
  return event.source === 'local_vehicle_collision' && validId(event.resolutionId) &&
    validId(event.vehicleId) &&
    ['minor', 'moderate', 'major', 'catastrophic', 'road_kill'].includes(String(event.severity)) &&
    boundedInteger(event.initialBuild) && boundedInteger(event.maxBuild) &&
    boundedInteger(event.buildDamage) &&
    boundedInteger(event.remainingBuild) &&
    Array.isArray(event.passengers) && event.passengers.length <= 16 &&
    event.passengers.every((passenger) => passenger && validId(passenger.characterId) &&
      boundedInteger(passenger.damage) && typeof passenger.killedInstantly === 'boolean') &&
    new Set(event.passengers.map((passenger) => passenger.characterId)).size === event.passengers.length &&
    typeof event.destroyedInSingleEvent === 'boolean' &&
    event.remainingBuild === Math.max(0, (event.initialBuild as number) - (event.buildDamage as number)) &&
    (event.initialBuild as number) <= (event.maxBuild as number) &&
    event.destroyedInSingleEvent === ((event.buildDamage as number) >= (event.maxBuild as number)) &&
    event.passengers.every((passenger) =>
      !passenger.killedInstantly || (event.remainingBuild === 0 && event.destroyedInSingleEvent),
    );
}

export function isDiceRollResolutionContext(value: unknown): value is DiceRollResolutionContext {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<DiceRollResolutionContext>;
  const validId = (id: unknown) => typeof id === 'string' && id.trim().length > 0 && id.length <= 120;
  return ['local_dice_card_reroll', 'local_chat_command'].includes(String(event.source)) && validId(event.originalEventId) &&
    validId(event.resolutionId) && typeof event.formula === 'string' &&
    event.formula.trim().length > 0 && event.formula.length <= 80 &&
    (event.characterName === undefined || (typeof event.characterName === 'string' && event.characterName.length <= 120)) &&
    (event.label === undefined || (typeof event.label === 'string' && event.label.length <= 120)) &&
    Array.isArray(event.diceValues) && event.diceValues.length > 0 && event.diceValues.length <= 40 &&
    event.diceValues.every((die) => Number.isInteger(die) && die >= 0 && die <= 100) &&
    Number.isInteger(event.modifier) && Math.abs(event.modifier as number) <= 1000 &&
    Number.isInteger(event.total) && Math.abs(event.total as number) <= 10000;
}

export interface DossierTurnContextInput {
  activationId: string;
  adventureId: string;
  query: string;
  activeSceneIds: string[];
  presentEntityIds: string[];
  targetEntityIds?: string[];
  acquiredRecordIds?: string[];
  mechanicIds?: string[];
  requestedMechanicIds?: string[];
  inventory?: DossierInventoryProjection;
  worldObjectState?: DossierWorldStateProjection;
  actorObservations?: DossierActorObservation[];
}

/** Returns only player-known clue IDs for reveal gates; keeper truth never unlocks content. */
export function getAcquiredDossierRecordIds(
  clues: Array<{
    id: string;
    dossierRecordId?: string;
    discoveryStatus?: 'unrevealed' | 'discovered' | 'verified';
    epistemicLayer?: 'keeper_truth' | 'player_clue';
  }>,
): string[] {
  return cleanIds(
    clues
      .filter((clue) =>
        (clue.discoveryStatus === 'discovered' || clue.discoveryStatus === 'verified') &&
        clue.epistemicLayer !== 'keeper_truth',
      )
      .map((clue) => clue.dossierRecordId?.trim() || clue.id),
  );
}

/**
 * Collects shared dossier knowledge for the active investigator and current
 * Hot Seat participants, without unlocking records from unrelated roster entries.
 */
export function getPartyAcquiredDossierRecordIds(input: {
  characters: Array<Pick<Character, 'id' | 'investigatorDossier'>>;
  activeCharacterId?: string;
  participantIds?: string[];
}): string[] {
  const eligibleCharacterIds = new Set(
    [input.activeCharacterId, ...(input.participantIds ?? [])]
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
  );
  if (eligibleCharacterIds.size === 0) return [];

  return cleanIds(
    input.characters
      .filter((character) => eligibleCharacterIds.has(character.id))
      .flatMap((character) =>
        getAcquiredDossierRecordIds(character.investigatorDossier?.clues ?? []),
      ),
  );
}

/** Maps validated runtime state to the numbered CoC audit areas used in dossier tags. */
export function getActiveDossierMechanicIds(input: {
  chaseActive?: boolean;
  submittedRollText?: string;
  submittedSpellResultText?: string;
  submittedHazardResultText?: string;
  submittedTomeResultText?: string;
  submittedOpposedMagicResultText?: string;
  submittedFirearmResultText?: string;
  /** Scene Director's resolved cadence gear; undefined for a continuation turn. */
  narrativeCadence?: 0 | 1 | 2 | 3 | 4;
  developmentResolved?: boolean;
  luckRecovered?: boolean;
  ideaRollResolved?: boolean;
  ideaRollOutcome?: 'critical' | 'extreme' | 'hard' | 'regular' | 'fail' | 'fumble';
  skillRolls?: Array<{
    outcome?: 'critical' | 'extreme' | 'hard' | 'regular' | 'fail' | 'fumble';
    luckSpent?: number;
    skillNames?: string[];
    targetNpcId?: string;
  }>;
  /** Stable IDs of NPCs confirmed in the active location for this turn. */
  presentEntityIds?: string[];
  /** Backward-compatible unambiguous target signal for legacy clients. */
  presentNpcCount?: number;
  activeBoutOfMadness?: boolean;
  /** True only when the local event arbiter requires a rule or blocks an impossible action. */
  eventAdjudicationRequired?: boolean;
  pushedRoll?: PushedRollResolutionContext;
  sanityRecovery?: SanityRecoveryResolutionContext[];
  medicalExpenses?: MedicalExpenseResolutionContext[];
  investigatorChanges?: InvestigatorChangeResolutionContext[];
  firearmResolutions?: FirearmResolutionContext[];
  jamClearingResolutions?: JamClearingResolutionContext[];
  vehicleCollisionResolutions?: VehicleCollisionResolutionContext[];
  diceRollResolutions?: DiceRollResolutionContext[];
  eligibleCharacterIds?: string[];
  combatResolutions?: Array<{
    attackerId?: string;
    defenderId?: string;
    maneuverType?: string;
    damageDealtTo?: string;
  } | null>;
  monsterEntityIds?: string[];
}): DossierMechanicId[] {
  const ids = new Set<DossierMechanicId>();
  const addAuditArea = (area: number) => {
    const mechanicId = getDossierMechanicIdForAuditArea(area);
    if (mechanicId) ids.add(mechanicId);
  };
  const pushedRoll = input.pushedRoll;
  if (input.eventAdjudicationRequired === true) addAuditArea(28);
  if (isPushedRollResolutionContext(pushedRoll)) {
    addAuditArea(15);
    if (!pushedRoll.passedRequirement) addAuditArea(16);
  }
  if ((input.sanityRecovery ?? []).some((event) =>
    isSanityRecoveryResolutionContext(event) &&
    (input.eligibleCharacterIds ?? []).includes(event.characterId),
  )) {
    addAuditArea(45);
  }
  if ((input.medicalExpenses ?? []).some((event) =>
    isMedicalExpenseResolutionContext(event) &&
    (input.eligibleCharacterIds ?? []).includes(event.characterId),
  )) {
    addAuditArea(27);
  }
  for (const event of input.investigatorChanges ?? []) {
    if (!isInvestigatorChangeResolutionContext(event) || !(input.eligibleCharacterIds ?? []).includes(event.characterId)) continue;
    if (event.operation === 'created') addAuditArea(4);
    if (event.changedFields.includes('alternate_creation')) addAuditArea(8);
    if (event.changedFields.includes('characteristics')) addAuditArea(1);
    if (event.changedFields.includes('age')) addAuditArea(5);
    if (event.changedFields.includes('occupation')) addAuditArea(6);
    if (event.changedFields.includes('wealth')) addAuditArea(7);
    if (event.changedFields.includes('weapons')) addAuditArea(57);
    if (event.changedFields.includes('skills')) {
      addAuditArea(10);
      addAuditArea(11);
      addAuditArea(12);
    }
  }
  const combatResolutions = (input.combatResolutions ?? []).filter(
    (resolution): resolution is NonNullable<typeof resolution> =>
      Boolean(resolution) && typeof resolution === 'object',
  );
  if (input.chaseActive) {
    addAuditArea(39);
    addAuditArea(40);
    addAuditArea(41);
    addAuditArea(52);
  }
  // Pacing guidance is relevant whenever the Scene Director has classified a
  // new narrative turn. A continuation has no cadence and must not reactivate it.
  if (input.narrativeCadence !== undefined) addAuditArea(52);
  if (input.developmentResolved) {
    addAuditArea(26);
    if (input.luckRecovered) addAuditArea(19);
  }
  if (input.activeBoutOfMadness) addAuditArea(44);
  const firearmResolutions = (input.firearmResolutions ?? []).filter(isFirearmResolutionContext);
  if (firearmResolutions.length) addAuditArea(34);
  if (firearmResolutions.some((event) => event.fireMode === 'burst' || event.fireMode === 'fixed_burst' || event.fireMode === 'continuous')) addAuditArea(35);
  if (firearmResolutions.some((event) => event.isMalfunction)) addAuditArea(36);
  if ((input.jamClearingResolutions ?? []).some(isJamClearingResolutionContext)) addAuditArea(36);
  if ((input.vehicleCollisionResolutions ?? []).some(isVehicleCollisionResolutionContext)) {
    addAuditArea(42);
  }
  if ((input.diceRollResolutions ?? []).some(isDiceRollResolutionContext)) addAuditArea(50);
  if (input.ideaRollResolved) {
    // The local Idea Roll resolver sends a typed result with the quoted player question.
    addAuditArea(13);
    addAuditArea(14);
    addAuditArea(20);
    // This is the subset of dice adjudication performed by the local Idea Roll resolver.
    addAuditArea(50);
    // The local Idea Roll rules explicitly fail forward on a resolved failure:
    // load adventure-specific clue/complication guidance, without claiming a
    // clue was actually acquired from generated prose.
    if (hasResolvedClueFailForwardTrigger({
      ideaRollResolved: input.ideaRollResolved,
      ideaRollOutcome: input.ideaRollOutcome,
    })) {
      addAuditArea(51);
    }
    if (input.ideaRollOutcome === 'critical' || input.ideaRollOutcome === 'fumble') {
      addAuditArea(18);
    }
  }
  const skillRolls = (input.skillRolls ?? []).filter(
    (roll) => roll && typeof roll === 'object',
  );
  if (skillRolls.length > 0) {
    addAuditArea(13);
    addAuditArea(14);
    // Covers resolved in-session skill rolls only; manual arbitration and
    // independent dice tools still need their own typed event path.
    addAuditArea(50);
    if (skillRolls.some((roll) =>
      (roll.skillNames ?? []).some(isInvestigatorCharacteristicName),
    )) {
      // The local test result names the characteristic; do not infer it from narration.
      addAuditArea(1);
    }
    if (skillRolls.some((roll) => roll.outcome === 'critical' || roll.outcome === 'fumble')) {
      addAuditArea(18);
    }
    if (skillRolls.some((roll) => Number.isFinite(roll.luckSpent) && (roll.luckSpent ?? 0) > 0)) {
      addAuditArea(19);
    }
    if (skillRolls.some((roll) =>
      (roll.skillNames ?? []).some(isSocialInfluenceSkillName),
    )) {
      addAuditArea(25);
      const presentNpcIds = new Set(input.presentEntityIds ?? []);
      if (skillRolls.some((roll) =>
        typeof roll.targetNpcId === 'string' && presentNpcIds.has(roll.targetNpcId),
      ) || input.presentNpcCount === 1) addAuditArea(49);
    }
    if (hasResolvedClueFailForwardTrigger({ skillRolls })) {
      // Only a resolved failure on a named investigative skill selects the
      // dossier's fail-forward guidance; it does not mark any clue acquired.
      addAuditArea(51);
    }
  }
  if (combatResolutions.length) {
    addAuditArea(29);
    addAuditArea(30);
    addAuditArea(32);
    addAuditArea(33);
    if (combatResolutions.some((resolution) => Boolean(resolution.maneuverType))) {
      addAuditArea(31);
    }
    if (combatResolutions.some((resolution) => resolution.damageDealtTo !== 'none')) {
      // Build and damage-bonus guidance is relevant only after the resolver
      // confirms that melee damage was dealt; prose alone cannot activate it.
      addAuditArea(2);
      addAuditArea(37);
    }
    const monsterEntityIds = new Set(cleanIds(input.monsterEntityIds ?? []));
    if (combatResolutions.some((resolution) =>
      monsterEntityIds.has(resolution.attackerId ?? '') ||
      monsterEntityIds.has(resolution.defenderId ?? ''),
    )) {
      // The combat resolver supplies stable actor IDs; NPC type comes from the
      // active scene snapshot, never from a generated name or narrative text.
      addAuditArea(55);
    }
  }
  const submittedRoll = input.submittedRollText?.match(
    /\[🎲 Test:\s*([^(]+)\(\d+%\)([^\]]*)\]\s*[\r\n]+Wynik:\s*\d+\s*→/i,
  );
  if (submittedRoll) {
    // This UI-formatted result selects reference context only; it never resolves or changes mechanics.
    addAuditArea(13);
    addAuditArea(14);
    if (/poczytaln|sanity|\bsan\b/i.test(submittedRoll[1])) addAuditArea(43);
    if (/kość bonusowa|kość karna|bonus die|penalty die/i.test(submittedRoll[2])) {
      addAuditArea(23);
    }
    if (/Test\s+(?:Trudny|Ekstremalny|Hard|Extreme)\s*:/i.test(input.submittedRollText ?? '')) {
      addAuditArea(9);
    }
  }
  const submittedSkillResultTags = [...(input.submittedRollText ?? '').matchAll(
    /\[WYNIK:\s*([^\]]+)\]/gi,
  )].map((match) => match[1]);
  if (submittedSkillResultTags.length > 0) {
    // These tags carry resolved outcomes from the local combined/opposed roll flows.
    addAuditArea(13);
    addAuditArea(14);
    if (/\[🎲\s*Test łączony\b/i.test(input.submittedRollText ?? '')) addAuditArea(24);
    if (submittedSkillResultTags.some((tag) => /\bLUCK\b/i.test(tag))) addAuditArea(19);
    if (submittedSkillResultTags.some((tag) => /\b(?:BONUS|kość bonusowa|bonus die)\b/i.test(tag))) {
      addAuditArea(23);
    }
    if (submittedSkillResultTags.some((tag) => /\b(?:FUMBLE|PECH|KRYTYK|CRITICAL)\b/i.test(tag))) {
      addAuditArea(18);
    }
    if (submittedSkillResultTags.some((tag) => /Pomysłowość|\bIdea Roll\b/i.test(tag))) addAuditArea(20);
    if (submittedSkillResultTags.some((tag) => /\b(?:Wykształcenie|EDU|Knowledge Roll)\b/i.test(tag))) {
      addAuditArea(21);
    }
  }
  const submittedGroupTestCount = [...(input.submittedRollText ?? '').matchAll(/^\[DICE_ROLL\]/gim)].length;
  if (
    /^Wyniki testów obojga badaczy:/im.test(input.submittedRollText ?? '') &&
    submittedGroupTestCount >= 2
  ) {
    // Hot Seat sends the completed group as one message after all local test cards resolve.
    addAuditArea(13);
    addAuditArea(14);
    addAuditArea(17);
  }
  const submittedSpellResult = input.submittedSpellResultText?.match(
    /\[(?:WYNIK_CZARU|SPELL_RESULT):\s*id=[^|\]]+\|\s*spell=[^|\]]+([^\]]*)\]/i,
  );
  if (submittedSpellResult) {
    // The local spell card emits this result tag after the deterministic resolver completes.
    addAuditArea(3);
    addAuditArea(47);
    if (/\bforsowany=true\b/i.test(submittedSpellResult[1])) addAuditArea(15);
    if (/\bstarcie=/i.test(submittedSpellResult[1])) addAuditArea(54);
    if (/\bKATASTROFA\b|\bCATASTROPHE\b/i.test(submittedSpellResult[1])) addAuditArea(48);
  }
  const submittedHazardResult = input.submittedHazardResultText?.match(
    /\[(?:WYNIK_ZAGROŻENIA|WYNIK_ZAGROZENIA|HAZARD_RESULT):\s*id=[^|\]]+([^\]]*)\]/i,
  );
  if (submittedHazardResult) {
    // The local hazard card emits this tag only after its deterministic resolver completes.
    addAuditArea(38);
    const resultDetails = submittedHazardResult[1];
    const damage = resultDetails.match(/(?:Obrażenia|Damage):\s*-(\d+)\s*HP/i);
    if (damage && Number(damage[1]) > 0) addAuditArea(37);
    if (/(?:Test Skakania|Jump Check|Test Kondycji|CON Check|Rzut obronny CON|CON Saving Throw):/i.test(resultDetails)) {
      addAuditArea(13);
      addAuditArea(14);
    }
  }
  const submittedTomeResult = input.submittedTomeResultText?.match(
    /\[WYNIK_TOMU:[^\]]*\|\s*akcja=([^|\]]+)/i,
  );
  if (submittedTomeResult) {
    // Tome result tags are emitted by the local deterministic tome resolver.
    addAuditArea(46);
    addAuditArea(53);
    if (/\b(?:skimming|study|reference)\b/i.test(submittedTomeResult[1])) {
      addAuditArea(13);
      addAuditArea(14);
    }
    if (/\b(?:skimming|study)\b/i.test(submittedTomeResult[1])) addAuditArea(43);
  }
  const submittedOpposedMagicResult = input.submittedOpposedMagicResultText?.match(
    /\[WYNIK_OBRONY_MAGII:\s*id=[^\]]+\]/i,
  );
  if (submittedOpposedMagicResult) {
    // The opposed-magic card emits this only after resolving the opposed POW roll.
    addAuditArea(22);
    addAuditArea(54);
    addAuditArea(13);
    addAuditArea(14);
  }
  const submittedFirearmResult = input.submittedFirearmResultText?.match(
    /\[WYNIK_STRZAŁU:\s*[^\]]+\|\s*DiveForCover=(?:SUKCES|PORAŻKA|BRAK)\b[^\]]*\]/i,
  );
  if (submittedFirearmResult) {
    // This card currently resolves the target's dive for cover, not the firearm attack itself.
    addAuditArea(34);
    if (!/\|\s*DiveForCover=BRAK\b/i.test(submittedFirearmResult[0])) {
      addAuditArea(13);
      addAuditArea(14);
    }
  }
  return [...ids];
}

function cleanIds(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export interface DossierTurnRetrieval {
  context: string;
  clueRecordIds: string[];
  handoutLocatorIds: string[];
}

function renderHits(hits: DossierRetrievalHit[]): DossierTurnRetrieval {
  const clueRecordIds = cleanIds(
    hits.filter((hit) => hit.recordType === 'clue').map((hit) => hit.recordId),
  );
  const handoutLocatorIds = cleanIds(
    hits.filter((hit) => hit.recordType === 'handout_locator' || (hit.recordType === 'media' && authoredPrabutyMediaId(hit.recordId) === hit.recordId)).map((hit) => hit.recordId),
  );
  if (hits.length === 0) return { context: '', clueRecordIds: [], handoutLocatorIds: [] };
  const records = hits.map((hit) =>
    `- [${hit.recordType}; ${hit.recordId}; ${hit.provenance}; ${hit.sourceRef}] ${hit.content}`,
  );
  const clueLinkingInstructions = clueRecordIds.length > 0
    ? [
        `Dostępne ID aktywnych rekordów typu clue: ${clueRecordIds.join(', ')}.`,
        'Jeśli ujawniasz dokładnie jedną z tych poszlak i zapisujesz ją tagiem dziennika, dodaj w nagłówku `| dossier_record_id:<dokładne ID>`. Nie używaj ID rekordu clue do innego faktu.',
      ]
    : [];
  const handoutInstructions = handoutLocatorIds.length > 0
    ? [
        `Dostępne ID aktywnych lokalizatorów handoutów: ${handoutLocatorIds.join(', ')}.`,
        ...handoutLocatorIds.map((id) => `Gdy Badacze zdobędą wskazany materiał, wstaw dokładnie [HANDOUT:${id}]. Nie używaj tego tagu dla mapy MG ani materiału z innego wydania.`),
      ]
    : [];
  return { context: [
    '[KONTEKST TECZKI PRZYGODY - NOTATKI DLA MG]',
    'To aktywne fakty i wskazówki dla prowadzącego. Aktywacja próbnej teczki nie oznacza akceptacji treści przez człowieka. Zachowaj granice ujawnienia. Nie dopowiadaj kanonu, którego tu nie ma. Streszczenie dokumentu nie jest transkrypcją: nie twórz rzekomych dosłownych cytatów, podpisów ani dat nieobecnych w źródle.',
    ...clueLinkingInstructions,
    ...handoutInstructions,
    ...records,
    '[/KONTEKST TECZKI PRZYGODY]',
  ].join('\n'), clueRecordIds, handoutLocatorIds };
}

/** Retrieves only currently eligible records from the active local dossier index. */
export async function retrieveDossierTurnContext(
  input: DossierTurnContextInput,
): Promise<DossierTurnRetrieval> {
  if (!input.query.trim()) return { context: '', clueRecordIds: [], handoutLocatorIds: [] };
  const binding = getDossierRagBinding(input.activationId);
  if (!binding || binding.adventureId !== input.adventureId) return { context: '', clueRecordIds: [], handoutLocatorIds: [] };

  const activeSceneIds = cleanIds(input.activeSceneIds);
  const presentEntityIds = cleanIds(input.presentEntityIds);
  const targetEntityIds = cleanIds(input.targetEntityIds ?? []).filter((id) => presentEntityIds.includes(id));
  const mechanicIds = cleanIds(input.mechanicIds ?? []);
  const requestedMechanicIds = cleanIds(input.requestedMechanicIds ?? []);
  const retrievalQuery = [
    input.query.trim(),
    activeSceneIds.length > 0 ? `Aktywne sceny: ${activeSceneIds.join(', ')}` : '',
    presentEntityIds.length > 0 ? `Obecne postacie i encje: ${presentEntityIds.join(', ')}` : '',
    targetEntityIds.length > 0 ? `Cel testu społecznego: ${targetEntityIds.join(', ')}` : '',
    mechanicIds.length > 0 ? `Rozstrzygnięte mechaniki: ${mechanicIds.join(', ')}` : '',
    requestedMechanicIds.length > 0 ? `Pytanie o zasady: ${requestedMechanicIds.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const hits = await retrieveDossierRag({
    activationId: input.activationId,
    adventureId: binding.adventureId,
    editionFingerprint: binding.editionFingerprint,
    query: retrievalQuery,
    activeSceneIds,
    presentEntityIds,
    targetEntityIds,
    acquiredRecordIds: cleanIds(input.acquiredRecordIds ?? []),
    mechanicIds,
    requestedMechanicIds,
    inventory: input.inventory,
    worldObjectState: input.worldObjectState,
    actorObservations: input.actorObservations,
  });
  return renderHits(hits);
}
