import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { ImageRequest } from '@/lib/parsers/types';
import type { Message } from '@/lib/types';
import {
  resolveAdventureAsset,
  type AdventurePackHandoutAsset,
  type AdventurePackManifest,
} from './adventure-asset-resolver';
import { resolvePreparedAdventureVisual as resolveVisual, deduplicatePreparedOpenings } from './prepared-adventure-visuals';
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
  it.each(packs)('$id shows its exact saved opening once without changing source history or other images', ({ openingImage }) => {
    const unrelatedImage = '/custom/opening-scene.png';
    const history: Message[] = [
      { id: 'intro', role: 'assistant', timestamp: new Date(0), content: 'Opening.',
        generatedImages: [openingImage], generatedImageTypes: ['scene'], generatedImageCacheIds: ['intro_0'] },
      { id: 'second', role: 'assistant', timestamp: new Date(1), content: 'A discovery.',
        generatedImages: [openingImage, unrelatedImage], generatedImageTypes: ['location', 'item'],
        generatedImageCacheIds: ['second_0', 'second_1'], dossierHandoutRecordIds: ['source-photo'] },
      { id: 'third', role: 'assistant', timestamp: new Date(2), content: 'Another view.',
        generatedImages: [unrelatedImage], generatedImageTypes: ['item'] },
    ];
    const snapshot = JSON.stringify(history);
    for (const message of history) {
      Object.freeze(message.generatedImages); Object.freeze(message.generatedImageTypes);
      Object.freeze(message.generatedImageCacheIds); Object.freeze(message);
    }
    Object.freeze(history);
    const view = deduplicatePreparedOpenings(history);
    expect(view.flatMap(message => message.generatedImages ?? [])).toEqual([openingImage, unrelatedImage, unrelatedImage]);
    expect(view[0]).toBe(history[0]);
    expect(view[1]).toMatchObject({ id: 'second', content: 'A discovery.', generatedImages: [unrelatedImage],
      generatedImageTypes: ['item'], generatedImageCacheIds: ['second_1'], dossierHandoutRecordIds: ['source-photo'] });
    expect(view[2]).toBe(history[2]);
    expect(JSON.stringify(history)).toBe(snapshot);
  });

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

it.each([
 ['clue-polak-testimony-monk','6534f2ce42672e0794a25f7bcca4dee90caf8db9b8ac313729d48510adab524b'],
 ['clue-military-tire-tracks','b2403e462d2a7d6cdcb8777f98e8711836f46644a5ac64d1c4b7e511386a60e5'],
])('Prabuty %s resolves the image visually verified for that source', (id,sha256)=>{
 const visual=resolveVisual('cien-nad-prabutami',{prompt:'',type:'item',itemName:id} as ImageRequest)!;
 const bytes=readFileSync(path.join(process.cwd(),'public',visual.imageUrl.replace(/^\//,'')));
 expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256);
 const generic=resolveAdventureAsset({slugOrQuery:id,manifest:prabutyManifest as PreparedPack});
 const genericBytes=readFileSync(path.join(process.cwd(),'public',generic.assetUrl!.replace(/^\//,'')));
 expect(createHash('sha256').update(genericBytes).digest('hex')).toBe(sha256);
});
