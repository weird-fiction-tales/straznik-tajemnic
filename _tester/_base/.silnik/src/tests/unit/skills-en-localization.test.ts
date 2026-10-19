import {
  BASE_SKILLS,
  SKILL_DESCRIPTIONS,
  getLocalizedSkillName,
  getLocalizedSkillDescription,
} from '@/lib/data/character/skills';

describe('Skills English Localization (Issue #811 - Plaster 3)', () => {
  it('has exactly 59 canonical skills in BASE_SKILLS', () => {
    expect(Object.keys(BASE_SKILLS).length).toBe(59);
  });

  it('provides an English name for all 59 skills without Polish diacritics', () => {
    for (const skill of Object.keys(BASE_SKILLS)) {
      const enName = getLocalizedSkillName(skill, 'en');
      expect(enName).toBeDefined();
      expect(enName.trim().length).toBeGreaterThan(0);
      expect(enName).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
    }
  });

  it('provides an English description for all 59 skills without Polish diacritics', () => {
    for (const skill of Object.keys(BASE_SKILLS)) {
      const enDesc = getLocalizedSkillDescription(skill, 'en');
      expect(enDesc).toBeDefined();
      expect(enDesc.trim().length).toBeGreaterThan(15);
      expect(enDesc).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
    }
  });

  it('correctly translates canonical CoC 7e skills bi-directionally (PL <-> EN)', () => {
    expect(getLocalizedSkillName('Spostrzegawczość', 'en')).toBe('Spot Hidden');
    expect(getLocalizedSkillName('Spot Hidden', 'pl')).toBe('Spostrzegawczość');

    expect(getLocalizedSkillName('Biblioteka', 'en')).toBe('Library Use');
    expect(getLocalizedSkillName('Library Use', 'pl')).toBe('Biblioteka');

    expect(getLocalizedSkillName('Walka Wręcz (Bijatyka)', 'en')).toBe('Fighting (Brawl)');
    expect(getLocalizedSkillName('Fighting (Brawl)', 'pl')).toBe('Walka Wręcz (Bijatyka)');

    expect(getLocalizedSkillName('Broń Palna (Krótka)', 'en')).toBe('Firearms (Handgun)');
    expect(getLocalizedSkillName('Firearms (Handgun)', 'pl')).toBe('Broń Palna (Krótka)');

    expect(getLocalizedSkillName('Majętność', 'en')).toBe('Credit Rating');
    expect(getLocalizedSkillName('Credit Rating', 'pl')).toBe('Majętność');

    expect(getLocalizedSkillName('Ślusarstwo', 'en')).toBe('Locksmith');
    expect(getLocalizedSkillName('Locksmith', 'pl')).toBe('Ślusarstwo');

    expect(getLocalizedSkillName('Zręczne Palce', 'en')).toBe('Sleight of Hand');
    expect(getLocalizedSkillName('Sleight of Hand', 'pl')).toBe('Zręczne Palce');

    expect(getLocalizedSkillName('Pierwsza Pomoc', 'en')).toBe('First Aid');
    expect(getLocalizedSkillName('First Aid', 'pl')).toBe('Pierwsza Pomoc');

    expect(getLocalizedSkillName('Gadanina', 'en')).toBe('Fast Talk');
    expect(getLocalizedSkillName('Fast Talk', 'pl')).toBe('Gadanina');

    expect(getLocalizedSkillName('Mity Cthulhu', 'en')).toBe('Cthulhu Mythos');
    expect(getLocalizedSkillName('Cthulhu Mythos', 'pl')).toBe('Mity Cthulhu');
  });

  it('preserves Polish names and descriptions when locale is "pl"', () => {
    expect(getLocalizedSkillName('Spostrzegawczość', 'pl')).toBe('Spostrzegawczość');
    expect(getLocalizedSkillDescription('Spostrzegawczość', 'pl')).toBe(
      SKILL_DESCRIPTIONS['Spostrzegawczość']
    );
  });

  it('correctly translates specializations and bracketed skills in occupations', () => {
    expect(getLocalizedSkillName('Dowolna', 'en')).toBe('Any Skill');
    expect(getLocalizedSkillName('Język Obcy (2)', 'en')).toBe('Language (Other) (2)');
    expect(getLocalizedSkillName('Język Obcy (łacina)', 'en')).toBe('Language (Other) (Latin)');
    expect(getLocalizedSkillName('Nauka (Chemia)', 'en')).toBe('Science (Chemistry)');
    expect(getLocalizedSkillName('Sztuka/Rzemiosło (Fotografia)', 'en')).toBe('Art and Craft (Photography)');
    expect(getLocalizedSkillName('Pilotowanie (Łódź)', 'en')).toBe('Pilot (Boat)');
    expect(getLocalizedSkillDescription('Dowolna', 'en')).toBeDefined();
  });
});
