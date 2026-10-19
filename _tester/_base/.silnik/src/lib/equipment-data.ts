/**
 * Predefiniowane przedmioty ekwipunku dla Call of Cthulhu 7th Edition
 * Używane przez AI do generowania ekwipunku startowego
 */

import { EquipmentItem } from './types';
import {
  applyCatalogTemplate,
  findEquipmentTemplate,
} from './equipment-catalog';
import type { EquipmentVisualEra } from './types';
import { getLocalizedEquipmentName } from './data/character/equipment-localization';

// === BROŃ ===

export const WEAPONS: Partial<EquipmentItem>[] = [
  {
    name: '.32 Revolver',
    category: 'weapon',
    description: 'Mały rewolwer, łatwy do ukrycia.',
    modifiers: { damage: '1d8', range: '15 yards', malfunction: 100 },
    weight: 1,
    value: 15,
  },
  {
    name: '.38 Revolver',
    category: 'weapon',
    description: 'Standardowy rewolwer policyjny.',
    modifiers: { damage: '1d10', range: '15 yards', malfunction: 100 },
    weight: 1.5,
    value: 25,
  },
  {
    name: '.45 Automatic',
    category: 'weapon',
    description: 'Potężny pistolet automatyczny, model Colt M1911.',
    modifiers: { damage: '1d10+2', range: '15 yards', malfunction: 100 },
    weight: 2.5,
    value: 35,
  },
  {
    name: 'Shotgun (Double-Barrel)',
    category: 'weapon',
    description: 'Dwururka myśliwska, śmiertelna na krótki dystans.',
    modifiers: { damage: '2d6+2', range: '10 yards', malfunction: 100 },
    weight: 7,
    value: 40,
  },
  {
    name: 'Hunting Rifle',
    category: 'weapon',
    description: 'Karabin myśliwski z celownikiem.',
    modifiers: { damage: '2d6+4', range: '110 yards', malfunction: 100 },
    weight: 8,
    value: 75,
  },
  {
    name: 'Knife',
    category: 'weapon',
    description: 'Solidny nóż myśliwski.',
    modifiers: { damage: '1d4+2' },
    weight: 0.5,
    value: 3,
  },
  {
    name: 'Club/Baton',
    category: 'weapon',
    description: 'Drewniany kij lub pałka.',
    modifiers: { damage: '1d6' },
    weight: 1,
    value: 1,
  },
  {
    name: 'Machete',
    category: 'weapon',
    description: 'Ciężka maczeta do przecinania roślinności.',
    modifiers: { damage: '1d8+1' },
    weight: 2,
    value: 5,
  },
];

// === BROŃ II RZECZYPOSPOLITEJ (Rozdział 9 Podręcznika Badacza, s. 214-216) ===

