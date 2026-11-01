import {
  DEFAULT_HUE_CONFIG,
  type HueBridgeConfig,
  type HueBridgeDiscoveryResult,
  type HueLightResource,
  type HueLightStateSnapshot,
  type HueStatus,
} from './types';

let ownerId = '';
export function hueOwner(): string {
  if (!ownerId)
    ownerId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'hue-' + Date.now();
  return ownerId;
}
export async function hueCommand<T = { ok: boolean }>(
  action: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch('/api/hue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, owner: hueOwner(), ...params }),
    signal:
      signal ??
      AbortSignal.timeout(
        ['start', 'resume', 'emergency'].includes(action) ? 10000 : 6000
      ),
  });
  const data = await response.json();
  if (!response.ok || data.error)
    throw new Error(typeof data.error === 'string' ? data.error : 'HUE_ERROR');
  return data as T;
}
export async function getHueStatus(): Promise<HueStatus> {
  const r = await fetch('/api/hue', {
    signal: AbortSignal.timeout(6000),
    cache: 'no-store',
  });
  const s = await r.json();
  if (!r.ok || (s.error && !s.config)) throw new Error(s.error ?? 'OFFLINE');
  return s;
}
export class HueClient {
  private config: HueBridgeConfig;
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  constructor(config?: Partial<HueBridgeConfig>) {
    this.config = { ...DEFAULT_HUE_CONFIG, selectedLightIds: [], ...config };
  }
  updateConfig(config: Partial<HueBridgeConfig>): void {
    this.config = { ...this.config, ...config };
  }
  getConfig(): HueBridgeConfig {
    return { ...this.config };
  }
  static async discoverBridges(): Promise<HueBridgeDiscoveryResult[]> {
    return (
      await hueCommand<{ bridges: HueBridgeDiscoveryResult[] }>('discover')
    ).bridges;
  }
  async linkBridge(
    _ip: string
  ): Promise<{ success: boolean; appKey?: string; error?: string }> {
    try {
      await hueCommand('pair');
      this.updateConfig({ paired: true });
      return { success: true, appKey: '' };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'HUE_ERROR',
      };
    }
  }
  async linkBridgeWithPolling(
    ip: string,
    onCountdown?: (seconds: number) => void,
    signal?: AbortSignal,
    timeoutSec = 30
  ): Promise<{ success: boolean; appKey?: string; error?: string }> {
    const deadline = Date.now() + timeoutSec * 1000;
    while (Date.now() < deadline) {
      if (signal?.aborted) return { success: false, error: 'ABORTED' };
      onCountdown?.(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
      try {
        await hueCommand('pair', {}, signal);
        return { success: true };
      } catch (e) {
        if (signal?.aborted) return { success: false, error: 'ABORTED' };
        if (!(e instanceof Error) || e.message !== 'LINK_BUTTON_REQUIRED')
          return {
            success: false,
            error: e instanceof Error ? e.message : 'HUE_ERROR',
          };
      }
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', done);
          resolve();
        };
        const timer = setTimeout(done, 1000);
        signal?.addEventListener('abort', done, { once: true });
      });
    }
    return { success: false, error: signal?.aborted ? 'ABORTED' : 'TIMEOUT' };
  }
  async getLights(): Promise<HueLightResource[]> {
    const s = await getHueStatus();
    if (s.error) throw new Error(s.error);
    return s.lights;
  }
  async captureSnapshot(): Promise<HueLightStateSnapshot[]> {
    const result = await hueCommand<{ snapshot: HueLightStateSnapshot[] }>(
      'start'
    );
    if (!this.heartbeat)
      this.heartbeat = setInterval(() => {
        void hueCommand('heartbeat').catch(() => {});
      }, 2500);
    return result.snapshot;
  }
  clearHeartbeat(): void {
    clearInterval(this.heartbeat);
    this.heartbeat = undefined;
  }
  async emergency(): Promise<void> {
    await hueCommand('emergency');
  }
  async restoreSnapshot(
    _snapshots: HueLightStateSnapshot[],
    _ms = 1000
  ): Promise<void> {
    clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    await hueCommand('stop');
  }
  async setLightState(
    _id: string,
    payload: Record<string, unknown>
  ): Promise<boolean> {
    await hueCommand('state', { payload });
    return true;
  }
  async applyToSelectedLights(payload: Record<string, unknown>): Promise<void> {
    if (!this.config.enabled) throw new Error('DISABLED');
    await hueCommand('state', { payload });
  }
}
