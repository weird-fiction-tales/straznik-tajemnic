/** Page-memory handshake, separate from browser-owned BYOK credentials and licenses. */
export interface LocalPlaytestTransport {
  serverConfigured: boolean;
  serverHasBaseRules: boolean;
  loading: boolean;
}
const initial: LocalPlaytestTransport = { serverConfigured: false, serverHasBaseRules: false, loading: true };
const unavailable: LocalPlaytestTransport = { serverConfigured: false, serverHasBaseRules: false, loading: false };
let snapshot = initial;
let inFlight: Promise<LocalPlaytestTransport> | undefined;
const listeners = new Set<() => void>();

function isLocalBrowser(): boolean {
  return typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) &&
    ['http:', 'https:'].includes(window.location.protocol);
}
function publish(value: LocalPlaytestTransport): LocalPlaytestTransport {
  snapshot = value;
  listeners.forEach(listener => listener());
  return value;
}
export const subscribeLocalPlaytestTransport = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const getLocalPlaytestTransport = (): LocalPlaytestTransport => isLocalBrowser() ? snapshot : unavailable;
export const getServerPlaytestTransport = (): LocalPlaytestTransport => initial;
export const hasLocalPlaytestTransport = (): boolean => getLocalPlaytestTransport().serverConfigured;
export const hasLocalPlaytestRules = (): boolean => {
  const state = getLocalPlaytestTransport();
  return state.serverConfigured && state.serverHasBaseRules;
};

/** Same-origin health verifies the server env key. Never sends or stores a client key. */
export function checkLocalPlaytestTransport(refresh = false): Promise<LocalPlaytestTransport> {
  if (!isLocalBrowser()) return Promise.resolve(unavailable);
  if (inFlight) return inFlight;
  if (!refresh && !snapshot.loading) return Promise.resolve(snapshot);
  inFlight = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    let serverConfigured = false;
    let serverHasBaseRules = false;
    try {
      const response = await fetch('/api/health/gemini', { cache: 'no-store', signal: controller.signal });
      const health = response.ok ? await response.json() : null;
      serverConfigured = health?.status === 'ok' && health?.keyValid === true && health?.serverConfigured === true;
      if (serverConfigured) {
        const rulesResponse = await fetch('/api/pdf/ingest-local?type=rules', { cache: 'no-store', signal: controller.signal });
        const rules = rulesResponse.ok ? await rulesResponse.json() : null;
        serverHasBaseRules = rules?.hasBaseRules === true;
      }
    } catch {
      // A missing/failed rules index cannot authorize the rules gate.
    } finally {
      clearTimeout(timeout);
    }
    return publish({ serverConfigured, serverHasBaseRules, loading: false });
  })().finally(() => { inFlight = undefined; });
  return inFlight;
}
