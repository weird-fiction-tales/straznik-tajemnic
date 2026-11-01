import type {
  EquipmentCategory,
  EquipmentItem,
  EquipmentVisualEra,
} from '@/lib/types';
import {
  applyCatalogTemplate,
  CATEGORY_FALLBACK_ASSETS,
} from '@/lib/equipment-catalog';

export type PresetEra =
  | 'gaslight'
  | 'classic'
  | 'noir'
  | 'prl'
  | 'prl-1970s'
  | '1990s'
  | '2000s'
  | 'modern';
export type PresetArchetype =
  | 'investigator'
  | 'scholar'
  | 'action'
  | 'healer'
  | 'mystic'
  | 'trickster';

interface PresetEquipmentContext {
  id: string;
  era: PresetEra;
  archetype: PresetArchetype;
  equipment?: EquipmentItem[];
}

type EquipmentSeed = Omit<EquipmentItem, 'id' | 'imageUrl'>;

const CATEGORY_IMAGES: Record<EquipmentCategory, string> =
  CATEGORY_FALLBACK_ASSETS;

const FLASHLIGHT_TEMPLATE_IDS = new Set([
  'light.flashlight',
  'tool.heavy-police-flashlight-prl',
  'tool.tactical-flashlight-modern',
]);

const PRESET_VISUAL_ERAS: Record<PresetEra, EquipmentVisualEra> = {
  gaslight: '1890s',
  classic: '1920s',
  noir: '1940s',
  prl: 'prl-1970s',
  'prl-1970s': 'prl-1970s',
  '1990s': '1990s',
  '2000s': '2000s',
  modern: 'modern',
};

const ERA_KITS: Record<PresetEra, EquipmentSeed[]> = {
  gaslight: [
    {
      name: 'Latarnia oliwna',
      category: 'tool',
      description: 'Mosiężna latarnia na naftę dająca ciepłe, równe światło.',
    },
    {
      name: 'Zegarek kieszonkowy',
      category: 'personal',
      description: 'Klasyczny zegarek na łańcuszku w stalowej kopercie.',
    },
    {
      name: 'Skórzany pugilares',
      category: 'personal',
      description: 'Portfel na banknoty, monety i dokumenty tożsamości.',
    },
  ],
  classic: [
    {
      name: 'Latarka elektryczna',
      category: 'tool',
      description: 'Masywna latarka na baterie z metalową obudową.',
    },
    {
      name: 'Zapałki sztormowe',
      category: 'tool',
      description: 'Wodoodporne zapałki w metalowym etui.',
    },
  ],
  noir: [
    {
      name: 'Zapalniczka benzynowa',
      category: 'tool',
      description: 'Ciężka metalowa zapalniczka z charakterystycznym kliknięciem.',
    },
    {
      name: 'Papierosy i papierośnica',
      category: 'personal',
      description: 'Metalowa papierośnica z zapasem papierosów.',
    },
  ],
  prl: [
    {
      name: 'Latarka elektryczna',
      category: 'tool',
      description: 'Prosta metalowa latarka z ciężką baterią.',
    },
    {
      name: 'Kieszonkowa apteczka',
      category: 'medical',
      description: 'Bandaże, plaster i podstawowe środki opatrunkowe.',
    },
  ],
  'prl-1970s': [
    {
      name: 'Latarka elektryczna',
      category: 'tool',
      description: 'Prosta metalowa latarka z ciężką baterią.',
    },
    {
      name: 'Kieszonkowa apteczka',
      category: 'medical',
      description: 'Bandaże, plaster i podstawowe środki opatrunkowe.',
    },
  ],
  '1990s': [
    {
      name: 'Telefon komórkowy (cegła)',
      category: 'tool',
      description: 'Wczesny telefon komórkowy z anteną i ładowarką sieciową.',
    },
    {
      name: 'Zapasowe baterie (R6/AA)',
      category: 'tool',
      description: 'Zestaw baterii alkalicznych do latarki i dyktafonu.',
    },
    {
      name: 'Dokumenty tożsamości',
      category: 'document',
      description: 'Portfel z dokumentami.',
    },
  ],
  '2000s': [
    {
      name: 'Telefon komórkowy z klawiaturą',
      category: 'tool',
      description: 'Klasyczny telefon komórkowy z ładowarką.',
    },
    {
      name: 'Zapasowa bateria do telefonu',
      category: 'tool',
      description: 'Zapasowy akumulator litowo-jonowy.',
    },
    {
      name: 'Dokumenty tożsamości',
      category: 'document',
      description: 'Portfel z dokumentami.',
    },
  ],
  modern: [
    {
      name: 'Smartfon z ładowarką',
      category: 'tool',
      description: 'Smartfon z mapami offline i zabezpieczonym notatnikiem.',
    },
    {
      name: 'Powerbank',
      category: 'tool',
      description: 'Zapas energii na długi dzień pracy w terenie.',
    },
    {
      name: 'Dokumenty tożsamości',
      category: 'document',
      description: 'Portfel z kartami i dokumentami.',
    },
  ],
};

