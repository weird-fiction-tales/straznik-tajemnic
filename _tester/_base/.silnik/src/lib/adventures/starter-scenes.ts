import type {
  DossierLocale,
  PreparedActor,
  PreparedScene,
} from './prepared-dossier';
import { phrase as tr } from './starter-handouts';

export function hauntingActors(l: DossierLocale): PreparedActor[] {
  const actor = (
    id: string,
    name: string,
    scene: string,
    pl: string,
    en: string,
    pages: number[],
    portrait?: string,
    stats?: string
  ): PreparedActor => ({
    id,
    name,
    sceneIds: [scene],
    description: tr(l, pl, en),
    knowledge: tr(l, pl, en),
    behaviour: tr(
      l,
      'Odgrywaj tylko posiadaną wiedzę. Improwizuj sposób wypowiedzi, nie nowe fakty.',
      'Perform only established knowledge. Improvise delivery, not new facts.'
    ),
    sourcePages: pages,
    portrait: portrait
      ? `/adventure-packs/case-s11-01/${portrait}.webp`
      : undefined,
    stats,
    voice: tr(
      l,
      'Głos postaci zgodny z istniejącym przypisaniem; przy braku użyj głosu narratora bez podszywania się pod inną osobę.',
      'Use the existing character voice assignment; otherwise use the narrator without impersonating another character.'
    ),
  });
  return [
    actor(
      'npc-steven-knott',
      'Steven Knott',
      'node-knott-office',
      'Właściciel zleca wyjaśnienie złej sławy domu. Daje klucze, adres i zaliczkę; pyta o postępy przedłużających się badań.',
      'The owner commissions an investigation into the house’s reputation. He supplies keys, an address and an advance, and asks about progress if research drags on.',
      [15, 16, 17],
      'npc-steven-knott'
    ),
    actor(
      'npc-arty-wilmot',
      'Arty Wilmot',
      'node-boston-globe',
      'Redaktor gazety. Może utrudniać dostęp do archiwum, nie zna ukrytych wydarzeń w domu.',
      'A newspaper editor who may obstruct access to the archive. He does not know the house’s hidden events.',
      [16, 17],
      'npc-arty-wilmot'
    ),
    actor(
      'npc-ruth-blake',
      'Ruth Blake',
      'node-boston-globe',
      'Pracuje w archiwum Boston Globe. Pomaga odnaleźć materiał prasowy, gdy Badacze uzyskają dostęp.',
      'Works in the Boston Globe archive. Helps locate newspaper material once the investigators obtain access.',
      [17],
      'npc-ruth-blake'
    ),
    actor(
      'npc-kim-debrun',
      'Kim Debrun',
      'node-courthouse',
      'Urzędnik stanowi drogę dostępu do akt sprawy kaplicy. Nie przenoś jego roli do biblioteki.',
      'A clerk provides a route to the chapel case records. Do not move this role into the library.',
      [18]
    ),
    actor(
      'npc-mr-dooley',
      'Mr Dooley',
      'node-neighbourhood',
      'Sklepikarz zna historię Macariów i drogę do kaplicy. Dzieci mieszkają z krewnymi w Baltimore, rodzice trafili do Roxbury. Plotkuje i przesadza.',
      'The shopkeeper knows the Macarios’ history and the way to the chapel. The children are with relatives in Baltimore, the parents in Roxbury. He gossips and exaggerates.',
      [19],
      'npc-mr-dooley'
    ),
    actor(
      'npc-vittorio-macario',
      'Vittorio Macario',
      'node-sanatorium',
      'Chory mężczyzna trzyma Biblię. Jego wypowiedź sugeruje pokonanie zła jego własną bronią. Nie objaśniaj znaczenia wskazówki.',
      'The ill man clutches a Bible. His remark suggests defeating evil with its own weapon. Do not explain the clue’s meaning.',
      [19]
    ),
    actor(
      'npc-gabriela-macario',
      'Gabriela Macario',
      'node-sanatorium',
      'Przytomna i życzliwa. Opowiada o nocnej obecności, poruszających się przedmiotach i gniewie skierowanym na Vittoria. Nie zna źródła zjawisk.',
      'Lucid and friendly. She describes a presence at night, moving objects and anger directed at Vittorio. She does not know what causes the phenomena.',
      [19],
      'npc-gabriela-macario'
    ),
    actor(
      'npc-walter-corbitt',
      'Walter Corbitt',
      'node-corbitt-crypt',
      'Nieumarły ukryty w komorze piwnicy. Oszczędza PM, odstrasza intruzów i broni ciała. Jego własny nóż niszczy go po trafieniu.',
      'An undead man concealed in a cellar chamber. He conserves MP, drives intruders away and protects his body. A hit from his own knife destroys him.',
      [26, 28, 29],
      'npc-walter-corbitt',
      tr(
        l,
        'SIŁ 90, KON 115, BC 55, ZR 35, INT 80, MOC 90, WYG 5, WYK 80, SAN 0, HP 16, PM 18, Ruch 8, Budowa 1, MO +1d4; Bijatyka 50/25/10 (1d3+1d4), Unik 17/8/3; Mity 17, Zastraszanie 64, Nasłuchiwanie 60, Zręczne Palce 30, Ukrywanie 72. Dominacja, Ochrona Ciała, Wezwanie/Spętanie Kroczącego Między Światami.',
        'STR 90, CON 115, SIZ 55, DEX 35, INT 80, POW 90, APP 5, EDU 80, SAN 0, HP 16, MP 18, MOV 8, Build 1, DB +1d4; Brawl 50/25/10 (1d3+1d4), Dodge 17/8/3; Cthulhu Mythos 17, Intimidate 64, Listen 60, Sleight of Hand 30, Stealth 72. Domination, Flesh Ward, Call/Bind Dimensional Shambler.'
      )
    ),
  ];
}

