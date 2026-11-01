'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { PRABUTY_SCENES } from '@/lib/hardware/hue/score';
import { immersion } from '@/lib/hardware/hue/immersion';
import { hueCommand } from '@/lib/hardware/hue/hue-client';
export function HueLightingPreview({
  available,
  onResult,
}: {
  available: boolean;
  onResult: (ok: boolean) => void;
}) {
  const t = useTranslations('HueSettings');
  const locale = useLocale() === 'en' ? 'en' : 'pl';
  const [sceneId, setSceneId] = useState(PRABUTY_SCENES[0].sceneId);
  const scene = PRABUTY_SCENES.find((s) => s.sceneId === sceneId)!;
  const run = async (accent?: string) => {
    try {
      await immersion.selectScene(sceneId, true);
      if (accent) await hueCommand('accent', { kind: accent });
      onResult(true);
    } catch {
      onResult(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { adventureId: 'cien-nad-prabutami', scenes: PRABUTY_SCENES },
            null,
            2
          ),
        ],
        { type: 'application/json' }
      )
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prabuty-lighting.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section
      data-testid="hue-lighting-preview"
      className="space-y-3 border-t border-brass/30 pt-4"
    >
      <h4 className="font-display text-brass">{t('scoreTitle')}</h4>
      <label className="block text-sm">
        {t('sceneLabel')}
        <select
          data-testid="hue-scene-select"
          className="mt-1 w-full bg-input text-foreground border border-brass/30 p-2"
          value={sceneId}
          onChange={(e) => setSceneId(e.target.value)}
        >
          {PRABUTY_SCENES.map((s) => (
            <option key={s.sceneId} value={s.sceneId}>
              {s.name[locale]}
            </option>
          ))}
        </select>
      </label>
      <p
        data-testid="hue-scene-values"
        className="font-mono text-sm text-muted-foreground"
      >
        {t('sceneValues', {
          brightness: scene.lighting.brightness,
          seconds: scene.lighting.transitionMs / 1000,
        })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          data-testid="hue-preview-base"
          disabled={!available}
          onClick={() => void run()}
        >
          {t('previewBase')}
        </Button>
        {scene.lighting.accents.map((a) => (
          <Button
            key={a.id}
            variant="outline"
            disabled={!available}
            onClick={() => void run(a.effectId)}
          >
            {t(`effect_${a.effectId}` as const)}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t('previewNotice')}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={download}>
          {t('exportScore')}
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          {t('printScore')}
        </Button>
        <Button
          variant="outline"
          disabled={!available}
          onClick={() => {
            void immersion
              .end('preview-' + Date.now())
              .then(() => onResult(true))
              .catch(() => onResult(false));
          }}
        >
          {t('endPreview')}
        </Button>
      </div>
      <table className="w-full text-xs text-left">
        <caption className="sr-only">{t('scoreTitle')}</caption>
        <thead>
          <tr>
            <th>{t('sceneLabel')}</th>
            <th>{t('brightnessLabel')}</th>
            <th>{t('transitionLabel')}</th>
          </tr>
        </thead>
        <tbody>
          {PRABUTY_SCENES.map((s) => (
            <tr key={s.sceneId} className="border-t border-brass/20">
              <td className="py-2">{s.name[locale]}</td>
              <td>{s.lighting.brightness}%</td>
              <td>{s.lighting.transitionMs / 1000} s</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
