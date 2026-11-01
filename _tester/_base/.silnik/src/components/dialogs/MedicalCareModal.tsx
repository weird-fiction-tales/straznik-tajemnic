'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import type { Character } from '@/lib/types';
import { getSkillValue } from '@/lib/types';
import {
  RecoveryFacility,
  TimeSkipPeriod,
  TimeSkipRecoveryResult,
  FirstAidResult,
  MedicineResult,
  getMaxHp,
  getMajorWoundThreshold,
  advanceTimeSkipRecovery,
  applyFirstAid,
  applyMedicine,
  getFacilityWeeklyCost,
} from '@/lib/health/recovery-tracker';
import { getCreditRating } from '@/lib/economy/credit-rating';
import {
  HeartPulse,
  Building2,
  Bandage,
  Clock,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Stethoscope,
  Sparkles,
  FileText,
  DollarSign,
} from 'lucide-react';
import { PhysicalDiceScene } from '@/components/dice/physical-dice-scene';
import { traceForD100 } from '@/lib/dice-roll-trace';

export interface MedicalCareModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character;
  onCharacterUpdate: (updated: Character) => void;
  onAddChatMessage?: (content: string) => void;
  isCombatOrChaseActive?: boolean;
}

export function MedicalCareModal({
  isOpen,
  onClose,
  character,
  onCharacterUpdate,
  onAddChatMessage,
  isCombatOrChaseActive = false,
}: MedicalCareModalProps) {
  const t = useTranslations('MedicalCareModal');

  const [activeTab, setActiveTab] = useState<'recovery' | 'facilities' | 'treatments'>('recovery');
  const [selectedPeriod, setSelectedPeriod] = useState<TimeSkipPeriod>('1_week');
  const [selectedFacility, setSelectedFacility] = useState<RecoveryFacility>('public_hospital');
  const [timeSkipResult, setTimeSkipResult] = useState<TimeSkipRecoveryResult | null>(null);
  const [firstAidResult, setFirstAidResult] = useState<FirstAidResult | null>(null);
  const [medicineResult, setMedicineResult] = useState<MedicineResult | null>(null);
  const [isDiceAnimating, setIsDiceAnimating] = useState(false);

  const maxHp = getMaxHp(character);
  const threshold = getMajorWoundThreshold(character);
  const creditRating = getCreditRating(character);
  const firstAidSkill =
    getSkillValue(character.skills?.['Pierwsza pomoc']) ||
    getSkillValue(character.skills?.['First Aid']) ||
    30;
  const medicineSkill =
    getSkillValue(character.skills?.['Medycyna']) ||
    getSkillValue(character.skills?.['Medicine']) ||
    1;

  const handleExecuteTimeSkip = () => {
    if (isCombatOrChaseActive) return;

    const result = advanceTimeSkipRecovery(character, selectedPeriod, selectedFacility);
    setTimeSkipResult(result);
    onCharacterUpdate(result.nextCharacter);

    if (onAddChatMessage) {
      onAddChatMessage(`📋 **[RAPORT MEDYCZNY]** ${result.narrativeSummary.pl}`);
    }
  };

  const handleFirstAid = () => {
    if (isCombatOrChaseActive) return;
    const res = applyFirstAid(character, firstAidSkill);
    setFirstAidResult(res);
    setIsDiceAnimating(true);
    window.setTimeout(() => setIsDiceAnimating(false), 720);
    onCharacterUpdate(res.nextCharacter);
  };

  const handleMedicine = () => {
    if (isCombatOrChaseActive) return;
    const res = applyMedicine(character, medicineSkill);
    setMedicineResult(res);
    setIsDiceAnimating(true);
    window.setTimeout(() => setIsDiceAnimating(false), 720);
    onCharacterUpdate(res.nextCharacter);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="wide" className="w-[80vw] h-[78vh] max-h-[85vh] overflow-y-auto bg-[#16130f] border-2 border-brass/40 text-foreground font-cormorant p-6 shadow-2xl">
        <DialogHeader className="border-b border-brass/20 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#1f1a14] border border-brass/40 rounded">
                <HeartPulse className="h-6 w-6 text-[#d9685f]" />
              </div>
              <div>
                <div className="font-special-elite text-[11px] uppercase tracking-[0.35em] text-primary mb-0.5">
                  {t('archiveKicker')}
                </div>
                <DialogTitle className="font-special-elite text-2xl text-brass tracking-wider">
                  {t('title')}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground font-sans">
                  {t('subtitle')}
                </DialogDescription>
              </div>
            </div>
            {/* Status Badges */}
            <div className="flex flex-wrap gap-2">
              {character.hasMajorWound && (
                <Badge variant="outline" className="border-[#b3322c] bg-[#7a221d]/40 text-[#d9685f] font-special-elite animate-pulse">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {t('badges.majorWound')}
                </Badge>
              )}
              {character.isDying && (
                <Badge variant="destructive" className="font-special-elite">
                  {t('badges.dying')}
                </Badge>
              )}
              {character.isUnconscious && (
                <Badge variant="secondary" className="font-special-elite">
                  {t('badges.unconscious')}
                </Badge>
              )}
              {character.healthRecoveryState?.hasInfection && (
                <Badge variant="outline" className="border-brass/40 bg-brass/10 text-brass font-special-elite">
                  {t('badges.infection')}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {isCombatOrChaseActive && (
          <div className="my-3 p-3 bg-destructive/10 border border-destructive/40 text-destructive flex items-center gap-2 text-sm font-sans">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>{t('combatActiveWarning')}</span>
          </div>
        )}

        {/* Current Vitals bar */}
        <div className="my-4 p-3 bg-[#1f1a14] border border-brass/20 rounded flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-special-elite text-sm text-brass tracking-wider">
              {t('vitalsLabel')}:
            </span>
            <span className="font-special-elite text-lg text-[#d9685f]">
              {character.hp} / {maxHp} {t('hpUnit')}
            </span>
            <span className="text-xs text-muted-foreground font-sans">
              ({t('thresholdLabel')}: {threshold} {t('hpUnit')})
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm font-sans text-muted-foreground">
            <DollarSign className="h-4 w-4 text-brass" />
            <span>
              {t('cashLabel')}: ${character.cash ?? 0} (CR: {creditRating}%)
            </span>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'recovery' | 'facilities' | 'treatments')}>
          <TabsList className="grid grid-cols-3 bg-[#1f1a14] border border-brass/30 mb-4">
            <TabsTrigger
              value="recovery"
              className="font-special-elite tracking-wider data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-glow"
            >
              <Clock className="h-4 w-4 mr-2" />
              {t('tabs.recovery')}
            </TabsTrigger>
            <TabsTrigger
              value="facilities"
              className="font-special-elite tracking-wider data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-glow"
            >
              <Building2 className="h-4 w-4 mr-2" />
              {t('tabs.facilities')}
            </TabsTrigger>
            <TabsTrigger
              value="treatments"
              className="font-special-elite tracking-wider data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-glow"
            >
              <Bandage className="h-4 w-4 mr-2" />
              {t('tabs.treatments')}
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: RECONVALESCENCE & TIME SKIP */}
          <TabsContent value="recovery" className="space-y-4 font-sans">
            <div className="p-4 bg-[#1a1510] border border-brass/20 rounded space-y-4">
              <h3 className="font-special-elite text-brass text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                {t('recoverySectionTitle')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {character.hasMajorWound ? t('recoveryMajorWoundInfo') : t('recoveryStandardInfo')}
              </p>

              {/* Period selection */}
              <div>
                <label className="block font-special-elite text-xs text-brass mb-2 tracking-wider">
                  {t('selectPeriodLabel')}:
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {(['1_day', '3_days', '1_week', '2_weeks', '1_month'] as TimeSkipPeriod[]).map((p) => (
                    <Button
                      key={p}
                      variant={selectedPeriod === p ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedPeriod(p)}
                      className={
                        selectedPeriod === p
                          ? 'bg-primary/10 text-foreground font-special-elite border border-primary shadow-glow'
                          : 'border-brass/30 text-brass/80 hover:bg-brass/10 font-special-elite'
                      }
                    >
                      {t(`periods.${p}`)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Facility selection */}
              <div>
                <label className="block font-special-elite text-xs text-brass mb-2 tracking-wider">
                  {t('selectFacilityLabel')}:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['public_hospital', 'private_clinic', 'home', 'poor_conditions'] as RecoveryFacility[]).map((fac) => {
                    const cost = getFacilityWeeklyCost(character, fac);
                    return (
                      <div
                        key={fac}
                        onClick={() => setSelectedFacility(fac)}
                        className={`p-3 border rounded cursor-pointer transition-colors ${
                          selectedFacility === fac
                            ? 'border-primary bg-[#0f1715] text-foreground shadow-glow'
                            : 'bg-[#1f1a14] border-brass/20 hover:border-brass/40 text-muted-foreground'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className={`font-special-elite text-sm ${selectedFacility === fac ? 'text-primary' : 'text-brass'}`}>
                            {t(`facilityNames.${fac}`)}
                          </span>
                          <span className="text-xs text-muted-foreground font-special-elite">
                            {cost > 0 ? `$${cost}/tydz.` : t('costFree')}
                          </span>
                        </div>
                        <p className="text-xs line-clamp-2">{t(`facilityDescriptions.${fac}`)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleExecuteTimeSkip}
                  disabled={isCombatOrChaseActive || isDiceAnimating}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-special-elite tracking-wider py-2 shadow-glow"
                >
                  <HeartPulse className="h-4 w-4 mr-2" />
                  {t('actionExecuteRecovery')}
                </Button>
              </div>
            </div>

            {/* Time Skip Results Display */}
            {timeSkipResult && (
              <div className="p-4 bg-[#1f1a14] border-2 border-primary/40 rounded space-y-3">
                <div className="flex items-center justify-between border-b border-brass/20 pb-2">
                  <h4 className="font-special-elite text-primary text-base flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    {t('recoveryResultsTitle')}
                  </h4>
                  <div className="flex items-center gap-2 font-special-elite text-xs tracking-wider">
                    {timeSkipResult.hpGained > 0 && (
                      <span className="text-primary bg-primary/15 border border-primary/40 px-2 py-0.5 rounded">
                        +{timeSkipResult.hpGained} PŻ
                      </span>
                    )}
                    {timeSkipResult.hpLost > 0 && (
                      <span className="text-destructive bg-destructive/15 border border-destructive/40 px-2 py-0.5 rounded">
                        -{timeSkipResult.hpLost} PŻ
                      </span>
                    )}
                    <span className="text-brass">
                      {t('periodAdvanced')}: {timeSkipResult.daysAdvanced} dni
                    </span>
                  </div>
                </div>

                <p className="text-sm font-sans">{timeSkipResult.narrativeSummary.pl}</p>

                {timeSkipResult.wasMajorWoundCleared && (
                  <div className="p-3 bg-primary/10 border border-primary/50 rounded flex items-center gap-3">
                    <Sparkles className="h-6 w-6 text-primary shrink-0" />
                    <div className="text-xs">
                      <p className="font-special-elite text-primary text-sm">
                        {t('majorWoundHealedBanner')}
                      </p>
                      {timeSkipResult.newScar && (
                        <p className="text-emerald-200 mt-0.5">
                          {t('scarAcquired')}: <strong>{timeSkipResult.newScar.descriptionPl}</strong>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {timeSkipResult.weeklyLogs.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="font-special-elite text-xs text-brass tracking-wider">
                      {t('weeklyChecksLog')}:
                    </span>
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {timeSkipResult.weeklyLogs.map((log) => (
                        <div
                          key={log.weekNumber}
                          className="p-2 bg-[#16130f] border border-brass/15 rounded text-xs flex justify-between items-center"
                        >
                          <div>
                            <span className="font-special-elite text-brass mr-2">Tydz. {log.weekNumber}:</span>
                            <span>{log.notes.pl}</span>
                          </div>
                          <span
                            className={`font-special-elite shrink-0 ml-2 ${
                              log.hpDelta > 0 ? 'text-primary' : log.hpDelta < 0 ? 'text-destructive' : 'text-muted-foreground'
                            }`}
                          >
                            {log.hpDelta > 0 ? `+${log.hpDelta}` : log.hpDelta} PŻ
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: FACILITIES & SCARS */}
          <TabsContent value="facilities" className="space-y-4 font-sans">
            <div className="space-y-3">
              <div className="p-3 bg-[#1f1a14] border border-brass/20 rounded">
                <div className="flex items-center gap-2 text-brass font-special-elite text-base mb-1">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span>Miejski Szpital Ogólny (General Hospital)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tradycyjny szpital miejski z salami wieloosobowymi. Zapewnia stałą opiekę medyczną dającą <strong>Kość Premii</strong> do tygodniowego rzutu na Kondycję. Koszt: $10 tygodniowo. Uwaga: rany postrzałowe lub nietypowe szarpane obrażenia mogą wzbudzić czujność lekarza i skutkować donosem na policję.
                </p>
              </div>

              <div className="p-3 bg-[#1f1a14] border border-brass/20 rounded">
                <div className="flex items-center gap-2 text-brass font-special-elite text-base mb-1">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Prywatna Klinika dr. Pennhallowa (Dr. Pennhallow’s Sanitarium)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Dyskretna placówka dla zamożniejszych pacjentów. Oferuje Kość Premii do rzutów CON oraz <strong>rygorystyczną opiekę antyseptyczną</strong>, która neutralizuje powikłania (Fumble nie wywołuje gorączki). Koszt $100 tygodniowo, wliczony w standard życia badaczy z Majętnością (Credit Rating) &ge; 40%.
                </p>
              </div>

              <div className="p-3 bg-[#1f1a14] border border-brass/20 rounded">
                <div className="flex items-center gap-2 text-brass font-special-elite text-base mb-1">
                  <FileText className="h-4 w-4 text-brass" />
                  <span>{t('scarsJournalTitle')}</span>
                </div>
                {character.scars && character.scars.length > 0 ? (
                  <ul className="list-disc list-inside text-xs text-foreground space-y-1 mt-2">
                    {character.scars.map((scar, idx) => (
                      <li key={idx} className="italic text-muted-foreground">
                        {scar}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic mt-1">
                    {t('noScarsRecorded')}
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: FIRST AID & MEDICINE */}
          <TabsContent value="treatments" className="space-y-4 font-sans">
            <div className="grid grid-cols-2 gap-4">
              {/* First Aid card */}
              <div className="p-4 bg-[#1f1a14] border border-brass/20 rounded space-y-3">
                <div className="flex items-center gap-2 text-brass font-special-elite text-base">
                  <Bandage className="h-5 w-5 text-primary" />
                  <span>{t('treatmentsFirstAidTitle')}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Doraźne opatrzenie świeżej rany w terenie (d100 Weird Fiction s. 122). Przywraca dokładnie <strong>1 PŻ</strong> oraz stabilizuje umierającego badacza.
                </p>
                <div className="text-xs font-special-elite text-primary">
                  {t('skillValue')}: {firstAidSkill}%
                </div>
                <Button
                  onClick={handleFirstAid}
                  disabled={isCombatOrChaseActive || isDiceAnimating}
                  variant="default"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 border border-primary font-special-elite shadow-glow"
                >
                  {t('actionRollFirstAid')}
                </Button>
                {firstAidResult && (
                  <div
                    className={`p-2 bg-[#16130f] border rounded text-xs space-y-1 ${
                      firstAidResult.success
                        ? 'border-primary/30'
                        : firstAidResult.outcome === 'fumble'
                          ? 'border-destructive/40'
                          : 'border-brass/20'
                    }`}
                  >
                    <div
                      className={`flex justify-between font-special-elite ${
                        firstAidResult.success
                          ? 'text-primary'
                          : firstAidResult.outcome === 'fumble'
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                      }`}
                    >
                      <span>Rzut: {firstAidResult.roll} vs {firstAidResult.targetSkill}</span>
                      <span>
                        {firstAidResult.outcome.toUpperCase()}
                        {firstAidResult.hpGained > 0 ? ` (+${firstAidResult.hpGained} PŻ)` : ''}
                      </span>
                    </div>
                    <PhysicalDiceScene dice={traceForD100(firstAidResult.roll, 'first-aid').dice} rolling={isDiceAnimating} label="d100" />
                    <p className="text-muted-foreground">{firstAidResult.narrativeSummary.pl}</p>
                  </div>
                )}
              </div>

              {/* Medicine card */}
              <div className="p-4 bg-[#1f1a14] border border-brass/20 rounded space-y-3">
                <div className="flex items-center gap-2 text-brass font-special-elite text-base">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  <span>{t('treatmentsMedicineTitle')}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Zabieg chirurgiczny lub podanie medykamentów trwający 1 pełną godzinę. Przywraca <strong>1k3 PŻ</strong> (lub 2k3 przy sukcesie ekstremalnym).
                </p>
                <div className="text-xs font-special-elite text-primary">
                  {t('skillValue')}: {medicineSkill}%
                </div>
                <Button
                  onClick={handleMedicine}
                  disabled={isCombatOrChaseActive || isDiceAnimating}
                  variant="default"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 border border-primary font-special-elite shadow-glow"
                >
                  {t('actionRollMedicine')}
                </Button>
                {medicineResult && (
                  <div
                    className={`p-2 bg-[#16130f] border rounded text-xs space-y-1 ${
                      medicineResult.success
                        ? 'border-primary/30'
                        : medicineResult.outcome === 'fumble'
                          ? 'border-destructive/40'
                          : 'border-brass/20'
                    }`}
                  >
                    <div
                      className={`flex justify-between font-special-elite ${
                        medicineResult.success
                          ? 'text-primary'
                          : medicineResult.outcome === 'fumble'
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                      }`}
                    >
                      <span>Rzut: {medicineResult.roll} vs {medicineResult.targetSkill}</span>
                      <span>
                        {medicineResult.outcome.toUpperCase()}
                        {medicineResult.hpGained > 0 ? ` (+${medicineResult.hpGained} PŻ)` : ''}
                      </span>
                    </div>
                    <PhysicalDiceScene dice={traceForD100(medicineResult.roll, 'medicine').dice} rolling={isDiceAnimating} label="d100" />
                    <p className="text-muted-foreground">{medicineResult.narrativeSummary.pl}</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
