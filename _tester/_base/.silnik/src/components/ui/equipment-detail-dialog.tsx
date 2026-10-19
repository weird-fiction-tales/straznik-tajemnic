import { SafeImage } from '@/components/ui/safe-image';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from './button';
import { EquipmentItem, Character } from '@/lib/types';
import { inferWeaponSkill, inferWeaponDamage, isWeapon } from '@/lib/combat/weapon-context';
import { generateItemLore } from '@/lib/character/item-helpers';
import {
  getLocalizedEquipmentName,
  getLocalizedEquipmentDescription,
  getLocalizedSkillName,
} from '@/lib/data/character';
import { Loader2, X, Maximize2, Minimize2, Play, Pause, RotateCcw, Disc } from 'lucide-react';
import { getApiKeyHeaders } from '@/lib/api-keys-service';
import { DiegeticDocumentViewer } from './diegetic-document-viewer';
import { EquipmentImagePlaceholder } from './equipment-image-placeholder';
import { CATEGORY_LABELS } from '@/lib/equipment-data';
import { resolveGameEraContext, formatEraCurrency, formatWeaponRange, type ResolvedEraContext } from '@/lib/era';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import {
  isInvalidKeyError,
  isQuotaOrCreditsError,
  isPrepaymentCreditsError,
} from '@/app/api/chat/_helpers/model-fallback';

interface EquipmentDetailDialogProps {
  item: EquipmentItem | null;
  onClose: () => void;
  era?: string;
  eraContext?: ResolvedEraContext | null;
  onUpdateItem?: (updatedItem: EquipmentItem) => void;
  onQuoteToInput?: (text: string) => void;
}

export function isAbnormalEquipmentCondition(
  condition?: EquipmentItem['condition']
): boolean {
  return (
    condition === 'damaged' ||
    condition === 'broken' ||
    condition === 'depleted'
  );
}

/**
 * Mechanika/zastosowanie przedmiotu do modalu detalu. Broń: umiejętność bojowa
 * (weapon-context) + obrażenia/zasięg z modifiers. Pozostałe: powiązana umiejętność
 * lub premia, jeśli AI/szablon je nadał. Pusta lista → przedmiot czysto fabularny.
 */
export function getItemMechanics(
  item: EquipmentItem,
  eraContext?: ResolvedEraContext | null,
  locale: string = 'pl'
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const measurementSystem =
    eraContext?.measurementSystem ??
    (eraContext?.regionProfile === 'PL' || eraContext?.countryCode === 'PL'
      ? 'metric'
      : 'imperial');
  const isMetric = measurementSystem === 'metric';

  if (isWeapon(item)) {
    rows.push({
      label: 'combatTest',
      value: getLocalizedSkillName(inferWeaponSkill(item), locale),
    });
    // Dopełnij obrażenia/zasięg, gdy broń nie ma ich w modifiers (np. broń z
    // OCCUPATION_EQUIPMENT bez szablonu) - tabela CoC 7e per typ broni.
    const inferred =
      item.modifiers?.damage && item.modifiers?.range
        ? null
        : inferWeaponDamage(item);
    const damage = item.modifiers?.damage ?? inferred?.damage;
    const range = item.modifiers?.range ?? inferred?.range;
    if (damage) rows.push({ label: 'damage', value: damage });
    if (range) {
      const loc = locale === 'en' ? 'en' : 'pl';
      rows.push({ label: 'range', value: formatWeaponRange(range, measurementSystem, loc) });
    }
    if (typeof item.currentAmmo === 'number') {
      const maxA = item.maxAmmo ?? (item.modifiers?.capacity ? Number(item.modifiers.capacity) : 6);
      rows.push({ label: 'currentAmmo', value: `${item.currentAmmo} / ${maxA}` });
    }
    if (item.modifiers?.attacks) rows.push({ label: 'attacks', value: String(item.modifiers.attacks) });
    if (item.modifiers?.capacity) rows.push({ label: 'capacity', value: String(item.modifiers.capacity) });
    if (item.modifiers?.malfunction) rows.push({ label: 'malfunction', value: String(item.modifiers.malfunction) });
  }

  if (typeof item.charges === 'number') {
    const maxC = item.maxCharges ?? 3;
    rows.push({ label: 'charges', value: `${item.charges} / ${maxC}` });
  }

  if (item.condition) {
    rows.push({ label: 'condition', value: item.condition });
  }

  // Waga przedmiotu (diegetyczny wgląd w ekwipunek CoC 7e RAW)
  if (item.weight != null && item.weight > 0) {
    if (isMetric) {
      const kg = Math.round(item.weight * 0.45359237 * 10) / 10;
      const displayKg = kg < 0.1 ? '< 0.1' : String(kg);
      rows.push({ label: 'weight', value: `${displayKg} kg` });
    } else {
      rows.push({ label: 'weight', value: `${item.weight} lbs` });
    }
  }

  if (item.modifiers?.skill)
    rows.push({ label: 'skill', value: item.modifiers.skill });
  if (item.modifiers?.bonus)
    rows.push({ label: 'bonus', value: `+${item.modifiers.bonus}%` });
  return rows;
}

