import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EQUIPMENT_CATALOG,
  applyCatalogTemplate,
  migrateEquipmentCatalog,
  findEquipmentTemplate,
  isCatalogEquipment,
  resolveCatalogAsset,
  safeResolveVisualEra,
} from './equipment-catalog';
import { PREDEFINED_CHARACTERS } from './immersion/predefined-characters';
import { STREFA_11_CHARACTERS } from './immersion/strefa-11-characters';
import { OCCUPATION_EQUIPMENT, splitTopLevel } from './equipment-data';

describe('equipment catalog', () => {
  it('rozpoznaje polskie nazwy i dawne aliasy bez fallbacku po nazwie UI', () => {
    expect(findEquipmentTemplate('Flashlight')?.id).toBe('light.flashlight');
    expect(findEquipmentTemplate('Latarka elektryczna')?.id).toBe(
      'light.flashlight'
    );
    expect(findEquipmentTemplate('Mocna lina')?.id).toBe('tool.rope');
    expect(findEquipmentTemplate('Stara latarka kieszonkowa')?.id).toBe('light.flashlight');
    expect(findEquipmentTemplate('Zardzewiałe wytrychy')?.id).toBe('tool.lockpicks');
  });

  it('wybiera wariant epoki tylko tam, gdzie istnieje, a poza nią zwraca undefined (brak cichego fallbacku shared)', () => {
    const flashlight = findEquipmentTemplate('Latarka')!;
    const rope = findEquipmentTemplate('Lina')!;
    expect(resolveCatalogAsset(flashlight, '1920s')).toBe(
      '/equipment/catalog/flashlight-1920s.webp'
    );
    expect(resolveCatalogAsset(flashlight, '1950s')).toBeUndefined();
    expect(resolveCatalogAsset(rope, '1920s')).toBe(
      '/equipment/catalog/rope-1920s.webp'
    );
    expect(resolveCatalogAsset(rope, 'prl-1970s')).toBeUndefined();
  });

  it.each([
    ['light.flashlight', 'Latarka', '/equipment/catalog/police-flashlight-prl.webp'],
    ['tool.camera', 'Aparat fotograficzny', '/equipment/catalog/camera-prl-1970s.webp'],
    ['tool.compass', 'Kompas', '/equipment/catalog/compass-shared.webp'],
  ])('przypisuje zatwierdzony wariant PRL: %s', (templateId, name, imageUrl) => {
    const template = findEquipmentTemplate(templateId);
    expect(resolveCatalogAsset(template, 'prl-1970s')).toBe(imageUrl);
    expect(applyCatalogTemplate({ id: 'legacy-' + templateId, name, category: 'tool' }, 'prl-1970s'))
      .toMatchObject({ templateId, imageUrl, visualSource: 'catalog', eraVariantId: templateId + '-prl-1970s' });
  });

  it.each([undefined, '/equipment/predefined/tool.svg'])
    ('naprawia pusty obraz generated we wznowionym zapisie (%s), zachowując własny obraz', (imageUrl) => {
      const customImage = 'data:image/webp;base64,story';
      const migrated = migrateEquipmentCatalog([
        { id: 'missing', name: 'Latarka', category: 'tool', visualSource: 'generated', imageUrl },
        { id: 'custom', name: 'Latarka', category: 'tool', visualSource: 'generated', imageUrl: customImage },
      ], 'prl-1970s');

      expect(migrated?.[0]).toMatchObject({
        id: 'missing', imageUrl: '/equipment/catalog/police-flashlight-prl.webp', visualSource: 'catalog',
      });
      expect(migrated?.[1]).toEqual({
        id: 'custom', name: 'Latarka', category: 'tool', visualSource: 'generated', imageUrl: customImage,
      });
      expect(migrateEquipmentCatalog(migrated, 'prl-1970s')).toEqual(migrated);
    });

  it('nie zastępuje ilustracji materiału teczki szablonem katalogowym', () => {
    const dossierItem = {
      id: 'dossier-photo', name: 'Fotografia', category: 'document' as const,
      visualSource: 'fallback' as const, imageUrl: '/adventure-packs/cien-nad-prabutami/fotografia.jpg',
      dossierBinding: { adventureId: 'cien-nad-prabutami', editionFingerprint: 'sha256:edition', recordId: 'photo-item' },
    };
    expect(applyCatalogTemplate(dossierItem, 'prl-1970s')).toBe(dossierItem);
  });

  it('migruje stary zapis po nazwie, zachowując stabilne ID egzemplarza i nadając eraVariantId', () => {
    const migrated = applyCatalogTemplate(
      {
        id: 'legacy-item-42',
        name: 'Flashlight',
        category: 'personal',
        source: 'starting',
      },
      '1920s'
    );

    expect(migrated).toMatchObject({
      id: 'legacy-item-42',
      templateId: 'light.flashlight',
      eraVariantId: 'light.flashlight-1920s',
      category: 'tool',
      visualSource: 'catalog',
      imageUrl: '/equipment/catalog/flashlight-1920s.webp',
    });
  });

  it('migruje całą listę starego zapisu bez zmiany jej kolejności', () => {
    const migrated = migrateEquipmentCatalog([
      {
        id: 'legacy-1',
        name: 'Flashlight',
        category: 'tool',
        source: 'starting',
      },
      {
        id: 'legacy-2',
        name: 'Rzecz własna',
        category: 'personal',
        source: 'starting',
      },
    ]);

    expect(migrated?.map((item) => item.id)).toEqual(['legacy-1', 'legacy-2']);
    expect(migrated?.[0].templateId).toBe('light.flashlight');
    expect(migrated?.[0].eraVariantId).toBe('light.flashlight-1920s');
    expect(migrated?.[1].templateId).toBeUndefined();
  });

  it('zachowuje istniejący obraz i rozróżnia wygenerowany egzemplarz od katalogu', () => {
    const generated = {
      id: 'story-flashlight',
      templateId: 'light.flashlight',
      name: 'Latarka znaleziona w piwnicy',
      category: 'tool' as const,
      visualSource: 'generated' as const,
      imageUrl: 'data:image/webp;base64,story',
    };

    expect(applyCatalogTemplate(generated, 'modern')).toEqual(generated);
    expect(isCatalogEquipment(generated)).toBe(false);
    expect(
      isCatalogEquipment({
        id: 'legacy-flashlight',
        templateId: 'light.flashlight',
        name: 'Latarka',
        category: 'tool',
      })
    ).toBe(true);
    expect(
      applyCatalogTemplate(
        {
          id: 'legacy-with-image',
          name: 'Latarka',
          category: 'tool',
          imageUrl: 'data:image/webp;base64,existing',
        },
        'modern'
      ).imageUrl
    ).toBe('data:image/webp;base64,existing');
    expect(
      isCatalogEquipment({
        id: 'unknown',
        templateId: 'unknown.future-template',
        name: 'Nieznany przedmiot',
        category: 'personal',
      })
    ).toBe(false);
  });

  it('ma lokalny render WebP dla każdego wzorca katalogu ze zdefiniowaną ścieżką assetu', () => {
    const templatesWithAssets = EQUIPMENT_CATALOG.filter(
      (template) => Object.values(template.assetPaths ?? {}).length > 0
    );
    expect(templatesWithAssets.length).toBeGreaterThanOrEqual(110);

    templatesWithAssets
      .flatMap((template) => Object.values(template.assetPaths!))
      .forEach((asset) => {
        expect(asset).toMatch(/^\/equipment\/catalog\/.+\.webp$/);
        expect(existsSync(join(process.cwd(), 'public', asset.slice(1)))).toBe(
          true
        );
      });
  });

  it('rozpoznaje nowe wzorce broni i wyposażenia z Partii 1 (Colt .38, Webley .455, Thompson, Łom, Pilotka)', () => {
    const colt = findEquipmentTemplate('Rewolwer Colt .38');
    expect(colt?.id).toBe('weapon.revolver-colt38-1920s');
    expect(colt?.modifiers?.damage).toBe('1d10');
    expect(colt?.value).toBe(25);

    const webley = findEquipmentTemplate('Webley Mk IV');
    expect(webley?.id).toBe('weapon.revolver-webley-1920s');
    expect(webley?.modifiers?.damage).toBe('1d10+2');

    const tommy = findEquipmentTemplate('Pistolet maszynowy Thompson');
    expect(tommy?.id).toBe('weapon.submachine-tommy-1920s');
    expect(tommy?.modifiers?.malfunction).toBe(96);

    const crowbar = findEquipmentTemplate('Stalowy łom');
    expect(crowbar?.id).toBe('tool.crowbar-shared');
    expect(crowbar?.modifiers?.skill).toBe('Walka wręcz');

    const goggles = findEquipmentTemplate('Skórzana pilotka i gogle');
    expect(goggles?.id).toBe('personal.pilot-goggles-1920s');
  });

  it('wzbogaca przedmioty o statystyki CoC 7e RAW (modifiers, value) podczas aplikowania szablonu', () => {
    const colt = applyCatalogTemplate(
      {
        id: 'test-colt',
        name: 'Rewolwer Colt .38',
        category: 'weapon',
      },
      '1920s'
    );
    expect(colt.templateId).toBe('weapon.revolver-colt38-1920s');
    expect(colt.modifiers?.damage).toBe('1d10');
    expect(colt.modifiers?.range).toBe('15 yards');
    expect(colt.value).toBe(25);
    expect(colt.imageUrl).toBe('/equipment/catalog/revolver-colt38-1920s.webp');

    const lockpicks = applyCatalogTemplate(
      {
        id: 'test-lockpicks',
        name: 'Wytrychy',
        category: 'tool',
      },
      '1920s'
    );
    expect(lockpicks.modifiers?.skill).toBe('Ślusarstwo');
    expect(lockpicks.modifiers?.bonus).toBe(10);
    expect(lockpicks.value).toBe(10);
  });

  it('zapewnia deterministyczny szablon w katalogu dla każdego przedmiotu z 46 aktywnych presetów postaci', () => {
    const allPresets = [...PREDEFINED_CHARACTERS, ...STREFA_11_CHARACTERS];
    expect(allPresets).toHaveLength(46);

    const missing: string[] = [];
    allPresets.forEach((character) => {
      const items = character.equipment ?? [];
      items.forEach((item) => {
        const template = findEquipmentTemplate(item.templateId ?? item.name);
        if (!template) {
          missing.push(`${item.name} (${character.name})`);
        }
      });
    });
    expect(missing).toEqual([]);
  });

  it('zapewnia deterministyczny szablon w katalogu dla każdego przedmiotu ze wszystkich 30 zawodów RAW (OCCUPATION_EQUIPMENT)', () => {
    const missing: string[] = [];
    Object.entries(OCCUPATION_EQUIPMENT).forEach(([occ, eqList]) => {
      eqList.forEach((eqStr) => {
        const itemNames = splitTopLevel(eqStr).map((s) =>
          s.replace(/\s+/g, ' ').trim()
        );
        itemNames.forEach((name) => {
          const template = findEquipmentTemplate(name);
          if (!template) {
            missing.push(`${name} (${occ})`);
          }
        });
      });
    });
    expect(missing).toEqual([]);
  });

  it('prawidłowo kategoryzuje przedmioty Parapsychologa (Termometr, Detektor EMF, Aparat) jako tool w 1920s', () => {
    const thermo = findEquipmentTemplate('Termometr');
    expect(thermo?.category).toBe('tool');
    expect(thermo?.availableIn).toContain('1920s');

    const emf = findEquipmentTemplate('Detektor pola elektromagnetycznego');
    expect(emf?.category).toBe('tool');
    expect(emf?.availableIn).toContain('1920s');

    const camera = findEquipmentTemplate('Aparat fotograficzny');
    expect(camera?.category).toBe('tool');
    expect(resolveCatalogAsset(camera, '1920s')).toBe(
      '/equipment/catalog/camera-1920s.webp'
    );
  });

  it('zapewnia poprawne szablony i assety WebP dla przedmiotów epoki 2000s (laptop, komórka, powerbank, narzędzia)', () => {
    // 1. Laptop
    const laptopTemplate = findEquipmentTemplate('Ciężki laptop z wczesnym Wi-Fi');
    expect(laptopTemplate?.id).toBe('tool.heavy-laptop-wifi-1990s');
    expect(resolveCatalogAsset(laptopTemplate, '2000s')).toBe(
      '/equipment/catalog/heavy-laptop-wifi-1990s.webp'
    );
    const laptopEnriched = applyCatalogTemplate(
      {
        id: 'eq-laptop',
        name: 'Ciężki laptop z wczesnym Wi-Fi',
        category: 'tool',
        imageUrl: '/equipment/predefined/tool.svg',
      },
      '2000s'
    );
    expect(laptopEnriched.imageUrl).toBe('/equipment/catalog/heavy-laptop-wifi-1990s.webp');
    expect(laptopEnriched.visualSource).toBe('catalog');

    // 2. Telefon komórkowy
    const phoneTemplate = findEquipmentTemplate('Telefon komórkowy');
    expect(phoneTemplate?.id).toBe('modern.phone');
    expect(resolveCatalogAsset(phoneTemplate, '2000s')).toBe(
      '/equipment/catalog/phone-modern.webp'
    );
    const phoneEnriched = applyCatalogTemplate(
      {
        id: 'eq-phone',
        name: 'Telefon komórkowy z klawiaturą',
        category: 'tool',
        imageUrl: '/equipment/predefined/tool.svg',
      },
      '2000s'
    );
    expect(phoneEnriched.imageUrl).toBe('/equipment/catalog/phone-modern.webp');
    expect(phoneEnriched.visualSource).toBe('catalog');

    // 3. Powerbank / Zapasowa bateria
    const batteryTemplate = findEquipmentTemplate('Zapasowa bateria');
    expect(batteryTemplate?.id).toBe('modern.power-bank');
    expect(resolveCatalogAsset(batteryTemplate, '2000s')).toBe(
      '/equipment/catalog/power-bank-modern.webp'
    );
    const batteryEnriched = applyCatalogTemplate(
      {
        id: 'eq-battery',
        name: 'Zapasowa bateria',
        category: 'tool',
        imageUrl: '/equipment/predefined/tool.svg',
      },
      '2000s'
    );
    expect(batteryEnriched.imageUrl).toBe('/equipment/catalog/power-bank-modern.webp');
    expect(batteryEnriched.visualSource).toBe('catalog');

    // 4. Zestaw narzędzi do elektroniki
    const kitTemplate = findEquipmentTemplate('Zestaw narzędzi do elektroniki');
    expect(kitTemplate?.id).toBe('tool.electrical-kit');
    expect(resolveCatalogAsset(kitTemplate, '2000s')).toBe(
      '/equipment/catalog/electrical-kit-modern.webp'
    );
    const kitEnriched = applyCatalogTemplate(
      {
        id: 'eq-kit',
        name: 'Zestaw narzędzi do elektroniki',
        category: 'tool',
        imageUrl: '/equipment/predefined/tool.svg',
      },
      '2000s'
    );
    expect(kitEnriched.imageUrl).toBe('/equipment/catalog/electrical-kit-modern.webp');
    expect(kitEnriched.visualSource).toBe('catalog');
  });

  it('mapuje w 100% wszystkie 110 grafik WebP z katalogu i gwarantuje ich obecność na dysku', () => {
    const manifestPath = existsSync(join(process.cwd(), 'docs/audits/equipment/catalog-manifest-all.json'))
      ? join(process.cwd(), 'docs/audits/equipment/catalog-manifest-all.json')
      : join(process.cwd(), '../../../docs/audits/equipment/catalog-manifest-all.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest).toHaveLength(110);

    manifest.forEach((entry: { id: string; filename: string; era: string; name: string }) => {
      // Każdy plik musi fizycznie istnieć na dysku w public/equipment/catalog/
      const diskPath = join(process.cwd(), 'public', 'equipment', 'catalog', entry.filename);
      expect(existsSync(diskPath)).toBe(true);

      // Każdy element manifestu musi odpowiadać szablonowi w EQUIPMENT_CATALOG
      const template = findEquipmentTemplate(entry.id) || findEquipmentTemplate(entry.name);
      expect(template).toBeDefined();

      // Asset musi być powiązany ze zdefiniowanym szablonem (jako wariant epokowy lub bezpośredni)
      const assets = Object.values(template?.assetPaths ?? {});
      const matchesDirect = assets.includes(`/equipment/catalog/${entry.filename}`);
      const stem = entry.filename.replace(/(-shared)?\.webp$/, '');
      const idStem = entry.id.replace(/^[a-z]+\./, '').replace(/(-shared)?$/, '');
      const matchesStem = assets.some((a) => {
        return a.startsWith(`/equipment/catalog/${stem}-`) || a.startsWith(`/equipment/catalog/${idStem}-`);
      });
      if (!matchesDirect && !matchesStem) {
        console.error('FAILED MANIFEST ENTRY:', entry.id, entry.filename, 'Assets in template:', assets);
      }
      expect(matchesDirect || matchesStem).toBe(true);
    });
  });

  it('nie zawiera martwego odwołania laptop-modern.webp w żadnym szablonie', () => {
    EQUIPMENT_CATALOG.forEach((template) => {
      const assets = Object.values(template.assetPaths ?? {});
      assets.forEach((asset) => {
        expect(asset).not.toContain('laptop-modern.webp');
      });
    });
  });

  it('prawidłowo przypisuje i rozstrzyga assety WebP dla przedmiotów epokowych i uniwersalnych (Batch 2-4)', () => {
    // 1. Broń epoki 1890s (Lee-Metford)
    const leeMetford = findEquipmentTemplate('Karabin Lee-Metford .303');
    expect(leeMetford?.id).toBe('weapon.rifle-lee-metford-1890s');
    expect(resolveCatalogAsset(leeMetford, '1890s')).toBe(
      '/equipment/catalog/rifle-lee-metford-1890s.webp'
    );
    expect(resolveCatalogAsset(leeMetford, '1920s')).toBeUndefined();

    // 2. Broń epoki 1920s (Springfield M1903)
    const springfield = findEquipmentTemplate('Karabin Springfield M1903');
    expect(springfield?.id).toBe('weapon.rifle-springfield-1920s');
    expect(resolveCatalogAsset(springfield, '1920s')).toBe(
      '/equipment/catalog/rifle-springfield-1920s.webp'
    );

    // 3. Broń współczesna (H&K 416)
    const hk416 = findEquipmentTemplate('Karabinek H&K 416');
    expect(hk416?.id).toBe('weapon.rifle-hk416-modern');
    expect(resolveCatalogAsset(hk416, 'modern')).toBe(
      '/equipment/catalog/rifle-hk416-modern.webp'
    );

    // 4. Sprzęt PRL (Magnetofon kasetowy)
    const tapeRecorder = findEquipmentTemplate('Magnetofon kasetowy PRL');
    expect(tapeRecorder?.id).toBe('tool.tape-recorder-prl-1970s');
    expect(resolveCatalogAsset(tapeRecorder, 'prl-1970s')).toBe(
      '/equipment/catalog/tape-recorder-prl-1970s.webp'
    );

    // 5. Przedmiot okultystyczny (Talia kart Tarota)
    const tarot = findEquipmentTemplate('Talia kart Tarota');
    expect(tarot?.id).toBe('occult.tarot-deck-vintage');
    expect(resolveCatalogAsset(tarot, '1920s')).toBe(
      '/equipment/catalog/tarot-deck-vintage-1920s.webp'
    );

    // 6. Zasób medyczny (Ampułki z morfiną)
    const morphine = findEquipmentTemplate('Ampułki z morfiną');
    expect(morphine?.id).toBe('medical.morphine-ampoules-shared');
    expect(resolveCatalogAsset(morphine, '1920s')).toBe(
      '/equipment/catalog/morphine-ampoules-1920s.webp'
    );
  });

  it('bezpiecznie normalizuje niestandardowe i złożone identyfikatory epok (safeResolveVisualEra)', () => {
    expect(safeResolveVisualEra('classic')).toBe('1920s');
    expect(safeResolveVisualEra('gaslight')).toBe('1890s');
    expect(safeResolveVisualEra('1920s-us')).toBe('1920s');
    expect(safeResolveVisualEra('1920s-pl')).toBe('1920s');
    expect(safeResolveVisualEra('noir')).toBe('1940s');
    expect(safeResolveVisualEra('pulp')).toBe('1930s');
    expect(safeResolveVisualEra('1946')).toBe('1940s');
    expect(safeResolveVisualEra('prl-1970s')).toBe('prl-1970s');
    expect(safeResolveVisualEra('modern')).toBe('modern');
    expect(safeResolveVisualEra(undefined)).toBe('1920s');
    expect(safeResolveVisualEra('unknown-era-xyz')).toBe('1920s');
  });

  it('gwarantuje deterministyczne przypisanie assetów lokalnych (WebP lub ikony kategorii SVG) dla 100% z 244 przedmiotów w 46 presetach', () => {
    const allPresets = [...PREDEFINED_CHARACTERS, ...STREFA_11_CHARACTERS];
    expect(allPresets).toHaveLength(46);

    let totalItems = 0;
    const missingAssetItems: string[] = [];
    const missingDiskFiles: string[] = [];

    allPresets.forEach((character) => {
      const items = character.equipment ?? [];
      items.forEach((item) => {
        totalItems++;
        const applied = applyCatalogTemplate(item, character.era);
        if (!applied.imageUrl) {
          missingAssetItems.push(`${item.name} (${character.name}, era: ${character.era}) -> brak imageUrl`);
        } else {
          const relativeAssetPath = applied.imageUrl.replace(/^\//, '');
          const diskPath = join(process.cwd(), 'public', relativeAssetPath);
          if (!existsSync(diskPath)) {
            missingDiskFiles.push(`${character.name} -> ${item.name}: ${diskPath}`);
          }
        }
      });
    });

    expect(totalItems).toBe(244);
    expect(missingAssetItems).toEqual([]);
    expect(missingDiskFiles).toEqual([]);
  });

  it('znajduje szablony po angielskich nazwach (nameEn) dla wszystkich 110 wpisów manifestu', () => {
    const manifestPath = existsSync(join(process.cwd(), 'docs/audits/equipment/catalog-manifest-all.json'))
      ? join(process.cwd(), 'docs/audits/equipment/catalog-manifest-all.json')
      : join(process.cwd(), '../../../docs/audits/equipment/catalog-manifest-all.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest).toHaveLength(110);

    const missingEn: string[] = [];
    manifest.forEach((entry: { id: string; nameEn?: string }) => {
      if (entry.nameEn) {
        const template = findEquipmentTemplate(entry.nameEn);
        if (!template) {
          missingEn.push(`${entry.nameEn} (id: ${entry.id})`);
        }
      }
    });

    expect(missingEn).toEqual([]);
  });

  it('rozstrzyga ikoniczne przedmioty (Rewolwer .38 i Lampa naftowa) do grafik WebP w 1920s', () => {
    const revolver = findEquipmentTemplate('weapon.revolver-38');
    expect(revolver).toBeDefined();
    expect(resolveCatalogAsset(revolver, '1920s')).toBe(
      '/equipment/catalog/revolver-colt38-1920s.webp'
    );
    expect(resolveCatalogAsset(revolver, '1940s')).toBe(
      '/equipment/catalog/revolver-1940s.webp'
    );

    const lantern = findEquipmentTemplate('light.oil-lantern');
    expect(lantern).toBeDefined();
    expect(resolveCatalogAsset(lantern, '1920s')).toBe(
      '/equipment/catalog/oil-lantern-1920s.webp'
    );
    expect(resolveCatalogAsset(lantern, '1890s')).toBe(
      '/equipment/catalog/oil-lantern-1890s.webp'
    );
  });

  it('gwarantuje, że wszystkie postacie Strefy 11 mają bezpośrednio w obiektach equipment poprawne lokalne assety (WebP lub fallback ikony)', () => {
    expect(STREFA_11_CHARACTERS.length).toBe(16);

    let totalItems = 0;
    const missingAssetItems: string[] = [];
    const missingDiskFiles: string[] = [];

    STREFA_11_CHARACTERS.forEach((character) => {
      const items = character.equipment ?? [];
      expect(items.length).toBeGreaterThan(0);

      items.forEach((item) => {
        totalItems++;
        if (!item.imageUrl) {
          missingAssetItems.push(
            `${character.name} (${character.era}) -> ${item.name}: brak imageUrl`
          );
        }
        if (item.imageUrl) {
          const relativeAssetPath = item.imageUrl.replace(/^\//, '');
          const diskPath = join(process.cwd(), 'public', relativeAssetPath);
          if (!existsSync(diskPath)) {
            missingDiskFiles.push(`${character.name} -> ${item.name}: ${diskPath}`);
          }
        }
      });
    });

    expect(totalItems).toBe(27);
    expect(missingAssetItems).toEqual([]);
    expect(missingDiskFiles).toEqual([]);
  });

  it('naprawia błąd Issue #469: Dokumenty tożsamości mapują się na document.id-card zamiast listu w kopercie', () => {
    const idTemplate = findEquipmentTemplate('Dokumenty tożsamości');
    expect(idTemplate?.id).toBe('document.id-card');
    expect(idTemplate?.category).toBe('document');

    const letterTemplate = findEquipmentTemplate('List');
    expect(letterTemplate?.aliases).not.toContain('Dokumenty tożsamości');

    const item = applyCatalogTemplate(
      { id: 'test_doc', name: 'Dokumenty tożsamości', category: 'document' },
      'prl-1970s'
    );
    expect(item.templateId).toBe('document.id-card');
    // Nie może używać letter-shared.webp (koperta lakowa)
    expect(item.imageUrl).not.toBe('/equipment/catalog/letter-shared.webp');
    expect(item.imageUrl).toBe('/equipment/predefined/document.svg');
  });

  it('naprawia błąd Issue #469: Aparat fotograficzny w PRL nie używa anachronistycznego aparatu z 1920s', () => {
    const camera = findEquipmentTemplate('Aparat fotograficzny');
    expect(camera?.id).toBe('tool.camera');

    // W epoce 1920s ma dedykowany render
    expect(resolveCatalogAsset(camera, '1920s')).toBe('/equipment/catalog/camera-1920s.webp');

    // W epoce PRL ma własny aparat analogowy zamiast renderu z lat 20.
    expect(resolveCatalogAsset(camera, 'prl-1970s')).toBe('/equipment/catalog/camera-prl-1970s.webp');

    const appliedPrl = applyCatalogTemplate(
      { id: 'test_cam_prl', name: 'Aparat fotograficzny', category: 'tool' },
      'prl-1970s'
    );
    expect(appliedPrl.imageUrl).not.toBe('/equipment/catalog/camera-1920s.webp');
    expect(appliedPrl.imageUrl).toBe('/equipment/catalog/camera-prl-1970s.webp');
  });

  it('obsługuje tool.electronics-case-prl w epoce 2000s oraz modern bez odrzucania szablonu', () => {
    const template = findEquipmentTemplate('tool.electronics-case-prl');
    expect(template).toBeDefined();
    expect(template?.availableIn).toContain('2000s');
    expect(template?.availableIn).toContain('modern');

    expect(resolveCatalogAsset(template, '2000s')).toBe(
      '/equipment/catalog/electronics-case-prl.webp'
    );
    expect(resolveCatalogAsset(template, 'modern')).toBe(
      '/equipment/catalog/electronics-case-prl.webp'
    );

    const applied2000s = applyCatalogTemplate(
      {
        id: 'eq_piotr_test',
        templateId: 'tool.electronics-case-prl',
        name: 'Zestaw narzędzi do elektroniki',
        category: 'tool',
      },
      '2000s'
    );
    expect(applied2000s.imageUrl).toBe(
      '/equipment/catalog/electronics-case-prl.webp'
    );
    expect(applied2000s.visualSource).toBe('catalog');

    const appliedModern = applyCatalogTemplate(
      {
        id: 'eq_modern_test',
        templateId: 'tool.electronics-case-prl',
        name: 'Zestaw narzędzi w walizce',
        category: 'tool',
      },
      'modern'
    );
    expect(appliedModern.imageUrl).toBe(
      '/equipment/catalog/electronics-case-prl.webp'
    );
    expect(appliedModern.visualSource).toBe('catalog');
  });

  it('obsługuje tool.diy-emf-detector-prl w epoce 2000s i modern oraz poprawnie rozstrzyga wykrywacz domowej roboty Karoliny Maj', () => {
    const template = findEquipmentTemplate('tool.diy-emf-detector-prl');
    expect(template).toBeDefined();
    expect(template?.availableIn).toContain('2000s');
    expect(template?.availableIn).toContain('modern');

    const applied = applyCatalogTemplate(
      {
        id: 'eq_luna_detector',
        name: 'Wykrywacz pól elektromagnetycznych domowej roboty',
        category: 'tool',
      },
      '2000s'
    );
    expect(applied.imageUrl).toBe('/equipment/catalog/diy-emf-detector-prl.webp');
    expect(applied.visualSource).toBe('catalog');

    const luna = STREFA_11_CHARACTERS.find((c) => c.id === 'glogow_ufolog');
    expect(luna).toBeDefined();
    const detector = luna?.equipment?.find((e) => e.id === 'eq_luna_detector');
    expect(detector?.imageUrl).toBe('/equipment/catalog/diy-emf-detector-prl.webp');
    expect(detector?.visualSource).toBe('catalog');
  });

  it('mapuje "Dokumenty tożsamości" oraz formy pojedyncze do document.id-card, a nie do document.letter', () => {
    const template = findEquipmentTemplate('Dokumenty tożsamości');
    expect(template).toBeDefined();
    expect(template?.id).toBe('document.id-card');
    expect(template?.id).not.toBe('document.letter');

    expect(findEquipmentTemplate('Dokument tożsamości')?.id).toBe('document.id-card');
    expect(findEquipmentTemplate('Dowód tożsamości')?.id).toBe('document.id-card');
    expect(findEquipmentTemplate('Dowód osobisty')?.id).toBe('document.id-card');

    const applied = applyCatalogTemplate(
      {
        id: 'eq_id_test',
        name: 'Dokumenty tożsamości',
        category: 'document',
      },
      '1920s'
    );
    expect(applied.templateId).toBe('document.id-card');
    expect(applied.imageUrl).toBe('/equipment/predefined/document.svg');
  });
});
