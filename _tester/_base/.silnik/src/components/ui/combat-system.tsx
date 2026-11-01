'use client';

import type { FormEvent } from 'react';
import { immersion } from '@/lib/hardware/hue/immersion';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './button';
import { isAIFeatureAvailable } from '@/lib/ai-settings';
import { useSettingsSubscription } from '@/hooks/use-settings-subscription';
import {
  rollD100,
  evaluateSkillCheck,
  isSuccess,
  rollDiceFormula,
} from '@/lib/dice-utils';
import {
  resolveMeleeEngagement,
  resolveOutnumberedBonus,
  checkMajorWound as resolverCheckMajorWound,
  type CombatConvention,
} from '@/lib/combat/combat-resolver';
import {
  resolveFirearmShot,
  calculateMultipleShotsPenalty,
} from '@/lib/combat/firearms-engine';
import { rollWithBonusPenalty } from './combat-utils';
import { PhysicalDiceScene } from '@/components/dice/physical-dice-scene';
import { traceForDice, type PhysicalDieType } from '@/lib/dice-roll-trace';

export interface Combatant {
  id: string;
  name: string;
  type: 'player' | 'npc' | 'monster';
  dex: number;
  hp: number;
  maxHp: number;
  san: number;
  maxSan: number;
  mp: number;
  maxMp: number;
  armor: number;
  weapons: Weapon[];
  statusEffects: StatusEffect[];
  initiative: number;
  isActive: boolean;
  isDead: boolean;
  isUnconscious: boolean;
  defensesUsedThisRound?: number;
  build?: number;
  brawlSkill?: number;
  dodgeSkill?: number;
  convention?: 'classic' | 'pulp';
  rulesetVariant?: 'classic' | 'pulp';
}

export interface Weapon {
  id: string;
  name: string;
  damage: string;
  range: string;
  attacks: number;
  skill: string;
  skillValue: number;
}

export interface StatusEffect {
  id: string;
  name: string;
  type: 'buff' | 'debuff' | 'condition';
  duration: number;
  description: string;
  effects: {
    hp?: number;
    san?: number;
    mp?: number;
    dex?: number;
    armor?: number;
  };
}

export interface CombatRound {
  id: string;
  roundNumber: number;
  actions: CombatAction[];
  timestamp: Date;
}

export interface CombatAction {
  id: string;
  attackerId: string;
  targetId?: string;
  actionType:
    | 'attack'
    | 'dodge'
    | 'parry'
    | 'move'
    | 'grapple'
    | 'disarm'
    | 'knockback'
    | 'other';
  weapon?: Weapon;
  roll: number;
  target: number;
  success: boolean;
  criticalSuccess?: boolean;
  criticalFailure?: boolean;
  damage?: number;
  damageRoll?: string;
  damageDiceResults?: number[];
  damageDiceFormula?: string;
  majorWound?: boolean;
  description: string;
  timestamp: Date;
}

function CombatDamageDice({
  formula,
  results,
}: {
  formula?: string;
  results?: number[];
}) {
  const sides = Number(formula?.match(/d(3|4|6|8|10|12|20)\b/i)?.[1]);
  if (!results?.length || !sides) return null;
  return (
    <div className="mt-2 max-w-xs">
      <PhysicalDiceScene
        dice={
          traceForDice(
            `d${sides}` as PhysicalDieType,
            results,
            results.reduce((sum, value) => sum + value, 0),
            'combat-damage'
          ).dice
        }
        label={formula ?? 'damage'}
      />
    </div>
  );
}

// === MANEWRY WALKI (CoC 7e Fighting Maneuvers) ===

export interface CombatManeuver {
  id: string;
  name: string;
  type: 'grapple' | 'disarm' | 'knockback';
  description: string;
  skillUsed: string;
  opposedBy: string;
  effectOnSuccess: string;
  effectOnFailure: string;
}

/**
 * Teksty manewrów żyją w messages/*.json (namespace CombatSystem, prefiks m*).
 * Pola przechowują stabilne identyfikatory kluczy - tłumaczenie następuje
 * w miejscu renderu przez t().
 */