export function EquipmentDetailDialog({
  item,
  onClose,
  era,
  eraContext: propEraContext,
  onUpdateItem,
}: EquipmentDetailDialogProps) {
  const t = useTranslations('EquipmentDetailDialog');
  const conditionLabels: Record<string, string> = {
    new: t('conditionNew'),
    used: t('conditionUsed'),
    damaged: t('conditionDamaged'),
    broken: t('conditionBroken'),
    working: t('conditionWorking'),
    depleted: t('conditionDepleted'),
  };
  const mechanicLabels: Record<string, string> = {
    combatTest: t('mechanicCombatTest'),
    damage: t('mechanicDamage'),
    range: t('mechanicRange'),
    currentAmmo: t('mechanicCurrentAmmo'),
    charges: t('mechanicCharges'),
    condition: t('mechanicCondition'),
    weight: t('mechanicWeight'),
    skill: t('mechanicSkill'),
    bonus: t('mechanicBonus'),
    attacks: t('mechanicAttacks'),
    capacity: t('mechanicCapacity'),
    malfunction: t('mechanicMalfunction'),
  };
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setIsExpanded(false);
    setIsAudioPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [item?.id]);

  useEffect(() => {
    try {
      const characterSaved = typeof window !== 'undefined' ? localStorage.getItem('characters') : null;
      const activeCharId = typeof window !== 'undefined' ? localStorage.getItem('active_character_id') : null;
      if (characterSaved) {
        const chars: Character[] = JSON.parse(characterSaved);
        const activeChar = chars.find((c) => c.id === activeCharId) || chars[0];
        if (activeChar) setActiveCharacter(activeChar);
      }
    } catch (e) {
      console.error('Failed to load active character in EquipmentDetailDialog:', e);
    }
  }, []);

  const resolvedEraContext: ResolvedEraContext = useMemo(() => {
    if (propEraContext) return propEraContext;
    try {
      const advSaved = typeof window !== 'undefined' ? localStorage.getItem('adventure_context') : null;
      const adventureContext = advSaved ? JSON.parse(advSaved) : null;
      if (adventureContext?.yearRange || adventureContext?.era) {
        return resolveGameEraContext({ adventure: adventureContext });
      }
    } catch {
      // Fallback
    }
    // Domyślny klasyczny kontekst CoC 7e
    return resolveGameEraContext({ userSelection: { year: 1924, country: 'USA' } });
  }, [propEraContext]);

  const locale = useLocale();

  if (!item) return null;

  const canRequestRead = item.category === 'document' || item.isReadable === true || Boolean(item.readableContent);

  const handleReadItem = async () => {
    if (!onUpdateItem) return;
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const characterSaved = typeof window !== 'undefined' ? localStorage.getItem('characters') : null;
      const activeCharId = typeof window !== 'undefined' ? localStorage.getItem('active_character_id') : null;
      let activeChar: Character | null = null;
      if (characterSaved) {
        const chars: Character[] = JSON.parse(characterSaved);
        activeChar = chars.find((c) => c.id === activeCharId) || chars[0];
      }

      const advSaved = typeof window !== 'undefined' ? localStorage.getItem('adventure_context') : null;
      const adventureContext = advSaved ? JSON.parse(advSaved) : null;

      const chatSaved = typeof window !== 'undefined' ? localStorage.getItem('chat-messages') : null;
      const recentHistory = chatSaved ? JSON.parse(chatSaved) : [];

      const res = await fetch('/api/equipment/read-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiKeyHeaders(),
        },
        body: JSON.stringify({
          item,
          character: activeChar,
          adventureContext: adventureContext || { title: item.name, yearRange: String(resolvedEraContext.effectiveYear) },
          eraContext: resolvedEraContext,
          currentLocation: undefined,
          recentHistory,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const code = errData?.code;
        const rawError = String(errData?.error || errData?.message || '');

        if (code === 'BYOK_CREDITS_DEPLETED' || isPrepaymentCreditsError(rawError)) {
          throw new Error(t('errorCreditsDepleted'));
        }
        if (code === 'BYOK_QUOTA_EXCEEDED' || isQuotaOrCreditsError(rawError)) {
          throw new Error(t('errorQuotaExceeded'));
        }
        if (code === 'BYOK_KEY_INVALID' || isInvalidKeyError(rawError)) {
          throw new Error(t('errorKeyInvalid'));
        }

        if (rawError.trim().startsWith('{')) {
          if (isPrepaymentCreditsError(rawError)) {
            throw new Error(t('errorCreditsDepleted'));
          }
          if (isQuotaOrCreditsError(rawError)) {
            throw new Error(t('errorQuotaExceeded'));
          }
          throw new Error(t('readFailed'));
        }

        throw new Error(rawError || t('readFailed'));
      }

      const data = await res.json();
      if (data.success && data.content) {
        onUpdateItem({
          ...item,
          readableContent: data.content,
          readableContentStatus: 'ready',
          isReadable: true,
        });
      }
    } catch (err: unknown) {
      console.error(err);
      let message = err instanceof Error ? err.message : t('readError');
      if (isPrepaymentCreditsError(message)) {
        message = t('errorCreditsDepleted');
      } else if (isQuotaOrCreditsError(message)) {
        message = t('errorQuotaExceeded');
      } else if (isInvalidKeyError(message)) {
        message = t('errorKeyInvalid');
      } else if (message.trim().startsWith('{')) {
        message = t('readFailed');
      }
      setErrorMsg(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const mechanics = getItemMechanics(item, resolvedEraContext, locale);
  const hasImage = !!item.imageUrl && !item.mapUrl && !item.isMap;
  const hasMap = !!(item.mapUrl || (item.imageUrl && item.isMap));
  const categoryLabel = CATEGORY_LABELS[item.category] || item.category;
  const effectiveLore = getLocalizedEquipmentDescription(item, locale);

  return (
    <DialogPrimitive.Root open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed z-[100] flex flex-col bg-[#120e0a] border-2 border-brass/60 overflow-hidden shadow-2xl focus:outline-none pointer-events-auto transition-all duration-200',
            isExpanded
              ? 'inset-0 w-screen h-screen max-h-none'
              : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] md:w-[60vw] h-[78vh] max-h-[85vh] rounded-none shadow-deco'
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {categoryLabel}: {item.name}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Opis i szczegóły przedmiotu {item.name}
          </DialogPrimitive.Description>

          {/* Narożniki Deco */}
          <span className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-brass/80 pointer-events-none z-10" />
          <span className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-brass/80 pointer-events-none z-10" />
          <span className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-brass/80 pointer-events-none z-10" />
          <span className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-brass/80 pointer-events-none z-10" />

          {/* Przycisk zamykania X - z dużą strefą dotyku i wysokim z-index */}
          <DialogPrimitive.Close
            className="absolute top-3 right-3 z-30 flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full border border-brass/35 bg-[#120f0c]/90 text-muted-foreground shadow-lg backdrop-blur-sm transition-all hover:border-brass/70 hover:text-brass focus:outline-none focus:ring-2 focus:ring-brass/50 cursor-pointer"
            aria-label={t('close')}
          >
            <X className="w-5 h-5" />
          </DialogPrimitive.Close>

          {isExpanded ? (
            /* === TRYB PEŁNOEKRANOWY CZYTNIKA DOKUMENTU === */
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden p-6 md:p-8">
              <div className="flex items-center justify-between mb-4 border-b border-brass/20 pb-3 flex-none pr-14">
                <div>
                  <div className="font-special-elite text-xs uppercase tracking-[0.2em] text-primary">
                    {categoryLabel}
                  </div>
                  <h3 className="font-serif text-2xl md:text-3xl text-foreground mt-0.5">
                    {item.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="flex items-center gap-2 text-xs font-special-elite text-primary border border-primary/50 bg-primary/10 hover:bg-primary/20 shadow-glow px-3 py-1.5 transition-colors cursor-pointer"
                >
                  <Minimize2 className="w-4 h-4" />
                  <span>{t('collapseDocument')}</span>
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                <DiegeticDocumentViewer
                  item={item}
                  character={activeCharacter}
                  eraContext={resolvedEraContext}
                  isExpanded={true}
                />
              </div>
            </div>
          ) : (
            /* === STANDARDOWY UKŁAD DWUKOLUMNOWY === */
            <div className="flex flex-col md:flex-row min-h-0 flex-1 overflow-hidden">
              {/* === LEWA KOLUMNA: Grafika === */}
              <div className="md:w-[45%] flex-shrink-0 bg-black/30">
                {hasMap ? (
                  /* Mapa - pełna kolumna */
                  <div className="relative w-full h-full min-h-[280px] md:min-h-0 flex items-center justify-center p-4">
                    <SafeImage
                      src={item.mapUrl || item.imageUrl}
                      alt={t('mapAlt', { name: getLocalizedEquipmentName(item.name, locale) })}
                      className="max-w-full max-h-full object-contain"
                    />
                    <div className="absolute top-4 left-4 bg-brass/90 text-black text-[10px] font-bold font-special-elite uppercase px-2 py-0.5 shadow">
                      {t('mapBadge')}
                    </div>
                  </div>
                ) : hasImage ? (
                  /* Obraz wygenerowany AI */
                  <div className="relative w-full h-full min-h-[280px] md:min-h-0">
                    <SafeImage
                      src={item.imageUrl}
                      alt={getLocalizedEquipmentName(item.name, locale)}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-2 pointer-events-none border border-brass/25" />
                    <div className="absolute inset-0 pointer-events-none border border-black/80" />
                  </div>
                ) : (
                  /* Klimatyczny placeholder SVG */
                  <div className="w-full h-full min-h-[280px] md:min-h-0">
                    <EquipmentImagePlaceholder
                      category={item.category}
                      className="h-full"
                    />
                  </div>
                )}
              </div>

              {/* === PRAWA KOLUMNA: Informacje === */}
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6 md:p-8 md:pl-6">
                {/* Nagłówek: kategoria + nazwa */}
                <div className="mb-4 pr-12">
                  <div className="font-special-elite text-[10px] uppercase tracking-[0.3em] text-primary mb-1.5">
                    {categoryLabel}
                    {item.condition && (
                      <span className="ml-2 text-muted-foreground/60">
                        · {conditionLabels[item.condition] || item.condition}
                      </span>
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-serif text-2xl md:text-3xl text-foreground leading-tight">
                        {getLocalizedEquipmentName(item.name, locale)}
                      </h3>
                      {item.value != null && item.value > 0 && (
                        <div className="mt-1.5 font-special-elite text-sm text-brass/80">
                          {t('valueLabel', { value: formatEraCurrency(item.value, resolvedEraContext) })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Audio diegetyczne (jeśli jest) */}
                {item.audioUrl && (
                  <div
                    className={`mb-4 p-3.5 bg-[#0d0a07] border rounded-sm shadow-md transition-colors ${
                      isAudioPlaying ? 'border-primary/60 shadow-glow' : 'border-brass/40'
                    }`}
                  >
                    <audio
                      ref={audioRef}
                      src={item.audioUrl}
                      onEnded={() => setIsAudioPlaying(false)}
                      preload="none"
                    />
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`text-xs font-special-elite uppercase flex items-center gap-2 ${
                          isAudioPlaying ? 'text-primary' : 'text-brass'
                        }`}
                      >
                        <Disc className={`w-4 h-4 ${isAudioPlaying ? 'text-primary animate-spin' : 'text-brass'}`} />
                        <span>{t('audioLabel')}</span>
                      </div>
                      <div className="text-[11px] font-mono text-brass/60">
                        {resolvedEraContext?.effectiveYear && resolvedEraContext.effectiveYear < 1930
                          ? t('audioGramophone')
                          : t('audioTape')}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-2 border-t border-brass/20">
                      <button
                        type="button"
                        onClick={() => {
                          if (!audioRef.current) return;
                          audioRef.current.currentTime = 0;
                          audioRef.current.play().then(() => setIsAudioPlaying(true)).catch(() => setIsAudioPlaying(false));
                        }}
                        className="p-1.5 text-brass/70 hover:text-primary transition-colors rounded hover:bg-primary/10 cursor-pointer"
                        title="Od początku"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!audioRef.current) return;
                          if (isAudioPlaying) {
                            audioRef.current.pause();
                            setIsAudioPlaying(false);
                          } else {
                            audioRef.current.play().then(() => setIsAudioPlaying(true)).catch(() => setIsAudioPlaying(false));
                          }
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-special-elite rounded-sm transition-all cursor-pointer active:scale-98 shadow ${
                          isAudioPlaying
                            ? 'bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50 shadow-glow'
                            : 'bg-brass/20 hover:bg-brass/30 text-brass border border-brass/40'
                        }`}
                      >
                        {isAudioPlaying ? (
                          <>
                            <Pause className="w-4 h-4" />
                            <span>{t('pauseAudio')}</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" />
                            <span>{t('playAudio')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Opis fabularny (zawsze obecny) */}
                <p className="font-serif italic text-base text-muted-foreground leading-relaxed mb-4">
                  {effectiveLore}
                </p>

                {/* Sekcja czytania dokumentu */}
                {canRequestRead && (
                  <div className="mb-4 pt-2 border-t border-brass/20">
                    {item.readableContent ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-special-elite text-xs uppercase tracking-wider text-primary">
                            📜 {t('documentPreviewTitle')}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsExpanded(true)}
                            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary transition-colors font-special-elite px-2.5 py-1 border border-primary/50 bg-primary/10 hover:bg-primary/20 shadow-glow cursor-pointer"
                            title={t('expandDocument')}
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>{t('expandDocument')}</span>
                          </button>
                        </div>
                        <DiegeticDocumentViewer
                          item={item}
                          character={activeCharacter}
                          eraContext={resolvedEraContext}
                          isExpanded={false}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {errorMsg && (
                          <div
                            role="alert"
                            className="p-3 bg-[#2a130f] border border-[#a83226]/60 text-xs text-[#fca5a5] font-special-elite rounded-sm mb-2 shadow-md flex flex-col gap-1 leading-relaxed animate-in fade-in-50 duration-200"
                          >
                            <div className="flex items-center gap-1.5 font-bold tracking-wider uppercase text-brass/90 text-[11px]">
                              <span>⚠️</span>
                              <span>{t('errorTitle')}</span>
                            </div>
                            <p className="text-foreground/90 font-serif text-xs italic">{errorMsg}</p>
                          </div>
                        )}
                        {onUpdateItem ? (
                          <Button
                            onClick={handleReadItem}
                            disabled={isGenerating}
                            variant="default"
                            className="w-full justify-center bg-primary hover:bg-primary/90 text-primary-foreground border border-primary shadow-glow uppercase font-special-elite tracking-wider text-xs"
                          >
                            {isGenerating ? (
                              <>
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                {t('examining')}
                              </>
                            ) : (
                              t('readDocument')
                            )}
                          </Button>
                        ) : (
                          <p className="text-xs italic text-muted-foreground/60">
                            {t('readableOnSheet')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}



                {/* Mechanika / zastosowanie CoC 7e */}
                {mechanics.length > 0 && (
                  <div className="border-t border-brass/20 pt-3 space-y-1.5">
                    <div className="font-display uppercase tracking-[0.16em] text-brass text-xs mb-2">
                      {t('mechanicsTitle')}
                    </div>
                    {mechanics.map((row) => (
                      <div
                        key={row.label}
                        className="flex justify-between gap-4 font-special-elite text-sm"
                      >
                        <span className="text-muted-foreground uppercase tracking-[0.06em] text-xs">
                          {mechanicLabels[row.label] ?? row.label}
                        </span>
                        <span className="text-foreground">{row.value}</span>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
