import {
  extractJournalTags,
  synthesizeClueFact,
  extractNpcTags,
  extractItemTags,
  parseClueProvenance,
  inferClueProvenance,
  extractSceneChangeTag,
  extractSceneCardTag,
  extractLocationExhaustedTag,
  extractActReportTag,
  isBanalSensoryObservation,
} from './journal-parser';
import { extractLatestTagLocation } from './event-parser';
import { appendJournalFromText, appendJournalToParty } from '../journal/apply-journal-tags';
import type { Character } from '../types';

describe('English game protocol', () => {
  it('persists English JOURNAL tags without translating player content', () => {
    expect(
      extractJournalTags(
        '[JOURNAL:clue:The sealed cellar]Cold air escapes through the wall.[/JOURNAL]'
      )
    ).toEqual([
      expect.objectContaining({
        type: 'clue',
        title: 'The sealed cellar',
        content: 'Cold air escapes through the wall.',
      }),
    ]);
  });

  it('parses [JOURNAL:case:Beginning the investigation] as type case', () => {
    expect(
      extractJournalTags(
        '[JOURNAL:case:Beginning the investigation]1-2 sentences about where I am.[/JOURNAL]'
      )
    ).toEqual([
      expect.objectContaining({
        type: 'case',
        title: 'Beginning the investigation',
        content: '1-2 sentences about where I am.',
      }),
    ]);
  });

  it('parses Polish aliases sprawa and cel as type case', () => {
    expect(
      extractJournalTags(
        '[DZIENNIK:sprawa:Początek śledztwa]Gdzie jestem i co mnie tu sprowadza.[/DZIENNIK]'
      )
    ).toEqual([
      expect.objectContaining({
        type: 'case',
        title: 'Początek śledztwa',
        content: 'Gdzie jestem i co mnie tu sprowadza.',
      }),
    ]);

    expect(
      extractJournalTags(
        '[DZIENNIK:cel:Odnaleźć profesora]Profesor zniknął bez śladu.[/DZIENNIK]'
      )
    ).toEqual([
      expect.objectContaining({
        type: 'case',
        title: 'Odnaleźć profesora',
        content: 'Profesor zniknął bez śladu.',
      }),
    ]);
  });

  it('accepts the English LOCATION tag with colon or pipe separator', () => {
    expect(
      extractLatestTagLocation('[LOCATION: Corbitt House: Rain-darkened brick]')
    ).toEqual({ name: 'Corbitt House', description: 'Rain-darkened brick' });

    expect(
      extractLatestTagLocation('[LOCATION: Place Name | Atmosphere & Visual Prompt]')
    ).toEqual({ name: 'Place Name', description: 'Atmosphere & Visual Prompt' });
  });
});

describe('synthesizeClueFact', () => {
  it('usuwa prefiksy i tagi, zwracając czysty 1-zdaniowy fakt', () => {
    const raw =
      'Poszlaka: **W starym kufrze** znaleziono mapę podziemi Arkham z zaznaczonym wejściem. Na biurku leżały też inne papiery.';
    const fact = synthesizeClueFact('Mapa podziemi', raw);

    expect(fact).toBe(
      'W starym kufrze znaleziono mapę podziemi Arkham z zaznaczonym wejściem.'
    );
  });

  it('usuwa tagi markdown i domyka kropką', () => {
    const raw = '*List od Armitage* wskazuje na piwnicę';
    const fact = synthesizeClueFact('List', raw);

    expect(fact).toBe('List od Armitage wskazuje na piwnicę.');
  });

  it('zwraca tytuł jako fallback gdy treść jest pusta', () => {
    expect(synthesizeClueFact('Tajemniczy klucz', '')).toBe('Tajemniczy klucz.');
  });
});

describe('extractNpcTags', () => {
  it('ekstrahuje tagi NPC zarówno z formatu [NPC:] jak i [DZIENNIK:npc:]', () => {
    const raw =
      'Wchodzisz do gabinetu. [NPC: Eleonora Vance: Młoda dziedziczka, blada i przerażona.] ' +
      'Rozmawia z nią stary służący. [DZIENNIK:npc:Barnaba]Stary lokaj rodziny Vance, nieufny wobec obcych.[/DZIENNIK]';

    const npcs = extractNpcTags(raw);
    expect(npcs).toHaveLength(2);
    expect(npcs[0]).toEqual({
      name: 'Eleonora Vance',
      description: 'Młoda dziedziczka, blada i przerażona.',
      who: undefined,
    });
    expect(npcs[1]).toEqual({
      name: 'Barnaba',
      description: 'Stary lokaj rodziny Vance, nieufny wobec obcych.',
      who: undefined,
    });
  });

  it('deduplikuje ten sam NPC występujący wielokrotnie w tej samej turze', () => {
    const raw =
      '[NPC: Eleonora Vance: Opis 1] [DZIENNIK:npc:Eleonora Vance]Opis 2[/DZIENNIK]';
    const npcs = extractNpcTags(raw);
    expect(npcs).toHaveLength(1);
    expect(npcs[0].name).toBe('Eleonora Vance');
  });
});

