'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getLocalizedSkillName } from '@/lib/data/character';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Character, SkillData } from '@/lib/types';
import { getMarkedSkills } from '@/lib/skill-migration';
import {
  characterDevelopment,
  DevelopmentRollResult,
  EDURollResult,
} from '@/lib/character-development';
import {
  GraduationCap,
  Dices,
  Check,
  X,
  Sparkles,
  Heart,
  Clover,
  Brain,
} from 'lucide-react';

interface DevelopmentPhaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character;
  onCharacterUpdate: (char: Character) => void;
  characters?: Character[];
  onActiveCharacterChange?: (char: Character) => void;
}

/** Separator déco - gradient-linie + obrócony romb. */
function DecoSeparator() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gold" />
      <span className="w-1.5 h-1.5 bg-brass rotate-45" />
      <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gold" />
    </div>
  );
}

/**
 * Development Phase Modal (CoC 7e - purystyczne zasady)
 *
 * Implementuje oficjalne zasady rozwoju (Faza Rozwoju, str. 105-106):
 * 1. Rzut K100 dla każdej oznaczonej umiejętności
 *    - Sukces gdy K100 > aktualna wartość LUB > 95 -> +1K10
 * 2. Bonus Poczytalności za mistrzostwo
 *    - Osiągnięcie 90%+ w umiejętności -> +2K6 PR
 *
 * Uwaga: rozwój Wykształcenia (EDU) NIE jest częścią Fazy Rozwoju per sesja.
 * W CoC 7e test rozwoju WYK następuje przy tworzeniu postaci wg wieku
 * (patrz character-wizard) oraz przy starzeniu się (co dekadę życia).
 */
