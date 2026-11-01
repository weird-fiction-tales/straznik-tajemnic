import { TextEncoder } from 'node:util';
import { webcrypto } from 'node:crypto';
import { createAuthoredPrabutyPayload } from './authored-prabuty';
import { authorizeLocalDraftPayload, fingerprintLocalDraftPayload } from './runtime-authorization';
import { authoredPrabutyMediaId, resolveAuthoredPrabutyMedia, acquiredAuthoredMedia } from './authored-media';
import { acquiredHandoutsFromTurn, presentHandoutsForTurn } from './local-handouts';
import { createAuthoredEnglewoodPayload } from './authored-englewood';
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

describe('discovery requires the player action and physical scene access', () => {
  const photo = 'prabuty.media.clue-photo-prabuty-1947';
  const tagged = '[HANDOUT:clue-photo-prabuty-1947]';
  test.each([
    '', 'Co Helena wie o fotografii?', 'Nie otwieram teczki.',
    'Helena otwiera teczkę.', 'Helena mówi: „Otwieram teczkę”.', 'Helena mówi: otwórz teczkę', 'Helena mówi, otwórz teczkę.',
    'Rozważam, czy otwieram teczkę.', 'Jeśli Helena pozwoli, otwieram teczkę.',
    'What does Helena know about the photograph?', "I do not open the folder.",
    'Helena opens the folder.', 'Helena says: "I open the folder."',
  ])('does not reveal the photograph for %s', async playerMessage => {
    const payload = await edition();
    expect(acquiredHandoutsFromTurn(tagged, [photo], payload, {
      playerMessage, location: 'loc-warszawa-redakcja',
    })).toEqual([]);
  });
  test.each(['pokaż co jest w teczce', 'Otwieram teczkę i przeglądam zawartość.', 'Otwieram teczkę i nie ruszam fotografii.', 'Show me what is inside the folder.', 'I open the folder.', 'I open the folder and do not touch the photograph.'])(
    'discovers the source photograph even if the model omitted its handout tag: %s', async playerMessage => {
      const payload = await edition();
      expect(acquiredHandoutsFromTurn('W teczce jest fotografia.', [photo], payload, {
        playerMessage, location: 'loc-warszawa-redakcja',
      })).toEqual([photo]);
    },
  );
  test('a folder action elsewhere cannot reveal the newsroom photograph', async () => {
    const payload = await edition();
    expect(acquiredHandoutsFromTurn(tagged, [photo], payload, {
      playerMessage: 'Otwieram teczkę.', location: 'loc-elblag-klasztor',
    })).toEqual([]);
  });
  test.each(['loc-warszawa-redakcja', 'loc-elblag-klasztor'])(
    'a previously viewed photograph is not pasted into an unrelated conversation at %s', async location => {
      const payload = await edition();
      expect(presentHandoutsForTurn('Helena opowiada o swojej pracy.', [photo], payload, {
        playerMessage: 'Jak długo tu pracujesz?', location, knownHandoutIds: [photo],
      })).toEqual({ content: 'Helena opowiada o swojej pracy.', handouts: [] });
    },
  );
  test('a saved discovery still authorizes its explicit handout after restoring history', async () => {
    const payload = await edition();
    expect(presentHandoutsForTurn(tagged, [], payload, {
      playerMessage: 'Pokaż ponownie fotografię.', location: 'OFF_GRAPH', knownHandoutIds: [photo],
    })).toEqual({ content: `[HANDOUT:${photo}]`, handouts: [photo] });
  });
  test('opening an unrelated folder elsewhere never pastes an earlier discovery into the response', async () => {
    const payload = await edition();
    expect(presentHandoutsForTurn('W teczce agenta są dokumenty.', [photo], payload, {
      playerMessage: 'Otwieram teczkę agenta SB.', location: 'loc-elblag-klasztor', knownHandoutIds: [photo],
    })).toEqual({ content: 'W teczce agenta są dokumenty.', handouts: [] });
  });
  test('a narrator cannot replay a known handout for a player action concerning an unrelated object', async () => {
    const payload = await edition();
    expect(presentHandoutsForTurn(tagged, [photo], payload, {
      playerMessage: 'I inspect the door.', location: 'loc-warszawa-redakcja', knownHandoutIds: [photo],
    }).handouts).toEqual([]);
  });
  test('missing handout tags become one source card after the discovery prose, without granting equipment', async () => {
    const payload = await edition();
    const presentation = presentHandoutsForTurn('Wewnątrz teczki widzisz fotografię.', [photo], payload, {
      playerMessage: 'pokaż co jest w teczce', location: 'loc-warszawa-redakcja',
    });
    expect(presentation).toEqual({ content: `Wewnątrz teczki widzisz fotografię.\n\n[HANDOUT:${photo}]`, handouts: [photo] });
    expect(presentation.content).not.toContain('EKWIPUNEK');
  });
  test('Englewood uses the same action, scene and negation gate for English evidence tags', async () => {
    const source = createAuthoredEnglewoodPayload(`sha256:${'0'.repeat(64)}`);
    const fingerprint = await fingerprintLocalDraftPayload(source);
    const payload = await authorizeLocalDraftPayload(createAuthoredEnglewoodPayload(fingerprint), {
      adventureId: source.adventure_id, editionFingerprint: fingerprint,
    });
    const media = payload.records.find(record => record.record_type === 'media')!;
    const location = media.tags.scenes.find(scene => scene.startsWith('loc-'))!;
    const tag = `[EVIDENCE:${media.record_id}]`;
    expect(presentHandoutsForTurn(tag, [media.record_id], payload, { playerMessage: 'I examine the document.', location }).handouts).toEqual([media.record_id]);
    for (const playerMessage of ['What does Shea know about the document?', 'I do not examine the document.', 'Shea says: "I examine the document."']) {
      expect(presentHandoutsForTurn(tag, [media.record_id], payload, { playerMessage, location }).handouts).toEqual([]);
    }
    expect(presentHandoutsForTurn(tag, [media.record_id], payload, { playerMessage: 'I examine the document.', location: 'OFF_GRAPH' }).handouts).toEqual([]);
  });
});

