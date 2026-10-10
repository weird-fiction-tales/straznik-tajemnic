/**
 * buildHandoutsContext - sekcja promptu z realnymi handoutami aktywnej przygody
 * (DriveThruRPG: mapy/dokumenty w public/handouts/).
 *
 * Scoping per rozdział i lokacja, bezpieczeństwo materiałów Strażnika (keeperOnly),
 * oraz deterministyczne instrukcje tagu [HANDOUT:<slug>].
 *
 * Pure function, bez side effects. Pusty string gdy przygoda nie ma handoutów ani zagadek.
 */
import { getAdventureById, type AdventureHandout, type AdventurePuzzle } from '@/lib/adventures-data';

export interface BuildHandoutsContextOptions {
  adventureId?: string;
  activeChapterId?: string | number | null;
  activeLocationId?: string | null;
  activeNodeId?: string | null;
  currentLocation?: string | null;
}

function normalizeString(val: string | number | null | undefined): string {
  if (val == null) return '';
  return String(val).trim().toLowerCase();
}

function matchesChapter(
  handoutChapter?: string,
  activeChapter?: string | number | null
): boolean {
  if (activeChapter == null || activeChapter === '') return true;
  if (!handoutChapter) return true; // Handout globalny dla całej przygody

  const hNorm = normalizeString(handoutChapter);
  const aNorm = normalizeString(activeChapter);

  if (hNorm === aNorm) return true;

  // Porównanie cyfr dla formatów np. "Rozdział 1" vs "1" lub "akt-2" vs 2
  const hDigits = hNorm.replace(/\D/g, '');
  const aDigits = aNorm.replace(/\D/g, '');
  if (hDigits && aDigits && hDigits === aDigits) return true;

  // Dopasowanie częściowe np. "chapter-1" zawiera "1"
  if (hNorm.includes(aNorm) || aNorm.includes(hNorm)) return true;

  return false;
}

function nodeLocationNames(adventureId: string, nodeId: string): string[] {
  const graph = getAdventureById(adventureId)?.graph;
  const node = graph?.nodes?.find(entry => entry.id === nodeId);
  if (!node) return [];
  const location = graph?.locations.find(entry => entry.id === node.locationId);
  // Parenthetical addresses are descriptions, not part of the <=45-character location tag.
  const shortName = node.name.replace(/\s*\([^)]*\)/g, '').trim();
  return [node.id, node.name, location?.id, location?.name,
    shortName.length <= 45 ? shortName : undefined].filter((name): name is string => Boolean(name));
}

function matchesLocation(
  handout: AdventureHandout,
  options?: BuildHandoutsContextOptions
): boolean {
  // Audio evidence requires the exact physical node; unknown nodes fail closed.
  if (handout.audioUrl || handout.audioUrlPl || handout.audioUrlEn) {
    const nodeId = normalizeString(handout.nodeId);
    if (!nodeId) return false;
    const currentLocation = normalizeString(options?.currentLocation);
    if (currentLocation) {
      const adventureId = options?.adventureId;
      if (!adventureId) return false;
      const nodes = getAdventureById(adventureId)?.graph?.nodes || [];
      const matches = nodes.filter(node =>
        nodeLocationNames(adventureId, node.id).some(name => normalizeString(name) === currentLocation)
      );
      // Never keep offering evidence from a stale starting node after travel.
      return matches.length === 1 && normalizeString(matches[0].id) === nodeId;
    }
    return nodeId === normalizeString(options?.activeNodeId);
  }

  // Handout bez ograniczeń lokacji/węzła jest globalny
  if (!handout.locationId && !handout.nodeId) return true;

  const currentLoc = normalizeString(options?.currentLocation);
  const activeLocId = normalizeString(options?.activeLocationId);
  const activeNodeId = normalizeString(options?.activeNodeId);

  // Jeśli opcje nie definiują żadnej lokacji/węzła, nie filtrujemy po lokacji
  if (!currentLoc && !activeLocId && !activeNodeId) return true;

  const targetTokens = [currentLoc, activeLocId, activeNodeId].filter(Boolean);

  if (handout.locationId) {
    const hLoc = normalizeString(handout.locationId);
    for (const token of targetTokens) {
      if (hLoc === token || hLoc.includes(token) || token.includes(hLoc)) {
        return true;
      }
    }
  }

  if (handout.nodeId) {
    const hNode = normalizeString(handout.nodeId);
    for (const token of targetTokens) {
      if (hNode === token || hNode.includes(token) || token.includes(hNode)) {
        return true;
      }
    }
  }

  return false;
}

