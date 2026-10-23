import {defineConfig,devices} from '@playwright/test';

const baseURL='http://127.0.0.1:4055';
export default defineConfig({
  testDir:'./tests/e2e',
  testMatch:['showcase-start.spec.ts','narrative-formatting.spec.ts','showcase-runtime.spec.ts'],
  workers:1,
  retries:0,
  reporter:'list',
  use:{baseURL,viewport:{width:1440,height:1000},screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}}],
  webServer:{
    command:'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 4055',
    url:baseURL,
    cwd:__dirname,
    reuseExistingServer:false,
    timeout:60_000,
    env:{ZEW_LOCAL_PLAYTEST:'showcase-pl-en',ZEW_DESKTOP_SHOWCASE:'1',ZEW_DESKTOP_SELF_UPDATE:'0',STRAZNIK_DESKTOP_UPDATE:'1',NEXT_TELEMETRY_DISABLED:'1'},
  },
});
