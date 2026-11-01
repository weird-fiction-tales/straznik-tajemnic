import type { SetStateAction, Dispatch } from 'react';
import { useTranslations } from 'next-intl';
import { AISettings } from '@/lib/ai-settings';
import { HelpIcon } from '../ui/tooltip';

interface GMStyleGridProps {
  settings: AISettings;
  setSettings: Dispatch<SetStateAction<AISettings>>;
}

type ResponseLength =
  AISettings['gameMasterNarration']['style']['responseLength'];
type DetailLevel = AISettings['gameMasterNarration']['style']['detailLevel'];
type Creativity = AISettings['gameMasterNarration']['behavior']['creativity'];

export function GMStyleGrid({ settings, setSettings }: GMStyleGridProps) {
  const t = useTranslations('GMStyleGrid');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label
          htmlFor="gm-response-length"
          className="flex items-center gap-2 text-[14px] font-special-elite uppercase tracking-[0.16em] text-brass mb-2"
        >
          {t('responseLengthLabel')}
          <HelpIcon content={t('responseLengthHelp')} />
        </label>
        <select
          id="gm-response-length"
          data-testid="gm-response-length"
          value={settings.gameMasterNarration.style.responseLength}
          onChange={(e) =>
            setSettings({
              ...settings,
              gameMasterNarration: {
                ...settings.gameMasterNarration,
                style: {
                  ...settings.gameMasterNarration.style,
                  responseLength: e.target.value as ResponseLength,
                },
              },
            })
          }
          className="w-full px-3 py-2 bg-[#1f1a14] border border-brass/30 text-foreground focus:border-primary focus:outline-none"
        >
          <option value="short">{t('lengthShort')}</option>
          <option value="medium">{t('lengthMedium')}</option>
          <option value="long">{t('lengthLong')}</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="gm-detail-level"
          className="flex items-center gap-2 text-[14px] font-special-elite uppercase tracking-[0.16em] text-brass mb-2"
        >
          {t('detailLevelLabel')}
          <HelpIcon content={t('detailLevelHelp')} />
        </label>
        <select
          id="gm-detail-level"
          data-testid="gm-detail-level"
          value={settings.gameMasterNarration.style.detailLevel}
          onChange={(e) =>
            setSettings({
              ...settings,
              gameMasterNarration: {
                ...settings.gameMasterNarration,
                style: {
                  ...settings.gameMasterNarration.style,
                  detailLevel: e.target.value as DetailLevel,
                },
              },
            })
          }
          className="w-full px-3 py-2 bg-[#1f1a14] border border-brass/30 text-foreground focus:border-primary focus:outline-none"
        >
          <option value="minimal">{t('detailMinimal')}</option>
          <option value="standard">{t('detailStandard')}</option>
          <option value="detailed">{t('detailDetailed')}</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="gm-creativity"
          className="flex items-center gap-2 text-[14px] font-special-elite uppercase tracking-[0.16em] text-brass mb-2"
        >
          {t('creativityLabel')}
          <HelpIcon content={t('creativityHelp')} />
        </label>
        <select
          id="gm-creativity"
          data-testid="gm-creativity"
          value={settings.gameMasterNarration.behavior.creativity}
          onChange={(e) =>
            setSettings({
              ...settings,
              gameMasterNarration: {
                ...settings.gameMasterNarration,
                behavior: {
                  ...settings.gameMasterNarration.behavior,
                  creativity: e.target.value as Creativity,
                },
              },
            })
          }
          className="w-full px-3 py-2 bg-[#1f1a14] border border-brass/30 text-foreground focus:border-primary focus:outline-none"
        >
          <option value="conservative">{t('creativityConservative')}</option>
          <option value="balanced">{t('creativityBalanced')}</option>
          <option value="creative">{t('creativityCreative')}</option>
        </select>
      </div>
    </div>
  );
}
