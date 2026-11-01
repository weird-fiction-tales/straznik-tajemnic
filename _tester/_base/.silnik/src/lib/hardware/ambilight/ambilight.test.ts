import { isPrivateIPv4, digestAuthorization } from './transport';
import { AmbilightService } from './service';
import { lightingToColor } from './color';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const system = {
  name: '55PUS7303/12',
  api_version: { Major: 6 },
  featuring: {
    jsonfeatures: { ambilight: ['Ambilight'] },
    systemfeatures: { pairing_type: 'digest_auth_pairing' },
  },
};
const initial = { styleName: 'FOLLOW_VIDEO', menuSetting: 'STANDARD' };
function setup() {
  const request = jest.fn(async (_ip: string, path: string, body?: unknown) => {
    let data: unknown = {};
    if (path === 'system') data = system;
    if (path === 'pair/grant') data = { error_id: 'SUCCESS' };
    if (path === 'pair/request')
      data = {
        error_id: 'SUCCESS',
        auth_key: 'private-test-key',
        timestamp: 123,
        timeout: 60,
      };
    if (path === 'ambilight/currentconfiguration' && body === undefined)
      data = initial;
    if (path === 'ambilight/power' || path === 'HueLamp/power')
      data = { power: 'On' };
    return { data, fingerprint: 'test-fingerprint' };
  });
  return { request };
}

describe('Philips Ambilight', () => {
  test.each([
    '127.0.0.1',
    '8.8.8.8',
    '169.254.1.1',
    '192.168.1.2/path',
    'localhost',
    '10.1.1.999',
  ])('rejects non-LAN target %s', (ip) =>
    expect(isPrivateIPv4(ip)).toBe(false)
  );
  test.each(['192.168.1.10', '10.0.0.2', '172.16.0.3'])(
    'accepts private IPv4 %s',
    (ip) => expect(isPrivateIPv4(ip)).toBe(true)
  );
  test('creates digest auth using the requested method and path', () => {
    const header = digestAuthorization(
      'Digest realm="tv", nonce="abc", qop="auth", algorithm=MD5',
      'user',
      'password',
      'POST',
      '/6/pair/grant',
      'xyz'
    );
    expect(header).toContain('uri="/6/pair/grant"');
    expect(header).toContain('qop=auth');
    expect(header).not.toContain('password');
    expect(() =>
      digestAuthorization('Basic realm="tv"', 'u', 'p', 'GET', '/6/system')
    ).toThrow();
  });
  test('maps brightness independently from color, including dim-only effects', () => {
    const color = lightingToColor({
      color: { xy: { x: 0.64, y: 0.33 } },
      dimming: { brightness: 100 },
    });
    expect(color.saturation).toBeGreaterThan(150);
    expect(color.brightness).toBe(255);
    expect(lightingToColor({ dimming: { brightness: 3 } }, color)).toEqual({
      ...color,
      brightness: 8,
    });
    expect(
      lightingToColor({ color_temperature: { mirek: 370 } }).hue
    ).toBeLessThan(50);
  });
  test('pairs, persists credentials privately, takes over, restores and disconnects', async () => {
    const { request } = setup();
    const directory = await mkdtemp(join(tmpdir(), 'ambilight-test-'));
    const service = new AmbilightService(join(directory, 'tv.json'), request);
    await service.pair('192.168.1.50');
    await service.confirm('1234');
    expect(JSON.stringify(await service.status())).not.toContain(
      'private-test-key'
    );
    expect((await stat(join(directory, 'tv.json'))).mode & 0o777).toBe(0o600);
    expect(await readFile(join(directory, 'tv.json'), 'utf8')).toContain(
      'private-test-key'
    );
    await service.enable(true);
    await service.effect({ dimming: { brightness: 80 } });
    expect(request).toHaveBeenCalledWith(
      '192.168.1.50',
      'ambilight/currentconfiguration',
      expect.objectContaining({ algorithm: 'MANUAL_HUE' }),
      expect.anything()
    );
    await service.enable(false);
    expect(request).toHaveBeenCalledWith(
      '192.168.1.50',
      'ambilight/currentconfiguration',
      initial,
      expect.anything()
    );
    const before = request.mock.calls.length;
    await service.effect({ dimming: { brightness: 100 } });
    expect(request).toHaveBeenCalledTimes(before);
    await service.disconnect();
    expect((await service.status()).paired).toBe(false);
  });
  test('invalid PIN does not persist credentials or report pairing success', async () => {
    const { request } = setup();
    const directory = await mkdtemp(join(tmpdir(), 'ambilight-test-'));
    const service = new AmbilightService(join(directory, 'tv.json'), request);
    await service.pair('192.168.1.50');
    request.mockImplementationOnce(async () => ({
      data: { error_id: 'INVALID_PIN' },
      fingerprint: 'test-fingerprint',
    }));
    await expect(service.confirm('9999')).rejects.toThrow();
    expect((await service.status()).paired).toBe(false);
  });
  test('unsupported TV cannot start PIN pairing', async () => {
    const { request } = setup();
    request.mockResolvedValueOnce({
      data: { ...system, api_version: { Major: 5 } },
      fingerprint: 'test-fingerprint',
    });
    const service = new AmbilightService('/unused', request);
    await expect(service.pair('192.168.1.50')).rejects.toThrow('unsupported');
  });
  test('failed restoration preserves the snapshot for a retry', async () => {
    const { request } = setup();
    const service = new AmbilightService(
      join(await mkdtemp(join(tmpdir(), 'ambilight-test-')), 'tv.json'),
      request
    );
    await service.pair('192.168.1.50');
    await service.confirm('1234');
    await service.enable(true);
    await service.effect({ dimming: { brightness: 50 } });
    request.mockRejectedValueOnce(new Error('offline'));
    await expect(service.enable(false)).rejects.toThrow('offline');
    await service.enable(false);
    expect(request).toHaveBeenCalledWith(
      '192.168.1.50',
      'ambilight/currentconfiguration',
      initial,
      expect.anything()
    );
  });
});

