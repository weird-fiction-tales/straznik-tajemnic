/**
 * Adventure Asset Resolver (Issue #661)
 *
 * Deterministyczny resolver pre-renderowanych zasobów wizualnych (Adventure Visual Packs).
 * Realizuje trójstopniową kaskadę dopasowania:
 * - Priorytet 1: Teczka Aktywnej Przygody (caseId) -> dopasowanie po clueId, nameHash, tags
 * - Priorytet 2: Rezerwuar Innych Teczek tej samej Epoki / katalogu z nałożeniem cssFilterOverride
 * - Priorytet 3: Fallback z wstrzyknięciem visualDna do Live API
 */

import { createHash } from 'crypto';

export interface AdventurePackAsset {
  id: string;
  category: 'kv' | 'node' | 'npc' | 'item-clue' | 'item-gear';
  file: string;
  aspectRatio: '16:9' | '3:4';
  nameHashes?: string[];
  nodeId?: string;
  clueId?: string;
  catalogItemIdOverride?: string;
  tagsPl?: string[];
  tagsEn?: string[];
}

export interface AdventurePackAudioAsset {
  id: string;
  category: 'audio-handout';
  file: string;
  audioId: string;
  tagsPl?: string[];
  tagsEn?: string[];
}

export interface AdventurePackManifest {
  caseId: string;
  /** Physical public/adventure-packs directory when it differs from the logical case ID. */
  assetDirectory?: string;
  era: string;
  pdfFingerprints?: string[];
  predefinedAdventureId?: string;
  visualDna: {
    styleCore: string;
    colorAndLightingScript: string;
    cssFilterOverride?: string;
  };
  assets: AdventurePackAsset[];
  audioAssets?: AdventurePackAudioAsset[];
}

export interface AssetResolveResult {
  priority: 1 | 2 | 3;
  assetUrl: string | null;
  aspectRatio: '16:9' | '3:4';
  cssFilter?: string;
  enhancedPrompt?: string;
  matchedAsset?: AdventurePackAsset;
}

/**
 * Normalizuje tekst do celów bezpiecznego haszowania (brak znaków diakrytycznych, małe litery, spacje pojedyncze).
 */
export function normalizeNameForHash(name: string): string {
  return name
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Zwraca 12-znakowy skrót SHA-256 ze znormalizowanej nazwy własnej.
 */
export function computeNameHash(name: string): string {
  const normalized = normalizeNameForHash(name);
  const hash = createHash('sha256').update(normalized, 'utf8').digest('hex');
  return hash.slice(0, 12);
}

/**
 * Rozwiązuje zapytanie o zasób (slug, nazwa NPC, tag, ID) według 3-stopniowej kaskady.
 */
export function resolveAdventureAsset({
  slugOrQuery,
  manifest,
  otherManifests = [],
}: {
  slugOrQuery: string;
  manifest?: AdventurePackManifest | null;
  otherManifests?: AdventurePackManifest[];
}): AssetResolveResult {
  const query = slugOrQuery.trim();
  const queryNorm = normalizeNameForHash(query);
  const queryHash = computeNameHash(query);
  const assetDirectory = manifest?.assetDirectory === undefined ? manifest?.caseId : manifest.assetDirectory;
  if (manifest && (typeof assetDirectory !== 'string' || assetDirectory.length > 200 ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(assetDirectory))) {
    return { priority: 3, assetUrl: null, aspectRatio: '16:9', enhancedPrompt: query };
  }

  // --- Priorytet 1: Teczka Aktywnej Przygody ---
  if (manifest && manifest.assets.length > 0) {
    const cssFilter = manifest.visualDna?.cssFilterOverride;

    // 1.1 Dopasowanie bezpośrednie po clueId, nodeId lub nazwie pliku
    const byIdOrFile = manifest.assets.find((asset) => {
      if (asset.clueId && asset.clueId.toLowerCase() === query.toLowerCase()) return true;
      if (asset.nodeId && asset.nodeId.toLowerCase() === query.toLowerCase()) return true;
      if (asset.id.toLowerCase() === query.toLowerCase()) return true;
      if (asset.file.toLowerCase() === query.toLowerCase()) return true;
      if (asset.file.toLowerCase().replace(/\.[^/.]+$/, '') === query.toLowerCase()) return true;
      return false;
    });

    if (byIdOrFile) {
      return {
        priority: 1,
        assetUrl: `/adventure-packs/${assetDirectory}/${byIdOrFile.file}`,
        aspectRatio: byIdOrFile.aspectRatio,
        cssFilter,
        matchedAsset: byIdOrFile,
      };
    }

    // 1.2 Dopasowanie po katalogItemIdOverride
    const byOverride = manifest.assets.find(
      (asset) =>
        asset.catalogItemIdOverride &&
        asset.catalogItemIdOverride.toLowerCase() === query.toLowerCase()
    );

    if (byOverride) {
      return {
        priority: 1,
        assetUrl: `/adventure-packs/${assetDirectory}/${byOverride.file}`,
        aspectRatio: byOverride.aspectRatio,
        cssFilter,
        matchedAsset: byOverride,
      };
    }

    // 1.3 Dopasowanie po skrótach nazw własnych (nameHashes)
    const byHash = manifest.assets.find(
      (asset) => asset.nameHashes && asset.nameHashes.includes(queryHash)
    );

    if (byHash) {
      return {
        priority: 1,
        assetUrl: `/adventure-packs/${assetDirectory}/${byHash.file}`,
        aspectRatio: byHash.aspectRatio,
        cssFilter,
        matchedAsset: byHash,
      };
    }

    // 1.4 Dopasowanie po tagach archetypicznych (tagsPl / tagsEn)
    const byTag = manifest.assets.find((asset) => {
      const matchPl = asset.tagsPl?.some(
        (t) => normalizeNameForHash(t) === queryNorm || queryNorm.includes(normalizeNameForHash(t))
      );
      const matchEn = asset.tagsEn?.some(
        (t) => normalizeNameForHash(t) === queryNorm || queryNorm.includes(normalizeNameForHash(t))
      );
      return matchPl || matchEn;
    });

    if (byTag) {
      return {
        priority: 1,
        assetUrl: `/adventure-packs/${assetDirectory}/${byTag.file}`,
        aspectRatio: byTag.aspectRatio,
        cssFilter,
        matchedAsset: byTag,
      };
    }
  }

  // --- Priorytet 2: Rezerwuar innych teczek tej samej epoki ---
  if (manifest && otherManifests.length > 0) {
    const sameEraManifests = otherManifests.filter((m) => m.era === manifest.era);
    for (const other of sameEraManifests) {
      const otherRes = resolveAdventureAsset({
        slugOrQuery: query,
        manifest: other,
      });
      if (otherRes.priority === 1 && otherRes.assetUrl) {
        return {
          priority: 2,
          assetUrl: otherRes.assetUrl,
          aspectRatio: otherRes.aspectRatio,
          cssFilter: manifest.visualDna?.cssFilterOverride,
          matchedAsset: otherRes.matchedAsset,
        };
      }
    }
  }

  // --- Priorytet 3: Fallback na Live API z wstrzyknięciem visualDna ---
  const visualScript = manifest?.visualDna?.colorAndLightingScript || '';
  const enhancedPrompt = visualScript
    ? `${query}, authentic lighting: ${visualScript}`
    : query;

  return {
    priority: 3,
    assetUrl: null,
    aspectRatio: '16:9',
    enhancedPrompt,
  };
}
