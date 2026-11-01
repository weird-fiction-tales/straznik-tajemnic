import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
const baseURL = 'http://127.0.0.1:4068';
const evidence = process.env.ZEW_UNIFIED_EVIDENCE || path.resolve(__dirname, '../../../../..', '.desktop/unified-macos-20261031/evidence');
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['unified-runtime-cache.spec.ts', 'unified-catalog.spec.ts', 'unified-dossier-media.spec.ts', 'showcase-journal-dialogue.spec.ts', 'showcase-save-roundtrip.spec.ts', 'hue-lighting.spec.ts', 'ambilight-settings.spec.ts', 'narration-preset-independence.spec.ts'],
  workers: 1, retries: 0, timeout: 60_000,
  reporter: [['list'], ['json', { outputFile: path.join(evidence, 'e2e-results.json') }]],
  outputDir: path.join(evidence, 'browser'),
  use: { baseURL, viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: {
    command: (process.env.ZEW_UNIFIED_RUNTIME ? './bin/node' : 'node') + ' node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 4068',
    cwd: process.env.ZEW_UNIFIED_RUNTIME || __dirname,
    url: baseURL, reuseExistingServer: process.env.ZEW_UNIFIED_REUSE === '1', timeout: 60_000,
    env: { ZEW_LOCAL_PLAYTEST: 'showcase-pl-en', ZEW_DESKTOP_SHOWCASE: '1', ZEW_DESKTOP_SELF_UPDATE: '0', STRAZNIK_DESKTOP_UPDATE: '1', NEXT_TELEMETRY_DISABLED: '1', ZEW_DATA_DIR: path.join(evidence, 'test-data'), RAG_DATA_DIR: path.join(evidence, 'test-data/rag') },
  },
});