const ARCHETYPE_KITS: Record<PresetArchetype, EquipmentSeed[]> = {
  investigator: [
    {
      name: 'Aparat fotograficzny',
      category: 'tool',
      description: 'Dokumentuje miejsca, osoby i ślady na potrzeby śledztwa.',
    },
  ],
  scholar: [
    {
      name: 'Lupa terenowa',
      category: 'tool',
      description: 'Składana lupa do oględzin druku, znaków i artefaktów.',
    },
  ],
  action: [
    {
      name: 'Mocna lina',
      category: 'tool',
      description: 'Piętnaście metrów liny z karabińczykiem.',
    },
    {
      name: 'Opatrunek uciskowy',
      category: 'medical',
      description: 'Podstawowy opatrunek na obrażenia odniesione w terenie.',
    },
  ],
  healer: [
    {
      name: 'Torba medyczna',
      category: 'medical',
      description: 'Narzędzia i środki do udzielania pierwszej pomocy.',
      modifiers: { skill: 'Pierwsza Pomoc', bonus: 10 },
    },
    {
      name: 'Środek uspokajający',
      category: 'medical',
      description: 'Odmierzona dawka leku do użycia w nagłym przypadku.',
    },
  ],
  mystic: [
    {
      name: 'Kreda rytualna',
      category: 'occult',
      description: 'Biała kreda do oznaczania symboli i granic ochronnych.',
    },
    {
      name: 'Talizman ochronny',
      category: 'occult',
      description: 'Osobista pamiątka używana podczas praktyk duchowych.',
    },
  ],
  trickster: [
    {
      name: 'Drobne narzędzia',
      category: 'tool',
      description: 'Kieszonkowy zestaw uniwersalnych narzędzi.',
    },
    {
      name: 'Fałszywe dokumenty',
      category: 'document',
      description: 'Dobrze przygotowane fałszywe referencje.',
    },
  ],
};

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('pl-PL');
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function withLocalImage(
  item: EquipmentItem,
  era: EquipmentVisualEra
): EquipmentItem {
  const hasCategoryFallback = Object.values(CATEGORY_IMAGES).includes(
    item.imageUrl ?? ''
  );
  const catalogItem = applyCatalogTemplate(
    {
      ...item,
      source: item.source ?? 'starting',
      condition: item.condition ?? 'used',
      imageUrl: hasCategoryFallback ? undefined : item.imageUrl,
    },
    era
  );

  return {
    ...catalogItem,
    imageUrl: catalogItem.imageUrl ?? CATEGORY_IMAGES[catalogItem.category],
    visualSource: catalogItem.imageUrl ? 'catalog' : 'fallback',
  };
}

/**
 * Rozwiązuje docelową epokę wyposażenia na podstawie epoki przygody lub presetu.
 */
