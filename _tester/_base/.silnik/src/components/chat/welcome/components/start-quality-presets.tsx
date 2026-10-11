'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  loadAISettings,
  saveAISettings,
  type AISettings,
} from '@/lib/ai-settings';
import { applyPreset } from '@/lib/ai-presets';
import { settingsEmitter } from '@/lib/settings-event-emitter';

const START_PRESETS = ['low', 'mid', 'high', 'ultra'] as const;

export function StartQualityPresets({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const t = useTranslations('StartQualityPresets');
  const [settings, setSettings] = useState<AISettings | null>(null);

  useEffect(() => {
    const current = loadAISettings();
    try {
      if (!localStorage.getItem('ai_settings')) saveAISettings(current);
    } catch {
      /* brak dostępu do storage */
    }
    setSettings(current);
    return settingsEmitter.subscribe(setSettings);
  }, []);

  return (
    <section
      data-testid="start-quality-presets"
      aria-labelledby="start-quality-title"
      className="md:col-span-2 w-full text-left"
    >
      <h2
        id="start-quality-title"
        className="font-display text-brass uppercase tracking-[0.12em] text-sm mb-3"
      >
        {t('title')}
      </h2>
      <div
        role="group"
        aria-label={t('title')}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {START_PRESETS.map((preset) => {
          const selected = settings?.qualityPreset === preset;
          return (
            <button
              key={preset}
              type="button"
              data-testid={`start-preset-${preset}`}
              aria-pressed={selected}
              disabled={disabled || !settings}
              onClick={() => {
                const next = applyPreset(preset, loadAISettings());
                saveAISettings(next);
                setSettings(next);
              }}
              className={`relative border p-4 text-left min-h-[120px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 disabled:cursor-wait ${selected ? 'border-primary bg-primary/10' : 'border-brass/40 bg-black/40 hover:border-primary/60'}`}
            >
              <span className="block font-display text-base font-bold tracking-[0.1em] text-foreground">
                {preset.toUpperCase()}
              </span>
              <span className="block font-serif text-sm text-muted-foreground mt-2 leading-snug">
                {t(`presets.${preset}`)}
              </span>
            </button>
          );
        })}
      </div>
      {settings?.qualityPreset === 'custom' && (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {t('custom')}
        </p>
      )}
    </section>
  );
}