describe('deterministic Prabuty handouts without narrator tags', () => {
  const cases = [
    { slug: 'clue-photo-prabuty-1947', location: 'loc-warszawa-redakcja', actions: [
      'Pokaż co masz w tej teczce.\n\nOtwieram ją',
      'Oglądam fotografię.', 'Open the folder and look at the photograph.',
    ] },
    { slug: 'clue-sb-file-klin', location: 'loc-msw-warszawa', actions: [
      'Otwieram teczkę KLIN.', 'Czytam raport SB.', 'I read the KLIN dossier.',
    ] },
    { slug: 'clue-herbal-recipe-152', location: 'loc-elblag-klasztor', actions: [
      'Czytam recepturę ziołową nr 152.', 'Oglądam rękopis.', 'I read the herbal recipe.',
    ] },
    { slug: 'audio-sb-wiretap-elblag', location: 'loc-msw-warszawa', actions: [
      'Oglądam taśmę ZK-140.', 'Odsłuchuję nagranie.', 'I examine the reel-to-reel tape.',
    ] },
  ];
  test.each(cases)('$slug follows its own action and scene even when retrieval omitted it', async ({slug, location, actions}) => {
    const payload = await edition();
    const id = `prabuty.media.${slug}`;
    for (const playerMessage of actions) {
      const result = presentHandoutsForTurn('Narracja bez znaczników.', [], payload, {playerMessage, location});
      expect(result.handouts).toEqual([id]);
      expect(result.content).toBe(`Narracja bez znaczników.\n\n[HANDOUT:${id}]`);
      expect(result.content).not.toContain('EKWIPUNEK');
    }
  });
  test.each(cases)('$slug cannot bypass the exact scene or payload authority', async ({slug, actions}) => {
    const payload = await edition();
    const id = `prabuty.media.${slug}`;
    for (const location of ['OFF_GRAPH', 'loc-prabuty-krypta', 'unknown']) {
      expect(presentHandoutsForTurn(`[HANDOUT:${id}]`, [id], payload, {playerMessage: actions[0], location}).handouts).toEqual([]);
    }
    const untrusted = JSON.parse(JSON.stringify(payload));
    expect(presentHandoutsForTurn('', [], untrusted, {playerMessage: actions[0], location: 'loc-msw-warszawa'}).handouts).toEqual([]);
  });
  test.each([
    'Czy w teczce jest raport?', 'Nie otwieram teczki KLIN.', 'Jeśli będzie okazja, otwieram teczkę KLIN.',
    'Helena mówi: „Czytam raport SB”.', 'I do not read the KLIN dossier.',
    'I wonder whether I should examine the tape.', 'Oglądam drzwi. Taśmę zostawiam.',
    'Czytam raport SB. Nie oglądam taśmy.',
  ])('never treats unrelated mentions or non-actions as tape discovery: %s', async playerMessage => {
    const payload = await edition();
    const audio = 'prabuty.media.audio-sb-wiretap-elblag';
    expect(presentHandoutsForTurn(`[HANDOUT:${audio}]`, [audio], payload, {playerMessage, location:'loc-msw-warszawa'}).handouts).not.toContain(audio);
  });
  test('deduplicates an exact or alias narrator tag against the deterministic result', async () => {
    const payload=await edition(), id='prabuty.media.clue-sb-file-klin';
    const result=presentHandoutsForTurn('[HANDOUT:clue-sb-file-klin][HANDOUT:'+id+']', [], payload, {
      playerMessage:'Czytam raport SB.',location:'loc-msw-warszawa',
    });
    expect(result).toEqual({content:`[HANDOUT:${id}]`,handouts:[id]});
  });
});

