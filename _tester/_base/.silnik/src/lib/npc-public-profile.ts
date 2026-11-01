export interface NpcPublicProfile {
  id: string;
  name: string;
  description: string;
  portraitUrl?: string;
  aliases: readonly string[];
}

interface PreparedNpc extends Omit<NpcPublicProfile, 'description'> {
  description: Record<'pl' | 'en', string>;
}

// Deliberately public introductions, not a projection of NPC dossiers or their secrets.
const profiles: Record<string, readonly PreparedNpc[]> = {
  'cien-nad-prabutami': [
    { id: 'npc-helena-krawczyk', name: 'Helena Krawczyk', aliases: ['Helena', 'Krawczyk', 'redaktorka Helena'],
      description: { pl: 'Redaktorka programu „Sygnały Nieznanego” w Telewizji Polskiej.', en: 'Editor of the Polish Television programme “Signals of the Unknown”.' },
      portraitUrl: '/adventure-packs/cien-nad-prabutami/npc-helena-krawczyk.png' },
    { id: 'npc-jaroslaw-skrzynski', name: 'dr Jarosław Skrzyński', aliases: ['Jarosław', 'Skrzyński', 'dr Skrzyński', 'doktor Skrzyński'],
      description: { pl: 'Konsultant naukowy zajmujący się bioelektroniką i psychotroniką.', en: 'Scientific consultant specialising in bioelectronics and psychotronics.' },
      portraitUrl: '/adventure-packs/cien-nad-prabutami/npc-jaroslaw-skrzynski.png' },
    { id: 'npc-klimuszko', name: 'Ojciec Andrzej Czesław Klimuszko', aliases: ['Klimuszko', 'Ojciec Klimuszko', 'Andrzej Czesław Klimuszko'],
      description: { pl: 'Franciszkanin i zielarz z Elbląga, znany z opowieści o jasnowidzeniu.', en: 'Franciscan friar and herbalist from Elbląg, known for accounts of clairvoyance.' },
      portraitUrl: '/adventure-packs/cien-nad-prabutami/npc-ojciec-klimuszko.webp' },
    { id: 'npc-tadeusz-polak', name: 'Tadeusz Polak', aliases: ['Tadeusz', 'Polak'],
      description: { pl: 'Sędziwy kościelny i grabarz z Prabut.', en: 'An elderly sexton and gravedigger from Prabuty.' },
      portraitUrl: '/adventure-packs/cien-nad-prabutami/npc-tadeusz-polak.png' },
    { id: 'npc-edward-majewski', name: 'Generał Edward Majewski', aliases: ['Edward Majewski', 'Majewski', 'generał Majewski', 'General Edward Majewski'],
      description: { pl: 'Wysoki oficer Ministerstwa Spraw Wewnętrznych.', en: 'A senior officer of the Ministry of Internal Affairs.' },
      portraitUrl: '/adventure-packs/cien-nad-prabutami/npc-edward-majewski.png' },
  ],
  'englewood-murder-castle-1893': [
    { id: 'npc-inspector-shea', name: 'Inspector John Shea', aliases: ['Shea', 'Inspector Shea', 'John Shea', 'Inspector John Shea (Chicago Police)'],
      description: { pl: 'Doświadczony inspektor policji w Chicago.', en: 'A veteran inspector with the Chicago Police.' },
      portraitUrl: '/adventure-packs/englewood-murder-castle-1893/npc-inspector-shea.png' },
    { id: 'npc-horace-gary', name: 'Horace Gary', aliases: ['Gary', 'Horace', 'Horace Gary (Fidelity Mutual Counsel)'],
      description: { pl: 'Prawnik towarzystwa ubezpieczeniowego Fidelity Mutual z Filadelfii.', en: 'A Philadelphia attorney representing Fidelity Mutual Insurance.' },
      portraitUrl: '/adventure-packs/englewood-murder-castle-1893/npc-horace-gary.png' },
    { id: 'npc-charles-chappell', name: 'Charles Chappell', aliases: ['Charles', 'Chappell', 'Charles Chappell (Articulator & Clerk)'],
      description: { pl: 'Blady, nerwowy technik pracujący dla Holmesa.', en: 'A pale, nervous technician who worked for Holmes.' },
      portraitUrl: '/adventure-packs/englewood-murder-castle-1893/npc-charles-chappell.png' },
    { id: 'npc-pat-quinlan', name: 'Pat Quinlan', aliases: ['Pat', 'Quinlan', 'Pat Quinlan (The Castle Caretaker)'],
      description: { pl: 'Wychudzony dozorca budynku w Englewood.', en: 'The gaunt caretaker of the Englewood building.' },
      portraitUrl: '/adventure-packs/englewood-murder-castle-1893/npc-pat-quinlan.png' },
    { id: 'npc-emeline-echo', name: 'Emeline Cigrand', aliases: ['Emeline', 'Cigrand', 'Dimensional Echo of Emeline Cigrand'],
      description: { pl: 'Emeline Cigrand, dawna stenografka Holmesa.', en: 'Emeline Cigrand, a former stenographer employed by Holmes.' },
      portraitUrl: '/adventure-packs/englewood-murder-castle-1893/npc-emeline-echo.png' },
  ],
};

function normalize(reference: string): string {
  return reference.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/gi, 'l')
    .toLowerCase().replace(/[.]/g, '').replace(/\s+/g, ' ').trim();
}

/** Exact, unambiguous aliases within one adventure. Calling this does not establish that an NPC was met. */
export function resolveNpcPublicProfile(
  adventureId: string | undefined,
  reference: string,
  locale: 'pl' | 'en' = 'pl',
  npcs: readonly { id?: string; name: string; portraitUrl?: string }[] = []
): NpcPublicProfile | null {
  const query = normalize(reference);
  if (!adventureId || !query) return null;
  const matches = (profiles[adventureId] ?? []).filter(profile =>
    [profile.id, profile.name, ...profile.aliases].some(alias => normalize(alias) === query));
  const candidates = npcs.map(npc => {
    const name = normalize(npc.name).replace(/^(?:dr|doktor|doctor|prof|profesor|inspector|det|detektyw|ojciec|father)\s+/, '');
    return { ...npc, aliases: [npc.name, name, name.split(' ')[0], ...(npc.id ? [npc.id] : [])] };
  });
  if (matches.length === 1) {
    const profile = matches[0];
    const fullIdentity = [profile.id, profile.name].some(name => normalize(name) === query);
    if (!fullIdentity && candidates.some(npc => npc.aliases.some(alias => normalize(alias) === query) &&
      npc.id !== profile.id && normalize(npc.name) !== normalize(profile.name))) return null;
    return { ...profile, aliases: [...profile.aliases], description: profile.description[locale] };
  }
  if (matches.length > 1) return null;
  const exact = candidates.filter(npc => normalize(npc.name) === query || npc.id === reference);
  const found = exact.length ? exact : candidates.filter(npc => npc.aliases.some(alias => normalize(alias) === query));
  if (found.length !== 1) return null;
  const npc = found[0];
  return { id: npc.id ?? npc.name, name: npc.name, aliases: npc.aliases, portraitUrl: npc.portraitUrl, description: '' };
}