export const WEAPONS_II_RP: Partial<EquipmentItem>[] = [
  {
    name: 'Nagant wz. 1895',
    templateId: 'weapon.nagant-1895',
    category: 'weapon',
    description: 'Rewolwer kalibru 7,62 mm Nagant z 7-nabojowym bębenkiem. Najpopularniejsza krótka broń II RP ("nagan"), przepisowa w Policji Państwowej, KOP i strażach.',
    modifiers: {
      damage: '1d8',
      range: '15 m',
      malfunction: 100,
      attacks: 1,
      capacity: 7,
      priceZl: 80,
      availability: 'Wymaga uznaniowego pozwolenia starosty; powszechny w służbach państwowych i WP',
    },
    weight: 0.8,
    value: 16,
  },
  {
    name: 'Reichsrevolver M1879',
    templateId: 'weapon.reichsrevolver-m1879',
    category: 'weapon',
    description: 'Ciężki (1,5 kg) niemiecki rewolwer wojskowy kalibru 10,6 mm z demobilu po zaborze pruskim. Potężna siła obalająca, brak rozładownika (powolne ładowanie pojedynczych łusek).',
    modifiers: {
      damage: '1d10+2',
      range: '15 m',
      malfunction: 90,
      attacks: 1,
      capacity: 6,
      priceZl: 100,
      availability: 'Pozostałość pozaborcza; formacje pomocnicze i policja',
    },
    weight: 1.5,
    value: 20,
  },
  {
    name: 'Browning FN 1900',
    templateId: 'weapon.browning-fn1900',
    category: 'weapon',
    description: 'Belgijski pistolet samopowtarzalny kalibru 7,65 mm Browning (.32 ACP). Niezwykle popularny w Polsce przed i po Wielkiej Wojnie, znany z zamachów politycznych.',
    modifiers: {
      damage: '1d8',
      range: '15 m',
      malfunction: 99,
      attacks: '1(3)',
      capacity: 7,
      priceZl: 130,
      availability: 'Wymaga pozwolenia starosty; powszechny na rynku cywilnym',
    },
    weight: 0.6,
    value: 25,
  },
  {
    name: 'Browning FN 1905',
    templateId: 'weapon.browning-fn1905',
    category: 'weapon',
    description: 'Kieszonkowy pistolet kamizelkowy kalibru 6,35 mm (.25 ACP). W dawnym zaborze pruskim sprzedawany bez pozwolenia, masowy w domach i polskim półświatku.',
    modifiers: {
      damage: '1d6',
      range: '15 m',
      malfunction: 98,
      attacks: '1(3)',
      capacity: 6,
      priceZl: 120,
      availability: 'Dawniej bez zezwolenia; bardzo łatwy do ukrycia, powszechny w półświatku',
    },
    weight: 0.4,
    value: 23,
  },
  {
    name: 'Browning M1910',
    templateId: 'weapon.browning-m1910',
    category: 'weapon',
    description: 'Jeden z najpopularniejszych pistoletów w międzywojennej Polsce, chętnie wybierany przez oficerów WP i wyższych urzędników. Kaliber 7,65 mm lub 9 mm krótki.',
    modifiers: {
      damage: '1d8',
      range: '15 m',
      malfunction: 99,
      attacks: '1(3)',
      capacity: 7,
      priceZl: 150,
      availability: 'Standard oficerów WP i wyższych urzędników; wymaga zezwolenia',
    },
    weight: 0.6,
    value: 29,
  },
  {
    name: 'P08 Parabellum',
    templateId: 'weapon.p08-parabellum',
    category: 'weapon',
    description: 'Niemiecki pistolet wojskowy (Luger) kalibru 9 mm Parabellum, słynący z wysokiej jakości wykonania i celności pod warunkiem starannej konserwacji.',
    modifiers: {
      damage: '1d10',
      range: '15 m',
      malfunction: 99,
      attacks: '1(3)',
      capacity: 8,
      priceZl: 200,
      availability: 'Broń wojskowa / poniemiecka; ściśle regulowana, wymaga zezwolenia',
    },
    weight: 0.9,
    value: 38,
  },
  {
    name: 'Mauser C96',
    templateId: 'weapon.mauser-c96',
    category: 'weapon',
    description: 'Charakterystyczny pistolet z drewnianą kaburo-kolbą kalibru 7,63 mm Mauser. Stały magazynek na 10 nabojów ładowany z łódki, weteran wojny 1920 r.',
    modifiers: {
      damage: '1d8',
      range: '25 m',
      malfunction: 99,
      attacks: '1(3)',
      capacity: 10,
      priceZl: 220,
      availability: 'Pozostałość po wojnie 1920 r., używany przez oficerów i straż',
    },
    weight: 1.1,
    value: 42,
  },
  {
    name: 'Colt M1911',
    templateId: 'weapon.colt-m1911',
    category: 'weapon',
    description: 'Potężny amerykański pistolet samopowtarzalny strzelający amunicją 11,43 mm (.45 ACP). W II RP broń rzadka z uwagi na trudnodostępną amunicję, lecz o olbrzymiej sile obalającej.',
    modifiers: {
      damage: '1d10+2',
      range: '15 m',
      malfunction: 99,
      attacks: '1(3)',
      capacity: 7,
      priceZl: 200,
      availability: 'Rzadki import w Polsce; trudnodostępna amunicja .45 ACP',
    },
    weight: 1.1,
    value: 38,
  },
  {
    name: 'Vis wz. 35',
    templateId: 'weapon.vis-wz35',
    category: 'weapon',
    description: 'Nowoczesny i niezawodny polski pistolet wojskowy kalibru 9 mm Parabellum, produkowany od 1935 r. w Fabryce Broni w Radomiu. Przepisowa broń oficerów WP i kawalerii.',
    modifiers: {
      damage: '1d10',
      range: '15 m',
      malfunction: 98,
      attacks: '1(3)',
      capacity: 8,
      priceZl: 200,
      availability: 'Od 1935 r.; ściśle wojskowy, przepisowa broń oficerów WP i kawalerii',
    },
    weight: 1.0,
    value: 38,
  },
  {
    name: 'Karabin wz. 98 / Karabin wz. 29',
    templateId: 'weapon.karabin-wz98',
    category: 'weapon',
    description: 'Podstawowy karabin i karabinek piechoty Wojska Polskiego kalibru 7,92 mm Mauser, produkowany w Radomiu na maszynach gdańskich. Donośność i skuteczność bojowa ponad 1000 m.',
    modifiers: {
      damage: '2d6+4',
      range: '100 m',
      malfunction: 100,
      attacks: 1,
      capacity: 5,
      priceZl: 250,
      availability: 'Ściśle wojskowy, wyposażenie piechoty Wojska Polskiego',
    },
    weight: 4.0,
    value: 48,
  },
  {
    name: 'Karabinek wz. 91/98/23',
    templateId: 'weapon.karabinek-wz91-98-23',
    category: 'weapon',
    description: 'Rosyjski karabin Mosin wz. 91 zdobyty w 1920 r., przekalibrowany w Polsce na amunicję 7,92 mm Mauser. Ze względu na niższą niezawodność przekazany Policji Państwowej i KOP.',
    modifiers: {
      damage: '2d6+4',
      range: '90 m',
      malfunction: 100,
      attacks: 1,
      capacity: 5,
      priceZl: 150,
      availability: 'Używany przez Policję Państwową, KOP i Straż Graniczną',
    },
    weight: 3.9,
    value: 29,
  },
  {
    name: 'Karabin ppanc wz. 35 Ur',
    templateId: 'weapon.karabin-ppanc-ur-wz35',
    category: 'weapon',
    description: 'Ściśle tajny polski karabin przeciwpancerny kalibru 7,92 mm DS (pocisk z rdzeniem ołowianym o prędkości wylotowej 1275 m/s). Zaprojektowany do niszczenia czołgów. Waga z dwójnogiem ponad 10 kg.',
    modifiers: {
      damage: '2d10+4',
      range: '150 m',
      malfunction: 99,
      attacks: 1,
      capacity: 4,
      priceZl: 2000,
      availability: 'Tajna broń wojskowa (od 1938 r.), niedostępna dla cywilów',
    },
    weight: 10.0,
    value: 380,
  },
  {
    name: 'Pistolet maszynowy Mors wz. 39',
    templateId: 'weapon.pm-mors',
    category: 'weapon',
    description: 'Polski pistolet maszynowy kalibru 9 mm Parabellum (łac. mors = śmierć) z magazynkiem na 24 naboje i wysuwanym chwytem przednim. Do wybuchu wojny powstała jedynie seria próbna (ok. 39 sztuk).',
    modifiers: {
      damage: '1d10',
      range: '30 m',
      malfunction: 99,
      attacks: '1(3) lub seria',
      capacity: 24,
      priceZl: 2500,
      availability: 'Prototyp wojskowy (1939 r.), seria próbna dla żołnierzy KOP',
    },
    weight: 4.2,
    value: 480,
  },
  {
    name: 'Dubeltówka myśliwska',
    templateId: 'weapon.dubeltowka-mysliwska',
    category: 'weapon',
    description: 'Klasyczna dwururka śrutowa kurkowa lub bezkurkowa (kaliber 12G lub 16G). Najpopularniejsza legalna długa broń w II RP, powszechna w kołach łowieckich i na prowincji.',
    modifiers: {
      damage: '4d6/2d6/1d6',
      range: '10/20/50 m',
      malfunction: 100,
      attacks: '1 lub 2',
      capacity: 2,
      priceZl: 180,
      availability: 'Wymaga przynależności do koła łowieckiego i pozwolenia starosty',
    },
    weight: 3.2,
    value: 35,
  },
  {
    name: 'Sztucer myśliwski',
    templateId: 'weapon.sztucer-mysliwski',
    category: 'weapon',
    description: 'Elegancki gwintowany karabin myśliwski (systemu Mauser lub Mannlicher) z celownikiem optycznym. Używany przez ziemiaństwo i leśników do polowań na grubą zwierzynę.',
    modifiers: {
      damage: '2d6+4',
      range: '100 m',
      malfunction: 100,
      attacks: 1,
      capacity: 5,
      priceZl: 350,
      availability: 'Wymaga pozwolenia na broń myśliwską; popularny w kołach łowieckich',
    },
    weight: 3.6,
    value: 68,
  },
  {
    name: 'Karabin maszynowy Chauchat',
    templateId: 'weapon.rkm-chauchat',
    category: 'weapon',
    description: 'Francuski ręczny karabin maszynowy wz. 1915 kalibru 8 mm Lebel z demobilu wojennego. Znany z fatalnej niezawodności i ciągłych zacięć ze względu na wycięcia w półkolistym magazynku.',
    modifiers: {
      damage: '2d6+4',
      range: '80 m',
      malfunction: 70,
      attacks: '1(3) lub seria',
      capacity: 20,
      priceZl: 850,
      availability: 'Demobil wojskowy, formacje rezerwowe; skrajnie podatny na zacięcia',
    },
    weight: 9.0,
    value: 160,
  },
];