test.each([
  ['Otwieram ją.', 'Helena podsuwa zamkniętą teczkę.', 'prabuty.media.clue-photo-prabuty-1947', 'loc-warszawa-redakcja'],
  ['I open it.', 'A closed folder rests on the desk.', 'prabuty.media.clue-photo-prabuty-1947', 'loc-warszawa-redakcja'],
  ['Czytam go.', 'Na biurku leży raport SB.', 'prabuty.media.clue-sb-file-klin', 'loc-msw-warszawa'],
  ['Oglądam ją.', 'Przed tobą leży taśma ZK-140.', 'prabuty.media.audio-sb-wiretap-elblag', 'loc-msw-warszawa'],
])('resolves a pronoun from the immediately preceding turn: %s', async (playerMessage, previousAssistantMessage, id, location) => {
  const payload=await edition();
  expect(presentHandoutsForTurn('Opis bez tagu.',[],payload,{playerMessage,previousAssistantMessage,location}).handouts).toEqual([id]);
});

test.each([
  ['Otwieram ją.', 'Helena opowiada o podróży.'],
  ['Otwieram ją.', '[HANDOUT:clue-photo-prabuty-1947]'],
  ['Czekam. Jeśli Helena pozwoli, otwieram teczkę.', 'Na biurku leży teczka.'],
  ['Helena mówi: otwórz teczkę.', 'Na biurku leży teczka.'],
  ['Pokaż co wiesz o tej teczce.', 'Na biurku leży teczka.'],
])('cannot fabricate pronoun access or promote a conditional: %s', async (playerMessage,previousAssistantMessage) => {
  const payload=await edition();
  expect(presentHandoutsForTurn('',[],payload,{playerMessage,previousAssistantMessage,location:'loc-warszawa-redakcja'}).handouts).toEqual([]);
});

test('continuing the same interrupted turn does not append a second copy; an explicit new viewing can', async()=>{
  const payload=await edition(), id='prabuty.media.clue-photo-prabuty-1947';
  const context={playerMessage:'Otwieram teczkę.',location:'loc-warszawa-redakcja',knownHandoutIds:[id]};
  expect(presentHandoutsForTurn('Dalszy opis.',[],payload,{...context,alreadyPresentedHandoutIds:[id]})).toEqual({content:'Dalszy opis.',handouts:[]});
  expect(presentHandoutsForTurn('Ponowny podgląd.',[],payload,{...context,playerMessage:'Oglądam fotografię.'}).handouts).toEqual([id]);
});

test.each([
  ['Czytam raport o nagraniu.', undefined, ['prabuty.media.clue-sb-file-klin']],
  ['Oglądam drzwi obok taśmy.', undefined, []],
  ['Otwieram ją.', 'Na stole leży teczka KLIN oraz taśma magnetofonowa.', []],
  ['I examine the door next to the tape.', undefined, []],
  ['I read the report about the recording.', undefined, ['prabuty.media.clue-sb-file-klin']],
] as const)('targets the direct object and refuses an ambiguous pronoun: %s',async(playerMessage,previousAssistantMessage,expected)=>{
 const payload=await edition();
 expect(presentHandoutsForTurn('',[],payload,{playerMessage,previousAssistantMessage,location:'loc-msw-warszawa'}).handouts).toEqual(expected);
});

