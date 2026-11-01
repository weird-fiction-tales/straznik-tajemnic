'use client';
import { AmbilightSettingsSection } from './ambilight-settings-section';
import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  HueClient,
  getHueStatus,
  hueCommand,
} from '@/lib/hardware/hue/hue-client';
import {
  loadStoredHueConfig,
  initializeHue,
  saveStoredHueConfig,
} from '@/lib/hardware/hue/light-director-service';
import { immersion } from '@/lib/hardware/hue/immersion';
import type {
  HueStatus,
  HueBridgeDiscoveryResult,
} from '@/lib/hardware/hue/types';
import { HueLightingPreview } from './hue-lighting-preview';
export function HueSettingsSection() {
  const t = useTranslations('HueSettings');
  const [config, setConfig] = useState(loadStoredHueConfig);
  const [status, setStatus] = useState<HueStatus>();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<
    | ''
    | 'operationSuccess'
    | 'connectionError'
    | 'linkAborted'
    | 'linkTimeout'
    | 'linkFailed'
    | 'linkSuccess'
  >('');
  const [bridges, setBridges] = useState<HueBridgeDiscoveryResult[]>([]);
  const [countdown, setCountdown] = useState<number>();
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    let alive = true;
    void initializeHue()
      .then((s) => {
        if (alive) {
          setStatus(s);
          setConfig(s.config);
        }
      })
      .catch(() => {
        if (alive) setNotice('connectionError');
      });
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, []);
  const refresh = async () => {
    const s = await getHueStatus();
    setStatus(s);
    setConfig(s.config);
    return s;
  };
  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setNotice('');
    try {
      await task();
      const s = await refresh();
      setNotice(s.error ? 'connectionError' : 'operationSuccess');
    } catch {
      setNotice('connectionError');
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    await saveStoredHueConfig(config);
  };
  const pair = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setNotice('');
    try {
      await save();
      const res = await new HueClient().linkBridgeWithPolling(
        config.bridgeIp,
        setCountdown,
        controller.signal
      );
      if (!res.success) {
        setNotice(
          res.error === 'ABORTED'
            ? 'linkAborted'
            : res.error === 'TIMEOUT'
              ? 'linkTimeout'
              : 'linkFailed'
        );
        return;
      }
      await refresh();
      setNotice('linkSuccess');
    } catch {
      setNotice('connectionError');
    } finally {
      setCountdown(undefined);
      setBusy(false);
    }
  };
  const paired = !!status?.paired;
  const hasTargets =
    config.mode === 'entertainment' && status?.hasClientKey
      ? !!status.areas.find((area) => area.id === config.areaId)?.lightIds
          ?.length
      : config.selectedLightIds.length > 0;
  const available = paired && config.enabled && hasTargets;
  return (
    <section
      data-testid="hue-settings"
      className="space-y-3 border border-brass/30 bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-brass">
            {t('title')}
          </h3>
          <p className="text-xs text-muted-foreground">{t('description')}</p>
        </div>
        <Button variant="outline" onClick={() => setExpanded(!expanded)}>
          {t(expanded ? 'collapse' : 'expand')}
        </Button>
      </div>
      <p data-testid="hue-status" className="text-xs text-muted-foreground">
        {!paired
          ? t('statusDisabled')
          : t(`phase_${status?.phase ?? 'off'}` as const)}
      </p>
      {paired && config.enabled && !hasTargets && (
        <p data-testid="hue-selection-required" className="text-sm text-brass">
          {t('selectionRequired')}
        </p>
      )}
      {expanded && (
        <div className="space-y-4 border-t border-brass/20 pt-3">
          <AmbilightSettingsSection />
          <label className="block text-sm">
            {t('bridgeIpAddress')}
            <input
              data-testid="hue-bridge-ip"
              className="block w-full bg-input text-foreground border border-brass/30 p-2"
              placeholder="192.168.1.xxx"
              value={config.bridgeIp}
              onChange={(e) =>
                setConfig({ ...config, bridgeIp: e.target.value.trim() })
              }
            />
          </label>
          <label className="block text-sm">
            {t('bridgeId')}
            <input
              className="block w-full bg-input text-foreground border border-brass/30 p-2 font-mono"
              maxLength={16}
              value={config.bridgeId ?? ''}
              onChange={(e) =>
                setConfig({ ...config, bridgeId: e.target.value.trim() })
              }
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const found = await HueClient.discoverBridges();
                  setBridges(found);
                  if (found.length)
                    setConfig((c) => ({
                      ...c,
                      bridgeIp: found[0].internalipaddress,
                      bridgeId: found[0].id,
                    }));
                })
              }
            >
              {t('scanLan')}
            </Button>
            <Button
              disabled={busy || !config.bridgeIp || !config.bridgeId}
              onClick={() => void pair()}
            >
              {t('pairBridgeButton')}
            </Button>
            {countdown !== undefined && (
              <>
                <span>
                  {t('pressButtonInstructionWithCountdown', {
                    seconds: countdown,
                  })}
                </span>
                <Button
                  variant="outline"
                  onClick={() => abort.current?.abort()}
                >
                  {t('cancel')}
                </Button>
              </>
            )}
          </div>
          {bridges.map((b) => (
            <Button
              key={b.id}
              variant="outline"
              onClick={() =>
                setConfig({
                  ...config,
                  bridgeIp: b.internalipaddress,
                  bridgeId: b.id,
                })
              }
            >
              {b.internalipaddress}
            </Button>
          ))}
          {!paired && (
            <p className="text-xs text-brass">
              {t('pairRequiredBeforeEnabling')}
            </p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              data-testid="hue-enabled"
              type="checkbox"
              disabled={!paired || busy}
              checked={config.enabled}
              onChange={(e) =>
                setConfig({ ...config, enabled: e.target.checked })
              }
            />
            {t('enabled')}
          </label>
          <fieldset className="space-y-2" disabled={!paired || busy}>
            <legend className="text-sm">{t('selectLightsTitle')}</legend>
            {status?.lights.map((l) => (
              <label key={l.id} className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.selectedLightIds.includes(l.id)}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      selectedLightIds: e.target.checked
                        ? [...config.selectedLightIds, l.id]
                        : config.selectedLightIds.filter((id) => id !== l.id),
                    })
                  }
                />
                {l.metadata.name}
              </label>
            ))}
          </fieldset>
          <label className="block text-sm">
            {t('modeLabel')}
            <select
              data-testid="hue-mode"
              className="block w-full bg-input border border-brass/30 p-2"
              value={config.mode ?? 'basic'}
              onChange={(e) =>
                setConfig({
                  ...config,
                  mode: e.target.value as 'basic' | 'entertainment',
                })
              }
            >
              <option value="basic">{t('modeBasic')}</option>
              <option value="entertainment">{t('modeEntertainment')}</option>
            </select>
          </label>
          {config.mode === 'entertainment' && (
            <div className="space-y-2">
              <label className="block text-sm">
                {t('areaLabel')}
                <select
                  data-testid="hue-area"
                  className="block w-full bg-input border border-brass/30 p-2"
                  value={config.areaId ?? ''}
                  onChange={(e) =>
                    setConfig({ ...config, areaId: e.target.value })
                  }
                >
                  <option value="">{t('chooseArea')}</option>
                  {status?.areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.metadata.name}
                    </option>
                  ))}
                </select>
              </label>
              <p data-testid="hue-area-members" className="text-xs text-brass">
                {t('areaConsent')}{' '}
                {status?.areas
                  .find((a) => a.id === config.areaId)
                  ?.lightIds?.map(
                    (id) =>
                      status.lights.find((l) => l.id === id)?.metadata.name ??
                      id
                  )
                  .join(', ')}
              </p>
              {!status?.hasClientKey && (
                <p className="text-xs text-brass">
                  {t('pairAgainForEntertainment')}
                </p>
              )}
            </div>
          )}
          <label className="block text-sm">
            {t('intensityLabel')}
            <input
              data-testid="hue-intensity"
              className="block w-full"
              type="range"
              min="0.25"
              max="1"
              step="0.05"
              value={config.intensity ?? 1}
              onChange={(e) =>
                setConfig({ ...config, intensity: Number(e.target.value) })
              }
            />
          </label>
          <label className="flex gap-2 text-sm">
            <input
              data-testid="hue-flashes"
              type="checkbox"
              checked={!!config.flashesEnabled}
              onChange={(e) =>
                setConfig({ ...config, flashesEnabled: e.target.checked })
              }
            />
            {t('flashesLabel')}
          </label>
          <Button
            data-testid="hue-save"
            disabled={busy || !paired}
            onClick={() => void run(save)}
          >
            {t('saveSettings')}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!available || busy}
              onClick={() => void run(() => immersion.pause())}
            >
              {t('pause')}
            </Button>
            <Button
              variant="outline"
              disabled={!available || busy}
              onClick={() => void run(() => immersion.resume())}
            >
              {t('resume')}
            </Button>
            <Button
              data-testid="hue-emergency"
              disabled={!available || busy}
              onClick={() => void run(() => immersion.emergency())}
            >
              {t('emergencyLight')}
            </Button>
            <Button
              variant="outline"
              disabled={!paired || busy}
              onClick={() =>
                void run(async () => {
                  await hueCommand('stop');
                })
              }
            >
              {t('restoreLights')}
            </Button>
          </div>
          <HueLightingPreview
            available={available && !busy}
            onResult={(ok) =>
              setNotice(ok ? 'operationSuccess' : 'connectionError')
            }
          />
          {notice && (
            <p
              role="status"
              data-testid="hue-notice"
              className="text-sm text-brass"
            >
              {t(notice)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
