import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createHash, randomBytes } from 'node:crypto';
import type { TLSSocket } from 'node:tls';

export function isPrivateIPv4(ip: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return false;
  const p = ip.split('.').map(Number);
  if (p.some((n) => n > 255) || p[3] === 0 || p[3] === 255) return false;
  return (
    p[0] === 10 ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31)
  );
}

export interface Credentials {
  username: string;
  password: string;
  fingerprint: string;
}
export interface TVReply {
  data: unknown;
  fingerprint: string;
}
export type TVRequest = (
  ip: string,
  path: string,
  body?: unknown,
  credentials?: Partial<Credentials>
) => Promise<TVReply>;

export function digestAuthorization(
  challenge: string,
  username: string,
  password: string,
  method: string,
  uri: string,
  cnonce = randomBytes(12).toString('hex')
): string {
  if (!challenge.startsWith('Digest ')) throw new Error('authentication');
  const fields: Record<string, string> = {};
  for (const match of challenge.matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]+))/g))
    fields[match[1]] = match[2] ?? match[3];
  if (
    !fields.realm ||
    !fields.nonce ||
    (fields.algorithm && fields.algorithm.toUpperCase() !== 'MD5')
  )
    throw new Error('authentication');
  const md5 = (s: string) => createHash('md5').update(s).digest('hex');
  const ha1 = md5(`${username}:${fields.realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const qop = fields.qop ? 'auth' : undefined;
  if (
    fields.qop &&
    !fields.qop
      .split(',')
      .map((s) => s.trim())
      .includes('auth')
  )
    throw new Error('authentication');
  const response = md5(
    qop
      ? `${ha1}:${fields.nonce}:00000001:${cnonce}:auth:${ha2}`
      : `${ha1}:${fields.nonce}:${ha2}`
  );
  const quoted = (s: string) => JSON.stringify(s);
  return `Digest username=${quoted(username)}, realm=${quoted(fields.realm)}, nonce=${quoted(fields.nonce)}, uri=${quoted(uri)}, response="${response}", algorithm=MD5${qop ? `, qop=auth, nc=00000001, cnonce=${quoted(cnonce)}` : ''}${fields.opaque ? `, opaque=${quoted(fields.opaque)}` : ''}`;
}

// Philips uses a self-signed certificate. Accept it only on this LAN connection;
// pin its fingerprint throughout pairing and all subsequent authenticated calls.
export const requestTV: TVRequest = async (ip, path, body, credentials) => {
  if (!isPrivateIPv4(ip) || !/^[a-zA-Z/]+$/.test(path))
    throw new Error('invalidAddress');
  const uri = `/6/${path}`;
  const method = body === undefined ? 'GET' : 'POST';
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const send = (authorization?: string) =>
    new Promise<{ status: number; challenge: string; reply: TVReply }>(
      (resolve, reject) => {
        const req = httpsRequest(
          {
            hostname: ip,
            port: 1926,
            path: uri,
            method,
            rejectUnauthorized: false,
            headers: {
              Accept: 'application/json',
              ...(payload
                ? {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                  }
                : {}),
              ...(authorization ? { Authorization: authorization } : {}),
            },
          },
          (res) => {
            const fingerprint = (res.socket as TLSSocket).getPeerCertificate()
              .fingerprint256;
            if (
              !fingerprint ||
              (credentials?.fingerprint &&
                credentials.fingerprint !== fingerprint)
            ) {
              res.destroy();
              reject(new Error('certificateChanged'));
              return;
            }
            let data = '';
            res.on('data', (chunk) => {
              data += chunk.toString();
              if (data.length > 65536)
                req.destroy(new Error('invalidResponse'));
            });
            res.on('error', reject);
            res.on('end', () => {
              try {
                resolve({
                  status: res.statusCode ?? 0,
                  challenge: String(res.headers['www-authenticate'] ?? ''),
                  reply: {
                    data:
                      data &&
                      res.statusCode &&
                      res.statusCode >= 200 &&
                      res.statusCode < 300
                        ? JSON.parse(data)
                        : {},
                    fingerprint,
                  },
                });
              } catch {
                reject(new Error('invalidResponse'));
              }
            });
          }
        );
        // Check before sending credentials or a command, not just after the reply.
        req.on('socket', (socket) =>
          socket.on('secureConnect', () => {
            const cert = (socket as TLSSocket).getPeerCertificate();
            if (
              credentials?.fingerprint &&
              cert.fingerprint256 !== credentials.fingerprint
            )
              req.destroy(new Error('certificateChanged'));
          })
        );
        const deadline = setTimeout(
          () => req.destroy(new Error('offline')),
          2500
        );
        req.on('close', () => clearTimeout(deadline));
        req.on('error', reject);
        req.end(payload);
      }
    );
  let result = await send();
  // Some Android firmware publishes metadata only on HTTP, while pairing and
  // authenticated control use HTTPS. Keep the TLS fingerprint from the probe.
  if (
    path === 'system' &&
    !credentials &&
    [401, 403, 404].includes(result.status)
  ) {
    const data = await new Promise<unknown>((resolve, reject) => {
      const req = httpRequest(
        {
          hostname: ip,
          port: 1925,
          path: uri,
          method: 'GET',
          headers: { Accept: 'application/json' },
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error('unsupported'));
            return;
          }
          let text = '';
          res.on('data', (chunk) => {
            text += chunk.toString();
            if (text.length > 65536) req.destroy(new Error('invalidResponse'));
          });
          res.on('error', reject);
          res.on('end', () => {
            try {
              resolve(JSON.parse(text));
            } catch {
              reject(new Error('invalidResponse'));
            }
          });
        }
      );
      const deadline = setTimeout(
        () => req.destroy(new Error('offline')),
        2500
      );
      req.on('close', () => clearTimeout(deadline));
      req.on('error', reject);
      req.end();
    });
    return { data, fingerprint: result.reply.fingerprint };
  }
  if (result.status === 401 && credentials?.username && credentials.password) {
    result = await send(
      digestAuthorization(
        result.challenge,
        credentials.username,
        credentials.password,
        method,
        uri
      )
    );
  }
  if (result.status < 200 || result.status >= 300)
    throw new Error(result.status === 401 ? 'authentication' : 'offline');
  return result.reply;
};
