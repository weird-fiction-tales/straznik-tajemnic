/**
 * @file light-director.ts
 * Reżyser Światła (Smart Lighting Director) dla Strażnika Tajemnic AI.
 * Odpowiada za deterministyczne mapowanie stanu świata i somatyczne impulsy grozy na fizyczne oświetlenie.
 */

import type { LightingTarget } from '../ambilight/client';
import type { LightingPayload } from '../ambilight/color';
import { HueClient } from './hue-client';
import { HueLightStateSnapshot, LightPreset, SceneLightingMood } from './types';
import presetsData from './light-presets.json';
import { resolveLightingScene } from './score';

export class LightDirector {
  private client: HueClient;
  private initialSnapshot: HueLightStateSnapshot[] | null = null;
  private currentMood: SceneLightingMood = 'kerosene_lamp';
  private presets: Record<string, LightPreset>;
  private lastFlashTimestamp: number = 0;
  private readonly FLASH_COOLDOWN_MS = 1500;
  private suspended = false;
  private generation = 0;
  private pending = new Set<ReturnType<typeof setTimeout>>();
  private starting: Promise<void> | null = null;

  public cancelPending(): void {
    this.generation += 1;
    for (const timer of this.pending) clearTimeout(timer);
    this.pending.clear();
  }

  public cancelPendingEffects(): void { this.cancelPending(); }

  private async applyLights(payload: Record<string, unknown>): Promise<void> {
    if (this.suspended) return;
    const hue = this.client.applyToSelectedLights(payload);
    if (this.additionalTarget?.isEnabled()) void this.additionalTarget.apply(payload as LightingPayload).catch(() => undefined);
    await hue;
  }

  public pause(): void {
    this.suspended = true;
    this.cancelPending();
  }
  public async resume(): Promise<void> {
    this.suspended = false;
    await this.applyPreset(this.currentMood);
  }

  private schedule(callback: () => Promise<void>, delay: number): void {
    if (this.suspended) return;
    const generation = this.generation;
    const timer = setTimeout(() => {
      this.pending.delete(timer);
      if (generation === this.generation && !this.suspended)
        void callback().catch(() => {});
    }, delay);
    this.pending.add(timer);
  }

  constructor(client: HueClient, private additionalTarget?: LightingTarget) {
    this.client = client;
    this.presets = (
      presetsData as unknown as { presets: Record<string, LightPreset> }
    ).presets;
  }

  /**
   * Bezpiecznik sensoryczny: minimalny odstęp 1.5 s między gwałtownymi rozbłyskami
   */
  public canTriggerFlash(): boolean {
    const now = Date.now();
    if (now - this.lastFlashTimestamp < this.FLASH_COOLDOWN_MS) {
      return false;
    }
    this.lastFlashTimestamp = now;
    return true;
  }

  public resetSession(): void {
    this.cancelPending();
    this.initialSnapshot = null;
    this.starting = null;
    this.suspended = false;
    this.client.clearHeartbeat();
  }

  public getClient(): HueClient {
    return this.client;
  }

  public getPresets(): Record<string, LightPreset> {
    return this.presets;
  }

  public getCurrentMood(): SceneLightingMood {
    return this.currentMood;
  }

  /**
   * Start sesji: pobiera stan początkowy oświetlenia do bezpiecznego przywrócenia (Safety Snapshot)
   */
  public async onSessionStart(applyDefault = true): Promise<void> {
    const config = this.client.getConfig();
    if (!config.enabled && !this.additionalTarget?.isEnabled()) return;

    if (this.starting) return this.starting ?? undefined;
    this.suspended = false;
    this.starting = (async () => {
      if (config.enabled) this.initialSnapshot = await this.client.captureSnapshot();
      if (applyDefault) await this.applyPreset('kerosene_lamp', 3000);
    })();
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }

  /**
   * Zakończenie sesji [KONIEC_SESJI]: bezpieczne przywrócenie stanu oświetlenia sprzed gry
   */
  public async onSessionEnd(): Promise<void> {
    this.pause();
    if (this.starting) await this.starting;
    await Promise.allSettled([
      this.initialSnapshot ? this.client.restoreSnapshot(this.initialSnapshot, 4000) : Promise.resolve(),
      this.additionalTarget?.end() ?? Promise.resolve(),
    ]);
    this.initialSnapshot = null;
  }

