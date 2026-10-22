/** @jest-environment-options {"url":"https://example.com/pl"} */
import { checkLocalPlaytestTransport, hasLocalPlaytestTransport, hasLocalPlaytestRules } from './local-playtest-transport';
it('cannot enable a remote/cloud browser even if its endpoint would advertise server credentials', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', keyValid: true, serverConfigured: true, hasBaseRules: true }) });
  await checkLocalPlaytestTransport(true);
  expect(hasLocalPlaytestTransport()).toBe(false);
  expect(hasLocalPlaytestRules()).toBe(false);
  expect(global.fetch).not.toHaveBeenCalled();
});
