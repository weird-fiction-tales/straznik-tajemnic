'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { HueClient } from '@/lib/hardware/hue/hue-client';
import {
  HueBridgeConfig,
  HueBridgeDiscoveryResult,
  HueLightResource,
} from '@/lib/hardware/hue/types';
import {
  loadStoredHueConfig,
  saveStoredHueConfig,
  getGlobalLightDirector,
} from '@/lib/hardware/hue/light-director-service';

export function HueSettingsSection() {
  const t = useTranslations('HueSettings');
  const [config, setConfig] = useState<HueBridgeConfig>(loadStoredHueConfig);
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [discoveredBridges, setDiscoveredBridges] = useState<HueBridgeDiscoveryResult[]>([]);
  const [lights, setLights] = useState<HueLightResource[]>([]);
  const [isLoadingLights, setIsLoadingLights] = useState(false);
  const [testStatus, setTestStatus] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    saveStoredHueConfig(config);
  }, [config]);

  // Pobierz listę lamp, jeśli mostek jest skonfigurowany
  useEffect(() => {
    if (config.bridgeIp && config.appKey) {
      const client = new HueClient(config);
      setIsLoadingLights(true);
      client
        .getLights()
        .then((res) => {
          setLights(res);
          setIsLoadingLights(false);
        })
        .catch(() => setIsLoadingLights(false));
    }
  }, [config.bridgeIp, config.appKey]);

  const handleToggleEnabled = () => {
    const next = !config.enabled;
    setConfig((prev) => ({ ...prev, enabled: next }));
  };

  const handleScanBridges = async () => {
    setIsScanning(true);
    setStatus(t('scanning'));
    try {
      const bridges = await HueClient.discoverBridges();
      setDiscoveredBridges(bridges);
      if (bridges.length > 0) {
        setStatus(t('foundBridges', { count: bridges.length }));
        if (!config.bridgeIp) {
          setConfig((prev) => ({ ...prev, bridgeIp: bridges[0].internalipaddress }));
        }
      } else {
        setStatus(t('noBridgesFound'));
      }
    } catch {
      setStatus(t('discoveryError'));
    } finally {
      setIsScanning(false);
    }
  };

  const handleLinkBridge = async () => {
    if (!config.bridgeIp) {
      setStatus(t('provideIpFirst'));
      return;
    }

    setIsLinking(true);
    setIsTimedOut(false);
    setCountdown(30);
    setStatus(t('pressButtonInstructionWithCountdown', { seconds: 30 }));

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const client = new HueClient();
    const res = await client.linkBridgeWithPolling(
      config.bridgeIp,
      (sec) => {
        setCountdown(sec);
        setStatus(t('pressButtonInstructionWithCountdown', { seconds: sec }));
      },
      controller.signal,
      30
    );

    if (res.success && res.appKey) {
      setConfig((prev) => ({
        ...prev,
        enabled: true,
        bridgeIp: config.bridgeIp,
        appKey: res.appKey!,
      }));
      setStatus(t('linkSuccess'));
      setCountdown(null);
      setIsTimedOut(false);
    } else if (res.error === 'TIMEOUT') {
      setStatus(t('linkTimeout'));
      setIsTimedOut(true);
      setCountdown(null);
    } else if (res.error === 'ABORTED') {
      setStatus(t('linkAborted'));
      setIsTimedOut(false);
      setCountdown(null);
    } else {
      setStatus(res.error || t('linkFailed'));
      setIsTimedOut(false);
      setCountdown(null);
    }
    setIsLinking(false);
  };

  const handleCancelLink = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLinking(false);
    setCountdown(null);
    setIsTimedOut(false);
    setStatus(t('linkAborted'));
  };

  const handleToggleLight = (lightId: string) => {
    setConfig((prev) => {
      const exists = prev.selectedLightIds.includes(lightId);
      const updated = exists
        ? prev.selectedLightIds.filter((id) => id !== lightId)
        : [...prev.selectedLightIds, lightId];
      return { ...prev, selectedLightIds: updated };
    });
  };

  const handleTestLight = async () => {
    const director = getGlobalLightDirector();
    setTestStatus(t('testLightingSuccess'));
    await director.applyPreset('kerosene_lamp', 1500);
    setTimeout(() => setTestStatus(''), 4000);
  };

  const handleEmergencyLight = async () => {
    const director = getGlobalLightDirector();
    setTestStatus('100%');
    await director.triggerEmergencyLight();
    setTimeout(() => setTestStatus(''), 4000);
  };

  const statusBadge = config.enabled && config.appKey
    ? t('statusActive', { count: config.selectedLightIds.length })
    : t('statusDisabled');

  return (
    <section data-testid="hue-settings" className="space-y-3 border border-brass/30 bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-brass">
            {t('title')}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-primary/80">{statusBadge}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="border-brass/40 text-xs uppercase tracking-wider text-brass"
          >
            {isExpanded ? t('collapse') : t('expand')}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-3 border-t border-brass/20">
          <div className="flex items-center gap-3">
            <Button
              variant={config.enabled ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggleEnabled}
              disabled={!config.appKey}
              className={config.enabled ? 'bg-primary text-[#04110f]' : 'border-brass/40 text-brass'}
            >
              {config.enabled ? t('enabled') : t('disabled')}
            </Button>
            {!config.appKey && (
              <span className="text-xs text-brass">{t('pairRequiredBeforeEnabling')}</span>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('bridgeIpAddress')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={config.bridgeIp}
                onChange={(e) => setConfig((prev) => ({ ...prev, bridgeIp: e.target.value.trim() }))}
                placeholder="192.168.1.xxx"
                className="flex-1 bg-black/40 border border-brass/30 px-3 py-1.5 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleScanBridges}
                disabled={isScanning || isLinking}
                className="border-brass/40 text-xs"
              >
                {isScanning ? t('scanning') : t('scanLan')}
              </Button>
            </div>
            {discoveredBridges.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-1">
                <span>{t('detectedBridges')}</span>
                {discoveredBridges.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setConfig((prev) => ({ ...prev, bridgeIp: b.internalipaddress }))}
                    className="ml-2 underline hover:text-primary font-mono text-xs"
                  >
                    {b.internalipaddress}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Procedura Pushlink (odliczanie 30s / przyciski) */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {!isLinking && !isTimedOut && (
                <Button
                  onClick={handleLinkBridge}
                  disabled={!config.bridgeIp}
                  size="sm"
                  className="bg-primary text-[#04110f] text-xs font-semibold uppercase tracking-wider hover:brightness-110"
                >
                  {t('pairBridgeButton')}
                </Button>
              )}

              {isLinking && (
                <>
                  <Button
                    disabled
                    size="sm"
                    className="bg-primary/80 text-[#04110f] text-xs font-mono font-semibold"
                  >
                    ⏳ {countdown !== null ? `${countdown}s` : t('linking')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelLink}
                    className="border-destructive text-destructive text-xs hover:bg-destructive/10"
                  >
                    {t('cancel')}
                  </Button>
                </>
              )}

              {isTimedOut && !isLinking && (
                <Button
                  onClick={handleLinkBridge}
                  size="sm"
                  className="bg-primary text-[#04110f] text-xs font-semibold uppercase tracking-wider"
                >
                  🔄 {t('retryPairing')}
                </Button>
              )}

              {status && <span className="text-xs text-brass/90">{status}</span>}
            </div>

            {/* Wizualny pasek odliczania 30s */}
            {isLinking && countdown !== null && (
              <div className="w-full bg-black/40 h-1.5 border border-brass/20 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${Math.round((countdown / 30) * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Akcje testowe i awaryjne */}
          {config.appKey && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-brass/10">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestLight}
                className="border-brass/40 text-xs text-brass hover:text-foreground"
              >
                🕯️ {t('testLighting')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEmergencyLight}
                className="border-primary/50 text-xs text-primary hover:bg-primary/10"
              >
                🛡️ {t('emergencyLight')}
              </Button>
              {testStatus && <span className="text-xs text-primary font-mono">{testStatus}</span>}
            </div>
          )}

          {/* Selektor żarówek do gry */}
          {config.appKey && (
            <div className="space-y-2 pt-2 border-t border-brass/10">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('selectLightsTitle')}
              </span>
              {isLoadingLights && <p className="text-xs text-muted-foreground">{t('loadingLights')}</p>}
              {!isLoadingLights && lights.length === 0 && (
                <p className="text-xs text-muted-foreground">{t('noLightsFound')}</p>
              )}
              {!isLoadingLights && lights.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {lights.map((l) => {
                    const checked = config.selectedLightIds.includes(l.id);
                    return (
                      <label
                        key={l.id}
                        className="flex items-center gap-2 p-2 border border-brass/20 bg-black/20 text-xs cursor-pointer hover:border-primary/50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleLight(l.id)}
                          className="accent-primary"
                        />
                        <span className="font-display font-medium text-foreground">
                          {l.metadata.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