test('a late effect with an old session token cannot take over TV after restoration', async () => {
  const { request } = setup();
  const service = new AmbilightService(
    join(await mkdtemp(join(tmpdir(), 'ambilight-test-')), 'tv.json'),
    request
  );
  await service.pair('192.168.1.50');
  await service.confirm('1234');
  await service.enable(true);
  const { generation } = await service.status();
  await service.effect({ dimming: { brightness: 50 } }, generation);
  await service.end();
  const before = request.mock.calls.length;
  await service.effect({ dimming: { brightness: 100 } }, generation);
  expect(request).toHaveBeenCalledTimes(before);
});

test('PIN grant follows the JointSpace 6 protocol signature and access envelope', async () => {
  const { request } = setup();
  const service = new AmbilightService(
    join(await mkdtemp(join(tmpdir(), 'ambilight-test-')), 'tv.json'),
    request
  );
  await service.pair('192.168.1.50');
  expect(request).toHaveBeenCalledWith(
    '192.168.1.50',
    'pair/request',
    expect.objectContaining({
      access: { scope: ['read', 'write', 'control'] },
    }),
    expect.anything()
  );
  await service.confirm('1234');
  expect(request).toHaveBeenCalledWith(
    '192.168.1.50',
    'pair/grant',
    expect.objectContaining({
      auth: {
        auth_appId: '1',
        pin: '1234',
        auth_timestamp: 123,
        auth_signature: 'OQ8crCxcfQJduJaTaeBQYu3BO6U=',
      },
    }),
    expect.anything()
  );
});

test('Digest MD5 matches the RFC 2617 reference vector', () => {
  const header = digestAuthorization(
    'Digest realm="testrealm@host.com", qop="auth,auth-int", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", opaque="5ccc069c403ebaf9f0171e9517f40e41"',
    'Mufasa',
    'Circle Of Life',
    'GET',
    '/dir/index.html',
    '0a4f113b'
  );
  expect(header).toContain('response="6629fae49393a05397450978507c4ef1"');
});

test('restart keeps effects disabled and can recover the previous TV mode', async () => {
  const { request } = setup();
  const file = join(
    await mkdtemp(join(tmpdir(), 'ambilight-test-')),
    'tv.json'
  );
  const original = new AmbilightService(file, request);
  await original.pair('192.168.1.50');
  await original.confirm('1234');
  await original.enable(true);
  await original.effect({ dimming: { brightness: 50 } });
  const restarted = new AmbilightService(file, request);
  expect(await restarted.status()).toMatchObject({
    paired: true,
    enabled: false,
    restorePending: true,
  });
  await restarted.enable(false);
  expect(request).toHaveBeenCalledWith(
    '192.168.1.50',
    'ambilight/currentconfiguration',
    initial,
    expect.anything()
  );
  expect((await restarted.status()).restorePending).toBe(false);
});

test('disable invalidates queued effects while a TV request is still in flight', async () => {
  const { request } = setup();
  const service = new AmbilightService(
    join(await mkdtemp(join(tmpdir(), 'ambilight-test-')), 'tv.json'),
    request
  );
  await service.pair('192.168.1.50');
  await service.confirm('1234');
  await service.enable(true);
  await service.effect({ dimming: { brightness: 50 } });
  let release!: () => void;
  let started!: () => void;
  const inFlight = new Promise<void>((resolve) => {
    started = resolve;
  });
  request.mockImplementationOnce(async () => {
    started();
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return { data: {}, fingerprint: 'test-fingerprint' };
  });
  const first = service.effect({ dimming: { brightness: 80 } });
  await inFlight;
  const queued = service.effect({ dimming: { brightness: 100 } });
  const disable = service.enable(false);
  release();
  await first;
  expect(await queued).toEqual({ applied: false });
  await disable;
  expect((await service.status()).enabled).toBe(false);
});
