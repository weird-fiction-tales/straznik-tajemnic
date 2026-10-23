import type { ImageRequest } from '@/lib/parsers/types';
import type {
  AdventurePackAsset,
  AdventurePackHandoutAsset,
  AdventurePackManifest,
} from './adventure-asset-resolver';
import prabutyPackJson from '../../../public/adventure-packs/cien-nad-prabutami/manifest.json';
import englewoodPackJson from '../../../public/adventure-packs/englewood-murder-castle-1893/manifest.json';

type PreparedPack = AdventurePackManifest & { handouts?: AdventurePackHandoutAsset[] };

const PACKS: Record<string, PreparedPack> = {
  'cien-nad-prabutami': prabutyPackJson as PreparedPack,
  'englewood-murder-castle-1893': englewoodPackJson as PreparedPack,
};

export interface PreparedVisualMatch {
  imageUrl: string;
  imageType: NonNullable<ImageRequest['type']> | 'scene';
  assetId: string;
}

function normalize(value: string): string {
  return value.toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesName(query: string, names: Array<string | undefined>): boolean {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 5) return false;
  return names.some((name) => {
    if (!name) return false;
    const normalizedName = normalize(name);
    if (normalizedName.length < 5) return false;
    return normalizedQuery === normalizedName ||
      normalizedQuery.includes(normalizedName) ||
      (normalizedQuery.length >= 8 && normalizedName.includes(normalizedQuery));
  });
}

function assetUrl(pack: PreparedPack, asset: AdventurePackAsset): string | null {
  const directory = pack.assetDirectory ?? pack.caseId;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(directory) || asset.file.includes('..') || asset.file.startsWith('/')) {
    return null;
  }
  return `/adventure-packs/${directory}/${asset.file}`;
}

/**
 * Reuse the exact authored handout, node or NPC image for an authored scenario.
 * A miss is intentionally explicit: only an unprepared visual reaches /api/imagen.
 */
export function resolvePreparedAdventureVisual(
  adventureId: string | undefined,
  request: ImageRequest,
  activeNodeId?: string | null,
  allowNodeFallback = false,
): PreparedVisualMatch | null {
  if (!adventureId) return null;
  const pack = PACKS[adventureId];
  if (!pack) return null;

  const type = request.type ?? 'scene';
  const query = type === 'monster' || type === 'vision'
    ? request.prompt
    : type === 'portrait'
    ? request.portraitName
    : type === 'item'
      ? request.itemName
      : type === 'location'
        ? request.locationName
          : type === 'scene'
            ? request.locationName
            : undefined;

  if (type === 'item' && query) {
    const handout = pack.handouts?.find((entry) => matchesName(query, [
      entry.slug,
      entry.clueId,
      entry.title,
      ...(entry.tagsPl ?? []),
      ...(entry.tagsEn ?? []),
    ]));
    if (handout && /^\/handouts\/[a-zA-Z0-9_./-]+\.(?:png|webp|jpg|jpeg)$/i.test(handout.image)) {
      return { imageUrl: handout.image, imageType: 'item', assetId: `handout:${handout.slug}` };
    }
  }

  const categoryAllowed = (asset: AdventurePackAsset) =>
    type === 'portrait' ? asset.category === 'npc' :
    type === 'monster' ? asset.category === 'npc' :
    type === 'vision' ? asset.category === 'node' || asset.category === 'kv' :
    type === 'item' ? asset.category === 'item-clue' || asset.category === 'item-gear' :
    type === 'location' ? asset.category === 'node' || asset.category === 'kv' :
    asset.category === 'node' || asset.category === 'kv';

  let asset: AdventurePackAsset | undefined;
  if (!asset && query) {
    asset = pack.assets.find((entry) => categoryAllowed(entry) && matchesName(query, [
      entry.id,
      entry.nodeId,
      entry.clueId,
      entry.file.replace(/\.[^/.]+$/, ''),
      ...(entry.tagsPl ?? []),
      ...(entry.tagsEn ?? []),
    ]));
  }
  if (!asset && allowNodeFallback && (type === 'scene' || type === 'location') && activeNodeId) {
    asset = pack.assets.find((entry) => categoryAllowed(entry) && (
      entry.nodeId === activeNodeId || matchesName(activeNodeId, [
        entry.id,
        entry.file.replace(/\.[^/.]+$/, ''),
        ...(entry.tagsPl ?? []),
        ...(entry.tagsEn ?? []),
      ])
    ));
  }

  const url = asset && assetUrl(pack, asset);
  return url ? { imageUrl: url, imageType: request.type ?? 'scene', assetId: asset!.id } : null;
}

/** Style anchors used only when the local pack has no prepared visual match. */
export function getAdventureVisualStyle(adventureId: string | undefined): string | null {
  const pack = adventureId ? PACKS[adventureId] : undefined;
  if (!pack) return null;
  return [pack.visualDna.styleCore, pack.visualDna.colorAndLightingScript]
    .filter(Boolean)
    .join('; ');
}
