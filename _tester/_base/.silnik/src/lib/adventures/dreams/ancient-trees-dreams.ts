/**
 * Dedykowany moduł Sennych Wezwań dla scenariusza "Pośród Pradawnych Drzew" (Amidst the Ancient Trees)
 * Źródło: Zew Cthulhu - Księga Strażnika 7e RAW (rozdz. 15.1, druk. s. 394-413, pomoce s. 411).
 *
 * Inwariant: Sny nie są przedmiotami ani handoutami do ekwipunku ze stanem zdobyty/niezdobyty.
 * Są to barwne, diegetyczne wizje prezentowane w oknie czatu i rozliczane mechanicznie przez silnik.
 */

export interface DreamCallVariant {
  id: 'restless-night' | 'dark-cabin' | 'forest-path' | 'thing-in-lake';
  slug: string;
  number: 1 | 2 | 3 | 4;
  titlePl: string;
  titleEn: string;
  narrativePl: string;
  narrativeEn: string;
  /**
   * Warunek dopuszczenia wariantu do losowania.
   * Wariant 1 (Niespokojna noc) pojawia się wyłącznie w Noc 1.
   * W Noc 2 losowane są wyłącznie warianty 2, 3 i 4.
   */
  allowedNights: (1 | 2)[];
  /**
   * Mechaniczne skutki snu rozliczane deterministycznie.
   */
  mechanicalResolution: {
    sanityCheckRequired: boolean;
    sanityLossFormula?: '1/1d6' | '1d3/1d10';
    conPenaltyDice?: boolean; // Jedna kość karna do testów Kondycji przez kolejny dzień
    subsequentTriggerLocation?: string; // Np. chata Turnera lub rozwidlenie ścieżek Dnia 3
    subsequentSanityLossFormula?: '0/1' | '1/1d6';
  };
}

export const ANCIENT_TREES_DREAM_VARIANTS: Record<string, DreamCallVariant> = {
  'restless-night': {
    id: 'restless-night',
    slug: 'posrod-pradawnych-drzew-senne-wezwania-1',
    number: 1,
    titlePl: 'Senne Wezwania 1: Niespokojna noc',
    titleEn: 'Dream Pull 1: Restless Night',
    narrativePl:
      'Ciemne pnie pradawnych drzew kołyszą się w chorobliwym bezruchu nocy. Pożółkłe, martwe liście opadają bezszelestnie, a z gęstwiny bije lodowaty chłód obcej uwagi. Coś nienazwanego czuwa pośród gałęzi i cierpliwie na ciebie czeka.',
    narrativeEn:
      'Dark trunks of ancient trees sway in the morbid stillness of the night. Jaundiced, dead leaves fall silently, and an icy chill of alien attention emanates from the thicket. Something unnamed watches among the branches and patiently waits for you.',
    allowedNights: [1],
    mechanicalResolution: {
      sanityCheckRequired: false,
      conPenaltyDice: true, // Kość karna do Kondycji do następnego snu
    },
  },
  'dark-cabin': {
    id: 'dark-cabin',
    slug: 'posrod-pradawnych-drzew-senne-wezwania-2',
    number: 2,
    titlePl: 'Senne Wezwania 2: Chata w ciemnościach',
    titleEn: 'Dream Pull 2: Cabin in the Dark',
    narrativePl:
      'Rozpadająca się chata z gnijących bali majaczy w leśnym półmroku. Przez wybite okna dostrzegasz blade, zastygłe sylwetki naznaczone ciemnozielonym śladem rozkładu. Ich martwe spojrzenia zwracają się ku tobie, niemo nakazując ci uległość i posłuszeństwo.',
    narrativeEn:
      'A crumbling log cabin looms in the forest twilight. Through broken windows you glimpse pale, frozen figures marked with dark green signs of decay. Their dead gazes turn toward you, mutely commanding subservience and obedience.',
    allowedNights: [1, 2],
    mechanicalResolution: {
      sanityCheckRequired: true,
      sanityLossFormula: '1/1d6',
      subsequentTriggerLocation: 'loc-turner-cabin',
      subsequentSanityLossFormula: '1/1d6',
    },
  },
  'forest-path': {
    id: 'forest-path',
    slug: 'posrod-pradawnych-drzew-senne-wezwania-3',
    number: 3,
    titlePl: 'Senne Wezwania 3: Ścieżka przez las',
    titleEn: 'Dream Pull 3: Path Through the Woods',
    narrativePl:
      'Wąska, zarośnięta ścieżka wije się pośród martwej leśnej ciszy. Na horyzoncie majaczy żółtawy, nienaturalny odblask odległej tafli wody, odbijający obce światło. Nagle twoją klatkę piersiową przeszywa dotkliwe, metaliczne ukłucie.',
    narrativeEn:
      'A narrow, overgrown path winds through dead forest silence. On the horizon flickers a sickly yellowish reflection of distant water, mirroring alien light. Suddenly a sharp, metallic puncture pierces your chest.',
    allowedNights: [1, 2],
    mechanicalResolution: {
      sanityCheckRequired: false,
      subsequentTriggerLocation: 'loc-forest-fork',
      subsequentSanityLossFormula: '0/1',
    },
  },
  'thing-in-lake': {
    id: 'thing-in-lake',
    slug: 'posrod-pradawnych-drzew-senne-wezwania-4',
    number: 4,
    titlePl: 'Senne Wezwania 4: Coś w jeziorze',
    titleEn: 'Dream Pull 4: Something in the Lake',
    narrativePl:
      'Stoisz nad brzegiem czarnego, oleistego jeziora. Pod gładką taflą wody poruszają się wici zwieńczone nieludzkimi oczami, a z głębin wyłaniają się ostre, metaliczne kolce. Z toni dobiega hipnotyczny, miażdżący zmysły nakaz zanurzenia się w otchłań.',
    narrativeEn:
      'You stand at the shore of a black, oily lake. Beneath the smooth surface move tendrils tipped with inhuman eyes, and sharp metallic spines emerge from the depths. A hypnotic, mind-crushing summons rises from the abyss, compelling you to step into the deep.',
    allowedNights: [1, 2],
    mechanicalResolution: {
      sanityCheckRequired: true,
      sanityLossFormula: '1d3/1d10',
    },
  },
};

/**
 * Zwraca warianty dozwolone dla danej nocy.
 */
export function getAvailableDreamVariantsForNight(night: 1 | 2): DreamCallVariant[] {
  return Object.values(ANCIENT_TREES_DREAM_VARIANTS).filter((v) =>
    v.allowedNights.includes(night)
  );
}

/**
 * Deterministyczny selektor wariantu snu w zależności od nocy i seeda/losowania.
 */
export function selectDreamVariantForNight(
  night: 1 | 2,
  randomIndex?: number
): DreamCallVariant {
  const available = getAvailableDreamVariantsForNight(night);
  const idx =
    typeof randomIndex === 'number' && randomIndex >= 0 && randomIndex < available.length
      ? randomIndex
      : Math.floor(Math.random() * available.length);
  return available[idx];
}
