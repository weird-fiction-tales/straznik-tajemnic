import https from 'node:https';
import { isIP } from 'node:net';
import { SIGNIFY_CA } from './signify-ca';
import { HueError, type BridgeIO, type StoredHueState } from './server-types';
import type { HueArea, HueLightResource } from './types';

export function validateBridgeAddress(ip: string): boolean {
  if (isIP(ip) !== 4) return false;
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  );
}

// No global TLS/DNS overrides: authenticate this bridge with Signify's CA and bridge ID.
export async function bridgeRequest<T>(
  state: StoredHueState,
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const { bridgeIp, bridgeId } = state.config;
  if (
    !validateBridgeAddress(bridgeIp) ||
    !bridgeId ||
    !/^[a-f0-9]{16}$/i.test(bridgeId)
  )
    throw new HueError('BRIDGE_ID_REQUIRED');
  return new Promise<T>((resolve, reject) => {
    const req = https.request(
      {
        hostname: bridgeIp,
        port: 443,
        path,
        method,
        ca: SIGNIFY_CA,
        servername: bridgeId.toLowerCase(),
        rejectUnauthorized: true,
        checkServerIdentity: (_host, cert) => {
          const cn = String(cert.subject?.CN ?? '').toLowerCase();
          return cn === bridgeId.toLowerCase()
            ? undefined
            : new Error('BRIDGE_ID_MISMATCH');
        },
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(state.appKey ? { 'hue-application-key': state.appKey } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          raw += chunk;
          if (raw.length > 2_000_000)
            req.destroy(new HueError('INVALID_RESPONSE'));
        });
        res.on('end', () => {
          if (!res.statusCode || res.statusCode >= 400) {
            reject(
              new HueError(
                res.statusCode === 429 ? 'RATE_LIMIT' : 'BRIDGE_ERROR'
              )
            );
            return;
          }
          try {
            const data: unknown = JSON.parse(raw);
            if (Array.isArray(data) && data.some((x) => x?.error)) {
              const e = data.find((x) => x?.error)?.error;
              reject(
                new HueError(
                  e?.type === 101 ? 'LINK_BUTTON_REQUIRED' : 'BRIDGE_ERROR'
                )
              );
              return;
            }
            if (
              data &&
              typeof data === 'object' &&
              'errors' in data &&
              Array.isArray(data.errors) &&
              data.errors.length
            ) {
              reject(new HueError('BRIDGE_ERROR'));
              return;
            }
            resolve(data as T);
          } catch {
            reject(new HueError('INVALID_RESPONSE'));
          }
        });
      }
    );
    req.setTimeout(1500, () => req.destroy(new HueError('TIMEOUT')));
    req.on('error', (e) =>
      reject(
        e instanceof HueError
          ? e
          : new HueError(signal?.aborted ? 'ABORTED' : 'OFFLINE')
      )
    );
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

export class HueV2Bridge implements BridgeIO {
  private nextWriteAt = 0;
  constructor(private state: StoredHueState) {}
  async lights(): Promise<HueLightResource[]> {
    return (
      await bridgeRequest<{ data: HueLightResource[] }>(
        this.state,
        '/clip/v2/resource/light'
      )
    ).data;
  }
  async areas(): Promise<HueArea[]> {
    const [areas, lights, resources] = await Promise.all([
      bridgeRequest<{ data: HueArea[] }>(
        this.state,
        '/clip/v2/resource/entertainment_configuration'
      ),
      this.lights(),
      bridgeRequest<{ data: Array<{ id: string; owner: { rid: string } }> }>(
        this.state,
        '/clip/v2/resource/entertainment'
      ),
    ]);
    return areas.data.map((area) => ({
      ...area,
      lightIds: [
        ...new Set(
          area.channels.flatMap((c) =>
            c.members.flatMap((m) => {
              const owner = resources.data.find((r) => r.id === m.service.rid)
                ?.owner.rid;
              return lights
                .filter((l) => l.owner?.rid === owner)
                .map((l) => l.id);
            })
          )
        ),
      ],
    }));
  }
  async write(id: string, payload: Record<string, unknown>): Promise<void> {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new HueError('INVALID_LIGHT');
    const wait = Math.max(0, this.nextWriteAt - performance.now());
    this.nextWriteAt = Math.max(this.nextWriteAt, performance.now()) + 125;
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    await bridgeRequest(
      this.state,
      '/clip/v2/resource/light/' + id,
      'PUT',
      payload
    );
  }
}
