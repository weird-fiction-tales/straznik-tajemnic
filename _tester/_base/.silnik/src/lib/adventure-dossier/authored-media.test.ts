import { TextEncoder } from 'node:util';
import { webcrypto } from 'node:crypto';
import { createAuthoredPrabutyPayload } from './authored-prabuty';
import { authorizeLocalDraftPayload, fingerprintLocalDraftPayload } from './runtime-authorization';
import { authoredPrabutyMediaId, resolveAuthoredPrabutyMedia, acquiredAuthoredMedia } from './authored-media';
import { acquiredHandoutsFromTurn } from './local-handouts';
beforeAll(() => {
  Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder });
  Object.defineProperty(globalThis.crypto, 'subtle', { configurable: true, value: webcrypto.subtle });
});
async function edition() {
  const fp = await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload(`sha256:${'0'.repeat(64)}`));
  return authorizeLocalDraftPayload(createAuthoredPrabutyPayload(fp), { adventureId: 'cien-nad-prabutami', editionFingerprint: fp });
}
test('matches only the four full authored identities', () => {
  expect(authoredPrabutyMediaId('clue-photo-prabuty-1947')).toBe('prabuty.media.clue-photo-prabuty-1947');
  expect(authoredPrabutyMediaId('photo-prabuty')).toBeNull();
  expect(authoredPrabutyMediaId('/etc/passwd')).toBeNull();
});
test('unregistered pending records cannot render a material', async () => {
  const registered = await edition();
  const plain = JSON.parse(JSON.stringify(registered));
  expect(resolveAuthoredPrabutyMedia(plain, 'clue-photo-prabuty-1947')).toBeNull();
  expect(resolveAuthoredPrabutyMedia(registered, 'clue-photo-prabuty-1947')?.image).toContain('/playtest/photo-1947.png');
});
test('a material requires an explicit tag and the exact scene-scoped eligible record', async () => {
  const payload = await edition();
  const id = 'prabuty.media.clue-photo-prabuty-1947';
  expect(acquiredAuthoredMedia('Oglądam fotografię.', [id], payload)).toEqual([]);
  expect(acquiredAuthoredMedia('[HANDOUT:clue-photo-prabuty-1947]', [], payload)).toEqual([]);
  expect(acquiredAuthoredMedia('[HANDOUT:photo-prabuty]', [id], payload)).toEqual([]);
  expect(acquiredHandoutsFromTurn('[HANDOUT:clue-photo-prabuty-1947] [HANDOUT:prabuty.media.clue-photo-prabuty-1947]', [id], payload)).toEqual([id]);
  expect(acquiredAuthoredMedia('[HANDOUT:clue-sb-file-klin]', [id], payload)).toEqual([]);
});
