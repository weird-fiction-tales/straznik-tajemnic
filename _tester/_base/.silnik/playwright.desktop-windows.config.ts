import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'desktop-windows-visual.spec.ts',
  workers: 2,
  fullyParallel: true,
  retries: 0,
  timeout: 60_000,
  reporter: [
    ['list'],
    [
      'html',
      { outputFolder: 'test-results/desktop-windows/report', open: 'never' },
    ],
  ],
  outputDir: 'test-results/desktop-windows/runs',
  use: {
    baseURL: 'http://127.0.0.1:3129',
    browserName: 'chromium',
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
  },
});
