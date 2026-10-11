import { useState, type SetStateAction, type Dispatch } from 'react';
import { useTranslations } from 'next-intl';
import type { AISettings } from '@/lib/ai-settings';
import { HelpIcon } from '../../ui/tooltip';
import { getSFXVolume, setSFXVolume } from '@/lib/audio/sfx-catalog';

interface SharedSlidersProps {
  settings: AISettings;
  setSettings: Dispatch<SetStateAction<AISettings>>;
}

export function VolumeSlider({ settings, setSettings }: SharedSlidersProps) {
  const t = useTranslations('TTSSettings');
  const volume = settings.voiceSettings.volume;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-2 font-special-elite uppercase text-[14px] tracking-[0.12em] text-muted-foreground">
          {t('volumeLabel')}
          <HelpIcon content={t('volumeHelp')} />
        </label>
        <span className="font-special-elite text-sm text-primary">
          {volume}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-special-elite text-[14px] text-muted-foreground min-w-[1.6rem]">
          0
        </span>
        <div className="flex-1">
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) =>
              setSettings({
                ...settings,
                voiceSettings: {
                  ...settings.voiceSettings,
                  volume: parseInt(e.target.value),
                },
              })
            }
            className="w-full h-3 rounded-lg appearance-none cursor-pointer slider-thumb"
            style={{
              background: `linear-gradient(to right, rgb(var(--primary)) 0%, rgb(var(--primary)) ${volume}%, #2a241b ${volume}%, #2a241b 100%)`,
            }}
          />
        </div>
        <span className="font-special-elite text-[14px] text-muted-foreground min-w-[1.6rem] text-right">
          100
        </span>
      </div>
    </div>
  );
}

export function SpeedSlider({ settings, setSettings }: SharedSlidersProps) {
  const t = useTranslations('TTSSettings');
  const speed = settings.voiceSettings.speed || 1.0;
  const pct = ((speed - 0.5) / 1.5) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-2 font-special-elite uppercase text-[14px] tracking-[0.12em] text-muted-foreground">
          {t('speedLabel')}
          <HelpIcon content={t('speedHelp')} />
        </label>
        <span className="font-special-elite text-sm text-primary">
          {speed.toFixed(1)}×
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-special-elite text-[14px] text-muted-foreground min-w-[1.8rem]">
          0,5×
        </span>
        <div className="flex-1">
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={speed}
            onChange={(e) =>
              setSettings({
                ...settings,
                voiceSettings: {
                  ...settings.voiceSettings,
                  speed: parseFloat(e.target.value),
                },
              })
            }
            className="w-full h-3 rounded-lg appearance-none cursor-pointer slider-thumb"
            style={{
              background: `linear-gradient(to right, rgb(var(--primary)) 0%, rgb(var(--primary)) ${pct}%, #2a241b ${pct}%, #2a241b 100%)`,
            }}
          />
        </div>
        <span className="font-special-elite text-[14px] text-muted-foreground min-w-[1.8rem] text-right">
          2,0×
        </span>
      </div>
    </div>
  );
}

export function SFXVolumeSlider() {
  const t = useTranslations('TTSSettings');
  const [volume, setVolumeState] = useState<number>(() => {
    return Math.round(getSFXVolume() * 100);
  });

  const handleChange = (newVol: number) => {
    setVolumeState(newVol);
    setSFXVolume(newVol);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-2 font-special-elite uppercase text-[14px] tracking-[0.12em] text-muted-foreground">
          {t('sfxVolumeLabel')}
          <HelpIcon content={t('sfxVolumeHelp')} />
        </label>
        <span className="font-special-elite text-sm text-primary">
          {volume}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-special-elite text-[14px] text-muted-foreground min-w-[1.6rem]">
          0
        </span>
        <div className="flex-1">
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => handleChange(parseInt(e.target.value, 10))}
            className="w-full h-3 rounded-lg appearance-none cursor-pointer slider-thumb"
            style={{
              background: `linear-gradient(to right, rgb(var(--primary)) 0%, rgb(var(--primary)) ${volume}%, #2a241b ${volume}%, #2a241b 100%)`,
            }}
          />
        </div>
        <span className="font-special-elite text-[14px] text-muted-foreground min-w-[1.6rem] text-right">
          100
        </span>
      </div>
    </div>
  );
}
