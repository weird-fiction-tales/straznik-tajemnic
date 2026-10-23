import {
  computeNameHash,
  normalizeNameForHash,
  resolveAdventureAsset,
  AdventurePackManifest,
} from './adventure-asset-resolver';

describe('AdventureAssetResolver (Issue #661)', () => {
  const mockManifest: AdventurePackManifest = {
    caseId: 'case-s11-01',
    era: '1920s-us',
    predefinedAdventureId: 'nawiedzony-dom',
    visualDna: {
      styleCore: 'silver gelatin print, Boston 1920, tactile paper texture',
      colorAndLightingScript: 'sepia toning, harsh angle gaslight, heavy shadows',
      cssFilterOverride: 'sepia(0.3) contrast(1.1)',
    },
    assets: [
      {
        id: 'clue-01',
        category: 'item-clue',
        file: 'clue-01-knott-keys.webp',
        aspectRatio: '16:9',
        clueId: 'clue-01-knott-keys',
        nameHashes: [computeNameHash('klucze knotta'), computeNameHash('knott keys')],
        tagsPl: ['klucze', 'mosiądz', 'wizytówka', 'dolar'],
        tagsEn: ['keys', 'brass', 'business card', 'dollar'],
      },
      {
        id: 'npc-01',
        category: 'npc',
        file: 'npc-steven-knott.webp',
        aspectRatio: '3:4',
        nameHashes: [computeNameHash('steven knott'), computeNameHash('knott')],
        tagsPl: ['właściciel', 'płaszcz', 'kamizelka'],
        tagsEn: ['landlord', 'coat', 'vest'],
      },
      {
        id: 'gear-01',
        category: 'item-gear',
        file: 'item-corbitt-dagger.webp',
        aspectRatio: '16:9',
        catalogItemIdOverride: 'ritual-dagger',
        tagsPl: ['sztylet', 'ostrze', 'kości'],
        tagsEn: ['dagger', 'blade', 'bone'],
      },
    ],
  };

  describe('normalizeNameForHash & computeNameHash', () => {
    it('normalizuje znaki diakrytyczne i spacje', () => {
      expect(normalizeNameForHash('Klucze  KNOTTA!')).toBe('klucze knotta');
      expect(normalizeNameForHash('Święty Grób / Łagiewniki')).toBe('swiety grob lagiewniki');
    });

    it('generuje deterministyczny skrót 12-znakowy', () => {
      const hash1 = computeNameHash('Klucze Knotta');
      const hash2 = computeNameHash('klucze knotta');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(12);
    });
  });

  describe('resolveAdventureAsset - Kaskada 3 Priorytetów', () => {
    it('Priorytet 1: dopasowanie bezpośrednie po clueId / slug', () => {
      const result = resolveAdventureAsset({
        slugOrQuery: 'clue-01-knott-keys',
        manifest: mockManifest,
      });

      expect(result.priority).toBe(1);
      expect(result.assetUrl).toBe('/adventure-packs/case-s11-01/clue-01-knott-keys.webp');
      expect(result.aspectRatio).toBe('16:9');
    });

    it('Priorytet 1: dopasowanie po nazwie własnej (nameHash)', () => {
      const result = resolveAdventureAsset({
        slugOrQuery: 'Steven Knott',
        manifest: mockManifest,
      });

      expect(result.priority).toBe(1);
      expect(result.assetUrl).toBe('/adventure-packs/case-s11-01/npc-steven-knott.webp');
      expect(result.aspectRatio).toBe('3:4');
    });

    it('Priorytet 1: dopasowanie po tagach archetypicznych (tagsPl/tagsEn)', () => {
      const result = resolveAdventureAsset({
        slugOrQuery: 'mosiądz',
        manifest: mockManifest,
      });

      expect(result.priority).toBe(1);
      expect(result.assetUrl).toBe('/adventure-packs/case-s11-01/clue-01-knott-keys.webp');
    });

    it('Priorytet 2: dopasowanie nadpisania katalogu (catalogItemIdOverride) z filtrem CSS', () => {
      const result = resolveAdventureAsset({
        slugOrQuery: 'ritual-dagger',
        manifest: mockManifest,
      });

      expect(result.priority).toBe(1);
      expect(result.assetUrl).toBe('/adventure-packs/case-s11-01/item-corbitt-dagger.webp');
      expect(result.cssFilter).toBe('sepia(0.3) contrast(1.1)');
    });

    it('Priorytet 3: fallback na Live API z automatycznym wstrzyknięciem visualDna', () => {
      const result = resolveAdventureAsset({
        slugOrQuery: 'nieznany-potwor-z-kosmosu',
        manifest: mockManifest,
      });

      expect(result.priority).toBe(3);
      expect(result.assetUrl).toBeNull();
      expect(result.enhancedPrompt).toContain('sepia toning, harsh angle gaslight');
      expect(result.enhancedPrompt).toContain('nieznany-potwor-z-kosmosu');
    });
  });
});

