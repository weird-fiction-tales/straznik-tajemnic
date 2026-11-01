import { HueClient, hueCommand } from './hue-client';
describe('same-origin Hue proxy', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn();
  });
  afterEach(() => jest.useRealTimers());
  it('defaults to disabled and never sends credentials to a bridge URL', async () => {
    const client = new HueClient();
    expect(client.getConfig().enabled).toBe(false);
    jest.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);
    await hueCommand('pause');
    expect(fetch).toHaveBeenCalledWith(
      '/api/hue',
      expect.objectContaining({ method: 'POST' })
    );
  });
  it('rejects a bridge error even on HTTP 200', async () => {
    jest.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ error: 'BRIDGE_ERROR' }),
    } as Response);
    await expect(hueCommand('state')).rejects.toThrow('BRIDGE_ERROR');
  });
  it('does not claim success when the local API is offline', async () => {
    jest.mocked(fetch).mockRejectedValue(new Error('offline'));
    await expect(
      new HueClient({ enabled: true }).applyToSelectedLights({
        on: { on: true },
      })
    ).rejects.toThrow('offline');
  });
  it('cancels pairing with the actual request signal', async () => {
    const controller = new AbortController();
    jest
      .mocked(fetch)
      .mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) =>
            options?.signal?.addEventListener('abort', () =>
              reject(new Error('aborted'))
            )
          )
      );
    const result = new HueClient().linkBridgeWithPolling(
      '192.168.1.2',
      undefined,
      controller.signal
    );
    controller.abort();
    expect(await result).toEqual({ success: false, error: 'ABORTED' });
  });
  it('keeps the heartbeat alive only until stop', async () => {
    jest.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ snapshot: [] }),
    } as unknown as Response);
    const c = new HueClient();
    await c.captureSnapshot();
    await jest.advanceTimersByTimeAsync(2500);
    expect(fetch).toHaveBeenCalledTimes(2);
    await c.restoreSnapshot([]);
    await jest.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('allows the bounded Entertainment retry to finish before aborting acquisition', async () => {
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    jest
      .mocked(fetch)
      .mockResolvedValue({
        ok: true,
        json: async () => ({ snapshot: [] }),
      } as unknown as Response);
    try {
      await hueCommand('start');
      expect(timeout).toHaveBeenLastCalledWith(10000);
    } finally {
      timeout.mockRestore();
    }
  });
});