// === NARZĘDZIA ===

export const TOOLS: Partial<EquipmentItem>[] = [
  {
    name: 'Flashlight',
    category: 'tool',
    description: 'Latarka elektryczna z bateriami.',
    weight: 1,
    value: 3,
  },
  {
    name: 'Lantern (Oil)',
    category: 'tool',
    description: 'Lampa naftowa, stabilne światło.',
    weight: 2,
    value: 2,
  },
  {
    name: 'Rope (50 ft)',
    category: 'tool',
    description: 'Mocna lina konopna, 15 metrów.',
    weight: 5,
    value: 1,
  },
  {
    name: 'Lockpicks',
    category: 'tool',
    description: 'Zestaw wytrychy do zamków.',
    modifiers: { skill: 'Locksmith', bonus: 10 },
    weight: 0.2,
    value: 10,
  },
  {
    name: 'Magnifying Glass',
    category: 'tool',
    description: 'Szkło powiększające do badania śladów.',
    modifiers: { skill: 'Spot Hidden', bonus: 10 },
    weight: 0.2,
    value: 2,
  },
  {
    name: 'Camera',
    category: 'tool',
    description: 'Aparat fotograficzny z fleshem.',
    weight: 3,
    value: 25,
  },
  {
    name: 'Binoculars',
    category: 'tool',
    description: 'Lornetka polowa.',
    weight: 1,
    value: 15,
  },
  {
    name: 'Compass',
    category: 'tool',
    description: 'Kompas kieszonkowy.',
    modifiers: { skill: 'Navigate', bonus: 10 },
    weight: 0.2,
    value: 5,
  },
  {
    name: 'Toolkit (Mechanical)',
    category: 'tool',
    description: 'Zestaw narzędzi mechanicznych.',
    modifiers: { skill: 'Mechanical Repair', bonus: 10 },
    weight: 5,
    value: 15,
  },
  {
    name: 'Toolkit (Electrical)',
    category: 'tool',
    description: 'Zestaw narzędzi elektrycznych.',
    modifiers: { skill: 'Electrical Repair', bonus: 10 },
    weight: 4,
    value: 20,
  },
];

