import { defaultAISettings } from '../ai-settings/defaults';
import { getGameMasterPrompt } from '../ai-settings/prompts-generator';
import { resolveSupplementalGMProtocol } from '@/app/api/chat/_helpers/resolve-gm-protocol';

describe('compact Keeper instructions in the real prompt path', () => {
  it.each(['pl', 'en'] as const)('%s keeps mechanics available without a large repeated protocol', locale => {
    const settings = { ...defaultAISettings, pureTextMode: false };
    const prompt = getGameMasterPrompt(settings, locale);
    expect(prompt).toContain('KEEPER CONTRACT V2');
    expect(prompt.length).toBeLessThan(34000);
    for (const tag of ['[TEST:', '[WYNIK:', '[ZDOBYTY_PRZEDMIOT:', '[HP:', '[SANITY:', '[GAME_OVER:']) {
      expect(prompt).toContain(tag);
    }
    expect(prompt).toContain('DOSSIER_ACCESS:');
    expect(prompt).toContain(locale === 'pl' ? '[WALKA_ATAK:' : '[OPPOSED_MELEE:');
    expect(prompt).toContain(locale === 'pl' ? '[CZAR:' : '[SPELL:');
    for (const count of [0, 8, 24, 130]) {
      const reminder = resolveSupplementalGMProtocol(prompt, count, locale);
      expect(reminder.length).toBeLessThan(1500);
      expect(reminder).toContain('[PRZEJŚCIE_AKTU: Akt N]');
      expect(reminder).not.toContain('KEEPER CONTRACT V2');
    }
    expect(getGameMasterPrompt(settings, locale)).toBe(prompt);
    console.info(JSON.stringify({ compactPrompt: locale, systemChars: prompt.length,
      reminderChars: resolveSupplementalGMProtocol(prompt, 130, locale).length,
      instructionTokensEstimate: Math.ceil((prompt.length + resolveSupplementalGMProtocol(prompt, 130, locale).length) / 4) }));
  });

  it.each(['pl', 'en'] as const)('%s omits mechanical cards in pure narrative mode', locale => {
    const settings = { ...defaultAISettings, sessionZero: { ...defaultAISettings.sessionZero!, narrativeMode: 'pure_narrative' as const } };
    const prompt = getGameMasterPrompt(settings, locale);
    expect(prompt).not.toContain('[WYNIK:');
    expect(prompt).not.toContain('[HP:');
    expect(prompt).toContain(locale === 'pl' ? '[DZIENNIK:' : '[JOURNAL:');
  });
});