export function hauntingScenes(l: DossierLocale): PreparedScene[] {
  const s = (
    id: string,
    title: [string, string],
    pages: number[],
    entry: [string, string],
    actors: string[],
    handouts: string[],
    exits: string[],
    actions: [string, string],
    director: [string, string],
    audio: string[] = []
  ): PreparedScene => ({
    id,
    title: tr(l, ...title),
    sourcePages: pages,
    entry: tr(l, ...entry),
    actorIds: actors,
    handoutSlugs: handouts,
    exits,
    atmosphere: tr(
      l,
      'Opisuj widoczne otoczenie i reakcje ludzi. Napięcie buduj przez konkretne szczegóły.',
      'Describe visible surroundings and people’s reactions. Build tension through concrete details.'
    ),
    knowledge: [tr(l, ...entry)],
    actions: [tr(l, ...actions)],
    director: tr(l, ...director),
    checks: [],
    audioIds: audio,
  });
  const scenes = [
    s(
      'node-knott-office',
      ['Zlecenie Knotta', 'Knott’s commission'],
      [15, 16],
      [
        'Knott proponuje zbadanie domu. Badacze otrzymują klucze i zaliczkę.',
        'Knott proposes investigating the house. The investigators receive keys and an advance.',
      ],
      ['npc-steven-knott'],
      ['clue-01-knott-keys'],
      [
        'node-boston-globe',
        'node-library',
        'node-city-hall',
        'node-neighbourhood',
        'node-corbitt-house',
      ],
      [
        'Zadawaj pytania o cel zlecenia, wynagrodzenie i drogi śledztwa.',
        'Ask about the assignment, payment and research routes.',
      ],
      [
        'Pozwól wybrać kolejność. Dokładny dzień, pogoda i wnętrze biura to adaptacja.',
        'Let players choose the order. The exact date, weather and office interior are adaptation.',
      ],
      ['briefing']
    ),
    s(
      'node-boston-globe',
      ['Redakcja i archiwum Boston Globe', 'Boston Globe office and archive'],
      [16, 17],
      [
        'Dostęp do archiwum prowadzi przez redakcję; Ruth pomaga przy wycinkach.',
        'Access to the archive goes through the newspaper office; Ruth assists with clippings.',
      ],
      ['npc-arty-wilmot', 'npc-ruth-blake'],
      ['clue-02-boston-globe-1918'],
      [
        'node-library',
        'node-sanatorium',
        'node-neighbourhood',
        'node-corbitt-house',
      ],
      [
        'Przekonaj redaktora lub znajdź inną wiarygodną drogę dostępu. Po wejściu odszukaj artykuł.',
        'Persuade the editor or find another credible route to access. Once inside, locate the article.',
      ],
      [
        'Po uzyskaniu dostępu nie blokuj jedynego artykułu kolejnym rzutem.',
        'Once access is obtained, do not gate the sole article behind another roll.',
      ],
      ['globe-reading', 'press-ambience']
    ),
    s(
      'node-library',
      ['Biblioteka Główna', 'Central Library'],
      [17, 18],
      [
        'Publiczne źródła opisują własność domu i procesy.',
        'Public sources describe the house’s ownership and court disputes.',
      ],
      [],
      [
        'clue-03-land-registry-1852',
        'clue-04-lawsuit-1853',
        'clue-05-obituary-1866',
        'clue-06-missing-court-verdict',
      ],
      ['node-city-hall', 'node-courthouse', 'node-corbitt-house'],
      [
        'Badaj kolejne dokumenty w kolejności Pomocy 3-6.',
        'Research documents in the order of Aids 3-6.',
      ],
      [
        'Każda próba zajmuje pół dnia. Po ponad dniu Knott pyta o postępy. Porażka pozwala badać dalej; nie wymyślaj nowej historii zamiast brakującej pomocy.',
        'Each attempt costs half a day. After more than a day Knott asks about progress. Failure permits further research; do not invent a replacement history.',
      ]
    ),
    s(
      'node-city-hall',
      ['Archiwum Miejskie', 'City archives'],
      [18],
      [
        'Akta testamentu prowadzą do Michaela Thomasa i kaplicy.',
        'Will records lead to Michael Thomas and the chapel.',
      ],
      [],
      ['clue-06-court-executor-record'],
      ['node-courthouse', 'node-chapel-ruins', 'node-corbitt-house'],
      [
        'Przeszukaj akta testamentu i rejestr instytucji.',
        'Search the will records and institutions register.',
      ],
      [
        'Ruth pracuje w gazecie. Nie umieszczaj jej w archiwum miejskim.',
        'Ruth works at the newspaper. Do not place her in the city archives.',
      ]
    ),
    s(
      'node-courthouse',
      ['Sąd i policja', 'Courthouse and police'],
      [18],
      [
        'Akta sprawy kaplicy mogą wymagać rozmowy z urzędnikiem.',
        'Access to the chapel case files may require talking to a clerk.',
      ],
      ['npc-kim-debrun'],
      ['clue-07-police-raid-file'],
      ['node-chapel-ruins', 'node-corbitt-house'],
      [
        'Uzyskaj dostęp do dokumentów legalnie, rozmową lub innym rozstrzygniętym działaniem.',
        'Gain access through official channels, conversation or another resolved action.',
      ],
      [
        'Rozstrzygnij metodę zadeklarowaną przez graczy. Raport nie leży w ruinach kaplicy.',
        'Resolve the method declared by the players. The police report is not in the chapel ruins.',
      ]
    ),
    s(
      'node-neighbourhood',
      ['Okolica domu', 'The neighbourhood'],
      [19],
      [
        'Dooley pamięta dawnych lokatorów i wskazuje szpital oraz kaplicę.',
        'Dooley remembers the former tenants and points to the hospital and chapel.',
      ],
      ['npc-mr-dooley'],
      [],
      ['node-sanatorium', 'node-chapel-ruins', 'node-corbitt-house'],
      [
        'Porozmawiaj ze sklepikarzem, pytaj o rodzinę i okolicę.',
        'Talk to the shopkeeper about the family and neighbourhood.',
      ],
      [
        'Odgrywaj plotkarza. Oddziel jego przesadę od ustalonych faktów; nie zdradzaj kryjówki sprawcy.',
        'Play a gossip. Separate exaggeration from established facts; do not reveal the antagonist’s hiding place.',
      ]
    ),
    s(
      'node-sanatorium',
      ['Szpital w Roxbury', 'Roxbury hospital'],
      [19],
      [
        'Można odwiedzić oboje rodziców. Vittorio jest chory; Gabriela rozmawia przytomnie.',
        'Both parents can be visited. Vittorio is ill; Gabriela speaks lucidly.',
      ],
      ['npc-vittorio-macario', 'npc-gabriela-macario'],
      [],
      ['node-neighbourhood', 'node-corbitt-house'],
      [
        'Wysłuchaj obojga. Pozostaw interpretację wskazówki o broni graczom.',
        'Listen to both. Leave interpretation of the weapon clue to the players.',
      ],
      [
        'To rozmowa, nie znalezienie wałka z 1912 roku. Nagranie wypowiedzi to adaptacja wykonania głosowego.',
        'This is a conversation, not discovery of a 1912 cylinder. Recorded dialogue is an audio performance adaptation.',
      ],
      ['macario-performance']
    ),
    s(
      'node-chapel-ruins',
      ['Ruiny Kaplicy Kontemplacji', 'Chapel of Contemplation ruins'],
      [20, 21],
      [
        'Ruiny noszą ślady pożaru i niezwykły symbol. Podłoga jest osłabiona.',
        'The ruins bear fire damage and an unusual symbol. The floor is weakened.',
      ],
      [],
      [
        'clue-08-cult-symbol-sketch',
        'clue-chapel-cult-journal',
        'item-liber-ivonis',
      ],
      ['node-corbitt-house', 'node-courthouse'],
      [
        'Obejrzyj symbol i zbadaj szafkę oraz przestrzeń pod nią.',
        'Examine the symbol and search the cabinet and the space beneath it.',
      ],
      [
        'Ostrzegaj opisem konstrukcji. Księga i dziennik kultu należą do odkryć osobnych od raportu policji.',
        'Describe structural warning signs. The book and cult diary are discoveries separate from police records.',
      ]
    ),
    s(
      'node-corbitt-house',
      ['Dom: parter', 'House: ground floor'],
      [21],
      [
        'Przedpokój prowadzi do pomieszczeń parteru. W pierwszym składziku stoi zabita szafka.',
        'The vestibule leads to the ground-floor rooms. A nailed-shut cabinet stands in the first storeroom.',
      ],
      [],
      ['clue-09-corbitt-journal'],
      ['node-corbitt-upper', 'node-basement-stairs', 'node-neighbourhood'],
      [
        'Eksploruj sześć pomieszczeń, otwórz szafkę, sprawdź kuchnię.',
        'Explore six rooms, open the cabinet, inspect the kitchen.',
      ],
      [
        'Szkicuj tylko obejrzane pomieszczenia. Dzienniki są na parterze. Nie podawaj z góry tajemnicy piwnicy.',
        'Sketch only explored rooms. The journals are on the ground floor. Do not reveal the cellar secret in advance.',
      ],
      ['house-ambience', 'journal-reading']
    ),
    s(
      'node-corbitt-upper',
      [
        'Dom: piętro i sypialnia gościnna',
        'House: upper floor and guest bedroom',
      ],
      [22, 23],
      [
        'Na piętrze są trzy sypialnie i łazienka. Niepokojące okno może przyciągnąć uwagę.',
        'The upper floor has three bedrooms and a bathroom. A disturbing window may draw attention.',
      ],
      [],
      [],
      ['node-corbitt-house'],
      [
        'Zbadaj pokoje; reaguj na ruch mebli i okna.',
        'Examine the rooms; react to furniture and window movement.',
      ],
      [
        'Atak łóżka rozstrzygnij jako konkretne zdarzenie. Nie powtarzaj obrażeń w narracji.',
        'Resolve the bed attack as a discrete event. Do not duplicate damage in narration.',
      ],
      ['window-sfx', 'bed-sfx']
    ),
    s(
      'node-basement-stairs',
      ['Zejście do piwnicy', 'Cellar stairs'],
      [23],
      [
        'Drzwi otwierają się od strony parteru. Schody są niebezpieczne; światło może zgasnąć.',
        'The door opens from the ground floor. The stairs are unsafe; the lights may go out.',
      ],
      [],
      [],
      ['node-corbitt-house', 'node-corbitt-basement'],
      [
        'Sprawdź schody, wybierz sposób zejścia albo zrezygnuj.',
        'Inspect the stairs, choose a descent method or turn back.',
      ],
      [
        'Pierwsza porażka to ostrzeżenie. Upadek dopiero przy nieudanym forsowaniu. Pomoc po zejściu daje kość premiową kolejnej osobie.',
        'The first failure is a warning. A fall follows a failed push. Help from below gives the next person a bonus die.',
      ]
    ),
    s(
      'node-corbitt-basement',
      ['Piwnica: składzik i węglarz', 'Cellar: storage and coal closet'],
      [23, 24],
      [
        'W piwnicy zalegają rzeczy i gruz. Można odnaleźć nóż oraz zbadać puste przestrzenie w ścianie.',
        'The cellar contains clutter and debris. A knife can be found and wall cavities examined.',
      ],
      [],
      ['item-corbitt-dagger'],
      ['node-basement-stairs', 'node-between-walls'],
      [
        'Przeszukaj rzeczy; sam zdecyduj o podniesieniu noża. Zbadaj boazerię.',
        'Search the clutter; choose whether to pick up the knife. Examine the panelling.',
      ],
      [
        'Dostrzeżenie noża nie oznacza zabrania. Jego atak ma koszt PM i zużywa akcję przeciwnika.',
        'Seeing the knife does not acquire it. Its attack costs MP and consumes the antagonist’s action.',
      ],
      ['knife-sfx']
    ),
    s(
      'node-between-walls',
      ['Przestrzeń za ścianą', 'Space beyond the wall'],
      [25],
      [
        'Po sforsowaniu ściany wąskie przejście pozwala zajrzeć dalej. Szczury atakują, jeśli Badacze odetną im drogę ucieczki.',
        'Once the wall is breached, a narrow passage leads further. Rats attack if investigators block their escape.',
      ],
      [],
      [],
      ['node-corbitt-basement', 'node-corbitt-crypt'],
      [
        'Przeczytaj oczywisty napis, reaguj na szczury, zdecyduj o dalszym wejściu.',
        'Read the obvious inscription, deal with rats, decide whether to proceed.',
      ],
      [
        'Nie wymagaj Spostrzegawczości dla oczywistego napisu. Śmierć jednego szczura wystarcza do rozproszenia stada.',
        'Do not require Spot Hidden for the obvious inscription. Killing one rat disperses the swarm.',
      ],
      ['rats-sfx']
    ),
    s(
      'node-corbitt-crypt',
      ['Ukryta komora', 'Concealed chamber'],
      [26, 27, 28, 29],
      [
        'Po odkryciu komory Badacze mogą zobaczyć ciało i skonfrontować się z Corbittem.',
        'After discovering the chamber, the investigators can see the body and confront Corbitt.',
      ],
      ['npc-walter-corbitt'],
      ['clue-crypt-horoscope'],
      ['node-between-walls'],
      [
        'Rozstrzygaj ataki, ochronę, wolę odwrotu oraz użycie odnalezionych przedmiotów.',
        'Resolve attacks, protection, retreat and use of discovered objects.',
      ],
      [
        'Własny nóż niszczy Corbitta po trafieniu, nawet przez ochronę. Dopiero ustalony stan wybiera zakończenie.',
        'A hit from his own knife destroys Corbitt despite protection. Choose an ending only from the resolved state.',
      ]
    ),
  ];
  const check = (
    scene: string,
    id: string,
    test: [string, string],
    success: [string, string],
    failure: [string, string],
    pushedFailure?: [string, string]
  ) => {
    scenes
      .find((s) => s.id === scene)!
      .checks.push({
        id,
        test: tr(l, ...test),
        success: tr(l, ...success),
        failure: tr(l, ...failure),
        pushedFailure: pushedFailure ? tr(l, ...pushedFailure) : undefined,
      });
  };
  check(
    'node-boston-globe',
    'globe-access',
    ['Rozmowa / dostęp', 'Conversation / access'],
    [
      'Dostęp do artykułu; bez drugiego rzutu za jego odszukanie.',
      'Access to the article; no second roll to locate it.',
    ],
    [
      'Inna metoda dostępu lub inna droga śledztwa.',
      'Another access method or another research route.',
    ]
  );
  for (let n = 1; n <= 4; n++)
    check(
      'node-library',
      `library-${n}`,
      ['Korzystanie z Bibliotek, zwykły', 'Library Use, regular'],
      [
        `Pomoc ${n + 2}; pół dnia badań.`,
        `Aid ${n + 2}; half a day of research.`,
      ],
      ['Pół dnia; można spróbować dalej.', 'Half a day; research may continue.']
    );
  check(
    'node-city-hall',
    'archives-search',
    ['Korzystanie z Bibliotek', 'Library Use'],
    ['Pomoc 7.', 'Aid 7.'],
    [
      'Kolejna próba kosztuje czas jak w bibliotece.',
      'Another attempt costs time as in the library.',
    ]
  );
  check(
    'node-courthouse',
    'court-access',
    [
      'Metoda dostępu zadeklarowana przez graczy',
      'Access method declared by players',
    ],
    ['Pomoc 8.', 'Aid 8.'],
    [
      'Odmowa tej metody; pozostają inne drogi.',
      'This method is refused; other routes remain.',
    ]
  );
  check(
    'node-chapel-ruins',
    'chapel-floor',
    ['Szczęście, potem Skakanie przy porażce', 'Luck, then Jump on failure'],
    ['Bezpieczne przejście.', 'Cross safely.'],
    [
      'Jeśli oba rzuty zawiodą: upadek, 1d6 PW.',
      'If both rolls fail: fall, 1d6 HP.',
    ]
  );
  check(
    'node-chapel-ruins',
    'chapel-search',
    [
      'Spostrzegawczość, jeśli nie zajrzano pod szafkę',
      'Spot Hidden if the space beneath the cabinet is not explicitly searched',
    ],
    [
      'Dziennik kultu i łaciński Liber Ivonis.',
      'Cult diary and Latin Liber Ivonis.',
    ],
    ['Można szukać dłużej.', 'More searching is possible.'],
    [
      'Gwóźdź lub uszkodzona odzież; dobierz skutek do deklaracji.',
      'A nail injury or torn clothing; match the consequence to the attempt.',
    ]
  );
  check(
    'node-corbitt-house',
    'open-journal-cabinet',
    [
      'Fizyczne otwarcie szafki, metoda gracza',
      'Physically open the cabinet using the player’s method',
    ],
    ['Trzy tomy dzienników.', 'Three journal volumes.'],
    [
      'Szafka pozostaje zamknięta; można zmienić metodę.',
      'Cabinet remains closed; another method is possible.',
    ]
  );
  check(
    'node-corbitt-upper',
    'bed-warning',
    [
      'Spostrzegawczość, potem Unik przy sukcesie',
      'Spot Hidden, then Dodge on success',
    ],
    [
      'Udany Unik pozwala uniknąć trafienia; świadkowie nadal testują SAN 1/1d4.',
      'Successful Dodge avoids impact; witnesses still test SAN 1/1d4.',
    ],
    [
      'Trafienie: 1d6+2 PW; świadkowie SAN 1/1d4.',
      'Hit: 1d6+2 HP; witnesses SAN 1/1d4.',
    ]
  );
  check(
    'node-basement-stairs',
    'stairs-descent',
    ['Jeden rzut wobec ZR lub Wspinaczki', 'One roll against DEX or Climb'],
    ['Bezpieczne zejście.', 'Descend safely.'],
    ['Ostrzeżenie, bez obrażeń.', 'Warning, no damage.'],
    [
      'Upadek: 1d6 PW. Przy wspólnej porażce pomocy zagrożone obie osoby.',
      'Fall: 1d6 HP. Failed assisted descent endangers both people.',
    ]
  );
  check(
    'node-corbitt-basement',
    'knife-discovery',
    ['Spostrzegawczość', 'Spot Hidden'],
    [
      'Dostrzeżony nóż; zabranie wymaga decyzji.',
      'Knife spotted; taking it requires a decision.',
    ],
    ['Można szukać dłużej.', 'Search longer if desired.'],
    ['Automatyczne skaleczenie 1d4+2 PW.', 'Automatic cut for 1d4+2 HP.']
  );
  return scenes;
}