// === MEDYCZNE ===

export const MEDICAL: Partial<EquipmentItem>[] = [
  {
    name: 'First Aid Kit',
    category: 'medical',
    description: 'Apteczka pierwszej pomocy z bandażami i jodyną.',
    modifiers: { skill: 'First Aid', bonus: 10 },
    weight: 2,
    value: 5,
  },
  {
    name: 'Medical Bag',
    category: 'medical',
    description: 'Torba lekarska z instrumentami chirurgicznymi.',
    modifiers: { skill: 'Medicine', bonus: 15 },
    weight: 4,
    value: 25,
  },
  {
    name: 'Morphine (5 doses)',
    category: 'medical',
    description: 'Morfina w ampułkach, silny środek przeciwbólowy.',
    weight: 0.2,
    value: 10,
  },
  {
    name: 'Bandages',
    category: 'medical',
    description: 'Zwój bandaży opatrunkowych.',
    weight: 0.5,
    value: 0.5,
  },
];

// === PRZEDMIOTY OSOBISTE ===

export const PERSONAL: Partial<EquipmentItem>[] = [
  {
    name: 'Pocket Watch',
    category: 'personal',
    description: 'Elegancki zegarek kieszonkowy.',
    weight: 0.2,
    value: 15,
  },
  {
    name: 'Cigarette Case',
    category: 'personal',
    description: 'Srebrna papierośnica.',
    weight: 0.2,
    value: 5,
  },
  {
    name: 'Hip Flask',
    category: 'personal',
    description: 'Piersiówka z whisky.',
    weight: 0.3,
    value: 3,
  },
  {
    name: 'Wallet',
    category: 'personal',
    description: 'Skórzany portfel.',
    weight: 0.1,
    value: 2,
  },
];

