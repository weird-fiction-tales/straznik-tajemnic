import { checkLocalPlaytestTransport, hasLocalPlaytestTransport, hasLocalPlaytestRules } from './local-playtest-transport';
import { hasRequiredKeys } from './api-keys-service';

const fetchMock = jest.fn();
const ok = (body: unknown) => ({ ok: true, json: async () => body });
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); global.fetch = fetchMock; });
it('requires the explicit verified handshake and actual rules; never stores credentials or licensing flags', async () => {
  fetchMock.mockResolvedValueOnce(ok({ status: 'ok', keyValid: true, serverConfigured: true }))
    .mockResolvedValueOnce(ok({ hasBaseRules: true }));
  await checkLocalPlaytestTransport(true);
  expect(hasLocalPlaytestTransport()).toBe(true);
  expect(hasLocalPlaytestRules()).toBe(true);
  expect(hasRequiredKeys()).toBe(false);
  expect(localStorage.length).toBe(0);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/health/gemini', '/api/pdf/ingest-local?type=rules']);
  for (const [,init] of fetchMock.mock.calls) expect(init.headers).toBeUndefined();
});
it.each([
  { status: 'ok', keyValid: true },
  { status: 'network_error', keyValid: null, serverConfigured: true },
  { status: 'invalid_key', keyValid: false, serverConfigured: true },
  { status: 'ok', keyValid: 'true', serverConfigured: true },
])('does not authorize an incomplete health response: %j', async health => {
  fetchMock.mockResolvedValueOnce(ok(health));
  await checkLocalPlaytestTransport(true);
  expect(hasLocalPlaytestTransport()).toBe(false);
  expect(hasLocalPlaytestRules()).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it.each([{ recordCount: 123 }, { hasBaseRules: false, recordCount: 123 }, { hasBaseRules: 'true' }])('does not infer rules licensing from count or truthiness: %j', async rules => {
  fetchMock.mockResolvedValueOnce(ok({ status: 'ok', keyValid: true, serverConfigured: true })).mockResolvedValueOnce(ok(rules));
  await checkLocalPlaytestTransport(true);
  expect(hasLocalPlaytestTransport()).toBe(true);
  expect(hasLocalPlaytestRules()).toBe(false);
});
it('clears authorization on refresh failure and shares an in-flight check', async () => {
  fetchMock.mockRejectedValueOnce(new Error('offline'));
  const first = checkLocalPlaytestTransport(true);
  expect(checkLocalPlaytestTransport()).toBe(first);
  await first;
  expect(hasLocalPlaytestTransport()).toBe(false);
});
