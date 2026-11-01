/**
 * @file types.ts
 * Definicje typów dla integracji z mostkiem Philips Hue CLIP v2 i Reżysera Światła.
 */

export interface HueLightResource {
  id: string;
  id_v1?: string;
  owner?: { rid: string; rtype: string };
  metadata: {
    name: string;
    archetype?: string;
  };
  on: {
    on: boolean;
  };
  dimming?: {
    brightness: number; // 0.0 - 100.0
  };
  color_temperature?: {
    mirek_valid?: boolean;
    mirek_schema?: { mirek_minimum: number; mirek_maximum: number };
    mirek: number | null; // 153 (zimna) - 500 (bardzo ciepła)
  };
  color?: {
    xy: {
      x: number;
      y: number;
    };
  };
}

export interface HueLightStateSnapshot {
  lightId: string;
  on: boolean;
  brightness?: number;
  mirek?: number | null;
  xy?: { x: number; y: number };
}

export interface HueBridgeConfig {
  enabled: boolean;
  bridgeIp: string;
  appKey: string;
  selectedLightIds: string[];
  paired?: boolean;
  bridgeId?: string;
  mode?: 'basic' | 'entertainment';
  areaId?: string;
  intensity?: number;
  flashesEnabled?: boolean;
}

export interface HueBridgeDiscoveryResult {
  id: string;
  internalipaddress: string;
  port?: number;
}

export interface LightPreset {
  id: string;
  name: string;
  description: string;
  mirek?: number;
  xy?: [number, number];
  brightness: number; // 0 - 100
  transitionMs: number;
}

export type SceneLightingMood =
  | 'kerosene_lamp'
  | 'new_england_fog'
  | 'subterranean_dark'
  | 'cosmic_horror'
  | 'candlelight'
  | 'institutional_cold'
  | 'deep_forest'
  | 'murky_swamp'
  | 'mine_shaft'
  | 'foggy_coast'
  | 'rainy_noir_street'
  | 'monastery_crypt'
  | 'radio_shack_electronic'
  | 'parish_archive'
  | 'police_interrogation'
  | 'abyssal_deep'
  | 'raging_fire'
  | 'asylum_solitary'
  | 'colour_out_of_space'
  | 'bloody_ritual'
  | 'frozen_rlyeh'
  | 'speakeasy_jazz'
  | 'prl_fluorescent'
  | 'investigator_study';

export type HuePhase =
  | 'off'
  | 'basic'
  | 'entertainment'
  | 'paused'
  | 'emergency'
  | 'unavailable'
  | 'busy';
export interface HueArea {
  id: string;
  metadata: { name: string };
  status: 'active' | 'inactive';
  channels: Array<{
    channel_id: number;
    members: Array<{ service: { rid: string; rtype: string } }>;
  }>;
  lightIds?: string[];
}
export interface HueStatus {
  config: HueBridgeConfig;
  phase: HuePhase;
  paired: boolean;
  hasClientKey: boolean;
  lights: HueLightResource[];
  areas: HueArea[];
  error?: string;
}
export const DEFAULT_HUE_CONFIG: HueBridgeConfig = {
  enabled: false,
  bridgeIp: '',
  appKey: '',
  selectedLightIds: [],
  mode: 'basic',
  intensity: 1,
  flashesEnabled: false,
};