  /**
   * Awaryjny przycisk bezpieczeństwa w UI (Emergency Light):
   * Natychmiast zapala bezpieczne, jasne światło domowe (2700K, 100% jasności)
   */
  public async triggerEmergencyLight(): Promise<void> {
    this.pause();
    await Promise.allSettled([
      this.client.getConfig().enabled ? this.client.emergency() : Promise.resolve(),
      this.additionalTarget?.isEnabled() ? this.additionalTarget.apply({ on: { on: true }, dimming: { brightness: 100 }, color_temperature: { mirek: 370 } }) : Promise.resolve(),
    ]);
  }

  /**
   * Zastosowanie konkretnego nastroju barwnego (np. zmiana lokacji lub pory dnia)
   */
  public async applyPreset(
    presetId: SceneLightingMood | string,
    overrideTransitionMs?: number,
    brightness?: number
  ): Promise<boolean> {
    const preset = this.presets[presetId];
    if (!preset || this.suspended) return false;

    this.currentMood = presetId as SceneLightingMood;
    const duration = overrideTransitionMs ?? preset.transitionMs;

    const payload: Record<string, unknown> = {
      on: { on: true },
      dimming: { brightness: brightness ?? preset.brightness },
      dynamics: { duration },
    };

    if (preset.mirek) {
      payload.color_temperature = { mirek: preset.mirek };
    } else if (preset.xy) {
      payload.color = { xy: { x: preset.xy[0], y: preset.xy[1] } };
    }

    await this.applyLights(payload);
    return true;
  }

  /**
   * Somatyczny Szok: Reakcja na utratę Poczytalności (SAN Loss).
   * Krok 1: Natychmiastowe zgaśnięcie do ciemności (200 ms).
   * Krok 2: Powolna adaptacja wzroku do mroku i powrót do nastroju sceny (4000 ms).
   */
  public async triggerSanityShock(): Promise<void> {
    const config = this.client.getConfig();
    if ((!config.enabled && !this.additionalTarget?.isEnabled()) || this.suspended) return;

    // Krok 1: Natychmiastowe uderzenie ciemności
    await this.applyLights({
      on: { on: true },
      dimming: { brightness: 3 }, // prawie całkowity mrok
      dynamics: { duration: 200 },
    });

    // Krok 2: Adaptacja wzroku po 1.2 sekundy szoku
    this.schedule(async () => {
      await this.applyPreset(this.currentMood, 4000);
    }, 1200);
  }

  /**
   * Subtelny impuls zakłócenia (Flicker / Pech / Fumble)
   */
  public async triggerFlicker(): Promise<void> {
    const config = this.client.getConfig();
    if ((!config.enabled && !this.additionalTarget?.isEnabled()) || this.suspended) return;

    const currentPreset = this.presets[this.currentMood];
    const baseBrightness = currentPreset ? currentPreset.brightness : 35;

    // Krótkie przygaśnięcie
    await this.applyLights({
      dimming: { brightness: Math.max(5, Math.floor(baseBrightness * 0.2)) },
      dynamics: { duration: 150 },
    });

    this.schedule(async () => {
      await this.applyLights({
        dimming: { brightness: baseBrightness },
        dynamics: { duration: 300 },
      });
    }, 250);
  }

  /**
   * Piorun: Błyskawiczny, zimny rozbłysk 80 ms (6500K / 100% jasności) i powrót do barwy sceny.
   */
  public async triggerLightningFlash(): Promise<boolean> {
    const config = this.client.getConfig();
    if ((!config.enabled && !this.additionalTarget?.isEnabled()) || this.suspended || !this.canTriggerFlash())
      return false;

    const currentPreset = this.presets[this.currentMood];
    const restoreMs = currentPreset ? currentPreset.transitionMs : 2000;

    await this.applyLights({
      on: { on: true },
      dimming: { brightness: 100 },
      color_temperature: { mirek: 153 }, // 6500K zimna biel wyładowania
      dynamics: { duration: 80 },
    });

    this.schedule(async () => {
      await this.applyPreset(this.currentMood, restoreMs);
    }, 100);

    return true;
  }