describe('appendJournalFromText (Zero-Effort Ledger & Dossier Loop)', () => {
  const baseCharacter: Character = {
    id: 'char_test',
    name: 'Edward Carnby',
    str: 50,
    dex: 50,
    con: 50,
    app: 50,
    pow: 50,
    edu: 50,
    siz: 50,
    int: 70,
    luck: 50,
    hp: 10,
    san: 50,
    mp: 10,
    skills: {},
    occupation: 'Detektyw',
    age: 35,
    background: '',
    playerName: 'Jakub',
    isActive: true,
    lastUsed: new Date(),
    notes: '',
    experience: { totalXP: 0, availableXP: 0, earnedThisSession: 0, maxEarnedThisSession: 10 },
    developmentHistory: [],
    journal: [],
  };

  it('przy pierwszym napotkaniu NPC dodaje kartę do dossier i jeden wpis do kroniki', () => {
    const raw = '[NPC: Eleonora Vance: Córka zaginionego profesora.]';
    const updated = appendJournalFromText(baseCharacter, raw, 'msg_1');

    expect(updated.investigatorDossier?.npcs).toHaveLength(1);
    expect(updated.investigatorDossier?.npcs[0].name).toBe('Eleonora Vance');
    expect(updated.investigatorDossier?.npcs[0].firstImpression).toBe(
      'Córka zaginionego profesora.'
    );

    expect(updated.journal).toHaveLength(1);
    expect(updated.journal?.[0].title).toBe('Eleonora Vance');
  });

  it('gdy ten sam NPC pojawia się ponownie, aktualizuje dossier i NIE duplikuje kroniki', () => {
    const raw1 = '[NPC: Eleonora Vance: Córka zaginionego profesora.]';
    const charAfterTurn1 = appendJournalFromText(baseCharacter, raw1, 'msg_1');

    const raw2 = '[DZIENNIK:npc:Eleonora Vance]Przyznała się, że ojciec zostawił szyfr w piwnicy.[/DZIENNIK]';
    const charAfterTurn2 = appendJournalFromText(charAfterTurn1, raw2, 'msg_2');

    // Dossier ma wciąż dokładnie 1 kartę NPC, ale zaktualizowaną o nowe fakty
    expect(charAfterTurn2.investigatorDossier?.npcs).toHaveLength(1);
    expect(charAfterTurn2.investigatorDossier?.npcs[0].keyInformation).toContain(
      'Przyznała się, że ojciec zostawił szyfr'
    );

    // Kronika wciąż ma dokładnie 1 wpis dla tego NPC (brak zaśmiecania kroniki)
    const npcEntriesInJournal = (charAfterTurn2.journal || []).filter(
      (j) => j.type === 'npc' && j.title.toLowerCase().includes('eleonora')
    );
    expect(npcEntriesInJournal).toHaveLength(1);
  });

  it('automatycznie syntetyzuje 1-zdaniowy fakt dla poszlak w dossier i dzienniku', () => {
    const raw =
      '[DZIENNIK:trop:Zakrwawiony sztylet]W szufladzie biurka znaleziono stary sztylet ze śladami zaschniętej krwi. Na ostrzu wyryto symbol gwiazdy.[/DZIENNIK]';
    const updated = appendJournalFromText(baseCharacter, raw, 'msg_3');

    expect(updated.investigatorDossier?.clues).toHaveLength(1);
    const clue = updated.investigatorDossier?.clues[0];
    expect(clue?.title).toBe('Zakrwawiony sztylet');
    expect(clue?.description).toBe(
      'W szufladzie biurka znaleziono stary sztylet ze śladami zaschniętej krwi.'
    );
    expect(clue?.status).toBe('confirmed');

    // W dzienniku również zapisany jest zwięzły fakt
    expect(updated.journal?.[0].content).toBe(
      'W szufladzie biurka znaleziono stary sztylet ze śladami zaschniętej krwi.'
    );
  });

  it('appendJournalToParty kieruje wpisy z prefiksem @Imię do właściwego badacza w duecie', () => {
    const char1 = { ...baseCharacter, id: 'char_1', name: 'Margaret Sullivan', journal: [] };
    const char2 = { ...baseCharacter, id: 'char_2', name: 'Tomasz Czarnecki', journal: [] };

    const raw =
      '[DZIENNIK:@Tomasz:notatka:Zapiski w notesie]Zanotowano podejrzane godziny odjazdów pociągu.[/DZIENNIK]\n' +
      '[DZIENNIK:trop:Ślad buta]Odcisk podeszwy w błocie.[/DZIENNIK]';

    const result = appendJournalToParty([char1, char2], char1, raw, 'msg_party_1');

    expect(result.changed).toBe(true);

    const updatedChar1 = result.characters.find((c) => c.id === 'char_1');
    const updatedChar2 = result.characters.find((c) => c.id === 'char_2');

    // char1 (aktywny badacz) otrzymuje wpis bez prefiksu ("Ślad buta")
    expect(updatedChar1?.journal?.some((j) => j.title === 'Ślad buta')).toBe(true);
    expect(updatedChar1?.journal?.some((j) => j.title === 'Zapiski w notesie')).toBe(false);

    // char2 (Tomasz) otrzymuje wpis z prefiksem @Tomasz
    expect(updatedChar2?.journal?.some((j) => j.title === 'Zapiski w notesie')).toBe(true);
    expect(updatedChar2?.journal?.some((j) => j.title === 'Ślad buta')).toBe(false);
  });

  it('unieważnia starszą poszlakę, gdy nowy wpis dziennika jawnie deklaruje zastąpienie (Fact Supersession)', () => {
    const raw1 = '[DZIENNIK:trop:Alibi dozorcy]Dozorca twierdzi, że całą noc spał w stróżówce.[/DZIENNIK]';
    const charWithClue1 = appendJournalFromText(baseCharacter, raw1, 'msg_super_1');

    expect(charWithClue1.investigatorDossier?.clues[0].status).toBe('confirmed');

    const raw2 = '[DZIENNIK:trop:Zdemaskowanie dozorcy]Dozorca przyznał się do kłamstwa. | zastępuje: Alibi dozorcy[/DZIENNIK]';
    const charWithClue2 = appendJournalFromText(charWithClue1, raw2, 'msg_super_2');

    const oldClue = charWithClue2.investigatorDossier?.clues.find((c) => c.title === 'Alibi dozorcy');
    const newClue = charWithClue2.investigatorDossier?.clues.find((c) => c.title === 'Zdemaskowanie dozorcy');

    expect(oldClue?.status).toBe('superseded');
    expect(oldClue?.supersededBy).toBe(newClue?.id);
    expect(charWithClue2.investigatorDossier?.clues).toHaveLength(2);
    expect(newClue?.status).toBe('confirmed');
  });

  describe('Epistemic Clue Provenance', () => {
    it('parseClueProvenance rozpoznaje słowa kluczowe PL i EN oraz prefiksy źródła', () => {
      expect(parseClueProvenance('observed')).toBe('observed');
      expect(parseClueProvenance('zaobserwowane')).toBe('observed');
      expect(parseClueProvenance('oględziny')).toBe('observed');
      expect(parseClueProvenance('źródło: naoczne')).toBe('observed');
      expect(parseClueProvenance('source: observation')).toBe('observed');

      expect(parseClueProvenance('testimony')).toBe('testimony');
      expect(parseClueProvenance('zeznanie')).toBe('testimony');
      expect(parseClueProvenance('usłyszane')).toBe('testimony');
      expect(parseClueProvenance('źródło: świadek')).toBe('testimony');
      expect(parseClueProvenance('proweniencja: rozmowa')).toBe('testimony');

      expect(parseClueProvenance('deduction')).toBe('deduction');
      expect(parseClueProvenance('dedukcja')).toBe('deduction');
      expect(parseClueProvenance('wniosek')).toBe('deduction');
      expect(parseClueProvenance('źródło: analiza')).toBe('deduction');

      expect(parseClueProvenance('handout')).toBe('handout');
      expect(parseClueProvenance('dokument')).toBe('handout');
      expect(parseClueProvenance('wycinek')).toBe('handout');
      expect(parseClueProvenance('source: letter')).toBe('handout');

      expect(parseClueProvenance('nieznane_zrodlo')).toBeUndefined();
      expect(parseClueProvenance('')).toBeUndefined();
    });

    it('inferClueProvenance automatycznie wnioskuje proweniencję z treści i kategorii', () => {
      // Kategoria dokument -> handout
      expect(inferClueProvenance('Notatki', 'Tajemnicze formuły', 'document')).toBe('handout');
      // Kategoria testimony -> testimony
      expect(inferClueProvenance('Relacja', 'Twierdzi, że uciekł', 'testimony')).toBe('testimony');

      // Słowa kluczowe dokumentów
      expect(
        inferClueProvenance('Dziennik Corbitta', 'Zapiski z 1890 roku')
      ).toBe('handout');
      expect(
        inferClueProvenance('Wycinek z Boston Globe', 'Artykuł o zniknięciu')
      ).toBe('handout');

      // Słowa kluczowe zeznań
      expect(
        inferClueProvenance('Dozorca', 'Twierdzi, że słyszał kroki na piętrze')
      ).toBe('testimony');
      expect(
        inferClueProvenance('Rozmowa z barmanem', 'Świadek powiedział o dziwnym kliencie')
      ).toBe('testimony');

      // Słowa kluczowe dedukcji
      expect(
        inferClueProvenance('Hipoteza', 'Analiza wskazuje na truciznę')
      ).toBe('deduction');
      expect(
        inferClueProvenance('Wniosek śledczego', 'Badacz połączył fakty i wywnioskował motyw')
      ).toBe('deduction');

      // Domyślna obserwacja fizyczna
      expect(
        inferClueProvenance('Ślady pazurów', 'Głębokie rysy na dębowych drzwiach piwnicy')
      ).toBe('observed');
    });

    it('appendJournalFromText zapisuje jawną proweniencję z tagu DZIENNIK', () => {
      const raw =
        '[DZIENNIK:trop:Ślady pazurów]Głębokie bruzdy na futrynie | zaobserwowane | M[/DZIENNIK]';
      const updated = appendJournalFromText(baseCharacter, raw, 'msg_prov_1');

      const clue = updated.investigatorDossier?.clues.find((c) => c.title === 'Ślady pazurów');
      expect(clue).toBeDefined();
      expect(clue?.provenance).toBe('observed');
      expect(clue?.miceType).toBe('milieu');
      expect(clue?.description).toBe('Głębokie bruzdy na futrynie.');
    });

    it('appendJournalFromText zapisuje proweniencję z prefiksem źródło:', () => {
      const raw =
        '[DZIENNIK:trop:Zeznanie Dozorcy]Widział postać w czarnym płaszczu | źródło: zeznanie | I[/DZIENNIK]';
      const updated = appendJournalFromText(baseCharacter, raw, 'msg_prov_2');

      const clue = updated.investigatorDossier?.clues.find((c) => c.title === 'Zeznanie Dozorcy');
      expect(clue).toBeDefined();
      expect(clue?.provenance).toBe('testimony');
      expect(clue?.miceType).toBe('inquiry');
    });

    it('appendJournalFromText stosuje heurystykę inferClueProvenance gdy brak jawnej proweniencji', () => {
      const raw =
        '[DZIENNIK:trop:Wycinek z Boston Globe]Artykuł o niewyjaśnionym zgonie w Bostonie.[/DZIENNIK]';
      const updated = appendJournalFromText(baseCharacter, raw, 'msg_prov_3');

      const clue = updated.investigatorDossier?.clues.find((c) => c.title === 'Wycinek z Boston Globe');
      expect(clue).toBeDefined();
      expect(clue?.provenance).toBe('handout');
    });

    it('appendJournalFromText obsługuje angielskie tagi JOURNAL z proweniencją', () => {
      const raw =
        '[JOURNAL:clue:Corbitt Journal]Written in archaic Latin cipher | handout | inquiry[/JOURNAL]';
      const updated = appendJournalFromText(baseCharacter, raw, 'msg_prov_en');

      const clue = updated.investigatorDossier?.clues.find((c) => c.title === 'Corbitt Journal');
      expect(clue).toBeDefined();
      expect(clue?.provenance).toBe('handout');
      expect(clue?.miceType).toBe('inquiry');
    });

    it('inferClueProvenance nie myli balistyki i zeznań specjalistów z handoutami (zabezpieczenie rdzenia "list")', () => {
      // "balistyka" zawiera "list", ale jest badaniem fizycznym/oględzinami (observed)
      expect(
        inferClueProvenance('Ekspertyza balistyczna', 'Ślad prochu na naboju wskazuje kaliber .38')
      ).toBe('observed');

      // "specjalista" zawiera "list", ale kontekst to zeznanie świadka (testimony)
      expect(
        inferClueProvenance(
          'Zeznanie specjalisty',
          'Świadek, wybitny specjalista kryminalistyki, zeznaje że widział uciekającego podejrzanego.'
        )
      ).toBe('testimony');

      // "zamówienie" zawiera "mówi", ale bez zeznań/rozmowy nie powinno być testimony
      expect(
        inferClueProvenance('Stare zamówienie', 'W piwnicy leżą zakurzone skrzynie z węglem z 1920 roku.')
      ).toBe('observed');
    });

    it('parseClueProvenance rozpoznaje frazy wielowyrazowe z prefiksem źródło:', () => {
      expect(parseClueProvenance('źródło: zeznania świadka')).toBe('testimony');
      expect(parseClueProvenance('źródło: obserwacja miejsca zbrodni')).toBe('observed');
      expect(parseClueProvenance('źródło: dedukcja po teście INT')).toBe('deduction');
      expect(parseClueProvenance('source: document from archive')).toBe('handout');
    });

    it('appendJournalFromText rozpoznaje proweniencję z 4. segmentu tagu z dwukropkiem i nie zaśmieca inGameDate', () => {
      const raw =
        '[DZIENNIK:trop:Ślad prochu:obserwacja]Ślad prochu wokół rany postrzałowej.[/DZIENNIK]';
      const updated = appendJournalFromText(baseCharacter, raw, 'msg_prov_colon');

      const clue = updated.investigatorDossier?.clues.find((c) => c.title === 'Ślad prochu');
      expect(clue).toBeDefined();
      expect(clue?.provenance).toBe('observed');
      expect(clue?.inGameDate).toBeUndefined();

      const journalEntry = updated.journal?.find((j) => j.title === 'Ślad prochu');
      expect(journalEntry?.inGameDate).toBeUndefined();
    });

    it('appendJournalFromText oczyszcza tytuł poszlaki z metadanych pipe zarówno w dossier, jak i w kronice', () => {
      const raw =
        '[DZIENNIK:trop:Dziwny zapach | zeznanie]Świadek poczuł zapach siarki przy kominku.[/DZIENNIK]';
      const updated = appendJournalFromText(baseCharacter, raw, 'msg_prov_clean_title');

      const clue = updated.investigatorDossier?.clues.find((c) => c.title === 'Dziwny zapach');
      expect(clue).toBeDefined();
      expect(clue?.title).toBe('Dziwny zapach');
      expect(clue?.provenance).toBe('testimony');

      // Tytuł w kronice nie może zawierać śmieci "| zeznanie"
      const journalEntry = updated.journal?.find((j) => j.title.includes('Dziwny zapach'));
      expect(journalEntry?.title).toBe('Dziwny zapach');
    });
  });

  describe('extractItemTags & Potrójny Byt Handoutów', () => {
    it('ekstrahuje tagi przedmiotów z formatów [PRZEDMIOT:], [ITEM:] i [DZIENNIK:przedmiot:]', () => {
      const raw =
        'Na stole leży list. [PRZEDMIOT: List Wilcoxa: Rękopis pokryty pismem w języku starogreckim] ' +
        'W szufladzie znaleziono bilet. [ITEM: Bilet kolejowy | dokument | nowy | Bilet na pociąg do Bostonu] ' +
        'Obok leży stary klucz. [DZIENNIK:przedmiot:Złoty klucz]Ciężki mosiężny klucz do krypty.[/DZIENNIK]';

      const items = extractItemTags(raw);
      expect(items).toHaveLength(3);
      expect(items[0]).toEqual({
        name: 'List Wilcoxa',
        description: 'Rękopis pokryty pismem w języku starogreckim',
        category: undefined,
        who: undefined,
      });
      expect(items[1].name).toBe('Bilet kolejowy');
      expect(items[1].category).toBe('dokument');
      expect(items[2].name).toBe('Złoty klucz');
      expect(items[2].description).toBe('Ciężki mosiężny klucz do krypty.');
    });

    it('appendJournalFromText automatycznie tworzy poszlakę z proweniencją handout dla dokumentów', () => {
      const baseChar: Character = {
        id: 'char_handout_test',
        name: 'Thomas Malone',
        str: 50, dex: 50, con: 50, app: 50, pow: 50, edu: 50, siz: 50, int: 70, luck: 50, hp: 10, san: 50,
        skills: {}, developmentHistory: [], notes: '',
      } as unknown as Character;

      const raw =
        'Odnaleziono ważny dokument. [PRZEDMIOT: Dziennik Corbitta: Zapiski w języku łacińskim ukryte pod deskami podłogi.]';
      const updated = appendJournalFromText(baseChar, raw, 'msg_handout_item');

      // Sprawdź wpis w kronice (typ 'item' dla fizycznego rekwizytu)
      const journalItem = updated.journal?.find((j) => j.title === 'Dziennik Corbitta');
      expect(journalItem).toBeDefined();
      expect(journalItem?.type).toBe('item');

      // Sprawdź syntetyczny fakt w dossier z proweniencją handout
      const clue = updated.investigatorDossier?.clues.find((c) => c.title === 'Dziennik Corbitta');
      expect(clue).toBeDefined();
      expect(clue?.provenance).toBe('handout');
      expect(clue?.category).toBe('document');
      expect(clue?.status).toBe('confirmed');
      expect(clue?.description).toContain('Zapiski w języku łacińskim');

      // Zgodnie z Issue #565: dokument trafia do dossier i kroniki, ale NIE trafia samowolnie do ekwipunku
      expect(updated.equipment ?? []).toHaveLength(0);
    });

    it('appendJournalFromText nie dodaje samowolnie przedmiotów do ekwipunku postaci (Issue #565)', () => {
      const baseChar: Character = {
        id: 'char_eq_test',
        name: 'Harvey Walters',
        str: 50, dex: 50, con: 50, app: 50, pow: 50, edu: 50, siz: 50, int: 75, luck: 50, hp: 10, san: 50,
        skills: {}, developmentHistory: [], notes: '',
        equipment: [],
      } as unknown as Character;

      const raw =
        'Na stole leży broń i bilet. [PRZEDMIOT: Rewolwer Colt | broń | Niezawodny rewolwer kaliber .38] ' +
        '[ITEM: Bilet kolejowy | dokument | Bilet na pociąg do Arkham]';
      const updated = appendJournalFromText(baseChar, raw, 'msg_eq_test');

      // Żadna rzecz nie trafia do torby sama (Issue #565)
      expect(updated.equipment ?? []).toHaveLength(0);
      expect(updated.journal?.some((j) => j.title === 'Rewolwer Colt')).toBe(true);
      expect(updated.journal?.some((j) => j.title === 'Bilet kolejowy')).toBe(true);
    });

    it('appendJournalFromText dodaje handouty do dossier i kroniki, nie mutując ekwipunku (Issue #565)', () => {
      const baseChar: Character = {
        id: 'char_clue_handout_test',
        name: 'Edward Carnby',
        str: 50, dex: 50, con: 50, app: 50, pow: 50, edu: 50, siz: 50, int: 70, luck: 50, hp: 10, san: 50,
        skills: {}, developmentHistory: [], notes: '',
        equipment: [],
      } as unknown as Character;

      const raw =
        'Na biurku leży [DZIENNIK:trop:List od adwokata | dokument]Panie Walters, proszę o pilny kontakt w sprawie spadku Corbitta.[/DZIENNIK] ' +
        'oraz [DZIENNIK:clue:Wycinek z Arkham Advertiser | handout]Artykuł o tajemniczym pożarze w dokach Bostonu.[/DZIENNIK]';
      const updated = appendJournalFromText(baseChar, raw, 'msg_clue_handout');

      // 1. Sprawdź syntetyczne fakty w dossier
      expect(updated.investigatorDossier?.clues).toHaveLength(2);
      const letterClue = updated.investigatorDossier?.clues.find((c) => c.title === 'List od adwokata');
      expect(letterClue).toBeDefined();
      expect(letterClue?.provenance).toBe('handout');
      expect(letterClue?.category).toBe('document');

      // 2. Ekwipunek postaci MA POZOSTAĆ PUSTY (Issue #565 - brak samowolnego auto-lootu)
      expect(updated.equipment ?? []).toHaveLength(0);

      // 3. Sprawdź zachowanie pełnej treści w kronice (Tier 2 Full Content)
      const journalLetter = updated.journal?.find((j) => j.title === 'List od adwokata');
      expect(journalLetter?.content).toContain('Panie Walters, proszę o pilny kontakt w sprawie spadku Corbitta.');
    });

    it('extractItemTags poprawnie parsuje stan (condition) oraz pipe w tytule tagów DZIENNIK:przedmiot', () => {
      const raw =
        '[PRZEDMIOT: Rewolwer Colt | broń | damaged | Rdzawy rewolwer z zaciętym bębnem] ' +
        '[DZIENNIK:przedmiot:Stara mapa | dokument | new]Świeżo sporządzona mapa podziemi.[/DZIENNIK]';
      const items = extractItemTags(raw);

      expect(items).toHaveLength(2);
      expect(items[0].name).toBe('Rewolwer Colt');
      expect(items[0].category).toBe('broń');
      expect(items[0].condition).toBe('damaged');
      expect(items[0].description).toBe('Rdzawy rewolwer z zaciętym bębnem');

      expect(items[1].name).toBe('Stara mapa');
      expect(items[1].category).toBe('dokument');
      expect(items[1].condition).toBe('new');
      expect(items[1].description).toBe('Świeżo sporządzona mapa podziemi.');
    });

    it('appendJournalFromText nie dodaje postaci (np. Uciekinier z warsztatu, Lucjan Łągiewka) do ekwipunku, nawet jeśli narracja wspomina o dokumentach', () => {
      const baseChar: Character = {
        id: 'char_npc_no_eq',
        name: 'Edward Carnby',
        str: 50, dex: 50, con: 50, app: 50, pow: 50, edu: 50, siz: 50, int: 70, luck: 50, hp: 10, san: 50,
        skills: {}, developmentHistory: [], notes: '',
        equipment: [],
      } as unknown as Character;

      const raw =
        'Zauważasz podejrzanego. [DZIENNIK:trop:Uciekinier z warsztatu]Mężczyzna uciekający ze skórzaną teczką pełną akt i raportów.[/DZIENNIK]' +
        ' Rozmawiasz z konstruktorem. [DZIENNIK:trop:Lucjan Łągiewka]Mężczyzna trzyma w rękach teczkę pełną planów i schematów.[/DZIENNIK]';
      const updated = appendJournalFromText(baseChar, raw, 'msg_npc_clue');

      expect(updated.investigatorDossier?.clues).toHaveLength(2);
      expect(updated.investigatorDossier?.clues[0].title).toBe('Uciekinier z warsztatu');
      expect(updated.investigatorDossier?.clues[1].title).toBe('Lucjan Łągiewka');

      // Żadna postać nie może wylądować w ekwipunku!
      expect(updated.equipment).toHaveLength(0);
    });
  });
});

