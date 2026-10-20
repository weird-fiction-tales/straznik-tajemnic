import {
  isVisualPromptLeak,
  sanitizeLocationName,
  extractLatestTagLocation,
  extractLocations,
  extractDreamVisionTag,
} from './event-parser';

describe('event-parser (Visual Prompt Leak & Location Sanitization)', () => {
  describe('isVisualPromptLeak', () => {
    it('wykrywa wycieki technicznych promptów obrazów', () => {
      expect(
        isVisualPromptLeak(
          'Kowary Mountain Cafe, 1990s authentic Poland, interior of a modest roadside diner in winter, misty Sudetes mountains through foggy windows, cast iron radiator, vintage furniture, 35mm film photograph'
        )
      ).toBe(true);
      expect(
        isVisualPromptLeak('Scena #1: Kowary Mountain Cafe, 35mm film photograph')
      ).toBe(true);
      expect(isVisualPromptLeak('cinematic lighting, moody lighting, wide angle')).toBe(
        true
      );
    });

    it('zwraca false dla poprawnych nazw lokacji CoC', () => {
      expect(isVisualPromptLeak('Kawiarnia „Śnieżka” w Kowarach')).toBe(false);
      expect(isVisualPromptLeak('Warsztat Lucjana Łągiewki')).toBe(false);
      expect(isVisualPromptLeak('Sztolnia Podgórze')).toBe(false);
    });
  });

  describe('sanitizeLocationName', () => {
    it('usuwa prefiks Lokacja: oraz cudzysłowy i techniczne ogony', () => {
      expect(
        sanitizeLocationName('Lokacja: Kawiarnia „Śnieżka” w Kowarach')
      ).toBe('Kawiarnia Śnieżka w Kowarach');
      expect(
        sanitizeLocationName('Kawiarnia Śnieżka, 1990s authentic Poland, 35mm')
      ).toBe('Kawiarnia Śnieżka');
      expect(
        sanitizeLocationName('Miskatonic University Library, towering gothic bookshelves, dust motes')
      ).toBe('Miskatonic University Library');
      expect(
        sanitizeLocationName('Wylot Doliny Białego | misty mountain path, dense pine trees')
      ).toBe('Wylot Doliny Białego');
    });
  });

  describe('extractLatestTagLocation', () => {
    it('pomija tagi będące wyciekiem promptu i zachowuje prawidłową lokację', () => {
      const text = [
        '[LOKACJA: Kawiarnia „Śnieżka” w Kowarach: Skromny lokal]',
        '',
        '[LOKACJA: Kowary Mountain Cafe, 1990s authentic Poland, interior of a modest roadside diner in winter, misty Sudetes mountains through foggy windows, cast iron radiator, vintage furniture, 35mm film photograph]',
        '',
        'Narracja...',
      ].join('\n');

      const loc = extractLatestTagLocation(text);
      expect(loc).not.toBeNull();
      expect(loc?.name).toBe('Kawiarnia Śnieżka w Kowarach');
      expect(loc?.description).toBe('Skromny lokal');
    });

    it('obsługuje nowy format z separatorem pionowej kreski [LOKACJA: Nazwa | Prompt]', () => {
      const text = 'Wchodzisz na szlak. [LOKACJA: Wylot Doliny Białego | misty mountain path, dense pine trees, ominous fog, vintage photograph] Co robisz?';
      const loc = extractLatestTagLocation(text);
      expect(loc).not.toBeNull();
      expect(loc?.name).toBe('Wylot Doliny Białego');
      expect(loc?.description).toBe('misty mountain path, dense pine trees, ominous fog, vintage photograph');
    });

    it('obsługuje angielski tag z separatorem pionowej kreski [LOCATION: Name | Visual Prompt]', () => {
      const text = 'You step into the building. [LOCATION: Boston Harbor | cold morning mist rising over dark water, 1920s vintage photograph] What do you do?';
      const loc = extractLatestTagLocation(text);
      expect(loc).not.toBeNull();
      expect(loc?.name).toBe('Boston Harbor');
      expect(loc?.description).toBe('cold morning mist rising over dark water, 1920s vintage photograph');
    });

    it('naprawia wyciek przy przecinku w tagu ze starego przykładu (Issue #570 repro)', () => {
      const text = 'Docierasz na miejsce. [LOKACJA: Miskatonic University Library, towering gothic bookshelves, dust motes dancing in shafts of pale sunlight, dark mahogany study tables] Czekasz.';
      const loc = extractLatestTagLocation(text);
      expect(loc).not.toBeNull();
      expect(loc?.name).toBe('Miskatonic University Library');
      expect(loc?.name.length).toBeLessThanOrEqual(45);
    });
  });

  describe('extractLocations', () => {
    it('nie tworzy wydarzeń lokacyjnych dla wycieków promptów', () => {
      const text =
        'Przybywasz do Kowary Mountain Cafe, 1990s authentic Poland, 35mm film photograph.';
      const locs = extractLocations(text);
      expect(locs).toHaveLength(0);
    });
  });

  describe('extractDreamVisionTag', () => {
    it('wyłuskuje znacznik [SEN: dark-cabin | Thomas] z poprawnymi polami', () => {
      const text =
        'Zapadła głęboka noc. [SEN: dark-cabin | Thomas] Budzisz się zlany potem.';
      const res = extractDreamVisionTag(text);
      expect(res).not.toBeNull();
      expect(res?.variantId).toBe('dark-cabin');
      expect(res?.investigatorName).toBe('Thomas');
      expect(res?.nightNumber).toBe(1);
    });

    it('obsługuje alternatywne prefiksy [SENNE_WEZWANIE: ...] i numery nocy', () => {
      const text =
        '[SENNE_WEZWANIE: Coś w jeziorze | Arthur | noc=2] Woda bulgocze w ciemności.';
      const res = extractDreamVisionTag(text);
      expect(res).not.toBeNull();
      expect(res?.variantId).toBe('thing-in-lake');
      expect(res?.investigatorName).toBe('Arthur');
      expect(res?.nightNumber).toBe(2);
    });

    it('obsługuje wariant 3 (Ścieżka przez las)', () => {
      const text = '[DREAM: 3] Widzisz zarośniętą ścieżkę.';
      const res = extractDreamVisionTag(text);
      expect(res).not.toBeNull();
      expect(res?.variantId).toBe('forest-path');
    });

    it('zwraca null gdy w tekście nie ma znacznika snu', () => {
      const text = 'Siedzicie przy ognisku, rozmawiając o dalszych planach.';
      expect(extractDreamVisionTag(text)).toBeNull();
    });
  });
});

