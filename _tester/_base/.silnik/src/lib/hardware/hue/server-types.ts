import type {
  HueBridgeConfig,
  HueLightResource,
  HueLightStateSnapshot,
  HueArea,
} from './types';
export interface StoredHueState {
  config: HueBridgeConfig;
  appKey: string;
  clientKey: string;
  snapshot?: HueLightStateSnapshot[];
}
export interface BridgeIO {
  lights(): Promise<HueLightResource[]>;
  areas(): Promise<HueArea[]>;
  write(id: string, payload: Record<string, unknown>): Promise<void>;
}
export interface EntertainmentIO {
  start(area: HueArea): Promise<void>;
  transition(payload: Record<string, unknown>): void;
  stop(): Promise<void>;
}
export class HueError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