export function resolveTargetPresetEra(
  presetEra: PresetEra,
  targetEra?: string | { effectiveYear?: number; canonicalEra?: string }
): PresetEra {
  if (!targetEra) return presetEra;

  if (typeof targetEra === 'object' && targetEra !== null) {
    if (targetEra.effectiveYear) {
      const y = targetEra.effectiveYear;
      if (y < 1914) return 'gaslight';
      if (y <= 1933) return 'classic';
      if (y <= 1959) return 'noir';
      if (y <= 1980) return 'prl-1970s';
      if (y <= 1999) return '1990s';
      if (y <= 2009) return '2000s';
      return 'modern';
    }
    if (targetEra.canonicalEra) {
      return resolveTargetPresetEra(presetEra, targetEra.canonicalEra);
    }
  }

  const str = String(targetEra).toLowerCase().trim();
  if (
    str === 'prl-1970s' ||
    str === 'prl' ||
    str.includes('prl') ||
    str.includes('1970') ||
    str.includes('1973') ||
    str.includes('1974')
  ) {
    return 'prl-1970s';
  }
  if (
    str === '1990s' ||
    str.includes('1990') ||
    str.includes('lata 90') ||
    str.includes('1999') ||
    str.includes('1995') ||
    str.includes('1996')
  ) {
    return '1990s';
  }
  if (
    str === '2000s' ||
    str.includes('2000') ||
    str.includes('2001') ||
    str.includes('y2k')
  ) {
    return '2000s';
  }
  if (
    str === 'gaslight' ||
    str.includes('1890') ||
    str.includes('gaslight') ||
    str.includes('wiktoria')
  ) {
    return 'gaslight';
  }
  if (
    str === 'classic' ||
    str.includes('1920') ||
    str.includes('classic') ||
    str.includes('lata 20')
  ) {
    return 'classic';
  }
  if (
    str === 'noir' ||
    str.includes('1930') ||
    str.includes('1940') ||
    str.includes('1950')
  ) {
    return 'noir';
  }
  if (
    str === 'modern' ||
    str.includes('modern') ||
    str.includes('wspolczesn') ||
    str.includes('współczesn')
  ) {
    return 'modern';
  }

  return presetEra;
}

/**
 * Rozbudowuje osobisty ekwipunek presetu o zestaw epoki i archetypu.
 * Nazwy są deduplikowane, a każdy przedmiot dostaje lokalną miniaturę kategorii,
 * dzięki czemu gotowy badacz nie uruchamia generatora obrazów przez API.
 * Jeśli przekazano targetEra ze scenariusza, ma ona pierwszeństwo nad presetem.
 */
export function buildPredefinedEquipment(
  preset: PresetEquipmentContext,
  targetEra?: string | { effectiveYear?: number; canonicalEra?: string }
): EquipmentItem[] {
  const effectiveEra = resolveTargetPresetEra(preset.era, targetEra);
  const visualEra = PRESET_VISUAL_ERAS[effectiveEra];
  if (!visualEra) {
    throw new Error(`Brak wizualnego profilu epoki dla presetu: ${effectiveEra}`);
  }
  const result = (preset.equipment ?? []).map((item) =>
    withLocalImage(item, visualEra)
  );
  const names = new Set(result.map((item) => normalizeName(item.name)));

  const eraKit = ERA_KITS[effectiveEra] ?? ERA_KITS['classic'];
  const archetypeKit = ARCHETYPE_KITS[preset.archetype] ?? [];

  [...eraKit, ...archetypeKit].forEach((seed) => {
    const normalized = normalizeName(seed.name);
    if (names.has(normalized)) return;
    const item = withLocalImage(
      { ...seed, id: `eq_${slugify(preset.id)}_${slugify(seed.name)}` },
      visualEra
    );
    // Uzupełniamy zestaw startowy, nie scalamy już posiadanych egzemplarzy.
    if (
      item.templateId === 'light.flashlight' &&
      result.some((owned) => FLASHLIGHT_TEMPLATE_IDS.has(owned.templateId ?? ''))
    ) return;
    names.add(normalized);
    result.push(item);
  });

  // Niektóre osobiste elementy celowo pokrywają się z zestawem epoki (np.
  // latarka kolejarza). Dajemy wtedy neutralny, użyteczny dodatek zamiast
  // dublować przedmiot i pozostawiać gotową postać z uboższym zestawem.
  if (result.length < 6 && !names.has(normalizeName('Kompas kieszonkowy'))) {
    result.push(
      withLocalImage(
        {
          id: `eq_${slugify(preset.id)}_kompas-kieszonkowy`,
          name: 'Kompas kieszonkowy',
          category: 'tool',
          description: 'Solidny kompas polowy ułatwiający orientację w terenie.',
        },
        visualEra
      )
    );
  }

  return result;
}

export { CATEGORY_IMAGES };
