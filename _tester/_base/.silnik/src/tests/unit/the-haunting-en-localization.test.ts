import { STARTER_HAUNTING_ADVENTURE } from '@/lib/starter-haunting-data';
import { localizeAdventure } from '@/lib/immersion/strefa-11-localization';
import { getSafeDossierIntro } from '@/lib/era/setting-trivia';
import { timeManager, deriveInitialWeather } from '@/lib/time-manager';
import { getGMProtocolPrompt, getContextAwareGMProtocol } from '@/lib/prompts/gm-protocol';

describe('The Haunting (Nawiedzony Dom) & Session Intro English Localization (Issue #807)', () => {
  describe('localizeAdventure - STARTER_HAUNTING_ADVENTURE', () => {
    it('returns original Polish fields when locale is "pl"', () => {
      const advPl = localizeAdventure(STARTER_HAUNTING_ADVENTURE, 'pl');
      expect(advPl.title).toBe('Nawiedzony Dom (The Haunting)');
      expect(advPl.description).toContain('Klasyczny scenariusz ze Startera');
      expect(advPl.hook).toContain('Pan Steven Knott wynajmuje Badaczy');
    });

    it('returns fully translated English fields when locale is "en"', () => {
      const advEn = localizeAdventure(STARTER_HAUNTING_ADVENTURE, 'en');
      expect(advEn.title).toBe('The Haunting');
      expect(advEn.eraLabel).toBe('1920s (USA)');
      expect(advEn.description).toContain('Call of Cthulhu 7e Starter Set');
      expect(advEn.description).not.toContain('Klasyczny scenariusz');
      expect(advEn.hook).toContain('Mr. Steven Knott');
      expect(advEn.hook).not.toContain('Pan Steven Knott');
      expect(advEn.investigatorIntro).toContain('May 1920, Boston');
      expect(advEn.initialWeather).toContain('Boston morning with harbor mist');
      expect(advEn.settingTrivia?.[0]).toContain('1920s Boston is a city of sharp contrasts');
    });
  });

  describe('getSafeDossierIntro in English', () => {
    it('produces English intro for The Haunting and never leaks Polish raw description', () => {
      const intro = getSafeDossierIntro(STARTER_HAUNTING_ADVENTURE, { locale: 'en' });
      expect(intro).not.toContain('Klasyczny scenariusz');
      expect(intro).not.toContain('nieumarłego czarnoksiężnika');
      expect(intro).toMatch(/Boston|Corbitt|estate|house|investigation/i);
    });
  });

  describe('Weather derivation in English', () => {
    it('derives English weather string for initial time and falls back to English', () => {
      const enWeather = deriveInitialWeather(null, { year: 1920, month: 9, day: 15, hour: 19, minute: 0 }, 'en');
      expect(enWeather).toBe('Cool wind, low hanging clouds and damp air');
      expect(enWeather).not.toContain('Chłodny wiatr');
    });

    it('preserves localized initialWeather when resetting timeManager for English adventure', () => {
      const advEn = localizeAdventure(STARTER_HAUNTING_ADVENTURE, 'en');
      timeManager.resetForAdventure(advEn, 'en');
      expect(timeManager.getWeather()).toBe('Chilly, damp Boston morning with harbor mist rising over Massachusetts Bay');
    });
  });

  describe('GM Protocol marker localization', () => {
    it('uses [What do you do?] in English GM Protocol prompt and does not require [Co robisz?]', () => {
      const promptEn = getGMProtocolPrompt('en');
      expect(promptEn).toContain('[What do you do?]');
      expect(promptEn).not.toContain('Każda wiadomość MUSI kończyć się otwartym markerem **`[Co robisz?]`**');

      const contextProtocolEn = getContextAwareGMProtocol(0, 10, 'en');
      expect(contextProtocolEn).toContain('[What do you do?]');
    });
  });
});
