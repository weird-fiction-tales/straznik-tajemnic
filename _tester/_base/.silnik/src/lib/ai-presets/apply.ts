/**
 * Applies model, voice and image presentation settings only.
 * Narration and advanced generation preferences remain independent.
 */

import type { AISettings } from '../ai-settings/types';
import {
  NARRATION_MAX_OUTPUT_TOKENS,
  QUALITY_PRESETS,
  type QualityPresetName,
} from './definitions';

export function applyPreset(
  presetName: QualityPresetName,
  currentSettings: AISettings
): AISettings {
  // Custom flow - explicit, brak nadpisywania pól
  if (presetName === 'custom') {
    return { ...currentSettings, qualityPreset: 'custom' };
  }

  const preset = QUALITY_PRESETS[presetName];
  const s = preset.settings;

  const newSettings: AISettings = {
    ...currentSettings,
    qualityPreset: presetName,

    geminiSettings: {
      ...currentSettings.geminiSettings,
      model: s.model,
      thinkingLevel: currentSettings.geminiSettings.thinkingLevel ?? 'low',
      maxOutputTokens: NARRATION_MAX_OUTPUT_TOKENS,
    },

    // Voice/TTS - IND-34: + volume/speed/speakingRate/pitchControl (HIGH only, ternary `in s`)
    // IND-165: + provider (HIGH preset migration na 'gemini')
    // 2026-07-25: + elevenLabsModelKey (HIGH/ULTRA = 'elevenlabs' provider)
    voiceSettings: {
      ...currentSettings.voiceSettings,
      enabled: s.ttsEnabled,
      provider: s.ttsProvider ?? currentSettings.voiceSettings.provider,
      voiceId: s.ttsVoice ?? currentSettings.voiceSettings.voiceId,
      narratorOnly:
        'narratorOnly' in s
          ? s.narratorOnly
          : currentSettings.voiceSettings.narratorOnly,
      volume: 'volume' in s ? s.volume : currentSettings.voiceSettings.volume,
      speed:
        currentSettings.voiceSettings.speed ?? ('speed' in s ? s.speed : 1.0),
      // ElevenLabs-specific (opcjonalne, undefined dla presetów bez EL)
      ...('elevenLabsModelKey' in s
        ? {
            elevenLabsModelKey: (
              s as { elevenLabsModelKey?: 'multilingual_v2' | 'turbo_v2_5' }
            ).elevenLabsModelKey,
          }
        : {}),
    },

    imageGenerationEnabled: s.imagesEnabled,
    // Replicate - IND-34: + style/autoGenerate*/maxImagesPerMessage (HIGH only)
    replicateSettings: {
      ...currentSettings.replicateSettings,
      quality: s.imageQuality,
      imageProvider: s.imageProvider,
      style:
        'replicateStyle' in s
          ? s.replicateStyle
          : currentSettings.replicateSettings.style,
      autoGeneratePortraits:
        'autoGeneratePortraits' in s
          ? s.autoGeneratePortraits
          : currentSettings.replicateSettings.autoGeneratePortraits,
      autoGenerateNPCs:
        'autoGenerateNPCs' in s
          ? s.autoGenerateNPCs
          : currentSettings.replicateSettings.autoGenerateNPCs,
      autoGenerateLocations:
        'autoGenerateLocations' in s
          ? s.autoGenerateLocations
          : currentSettings.replicateSettings.autoGenerateLocations,
      maxImagesPerMessage:
        'maxImagesPerMessage' in s
          ? s.maxImagesPerMessage
          : currentSettings.replicateSettings.maxImagesPerMessage,
    },
  };

  // M2 sesja 146: branch if (ttsProvider === 'elevenlabs') DROPPED (provider odchodzi per D2).
  // Source of truth dla TTS: voiceSettings.provider (ustawione w lin ~55 z s.ttsProvider).

  return newSettings;
}
