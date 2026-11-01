import {
  HueError,
  type BridgeIO,
  type EntertainmentIO,
  type StoredHueState,
} from './server-types';
import type { HuePhase, HueLightResource } from './types';

export class HueSession {
  phase: HuePhase = 'off';
  private owner: string | null = null;
  private lease: ReturnType<typeof setTimeout> | undefined;
  private pending: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private lights: HueLightResource[] = [];
  private base: Record<string, unknown> = {};
  private lastAccent = 0;
  private leaseEpoch = 0;
  constructor(
    readonly state: StoredHueState,
    private bridge: BridgeIO,
    private persist: () => Promise<void>,
    private stream?: EntertainmentIO,
    private exclusive: <T>(task: () => Promise<T>) => Promise<T> = (task) =>
      task()
  ) {}
  assertOwner(owner: string): void {
    if (this.owner && this.owner !== owner) throw new HueError('BUSY');
  }
  heartbeat(owner: string): void {
    this.assertOwner(owner);
    if (!this.owner) return;
    clearTimeout(this.lease);
    const epoch = ++this.leaseEpoch;
    this.lease = setTimeout(() => {
      void this.exclusive(async () => {
        if (epoch === this.leaseEpoch) await this.stop(owner);
      }).catch(() => {
        this.phase = 'unavailable';
      });
    }, 10000);
    this.lease.unref?.();
  }
  async recover(): Promise<void> {
    if (this.state.snapshot?.length) {
      if (this.state.config.mode === 'entertainment') {
        const area = (await this.bridge.areas()).find(
          (a) => a.id === this.state.config.areaId
        );
        if (area?.status === 'active') throw new HueError('AREA_BUSY');
      }
      await this.restore();
    }
  }
  async start(owner: string): Promise<void> {
    this.assertOwner(owner);
    if (this.owner === owner) {
      this.heartbeat(owner);
      return;
    }
    if (!this.state.config.enabled) throw new HueError('DISABLED');
    if (this.state.snapshot?.length) await this.recover();
    this.lights = await this.bridge.lights();
    const config = this.state.config;
    config.selectedLightIds = config.selectedLightIds.map(
      (id) =>
        this.lights.find((l) => l.id === id || l.id_v1 === '/lights/' + id)
          ?.id ?? id
    );
    let ids = config.selectedLightIds;
    let area;
    if (config.mode === 'entertainment') {
      area = (await this.bridge.areas()).find((a) => a.id === config.areaId);
      if (area?.status === 'active') throw new HueError('AREA_BUSY');
      if (area && this.stream && this.state.clientKey)
        ids = area.lightIds ?? [];
    }
    const selected = this.lights.filter((l) => ids.includes(l.id));
    if (!selected.length) throw new HueError('NO_LIGHTS');
    // A persisted snapshot precedes every change to physical lamps.
    this.state.snapshot = selected.map((l) => ({
      lightId: l.id,
      on: l.on.on,
      brightness: l.dimming?.brightness,
      ...(l.color_temperature?.mirek_valid && l.color_temperature.mirek !== null
        ? { mirek: l.color_temperature.mirek }
        : l.color
          ? { xy: l.color.xy }
          : {}),
    }));
    await this.persist();
    this.owner = owner;
    this.phase = 'basic';
    this.heartbeat(owner);
    if (area && this.stream && this.state.clientKey) {
      try {
        await this.stream.start(area);
        this.phase = 'entertainment';
      } catch (e) {
        if (e instanceof HueError && e.code === 'AREA_BUSY') {
          delete this.state.snapshot;
          await this.persist();
          clearTimeout(this.lease);
          this.owner = null;
          this.phase = 'busy';
          throw e;
        }
        this.phase = 'basic';
      }
    }
    this.heartbeat(owner);
  }
  private cancel(): void {
    this.generation++;
    clearTimeout(this.pending);
  }
  async pause(owner: string): Promise<void> {
    this.assertOwner(owner);
    this.cancel();
    await this.stream?.stop();
    this.phase = 'paused';
  }
  async resume(owner: string): Promise<void> {
    this.assertOwner(owner);
    if (!this.owner) return;
    await this.pause(owner);
    this.phase = 'basic';
    if (
      this.state.config.mode === 'entertainment' &&
      this.stream &&
      this.state.clientKey
    ) {
      const area = (await this.bridge.areas()).find(
        (a) => a.id === this.state.config.areaId
      );
      if (area?.status === 'active') throw new HueError('AREA_BUSY');
      if (area) {
        try {
          await this.stream.start(area);
          this.phase = 'entertainment';
        } catch {
          this.phase = 'basic';
        }
      }
    }
    await this.apply(owner, this.base);
  }
  async fallback(): Promise<void> {
    if (this.phase !== 'entertainment') return;
    this.phase = 'basic';
    this.cancel();
    await this.write(this.base);
  }
  async emergency(owner: string): Promise<void> {
    this.assertOwner(owner);
    if (!this.owner) await this.start(owner);
    this.cancel();
    await this.stream?.stop();
    this.phase = 'emergency';
    await this.write({
      on: { on: true },
      dimming: { brightness: 100 },
      color_temperature: { mirek: 370 },
      dynamics: { duration: 0 },
    });
  }
  async apply(
    owner: string,
    payload: Record<string, unknown>,
    accent = false
  ): Promise<void> {
    this.assertOwner(owner);
    if (!this.owner) throw new HueError('NOT_STARTED');
    if (this.phase === 'paused' || this.phase === 'emergency') return;
    if (!accent) {
      this.cancel();
      this.base = payload;
    }
    await this.write(payload);
  }
  async accent(owner: string, kind: string): Promise<void> {
    this.assertOwner(owner);
    if (
      !this.owner ||
      this.phase === 'paused' ||
      this.phase === 'emergency' ||
      !this.state.config.flashesEnabled
    )
      return;
    if (Date.now() - this.lastAccent < 1500) return;
    // Fast effects belong exclusively to Entertainment; REST remains quiet.
    if (this.phase !== 'entertainment') return;
    this.lastAccent = Date.now();
    this.cancel();
    const gen = this.generation;
    const brightness =
      kind === 'sanity-loss'
        ? 10
        : Math.max(
            10,
            (kind === 'anomaly' ? 35 : 70) * (this.state.config.intensity ?? 1)
          );
    await this.apply(
      owner,
      {
        on: { on: true },
        dimming: { brightness },
        ...(kind === 'anomaly'
          ? { color: { xy: { x: 0.38, y: 0.15 } } }
          : { color_temperature: { mirek: kind === 'thunder' ? 153 : 333 } }),
        dynamics: { duration: kind === 'anomaly' ? 600 : 80 },
      },
      true
    );
    this.pending = setTimeout(
      () => {
        if (gen === this.generation)
          void this.apply(owner, this.base).catch(() => {});
      },
      kind === 'sanity-loss' ? 1200 : kind === 'anomaly' ? 2500 : 120
    );
  }
  private async write(payload: Record<string, unknown>): Promise<void> {
    if (this.phase === 'entertainment' && this.stream) {
      this.stream.transition(payload);
      return;
    }
    const generation = this.generation;
    for (const snap of this.state.snapshot ?? []) {
      if (generation !== this.generation) return;
      const light = this.lights.find((l) => l.id === snap.lightId);
      const p = { ...payload };
      if (!light?.color) delete p.color;
      if (!light?.color_temperature) delete p.color_temperature;
      else if (p.color_temperature) {
        const ct = p.color_temperature as { mirek: number };
        const limits = light.color_temperature.mirek_schema;
        p.color_temperature = {
          mirek: Math.min(
            limits?.mirek_maximum ?? 500,
            Math.max(limits?.mirek_minimum ?? 153, ct.mirek)
          ),
        };
      }
      await this.bridge.write(snap.lightId, p);
    }
  }
  private async restore(): Promise<void> {
    for (const s of this.state.snapshot ?? [])
      await this.bridge.write(s.lightId, {
        on: { on: s.on },
        ...(s.brightness !== undefined
          ? { dimming: { brightness: s.brightness } }
          : {}),
        ...(s.mirek != null
          ? { color_temperature: { mirek: s.mirek } }
          : s.xy
            ? { color: { xy: s.xy } }
            : {}),
        dynamics: { duration: 1000 },
      });
    delete this.state.snapshot;
    await this.persist();
  }
  async shutdown(): Promise<void> {
    await this.stop(this.owner ?? '');
  }
  async stop(owner: string): Promise<void> {
    this.assertOwner(owner);
    this.cancel();
    clearTimeout(this.lease);
    await this.stream?.stop();
    await this.restore();
    this.owner = null;
    this.phase = 'off';
  }
}