describe('Reżyseria scen i Karta Akt Śledczych (Issue #402)', () => {
  describe('extractSceneChangeTag', () => {
    it('parsuje prosty tag zmiany sceny w języku polskim', () => {
      const text = 'Wychodzicie na deszczową ulicę. [ZMIANA_SCENY: Szpital św. Marii] Deszcz przybiera na sile.';
      const res = extractSceneChangeTag(text);
      expect(res).not.toBeNull();
      expect(res?.newLocation).toBe('Szpital św. Marii');
      expect(res?.transitionType).toBeUndefined();
    });

    it('parsuje tag z parametrem typu przejścia', () => {
      const text = 'Wsiadacie do powozu. [ZMIANA_SCENY: Pociąg do Bostonu | typ=podróż] Koła stukają miarowo.';
      const res = extractSceneChangeTag(text);
      expect(res).not.toBeNull();
      expect(res?.newLocation).toBe('Pociąg do Bostonu');
      expect(res?.transitionType).toBe('podróż');
    });

    it('parsuje angielski wariant SCENE_CHANGE', () => {
      const text = 'You leave the manor. [SCENE_CHANGE: Miskatonic Library] Shadows lengthen.';
      const res = extractSceneChangeTag(text);
      expect(res).not.toBeNull();
      expect(res?.newLocation).toBe('Miskatonic Library');
    });

    it('zwraca null gdy w tekście brak tagu', () => {
      expect(extractSceneChangeTag('Zwykły opis bez zmiany sceny.')).toBeNull();
    });
  });

  describe('extractSceneCardTag', () => {
    it('parsuje pełną wieloliniową Kartę Akt Śledczych', () => {
      const raw = `
        Koniec przeszukania.
        [KARTA_SCENY: Przeszukanie Gabinetu | Dom Corbitta]
        OSOBY: Eleonora Vance, Lokaj Barnaba
        CO_ZDOBYTO: Mosiężny klucz, Dziennik Westona
        USTALENIA: Weston nie uciekł dobrowolnie, został uprowadzony przed północą.
        CEL: Sprawdzić Magazyn nr 7 w dokach.
        [/KARTA_SCENY]
      `;
      const card = extractSceneCardTag(raw);
      expect(card).not.toBeNull();
      expect(card?.title).toBe('Przeszukanie Gabinetu');
      expect(card?.location).toBe('Dom Corbitta');
      expect(card?.people).toEqual(['Eleonora Vance', 'Lokaj Barnaba']);
      expect(card?.findings).toEqual(['Mosiężny klucz', 'Dziennik Westona']);
      expect(card?.keyTakeaways).toEqual([
        'Weston nie uciekł dobrowolnie, został uprowadzony przed północą.',
      ]);
      expect(card?.nextStep).toBe('Sprawdzić Magazyn nr 7 w dokach.');
    });

    it('parsuje wariant angielski SCENE_CARD z synonimami kluczy', () => {
      const raw = `
        [SCENE_CARD: Vault Breach]
        PEOPLE: Dr. Armitage
        FINDINGS: Ripped page
        SUMMARY: The ward was broken from inside.
        NEXT_STEP: Interview the night guard.
        [/SCENE_CARD]
      `;
      const card = extractSceneCardTag(raw);
      expect(card).not.toBeNull();
      expect(card?.title).toBe('Vault Breach');
      expect(card?.people).toEqual(['Dr. Armitage']);
      expect(card?.findings).toEqual(['Ripped page']);
      expect(card?.keyTakeaways).toEqual(['The ward was broken from inside.']);
      expect(card?.nextStep).toBe('Interview the night guard.');
    });
  });

  describe('Integracja cyklu życia sceny w appendJournalFromText', () => {
    const baseChar: Character = {
      id: 'char_scene_test',
      name: 'Thomas Malone',
      str: 50, dex: 50, con: 50, app: 50, pow: 50, edu: 50, siz: 50, int: 70, luck: 50, hp: 10, san: 50,
      skills: {}, developmentHistory: [], notes: '',
      journal: [],
      equipment: [],
      sceneCards: [],
    } as unknown as Character;

    it('akumuluje tropy i postacie w trwającej scenie, a po ZMIANA_SCENY pieczętuje Kartę Akt', () => {
      // 1. Tura 1: Otwarcie sceny i pierwszy trop
      const tura1 =
        '[LOKACJA: Gabinet Profesora: Kurz i porozrzucane papiery] ' +
        '[NPC: Eleonora Vance: Córka profesora] ' +
        '[DZIENNIK:trop:Zakrwawiony nóż | obserwacja]Nóż rytualny ukryty pod dywanem.[/DZIENNIK]';
      const poTurze1 = appendJournalFromText(baseChar, tura1, 'msg_t1');

      expect(poTurze1.activeScene).toBeDefined();
      expect(poTurze1.activeScene?.location).toBe('Gabinet Profesora');
      expect(poTurze1.activeScene?.people).toContain('Eleonora Vance');
      expect(poTurze1.activeScene?.findings).toContain('Zakrwawiony nóż');
      expect(poTurze1.sceneCards).toHaveLength(0);

      // 2. Tura 2: Zmiana sceny - automatyczne zapieczętowanie karty
      const tura2 =
        'Opuszczacie dom w pośpiechu. [ZMIANA_SCENY: Doki w Bostonie] Zimny wiatr znad oceanu smaga wasze twarze.';
      const poTurze2 = appendJournalFromText(poTurze1, tura2, 'msg_t2');

      // Powinna powstać zapieczętowana karta
      expect(poTurze2.sceneCards).toHaveLength(1);
      const sealed = poTurze2.sceneCards![0];
      expect(sealed.location).toBe('Gabinet Profesora');
      expect(sealed.people).toContain('Eleonora Vance');
      expect(sealed.findings.some((f) => f.includes('Zakrwawiony nóż'))).toBe(true);

      // Wpis w dzienniku typu 'scene'
      const sceneEntry = poTurze2.journal?.find((j) => j.type === 'scene');
      expect(sceneEntry).toBeDefined();
      expect(sceneEntry?.sceneData).toBeDefined();
      expect(sceneEntry?.sceneData?.location).toBe('Gabinet Profesora');

      // Nowa trwająca scena w Dokach
      expect(poTurze2.activeScene?.location).toBe('Doki w Bostonie');
      expect(poTurze2.activeScene?.findings).toHaveLength(0);
    });

    it('pieczętuje scenę natychmiast z jawnego tagu [KARTA_SCENY]', () => {
      const turn = `
        Zabezpieczacie ślady.
        [KARTA_SCENY: Zakończenie Przeszukania | Piwnica]
        OSOBY: Thomas Malone
        CO_ZDOBYTO: Stary medalion
        USTALENIA: W piwnicy odprawiano bluźniercze rytuały.
        CEL: Znaleźć tłumacza inskrypcji.
        [/KARTA_SCENY]
      `;
      const updated = appendJournalFromText(baseChar, turn, 'msg_explicit_card');

      expect(updated.sceneCards).toHaveLength(1);
      const card = updated.sceneCards![0];
      expect(card.title).toBe('Zakończenie Przeszukania');
      expect(card.location).toBe('Piwnica');
      expect(card.keyTakeaways).toEqual(['W piwnicy odprawiano bluźniercze rytuały.']);
      expect(card.nextStep).toBe('Znaleźć tłumacza inskrypcji.');

      const entry = updated.journal?.find((j) => j.type === 'scene');
      expect(entry).toBeDefined();
      expect(entry?.title).toBe('Zakończenie Przeszukania');
    });

    it('appendJournalToParty synchronizuje karty scen dla całej drużyny', () => {
      const charA = { ...baseChar, id: 'char_a', name: 'Badacz A' };
      const charB = { ...baseChar, id: 'char_b', name: 'Badacz B' };

      const turn =
        '[LOKACJA: Magazyn nr 7] ' +
        '[DZIENNIK:trop:Skrzynie z symbolem]Skrzynie oznakowane okiem w trójkącie.[/DZIENNIK] ' +
        '[ZMIANA_SCENY: Ratusz Miejski]';

      const party = appendJournalToParty([charA, charB], charA, turn, 'msg_party_scene');
      expect(party.characters[0].sceneCards).toHaveLength(1);
      expect(party.characters[1].sceneCards).toHaveLength(1);
      expect(party.characters[0].sceneCards![0].location).toBe('Magazyn nr 7');
      expect(party.characters[1].sceneCards![0].location).toBe('Magazyn nr 7');
      expect(party.characters[0].activeScene?.location).toBe('Ratusz Miejski');
      expect(party.characters[1].activeScene?.location).toBe('Ratusz Miejski');
    });

    it('extractLocationExhaustedTag i appendJournalFromText oznaczają lokację jako wyczerpaną (Mechanika 7)', () => {
      const tag1 = extractLocationExhaustedTag('Przeszukano wszystko.\n[LOKACJA_WYCZERPANA]');
      expect(tag1).toBeDefined();

      const tag2 = extractLocationExhaustedTag('[LOCATION_EXHAUSTED: Archiwum]');
      expect(tag2).toBeDefined();
      expect(tag2?.locationName).toBe('Archiwum');

      const turn = '[LOKACJA: Gabinet Profesora] [LOKACJA_WYCZERPANA] Dalsze przeszukiwanie nic nie da.';
      const updated = appendJournalFromText(baseChar, turn, 'msg_exhausted');
      expect(updated.activeScene?.isLocationExhausted).toBe(true);

      const loc = updated.investigatorDossier?.locations?.find((l) => l.name === 'Gabinet Profesora');
      expect(loc?.searchStatus).toBe('thoroughly_searched');
    });

    it('extractActReportTag parsuje ustrukturyzowany raport aktu PL i EN (Mechanika 8)', () => {
      const plText = `
        Zakończyliście badanie biblioteki.
        [RAPORT_AKTU: Akt 1: Śmierć w Bibliotece | Status: W toku | Data: 14 stycznia 1928]
        FAKTY:
        - Bibliotekarz został otruty cyjankiem
        - Z sejfu zniknął egzemplarz De Vermis Mysteriis
        PODEJRZANI:
        - Asystent William (miał klucze do gabinetu)
        - Lord Blackwood (widziany w zaułku)
        LUKI:
        - Kto wyłączył dzwonki alarmowe?
        HIPOTEZA:
        Kradzież zlecili czciciele Dagona przez podstawionego asystenta.
        [/RAPORT_AKTU]
      `;
      const reportPl = extractActReportTag(plText);
      expect(reportPl).toBeDefined();
      expect(reportPl?.actNumber).toBe(1);
      expect(reportPl?.title).toBe('Śmierć w Bibliotece');
      expect(reportPl?.status).toBe('in_progress');
      expect(reportPl?.inGameDate).toBe('14 stycznia 1928');
      expect(reportPl?.confirmedFacts).toHaveLength(2);
      expect(reportPl?.confirmedFacts[0]).toContain('Bibliotekarz został otruty');
      expect(reportPl?.suspects).toHaveLength(2);
      expect(reportPl?.suspects[0]).toContain('Asystent William');
      expect(reportPl?.unresolvedQuestions).toEqual(['Kto wyłączył dzwonki alarmowe?']);
      expect(reportPl?.leadHypothesis).toContain('czciciele Dagona');

      const enText = `
        [ACT_REPORT: Act 2: The Boston Coven | Status: Completed]
        FACTS:
        - The occult bookstore is a facade
        SUSPECTS:
        - Silas Marsh
        QUESTIONS:
        - Where is the basement entrance?
        HYPOTHESIS:
        The meeting takes place at midnight.
        [/ACT_REPORT]
      `;
      const reportEn = extractActReportTag(enText);
      expect(reportEn).toBeDefined();
      expect(reportEn?.actNumber).toBe(2);
      expect(reportEn?.title).toBe('The Boston Coven');
      expect(reportEn?.status).toBe('completed');
      expect(reportEn?.confirmedFacts).toHaveLength(1);
      expect(reportEn?.suspects).toEqual(['Silas Marsh']);
      expect(reportEn?.unresolvedQuestions).toEqual(['Where is the basement entrance?']);
      expect(reportEn?.leadHypothesis).toBe('The meeting takes place at midnight.');
    });

    it('appendJournalFromText i appendJournalToParty zapisują raport aktu w profilu i synchronizują drużynę', () => {
      const turn = `
        [RAPORT_AKTU: Akt 1: Początek Koszmaru | Status: W toku]
        FAKTY:
        - Znaleziono ciało w dokach
        PODEJRZANI:
        - Obed Marsh
        LUKI:
        - Gdzie zniknęła łódź?
        HIPOTEZA:
        Świadek ukrywa się na bagnach.
        [/RAPORT_AKTU]
      `;
      const updated = appendJournalFromText(baseChar, turn, 'msg_act_1');
      expect(updated.actReports).toHaveLength(1);
      expect(updated.actReports![0].actNumber).toBe(1);
      expect(updated.actReports![0].title).toBe('Początek Koszmaru');

      const journalEntry = updated.journal?.find((j) => j.type === 'act_report');
      expect(journalEntry).toBeDefined();
      expect(journalEntry?.actReportData?.actNumber).toBe(1);

      // Aktualizacja tego samego aktu
      const turnUpdate = `
        [RAPORT_AKTU: Akt 1: Początek Koszmaru | Status: Zakończony]
        FAKTY:
        - Znaleziono ciało w dokach
        - Odzyskano dziennik szypra
        PODEJRZANI:
        - Obed Marsh (aresztowany)
        LUKI:
        - Brak luk
        HIPOTEZA:
        Etap pierwszy zamknięty.
        [/RAPORT_AKTU]
      `;
      const updatedTwice = appendJournalFromText(updated, turnUpdate, 'msg_act_1_update');
      expect(updatedTwice.actReports).toHaveLength(1);
      expect(updatedTwice.actReports![0].status).toBe('completed');
      expect(updatedTwice.actReports![0].confirmedFacts).toHaveLength(2);

      // Synchronizacja drużyny
      const charA = { ...baseChar, id: 'char_a', name: 'Badacz A' };
      const charB = { ...baseChar, id: 'char_b', name: 'Badacz B' };
      const party = appendJournalToParty([charA, charB], charA, turn, 'msg_party_act');
      expect(party.characters[0].actReports).toHaveLength(1);
      expect(party.characters[1].actReports).toHaveLength(1);
      expect(party.characters[0].actReports![0].actNumber).toBe(1);
      expect(party.characters[1].actReports![0].actNumber).toBe(1);
    });
  });
});

