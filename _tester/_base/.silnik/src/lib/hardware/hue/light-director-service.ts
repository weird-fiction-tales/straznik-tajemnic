/**
 * @file light-director-service.ts
 * Globalny singleton i serwis zarządzania Reżyserem Światła Philips Hue.
 * Zapewnia spójność stanu oświetlenia między panelem bocznym, ustawieniami a narracją czatu.
 */

import { LightDirector } from './light-director';
import { HueClient } from './hue-client';
import { HueBridgeConfig } from './types';

export const HUE_CONFIG_STORAGE_KEY = 'straznik_hue_config';

export function loadStoredHueConfig(): HueBridgeConfig {
  if (typeof window === 'undefined') {
    return { enabled: false, bridgeIp: '', appKey: '', selectedLightIds: [] };
  }
  try {
    const raw = localStorage.getItem(HUE_CONFIG_STORAGE_KEY);
    if (!raw) return { enabled: false, bridgeIp: '', appKey: '', selectedLightIds: [] };
    return JSON.parse(raw);
  } catch {
    return { enabled: false, bridgeIp: '', appKey: '', selectedLightIds: [] };
  }
}

let globalDirectorInstance: LightDirector | null = null;

export function getGlobalLightDirector(): LightDirector {
  if (!globalDirectorInstance) {
    const cfg = loadStoredHueConfig();
    const client = new HueClient(cfg);
    globalDirectorInstance = new LightDirector(client);

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === HUE_CONFIG_STORAGE_KEY && e.newValue) {
          try {
            const updated = JSON.parse(e.newValue);
            globalDirectorInstance?.getClient().updateConfig(updated);
          } catch {
            // ignoruj błędy parsowania
          }
        }
      });
    }
  }
  return globalDirectorInstance;
}

export function saveStoredHueConfig(cfg: HueBridgeConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HUE_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  const director = getGlobalLightDirector();
  director.getClient().updateConfig(cfg);
  window.dispatchEvent(new CustomEvent('straznik_hue_config_changed', { detail: cfg }));
}
