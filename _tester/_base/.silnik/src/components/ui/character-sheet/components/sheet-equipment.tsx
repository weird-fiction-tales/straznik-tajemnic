'use client';

import { SafeImage } from '@/components/ui/safe-image';
import { useTranslations, useLocale } from 'next-intl';
import { generateItemLore } from '@/lib/character/item-helpers';
import {
  getLocalizedEquipmentName,
  getLocalizedEquipmentDescription,
  getLocalizedSkillName,
} from '@/lib/data/character';
/**
 * CharacterSheet - SheetEquipment komponent (re-skin Dark Art Déco, makieta 04).
 *
 * Sekcja 7 EKWIPUNEK I FINANSE. Rozdziela:
 *   - 💵 FINANSE I STANDARD ŻYCIA - CoC 7e RAW (poziom życia, wydatki dzienne, gotówka, majątek),
 *   - ⚔️ BROŃ - pełna statystyka bojowa (umiejętność %, obrażenia, zasięg, zacięcie),
 *   - 🎒 WYPOSAŻENIE - pozostałe przedmioty jako kafle déco 2-kolumnowe.
 *
 * Klasyfikacja broni reużyta z weapon-context, wartość umiejętności bojowej z
 * resolveTestValue. RAW: brak wagi; broń biała dolicza DB postaci.
 */

import type { Character, EquipmentItem } from '@/lib/types';
import { resolveTestValue } from '@/lib/skill-test-resolver';
import {
  isWeapon,
  inferWeaponSkill,
  isMeleeWeapon,
} from '@/lib/combat/weapon-context';
import { formatWeaponRange } from '@/lib/era';
import {
  Package,
  Sword,
  Shield,
  Wrench,
  FileText,
  Sparkles,
  User,
  HeartPulse,
  Flame,
  Coins,
  Wallet,
  Landmark,
  Home,
} from 'lucide-react';

/** Ikona kategorii przedmiotu (Lucide) - placeholder gdy brak wygenerowanego obrazu AI. */
function CategoryIcon({ category, className }: { category: string; className?: string }) {
  switch (category) {
    case 'weapon':
      return <Sword className={className} />;
    case 'armor':
      return <Shield className={className} />;
    case 'tool':
      return <Wrench className={className} />;
    case 'document':
      return <FileText className={className} />;
    case 'artifact':
      return <Sparkles className={className} />;
    case 'personal':
      return <User className={className} />;
    case 'medical':
      return <HeartPulse className={className} />;
    case 'occult':
      return <Flame className={className} />;
    default:
      return <Package className={className} />;
  }
}

import { deriveFinances, type EconomyEraContext } from '@/lib/economy/credit-rating';

export interface SheetEquipmentProps {
  character: Character;
  eraContext?: EconomyEraContext | string | null;
  onItemClick?: (item: EquipmentItem) => void;
}

/**
 * Miniatura przedmiotu (B2): pokazuje obraz `item.imageUrl` gdy istnieje
 * (generowany w tle przez useEquipmentThumbnails IND-271 lub ręcznie w
 * EquipmentModal), w przeciwnym razie ikonę kategorii w stylu Art Déco. Read-only - panel karty
 * nie generuje obrazów (to robi modal/hook), tu tylko prezentacja.
 */
