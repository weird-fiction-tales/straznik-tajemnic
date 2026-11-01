import { mkdir, readFile, writeFile, rename, chmod } from 'node:fs/promises';
import path from 'node:path';
import { getWritableDataDir } from '@/lib/paths';
import { DEFAULT_HUE_CONFIG } from './types';
import type { StoredHueState } from './server-types';
export function hueStateFile(): string {
  return path.join(getWritableDataDir(), 'hardware', 'hue.json');
}
export async function loadHueState(): Promise<StoredHueState> {
  try {
    const s = JSON.parse(
      await readFile(hueStateFile(), 'utf8')
    ) as StoredHueState;
    if (
      !s ||
      typeof s.appKey !== 'string' ||
      !Array.isArray(s.config?.selectedLightIds)
    )
      throw Error('INVALID_CONFIG');
    return { ...s, config: { ...DEFAULT_HUE_CONFIG, ...s.config, appKey: '' } };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
      throw Error('HUE_STORAGE_ERROR');
    return {
      config: { ...DEFAULT_HUE_CONFIG, selectedLightIds: [] },
      appKey: '',
      clientKey: '',
    };
  }
}
export async function saveHueState(s: StoredHueState): Promise<void> {
  const file = hueStateFile();
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = file + '.tmp';
  await writeFile(tmp, JSON.stringify(s), { mode: 0o600 });
  await chmod(tmp, 0o600);
  await rename(tmp, file);
}
