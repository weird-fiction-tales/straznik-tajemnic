import { act, renderHook } from '@testing-library/react';
import type { Character, EquipmentItem, AdventureContext } from '@/lib/types';
import { fetchWithApiKeys } from '@/lib/api-keys-service';
import { persistCharacters } from '@/lib/character-cloud-sync';
import { useEquipmentThumbnails } from './useEquipmentThumbnails';

jest.mock('@/lib/api-keys-service', () => ({
  fetchWithApiKeys: jest.fn(),
  isPureTextMode: jest.fn(() => false),
}));

jest.mock('@/lib/character-cloud-sync', () => ({
  persistCharacters: jest.fn(),
}));

const catalogFlashlight: EquipmentItem = {
  id: 'catalog-flashlight',
  name: 'Latarka',
  category: 'tool',
  source: 'starting',
  templateId: 'light.flashlight',
  visualSource: 'catalog',
  imageUrl: '/equipment/catalog/flashlight-1920s.webp',
};

const character = {
  id: 'investigator-1',
  name: 'Janina Różycka',
  equipment: [catalogFlashlight],
} as Character;

describe('useEquipmentThumbnails', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('nie wywołuje API obrazu dla lokalnego assetu katalogowego', async () => {
    const setActiveCharacter = jest.fn();
    const setCharacters = jest.fn();
    const { result } = renderHook(() =>
      useEquipmentThumbnails({
        activeCharacter: character,
        adventureContext: null,
        imageGenerationEnabled: true,
        setActiveCharacter,
        setCharacters,
      })
    );

    await act(async () => {
      await result.current.generateThumbnailsInBackground();
    });

    expect(fetchWithApiKeys).not.toHaveBeenCalled();
    expect(setActiveCharacter).not.toHaveBeenCalled();
    expect(setCharacters).not.toHaveBeenCalled();
  });

  it('automatycznie przypisuje lokalny asset WebP z katalogu bez wywołania API', async () => {
    const startingCharacter = {
      ...character,
      equipment: [
        {
          id: 'starting-laptop',
          name: 'Ciężki laptop z wczesnym Wi-Fi',
          category: 'tool',
          source: 'starting',
          visualSource: 'fallback',
          imageUrl: '/equipment/predefined/tool.svg',
        },
      ],
    } as Character;
    let characters = [startingCharacter];
    let activeCharacter: Character | null = startingCharacter;
    const setCharacters = jest.fn((update) => {
      characters = update(characters);
    });
    const setActiveCharacter = jest.fn((update) => {
      activeCharacter = update(activeCharacter);
    });

    const { result } = renderHook(() =>
      useEquipmentThumbnails({
        activeCharacter: startingCharacter,
        adventureContext: { yearRange: '2001-2005' } as unknown as AdventureContext,
        imageGenerationEnabled: true,
        setActiveCharacter,
        setCharacters,
      })
    );

    await act(async () => {
      await result.current.generateThumbnailsInBackground();
    });

    expect(fetchWithApiKeys).not.toHaveBeenCalled();
    expect(characters[0].equipment?.[0]).toMatchObject({
      imageUrl: '/equipment/catalog/heavy-laptop-wifi-1990s.webp',
      visualSource: 'catalog',
    });
    expect(activeCharacter?.equipment?.[0]).toMatchObject({
      imageUrl: '/equipment/catalog/heavy-laptop-wifi-1990s.webp',
      visualSource: 'catalog',
    });
  });

  it.each([false, true])('naprawia obrazy PRL mimo pustego znacznika generated bez żądania API (generacja=%s)', async (enabled) => {
    const savedCharacter = {
      ...character,
      equipment: [
        { id: 'saved-flashlight', name: 'Latarka', category: 'tool', visualSource: 'generated' },
        { id: 'saved-camera', name: 'Aparat fotograficzny', category: 'tool', visualSource: 'generated', imageUrl: '/equipment/predefined/tool.svg' },
        { id: 'saved-compass', name: 'Kompas', category: 'tool', visualSource: 'fallback' },
        { id: 'own-image', name: 'Latarka', category: 'tool', visualSource: 'generated', imageUrl: 'data:image/webp;base64,own' },
      ],
    } as Character;
    let characters = [savedCharacter];
    let activeCharacter: Character | null = savedCharacter;
    const setCharacters = jest.fn((update) => { characters = update(characters); });
    const setActiveCharacter = jest.fn((update) => { activeCharacter = update(activeCharacter); });
    const { result } = renderHook(() => useEquipmentThumbnails({
      activeCharacter: savedCharacter,
      adventureContext: { yearRange: '1973-1974' } as AdventureContext,
      imageGenerationEnabled: enabled,
      setActiveCharacter,
      setCharacters,
    }));

    await act(async () => { await result.current.generateThumbnailsInBackground(); });

    expect(characters[0].equipment?.map(item => item.imageUrl)).toEqual([
      '/equipment/catalog/police-flashlight-prl.webp',
      '/equipment/catalog/camera-prl-1970s.webp',
      '/equipment/catalog/compass-shared.webp',
      'data:image/webp;base64,own',
    ]);
    expect(activeCharacter?.equipment).toEqual(characters[0].equipment);
    expect(persistCharacters).toHaveBeenCalledWith(characters);
    expect(fetchWithApiKeys).not.toHaveBeenCalled();
  });

  it('nie generuje zastępczego obrazu znanego materiału teczki bez ilustracji', async () => {
    const dossierCharacter = {
      ...character,
      equipment: [{ id: 'dossier-photo', name: 'Fotografia', category: 'document', source: 'found',
        dossierBinding: { adventureId: 'cien-nad-prabutami', editionFingerprint: 'sha256:edition', recordId: 'photo-item' } }],
    } as Character;
    const { result } = renderHook(() => useEquipmentThumbnails({
      activeCharacter: dossierCharacter,
      adventureContext: { yearRange: '1973-1974' } as AdventureContext,
      imageGenerationEnabled: true,
      setActiveCharacter: jest.fn(), setCharacters: jest.fn(),
    }));
    await act(async () => { await result.current.generateThumbnailsInBackground(); });
    expect(fetchWithApiKeys).not.toHaveBeenCalled();
  });

  it('wywołuje API generowania dla przedmiotu startowego bez lokalnego assetu w katalogu', async () => {
    const fallbackCharacter = {
      ...character,
      equipment: [
        {
          id: 'starting-recorder',
          name: 'Dyktafon na mikrokasety',
          category: 'tool',
          source: 'starting',
          visualSource: 'fallback',
          imageUrl: '/equipment/predefined/tool.svg',
        },
      ],
    } as Character;
    const { result } = renderHook(() =>
      useEquipmentThumbnails({
        activeCharacter: fallbackCharacter,
        adventureContext: null,
        imageGenerationEnabled: true,
        setActiveCharacter: jest.fn(),
        setCharacters: jest.fn(),
      })
    );

    await act(async () => {
      await result.current.generateThumbnailsInBackground();
    });

    expect(fetchWithApiKeys).toHaveBeenCalledTimes(1);
  });

  it('nie wywołuje API, gdy generowanie obrazów jest wyłączone', async () => {
    const storyItemCharacter = {
      ...character,
      equipment: [
        {
          id: 'found-key',
          name: 'Klucz z piwnicy',
          category: 'personal',
          source: 'found',
        },
      ],
    } as Character;
    const setActiveCharacter = jest.fn();
    const setCharacters = jest.fn();
    const { result } = renderHook(() =>
      useEquipmentThumbnails({
        activeCharacter: storyItemCharacter,
        adventureContext: null,
        imageGenerationEnabled: false,
        setActiveCharacter,
        setCharacters,
      })
    );

    await act(async () => {
      await result.current.generateThumbnailsInBackground();
    });

    expect(fetchWithApiKeys).not.toHaveBeenCalled();
    expect(setActiveCharacter).not.toHaveBeenCalled();
    expect(setCharacters).not.toHaveBeenCalled();
  });

  it('zapisuje obraz, prompt i źródło wygenerowane w obu stanach postaci', async () => {
    const storyCharacter = {
      ...character,
      equipment: [
        {
          id: 'found-key',
          name: 'Klucz z piwnicy',
          category: 'personal',
          source: 'found',
        },
      ],
    } as Character;
    let characters = [storyCharacter];
    let activeCharacter: Character | null = storyCharacter;
    const setCharacters = jest.fn((update) => {
      characters = update(characters);
    });
    const setActiveCharacter = jest.fn((update) => {
      activeCharacter = update(activeCharacter);
    });
    jest.mocked(fetchWithApiKeys).mockResolvedValue({
      ok: true,
      json: async () => ({ imageUrl: 'data:image/webp;base64,abc' }),
    } as Response);

    const { result } = renderHook(() =>
      useEquipmentThumbnails({
        activeCharacter: storyCharacter,
        adventureContext: null,
        imageGenerationEnabled: true,
        setActiveCharacter,
        setCharacters,
      })
    );

    await act(async () => {
      await result.current.generateThumbnailsInBackground();
    });

    expect(fetchWithApiKeys).toHaveBeenCalledTimes(1);
    expect(characters[0].equipment?.[0]).toMatchObject({
      imageUrl: 'data:image/webp;base64,abc',
      imagePrompt: expect.any(String),
      visualSource: 'generated',
    });
    expect(activeCharacter?.equipment?.[0]).toMatchObject({
      imageUrl: 'data:image/webp;base64,abc',
      imagePrompt: expect.any(String),
      visualSource: 'generated',
    });
    expect(persistCharacters).toHaveBeenCalledTimes(1);
  });

  it('nie uruchamia drugiej kolejki dla tej samej postaci', async () => {
    const storyCharacter = {
      ...character,
      equipment: [
        {
          id: 'found-key',
          name: 'Klucz z piwnicy',
          category: 'personal',
          source: 'found',
        },
      ],
    } as Character;
    let resolveFetch!: (response: Response) => void;
    jest.mocked(fetchWithApiKeys).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );
    const { result } = renderHook(() =>
      useEquipmentThumbnails({
        activeCharacter: storyCharacter,
        adventureContext: null,
        imageGenerationEnabled: true,
        setActiveCharacter: jest.fn(),
        setCharacters: jest.fn(),
      })
    );

    let firstRun!: Promise<void>;
    let secondRun!: Promise<void>;
    act(() => {
      firstRun = result.current.generateThumbnailsInBackground();
      secondRun = result.current.generateThumbnailsInBackground();
    });

    expect(fetchWithApiKeys).toHaveBeenCalledTimes(1);
    resolveFetch({ ok: false } as Response);
    await act(async () => {
      await Promise.all([firstRun, secondRun]);
    });
    expect(fetchWithApiKeys).toHaveBeenCalledTimes(1);
  });

  it('zatrzymuje kolejne żądania po wyłączeniu obrazów w trakcie kolejki', async () => {
    const storyCharacter = {
      ...character,
      equipment: [
        { id: 'item-1', name: 'Klucz', category: 'personal', source: 'found' },
        { id: 'item-2', name: 'Sygnet', category: 'personal', source: 'found' },
      ],
    } as Character;
    let resolveFetch!: (response: Response) => void;
    jest.mocked(fetchWithApiKeys).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );
    const setActiveCharacter = jest.fn();
    const setCharacters = jest.fn();
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useEquipmentThumbnails({
          activeCharacter: storyCharacter,
          adventureContext: null,
          imageGenerationEnabled: enabled,
          setActiveCharacter,
          setCharacters,
        }),
      { initialProps: { enabled: true } }
    );

    let run!: Promise<void>;
    act(() => {
      run = result.current.generateThumbnailsInBackground();
    });
    expect(fetchWithApiKeys).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    resolveFetch({ ok: false } as Response);
    await act(async () => {
      await run;
    });

    expect(fetchWithApiKeys).toHaveBeenCalledTimes(1);
  });

  it('przekazuje style="horror" dla przedmiotów nadprzyrodzonych oraz oznacza visualSource="fallback" przy błędzie API (Issue #567)', async () => {
    const supernaturalCharacter = {
      ...character,
      equipment: [
        {
          id: 'cursed-stone',
          name: 'Czarny kamień z piwnicy',
          category: 'artifact',
          source: 'acquired',
          acquiredFrom: 'acquired',
          visualTreatment: 'supernatural',
          imageUrl: '/equipment/predefined/artifact.svg',
        },
      ],
    } as Character;
    let characters = [supernaturalCharacter];
    let activeCharacter: Character | null = supernaturalCharacter;
    const setCharacters = jest.fn((update) => {
      characters = update(characters);
    });
    const setActiveCharacter = jest.fn((update) => {
      activeCharacter = update(activeCharacter);
    });

    jest.mocked(fetchWithApiKeys).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const { result } = renderHook(() =>
      useEquipmentThumbnails({
        activeCharacter: supernaturalCharacter,
        adventureContext: { yearRange: '1920s' } as unknown as AdventureContext,
        imageGenerationEnabled: true,
        setActiveCharacter,
        setCharacters,
      })
    );

    await act(async () => {
      await result.current.generateThumbnailsInBackground();
    });

    expect(fetchWithApiKeys).toHaveBeenCalledWith(
      '/api/imagen',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"style":"horror"'),
      })
    );
    expect(characters[0].equipment?.[0].visualSource).toBe('fallback');
    expect(activeCharacter?.equipment?.[0].visualSource).toBe('fallback');
  });

  it('izoluje miniatury per epoka i podmienia anachronistyczny asset na właściwy wariant lub fallback SVG (Issue #503)', async () => {
    const characterWithAnachronisticItem = {
      ...character,
      equipment: [
        {
          id: 'test-lantern',
          name: 'Lampa naftowa',
          category: 'tool',
          source: 'starting',
          templateId: 'light.oil-lantern',
          eraVariantId: 'light.oil-lantern-1920s',
          visualSource: 'catalog',
          imageUrl: '/equipment/catalog/oil-lantern-1920s.webp',
        },
      ],
    } as Character;

    let characters = [characterWithAnachronisticItem];
    let activeCharacter: Character | null = characterWithAnachronisticItem;
    const setCharacters = jest.fn((update) => {
      characters = update(characters);
    });
    const setActiveCharacter = jest.fn((update) => {
      activeCharacter = update(activeCharacter);
    });

    // Przenosimy postać do 1890s (Gaslight), gdzie lampa naftowa ma dedykowany wariant 1890s
    const { result } = renderHook(() =>
      useEquipmentThumbnails({
        activeCharacter: characterWithAnachronisticItem,
        adventureContext: { yearRange: '1890s' } as unknown as AdventureContext,
        imageGenerationEnabled: false,
        setActiveCharacter,
        setCharacters,
      })
    );

    await act(async () => {
      await result.current.generateThumbnailsInBackground();
    });

    expect(characters[0].equipment?.[0]).toMatchObject({
      imageUrl: '/equipment/catalog/oil-lantern-1890s.webp',
      eraVariantId: 'light.oil-lantern-1890s',
      visualSource: 'catalog',
    });
    expect(activeCharacter?.equipment?.[0]).toMatchObject({
      imageUrl: '/equipment/catalog/oil-lantern-1890s.webp',
      eraVariantId: 'light.oil-lantern-1890s',
      visualSource: 'catalog',
    });
  });
});

