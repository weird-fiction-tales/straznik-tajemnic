import { EventEmitter } from 'node:events';
import { bridgeRequest } from './bridge-transport';
import {
  HueError,
  type StoredHueState,
  type EntertainmentIO,
} from './server-types';
import type { HueArea } from './types';
export interface HueChannelState {
  x: number;
  y: number;
  brightness: number;
}
export function encodeHueFrame(
  areaId: string,
  channels: number[],
  state: HueChannelState,
  sequence: number
): Buffer {
  if (
    !/^[a-f0-9-]{36}$/i.test(areaId) ||
    channels.some((c) => !Number.isInteger(c) || c < 0 || c > 255)
  )
    throw new HueError('INVALID_AREA');
  const frame = Buffer.alloc(52 + channels.length * 7);
  frame.write('HueStream', 0, 'ascii');
  frame[9] = 2;
  frame[10] = 0;
  frame[11] = sequence & 255;
  frame[14] = 1; // v2, CIE xy
  frame.write(areaId, 16, 36, 'ascii');
  for (let i = 0; i < channels.length; i++) {
    const p = 52 + i * 7;
    frame[p] = channels[i];
    frame.writeUInt16BE(
      Math.round(Math.max(0, Math.min(1, state.x)) * 65535),
      p + 1
    );
    frame.writeUInt16BE(
      Math.round(Math.max(0, Math.min(1, state.y)) * 65535),
      p + 3
    );
    frame.writeUInt16BE(
      Math.round(Math.max(0, Math.min(1, state.brightness)) * 65535),
      p + 5
    );
  }
  return frame;
}
export function whitePoint(mirek: number): { x: number; y: number } {
  const t = Math.max(1667, Math.min(25000, 1_000_000 / mirek));
  const x =
    t <= 4000
      ? -0.2661239e9 / t ** 3 - 0.234358e6 / t ** 2 + 0.8776956e3 / t + 0.17991
      : -3.0258469e9 / t ** 3 +
        2.1070379e6 / t ** 2 +
        0.2226347e3 / t +
        0.24039;
  const y =
    t <= 2222
      ? -1.1063814 * x ** 3 - 1.3481102 * x ** 2 + 2.18555832 * x - 0.20219683
      : t <= 4000
        ? -0.9549476 * x ** 3 -
          1.37418593 * x ** 2 +
          2.09137015 * x -
          0.16748867
        : 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - 0.37001483;
  return { x, y };
}
interface SocketLike extends EventEmitter {
  send(data: Buffer): void;
  close(): void;
}
type SocketFactory = (
  ip: string,
  key: string,
  clientKey: string
) => Promise<SocketLike>;
async function openSocket(
  ip: string,
  key: string,
  clientKey: string
): Promise<SocketLike> {
  const { dtls } = await import('node-dtls-client');
  // The bridge acknowledges activation before its streaming endpoint is ready.
  await new Promise((resolve) => setTimeout(resolve, 500));
  return new Promise((resolve, reject) => {
    const socket = dtls.createSocket({
      type: 'udp4',
      address: ip,
      port: 2100,
      psk: { [key]: Buffer.from(clientKey, 'hex') },
      timeout: 3000,
      ciphers: ['TLS_PSK_WITH_AES_128_GCM_SHA256'],
    });
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      // node-dtls-client owns the handshake timeout and closes its UDP socket.
      reject(new HueError('TIMEOUT'));
    }, 3500);
    socket.once('connected', () => {
      clearTimeout(timer);
      if (settled) {
        socket.close();
        return;
      }
      settled = true;
      resolve(socket);
    });
    socket.on('error', () => {
      clearTimeout(timer);
      settled = true;
      // killConnection() has already closed UDP before emitting this event.
      reject(new HueError('OFFLINE'));
    });
  });
}
export class HueEntertainment implements EntertainmentIO {
  private socket: SocketLike | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private area: HueArea | undefined;
  private sequence = 0;
  private started = false;
  private from: HueChannelState = { x: 0.45, y: 0.41, brightness: 0.1 };
  private target = { ...this.from };
  private at = 0;
  private duration = 0;
  constructor(
    private state: StoredHueState,
    private request = bridgeRequest,
    private failed: () => void = () => {},
    private factory: SocketFactory = openSocket
  ) {}
  async start(area: HueArea): Promise<void> {
    if (area.status === 'active') throw new HueError('AREA_BUSY');
    if (!this.state.clientKey || !area.channels.length)
      throw new HueError('CLIENT_KEY_REQUIRED');
    await this.request(
      this.state,
      '/clip/v2/resource/entertainment_configuration/' + area.id,
      'PUT',
      { action: 'start' }
    );
    this.started = true;
    this.area = area;
    const original = this.state.snapshot?.[0];
    const xy = original?.xy ?? whitePoint(original?.mirek ?? 370);
    this.from = {
      ...xy,
      brightness: original?.on
        ? Math.min(0.7, (original.brightness ?? 10) / 100)
        : 0,
    };
    this.target = { ...this.from };
    this.at = performance.now();
    this.duration = 0;
    try {
      const connect = () =>
        this.factory(
          this.state.config.bridgeIp,
          this.state.appKey,
          this.state.clientKey!
        );
      // One fresh handshake fits inside the 10-second ownership lease.
      // Both attempts share the area already reserved above.
      try {
        this.socket = await connect();
      } catch {
        this.socket = await connect();
      }
      this.socket.on('error', () => {
        this.socket = undefined;
        void this.stop().then(this.failed, this.failed);
      });
      // Never send an arbitrary initial frame. The first transition supplies the scene baseline.
    } catch (e) {
      await this.stop();
      throw e;
    }
  }
  private current(): HueChannelState {
    const alpha = this.duration
      ? Math.min(1, (performance.now() - this.at) / this.duration)
      : 1;
    return {
      x: this.from.x + (this.target.x - this.from.x) * alpha,
      y: this.from.y + (this.target.y - this.from.y) * alpha,
      brightness:
        this.from.brightness +
        (this.target.brightness - this.from.brightness) * alpha,
    };
  }
  transition(payload: Record<string, unknown>): void {
    if (!this.socket || !this.area) throw new HueError('NOT_STARTED');
    this.from = this.current();
    const p = payload as {
      color?: { xy: { x: number; y: number } };
      color_temperature?: { mirek: number };
      dimming?: { brightness: number };
      dynamics?: { duration: number };
    };
    const xy =
      p.color?.xy ??
      (p.color_temperature
        ? whitePoint(p.color_temperature.mirek)
        : this.target);
    this.target = {
      x: xy.x,
      y: xy.y,
      brightness: p.dimming
        ? Math.min(0.7, Math.max(0.1, p.dimming.brightness / 100))
        : this.target.brightness,
    };
    this.at = performance.now();
    this.duration = p.dynamics?.duration ?? 0;
    const render = () => {
      if (!this.socket || !this.area) return;
      try {
        this.socket.send(
          encodeHueFrame(
            this.area.id,
            this.area.channels.map((c) => c.channel_id),
            this.current(),
            this.sequence++
          )
        );
      } catch {
        void this.stop().then(this.failed, this.failed);
      }
    };
    if (!this.timer) {
      render();
      this.timer = setInterval(render, 20);
      this.timer.unref?.();
    }
  }
  async stop(): Promise<void> {
    clearInterval(this.timer);
    this.timer = undefined;
    const socket = this.socket;
    this.socket = undefined;
    socket?.removeAllListeners();
    socket?.on('error', () => {});
    socket?.close();
    if (this.started && this.area) {
      this.started = false;
      await this.request(
        this.state,
        '/clip/v2/resource/entertainment_configuration/' + this.area.id,
        'PUT',
        { action: 'stop' }
      );
    }
    this.area = undefined;
  }
}
