import { appendJournalToParty } from './apply-journal-tags';
import { buildPublicJournal, markJournalCardRead } from './public-journal';
import { PREDEFINED_CHARACTERS } from '@/lib/immersion/predefined-characters';
import type { Character } from '@/lib/types';

const chapter = {
  playthroughId: 'run',
  campaignDefinitionId: 'campaign',
  adventureId: 'case',
  sessionId: 'session',
  sessionNumber: 1,
};
const person = (id = 'one'): Character => ({
  ...PREDEFINED_CHARACTERS[0],
  id,
  journal: [],
  equipment: [],
  sceneCards: [],
  chronicleSession: chapter,
  investigatorDossier: { clues: [], npcs: [], locations: [], notes: [] },
});
const turn = (party: Character[], text: string, id: string) =>
  appendJournalToParty(party, party[0], text, id).characters;
const view = (characters: Character[]) =>
  buildPublicJournal({ characters, chapter, locale: 'pl' });

it('projects only saved sealed scenes in the current run, without next-step advice or duplicate party copies', () => {
  const pc = person();
  pc.sceneCards = [
    {
      id: 'closed',
      sceneNumber: 1,
      title: 'Archiwum',
      location: 'Archiwum',
      timestamp: '2026-11-01',
      isSealed: true,
      people: ['Dozorca'],
      findings: [],
      keyTakeaways: [],
      chronicleChapter: chapter,
      chronicleSummaryByLocale: {
        pl: 'Dozorca twierdził, że list zaginął.',
        en: 'The caretaker claimed the letter was missing.',
      },
      nextStep: 'PRIVATE_ADVICE',
    },
  ];
  const result = view([pc, { ...pc, id: 'two' }]);
  expect(result.chronicle).toHaveLength(1);
  expect(result.chronicle?.[0].summary).toBe(
    'Dozorca twierdził, że list zaginął.'
  );
  expect(JSON.stringify(result.chronicle)).not.toContain('PRIVATE_ADVICE');
  expect(
    view([
      {
        ...pc,
        sceneCards: pc.sceneCards.map((scene) => ({
          ...scene,
          chronicleChapter: { ...chapter, playthroughId: 'other-run' },
        })),
      },
    ]).chronicle
  ).toEqual([]);
});

it('shares source-backed knowledge, keeps contradictory accounts and deduplicates a repeated turn', () => {
  let party = turn(
    [person(), person('two')],
    'Dozorca twierdzi, że brama była zamknięta. [JOURNAL:clue:Brama|witness:Dozorca]Dozorca twierdzi, że brama była zamknięta. | źródło:zeznanie[/JOURNAL]',
    'a'
  );
  party = turn(
    party,
    'Sąsiadka twierdzi, że brama była otwarta. [JOURNAL:clue:Brama|witness:Sąsiadka]Sąsiadka twierdzi, że brama była otwarta. | źródło:zeznanie[/JOURNAL]',
    'b'
  );
  party = turn(
    party,
    'Sąsiadka twierdzi, że brama była otwarta. [JOURNAL:clue:Brama|witness:Sąsiadka]Sąsiadka twierdzi, że brama była otwarta. | źródło:zeznanie[/JOURNAL]',
    'b'
  );
  const card = view(party).cards.find((card) => card.kind === 'finding')!;
  expect(card.paragraphs.map((p) => p.text)).toEqual([
    'Dozorca twierdzi, że brama była zamknięta.',
    'Sąsiadka twierdzi, że brama była otwarta.',
  ]);
  expect(card.sources.map((source) => source.messageId)).toEqual(['a', 'b']);
  expect(card.sources[0].excerpt).not.toMatch(/JOURNAL|źródło:/);
  expect(
    view(party).cards.find((card) => card.title === 'Dozorca')?.sources[0]
      .excerpt
  ).toBe('Dozorca twierdzi, że brama była zamknięta.');
  expect(view([...party].reverse()).cards).toEqual(view(party).cards);
});