  /**
   * Wystrzał / Eksplozja: Ciepły mikro-rozbłysk 60 ms (żółć/ciepła biel 100%) i powrót do barwy sceny.
   */
  public async triggerGunshotFlash(): Promise<boolean> {
    const config = this.client.getConfig();
    if ((!config.enabled && !this.additionalTarget?.isEnabled()) || this.suspended || !this.canTriggerFlash())
      return false;

    const currentPreset = this.presets[this.currentMood];
    const restoreMs = currentPreset ? currentPreset.transitionMs : 1500;

    await this.applyLights({
      on: { on: true },
      dimming: { brightness: 100 },
      color_temperature: { mirek: 333 }, // 3000K błysk prochu
      dynamics: { duration: 60 },
    });

    this.schedule(async () => {
      await this.applyPreset(this.currentMood, restoreMs);
    }, 80);

    return true;
  }

  /**
   * Spięcie elektryczne / Iskra: Podwójne mikro-migotanie 120 ms.
   */
  public async triggerElectricalSpark(): Promise<boolean> {
    const config = this.client.getConfig();
    if ((!config.enabled && !this.additionalTarget?.isEnabled()) || this.suspended || !this.canTriggerFlash())
      return false;

    // Błysk 1
    await this.applyLights({
      dimming: { brightness: 90 },
      color_temperature: { mirek: 180 },
      dynamics: { duration: 50 },
    });

    this.schedule(async () => {
      // Przygaśnięcie
      await this.applyLights({
        dimming: { brightness: 10 },
        dynamics: { duration: 40 },
      });

      this.schedule(async () => {
        // Błysk 2
        await this.applyLights({
          dimming: { brightness: 85 },
          dynamics: { duration: 50 },
        });

        this.schedule(async () => {
          await this.applyPreset(this.currentMood, 800);
        }, 60);
      }, 50);
    }, 60);

    return true;
  }

  /**
   * Silnik Atmosferyczny: modyfikuje jasność i temperaturę presetu na podstawie aury (Q2 -> B)
   */
  public applyWeatherModifier(
    basePreset: LightPreset,
    weather?: string
  ): { brightness: number; duration: number } {
    let brightness = basePreset.brightness;
    let duration = basePreset.transitionMs;

    if (!weather) return { brightness, duration };
    const w = weather.toLowerCase();

    if (w.includes('burz') || w.includes('nawałnic') || w.includes('storm')) {
      brightness = Math.max(4, Math.floor(brightness * 0.7)); // przyciemnienie burzowe
      duration = 2000;
    } else if (w.includes('mgł') || w.includes('fog')) {
      brightness = Math.max(6, Math.floor(brightness * 0.85));
      duration = 4500;
    } else if (w.includes('deszcz') || w.includes('rain')) {
      brightness = Math.max(5, Math.floor(brightness * 0.8));
    }

    return { brightness, duration };
  }

