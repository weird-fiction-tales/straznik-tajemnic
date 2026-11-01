import { AmbilightClient, AMBILIGHT_CHANGED } from '../ambilight/client';
import { LightDirector } from './light-director';
import { HueClient, hueCommand, getHueStatus } from './hue-client';
import {
  DEFAULT_HUE_CONFIG,
  type HueBridgeConfig,
  type HueStatus,
} from './types';
export const HUE_CONFIG_STORAGE_KEY = 'straznik_hue_config';
export function loadStoredHueConfig(): HueBridgeConfig {
  try {
    const raw =
      typeof window === 'undefined'
        ? null
        : localStorage.getItem(HUE_CONFIG_STORAGE_KEY);
    const cfg = raw ? JSON.parse(raw) : {};
    return {
      ...DEFAULT_HUE_CONFIG,
      ...cfg,
      selectedLightIds: Array.isArray(cfg.selectedLightIds)
        ? cfg.selectedLightIds.filter((x: unknown) => typeof x === 'string')
        : [],
    };
  } catch {
    return { ...DEFAULT_HUE_CONFIG, selectedLightIds: [] };
  }
}
let globalDirectorInstance: LightDirector | undefined;
export function getGlobalLightDirector(): LightDirector {
  return (globalDirectorInstance ??= new LightDirector(
    new HueClient(loadStoredHueConfig()), new AmbilightClient()
  ));
}
function remember(cfg: HueBridgeConfig): void {
  if (typeof window === 'undefined') return;
  const safe = { ...cfg, appKey: '' };
  localStorage.setItem(HUE_CONFIG_STORAGE_KEY, JSON.stringify(safe));
  getGlobalLightDirector().getClient().updateConfig(safe);
  window.dispatchEvent(
    new CustomEvent('straznik_hue_config_changed', { detail: safe })
  );
}
if (typeof window !== 'undefined') window.addEventListener(AMBILIGHT_CHANGED, () => globalDirectorInstance?.cancelPending());
let initializing: Promise<HueStatus> | undefined;
export function initializeHue(): Promise<HueStatus> {
  if (initializing) return initializing;
  initializing = (async () => {
    const legacy = loadStoredHueConfig();
    if (legacy.appKey) await hueCommand('import', { config: legacy });
    const status = await getHueStatus();
    remember(status.config);
    return status;
  })().finally(() => {
    initializing = undefined;
  });
  return initializing;
}
export async function saveStoredHueConfig(cfg: HueBridgeConfig): Promise<void> {
  await hueCommand('configure', { config: { ...cfg, appKey: '' } });
  getGlobalLightDirector().resetSession();
  remember(cfg);
}
