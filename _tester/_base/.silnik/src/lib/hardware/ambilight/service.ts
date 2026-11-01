import { createHmac, randomBytes } from 'node:crypto';
import {
  readFile,
  writeFile,
  mkdir,
  rename,
  unlink,
  chmod,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getWritableDataDir } from '@/lib/paths';
import {
  requestTV,
  isPrivateIPv4,
  type Credentials,
  type TVRequest,
} from './transport';
import { discoverTVAddresses } from './discovery';
import { lightingToColor, type LightingPayload, type TVColor } from './color';

interface PairedTV extends Credentials {
  ip: string;
  name: string;
}
interface Snapshot {
  configuration: unknown;
  power: unknown;
  huePower?: unknown;
}
interface Pending {
  tv: PairedTV;
  timestamp: number;
  expires: number;
  device: Record<string, string>;
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
// Public protocol signing constant used by Philips pairing, not a user credential.
const PAIRING_KEY =
  'ZmVay1EQVFOaZhwQ4Kv81ypLAZNczV9sG4KkseXWn1NEk6cXmPKO/MCa9sryslvLCFMnNe4Z4CPXzToowvhHvA==';

export class AmbilightService {
  private paired?: PairedTV;
  private loaded = false;
  private pending?: Pending;
  private enabled = false;
  private snapshot?: Snapshot;
  private color?: TVColor;
  private generation = randomBytes(12).toString('hex');
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private file = join(getWritableDataDir(), 'hardware', 'ambilight.json'),
    private request: TVRequest = requestTV
  ) {}

