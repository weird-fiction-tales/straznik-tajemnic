/**
 * AI Quality Presets - Definicje presetów jakości
 *
 * Wyodrębnione z ai-settings.ts dla zgodności z zasadą <200 linii/plik.
 * @module ai-presets
 */

// ========================================
// QUALITY PRESETS
// ========================================

/**
 * Presety określające ustawienia dla danego poziomu jakości/kosztów
 */
export const QUALITY_PRESETS = {
  low: {
    name: 'LOW',
    description: 'Tylko tekst, bez lektora i ilustracji AI',
    settings: {
      // Gemini settings - Gemini Flash-Lite Latest
      model: 'gemini-flash-lite-latest' as const, // Ultra-szybki i tani
      temperature: 0.7,
      topP: 0.85,
      topK: 40,
      thinkingLevel: 'minimal' as const,
      maxOutputTokens: 2048,
      // === GEMINI nested (IND-32a) ===
      safetySettings: {
        harassment: 'BLOCK_MEDIUM_AND_ABOVE' as const,
        hateSpeech: 'BLOCK_MEDIUM_AND_ABOVE' as const,
        sexuallyExplicit: 'BLOCK_MEDIUM_AND_ABOVE' as const,
        dangerousContent: 'BLOCK_MEDIUM_AND_ABOVE' as const,
      },
      enableCache: true,
      cacheTTL: 2 * 60 * 60 * 1000, // 2h (OPT-C04)
      // TTS settings - lektor wyłączony
      ttsEnabled: false,
      ttsProvider: 'gemini' as const,
      ttsVoice: null,
      // Image settings - pure text, obrazy wyłączone
      imagesEnabled: false,
      imageProvider: 'vertex' as const,
      imageQuality: 'medium' as const,
      // Narration style - zwięzła narracja
      responseLength: 'short' as const,
      detailLevel: 'minimal' as const,
      creativity: 'conservative' as const,
    },
  },

  mid: {
    name: 'MID',
    description: 'Tekst i handouty, bez lektora i ilustracji AI',
    settings: {
      // Gemini settings - Gemini Flash Latest
      model: 'gemini-flash-latest' as const,
      temperature: 0.7,
      topP: 0.85,
      topK: 40,
      thinkingLevel: 'low' as const,
      maxOutputTokens: 2048,
      // === GEMINI nested (IND-32a) ===
      safetySettings: {
        harassment: 'BLOCK_MEDIUM_AND_ABOVE' as const,
        hateSpeech: 'BLOCK_MEDIUM_AND_ABOVE' as const,
        sexuallyExplicit: 'BLOCK_MEDIUM_AND_ABOVE' as const,
        dangerousContent: 'BLOCK_MEDIUM_AND_ABOVE' as const,
      },
      enableCache: true,
      cacheTTL: 2 * 60 * 60 * 1000, // 2h (OPT-C04)
      // TTS settings - Charon jako jeden stabilny lektor
      ttsEnabled: false,
      ttsProvider: 'gemini' as const,
      ttsVoice: null,
      narratorOnly: true,
      volume: 85,
      speed: 0.92,
      // Image settings - Imagen standard
      imagesEnabled: false,
      imageProvider: 'vertex' as const,
      imageQuality: 'medium' as const,
      // Narration style
      responseLength: 'medium' as const,
      detailLevel: 'standard' as const,
      creativity: 'balanced' as const,
    },
  },

  high: {
    name: 'HIGH',
    description: 'Lektor, handouty i ilustracje ważnych scen',
    settings: {
      // === GEMINI SETTINGS ===
      model: 'gemini-3.8-flash' as const, // Gemini 3.8 Flash
      temperature: 0.8,
      topP: 0.9,
      topK: 50,
      thinkingLevel: 'low' as const,
      maxOutputTokens: 8192,

      // === GEMINI nested (IND-32a) - Horror authentic safety ===
      safetySettings: {
        harassment: 'BLOCK_ONLY_HIGH' as const,
        hateSpeech: 'BLOCK_ONLY_HIGH' as const,
        sexuallyExplicit: 'BLOCK_ONLY_HIGH' as const,
        dangerousContent: 'BLOCK_ONLY_HIGH' as const,
      },
      enableCache: true,
      cacheTTL: 2 * 60 * 60 * 1000, // 2h (OPT-C04)

      // === GEMINI TTS SŁUCHOWISKO ===
      ttsEnabled: true,
      ttsProvider: 'gemini' as const,
      ttsVoice: 'Algenib',
      narratorOnly: true,
      volume: 85,
      speed: 1.0,

      // === IMAGE SETTINGS ===
      imagesEnabled: true,
      imageProvider: 'vertex' as const,
      imageQuality: 'high' as const,

      // === REPLICATE SETTINGS ===
      replicateStyle: 'realistic' as const,
      autoGeneratePortraits: true,
      autoGenerateNPCs: true,
      autoGenerateLocations: true,
      maxImagesPerMessage: 1,

      // === NARRATION STYLE ===
      responseLength: 'long' as const,
      detailLevel: 'detailed' as const,
      creativity: 'balanced' as const,
    },
  },

  ultra: {
    name: 'ULTRA',
    description: 'Pełne słuchowisko, handouty i ilustracje',
    settings: {
      // Gemini settings - maksymalna jakość
      model: 'gemini-3.1-pro-preview' as const,
      temperature: 0.9,
      topP: 0.95,
      topK: 60,
      thinkingLevel: 'low' as const,
      maxOutputTokens: 8192,
      // === GEMINI nested (IND-32a) ===
      safetySettings: {
        harassment: 'BLOCK_ONLY_HIGH' as const,
        hateSpeech: 'BLOCK_ONLY_HIGH' as const,
        sexuallyExplicit: 'BLOCK_ONLY_HIGH' as const,
        dangerousContent: 'BLOCK_ONLY_HIGH' as const,
      },
      enableCache: true,
      cacheTTL: 2 * 60 * 60 * 1000, // 2h
      // === GEMINI TTS FULL SŁUCHOWISKO ===
      ttsEnabled: true,
      ttsProvider: 'gemini' as const,
      ttsVoice: 'Gacrux',
      narratorOnly: false,
      volume: 85,
      speed: 0.92,
      // === IMAGE SETTINGS ===
      imagesEnabled: true,
      imageProvider: 'vertex' as const,
      imageQuality: 'high' as const,
      // Narration style - długie, bogate opisy
      responseLength: 'long' as const,
      detailLevel: 'detailed' as const,
      creativity: 'creative' as const,
    },
  },

  custom: {
    name: 'CUSTOM',
    description: 'Własna konfiguracja wszystkich parametrów',
    settings: null, // brak nadpisywania
  },
} as const;

// ========================================
// TYPES
// ========================================

export type QualityPresetName = keyof typeof QUALITY_PRESETS;
export type QualityPreset = (typeof QUALITY_PRESETS)[QualityPresetName];

/**
 * Pobiera preset według nazwy
 */
export function getPreset(name: QualityPresetName): QualityPreset {
  return QUALITY_PRESETS[name];
}

/**
 * Pobiera opis presetu
 */
export function getPresetDescription(name: QualityPresetName): string {
  return QUALITY_PRESETS[name].description;
}
