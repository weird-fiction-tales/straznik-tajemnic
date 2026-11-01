'use client';

import '@/components/ui/deco-window.css';

/**
 * @file opposed-melee-card.tsx
 * Karta obrony Badacza w walce wręcz (Opposed Melee Defense - CoC 7e RAW Rozdz. 6, s. 102-117 BMG).
 * Wyświetlana w oknie czatu po wykryciu znacznika [WALKA_ATAK:...] lub [OBRONA_WALKA:...].
 * Estetyka: Dark Art Déco Fiction First.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Swords,
  ShieldAlert,
  Footprints,
  CheckCircle2,
  AlertTriangle,
  Dices,
  Skull,
  HeartPulse,
} from 'lucide-react';
import {
  type PendingMeleeAttack,
  type CombatResolution,
  type DefenseChoice,
  type ManeuverType,
  resolveMeleeEngagement,
  checkManeuverFeasibility,
  resolveOutnumberedBonus,
  applyCombatDamage,
} from '@/lib/combat/combat-resolver';
import {
  getCombatDefenseWeapons,
  type CombatDefenseWeaponOption,
} from '@/lib/combat/weapon-context';
import { rollD100, rollD100WithBonus, type RollOutcome } from '@/lib/dice-utils';
import { resolveTestValue } from '@/lib/skill-test-resolver';
import { findEquipmentTemplate } from '@/lib/equipment-catalog';
import type { Character, OpposedMeleeEventData } from '@/lib/types';
import { PhysicalDiceScene } from '@/components/dice/physical-dice-scene';
import { traceForDice, type PhysicalDieType } from '@/lib/dice-roll-trace';

export interface OpposedMeleeCardProps {
  opposedEvent?: OpposedMeleeEventData;
  attack?: PendingMeleeAttack;
  activeCharacter?: Character | null;
  characters?: Character[];
  completed?: boolean;
  resolution?: CombatResolution | null;
  defensesUsedThisRound?: number;
  onCharacterUpdate?: (character: Character) => void;
  onResolveDefense?: (
    attack: PendingMeleeAttack | OpposedMeleeEventData,
    choice: DefenseChoice,
    weapon?: CombatDefenseWeaponOption,
    maneuverType?: ManeuverType
  ) => void;
  onSendChat?: (message: string) => void;
  canAct?: boolean;
  disabled?: boolean;
}

interface OpposedMeleeResolutionState {
  choice: DefenseChoice;
  maneuverType?: ManeuverType;
  weaponUsed?: CombatDefenseWeaponOption;
  attackerRoll: number;
  attackerOutcome: RollOutcome;
  defenderRoll: number;
  defenderOutcome: RollOutcome;
  winner: 'attacker' | 'defender' | 'none';
  damageDealtTo: 'attacker' | 'defender' | 'none';
  effectiveDamage: number;
  damageDiceResults?: number[];
  damageDiceFormula?: string;
  defenderHpBefore: number;
  defenderHpAfter: number;
  attackerHpBefore: number;
  attackerHpAfter: number;
  isMajorWound: boolean;
  isDefenderDead: boolean;
  summaryText: string;
}

export function OpposedMeleeCard({
  opposedEvent,
  attack,
  activeCharacter,
  characters = [],
  completed = false,
  resolution = null,
  defensesUsedThisRound = 0,
  onCharacterUpdate,
  onResolveDefense,
  onSendChat,
  canAct = true,
  disabled = false,
}: OpposedMeleeCardProps) {
  const t = useTranslations('CombatDefense');
  const locale = useLocale() === 'en' ? 'en' : 'pl';

  const [isResolved, setIsResolved] = useState<boolean>(completed || Boolean(resolution));
  const [selectedManeuver, setSelectedManeuver] = useState<ManeuverType>('knockdown');

  useEffect(() => {
    if (completed) {
      setIsResolved(true);
    }
  }, [completed]);

  const effectiveResolved = isResolved || completed || Boolean(resolution);

  // Normalizacja danych wejściowych (z opposedEvent lub attack)
  const attackerName = opposedEvent?.attackerName || attack?.attacker.name || 'Wrogi Przeciwnik';
  const attackerSkill = opposedEvent?.attackerSkill ?? attack?.attacker.attackSkill ?? 50;
  const attackerBuild = opposedEvent?.attackerBuild ?? attack?.attacker.build ?? 0;
  const attackerWeaponName = opposedEvent?.weaponName || attack?.weapon.name || 'Cios wręcz';
  const attackerDamageFormula = opposedEvent?.damageFormula || attack?.weapon.damageFormula || '1d3';
  const attackerDamageBonus = opposedEvent?.damageBonus || attack?.attacker.damageBonus || '';
  const attackerDamageType =
    (opposedEvent?.damageClass === 'impaling' || attack?.weapon.damageClass === 'impaling')
      ? 'impaling'
      : 'blunt';
  const attackIntent = opposedEvent?.intent || opposedEvent?.description || attack?.intent || '';
  const eventId = opposedEvent?.id || attack?.eventId || 'melee-engagement';

  // Obrońca (badacz będący celem ataku)
  const defender = useMemo(() => {
    const pool = activeCharacter
      ? [activeCharacter, ...characters.filter((c) => c.id !== activeCharacter.id)]
      : characters;

    const targetName = (opposedEvent?.characterName || attack?.target.name || '').trim().toLowerCase();
    const targetId = opposedEvent?.characterId || attack?.target.characterId;

    if (targetId) {
      const match = pool.find((c) => c.id === targetId);
      if (match) return match;
    }

    if (targetName) {
      const match = pool.find((c) => c.name.trim().toLowerCase() === targetName);
      if (match) return match;
    }

    return activeCharacter || pool[0] || null;
  }, [activeCharacter, characters, opposedEvent, attack]);

  // Dostępne bronie obrońcy
  const weapons = useMemo(() => getCombatDefenseWeapons(defender), [defender]);
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>(weapons[0]?.id ?? 'unarmed');
  const selectedWeapon = weapons.find((w) => w.id === selectedWeaponId) ?? weapons[0];

  // Umiejętności obrońcy
  const dodgeSkill = useMemo(() => {
    if (!defender) return 25;
    const resolved = resolveTestValue('Unik', defender);
    if (typeof resolved === 'number') return resolved;
    return Math.floor((defender.dex ?? 50) / 2);
  }, [defender]);

  const brawlSkill = useMemo(() => {
    if (!defender) return 25;
    const resolved = resolveTestValue('Walka Wręcz', defender);
    if (typeof resolved === 'number') return resolved;
    return 25;
  }, [defender]);

  const defenderBuild = defender?.build ?? 0;
  const maneuverCheck = checkManeuverFeasibility(defenderBuild, attackerBuild);

  const defenderArmor = useMemo(() => {
    if (!defender) return 0;
    let armor = defender.armor ?? 0;
    for (const item of defender.equipment ?? []) {
      if (!item.templateId || item.condition === 'broken') continue;
      const template = findEquipmentTemplate(item.templateId);
      const profile = template?.combatProfile;
      if (profile?.kind === 'armor' && typeof profile.armorValue === 'number') {
        armor = Math.max(armor, profile.armorValue);
      }
    }
    return armor;
  }, [defender]);

  // Przewaga liczebna (Outnumbered RAW s. 108)
  const isOpposedOutnumbered = Boolean(opposedEvent?.isOutnumbered);
  const outnumbered = resolveOutnumberedBonus(isOpposedOutnumbered ? 1 : defensesUsedThisRound);

  // Stan rozstrzygnięcia
  const [resultState, setResultState] = useState<OpposedMeleeResolutionState | null>(() => {
    if (!resolution || !defender) return null;
    return {
      choice: resolution.defenseChoice,
      attackerRoll: resolution.attackerRoll,
      attackerOutcome: resolution.attackerOutcome,
      defenderRoll: resolution.defenderRoll,
      defenderOutcome: resolution.defenderOutcome,
      winner: resolution.winner,
      damageDealtTo: resolution.damageDealtTo,
      effectiveDamage: resolution.damage?.effectiveDamage ?? 0,
      damageDiceResults: resolution.damage?.diceResults,
      damageDiceFormula: resolution.damage?.diceFormula,
      defenderHpBefore: resolution.defenderHealth?.hpBefore ?? defender.hp,
      defenderHpAfter: resolution.defenderHealth?.hpAfter ?? defender.hp,
      attackerHpBefore: resolution.attackerHpBefore,
      attackerHpAfter: resolution.attackerHpAfter,
      isMajorWound: Boolean(resolution.defenderHealth?.hasMajorWound),
      isDefenderDead: Boolean(resolution.defenderHealth?.isDead),
      summaryText: t('defenseResolved'),
    };
  });

  const getOutcomeBadge = (outcome: RollOutcome) => {
    switch (outcome) {
      case 'critical':
        return <Badge className="bg-brass/10 text-brass border-brass/50">{t('outcomeCritical')}</Badge>;
      case 'extreme':
        return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">{t('outcomeExtreme')}</Badge>;
      case 'hard':
        return <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30">{t('outcomeHard')}</Badge>;
      case 'regular':
        return <Badge className="bg-primary/10 text-primary border-primary/60">{t('outcomeRegular')}</Badge>;
      case 'fail':
        return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40">{t('outcomeFail')}</Badge>;
      case 'fumble':
      default:
        return <Badge className="bg-destructive/30 text-destructive-foreground border-destructive/50">{t('outcomeFumble')}</Badge>;
    }
  };

  const handleExecuteDefense = (choice: DefenseChoice) => {
    if (!defender || effectiveResolved || disabled || !canAct) return;
    if (choice === 'maneuver' && !maneuverCheck.allowed) return;

    // Rzuty K100 CoC 7e RAW:
    // Jeśli obrońca jest outnumbered (przewaga liczebna), napastnik ma kość premiową (+1K)
    const attackerRoll = outnumbered.isOutnumbered ? rollD100WithBonus(1).total : rollD100();

    // Dla obrońcy przy manewrze uwzględniamy kości karne wynikające z różnicy Budowy (Build)
    let defenderRoll = rollD100();
    if (choice === 'maneuver' && maneuverCheck.penaltyDice > 0) {
      defenderRoll = rollD100WithBonus(-maneuverCheck.penaltyDice).total;
    }

    const defenderSkillVal =
      choice === 'dodge'
        ? dodgeSkill
        : choice === 'fight_back'
        ? selectedWeapon?.skillValue ?? brawlSkill
        : brawlSkill;

    const convention = defender.rulesetVariant === 'pulp' ? 'pulp' : 'classic';

    const engagement = resolveMeleeEngagement({
      attackerName,
      defenderName: defender.name,
      attackerRoll,
      attackerSkill,
      defenderRoll,
      defenderSkill: defenderSkillVal,
      defenseChoice: choice,
      attackerWeaponFormula: attackerDamageFormula,
      attackerDamageBonusFormula: attackerDamageBonus,
      attackerDamageType,
      defenderWeaponFormula: selectedWeapon?.damageFormula ?? '1d3',
      defenderDamageBonusFormula: defender.damageBonus ?? '0',
      defenderDamageType: selectedWeapon?.damageType ?? 'blunt',
      defenderArmor,
      attackerArmor: attack?.attacker.armor ?? 0,
      defenderMaxHp: defender.maxHp ?? defender.hp,
      attackerMaxHp: attack?.attacker.maxHp ?? attack?.attacker.hp ?? 10,
      maneuverType: choice === 'maneuver' ? selectedManeuver : undefined,
      attackerBuild,
      defenderBuild,
      convention,
    });

    const damageDealt = engagement.damage?.effectiveDamage ?? 0;
    const defenderHpBefore = defender.hp;
    let defenderHpAfter = defenderHpBefore;
    const attackerHpBefore = attack?.attacker.hp ?? 10;
    let attackerHpAfter = attackerHpBefore;
    let hasMajorWound = Boolean(defender.hasMajorWound);
    let isDead = false;

    if (engagement.damageDealtTo === 'defender' && damageDealt > 0) {
      const conRoll = rollD100();
      const healthState = applyCombatDamage({
        hp: defender.hp,
        maxHp: defender.maxHp ?? defender.hp,
        con: defender.con ?? 50,
        damage: damageDealt,
        hadMajorWound: defender.hasMajorWound,
        conRoll,
        convention,
      });
      defenderHpAfter = healthState.hpAfter;
      hasMajorWound = healthState.hasMajorWound;
      isDead = healthState.isDead;

      if (onCharacterUpdate) {
        onCharacterUpdate({
          ...defender,
          hp: defenderHpAfter,
          hasMajorWound,
          isUnconscious: healthState.isUnconscious,
          isDying: healthState.isDying,
          isDead: healthState.isDead,
        });
      }
    } else if (engagement.damageDealtTo === 'attacker' && damageDealt > 0) {
      attackerHpAfter = Math.max(0, attackerHpBefore - damageDealt);
    }

    let summaryText = '';
    if (choice === 'dodge') {
      summaryText =
        engagement.winner === 'defender'
          ? t('resultDodgeSuccess')
          : t('resultAttackerHits');
    } else if (choice === 'fight_back') {
      summaryText =
        engagement.winner === 'defender'
          ? t('resultCounterSuccess')
          : engagement.winner === 'attacker'
          ? t('resultAttackerHits')
          : t('resultBothMiss');
    } else {
      summaryText =
        engagement.winner === 'defender'
          ? `${t('actionManeuver')}: ${t(
              selectedManeuver === 'disarm'
                ? 'maneuverDisarm'
                : selectedManeuver === 'grapple'
                ? 'maneuverGrapple'
                : 'maneuverKnockdown'
            )} - ${t('outcomeRegular')}`
          : t('resultAttackerHits');
    }

    const state: OpposedMeleeResolutionState = {
      choice,
      maneuverType: selectedManeuver,
      weaponUsed: selectedWeapon,
      attackerRoll,
      attackerOutcome: engagement.attackerOutcome,
      defenderRoll,
      defenderOutcome: engagement.defenderOutcome,
      winner: engagement.winner,
      damageDealtTo: engagement.damageDealtTo,
      effectiveDamage: damageDealt,
      damageDiceResults: engagement.damage?.diceResults,
      damageDiceFormula: engagement.damage?.diceFormula,
      defenderHpBefore,
      defenderHpAfter,
      attackerHpBefore,
      attackerHpAfter,
      isMajorWound: hasMajorWound && !defender.hasMajorWound,
      isDefenderDead: isDead,
      summaryText,
    };

    setResultState(state);
    setIsResolved(true);

    if (onResolveDefense) {
      onResolveDefense(attack || opposedEvent!, choice, selectedWeapon, selectedManeuver);
    }

    // Wyślij raport diegetyczny dla MG (tag WYNIK_WALKI jest filtrowany przed TTS i graczem)
    if (onSendChat) {
      const chatReport = `[WYNIK_WALKI: id=${eventId} | napastnik=${attackerName} | cel=${defender.name} | reakcja=${choice} | rzut_napastnika=${attackerRoll} (${engagement.attackerOutcome}) | rzut_obrońcy=${defenderRoll} (${engagement.defenderOutcome}) | zwyciezca=${engagement.winner} | obrazenia=${damageDealt} | cel_ran=${engagement.damageDealtTo}]\n${summaryText}`;
      onSendChat(chatReport);
    }
  };

  return (
    <Card data-testid="opposed-melee-card" className="deco-window my-3 overflow-hidden border border-brass/50 bg-card/95 text-foreground shadow-deco backdrop-blur-sm">
      {/* Nagłówek klimatyczny Dark Art Déco */}
      <div className="border-b border-brass/20 bg-gradient-to-r from-brass/15 via-background/40 to-brass/10 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-destructive animate-pulse" />
            <span className="font-display text-sm uppercase tracking-widest text-brass">
              {t('cardTitle')}
            </span>
            <Badge variant="outline" className="text-[10px] border-border/50 text-muted-foreground hidden sm:inline-flex">
              d100 Weird Fiction s. 102
            </Badge>
          </div>
          {effectiveResolved ? (
            <Badge className="border-emerald-500/40 bg-emerald-500/20 font-mono text-xs text-emerald-300">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              {t('statusResolved')}
            </Badge>
          ) : (
            <Badge className="border-destructive/40 bg-destructive/20 font-mono text-xs text-destructive-foreground animate-pulse">
              <ShieldAlert className="mr-1 h-3 w-3 text-destructive" />
              {attackerWeaponName}
            </Badge>
          )}
        </div>

        {/* Opis sytuacji w świecie gry */}
        <div className="mt-2 space-y-1">
          <p className="font-serif text-lg font-medium text-foreground">
            <strong className="text-destructive">{attackerName}</strong>{' '}
            {t('incomingAttackWithWeapon', {
              attacker: '',
              weapon: attackerWeaponName,
            }).replace(/^:\s*/, '')}
          </p>
          {attackIntent && (
            <p className="font-serif text-lg italic text-muted-foreground">
              „{attackIntent}”
            </p>
          )}
        </div>

        {/* Ostrzeżenie o przewadze liczebnej */}
        {outnumbered.isOutnumbered && !effectiveResolved && (
          <div className="mt-2 flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>{t('outnumberedWarning')}</span>
          </div>
        )}
      </div>

      <CardContent className="space-y-4 p-4">
        {/* Stan 1: Opcje obrony (gdy starcie czeka na decyzję) */}
        {!effectiveResolved && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* Opcja 1: Zwinny Unik (Dodge) */}
            <div className="flex flex-col justify-between rounded-lg border border-primary/60 bg-primary/10 p-3.5 transition-all hover:border-primary/60">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-display text-sm font-semibold text-primary">
                    <Footprints className="h-4 w-4" />
                    {t('dodgeTitle')}
                  </span>
                  <Badge className="border-primary/60 bg-primary/10 font-mono text-xs text-primary">
                    {dodgeSkill}%
                  </Badge>
                </div>
                <p className="font-serif text-xs text-muted-foreground leading-relaxed">
                  {t('dodgeLore')}
                </p>
                <div className="border-t border-primary/60 pt-1.5 text-[11px] font-mono text-primary">
                  {t('dodgeThresholds', {
                    regular: dodgeSkill,
                    hard: Math.floor(dodgeSkill / 2),
                    extreme: Math.floor(dodgeSkill / 5),
                  })}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled || !canAct}
                onClick={() => handleExecuteDefense('dodge')}
                className="mt-3 w-full border-primary/60 text-primary hover:bg-primary/10 hover:text-primary"
              >
                {t('dodgeButton')}
              </Button>
            </div>

            {/* Opcja 2: Wejście w Zwarcie / Kontratak (Fight Back) */}
            <div className="flex flex-col justify-between rounded-lg border border-rose-500/40 bg-rose-950/20 p-3.5 transition-all hover:border-rose-500/70">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-display text-sm font-semibold text-rose-400">
                    <Swords className="h-4 w-4" />
                    {t('fightBackTitle')}
                  </span>
                  <Badge className="border-rose-500/40 bg-rose-500/15 font-mono text-xs text-rose-300">
                    {selectedWeapon?.skillValue ?? brawlSkill}%
                  </Badge>
                </div>
                <p className="font-serif text-xs text-muted-foreground leading-relaxed">
                  {t('fightBackLore')}
                </p>

                {/* Wybór broni */}
                <div className="space-y-1 pt-1">
                  <label
                    htmlFor={`weapon-select-${eventId}`}
                    className="block text-[11px] font-serif text-muted-foreground"
                  >
                    {t('weaponSelectLabel')}:
                  </label>
                  <select
                    id={`weapon-select-${eventId}`}
                    value={selectedWeaponId}
                    onChange={(e) => setSelectedWeaponId(e.target.value)}
                    className="w-full rounded border border-rose-500/30 bg-background/90 px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    {weapons.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.id === 'unarmed' ? t('unarmed') : w.name} ({w.skillValue}%, {w.damageFormula})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                size="sm"
                disabled={disabled || !canAct}
                onClick={() => handleExecuteDefense('fight_back')}
                className="mt-3 w-full bg-rose-600 font-medium text-white hover:bg-rose-500 shadow-sm"
              >
                {t('fightBackButton')}
              </Button>
            </div>

            {/* Opcja 3: Manewr Taktyczny (Fighting Maneuver) */}
            <div className="flex flex-col justify-between rounded-lg border border-brass/50 bg-brass/10 p-3.5 transition-all hover:border-brass/50">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-display text-sm font-semibold text-brass">
                    <ShieldAlert className="h-4 w-4" />
                    {t('maneuverTitle')}
                  </span>
                  <Badge className="border-brass/50 bg-brass/10 font-mono text-xs text-brass">
                    {brawlSkill}%
                  </Badge>
                </div>

                {!maneuverCheck.allowed ? (
                  <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive-foreground">
                    {t('maneuverBuildBlocked')}
                  </div>
                ) : (
                  <>
                    <p className="font-serif text-xs text-muted-foreground leading-relaxed">
                      {t('maneuverLore')}
                    </p>
                    {maneuverCheck.penaltyDice > 0 && (
                      <p className="text-[11px] font-mono text-brass">
                        {t('maneuverPenaltyWarn', {
                          buildDiff: maneuverCheck.buildDifference,
                          penalty: maneuverCheck.penaltyDice,
                        })}
                      </p>
                    )}
                    <div className="flex gap-1.5 pt-1">
                      {(['knockdown', 'disarm', 'grapple'] as ManeuverType[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSelectedManeuver(type)}
                          className={`flex-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                            selectedManeuver === type
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border/60 text-muted-foreground hover:bg-background'
                          }`}
                        >
                          {t(
                            type === 'disarm'
                              ? 'maneuverDisarm'
                              : type === 'grapple'
                              ? 'maneuverGrapple'
                              : 'maneuverKnockdown'
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled || !canAct || !maneuverCheck.allowed}
                onClick={() => handleExecuteDefense('maneuver')}
                className="mt-3 w-full border-brass/50 text-brass hover:bg-brass/10 hover:text-brass"
              >
                {t('maneuverButton')}
              </Button>
            </div>
          </div>
        )}

        {/* Stan 2: Wizualizacja rozstrzygnięcia, kości K100 i obrażeń */}
        {effectiveResolved && resultState && (
          <div className="space-y-3 rounded-lg border border-brass/30 bg-background/60 p-4">
            {/* Werdykt starcia */}
            <div className="flex items-center gap-2 font-display text-sm font-semibold">
              {resultState.winner === 'defender' ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>{resultState.summaryText}</span>
                </div>
              ) : resultState.damageDealtTo === 'defender' ? (
                <div className="flex items-center gap-2 text-destructive">
                  <Skull className="h-5 w-5" />
                  <span>{resultState.summaryText}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldAlert className="h-5 w-5" />
                  <span>{resultState.summaryText}</span>
                </div>
              )}
            </div>

            {/* Tabela kości (Dice Breakdown) */}
            <div className="grid grid-cols-1 gap-2.5 rounded-md border border-brass/20 bg-card/60 p-3 sm:grid-cols-2 text-xs font-mono">
              {/* Napastnik */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="font-serif">{attackerName}</span>
                  <span>{attackerSkill}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Dices className="h-4 w-4 text-destructive" />
                  <span className="text-base font-bold text-foreground">
                    K100: {resultState.attackerRoll}
                  </span>
                  {getOutcomeBadge(resultState.attackerOutcome)}
                </div>
              </div>

              {/* Badacz */}
              <div className="space-y-1 border-t border-border/40 pt-2 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-3">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="font-serif">{defender?.name || t('targetLabel', { target: '' })}</span>
                  <span>
                    {resultState.choice === 'dodge'
                      ? `${dodgeSkill}%`
                      : `${resultState.weaponUsed?.skillValue ?? brawlSkill}%`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Dices className="h-4 w-4 text-primary" />
                  <span className="text-base font-bold text-foreground">
                    K100: {resultState.defenderRoll}
                  </span>
                  {getOutcomeBadge(resultState.defenderOutcome)}
                </div>
              </div>
            </div>

            {/* Skutki i bilans zdrowia */}
            <div className="space-y-1.5 pt-1 text-xs">
              {resultState.effectiveDamage > 0 && (
                <div className="flex items-center justify-between font-serif">
                  <span className="text-muted-foreground">
                    {resultState.damageDealtTo === 'defender'
                      ? t('healthStatePlayer', {
                          before: resultState.defenderHpBefore,
                          after: resultState.defenderHpAfter,
                        })
                      : t('healthStateEnemy', {
                          before: resultState.attackerHpBefore,
                          after: resultState.attackerHpAfter,
                        })}
                  </span>
                  <Badge className="border-destructive/40 bg-destructive/20 font-mono text-destructive-foreground">
                    <HeartPulse className="mr-1 h-3 w-3" />
                    {t('damageDealtLabel', { damage: resultState.effectiveDamage })}
                  </Badge>
                </div>
              )}
              {resultState.damageDiceResults?.length ? (
                <PhysicalDiceScene
                  dice={traceForDice(
                    `d${Number(resultState.damageDiceFormula?.match(/d(3|4|6|8|10|12|20)\b/i)?.[1])}` as PhysicalDieType,
                    resultState.damageDiceResults,
                    resultState.damageDiceResults.reduce((sum, value) => sum + value, 0),
                    'opposed-melee-damage'
                  ).dice}
                  label={resultState.damageDiceFormula ?? 'damage'}
                />
              ) : null}

              {/* Alerty stanów krytycznych */}
              {resultState.isMajorWound && (
                <div className="rounded border border-destructive/50 bg-destructive/15 p-2 text-xs font-semibold text-destructive-foreground">
                  {t('majorWoundAlert')}
                </div>
              )}
              {resultState.isDefenderDead && (
                <div className="rounded border border-destructive bg-destructive/25 p-2 text-xs font-bold text-destructive-foreground">
                  {t('dyingAlert')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stan 3: Wizualizacja rozstrzygnięcia historycznego (bez szczegółów rzutu w sesji) */}
        {effectiveResolved && !resultState && (
          <div className="rounded-lg border border-brass/20 bg-background/40 p-4 text-center text-xs text-muted-foreground font-serif">
            <div className="flex items-center justify-center gap-2 text-emerald-400 mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-semibold">{t('defenseResolved')}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{t('rulebookTieReminder')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default OpposedMeleeCard;