export function buildHandoutsContext(
  handouts?: AdventureHandout[] | null,
  puzzles?: AdventurePuzzle[] | null,
  options?: BuildHandoutsContextOptions
): string {
  let context = '';
  const allHandouts = handouts || [];

  // 1. Separacja materiałów graczy od tajnych materiałów Strażnika
  const playerHandouts = allHandouts.filter(
    (h) => !h.keeperOnly && h.isPlayerFacing !== false
  );
  const keeperMaterials = allHandouts.filter(
    (h) => h.keeperOnly === true || h.isPlayerFacing === false
  );

  // 2. Scoping handoutów gracza wg aktywnego rozdziału i lokacji
  const scopedPlayerHandouts = playerHandouts.filter((h) => {
    return matchesChapter(h.chapterId, options?.activeChapterId) &&
           matchesLocation(h, options);
  });

  // 3. Scoping materiałów Strażnika (wg rozdziału, jeśli podano)
  const scopedKeeperMaterials = keeperMaterials.filter((h) => {
    return matchesChapter(h.chapterId, options?.activeChapterId);
  });

  // The location parser accepts short labels. Keep the graph-to-tag mapping explicit
  // so a natural scene transition can identify the exact physical audio node.
  if (options?.adventureId) {
    const names = new Set<string>();
    for (const handout of playerHandouts) {
      if (!(handout.audioUrl || handout.audioUrlPl || handout.audioUrlEn) || !handout.nodeId) continue;
      const labels = nodeLocationNames(options.adventureId, handout.nodeId);
      const shortLabel = labels.find(label => label !== handout.nodeId && label.length <= 45 && !/[:|,\[\]]/.test(label) && !label.startsWith('loc-'));
      if (shortLabel) names.add(`- ${handout.nodeId}: [LOKACJA:${shortLabel}]`);
    }
    if (names.size) context += `\n## NAZWY LOKACJI W GRAFIE\nPo faktycznym dotarciu do wskazanego węzła użyj jego dokładnej krótkiej nazwy lokacji. To nie jest polecenie podróży ani wręczenia rekwizytu:\n${[...names].join('\n')}\n`;
  }

  // 4. Sekcja DOSTĘPNE HANDOUTY (materiały do wręczenia graczom)
  if (scopedPlayerHandouts.length > 0) {
    const list = scopedPlayerHandouts
      .map((h) => `- ${h.title} → wstaw dokładnie: [HANDOUT:${h.slug}]`)
      .join('\n');

    context += (
      `\n## DOSTĘPNE HANDOUTY (realne dokumenty tej przygody)\n` +
      `Masz prawdziwe materiały do POKAZANIA graczom (mapy, dokumenty, listy). Reguły:\n` +
      `- Wstaw handout TYLKO gdy postacie fizycznie go widzą/otrzymują w fikcji (znajdują mapę, dostają kopertę).\n` +
      `- Gdy gracze fizycznie odnajdują lub otrzymują dokument, wstaw dokładnie tag: [HANDOUT:<slug>] w osobnej linii po opisie sceny. Nie parafrazuj ani nie zmyślaj treści dokumentu w narracji.\n` +
      `- Silnik gry automatycznie wyświetli graczom oryginalny, autentyczny dokument (100% RAW) na podstawie sluga.\n` +
      `- Nagranie audio wręczaj dopiero gdy postacie zbadają nośnik lub urządzenie w bieżącym węźle. Nie odtwarzaj go automatycznie ani nie zdradzaj treści przed odsłuchem.\n` +
      `- NIE wymyślaj własnych ścieżek ani handoutów spoza tej listy. Każdy pokaż maksymalnie raz, w naturalnym momencie.\n\n` +
      list + '\n'
    );
  }

  // 5. Sekcja KEEPER-ONLY (tajemnice i plany taktyczne MG - zakaz wręczenia)
  if (scopedKeeperMaterials.length > 0) {
    const keeperList = scopedKeeperMaterials
      .map((h) => {
        let entry = `- ${h.title} (slug: ${h.slug})`;
        if (h.textContent) {
          entry += `\n  Informacje dla MG: ${h.textContent}`;
        }
        return entry;
      })
      .join('\n');

    context += (
      `\n## MATERIAŁY I PLANY STRAŻNIKA (KEEPER-ONLY - ZAKAZ WRĘCZANIA GRACZOM)\n` +
      `Materiały taktyczne i plany przeznaczone WYŁĄCZNIE dla Ciebie jako Strażnika Tajemnic (tajemnice MG, plany kondygnacji):\n` +
      `- BEZWZGLĘDNY ZAKAZ: Nigdy nie emituj tagu [HANDOUT:...] dla tych materiałów!\n` +
      `- ZAKAZ bezpośredniego wręczania, pokazywania lub cytowania 1:1 tych materiałów graczom.\n` +
      `- Możesz opisywać słownie w narracji jedynie to, co postacie bezpośrednio widzą i badają.\n\n` +
      keeperList + '\n'
    );
  }

  // 6. Sekcja ZAGADKI LOGICZNE (bez zmian)
  if (puzzles && puzzles.length > 0) {
    const puzzleList = puzzles
      .map((p) => {
        const clues = (p.clues || []).map((c) => `  * Poszlaka: ${c}`).join('\n');
        return `### Zagadka: ${p.title}\n- Opis: ${p.description}\n- Rozwiązanie (Tylko dla MG): ${p.solutionSummary}\n- Poszlaki:\n${clues}\n- Reguła Idea Roll (RAW CoC 7e): ${p.ideaRollPrompt}`;
      })
      .join('\n\n');

    context += (
      `\n## ZAGADKI LOGICZNE I ŁAMIGŁÓWKI ŚLEDZTWA (RAW)\n` +
      `Scenariusz zawiera zdefiniowane wyzwania dedukcyjne dla graczy:\n` +
      `- Nie zdradzaj rozwiązania od razu! Pozwól graczom analizować zebrane materiały (handouty) i dedukować.\n` +
      `- ZASADA IDEA ROLL (Rzut na Pomysł - INT): Jeśli gracze utkną lub deklarują próbę dedukcji/powiązania faktów, zaproponuj Rzut na Pomysł (Idea Roll).\n` +
      `- ZASADA FAIL-FORWARD: Sukces w Idea Roll oznacza bezpośrednią dedukcję/wskazówkę. Porażka w rzucie na pomysł RÓWNIEŻ popycha śledztwo naprzód (gracze wpadają na trop), ale sprowadza natychmiastowe zagrożenie lub komplikację (zasadzka, alarm, utrata cennego czasu).\n\n` +
      puzzleList + '\n'
    );
  }

  return context;
}
