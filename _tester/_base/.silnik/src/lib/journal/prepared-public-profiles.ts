import { resolveCanonicalAdventureLocation } from '@/lib/canonical-adventure-location';
import { resolveNpcPublicProfile } from '@/lib/npc-public-profile';
import { resolvePreparedAdventureVisual } from '@/lib/immersion/prepared-adventure-visuals';

export interface PreparedPublicProfile {
  description: string;
  imageUrl?: string;
}

// Only the visible setting of a visited place. Never copy scene hooks, exits, clues or hidden rooms.
const places: Record<string, Record<string, Record<'pl' | 'en', string>>> = {
  'cien-nad-prabutami': {
    'loc-warszawa-redakcja': { pl: 'Gabinet i montażownia w gmachu Telewizji Polskiej przy ulicy Woronicza w Warszawie.', en: 'An editorial office and editing room in the Polish Television building on Woronicza Street in Warsaw.' },
    'loc-elblag-klasztor': { pl: 'Klasztor franciszkanów w Elblągu.', en: 'The Franciscan monastery in Elbląg.' },
    'loc-prabuty-wykopaliska': { pl: 'Ruiny kościoła i teren wykopalisk w Prabutach.', en: 'The church ruins and excavation site in Prabuty.' },
    'loc-msw-warszawa': { pl: 'Gmach Ministerstwa Spraw Wewnętrznych w Warszawie.', en: 'The Ministry of Internal Affairs building in Warsaw.' },
    'loc-prabuty-krypta': { pl: 'Krypta pod kościołem w Prabutach.', en: 'The crypt beneath the church in Prabuty.' },
  },
  'englewood-murder-castle-1893': {
    'loc-chicago-precinct': { pl: 'Ceglany komisariat policji w dzielnicy Englewood w Chicago.', en: 'A brick police station in Chicago’s Englewood district.' },
    'loc-castle-pharmacy': { pl: 'Apteka na parterze budynku Holmesa przy 63rd i Wallace Street.', en: 'The ground-floor pharmacy in Holmes’s building at 63rd and Wallace Street.' },
    'loc-castle-second-floor': { pl: 'Korytarze i pokoje na piętrze budynku Holmesa.', en: 'The upstairs corridors and rooms of Holmes’s building.' },
    'loc-quinlan-quarters': { pl: 'Mieszkanie dozorcy od strony dziedzińca.', en: 'The caretaker’s rooms facing the courtyard.' },
    'loc-castle-basement': { pl: 'Piwnica z ceglanym piecem pod budynkiem Holmesa.', en: 'A cellar with a brick kiln beneath Holmes’s building.' },
  },
};

/** Call only for an already known public card; this function never enumerates the prepared cast. */
export function resolvePreparedPublicProfile(
  adventureId: string | undefined,
  kind: 'person' | 'place',
  reference: string,
  locale: 'pl' | 'en'
): PreparedPublicProfile | null {
  if (kind === 'person') {
    const person = resolveNpcPublicProfile(adventureId, reference, locale);
    return person ? { description: person.description, imageUrl: person.portraitUrl } : null;
  }
  const place = resolveCanonicalAdventureLocation(adventureId, reference);
  const description = adventureId && place && places[adventureId]?.[place.locationId]?.[locale];
  if (!description || !place) return null;
  const visual = resolvePreparedAdventureVisual(adventureId, { type: 'location', locationName: place.nodeId ?? place.locationId, prompt: '' }, place.nodeId, true);
  return { description, imageUrl: visual?.imageUrl };
}
