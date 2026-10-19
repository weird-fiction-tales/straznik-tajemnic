'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { formatWeaponRange } from '@/lib/era';
import { SafeImage } from '@/components/ui/safe-image';
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
} from 'lucide-react';
import type {
  EquipmentCategory,
  EquipmentItem,
  EquipmentVisualEra,
} from '@/lib/types';
import {
  splitTopLevel,
  findEquipmentByName,
  createEquipmentItem,
  parseItemConsumableInfo,
} from '@/lib/equipment-data';
import {
  applyCatalogTemplate,
  findEquipmentTemplate,
  resolveCatalogAsset,
} from '@/lib/equipment-catalog';
import { resolveEraVisualProfile } from '@/lib/era-visual-style';
import {
  isWeapon,
  inferWeaponSkill,
  inferWeaponDamage,
} from '@/lib/combat/weapon-context';
import {
  generateItemLore,
  categorizeItem,
} from '@/lib/character/item-helpers';
import {
  getLocalizedEquipmentName,
  getLocalizedEquipmentDescription,
  getLocalizedSkillName,
} from '@/lib/data/character';
import { EquipmentDetailDialog } from './equipment-detail-dialog';

interface WizardEquipmentViewProps {
  equipmentStr: string;
  era?: string;
}

/** Ikona wektorowa kategorii w stylu Art Déco (gdy brak grafiki WebP). */
function CategoryIcon({
  category,
  className = 'w-5 h-5',
}: {
  category: string;
  className?: string;
}) {
  switch (category) {
    case 'weapon':
      return <Sword className={className} />;
    case 'armor':
      return <Shield className={className} />;
    case 'tool':
      return <Wrench className={className} />;
    case 'document':
    case 'story':
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

/**
 * Prezentacyjny widok wyposażenia w Kroku 6 kreatora badacza.
 * Wyświetla prerenderowane miniatury WebP z katalogu, opisy fabularne
 * oraz statystyki mechaniczne Call of Cthulhu 7e RAW (bez dodawania i usuwania).
 */
export function WizardEquipmentView({
  equipmentStr,
  era = '1920s',
}: WizardEquipmentViewProps) {
  const t = useTranslations('CharacterWizard');
  const locale = useLocale();
  const [selectedItem, setSelectedItem] = useState<EquipmentItem | null>(null);

  const effectiveEra = useMemo(
    () => resolveEraVisualProfile(era) as EquipmentVisualEra,
    [era]
  );

  // Budowanie pełnych obiektów EquipmentItem ze stringa ekwipunku
  const items = useMemo(() => {
    if (!equipmentStr?.trim()) return [];

    const names = splitTopLevel(equipmentStr).map((s) =>
      s.replace(/\s+/g, ' ').trim()
    );

    return names.map((name, index) => {
      const template = findEquipmentByName(name);
      let item: EquipmentItem;

      if (template) {
        item = createEquipmentItem(template, 'starting', effectiveEra);
        // Zachowujemy oryginalną wyświetlaną nazwę (np. jeśli szablon miał alias)
        item.name = name;
      } else {
        const cat = categorizeItem(name) as EquipmentCategory;
        const validCategory: EquipmentCategory = [
          'weapon',
          'armor',
          'tool',
          'document',
          'artifact',
          'personal',
          'medical',
          'occult',
        ].includes(cat)
          ? cat
          : 'personal';

        item = {
          id: `wizard_eq_${index}_${name.toLowerCase().replace(/\s+/g, '_')}`,
          name,
          category: validCategory,
          description: getLocalizedEquipmentDescription(name, locale),
          condition: 'used',
          source: 'starting',
          obtainedAt: new Date(),
        };

        // Próba podpięcia pod wzorzec katalogu (WebP asset)
        item = applyCatalogTemplate(item, effectiveEra);
      }

      // Jeśli szablon nie ma bezpośredniego imageUrl, sprawdź czy pasuje do szablonu z assetPaths
      if (!item.imageUrl) {
        const catalogTemplate = findEquipmentTemplate(name);
        if (catalogTemplate) {
          item.imageUrl = resolveCatalogAsset(catalogTemplate, effectiveEra);
          if (item.imageUrl) {
            item.templateId = catalogTemplate.id;
            item.visualSource = 'catalog';
          }
        }
      }

      // Uzupełnienie mechanik bojowych dla broni
      if (isWeapon(item) && !item.modifiers?.damage) {
        const inferred = inferWeaponDamage(item);
        if (inferred?.damage) {
          item.modifiers = {
            ...item.modifiers,
            damage: inferred.damage,
            range: inferred.range ?? item.modifiers?.range,
          };
        }
      }

      // Uzupełnienie informacji o zasobach zużywalnych
      const consumable = parseItemConsumableInfo(name);
      if (consumable.isConsumable) {
        item.isConsumable = true;
        item.quantity = item.quantity ?? consumable.quantity;
        item.maxQuantity = item.maxQuantity ?? consumable.maxQuantity;
      }

      // Upewnienie się, że opis lore istnieje i jest zlokalizowany
      if (!item.description || item.description.trim() === '' || locale === 'en') {
        item.description = getLocalizedEquipmentDescription(item, locale);
      }

      return item;
    });
  }, [equipmentStr, effectiveEra, locale]);

  // Etykiety kategorii
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'weapon':
        return t('categoryWeapon');
      case 'armor':
        return t('categoryArmor');
      case 'tool':
        return t('categoryTool');
      case 'document':
        return t('categoryDocument');
      case 'artifact':
        return t('categoryArtifact');
      case 'personal':
        return t('categoryPersonal');
      case 'medical':
        return t('categoryMedical');
      case 'occult':
        return t('categoryOccult');
      default:
        return t('categoryOther');
    }
  };

  return (
    <div className="border border-brass/28 bg-[#16130f] p-4 flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="block font-display uppercase tracking-[0.1em] text-brass text-xs font-semibold">
          {t('equipmentAndItems')}
        </label>
        {items.length > 0 && (
          <span className="font-special-elite text-[11px] text-brass/70 uppercase tracking-wider">
            {t('equipmentCount', { count: items.length })}
          </span>
        )}
      </div>

      <p className="font-serif italic text-xs text-muted-foreground mb-3">
        {t('equipmentDescription')}
      </p>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-brass/20 bg-[#0e0c09] text-center">
          <Package className="w-10 h-10 text-brass/30 mb-2" />
          <p className="font-serif italic text-sm text-muted-foreground">
            {t('equipmentEmpty')}
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {items.map((item) => {
              const hasImage = Boolean(item.imageUrl && !item.imageUrl.endsWith('.svg'));
              const damage = item.modifiers?.damage;
              const rawRange = item.modifiers?.range;
              const measurementSystem =
                locale === 'pl' || era?.toLowerCase().includes('pl')
                  ? 'metric'
                  : 'imperial';
              const range = rawRange
                ? formatWeaponRange(rawRange, measurementSystem, locale === 'en' ? 'en' : 'pl')
                : null;
              const weaponSkill = isWeapon(item) ? inferWeaponSkill(item) : null;
              const skillModifier = item.modifiers?.skill;
              const bonusModifier = item.modifiers?.bonus;
              const categoryLabel = getCategoryLabel(item.category);

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  title={item.name}
                  className="group border border-brass/25 bg-[#120f0b] hover:bg-[#1a1510] hover:border-brass/50 p-3 rounded-sm flex gap-3 items-start transition-all duration-200 cursor-pointer shadow-sm relative"
                >
                  {/* Miniatura graficzna */}
                  <div className="w-14 h-14 shrink-0 border border-brass/35 bg-gradient-to-br from-[#1c1712] via-[#140f0a] to-[#0b0805] overflow-hidden flex items-center justify-center relative shadow-sm rounded-sm group-hover:border-brass/60 transition-colors">
                    {hasImage ? (
                      <SafeImage
                        src={item.imageUrl!}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <CategoryIcon
                        category={item.category}
                        className="w-6 h-6 text-brass/70 group-hover:text-brass transition-colors"
                      />
                    )}
                    {typeof item.quantity === 'number' && item.quantity > 1 && (
                      <span className="absolute bottom-0.5 right-0.5 font-special-elite text-[10px] font-bold bg-[#120e0a]/95 text-brass border border-brass/40 px-1 rounded shadow">
                        x{item.quantity}
                      </span>
                    )}
                  </div>

                  {/* Informacje o przedmiocie */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="font-serif text-base font-semibold text-foreground truncate leading-tight group-hover:text-brass transition-colors">
                        {getLocalizedEquipmentName(item.name, locale)}
                      </span>
                      <span className="shrink-0 font-special-elite text-[10px] text-brass/80 bg-brass/10 px-1.5 py-0.5 rounded border border-brass/20 uppercase tracking-wider">
                        {categoryLabel}
                      </span>
                    </div>

                    {/* Linia statystyk i mechanik CoC 7e RAW */}
                    {(damage || weaponSkill || skillModifier || (item.isConsumable && item.quantity)) && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 font-special-elite text-[11px] text-muted-foreground/90 leading-tight">
                        {damage && (
                          <span className="text-foreground">
                            ⚔️ <strong className="text-brass/90">{damage}</strong>
                          </span>
                        )}
                        {range && <span>🎯 {range}</span>}
                        {weaponSkill && (
                          <span className="text-[#d9685f] bg-[#d9685f]/10 px-1 py-0.2 rounded border border-[#d9685f]/20">
                            {getLocalizedSkillName(weaponSkill, locale)}
                          </span>
                        )}
                        {skillModifier && (
                          <span className="text-primary bg-primary/10 px-1 py-0.2 rounded border border-primary/20">
                            🔧 {skillModifier} {bonusModifier ? `+${bonusModifier}%` : ''}
                          </span>
                        )}
                        {item.isConsumable && item.quantity && (
                          <span className="text-brass bg-brass/10 px-1 py-0.2 rounded border border-brass/30">
                            💊 {item.quantity === 1 ? t('usesCount', { count: 1 }) : t('dosesCount', { count: item.quantity })}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Opis fabularny / lore */}
                    {item.description && (
                      <p className="font-serif italic text-sm text-muted-foreground/90 line-clamp-2 leading-relaxed mt-1">
                        {getLocalizedEquipmentDescription(item, locale)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal szczegółów po kliknięciu w kafel */}
      {selectedItem && (
        <EquipmentDetailDialog
          item={selectedItem}
          era={era}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
