import { HueEntertainment } from './entertainment';
import {
  HueError,
  type StoredHueState,
  type EntertainmentIO,
} from './server-types';
import {
  HueV2Bridge,
  bridgeRequest,
  validateBridgeAddress,
} from './bridge-transport';
import { loadHueState, saveHueState } from './server-store';
import { HueSession } from './server-session';
import type {
  HueBridgeConfig,
  HueBridgeDiscoveryResult,
  HueStatus,
} from './types';

export class HueService {
  private sequence: Promise<unknown> = Promise.resolve();
  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.sequence.then(task);
    this.sequence = result.catch(() => {});
    return result;
  }
  private bridge: HueV2Bridge;
  session: HueSession;
  constructor(
    readonly state: StoredHueState,
    stream?: EntertainmentIO
  ) {
    this.bridge = new HueV2Bridge(state);
    this.session = new HueSession(
      state,
      this.bridge,
      () => saveHueState(state),
      stream ??
        new HueEntertainment(state, bridgeRequest, () => {
          void this.run(() => this.session.fallback()).catch(() => {});
        }),
      (task) => this.run(task)
    );
  }
  async status(): Promise<HueStatus> {
    const base = {
      config: { ...this.state.config, appKey: '', paired: !!this.state.appKey },
      phase: this.session.phase,
      paired: !!this.state.appKey,
      hasClientKey: !!this.state.clientKey,
    };
    if (!this.state.appKey) return { ...base, lights: [], areas: [] };
    try {
      const [lights, areas] = await Promise.all([
        this.bridge.lights(),
        this.bridge.areas(),
      ]);
      return { ...base, lights, areas };
    } catch (e) {
      return {
        ...base,
        phase: 'unavailable',
        lights: [],
        areas: [],
        error: e instanceof HueError ? e.code : 'OFFLINE',
      };
    }
  }
  async configure(owner: string, cfg: Partial<HueBridgeConfig>): Promise<void> {
    this.session.assertOwner(owner);
    const next = { ...this.state.config, ...cfg, appKey: '' };
    if (
      typeof next.enabled !== 'boolean' ||
      typeof next.flashesEnabled !== 'boolean'
    )
      throw new HueError('INVALID_CONFIG');
    if (next.bridgeIp && !validateBridgeAddress(next.bridgeIp))
      throw new HueError('INVALID_ADDRESS');
    if (next.bridgeId && !/^[a-f0-9]{16}$/i.test(next.bridgeId))
      throw new HueError('INVALID_BRIDGE_ID');
    if (
      !Array.isArray(next.selectedLightIds) ||
      next.selectedLightIds.length > 50 ||
      next.selectedLightIds.some(
        (id) => typeof id !== 'string' || id.length > 80
      )
    )
      throw new HueError('INVALID_LIGHT');
    if (next.mode !== 'basic' && next.mode !== 'entertainment')
      throw new HueError('INVALID_MODE');
    if (
      !Number.isFinite(next.intensity) ||
      next.intensity! < 0.25 ||
      next.intensity! > 1
    )
      throw new HueError('INVALID_INTENSITY');
    // Validate first; only a valid settings change may release the current lamps.
    await this.session.stop(owner);
    const changedBridge =
      this.state.config.bridgeIp &&
      (this.state.config.bridgeIp !== next.bridgeIp ||
        Boolean(
          this.state.config.bridgeId &&
          this.state.config.bridgeId !== next.bridgeId
        ));
    this.state.config = next;
    if (changedBridge) {
      this.state.appKey = '';
      this.state.clientKey = '';
    }
    await saveHueState(this.state);
  }
  async importLegacy(owner: string, cfg: HueBridgeConfig): Promise<void> {
    this.session.assertOwner(owner);
    if (
      !cfg ||
      typeof cfg.appKey !== 'string' ||
      !/^[\x21-\x7E]{1,256}$/.test(cfg.appKey)
    )
      throw new HueError('INVALID_KEY');
    if (!cfg.bridgeId)
      cfg = {
        ...cfg,
        bridgeId:
          (this.state.config.bridgeIp === cfg.bridgeIp &&
            this.state.config.bridgeId) ||
          (await discoverHueBridges()).find(
            (b) => b.internalipaddress === cfg.bridgeIp
          )?.id,
      };
    const previous = {
      config: this.state.config,
      appKey: this.state.appKey,
      clientKey: this.state.clientKey,
    };
    await this.configure(owner, { ...cfg, appKey: '', mode: 'basic' });
    try {
      const candidate = { ...this.state, appKey: cfg.appKey };
      await new HueV2Bridge(candidate).lights();
      this.state.appKey = cfg.appKey;
      this.state.clientKey =
        previous.appKey === cfg.appKey ? previous.clientKey : '';
      await saveHueState(this.state);
    } catch (error) {
      Object.assign(this.state, previous);
      await saveHueState(this.state);
      throw error;
    }
  }
  async pair(owner: string, signal?: AbortSignal): Promise<void> {
    this.session.assertOwner(owner);
    const results = await bridgeRequest<
      Array<{ success?: { username: string; clientkey: string } }>
    >(
      this.state,
      '/api',
      'POST',
      { devicetype: 'straznik-tajemnic#desktop', generateclientkey: true },
      signal
    );
    const success = results[0]?.success;
    if (!success?.username || !success.clientkey)
      throw new HueError('INVALID_RESPONSE');
    this.state.appKey = success.username;
    this.state.clientKey = success.clientkey;
    await saveHueState(this.state);
  }
}
export async function discoverHueBridges(): Promise<
  HueBridgeDiscoveryResult[]
> {
  const r = await fetch('https://discovery.meethue.com/', {
    signal: AbortSignal.timeout(3000),
  });
  if (!r.ok) throw new HueError('DISCOVERY_ERROR');
  const data: unknown = await r.json();
  if (!Array.isArray(data)) throw new HueError('INVALID_RESPONSE');
  return data.filter(
    (b): b is HueBridgeDiscoveryResult =>
      !!b &&
      typeof b.id === 'string' &&
      /^[a-f0-9]{16}$/i.test(b.id) &&
      typeof b.internalipaddress === 'string' &&
      validateBridgeAddress(b.internalipaddress)
  );
}

type HueGlobal = typeof globalThis & { __hueService?: Promise<HueService> };
export function getHueService(): Promise<HueService> {
  const global = globalThis as HueGlobal;
  if (!global.__hueService)
    global.__hueService = loadHueState()
      .then(async (state) => {
        const service = new HueService(state);
        try {
          await service.session.recover();
        } catch {
          service.session.phase = 'unavailable';
        }
        return service;
      })
      .catch((e) => {
        delete global.__hueService;
        throw e;
      });
  return global.__hueService;
}