function ItemThumbnail({ item }: { item: EquipmentItem }) {
  return (
    <div className="flex-none w-20 h-20 border border-brass/30 bg-gradient-to-br from-[#1c1712] to-[#0f0b07] overflow-hidden flex items-center justify-center relative shadow-md rounded-sm transition-colors hover:border-brass/50">
      {item.imageUrl && !item.imageUrl.endsWith('.svg') ? (
        <SafeImage
          src={item.imageUrl}
          alt={item.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex items-center justify-center w-full h-full text-brass/70">
          <CategoryIcon category={item.category} className="w-6 h-6" />
        </div>
      )}
      {typeof item.quantity === 'number' && item.quantity > 0 && (
        <span className="absolute bottom-1 right-1 font-special-elite text-[11px] font-bold bg-[#120e0a]/95 text-brass border border-brass/40 px-1.5 py-0.5 rounded shadow">
          x{item.quantity}
        </span>
      )}
    </div>
  );
}

/**
 * Renderuje ekwipunek postaci: broń z pełną statystyką bojową + resztę jako kafle.
 * Zwraca null gdy postać nie ma ekwipunku (sekcja znika z karty).
 */
export function SheetEquipment({ character, eraContext, onItemClick }: SheetEquipmentProps) {
  const t = useTranslations('CharacterSheet');
  const locale = useLocale();
  const currentLocale = (locale === 'en' ? 'en' : 'pl') as 'pl' | 'en';
  const finances = deriveFinances(character, eraContext, currentLocale);

  // Kanoniczne nazwy umiejetnosci (dane gry, SSOT z weapon-context) mapujemy na
  // etykiety wyswietlania per jezyk - dopasowanie wartosci zostaje na kanonie.
  const skillLabel = (canonical: string): string => {
    return getLocalizedSkillName(canonical, currentLocale);
  };
  const equipment = character.equipment ?? [];
  const weapons = equipment.filter(isWeapon);
  const medical = equipment.filter((item) => !isWeapon(item) && item.category === 'medical');
  const tools = equipment.filter((item) => !isWeapon(item) && (item.category === 'tool' || item.category === 'armor'));
  const documents = equipment.filter((item) => !isWeapon(item) && item.category === 'document');
  const occult = equipment.filter((item) => !isWeapon(item) && (item.category === 'artifact' || item.category === 'occult'));
  const personal = equipment.filter(
    (item) =>
      !isWeapon(item) &&
      item.category !== 'medical' &&
      item.category !== 'document' &&
      item.category !== 'artifact' &&
      item.category !== 'occult' &&
      item.category !== 'tool' &&
      item.category !== 'armor'
  );

  const damageBonus = character.damageBonus?.trim();
  const hasDb =
    Boolean(damageBonus) && damageBonus !== '0' && damageBonus !== '-';

  return (
    <div>
      <h3 className="font-display uppercase tracking-[0.24em] text-brass text-xs font-semibold mb-4">
        🎒 {t('equipment')}
      </h3>

      {/* FINANSE I STANDARD ŻYCIA (CoC 7e RAW) */}
      <div className="mb-5 border border-brass/30 bg-gradient-to-br from-[#181410] via-[#140f0c] to-[#0d0a08] p-4 rounded-sm relative overflow-hidden shadow-md">
        {/* Narożniki Déco */}
        <span className="absolute top-1 left-1 w-3 h-3 border-t border-l border-brass/50 pointer-events-none" />
        <span className="absolute top-1 right-1 w-3 h-3 border-t border-r border-brass/50 pointer-events-none" />
        <span className="absolute bottom-1 left-1 w-3 h-3 border-b border-l border-brass/50 pointer-events-none" />
        <span className="absolute bottom-1 right-1 w-3 h-3 border-b border-r border-brass/50 pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-brass/20">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-brass" />
            <span className="font-display uppercase tracking-[0.18em] text-sm font-semibold text-brass">
              {t('livingStandard')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-special-elite text-xs sm:text-sm bg-brass/15 text-brass border border-brass/40 px-2.5 py-0.5 rounded font-semibold">
              {finances.tierLabel} ({finances.creditRating}%)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-special-elite text-sm mb-3">
          <div className="bg-[#100c09] border border-brass/20 p-2.5 rounded-sm">
            <div className="text-xs uppercase tracking-wider text-brass/90 mb-1 flex items-center gap-1.5 font-semibold">
              <Wallet className="w-3.5 h-3.5 text-brass" />
              {t('dailySpending')}
            </div>
            <div className="text-foreground font-bold text-base">
              {finances.formattedSpendingLevel}
            </div>
          </div>

          <div className="bg-[#100c09] border border-brass/20 p-2.5 rounded-sm">
            <div className="text-xs uppercase tracking-wider text-brass/90 mb-1 flex items-center gap-1.5 font-semibold">
              <Coins className="w-3.5 h-3.5 text-brass" />
              {t('cash')}
            </div>
            <div className="text-foreground font-bold text-base">
              {finances.formattedCash}
            </div>
          </div>

          <div className="bg-[#100c09] border border-brass/20 p-2.5 rounded-sm">
            <div className="text-xs uppercase tracking-wider text-brass/90 mb-1 flex items-center gap-1.5 font-semibold">
              <Landmark className="w-3.5 h-3.5 text-brass" />
              {t('assets')}
            </div>
            <div className="text-foreground font-bold text-base truncate" title={finances.formattedAssets}>
              {finances.formattedAssets}
            </div>
          </div>
        </div>

        {finances.livingConditions && (
          <div className="flex items-start gap-2 pt-2 border-t border-brass/15 text-xs font-serif italic text-muted-foreground/80 leading-relaxed">
            <Home className="w-3.5 h-3.5 text-brass/60 mt-0.5 shrink-0" />
            <span>{finances.livingConditions}</span>
          </div>
        )}
      </div>

      {/* BROŃ - pełna statystyka bojowa CoC 7e */}
      {weapons.length > 0 && (
        <div className="mb-4">
          <h4 className="font-special-elite text-[14px] text-brass/70 uppercase tracking-[0.16em] mb-2">
            ⚔️ {t('weapons')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {weapons.map((w) => {
              const skill = inferWeaponSkill(w);
              const skillDisplayName = skillLabel(skill);
              const skillVal = resolveTestValue(skill, character);
              const melee = isMeleeWeapon(w);
              const damage = w.modifiers?.damage ?? '-';
              const damageStr =
                melee && hasDb ? `${damage} ${damageBonus}` : damage;
              const weaponLore = getLocalizedEquipmentDescription(w, currentLocale);

              const abnormalCondition =
                w.condition === 'depleted'
                  ? t('conditionDepleted')
                  : w.condition === 'broken'
                    ? t('conditionBroken')
                    : w.condition === 'damaged'
                      ? t('conditionDamaged')
                      : null;

              return (
                <div
                  key={w.id}
                  onClick={() => onItemClick?.(w)}
                  className="cursor-pointer border border-[#b3322c]/35 bg-[#181410] hover:bg-[#1f1a14]/60 p-4 rounded-sm flex flex-col justify-between hover:border-[#b3322c]/60 transition-all duration-200"
                >
                  <div>
                    <div className="flex justify-between items-start gap-3 mb-2.5">
                      <span className="flex items-center gap-3 min-w-0">
                        <ItemThumbnail item={w} />
                        <span className="font-serif text-lg text-foreground font-medium truncate leading-tight">
                          {getLocalizedEquipmentName(w.name, currentLocale)}
                        </span>
                      </span>
                      <span className="flex-none font-special-elite text-sm text-[#d9685f] bg-[#d9685f]/10 px-2 py-0.5 rounded border border-[#d9685f]/20">
                        {skillDisplayName}{' '}
                        <span className="font-bold">
                          {skillVal !== null ? `${skillVal}%` : t('base')}
                        </span>
                      </span>
                    </div>
                    {weaponLore && (
                      <p className="font-serif italic text-sm md:text-base text-muted-foreground/90 line-clamp-2 leading-relaxed mb-2.5">
                        {weaponLore}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 font-special-elite text-sm text-muted-foreground/90 tracking-[0.04em] pt-2 border-t border-[#b3322c]/15">
                    <span className="flex items-center gap-1">⚔️ {t('damage')}: <strong className="text-foreground">{damageStr}</strong></span>
                    {w.modifiers?.range && (
                      <span className="flex items-center gap-1">
                        🎯 {t('range')}:{' '}
                        <strong className="text-foreground">
                          {formatWeaponRange(
                            w.modifiers.range,
                            character.currency === 'PLN' || character.currency === 'PLZ' || character.era?.includes('pl') || locale === 'pl'
                              ? 'metric'
                              : 'imperial',
                            locale === 'en' ? 'en' : 'pl'
                          )}
                        </strong>
                      </span>
                    )}
                    {typeof w.currentAmmo === 'number' && (
                      <span className="flex items-center gap-1">🔫 {t('ammo')}: <strong className="text-foreground">{w.currentAmmo} / {w.maxAmmo ?? w.modifiers?.capacity ?? 6}</strong></span>
                    )}
                    {w.isJammed && (
                      <span className="flex items-center gap-1 text-[#d9685f] font-bold">⚠️ {t('jammed')}</span>
                    )}
                    {abnormalCondition && (
                      <span className="flex items-center gap-1 text-[#d9685f] font-bold">⚠️ {abnormalCondition}</span>
                    )}
                    {w.modifiers?.malfunction && (
                      <span className="flex items-center gap-1">⚙️ {t('malfunction')}: <strong className="text-foreground">{w.modifiers.malfunction}</strong></span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MEDYCYNA I LECZENIE */}
      {medical.length > 0 && (
        <div className="mb-4">
          <h4 className="font-special-elite text-[14px] text-brass/70 uppercase tracking-[0.16em] mb-2">
            🩹 {t('categoryMedical')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {medical.map((item) => {
              const gearLore = getLocalizedEquipmentDescription(item, currentLocale);
              const abnormalCondition =
                item.condition === 'depleted'
                  ? t('conditionDepleted')
                  : item.condition === 'broken'
                    ? t('conditionBroken')
                    : item.condition === 'damaged'
                      ? t('conditionDamaged')
                      : null;
              return (
                <div
                  key={item.id}
                  onClick={() => onItemClick?.(item)}
                  className="cursor-pointer flex items-center gap-4 border border-brass/25 bg-[#181410] hover:bg-[#1f1a14]/60 p-4 rounded-sm hover:border-brass/45 transition-all duration-200"
                >
                  <ItemThumbnail item={item} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-serif text-lg text-foreground font-medium truncate leading-tight">
                        {getLocalizedEquipmentName(item.name, currentLocale)}
                      </span>
                      <div className="flex items-center gap-1.5 flex-none">
                        {abnormalCondition && (
                          <span className="font-special-elite text-xs px-1.5 py-0.5 rounded border text-[#d9685f] bg-[#d9685f]/10 border-[#d9685f]/20">
                            {abnormalCondition}
                          </span>
                        )}
                        {typeof item.charges === 'number' && (
                          <span className="font-special-elite text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                            🩹 {t('charges')}: {item.charges}/{item.maxCharges ?? 3}
                          </span>
                        )}
                      </div>
                    </div>
                    {gearLore && (
                      <div className="font-serif italic text-sm md:text-base text-muted-foreground/90 tracking-[0.02em] mt-1.5 line-clamp-2 leading-relaxed">
                        {gearLore}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* NARZĘDZIA I REKWIZYTY */}
      {tools.length > 0 && (
        <div className="mb-4">
          <h4 className="font-special-elite text-[14px] text-brass/70 uppercase tracking-[0.16em] mb-2">
            🔦 {t('categoryTools')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {tools.map((item) => {
              const gearLore = getLocalizedEquipmentDescription(item, currentLocale);
              const isDepleted = item.condition === 'depleted';
              const isBroken = item.condition === 'broken';
              const isDamaged = item.condition === 'damaged';
              const showConditionBadge = isDepleted || isBroken || isDamaged;
              return (
                <div
                  key={item.id}
                  onClick={() => onItemClick?.(item)}
                  className="cursor-pointer flex items-center gap-4 border border-brass/25 bg-[#181410] hover:bg-[#1f1a14]/60 p-4 rounded-sm hover:border-brass/45 transition-all duration-200"
                >
                  <ItemThumbnail item={item} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-serif text-lg text-foreground font-medium truncate leading-tight">
                        {getLocalizedEquipmentName(item.name, currentLocale)}
                      </span>
                      {showConditionBadge && (
                        <span className="flex-none font-special-elite text-xs px-1.5 py-0.5 rounded border text-[#d9685f] bg-[#d9685f]/10 border-[#d9685f]/20">
                          {isDepleted
                            ? t('conditionDepleted')
                            : isBroken
                              ? t('conditionBroken')
                              : t('conditionDamaged')}
                        </span>
                      )}
                    </div>
                    {gearLore && (
                      <div className="font-serif italic text-sm md:text-base text-muted-foreground/90 tracking-[0.02em] mt-1.5 line-clamp-2 leading-relaxed">
                        {gearLore}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DOKUMENTY I AKTA */}
      {documents.length > 0 && (
        <div className="mb-4">
          <h4 className="font-special-elite text-[14px] text-brass/70 uppercase tracking-[0.16em] mb-2">
            📜 {t('categoryDocuments')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {documents.map((item) => {
              const gearLore = getLocalizedEquipmentDescription(item, currentLocale);
              const abnormalCondition =
                item.condition === 'depleted'
                  ? t('conditionDepleted')
                  : item.condition === 'broken'
                    ? t('conditionBroken')
                    : item.condition === 'damaged'
                      ? t('conditionDamaged')
                      : null;
              return (
                <div
                  key={item.id}
                  onClick={() => onItemClick?.(item)}
                  className="cursor-pointer flex items-center gap-4 border border-brass/25 bg-[#181410] hover:bg-[#1f1a14]/60 p-4 rounded-sm hover:border-brass/45 transition-all duration-200"
                >
                  <ItemThumbnail item={item} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-serif text-lg text-foreground font-medium truncate leading-tight">
                        {getLocalizedEquipmentName(item.name, currentLocale)}
                      </span>
                      <div className="flex items-center gap-1.5 flex-none">
                        {abnormalCondition && (
                          <span className="font-special-elite text-xs px-1.5 py-0.5 rounded border text-[#d9685f] bg-[#d9685f]/10 border-[#d9685f]/20">
                            {abnormalCondition}
                          </span>
                        )}
                        {item.isReadable && (
                          <span className="font-special-elite text-xs text-brass bg-brass/10 px-1.5 py-0.5 rounded border border-brass/20">
                            📜 {t('categoryDocuments')}
                          </span>
                        )}
                      </div>
                    </div>
                    {gearLore && (
                      <div className="font-serif italic text-sm md:text-base text-muted-foreground/90 tracking-[0.02em] mt-1.5 line-clamp-2 leading-relaxed">
                        {gearLore}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ARTEFAKTY I OKULTYZM */}
      {occult.length > 0 && (
        <div className="mb-4">
          <h4 className="font-special-elite text-[14px] text-brass/70 uppercase tracking-[0.16em] mb-2">
            🔮 {t('categoryOccult')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {occult.map((item) => {
              const gearLore = getLocalizedEquipmentDescription(item, currentLocale);
              const abnormalCondition =
                item.condition === 'depleted'
                  ? t('conditionDepleted')
                  : item.condition === 'broken'
                    ? t('conditionBroken')
                    : item.condition === 'damaged'
                      ? t('conditionDamaged')
                      : null;
              return (
                <div
                  key={item.id}
                  onClick={() => onItemClick?.(item)}
                  className="cursor-pointer flex items-center gap-4 border border-[#8e4a96]/40 bg-[#181410] hover:bg-[#1f1a14]/60 p-4 rounded-sm hover:border-[#8e4a96]/70 transition-all duration-200"
                >
                  <ItemThumbnail item={item} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-serif text-lg text-foreground font-medium truncate leading-tight">
                        {getLocalizedEquipmentName(item.name, currentLocale)}
                      </span>
                      <div className="flex items-center gap-1.5 flex-none">
                        {abnormalCondition && (
                          <span className="font-special-elite text-xs px-1.5 py-0.5 rounded border text-[#d9685f] bg-[#d9685f]/10 border-[#d9685f]/20">
                            {abnormalCondition}
                          </span>
                        )}
                        <span className="font-special-elite text-xs text-[#b870c2] bg-[#8e4a96]/15 px-1.5 py-0.5 rounded border border-[#8e4a96]/30">
                          {t('occultItemBadge')}
                        </span>
                      </div>
                    </div>
                    {gearLore && (
                      <div className="font-serif italic text-sm md:text-base text-muted-foreground/90 tracking-[0.02em] mt-1.5 line-clamp-2 leading-relaxed">
                        {gearLore}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PRZEDMIOTY OSOBISTE */}
      {personal.length > 0 && (
        <div>
          <h4 className="font-special-elite text-[14px] text-brass/70 uppercase tracking-[0.16em] mb-2">
            🎒 {t('categoryPersonal')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {personal.map((item) => {
              const gearLore = getLocalizedEquipmentDescription(item, currentLocale);
              const abnormalCondition =
                item.condition === 'depleted'
                  ? t('conditionDepleted')
                  : item.condition === 'broken'
                    ? t('conditionBroken')
                    : item.condition === 'damaged'
                      ? t('conditionDamaged')
                      : null;
              return (
                <div
                  key={item.id}
                  onClick={() => onItemClick?.(item)}
                  className="cursor-pointer flex items-center gap-4 border border-brass/25 bg-[#181410] hover:bg-[#1f1a14]/60 p-4 rounded-sm hover:border-brass/45 transition-all duration-200"
                >
                  <ItemThumbnail item={item} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-serif text-lg text-foreground font-medium truncate leading-tight">
                        {getLocalizedEquipmentName(item.name, currentLocale)}
                      </span>
                      <div className="flex items-center gap-1.5 flex-none">
                        {abnormalCondition && (
                          <span className="font-special-elite text-xs px-1.5 py-0.5 rounded border text-[#d9685f] bg-[#d9685f]/10 border-[#d9685f]/20">
                            {abnormalCondition}
                          </span>
                        )}
                        {item.modifiers?.skill && item.modifiers?.bonus && (
                          <span className="font-special-elite text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                            {item.modifiers.skill} +{item.modifiers.bonus}%
                          </span>
                        )}
                      </div>
                    </div>
                    {gearLore && (
                      <div className="font-serif italic text-sm md:text-base text-muted-foreground/90 tracking-[0.02em] mt-1.5 line-clamp-2 leading-relaxed">
                        {gearLore}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
