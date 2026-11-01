import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PREDEFINED_CHARACTERS } from './predefined-characters';
import {
  STREFA_11_CHARACTERS,
  getStrefa11CharactersForAdventure,
} from './strefa-11-characters';
import { buildPredefinedEquipment } from './predefined-equipment';
import {
  CATEGORY_FALLBACK_ASSETS,
  findEquipmentTemplate,
  resolveCatalogAsset,
} from '@/lib/equipment-catalog';
import type { EquipmentVisualEra } from '@/lib/types';

const VISUAL_ERAS: Record<string, EquipmentVisualEra> = {
  gaslight: '1890s',
  classic: '1920s',
  noir: '1940s',
  prl: 'prl-1970s',
  'prl-1970s': 'prl-1970s',
  '1990s': 'modern',
  '2000s': 'modern',
  modern: 'modern',
};

describe('PREDEFINED_CHARACTERS', () => {
  it('keeps the universal and Strefa 11 pools disjoint', () => {
    const universalIds = new Set(PREDEFINED_CHARACTERS.map((character) => character.id));
    expect(PREDEFINED_CHARACTERS).toHaveLength(30);
    expect(STREFA_11_CHARACTERS.every((character) => !universalIds.has(character.id))).toBe(true);
  });

  it('assigns every Strefa 11 preset explicitly to one scenario', () => {
    const assignedIds = new Set(
      [
        'cien-nad-prabutami',
        'tajemnica-pendnika-lagiewki',
        'tajemnica-dzieci-z-traszyna',
        'przybysz-z-matriksa-glogow',
      ].flatMap((adventureId) =>
        getStrefa11CharactersForAdventure(adventureId).map((character) => character.id)
      )
    );

    expect(assignedIds.size).toBe(STREFA_11_CHARACTERS.length);
    expect(STREFA_11_CHARACTERS.every((character) => character.scenarioIds?.length === 1)).toBe(true);
  });
  it('zapewnia każdemu badaczowi pełną biografię i rozbudowany ekwipunek', () => {
    expect(PREDEFINED_CHARACTERS).toHaveLength(30);

    PREDEFINED_CHARACTERS.forEach((character) => {
      expect(character.background.trim().length).toBeGreaterThan(40);
      expect(character.equipment?.length).toBeGreaterThanOrEqual(6);

      const names = (character.equipment ?? []).map((item) =>
        item.name.toLocaleLowerCase('pl-PL')
      );
      expect(new Set(names).size).toBe(names.length);
    });
  });

  it('zapewnia gotowych badaczy dla podstawowych epok (gaslight, classic, modern)', () => {
    expect(PREDEFINED_CHARACTERS.filter((c) => c.era === 'gaslight')).toHaveLength(10);
    expect(PREDEFINED_CHARACTERS.filter((c) => c.era === 'classic')).toHaveLength(10);
    expect(PREDEFINED_CHARACTERS.filter((c) => c.era === 'modern')).toHaveLength(10);
  });

  it('wskazuje indywidualne, istniejące portrety dla nowych epok', () => {
    PREDEFINED_CHARACTERS.filter(
      (character) => character.era === 'gaslight' || character.era === 'classic' || character.era === 'modern'
    ).forEach((character) => {
      expect(character.portraitUrl).toMatch(
        /^\/portraits\/predefined\/.+\.webp$/
      );
      if (
        !existsSync(
          join(process.cwd(), 'public', character.portraitUrl!.slice(1))
        )
      ) {
        throw new Error(
          `Missing portrait for ${character.name}: ${character.portraitUrl}`
        );
      }
    });
  });

  it('wskazuje istniejący, unikalny portret dla każdego aktywnego presetu', () => {
    const activeCharacters = [
      ...PREDEFINED_CHARACTERS,
      ...STREFA_11_CHARACTERS,
    ];
    const portraitUrls = activeCharacters.map((character) => character.portraitUrl);

    expect(activeCharacters).toHaveLength(46);
    expect(new Set(portraitUrls).size).toBe(activeCharacters.length);
    activeCharacters.forEach((character) => {
      expect(character.portraitUrl).toMatch(/^\/portraits\/predefined\/.+\.webp$/);
      expect(
        existsSync(join(process.cwd(), 'public', character.portraitUrl!.slice(1)))
      ).toBe(true);
    });
  });

  it('przypisuje portrety PRL 1973-1974 do postaci z Cienia nad Prabutami', () => {
    const portraitsById = new Map(
      getStrefa11CharactersForAdventure('cien-nad-prabutami').map((character) => [
        character.id,
        character.portraitUrl,
      ])
    );

    expect(portraitsById).toEqual(
      new Map([
        ['strefa11_tomasz_nowicki', '/portraits/predefined/tomasz_nowicki.webp'],
        ['strefa11_helena_krawczyk', '/portraits/predefined/helena_krawczyk.webp'],
        ['strefa11_barbara_zawadzka', '/portraits/predefined/barbara_zawadzka.webp'],
        ['strefa11_ryszard_klucznik', '/portraits/predefined/ryszard_kaczmarek.webp'],
      ])
    );
  });

  it('nie kieruje wyposażenia startowego do generatora obrazów', () => {
    [...PREDEFINED_CHARACTERS, ...STREFA_11_CHARACTERS].forEach((character) => {
      character.equipment?.forEach((item) => {
        expect(item.source).toBe('starting');
        expect(item.imageUrl).toMatch(
          /^\/equipment\/(?:catalog\/.+\.webp|predefined\/[a-z]+\.svg)$/
        );
        expect(item.visualSource).not.toBe('generated');
        expect(
          existsSync(join(process.cwd(), 'public', item.imageUrl!.slice(1)))
        ).toBe(true);
      });
    });
  });

  it('używa wyłącznie istniejących lokalnych miniatur ekwipunku dla przedmiotów katalogowych', () => {
    PREDEFINED_CHARACTERS.forEach((character) => {
      character.equipment?.forEach((item) => {
        if (!item.imageUrl) return;
        expect(item.imageUrl).toMatch(
          /^\/equipment\/(?:catalog\/.+\.webp|predefined\/[a-z]+\.svg)$/
        );
        expect(
          existsSync(join(process.cwd(), 'public', item.imageUrl!.slice(1)))
        ).toBe(true);

        const template = findEquipmentTemplate(item.templateId);
        if (template) {
          expect(item.imageUrl).toBe(
            resolveCatalogAsset(template, VISUAL_ERAS[character.era]) ??
              CATEGORY_FALLBACK_ASSETS[template.category]
          );
        }
      });
    });
  });

  it('przypisuje właściwe epoki historyczne do postaci ze Strefy 11 bez cichego modern', () => {
    const prabuty = getStrefa11CharactersForAdventure('cien-nad-prabutami');
    expect(prabuty).toHaveLength(4);
    expect(prabuty.every((c) => c.era === 'prl-1970s')).toBe(true);

    const kowary = getStrefa11CharactersForAdventure('tajemnica-pendnika-lagiewki');
    expect(kowary).toHaveLength(4);
    expect(kowary.every((c) => c.era === '1990s')).toBe(true);

    const traszyn = getStrefa11CharactersForAdventure('tajemnica-dzieci-z-traszyna');
    expect(traszyn).toHaveLength(4);
    expect(traszyn.every((c) => c.era === '1990s')).toBe(true);

    const glogow = getStrefa11CharactersForAdventure('przybysz-z-matriksa-glogow');
    expect(glogow).toHaveLength(4);
    expect(glogow.every((c) => c.era === '2000s')).toBe(true);

    expect(STREFA_11_CHARACTERS.some((c) => c.era === 'modern')).toBe(false);
  });

  it('deterministycznie dobiera wyposażenie epokowe i eliminuje anachronizmy (smartfon, powerbank)', () => {
    // Andrzej Zalewski z Traszyna (lata 90.)
    const andrzej = STREFA_11_CHARACTERS.find((c) => c.id === 'traszyn_terapeuta');
    expect(andrzej).toBeDefined();
    const andrzejEq = buildPredefinedEquipment(andrzej!, '1990s');
    const andrzejItemNames = andrzejEq.map((i) => i.name.toLowerCase());

    expect(andrzejItemNames).not.toContain('smartfon z ładowarką'.toLowerCase());
    expect(andrzejItemNames).not.toContain('powerbank'.toLowerCase());
    expect(andrzejItemNames).toContain('telefon komórkowy (cegła)'.toLowerCase());
    expect(andrzejItemNames).toContain('wahadełko z kryształem'.toLowerCase());

    // Badacze z Cienia nad Prabutami (1973 PRL)
    const prabutyChars = getStrefa11CharactersForAdventure('cien-nad-prabutami');
    prabutyChars.forEach((c) => {
      const eq = buildPredefinedEquipment(c, 'prl-1970s');
      const names = eq.map((i) => i.name.toLowerCase());
      expect(names).not.toContain('smartfon z ładowarką'.toLowerCase());
      expect(names).not.toContain('powerbank'.toLowerCase());
      expect(names).not.toContain('telefon komórkowy (cegła)'.toLowerCase());
      expect(eq.some((item) => /latark/i.test(item.name))).toBe(true);
      expect(names).toContain('kieszonkowa apteczka'.toLowerCase());
      expect(names).not.toContain('notes badawczy'.toLowerCase());
      expect(names).not.toContain('koperty na dowody'.toLowerCase());
    });
  });

  it('zapewnia pełną siatkę umiejętności CoC 7e RAW dla postaci Strefy 11', () => {
    STREFA_11_CHARACTERS.forEach((character) => {
      const skillKeys = Object.keys(character.skills);
      expect(skillKeys.length).toBeGreaterThanOrEqual(10);
      expect(character.skills['Unik']).toBeDefined();
      expect(character.skills['Język Ojczysty (Polski)']).toBeDefined();
      expect(character.skills['Spostrzegawczość']).toBeDefined();

      // Zgodność Uniku z zasadą RAW (bazowo DEX/2 lub więcej z punktów)
      const rawDodgeBase = Math.floor(character.dex / 2);
      const characterDodge = typeof character.skills['Unik'] === 'number'
        ? character.skills['Unik']
        : character.skills['Unik'].value;
      expect(characterDodge).toBeGreaterThanOrEqual(rawDodgeBase);
    });
  });
});

