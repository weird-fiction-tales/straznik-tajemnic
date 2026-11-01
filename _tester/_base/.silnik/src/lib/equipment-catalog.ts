import type {
  EquipmentCategory,
  EraEquipmentTemplate,
  EquipmentItem,
  EquipmentTemplate,
  EquipmentVisualEra,
} from './types';
import { resolveEraVisualProfile } from './era-visual-style';

export function safeResolveVisualEra(era: string | undefined): EquipmentVisualEra {
  if (!era) return '1920s';
  if ((EQUIPMENT_VISUAL_ERAS as string[]).includes(era)) {
    return era as EquipmentVisualEra;
  }
  try {
    const resolved = resolveEraVisualProfile(era);
    if ((EQUIPMENT_VISUAL_ERAS as string[]).includes(resolved)) {
      return resolved as EquipmentVisualEra;
    }
  } catch {
    // Fallback poniżej
  }
  const lower = era.toLowerCase();
  if (lower.includes('gaslight') || lower.includes('1890') || lower.includes('wiktoria')) return '1890s';
  if (lower.includes('pulp') || lower.includes('1930') || lower.includes('depression')) return '1930s';
  if (lower.includes('noir') || lower.includes('1940') || lower.includes('wojen')) return '1940s';
  if (lower.includes('prl') || lower.includes('1970') || lower.includes('1960')) return 'prl-1970s';
  if (lower.includes('1980')) return '1980s';
  if (lower.includes('1990')) return '1990s';
  if (lower.includes('2000') || lower.includes('y2k')) return '2000s';
  if (lower.includes('modern') || lower.includes('wspolczesn') || lower.includes('współczesn')) return 'modern';
  return '1920s';
}

/** Bezpieczny lokalny fallback, używany zanim konkretny render WebP jest dostępny. */
export const CATEGORY_FALLBACK_ASSETS: Record<EquipmentCategory, string> = {
  weapon: '/equipment/predefined/weapon.svg',
  armor: '/equipment/predefined/armor.svg',
  tool: '/equipment/predefined/tool.svg',
  document: '/equipment/predefined/document.svg',
  artifact: '/equipment/predefined/artifact.svg',
  personal: '/equipment/predefined/personal.svg',
  medical: '/equipment/predefined/medical.svg',
  occult: '/equipment/predefined/occult.svg',
  story: '/equipment/predefined/document.svg',
};

export const EQUIPMENT_VISUAL_ERAS: EquipmentVisualEra[] = [
  '1890s',
  '1920s',
  '1930s',
  '1940s',
  '1950s',
  'prl-1970s',
  '1980s',
  '1990s',
  '2000s',
  'modern',
];

export const ALL_ERAS: EquipmentVisualEra[] = EQUIPMENT_VISUAL_ERAS;
export const HISTORICAL_ERAS: EquipmentVisualEra[] = [
  '1890s',
  '1920s',
  '1930s',
  '1940s',
  '1950s',
  'prl-1970s',
  '1980s',
];
export const MODERN_ERAS: EquipmentVisualEra[] = ['1990s', '2000s', 'modern'];

/**
 * Wzorce katalogu ekwipunku zgodne z Call of Cthulhu 7e RAW.
 * Zawiera deterministyczne szablony, statystyki bojowe/użytkowe, ceny referencyjne
 * oraz powiązania z lokalnymi grafikami WebP z bezpiecznym fallbackiem SVG.
 */
