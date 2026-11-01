import type { AdventureGraph } from '../types';
import {
  escapeXml,
  type DossierLocale,
  type PreparedDossier,
} from './prepared-dossier';
import { getHauntingHandouts, phrase as tr } from './starter-handouts';
import { hauntingActors, hauntingScenes } from './starter-scenes';
import { hauntingAudio } from './starter-audio';
export { getHauntingHandouts } from './starter-handouts';

const source = {
  url: 'https://static.blackmonk.pl/file/ZC_Starter.pdf',
  sha256: '2f8dd50ea4a6a3c7a35dc1998d7caeaae00669c694672cee0426eb407c4b50ad',
  printedPageOffset: 2,
};

export function getHauntingDossier(l: DossierLocale): PreparedDossier {
  const rule = (id: string, sourcePages: number[], pl: string, en: string) => ({
    id,
    sourcePages,
    text: tr(l, pl, en),
  });
  return {
    schemaVersion: 1,
    adventureId: 'nawiedzony-dom',
    editionId: 'blackmonk-2019-v1.3-prepared-1',
    locale: l,
    approval: 'pending',
    source,
    handouts: getHauntingHandouts(l),
    actors: hauntingActors(l),
    scenes: hauntingScenes(l),
    audio: hauntingAudio(l),
    rooms: hauntingRooms(l),
    rules: [
      rule(
        'research',
        [17, 18],
        'Biblioteka: kolejno Pomoce 3-6, jeden sukces Korzystania z Bibliotek na pomoc. Próba zajmuje pół dnia. Porażka nie kończy badań. Po ponad dniu Knott pyta o postępy.',
        'Library: Aids 3-6 in order, one successful Library Use roll per aid. Each attempt takes half a day. Failure does not end research. After more than a day, Knott asks about progress.'
      ),
      rule(
        'liber-ivonis',
        [20, 21],
        'Pod szafką w kaplicy: dziennik kultu i łaciński Liber Ivonis. Łacina co najmniej 50 lub udany test. Lektura co najmniej 3h: Mity +2, maksimum SAN -2.',
        'Beneath the chapel cabinet: cult diary and Latin Liber Ivonis. Latin at least 50 or a successful roll. At least 3h study: Mythos +2, maximum SAN -2.'
      ),
      rule(
        'journal-study',
        [21],
        'Trzy angielskie tomy na parterze. Dwa dni lektury: Mity +4, strata SAN 1d4. Nauka Przyzwania/Wiązania Otwierającego Drogi: 2d6 tygodni. Skutki lektury rozstrzygaj osobno od znalezienia.',
        'Three English volumes on the ground floor. Two days of study: Mythos +4, SAN loss 1d4. Learning Call/Bind Dimensional Shambler: 2d6 weeks. Study effects are separate from discovery.'
      ),
      rule(
        'bed',
        [22, 23],
        'Łóżko: po przyciągnięciu Badacza ku oknu Spostrzegawczość daje możliwość Uniku. Trafienie 1d6+2 PW; świadkowie SAN 1/1d4. Wyboru celu dokonaj według bliskości/Szczęścia, bez powtarzania skutku.',
        'Bed: after luring an investigator towards the window, Spot Hidden allows Dodge. A hit causes 1d6+2 HP; witnesses SAN 1/1d4. Choose a target by proximity/Luck; do not repeat consequences.'
      ),
      rule(
        'stairs',
        [23],
        'Jeden rzut przeciw ZR lub Wspinaczce; sukces dowolnego progu wystarcza. Pierwsza porażka ostrzega; porażka forsowana: 1d6 PW. Pomoc z dołu daje kość premiową; wspólna porażka zagraża obu osobom.',
        'One roll against DEX or Climb; either threshold succeeding is enough. First failure warns; failed push causes 1d6 HP. Help from below gives a bonus die; an assisted failure endangers both.'
      ),
      rule(
        'knife',
        [23, 24, 25, 29],
        'Odkrycie: Spostrzegawczość; porażka forsowana: 1d4+2 PW bez rzutu ataku. Latający nóż: 1 atak MOC90/rundę, koszt 1PM i akcja Corbitta. Zwykłe obrażenia 1d4+2; ekstremalne 6+1d4+2. Unik wygrywa remis poziomów. Nieświadomy celu: Spostrzegawczość; porażka daje atakowi premię i wyklucza Unik (źródłowy szczególny wyjątek pudła tylko przy100 wymaga osobnego odbioru). SAN świadków 1/1d4.',
        'Discovery: Spot Hidden; failed push causes 1d4+2 HP without attack roll. Flying knife: one POW90 attack/round, costing 1MP and Corbitt’s action. Damage 1d4+2; extreme 6+1d4+2. Dodge wins tied success levels. Unaware target: Spot Hidden; failure gives attack bonus and denies Dodge (source-specific miss-only-on100 exception needs separate review). Witness SAN 1/1d4.'
      ),
      rule(
        'knife-capture',
        [24, 25],
        'Przechwycenie: Bijatyka przeciw MOC90, przy remisie inicjator wygrywa; nie porównuj Budowy. Utrzymanie: SIŁA przeciw MOC90; próba Corbitta kosztuje 1PM. Osłona z pokrywy kosza daje premię do Uniku.',
        'Capture: Brawl versus POW90; initiator wins ties; ignore Build. Holding: STR versus POW90; Corbitt’s attempt costs 1MP. A bin-lid shield gives a bonus to Dodge.'
      ),
      rule(
        'rats',
        [25],
        'Stado: 10 szczurów. Śmierć jednego wystarcza do odwrotu; sukces ataku zabija 1-2. SIŁ35 KON55 BC35 ZR70 MOC50 PW9, Ruch9, Budowa-1, MO-1; Bijatyka40/20/8, Unik42/21/8, ugryzienie1d3, przytłoczenie2d6 z premią. Napis na ścianie jest oczywisty.',
        'Swarm: ten rats. Killing one disperses them; successful attack kills 1-2. STR35 CON55 SIZ35 DEX70 POW50 HP9, MOV9, Build-1, DB-1; Brawl40/20/8, Dodge42/21/8, bite1d3, overwhelm2d6 with bonus. Wall inscription is obvious.'
      ),
      rule(
        'corbitt',
        [26, 28, 29],
        'Corbitt PW16/PM18, regeneracja1PM/h, nie leczy PW i nie traci przytomności. Animacja ciała:2PM/5rund. Widok:SAN1/1d8. Przy stracie co najmniej5SAN: udany INT wywołuje napad obłędu. Własny nóż po trafieniu niszczy Corbitta niezależnie od ochrony; inne ataki muszą sprowadzić PW do0.',
        'Corbitt HP16/MP18, regains1MP/hour, cannot heal HP or become unconscious. Animate body:2MP/5rounds. Sight:SAN1/1d8. Loss of at least5SAN: successful INT causes a bout of madness. A hit with his own knife destroys him regardless of protection; other attacks must reduce HP to0.'
      ),
      rule(
        'flesh-ward',
        [28, 29],
        'Ochrona Ciała: 5 rund rzucania, 1PM za1d6 pochłaniania; karta przyjmuje2d6. Pula zmniejsza się od obrażeń, nadmiar odejmij od PW. Trwa do24h lub wyczerpania. Brak wzmacniania/ponowienia, dopóki działa.',
        'Flesh Ward: 5 rounds casting, 1MP per1d6 absorption; the card prescribes2d6. Damage depletes the pool; excess reduces HP. Lasts24h or until exhausted. No strengthening/recasting while active.'
      ),
      rule(
        'domination',
        [26, 29],
        'Dominacja:1PM, przeciwstawne MOC90/MOC celu, jedna osoba w domu; działanie1d6+1rund. Rzucenie zużywa akcję, w tej rundzie+50ZR. Rozkazy nie mogą nakazywać samobójstwa. Źródło różni się opisem czasu rzucania: zachowaj jawny konflikt do odbioru.',
        'Domination:1MP, opposed POW90/target POW, one person inside the house; effect1d6+1rounds. Casting consumes the action and grants+50DEX that round. Orders cannot command suicide. Source casting-time descriptions differ: retain the explicit conflict for review.'
      ),
      rule(
        'infection',
        [28],
        'Po trafieniu pazurami: Szczęście; porażka oznacza zadrapanie i następnego dnia majaczenie/test KON. Porażka KON:1d10 dni i trwała strata1d10KON; sukces:1d6 dni bez straty KON. Dalsze testy codziennie do wyzdrowienia/śmierci. Źródło dopuszcza złagodzenie trwałych następstw w udanym epilogu.',
        'After a claw hit: Luck; failure causes a scratch, followed next day by delirium/CON. Failed CON:1d10 days and permanent1d10CON loss; success:1d6 days without CON loss. Repeat daily until recovery/death. Source permits waiving lasting consequences in a successful epilogue.'
      ),
      rule(
        'madness-and-turns',
        [26, 27, 28],
        'Inicjatywa malejąco po ZR, gotowa broń palna+50. Kolejny atakujący otrzymuje premię przewagi liczebnej. Obłęd tymczasowy1d10h lub do poranka po opuszczeniu domu i śnie; napad1d10rund; Mity+5. Test rzeczywistości: sukces SAN kończy omam, porażka-1SAN i kolejny napad.',
        'Initiative descends by DEX; readied firearm+50. A subsequent attacker gains an outnumbering bonus. Temporary insanity1d10h or until morning after leaving and sleeping; bout1d10rounds; Mythos+5. Reality check: successful SAN ends hallucination, failure loses1SAN and causes another bout.'
      ),
      rule(
        'party-and-items',
        [15, 23, 24],
        'Solo i duet: odkrycia należą do drużyny, przedmiot ma jednego posiadacza. Znalezienie nie oznacza zabrania. Rozstrzygnięcie przechowuje osobę, test i skutek; ponowne pokazanie dokumentu nie powtarza nagrody.',
        'Solo and duet: discoveries belong to the party; a portable item has one owner. Discovery is not acquisition. A resolution identifies actor, test and effect; reopening a document never repeats a reward.'
      ),
    ],
    endings: [
      {
        id: 'success',
        sourcePages: [28],
        condition: tr(
          l,
          'Rozwiązana tajemnica i Corbitt zniszczony.',
          'Mystery solved and Corbitt destroyed.'
        ),
        consequence: tr(
          l,
          'Wynagrodzenie Knotta i premia; każda postać +1d6SAN. Rozstrzygnij osobno rany, obłęd i posiadane księgi.',
          'Knott’s payment and bonus; each investigator gains1d6SAN. Resolve wounds, insanity and retained books separately.'
        ),
      },
      {
        id: 'false-clearance',
        sourcePages: [28],
        condition: tr(
          l,
          'Corbitt żyje, a drużyna zgłasza dom jako bezpieczny.',
          'Corbitt survives and the party reports the house safe.'
        ),
        consequence: tr(
          l,
          'Knott nocuje w domu i ginie. Policja szuka Badaczy. Nie wywołuj tego epilogu po zwykłym odwrocie.',
          'Knott stays overnight and dies. Police seek the investigators. Do not trigger this ending for a simple retreat.'
        ),
      },
      {
        id: 'withdrawal',
        sourcePages: [28],
        condition: tr(
          l,
          'Drużyna wycofuje się bez fałszywego zapewnienia o bezpieczeństwie.',
          'The party withdraws without falsely declaring the house safe.'
        ),
        consequence: tr(
          l,
          'Zachowaj odkrycia i stan postaci. Sprawa pozostaje nierozwiązana; powrót jest możliwy. To jawna adaptacja obsługi przerwanej sesji.',
          'Keep discoveries and character state. The case remains unresolved and return is possible. This is an explicit adaptation for interrupted sessions.'
        ),
      },
      {
        id: 'defeat',
        sourcePages: [27, 28],
        condition: tr(
          l,
          'Brak postaci zdolnej kontynuować wskutek śmierci lub obłędu.',
          'No investigator can continue because of death or insanity.'
        ),
        consequence: tr(
          l,
          'Indywidualne epilogi według ustalonego stanu. Nie ogłaszaj zniszczenia Corbitta ani nie wypłacaj nagrody za sukces.',
          'Give individual epilogues from resolved state. Do not declare Corbitt destroyed or award success rewards.'
        ),
      },
    ],
    unresolved: [
      {
        id: 'domination-casting-time',
        sourcePages: [26, 29],
        description: tr(
          l,
          'Opis sceny podaje natychmiastowe rzucenie, karta zaklęcia jedną rundę. Wymaga jawnej decyzji odbioru mechaniki; nie ukrywaj różnicy.',
          'Scene prose says instantaneous casting; the spell card says one round. Requires an explicit mechanics review decision; do not conceal the difference.'
        ),
      },
    ],
  };
}

