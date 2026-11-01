import { resolveAdventureOpening, isAdventureOpeningValid, buildAdventureOpeningDirective } from './adventure-opening';
import { STREFA_11_ADVENTURES } from './adventures-data';
import { deriveSceneSensoryMemoryFromMessages } from './world-engine/adapter';

const adventure = STREFA_11_ADVENTURES.find(a => a.id === 'cien-nad-prabutami')!;

describe('dossier opening contract', () => {
  it('selects intro even when it is not the first array entry and the active node is elsewhere', () => {
    const nodes = adventure.graph!.nodes!;
    expect(resolveAdventureOpening({ ...adventure, graph: { ...adventure.graph!, nodes: [nodes[1], nodes[0]] } }))
      .toMatchObject({ nodeId: 'node-warszawa-redakcja', locationId: 'loc-warszawa-redakcja', npcNames: ['Helena Krawczyk', 'dr Jarosław Skrzyński'] });
  });
  it('uses the first dossier node when no intro is marked', () => {
    expect(resolveAdventureOpening({ graph: { ...adventure.graph!, nodes: adventure.graph!.nodes!.slice(1) } })?.nodeId)
      .toBe('node-elblag-klasztor');
  });
  it('keeps compatibility with an unstructured adventure', () => {
    expect(resolveAdventureOpening({})).toBeNull();
    expect(resolveAdventureOpening(null)).toBeNull();
  });
  it('hydrates the header location from the full canonical opening tag, without its atmosphere', () => {
    const opening = resolveAdventureOpening(adventure)!;
    const text = `[LOKACJA: ${opening.location} | Paper and tobacco.]`;
    const result = deriveSceneSensoryMemoryFromMessages([{ role: 'assistant', content: text }]);
    expect(result.currentLocation).toBe(opening.location);
  });
  it.each(['pl', 'en'] as const)('%s: requires exactly one canonical location tag, without leaking secrets', locale => {
    const opening = resolveAdventureOpening(adventure)!;
    const tag = locale === 'en' ? 'LOCATION' : 'LOKACJA';
    const valid = `[${tag}: ${opening.location} | Dym i stukot maszyn.] Helena waits.`;
    expect(isAdventureOpeningValid(valid, opening)).toBe(true);
    expect(isAdventureOpeningValid(`[${tag}: ${opening.location}: Dym.]`, opening)).toBe(true);
    expect(isAdventureOpeningValid(`[${tag}: Klasztor św. Pawła w Elblągu | Fog.]`, opening)).toBe(false);
    expect(isAdventureOpeningValid('No location tag', opening)).toBe(false);
    expect(isAdventureOpeningValid(`${valid} [${tag}: Elbląg | Fog.]`, opening)).toBe(false);
    for (const transition of ['ZMIANA_SCENY', 'SCENE_CHANGE', 'KARTA_SCENY', 'SCENE_CARD']) {
      expect(isAdventureOpeningValid(`${valid} [${transition}: Elbląg]`, opening)).toBe(false);
      expect(isAdventureOpeningValid(`${valid} [${transition}]Elbląg[/${transition}]`, opening)).toBe(false);
    }
    expect(isAdventureOpeningValid(`[${tag}: ${opening.location} - Elbląg | Fog.]`, opening)).toBe(false);
    const directive = buildAdventureOpeningDirective(opening, locale);
    expect(directive).toContain(opening.location);
    expect(directive).not.toContain(adventure.truthAnchor!.culprit);
  });
});
