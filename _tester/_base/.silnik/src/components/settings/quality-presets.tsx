import type { SetStateAction, Dispatch } from 'react';
import { useTranslations } from 'next-intl';
import equal from 'fast-deep-equal';
import { AISettings } from '@/lib/ai-settings';
import {
  applyPreset,
  QUALITY_PRESETS,
  type QualityPresetName,
} from '@/lib/ai-presets';

// IND-208: beta lock - tester gra wyłącznie na presecie HIGH. Ukrywamy
// przyciski LOW/MID/ULTRA (wzorzec flag bety SHOW_UPLOAD_RULES, commit 619e174).
// false = pełne UI 5 presetów dla właściciela, zero wpływu na applyPreset.
// PLAYTEST 2026-06-17: tymczasowo false dla testu ULTRA (diagnoza model vs prompt,
// IND-221). PRZYWRÓCIĆ na true przed deployem bety.
const BETA_HIGH_ONLY = false;

interface QualityPresetsProps {
  settings: AISettings;
  setSettings: Dispatch<SetStateAction<AISettings>>;
}

export function QualityPresets({ settings, setSettings }: QualityPresetsProps) {
  const t = useTranslations('QualityPresets');
  // IND-33: badge "Modified" - race condition z drift detector (1 frame przed flip
  // na 'custom'). Akceptowalne - wizualny sygnał że values uciekły od presetu.
  const isModified =
    settings.qualityPreset !== 'custom' &&
    !equal(settings, applyPreset(settings.qualityPreset, settings));

  return (
    <div
      data-testid="settings-quality-presets"
      className="relative border border-brass/30 bg-gradient-to-br from-[#1a1610] to-[#100d09] p-5 mb-6 shadow-[0_0_22px_rgba(13,148,136,0.08)]"
    >
      <span className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-brass/60" />
      <span className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-brass/60" />

      <div className="font-special-elite text-[14px] uppercase tracking-[0.32em] text-primary">
        {t('eyebrow')}
      </div>
      <h3 className="font-display uppercase text-brass text-xl font-bold tracking-[0.1em] mt-1.5">
        {t('title')}
      </h3>
      <p className="font-serif italic text-base text-muted-foreground mt-1.5 mb-5">
        {t('description')}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(
          Object.entries(QUALITY_PRESETS) as [
            QualityPresetName,
            (typeof QUALITY_PRESETS)[QualityPresetName],
          ][]
        )
          .filter(([key]) => !BETA_HIGH_ONLY || key === 'high')
          .map(([key, preset]) => (
            <button
              key={key}
              data-testid={`settings-preset-${key}`}
              aria-pressed={settings.qualityPreset === key}
              onClick={() => setSettings((prev) => applyPreset(key, prev))}
              className={`relative p-4 border text-left transition-all duration-300 ${
                settings.qualityPreset === key
                  ? 'border-primary bg-[#0e1413] shadow-[0_0_22px_rgba(13,148,136,0.2)]'
                  : 'border-brass/22 bg-[#16130f] hover:border-primary/50 hover:bg-[#0e1413]'
              }`}
            >
              {settings.qualityPreset === key && (
                <span className="absolute -top-px -right-px font-special-elite text-[13px] uppercase tracking-[0.1em] text-[#04110f] bg-primary px-2 py-0.5">
                  {t('selectedBadge')}
                </span>
              )}
              <div
                className={`font-display font-bold text-base tracking-[0.14em] mb-1.5 ${
                  settings.qualityPreset === key
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {key === 'ultra' && '🔥 '}
                {preset.name}
              </div>
              <div className="font-serif italic text-sm text-muted-foreground line-clamp-2 leading-snug">
                {t(`presets.${key}.description`)}
              </div>
              {settings.qualityPreset === key && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-brass rotate-45 animate-pulse" />
              )}
            </button>
          ))}
      </div>

      {settings.qualityPreset !== 'custom' && (
        <div className="mt-5 border border-brass/22 bg-[#16130f] p-3.5">
          <div className="font-special-elite text-xs text-muted-foreground tracking-[0.06em]">
            <strong className="text-brass uppercase tracking-[0.16em]">
              {t('activePreset')}
            </strong>{' '}
            <span className="text-primary">
              {QUALITY_PRESETS[settings.qualityPreset].name}
            </span>
            {isModified && (
              <span className="ml-2 px-1.5 py-0.5 text-[14px] font-medium bg-brass/15 text-brass border border-brass/40">
                ⚠️ Modified
              </span>
            )}
            {' • '}
            {t('modelLabel')}{' '}
            {settings.geminiSettings.model.split('-').slice(0, 2).join('-')}
            {' • '}
            TTS: {settings.voiceSettings?.enabled ? '✅' : '❌'}
            {' • '}
            {t('imagesLabel')} {settings.imageGenerationEnabled ? '✅' : '❌'}
          </div>
        </div>
      )}
    </div>
  );
}
