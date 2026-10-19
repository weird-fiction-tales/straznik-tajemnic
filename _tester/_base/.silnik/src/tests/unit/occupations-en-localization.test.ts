import {
  OCCUPATIONS,
  OCCUPATION_DESCRIPTIONS,
  getLocalizedOccupationName,
  getLocalizedOccupationDescription,
} from '@/lib/data/character/occupations';

describe('Occupations English Localization (Issue #809 - Plaster 2)', () => {
  it('has exactly 94 occupations in OCCUPATIONS catalog', () => {
    expect(OCCUPATIONS.length).toBe(94);
  });

  it('provides an English name for all 94 occupations without Polish diacritics', () => {
    for (const occ of OCCUPATIONS) {
      const enName = getLocalizedOccupationName(occ, 'en');
      expect(enName).toBeDefined();
      expect(enName.trim().length).toBeGreaterThan(0);
      expect(enName).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
    }
  });

  it('provides an English description for all 94 occupations without Polish diacritics', () => {
    for (const occ of OCCUPATIONS) {
      const enDesc = getLocalizedOccupationDescription(occ.id, 'en');
      expect(enDesc).toBeDefined();
      expect(enDesc.trim().length).toBeGreaterThan(15);
      expect(enDesc).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
    }
  });

  it('correctly translates canonical CoC 7e occupation names bi-directionally (PL <-> EN)', () => {
    expect(getLocalizedOccupationName('Prywatny Detektyw', 'en')).toBe('Private Investigator');
    expect(getLocalizedOccupationName('Private Investigator', 'pl')).toBe('Prywatny Detektyw');

    expect(getLocalizedOccupationName('Antykwariusz', 'en')).toBe('Antiquarian');
    expect(getLocalizedOccupationName('Antiquarian', 'pl')).toBe('Antykwariusz');

    expect(getLocalizedOccupationName('Dziennikarz', 'en')).toBe('Journalist');
    expect(getLocalizedOccupationName('Journalist', 'pl')).toBe('Dziennikarz');

    expect(getLocalizedOccupationName('Lekarz', 'en')).toBe('Doctor of Medicine');
    expect(getLocalizedOccupationName('Doctor of Medicine', 'pl')).toBe('Lekarz');

    expect(getLocalizedOccupationName('Profesor', 'en')).toBe('Professor');
    expect(getLocalizedOccupationName('Professor', 'pl')).toBe('Profesor');
  });

  it('preserves Polish names and descriptions when locale is "pl"', () => {
    const occ = OCCUPATIONS.find((o) => o.id === 'antiquarian')!;
    expect(getLocalizedOccupationName(occ, 'pl')).toBe('Antykwariusz');
    expect(getLocalizedOccupationDescription('antiquarian', 'pl')).toBe(OCCUPATION_DESCRIPTIONS['antiquarian']);
  });
});