// === DOKUMENTY ===

export const DOCUMENTS: Partial<EquipmentItem>[] = [
  {
    name: 'Newspaper Clipping',
    category: 'document',
    description: 'Wycinek z gazety z ważną informacją.',
    weight: 0,
    value: 0,
  },
  {
    name: 'Letter',
    category: 'document',
    description: 'List z tajemniczą wiadomością.',
    weight: 0,
    value: 0,
  },
  {
    name: 'Map',
    category: 'document',
    description: 'Mapa z zaznaczonymi lokacjami.',
    weight: 0.1,
    value: 1,
  },
  {
    name: 'Photograph',
    category: 'document',
    description: 'Stara fotografia.',
    weight: 0,
    value: 0,
  },
  {
    name: 'Journal/Diary',
    category: 'document',
    description: 'Dziennik z zapiskami.',
    weight: 0.5,
    value: 0,
  },
];

// === OKULTYSTYCZNE ===

export const OCCULT: Partial<EquipmentItem>[] = [
  {
    name: 'Candles (12)',
    category: 'occult',
    description: 'Świece woskowe do rytuałów.',
    weight: 1,
    value: 1,
  },
  {
    name: 'Chalk (colored)',
    category: 'occult',
    description: 'Kolorowa kreda do rysowania pentagramów.',
    weight: 0.2,
    value: 0.5,
  },
  {
    name: 'Incense & Burner',
    category: 'occult',
    description: 'Kadzidło i kadzielnica.',
    weight: 0.5,
    value: 2,
  },
  {
    name: 'Silver Mirror',
    category: 'occult',
    description: 'Srebrne lusterko do wróżb.',
    weight: 0.3,
    value: 5,
  },
  {
    name: 'Crystal Ball',
    category: 'occult',
    description: 'Kryształowa kula do wróżenia.',
    weight: 2,
    value: 25,
  },
];

// === ARTEFAKTY MYTHOS ===

export const ARTIFACTS: Partial<EquipmentItem>[] = [
  {
    name: 'Strange Amulet',
    category: 'artifact',
    description: 'Amulet z nieznanym symbolem.',
    modifiers: { sanLoss: '0/1d2' },
    weight: 0.2,
    value: 0,
  },
  {
    name: 'Mythos Tome (Minor)',
    category: 'artifact',
    description: 'Starodawna księga z zakazaną wiedzą.',
    modifiers: { sanLoss: '1d3/1d6', skill: 'Cthulhu Mythos', bonus: 3 },
    weight: 1,
    value: 0,
  },
];

// === EKWIPUNEK WG ZAWODU ===

/**
 * Zweryfikowane prywatne źródło reguł. Repo przechowuje wyłącznie metadane,
 * numery stron i własne dane strukturalne, bez treści podręcznika.
 */
export const EQUIPMENT_RULES_REFERENCE = {
  title: 'Zew Cthulhu - Księga Strażnika',
  version: '1.3',
  sha256: 'b463b904d4c2e9d69e08a4268691bed1a3d83e1f157a01e8dce42ef7e6cc795c',
  verifiedAt: '2026-09-01',
  rights: 'private-local-reference',
  printedPages: {
    occupations: [44, 45],
    creditRating: [50, 107],
    equipment: [447, 448, 449, 450],
    weapons: [452, 453, 454, 455, 456, 457],
  },
} as const;

