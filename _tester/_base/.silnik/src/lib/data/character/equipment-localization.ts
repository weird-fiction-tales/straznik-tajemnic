/**
 * Angielskie nazwy i opisy ekwipunku Call of Cthulhu 7e RAW (Issue #813 - Plaster 4).
 * Zapewnia 100% symetrie jezykowa PL <-> EN dla ekwipunku poczatkowego, bazy przedmiotow
 * oraz kart wyposazenia w kreatorze i karcie badacza.
 */

import type { EquipmentItem } from '@/lib/types';
import { generateItemLore } from '@/lib/character/item-helpers';

export const EQUIPMENT_NAMES_EN: Record<string, string> = {
  // Bron
  "Rewolwer .38": ".38 Revolver",
  "Rewolwer .32": ".32 Revolver",
  "Pistolet .32": ".32 Semi-Auto",
  "Pistolet .45": ".45 Automatic",
  "Karabin": "Rifle",
  "Sztucer myśliwski": "Hunting Rifle",
  "Dubeltówka (dwururka)": "Shotgun (Double-Barrel)",
  "Dubeltówka": "Shotgun",
  "Nóż": "Knife",
  "Maczeta": "Machete",
  "Pałka policyjna": "Police Baton",
  "Drewniany kij lub pałka": "Club / Baton",

  // Narzedzia i oswietlenie
  "Latarka": "Flashlight",
  "Lampa naftowa": "Oil Lantern",
  "Lina (15 m)": "Rope (50 ft)",
  "Lina": "Rope",
  "Wytrychy": "Lockpicks",
  "Zestaw narzędzi (mechaniczny)": "Tool Kit (Mechanical)",
  "Zestaw narzędzi (elektryczny)": "Tool Kit (Electrical)",
  "Lupa": "Magnifying Glass",
  "Kompas": "Compass",
  "Lornetka": "Binoculars",
  "Lornetka teatralna": "Opera Glasses",
  "Aparat fotograficzny": "Camera",
  "Statyw": "Tripod",
  "Klisza": "Camera Film",
  "Termometr": "Thermometer",
  "Detektor pola elektromagnetycznego": "EMF Detector",
  "Sprzęt laboratoryjny (w laboratorium)": "Laboratory Equipment (in lab)",
  "Sprzęt laboratoryjny": "Laboratory Equipment",
  "Pędzel i kielnia": "Brush and Trowel",

  // Medyczne
  "Apteczka": "First Aid Kit",
  "Torba lekarska": "Medical Bag",
  "Bandaże": "Bandages",
  "Morfina (5 dawek)": "Morphine (5 doses)",
  "Morfina": "Morphine",

  // Osobiste i uzytkowe
  "Zegarek kieszonkowy": "Pocket Watch",
  "Zapałki": "Matches",
  "Pudełko zapałek": "Matchbox",
  "Zapalniczka": "Lighter",
  "Piersiówka": "Flask",
  "Papierośnica": "Cigarette Case",
  "Portfel": "Wallet",
  "Plecak": "Backpack",
  "Koc": "Blanket",
  "Manierka": "Canteen",
  "Kluczyki do samochodu": "Car Keys",
  "Kombinezon": "Coveralls",
  "Strój sportowy": "Athletic Wear",
  "Torba sportowa": "Gym Bag",
  "Ręcznik": "Towel",
  "Aktówka": "Briefcase",
  "Odznaka": "Badge",
  "Kajdanki": "Handcuffs",

  // Dokumenty, pismiennictwo i media
  "Książki źródłowe": "Reference Books",
  "Karta biblioteczna": "Library Card",
  "Legitymacja prasowa": "Press Pass",
  "Maszyna do pisania (w domu)": "Typewriter (at home)",
  "Maszyna do pisania": "Typewriter",
  "Notes": "Notebook",
  "Notatnik": "Notebook",
  "Dziennik": "Journal",
  "Dziennik/Pamiętnik": "Journal / Diary",
  "Szkicownik": "Sketchbook",
  "Ołówki i węgiel": "Pencils and Charcoal",
  "Paleta i pędzle": "Palette and Brushes",
  "Instrument": "Musical Instrument",
  "Nuty": "Sheet Music",
  "Scenariusz": "Script",
  "Fałszywe dokumenty": "Forged Documents",
  "Wycinek z gazety": "Newspaper Clipping",
  "List": "Letter",
  "Mapa": "Map",
  "Stara fotografia": "Old Photograph",
  "Fotografia": "Photograph",
  "Komputer przenośny": "Laptop",

  // Religijne i okultyzm
  "Świece (12 szt.)": "Candles (12)",
  "Świece": "Candles",
  "Kreda (kolorowa)": "Chalk (colored)",
  "Kreda": "Chalk",
  "Kadzidło i kadzielnica": "Incense & Burner",
  "Dziwny amulet": "Strange Amulet",
  "Biblia/modlitewnik": "Bible / Prayer Book",
  "Biblia": "Bible",
  "Krucyfiks": "Crucifix",
  "Zestaw do charakteryzacji": "Disguise Kit",
  "Srebrne lusterko": "Silver Mirror",
  "Kryształowa kula": "Crystal Ball",
  "Księga Mitów": "Mythos Tome"
};