export const COMBAT_MANEUVERS: CombatManeuver[] = [
  {
    id: 'grapple',
    name: 'mGrappleName',
    type: 'grapple',
    description: 'mGrappleDescription',
    skillUsed: 'mGrappleSkillUsed',
    opposedBy: 'mGrappleOpposedBy',
    effectOnSuccess: 'mGrappleSuccess',
    effectOnFailure: 'mGrappleFailure',
  },
  {
    id: 'disarm',
    name: 'mDisarmName',
    type: 'disarm',
    description: 'mDisarmDescription',
    skillUsed: 'mDisarmSkillUsed',
    opposedBy: 'mDisarmOpposedBy',
    effectOnSuccess: 'mDisarmSuccess',
    effectOnFailure: 'mDisarmFailure',
  },
  {
    id: 'knockback',
    name: 'mKnockbackName',
    type: 'knockback',
    description: 'mKnockbackDescription',
    skillUsed: 'mKnockbackSkillUsed',
    opposedBy: 'mKnockbackOpposedBy',
    effectOnSuccess: 'mKnockbackSuccess',
    effectOnFailure: 'mKnockbackFailure',
  },
];

// === MAJOR WOUNDS (CoC 7e) ===

/**
 * Sprawdza, czy obrażenia powodują Major Wound (Ranę Ciężką)
 * CoC 7e: jeśli obrażenia z jednego ataku ≥ połowy max HP → test CON
 * Porażka: natychmiastowa utrata przytomności + skutki
 */
export function checkMajorWound(
  damage: number,
  maxHp: number,
  con: number,
  convention: CombatConvention = 'classic'
): {
  isMajorWound: boolean;
  conTestRequired: boolean;
  conRoll?: number;
  conTestPassed?: boolean;
  effect: string;
} {
  const wound = resolverCheckMajorWound(damage, maxHp, convention);
  if (!wound.isMajorWound) {
    return { isMajorWound: false, conTestRequired: false, effect: '' };
  }

  if (!wound.conTestRequired) {
    return {
      isMajorWound: true,
      conTestRequired: false,
      effect: 'majorWoundPassed',
    };
  }

  const conRoll = rollD100();
  const conTestPassed = conRoll <= con; // zwykły test CON (RAW: rzut ≤ wartość)

  return {
    isMajorWound: true,
    conTestRequired: true,
    conRoll,
    conTestPassed,
    // Stabilne tokeny (nie UI): gotowy tekst powstaje z kluczy
    // majorWoundPassed/majorWoundFailed w messages/*.json.
    effect: conTestPassed ? 'majorWoundPassed' : 'majorWoundFailed',
  };
}

interface CombatSystemProps {
  onClose: () => void;
  characters: Combatant[];
  onCombatantsChange: (combatants: Combatant[]) => void;
  autoStart?: boolean; // Automatyczne uruchomienie walki
  combatData?: {
    combatants: Array<{
      name: string;
      type: 'player' | 'npc' | 'monster';
      dex?: number;
      hp?: number;
      maxHp?: number;
      san?: number;
      maxSan?: number;
    }>;
    location?: string;
    description?: string;
  };
  autoAdvanceTurn?: boolean; // Automatyczne przejście do następnej tury
  turnTimeLimit?: number; // Czas na turę w sekundach (0 = ręczne)
  onCombatStateChange?: (state: {
    isActive: boolean;
    currentRound: number;
    currentTurn: number;
  }) => void;
}