// UWAGA: KLUCZE pozostają po angielsku (techniczne ID mapowane z OCCUPATIONS
// przez kapitalizację/aliasy - patrz getStartingEquipmentForOccupation).
// WARTOŚCI (nazwy przedmiotów) są po polsku. IND-233: nazwy NIE mogą mieć
// przecinka na najwyższym poziomie (splitTopLevel tnie po przecinku poza
// nawiasami) - dlatego doprecyzowania trzymamy w nawiasach, np. "Lina (15 m)".
export const OCCUPATION_EQUIPMENT: Record<string, string[]> = {
  // Akademiccy i Profesjonaliści
  Antiquarian: ['Lupa', 'Książki źródłowe'],
  Archaeologist: [
    'Zestaw narzędzi (mechaniczny)',
    'Lina (15 m)',
    'Latarka',
    'Kompas',
    'Pędzel i kielnia',
  ],
  Author: [
    'Zegarek kieszonkowy',
    'Maszyna do pisania (w domu)',
  ],
  Librarian: ['Lupa', 'Karta biblioteczna'],
  Professor: [
    'Lupa',
    'Zegarek kieszonkowy',
    'Książki źródłowe',
  ],
  Scientist: [
    'Lupa',
    'Sprzęt laboratoryjny (w laboratorium)',
  ],

  // Medycyna
  Doctor: [
    'Torba lekarska',
    'Apteczka',
    'Zegarek kieszonkowy',
  ],
  Nurse: ['Apteczka', 'Bandaże', 'Zegarek kieszonkowy'],
  Psychiatrist: [
    'Zegarek kieszonkowy',
    'Morfina (5 dawek)',
  ],

  // Prawo i Porządek
  'Private Investigator': [
    'Rewolwer .38',
    'Latarka',
    'Wytrychy',
    'Aparat fotograficzny',
    'Piersiówka',
  ],
  'Police Detective': [
    'Rewolwer .38',
    'Latarka',
    'Kajdanki',
    'Odznaka',
  ],
  Lawyer: ['Zegarek kieszonkowy', 'Aktówka'],

  // Prasa i Media
  Journalist: [
    'Aparat fotograficzny',
    'Legitymacja prasowa',
    'Piersiówka',
  ],
  Photographer: ['Aparat fotograficzny', 'Latarka', 'Statyw', 'Klisza'],

  // Religia i Okultyzm
  Clergy: ['Biblia/modlitewnik', 'Zegarek kieszonkowy', 'Krucyfiks'],
  Occultist: [
    'Świece (12 szt.)',
    'Kreda (kolorowa)',
    'Kadzidło i kadzielnica',
    'Dziwny amulet',
  ],
  Parapsychologist: [
    'Aparat fotograficzny',
    'Termometr',
    'Detektor pola elektromagnetycznego',
  ],

  // Wojsko i Przygoda
  'Military Officer': ['Pistolet .45', 'Lornetka', 'Kompas', 'Nóż'],
  Soldier: ['Karabin', 'Nóż', 'Apteczka', 'Manierka'],
  Dilettante: [
    'Zegarek kieszonkowy',
    'Papierośnica',
    'Piersiówka',
    'Lornetka teatralna',
  ],
  Explorer: [
    'Kompas',
    'Lornetka',
    'Lina (15 m)',
    'Maczeta',
    'Apteczka',
    'Latarka',
  ],
  'Big Game Hunter': [
    'Sztucer myśliwski',
    'Dubeltówka (dwururka)',
    'Nóż',
    'Lornetka',
    'Kompas',
  ],

  // Przestępczość
  Criminal: ['Rewolwer .32', 'Wytrychy', 'Nóż', 'Latarka'],
  Bootlegger: ['Rewolwer .38', 'Piersiówka', 'Kluczyki do samochodu'],

  // Artyści
  Artist: ['Szkicownik', 'Ołówki i węgiel', 'Paleta i pędzle'],
  Athlete: ['Strój sportowy', 'Torba sportowa', 'Apteczka', 'Ręcznik'],
  Musician: ['Instrument', 'Nuty'],
  Actor: ['Zestaw do charakteryzacji', 'Scenariusz', 'Zegarek kieszonkowy'],

  // Robotnicy
  Mechanic: ['Zestaw narzędzi (mechaniczny)', 'Latarka', 'Kombinezon'],
  Sailor: ['Nóż', 'Lina (15 m)', 'Kompas', 'Piersiówka'],
  Farmer: ['Dubeltówka (dwururka)', 'Nóż', 'Lampa naftowa', 'Lina (15 m)'],

  // Zawody wymagające jawnego zestawu zamiast cichego spadku do `default`.
  Drifter: ['Plecak', 'Koc', 'Nóż', 'Zapałki', 'Manierka'],
  Hacker: [
    'Komputer przenośny',
    'Zestaw narzędzi (elektryczny)',
  ],
  'Police Officer': ['Pałka policyjna', 'Kajdanki', 'Odznaka', 'Latarka'],
  Spy: [
    'Aparat fotograficzny',
    'Wytrychy',
    'Fałszywe dokumenty',
    'Pistolet .32',
  ],
  'Tribe Member': ['Nóż', 'Lina (15 m)', 'Manierka', 'Apteczka'],

  // Domyślne
  default: ['Zegarek kieszonkowy', 'Portfel'],
};

