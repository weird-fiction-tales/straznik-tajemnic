import type { SetStateAction, Dispatch } from 'react';
import { useTranslations } from 'next-intl';
import type { AISettings } from '@/lib/ai-settings';
import type { TestResults } from '@/hooks/useApiTester';
import type { AvailableVoice } from '@/hooks/useSettingsModal';
import { HelpIcon } from '../../ui/tooltip';
import { Switch } from '../../ui/switch';
import { ProviderTestButton } from './provider-test-button';
import { GeminiSettings } from './gemini-settings';
import { VolumeSlider, SpeedSlider, SFXVolumeSlider } from './shared-sliders';

interface TTSSettingsProps {
  settings: AISettings;
  setSettings: Dispatch<SetStateAction<AISettings>>;
  testResults: TestResults;
  isLoading: boolean;
  testAPI: (apiType: string) => Promise<void>;
  getTestResultColor: (result: boolean | null) => string;
  getTestResultIcon: (result: boolean | null) => string;
  availableVoices: AvailableVoice[];
  loadAvailableVoices: () => Promise<void>;
}

/**
 * Panel TTS - Zew Home (offline-first). Cały lektor idzie przez `/api/tts/gemini`
 * (jeden klucz Gemini; Google Cloud TTS całkowicie usunięty).
 */
export function TTSSettings({
  settings,
  setSettings,
  testResults,
  isLoading,
  testAPI,
  getTestResultColor,
  getTestResultIcon,
}: TTSSettingsProps) {
  const t = useTranslations('TTSSettings');
  const enabled = settings.voiceSettings.enabled;

  return (
    <div className="relative border border-brass/30 bg-gradient-to-br from-[#1a1610] to-[#100d09] p-6 shadow-[0_0_22px_rgba(13,148,136,0.08)]">
      {/* Narożniki déco */}
      <span className="pointer-events-none absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-brass/60" />
      <span className="pointer-events-none absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-brass/60" />
      <span className="pointer-events-none absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-brass/60" />
      <span className="pointer-events-none absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-brass/60" />

      {/* Nagłówek sekcji */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-special-elite uppercase text-[14px] tracking-[0.32em] text-primary">
            {t('eyebrow')}
          </div>
          <h3 className="mt-1 font-display uppercase text-2xl tracking-[0.1em] text-foreground">
            {t('title')}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`font-special-elite uppercase text-[14px] tracking-[0.1em] ${
              enabled ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            {enabled ? t('stateEnabled') : t('stateDisabled')}
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={(checked) =>
              setSettings({
                ...settings,
                voiceSettings: { ...settings.voiceSettings, enabled: checked },
              })
            }
          />
          <HelpIcon content={t('toggleHelp')} />
        </div>
      </div>

      {/* Separator déco */}
      <div className="flex items-center gap-4 my-5">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gold/35" />
        <span className="w-2 h-2 bg-brass rotate-45" />
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gold/35" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Lewa kolumna - wybór głosu */}
        <GeminiSettings
          settings={settings}
          setSettings={setSettings}
          isLoading={isLoading}
        />

        {/* Prawa kolumna - parametry + test/próbka */}
        <div className="flex flex-col gap-4">
          <div className="relative border border-brass/22 bg-[#16130f] p-5 flex flex-col gap-4">
            <div className="font-special-elite uppercase text-[14px] tracking-[0.16em] text-brass mb-1">
              {t('parametersTitle')}
            </div>
            <VolumeSlider settings={settings} setSettings={setSettings} />
            <SpeedSlider settings={settings} setSettings={setSettings} />
            <SFXVolumeSlider />

            {/* Wybór formatu narracji: Słuchowisko vs Audiobook */}
            <div className="pt-3 border-t border-brass/15 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 font-special-elite uppercase text-[14px] tracking-[0.12em] text-brass">
                  {t('modeLabel')}
                  <HelpIcon content={t('modeHelp')} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      voiceSettings: {
                        ...settings.voiceSettings,
                        narratorOnly: false,
                      },
                    })
                  }
                  className={`px-3 py-2 text-xs font-special-elite uppercase tracking-[0.08em] border transition-colors ${
                    !settings.voiceSettings.narratorOnly
                      ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(13,148,136,0.2)]'
                      : 'bg-[#0e0c08] border-brass/25 text-muted-foreground hover:border-brass/50'
                  }`}
                >
                  🎭 {t('modeRadioDrama')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      voiceSettings: {
                        ...settings.voiceSettings,
                        narratorOnly: true,
                      },
                    })
                  }
                  className={`px-3 py-2 text-xs font-special-elite uppercase tracking-[0.08em] border transition-colors ${
                    settings.voiceSettings.narratorOnly
                      ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(13,148,136,0.2)]'
                      : 'bg-[#0e0c08] border-brass/25 text-muted-foreground hover:border-brass/50'
                  }`}
                >
                  📖 {t('modeAudiobook')}
                </button>
              </div>
            </div>
          </div>

          <div className="relative border border-brass/22 bg-[#16130f] p-5 flex flex-col gap-3">
            <div className="font-special-elite uppercase text-[14px] tracking-[0.16em] text-brass">
              {t('diagnosticsTitle')}
            </div>
            <p className="font-serif italic text-base text-muted-foreground leading-relaxed m-0">
              {t('sampleQuote')}
            </p>
            <div className="flex items-center justify-between mt-auto pt-1">
              <span className="font-special-elite uppercase text-[14px] tracking-[0.12em] text-muted-foreground">
                {t('testLabel')}
              </span>
              <ProviderTestButton
                provider="gemini"
                testResults={testResults}
                isLoading={isLoading}
                testAPI={testAPI}
                getTestResultColor={getTestResultColor}
                getTestResultIcon={getTestResultIcon}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