const legacyClue: Record<string, string> = {
  'clue-01-knott-keys': 'clue-knott-keys',
  'clue-02-boston-globe-1918': 'clue-globe-article-1918',
  'clue-03-land-registry-1852': 'clue-land-registry-1852',
  'clue-04-lawsuit-1853': 'clue-lawsuit-1853',
  'clue-05-obituary-1866': 'clue-obituary-1866',
  'clue-06-court-executor-record': 'clue-executor-record',
  'clue-07-police-raid-file': 'clue-police-raid-file',
  'clue-08-cult-symbol-sketch': 'clue-cult-symbol-sketch',
  'clue-09-corbitt-journal': 'clue-corbitt-journal',
};

export function getHauntingGraph(locale: DossierLocale): AdventureGraph {
  const d = getHauntingDossier(locale);
  const target: Record<string, string> = {
    'clue-knott-keys': 'node-corbitt-house',
    'clue-globe-article-1918': 'node-sanatorium',
    'clue-land-registry-1852': 'node-corbitt-house',
    'clue-lawsuit-1853': 'node-corbitt-house',
    'clue-obituary-1866': 'node-corbitt-basement',
    'clue-executor-record': 'node-chapel-ruins',
    'clue-police-raid-file': 'node-chapel-ruins',
    'clue-cult-symbol-sketch': 'node-corbitt-house',
    'clue-corbitt-journal': 'node-corbitt-house',
  };
  const clues: AdventureGraph['clues'] = d.handouts.map((h) => ({
    id: legacyClue[h.slug] || h.slug,
    name: h.title,
    description: h.textContent!,
    sourceType: h.slug.startsWith('item-')
      ? 'material'
      : h.sourceNumber === 9
        ? 'anomaly'
        : 'document',
    clueType: 'core',
    sourceNodeId: h.nodeId,
    targetNodeId: target[legacyClue[h.slug]] || h.nodeId,
  }));
  clues.push({
    id: 'clue-macario-testimony',
    name: tr(locale, 'Relacja Macariów', 'Macario testimony'),
    description: d.actors.find((a) => a.id === 'npc-vittorio-macario')!
      .knowledge,
    sourceType: 'testimony',
    clueType: 'core',
    sourceNodeId: 'node-sanatorium',
    targetNodeId: 'node-corbitt-basement',
  });
  return {
    nodes: d.scenes.map((s) => ({
      id: s.id,
      name: s.title,
      description: s.entry,
      type: s.id === 'node-corbitt-crypt' ? 'climax' : 'location',
      isClimax: s.id === 'node-corbitt-crypt',
      locationId: s.id.replace('node-', 'loc-'),
      npcIds: s.actorIds,
      leadInClueIds: clues
        .filter((c) => c.targetNodeId === s.id)
        .map((c) => c.id),
      leadOutClueIds: clues
        .filter((c) => c.sourceNodeId === s.id)
        .map((c) => c.id),
    })),
    locations: d.scenes.map((s) => ({
      id: s.id.replace('node-', 'loc-'),
      name: s.title,
      description: s.entry,
      atmosphere: s.atmosphere,
    })),
    npcs: d.actors.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      statsSummary: a.stats,
    })),
    clues,
    connections: d.scenes.flatMap((s) =>
      s.exits.map((toId) => ({
        fromId: s.id,
        toId,
        description: tr(
          locale,
          'Możliwa dalsza droga; gracz wybiera.',
          'Possible onward route; player chooses.'
        ),
      }))
    ),
  };
}

