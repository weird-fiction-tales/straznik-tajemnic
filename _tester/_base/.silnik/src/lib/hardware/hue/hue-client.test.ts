/**
 * @file hue-client.test.ts
 * Testy jednostkowe dla klienta Philips Hue CLIP v2 z izolacją sieciową (mock fetch).
 */

import { HueClient } from './hue-client';

describe('HueClient (Local CLIP v2 LAN)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('inicjalizuje się z domyślnie wyłączoną konfiguracją (Zero Overhead)', () => {
    const client = new HueClient();
    expect(client.getConfig().enabled).toBe(false);
    expect(client.getConfig().bridgeIp).toBe('');
    expect(client.getConfig().appKey).toBe('');
    expect(client.getConfig().selectedLightIds).toEqual([]);
  });

  it('poprawnie odkrywa mostki przez discovery endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'bridge-1', internalipaddress: '192.168.1.120', port: 443 },
      ],
    } as unknown as Response);

    const result = await HueClient.discoverBridges();
    expect(result).toHaveLength(1);
    expect(result[0].internalipaddress).toBe('192.168.1.120');
  });

  it('obsługuje błąd discovery i zwraca pustą tablicę', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    const result = await HueClient.discoverBridges();
    expect(result).toEqual([]);
  });

  it('przeprowadza procedurę parowania pushlink z mostkiem', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ success: { username: 'test-app-key-123' } }],
    } as unknown as Response);

    const client = new HueClient();
    const result = await client.linkBridge('192.168.1.120');

    expect(result.success).toBe(true);
    expect(result.appKey).toBe('test-app-key-123');
    expect(client.getConfig().bridgeIp).toBe('192.168.1.120');
    expect(client.getConfig().appKey).toBe('test-app-key-123');
  });

  it('zwraca błąd parowania, gdy przycisk na mostku nie został wciśnięty', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ error: { description: 'link button not pressed' } }],
    } as unknown as Response);

    const client = new HueClient();
    const result = await client.linkBridge('192.168.1.120');

    expect(result.success).toBe(false);
    expect(result.error).toBe('link button not pressed');
  });

  it('obsługuje pętlę Pushlink (linkBridgeWithPolling) z odliczaniem i wykryciem wciśnięcia przycisku', async () => {
    const fetchMock = jest.fn();
    // 1 próba: przycisk jeszcze nie wciśnięty
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ error: { description: 'link button not pressed' } }],
    });
    // 2 próba: przycisk wciśnięty!
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ success: { username: 'polled-key-456' } }],
    });

    global.fetch = fetchMock;

    const client = new HueClient();
    const countdowns: number[] = [];
    const result = await client.linkBridgeWithPolling(
      '192.168.1.120',
      (sec) => countdowns.push(sec),
      undefined,
      3
    );

    expect(result.success).toBe(true);
    expect(result.appKey).toBe('polled-key-456');
    expect(countdowns).toContain(3);
    expect(countdowns).toContain(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('zwraca TIMEOUT w linkBridgeWithPolling, gdy gracz nie wciśnie przycisku na mostku', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ error: { description: 'link button not pressed' } }],
    } as unknown as Response);

    const client = new HueClient();
    const result = await client.linkBridgeWithPolling(
      '192.168.1.120',
      undefined,
      undefined,
      1 // krótki timeout pod test
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('TIMEOUT');
  });

  it('pobiera listę świateł w oficjalnym formacie Hue API v1 LAN', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        '1': {
          name: 'Lampa Sufitowa',
          type: 'Dimmable light',
          state: {
            on: true,
            bri: 254,
            ct: 370,
            reachable: true,
          },
        },
        '2': {
          name: 'Lampa Biurkowa',
          type: 'Extended color light',
          state: {
            on: false,
            bri: 127,
            xy: [0.45, 0.40],
            reachable: true,
          },
        },
      }),
    } as unknown as Response);

    const client = new HueClient({
      bridgeIp: '192.168.1.120',
      appKey: 'test-key',
    });

    const lights = await client.getLights();
    expect(lights).toHaveLength(2);
    expect(lights[0].id).toBe('1');
    expect(lights[0].metadata.name).toBe('Lampa Sufitowa');
    expect(lights[0].dimming?.brightness).toBe(100);
    expect(lights[0].color_temperature?.mirek).toBe(370);
    expect(lights[1].id).toBe('2');
    expect(lights[1].on.on).toBe(false);
    expect(lights[1].dimming?.brightness).toBe(50);
    expect(lights[1].color?.xy).toEqual({ x: 0.45, y: 0.40 });
  });

  it('pobiera listę zasobów świateł CLIP v2', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'light-1',
            metadata: { name: 'Kinkiet Salon' },
            on: { on: true },
            dimming: { brightness: 50 },
            color_temperature: { mirek: 300 },
          },
        ],
      }),
    } as unknown as Response);

    const client = new HueClient({
      bridgeIp: '192.168.1.120',
      appKey: 'test-key',
    });

    const lights = await client.getLights();
    expect(lights).toHaveLength(1);
    expect(lights[0].metadata.name).toBe('Kinkiet Salon');
  });

  it('tworzy i przywraca migawkę (snapshot) stanu świateł', async () => {
    const fetchMock = jest.fn();
    // 1: getLights call
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'light-1',
            metadata: { name: 'Lampa biurko' },
            on: { on: true },
            dimming: { brightness: 40 },
            color_temperature: { mirek: 400 },
          },
        ],
      }),
    });
    // 2: restore setLightState call
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    global.fetch = fetchMock;

    const client = new HueClient({
      bridgeIp: '192.168.1.120',
      appKey: 'test-key',
      selectedLightIds: ['light-1'],
    });

    const snapshot = await client.captureSnapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].brightness).toBe(40);

    await client.restoreSnapshot(snapshot, 2000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