  /**
   * Deterministyczna analiza stanu gry: dobór nastroju na podstawie pory dnia, lokacji i słów kluczowych (Q1 -> C)
   */
  public evaluateEnvironmentMood(params: {
    adventureId?: string;
    hour?: number;
    isOutdoor?: boolean;
    isUnderground?: boolean;
    isSanatoriumOrClinic?: boolean;
    isOccultScene?: boolean;
    explicitMood?: SceneLightingMood;
    locationText?: string;
  }): SceneLightingMood {
    if (params.adventureId === 'cien-nad-prabutami' && params.locationText) {
      const scene = resolveLightingScene(params.locationText);
      const preset = scene?.lighting.presetId;
      if (preset && this.presets[preset]) return preset as SceneLightingMood;
    }
    // 1. Jawny wybór z węzła przygody (Q1 -> C priorytet)
    if (params.explicitMood && this.presets[params.explicitMood]) {
      return params.explicitMood;
    }

    // 2. Klasyfikacja semantyczna z nazwy/opisu lokacji
    if (params.locationText) {
      const txt = params.locationText.toLowerCase();
      // Priorytet 1: Anomalie Mitów i nadnaturalne zjawiska
      if (
        txt.includes('kolor z innego') ||
        txt.includes('meteoryt') ||
        txt.includes('anomali') ||
        txt.includes('nieziemsk')
      ) {
        return 'colour_out_of_space';
      }
      if (
        txt.includes('rytuał') ||
        txt.includes('ołtarz') ||
        txt.includes('krwaw') ||
        txt.includes('ofiarn')
      ) {
        return 'bloody_ritual';
      }
      if (
        txt.includes("r'lyeh") ||
        txt.includes('rlyeh') ||
        txt.includes('cyklopow') ||
        txt.includes('lodowat')
      ) {
        return 'frozen_rlyeh';
      }

      // Priorytet 2: Specyficzne lokacje fabularne
      if (
        /\b(las\w*|leśn\w*|bór|boru|puszcz\w*|drzew\w*)\b/i.test(txt) ||
        /\bsad\b/i.test(txt)
      ) {
        return 'deep_forest';
      }
      if (
        txt.includes('bagn') ||
        txt.includes('moczar') ||
        txt.includes('torf')
      ) {
        return 'murky_swamp';
      }
      if (
        txt.includes('kopaln') ||
        txt.includes('sztolni') ||
        txt.includes('bunk') ||
        txt.includes('szyb')
      ) {
        return 'mine_shaft';
      }
      if (
        txt.includes('morz') ||
        txt.includes('port') ||
        txt.includes('wybrzez') ||
        txt.includes('plaż') ||
        txt.includes('klif')
      ) {
        return 'foggy_coast';
      }
      if (
        txt.includes('ulic') ||
        txt.includes('zauł') ||
        txt.includes('alei') ||
        txt.includes('miast')
      ) {
        return 'rainy_noir_street';
      }
      if (
        txt.includes('krypt') ||
        txt.includes('grobow') ||
        txt.includes('cment') ||
        txt.includes('klasztor')
      ) {
        return 'monastery_crypt';
      }
      if (
        txt.includes('radio') ||
        txt.includes('kabl') ||
        txt.includes('antyst') ||
        txt.includes('elektron')
      ) {
        return 'radio_shack_electronic';
      }
      if (
        txt.includes('archiw') ||
        txt.includes('bibliotek') ||
        txt.includes('regał') ||
        txt.includes('czytel')
      ) {
        return 'parish_archive';
      }
      if (
        txt.includes('areszt') ||
        txt.includes('przesłuch') ||
        txt.includes('komisariat') ||
        txt.includes('cel')
      ) {
        return 'police_interrogation';
      }
      if (
        txt.includes('głębin') ||
        /\b(toń|toni|dno)\b/i.test(txt) ||
        txt.includes('zatopion')
      ) {
        return 'abyssal_deep';
      }
      if (
        txt.includes('pożar') ||
        txt.includes('płon') ||
        txt.includes('ogień') ||
        txt.includes('płomien')
      ) {
        return 'raging_fire';
      }
      if (
        txt.includes('izolatk') ||
        txt.includes('sanator') ||
        txt.includes('psychiatr') ||
        txt.includes('szpital')
      ) {
        return 'asylum_solitary';
      }
      if (
        txt.includes('speakeasy') ||
        txt.includes('jazz') ||
        txt.includes('klub') ||
        txt.includes('szynk') ||
        txt.includes('melin')
      ) {
        return 'speakeasy_jazz';
      }
      if (
        txt.includes('jarzeniówk') ||
        txt.includes('świetlówk') ||
        txt.includes('komitet') ||
        txt.includes('milicj')
      ) {
        return 'prl_fluorescent';
      }
      if (
        txt.includes('gabinet') ||
        txt.includes('narad') ||
        txt.includes('odpoczynek') ||
        txt.includes('pokój badacz')
      ) {
        return 'investigator_study';
      }
    }

    if (params.isOccultScene) return 'cosmic_horror';
    if (params.isUnderground) return 'subterranean_dark';
    if (params.isSanatoriumOrClinic) return 'institutional_cold';

    const hour = params.hour ?? 20;
    const isNight = hour >= 22 || hour < 5;
    const isDay = hour >= 7 && hour < 18;

    if (params.isOutdoor) {
      return isDay ? 'new_england_fog' : 'subterranean_dark';
    }

    return isNight ? 'candlelight' : 'kerosene_lamp';
  }
}
