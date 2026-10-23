import { parseIntoSections, detectHandoutType } from './parse-sections';

describe('parseIntoSections (Handouty, obrazy i nagrania audio)', () => {
  it('poprawnie parsuje blok handoutu z obrazem [OBRAZ: ...]', () => {
    const text = [
      'Odnajdujesz starą kopertę.',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '📜 DOKUMENT ŚLEDCZY: ZAPISKI Z ARCHIWUM',
      '',
      'Poufne notatki z Uniwersytetu Miskatonic.',
      '',
      '[OBRAZ: /equipment/catalog/letter-shared.webp]',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'Co robisz dalej?',
    ].join('\n');

    const sections = parseIntoSections(text);
    expect(sections).toHaveLength(3);
    expect(sections[0].type).toBe('narrative');
    expect(sections[1].type).toBe('handout');
    expect(sections[1].imageUrl).toBe('/equipment/catalog/letter-shared.webp');
    expect(sections[1].content).not.toContain('[OBRAZ:');
    expect(sections[1].content).toContain('Poufne notatki z Uniwersytetu Miskatonic.');
    expect(sections[2].type).toBe('narrative');
  });

  it('poprawnie parsuje blok handoutu z nagraniem [AUDIO: ...]', () => {
    const text = [
      'Włączasz stary magnetofon szpulowy.',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '🎙️ NAGRANIE DŹWIĘKOWE: TAŚMA SZPULOWA NR 1',
      '',
      '[00:02] Szum taśmy i trzask...',
      '[00:06] "Jeśli to słyszysz..."',
      '',
      '[AUDIO: /audio/handouts/starter_friend_letter.mp3]',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ].join('\n');

    const sections = parseIntoSections(text);
    expect(sections).toHaveLength(2);
    expect(sections[0].type).toBe('narrative');
    expect(sections[1].type).toBe('handout');
    expect(sections[1].audioUrl).toBe('/audio/handouts/starter_friend_letter.mp3');
    expect(sections[1].content).not.toContain('[AUDIO:');
    expect(sections[1].content).toContain('[00:06] "Jeśli to słyszysz..."');
  });

  it('poprawnie parsuje oba bloki rekwizytów (dokument i audio) w jednej wiadomości', () => {
    const text = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '📜 DOKUMENT ŚLEDCZY',
      'Treść dokumentu.',
      '[OBRAZ: /equipment/catalog/letter-shared.webp]',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '🎙️ NAGRANIE AUDIO',
      'Transkrypcja nagrania.',
      '[AUDIO: /audio/handouts/corbitt_journal.mp3]',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ].join('\n');

    const sections = parseIntoSections(text);
    const handouts = sections.filter((s) => s.type === 'handout');
    expect(handouts).toHaveLength(2);
    expect(handouts[0].imageUrl).toBe('/equipment/catalog/letter-shared.webp');
    expect(handouts[1].audioUrl).toBe('/audio/handouts/corbitt_journal.mp3');
  });

  it('poprawnie parsuje [NOTATKA_BADACZA: ...] i tworzy obiekt stickyNote na sekcji handoutu', () => {
    const text = [
      'Na biurku profesora leży pożółkły dokument.',
      '[NOTATKA_BADACZA: Kto: Dr Henry Armitage | Dotyczy: Fragment dziennika Wilbura Whateleya | Trop: Ostrzeżenie przed formułą z 751 strony]',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '📜 DZIENNIK WILBURA WHATELEYA',
      'Dziś w nocy nadeszło wołanie z wzgórz...',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '[Co robisz?]',
    ].join('\n');

    const sections = parseIntoSections(text);
    expect(sections).toHaveLength(3);
    expect(sections[0].type).toBe('narrative');
    expect(sections[1].type).toBe('handout');
    expect(sections[1].stickyNote).toBeDefined();
    expect(sections[1].stickyNote?.who).toBe('Dr Henry Armitage');
    expect(sections[1].stickyNote?.about).toBe('Fragment dziennika Wilbura Whateleya');
    expect(sections[1].stickyNote?.clue).toBe('Ostrzeżenie przed formułą z 751 strony');
    expect(sections[1].content).not.toContain('[NOTATKA_BADACZA:');
    expect(sections[1].content).toContain('Dziś w nocy nadeszło wołanie z wzgórz...');
    expect(sections[2].type).toBe('whisper');
    expect(sections[2].content).toBe('Co robisz?');
  });

  it('poprawnie parsuje wariant angielski [STICKY_NOTE: Who: ... | About: ... | Clue: ...]', () => {
    const text = [
      '[STICKY_NOTE: Who: Inspector Legrasse | About: Raid in the swamps | Clue: Idol made of unknown stone]',
      '📰 ARKHAM ADVERTISER',
      'POLICE DISCOVER STRANGE CULT IN LOUISIANA BAYOUS',
    ].join('\n');

    const sections = parseIntoSections(text);
    expect(sections).toHaveLength(1);
    expect(sections[0].type).toBe('handout');
    expect(sections[0].stickyNote).toEqual({
      who: 'Inspector Legrasse',
      about: 'Raid in the swamps',
      clue: 'Idol made of unknown stone',
    });
    expect(sections[0].content).toContain('POLICE DISCOVER STRANGE CULT');
  });

  it('nie traktuje zwykłej prozy ze słowami Kurier, Telegram, Dziennik jako nagłówka handoutu', () => {
    const text = [
      'Kurier zapukał do drzwi i wręczył ci małą paczkę.',
      'Janusz podszedł bliżej:',
      'Janusz: „Co to jest?”',
      '[Co robisz?]',
    ].join('\n');

    const sections = parseIntoSections(text);
    expect(sections.some((s) => s.type === 'handout')).toBe(false);
    expect(sections[0].type).toBe('narrative');
    expect(sections[1].type).toBe('dialogue');
    expect(sections[1].speaker).toBe('Janusz');
    expect(sections[1].content).toBe('Co to jest?');
  });

  it('detectHandoutType nie traktuje słów SZANOWNY ani DROGI w zwykłym tekście jako listu', () => {
    expect(detectHandoutType('Drogi przyjacielu, musimy porozmawiać')).toBe('note');
    expect(detectHandoutType('Szanowny Pan Jan podszedł do okna')).toBe('note');
    expect(detectHandoutType('✉️ POUFNY LIST')).toBe('letter');
    expect(detectHandoutType('LIST Z MISKATONIC')).toBe('letter');
    expect(detectHandoutType('OFFICIAL LETTER')).toBe('letter');
  });

  it('nie połyka dialogów NPC wewnątrz listu lub niedomkniętego dokumentu', () => {
    const text = [
      'Otwierasz kopertę i czytasz:',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '📜 DOKUMENT ŚLEDCZY: LIST DO ARCHIWUM',
      'Spotkajmy się jutro o północy pod starym dębem.',
      'Janusz: „Nie podoba mi się to, doktorze.”',
      '[Co robisz?]',
    ].join('\n');

    const sections = parseIntoSections(text);
    const handout = sections.find((s) => s.type === 'handout');
    const dialogue = sections.find((s) => s.type === 'dialogue');

    expect(handout).toBeDefined();
    expect(handout?.content).toContain('Spotkajmy się jutro');
    expect(handout?.content).not.toContain('Janusz:');

    expect(dialogue).toBeDefined();
    expect(dialogue?.content).toContain('Nie podoba mi się to, doktorze.');
  });

  it('zamyka handout przed dialogiem z interpunkcją po zamykającym cudzysłowie', () => {
    const text = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '📜 DOKUMENT ŚLEDCZY: LIST',
      'Treść dokumentu.',
      'Helena Krawczyk: „To już wszystko”.',
    ].join('\n');

    const sections = parseIntoSections(text);
    expect(sections).toHaveLength(2);
    expect(sections[0].type).toBe('handout');
    expect(sections[0].content).toContain('Treść dokumentu.');
    expect(sections[0].content).not.toContain('Helena Krawczyk:');
    expect(sections[1]).toMatchObject({
      type: 'dialogue',
      speaker: 'Helena Krawczyk',
      content: 'To już wszystko',
      punctuationAfterQuote: '.',
    });
  });

  it('poprawnie parsuje przesyłkę pocztową PRZESYŁKA EKSPRESOWA – POCZTA POLSKA z oddzieleniem narracji po separatorze', () => {
    const text = [
      '[NOTATKA_BADACZA: Kto: Urząd Pocztowy Warszawa 1 | Dotyczy: Zapieczętowana przesyłka ekspresowa | Trop: Koperta zabezpieczona lakiem / zawartość nieznana do momentu otwarcia]',
      'PRZESYŁKA EKSPRESOWA – POCZTA POLSKA',
      '----------------------------------------',
      'OD: Ministerstwo Spraw Wewnętrznych, Warszawa',
      'DO: Dr Janusz Kowalski, Archiwum Akt Dawnych',
      '',
      'PILNE: Dokumenty dotyczące incydentu w Wilczym Jarze.',
      '----------------------------------------',
      'Na biurku unosi się zapach laku i wilgotnego papieru.',
      '[Co robisz?]',
    ].join('\n');

    const sections = parseIntoSections(text);
    expect(sections).toHaveLength(3);

    // Sekcja 0: handout listu z notatką badacza
    expect(sections[0].type).toBe('handout');
    expect(sections[0].handoutType).toBe('letter');
    expect(sections[0].stickyNote).toBeDefined();
    expect(sections[0].stickyNote?.who).toBe('Urząd Pocztowy Warszawa 1');
    expect(sections[0].stickyNote?.about).toBe('Zapieczętowana przesyłka ekspresowa');
    expect(sections[0].stickyNote?.clue).toBe('Koperta zabezpieczona lakiem / zawartość nieznana do momentu otwarcia');
    expect(sections[0].content).toContain('PRZESYŁKA EKSPRESOWA – POCZTA POLSKA');
    expect(sections[0].content).toContain('PILNE: Dokumenty dotyczące incydentu w Wilczym Jarze.');
    expect(sections[0].content).not.toContain('Na biurku unosi się zapach laku');

    // Sekcja 1: czysta narracja po separatorze, bez kresek ASCII w prozie
    expect(sections[1].type).toBe('narrative');
    expect(sections[1].content).toBe('Na biurku unosi się zapach laku i wilgotnego papieru.');
    expect(sections[1].content).not.toMatch(/[-─━═]{3,}/);

    // Sekcja 2: szept / pytanie końcowe
    expect(sections[2].type).toBe('whisper');
    expect(sections[2].content).toBe('Co robisz?');
  });

  it('poprawnie klasyfikuje nagłówki pocztowe i blankiety w detectHandoutType', () => {
    expect(detectHandoutType('PRZESYŁKA EKSPRESOWA – POCZTA POLSKA')).toBe('letter');
    expect(detectHandoutType('PRZESYŁKA POLECONA')).toBe('letter');
    expect(detectHandoutType('POCZTA POLSKA')).toBe('letter');
    expect(detectHandoutType('BLANKIET POCZTOWY')).toBe('telegram');
    expect(detectHandoutType('BLANKIET TELEGRAFICZNY')).toBe('telegram');
  });

  it('oddziela narrację po separatorze markdown (---) bez wylewania kresek do prozy', () => {
    const text = [
      'PRZESYŁKA EKSPRESOWA – POCZTA POLSKA',
      'Poufna korespondencja urzędowa.',
      '---',
      'Krople deszczu uderzają o parapet.',
    ].join('\n');

    const sections = parseIntoSections(text);
    expect(sections).toHaveLength(2);
    expect(sections[0].type).toBe('handout');
    expect(sections[0].handoutType).toBe('letter');
    expect(sections[0].content).toContain('Poufna korespondencja urzędowa.');
    expect(sections[1].type).toBe('narrative');
    expect(sections[1].content).toBe('Krople deszczu uderzają o parapet.');
    expect(sections[1].content).not.toContain('---');
  });

  it('zamyka handout separatorem, nawet gdy treść listu zawiera słowa kluczowe typu plan, policja, raport', () => {
    const text = [
      'PRZESYŁKA EKSPRESOWA – POCZTA POLSKA',
      '----------------------------------------',
      'Nasz plan zakłada ukrycie się przed policją.',
      'Dołączam raport i mapę ewakuacji.',
      '----------------------------------------',
      'Na biurku unosi się zapach laku i wilgotnego papieru.',
      '[Co robisz?]',
    ].join('\n');

    const sections = parseIntoSections(text);
    expect(sections).toHaveLength(3);
    expect(sections[0].type).toBe('handout');
    expect(sections[0].handoutType).toBe('letter');
    expect(sections[0].content).toContain('Nasz plan zakłada ukrycie się przed policją.');
    expect(sections[0].content).toContain('Dołączam raport i mapę ewakuacji.');
    expect(sections[0].content).not.toContain('Na biurku unosi się zapach laku');

    expect(sections[1].type).toBe('narrative');
    expect(sections[1].content).toBe('Na biurku unosi się zapach laku i wilgotnego papieru.');

    expect(sections[2].type).toBe('whisper');
    expect(sections[2].content).toBe('Co robisz?');
  });

  it('poprawnie parsuje otwierający separator --- przed nagłówkiem handoutu bez traktowania go jako dialog', () => {
    const text = [
      '---',
      'PRZESYŁKA EKSPRESOWA – POCZTA POLSKA',
      '---',
      'Tajemnicza treść listu.',
      '---',
      'Narracja po liście.',
    ].join('\n');

    const sections = parseIntoSections(text);
    expect(sections).toHaveLength(2);
    expect(sections.some((s) => s.type === 'dialogue')).toBe(false);
    expect(sections[0].type).toBe('handout');
    expect(sections[0].handoutType).toBe('letter');
    expect(sections[0].content).toContain('Tajemnicza treść listu.');
    expect(sections[1].type).toBe('narrative');
    expect(sections[1].content).toBe('Narracja po liście.');
  });

  it('poprawnie parsuje dedykowany tag [HANDOUT:slug] z wydzieleniem sekcji (Issue #649)', () => {
    const text = [
      'Wchodzicie do archiwum.',
      '[HANDOUT:teczka-sb-klin]',
      'W pokoju panuje chlod.',
    ].join('\n');

    const sections = parseIntoSections(text);
    expect(sections.length).toBeGreaterThanOrEqual(2);
    const handoutSec = sections.find((s) => s.type === 'handout');
    expect(handoutSec).toBeDefined();
    expect(handoutSec?.handoutSlug).toBe('teczka-sb-klin');
  });

  it('detectHandoutType poprawnie rozpoznaje typ map dla map i planow (Issue #649)', () => {
    expect(detectHandoutType('mapa-walimia')).toBe('map');
    expect(detectHandoutType('PLAN PIWNIC')).toBe('map');
    expect(detectHandoutType('🗺️ Szkic terenu')).toBe('map');
    expect(detectHandoutType('floorplan-hospital')).toBe('map');
  });

  it('poprawnie parsuje 3+ sasiadujace tagi [HANDOUT:slug] bez spacji jako osobne sekcje', () => {
    const text = '[HANDOUT:slug1][HANDOUT:slug2][HANDOUT:slug3]';
    const sections = parseIntoSections(text);
    expect(sections).toHaveLength(3);
    expect(sections.every((s) => s.type === 'handout')).toBe(true);
    expect(sections.map((s) => s.handoutSlug)).toEqual(['slug1', 'slug2', 'slug3']);
    expect(sections.some((s) => s.type === 'whisper')).toBe(false);
  });

  it('zachowuje powiazanie [NOTATKA_BADACZA] z [HANDOUT:<slug>] przy normalizacji', () => {
    const text = [
      '[NOTATKA_BADACZA: Kto: Dr Armitage | Dotyczy: Akta | Trop: Slad]',
      '[HANDOUT:akta-sprawy]',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'Tresc akt.',
    ].join('\n');
    const sections = parseIntoSections(text);
    const handout = sections.find((s) => s.type === 'handout' && s.handoutSlug === 'akta-sprawy');
    expect(handout).toBeDefined();
    expect(handout?.stickyNote?.who).toBe('Dr Armitage');
    expect(handout?.stickyNote?.about).toBe('Akta');
    expect(handout?.stickyNote?.clue).toBe('Slad');
  });

  it('poprawnie parsuje tag [DOWÓD:slug] oraz [EVIDENCE:slug] jako sekcję handoutu (Issue #661)', () => {
    const text = [
      'Badacz przeszukuje biurko Knotta.',
      '[DOWÓD:clue-01-knott-keys]',
      'Mosiężne klucze leżą obok wizytówki.',
    ].join('\n');
    const sections = parseIntoSections(text);
    const handout = sections.find((s) => s.type === 'handout');
    expect(handout).toBeDefined();
    expect(handout?.handoutSlug).toBe('clue-01-knott-keys');

    const textEn = [
      'Investigator examines the evidence.',
      '[EVIDENCE:clue-02-boston-globe-1918]',
    ].join('\n');
    const sectionsEn = parseIntoSections(textEn);
    const handoutEn = sectionsEn.find((s) => s.type === 'handout');
    expect(handoutEn).toBeDefined();
    expect(handoutEn?.handoutSlug).toBe('clue-02-boston-globe-1918');
  });

  it('parsuje dialog z kropką po cudzysłowie i zachowuje rozmówcę oraz interpunkcję', () => {
    const sections = parseIntoSections('Helena Krawczyk: „Góra dała zielone światło na odcinek”.');

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      type: 'dialogue',
      speaker: 'Helena Krawczyk',
      content: 'Góra dała zielone światło na odcinek',
      punctuationAfterQuote: '.',
    });
  });

  it('łączy rozmówcę z kwestią w nowej linii także przy interpunkcji za cudzysłowem', () => {
    const sections = parseIntoSections('Helena Krawczyk:\n„Góra dała zielone światło na odcinek”.');

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      type: 'dialogue',
      speaker: 'Helena Krawczyk',
      content: 'Góra dała zielone światło na odcinek',
      punctuationAfterQuote: '.',
    });
  });

  it.each(['.', '!', '?', ',', ';', ':', '…'])(
    'zachowuje znak %s po zamykającym cudzysłowie dialogu',
    (punctuation) => {
      const sections = parseIntoSections(`Helena: „Wiadomość”${punctuation}`);

      expect(sections[0]).toMatchObject({
        type: 'dialogue',
        speaker: 'Helena',
        content: 'Wiadomość',
        punctuationAfterQuote: punctuation,
      });
    }
  );

  it('parsuje dialog bez podpisu z kropką po zamykającym cudzysłowie', () => {
    const sections = parseIntoSections('„Wiadomość bez podpisu”.');

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      type: 'dialogue',
      content: 'Wiadomość bez podpisu',
      punctuationAfterQuote: '.',
    });
  });
});