/**
 * Aliasy: id zawodu (z OCCUPATIONS, np. 'military') → klucz OCCUPATION_EQUIPMENT,
 * gdy proste kapitalizowanie nie trafia w istniejący klucz. Reszta mapuje się
 * przez kapitalizację pierwszej litery, a brak dopasowania spada do 'default'.
 */
export const OCCUPATION_EQUIPMENT_ALIASES: Record<string, string> = {
  antiquarian: 'Antiquarian',
  artist: 'Artist',
  athlete: 'Athlete',
  author: 'Author',
  clergy: 'Clergy',
  criminal: 'Criminal',
  dilettante: 'Dilettante',
  doctor: 'Doctor',
  drifter: 'Drifter',
  engineer: 'Mechanic',
  entertainer: 'Actor',
  farmer: 'Farmer',
  hacker: 'Hacker',
  journalist: 'Journalist',
  lawyer: 'Lawyer',
  librarian: 'Librarian',
  military: 'Soldier',
  nurse: 'Nurse',
  parapsychologist: 'Parapsychologist',
  pilot: 'Explorer',
  police_officer: 'Police Officer',
  police_detective: 'Police Detective',
  private_investigator: 'Private Investigator',
  professor: 'Professor',
  sailor: 'Sailor',
  scientist: 'Scientist',
  soldier: 'Soldier',
  spy: 'Spy',
  tribe_member: 'Tribe Member',
};

/**
 * Deterministyczny ekwipunek startowy wg zawodu (CoC 7e, "na sztywno"). Zwraca
 * listę nazw przedmiotów z OCCUPATION_EQUIPMENT - bez AI, bez losowości.
 * Brak dopasowania zawodu → zestaw 'default'.
 */
export function getStartingEquipmentForOccupation(
  occupationId: string | null | undefined,
  locale: 'pl' | 'en' | string = 'pl'
): string[] {
  const fallback = OCCUPATION_EQUIPMENT.default ?? [];
  const rawItems = !occupationId
    ? [...fallback]
    : (() => {
        const aliased = OCCUPATION_EQUIPMENT_ALIASES[occupationId];
        const capitalized =
          occupationId.charAt(0).toUpperCase() + occupationId.slice(1);
        const key = aliased ?? capitalized;
        return [...(OCCUPATION_EQUIPMENT[key] ?? fallback)];
      })();

  if (locale === 'en') {
    return rawItems.map((item) => getLocalizedEquipmentName(item, 'en'));
  }
  return rawItems;
}

// === KATEGORIE PO POLSKU ===

export const CATEGORY_LABELS: Record<string, string> = {
  weapon: '⚔️ Broń',
  armor: '🛡️ Ochrona',
  tool: '🔧 Narzędzia',
  document: '📄 Dokumenty',
  artifact: '🔮 Artefakty',
  personal: '👤 Osobiste',
  medical: '💊 Medyczne',
  occult: '🕯️ Okultystyczne',
  story: '📜 Fabularne',
};

// === WSZYSTKIE PRZEDMIOTY ===

export const ALL_EQUIPMENT: Partial<EquipmentItem>[] = [
  ...WEAPONS,
  ...WEAPONS_II_RP,
  ...TOOLS,
  ...MEDICAL,
  ...PERSONAL,
  ...DOCUMENTS,
  ...OCCULT,
  ...ARTIFACTS,
];

/**
 * Znajdź przedmiot po nazwie
 */
export function findEquipmentByName(
  name: string
): Partial<EquipmentItem> | undefined {
  const localMatch = ALL_EQUIPMENT.find(
    (item) => item.name?.toLowerCase() === name.toLowerCase()
  );
  if (localMatch) return localMatch;

  const template = findEquipmentTemplate(name);
  return template
    ? {
        name: template.name,
        category: template.category,
        description: template.description,
        templateId: template.id,
        visualSource: 'catalog',
        visualTreatment: template.visualTreatment,
      }
    : undefined;
}

/**
 * Wykrywa czy przedmiot jest zasobem zużywalnym oraz wyciąga ilość z nawiasów
 * (np. "Morfina (5 dawek)" -> cleanName: "Morfina", quantity: 5, isConsumable: true).
 */