it('records mentioned people and places without leaking prepared portraits or keeper secrets', () => {
  const input = person();
  input.investigatorDossier!.npcs.push({
    id: 'prepared',
    name: 'Dozorca',
    avatarUrl: '/hidden.webp',
    relationshipStatus: 'unknown',
    secret: 'SECRET',
  });
  const party = turn(
    [input],
    'Dowiadujesz się o dozorcy i starym młynie. [JOURNAL:npc:Dozorca]Wspomniany przez sąsiadkę. | knowledge:mentioned[/JOURNAL][JOURNAL:location:Stary młyn]Adres poznany z relacji. | knowledge:mentioned[/JOURNAL][GM_THOUGHTS][JOURNAL:clue:SECRET]SECRET[/JOURNAL][/GM_THOUGHTS]',
    'a'
  );
  expect(view(party).cards.map((card) => card.title)).toEqual(
    expect.arrayContaining(['Dozorca', 'Stary młyn'])
  );
  expect(view(party).cards.every((card) => !card.imageUrl)).toBe(true);
  expect(JSON.stringify(view(party))).not.toMatch(/SECRET|hidden.webp/);
  expect(
    view(party).cards.find((card) => card.kind === 'place')?.mentioned
  ).toBe(true);
});

it('retains different witnesses within a single accepted response and stores only their exact visible excerpts', () => {
  const text =
    'Pada deszcz. Dozorca twierdzi, że brama była zamknięta. Sąsiadka widziała otwartą bramę. ' +
    '[JOURNAL:clue:Brama|witness:Dozorca]Dozorca twierdzi, że brama była zamknięta. | źródło:zeznanie[/JOURNAL]' +
    '[JOURNAL:clue:Brama|witness:Sąsiadka]Sąsiadka widziała otwartą bramę. | źródło:zeznanie[/JOURNAL]';
  const card = view(turn([person()], text, 'a')).cards.find(
    (card) => card.kind === 'finding'
  )!;
  expect(card.paragraphs).toHaveLength(2);
  expect(card.sources.map((source) => source.excerpt)).toEqual([
    'Dozorca twierdzi, że brama była zamknięta.',
    'Sąsiadka widziała otwartą bramę.',
  ]);
});

it('validates a source quote against visible text and never promotes a tag body into an invented quotation', () => {
  const party = turn(
    [person()],
    '„Byłem w domu” - mówi dozorca. [JOURNAL:clue:Alibi|source_quote:„Byłem w domu” - mówi dozorca.]Dozorca twierdzi, że był w domu.[/JOURNAL]' +
      '[JOURNAL:clue:Brak źródła|source_quote:INVENTED]Informacja z samego tagu.[/JOURNAL]',
    'a'
  );
  expect(
    view(party).cards.find((card) => card.title === 'Alibi')?.sources[0].excerpt
  ).toBe('„Byłem w domu” - mówi dozorca.');
  expect(
    view(party).cards.find((card) => card.title === 'Brak źródła')?.sources[0]
      .excerpt
  ).toBe('');
});

it('isolates active and sealed scenes belonging to a different edition', () => {
  const input = person();
  const binding = { adventureId: 'case', editionFingerprint: 'a' };
  input.activeScene = {
    sceneNumber: 1,
    location: 'PRIVATE_LOCATION',
    people: [],
    findings: [],
    notes: [],
    startedAt: new Date().toISOString(),
    chronicleChapter: chapter,
    dossierBinding: binding,
  };
  input.sceneCards = [
    {
      ...input.activeScene,
      id: 'sealed',
      title: 'PRIVATE_TITLE',
      timestamp: new Date().toISOString(),
      keyTakeaways: [],
      isSealed: true,
      chronicleSummaryByLocale: { pl: 'PRIVATE_SUMMARY' },
    },
  ];
  const model = buildPublicJournal({
    characters: [input],
    chapter,
    binding: { ...binding, editionFingerprint: 'b' },
    locale: 'pl',
  });
  expect(model.scene).toBeUndefined();
  expect(JSON.stringify(model)).not.toMatch(/PRIVATE/);
  const otherBinding = { ...binding, editionFingerprint: 'b' };
  const next = appendJournalToParty(
    [input],
    input,
    'The letter is signed. [JOURNAL:clue:Signature]The letter is signed.[/JOURNAL]',
    'other-edition',
    undefined,
    [],
    { binding: otherBinding }
  );
  expect(
    JSON.stringify(
      buildPublicJournal({
        characters: next.characters,
        chapter,
        binding: otherBinding,
        locale: 'pl',
      })
    )
  ).not.toMatch(/PRIVATE/);
});