export function CombatSystem({
  onClose,
  characters,
  onCombatantsChange,
  autoStart = false,
  combatData,
  autoAdvanceTurn = false,
  turnTimeLimit = 0,
  onCombatStateChange,
}: CombatSystemProps) {
  const t = useTranslations('CombatSystem');
  const [combatants, setCombatants] = useState<Combatant[]>(characters);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [isCombatActive, setIsCombatActive] = useState(false);
  const [combatHistory, setCombatHistory] = useState<CombatRound[]>([]);
  const [showAddCombatant, setShowAddCombatant] = useState(false);
  const [editingCombatant, setEditingCombatant] = useState<Combatant | null>(
    null
  );
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(false);
  // === REACTIVE SETTINGS: Automatycznie aktualizowane gdy użytkownik zmieni ustawienia ===
  const aiSettings = useSettingsSubscription();
  const [turnTimer, setTurnTimer] = useState<NodeJS.Timeout | null>(null);

  // Automatyczne uruchomienie walki
  useEffect(() => {
    if (
      autoStart &&
      combatData &&
      combatData.combatants.length > 0 &&
      !isCombatActive
    ) {
      // Dodaj uczestników z combatData
      const newCombatants: Combatant[] = combatData.combatants.map((c) => ({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        name: c.name,
        type: c.type,
        dex: c.dex || 50,
        hp: c.hp || 10,
        maxHp: c.maxHp || 10,
        san: c.san || 50,
        maxSan: c.maxSan || 50,
        mp: 10,
        maxMp: 10,
        armor: 0,
        weapons: [],
        statusEffects: [],
        initiative: 0,
        isActive: false,
        isDead: false,
        isUnconscious: false,
      }));

      setCombatants(newCombatants);
      setTimeout(() => {
        startCombat();
      }, 500);
    }
  }, [autoStart, combatData]);

  // Initialize combat if not already done
  useEffect(() => {
    if (combatants.length > 0 && !isCombatActive && !autoStart) {
      rollInitiative();
    }
  }, [combatants]);

  // Timer dla auto-advance tury
  useEffect(() => {
    if (isCombatActive && autoAdvanceTurn && turnTimeLimit > 0) {
      if (turnTimer) clearTimeout(turnTimer);

      const timer = setTimeout(() => {
        nextTurn();
      }, turnTimeLimit * 1000);

      setTurnTimer(timer);

      return () => {
        if (turnTimer) clearTimeout(turnTimer);
      };
    }
  }, [currentTurn, isCombatActive, autoAdvanceTurn, turnTimeLimit]);

  // Powiadom o zmianie stanu walki
  useEffect(() => {
    if (onCombatStateChange) {
      onCombatStateChange({
        isActive: isCombatActive,
        currentRound,
        currentTurn,
      });
    }
  }, [isCombatActive, currentRound, currentTurn]);

  // REMOVED: aiSettings is now reactive via useSettingsSubscription hook
  // Ustawienia są automatycznie synchronizowane
  useEffect(() => {
    setSoundEffectsEnabled(isAIFeatureAvailable('voiceSettings'));
  }, [aiSettings]);

  const playCombatSound = async (
    soundType: 'attack' | 'hit' | 'miss' | 'damage' | 'death' | 'victory'
  ) => {
    if (!soundEffectsEnabled) {
      return;
    }

    try {
      let soundEffectId = '';

      switch (soundType) {
        case 'attack':
          soundEffectId = 'combat-gunshot';
          break;
        case 'hit':
          soundEffectId = 'combat-punch';
          break;
        case 'miss':
          soundEffectId = 'ambient-wind';
          break;
        case 'damage':
          soundEffectId = 'horror-screech';
          break;
        case 'death':
          soundEffectId = 'horror-whisper';
          break;
        case 'victory':
          soundEffectId = 'ambient-thunder';
          break;
        default:
          return;
      }

      // Sound effects disabled - ElevenLabs removed
      console.log('Sound effect would play:', soundEffectId);
    } catch (error) {
      console.error('Failed to play combat sound:', error);
    }
  };

  const rollInitiative = () => {
    const updatedCombatants = combatants
      .map((combatant) => {
        const hasReadyFirearm = combatant.weapons.some(
          (w) =>
            (w.range && parseInt(w.range, 10) > 0) ||
            /pistolet|gun|rewolwer|rifle|strzelb/i.test(w.name)
        );
        const firearmBonus = hasReadyFirearm ? 50 : 0;
        return {
          ...combatant,
          initiative: combatant.dex + firearmBonus,
        };
      })
      .sort((a, b) => b.initiative - a.initiative);

    setCombatants(updatedCombatants);
    onCombatantsChange(updatedCombatants);
  };

  const startCombat = () => {
    setIsCombatActive(true);
    setCurrentTurn(0);
    setCurrentRound(1);
    rollInitiative();

    // Zapisz do localStorage dla integracji z AI
    if (typeof window !== 'undefined') {
      localStorage.setItem('combat_active', 'true');
      localStorage.setItem(
        'combat_data',
        JSON.stringify({
          combatants,
          round: 1,
          turn: 0,
          started: new Date().toISOString(),
        })
      );
    }
  };

  const endCombat = () => {
    setIsCombatActive(false);
    setCurrentTurn(0);
    setCurrentRound(1);

    // Wyczyść timer
    if (turnTimer) {
      clearTimeout(turnTimer);
      setTurnTimer(null);
    }

    // Wyczyść localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('combat_active');
      localStorage.removeItem('combat_data');
    }
  };

  const nextTurn = () => {
    if (currentTurn < combatants.length - 1) {
      setCurrentTurn(currentTurn + 1);
    } else {
      setCurrentRound(currentRound + 1);
      setCurrentTurn(0);
      // Nowa runda: reset darmowych obron (Outnumbered CoC 7e RAW)
      setCombatants((prev) =>
        prev.map((c) => ({ ...c, defensesUsedThisRound: 0 }))
      );
      // Roll new initiative for next round
      rollInitiative();
    }
  };

  const performAttack = (
    attacker: Combatant,
    target: Combatant,
    weapon: Weapon
  ) => {
    const currentRoundData = combatHistory.find(
      (r) => r.roundNumber === currentRound
    );
    const isFirearm =
      (weapon.range && parseInt(weapon.range, 10) > 0) ||
      /pistolet|gun|rewolwer|rifle|strzelb/i.test(weapon.name);

    if (!isFirearm) {
      // Walka wręcz - deterministyczne rozstrzygnięcie CoC 7e RAW
      const defensesUsed = target.defensesUsedThisRound || 0;
      const { isOutnumbered } = resolveOutnumberedBonus(defensesUsed);

      // Jeśli obrońca jest osaczony, napastnik otrzymuje kość premiową
      const attackRoll = isOutnumbered
        ? rollWithBonusPenalty(1, 0).finalResult
        : rollD100();

      // Domyślny wybór reakcji obrońcy (Unik vs Kontratak)
      const defenderDodge = target.dodgeSkill || target.dex;
      const defenderBrawl = target.brawlSkill || 25;
      const defenseChoice =
        defenderDodge >= defenderBrawl ? 'dodge' : 'fight_back';
      const defenderRoll = rollD100();
      const defenderSkill =
        defenseChoice === 'dodge' ? defenderDodge : defenderBrawl;

      const resolution = resolveMeleeEngagement({
        attackerName: attacker.name,
        defenderName: target.name,
        attackerRoll: attackRoll,
        attackerSkill: weapon.skillValue,
        defenderRoll,
        defenderSkill,
        defenseChoice,
        attackerWeaponFormula: weapon.damage || '1d3',
        defenderWeaponFormula: '1d3',
        defenderArmor: target.armor,
        attackerArmor: attacker.armor,
        defenderMaxHp: target.maxHp,
        attackerMaxHp: attacker.maxHp,
        attackerBuild: attacker.build || 0,
        defenderBuild: target.build || 0,
      });

      const updatedTargetDefenses = defensesUsed + 1;
      let damage = 0;
      let damageRoll = '';
      let damageDiceResults: number[] | undefined;
      let damageDiceFormula: string | undefined;
      let majorWound = false;

      let nextCombatants = combatants.map((c) =>
        c.id === target.id
          ? { ...c, defensesUsedThisRound: updatedTargetDefenses }
          : c
      );

      if (resolution.damageDealtTo === 'defender' && resolution.damage) {
        damage = resolution.damage.effectiveDamage;
        majorWound = resolution.damage.isMajorWound;
        damageRoll = resolution.damage.breakdown;
        damageDiceResults = resolution.damage.diceResults;
        damageDiceFormula = resolution.damage.diceFormula;

        const newHp = Math.max(0, target.hp - damage);
        nextCombatants = nextCombatants.map((c) =>
          c.id === target.id
            ? {
                ...c,
                hp: newHp,
                isDead: newHp <= 0,
                isUnconscious: newHp <= 0 || majorWound,
              }
            : c
        );
      } else if (resolution.damageDealtTo === 'attacker' && resolution.damage) {
        // Kontratak obrońcy zadał obrażenia atakującemu!
        damage = resolution.damage.effectiveDamage;
        majorWound = resolution.damage.isMajorWound;
        damageRoll = `Kontratak: ${resolution.damage.breakdown}`;
        damageDiceResults = resolution.damage.diceResults;
        damageDiceFormula = resolution.damage.diceFormula;

        const newHp = Math.max(0, attacker.hp - damage);
        nextCombatants = nextCombatants.map((c) =>
          c.id === attacker.id
            ? {
                ...c,
                hp: newHp,
                isDead: newHp <= 0,
                isUnconscious: newHp <= 0 || majorWound,
              }
            : c
        );
      }

      setCombatants(nextCombatants);
      onCombatantsChange(nextCombatants);

      const action: CombatAction = {
        id: Date.now().toString(),
        attackerId: attacker.id,
        targetId: target.id,
        actionType: 'attack',
        weapon,
        roll: attackRoll,
        target: weapon.skillValue,
        success: resolution.winner === 'attacker',
        criticalSuccess: resolution.attackerOutcome === 'critical',
        criticalFailure: resolution.attackerOutcome === 'fumble',
        damage,
        damageRoll,
        damageDiceResults,
        damageDiceFormula,
        majorWound,
        description: t('attackDescription', {
          attacker: attacker.name,
          target: target.name,
          weapon: weapon.name,
        }),
        timestamp: new Date(),
      };

      if (currentRoundData) {
        const updatedRound = {
          ...currentRoundData,
          actions: [...currentRoundData.actions, action],
        };
        setCombatHistory(
          combatHistory.map((r) =>
            r.roundNumber === currentRound ? updatedRound : r
          )
        );
      } else {
        const newRound: CombatRound = {
          id: Date.now().toString(),
          roundNumber: currentRound,
          actions: [action],
          timestamp: new Date(),
        };
        setCombatHistory([...combatHistory, newRound]);
      }

      if (resolution.damageDealtTo !== 'none') {
        playCombatSound('hit');
      } else {
        playCombatSound('miss');
      }

      return;
    }

    // Broń palna: deterministyczne rozstrzygnięcie CoC 7e RAW z zacięciami i karami za kolejne strzały
    const previousFirearmShotsThisRound = (
      currentRoundData?.actions || []
    ).filter(
      (a) =>
        a.attackerId === attacker.id &&
        a.actionType === 'attack' &&
        ((a.weapon?.range && parseInt(a.weapon.range, 10) > 0) ||
          /pistolet|gun|rewolwer|rifle|strzelb/i.test(a.weapon?.name || ''))
    ).length;
    const shotNumberInRound = previousFirearmShotsThisRound + 1;
    const penaltyDice = calculateMultipleShotsPenalty(shotNumberInRound);

    const attackRoll =
      penaltyDice > 0
        ? rollWithBonusPenalty(0, penaltyDice).finalResult
        : rollD100();
    const targetNumber = weapon.skillValue;

    const isTommy = /thompson|tommy/i.test(weapon.name);
    const malfunctionThreshold = isTommy ? 96 : 100;
    const baseRange = parseInt(weapon.range, 10) || 15;

    const shotResolution = resolveFirearmShot({
      shooterName: attacker.name,
      targetName: target.name,
      weaponName: weapon.name,
      skillValue: targetNumber,
      roll: attackRoll,
      damageFormula: weapon.damage || '1d10',
      distanceYards: baseRange,
      baseRangeYards: baseRange,
      shooterDex: attacker.dex,
      shotNumberInRound,
      malfunctionThreshold,
      targetArmor: target.armor,
      targetMaxHp: target.maxHp,
      convention:
        target.convention ??
        (target.rulesetVariant === 'pulp' || attacker.rulesetVariant === 'pulp'
          ? 'pulp'
          : 'classic'),
    });

    const success = shotResolution.hit;
    const criticalSuccess = shotResolution.outcome === 'critical';
    const criticalFailure =
      shotResolution.outcome === 'fumble' || shotResolution.isMalfunction;

    let damage = 0;
    let damageRoll = '';
    let damageDiceResults: number[] | undefined;
    let damageDiceFormula: string | undefined;
    let majorWound = false;

    if (shotResolution.isMalfunction) {
      damage = 0;
      damageRoll = t('firearmMalfunctionDesc', {
        roll: attackRoll,
        threshold: malfunctionThreshold,
      });
      playCombatSound('miss');
    } else if (success && shotResolution.damage) {
      damage = shotResolution.damage.effectiveDamage;
      majorWound = shotResolution.damage.isMajorWound;
      damageRoll = shotResolution.damage.breakdown;
      damageDiceResults = shotResolution.damage.diceResults;
      damageDiceFormula = shotResolution.damage.diceFormula;

      if (shotResolution.damage.isImpale) {
        damageRoll += ` ${t('impaleNotice')}`;
      }

      if (target.armor > 0) {
        damageRoll += ` ${t('armorNote', {
          armor: target.armor,
          effective: damage,
        })}`;
      }

      const newHp = Math.max(0, target.hp - damage);
      const updatedTarget = {
        ...target,
        hp: newHp,
        isDead: newHp <= 0,
        isUnconscious: newHp <= 0 || majorWound,
      };

      const updatedCombatants = combatants.map((c) =>
        c.id === target.id ? updatedTarget : c
      );
      setCombatants(updatedCombatants);
      onCombatantsChange(updatedCombatants);
      playCombatSound('hit');
    } else {
      damage = 0;
      damageRoll = t('firearmMissDesc', {
        roll: attackRoll,
        target: targetNumber,
      });
      playCombatSound('miss');
    }

    const action: CombatAction = {
      id: Date.now().toString(),
      attackerId: attacker.id,
      targetId: target.id,
      actionType: 'attack',
      weapon,
      roll: attackRoll,
      target: targetNumber,
      success,
      criticalSuccess,
      criticalFailure,
      damage,
      damageRoll,
      damageDiceResults,
      damageDiceFormula,
      majorWound,
      description: t('attackDescription', {
        attacker: attacker.name,
        target: target.name,
        weapon: weapon.name,
      }),
      timestamp: new Date(),
    };

    if (!shotResolution.isMalfunction)
      immersion.committedShot('shot-' + action.id);

    // Add to combat history
    if (currentRoundData) {
      const updatedRound = {
        ...currentRoundData,
        actions: [...currentRoundData.actions, action],
      };
      setCombatHistory(
        combatHistory.map((r) =>
          r.roundNumber === currentRound ? updatedRound : r
        )
      );
    } else {
      const newRound: CombatRound = {
        id: Date.now().toString(),
        roundNumber: currentRound,
        actions: [action],
        timestamp: new Date(),
      };
      setCombatHistory([...combatHistory, newRound]);
    }

    // Play sound effects
    if (success) {
      if (criticalSuccess) {
        playCombatSound('hit');
      } else if (criticalFailure) {
        playCombatSound('miss');
      } else {
        playCombatSound('attack');
      }

      if (damage > 0) {
        setTimeout(() => playCombatSound('damage'), 200);
      }

      // Check for death
      if (target.hp - damage <= 0) {
        setTimeout(() => playCombatSound('death'), 500);
      }
    } else {
      playCombatSound('miss');
    }

    // Auto-advance turn if attack was successful
    if (success) {
      setTimeout(nextTurn, 1000);
    }
  };

  const addCombatant = (combatant: Omit<Combatant, 'id'>) => {
    const newCombatant: Combatant = {
      ...combatant,
      id: Date.now().toString(),
    };
    const updatedCombatants = [...combatants, newCombatant];
    setCombatants(updatedCombatants);
    onCombatantsChange(updatedCombatants);
    setShowAddCombatant(false);
  };

  const removeCombatant = (id: string) => {
    const updatedCombatants = combatants.filter((c) => c.id !== id);
    setCombatants(updatedCombatants);
    onCombatantsChange(updatedCombatants);
  };

  const getCurrentCombatant = () => {
    return combatants[currentTurn] || null;
  };

  const getStatusColor = (combatant: Combatant) => {
    if (combatant.isDead) return 'text-red-500';
    if (combatant.isUnconscious) return 'text-yellow-500';
    if (combatant.hp < combatant.maxHp / 2) return 'text-orange-500';
    return 'text-green-500';
  };

  const getStatusIcon = (combatant: Combatant) => {
    if (combatant.isDead) return '💀';
    if (combatant.isUnconscious) return '😵';
    if (combatant.hp < combatant.maxHp / 2) return '🩸';
    return '✅';
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border border-white/20 w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold font-display uppercase tracking-wider text-brass">
              {t('title')}
            </h2>
          </div>
          <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
        </div>

        <div className="p-6">
          {/* Combat Controls */}
          <div className="flex gap-4 mb-6">
            <Button
              onClick={startCombat}
              disabled={isCombatActive}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-lg transition-colors"
            >
              {t('startCombat')}
            </Button>
            <Button
              onClick={endCombat}
              disabled={!isCombatActive}
              className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg transition-colors"
            >
              {t('endCombat')}
            </Button>
            <Button
              onClick={rollInitiative}
              className="px-4 py-2 bg-brass hover:bg-brass/90 text-primary-foreground font-semibold rounded-lg transition-colors"
            >
              {t('rollInitiative')}
            </Button>
            <Button
              onClick={() => setShowAddCombatant(true)}
              className="px-4 py-2 bg-card border border-brass/40 hover:bg-brass/10 text-brass rounded-lg transition-colors"
            >
              {t('addCombatantButton')}
            </Button>
          </div>

          {/* Combat Status */}
          {isCombatActive && (
            <div className="bg-brass/10 border border-brass/30 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold font-display tracking-wider text-brass">
                    {t('roundTurn', {
                      round: currentRound,
                      turn: currentTurn + 1,
                    })}
                  </h3>
                  <p className="text-foreground/80 text-sm">
                    {t('currentPlayer', {
                      name: getCurrentCombatant()?.name || t('none'),
                    })}
                  </p>
                </div>
                <Button
                  onClick={nextTurn}
                  className="px-6 py-2 bg-brass hover:bg-brass/90 text-primary-foreground font-semibold rounded-lg transition-colors"
                >
                  {t('nextTurn')}
                </Button>
              </div>
            </div>
          )}

          {/* Combatants Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            {combatants.map((combatant, index) => (
              <div
                key={combatant.id}
                className={`bg-muted/50 rounded-lg p-4 border ${
                  currentTurn === index && isCombatActive
                    ? 'border-yellow-500/50 bg-yellow-500/10'
                    : 'border-white/10'
                }`}
              >
                {/* Combatant Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getStatusIcon(combatant)}</span>
                    <h3
                      className={`font-semibold ${getStatusColor(combatant)}`}
                    >
                      {combatant.name}
                    </h3>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      {t('initiativeLabel', { value: combatant.initiative })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('positionLabel', { position: index + 1 })}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <span className="text-muted-foreground">HP:</span>
                    <span className={`ml-1 ${getStatusColor(combatant)}`}>
                      {combatant.hp}/{combatant.maxHp}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">SAN:</span>
                    <span className="ml-1 text-primary">
                      {combatant.san}/{combatant.maxSan}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">MP:</span>
                    <span className="ml-1 text-gold">
                      {combatant.mp}/{combatant.maxMp}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ZR:</span>
                    <span className="ml-1 text-emerald-400">
                      {combatant.dex}
                    </span>
                  </div>
                </div>

                {/* Weapons */}
                {combatant.weapons.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">
                      {t('weaponsLabel')}
                    </h4>
                    <div className="space-y-1">
                      {combatant.weapons.map((weapon) => (
                        <div
                          key={weapon.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-foreground">{weapon.name}</span>
                          <Button
                            onClick={() => {
                              const target = combatants.find(
                                (c) => c.id !== combatant.id && !c.isDead
                              );
                              if (target) {
                                performAttack(combatant, target, weapon);
                              }
                            }}
                            disabled={
                              !isCombatActive ||
                              currentTurn !== index ||
                              combatant.isDead
                            }
                            className="px-2 py-1 bg-destructive hover:bg-destructive/90 disabled:bg-muted text-destructive-foreground rounded text-xs transition-colors"
                          >
                            {t('attackButton')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => setEditingCombatant(combatant)}
                    className="px-2 py-1 bg-card border border-brass/40 hover:bg-brass/10 text-brass rounded text-xs transition-colors"
                  >
                    {t('editButton')}
                  </Button>
                  <Button
                    onClick={() => removeCombatant(combatant.id)}
                    className="px-2 py-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded text-xs transition-colors"
                  >
                    {t('deleteButton')}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Combat History */}
          {combatHistory.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <h3 className="text-lg font-semibold font-display tracking-wider text-brass mb-4">
                {t('historyTitle')}
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {combatHistory.map((round) => (
                  <div
                    key={round.id}
                    className="bg-muted/30 rounded-lg p-3 border border-border/40"
                  >
                    <h4 className="font-medium text-brass mb-2">
                      {t('roundLabel', { round: round.roundNumber })}
                    </h4>
                    <div className="space-y-2">
                      {round.actions.map((action) => (
                        <div
                          key={action.id}
                          className="text-sm bg-muted/30 rounded p-2 border border-border/20"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-foreground">
                              {action.description}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                action.criticalSuccess
                                  ? 'bg-emerald-600 text-white'
                                  : action.success
                                    ? 'bg-primary/80 text-primary-foreground'
                                    : action.criticalFailure
                                      ? 'bg-destructive text-destructive-foreground'
                                      : 'bg-muted'
                              }`}
                            >
                              {action.roll} vs {action.target}
                            </span>
                          </div>
                          {action.damage !== undefined && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {t('damageLabel', {
                                damage: action.damage,
                                roll: action.damageRoll ?? '',
                              })}
                              <CombatDamageDice
                                formula={action.damageDiceFormula}
                                results={action.damageDiceResults}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Add Combatant Modal */}
        {showAddCombatant && (
          <AddCombatantForm
            onAdd={addCombatant}
            onCancel={() => setShowAddCombatant(false)}
          />
        )}

        {/* Edit Combatant Modal */}
        {editingCombatant && (
          <EditCombatantForm
            combatant={editingCombatant}
            onUpdate={(updated) => {
              const updatedCombatants = combatants.map((c) =>
                c.id === updated.id ? updated : c
              );
              setCombatants(updatedCombatants);
              onCombatantsChange(updatedCombatants);
              setEditingCombatant(null);
            }}
            onCancel={() => setEditingCombatant(null)}
          />
        )}
      </div>
    </div>
  );
}

interface AddCombatantFormProps {
  onAdd: (combatant: Omit<Combatant, 'id'>) => void;
  onCancel: () => void;
}

function AddCombatantForm({ onAdd, onCancel }: AddCombatantFormProps) {
  const t = useTranslations('CombatSystem');
  const [formData, setFormData] = useState({
    name: '',
    type: 'player' as Combatant['type'],
    dex: 50,
    hp: 10,
    maxHp: 10,
    san: 50,
    maxSan: 50,
    mp: 10,
    maxMp: 10,
    armor: 0,
    weapons: [] as Weapon[],
    statusEffects: [] as StatusEffect[],
    initiative: 0,
    isActive: true,
    isDead: false,
    isUnconscious: false,
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (formData.name.trim()) {
      onAdd(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg border border-white/20 w-[80vw] h-[78vh] max-h-[85vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-bold font-display uppercase tracking-wider text-brass mb-4">
            {t('addFormTitle')}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('nameLabel')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:border-brass focus:outline-none"
                  placeholder={t('namePlaceholder')}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('typeLabel')}
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as Combatant['type'],
                    })
                  }
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:border-brass focus:outline-none"
                >
                  <option value="player">{t('typePlayer')}</option>
                  <option value="npc">{t('typeNpc')}</option>
                  <option value="monster">{t('typeMonster')}</option>
                </select>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('dexLabel')}
                </label>
                <input
                  type="number"
                  value={formData.dex}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dex: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:border-brass focus:outline-none"
                  min="1"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  HP
                </label>
                <input
                  type="number"
                  value={formData.hp}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hp: parseInt(e.target.value) || 0,
                      maxHp: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:border-brass focus:outline-none"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  SAN
                </label>
                <input
                  type="number"
                  value={formData.san}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      san: parseInt(e.target.value) || 0,
                      maxSan: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:border-brass focus:outline-none"
                  min="1"
                  max="100"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                className="flex-1 py-2 bg-brass hover:bg-brass/90 text-primary-foreground font-semibold rounded-lg transition-colors"
              >
                {t('addSubmit')}
              </Button>
              <Button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2 bg-card border border-border hover:bg-muted text-foreground rounded-lg transition-colors"
              >
                {t('cancelX')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

interface EditCombatantFormProps {
  combatant: Combatant;
  onUpdate: (combatant: Combatant) => void;
  onCancel: () => void;
}

function EditCombatantForm({
  combatant,
  onUpdate,
  onCancel,
}: EditCombatantFormProps) {
  const t = useTranslations('CombatSystem');
  const [formData, setFormData] = useState(combatant);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onUpdate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg border border-white/20 w-[80vw] h-[78vh] max-h-[85vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-bold font-display uppercase tracking-wider text-brass mb-4">
            {t('editFormTitle')}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('nameLabel')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:border-brass focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('typeLabel')}
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as Combatant['type'],
                    })
                  }
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:border-brass focus:outline-none"
                >
                  <option value="player">{t('typePlayer')}</option>
                  <option value="npc">{t('typeNpc')}</option>
                  <option value="monster">{t('typeMonster')}</option>
                </select>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('dexLabel')}
                </label>
                <input
                  type="number"
                  value={formData.dex}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dex: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:border-brass focus:outline-none"
                  min="1"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  HP
                </label>
                <input
                  type="number"
                  value={formData.hp}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hp: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:border-brass focus:outline-none"
                  min="0"
                  max={formData.maxHp}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  SAN
                </label>
                <input
                  type="number"
                  value={formData.san}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      san: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:border-brass focus:outline-none"
                  min="0"
                  max={formData.maxSan}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                className="flex-1 py-2 bg-brass hover:bg-brass/90 text-primary-foreground font-semibold rounded-lg transition-colors"
              >
                {t('saveChanges')}
              </Button>
              <Button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2 bg-card border border-border hover:bg-muted text-foreground rounded-lg transition-colors"
              >
                {t('cancelX')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