export function parseItemConsumableInfo(name: string): {
  cleanName: string;
  quantity?: number;
  maxQuantity?: number;
  isConsumable?: boolean;
} {
  const trimmed = (name || '').trim();
  const doseMatch = trimmed.match(
    /^(.+?)\s*\((?:(\d+)\s*(?:dawek|dawki|dawka|szt\.|sztuk|ampułek|ładunków|użyć))\)$/i
  );
  if (doseMatch) {
    const cleanName = doseMatch[1].trim();
    const count = parseInt(doseMatch[2], 10);
    return {
      cleanName,
      quantity: count,
      maxQuantity: count,
      isConsumable: true,
    };
  }

  const lower = trimmed.toLowerCase();
  if (lower === 'morfina' || lower === 'morphine') {
    return { cleanName: trimmed, quantity: 5, maxQuantity: 5, isConsumable: true };
  }
  if (lower === 'bandaże' || lower === 'bandages') {
    return { cleanName: trimmed, quantity: 3, maxQuantity: 3, isConsumable: true };
  }
  if (lower === 'apteczka' || lower === 'first aid kit') {
    return { cleanName: trimmed, quantity: 3, maxQuantity: 3, isConsumable: true };
  }

  return { cleanName: trimmed, isConsumable: false };
}

/**
 * Wygeneruj pełny przedmiot z szablonu
 */
export function createEquipmentItem(
  template: Partial<EquipmentItem>,
  source: 'starting' | 'acquired' | 'found' = 'starting',
  era: EquipmentVisualEra = '1920s'
): EquipmentItem {
  const rawName = template.name || 'Unknown Item';
  const consumableInfo = parseItemConsumableInfo(rawName);
  const finalName = consumableInfo.cleanName || rawName;

  return applyCatalogTemplate(
    {
      id: `eq_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      templateId: template.templateId,
      name: finalName,
      category: template.category || (source === 'acquired' || source === 'found' ? 'story' : 'personal'),
      description: template.description,
      modifiers: template.modifiers,
      weight: template.weight,
      value: template.value,
      condition: 'used',
      source,
      acquiredFrom: template.acquiredFrom ?? source,
      obtainedAt: new Date(),
      quantity: template.quantity ?? consumableInfo.quantity,
      maxQuantity: template.maxQuantity ?? consumableInfo.maxQuantity,
      isConsumable: template.isConsumable ?? consumableInfo.isConsumable,
      isStoryItem: template.isStoryItem ?? (template.category === 'story' ? true : undefined),
    },
    era
  );
}

// Faza 4 (ekonomia RAW): CoC 7e nie ma systemu wagi/udźwigu - waga przedmiotów NIE jest
// już dopisywana ani pokazywana (zamożność opisuje Credit Rating, patrz lib/economy).
// `value` zostaje jako cena jednostkowa (referencyjna przy zakupach), z fallbackiem $1.
export const DEFAULT_ITEM_VALUE = 1; // $ 1920s (cena referencyjna)

/**
 * Uzupełnia brakujące `value` sensownym domyślnym ($1). NIE nadpisuje istniejących
 * (`??`) - szablony i wartości od AI mają pierwszeństwo. RAW: wagi nie dopisujemy.
 */
export function withEquipmentDefaults(items: EquipmentItem[]): EquipmentItem[] {
  return items.map((item) => ({
    ...item,
    value: item.value ?? DEFAULT_ITEM_VALUE,
  }));
}

/**
 * IND-233: dzieli listę przedmiotów po przecinkach/średnikach TYLKO na najwyższym
 * poziomie - przecinki wewnątrz nawiasów są ignorowane. Bez tego "Laptop (przenośny,
 * średniej klasy)" rozpadał się na 2 śmieci-itemy ("Laptop (przenośny" + "średniej
 * klasy)"). Obsługuje zarówno ekwipunek od AI (lista), jak i ręczny CSV z pola tekstowego.
 */
export function splitTopLevel(str: string): string[] {
  if (!str?.trim()) return [];
  const items: string[] = [];
  let current = '';
  let depth = 0;
  for (const ch of str.replace(/[\n\r]+/g, ' ')) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);

    if ((ch === ',' || ch === ';') && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) items.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }
  const last = current.trim();
  if (last) items.push(last);
  return items;
}
