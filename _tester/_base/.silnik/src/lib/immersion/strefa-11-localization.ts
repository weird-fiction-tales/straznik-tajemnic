import type { AdventureContext } from '@/lib/adventures-data';
import type { PredefinedCharacter } from './predefined-characters';

type Locale = string;

type AdventureTranslation = Pick<
  AdventureContext,
  | 'title'
  | 'eraLabel'
  | 'location'
  | 'country'
  | 'themes'
  | 'suggestedOccupations'
  | 'hook'
  | 'description'
  | 'source'
  | 'externalLinks'
  | 'investigatorIntro'
  | 'initialWeather'
  | 'settingTrivia'
>;

const EN_ADVENTURES: Record<string, AdventureTranslation> = {
  'nawiedzony-dom': {
    title: 'The Haunting',
    eraLabel: '1920s (USA)',
    location: 'Boston, Massachusetts',
    country: 'USA',
    themes: ['Haunted House', 'Crime of the Past', 'Mythos Cult', 'Archival Investigation'],
    suggestedOccupations: ['Private Investigator', 'Journalist', 'Antiquarian', 'Doctor', 'Professor'],
    hook: 'Mr. Steven Knott hires the Investigators to inspect the Corbitt House in central Boston, whose sinister reputation prevents finding tenants.',
    description:
      'A classic scenario from the Call of Cthulhu 7e Starter Set. The Investigators look into the mystery of the Corbitt estate, uncovering the dark trial of the past, the Chapel of Contemplation cult, and the undead sorcerer Walter Corbitt resting in the cellar.',
    investigatorIntro:
      "May 1920, Boston. In client Steven Knott's office, he lays before you the brass keys to the townhouse on an old cobblestone street. The tragedy of the Macario family has driven away all tenants; your task is to discover the truth and clear the building's reputation.",
    initialWeather: 'Chilly, damp Boston morning with harbor mist rising over Massachusetts Bay',
    settingTrivia: [
      '1920s Boston is a city of sharp contrasts: modern steel-frame offices tower beside gloomy red-brick Victorian tenements.',
      'The Boston Globe morgue in the newspaper cellar holds thousands of unpublished crime files.',
      'The Chapel of Contemplation was burned down during a secret Boston Police raid in 1912.',
    ],
    source: 'Call of Cthulhu 7e Starter Set',
  },
  'cien-nad-prabutami': {
    title: "Shadow over Prabuty: Father Klimuszko's Vision",
    eraLabel: "People's Poland - 1970s",
    location: 'Warsaw - Elbląg - Prabuty',
    country: 'Poland',
    themes: ['Clairvoyance', 'Security Service', 'War trauma', 'Four dimensions'],
    suggestedOccupations: ['Journalist', 'Parapsychologist', 'Exorcist', 'Militia officer'],
    hook: "Investigating Father Klimuszko's phenomena leads the investigators to secret Security Service files and a dimensional anomaly in Prabuty.",
    description:
      'The investigators are recruited by Helena Krawczyk, producer of the television programme "Signals from the Unknown", following the International Psychotronics Congress in Prague. Their task is to scientifically verify the extraordinary phenomena of Father Klimuszko - a Franciscan friar from Elbląg who locates the missing from photographs alone. The investigation quickly collides with secret Security Service operations, unveiling a horrifying truth regarding wartime trauma from 1941 and the fourth dimension of time.',
    source: 'Strefa 11 / Beyond Belief',
    externalLinks: [
      { label: 'Wikipedia (Beyond Belief)', url: 'https://pl.wikipedia.org/wiki/Nie_do_wiary' },
      { label: 'Filmweb (Beyond Belief)', url: 'https://www.filmweb.pl/serial/Nie+do+wiary-1996-161405' },
      { label: 'Official Player.pl TVN', url: 'https://player.pl' },
    ],
  },
  'tajemnica-pendnika-lagiewki': {
    title: 'The Drive Mystery: A Brilliant Inventor from Kowary',
    eraLabel: '1990s',
    location: 'Kowary - Karkonosze Mountains',
    country: 'Poland',
    themes: ['Brilliant invention', 'Kinetic absorber', 'Secret AOR agents', 'Mi-Go technology'],
    suggestedOccupations: ['Engineer', 'Investigative journalist', 'Test driver', 'Physicist'],
    hook: "Łągiewka's bumper eliminates collision forces, but his Drive breaks the laws of physics using forbidden Mi-Go technology.",
    description:
      'The investigators uncover the unconventional discoveries of Lucjan Łągiewka - a constructor from Kowar whose kinetic bumpers and rotary absorbers eliminate impact shock during collisions. When he invents the "Drive" - an inertia engine defying known physical laws without traction in vacuum - secret AOR agents arrive at his workshop. His invention is an attempt to harness kinetic Mi-Go technology from the Mountains of Madness.',
    source: 'Strefa 11 / Beyond Belief',
    externalLinks: [
      { label: 'Wikipedia (Beyond Belief)', url: 'https://pl.wikipedia.org/wiki/Nie_do_wiary' },
      { label: 'Filmweb (Beyond Belief)', url: 'https://www.filmweb.pl/serial/Nie+do+wiary-1996-161405' },
      { label: 'Official Player.pl TVN', url: 'https://player.pl' },
    ],
  },
  'tajemnica-dzieci-z-traszyna': {
    title: 'The Children of Traszyn: The Key and the Inverted Cross',
    eraLabel: '1990s (Y2K)',
    location: 'Traszyn, near Lublin',
    country: 'Poland',
    themes: ['Seance with a book and a key', 'Night paralysis', 'Poltergeist', 'Exorcisms'],
    suggestedOccupations: ['Psychologist', 'Ethnographer', 'Dowser / bioenergy therapist', 'Forester'],
    hook: 'In 1983, three children summoned a spirit in a barn. Sixteen years later it returns with a lightning strike and a scorched inverted cross.',
    description:
      'The investigators are summoned by local parapsychologist and bioenergy therapist Tomasz Nowicki to the secluded village of Traszyn near Lublin. In 1983, three children conducted a seance with a book and a key in an old barn. Sixteen years later, the entity returns, tormenting the adult victims with sleep paralysis, spectral manifestations, and a scorched inverted cross left by lightning. The investigators face an ancient entity from subterranean realms.',
    source: 'Strefa 11 / Beyond Belief',
    externalLinks: [
      { label: 'Wikipedia (Beyond Belief)', url: 'https://pl.wikipedia.org/wiki/Nie_do_wiary' },
      { label: 'Filmweb (Beyond Belief)', url: 'https://www.filmweb.pl/serial/Nie+do+wiary-1996-161405' },
      { label: 'Official Player.pl TVN', url: 'https://player.pl' },
    ],
  },
  'przybysz-z-matriksa-glogow': {
    title: 'The Visitor from the Matrix: Prophecy and the Głogów Phenomenon',
    eraLabel: 'Turn of the Millennium',
    location: 'Głogów - Legnica',
    country: 'Poland',
    themes: ['VHS signal', 'Time anomaly', 'Broadcasts from the future', 'Fortress tunnels'],
    suggestedOccupations: ['Y2K programmer', 'TV journalist', 'Radio amateur', 'Detective'],
    hook: 'A radio amateur records broadcasts from the future and a disrupted signal from the night of 14 November. An entity beneath the fortress manipulates time.',
    description:
      'The investigators arrive in Głogów after a series of inexplicable phenomena recorded on VHS tapes by a local radio amateur. Witnesses report night flashes of light, memory loss, and television broadcasts transmitted from the future. The inquiry leads through covert intelligence attempts to seize the tapes and into the abandoned underground of Głogów Fortress, where an ancient entity manipulates the currents of time.',
    source: 'Strefa 11 / Beyond Belief',
    externalLinks: [
      { label: 'Wikipedia (Beyond Belief)', url: 'https://pl.wikipedia.org/wiki/Nie_do_wiary' },
      { label: 'Filmweb (Beyond Belief)', url: 'https://www.filmweb.pl/serial/Nie+do+wiary-1996-161405' },
      { label: 'Official Player.pl TVN', url: 'https://player.pl' },
    ],
  },
};

