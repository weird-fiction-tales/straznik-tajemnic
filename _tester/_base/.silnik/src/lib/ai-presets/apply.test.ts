import { applyPreset } from './apply';
import { defaultAISettings } from '../ai-settings/defaults';

describe('presentation presets', () => {
  it.each(['low', 'mid'] as const)(
    'turns off paid media when switching ULTRA to %s',
    (preset) => {
      const settings = applyPreset(
        preset,
        applyPreset('ultra', defaultAISettings)
      );
      expect(settings.voiceSettings.enabled).toBe(false);
      expect(settings.imageGenerationEnabled).toBe(false);
      expect(settings.qualityPreset).toBe(preset);
    }
  );
  it('distinguishes a single narrator from the ULTRA voice cast', () => {
    expect(
      applyPreset('high', defaultAISettings).voiceSettings.narratorOnly
    ).toBe(true);
    expect(
      applyPreset('ultra', defaultAISettings).voiceSettings.narratorOnly
    ).toBe(false);
  });
});