/**
 * Odwrocona mapa EN -> PL dla szybkiego resolve w obydwie strony.
 */
const EQUIPMENT_MAP_EN_TO_PL: Record<string, string> = {};
for (const [plName, enName] of Object.entries(EQUIPMENT_NAMES_EN)) {
  EQUIPMENT_MAP_EN_TO_PL[enName.trim().toLowerCase()] = plName;
}

// Dodatkowe powszechne aliasy angielskie
const ADDITIONAL_EQUIPMENT_ALIASES: Record<string, string> = {
  'flashlight': 'Latarka',
  'lantern (oil)': 'Lampa naftowa',
  'oil lantern': 'Lampa naftowa',
  'matches': 'Zapałki',
  'rope (50 ft)': 'Lina (15 m)',
  'rope': 'Lina (15 m)',
  'lockpicks': 'Wytrychy',
  'lockpick': 'Wytrychy',
  'first aid kit': 'Apteczka',
  'pocket watch': 'Zegarek kieszonkowy',
  'camera': 'Aparat fotograficzny',
  'binoculars': 'Lornetka',
  'magnifying glass': 'Lupa',
  'compass': 'Kompas',
  'knife': 'Nóż',
  'machete': 'Maczeta',
  '.38 revolver': 'Rewolwer .38',
  '.32 revolver': 'Rewolwer .32',
  '.45 automatic': 'Pistolet .45',
  'hunting rifle': 'Sztucer myśliwski',
  'shotgun (double-barrel)': 'Dubeltówka (dwururka)',
  'shotgun': 'Dubeltówka (dwururka)',
  'medical bag': 'Torba lekarska',
  'bandages': 'Bandaże',
  'bandage': 'Bandaże',
  'handcuffs': 'Kajdanki',
  'badge': 'Odznaka',
  'flask': 'Piersiówka',
  'lighter': 'Zapalniczka',
  'backpack': 'Plecak',
  'wallet': 'Portfel',
  'laptop': 'Komputer przenośny',
  'reference books': 'Książki źródłowe',
  'library card': 'Karta biblioteczna',
  'press pass': 'Legitymacja prasowa',
  'typewriter': 'Maszyna do pisania (w domu)',
  'typewriter (at home)': 'Maszyna do pisania (w domu)',
  'strange amulet': 'Dziwny amulet'
};

for (const [enAlias, pl] of Object.entries(ADDITIONAL_EQUIPMENT_ALIASES)) {
  EQUIPMENT_MAP_EN_TO_PL[enAlias.trim().toLowerCase()] = pl;
}