function hauntingRooms(l: DossierLocale): PreparedDossier['rooms'] {
  const rows: Array<[string, string, number, string, string]> = [
    [
      'G1',
      'node-corbitt-house',
      21,
      'Rupiecie, stary zbiornik i rower; zabita gwoździami szafka z trzema dziennikami.',
      'Clutter, an old tank and bicycle; a nailed cabinet holding three journals.',
    ],
    [
      'G2',
      'node-corbitt-house',
      22,
      'Stare meble przeznaczone na opał.',
      'Old furniture intended for firewood.',
    ],
    [
      'G3',
      'node-corbitt-house',
      22,
      'Odzież przeciwdeszczowa, parasole i węgiel. Boczne drzwi: trzy rygle i dwa zamki.',
      'Rainwear, umbrellas and coal. Side door: three bolts and two locks.',
    ],
    [
      'G4',
      'node-corbitt-house',
      22,
      'Radio, kanapa i fotele; liczne krzyże i katolickie przedmioty. Odgłosy mogą dobiegać z sypialni gościnnej.',
      'Radio, sofa and chairs; numerous crosses and Catholic objects. Sounds may come from the guest bedroom.',
    ],
    [
      'G5',
      'node-corbitt-house',
      22,
      'Mahoniowy stół, siedem krzeseł i trzy nakrycia; resztki zupy ryżowej.',
      'Mahogany table, seven chairs and three place settings; remains of rice soup.',
    ],
    [
      'G6',
      'node-corbitt-house',
      22,
      'Chłodnia, piec i spiżarka. Konserwy, makaron i wino; część zapasów zniszczyły szczury. Bezpieczniki sterują światłem piwnicy.',
      'Icebox, stove and pantry. Tins, pasta and wine; rats damaged some stores. Fuses control cellar lighting.',
    ],
    [
      'U1',
      'node-corbitt-upper',
      22,
      'Podwójne łóżko, książki i okno; krzyże, świece, brewiarz i różaniec.',
      'Double bed, books and window; crosses, candles, prayer book and rosary.',
    ],
    [
      'U2',
      'node-corbitt-upper',
      22,
      'Dwa małe łóżka, szafy i zabawki; obrazki samolotów i kowbojów.',
      'Two small beds, wardrobes and toys; pictures of planes and cowboys.',
    ],
    [
      'U3',
      'node-corbitt-upper',
      22,
      'Szafa i pusta rama łóżka ze sprężynami. Corbitt może wywoływać swąd, hałasy i plamy krwi oraz zwabić do okna.',
      'Wardrobe and bare sprung bed frame. Corbitt may cause foul smells, noises and blood stains, and lure someone to the window.',
    ],
    [
      'U4',
      'node-corbitt-upper',
      23,
      'Zlew, wanna, toaleta z górnym zbiornikiem, rodzinne ręczniki; cieknący kran i stęchła woda.',
      'Sink, bath, high-cistern toilet and family towels; dripping tap and stale water.',
    ],
    [
      'B1',
      'node-corbitt-basement',
      23,
      'Narzędzia, rura, pokrywa kosza, drewno, gwoździe i śruby. Nóż wymaga odkrycia. Zamek i trzy rygle otwiera się z parteru.',
      'Tools, pipe, bin lid, timber, nails and screws. The knife must be discovered. Lock and three bolts open from the ground floor.',
    ],
    [
      'B2',
      'node-corbitt-basement',
      25,
      'Pusty schowek, dawniej przeznaczony na węgiel.',
      'Empty former coal closet.',
    ],
    [
      'B3',
      'node-between-walls',
      25,
      'Wąska przestrzeń między ścianami. Oczywisty napis; szczury atakują, gdy odcięto im ucieczkę.',
      'Narrow space between walls. An obvious inscription; rats attack if their escape is blocked.',
    ],
    [
      'B4',
      'node-corbitt-crypt',
      26,
      'Klepisko, barłóg z ciałem, stół z rozpadającymi się papierami i arkuszem przypominającym horoskop. Znaczenie arkusza pozostaje nieustalone.',
      'Earth floor, pallet with a body, table with crumbling papers and a sheet resembling a horoscope. Its meaning is deliberately unspecified.',
    ],
  ];
  return rows.map(([id, sceneId, page, pl, en]) => ({
    id,
    sceneId,
    sourcePages: [page],
    description: tr(l, pl, en),
  }));
}

