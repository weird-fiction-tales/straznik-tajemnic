import type { LightingPayload } from './color';
export interface AmbilightStatus {
  paired: boolean;
  enabled: boolean;
  ip: string;
  name: string;
  restorePending?: boolean;
  generation?: string;
}
export const AMBILIGHT_ENABLED_KEY = 'straznik_ambilight_enabled';
const GENERATION_KEY = 'straznik_ambilight_generation';
export const AMBILIGHT_CHANGED = 'straznik_ambilight_changed';
export async function ambilightAction<T>(
  action?: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const response = await fetch(
    '/api/hardware/ambilight',
    action
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...body,
            action,
            ...(action === 'effect'
              ? { generation: localStorage.getItem(GENERATION_KEY) }
              : {}),
          }),
          signal: AbortSignal.timeout(15000),
        }
      : { cache: 'no-store', signal: AbortSignal.timeout(5000) }
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'offline');
  if (
    !action &&
    (typeof result.paired !== 'boolean' ||
      typeof result.enabled !== 'boolean' ||
      typeof result.ip !== 'string')
  )
    throw new Error('invalidResponse');
  return result as T;
}
export function saveAmbilightStatus(status: AmbilightStatus) {
  localStorage.setItem(AMBILIGHT_ENABLED_KEY, String(status.enabled));
  if (status.generation)
    localStorage.setItem(GENERATION_KEY, status.generation);
  window.dispatchEvent(new Event(AMBILIGHT_CHANGED));
}
export interface LightingTarget {
  isEnabled(): boolean;
  apply(payload: LightingPayload): Promise<void>;
  end(): Promise<void>;
}
export class AmbilightClient implements LightingTarget {
  isEnabled() {
    return (
      typeof window !== 'undefined' &&
      localStorage.getItem(AMBILIGHT_ENABLED_KEY) === 'true'
    );
  }
  async apply(payload: LightingPayload) {
    if (!this.isEnabled()) return;
    await ambilightAction('effect', { payload });
  }
  async end() {
    saveAmbilightStatus(await ambilightAction<AmbilightStatus>('end'));
  }
}