export const EQUIPMENT_CATALOG: EquipmentTemplate[] = [
  {
    id: 'light.flashlight',
    name: "Latarka",
    aliases: ["Flashlight", "Latarka elektryczna", "Lampa elektryczna (latarka)", "Stara latarka kieszonkowa", "tool.flashlight-1920s"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ['1920s', '1940s', 'prl-1970s', 'modern'],
    assetPaths: { '1920s': '/equipment/catalog/flashlight-1920s.webp', '1940s': '/equipment/catalog/flashlight-1940s.webp', 'prl-1970s': '/equipment/catalog/police-flashlight-prl.webp', 'modern': '/equipment/catalog/flashlight-modern.webp', },
    value: 3,
  },
  {
    id: 'light.oil-lantern',
    name: "Lampa naftowa",
    aliases: ["Lantern (Oil)", "Latarnia naftowa", "Latarnia oliwna", "Lampa naftowa kieszonkowa", "Brass Kerosene Hurricane Lantern", "tool.oil-lantern-1890s"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: HISTORICAL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/oil-lantern-1890s.webp', '1920s': '/equipment/catalog/oil-lantern-1920s.webp', '1930s': '/equipment/catalog/oil-lantern-1930s.webp', '1940s': '/equipment/catalog/oil-lantern-1940s.webp', '1980s': '/equipment/catalog/oil-lantern-1980s.webp', },
    value: 2,
  },
  {
    id: 'light.matches',
    name: "Pudełko zapałek",
    aliases: ["Zapałki", "Zapałki sztormowe", "Matches", "Vintage Wooden Matchbox", "tool.matches-shared"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/matches-1890s.webp', '1920s': '/equipment/catalog/matches-1920s.webp', '1930s': '/equipment/catalog/matches-1930s.webp', '1940s': '/equipment/catalog/matches-1940s.webp', '1980s': '/equipment/catalog/matches-1980s.webp', 'modern': '/equipment/catalog/matches-modern.webp', },
    value: 1,
  },
  {
    id: 'tool.rope',
    name: "Lina (15 m)",
    aliases: ["Rope (50 ft)", "Mocna lina", "Lina", "Coiled Heavy Manila Hemp Rope", "tool.rope-shared"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/rope-1890s.webp', '1920s': '/equipment/catalog/rope-1920s.webp', '1930s': '/equipment/catalog/rope-1930s.webp', '1940s': '/equipment/catalog/rope-1940s.webp', '1980s': '/equipment/catalog/rope-1980s.webp', 'modern': '/equipment/catalog/rope-modern.webp', },
    value: 2,
  },
  {
    id: 'tool.lockpicks',
    name: "Wytrychy",
    aliases: ["Lockpicks", "Zestaw wytrychów", "Zardzewiałe wytrychy", "Zestaw wytrychów w etui", "Zestaw wytrychów i łom", "Lockpick Set in Leather Wrap", "tool.lockpicks-shared"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1930s': '/equipment/catalog/lockpicks-1930s.webp', '1940s': '/equipment/catalog/lockpicks-1940s.webp', '1980s': '/equipment/catalog/lockpicks-1980s.webp', 'modern': '/equipment/catalog/lockpicks-modern.webp', },
    modifiers: { skill: 'Ślusarstwo', bonus: 10 },
    value: 10,
  },
  {
    id: 'tool.magnifier',
    name: "Lupa",
    aliases: ["Magnifying Glass", "Lupa terenowa", "Lupa jubilerska", "Lupa kieszonkowa", "Lupa w mosiężnej oprawie", "Brass Hand Magnifier with Ebony Handle", "tool.magnifier-shared"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/magnifier-1890s.webp', '1920s': '/equipment/catalog/magnifier-1920s.webp', '1930s': '/equipment/catalog/magnifier-1930s.webp', '1940s': '/equipment/catalog/magnifier-1940s.webp', '1980s': '/equipment/catalog/magnifier-1980s.webp', 'modern': '/equipment/catalog/magnifier-modern.webp', },
    modifiers: { skill: 'Spostrzegawczość', bonus: 5 },
    value: 3,
  },
  {
    id: 'tool.camera',
    name: "Aparat fotograficzny",
    aliases: ["Camera", "Aparat", "Aparat fotograficzny mieszkowy", "Aparat fotograficzny z lampą błyskową", "Aparat małoobrazkowy Kodak", "tool.camera-1920s"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/camera-1890s.webp', '1920s': '/equipment/catalog/camera-1920s.webp', '1930s': '/equipment/catalog/camera-1930s.webp', '1940s': '/equipment/catalog/camera-1940s.webp', 'prl-1970s': '/equipment/catalog/camera-prl-1970s.webp', '1980s': '/equipment/catalog/camera-1980s.webp', 'modern': '/equipment/catalog/dslr-camera-modern.webp', },
    value: 30,
  },
  {
    id: 'tool.binoculars',
    name: "Lornetka",
    aliases: ["Binoculars", "Lornetka polowa", "Lornetka teatralna", "tool.binoculars-shared"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/binoculars-1890s.webp', '1920s': '/equipment/catalog/binoculars-1920s.webp', '1930s': '/equipment/catalog/binoculars-1930s.webp', '1940s': '/equipment/catalog/binoculars-1940s.webp', '1980s': '/equipment/catalog/binoculars-1980s.webp', 'modern': '/equipment/catalog/binoculars-modern.webp', },
    modifiers: { skill: 'Spostrzegawczość', bonus: 10 },
    value: 15,
  },
  {
    id: 'tool.compass',
    name: "Kompas",
    aliases: ["Compass", "Kompas z wieczkiem", "Kompas geologiczny Bruntona", "Wojskowy kompas mosiężny", "tool.compass-shared"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/compass-1890s.webp', '1920s': '/equipment/catalog/compass-1920s.webp', '1930s': '/equipment/catalog/compass-1930s.webp', '1940s': '/equipment/catalog/compass-1940s.webp', 'prl-1970s': '/equipment/catalog/compass-shared.webp', '1980s': '/equipment/catalog/compass-1980s.webp', 'modern': '/equipment/catalog/compass-modern.webp', },
    modifiers: { skill: 'Nawigacja', bonus: 10 },
    value: 5,
  },
  {
    id: 'tool.mechanical-kit',
    name: "Zestaw narzędzi mechanicznych",
    aliases: ["Toolkit (Mechanical)", "Zestaw narzędzi (mechaniczny)", "Skrzynka z narzędziami", "Drobne narzędzia", "Mechanical Tool Roll", "tool.mechanical-kit-shared"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/mechanical-kit-1890s.webp', '1920s': '/equipment/catalog/mechanical-kit-1920s.webp', '1930s': '/equipment/catalog/mechanical-kit-1930s.webp', '1940s': '/equipment/catalog/mechanical-kit-1940s.webp', '1980s': '/equipment/catalog/mechanical-kit-1980s.webp', 'modern': '/equipment/catalog/mechanical-kit-modern.webp', },
    modifiers: { skill: 'Naprawa mechaniczna', bonus: 10 },
    value: 15,
  },
  {
    id: 'tool.electrical-kit',
    name: "Zestaw narzędzi elektrycznych",
    aliases: [
      "Toolkit (Electrical)",
      "Zestaw narzędzi (elektryczny)",
      "Zestaw narzędzi do elektroniki",
      "Narzędzia do elektroniki",
      "Zestaw narzędzi",
      "Vintage Electrical Test Kit",
      "tool.electrical-kit-shared",
    ],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/electrical-kit-1890s.webp', '1920s': '/equipment/catalog/electrical-kit-1920s.webp', '1930s': '/equipment/catalog/electrical-kit-1930s.webp', '1940s': '/equipment/catalog/electrical-kit-1940s.webp', '1980s': '/equipment/catalog/electrical-kit-1980s.webp', '2000s': '/equipment/catalog/electrical-kit-modern.webp', 'modern': '/equipment/catalog/electrical-kit-modern.webp', },
    modifiers: { skill: 'Naprawa elektryczna', bonus: 10 },
    value: 15,
  },
  {
    id: 'medical.first-aid',
    name: "Apteczka",
    aliases: ["First Aid Kit", "Kieszonkowa apteczka", "Apteczka polowa", "Zaawansowana torba reanimacyjna", "Zestaw pierwszej pomocy z środkami uspokajającymi", "PRL First Aid Metal Box", "medical.first-aid-prl-1970s"],
    category: 'medical',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/first-aid-1890s.webp', '1920s': '/equipment/catalog/first-aid-1920s.webp', '1930s': '/equipment/catalog/first-aid-1930s.webp', '1940s': '/equipment/catalog/first-aid-1940s.webp', 'prl-1970s': '/equipment/catalog/first-aid-prl-1970s.webp', '1980s': '/equipment/catalog/first-aid-1980s.webp', 'modern': '/equipment/catalog/first-aid-modern.webp', },
    modifiers: { skill: 'Pierwsza pomoc', bonus: 10 },
    value: 5,
  },
  {
    id: 'medical.bag',
    name: "Torba medyczna",
    aliases: ["Medical Bag", "Torba lekarska", "Wiktoriańska torba lekarska", "medical.medical-bag-shared"],
    category: 'medical',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/bag-1890s.webp', '1920s': '/equipment/catalog/medical-bag-1920s.webp', '1930s': '/equipment/catalog/bag-1930s.webp', '1940s': '/equipment/catalog/bag-1940s.webp', '1980s': '/equipment/catalog/bag-1980s.webp', 'modern': '/equipment/catalog/bag-modern.webp', },
    modifiers: { skill: 'Medycyna', bonus: 10 },
    value: 15,
  },
  {
    id: 'medical.bandages',
    name: "Bandaże",
    aliases: ["Bandages", "Opatrunek uciskowy", "Rolki bandaży i antyseptyk", "Zestaw sterylnych bandaży", "Sterile Cotton Gauze Rolls", "medical.bandages-shared"],
    category: 'medical',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/bandages-1890s.webp', '1920s': '/equipment/catalog/bandages-1920s.webp', '1930s': '/equipment/catalog/bandages-1930s.webp', '1940s': '/equipment/catalog/bandages-1940s.webp', '1980s': '/equipment/catalog/bandages-1980s.webp', 'modern': '/equipment/catalog/bandages-modern.webp', },
    modifiers: { skill: 'Pierwsza pomoc', bonus: 5 },
    value: 1,
  },
  {
    id: 'personal.pocket-watch',
    name: "Zegarek kieszonkowy",
    aliases: ["Pocket Watch", "Złoty zegarek kieszonkowy", "personal.pocket-watch-shared"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: HISTORICAL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/pocket-watch-1890s.webp', '1920s': '/equipment/catalog/pocket-watch-1920s.webp', '1930s': '/equipment/catalog/pocket-watch-1930s.webp', '1940s': '/equipment/catalog/pocket-watch-1940s.webp', '1980s': '/equipment/catalog/pocket-watch-1980s.webp', },
    value: 10,
  },
  {
    id: 'personal.cigarette-case',
    name: "Papierośnica",
    aliases: ["Cigarette Case", "Papierosy i papierośnica", "Srebrna papierośnica", "personal.cigarette-case-shared"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: HISTORICAL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/cigarette-case-1890s.webp', '1920s': '/equipment/catalog/cigarette-case-1920s.webp', '1930s': '/equipment/catalog/cigarette-case-1930s.webp', '1940s': '/equipment/catalog/cigarette-case-1940s.webp', '1980s': '/equipment/catalog/cigarette-case-1980s.webp', },
    value: 5,
  },
  {
    id: 'personal.flask',
    name: "Piersiówka",
    aliases: ["Hip Flask", "Manierka", "Srebrna piersiówka", "Srebrna piersiówka z brandy", "personal.flask-shared"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/flask-1890s.webp', '1920s': '/equipment/catalog/flask-1920s.webp', '1930s': '/equipment/catalog/flask-1930s.webp', '1940s': '/equipment/catalog/flask-1940s.webp', '1980s': '/equipment/catalog/flask-1980s.webp', 'modern': '/equipment/catalog/flask-modern.webp', },
    value: 2,
  },
  {
    id: 'personal.wallet',
    name: "Portfel",
    aliases: ["Wallet", "Skórzany pugilares", "personal.wallet-shared"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/wallet-1890s.webp', '1920s': '/equipment/catalog/wallet-1920s.webp', '1930s': '/equipment/catalog/wallet-1930s.webp', '1940s': '/equipment/catalog/wallet-1940s.webp', '1980s': '/equipment/catalog/wallet-1980s.webp', 'modern': '/equipment/catalog/wallet-modern.webp', },
    value: 2,
  },
  {
    id: 'document.notebook',
    name: "Notatnik i ołówek",
    aliases: ["Notebook & Pencil", "Notes badawczy", "Szkicownik", "Notatnik", "Notes z ołówkiem", "Notatnik podróżnika", "Skórzany notatnik i pióro", "Zeszyt do notatek psychologicznych", "Zeszyt pełen wzorów", "Zeszyt z legendami i baśniami", "Field Notebook & Graphite Pencil", "document.notebook-shared"],
    category: 'document',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1920s': '/equipment/catalog/notebook-shared.webp' },
    value: 1,
  },
  {
    id: 'document.letter',
    name: "List",
    aliases: ["Letter", "Dokumenty i bilety", "Dokumenty podróżne", "Koperty na dowody", "Dokumenty", "Papiery wartościowe", "Teczka z aktami", "Fałszywe dokumenty", "Zalita woskiem koperta", "document.letter-shared"],
    category: 'document',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1920s': '/equipment/catalog/letter-shared.webp' },
    value: 1,
  },
  {
    id: 'document.id-card',
    name: "Dokumenty tożsamości",
    aliases: [
      "Identity Documents",
      "Dokumenty tożsamości",
      "Dokument tożsamości",
      "Dowód tożsamości",
      "Dowód osobisty",
      "Legitymacja",
      "Dokumenty osobiste",
      "Portfel z dokumentami",
      "ID Card",
      "Identity Papers",
      "document.id-card-shared"
    ],
    category: 'document',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: {},
    value: 1,
  },
  {
    id: 'document.map',
    name: "Mapa",
    aliases: ["Map", "Mapy lotnicze regionu", "Mapa regionu", "Plany architektoniczne", "Mapnik terenowy", "Mapy topograficzne Nowej Anglii", "Złożona mapa", "document.map-shared"],
    category: 'document',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1920s': '/equipment/catalog/map-shared.webp' },
    value: 2,
  },
  {
    id: 'document.photo',
    name: "Fotografia",
    aliases: ["Photograph", "Zdjęcie", "Stara fotografia", "document.photo-shared"],
    category: 'document',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1920s': '/equipment/catalog/photo-shared.webp' },
    value: 1,
  },
  {
    id: 'document.diary',
    name: "Dziennik",
    aliases: ["Journal/Diary", "Dziennik", "Pamiętnik", "Notatnik z zapiskami", "Dziennik skórzany", "Dziennik analiz snów pacjentów", "Dziennik badań", "Dziennik sekcji zwłok", "Dziennik wykopalisk", "Notes z zapiskami snów", "Leather-Bound Journal with Clasp", "document.diary-shared"],
    category: 'document',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1920s': '/equipment/catalog/diary-shared.webp' },
    value: 3,
  },
  {
    id: 'personal.badge',
    name: "Odznaka służbowa",
    aliases: ["Odznaka", "Police Badge", "Zniszczona odznaka", "Legitymacja służbowa", "Odznaka detektywa", "Odznaka policyjna", "Legitymacja prasowa", "Legitymacja prasowa gazety"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/wallet-1890s.webp', '1920s': '/equipment/catalog/wallet-1920s.webp', '1930s': '/equipment/catalog/wallet-1930s.webp', '1940s': '/equipment/catalog/wallet-1940s.webp', '1980s': '/equipment/catalog/wallet-1980s.webp', 'modern': '/equipment/catalog/wallet-modern.webp', },
    value: 5,
  },
  {
    id: 'weapon.flare-gun',
    name: "Pistolet sygnalizacyjny",
    aliases: ["Flare Gun", "Pistolet sygnałowy", "Rakietnica"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/flare-gun-1890s.webp', '1920s': '/equipment/catalog/pistol-45-1920s.webp', '1930s': '/equipment/catalog/flare-gun-1930s.webp', '1940s': '/equipment/catalog/pistol-45-1940s.webp', '1980s': '/equipment/catalog/flare-gun-1980s.webp', 'modern': '/equipment/catalog/pistol-45-modern.webp', },
    modifiers: { damage: '1d10+1d3 burn', range: '10 yards', malfunction: 100 },
    value: 15,
  },
  {
    id: 'weapon.revolver-32',
    name: "Rewolwer .32",
    aliases: [".32 Revolver", "Pistolet .32", ".32 Pistol", ".32 Snubnose Revolver", "weapon.revolver-32-shared"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: HISTORICAL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/revolver-32-1890s.webp', '1920s': '/equipment/catalog/revolver-32-1920s.webp', '1930s': '/equipment/catalog/revolver-32-1930s.webp', '1940s': '/equipment/catalog/revolver-32-1940s.webp', '1980s': '/equipment/catalog/revolver-32-1980s.webp', },
    modifiers: { damage: '1d8', range: '15 yards', malfunction: 100 },
    value: 15,
  },
  {
    id: 'weapon.revolver-38',
    name: "Rewolwer .38",
    aliases: [".38 Revolver", "1940s Detective Special Revolver", "weapon.revolver-1940s"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ['1920s', '1940s', 'prl-1970s'],
    assetPaths: { '1920s': '/equipment/catalog/revolver-colt38-1920s.webp', '1940s': '/equipment/catalog/revolver-1940s.webp', },
    modifiers: { damage: '1d10', range: '15 yards', malfunction: 100 },
    value: 25,
  },
  {
    id: 'weapon.pistol-45',
    name: "Pistolet .45",
    aliases: [".45 Automatic", "Rewolwer .45 Colt", "weapon.pistol-45-shared"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ['1920s', '1940s', 'modern'],
    assetPaths: { '1920s': '/equipment/catalog/pistol-45-1920s.webp', '1940s': '/equipment/catalog/pistol-45-1940s.webp', 'modern': '/equipment/catalog/pistol-45-modern.webp', },
    modifiers: { damage: '1d10+2', range: '15 yards', malfunction: 100 },
    value: 35,
  },
  {
    id: 'weapon.shotgun',
    name: "Dubeltówka",
    aliases: ["Shotgun (Double-Barrel)", "Dubeltówka (dwururka)", "Strzelba myśliwska", "Double-Barrel Side-by-Side Shotgun", "weapon.shotgun-shared"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/shotgun-1890s.webp', '1920s': '/equipment/catalog/shotgun-1920s.webp', '1930s': '/equipment/catalog/shotgun-1930s.webp', '1940s': '/equipment/catalog/shotgun-1940s.webp', '1980s': '/equipment/catalog/shotgun-1980s.webp', 'modern': '/equipment/catalog/shotgun-modern.webp', },
    modifiers: { damage: '4d6/2d6/1d6', range: '10/20/50 yards', malfunction: 100 },
    value: 40,
  },
  {
    id: 'weapon.hunting-rifle',
    name: "Karabin myśliwski",
    aliases: ["Hunting Rifle", "Karabin", "weapon.hunting-rifle-shared"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/hunting-rifle-1890s.webp', '1920s': '/equipment/catalog/hunting-rifle-1920s.webp', '1930s': '/equipment/catalog/hunting-rifle-1930s.webp', '1940s': '/equipment/catalog/hunting-rifle-1940s.webp', '1980s': '/equipment/catalog/hunting-rifle-1980s.webp', 'modern': '/equipment/catalog/hunting-rifle-modern.webp', },
    modifiers: { damage: '2d6+4', range: '110 yards', malfunction: 100 },
    value: 75,
  },
  {
    id: 'weapon.nagant-1895',
    name: 'Nagant wz. 1895',
    aliases: ['Nagant', 'Nagan', 'Rewolwer Nagant wz. 1895', 'Rewolwer Nagant', 'wz. 1895 Nagant'],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: HISTORICAL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/revolver-32-1890s.webp', '1920s': '/equipment/catalog/revolver-32-1920s.webp', '1930s': '/equipment/catalog/revolver-32-1930s.webp', '1940s': '/equipment/catalog/revolver-32-1940s.webp', '1980s': '/equipment/catalog/revolver-32-1980s.webp', },
    modifiers: {
      damage: '1d8',
      range: '15 m',
      malfunction: 100,
      attacks: 1,
      capacity: 7,
      priceZl: 80,
      availability: 'Wymaga uznaniowego pozwolenia starosty; powszechny w służbach państwowych i WP',
    },
    value: 16,
    description: 'Rewolwer kalibru 7,62 mm Nagant z 7-nabojowym bębenkiem. Najpopularniejsza krótka broń II RP ("nagan"), przepisowa w Policji Państwowej, KOP i strażach.',
  },
  {
    id: 'weapon.reichsrevolver-m1879',
    name: 'Reichsrevolver M1879',
    aliases: ['Reichsrevolver', 'M1879', 'Rewolwer M1879', 'Rewolwer Reichsrevolver'],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: HISTORICAL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/revolver-32-1890s.webp', '1920s': '/equipment/catalog/revolver-32-1920s.webp', '1930s': '/equipment/catalog/revolver-32-1930s.webp', '1940s': '/equipment/catalog/revolver-32-1940s.webp', '1980s': '/equipment/catalog/revolver-32-1980s.webp', },
    modifiers: {
      damage: '1d10+2',
      range: '15 m',
      malfunction: 90,
      attacks: 1,
      capacity: 6,
      priceZl: 100,
      availability: 'Pozostałość pozaborcza; formacje pomocnicze i policja',
    },
    value: 20,
    description: 'Ciężki (1,5 kg) niemiecki rewolwer wojskowy kalibru 10,6 mm z demobilu po zaborze pruskim. Potężna siła obalająca, brak rozładownika (powolne ładowanie pojedynczych łusek).',
  },
  {
    id: 'weapon.browning-fn1900',
    name: 'Browning FN 1900',
    aliases: ['FN 1900', 'FN1900', 'Browning FN1900', 'Pistolet FN 1900', 'Pistolet Browning FN 1900'],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: HISTORICAL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/browning-fn1900-1890s.webp', '1920s': '/equipment/catalog/pistol-45-1920s.webp', '1930s': '/equipment/catalog/browning-fn1900-1930s.webp', '1940s': '/equipment/catalog/pistol-45-1940s.webp', '1980s': '/equipment/catalog/browning-fn1900-1980s.webp', 'modern': '/equipment/catalog/pistol-45-modern.webp', },
    modifiers: {
      damage: '1d8',
      range: '15 m',
      malfunction: 99,
      attacks: '1(3)',
      capacity: 7,
      priceZl: 130,
      availability: 'Wymaga pozwolenia starosty; powszechny na rynku cywilnym',
    },
    value: 25,
    description: 'Belgijski pistolet samopowtarzalny kalibru 7,65 mm Browning (.32 ACP). Niezwykle popularny w Polsce przed i po Wielkiej Wojnie, znany z zamachów politycznych.',
  },
  {
    id: 'weapon.browning-fn1905',
    name: 'Browning FN 1905',
    aliases: ['FN 1905', 'FN1905', 'Browning FN1905', 'Pistolet FN 1905', 'Browning 6.35', 'Pistolet kieszonkowy Browning'],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: HISTORICAL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/browning-fn1905-1890s.webp', '1920s': '/equipment/catalog/pistol-45-1920s.webp', '1930s': '/equipment/catalog/browning-fn1905-1930s.webp', '1940s': '/equipment/catalog/pistol-45-1940s.webp', '1980s': '/equipment/catalog/browning-fn1905-1980s.webp', 'modern': '/equipment/catalog/pistol-45-modern.webp', },
    modifiers: {
      damage: '1d6',
      range: '15 m',
      malfunction: 98,
      attacks: '1(3)',
      capacity: 6,
      priceZl: 120,
      availability: 'Dawniej bez zezwolenia; bardzo łatwy do ukrycia, powszechny w półświatku',
    },
    value: 23,
    description: 'Kieszonkowy pistolet kamizelkowy kalibru 6,35 mm (.25 ACP). W dawnym zaborze pruskim sprzedawany bez pozwolenia, masowy w domach i polskim półświatku.',
  },
  {
    id: 'weapon.browning-m1910',
    name: 'Browning M1910',
    aliases: ['Browning 1910', 'FN 1910', 'FN1910', 'Pistolet Browning M1910', 'Browning wz. 1910'],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: HISTORICAL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/browning-m1910-1890s.webp', '1920s': '/equipment/catalog/pistol-45-1920s.webp', '1930s': '/equipment/catalog/browning-m1910-1930s.webp', '1940s': '/equipment/catalog/pistol-45-1940s.webp', '1980s': '/equipment/catalog/browning-m1910-1980s.webp', 'modern': '/equipment/catalog/pistol-45-modern.webp', },
    modifiers: {
      damage: '1d8',
      range: '15 m',
      malfunction: 99,
      attacks: '1(3)',
      capacity: 7,
      priceZl: 150,
      availability: 'Standard oficerów WP i wyższych urzędników; wymaga zezwolenia',
    },
    value: 29,
    description: 'Jeden z najpopularniejszych pistoletów w międzywojennej Polsce, chętnie wybierany przez oficerów WP i wyższych urzędników. Kaliber 7,65 mm lub 9 mm krótki.',
  },
  {
    id: 'weapon.p08-parabellum',
    name: 'P08 Parabellum',
    aliases: ['Luger', 'Parabellum', 'Luger P08', 'P08', 'Pistolet Parabellum', 'Pistolet P08'],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: HISTORICAL_ERAS,
    assetPaths: { '1920s': '/equipment/catalog/pistol-45-1920s.webp', '1930s': '/equipment/catalog/p08-parabellum-1930s.webp', '1940s': '/equipment/catalog/pistol-45-1940s.webp', '1980s': '/equipment/catalog/p08-parabellum-1980s.webp', 'modern': '/equipment/catalog/pistol-45-modern.webp', },
    modifiers: {
      damage: '1d10',
      range: '15 m',
      malfunction: 99,
      attacks: '1(3)',
      capacity: 8,
      priceZl: 200,
      availability: 'Broń wojskowa / poniemiecka; ściśle regulowana, wymaga zezwolenia',
    },
    value: 38,
    description: 'Niemiecki pistolet wojskowy (Luger) kalibru 9 mm Parabellum, słynący z wysokiej jakości wykonania i celności pod warunkiem starannej konserwacji.',
  },
  {
    id: 'weapon.mauser-c96',
    name: 'Mauser C96',
    aliases: ['C96', 'Mauser', 'Broomhandle', 'Pistolet Mauser C96'],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: HISTORICAL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/mauser-c96-1890s.webp', '1920s': '/equipment/catalog/pistol-45-1920s.webp', '1930s': '/equipment/catalog/mauser-c96-1930s.webp', '1940s': '/equipment/catalog/pistol-45-1940s.webp', '1980s': '/equipment/catalog/mauser-c96-1980s.webp', 'modern': '/equipment/catalog/pistol-45-modern.webp', },
    modifiers: {
      damage: '1d8',
      range: '25 m',
      malfunction: 99,
      attacks: '1(3)',
      capacity: 10,
      priceZl: 220,
      availability: 'Pozostałość po wojnie 1920 r., używany przez oficerów i straż',
    },
    value: 42,
    description: 'Charakterystyczny pistolet z drewnianą kaburo-kolbą kalibru 7,63 mm Mauser. Stały magazynek na 10 nabojów ładowany z łódki, weteran wojny 1920 r.',
  },
  {
    id: 'weapon.colt-m1911',
    name: 'Colt M1911',
    aliases: ['Colt 1911', 'M1911', 'Colt .45', 'Pistolet Colt M1911', 'Colt Government'],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: HISTORICAL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/colt-m1911-1890s.webp', '1920s': '/equipment/catalog/pistol-45-1920s.webp', '1930s': '/equipment/catalog/colt-m1911-1930s.webp', '1940s': '/equipment/catalog/pistol-45-1940s.webp', '1980s': '/equipment/catalog/colt-m1911-1980s.webp', 'modern': '/equipment/catalog/pistol-45-modern.webp', },
    modifiers: {
      damage: '1d10+2',
      range: '15 m',
      malfunction: 99,
      attacks: '1(3)',
      capacity: 7,
      priceZl: 200,
      availability: 'Rzadki import w Polsce; trudnodostępna amunicja .45 ACP',
    },
    value: 38,
    description: 'Potężny amerykański pistolet samopowtarzalny strzelający amunicją 11,43 mm (.45 ACP). W II RP broń rzadka z uwagi na trudnodostępną amunicję, lecz o olbrzymiej sile obalającej.',
  },
  {
    id: 'weapon.vis-wz35',
    name: 'Vis wz. 35',
    aliases: ['Vis', 'ViS', 'Pistolet Vis', 'Vis wz.35', 'wz. 35 Vis', 'Pistolet Vis wz. 35'],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ['1930s', '1940s', 'modern'],
    assetPaths: { '1920s': '/equipment/catalog/pistol-45-1920s.webp', '1930s': '/equipment/catalog/vis-wz35-1930s.webp', '1940s': '/equipment/catalog/pistol-45-1940s.webp', 'modern': '/equipment/catalog/pistol-45-modern.webp', },
    modifiers: {
      damage: '1d10',
      range: '15 m',
      malfunction: 98,
      attacks: '1(3)',
      capacity: 8,
      priceZl: 200,
      availability: 'Od 1935 r.; ściśle wojskowy, przepisowa broń oficerów WP i kawalerii',
    },
    value: 38,
    description: 'Nowoczesny i niezawodny polski pistolet wojskowy kalibru 9 mm Parabellum, produkowany od 1935 r. w Fabryce Broni w Radomiu. Przepisowa broń oficerów WP i kawalerii.',
  },
  {
    id: 'weapon.karabin-wz98',
    name: 'Karabin wz. 98 / Karabin wz. 29',
    aliases: ['Karabin wz. 98', 'Karabinek wz. 29', 'Karabin wz.98', 'Karabinek wz.29', 'Mauser wz. 29', 'Mauser wz. 98'],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: HISTORICAL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/hunting-rifle-1890s.webp', '1920s': '/equipment/catalog/hunting-rifle-1920s.webp', '1930s': '/equipment/catalog/hunting-rifle-1930s.webp', '1940s': '/equipment/catalog/hunting-rifle-1940s.webp', '1980s': '/equipment/catalog/hunting-rifle-1980s.webp', 'modern': '/equipment/catalog/hunting-rifle-modern.webp', },
    modifiers: {
      damage: '2d6+4',
      range: '100 m',
      malfunction: 100,
      attacks: 1,
      capacity: 5,
      priceZl: 250,
      availability: 'Ściśle wojskowy, wyposażenie piechoty Wojska Polskiego',
    },
    value: 48,
    description: 'Podstawowy karabin i karabinek piechoty Wojska Polskiego kalibru 7,92 mm Mauser, produkowany w Radomiu na maszynach gdańskich. Donośność i skuteczność bojowa ponad 1000 m.',
  },
  {
    id: 'weapon.karabinek-wz91-98-23',
    name: 'Karabinek wz. 91/98/23',
    aliases: ['Mosin polski', 'wz. 91/98/23', 'Karabin wz. 91/98/23', 'Karabinek Mosin wz. 91/98/23'],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: HISTORICAL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/hunting-rifle-1890s.webp', '1920s': '/equipment/catalog/hunting-rifle-1920s.webp', '1930s': '/equipment/catalog/hunting-rifle-1930s.webp', '1940s': '/equipment/catalog/hunting-rifle-1940s.webp', '1980s': '/equipment/catalog/hunting-rifle-1980s.webp', 'modern': '/equipment/catalog/hunting-rifle-modern.webp', },
    modifiers: {
      damage: '2d6+4',
      range: '90 m',
      malfunction: 100,
      attacks: 1,
      capacity: 5,
      priceZl: 150,
      availability: 'Używany przez Policję Państwową, KOP i Straż Graniczną',
    },
    value: 29,
    description: 'Rosyjski karabin Mosin wz. 91 zdobyty w 1920 r., przekalibrowany w Polsce na amunicję 7,92 mm Mauser. Ze względu na niższą niezawodność przekazany Policji Państwowej i KOP.',
  },
  {
    id: 'weapon.karabin-ppanc-ur-wz35',
    name: 'Karabin ppanc wz. 35 Ur',
    aliases: ['Karabin Ur', 'Ur wz. 35', 'wz. 35 Ur', 'Karabin przeciwpancerny wz. 35', 'Ur.35', 'Karabin Ur wz. 35'],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ['1930s', '1940s'],
    assetPaths: { '1890s': '/equipment/catalog/hunting-rifle-1890s.webp', '1920s': '/equipment/catalog/hunting-rifle-1920s.webp', '1930s': '/equipment/catalog/hunting-rifle-1930s.webp', '1940s': '/equipment/catalog/hunting-rifle-1940s.webp', '1980s': '/equipment/catalog/hunting-rifle-1980s.webp', 'modern': '/equipment/catalog/hunting-rifle-modern.webp', },
    modifiers: {
      damage: '2d10+4',
      range: '150 m',
      malfunction: 99,
      attacks: 1,
      capacity: 4,
      priceZl: 2000,
      availability: 'Tajna broń wojskowa (od 1938 r.), niedostępna dla cywilów',
    },
    value: 380,
    description: 'Ściśle tajny polski karabin przeciwpancerny kalibru 7,92 mm DS (pocisk z rdzeniem ołowianym o prędkości wylotowej 1275 m/s). Zaprojektowany do niszczenia czołgów. Waga z dwójnogiem ponad 10 kg.',
  },
  {
    id: 'weapon.pm-mors',
    name: 'Pistolet maszynowy Mors wz. 39',
    aliases: ['Mors', 'pm Mors', 'Mors wz. 39', 'Pistolet maszynowy Mors', 'PM Mors'],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ['1930s', '1940s'],
    assetPaths: { '1890s': '/equipment/catalog/hunting-rifle-1890s.webp', '1920s': '/equipment/catalog/hunting-rifle-1920s.webp', '1930s': '/equipment/catalog/hunting-rifle-1930s.webp', '1940s': '/equipment/catalog/hunting-rifle-1940s.webp', '1980s': '/equipment/catalog/hunting-rifle-1980s.webp', 'modern': '/equipment/catalog/hunting-rifle-modern.webp', },
    modifiers: {
      damage: '1d10',
      range: '30 m',
      malfunction: 99,
      attacks: '1(3) lub seria',
      capacity: 24,
      priceZl: 2500,
      availability: 'Prototyp wojskowy (1939 r.), seria próbna dla żołnierzy KOP',
    },
    value: 480,
    description: 'Polski pistolet maszynowy kalibru 9 mm Parabellum (łac. mors = śmierć) z magazynkiem na 24 naboje i wysuwanym chwytem przednim. Do wybuchu wojny powstała jedynie seria próbna (ok. 39 sztuk).',
  },
  {
    id: 'weapon.dubeltowka-mysliwska',
    name: 'Dubeltówka myśliwska',
    aliases: ['Dwururka myśliwska', 'Strzelba myśliwska II RP', 'Dubeltówka kurkowa'],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: HISTORICAL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/shotgun-1890s.webp', '1920s': '/equipment/catalog/shotgun-1920s.webp', '1930s': '/equipment/catalog/shotgun-1930s.webp', '1940s': '/equipment/catalog/shotgun-1940s.webp', '1980s': '/equipment/catalog/shotgun-1980s.webp', 'modern': '/equipment/catalog/shotgun-modern.webp', },
    modifiers: {
      damage: '4d6/2d6/1d6',
      range: '10/20/50 m',
      malfunction: 100,
      attacks: '1 lub 2',
      capacity: 2,
      priceZl: 180,
      availability: 'Wymaga przynależności do koła łowieckiego i pozwolenia starosty',
    },
    value: 35,
    description: 'Klasyczna dwururka śrutowa kurkowa lub bezkurkowa (kaliber 12G lub 16G). Najpopularniejsza legalna długa broń w II RP, powszechna w kołach łowieckich i na prowincji.',
  },
  {
    id: 'weapon.sztucer-mysliwski',
    name: 'Sztucer myśliwski',
    aliases: ['Sztucer', 'Karabin myśliwski z lunetą', 'Sztucer Mausera'],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: HISTORICAL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/hunting-rifle-1890s.webp', '1920s': '/equipment/catalog/hunting-rifle-1920s.webp', '1930s': '/equipment/catalog/hunting-rifle-1930s.webp', '1940s': '/equipment/catalog/hunting-rifle-1940s.webp', '1980s': '/equipment/catalog/hunting-rifle-1980s.webp', 'modern': '/equipment/catalog/hunting-rifle-modern.webp', },
    modifiers: {
      damage: '2d6+4',
      range: '100 m',
      malfunction: 100,
      attacks: 1,
      capacity: 5,
      priceZl: 350,
      availability: 'Wymaga pozwolenia na broń myśliwską; popularny w kołach łowieckich',
    },
    value: 68,
    description: 'Elegancki gwintowany karabin myśliwski (systemu Mauser lub Mannlicher) z celownikiem optycznym. Używany przez ziemiaństwo i leśników do polowań na grubą zwierzynę.',
  },
  {
    id: 'weapon.rkm-chauchat',
    name: 'Karabin maszynowy Chauchat',
    aliases: ['Chauchat', 'rkm Chauchat', 'Chauchat wz. 1915', 'Karabin Chauchat'],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: HISTORICAL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/hunting-rifle-1890s.webp', '1920s': '/equipment/catalog/hunting-rifle-1920s.webp', '1930s': '/equipment/catalog/hunting-rifle-1930s.webp', '1940s': '/equipment/catalog/hunting-rifle-1940s.webp', '1980s': '/equipment/catalog/hunting-rifle-1980s.webp', 'modern': '/equipment/catalog/hunting-rifle-modern.webp', },
    modifiers: {
      damage: '2d6+4',
      range: '80 m',
      malfunction: 70,
      attacks: '1(3) lub seria',
      capacity: 20,
      priceZl: 850,
      availability: 'Demobil wojskowy, formacje rezerwowe; skrajnie podatny na zacięcia',
    },
    value: 160,
    description: 'Francuski ręczny karabin maszynowy wz. 1915 kalibru 8 mm Lebel z demobilu wojennego. Znany z fatalnej niezawodności i ciągłych zacięć ze względu na wycięcia w półkolistym magazynku.',
  },
  {
    id: 'weapon.knife',
    name: "Nóż",
    aliases: ["Knife", "Nóż myśliwski", "Scyzoryk", "weapon.knife-shared"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/knife-1890s.webp', '1920s': '/equipment/catalog/knife-1920s.webp', '1930s': '/equipment/catalog/knife-1930s.webp', '1940s': '/equipment/catalog/knife-1940s.webp', '1980s': '/equipment/catalog/knife-1980s.webp', 'modern': '/equipment/catalog/knife-modern.webp', },
    modifiers: { damage: '1d4+2' },
    combatProfile: {
      schemaVersion: 1,
      kind: 'melee_weapon',
      combatSkillId: 'Walka Wręcz',
      damageFormula: '1d4+2',
      damageClass: 'impaling',
    },
    value: 3,
  },
  {
    id: 'weapon.machete',
    name: "Maczeta",
    aliases: ["Machete", "weapon.machete-shared"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/machete-1890s.webp', '1920s': '/equipment/catalog/machete-1920s.webp', '1930s': '/equipment/catalog/machete-1930s.webp', '1940s': '/equipment/catalog/machete-1940s.webp', '1980s': '/equipment/catalog/machete-1980s.webp', 'modern': '/equipment/catalog/machete-modern.webp', },
    modifiers: { damage: '1d8+1' },
    combatProfile: {
      schemaVersion: 1,
      kind: 'melee_weapon',
      combatSkillId: 'Walka Wręcz',
      damageFormula: '1d8+1',
      damageClass: 'non_impaling',
    },
    value: 5,
  },
  {
    id: 'occult.candles',
    name: "Świece",
    aliases: ["Candles (12)", "Świece (12 szt.)", "Świece woskowe", "Zestaw rytualnych swiec", "Bundle of Natural Beeswax Candles", "occult.candles-shared"],
    category: 'occult',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/candles-1890s.webp', '1920s': '/equipment/catalog/candles-1920s.webp', '1930s': '/equipment/catalog/candles-1930s.webp', '1940s': '/equipment/catalog/candles-1940s.webp', '1980s': '/equipment/catalog/candles-1980s.webp', 'modern': '/equipment/catalog/candles-modern.webp', },
    value: 1,
  },
  {
    id: 'occult.chalk',
    name: "Kreda rytualna",
    aliases: ["Chalk (colored)", "Kreda (kolorowa)", "Mineral Ritual Chalk Pieces", "occult.chalk-shared"],
    category: 'occult',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/chalk-1890s.webp', '1920s': '/equipment/catalog/chalk-1920s.webp', '1930s': '/equipment/catalog/chalk-1930s.webp', '1940s': '/equipment/catalog/chalk-1940s.webp', '1980s': '/equipment/catalog/chalk-1980s.webp', 'modern': '/equipment/catalog/chalk-modern.webp', },
    value: 1,
  },
  {
    id: 'occult.incense',
    name: "Kadzidło i kadzielnica",
    aliases: ["Incense & Burner", "Bronze Incense Burner and Resins", "occult.incense-shared"],
    category: 'occult',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/incense-1890s.webp', '1920s': '/equipment/catalog/incense-1920s.webp', '1930s': '/equipment/catalog/incense-1930s.webp', '1940s': '/equipment/catalog/incense-1940s.webp', '1980s': '/equipment/catalog/incense-1980s.webp', 'modern': '/equipment/catalog/incense-modern.webp', },
    value: 3,
  },
  {
    id: 'modern.phone',
    name: "Smartfon z ładowarką",
    aliases: [
      "Smartfon",
      "Smartphone",
      "Nowoczesny telefon",
      "Najnowszy smartfon",
      "Telefon komórkowy",
      "Telefon komórkowy z klawiaturą",
      "Telefon z klawiaturą",
      "Komórka",
      "tool.phone-modern",
    ],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ['2000s', 'modern'],
    assetPaths: { '2000s': '/equipment/catalog/phone-modern.webp', 'modern': '/equipment/catalog/phone-modern.webp', },
    value: 300,
  },
  {
    id: 'modern.power-bank',
    name: "Powerbank",
    aliases: [
      "Bateria zewnętrzna",
      "Przenośna bateria",
      "Zapasowa bateria",
      "Bateria",
      "Akumulator",
      "Zapasowy akumulator",
      "Portable Slim Power Bank",
      "tool.power-bank-modern",
    ],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ['2000s', 'modern'],
    assetPaths: { '2000s': '/equipment/catalog/power-bank-modern.webp', 'modern': '/equipment/catalog/power-bank-modern.webp', },
    value: 25,
  },
  {
    id: 'weapon.revolver-colt38-1920s',
    name: "Rewolwer Colt Police Positive .38",
    aliases: ["Colt Police Positive .38 Revolver", "Colt .38", "Rewolwer Colt .38", "Colt Police Positive"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ['1920s', '1940s'],
    assetPaths: { '1920s': '/equipment/catalog/revolver-colt38-1920s.webp', },
    modifiers: { damage: '1d10', range: '15 yards', malfunction: 100 },
    value: 25,
  },
  {
    id: 'weapon.revolver-webley-1920s',
    name: "Rewolwer Webley Mk IV .455",
    aliases: ["Webley Mk IV .455 Revolver", "Webley .455", "Rewolwer Webley", "Webley Mk IV"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ['1890s', '1920s', '1940s'],
    assetPaths: { '1890s': '/equipment/catalog/revolver-webley-1920s.webp', '1920s': '/equipment/catalog/revolver-webley-1920s.webp', },
    modifiers: { damage: '1d10+2', range: '15 yards', malfunction: 100 },
    value: 30,
  },
  {
    id: 'weapon.derringer-1890s',
    name: "Kieszonkowy pistolet Derringer .41",
    aliases: ["Pocket Remington Derringer .41", "Derringer .41", "Mały pistolet Derringer .41", "Derringer"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ['1890s'],
    assetPaths: { '1890s': '/equipment/catalog/derringer-1890s.webp', },
    modifiers: { damage: '1d6', range: '3 yards', malfunction: 100 },
    value: 8,
  },
  {
    id: 'weapon.pistol-p64-prl',
    name: "Pistolet P-64 Czak 9mm Makarov",
    aliases: ["P-64 Czak 9mm Makarov Pistol", "Pistolet P-64", "Pistolet P-64 z zapasowym magazynkiem", "P-64 Czak"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ['prl-1970s', '1980s'],
    assetPaths: { 'prl-1970s': '/equipment/catalog/pistol-p64-prl.webp', },
    modifiers: { damage: '1d8', range: '15 yards', malfunction: 99 },
    value: 40,
  },
  {
    id: 'weapon.pistol-glock-modern',
    name: "Pistolet Glock 19 9mm",
    aliases: ["Glock 19 9mm Pistol", "Glock 19", "Pistolet Glock 19"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: MODERN_ERAS,
    assetPaths: { 'modern': '/equipment/catalog/pistol-glock-modern.webp', },
    modifiers: { damage: '1d10', range: '15 yards', malfunction: 99 },
    value: 500,
  },
  {
    id: 'weapon.shotgun-sawed-off-shared',
    name: "Obrzyn dubeltówki",
    aliases: ["Sawed-Off Double-Barrel Shotgun", "Obrzyn", "Obrzyn dubeltówki (dwururka)"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/shotgun-sawed-off-1890s.webp', '1920s': '/equipment/catalog/shotgun-sawed-off-1920s.webp', '1930s': '/equipment/catalog/shotgun-sawed-off-1930s.webp', '1940s': '/equipment/catalog/shotgun-sawed-off-1940s.webp', '1980s': '/equipment/catalog/shotgun-sawed-off-1980s.webp', 'modern': '/equipment/catalog/shotgun-sawed-off-modern.webp', },
    modifiers: { damage: '4d6/1d6', range: '5/10 yards', malfunction: 100 },
    value: 35,
  },
  {
    id: 'weapon.submachine-tommy-1920s',
    name: "Pistolet maszynowy Thompson 1921",
    aliases: ["Thompson 1921 Submachine Gun", "Thompson", "Tommy Gun", "Pistolet maszynowy Thompson"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ['1920s', '1940s'],
    assetPaths: { '1920s': '/equipment/catalog/submachine-tommy-1920s.webp', },
    modifiers: { damage: '1d10+2', range: '20 yards', malfunction: 96 },
    value: 200,
  },
  {
    id: 'tool.gasoline-lighter-1940s',
    name: "Zapalniczka benzynowa",
    aliases: ["Vintage Gasoline Trench Lighter", "Zapalniczka", "Zapalniczka benzynowa"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ['1940s'],
    assetPaths: { '1940s': '/equipment/catalog/gasoline-lighter-1940s.webp', },
    value: 2,
  },
  {
    id: 'tool.crowbar-shared',
    name: "Stalowy łom",
    aliases: ["Heavy Steel Crowbar", "Łom", "Stalowy łom"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/crowbar-1890s.webp', '1920s': '/equipment/catalog/crowbar-1920s.webp', '1930s': '/equipment/catalog/crowbar-1930s.webp', '1940s': '/equipment/catalog/crowbar-1940s.webp', '1980s': '/equipment/catalog/crowbar-1980s.webp', 'modern': '/equipment/catalog/crowbar-modern.webp', },
    modifiers: { damage: '1d6', skill: 'Walka wręcz' },
    value: 2,
  },
  {
    id: 'personal.pilot-goggles-1920s',
    name: "Skórzana pilotka i gogle",
    aliases: ["Aviation Helmet and Flying Goggles", "Gogle i skórzana pilotka", "Pilotka i gogle", "Gogle lotnicze"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ['1920s', '1940s'],
    assetPaths: { '1920s': '/equipment/catalog/pilot-goggles-1920s.webp', },
    value: 15,
  },
  {
    id: 'tool.french-wrench-tool',
    name: "Klucz francuski nastawny",
    aliases: ["Vintage Adjustable Monkey Wrench", "Klucz francuski", "Klucz nastawny"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/french-wrench-tool-1890s.webp', '1920s': '/equipment/catalog/french-wrench-tool-1920s.webp', '1930s': '/equipment/catalog/french-wrench-tool-1930s.webp', '1940s': '/equipment/catalog/french-wrench-tool-1940s.webp', '1980s': '/equipment/catalog/french-wrench-tool-1980s.webp', 'modern': '/equipment/catalog/french-wrench-tool-modern.webp', },
    modifiers: { damage: '1d6', skill: 'Walka wręcz' },
    value: 3,
  },
  {
    id: 'personal.leather-briefcase-shared',
    name: "Skórzana aktówka śledcza",
    aliases: ["Investigator Leather Briefcase", "Skórzana aktówka", "Aktówka", "Aktówka śledcza"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/leather-briefcase-1890s.webp', '1920s': '/equipment/catalog/leather-briefcase-1920s.webp', '1930s': '/equipment/catalog/leather-briefcase-1930s.webp', '1940s': '/equipment/catalog/leather-briefcase-1940s.webp', '1980s': '/equipment/catalog/leather-briefcase-1980s.webp', 'modern': '/equipment/catalog/leather-briefcase-modern.webp', },
    value: 10,
  },
  {
    id: 'tool.tape-recorder-prl-1970s',
    name: "Magnetofon kasetowy PRL",
    aliases: ["PRL Portable Cassette Recorder", "Magnetofon kasetowy", "Magnetofon szpulowy"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ['prl-1970s', '1980s'],
    assetPaths: { 'prl-1970s': '/equipment/catalog/tape-recorder-prl-1970s.webp', },
    value: 60,
  },
  {
    id: 'medical.morphine-ampoules-shared',
    name: "Ampułki z morfiną",
    aliases: ["Medical Morphine Ampoules in Tin", "Ampułki z morfiną", "Morfina w ampułkach", "Morfina (5 dawek)", "Morfina", "Morphine (5 doses)"],
    category: 'medical',
    visualTreatment: 'mundane',
    availableIn: ['1920s', '1940s'],
    assetPaths: { '1920s': '/equipment/catalog/morphine-ampoules-1920s.webp', '1940s': '/equipment/catalog/morphine-ampoules-1940s.webp', },
    value: 5,
  },
  {
    id: 'personal.silver-cross-shared',
    name: "Srebrny krucyfiks",
    aliases: ["Silver Crucifix on Chain", "Krucyfiks", "Crucifix", "Srebrny krzyżyk", "Krzyżyk srebrny"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/silver-cross-1890s.webp', '1920s': '/equipment/catalog/silver-cross-1920s.webp', '1930s': '/equipment/catalog/silver-cross-1930s.webp', '1940s': '/equipment/catalog/silver-cross-1940s.webp', '1980s': '/equipment/catalog/silver-cross-1980s.webp', 'modern': '/equipment/catalog/silver-cross-modern.webp', },
    value: 15,
  },
  {
    id: 'weapon.revolver-pocket-unlicensed',
    name: "Rewolwer kieszonkowy (bez zezwolenia)",
    aliases: ["Unregistered Pocket Snub Revolver", "Rewolwer kieszonkowy"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/revolver-pocket-unlicensed-1890s.webp', '1920s': '/equipment/catalog/revolver-pocket-unlicensed-1920s.webp', '1930s': '/equipment/catalog/revolver-pocket-unlicensed-1930s.webp', '1940s': '/equipment/catalog/revolver-pocket-unlicensed-1940s.webp', '1980s': '/equipment/catalog/revolver-pocket-unlicensed-1980s.webp', 'modern': '/equipment/catalog/revolver-pocket-unlicensed-modern.webp', },
    modifiers: { damage: '1d6', range: '10 yards', malfunction: 100 },
    value: 10,
  },
  {
    id: 'weapon.leather-whip-shared',
    name: "Skórzany bicz",
    aliases: ["Braided Kangaroo Leather Bullwhip", "Bicz skórzany", "Bat skórzany", "Bicz"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/leather-whip-1890s.webp', '1920s': '/equipment/catalog/leather-whip-1920s.webp', '1930s': '/equipment/catalog/leather-whip-1930s.webp', '1940s': '/equipment/catalog/leather-whip-1940s.webp', '1980s': '/equipment/catalog/leather-whip-1980s.webp', 'modern': '/equipment/catalog/leather-whip-modern.webp', },
    modifiers: { damage: '1d3' },
    value: 5,
  },
  {
    id: 'personal.handcuffs-shared',
    name: "Stalowe kajdanki",
    aliases: ["Steel Police Handcuffs with Key", "Kajdanki policyjne", "Kajdanki"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/handcuffs-1890s.webp', '1920s': '/equipment/catalog/handcuffs-1920s.webp', '1930s': '/equipment/catalog/handcuffs-1930s.webp', '1940s': '/equipment/catalog/handcuffs-1940s.webp', '1980s': '/equipment/catalog/handcuffs-1980s.webp', 'modern': '/equipment/catalog/handcuffs-modern.webp', },
    value: 10,
  },
  {
    id: 'personal.canteen-military-shared',
    name: "Manierka wojskowa",
    aliases: ["Military Canteen in Canvas Cover", "Manierka", "Manierka wojskowa"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/canteen-military-1890s.webp', '1920s': '/equipment/catalog/canteen-military-1920s.webp', '1930s': '/equipment/catalog/canteen-military-1930s.webp', '1940s': '/equipment/catalog/canteen-military-1940s.webp', '1980s': '/equipment/catalog/canteen-military-1980s.webp', 'modern': '/equipment/catalog/canteen-military-modern.webp', },
    value: 2,
  },
  {
    id: 'tool.geological-hammer-shared',
    name: "Młotek geologiczny",
    aliases: ["Geologist Rock Pick Hammer", "Młotek skalny"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/geological-hammer-1890s.webp', '1920s': '/equipment/catalog/geological-hammer-1920s.webp', '1930s': '/equipment/catalog/geological-hammer-1930s.webp', '1940s': '/equipment/catalog/geological-hammer-1940s.webp', '1980s': '/equipment/catalog/geological-hammer-1980s.webp', 'modern': '/equipment/catalog/geological-hammer-modern.webp', },
    modifiers: { damage: '1d4', skill: 'Walka wręcz' },
    value: 2,
  },
  {
    id: 'tool.heavy-police-flashlight-prl',
    name: "Mocna latarka policyjna PRL",
    aliases: ["Heavy Duty Police Flashlight PRL", "Mocna latarka policyjna", "Latarka milicyjna"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ['prl-1970s', '1980s'],
    assetPaths: { 'prl-1970s': '/equipment/catalog/police-flashlight-prl.webp', },
    value: 5,
  },
  {
    id: 'tool.tactical-flashlight-modern',
    name: "Ciężka latarka taktyczna LED",
    aliases: ["Heavy Tactical LED Patrol Light", "Latarka taktyczna", "Latarka LED"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: MODERN_ERAS,
    assetPaths: { 'modern': '/equipment/catalog/tactical-flashlight-modern.webp', },
    value: 35,
  },
  {
    id: 'tool.multitool-modern',
    name: "Multitool Leatherman",
    aliases: ["Stainless Steel Multitool", "Scyzoryk wielofunkcyjny", "Narzędzie wielofunkcyjne"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: MODERN_ERAS,
    assetPaths: { 'modern': '/equipment/catalog/multitool-modern.webp', },
    modifiers: { skill: 'Naprawa mechaniczna', bonus: 5 },
    value: 60,
  },
  {
    id: 'document.sketchbook-shared',
    name: "Szkicownik z ołówkiem",
    aliases: ["Artist Sketchbook with Charcoal Study", "Szkicownik węglowy", "Szkicownik z ołówkiem"],
    category: 'document',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1920s': '/equipment/catalog/sketchbook-pencil-shared.webp', },
    value: 2,
  },
  {
    id: 'medical.laudanum-bottle-vintage',
    name: "Buteleczka z laudanum",
    aliases: ["Amber Glass Tincture Bottle of Laudanum", "Laudanum", "Buteleczka laudanum"],
    category: 'medical',
    visualTreatment: 'mundane',
    availableIn: ['1890s'],
    assetPaths: { '1890s': '/equipment/catalog/laudanum-bottle-vintage-1890s.webp', },
    value: 3,
  },
  {
    id: 'medical.smelling-salts-vial',
    name: "Sole trzeźwiące",
    aliases: ["Antique Glass Smelling Salts Vial", "Sole trzeźwiące i toniki"],
    category: 'medical',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/smelling-salts-vial-1890s.webp', '1920s': '/equipment/catalog/smelling-salts-vial-1920s.webp', '1930s': '/equipment/catalog/smelling-salts-vial-1930s.webp', '1940s': '/equipment/catalog/smelling-salts-vial-1940s.webp', '1980s': '/equipment/catalog/smelling-salts-vial-1980s.webp', 'modern': '/equipment/catalog/smelling-salts-vial-modern.webp', },
    value: 1,
  },
  {
    id: 'occult.tarot-deck-vintage',
    name: "Talia kart Tarota",
    aliases: ["Antique Marseilles Tarot Deck", "Karty tarota", "Tarot"],
    category: 'occult',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/tarot-deck-vintage-1890s.webp', '1920s': '/equipment/catalog/tarot-deck-vintage-1920s.webp', '1930s': '/equipment/catalog/tarot-deck-vintage-1930s.webp', '1940s': '/equipment/catalog/tarot-deck-vintage-1940s.webp', '1980s': '/equipment/catalog/tarot-deck-vintage-1980s.webp', 'modern': '/equipment/catalog/tarot-deck-vintage-modern.webp', },
    value: 5,
  },
  {
    id: 'occult.crystal-ball-stand',
    name: "Kula kryształowa",
    aliases: ["Flawless Quartz Scrying Sphere on Stand", "Kula krysztalowa", "Kula ze szkła"],
    category: 'occult',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/crystal-ball-stand-1890s.webp', '1920s': '/equipment/catalog/crystal-ball-stand-1920s.webp', '1930s': '/equipment/catalog/crystal-ball-stand-1930s.webp', '1940s': '/equipment/catalog/crystal-ball-stand-1940s.webp', '1980s': '/equipment/catalog/crystal-ball-stand-1980s.webp', 'modern': '/equipment/catalog/crystal-ball-stand-modern.webp', },
    value: 25,
  },
  {
    id: 'occult.leather-grimoire-book',
    name: "Oprawny w skórę grimuar",
    aliases: ["Heavy Leather-Bound Grimoire", "Oprawny w skore grimuar", "Grimuar", "Księga cieni"],
    category: 'occult',
    visualTreatment: 'supernatural',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/leather-grimoire-book-1890s.webp', '1920s': '/equipment/catalog/leather-grimoire-book-1920s.webp', '1930s': '/equipment/catalog/leather-grimoire-book-1930s.webp', '1940s': '/equipment/catalog/leather-grimoire-book-1940s.webp', '1980s': '/equipment/catalog/leather-grimoire-book-1980s.webp', 'modern': '/equipment/catalog/leather-grimoire-book-modern.webp', },
    value: 50,
  },
  {
    id: 'occult.latin-scroll-vellum',
    name: "Łaciński zwój z XIV wieku",
    aliases: ["Rolled Medieval Latin Vellum Scroll", "Łaciński pergamin", "Średniowieczny zwój"],
    category: 'occult',
    visualTreatment: 'supernatural',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/latin-scroll-vellum-1890s.webp', '1920s': '/equipment/catalog/latin-scroll-vellum-1920s.webp', '1930s': '/equipment/catalog/latin-scroll-vellum-1930s.webp', '1940s': '/equipment/catalog/latin-scroll-vellum-1940s.webp', '1980s': '/equipment/catalog/latin-scroll-vellum-1980s.webp', 'modern': '/equipment/catalog/latin-scroll-vellum-modern.webp', },
    value: 40,
  },
  {
    id: 'occult.ancient-runes-stones',
    name: "Zestaw starożytnych run",
    aliases: ["Carved River Stone Runes in Pouch", "Zestaw starozytnych run", "Runy kamienne"],
    category: 'occult',
    visualTreatment: 'supernatural',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/ancient-runes-stones-1890s.webp', '1920s': '/equipment/catalog/ancient-runes-stones-1920s.webp', '1930s': '/equipment/catalog/ancient-runes-stones-1930s.webp', '1940s': '/equipment/catalog/ancient-runes-stones-1940s.webp', '1980s': '/equipment/catalog/ancient-runes-stones-1980s.webp', 'modern': '/equipment/catalog/ancient-runes-stones-modern.webp', },
    value: 15,
  },
  {
    id: 'occult.silver-amulet-sigil',
    name: "Srebrny amulet z siglem",
    aliases: ["Heavy Silver Talisman with Astrological Sigil", "Dziwny amulet", "Strange Amulet", "Amulet z siglem", "Amulet ochronny", "Amulet"],
    category: 'occult',
    visualTreatment: 'supernatural',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/silver-amulet-sigil-1890s.webp', '1920s': '/equipment/catalog/silver-amulet-sigil-1920s.webp', '1930s': '/equipment/catalog/silver-amulet-sigil-1930s.webp', '1940s': '/equipment/catalog/silver-amulet-sigil-1940s.webp', '1980s': '/equipment/catalog/silver-amulet-sigil-1980s.webp', 'modern': '/equipment/catalog/silver-amulet-sigil-modern.webp', },
    value: 20,
  },
  {
    id: 'occult.crystal-pendulum-shared',
    name: "Wahadełko z kryształem",
    aliases: ["Faceted Quartz Divination Pendulum", "Wahadełko radiestezyjne"],
    category: 'occult',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/crystal-pendulum-1890s.webp', '1920s': '/equipment/catalog/crystal-pendulum-1920s.webp', '1930s': '/equipment/catalog/crystal-pendulum-1930s.webp', '1940s': '/equipment/catalog/crystal-pendulum-1940s.webp', '1980s': '/equipment/catalog/crystal-pendulum-1980s.webp', 'modern': '/equipment/catalog/crystal-pendulum-modern.webp', },
    value: 8,
  },
  {
    id: 'tool.emf-meter-vintage',
    name: "Miernik pola elektromagnetycznego",
    aliases: [
      "Analog Electromagnetic Field Meter",
      "Detektor pola elektromagnetycznego",
      "Miernik EMF",
      "Detektor EMF",
      "EMF Detector",
      "Wykrywacz EMF",
    ],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/emf-meter-vintage-1890s.webp', '1920s': '/equipment/catalog/emf-meter-vintage-1920s.webp', '1930s': '/equipment/catalog/emf-meter-vintage-1930s.webp', '1940s': '/equipment/catalog/emf-meter-vintage-1940s.webp', 'prl-1970s': '/equipment/catalog/emf-meter-vintage.webp', '1980s': '/equipment/catalog/emf-meter-vintage-1980s.webp', 'modern': '/equipment/catalog/emf-meter-vintage-modern.webp', },
    modifiers: { skill: 'Nauka' },
    value: 50,
  },
  {
    id: 'tool.microcassette-dictaphone',
    name: "Dyktafon na mikrokasety",
    aliases: ["Microcassette Pocket Dictaphone", "Dyktafon reporterski", "Dyktafon kasetowy"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ['prl-1970s', '1980s', '1990s'],
    assetPaths: { 'prl-1970s': '/equipment/catalog/microcassette-dictaphone.webp', '1980s': '/equipment/catalog/microcassette-dictaphone.webp', },
    value: 35,
  },
  {
    id: 'tool.digital-dictaphone-modern',
    name: "Dyktafon cyfrowy",
    aliases: ["Modern Digital Audio Dictaphone", "Mikrofon kierunkowy", "Rejestrator dźwięku"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: MODERN_ERAS,
    assetPaths: { 'modern': '/equipment/catalog/digital-dictaphone-modern.webp', },
    value: 80,
  },
  {
    id: 'tool.nightvision-camera-modern',
    name: "Kamera z trybem NightVision",
    aliases: ["Infrared Night-Vision Video Camcorder", "Kamera na podczerwień", "Kamera noktowizyjna"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ['prl-1970s', '1980s', '1990s', '2000s', 'modern'],
    assetPaths: { 'modern': '/equipment/catalog/nightvision-camera-modern.webp', },
    value: 400,
  },
  {
    id: 'tool.dslr-camera-modern',
    name: "Lustrzanka cyfrowa z fleszem",
    aliases: ["Professional DSLR Camera with Speedlight", "Lustrzanka z fleszem", "Aparat cyfrowy Sony Alpha z zoomem"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: MODERN_ERAS,
    assetPaths: { 'modern': '/equipment/catalog/dslr-camera-modern.webp', },
    value: 600,
  },
  {
    id: 'tool.satellite-gps-modern',
    name: "Odbiornik GPS satelitarny",
    aliases: ["Rugged Handheld Satellite GPS Navigator", "Nawigacja satelitarna", "GPS"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: MODERN_ERAS,
    assetPaths: { 'modern': '/equipment/catalog/satellite-gps-modern.webp', },
    modifiers: { skill: 'Nawigacja', bonus: 20 },
    value: 150,
  },
  {
    id: 'tool.satellite-radio-modern',
    name: "Zabezpieczone radio satelitarne",
    aliases: ["Rugged Satellite Transceiver Radio", "Radio satelitarne"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: MODERN_ERAS,
    assetPaths: { 'modern': '/equipment/catalog/satellite-radio-modern.webp', },
    value: 300,
  },
  {
    id: 'tool.rugged-ultrabook-modern',
    name: "Zabezpieczony Ultrabook",
    aliases: ["Ruggedized Mil-Spec Laptop", "Laptop ze stacją audio", "Zabezpieczony laptop", "Laptop pancerny"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: MODERN_ERAS,
    assetPaths: { 'modern': '/equipment/catalog/rugged-ultrabook-modern.webp', },
    modifiers: { skill: 'Korzystanie z komputerów', bonus: 10 },
    value: 1500,
  },
  {
    id: 'tool.rugged-tablet-lidar',
    name: "Tablet ze skanerem LiDAR",
    aliases: ["Rugged Industrial Tablet with LiDAR Sensor", "Tablet ze skanerem LiDAR", "Wstrząsoodporny tablet ze skanerem LiDAR", "Tablet z dokumentacją pacjentów"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: MODERN_ERAS,
    assetPaths: { 'modern': '/equipment/catalog/rugged-tablet-lidar.webp', },
    value: 1200,
  },
  {
    id: 'tool.batteries-aa',
    assetPaths: { '1890s': '/equipment/catalog/batteries-aa-1890s.webp', '1920s': '/equipment/catalog/batteries-aa-1920s.webp', '1930s': '/equipment/catalog/batteries-aa-1930s.webp', '1940s': '/equipment/catalog/batteries-aa-1940s.webp', '1980s': '/equipment/catalog/batteries-aa-1980s.webp', 'modern': '/equipment/catalog/batteries-aa-modern.webp', },
    name: "Zapasowe baterie (R6/AA)",
    aliases: [
      "Zapasowe baterie",
      "Baterie AA",
      "Baterie R6",
      "Baterie alkaliczne",
      "Alkaline Batteries",
      "AA Batteries",
      "Baterie do latarki",
      "Zestaw baterii alkalicznych",
      "Baterie",
      "Bateria",
      "Bateria AA",
      "Akumulatorki",
      "tool.batteries-aa",
    ],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    value: 2,
    weight: 0.2,
  },
  {
    id: 'tool.brick-cellphone-prl',
    name: "Telefon komórkowy (wielki)",
    aliases: ["Vintage 1980s Brick Cellphone", "Telefon komórkowy (cegła)"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ['prl-1970s', '1980s', '1990s', '2000s'],
    assetPaths: { 'prl-1970s': '/equipment/catalog/brick-cellphone-prl.webp', },
    value: 500,
  },
  {
    id: 'tool.audio-cassette-shared',
    name: "Taśma kasetowa z nagraniem",
    aliases: ["Compact Audio Cassette with Handwritten Label", "Kaseta magnetofonowa", "Taśma magnetofonowa"],
    category: 'document',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { 'prl-1970s': '/equipment/catalog/audio-cassette-shared.webp', '1980s': '/equipment/catalog/audio-cassette-shared.webp', },
    value: 2,
  },
  {
    id: 'tool.film-reel-shared',
    name: "Szpula taśmy 16mm",
    aliases: ["16mm Metal Film Reel in Tin", "Taśma filmowa", "Szpula filmowa"],
    category: 'document',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1920s': '/equipment/catalog/film-reel-shared.webp', '1940s': '/equipment/catalog/film-reel-shared.webp', },
    value: 10,
  },
  {
    id: 'tool.encrypted-usb-modern',
    name: "Zaszyfrowany pendrive i dysk",
    aliases: ["Hardware Encrypted Flash Drive with Keypad", "Zaszyfrowany pendrive i dysk zewnętrzny", "Zestaw cyber-śledczy", "Pendrive z szyfrowaniem"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: MODERN_ERAS,
    assetPaths: { 'modern': '/equipment/catalog/encrypted-usb-modern.webp', },
    value: 40,
  },
  {
    id: 'personal.archive-keys-bundle',
    name: "Pęk starych kluczy do archiwum",
    aliases: ["Heavy Iron Ring of Antique Archive Keys", "Pęk kluczy"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/archive-keys-bundle-1890s.webp', '1920s': '/equipment/catalog/archive-keys-bundle-1920s.webp', '1930s': '/equipment/catalog/archive-keys-bundle-1930s.webp', '1940s': '/equipment/catalog/archive-keys-bundle-1940s.webp', '1980s': '/equipment/catalog/archive-keys-bundle-1980s.webp', 'modern': '/equipment/catalog/archive-keys-bundle-modern.webp', },
    value: 5,
  },
  {
    id: 'personal.reading-glasses-case',
    name: "Okulary do czytania w etui",
    aliases: ["Tortoiseshell Reading Glasses & Leather Case", "Okulary do czytania", "Okulary z filtrem światła niebieskiego"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/reading-glasses-case-1890s.webp', '1920s': '/equipment/catalog/reading-glasses-case-1920s.webp', '1930s': '/equipment/catalog/reading-glasses-case-1930s.webp', '1940s': '/equipment/catalog/reading-glasses-case-1940s.webp', '1980s': '/equipment/catalog/reading-glasses-case-1980s.webp', 'modern': '/equipment/catalog/reading-glasses-case-modern.webp', },
    value: 5,
  },
  {
    id: 'personal.tactical-vest-black',
    name: "Kamizelka taktyczna",
    aliases: ["Black Tactical MOLLE Load-Bearing Vest", "Kamizelka kuloodporna"],
    category: 'armor',
    visualTreatment: 'mundane',
    availableIn: MODERN_ERAS,
    assetPaths: { 'modern': '/equipment/catalog/tactical-vest-black.webp', },
    modifiers: { bonus: 6 },
    value: 250,
  },
  {
    id: 'personal.rugged-hiking-backpack',
    name: "Plecak turystyczny",
    aliases: ["Plecak", "Backpack", "Rucksack", "Expedition Cordura Rucksack", "Wstrząsoodporny plecak turystyczny", "Plecak wyprawowy"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/rugged-hiking-backpack-1890s.webp', '1920s': '/equipment/catalog/rugged-hiking-backpack-1920s.webp', '1930s': '/equipment/catalog/rugged-hiking-backpack-1930s.webp', '1940s': '/equipment/catalog/rugged-hiking-backpack-1940s.webp', '1980s': '/equipment/catalog/rugged-hiking-backpack-1980s.webp', 'modern': '/equipment/catalog/rugged-hiking-backpack.webp', },
    value: 15,
  },
  {
    id: 'weapon.rifle-lee-metford-1890s',
    name: "Karabin Lee-Metford .303",
    aliases: ["Lee-Metford .303 Bolt-Action Service Rifle", "Karabin .303", "Lee-Metford"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ['1890s'],
    assetPaths: { '1890s': '/equipment/catalog/rifle-lee-metford-1890s.webp', },
    modifiers: { damage: '2d6+4', range: '110 yards', malfunction: 100 },
    value: 60,
  },
  {
    id: 'weapon.rifle-springfield-1920s',
    name: "Karabin Springfield M1903",
    aliases: ["Springfield M1903 .30-06 Rifle", "Karabin Springfield", "Springfield M1903"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ['1920s', '1940s'],
    assetPaths: { '1920s': '/equipment/catalog/rifle-springfield-1920s.webp', },
    modifiers: { damage: '2d6+4', range: '110 yards', malfunction: 100 },
    value: 75,
  },
  {
    id: 'weapon.rifle-hk416-modern',
    name: "Karabinek H&K 416",
    aliases: ["Tactical H&K 416 Carbine", "HK416", "Karabinek automatyczny H&K 416"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: MODERN_ERAS,
    assetPaths: { 'modern': '/equipment/catalog/rifle-hk416-modern.webp', },
    modifiers: { damage: '2d6', range: '90 yards', malfunction: 98 },
    value: 1200,
  },
  {
    id: 'medical.adrenaline-syringes-modern',
    name: "Ampułkostrzykawki z adrenaliną",
    aliases: ["Auto-Injector Epinephrine Syringes", "EpiPen", "Adrenalina"],
    category: 'medical',
    visualTreatment: 'mundane',
    availableIn: MODERN_ERAS,
    assetPaths: { 'modern': '/equipment/catalog/adrenaline-syringes-modern.webp', },
    value: 20,
  },
  {
    id: 'medical.psychotropics-kit-shared',
    name: "Leki uspokajające i psychotropowe",
    aliases: ["Sedatives & Psychiatric Medication Kit", "Środek uspokajający", "Środki uspokajające", "Leki psychotropowe", "Przenośna apteczka z lekami psychotropowymi"],
    category: 'medical',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/psychotropics-kit-1890s.webp', '1920s': '/equipment/catalog/psychotropics-kit-1920s.webp', '1930s': '/equipment/catalog/psychotropics-kit-1930s.webp', '1940s': '/equipment/catalog/psychotropics-kit-1940s.webp', '1980s': '/equipment/catalog/psychotropics-kit-1980s.webp', 'modern': '/equipment/catalog/psychotropics-kit-modern.webp', },
    value: 5,
  },
  {
    id: 'document.patient-records-folder',
    name: "Teczka z aktami pacjentów",
    aliases: ["Asylum Patient Case Files Folder", "Akta pacjentów", "Teczka pacjenta"],
    category: 'document',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1920s': '/equipment/catalog/patient-records-folder.webp', },
    value: 2,
  },
  {
    id: 'personal.medical-id-badge',
    name: "Identyfikator medyczny ordynatora",
    aliases: ["Hospital Chief Medical Officer Badge", "Identyfikator medyczny", "Przepustka szpitalna"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: MODERN_ERAS,
    assetPaths: { 'modern': '/equipment/catalog/medical-id-badge.webp', },
    value: 5,
  },
  {
    id: 'tool.climbing-carabiners-modern',
    name: "Lina wspinaczkowa i karabinki",
    aliases: ["Dynamic Climbing Rope & Locking Carabiners", "Uprząż wspinaczkowa", "Karabinki i lina"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: MODERN_ERAS,
    assetPaths: { 'modern': '/equipment/catalog/climbing-carabiners-modern.webp', },
    value: 40,
  },
  {
    id: 'tool.night-photo-kit-shared',
    name: "Zestaw do zdjęć nocnych",
    aliases: ["Night Photography Tripod and Cable Release", "Zestaw do zdjęć nocnych"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/night-photo-kit-1890s.webp', '1920s': '/equipment/catalog/night-photo-kit-1920s.webp', '1930s': '/equipment/catalog/night-photo-kit-1930s.webp', '1940s': '/equipment/catalog/night-photo-kit-1940s.webp', '1980s': '/equipment/catalog/night-photo-kit-1980s.webp', 'modern': '/equipment/catalog/night-photo-kit-modern.webp', },
    value: 50,
  },
  {
    id: 'tool.diy-emf-detector-prl',
    name: "Wykrywacz EMF domowej roboty",
    aliases: ["Handmade Homemade EMF Detector Unit", "Wykrywacz pól elektromagnetycznych domowej roboty"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ['prl-1970s', '1980s', '1990s', '2000s', 'modern'],
    assetPaths: { 'prl-1970s': '/equipment/catalog/diy-emf-detector-prl.webp', '2000s': '/equipment/catalog/diy-emf-detector-prl.webp', 'modern': '/equipment/catalog/diy-emf-detector-prl.webp' },
    value: 10,
  },
  {
    id: 'tool.electronics-case-prl',
    name: "Zestaw narzędzi w walizce",
    aliases: ["Electronic Repair Tools in Hard Case", "Zestaw narzędzi w walizce", "Zestaw narzędzi do elektroniki"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ['prl-1970s', '1980s', '1990s', '2000s', 'modern'],
    assetPaths: { 'prl-1970s': '/equipment/catalog/electronics-case-prl.webp', '2000s': '/equipment/catalog/electronics-case-prl.webp', 'modern': '/equipment/catalog/electronics-case-prl.webp' },
    modifiers: { skill: 'Elektronika', bonus: 10 },
    value: 25,
  },
  {
    id: 'tool.heavy-laptop-wifi-1990s',
    name: "Ciężki laptop z wczesnym Wi-Fi",
    aliases: [
      "Heavy 1990s Laptop with PCMCIA Card",
      "Laptop z wczesnym Wi-Fi",
      "Laptop",
      "Komputer przenośny",
      "Ciężki laptop",
      "tool.laptop-modern",
    ],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ['1990s', '2000s', 'modern'],
    assetPaths: { '1990s': '/equipment/catalog/heavy-laptop-wifi-1990s.webp', '2000s': '/equipment/catalog/heavy-laptop-wifi-1990s.webp', 'modern': '/equipment/catalog/heavy-laptop-wifi-1990s.webp' },
    value: 800,
  },
  {
    id: 'tool.scientific-calc-prl',
    name: "Kalkulator naukowy Elwro/PRL",
    aliases: ["Vintage VFD Display Scientific Calculator", "Kalkulator naukowy", "Kalkulator Elwro"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ['prl-1970s', '1980s', '1990s'],
    assetPaths: { 'prl-1970s': '/equipment/catalog/scientific-calc-prl.webp', },
    value: 20,
  },
  {
    id: 'armor.safety-helmet-industrial',
    name: "Przemysłowy kask ochronny",
    aliases: ["Vintage Industrial Safety Hard Hat", "Kask ochronny", "Kask budowlany"],
    category: 'armor',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/safety-helmet-industrial-1890s.webp', '1920s': '/equipment/catalog/safety-helmet-industrial-1920s.webp', '1930s': '/equipment/catalog/safety-helmet-industrial-1930s.webp', '1940s': '/equipment/catalog/safety-helmet-industrial-1940s.webp', '1980s': '/equipment/catalog/safety-helmet-industrial-1980s.webp', 'modern': '/equipment/catalog/safety-helmet-industrial-modern.webp', },
    modifiers: { bonus: 2 },
    value: 10,
  },
  {
    id: 'armor.fireproof-gloves-shared',
    name: "Rękawice ognioodporne",
    aliases: ["Heavy Fireproof Cowhide Gauntlets", "Rękawice ognioodporne", "Rękawice azbestowe"],
    category: 'armor',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/fireproof-gloves-1890s.webp', '1920s': '/equipment/catalog/fireproof-gloves-1920s.webp', '1930s': '/equipment/catalog/fireproof-gloves-1930s.webp', '1940s': '/equipment/catalog/fireproof-gloves-1940s.webp', '1980s': '/equipment/catalog/fireproof-gloves-1980s.webp', 'modern': '/equipment/catalog/fireproof-gloves-modern.webp', },
    modifiers: { bonus: 1 },
    value: 10,
  },
  {
    id: 'document.contacts-notebook-prl',
    name: "Notes kontaktów i telefonów",
    aliases: ["Vintage Pocket Telephone Address Book", "Notes kontaktów", "Książka telefoniczna"],
    category: 'document',
    visualTreatment: 'mundane',
    availableIn: ['prl-1970s', '1980s'],
    assetPaths: { 'prl-1970s': '/equipment/catalog/contacts-notebook-prl.webp', },
    value: 2,
  },
  {
    id: 'personal.embroidered-shawl',
    name: "Haftowany szal wełniany",
    aliases: ["Traditional Folk Embroidered Wool Shawl", "Haftowany szal", "Szal wełniany"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/embroidered-shawl-1890s.webp', '1920s': '/equipment/catalog/embroidered-shawl-1920s.webp', '1930s': '/equipment/catalog/embroidered-shawl-1930s.webp', '1940s': '/equipment/catalog/embroidered-shawl-1940s.webp', '1980s': '/equipment/catalog/embroidered-shawl-1980s.webp', 'modern': '/equipment/catalog/embroidered-shawl-modern.webp', },
    value: 8,
  },
  {
    id: 'personal.black-veil-hat',
    name: "Czarny welon i kapelusz maskujący",
    aliases: ["Mourning Hat with Black Lace Veil", "Czarny welon", "Kapelusz z welonem"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ['1890s'],
    assetPaths: { '1890s': '/equipment/catalog/black-veil-hat.webp', },
    value: 12,
  },
  {
    id: 'personal.trenchcoat-hat-noir',
    name: "Prochowiec i kapelusz",
    aliases: ["Folded Noir Trenchcoat and Fedora", "Prochowiec i kapelusz", "Płaszcz detektywistyczny"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ['1920s', '1940s'],
    assetPaths: { '1920s': '/equipment/catalog/trenchcoat-hat-noir-1920s.webp', '1940s': '/equipment/catalog/trenchcoat-hat-noir.webp', },
    value: 25,
  },
  {
    id: 'personal.nurse-cross-silver',
    name: "Srebrny krzyżyk pielęgniarki",
    aliases: ["Vintage Silver Nurse Cross Pendant", "Krzyżyk pielęgniarki"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ['1890s', '1920s', '1940s'],
    assetPaths: { '1890s': '/equipment/catalog/nurse-cross-silver-1890s.webp', '1920s': '/equipment/catalog/nurse-cross-silver-1920s.webp', '1940s': '/equipment/catalog/nurse-cross-silver-1940s.webp', },
    value: 10,
  },
  {
    id: 'occult.holy-water-phial',
    name: "Buteleczka z wodą święconą",
    aliases: ["Engraved Glass Phial of Blessed Water", "Woda święcona", "Buteleczka z wodą święconą"],
    category: 'occult',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/holy-water-phial-1890s.webp', '1920s': '/equipment/catalog/holy-water-phial-1920s.webp', '1930s': '/equipment/catalog/holy-water-phial-1930s.webp', '1940s': '/equipment/catalog/holy-water-phial-1940s.webp', '1980s': '/equipment/catalog/holy-water-phial-1980s.webp', 'modern': '/equipment/catalog/holy-water-phial-modern.webp', },
    value: 5,
  },
  {
    id: 'occult.sage-incense-bundle',
    name: "Kadzidła szałwiowe",
    aliases: ["Dried White Sage Smudge Stick Bundle", "Biała szałwia", "Pęczek szałwii"],
    category: 'occult',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/sage-incense-bundle-1890s.webp', '1920s': '/equipment/catalog/sage-incense-bundle-1920s.webp', '1930s': '/equipment/catalog/sage-incense-bundle-1930s.webp', '1940s': '/equipment/catalog/sage-incense-bundle-1940s.webp', '1980s': '/equipment/catalog/sage-incense-bundle-1980s.webp', 'modern': '/equipment/catalog/sage-incense-bundle-modern.webp', },
    value: 3,
  },
  {
    id: 'occult.protective-herbs-pouch',
    name: "Woreczek ziół ochronnych",
    aliases: ["Linen Charm Pouch of Protective Herbs", "Woreczek ziol ochronnych", "Zioła ochronne"],
    category: 'occult',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/protective-herbs-pouch-1890s.webp', '1920s': '/equipment/catalog/protective-herbs-pouch-1920s.webp', '1930s': '/equipment/catalog/protective-herbs-pouch-1930s.webp', '1940s': '/equipment/catalog/protective-herbs-pouch-1940s.webp', '1980s': '/equipment/catalog/protective-herbs-pouch-1980s.webp', 'modern': '/equipment/catalog/protective-herbs-pouch-modern.webp', },
    value: 3,
  },
  {
    id: 'occult.silver-talisman-shared',
    name: "Srebrny talizman z kamieniem",
    aliases: ["Silver Amulet with Polished Obsidian", "Srebrny talizman", "Talizman ochronny"],
    category: 'occult',
    visualTreatment: 'supernatural',
    availableIn: ALL_ERAS,
    assetPaths: { '1890s': '/equipment/catalog/silver-talisman-1890s.webp', '1920s': '/equipment/catalog/silver-talisman-1920s.webp', '1930s': '/equipment/catalog/silver-talisman-1930s.webp', '1940s': '/equipment/catalog/silver-talisman-1940s.webp', '1980s': '/equipment/catalog/silver-talisman-1980s.webp', 'modern': '/equipment/catalog/silver-talisman-modern.webp', },
    value: 25,
  },
  {
    id: 'document.ancient-translations-book',
    name: "Zeszyt z odręcznymi tłumaczeniami",
    aliases: ["Scholar Notebook of Hieroglyphic Translations", "Zeszyt z odręcznymi tłumaczeniami", "Monografia o demonologii", "Rzadkie słowniki lingwistyczne"],
    category: 'document',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    assetPaths: { '1920s': '/equipment/catalog/ancient-translations-book.webp', },
    value: 15,
  },
  {
    id: 'tool.thermometer',
    assetPaths: { '1890s': '/equipment/catalog/thermometer-1890s.webp', '1920s': '/equipment/catalog/thermometer-1920s.webp', '1930s': '/equipment/catalog/thermometer-1930s.webp', '1940s': '/equipment/catalog/thermometer-1940s.webp', '1980s': '/equipment/catalog/thermometer-1980s.webp', 'modern': '/equipment/catalog/thermometer-modern.webp', },
    name: "Termometr",
    aliases: ["Thermometer", "Termometr laboratoryjny", "Termometr lekarski", "Termometr rtęciowy"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    modifiers: { skill: 'Nauka' },
    value: 2,
  },
  {
    id: 'tool.photo-tripod',
    assetPaths: { '1890s': '/equipment/catalog/photo-tripod-1890s.webp', '1920s': '/equipment/catalog/photo-tripod-1920s.webp', '1930s': '/equipment/catalog/photo-tripod-1930s.webp', '1940s': '/equipment/catalog/photo-tripod-1940s.webp', '1980s': '/equipment/catalog/photo-tripod-1980s.webp', 'modern': '/equipment/catalog/photo-tripod-modern.webp', },
    name: "Statyw fotograficzny",
    aliases: ["Statyw", "Tripod", "Statyw drewniany", "Mosiężny statyw fotograficzny"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    value: 5,
  },
  {
    id: 'tool.photo-plates',
    assetPaths: { '1890s': '/equipment/catalog/photo-plates-1890s.webp', '1920s': '/equipment/catalog/photo-plates-1920s.webp', '1930s': '/equipment/catalog/photo-plates-1930s.webp', '1940s': '/equipment/catalog/photo-plates-1940s.webp', '1980s': '/equipment/catalog/photo-plates-1980s.webp', 'modern': '/equipment/catalog/photo-plates-modern.webp', },
    name: "Klisza fotograficzna",
    aliases: ["Klisza", "Klisze", "Klisze szklane", "Błona fotograficzna", "Film roll", "Photo plates"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    value: 2,
  },
  {
    id: 'tool.trowel-brush',
    assetPaths: { '1890s': '/equipment/catalog/trowel-brush-1890s.webp', '1920s': '/equipment/catalog/trowel-brush-1920s.webp', '1930s': '/equipment/catalog/trowel-brush-1930s.webp', '1940s': '/equipment/catalog/trowel-brush-1940s.webp', '1980s': '/equipment/catalog/trowel-brush-1980s.webp', 'modern': '/equipment/catalog/trowel-brush-modern.webp', },
    name: "Pędzel i kielnia archeologiczna",
    aliases: ["Pędzel i kielnia", "Kielnia i pędzel", "Narzędzia archeologiczne", "Archaeological Trowel & Brush"],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    modifiers: { skill: 'Archeologia', bonus: 5 },
    value: 3,
  },
  {
    id: 'tool.lab-equipment',
    assetPaths: { '1890s': '/equipment/catalog/lab-equipment-1890s.webp', '1920s': '/equipment/catalog/lab-equipment-1920s.webp', '1930s': '/equipment/catalog/lab-equipment-1930s.webp', '1940s': '/equipment/catalog/lab-equipment-1940s.webp', '1980s': '/equipment/catalog/lab-equipment-1980s.webp', 'modern': '/equipment/catalog/lab-equipment-modern.webp', },
    name: "Sprzęt laboratoryjny",
    aliases: [
      "Sprzęt laboratoryjny (w laboratorium)",
      "Zestaw laboratoryjny",
      "Szkło laboratoryjne",
      "Laboratory Equipment",
    ],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    modifiers: { skill: 'Nauka', bonus: 10 },
    value: 50,
  },
  {
    id: 'tool.typewriter',
    assetPaths: { '1890s': '/equipment/catalog/typewriter-1890s.webp', '1920s': '/equipment/catalog/typewriter-1920s.webp', '1930s': '/equipment/catalog/typewriter-1930s.webp', '1940s': '/equipment/catalog/typewriter-1940s.webp', '1980s': '/equipment/catalog/typewriter-1980s.webp', 'modern': '/equipment/catalog/typewriter-modern.webp', },
    name: "Maszyna do pisania",
    aliases: [
      "Maszyna do pisania (w domu)",
      "Mechaniczna maszyna do pisania",
      "Przenośna maszyna do pisania Remington",
      "Typewriter",
    ],
    category: 'tool',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    value: 20,
  },
  {
    id: 'document.source-books',
    name: "Książki źródłowe",
    aliases: ["Reference Books", "Księgi źródłowe", "Dzieła naukowe", "Tomy encyklopedii"],
    category: 'document',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    modifiers: { skill: 'Biblioteka', bonus: 5 },
    value: 10,
  },
  {
    id: 'document.library-card',
    name: "Karta biblioteczna",
    aliases: ["Library Card", "Karta czytelnika", "Karta biblioteczna Miskatonic", "Przepustka biblioteczna"],
    category: 'document',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    value: 1,
  },
  {
    id: 'document.bible',
    name: "Biblia / modlitewnik",
    aliases: ["Biblia/modlitewnik", "Biblia", "Modlitewnik", "Pismo Święte", "Holy Bible"],
    category: 'document',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    value: 3,
  },
  {
    id: 'document.music-sheets',
    name: "Nuty i partytury",
    aliases: ["Nuty", "Partytury", "Nuty muzyczne", "Music Sheets"],
    category: 'document',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    modifiers: { skill: 'Sztuka/Rzemiosło' },
    value: 2,
  },
  {
    id: 'document.script',
    name: "Scenariusz teatralny",
    aliases: ["Scenariusz", "Egzemplarz teatralny", "Rękopis scenariusza", "Play Script"],
    category: 'document',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    value: 2,
  },
  {
    id: 'weapon.police-baton',
    assetPaths: { '1890s': '/equipment/catalog/police-baton-1890s.webp', '1920s': '/equipment/catalog/police-baton-1920s.webp', '1930s': '/equipment/catalog/police-baton-1930s.webp', '1940s': '/equipment/catalog/police-baton-1940s.webp', '1980s': '/equipment/catalog/police-baton-1980s.webp', 'modern': '/equipment/catalog/police-baton-modern.webp', },
    name: "Pałka policyjna",
    aliases: ["Pałka", "Pałka drewniana", "Police Baton", "Club/Baton"],
    category: 'weapon',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    modifiers: { damage: '1d6' },
    combatProfile: {
      schemaVersion: 1,
      kind: 'melee_weapon',
      combatSkillId: 'Walka Wręcz',
      damageFormula: '1d6',
      damageClass: 'non_impaling',
    },
    value: 2,
  },
  {
    id: 'personal.car-keys',
    assetPaths: { '1890s': '/equipment/catalog/car-keys-1890s.webp', '1920s': '/equipment/catalog/car-keys-1920s.webp', '1930s': '/equipment/catalog/car-keys-1930s.webp', '1940s': '/equipment/catalog/car-keys-1940s.webp', '1980s': '/equipment/catalog/car-keys-1980s.webp', 'modern': '/equipment/catalog/car-keys-modern.webp', },
    name: "Kluczyki do samochodu",
    aliases: ["Car Keys", "Kluczyki samochodowe", "Kluczyki do auta"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    value: 2,
  },
  {
    id: 'personal.art-pencils',
    assetPaths: { '1890s': '/equipment/catalog/art-pencils-1890s.webp', '1920s': '/equipment/catalog/art-pencils-1920s.webp', '1930s': '/equipment/catalog/art-pencils-1930s.webp', '1940s': '/equipment/catalog/art-pencils-1940s.webp', '1980s': '/equipment/catalog/art-pencils-1980s.webp', 'modern': '/equipment/catalog/art-pencils-modern.webp', },
    name: "Ołówki i węgiel rysunkowy",
    aliases: ["Ołówki i węgiel", "Węgiel rysunkowy", "Zestaw ołówków", "Drawing Pencils & Charcoal"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    modifiers: { skill: 'Sztuka/Rzemiosło', bonus: 5 },
    value: 2,
  },
  {
    id: 'personal.palette-brushes',
    assetPaths: { '1890s': '/equipment/catalog/palette-brushes-1890s.webp', '1920s': '/equipment/catalog/palette-brushes-1920s.webp', '1930s': '/equipment/catalog/palette-brushes-1930s.webp', '1940s': '/equipment/catalog/palette-brushes-1940s.webp', '1980s': '/equipment/catalog/palette-brushes-1980s.webp', 'modern': '/equipment/catalog/palette-brushes-modern.webp', },
    name: "Paleta i pędzle malarskie",
    aliases: ["Paleta i pędzle", "Zestaw pędzli", "Paleta malarska", "Palette and Brushes"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    modifiers: { skill: 'Sztuka/Rzemiosło', bonus: 5 },
    value: 4,
  },
  {
    id: 'personal.sports-gear',
    assetPaths: { '1890s': '/equipment/catalog/sports-gear-1890s.webp', '1920s': '/equipment/catalog/sports-gear-1920s.webp', '1930s': '/equipment/catalog/sports-gear-1930s.webp', '1940s': '/equipment/catalog/sports-gear-1940s.webp', '1980s': '/equipment/catalog/sports-gear-1980s.webp', 'modern': '/equipment/catalog/sports-gear-modern.webp', },
    name: "Strój sportowy",
    aliases: ["Strój sportowy", "Strój gimnastyczny", "Kostium sportowy", "Athletic Wear"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    value: 5,
  },
  {
    id: 'personal.sports-bag',
    assetPaths: { '1890s': '/equipment/catalog/sports-bag-1890s.webp', '1920s': '/equipment/catalog/sports-bag-1920s.webp', '1930s': '/equipment/catalog/sports-bag-1930s.webp', '1940s': '/equipment/catalog/sports-bag-1940s.webp', '1980s': '/equipment/catalog/sports-bag-1980s.webp', 'modern': '/equipment/catalog/sports-bag-modern.webp', },
    name: "Torba sportowa",
    aliases: ["Torba sportowa", "Duffle bag", "Gym Bag"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    value: 3,
  },
  {
    id: 'personal.towel',
    assetPaths: { '1890s': '/equipment/catalog/towel-1890s.webp', '1920s': '/equipment/catalog/towel-1920s.webp', '1930s': '/equipment/catalog/towel-1930s.webp', '1940s': '/equipment/catalog/towel-1940s.webp', '1980s': '/equipment/catalog/towel-1980s.webp', 'modern': '/equipment/catalog/towel-modern.webp', },
    name: "Ręcznik bawełniany",
    aliases: ["Ręcznik", "Cotton Towel"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    value: 1,
  },
  {
    id: 'personal.musical-instrument',
    assetPaths: { '1890s': '/equipment/catalog/musical-instrument-1890s.webp', '1920s': '/equipment/catalog/musical-instrument-1920s.webp', '1930s': '/equipment/catalog/musical-instrument-1930s.webp', '1940s': '/equipment/catalog/musical-instrument-1940s.webp', '1980s': '/equipment/catalog/musical-instrument-1980s.webp', 'modern': '/equipment/catalog/musical-instrument-modern.webp', },
    name: "Instrument muzyczny",
    aliases: ["Instrument", "Futerał z instrumentem", "Skrzypce", "Trąbka", "Klarnet", "Musical Instrument"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    modifiers: { skill: 'Sztuka/Rzemiosło', bonus: 5 },
    value: 25,
  },
  {
    id: 'personal.makeup-kit',
    assetPaths: { '1890s': '/equipment/catalog/makeup-kit-1890s.webp', '1920s': '/equipment/catalog/makeup-kit-1920s.webp', '1930s': '/equipment/catalog/makeup-kit-1930s.webp', '1940s': '/equipment/catalog/makeup-kit-1940s.webp', '1980s': '/equipment/catalog/makeup-kit-1980s.webp', 'modern': '/equipment/catalog/makeup-kit-modern.webp', },
    name: "Zestaw do charakteryzacji",
    aliases: ["Zestaw do charakteryzacji", "Kuferek charakteryzatorski", "Farby do charakteryzacji", "Disguise / Makeup Kit"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    modifiers: { skill: 'Charakteryzacja', bonus: 10 },
    value: 10,
  },
  {
    id: 'personal.overalls',
    assetPaths: { '1890s': '/equipment/catalog/overalls-1890s.webp', '1920s': '/equipment/catalog/overalls-1920s.webp', '1930s': '/equipment/catalog/overalls-1930s.webp', '1940s': '/equipment/catalog/overalls-1940s.webp', '1980s': '/equipment/catalog/overalls-1980s.webp', 'modern': '/equipment/catalog/overalls-modern.webp', },
    name: "Kombinezon roboczy",
    aliases: ["Kombinezon", "Drelich roboczy", "Kombinezon mechanika", "Work Overalls"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    value: 3,
  },
  {
    id: 'personal.blanket',
    assetPaths: { '1890s': '/equipment/catalog/blanket-1890s.webp', '1920s': '/equipment/catalog/blanket-1920s.webp', '1930s': '/equipment/catalog/blanket-1930s.webp', '1940s': '/equipment/catalog/blanket-1940s.webp', '1980s': '/equipment/catalog/blanket-1980s.webp', 'modern': '/equipment/catalog/blanket-modern.webp', },
    name: "Wełniany koc",
    aliases: ["Koc", "Koc wełniany", "Koc podróżny", "Woolen Blanket"],
    category: 'personal',
    visualTreatment: 'mundane',
    availableIn: ALL_ERAS,
    value: 2,
  },
];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pl-PL');
}

function matchesPhraseBoundary(text: string, phrase: string): boolean {
  if (!text || !phrase) return false;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i');
  return regex.test(text);
}


/**
 * Deterministycznie rozwiązuje identyfikator wariantu epokowego dla przedmiotu (Issue #503).
 * Przekształca bazowe ID (np. 'light.flashlight') w ID właściwe dla aktywnej epoki ('light.flashlight-1920s').
 */
export function resolveEraEquipmentId(
  baseOrVariantId: string,
  era: EquipmentVisualEra | string = '1920s'
): string {
  const visualEra = safeResolveVisualEra(era);
  if (!baseOrVariantId) return '';
  if (baseOrVariantId.endsWith(`-${visualEra}`) || baseOrVariantId.endsWith(`.${visualEra}`)) {
    return baseOrVariantId;
  }
  const cleanBase = baseOrVariantId.replace(
    /-(1890s|1920s|1930s|1940s|1950s|prl-1970s|prl|1980s|1990s|2000s|modern|shared)$/,
    ''
  );
  return `${cleanBase}-${visualEra}`;
}

/**
 * Zwraca katalog przedmiotów dostępnych wyłącznie w danej epoce historycznej z unikalnymi ID i dedykowanymi assetami (Issue #503).
 */
export function getEraEquipmentCatalog(
  era: EquipmentVisualEra | string = '1920s'
): EraEquipmentTemplate[] {
  const visualEra = safeResolveVisualEra(era);
  return EQUIPMENT_CATALOG.filter(
    (template) => !template.availableIn || template.availableIn.includes(visualEra)
  ).map((template) => ({
    id: resolveEraEquipmentId(template.id, visualEra),
    baseTemplateId: template.id,
    era: visualEra,
    name: template.name,
    aliases: template.aliases,
    category: template.category,
    description: template.description,
    visualTreatment: template.visualTreatment,
    assetPath: resolveCatalogAsset(template, visualEra),
    modifiers: template.modifiers,
    combatProfile: template.combatProfile,
    value: template.value,
    weight: template.weight,
  }));
}

export function findEquipmentTemplate(
  nameOrId: string | undefined,
  expectedCategory?: EquipmentCategory
): EquipmentTemplate | undefined {
  if (!nameOrId) return undefined;
  const needle = normalize(nameOrId);

  // 1. Ścisłe dopasowanie po ID, nazwie lub aliasie
  const exactMatches = EQUIPMENT_CATALOG.filter(
    (template) =>
      template.id === nameOrId ||
      normalize(template.name) === needle ||
      template.aliases.some((alias) => normalize(alias) === needle)
  );
  if (exactMatches.length > 0) {
    if (expectedCategory) {
      const catMatch = exactMatches.find((t) => t.category === expectedCategory);
      if (catMatch) return catMatch;
    }
    return exactMatches[0];
  }

  // 1b. Dopasowanie po ID wariantu epokowego (np. light.flashlight-1920s -> light.flashlight) (Issue #503)
  const baseIdCandidate = nameOrId.replace(
    /-(1890s|1920s|1930s|1940s|1950s|prl-1970s|prl|1980s|1990s|2000s|modern|shared)$/,
    ''
  );
  if (baseIdCandidate !== nameOrId) {
    const baseMatch = EQUIPMENT_CATALOG.find(
      (t) =>
        t.id === baseIdCandidate ||
        t.id.toLowerCase() === baseIdCandidate.toLowerCase() ||
        t.id.replace(
          /-(1890s|1920s|1930s|1940s|1950s|prl-1970s|prl|1980s|1990s|2000s|modern|shared)$/,
          ''
        ) === baseIdCandidate
    );
    if (baseMatch) {
      if (expectedCategory) {
        if (baseMatch.category === expectedCategory) return baseMatch;
      } else {
        return baseMatch;
      }
    }
  }

  // 2. Elastyczne dopasowanie po pełnych słowach / granicach fraz (word boundary)
  const isMundaneNeedle = /\b(bateri[aeiouy]|bateryj|battery|batteries|latark[aeiouy]|flashlight|lantern|lampa|naftow|zapałk[aeiouy]|matches|telefon|phone|notes|pióro|herbata|tea|kawa|coffee|zegarek|portfel|płaszcz|ubranie|koc|apteczk[ae]|bandaż|morfina)\b/i.test(needle);

  const candidates = EQUIPMENT_CATALOG.filter((template) => {
    // Blokada kategorii: jeśli poszukujemy narzędzia/dokumentu lub fraza wskazuje na przedmiot codzienny, ignorujemy szablony broni
    if (isMundaneNeedle && template.category === 'weapon') {
      return false;
    }
    if (expectedCategory && expectedCategory !== 'weapon' && template.category === 'weapon') {
      return false;
    }
    if (expectedCategory && expectedCategory === 'weapon' && template.category !== 'weapon') {
      return false;
    }

    const normName = normalize(template.name);
    if (matchesPhraseBoundary(needle, normName) || matchesPhraseBoundary(normName, needle)) {
      return true;
    }

    return template.aliases.some((alias) => {
      const normAlias = normalize(alias);
      if (normAlias.length < 3) return false;
      return (
        matchesPhraseBoundary(needle, normAlias) ||
        matchesPhraseBoundary(normAlias, needle)
      );
    });
  });

  if (candidates.length > 0) {
    if (expectedCategory) {
      const catMatch = candidates.find((t) => t.category === expectedCategory);
      if (catMatch) return catMatch;
    }
    return candidates[0];
  }

  return undefined;
}

export function resolveCatalogAsset(
  template: EquipmentTemplate | undefined,
  era: EquipmentVisualEra | string = '1920s'
): string | undefined {
  if (!template) return undefined;
  const visualEra = safeResolveVisualEra(era);
  // Jeśli szablon jest ściśle ograniczony do konkretnych epok, nie zwracaj assetu poza nimi
  if (template.availableIn && !template.availableIn.includes(visualEra)) {
    return undefined;
  }
  return template.assetPaths?.[visualEra];
}

/** Oznacza istniejący przedmiot jako katalogowy, nie zmieniając jego ID egzemplarza. */
export function applyCatalogTemplate(
  item: EquipmentItem,
  era: EquipmentVisualEra | string = '1920s'
): EquipmentItem {
  if (item.dossierBinding) return item;
  const isSvgOrFallback =
    !item.imageUrl ||
    item.imageUrl.endsWith('.svg') ||
    item.imageUrl.startsWith('data:image/svg+xml') ||
    item.imageUrl.includes('/predefined/') ||
    item.imageUrl.includes('/equipment/predefined/') ||
    item.visualSource === 'fallback';
  if (item.visualSource === 'generated' && !isSvgOrFallback) return item;
  const template = findEquipmentTemplate(item.templateId ?? item.name, item.category);
  if (!template) return item;

  const visualEra = safeResolveVisualEra(era);
  const eraVariantId = resolveEraEquipmentId(template.id, visualEra);
  const needle = normalize(item.templateId ?? item.name);
  const isExactNameOrIdMatch =
    template.id === (item.templateId ?? item.name) ||
    eraVariantId === (item.templateId ?? item.name) ||
    normalize(template.name) === needle ||
    template.aliases.some((a) => normalize(a) === needle);

  // Bezwzględna ochrona kategorii dla dopasowań elastycznych/rozmytych:
  // Tylko ścisłe dopasowanie po nazwie/ID/aliasie może zmienić kategorię (np. 'Skórzany bicz' na 'weapon').
  // Dopasowanie rozmyte nigdy nie przekształca narzędzia/dokumentu w broń ani odwrotnie.
  if (!isExactNameOrIdMatch) {
    if (item.category && item.category !== 'weapon' && template.category === 'weapon') {
      return item;
    }
    if (item.category && item.category === 'weapon' && template.category !== 'weapon') {
      return item;
    }
  }

  // Zabezpieczenie epokowe: jeśli szablon nie jest dostępny w tej epoce, nie narzucaj go
  if (template.availableIn && !template.availableIn.includes(visualEra)) {
    return item;
  }

  const catalogAsset = resolveCatalogAsset(template, visualEra);
  const isCustomDataImage = Boolean(
    item.imageUrl?.startsWith('data:') && !item.imageUrl.startsWith('data:image/svg+xml')
  );

  const isCatalogManaged =
    item.visualSource === 'catalog' ||
    Boolean(item.imageUrl && item.imageUrl.startsWith('/equipment/catalog/'));

  const resolvedCategory =
    isExactNameOrIdMatch || !item.category || item.category === 'personal'
      ? template.category
      : item.category;

  let resolvedImageUrl = item.imageUrl;
  if (!isCustomDataImage) {
    if (isCatalogManaged || isSvgOrFallback) {
      resolvedImageUrl = catalogAsset ?? CATEGORY_FALLBACK_ASSETS[resolvedCategory];
    }
  }

  const defaultCapacity = template.modifiers?.capacity ? Number(template.modifiers.capacity) : 6;
  const isFirearm = resolvedCategory === 'weapon' && Boolean(template.modifiers?.range || template.modifiers?.capacity);

  return {
    ...item,
    templateId: template.id,
    eraVariantId: template.category === 'document' ? undefined : eraVariantId,
    category: resolvedCategory,
    description: item.description || template.description,
    modifiers: item.modifiers ?? template.modifiers,
    value: item.value ?? template.value,
    visualSource: isCustomDataImage ? (item.visualSource ?? 'fallback') : (catalogAsset ? 'catalog' : 'fallback'),
    visualTreatment: template.visualTreatment,
    imageUrl: resolvedImageUrl ?? CATEGORY_FALLBACK_ASSETS[resolvedCategory],
    currentAmmo: item.currentAmmo ?? (isFirearm ? (item.maxAmmo ?? defaultCapacity) : undefined),
    maxAmmo: item.maxAmmo ?? (isFirearm ? defaultCapacity : undefined),
    charges: item.charges ?? (resolvedCategory === 'medical' ? (item.quantity ?? 3) : undefined),
    maxCharges: item.maxCharges ?? (resolvedCategory === 'medical' ? 3 : undefined),
    condition: item.condition ?? (resolvedCategory === 'tool' ? 'working' : 'new'),
    suggestedAction:
      item.suggestedAction ??
      (resolvedCategory === 'weapon'
        ? 'shoot'
        : resolvedCategory === 'medical'
        ? 'first_aid'
        : resolvedCategory === 'document'
        ? 'read'
        : resolvedCategory === 'artifact' || resolvedCategory === 'occult'
        ? 'study'
        : 'use_in_scene'),
    actionDeclaration:
      item.actionDeclaration ??
      (resolvedCategory === 'weapon'
        ? `Mierzę z ${item.name} i pociągam za spust.`
        : resolvedCategory === 'medical'
        ? `Wyciągam ${item.name} i opatruję ranę.`
        : resolvedCategory === 'document'
        ? `Uważnie przeglądam dokument: ${item.name}.`
        : resolvedCategory === 'artifact' || resolvedCategory === 'occult'
        ? `Przystępuję do badania artefaktu: ${item.name}.`
        : `Używam rekwizytu: ${item.name}.`),
  };
}

const DEPRECATED_EMPTY_STARTING_NAMES = new Set([
  'notes badawczy',
  'koperty na dowody',
  'notes i olowek',
  'notatnik i olowek',
  'notes z olowkiem',
  'notebook & pencil',
]);

/**
 * Sprawdza, czy przedmiot to wycofany pusty przedmiot startowy (Notes badawczy, Koperty na dowody),
 * który nie zawiera żadnej treści do przeczytania (`readableContent`) i pochodzi z wyposażenia startowego.
 */
export function isDeprecatedEmptyStartingEquipment(
  item: EquipmentItem | null | undefined
): boolean {
  if (!item || typeof item !== 'object') return false;
  if (typeof item.readableContent === 'string' && item.readableContent.trim().length > 0) {
    return false;
  }
  if (item.source && item.source !== 'starting') {
    return false;
  }
  if (item.id === 'eq_notes' || item.id === 'eq_envelopes') {
    return true;
  }
  if (typeof item.name === 'string') {
    const normalizedName = normalize(item.name).replace(/ł/g, 'l');
    if (DEPRECATED_EMPTY_STARTING_NAMES.has(normalizedName)) {
      return true;
    }
  }
  return false;
}

/** Lekka, idempotentna migracja zapisów sprzed `templateId` i `visualSource`. */
export function migrateEquipmentCatalog(
  items: EquipmentItem[] | undefined,
  era: EquipmentVisualEra | string = '1920s'
): EquipmentItem[] | undefined {
  const visualEra = safeResolveVisualEra(era);
  return items
    ?.filter((item) => !isDeprecatedEmptyStartingEquipment(item))
    .map((item) => applyCatalogTemplate(item, visualEra));
}

export function isCatalogEquipment(item: EquipmentItem): boolean {
  if (item.visualSource === 'generated') return false;
  if (item.visualSource === 'catalog') return true;
  return Boolean(item.templateId && findEquipmentTemplate(item.templateId));
}
