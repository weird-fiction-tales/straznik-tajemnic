import { defaultAISettings } from '@/lib/ai-settings/defaults';
import { prabutyShowcaseSettings } from './quick-setup-showcase-profile';

test('quick start restores Google dialogue voices after the old narrator-only showcase override', () => {
  const settings = {
    ...defaultAISettings,
    voiceSettings: { ...defaultAISettings.voiceSettings, voiceId: 'Kore', narratorOnly: true },
  };
  const next = prabutyShowcaseSettings(settings);
  expect(next.voiceSettings).toMatchObject({ voiceId: 'Kore', narratorOnly: false, provider: 'gemini' });
  expect(settings.voiceSettings.narratorOnly).toBe(true);
});
