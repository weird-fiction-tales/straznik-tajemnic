import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';


test('favicon requests preserve the signed runtime', async ({ request }) => {
  const runtime = process.env.ZEW_UNIFIED_RUNTIME;
  test.skip(!runtime, 'Requires a frozen desktop runtime');
  const cache = path.join(runtime!, '.next/server/route-cache');
  const before = fs.existsSync(cache) ? fs.readdirSync(cache, {recursive: true}).sort() : [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await request.get('/favicon.ico');
    expect(response.status()).toBe(200);
    expect((await response.body()).length).toBeGreaterThan(100);
  }
  await new Promise(resolve => setTimeout(resolve, 300));
  const after = fs.existsSync(cache) ? fs.readdirSync(cache, {recursive: true}).sort() : [];
  expect(after).toEqual(before);
});
