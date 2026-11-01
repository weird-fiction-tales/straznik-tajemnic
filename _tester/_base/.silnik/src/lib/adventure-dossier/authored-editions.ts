import { createAuthoredPrabutyPayload } from './authored-prabuty';
import { createAuthoredEnglewoodPayload } from './authored-englewood';
import { isAuthoredAdventureId } from './authored-scenarios';
import { authorizeLocalDraftPayload, fingerprintLocalDraftPayload } from './runtime-authorization';

export async function createAuthoredEdition(adventureId: string) {
  if (!isAuthoredAdventureId(adventureId)) throw new Error('LOCAL_PLAYTEST_INVALID');
  const factory = adventureId === 'cien-nad-prabutami' ? createAuthoredPrabutyPayload : createAuthoredEnglewoodPayload;
  const editionFingerprint = await fingerprintLocalDraftPayload(factory('sha256:' + '0'.repeat(64)));
  const payload = await authorizeLocalDraftPayload(factory(editionFingerprint), { adventureId, editionFingerprint });
  return { payload, editionFingerprint };
}
