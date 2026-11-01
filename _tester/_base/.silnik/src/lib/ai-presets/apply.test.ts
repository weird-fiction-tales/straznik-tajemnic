import { applyPreset } from './apply';
import { defaultAISettings } from '../ai-settings/defaults';
import { QUALITY_PRESETS } from './definitions';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('presentation presets', () => {
  it.each(['mid', 'high', 'ultra'] as const)('uses natural 1.0 speed in the %s profile', (preset) => {
    expect(QUALITY_PRESETS[preset].settings.speed).toBe(1.0);
  });

  it.each([0.9, 1.0, 1.3])('preserves a manually selected speed %s when switching profiles', (speed) => {
    const settings = { ...defaultAISettings, voiceSettings: { ...defaultAISettings.voiceSettings, speed } };
    expect(applyPreset('ultra', settings).voiceSettings.speed).toBe(speed);
    expect(applyPreset('mid', settings).voiceSettings.speed).toBe(speed);
  });
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

describe('narration independent of presentation presets', () => {
  it.each(['low', 'mid', 'high', 'ultra'] as const)(
    'preserves all narration preferences when applying %s',
    (preset) => {
      const settings = clone(defaultAISettings);
      settings.gameMasterNarration.style = {
        responseLength: 'long',
        detailLevel: 'detailed',
      };
      settings.gameMasterNarration.behavior.creativity = 'creative';
      const before = clone(settings);
      const next = applyPreset(preset, settings);
      expect(next.gameMasterNarration).toEqual(before.gameMasterNarration);
      expect(next.geminiSettings.maxOutputTokens).toBe(8192);
      expect(settings).toEqual(before);
    }
  );

  it('does not classify independent narration and generation preferences as CUSTOM', () => {
    const settings = applyPreset('mid', defaultAISettings);
    settings.gameMasterNarration.style = {
      responseLength: 'short',
      detailLevel: 'minimal',
    };
    settings.gameMasterNarration.behavior.creativity = 'conservative';
    settings.geminiSettings = {
      ...settings.geminiSettings,
      temperature: 0.42,
      topP: 0.8,
      topK: 25,
      thinkingLevel: 'medium',
      enableCache: false,
      cacheTTL: 1000,
    };
    expect(applyPreset('mid', settings)).toEqual(settings);
  });

  it('keeps a short narrative short across MID → HIGH → ULTRA → MID', () => {
    let settings = clone(defaultAISettings);
    settings.gameMasterNarration.style = {
      responseLength: 'short',
      detailLevel: 'minimal',
    };
    const narration = clone(settings.gameMasterNarration);
    for (const preset of ['mid', 'high', 'ultra', 'mid'] as const) {
      settings = applyPreset(preset, settings);
      expect(settings.gameMasterNarration).toEqual(narration);
      expect(settings.qualityPreset).toBe(preset);
    }
  });
});
