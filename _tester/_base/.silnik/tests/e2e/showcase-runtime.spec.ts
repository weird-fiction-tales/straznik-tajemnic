import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import path from 'node:path';

test('both local adventure dossiers and the update lock are active',async({request})=>{
  for(const id of ['cien-nad-prabutami','englewood-murder-castle-1893']){
    const response=await request.get('/api/adventure-dossier/playtest?adventureId='+id);
    expect(response.status()).toBe(200);
    const edition=await response.json();
    expect(edition.mode).toBe('local_playtest');
    expect(edition.adventureId).toBe(id);
    expect(edition.payload.adventure_id).toBe(id);
    expect(edition.payload.records.length).toBeGreaterThan(0);
    expect(edition.editionFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    const manifest=JSON.parse(readFileSync(path.resolve(__dirname,'../../public/adventure-packs',id,'manifest.json'),'utf8'));
    expect(manifest.handouts).toHaveLength(4);
    for(const handout of manifest.handouts){
      const media=await request.get(handout.image);
      expect(media.status()).toBe(200);
      expect(media.headers()['content-type']).toMatch(/^image\//);
    }
  }
  const check=await request.get('/api/desktop/update/check');
  expect(check.status()).toBe(200);
  expect(await check.json()).toMatchObject({available:false,configured:false,canSelfUpdate:false});
  const start=await request.post('/api/desktop/update/start',{headers:{origin:'http://127.0.0.1:4055'},data:{}});
  expect(start.status()).toBe(409);
});