describe('Filtr anty-inflacyjny poszlak (Issue #568)', () => {
  it('odrzuca banalne obserwacje zmysłowe i atmosferyczne z tagów [DZIENNIK:trop:...]', () => {
    const raw = [
      '[DZIENNIK:trop:Zapach karbolu]W korytarzu czuć silny zapach karbolu i starego papieru.[/DZIENNIK]',
      '[DZIENNIK:trop:Brak dymu z komina]Z komina na dachu nie unosi się żaden dym.[/DZIENNIK]',
      '[DZIENNIK:trop:Przenikliwe zimno]W piwnicy panuje lodowaty chłód i wilgoć.[/DZIENNIK]',
      '[DZIENNIK:trop:Martwa cisza]W całym domu panuje grobowa cisza.[/DZIENNIK]',
      '[DZIENNIK:trop:Uchylone drzwi]Drzwi na końcu korytarza są lekko uchylone.[/DZIENNIK]',
      '[DZIENNIK:trop:Skrzypiąca podłoga]Drewniane deski podłogi cicho skrzypią pod stopami.[/DZIENNIK]',
    ].join('\n');

    expect(extractJournalTags(raw)).toEqual([]);
  });

  it('przepuszcza twarde dowody śledcze nawet jeśli wspominają o drzwiach lub zapachu', () => {
    expect(
      isBanalSensoryObservation(
        'Wyłamany zamek w drzwiach',
        'Drzwi gabinetu mają wyłamany zamek i ślady łomu na futrynie.'
      )
    ).toBe(false);

    expect(
      isBanalSensoryObservation(
        'Zapach gorzkich migdałów przy kieliszku',
        'Analiza chemiczna wykazała truciznę - cyjanek potasu w kieliszku ofiary.'
      )
    ).toBe(false);

    const raw =
      '[DZIENNIK:trop:Zapach karbolu]W korytarzu czuć zapach karbolu.[/DZIENNIK]\n' +
      '[DZIENNIK:trop:Kalka techniczna z R-1]Skradziona dokumentacja techniczna z pieczęcią ściśle tajne.[/DZIENNIK]';

    const extracted = extractJournalTags(raw);
    expect(extracted).toHaveLength(1);
    expect(extracted[0].title).toBe('Kalka techniczna z R-1');
  });
});