interface MapRoom {
  id: string;
  floor: 'ground' | 'upper' | 'basement';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
const roomData: Array<
  [string, MapRoom['floor'], string, string, number, number, number, number]
> = [
  ['G1', 'ground', 'Składzik', 'Storeroom', 0, 0, 200, 70],
  ['G2', 'ground', 'Drugi składzik', 'Second storeroom', 200, 0, 160, 70],
  ['G3', 'ground', 'Przedpokój', 'Vestibule', 360, 0, 150, 70],
  ['G4', 'ground', 'Salon', 'Living room', 0, 150, 240, 190],
  ['G5', 'ground', 'Jadalnia', 'Dining room', 240, 150, 200, 190],
  ['G6', 'ground', 'Kuchnia', 'Kitchen', 440, 150, 160, 190],
  ['U1', 'upper', 'Główna sypialnia', 'Main bedroom', 0, 45, 160, 115],
  ['U2', 'upper', 'Sypialnia dzieci', 'Children’s bedroom', 160, 45, 160, 115],
  ['U3', 'upper', 'Sypialnia gościnna', 'Guest bedroom', 320, 45, 160, 115],
  ['U4', 'upper', 'Łazienka', 'Bathroom', 480, 85, 120, 75],
  ['B1', 'basement', 'Składzik', 'Storeroom', 400, 0, 200, 300],
  ['B2', 'basement', 'Schowek węglowy', 'Coal closet', 520, 0, 80, 70],
  ['B3', 'basement', 'Przejście', 'Passage', 360, 0, 40, 300],
  ['B4', 'basement', 'Komora', 'Chamber', 0, 0, 360, 300],
];
/** Only acquired room identities cross this boundary. Unknown geometry and names are omitted. */
export function projectHauntingMap(
  locale: DossierLocale,
  discovered: string[]
): { rooms: MapRoom[] } {
  const known = new Set(discovered);
  return {
    rooms: roomData
      .filter((r) => known.has(r[0]))
      .map(([id, floor, pl, en, x, y, width, height]) => ({
        id,
        floor,
        name: tr(locale, pl, en),
        x,
        y,
        width,
        height,
      })),
  };
}
export function hauntingMapImage(
  locale: DossierLocale,
  discovered: string[]
): string {
  const rooms = projectHauntingMap(locale, discovered).rooms;
  const floors = ['ground', 'upper', 'basement'];
  const title = tr(
    locale,
    'Szkic odkrytych pomieszczeń',
    'Sketch of explored rooms'
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1500" viewBox="0 0 900 1500"><rect width="900" height="1500" fill="#e7d6b7"/><text x="40" y="45" font-family="Georgia" font-size="28">${escapeXml(title)}</text>${floors
    .map((floor, i) => {
      const selected = rooms.filter((r) => r.floor === floor);
      if (!selected.length) return '';
      return `<g transform="translate(80 ${90 + i * 470})"><text y="-15" font-family="Georgia" font-size="24">${escapeXml(tr(locale, ['Parter', 'Piętro', 'Piwnica'][i], ['Ground floor', 'Upper floor', 'Cellar'][i]))}</text>${selected.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="#e7d6b7" stroke="#30251d" stroke-width="3"/><text x="${r.x + 8}" y="${r.y + 28}" font-family="Georgia" font-size="15">${escapeXml(r.id)}</text>`).join('')}${selected.map((r, n) => `<text x="${Math.floor(n / 3) * 300}" y="${380 + (n % 3) * 25}" font-family="Georgia" font-size="16">${escapeXml(r.id + ' ' + r.name)}</text>`).join('')}</g>`;
    })
    .join('')}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

type Consequence =
  | { event: 'stairs'; success: boolean; pushed: boolean; roll: number }
  | {
      event: 'corbitt-hit';
      damage: number;
      armour: number;
      hp: number;
      ownKnife: boolean;
    };
/** Accepts engine-resolved outcomes only. Never rolls dice or infers success from narration. */
export function resolveHauntingConsequence(input: Extract<Consequence, { event: 'stairs' }>): { hpLoss: number; warning: boolean };
export function resolveHauntingConsequence(input: Extract<Consequence, { event: 'corbitt-hit' }>): { hp: number; armour: number; destroyed: boolean };
export function resolveHauntingConsequence(input: Consequence) {
  if (input.event === 'stairs') {
    if (!Number.isInteger(input.roll) || input.roll < 1 || input.roll > 6)
      throw new Error('INVALID_D6');
    return {
      hpLoss: input.success || !input.pushed ? 0 : input.roll,
      warning: !input.success && !input.pushed,
    };
  }
  if (
    [input.damage, input.armour, input.hp].some(
      (n) => !Number.isFinite(n) || n < 0
    )
  )
    throw new Error('INVALID_DAMAGE_STATE');
  const hp = input.ownKnife
    ? 0
    : Math.max(0, input.hp - Math.max(0, input.damage - input.armour));
  return {
    hp,
    armour: input.ownKnife
      ? input.armour
      : Math.max(0, input.armour - input.damage),
    destroyed: hp === 0,
  };
}
