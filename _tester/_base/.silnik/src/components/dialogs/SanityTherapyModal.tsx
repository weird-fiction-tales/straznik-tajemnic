'use client';

import { useState, useMemo } from 'react';
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
import { Character } from '@/lib/types';
import {
  getCharacterAnchors,
  getMaxSanity,
  recoverSanityFromAnchor,
  attemptSelfHelp,
  institutionalizeCare,
  AnchorRecoveryType,
  AnchorRecoveryResult,
  SelfHelpResult,
  HospitalCareResult,
  HospitalizationFacility,
} from '@/lib/sanity/sanity-recovery';
import { getCreditRating } from '@/lib/economy/credit-rating';
import {
  Heart,
  Brain,
  Building2,
  Sparkles,
  AlertTriangle,
  Mail,
  User,
  Camera,
  Check,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

export interface SanityTherapyModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character;
  onCharacterUpdate: (updated: Character) => void;
  isCombatOrChaseActive?: boolean;
}

export function SanityTherapyModal({
  isOpen,
  onClose,
  character,
  onCharacterUpdate,
  isCombatOrChaseActive = false,
}: SanityTherapyModalProps) {
  const t = useTranslations('SanityTherapyModal');

  const [activeTab, setActiveTab] = useState<'anchors' | 'self_help' | 'asylum'>('anchors');

  // Kotwice
  const anchors = useMemo(() => getCharacterAnchors(character), [character]);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string>(
    anchors[0]?.id || ''
  );
  const [contactForm, setContactForm] = useState<AnchorRecoveryType>('visit');
  const [anchorResult, setAnchorResult] = useState<AnchorRecoveryResult | null>(null);

  // Samopomoc
  const availableTraits = useMemo(() => {
    const list: Array<{ type: 'phobia' | 'mania'; name: string }> = [];
    character.characterTraits?.phobias?.forEach((p) => list.push({ type: 'phobia', name: p }));
    character.characterTraits?.manias?.forEach((m) => list.push({ type: 'mania', name: m }));
    return list;
  }, [character]);
  const [selectedTrait, setSelectedTrait] = useState<{ type: 'phobia' | 'mania'; name: string } | null>(
    availableTraits[0] || null
  );
  const [selfHelpResult, setSelfHelpResult] = useState<SelfHelpResult | null>(null);

  // Szpitalnictwo
  const creditRating = useMemo(() => getCreditRating(character), [character]);
  const cash = character.cash ?? 0;
  const canAffordPrivate = creditRating >= 50 || cash >= 150;
  const [facility, setFacility] = useState<HospitalizationFacility>(
    canAffordPrivate ? 'private_sanitarium' : 'public_asylum'
  );
  const [hospitalResult, setHospitalResult] = useState<HospitalCareResult | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const maxSan = getMaxSanity(character);
  const selectedAnchor = anchors.find((a) => a.id === selectedAnchorId) || anchors[0];

  const handleAnchorRecovery = () => {
    if (!selectedAnchor) return;
    try {
      setErrorMessage(null);
      const res = recoverSanityFromAnchor(character, selectedAnchor.id, contactForm);
      setAnchorResult(res);
      onCharacterUpdate(res.nextCharacter);
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSelfHelp = () => {
    if (!selectedTrait) return;
    setErrorMessage(null);
    const res = attemptSelfHelp(character, selectedTrait);
    setSelfHelpResult(res);
    onCharacterUpdate(res.nextCharacter);
  };

  const handleHospitalCare = () => {
    try {
      setErrorMessage(null);
      const res = institutionalizeCare(character, facility);
      setHospitalResult(res);
      onCharacterUpdate(res.nextCharacter);
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const handleResetModal = () => {
    setErrorMessage(null);
    setAnchorResult(null);
    setSelfHelpResult(null);
    setHospitalResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="wide" className="w-[80vw] h-[78vh] max-h-[85vh] overflow-y-auto bg-[#120f0d] border border-brass/40 text-foreground p-6 shadow-2xl rounded-none">
        <DialogHeader className="border-b border-brass/20 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-xl uppercase tracking-[0.2em] text-brass flex items-center gap-2">
              <Brain className="w-5 h-5 text-brass" />
              {t('title')}
            </DialogTitle>
            <div className="flex items-center gap-2 font-special-elite text-xs text-muted-foreground">
              <span>{t('currentSan')}: <strong className="text-brass">{character.san || 0}</strong></span>
              <span>/</span>
              <span>{t('maxSan')}: <strong>{maxSan}</strong></span>
            </div>
          </div>
          <DialogDescription className="font-serif italic text-xs text-muted-foreground mt-1">
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        {isCombatOrChaseActive ? (
          <div className="p-6 my-4 border border-brass/40 bg-card text-center space-y-2">
            <ShieldAlert className="w-8 h-8 text-brass mx-auto" />
            <h4 className="font-display uppercase tracking-widest text-gold text-sm font-semibold">
              {t('dangerLockTitle')}
            </h4>
            <p className="font-serif text-xs text-muted-foreground">
              {t('dangerLockDesc')}
            </p>
          </div>
        ) : (
          <>
            {errorMessage && (
              <div className="p-3 my-2 border border-red-500/40 bg-red-950/30 text-red-300 text-xs font-serif flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}
            <Tabs
              value={activeTab}
              onValueChange={(val) => {
                setActiveTab(val as 'anchors' | 'self_help' | 'asylum');
                handleResetModal();
              }}
              className="w-full mt-2"
            >
            <TabsList className="grid grid-cols-3 bg-[#181512] border border-brass/25 rounded-none p-1">
              <TabsTrigger
                value="anchors"
                className="font-display text-xs uppercase tracking-wider data-[state=active]:bg-primary/10 data-[state=active]:text-foreground"
              >
                <Heart className="w-3.5 h-3.5 mr-1.5" />
                {t('tabAnchors')}
              </TabsTrigger>
              <TabsTrigger
                value="self_help"
                className="font-display text-xs uppercase tracking-wider data-[state=active]:bg-primary/10 data-[state=active]:text-foreground"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {t('tabSelfHelp')}
              </TabsTrigger>
              <TabsTrigger
                value="asylum"
                className="font-display text-xs uppercase tracking-wider data-[state=active]:bg-primary/10 data-[state=active]:text-foreground"
              >
                <Building2 className="w-3.5 h-3.5 mr-1.5" />
                {t('tabAsylum')}
              </TabsTrigger>
            </TabsList>

            {/* ZAKŁADKA 1: KOTWICE ŻYCIOWE */}
            <TabsContent value="anchors" className="space-y-4 pt-4">
              {anchors.length === 0 ? (
                <div className="p-4 border border-dashed border-brass/30 bg-[#16130f] text-center font-serif text-sm text-muted-foreground">
                  {t('noAnchors')}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Wybór osoby */}
                  <div className="space-y-2">
                    <label className="font-display uppercase tracking-[0.16em] text-brass text-xs font-semibold">
                      {t('chooseAnchor')}:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {anchors.map((anchor) => {
                        const isSelected = (selectedAnchor?.id || anchors[0].id) === anchor.id;
                        const isLost = anchor.status === 'lost';
                        return (
                          <div
                            key={anchor.id}
                            onClick={() => !isLost && setSelectedAnchorId(anchor.id)}
                            className={`p-3 border transition-colors flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'border-primary bg-primary/10'
                                : 'border-brass/20 bg-[#16130f] hover:border-brass/40'
                            } ${isLost ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-serif text-sm font-semibold whitespace-normal break-words text-foreground flex items-start gap-1.5">
                                <User className="w-3.5 h-3.5 text-brass/70 flex-shrink-0" />
                                {anchor.name}
                              </div>
                              <div className="font-special-elite text-[11px] text-muted-foreground">
                                {anchor.relationship}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              {anchor.isKeyConnection && anchor.status === 'intact' && (
                                <Badge variant="outline" className="text-[9px] bg-gold/15 text-gold border-gold/40 py-0">
                                  {t('keyAnchorBadge')}
                                </Badge>
                              )}
                              {anchor.status === 'intact' && (
                                <Badge variant="outline" className="text-[9px] bg-emerald-950/40 text-emerald-400 border-emerald-500/30 py-0">
                                  {t('statusIntact')}
                                </Badge>
                              )}
                              {anchor.status === 'damaged' && (
                                <Badge variant="outline" className="text-[9px] bg-brass/15 text-brass border-brass/40 py-0">
                                  {t('statusDamaged')}
                                </Badge>
                              )}
                              {anchor.status === 'lost' && (
                                <Badge variant="outline" className="text-[9px] bg-red-950/40 text-red-400 border-red-500/40 py-0">
                                  {t('statusLost')}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Wybór formy kontaktu */}
                  <div className="space-y-2">
                    <label className="font-display uppercase tracking-[0.16em] text-brass text-xs font-semibold">
                      {t('contactMethod')}:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setContactForm('visit')}
                        className={`p-2.5 border text-center font-serif text-xs transition-colors flex flex-col items-center gap-1 ${
                          contactForm === 'visit'
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-brass/20 bg-[#16130f] text-muted-foreground hover:border-brass/40'
                        }`}
                      >
                        <User className="w-4 h-4 text-brass" />
                        <span>{t('formVisit')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactForm('correspondence')}
                        className={`p-2.5 border text-center font-serif text-xs transition-colors flex flex-col items-center gap-1 ${
                          contactForm === 'correspondence'
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-brass/20 bg-[#16130f] text-muted-foreground hover:border-brass/40'
                        }`}
                      >
                        <Mail className="w-4 h-4 text-brass" />
                        <span>{t('formMail')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactForm('keepsake')}
                        className={`p-2.5 border text-center font-serif text-xs transition-colors flex flex-col items-center gap-1 ${
                          contactForm === 'keepsake'
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-brass/20 bg-[#16130f] text-muted-foreground hover:border-brass/40'
                        }`}
                      >
                        <Camera className="w-4 h-4 text-brass" />
                        <span>{t('formKeepsake')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Bezpiecznik: Użycie w tej przerwie */}
                  {character.usedDowntimeRecovery && !anchorResult && (
                    <div className="p-3 border border-brass/30 bg-card/80 text-brass text-xs font-serif flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 text-brass" />
                      <span>{t('cooldownNotice')}</span>
                    </div>
                  )}

                  {/* Wynik rzutu */}
                  {anchorResult && (
                    <div
                      className={`p-4 border space-y-2 ${
                        anchorResult.success
                          ? 'border-emerald-500/40 bg-emerald-950/20'
                          : 'border-red-500/40 bg-red-950/20'
                      }`}
                    >
                      <div className="flex items-center justify-between font-display text-sm font-semibold uppercase tracking-wider">
                        <span className={anchorResult.success ? 'text-emerald-400' : 'text-red-400'}>
                          {anchorResult.success ? t('rollSuccess') : t('rollFailure')}
                        </span>
                        <span className="font-special-elite text-xs text-muted-foreground">
                          {t('rollValue')}: {anchorResult.sanRoll} / {anchorResult.sanTarget}
                          {anchorResult.isBonusDieUsed && ` (${t('bonusDieActive')})`}
                        </span>
                      </div>
                      <p className="font-serif text-sm italic text-foreground leading-relaxed">
                        {anchorResult.narrativeSummary.pl}
                      </p>
                      <div className="font-special-elite text-xs pt-1 flex items-center gap-3">
                        {anchorResult.sanGained > 0 && (
                          <span className="text-emerald-400">+{anchorResult.sanGained} SAN</span>
                        )}
                        {anchorResult.sanLost > 0 && (
                          <span className="text-red-400">-{anchorResult.sanLost} SAN</span>
                        )}
                        <span className="text-muted-foreground">
                          {t('newStatusLabel')}: <strong>{anchorResult.newStatus}</strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Przycisk akcji */}
                  {!anchorResult ? (
                    <Button
                      onClick={handleAnchorRecovery}
                      disabled={character.usedDowntimeRecovery || selectedAnchor?.status === 'lost'}
                      className="w-full font-display uppercase tracking-[0.16em] bg-primary text-primary-foreground border border-primary hover:bg-primary/90 py-2.5"
                    >
                      <Heart className="w-4 h-4 mr-2" />
                      {t('actionSeekSolace')}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleResetModal}
                      variant="outline"
                      className="w-full font-display uppercase tracking-[0.16em] border-brass/30 text-muted-foreground hover:text-brass"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-2" />
                      {t('reset')}
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ZAKŁADKA 2: SAMOPOMOC (FOBIE I MANIE) */}
            <TabsContent value="self_help" className="space-y-4 pt-4">
              {availableTraits.length === 0 ? (
                <div className="p-4 border border-dashed border-brass/30 bg-[#16130f] text-center font-serif text-sm text-muted-foreground">
                  <Check className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                  {t('noPhobiasOrManias')}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="font-display uppercase tracking-[0.16em] text-brass text-xs font-semibold">
                      {t('chooseTrait')}:
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {availableTraits.map((trait, idx) => {
                        const isSelected =
                          selectedTrait?.type === trait.type && selectedTrait?.name === trait.name;
                        return (
                          <div
                            key={`${trait.type}_${idx}`}
                            onClick={() => setSelectedTrait(trait)}
                            className={`p-3 border transition-colors flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'border-primary bg-primary/10'
                                : 'border-brass/20 bg-[#16130f] hover:border-brass/40'
                            }`}
                          >
                            <span className="font-serif text-sm text-foreground">
                              {trait.name}
                            </span>
                            <Badge variant="outline" className="text-[10px] uppercase border-brass/30 text-brass">
                              {trait.type === 'phobia' ? t('phobia') : t('mania')}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="font-serif italic text-xs text-muted-foreground">
                    {t('selfHelpExplanation')}
                  </p>

                  {selfHelpResult && (
                    <div
                      className={`p-4 border space-y-2 ${
                        selfHelpResult.cured
                          ? 'border-emerald-500/40 bg-emerald-950/20'
                          : 'border-brass/40 bg-brass/10'
                      }`}
                    >
                      <div className="flex items-center justify-between font-display text-sm font-semibold uppercase tracking-wider">
                        <span className={selfHelpResult.cured ? 'text-emerald-400' : 'text-brass'}>
                          {selfHelpResult.cured ? t('selfHelpSuccess') : t('selfHelpFail')}
                        </span>
                        <span className="font-special-elite text-xs text-muted-foreground">
                          {t('rollValue')}: {selfHelpResult.sanRoll} / {selfHelpResult.sanTarget}
                        </span>
                      </div>
                      <p className="font-serif text-sm italic text-foreground leading-relaxed">
                        {selfHelpResult.narrativeSummary.pl}
                      </p>
                    </div>
                  )}

                  {!selfHelpResult ? (
                    <Button
                      onClick={handleSelfHelp}
                      disabled={!selectedTrait}
                      className="w-full font-display uppercase tracking-[0.16em] bg-primary text-primary-foreground border border-primary hover:bg-primary/90 py-2.5"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      {t('actionSelfHelp')}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleResetModal}
                      variant="outline"
                      className="w-full font-display uppercase tracking-[0.16em] border-brass/30 text-muted-foreground hover:text-brass"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-2" />
                      {t('reset')}
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ZAKŁADKA 3: HOSPITALIZACJA PSYCHIATRYCZNA */}
            <TabsContent value="asylum" className="space-y-4 pt-4">
              <div className="space-y-3">
                <label className="font-display uppercase tracking-[0.16em] text-brass text-xs font-semibold">
                  {t('selectFacility')}:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Public Asylum */}
                  <div
                    onClick={() => setFacility('public_asylum')}
                    className={`p-3.5 border transition-colors cursor-pointer space-y-2 ${
                      facility === 'public_asylum'
                        ? 'border-primary bg-primary/10'
                        : 'border-brass/20 bg-[#16130f] hover:border-brass/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-serif font-semibold text-sm text-foreground">
                        {t('publicAsylumTitle')}
                      </span>
                      <Badge variant="outline" className="text-[9px] bg-emerald-950/30 text-emerald-400 border-emerald-500/30">
                        {t('freeOfCharge')}
                      </Badge>
                    </div>
                    <p className="font-serif text-xs text-muted-foreground leading-snug">
                      {t('publicAsylumDesc')}
                    </p>
                    <div className="font-special-elite text-[11px] text-brass/80">
                      {t('doctorSkill')}: 40% (Psychoanaliza)
                    </div>
                  </div>

                  {/* Private Sanitarium */}
                  <div
                    onClick={() => canAffordPrivate && setFacility('private_sanitarium')}
                    className={`p-3.5 border transition-colors space-y-2 ${
                      facility === 'private_sanitarium'
                        ? 'border-primary bg-primary/10 cursor-pointer'
                        : canAffordPrivate
                          ? 'border-brass/20 bg-[#16130f] hover:border-brass/40 cursor-pointer'
                          : 'opacity-40 border-brass/10 bg-[#16130f] cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-serif font-semibold text-sm text-foreground">
                        {t('privateSanitariumTitle')}
                      </span>
                      <Badge variant="outline" className="text-[9px] bg-gold/15 text-gold border-gold/40">
                        $150 / m-c
                      </Badge>
                    </div>
                    <p className="font-serif text-xs text-muted-foreground leading-snug">
                      {t('privateSanitariumDesc')}
                    </p>
                    <div className="font-special-elite text-[11px] text-brass/80 flex items-center justify-between">
                      <span>{t('doctorSkill')}: 65%</span>
                      {!canAffordPrivate && (
                        <span className="text-red-400 font-sans text-[10px]">{t('unaffordable')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 border border-brass/20 bg-[#16130f] font-serif italic text-xs text-muted-foreground">
                {t('hospitalCareNotice')}
              </div>

              {hospitalResult && (
                <div
                  className={`p-4 border space-y-2 ${
                    hospitalResult.outcome === 'fumble'
                      ? 'border-red-500/40 bg-red-950/20'
                      : hospitalResult.outcome === 'fail'
                        ? 'border-brass/40 bg-brass/10'
                        : 'border-emerald-500/40 bg-emerald-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between font-display text-sm font-semibold uppercase tracking-wider">
                    <span
                      className={
                        hospitalResult.outcome === 'fumble'
                          ? 'text-red-400'
                          : hospitalResult.outcome === 'fail'
                            ? 'text-brass'
                            : 'text-emerald-400'
                      }
                    >
                      {hospitalResult.outcome === 'fumble'
                        ? t('outcomeFumble')
                        : hospitalResult.outcome === 'fail'
                          ? t('outcomeFail')
                          : t('outcomeSuccess')}
                    </span>
                    <span className="font-special-elite text-xs text-muted-foreground">
                      {t('doctorRoll')}: {hospitalResult.doctorRoll} / {hospitalResult.doctorSkill} ({hospitalResult.outcome})
                    </span>
                  </div>
                  <p className="font-serif text-sm italic text-foreground leading-relaxed">
                    {hospitalResult.narrativeSummary.pl}
                  </p>
                </div>
              )}

              {!hospitalResult ? (
                <Button
                  onClick={handleHospitalCare}
                  className="w-full font-display uppercase tracking-[0.16em] bg-primary text-primary-foreground border border-primary hover:bg-primary/90 py-2.5"
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  {t('actionBeginHospitalCare')}
                </Button>
              ) : (
                <Button
                  onClick={handleResetModal}
                  variant="outline"
                  className="w-full font-display uppercase tracking-[0.16em] border-brass/30 text-muted-foreground hover:text-brass"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-2" />
                  {t('reset')}
                </Button>
              )}
            </TabsContent>
          </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
