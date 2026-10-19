import {
  OCCUPATION_EQUIPMENT,
  getStartingEquipmentForOccupation,
} from '@/lib/equipment-data';
import {
  EQUIPMENT_NAMES_EN,
  getLocalizedEquipmentName,
  getLocalizedEquipmentDescription,
} from '@/lib/data/character/equipment-localization';

describe('Equipment English Localization (Issue #813 - Plaster 4)', () => {
  it('provides an English translation for every unique occupation equipment item', () => {
    const allItems = new Set<string>();
    Object.values(OCCUPATION_EQUIPMENT).forEach((list) => {
      list.forEach((item) => allItems.add(item));
    });

    expect(allItems.size).toBeGreaterThanOrEqual(60);

    for (const item of allItems) {
      const enName = getLocalizedEquipmentName(item, 'en');
      expect(enName).toBeDefined();
      expect(enName.trim().length).toBeGreaterThan(0);
      expect(enName).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
    }
  });

  it('correctly maps canonical CoC 7e equipment bi-directionally (PL <-> EN)', () => {
    expect(getLocalizedEquipmentName('Lupa', 'en')).toBe('Magnifying Glass');
    expect(getLocalizedEquipmentName('Magnifying Glass', 'pl')).toBe('Lupa');

    expect(getLocalizedEquipmentName('Rewolwer .38', 'en')).toBe('.38 Revolver');
    expect(getLocalizedEquipmentName('.38 Revolver', 'pl')).toBe('Rewolwer .38');

    expect(getLocalizedEquipmentName('Zegarek kieszonkowy', 'en')).toBe('Pocket Watch');
    expect(getLocalizedEquipmentName('Pocket Watch', 'pl')).toBe('Zegarek kieszonkowy');

    expect(getLocalizedEquipmentName('Lina (15 m)', 'en')).toBe('Rope (50 ft)');
    expect(getLocalizedEquipmentName('Rope (50 ft)', 'pl')).toBe('Lina (15 m)');

    expect(getLocalizedEquipmentName('Apteczka', 'en')).toBe('First Aid Kit');
    expect(getLocalizedEquipmentName('First Aid Kit', 'pl')).toBe('Apteczka');

    expect(getLocalizedEquipmentName('Latarka', 'en')).toBe('Flashlight');
    expect(getLocalizedEquipmentName('Flashlight', 'pl')).toBe('Latarka');

    expect(getLocalizedEquipmentName('Wytrychy', 'en')).toBe('Lockpicks');
    expect(getLocalizedEquipmentName('Lockpicks', 'pl')).toBe('Wytrychy');
  });

  it('preserves Polish names when locale is "pl"', () => {
    expect(getLocalizedEquipmentName('Lupa', 'pl')).toBe('Lupa');
    expect(getLocalizedEquipmentName('Rewolwer .38', 'pl')).toBe('Rewolwer .38');
    expect(getLocalizedEquipmentName('Książki źródłowe', 'pl')).toBe('Książki źródłowe');
  });

  it('provides English starting equipment lists for occupations when locale is "en"', () => {
    const plEq = getStartingEquipmentForOccupation('antiquarian', 'pl');
    expect(plEq).toEqual(['Lupa', 'Książki źródłowe']);

    const enEq = getStartingEquipmentForOccupation('antiquarian', 'en');
    expect(enEq).toEqual(['Magnifying Glass', 'Reference Books']);

    // Default backward compatibility (no locale arg = Polish)
    expect(getStartingEquipmentForOccupation('antiquarian')).toEqual(plEq);
  });

  it('provides atmospheric English equipment descriptions without Polish diacritics', () => {
    const sampleItems = [
      { name: 'Lupa', description: 'Duża szklana soczewka w mosiężnej oprawie.' },
      { name: 'Rewolwer .38', description: 'Standardowy rewolwer policyjny.' },
      { name: 'Apteczka', description: 'Bandaże, jodyna i środki dezynfekujące.' },
      { name: 'Latarka', description: 'Poręczna latarka z baterią.' },
    ];

    for (const item of sampleItems) {
      const enDesc = getLocalizedEquipmentDescription(item, 'en');
      expect(enDesc).toBeDefined();
      expect(enDesc.length).toBeGreaterThan(15);
      expect(enDesc).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);

      const plDesc = getLocalizedEquipmentDescription(item, 'pl');
      expect(plDesc).toBe(item.description);
    }
  });
});
