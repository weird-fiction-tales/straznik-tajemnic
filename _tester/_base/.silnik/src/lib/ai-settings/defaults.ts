import { AISettings } from './types';
import { NARRATION_MAX_OUTPUT_TOKENS } from '../ai-presets/definitions';

export const defaultAISettings: AISettings = {
  // === GEMINI API ===
  geminiEnabled: false,
  geminiApiKey: undefined,
  geminiSettings: {
    model: 'gemini-3.8-flash', // Domyślny model Mistrza Gry z poziomem myślenia LOW (szybki start OOTB <5s)
    // === Shared generation defaults, independent of presentation ===
    temperature: 0.8,
    topP: 0.9,
    topK: 50,
    maxOutputTokens: NARRATION_MAX_OUTPUT_TOKENS,
    candidateCount: 1, // Jedna odpowiedź na request - wystarcza
    seed: undefined, // Losowy; user może ustawić dla powtarzalności (testy)
    presencePenalty: 0, // Neutralne
    frequencyPenalty: 0, // Neutralne
    stopSequences: [], // Pusta - user może dodać np. "###"
    // === Output ===
    responseMimeType: undefined, // Domyślnie text/plain (nie wymuszamy JSON)
    responseSchema: undefined,
    // === Cache (placeholder dla IND-13) ===
    enableCache: true, // Domyślnie włączone
    cacheTTL: 2 * 60 * 60 * 1000, // 2h (OPT-C04)
    cachedContent: undefined, // Brak cache (placeholder dla IND-13)
    // === Thinking ===
    thinkingLevel: 'low', // Domyślnie szybki poziom myślenia (błyskawiczny start OOTB bez zbędnego reasoning)
    // === Tools / Function Calling (eksperymentalne) ===
    tools: undefined,
    toolConfig: undefined,
    // === Safety ===
    safetySettings: {
      // Shared horror narration baseline.
      harassment: 'BLOCK_ONLY_HIGH',
      hateSpeech: 'BLOCK_ONLY_HIGH',
      sexuallyExplicit: 'BLOCK_ONLY_HIGH',
      dangerousContent: 'BLOCK_ONLY_HIGH',
    },
  },

  voiceSettings: {
    enabled: true, // Domyślnie włączony lektor (synteza mowy TTS)
    provider: 'gemini', // M3 sesja 146: default Gemini (drop OpenAI per D2)
    narratorOnly: false, // Włączone słuchowisko (multi-voice NPC: różne głosy i emocje)
    volume: 85,
    speed: 1.0, // Domyślnie 1.0x - naturalne tempo narracji
    voiceId: 'Algenib', // Szorstki, nastrojowy głos narratora (stary marynarz, kultysta)
  },

  // === IMAGE GENERATION (IND-91 rename) ===
  imageGenerationEnabled: true,
  replicateSettings: {
    imageProvider: 'vertex', // HIGH/ULTRA: Imagen 4 Ultra Tier 1 (applyPreset - drift guard T31)
    style: 'realistic',
    quality: 'high',
    autoGeneratePortraits: true,
    autoGenerateNPCs: true,
    autoGenerateLocations: true, // Preset HIGH - włączone
    maxImagesPerMessage: 1, // 1/odpowiedź - płynność narracji > ilość obrazów
    imageFrequency: 'often', // suwak częstotliwości obrazów scen (rare/normal/often) - default 'often' na demo (obrazy = wyróżnik)
    cacheEnabled: true,
    // M9 sesja 146 (D4): default true - regeneracja zachowuje wygląd NPC.
    useExistingPortraitForRegen: true,
  },

  // M3 sesja 146: elevenLabsApiKey + elevenLabsSettings DROPPED per D2.

  // === GAME MASTER NARRATION ===
  gameMasterNarration: {
    enabled: true,
    prompts: {
      mainPrompt: undefined,
      contextualPrompt: undefined,
      stylePrompt: undefined,
    },
    style: {
      responseLength: 'long', // Independent narration default
      detailLevel: 'detailed', // Independent narration default
    },
    behavior: {
      creativity: 'balanced',
      contextMemory: 1000, // Domyślnie wszystkie wiadomości
    },
  },

  // === COST CONTROL ===
  costControl: {
    enabled: true,
    monthlyBudget: 10.0,
    currentMonthUsage: 0.0,
    sessionCost: 0.0, // Koszt aktualnej sesji
    totalCost: 0.0, // Ogólny koszt ze wszystkich sesji
    sessionTokens: 0, // Tokeny zużyte w aktualnej sesji
    totalTokens: 0, // Ogólna liczba tokenów
    todayTokens: 0, // Tokeny zużyte dzisiaj
  },

  // === PDF MEMORY ===
  pdfMemory: {
    enabled: false,
    rulesUrl: undefined,
    adventureUrl: undefined,
    lastUpdated: undefined,
  },

  // === GM TOOLS ===
  gmTools: {
    npcManager: {
      autoDetection: true,
      autoCreation: false,
    },
    initiativeTracker: {
      autoStart: true,
      autoAdvanceTurn: false,
      turnTimeLimit: 0,
    },
    randomEventGenerator: {
      enabled: true,
      autoSuggest: false,
    },
    skillCalculator: {
      autoSuggest: true,
    },
    locationManager: {
      autoTracking: true,
    },
    sessionTimeline: {
      autoSave: true,
    },
    advancedNarration: {
      unreliableNarrator: false,
      timeDisorientation: false,
      falseChoices: false,
      postHorrorSilence: false,
      intensityLevel: 'subtle',
    },
  },

  // === CUSTOM COMMANDS ===
  customCommands: [
    {
      command: 'karta',
      description:
        'Wyświetla aktualną kartę postaci (PŻ, PR, PM, główne umiejętności)',
      handler: 'card',
    },
    {
      command: 'ekwipunek',
      description: 'Wyświetla listę przedmiotów w ekwipunku postaci',
      handler: 'equipment',
    },
  ],

  // === QUALITY PRESET ===
  qualityPreset: 'high', // Demo 2026-06-23: domyślnie HIGH (flash 2-3x szybszy, jakość + reguły OK na playteście). Wartości geminiSettings/voiceSettings wyżej zsynchronizowane z applyPreset('high') - drift detector zostaje na 'high'.
};