it('keeps the latest shared location when another investigator has an older local scene', () => {
  jest.useFakeTimers();
  try {
    jest.setSystemTime(1792836000000);
    let party = turn(
      [person(), person('two')],
      'House. [LOCATION:House:We enter the house.]',
      'house-a'
    );
    jest.advanceTimersByTime(1000);
    party = appendJournalToParty(
      party,
      party[1],
      'House. [LOCATION:House:We enter the house.]',
      'house-b'
    ).characters;
    jest.advanceTimersByTime(1000);
    party = turn(
      party,
      'Port. [LOCATION:Port:We arrive at the port.]',
      'port-a'
    );
    jest.advanceTimersByTime(1000);
    party = appendJournalToParty(
      party,
      party[1],
      'The ship has left. [JOURNAL:clue:Ship]The ship has left.[/JOURNAL]',
      'port-b'
    ).characters;
    const model = view(party);
    expect(model.scene?.location).toBe('Port');
    expect(
      model.cards.find((card) => card.title === 'Ship')?.relatedIds
    ).toContain('place:port');
  } finally {
    jest.useRealTimers();
  }
});

it('separates event dates from discovery order and isolates playthroughs', () => {
  const party = turn(
    [person()],
    'Czytasz o dawnym pożarze. [JOURNAL:event:Pożar|event_date:około 1900]Gazeta opisuje pożar młyna.[/JOURNAL]',
    'a'
  );
  const card = view(party).cards.find((card) => card.kind === 'event')!;
  expect(card.occurredAt).toBe('około 1900');
  expect(card.sources[0].messageId).toBe('a');
  expect(
    buildPublicJournal({
      characters: party,
      chapter: { ...chapter, playthroughId: 'other' },
      locale: 'pl',
    }).cards
  ).toEqual([]);
});

it('persists read versions and marks only a genuine addition as updated', () => {
  let party = turn(
    [person()],
    'Brama jest zamknięta. [JOURNAL:clue:Brama]Brama jest zamknięta.[/JOURNAL]',
    'a'
  );
  const first = view(party).cards.find((card) => card.kind === 'finding')!;
  expect(first.unread).toBe('new');
  party[0] = markJournalCardRead(party[0], view(party).scopeKey, first);
  party = JSON.parse(JSON.stringify(party));
  expect(
    view(party).cards.find((card) => card.id === first.id)?.unread
  ).toBeUndefined();
  party = turn(
    party,
    'Brama ma wyłamany zamek. [JOURNAL:clue:Brama]Brama ma wyłamany zamek.[/JOURNAL]',
    'b'
  );
  expect(view(party).cards.find((card) => card.id === first.id)?.unread).toBe(
    'updated'
  );
});

it('keeps an observed material after messages and inventory disappear, with strict edition binding', () => {
  const binding = { adventureId: 'case', editionFingerprint: 'edition' };
  const result = appendJournalToParty(
    [person()],
    person(),
    'Oglądasz fotografię.',
    'a',
    undefined,
    [],
    { binding, handoutRecordIds: ['photo'] }
  );
  const saved: Character[] = JSON.parse(JSON.stringify(result.characters));
  const model = buildPublicJournal({
    characters: saved,
    chapter,
    binding,
    locale: 'pl',
  });
  expect(model.cards.filter((card) => card.kind === 'material')).toHaveLength(
    1
  );
  expect(
    model.cards.find((card) => card.kind === 'material')?.material?.recordId
  ).toBe('photo');
  expect(
    buildPublicJournal({
      characters: saved,
      chapter,
      binding: { ...binding, editionFingerprint: 'other' },
      locale: 'pl',
    }).cards
  ).toEqual([]);
  expect(saved[0].equipment).toEqual([]);
});

it('links an earlier shared original when another investigator records a new finding', () => {
  const binding = { adventureId: 'case', editionFingerprint: 'edition' };
  let party = appendJournalToParty(
    [person(), person('two')],
    person(),
    'We see a photograph.',
    'a',
    undefined,
    [],
    { binding, handoutRecordIds: ['photo'] }
  ).characters;
  party = appendJournalToParty(
    party,
    party[1],
    'There is a scratch. [JOURNAL:clue:Scratch|source_material_id:photo]There is a scratch. | źródło:handout[/JOURNAL]',
    'b',
    undefined,
    [],
    { binding }
  ).characters;
  const model = buildPublicJournal({
    characters: party,
    chapter,
    binding,
    locale: 'en',
  });
  const finding = model.cards.find((card) => card.title === 'Scratch')!;
  expect(finding.sources[0].materialId).toBe('photo');
  expect(finding.relatedIds).toContain('material:photo');
  expect(model.cards.filter((card) => card.kind === 'material')).toHaveLength(
    1
  );
});

