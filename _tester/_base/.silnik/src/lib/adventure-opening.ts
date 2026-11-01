import type { AdventureGraph } from './types';

export interface AdventureOpening {
  nodeId: string;
  locationId?: string;
  location: string;
  description: string;
  atmosphere: string;
  npcNames: string[];
}

/** A fresh game starts at the dossier intro, never at a previously active node. */
export function resolveAdventureOpening(
  adventure: { graph?: AdventureGraph } | null | undefined
): AdventureOpening | null {
  const graph = adventure?.graph;
  const node = graph?.nodes?.find(candidate => candidate.type === 'intro') ?? graph?.nodes?.[0];
  if (!node) return null; // Older, unstructured scenarios keep their existing start flow.
  return {
    nodeId: node.id,
    locationId: node.locationId,
    location: node.name,
    description: node.description,
    atmosphere: node.atmosphere ?? '',
    npcNames: (node.npcIds ?? []).flatMap(id => {
      const npc = graph?.npcs?.find(candidate => candidate.id === id);
      return npc ? [npc.name] : [];
    }),
  };
}

export function buildAdventureOpeningDirective(opening: AdventureOpening, locale: 'pl' | 'en'): string {
  const tag = locale === 'en' ? 'LOCATION' : 'LOKACJA';
  return locale === 'en'
    ? `\n## MANDATORY OPENING SCENE\nThe engine has selected the first dossier node: ${opening.nodeId}.\nLocation: ${opening.location}\nScene: ${opening.description}\nAtmosphere: ${opening.atmosphere}\nPresent NPCs: ${opening.npcNames.join(', ')}\nBegin and remain in this scene. Do not skip it, invent prior travel or move the investigators to another node. Other places in the scenario are future destinations, not the starting point. General weather must not relocate the scene. Narrate in English, but copy this canonical place name verbatim in the single required tag: [${tag}: ${opening.location} | atmosphere]. Do not emit any other location tag. End by asking the players what they do.\n`
    : `\n## OBOWIĄZKOWA SCENA OTWARCIA\nSilnik wybrał pierwszy węzeł teczki: ${opening.nodeId}.\nMiejsce: ${opening.location}\nScena: ${opening.description}\nAtmosfera: ${opening.atmosphere}\nObecni NPC: ${opening.npcNames.join(', ')}\nZacznij i pozostań w tej scenie. Nie pomijaj jej, nie dopisuj odbytej podróży i nie przenoś badaczy do innego węzła. Pozostałe miejsca scenariusza to przyszłe cele, a nie punkt startu. Ogólna pogoda nie może zmieniać miejsca sceny. Skopiuj kanoniczną nazwę miejsca dokładnie w jedynym wymaganym tagu: [${tag}: ${opening.location} | atmosfera]. Nie emituj żadnego innego tagu lokacji. Zakończ pytaniem o działanie graczy.\n`;
}

/** Validate the complete draft before SSE, TTS, journal or campaign memory can consume it. */
export function isAdventureOpeningValid(text: string, opening: AdventureOpening): boolean {
  if (/\[(?:ZMIANA_SCENY|SCENE_CHANGE|KARTA_SCENY|SCENE_CARD)\b/i.test(text)) return false;
  const tags = [...text.matchAll(/\[(?:LOKACJA|LOCATION):\s*([^\]]*)\]/gi)];
  if (tags.length !== 1) return false;
  const payload = tags[0][1].trim();
  return payload === opening.location ||
    payload.startsWith(`${opening.location} |`) ||
    payload.startsWith(`${opening.location}:`);
}