export function DevelopmentPhaseModal({
  isOpen,
  onClose,
  character,
  onCharacterUpdate,
  characters = [],
  onActiveCharacterChange,
}: DevelopmentPhaseModalProps) {
  const t = useTranslations('DevelopmentPhaseModal');
  const locale = useLocale();
  const [skillResults, setSkillResults] = useState<DevelopmentRollResult[]>([]);
  const [luckResult, setLuckResult] = useState<EDURollResult | null>(null);
  const [selfHelpAspect, setSelfHelpAspect] = useState('');
  const [sanRecovered, setSanRecovered] = useState<number | null>(null);
  const [phase, setPhase] = useState<
    'ready' | 'rolling_skills' | 'rolling_luck' | 'done'
  >('ready');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Pobierz oznaczone umiejętności
  const markedSkills = getMarkedSkills(character);

  // Reset state when modal opens or active character changes
  useEffect(() => {
    if (isOpen) {
      setSkillResults([]);
      setLuckResult(null);
      setSelfHelpAspect('');
      setSanRecovered(null);
      setPhase('ready');
      setCurrentIndex(0);
    }
  }, [isOpen, character.id]);

  /**
   * Przeprowadza pełną fazę rozwoju
   */
  const runDevelopmentPhase = async () => {
    const newResults: DevelopmentRollResult[] = [];
    const updatedCharacter = { ...character };
    const updatedSkills = { ...character.skills };

    // === FAZA 1: Rzuty na umiejętności (jeśli są oznaczone) ===
    if (markedSkills.length > 0) {
      setPhase('rolling_skills');
      for (let i = 0; i < markedSkills.length; i++) {
        const skill = markedSkills[i];
        setCurrentIndex(i);

        // Animacja - pauza między rzutami
        await new Promise((r) => setTimeout(r, 800));

        const result = characterDevelopment.rollSkillDevelopment(
          skill.name,
          skill.value
        );

        if (result.success && result.newValue !== undefined) {
          // Zaktualizuj wartość umiejętności
          const currentSkill = updatedSkills[skill.name];
          const currentSkillData: SkillData =
            typeof currentSkill === 'number'
              ? { value: currentSkill, markedForImprovement: false }
              : currentSkill;

          updatedSkills[skill.name] = {
            ...currentSkillData,
            value: result.newValue,
            markedForImprovement: false,
            improvementHistory: [
              ...(currentSkillData.improvementHistory || []),
              {
                date: new Date(),
                oldValue: skill.value,
                newValue: result.newValue,
                method: 'development_phase' as const,
                rollValue: result.roll,
                improvementRoll: result.improvement,
              },
            ],
          };

          // Bonus SAN za mistrzostwo (90%+) z pułapem 99 - Mity Cthulhu
          if (result.sanityBonus) {
            const mythosSkill = character.skills['Mity Cthulhu'] || character.skills['Cthulhu Mythos'];
            const mythosValue =
              typeof mythosSkill === 'object' && mythosSkill !== null
                ? mythosSkill.value
                : Number(mythosSkill || 0);
            const maxSan = Math.max(0, 99 - mythosValue);
            updatedCharacter.san = Math.min(
              maxSan,
              (updatedCharacter.san || 0) + result.sanityBonus
            );
          }
        } else {
          // Przy porażce tylko czyścimy oznaczenie
          const currentSkill = updatedSkills[skill.name];
          if (typeof currentSkill !== 'number') {
            updatedSkills[skill.name] = {
              ...currentSkill,
              markedForImprovement: false,
            };
          }
        }

        newResults.push(result);
        setSkillResults([...newResults]);
      }
    }

    // === FAZA 2: Odzyskanie Szczęścia (CoC 7e, str. 110-111) ===
    setPhase('rolling_luck');
    await new Promise((r) => setTimeout(r, 1000));
    const luckRoll = characterDevelopment.rollLuckRecovery(character.luck || 0);
    setLuckResult(luckRoll);
    if (luckRoll.success && luckRoll.newValue !== undefined) {
      updatedCharacter.luck = luckRoll.newValue;
    }

    // === Zapisz zmiany ===
    updatedCharacter.skills = updatedSkills;
    updatedCharacter.luckSpentThisSession = 0; // Reset wydanego Szczęścia

    // Dodaj wpis do historii rozwoju
    const successfulSkills = newResults.filter((r) => r.success);
    const entries: Character['developmentHistory'] = [];

    if (successfulSkills.length > 0) {
      entries.push({
        id: `dev_skills_${Date.now()}`,
        timestamp: new Date(),
        type: 'special' as const,
        target: 'Development Phase',
        oldValue: 0,
        newValue: successfulSkills.reduce(
          (sum, r) => sum + (r.improvement || 0),
          0
        ),
        xpCost: 0,
        description: t('historySkillsDescription', {
          skills: successfulSkills
            .map((r) => `${r.skillName} +${r.improvement}`)
            .join(', '),
        }),
      });
    }

    // SAN bonus entries
    const sanBonusResults = newResults.filter((r) => r.sanityBonus);
    for (const r of sanBonusResults) {
      entries.push({
        id: `san_mastery_${Date.now()}_${r.skillName}`,
        timestamp: new Date(),
        type: 'attribute' as const,
        target: t('historyMasteryTarget'),
        oldValue: character.san || 0,
        newValue: updatedCharacter.san,
        xpCost: 0,
        description: t('historyMasteryDescription', {
          bonus: r.sanityBonus ?? 0,
          skill: r.skillName,
        }),
      });
    }

    if (luckRoll.success && luckRoll.newValue !== undefined) {
      entries.push({
        id: `luck_recovery_${Date.now()}`,
        timestamp: new Date(),
        type: 'attribute' as const,
        target: t('historyLuckTarget'),
        oldValue: luckRoll.oldValue,
        newValue: luckRoll.newValue,
        xpCost: 0,
        description: t('historyLuckDescription', {
          old: luckRoll.oldValue,
          new: luckRoll.newValue,
          roll: luckRoll.roll,
        }),
      });
    }

    if (entries.length > 0) {
      updatedCharacter.developmentHistory = [
        ...updatedCharacter.developmentHistory,
        ...entries,
      ];
    }

    onCharacterUpdate(updatedCharacter);
    setPhase('done');
  };

  /**
   * Samopomoc - odzyskanie Poczytalności (CoC 7e, str. 186-187).
   * Mechanika CoC 7e: rzut 1K6 PR za zaangażowanie w aspekt historii.
   * Czyta aktualny stan postaci (po automatycznych rzutach z Fazy Rozwoju).
   */
  const applySelfHelp = () => {
    if (!selfHelpAspect.trim() || sanRecovered !== null) return;
    const recovered = characterDevelopment.rollSanityRecovery();
    const mythosSkill = character.skills['Mity Cthulhu'] || character.skills['Cthulhu Mythos'];
    const mythosValue =
      typeof mythosSkill === 'object' && mythosSkill !== null
        ? mythosSkill.value
        : Number(mythosSkill || 0);
    const maxSan = character.maxSan ?? Math.max(0, 99 - mythosValue);
    const oldSan = character.san || 0;
    const newSan = Math.min(maxSan, oldSan + recovered);
    const actualGain = newSan - oldSan;
    setSanRecovered(actualGain);

    onCharacterUpdate({
      ...character,
      san: newSan,
      developmentHistory: [
        ...character.developmentHistory,
        {
          id: `self_help_${Date.now()}`,
          timestamp: new Date(),
          type: 'attribute' as const,
          target: t('historySelfHelpTarget'),
          oldValue: oldSan,
          newValue: newSan,
          xpCost: 0,
          description: t('historySelfHelpDescription', {
            aspect: selfHelpAspect.trim(),
            gain: actualGain,
            roll: recovered,
          }),
        },
      ],
    });
  };

  /**
   * Oblicza łączny przyrost punktów
   */
  const totalSkillImprovement = skillResults
    .filter((r) => r.success)
    .reduce((sum, r) => sum + (r.improvement || 0), 0);

  const skillSuccessCount = skillResults.filter((r) => r.success).length;
  const sanBonusTotal = skillResults
    .filter((r) => r.sanityBonus)
    .reduce((sum, r) => sum + (r.sanityBonus || 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="screen">
        {/* Nagłówek déco - eyebrow + tytuł Cinzel + opis serif italic */}
        <DialogHeader className="text-center sm:text-center mb-1">
          <div className="font-special-elite text-[14px] uppercase tracking-[0.36em] text-primary">
            {t('eyebrow')}
          </div>
          <DialogTitle className="font-display-decorative text-2xl uppercase tracking-[0.1em] text-foreground flex items-center justify-center gap-2 pt-1">
            <GraduationCap className="w-5 h-5 text-brass" />
            {t('title')}
          </DialogTitle>
          <DialogDescription className="font-serif italic text-base text-muted-foreground">
            {t('subtitle')}
          </DialogDescription>

          {/* Przełącznik postaci w duecie / multiplayer */}
          {characters.length > 1 && onActiveCharacterChange && (
            <div className="mt-3 flex justify-center">
              <select
                aria-label={t('selectCharacterAria')}
                value={character.id || ''}
                onChange={(e) => {
                  const selected = characters.find(
                    (c) => c.id === e.target.value
                  );
                  if (selected) {
                    onActiveCharacterChange(selected);
                  }
                }}
                disabled={phase !== 'ready' && phase !== 'done'}
                className="appearance-none bg-card border border-brass/40 rounded-none px-4 py-2 pr-10 text-sm text-foreground cursor-pointer hover:border-brass/70 transition-colors focus:outline-none focus:ring-1 focus:ring-brass/50 font-special-elite"
              >
                {characters.map((char) => {
                  const skillsCount = getMarkedSkills(char).length;
                  return (
                    <option key={char.id} value={char.id}>
                      {char.name} ({t('markedSkillsCount', { count: skillsCount })})
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </DialogHeader>

        {phase === 'ready' && (
          <div className="space-y-4">
            {markedSkills.length === 0 ? (
              // IND-268: wersja edukacyjna gdy 0 oznaczonych umiejętności.
              // Zamiast "martwego wejścia" (przycisk Rozpocznij, który robił
              // tylko odzysk Szczęścia bez rozwoju) - tłumaczymy nowicjuszowi
              // JAK działa rozwój postaci i KIEDY ta faza będzie dostępna.
              <div className="space-y-4">
                <div className="relative border border-brass/30 bg-gradient-to-br from-[#1a1610] to-[#100d09] p-4 space-y-3">
                  <span className="absolute top-2 left-2 w-3 h-3 border-t border-l border-brass/50" />
                  <span className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-brass/50" />
                  <p className="font-special-elite text-sm uppercase tracking-[0.12em] text-foreground flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <strong>{t('nothingToDevelop')}</strong>
                  </p>
                  <p className="font-serif italic text-base text-muted-foreground">
                    {t('nothingToDevelopPre')}
                    <strong className="text-primary not-italic">
                      {t('nothingToDevelopMarked')}
                    </strong>
                    {t('nothingToDevelopPost')}
                  </p>

                  <div className="border border-brass/25 bg-[#16130f] p-3">
                    <p className="font-display uppercase tracking-[0.16em] text-xs font-semibold text-brass mb-2">
                      {t('howToTitle')}
                    </p>
                    <ol className="font-serif text-base text-foreground/90 space-y-1.5 list-decimal list-inside">
                      <li>
                        {t('howToStep1Pre')}{' '}
                        <strong className="text-primary">{t('howToStep1Marked')}</strong>{' '}
                        {t('howToStep1Post')}
                      </li>
                      <li>
                        {t('howToStep2Pre')}{' '}
                        <strong className="text-primary">
                          {t('howToStep2Marked')}
                        </strong>{' '}
                        {t('howToStep2Post')}
                      </li>
                      <li>
                        {t('howToStep3Pre')}{' '}
                        <strong className="text-primary">{t('howToStep3Marked')}</strong>{' '}
                        {t('howToStep3Post')}
                      </li>
                    </ol>
                  </div>

                  <div className="border border-brass/35 bg-[rgba(201,162,39,0.08)] p-3 text-foreground/90 text-sm font-serif">
                    <p className="flex items-center gap-2 font-semibold text-brass mb-1">
                      <Clover className="w-4 h-4 text-gold" />
                      {t('luckRecoveryAvailableTitle')}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t('luckRecoveryAvailableDesc')}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <Button
                    onClick={runDevelopmentPhase}
                    className="flex-1 font-display font-semibold uppercase tracking-[0.14em] text-[#04110f] bg-primary border border-primary hover:brightness-110 shadow-md flex items-center justify-center gap-2 py-2"
                  >
                    <Clover className="w-4 h-4" />
                    {t('startLuckRecoveryButton')}
                  </Button>
                  <Button
                    onClick={onClose}
                    variant="outline"
                    className="font-display font-semibold uppercase tracking-[0.14em] border-brass/40 text-muted-foreground hover:bg-brass/10 hover:text-foreground"
                  >
                    {t('close')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="font-serif italic text-base text-muted-foreground text-center">
                  {t('markedPre')}{' '}
                  <span className="font-special-elite not-italic text-primary font-bold">
                    {markedSkills.length}
                  </span>{' '}
                  {t('markedPost')}
                </p>

                <DecoSeparator />

                {/* Lista umiejętności do rozwoju jako kafle déco */}
                <div className="flex flex-col gap-2.5">
                  {markedSkills.map((skill) => (
                    <div
                      key={skill.name}
                      className="flex items-center justify-between border border-primary/40 bg-[rgba(13,148,136,0.06)] px-4 py-3"
                    >
                      <span className="font-serif text-lg text-foreground flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-primary" />
                        {getLocalizedSkillName(skill.name, locale)}
                      </span>
                      <span className="font-special-elite text-sm text-muted-foreground">
                        {skill.value}%
                      </span>
                    </div>
                  ))}
                </div>

                <div className="relative border border-brass/30 bg-gradient-to-br from-[#1a1610] to-[#100d09] p-4">
                  <span className="absolute top-2 left-2 w-3 h-3 border-t border-l border-brass/50" />
                  <span className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-brass/50" />
                  <p className="font-serif text-base text-muted-foreground">
                    <strong className="font-display uppercase tracking-[0.14em] text-xs text-brass">
                      {t('rulesLabel')}
                    </strong>{' '}
                    {t('rulesPre')}{' '}
                    <strong className="text-primary">{t('rulesHigher')}</strong>{' '}
                    {t('rulesPost')}
                  </p>
                  <p className="font-serif italic text-sm text-muted-foreground mt-2">
                    {t('lowSkillHint')}
                  </p>
                  <p className="font-special-elite text-xs uppercase tracking-[0.1em] text-brass mt-3 flex items-center gap-1.5">
                    <Heart className="w-3 h-3 inline text-brass" />
                    {t('masteryBonus')}
                  </p>
                  {/* IND-268: jasny komunikat o odzysku Szczęścia - koniec
                  "odzyskało mi się Szczęście, nie wiem czemu". */}
                  <p className="font-serif italic text-sm text-muted-foreground mt-2 flex items-start gap-1.5">
                    <Clover className="w-3.5 h-3.5 inline mt-0.5 shrink-0 text-primary not-italic" />
                    <span>
                      {t('luckInfoPre')}{' '}
                      <strong className="not-italic text-foreground/90">
                        {t('luckInfoMarked')}
                      </strong>{' '}
                      {t('luckInfoPost')}
                    </span>
                  </p>
                </div>

                <Button
                  onClick={runDevelopmentPhase}
                  className="w-full font-display font-semibold uppercase tracking-[0.16em] text-[#04110f] bg-primary border border-primary hover:brightness-110 animate-emerald-pulse"
                >
                  <Dices className="w-4 h-4 mr-2" />
                  {t('startButton')}
                </Button>
              </>
            )}
          </div>
        )}

        {(phase === 'rolling_skills' ||
          phase === 'rolling_luck' ||
          phase === 'done') && (
          <div className="space-y-3">
            {/* Skill results - kafle déco z akcentem emerald (sukces) lub złotem (bez zmian) */}
            {skillResults.map((result, i) => (
              <div
                key={i}
                className={`px-4 py-3 border transition-all ${
                  result.success
                    ? 'border-primary/40 bg-[rgba(13,148,136,0.06)] shadow-[0_0_14px_rgba(13,148,136,0.12)]'
                    : 'border-brass/20 bg-[#16130f] opacity-80'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-serif text-lg text-foreground flex items-center gap-2">
                    {result.success ? (
                      <Sparkles className="w-4 h-4 text-brass" />
                    ) : (
                      <X className="w-4 h-4 text-muted-foreground" />
                    )}
                    {getLocalizedSkillName(result.skillName, locale)}
                  </span>
                  <span className="font-special-elite text-sm">
                    <span
                      className={
                        result.success ? 'text-primary' : 'text-destructive'
                      }
                    >
                      {result.roll}
                    </span>
                    <span className="text-muted-foreground mx-1">vs</span>
                    <span className="text-muted-foreground">
                      {result.oldValue}
                    </span>
                  </span>
                </div>

                {result.success ? (
                  <div className="space-y-1 mt-1.5">
                    <div className="font-special-elite text-sm text-primary flex items-center gap-2">
                      <Check className="w-3 h-3" />
                      {t('successImprovement', {
                        improvement: result.improvement ?? 0,
                        newValue: String(result.newValue),
                      })}
                    </div>
                    {result.sanityBonus && (
                      <div className="font-special-elite text-sm text-brass flex items-center gap-2">
                        <Heart className="w-3 h-3" />
                        {t('masteryLine', { bonus: result.sanityBonus })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="font-serif italic text-sm text-muted-foreground mt-1">
                    {t('noChange')}
                  </div>
                )}
              </div>
            ))}

            {/* Rolling animation for skills */}
            {phase === 'rolling_skills' &&
              currentIndex < markedSkills.length && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-bounce text-primary">
                    <Dices className="w-8 h-8" />
                  </div>
                  <span className="ml-3 font-special-elite text-sm uppercase tracking-[0.1em] text-muted-foreground">
                    {t('rollingFor', {
                      name: markedSkills[currentIndex]?.name ?? '',
                    })}
                  </span>
                </div>
              )}

            {/* Odzyskanie Szczęścia (Faza 2) */}
            {phase === 'rolling_luck' && !luckResult && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-bounce text-brass">
                  <Clover className="w-8 h-8" />
                </div>
                <span className="ml-3 font-special-elite text-sm uppercase tracking-[0.1em] text-muted-foreground">
                  {t('luckRolling')}
                </span>
              </div>
            )}

            {luckResult && (
              <div
                className={`px-4 py-3 border transition-all ${
                  luckResult.success
                    ? 'border-brass/45 bg-[rgba(201,162,39,0.06)] shadow-[0_0_14px_rgba(201,162,39,0.1)]'
                    : 'border-brass/20 bg-[#16130f] opacity-80'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-serif text-lg text-foreground flex items-center gap-2">
                    <Clover className="w-4 h-4 text-brass" />
                    {t('luckLabel')}
                  </span>
                  <span className="font-special-elite text-sm">
                    <span
                      className={
                        luckResult.success ? 'text-brass' : 'text-destructive'
                      }
                    >
                      {luckResult.roll}
                    </span>
                    <span className="text-muted-foreground mx-1">vs</span>
                    <span className="text-muted-foreground">
                      {luckResult.oldValue}
                    </span>
                  </span>
                </div>
                {luckResult.success ? (
                  <div className="font-special-elite text-sm text-brass mt-1.5 flex items-center gap-2">
                    <Check className="w-3 h-3" />
                    {t('luckRecovered', {
                      improvement: luckResult.improvement ?? 0,
                      newValue: String(luckResult.newValue),
                    })}
                  </div>
                ) : (
                  <div className="font-serif italic text-sm text-muted-foreground mt-1">
                    {t('noChange')}
                  </div>
                )}
              </div>
            )}

            {phase === 'done' && (
              <div className="space-y-4 mt-4">
                <DecoSeparator />

                <div className="relative border border-brass/30 bg-gradient-to-br from-[#1a1610] to-[#100d09] p-4">
                  <span className="absolute top-2 left-2 w-3 h-3 border-t border-l border-brass/50" />
                  <span className="absolute top-2 right-2 w-3 h-3 border-t border-r border-brass/50" />
                  <span className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-brass/50" />
                  <span className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-brass/50" />
                  <h4 className="font-display uppercase tracking-[0.16em] text-xs font-semibold text-brass mb-3 text-center">
                    {t('summaryTitle')}
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="border border-primary/30 bg-[#0e1413] p-3">
                      <div className="font-display-decorative text-2xl font-bold text-primary">
                        {skillSuccessCount}/{markedSkills.length}
                      </div>
                      <div className="font-special-elite text-xs uppercase tracking-[0.1em] text-muted-foreground mt-1">
                        {t('successfulRolls')}
                      </div>
                    </div>
                    <div className="border border-brass/30 bg-[#16130f] p-3">
                      <div className="font-display-decorative text-2xl font-bold text-brass">
                        +{totalSkillImprovement}
                      </div>
                      <div className="font-special-elite text-xs uppercase tracking-[0.1em] text-muted-foreground mt-1">
                        {t('developmentPoints')}
                      </div>
                    </div>
                  </div>
                  {sanBonusTotal > 0 && (
                    <div className="mt-3 text-center">
                      <div className="font-display text-lg font-bold text-brass">
                        <Heart className="w-4 h-4 inline mr-1" />
                        {t('sanityGain', { total: sanBonusTotal })}
                      </div>
                      <div className="font-special-elite text-xs uppercase tracking-[0.1em] text-brass/70">
                        {t('masteryCaption')}
                      </div>
                    </div>
                  )}
                  {luckResult?.success && (
                    <div className="mt-3 text-center">
                      <div className="font-display text-lg font-bold text-brass">
                        <Clover className="w-4 h-4 inline mr-1" />
                        {t('luckGain', {
                          improvement: luckResult.improvement ?? 0,
                        })}
                      </div>
                      <div className="font-special-elite text-xs uppercase tracking-[0.1em] text-brass/70">
                        {t('luckCaption')}
                      </div>
                    </div>
                  )}
                </div>

                {/* Samopomoc - odzyskanie Poczytalności (CoC 7e str. 185) */}
                <div className="relative border-l-2 border-l-brass/50 border border-brass/25 bg-[#16130f] p-4 space-y-2">
                  <p className="font-special-elite text-sm uppercase tracking-[0.12em] text-foreground flex items-center gap-2">
                    <Brain className="w-4 h-4 text-brass" />
                    <strong>{t('selfHelpLabel')}</strong> {t('selfHelpSuffix')}
                  </p>
                  <p className="font-serif italic text-sm text-muted-foreground">
                    {t('selfHelpDesc')}
                  </p>
                  {sanRecovered === null ? (
                    <>
                      <Textarea
                        value={selfHelpAspect}
                        onChange={(e) => setSelfHelpAspect(e.target.value)}
                        placeholder={t('selfHelpPlaceholder')}
                        className="font-serif text-base min-h-[60px]"
                      />
                      <Button
                        onClick={applySelfHelp}
                        disabled={!selfHelpAspect.trim()}
                        className="w-full font-display font-semibold uppercase tracking-[0.16em] text-brass bg-brass/[0.04] border border-brass/45 hover:bg-brass/10"
                      >
                        <Brain className="w-4 h-4 mr-2" />
                        {t('selfHelpButton')}
                      </Button>
                    </>
                  ) : (
                    <div className="font-special-elite text-sm text-brass flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      {sanRecovered > 0
                        ? t('selfHelpRecovered', { amount: sanRecovered })
                        : t('sanAlreadyMax')}
                    </div>
                  )}
                </div>

                <Button
                  onClick={onClose}
                  className="w-full font-display font-semibold uppercase tracking-[0.16em] text-[#04110f] bg-primary border border-primary hover:brightness-110"
                >
                  {t('close')}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default DevelopmentPhaseModal;
