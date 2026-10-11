/**
 * @file hue-client.ts
 * Klient HTTP dla Philips Hue Bridge v2 (REST CLIP v2).
 * W 100% lokalny w sieci LAN (Zero Cloud), odporny na błędy sieciowe i rozłączenia.
 */

import {
  HueBridgeConfig,
  HueBridgeDiscoveryResult,
  HueLightResource,
  HueLightStateSnapshot,
} from './types';

export class HueClient {
  private config: HueBridgeConfig;

  constructor(config?: Partial<HueBridgeConfig>) {
    this.config = {
      enabled: false,
      bridgeIp: '',
      appKey: '',
      selectedLightIds: [],
      ...config,
    };
  }

  public updateConfig(newConfig: Partial<HueBridgeConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): HueBridgeConfig {
    return { ...this.config };
  }

  /**
   * Automatyczne wykrywanie mostka w sieci LAN przy użyciu oficjalnego endpointu Discovery
   */
  public static async discoverBridges(): Promise<HueBridgeDiscoveryResult[]> {
    try {
      const response = await fetch('https://discovery.meethue.com/', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return [];
      const data = await response.json();
      if (!Array.isArray(data)) return [];
      return data.map((b) => ({
        id: b.id,
        internalipaddress: b.internalipaddress,
        port: b.port,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Procedura parowania (Pushlink): wysyła POST /api z nazwą aplikacji.
   * Użytkownik musi uprzednio wcisnąć fizyczny przycisk na mostku.
   */
  public async linkBridge(
    bridgeIp: string,
    appName = 'straznik-tajemnic#pc'
  ): Promise<{ success: boolean; appKey?: string; error?: string }> {
    try {
      const url = `http://${bridgeIp}/api`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          devicetype: appName,
          generateclientkey: true,
        }),
      });

      const data = await response.json();
      if (Array.isArray(data) && data[0]) {
        if (data[0].success && data[0].success.username) {
          const key = data[0].success.username;
          this.updateConfig({ bridgeIp, appKey: key });
          return { success: true, appKey: key };
        }
        if (data[0].error) {
          return { success: false, error: data[0].error.description };
        }
      }
      return { success: false, error: 'Nieznana odpowiedź mostka' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Procedura parowania (Pushlink) z 30-sekundowym odpytywaniem w tle.
   * Użytkownik ma czas podejść do mostka i wcisnąć przycisk.
   */
  public async linkBridgeWithPolling(
    bridgeIp: string,
    onCountdown?: (secondsLeft: number) => void,
    abortSignal?: AbortSignal,
    timeoutSec = 30
  ): Promise<{ success: boolean; appKey?: string; error?: string }> {
    let secondsLeft = timeoutSec;
    if (onCountdown) onCountdown(secondsLeft);

    while (secondsLeft > 0) {
      if (abortSignal?.aborted) {
        return { success: false, error: 'ABORTED' };
      }

      const res = await this.linkBridge(bridgeIp);
      if (res.success && res.appKey) {
        return res;
      }

      if (res.error && res.error.toLowerCase().includes('link button not pressed')) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        secondsLeft -= 1;
        if (onCountdown) onCountdown(secondsLeft);
      } else {
        return res;
      }
    }

    return { success: false, error: 'TIMEOUT' };
  }

  /**
   * Pobiera listę zasobów oświetlenia z mostka (oficjalne Hue API v1 LAN na porcie 80)
   */
  public async getLights(): Promise<HueLightResource[]> {
    if (!this.config.bridgeIp || !this.config.appKey) return [];

    try {
      const url = `http://${this.config.bridgeIp}/api/${this.config.appKey}/lights`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) return [];
      const data = await response.json();
      if (!data || typeof data !== 'object') return [];

      // Kompatybilność z formatem CLIP v2 (jeśli mostek go zwraca)
      if (Array.isArray(data.data)) {
        return data.data as HueLightResource[];
      }

      if (Array.isArray(data)) return [];

      interface HueV1LightItem {
        name?: string;
        type?: string;
        state?: {
          on?: boolean;
          bri?: number;
          ct?: number;
          xy?: [number, number];
        };
      }

      // Oficjalny format Hue API v1 LAN: { "1": { name, state: { on, bri, ct, xy, ... } } }
      return Object.entries(data as Record<string, HueV1LightItem>).map(([id, item]) => ({
        id,
        metadata: {
          name: item.name || `Światło ${id}`,
          archetype: item.type || 'light',
        },
        on: {
          on: !!item.state?.on,
        },
        dimming: {
          brightness: Math.round(((item.state?.bri ?? 254) / 254) * 100),
        },
        color_temperature: {
          mirek: typeof item.state?.ct === 'number' ? item.state.ct : null,
        },
        color:
          Array.isArray(item.state?.xy) && item.state.xy.length === 2
            ? { xy: { x: item.state.xy[0], y: item.state.xy[1] } }
            : undefined,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Wykonuje migawkę (snapshot) bieżącego stanu wybranych świateł
   */
  public async captureSnapshot(): Promise<HueLightStateSnapshot[]> {
    const lights = await this.getLights();
    const targetIds =
      this.config.selectedLightIds.length > 0
        ? this.config.selectedLightIds
        : lights.map((l) => l.id);

    return lights
      .filter((l) => targetIds.includes(l.id))
      .map((l) => ({
        lightId: l.id,
        on: l.on.on,
        brightness: l.dimming?.brightness,
        mirek: l.color_temperature?.mirek,
        xy: l.color?.xy,
      }));
  }

  /**
   * Przywraca stan świateł z zapisanej migawki (Safety & Restore)
   */
  public async restoreSnapshot(
    snapshots: HueLightStateSnapshot[],
    transitionMs = 3000
  ): Promise<void> {
    if (!this.config.bridgeIp || !this.config.appKey) return;

    for (const snap of snapshots) {
      const payload: Record<string, unknown> = {
        on: { on: snap.on },
        dynamics: { duration: transitionMs },
      };

      if (snap.brightness !== undefined) {
        payload.dimming = { brightness: snap.brightness };
      }
      if (snap.mirek !== undefined && snap.mirek !== null) {
        payload.color_temperature = { mirek: snap.mirek };
      } else if (snap.xy) {
        payload.color = { xy: snap.xy };
      }

      await this.setLightState(snap.lightId, payload);
    }
  }

  /**
   * Ustawia stan pojedynczego światła przez Hue API v1 LAN
   */
  public async setLightState(
    lightId: string,
    payload: Record<string, unknown>
  ): Promise<boolean> {
    if (!this.config.bridgeIp || !this.config.appKey) return false;

    try {
      const v1Body: Record<string, unknown> = {};

      if (payload.on && typeof payload.on === 'object' && 'on' in payload.on) {
        v1Body.on = (payload.on as { on: boolean }).on;
      }

      if (
        payload.dimming &&
        typeof payload.dimming === 'object' &&
        'brightness' in payload.dimming
      ) {
        const b = (payload.dimming as { brightness: number }).brightness;
        v1Body.bri = Math.max(1, Math.min(254, Math.round((b / 100) * 254)));
      }

      if (
        payload.color_temperature &&
        typeof payload.color_temperature === 'object' &&
        'mirek' in payload.color_temperature
      ) {
        v1Body.ct = (payload.color_temperature as { mirek: number }).mirek;
      } else if (
        payload.color &&
        typeof payload.color === 'object' &&
        'xy' in payload.color
      ) {
        const xy = (payload.color as { xy: { x: number; y: number } }).xy;
        v1Body.xy = [xy.x, xy.y];
      }

      if (
        payload.dynamics &&
        typeof payload.dynamics === 'object' &&
        'duration' in payload.dynamics
      ) {
        const durationMs = (payload.dynamics as { duration: number }).duration;
        v1Body.transitiontime = Math.round(durationMs / 100);
      }

      const url = `http://${this.config.bridgeIp}/api/${this.config.appKey}/lights/${lightId}/state`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(v1Body),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Aplikuje komendę do wszystkich aktualnie wybranych świateł
   */
  public async applyToSelectedLights(
    payload: Record<string, unknown>
  ): Promise<void> {
    if (!this.config.enabled || !this.config.bridgeIp || !this.config.appKey) {
      return;
    }

    const lightIds = this.config.selectedLightIds;
    if (lightIds.length === 0) return;

    // Wysyłamy asynchronicznie bez blokowania wątku
    await Promise.allSettled(
      lightIds.map((id) => this.setLightState(id, payload))
    );
  }
}