describe('explicit asset directory', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  it.each(['cien-nad-prabutami', 'englewood-murder-castle-1893'])(
    'resolves every real %s manifest asset to an existing file while preserving case identity', (directory) => {
      const publicRoot = path.join(process.cwd(), 'public');
      const manifest = JSON.parse(fs.readFileSync(path.join(publicRoot, 'adventure-packs', directory, 'manifest.json'), 'utf8')) as AdventurePackManifest;
      expect(manifest.caseId).not.toBe(directory);
      expect(manifest.assetDirectory).toBe(directory);
      for (const asset of manifest.assets) {
        const result = resolveAdventureAsset({slugOrQuery:asset.id, manifest});
        expect(result.assetUrl).toBe('/adventure-packs/' + directory + '/' + asset.file);
        expect(fs.statSync(path.join(publicRoot, result.assetUrl!.slice(1))).isFile()).toBe(true);
      }
    }
  );
  it.each(['cien-nad-prabutami', 'englewood-murder-castle-1893'])(
    'uses source clue IDs, visual categories, and separate audio assets in %s', (directory) => {
      const publicRoot = path.join(process.cwd(), 'public');
      const raw = JSON.parse(fs.readFileSync(path.join(publicRoot, 'adventure-packs', directory, 'manifest.json'), 'utf8')) as {
        assets: Array<{ category?: string; clueId?: string }>;
        audioAssets?: Array<{ category?: string; file?: string }>;
      };
      const expectedClueIds = directory === 'cien-nad-prabutami'
        ? ['clue-sb-file-klin', 'clue-photo-prabuty']
        : ['clue-blueprint-castle-2nd-floor', 'clue-vault-footprint-etching'];
      expect(raw.assets.map(asset => asset.clueId)).toEqual(expect.arrayContaining(expectedClueIds));
      const manifest = raw as unknown as AdventurePackManifest;
      for (const clueId of expectedClueIds) {
        const resolved = resolveAdventureAsset({slugOrQuery:clueId, manifest});
        expect(resolved.priority).toBe(1);
        expect(resolved.matchedAsset?.clueId).toBe(clueId);
      }
      expect(raw.assets.every(asset => ['kv', 'node', 'npc', 'item-clue', 'item-gear'].includes(asset.category ?? ''))).toBe(true);
      expect(raw.audioAssets).toEqual(expect.arrayContaining([expect.objectContaining({category:'audio-handout'})]));
      for (const asset of raw.audioAssets ?? []) {
        expect(asset.file).toBeTruthy();
        expect(fs.statSync(path.join(publicRoot, 'adventure-packs', directory, asset.file!)).isFile()).toBe(true);
      }
    }
  );
  const fixture: AdventurePackManifest = {
    caseId:'logical-case', assetDirectory:'physical-folder', era:'1920s',
    visualDna:{styleCore:'fixture',colorAndLightingScript:'fixture'},
    assets:[{id:'direct-id',file:'test.webp',category:'npc',aspectRatio:'3:4',
      catalogItemIdOverride:'catalog-id',nameHashes:[computeNameHash('Unique Person')],tagsPl:['tag-fixture']}],
  };
  it.each(['direct-id','catalog-id','Unique Person','tag-fixture'])('uses explicit directory for %s matching', query => {
    expect(resolveAdventureAsset({slugOrQuery:query,manifest:fixture}).assetUrl).toBe('/adventure-packs/physical-folder/test.webp');
  });
  it('keeps caseId fallback for existing manifests without a directory override', () => {
    const {assetDirectory: _unused, ...legacy} = fixture;
    expect(resolveAdventureAsset({slugOrQuery:'direct-id',manifest:legacy}).assetUrl).toBe('/adventure-packs/logical-case/test.webp');
  });
  it.each(['../escape','a/b','a\\b','%2e%2e','/absolute','','.','..',null,42])(
    'fails closed for unsafe explicit directory %s', invalid => {
      const malformed = {...fixture,assetDirectory:invalid} as unknown as AdventurePackManifest;
      const result = resolveAdventureAsset({slugOrQuery:'direct-id',manifest:malformed,otherManifests:[fixture]});
      expect(result.assetUrl).toBeNull();
      expect(result.priority).toBe(3);
    }
  );
});
