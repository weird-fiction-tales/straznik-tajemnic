'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  ambilightAction,
  saveAmbilightStatus,
  type AmbilightStatus,
} from '@/lib/hardware/ambilight/client';

export function AmbilightSettingsSection() {
  const t = useTranslations('AmbilightSettings');
  const [status, setStatus] = useState<AmbilightStatus>({
    paired: false,
    enabled: false,
    ip: '',
    name: '',
  });
  const [ip, setIp] = useState('');
  const [pin, setPin] = useState('');
  const [pinRequired, setPinRequired] = useState(false);
  const [devices, setDevices] = useState<{ ip: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const update = (next: AmbilightStatus) => {
    setStatus(next);
    saveAmbilightStatus(next);
  };
  useEffect(() => {
    let active = true;
    ambilightAction<AmbilightStatus>()
      .then((next) => {
        if (active) {
          setStatus(next);
          saveAmbilightStatus(next);
          setIp(next.ip);
        }
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    setLoadFailed(false);
    try {
      await work();
    } catch (error) {
      const code = error instanceof Error ? error.message : 'offline';
      const known = [
        'invalidAddress',
        'unsupported',
        'pairing',
        'expired',
        'invalidPin',
        'notPaired',
        'authentication',
        'certificateChanged',
        'disconnectFirst',
        'storage',
      ] as const;
      setMessage(t(known.find((item) => item === code) ?? 'offline'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      data-testid="ambilight-settings"
      className="space-y-3 border-t border-brass/30 pt-4"
    >
      <h4 className="font-display text-sm uppercase tracking-wider text-brass">
        {t('title')}
      </h4>
      <p className="text-xs text-muted-foreground">{t('description')}</p>
      <p
        data-testid="ambilight-status"
        className="text-xs text-primary"
        aria-live="polite"
      >
        {status.paired
          ? `${status.name} (${status.ip}) - ${t(status.enabled ? 'active' : 'inactive')}`
          : t('unpaired')}
      </p>
      {!status.paired && (
        <>
          <label
            className="block text-xs text-muted-foreground"
            htmlFor="ambilight-ip"
          >
            {t('ip')}
          </label>
          <input
            id="ambilight-ip"
            value={ip}
            onChange={(event) => {
              setIp(event.target.value.trim());
              setPinRequired(false);
            }}
            disabled={busy || pinRequired}
            placeholder="192.168.1.50"
            className="border border-brass/30 bg-input px-3 py-2 font-mono text-xs text-foreground"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy || pinRequired}
              onClick={() =>
                void run(async () => {
                  const result = await ambilightAction<{
                    devices: typeof devices;
                  }>('discover');
                  setDevices(result.devices);
                  if (!result.devices.length) setMessage(t('notFound'));
                })
              }
            >
              {t('discover')}
            </Button>
            <Button
              size="sm"
              disabled={busy || !ip || pinRequired}
              onClick={() =>
                void run(async () => {
                  await ambilightAction('pair', { ip });
                  setPinRequired(true);
                  setMessage(t('enterPin'));
                })
              }
            >
              {t('pair')}
            </Button>
          </div>
          {devices.map((device) => (
            <button
              key={device.ip}
              disabled={busy || pinRequired}
              onClick={() => setIp(device.ip)}
              className="block font-mono text-xs text-brass underline"
            >
              {device.name} ({device.ip})
            </button>
          ))}
          {pinRequired && (
            <div className="space-y-2">
              <label
                htmlFor="ambilight-pin"
                className="block text-xs text-brass"
              >
                {t('enterPin')}
              </label>
              <input
                id="ambilight-pin"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                value={pin}
                onChange={(event) =>
                  setPin(event.target.value.replace(/\D/g, ''))
                }
                className="border border-brass/30 bg-input px-3 py-2 font-mono text-foreground"
              />
              <Button
                size="sm"
                disabled={busy || pin.length !== 4}
                onClick={() =>
                  void run(async () => {
                    update(
                      await ambilightAction<AmbilightStatus>('confirm', { pin })
                    );
                    setPin('');
                    setPinRequired(false);
                    setMessage(t('paired'));
                  })
                }
              >
                {t('confirm')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setPinRequired(false);
                  setPin('');
                  setMessage('');
                }}
              >
                {t('cancel')}
              </Button>
            </div>
          )}
        </>
      )}
      {status.paired && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                update(
                  await ambilightAction<AmbilightStatus>('enable', {
                    enabled: !status.enabled,
                  })
                );
              })
            }
          >
            {t(status.enabled ? 'disable' : 'enable')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !status.enabled}
            onClick={() =>
              void run(async () => {
                // A static test avoids startling the player while pairing.
                await ambilightAction('effect', {
                  payload: {
                    on: { on: true },
                    dimming: { brightness: 40 },
                    color_temperature: { mirek: 370 },
                  },
                });
                setMessage(t('testSuccess'));
              })
            }
          >
            {t('test')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                update(
                  await ambilightAction<AmbilightStatus>('enable', {
                    enabled: false,
                  })
                );
                setMessage(t('restored'));
              })
            }
          >
            {t('restore')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                update(await ambilightAction<AmbilightStatus>('disconnect'));
                setPinRequired(false);
                setMessage(t('disconnected'));
              })
            }
          >
            {t('disconnect')}
          </Button>
        </div>
      )}
      {loadFailed && (
        <p role="status" className="text-xs text-brass">
          {t('offline')}
        </p>
      )}
      {busy && (
        <p role="status" className="text-xs text-muted-foreground">
          {t('busy')}
        </p>
      )}
      {message && (
        <p role="status" className="text-xs text-brass">
          {message}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t('note')}</p>
    </section>
  );
}