it('enriches a previously unavailable source with a later verified excerpt without repeating the paragraph', () => {
  let party = turn(
    [person()],
    '[JOURNAL:clue:Alibi|witness:Dozorca]Dozorca był w domu.[/JOURNAL]',
    'a'
  );
  const first = view(party).cards.find((card) => card.kind === 'finding')!;
  party[0] = markJournalCardRead(party[0], view(party).scopeKey, first);
  party = turn(
    party,
    '„Byłem w domu” - mówi dozorca. [JOURNAL:clue:Alibi|witness:Dozorca|source_quote:„Byłem w domu” - mówi dozorca.]Dozorca był w domu.[/JOURNAL]',
    'b'
  );
  const card = view(party).cards.find((card) => card.kind === 'finding')!;
  expect(card.paragraphs).toHaveLength(1);
  expect(card.sources.map((source) => source.excerpt)).toEqual([
    '',
    '„Byłem w domu” - mówi dozorca.',
  ]);
  expect(card.sources[card.paragraphs[0].sourceIndex].messageId).toBe('b');
  expect(card.unread).toBe('updated');
});

it('renders canonical Prabuty place labels while preserving saved identity',()=>{
 const scope={...chapter,adventureId:'cien-nad-prabutami'};
 const pc=person();pc.chronicleSession=scope;
 const party=appendJournalToParty([pc],pc,'Jesteś w redakcji. [LOKACJA:loc-warszawa-redakcja]','opening',undefined,[],{scope}).characters;
 const model=buildPublicJournal({characters:party,chapter:scope,locale:'pl'});
 const place=model.cards.find(card=>card.kind==='place')!;
 expect(place.title).toContain('Sygnałów Nieznanego');
 expect(place.id).toBe('place:loc warszawa redakcja');
 expect(model.scene?.location).toBe('loc-warszawa-redakcja');
 expect(model.scene?.title).toContain('Sygnałów Nieznanego');
});


it('stages updated witnesses and clue relations without mutating the accepted party', () => {
  const opening = turn([person()],
    'Helena podaje teczkę. [JOURNAL:npc:Helena Krawczyk]Helena podaje teczkę.[/JOURNAL][LOKACJA: Redakcja | Gabinet Heleny]', 'opening');
  const accepted = JSON.stringify(opening);
  const next = turn(opening,
    'Helena patrzy na twój ruch. [JOURNAL:npc:Helena Krawczyk]Helena patrzy na twój ruch.[/JOURNAL]' +
    '[JOURNAL:clue:Fotografia|witness:Helena Krawczyk]Na odwrocie jest dopisek. | źródło:zeznanie[/JOURNAL]' +
    '[LOKACJA: Redakcja | Gabinet Heleny]', 'photo');
  expect(JSON.stringify(opening)).toBe(accepted);
  expect(next[0].investigatorDossier!.npcs.find(npc => npc.name === 'Helena Krawczyk')!.keyInformation)
    .toContain('Helena patrzy na twój ruch.');
  expect(next[0].investigatorDossier!.clues).toHaveLength(1);
});


it.each(['pl', 'en'] as const)('enriches only met Prabuty cards from a saved public history (%s)', locale => {
  const scope = {...chapter, adventureId: 'cien-nad-prabutami'};
  const pc = person(); pc.chronicleSession = scope;
  const party = appendJournalToParty([pc], pc,
    'Helena podaje teczkę. [JOURNAL:npc:Helena Krawczyk]Helena podaje teczkę.[/JOURNAL]' +
    '[JOURNAL:npc:Generał Edward Majewski|knowledge:mentioned]Wspomniany w rozmowie.[/JOURNAL]' +
    '[LOKACJA:loc-warszawa-redakcja]', 'opening', undefined, [], {scope}).characters;
  const saved = JSON.parse(JSON.stringify(party)) as Character[];
  const original = JSON.stringify(saved);
  const model = buildPublicJournal({characters: saved, chapter: scope, locale});
  const helena = model.cards.find(card => card.title === 'Helena Krawczyk')!;
  expect(helena.imageUrl).toBe('/adventure-packs/cien-nad-prabutami/npc-helena-krawczyk.png');
  expect(helena).toHaveProperty('publicDescription', locale === 'pl'
    ? "Redaktorka programu „Sygnały Nieznanego” w Telewizji Polskiej."
    : 'Editor of the Polish Television programme “Signals of the Unknown”.');
  expect(helena.paragraphs[0].text).toBe('Helena podaje teczkę.');
  expect(helena.id).toBe('person:helena krawczyk');
  const place = model.cards.find(card => card.kind === 'place')!;
  expect(place).toHaveProperty('publicDescription');
  expect(place.imageUrl).toMatch(/opening|warszawa/);
  expect(model.cards.find(card => card.title.includes('Majewski'))?.imageUrl).toBeUndefined();
  expect(model.cards.find(card => card.title.includes('Majewski'))).not.toHaveProperty('publicDescription');
  expect(model.cards).toHaveLength(3);
  expect(JSON.stringify(model)).not.toMatch(/keeperSecret|szantaż|tajny program|KLIN/);
  expect(JSON.stringify(saved)).toBe(original);
});


