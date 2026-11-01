import { defaultAISettings } from './defaults';
import { loadAISettings, resetAISettings, saveAISettings } from './storage';

const sessionZero = {
  era: 'classic' as const,
  tone: 'purist' as const,
  difficulty: 'normal' as const,
  narrativeMode: 'full_rpg' as const,
  lines: [],
  veils: [],
  safetyWord: '',
  playerName: 'Aga',
  completed: true,
};

describe('loadAISettings session mechanics migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps legacy Session Zero settings without activating mechanics', () => {
    localStorage.setItem('ai_settings', JSON.stringify({ sessionZero }));

    expect(loadAISettings().sessionZero).toEqual({
      ...sessionZero,
      mechanics: undefined,
    });
  });

  it('keeps only a valid version 1 mechanics contract', () => {
    localStorage.setItem(
      'ai_settings',
      JSON.stringify({
        sessionZero: {
          ...sessionZero,
          mechanics: {
            schemaVersion: 1,
            enabled: true,
            pacing: 'detailed',
            combatDetail: 'standard',
            chaseDetail: 'narrative',
          },
        },
      })
    );

    expect(loadAISettings().sessionZero?.mechanics).toEqual({
      schemaVersion: 1,
      enabled: true,
      pacing: 'detailed',
      combatDetail: 'standard',
      chaseDetail: 'narrative',
    });
  });

  it('falls back when the stored mechanics contract is malformed', () => {
    localStorage.setItem(
      'ai_settings',
      JSON.stringify({
        sessionZero: {
          ...sessionZero,
          mechanics: { schemaVersion: 2, enabled: true },
        },
      })
    );

    expect(loadAISettings().sessionZero?.mechanics).toBeUndefined();
    expect(loadAISettings().qualityPreset).toBe(
      defaultAISettings.qualityPreset
    );
  });

  it('keeps pure narrative free of mechanics even for a valid stored contract', () => {
    localStorage.setItem(
      'ai_settings',
      JSON.stringify({
        sessionZero: {
          ...sessionZero,
          narrativeMode: 'pure_narrative',
          mechanics: {
            schemaVersion: 1,
            enabled: true,
            pacing: 'detailed',
            combatDetail: 'detailed',
            chaseDetail: 'detailed',
          },
        },
      })
    );

    expect(loadAISettings().sessionZero?.mechanics).toBeUndefined();
  });

  it('Issue #366: domyślnie lektor (TTS) jest włączony w defaultAISettings oraz loadAISettings', () => {
    expect(defaultAISettings.voiceSettings.enabled).toBe(true);
    expect(loadAISettings().voiceSettings.enabled).toBe(true);
  });
});

describe('first-run quality preset', () => {
  beforeEach(() => localStorage.clear());

  it('starts the narrator at natural 1.0 speed', () => {
    expect(loadAISettings().voiceSettings.speed).toBe(1.0);
  });

  it.each([0.9, 0.92, 1.0, 1.3])('preserves an existing voice speed %s on load', (speed) => {
    localStorage.setItem('ai_settings', JSON.stringify({ voiceSettings: { speed } }));
    expect(loadAISettings().voiceSettings.speed).toBe(speed);
  });

  it('uses the actual ULTRA settings on first run', () => {
    const settings = loadAISettings();
    expect(settings.qualityPreset).toBe('ultra');
    expect(settings.voiceSettings.enabled).toBe(true);
    expect(settings.voiceSettings.narratorOnly).toBe(false);
    expect(settings.imageGenerationEnabled).toBe(true);
  });

  it.each(['low', 'mid', 'high', 'ultra', 'custom'])(
    'preserves saved %s settings',
    (preset) => {
      localStorage.setItem(
        'ai_settings',
        JSON.stringify({
          qualityPreset: preset,
          voiceSettings: { enabled: false },
        })
      );
      const settings = loadAISettings();
      expect(settings.qualityPreset).toBe(preset);
      expect(settings.voiceSettings.enabled).toBe(false);
    }
  );

  it('resets settings to canonical ULTRA preset', () => {
    localStorage.setItem(
      'ai_settings',
      JSON.stringify({
        qualityPreset: 'low',
        voiceSettings: { enabled: false },
      })
    );
    const reset = resetAISettings();
    expect(reset.qualityPreset).toBe('ultra');
    expect(reset.voiceSettings.enabled).toBe(true);
    expect(reset.voiceSettings.narratorOnly).toBe(false);
    expect(loadAISettings().qualityPreset).toBe('ultra');
  });

  it('gracefully handles localStorage failures without crashing', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: The operation is insecure.');
    });
    const settings = loadAISettings();
    expect(settings.qualityPreset).toBe('ultra');

    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveAISettings(settings)).not.toThrow();
    jest.restoreAllMocks();
  });
});

describe('legacy narration settings remain independent', () => {
  beforeEach(() => localStorage.clear());
  it.each(['low', 'mid', 'high', 'ultra'] as const)(
    'loads legacy %s without limiting narration or changing saved preferences',
    (qualityPreset) => {
      const settings = {
        ...defaultAISettings,
        qualityPreset,
        geminiSettings: {
          ...defaultAISettings.geminiSettings,
          maxOutputTokens: 2048,
        },
        gameMasterNarration: {
          ...defaultAISettings.gameMasterNarration,
          style: { responseLength: 'medium', detailLevel: 'standard' },
          behavior: {
            ...defaultAISettings.gameMasterNarration.behavior,
            creativity: 'conservative',
          },
        },
      };
      localStorage.setItem('ai_settings', JSON.stringify(settings));
      const loaded = loadAISettings();
      expect(loaded.geminiSettings.maxOutputTokens).toBe(8192);
      expect(loaded.gameMasterNarration).toEqual(settings.gameMasterNarration);
      expect(loaded.qualityPreset).toBe(qualityPreset);
      saveAISettings(loaded);
      expect(loadAISettings()).toEqual(loaded);
    }
  );
  it('preserves an explicitly custom token budget', () => {
    const settings = {
      ...defaultAISettings,
      qualityPreset: 'custom',
      geminiSettings: {
        ...defaultAISettings.geminiSettings,
        maxOutputTokens: 1234,
      },
    };
    localStorage.setItem('ai_settings', JSON.stringify(settings));
    expect(loadAISettings().geminiSettings.maxOutputTokens).toBe(1234);
  });
});