  // Serialize takeover, effects and restoration so a late request cannot re-enable TV.
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.catch(() => undefined);
    return result;
  }
  private async load() {
    if (this.loaded) return;
    try {
      const tv = JSON.parse(await readFile(this.file, 'utf8')) as PairedTV;
      if (isPrivateIPv4(tv.ip) && tv.username && tv.password && tv.fingerprint)
        this.paired = tv;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error('storage');
    }
    if (this.paired) {
      try {
        this.snapshot = JSON.parse(
          await readFile(`${this.file}.recovery`, 'utf8')
        ) as Snapshot;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
          throw new Error('storage');
      }
    }
    this.loaded = true;
  }
  async status() {
    await this.load();
    return {
      paired: !!this.paired,
      enabled: this.enabled,
      ip: this.paired?.ip ?? '',
      name: this.paired?.name ?? '',
      restorePending: !!this.snapshot,
      generation: this.generation,
    };
  }
  async probe(ip: string) {
    if (!isPrivateIPv4(ip)) throw new Error('invalidAddress');
    const reply = await this.request(ip, 'system');
    const system = record(reply.data),
      features = record(system.featuring);
    const supported =
      record(system.api_version).Major === 6 &&
      Array.isArray(record(features.jsonfeatures).ambilight) &&
      (record(features.jsonfeatures).ambilight as unknown[]).includes(
        'Ambilight'
      ) &&
      record(features.systemfeatures).pairing_type === 'digest_auth_pairing';
    if (!supported) throw new Error('unsupported');
    return {
      ip,
      name:
        typeof system.name === 'string'
          ? system.name.slice(0, 100)
          : 'Philips TV',
      fingerprint: reply.fingerprint,
    };
  }
  async discover() {
    const results = await Promise.allSettled(
      (await discoverTVAddresses()).map((ip) => this.probe(ip))
    );
    return results.flatMap((result) =>
      result.status === 'fulfilled'
        ? [{ ip: result.value.ip, name: result.value.name }]
        : []
    );
  }
  pair(ip: string) {
    return this.exclusive(async () => {
      await this.load();
      if (this.enabled || this.snapshot) throw new Error('disconnectFirst');
      this.pending = undefined;
      const tv = await this.probe(ip);
      const device = {
        device_name: 'Straznik Tajemnic',
        device_os: 'macOS',
        app_name: 'Straznik Tajemnic',
        type: 'native',
        app_id: 'straznik.tajemnic',
        id: randomBytes(16).toString('hex'),
      };
      const reply = await this.request(
        ip,
        'pair/request',
        { access: { scope: ['read', 'write', 'control'] }, device },
        { fingerprint: tv.fingerprint }
      );
      const data = record(reply.data);
      if (
        data.error_id !== 'SUCCESS' ||
        typeof data.auth_key !== 'string' ||
        typeof data.timestamp !== 'number'
      )
        throw new Error('pairing');
      this.pending = {
        tv: { ...tv, username: device.id, password: data.auth_key },
        device,
        timestamp: data.timestamp,
        expires:
          Date.now() +
          Math.min(120, Math.max(1, Number(data.timeout) || 60)) * 1000,
      };
      return { pinRequired: true, name: tv.name };
    });
  }
  confirm(pin: string) {
    return this.exclusive(async () => {
      const pending = this.pending;
      if (!pending || Date.now() > pending.expires) {
        this.pending = undefined;
        throw new Error('expired');
      }
      if (!/^\d{4}$/.test(pin)) throw new Error('invalidPin');
      const signature = createHmac('sha1', Buffer.from(PAIRING_KEY, 'base64'))
        .update(`${pending.timestamp}${pin}`)
        .digest('base64');
      const reply = await this.request(
        pending.tv.ip,
        'pair/grant',
        {
          device: pending.device,
          auth: {
            auth_appId: '1',
            pin,
            auth_timestamp: pending.timestamp,
            auth_signature: signature,
          },
        },
        pending.tv
      );
      const response = record(reply.data);
      if (response.error_id !== 'SUCCESS') throw new Error('invalidPin');
      // Verify access before persisting or announcing success.
      await this.request(
        pending.tv.ip,
        'ambilight/currentconfiguration',
        undefined,
        pending.tv
      );
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
      const temp = `${this.file}.${randomBytes(6).toString('hex')}.tmp`;
      await writeFile(temp, JSON.stringify(pending.tv), {
        mode: 0o600,
        flag: 'wx',
      });
      await chmod(temp, 0o600);
      await rename(temp, this.file);
      this.paired = pending.tv;
      this.loaded = true;
      this.pending = undefined;
      return this.status();
    });
  }
  enable(enabled: boolean) {
    // Invalidate queued effects immediately, before waiting for an in-flight call.
    if (!enabled) {
      this.enabled = false;
      this.generation = randomBytes(12).toString('hex');
    }
    return this.exclusive(async () => {
      await this.load();
      if (enabled && !this.paired) throw new Error('notPaired');
      if (!enabled) {
        this.enabled = false;
        await this.restore();
      } else {
        if (!this.enabled && this.snapshot) await this.restore();
        this.enabled = true;
      }
      this.generation = randomBytes(12).toString('hex');
      return this.status();
    });
  }
  private call(path: string, body?: unknown) {
    if (!this.paired) throw new Error('notPaired');
    return this.request(this.paired.ip, path, body, this.paired).then(
      (reply) => {
        const data = record(reply.data);
        if (data.error_id && data.error_id !== 'SUCCESS')
          throw new Error('unsupported');
        return reply;
      }
    );
  }
  effect(payload: LightingPayload, generation = this.generation) {
    return this.exclusive(async () => {
      if (generation !== this.generation || !this.enabled)
        return { applied: false };
      if (!this.snapshot) {
        const configuration = record(
          (await this.call('ambilight/currentconfiguration')).data
        );
        const power = record((await this.call('ambilight/power')).data);
        if (
          !configuration.styleName ||
          !['On', 'Off'].includes(String(power.power))
        )
          throw new Error('unsupported');
        let huePower: unknown;
        try {
          const hue = record((await this.call('HueLamp/power')).data);
          if (['On', 'Off'].includes(String(hue.power))) huePower = hue;
        } catch {
          /* Some API 6 models do not expose Ambilight+hue. */
        }
        this.snapshot = { configuration, power, huePower };
        // Persist recovery before changing TV; an app restart can restore the snapshot.
        try {
          await this.saveRecovery();
        } catch (error) {
          this.snapshot = undefined;
          throw error;
        }
        if (record(huePower).power === 'On')
          await this.call('HueLamp/power', { power: 'Off' });
        await this.call('ambilight/power', { power: 'On' });
      }
      this.color = lightingToColor(payload, this.color);
      await this.call('ambilight/currentconfiguration', {
        styleName: 'FOLLOW_COLOR',
        isExpert: true,
        algorithm: 'MANUAL_HUE',
        colorSettings: {
          color: this.color,
          colorDelta: { hue: 0, saturation: 0, brightness: 0 },
          speed: 255,
        },
      });
      return { applied: true };
    });
  }
  private async saveRecovery() {
    await writeFile(`${this.file}.recovery`, JSON.stringify(this.snapshot), {
      mode: 0o600,
    });
  }
  private async restore() {
    if (!this.snapshot && this.paired) {
      try {
        this.snapshot = JSON.parse(
          await readFile(`${this.file}.recovery`, 'utf8')
        ) as Snapshot;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
          throw new Error('storage');
      }
    }
    if (!this.snapshot) return;
    await this.call(
      'ambilight/currentconfiguration',
      this.snapshot.configuration
    );
    if (this.snapshot.huePower)
      await this.call('HueLamp/power', this.snapshot.huePower);
    await this.call('ambilight/power', this.snapshot.power);
    await unlink(`${this.file}.recovery`).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    this.snapshot = undefined;
    this.color = undefined;
  }
  end() {
    this.generation = randomBytes(12).toString('hex');
    return this.exclusive(async () => {
      await this.load();
      await this.restore();
      return this.status();
    });
  }
  disconnect() {
    this.enabled = false;
    this.generation = randomBytes(12).toString('hex');
    return this.exclusive(async () => {
      await this.load();
      this.enabled = false;
      await this.restore();
      await unlink(this.file).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
      this.paired = undefined;
      this.pending = undefined;
      return this.status();
    });
  }
}

const globalService = globalThis as typeof globalThis & {
  __straznikAmbilight?: AmbilightService;
};
export const ambilightService = (globalService.__straznikAmbilight ??=
  new AmbilightService());