/**
 * Zwraca zlokalizowana nazwe przedmiotu Call of Cthulhu 7e w zadanym jezyku ('pl' lub 'en').
 * Obsluguje:
 * - 'Lupa' -> 'Magnifying Glass' (gdy locale === 'en')
 * - 'Magnifying Glass' -> 'Lupa' (gdy locale === 'pl')
 * - Zachowanie specyfikacji w nawiasach: 'Lina (15 m)' -> 'Rope (50 ft)'
 */
export function getLocalizedEquipmentName(
  rawName: string | null | undefined,
  locale: 'pl' | 'en' | string = 'pl'
): string {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  if (!trimmed) return '';

  const isEn = locale === 'en';
  const lower = trimmed.toLowerCase();

  // 1. Bezposrednie dopasowanie w mapie
  if (isEn && EQUIPMENT_NAMES_EN[trimmed]) {
    return EQUIPMENT_NAMES_EN[trimmed];
  }
  if (!isEn && EQUIPMENT_MAP_EN_TO_PL[lower]) {
    return EQUIPMENT_MAP_EN_TO_PL[lower];
  }

  // 2. Dopasowanie bez rozrozniania wielkosci liter
  for (const [plName, enName] of Object.entries(EQUIPMENT_NAMES_EN)) {
    if (plName.toLowerCase() === lower) {
      return isEn ? enName : plName;
    }
    if (enName.toLowerCase() === lower) {
      return isEn ? enName : plName;
    }
  }

  // 3. Obsluga nawiasow: np. "Narzędzia (specjalistyczne)" -> "Tools (specjalistyczne)"
  const bracketMatch = trimmed.match(/^([^(]+)\(([^)]+)\)$/);
  if (bracketMatch) {
    const baseName = bracketMatch[1].trim();
    const spec = bracketMatch[2].trim();
    const localizedBase = getLocalizedEquipmentName(baseName, locale);
    if (localizedBase && localizedBase !== baseName) {
      return `${localizedBase} (${spec})`;
    }
  }

  return trimmed;
}

/**
 * Zwraca zlokalizowany opis klimatyczny przedmiotu (lore) wolny od wyciekow jezykowych.
 */
export function getLocalizedEquipmentDescription(
  itemOrName: Partial<EquipmentItem> | string | null | undefined,
  locale: 'pl' | 'en' | string = 'pl'
): string {
  if (!itemOrName) return '';

  const name =
    typeof itemOrName === 'string'
      ? itemOrName
      : itemOrName.name || '';
  const rawDescription =
    typeof itemOrName === 'string'
      ? ''
      : itemOrName.description?.trim() || '';

  const isEn = locale === 'en';

  if (!isEn) {
    // W jezyku polskim: preferuj istniejacy opis lub generuj polski lore
    if (rawDescription && /[ąćęłńóśźż]/i.test(rawDescription)) {
      return rawDescription;
    }
    return rawDescription || generateItemLore(name, 'pl');
  }

  // W jezyku angielskim:
  // Jesli opis istnieje i jest w calosci po angielsku (brak polskich znakow diakrytycznych)
  if (rawDescription && !/[ąćęłńóśźż]/i.test(rawDescription)) {
    // Sprawdz czy to nie jest krótki polski tekst bez ogonkow z ALL_EQUIPMENT
    const isKnownPolishText =
      rawDescription.includes('Maly rewolwer') ||
      rawDescription.includes('Standardowy rewolwer') ||
      rawDescription.includes('Drewniany kij') ||
      rawDescription.includes('Karabin mysliwski') ||
      rawDescription.includes('Swiece woskowe') ||
      rawDescription.includes('Kadzidlo') ||
      rawDescription.includes('Wycinek z gazety') ||
      rawDescription.includes('Skorzany portfel') ||
      rawDescription.includes('Stara fotografia');

    if (!isKnownPolishText) {
      return rawDescription;
    }
  }

  // Fallback do generatora angielskiego lore CoC 7e
  return generateItemLore(name, 'en');
}