const EN_CHARACTER_OCCUPATIONS: Record<string, string> = {
  strefa11_tomasz_nowicki: 'Investigative Journalist / Host',
  strefa11_helena_krawczyk: 'Television Producer',
  strefa11_barbara_zawadzka: 'Ethnographer / Parapsychologist',
  strefa11_ryszard_klucznik: 'Former Security Service Officer / Protection Specialist',
  pednik_inzynier: 'Mechanical Engineer',
  pednik_kierowca: 'Test Driver',
  pednik_dziennikarka: 'Investigative Journalist',
  pednik_fizyk: 'Physicist',
  traszyn_egzorcysta: 'Exorcist',
  traszyn_terapeuta: 'Bioenergy Therapist',
  traszyn_psycholog: 'Psychologist',
  traszyn_etnografka: 'Ethnographer',
  glogow_detektyw: 'Private Detective',
  glogow_haker: 'Hacker',
  glogow_psychiatra: 'Psychiatrist',
  glogow_ufolog: 'Ufologist',
};

export function localizeAdventure<T extends { id?: string }>(
  adventure: T,
  locale: Locale
): T {
  const translation =
    locale === 'en' && adventure.id ? EN_ADVENTURES[adventure.id] : undefined;
  return translation ? { ...adventure, ...translation } : adventure;
}

export const localizeStrefa11Adventure = localizeAdventure;

export function localizeStrefa11Character(
  character: PredefinedCharacter,
  locale: Locale
): PredefinedCharacter {
  if (locale !== 'en') return character;
  const occupation = locale === 'en' ? EN_CHARACTER_OCCUPATIONS[character.id] : undefined;
  // The ID is retained solely as display provenance. It lets CharacterSheet
  // select dictionary text without altering the persisted rules data.
  return { ...character, ...(occupation ? { occupation } : {}), sourcePresetId: character.id };
}
