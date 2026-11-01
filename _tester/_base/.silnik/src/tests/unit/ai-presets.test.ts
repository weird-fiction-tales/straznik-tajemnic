import { defaultAISettings } from '../../lib/ai-settings/defaults';
import { applyPreset } from '../../lib/ai-presets/apply';
import { QUALITY_PRESETS } from '../../lib/ai-presets/definitions';
import type { AISettings } from '../../lib/ai-settings/types';

describe('AI Presets & Thinking Level Decoupling (Issue #754)', () => {
  describe('defaults.ts', () => {
    it('posiada domyślny thinkingLevel: low dla szybkiego startu OOTB', () => {
      expect(defaultAISettings.geminiSettings.thinkingLevel).toBe('low');
    });

    it('nie posiada wbitego thinkingLevel: high', () => {
      expect(defaultAISettings.geminiSettings.thinkingLevel).not.toBe('high');
    });
  });

  describe('definitions.ts', () => {
    it.each(['low', 'mid', 'high', 'ultra'] as const)(
      '%s contains presentation only, without narration or generation overrides',
      (preset) => {
        for (const field of [
          'thinkingLevel',
          'temperature',
          'topP',
          'topK',
          'safetySettings',
          'maxOutputTokens',
          'responseLength',
          'detailLevel',
          'creativity',
        ]) {
          expect(QUALITY_PRESETS[preset].settings).not.toHaveProperty(field);
        }
      }
    );
  });

  describe('applyPreset decoupling', () => {
    it('zachowuje wybrany przez użytkownika thinkingLevel przy przełączeniu na ULTRA', () => {
      const userSettings: AISettings = {
        ...defaultAISettings,
        geminiSettings: {
          ...defaultAISettings.geminiSettings,
          thinkingLevel: 'minimal',
        },
      };

      const result = applyPreset('ultra', userSettings);
      // Oprawa została podniesiona do ULTRA (obrazy, TTS, etc.)
      expect(result.qualityPreset).toBe('ultra');
      expect(result.voiceSettings.enabled).toBe(true);
      expect(result.imageGenerationEnabled).toBe(true);
      // Ale thinkingLevel pozostał 'minimal' zgodnie z wyborem gracza
      expect(result.geminiSettings.thinkingLevel).toBe('minimal');
    });

    it('zachowuje wybrany thinkingLevel: low przy przełączeniu na HIGH', () => {
      const userSettings: AISettings = {
        ...defaultAISettings,
        geminiSettings: {
          ...defaultAISettings.geminiSettings,
          thinkingLevel: 'low',
        },
      };

      const result = applyPreset('high', userSettings);
      expect(result.qualityPreset).toBe('high');
      expect(result.geminiSettings.thinkingLevel).toBe('low');
    });

    it('zachowuje wybrany thinkingLevel: medium przy przełączeniu na LOW', () => {
      const userSettings: AISettings = {
        ...defaultAISettings,
        geminiSettings: {
          ...defaultAISettings.geminiSettings,
          thinkingLevel: 'medium',
        },
      };

      const result = applyPreset('low', userSettings);
      expect(result.qualityPreset).toBe('low');
      expect(result.geminiSettings.thinkingLevel).toBe('medium');
    });

    it('gdy thinkingLevel nie jest określony, używa domyślnego szybkiego poziomu presetu', () => {
      const cleanSettings: AISettings = {
        ...defaultAISettings,
        geminiSettings: {
          ...defaultAISettings.geminiSettings,
          thinkingLevel: undefined,
        },
      };

      const result = applyPreset('high', cleanSettings);
      expect(result.geminiSettings.thinkingLevel).toBe('low');
    });
  });
});
