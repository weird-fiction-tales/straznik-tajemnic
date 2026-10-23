import { existsSync } from 'node:fs';
import path from 'node:path';
import type { ImageRequest } from '@/lib/parsers/types';
import {
  resolveAdventureAsset,
  type AdventurePackHandoutAsset,
  type AdventurePackManifest,
} from './adventure-asset-resolver';
import { resolvePreparedAdventureVisual as resolveVisual } from './prepared-adventure-visuals';
import { STREFA_11_ADVENTURES } from '@/lib/adventures-data';
import { AMERICAN_COLD_CASES_ADVENTURES } from '@/lib/american-cold-cases-data';
import prabutyManifest from '../../../public/adventure-packs/cien-nad-prabutami/manifest.json';
import englewoodManifest from '../../../public/adventure-packs/englewood-murder-castle-1893/manifest.json';

type PreparedPack = AdventurePackManifest & { handouts?: AdventurePackHandoutAsset[] };

const packs: Array<{ id: string; manifest: PreparedPack; openingNodeId: string; openingImage: string }> = [
  {
    id: 'cien-nad-prabutami',
    manifest: prabutyManifest as unknown as PreparedPack,
    openingNodeId: 'node-warszawa-redakcja',
    openingImage: '/adventure-packs/cien-nad-prabutami/opening-warszawa-redakcja.png',
  },
  {
    id: 'englewood-murder-castle-1893',
    manifest: englewoodManifest as unknown as PreparedPack,
    openingNodeId: 'node-chicago-precinct',
    openingImage: '/adventure-packs/englewood-murder-castle-1893/opening-chicago-precinct.png',
  },
];

const adventures = [...STREFA_11_ADVENTURES, ...AMERICAN_COLD_CASES_ADVENTURES];

describe('prepared adventure visuals', () => {
  it.each(packs)('$id resolves its opening image and all 12 clues from local files', ({ id, manifest, openingNodeId, openingImage }) => {
    const opening = resolveVisual(
      id,
      { prompt: '', type: 'location', locationName: 'opening' } as ImageRequest,
      openingNodeId,
      true,
    );
    expect(opening?.imageUrl).toBe(openingImage);

    const clues = manifest.assets.filter((asset) => asset.category === 'item-clue');
    expect(clues).toHaveLength(12);
    for (const clue of clues) {
      const itemName = clue.tagsPl?.[0] ?? clue.clueId;
      expect(itemName).toBeTruthy();
      const match = resolveVisual(
        id,
        { prompt: itemName ?? '', type: 'item', itemName } as ImageRequest,
      );
      expect(match?.imageType).toBe('item');
      expect(match?.imageUrl).toBeTruthy();
      const filePath = path.join(process.cwd(), 'public', match!.imageUrl.replace(/^\//, ''));
      expect(existsSync(filePath)).toBe(true);
    }
  });

  it.each(packs)('$id resolves each canonical handout to its configured image', ({ id, manifest }) => {
    expect(manifest.handouts).toBeDefined();
    const adventure = adventures.find((entry) => entry.id === id);
    expect(adventure?.handouts).toBeDefined();
    expect(manifest.handouts?.map((handout) => handout.slug).sort()).toEqual(
      adventure!.handouts!.map((handout) => handout.slug).sort(),
    );
    for (const handout of manifest.handouts ?? []) {
      const match = resolveAdventureAsset({ slugOrQuery: handout.title, manifest });
      expect(match.assetUrl).toBe(handout.image);
      expect(adventure!.handouts!.find((configured) => configured.slug === handout.slug)?.image)
        .toBe(handout.image);
      expect(existsSync(path.join(process.cwd(), 'public', handout.image.replace(/^\//, '')))).toBe(true);
    }
  });

  it.each(packs)('$id prepared clue and node assets map to the authored graph', ({ id, manifest }) => {
    const adventure = adventures.find((entry) => entry.id === id);
    expect(adventure?.graph).toBeDefined();
    const graph = adventure!.graph!;
    const graphClueIds = graph.clues.map((clue) => clue.id).sort();
    const preparedClueIds = manifest.assets
      .filter((asset) => asset.category === 'item-clue')
      .map((asset) => asset.clueId)
      .filter((clueId): clueId is string => Boolean(clueId))
      .sort();
    expect(preparedClueIds).toEqual(graphClueIds);

    const graphNodeIds = (graph.nodes ?? []).map((node) => node.id).sort();
    const preparedNodeIds = [...new Set(
      manifest.assets
        .filter((asset) => asset.category === 'node')
        .map((asset) => asset.nodeId)
        .filter((nodeId): nodeId is string => Boolean(nodeId)),
    )].sort();
    expect(preparedNodeIds).toEqual(graphNodeIds);
  });
});
