import type { DossierLocale, PreparedAudio } from './prepared-dossier';
import { getHauntingHandouts } from './starter-handouts';

/** Production briefs only. Unreviewed files are never attached as playable handouts. */
export function hauntingAudio(locale: DossierLocale): PreparedAudio[] {
  const audio: PreparedAudio[] = [
    {
      id: 'briefing',
      sceneId: 'node-knott-office',
      trigger: 'before accepting the commission',
      kind: 'briefing',
      status: 'needs_review',
      sourcePages: [15, 16],
      seconds: 38,
      files: {
        pl: '/audio/briefings/the-haunting/briefing-pl.mp3',
        en: '/audio/briefings/the-haunting/briefing-en.mp3',
      },
      scripts: {
        pl: 'Boston, rok 1920. Steven Knott chce wyjaśnić złą sławę domu, którego nie może wynająć. Poprzednia rodzina opuściła go po tragicznych wydarzeniach. Na stole czekają klucze i zaliczka. Możecie zacząć od rozmów, archiwów albo samych oględzin budynku. To od was zależy, którą drogą pójdzie śledztwo.',
        en: 'Boston, 1920. Steven Knott wants to explain the reputation of a house he cannot rent. Its previous occupants left after tragic events. Keys and an advance await on the table. You can begin with interviews, archives or an inspection of the building itself. The course of the investigation is yours to choose.',
      },
      notes:
        'Existing PL file has conflicting manifest transcripts. Neither existing recording has listening approval. Scripts here are proposed replacements, not verified transcripts.',
    },
    {
      id: 'macario-performance',
      sceneId: 'node-sanatorium',
      trigger: 'after Gabriela agrees to speak',
      kind: 'performance',
      status: 'replace',
      sourcePages: [19],
      seconds: 45,
      files: {
        pl: '/audio/handouts/the-haunting/walek-dyktafon-boston-sanitarium-1912-pl.mp3',
        en: '/audio/handouts/the-haunting/walek-dyktafon-boston-sanitarium-1912.mp3',
      },
      scripts: {
        pl: 'Dziękuję, że przyszliście. Pytacie o tamten dom. Czułam, że coś tam jest, jakaś zła obecność. Nocami budziłam się i widziałam to nad łóżkiem. Gdy wpadało w gniew, przedmioty poruszały się po pokoju. Najgorzej traktowało Vittoria. Nie potrafię wam powiedzieć, czym było ani skąd przyszło. Wiem tylko, co widziałam i czego się bałam.',
        en: 'Thank you for coming. You are asking about that house. I felt something there, an evil presence. At night I would wake and see it over the bed. When it grew angry, objects moved about the room. Vittorio suffered the worst of its anger. I cannot tell you what it was or where it came from. I can only tell you what I saw and what frightened me.',
      },
      notes:
        'Lucid, friendly testimony with restrained fear. Audio performance adaptation of a live conversation; no invented 1912 cylinder or new evidence.',
    },
    {
      id: 'globe-reading',
      sceneId: 'node-boston-globe',
      trigger: 'after Aid 2 is acquired; explicit Play',
      kind: 'reading',
      status: 'missing',
      sourcePages: [17, 30],
      seconds: 55,
      files: {},
      scripts: {
        pl: getHauntingHandouts('pl').find((h) => h.sourceNumber === 2)!
          .textContent!,
        en: getHauntingHandouts('en').find((h) => h.sourceNumber === 2)!
          .textContent!,
      },
      notes:
        'Read the same approved text shown on the document. No extra facts.',
    },
    {
      id: 'journal-reading',
      sceneId: 'node-corbitt-house',
      trigger: 'after journals are acquired; explicit Play',
      kind: 'reading',
      status: 'missing',
      sourcePages: [21],
      seconds: 35,
      files: {},
      scripts: {
        pl: 'Przed wami trzy tomy zapisane po angielsku. To dzienniki człowieka, który poświęcał coraz więcej uwagi sprawom okultystycznym. Zapiski łączą osobiste doświadczenia z opisami jego badań. Nie wystarczy pobieżne przekartkowanie. Dokładne zapoznanie się z całością wymaga około dwóch dni. Czy chcecie poświęcić na to czas?',
        en: 'Before you are three volumes written in English. They are the journals of a man increasingly devoted to occult matters. Personal experiences sit beside accounts of his investigations. A hurried glance will not reveal everything. Careful study of the complete set takes about two days. Do you want to spend that time?',
      },
      notes:
        'Adapted narrator description, not a fabricated passage of a spell or an authentic voice of Corbitt.',
    },
  ];
  const effects: Array<
    [string, string, string, string, number, string, number[]]
  > = [
    [
      'house-ambience',
      'node-corbitt-house',
      'when exploring house; ambient setting enabled',
      'ambience',
      60,
      'An abandoned wooden house, draughts through gaps, restrained floorboard creaks, distant settling timber. Seamless loop. No speech, screams, music or event impacts.',
      [21, 22, 23],
    ],
    [
      'press-ambience',
      'node-boston-globe',
      'inside newspaper office; ambient setting enabled',
      'ambience',
      60,
      '1920 newspaper printing machinery and soft paper handling in the distance. Seamless loop. No intelligible voices or modern electronics.',
      [16, 17],
    ],
    [
      'window-sfx',
      'node-corbitt-upper',
      'guest bedroom window disturbance',
      'sfx',
      7,
      'Old sash window rattles in a gust, then settles. No impact of a bed or breaking glass.',
      [22],
    ],
    [
      'bed-sfx',
      'node-corbitt-upper',
      'resolved bed attack, once per committed event',
      'sfx',
      4,
      'A heavy wooden bed violently scrapes and slams across a bare floor. One impact, no speech.',
      [22, 23],
    ],
    [
      'knife-sfx',
      'node-corbitt-basement',
      'resolved flying knife attack, once per committed event',
      'sfx',
      5,
      'A knife whistles through the air and strikes old wood. One throw, no voices or music.',
      [24],
    ],
    [
      'rats-sfx',
      'node-between-walls',
      'rat swarm appears in passage',
      'sfx',
      10,
      'A small swarm of rats scurries and squeaks in a narrow wooden cavity. No human screaming.',
      [25],
    ],
  ];
  for (const [
    id,
    sceneId,
    trigger,
    kind,
    seconds,
    prompt,
    sourcePages,
  ] of effects)
    audio.push({
      id,
      sceneId,
      trigger,
      kind: kind as 'ambience' | 'sfx',
      status: 'missing',
      sourcePages,
      seconds,
      files: {},
      scripts: { pl: prompt, en: prompt },
      notes:
        'Language-neutral production prompt. Adapted sound design; not a historical recording. Existing volume and mute settings apply.',
    });
  if (locale === 'pl') {
    const translations: Record<string, [string, string]> = {
      briefing: [
        'Przed przyjęciem zlecenia.',
        'Transkrypcje manifestów istniejącego pliku PL są sprzeczne. Brak odbioru odsłuchem obu wersji. To propozycje nowych tekstów, nie zweryfikowane transkrypcje.',
      ],
      'macario-performance': [
        'Po zgodzie Gabrieli na rozmowę.',
        'Spokojna, przytomna rozmówczyni z wyczuwalnym lękiem. Adaptacja wykonania głosowego, bez fikcyjnego wałka z 1912 roku.',
      ],
      'globe-reading': [
        'Po zdobyciu Pomocy 2; przycisk Odtwórz.',
        'Czytaj dokładnie treść widoczną na dokumencie, bez dodawania faktów.',
      ],
      'journal-reading': [
        'Po zdobyciu dzienników; przycisk Odtwórz.',
        'Adaptowany opis narratora, nie wymyślony fragment zaklęcia ani autentyczny głos Corbitta.',
      ],
      'house-ambience': [
        'Podczas eksploracji domu, przy włączonych tłach.',
        'Pętla 60 sekund: przeciąg, skrzypienie desek, osiadanie drewna. Bez głosów, krzyków, muzyki i odgłosów zdarzeń.',
      ],
      'press-ambience': [
        'W redakcji, przy włączonych tłach.',
        'Pętla 60 sekund: maszyny drukarskie i szelest papieru. Bez zrozumiałych rozmów i współczesnej elektroniki.',
      ],
      'window-sfx': [
        'Zdarzenie grzechoczącego okna w sypialni gościnnej.',
        'Pojedynczy odgłos starego okna. Bez uderzenia łóżka i tłuczonego szkła.',
      ],
      'bed-sfx': [
        'Po rozstrzygnięciu ataku łóżka, raz na zatwierdzone zdarzenie.',
        'Ciężkie łóżko szoruje po podłodze i uderza. Jeden cios, bez głosu.',
      ],
      'knife-sfx': [
        'Po rozstrzygnięciu ataku noża, raz na zatwierdzone zdarzenie.',
        'Świst i wbicie noża w drewno. Jeden rzut, bez głosu i muzyki.',
      ],
      'rats-sfx': [
        'Przy pojawieniu się szczurów w przejściu.',
        'Szelest i piski szczurów w drewnianej przestrzeni. Bez ludzkiego krzyku.',
      ],
    };
    for (const a of audio) {
      const [trigger, notes] = translations[a.id];
      a.trigger = trigger;
      a.notes = notes;
      if (a.kind === 'ambience' || a.kind === 'sfx') a.scripts.pl = notes;
    }
  }
  return audio;
}
