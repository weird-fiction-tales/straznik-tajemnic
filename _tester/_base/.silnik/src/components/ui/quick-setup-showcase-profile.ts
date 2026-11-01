// Set enabled to false to restore the complete Quick Setup catalog. Solo and Hot Seat stay available.
export const QUICK_SETUP_SHOWCASE_PROFILE = {
  enabled: false,
  locales: {
    pl: {
      adventureId: 'cien-nad-prabutami',
      characterId: 'strefa11_tomasz_nowicki',
      companionCharacterId: 'strefa11_barbara_zawadzka',
    },
    en: {
      adventureId: 'englewood-murder-castle-1893',
      characterId: 'coldcase_frank_geyer',
      companionCharacterId: 'coldcase_clara_vance',
    },
  },
};

/** Measured local-demo configuration. Stored normally so UI, reload and actual requests agree. */
export function prabutyShowcaseSettings(settings: import('@/lib/ai-settings/types').AISettings) {
  return {...settings,qualityPreset:'high' as const,voiceSettings:{...settings.voiceSettings,provider:'gemini' as const,narratorOnly:false}, geminiSettings:{...settings.geminiSettings,
    model:'gemini-flash-lite-latest' as const,thinkingLevel:'minimal' as const,
    maxOutputTokens:4096,enableCache:false,cachedContent:undefined}};
}