test('restores suppression and the original antecedent across two truncated continuations',async()=>{
 const {handoutContinuationContext}=await import('./local-handouts');
 const payload=await edition(),id='prabuty.media.clue-photo-prabuty-1947';
 const binding={adventureId:payload.adventure_id,editionFingerprint:payload.edition_fingerprint};
 const history=[
  {id:'intro',role:'assistant' as const,content:'Na stole jest teczka.',timestamp:new Date(0)},
  {id:'user',role:'user' as const,content:'Otwieram ją.',timestamp:new Date(0)},
  {id:'part1',role:'assistant' as const,content:'Część pierwsza.',timestamp:new Date(0),dossierHandoutBinding:binding,dossierHandoutRecordIds:[id],finishReason:'MAX_TOKENS'},
  {id:'part2',role:'assistant' as const,content:'Część druga.',timestamp:new Date(0),dossierHandoutBinding:binding,dossierHandoutRecordIds:[],finishReason:'MAX_TOKENS'},
 ];
 const restored=JSON.parse(JSON.stringify(history));
 const context=handoutContinuationContext(restored,'part2',binding);
 expect(context.previousAssistantMessage).toBe('Na stole jest teczka.');
 expect(context.alreadyPresentedHandoutIds).toEqual([id]);
 expect(presentHandoutsForTurn('Część trzecia.',[],payload,{...context,playerMessage:'Otwieram ją.',location:'loc-warszawa-redakcja'})).toEqual({content:'Część trzecia.',handouts:[]});
 expect(handoutContinuationContext(restored,'part2',{...binding,editionFingerprint:'sha256:'+'f'.repeat(64)}).alreadyPresentedHandoutIds).toEqual([]);
});


describe('mixed turn action and question', () => {
  const photo = 'prabuty.media.clue-photo-prabuty-1947';
  test.each([
    'Oglądam to zdjęcie. \n\nA Pan, Panie Dotkorze... co Pan o tym sądzi?',
    'Co Pan o tym sądzi? Oglądam to zdjęcie.',
    'Oglądam fotografię. Co Pan o tym sądzi?',
    'Oglądam fotografię.\nCzy dobrze widzę?',
    'I examine this photograph. Doctor, what do you think?',
    'Doctor, what do you think? I examine the photograph.',
  ])('mixed turn shows one photograph without a narrator tag: %s', async playerMessage => {
    const payload = await edition();
    const result = presentHandoutsForTurn('Opis fotografii.', [], payload, {
      playerMessage, location: 'loc-warszawa-redakcja',
    });
    expect(result.handouts).toEqual([photo]);
    expect(result.content).toBe(`Opis fotografii.\n\n[HANDOUT:${photo}]`);
    expect(presentHandoutsForTurn('Opis fotografii.', [], payload, {
      playerMessage, location: 'OFF_GRAPH',
    }).handouts).toEqual([]);
  });
  test.each([
    'Oglądam fotografię?',
    'Co Pan sądzi? Oglądam fotografię?',
    'Czy oglądam fotografię? Czekam.',
    'Czy mam powiedzieć: „Oglądam fotografię”?',
    'Co Pan sądzi? Nie oglądam fotografii.',
    'Co Pan sądzi? Jeśli Pan pozwoli, oglądam fotografię.',
    'Co Pan sądzi? Helena mówi: oglądam fotografię.',
    'Jeśli Pan pozwoli,\noglądam fotografię. Co Pan o tym sądzi?',
    'Helena mówi:\noglądam fotografię. Co Pan o tym sądzi?',
    'Do I examine the photograph? I wait.',
    'What do you think? I do not examine the photograph.',
    'What do you think? If you allow it, I examine the photograph.',
    'What do you think? Helena says: "I examine the photograph."',
  ])('mixed turn never treats a question or indirect action as discovery: %s', async playerMessage => {
    expect(presentHandoutsForTurn('[HANDOUT:clue-photo-prabuty-1947]', [photo], await edition(), {
      playerMessage, location: 'loc-warszawa-redakcja',
    }).handouts).toEqual([]);
  });
});