it('restores a legacy truncated quotation only from its own accepted message, without changing the save', () => {
  const scope = {...chapter, adventureId: 'cien-nad-prabutami'};
  const pc = person(); pc.chronicleSession = scope;
  const prefix = 'Helena Krawczyk: „Masz raport dr.';
  const complete = prefix + ' Skrzyńskiego. Przeczytaj go uważnie.”';
  const party = appendJournalToParty([pc], pc, prefix + ' [JOURNAL:npc:Helena Krawczyk]' + prefix + '[/JOURNAL]', 'legacy', undefined, [], {scope}).characters;
  const original = JSON.stringify(party);
  const model = buildPublicJournal({characters: party, chapter: scope, locale: 'pl', messages: [{id: 'legacy', role: 'assistant', timestamp: new Date(), content: complete}]});
  const helena = model.cards.find(card => card.kind === 'person')!;
  expect(helena.paragraphs[0].text).toBe(complete);
  expect(helena.sources[0]).toMatchObject({messageId: 'legacy', excerpt: complete, witness: 'Helena Krawczyk'});
  expect(JSON.stringify(party)).toBe(original);
  const unverified = buildPublicJournal({characters: party, chapter: scope, locale: 'pl', messages: [{id: 'other', role: 'assistant', timestamp: new Date(), content: complete}]});
  expect(unverified.cards.find(card => card.kind === 'person')?.paragraphs[0].text).toBe(prefix);
  const foreign = buildPublicJournal({characters: party, chapter: scope, locale: 'pl', messages: [{id: 'legacy', role: 'assistant', timestamp: new Date(), content: complete,
    dossierHandoutBinding: {adventureId: scope.adventureId, editionFingerprint: 'foreign'}}]});
  expect(foreign.cards.find(card => card.kind === 'person')?.paragraphs[0].text).toBe(prefix);
});


it.each([
  '[MYŚLI_MG: Helena Krawczyk: „Masz raport dr. UKRYTY SEKRET TESTOWY”.]',
  '[GM_THOUGHTS]Helena Krawczyk: „Masz raport dr. UKRYTY SEKRET TESTOWY”.[/GM_THOUGHTS]',
])('repairs a saved quotation only from visible source text after private comments: %s', privateText => {
  const scope = {...chapter, adventureId: 'cien-nad-prabutami'};
  const pc = person(); pc.chronicleSession = scope;
  const prefix = 'Helena Krawczyk: „Masz raport dr.';
  const complete = prefix + ' Skrzyńskiego. Przeczytaj go uważnie.”';
  const party = appendJournalToParty([pc], pc, prefix + ' [JOURNAL:npc:Helena Krawczyk]' + prefix + '[/JOURNAL]', 'legacy-private', undefined, [], {scope}).characters;
  const original = JSON.stringify(party);
  const model = buildPublicJournal({characters: party, chapter: scope, locale: 'pl', messages: [{
    id: 'legacy-private', role: 'assistant', timestamp: new Date(), content: privateText + '\n' + complete,
  }]});
  const helena = model.cards.find(card => card.kind === 'person')!;
  expect(helena.paragraphs[0].text).toBe(complete);
  expect(helena.sources[0]).toMatchObject({excerpt: complete, witness: 'Helena Krawczyk'});
  expect(JSON.stringify(model)).not.toContain('UKRYTY SEKRET TESTOWY');
  expect(JSON.stringify(party)).toBe(original);
});
