/**
 * AI Quality Presets - Definicje presetów jakości
 *
 * Wyodrębnione z ai-settings.ts dla zgodności z zasadą <200 linii/plik.
 * @module ai-presets
 */

// Shared response budget; presentation presets never choose narrative length.
export const NARRATION_MAX_OUTPUT_TOKENS = 8192;

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
      // TTS settings - lektor wyłączony
      ttsEnabled: false,
      ttsProvider: 'gemini' as const,
      ttsVoice: null,
      // Image settings - pure text, obrazy wyłączone
      imagesEnabled: false,
      imageProvider: 'vertex' as const,
      imageQuality: 'medium' as const,
    },
  },

  mid: {
    name: 'MID',
    description: 'Tekst i handouty, bez lektora i ilustracji AI',
    settings: {
      // Gemini settings - Gemini Flash Latest
      model: 'gemini-flash-latest' as const,
      // TTS settings - Charon jako jeden stabilny lektor
      ttsEnabled: false,
      ttsProvider: 'gemini' as const,
      ttsVoice: null,
      narratorOnly: true,
      volume: 85,
      speed: 1.0,
      // Image settings - Imagen standard
      imagesEnabled: false,
      imageProvider: 'vertex' as const,
      imageQuality: 'medium' as const,
    },
  },

  high: {
    name: 'HIGH',
    description: 'Lektor, handouty i ilustracje ważnych scen',
    settings: {
      // === GEMINI SETTINGS ===
      model: 'gemini-3.8-flash' as const, // Gemini 3.8 Flash

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
    },
  },

  ultra: {
    name: 'ULTRA',
    description: 'Pełne słuchowisko, handouty i ilustracje',
    settings: {
      // Gemini settings - wysoka jakość z szybkim modelem Flash (Issue #798)
      model: 'gemini-3.8-flash' as const,
      // === GEMINI TTS FULL SŁUCHOWISKO ===
      ttsEnabled: true,
      ttsProvider: 'gemini' as const,
      ttsVoice: 'Algenib',
      narratorOnly: false,
      volume: 85,
      speed: 1.0,
      // === IMAGE SETTINGS ===
      imagesEnabled: true,
      imageProvider: 'vertex' as const,
      imageQuality: 'high' as const,
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
