import {
  extractSkillTests,
  extractHazardEvents,
  extractSpellCastEvents,
  extractOpposedMagicEvents,
  extractTomeStudyEvents,
  extractSkillResults,
  extractMeleeAttackReferences,
  stripMeleeAttackTags,
  extractRefereeVetoEvents,
  stripRefereeVetoTags,
} from './mechanics-parser';

describe('ATAK_WRĘCZ', () => {
  it('parsuje ścisły tag referencyjny i nie przyjmuje pól mechanicznych', () => {
    expect(extractMeleeAttackReferences(
      '[ATAK_WRĘCZ: napastnik=npc-1 | cel=@Anna Kowalska | atak=knife | zamiar=twardy cios]'
    )).toEqual([{
      attackerNpcId: 'npc-1',
      targetCharacterName: 'Anna Kowalska',
      attackOptionId: 'knife',
      intent: 'twardy cios',
    }]);
    expect(extractMeleeAttackReferences(
      '[ATAK_WRĘCZ: napastnik=npc-1 | cel=@Anna | atak=knife | zamiar=cios | obrażenia=99]'
    )).toEqual([]);
  });

  it('ukrywa pełny i częściowo streamowany tag przed graczem', () => {
    expect(stripMeleeAttackTags('Kultysta rusza.\n[ATAK_WRĘCZ: napastnik=npc-1')).toBe('Kultysta rusza.');
    expect(stripMeleeAttackTags('Kultysta rusza.\n[ATAK_WRĘCZ: napastnik=npc-1 | cel=@Anna | atak=fist | zamiar=cios]')).toBe('Kultysta rusza.');
  });
});

describe('extractSkillTests - duet', () => {
  it('zachowuje zgodność ze starym tagiem solo', () => {
    const [test] = extractSkillTests(
      '[TEST: Spostrzegawczość | zwykły | | Rozglądasz się po pokoju]'
    );

    expect(test).toMatchObject({
      skillName: 'Spostrzegawczość',
      characterName: undefined,
    });
    expect(test.groupId).toBeUndefined();
  });

  it('odczytuje adresata i grupuje testy z jednej odpowiedzi', () => {
    const tests = extractSkillTests(
      '[TEST:@Margaret Sullivan: Spostrzegawczość | zwykły | | Szuka śladu]\n' +
        '[TEST:@Prof. William Dyer: Nasłuchiwanie | trudny | Ciemność:-1 | Słucha odgłosów]'
    );

    expect(tests).toHaveLength(2);
    expect(tests[0]).toMatchObject({
      characterName: 'Margaret Sullivan',
      skillName: 'Spostrzegawczość',
    });
    expect(tests[1]).toMatchObject({
      characterName: 'Prof. William Dyer',
      skillName: 'Nasłuchiwanie',
    });
    expect(tests[0].groupId).toBeTruthy();
    expect(tests[1].groupId).toBe(tests[0].groupId);
  });
});

describe('extractSkillResults (WYNIK) - duet & solo', () => {
  it('parsuje wyniki testów solo bez adresata', () => {
    const [res] = extractSkillResults(
      '[WYNIK: Spostrzegawczość | 34 ≤ 55 | SUKCES]'
    );
    expect(res).toBeDefined();
    expect(res.skillName).toBe('Spostrzegawczość');
    expect(res.characterName).toBeUndefined();
    expect(res.shouldMark).toBe(true);
    expect(res.result).toBe('regular');
  });

  it('parsuje wyniki testów duet z prefiksem @Imię', () => {
    const results = extractSkillResults(
      '[WYNIK:@Margaret Sullivan: Spostrzegawczość | 34 ≤ 55 | SUKCES]\n' +
        '[WYNIK:@Tomasz: Nasłuchiwanie | 67 ≤ 45 | SUKCES | LUCK]'
    );
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      characterName: 'Margaret Sullivan',
      skillName: 'Spostrzegawczość',
      shouldMark: true,
      usedLuck: false,
    });
    expect(results[1]).toMatchObject({
      characterName: 'Tomasz',
      skillName: 'Nasłuchiwanie',
      shouldMark: false,
      usedLuck: true,
    });
  });

  it('blokuje oznaczanie umiejętności do rozwoju przy sukcesie z kością premiową (CoC 7e RAW s. 105)', () => {
    const results = extractSkillResults(
      '[WYNIK: Spostrzegawczość | 22 ≤ 55 | SUKCES | +1 kość bonusowa]\n' +
        '[WYNIK: Broń Palna | 15 ≤ 50 | SUKCES | kość premiowa]\n' +
        '[WYNIK: @Arthur: Przekonywanie | 30 ≤ 60 | SUKCES | BONUS]'
    );
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      skillName: 'Spostrzegawczość',
      shouldMark: false,
      usedBonus: true,
    });
    expect(results[0].reason).toContain('kością premiową');

    expect(results[1]).toMatchObject({
      skillName: 'Broń Palna',
      shouldMark: false,
      usedBonus: true,
    });
    expect(results[1].reason).toContain('kością premiową');

    expect(results[2]).toMatchObject({
      characterName: 'Arthur',
      skillName: 'Przekonywanie',
      shouldMark: false,
      usedBonus: true,
    });
    expect(results[2].reason).toContain('kością premiową');
  });
});

describe('extractHazardEvents (CoC 7e RAW)', () => {
  it('poprawnie parsuje tag zagrożenia upadkiem z wysokości', () => {
    const [hazard] = extractHazardEvents(
      'Podłoga pęka pod ciężarem!\n[ZAGROŻENIE: typ=upadek | wys=6m | obrona=Skakanie | Załamanie stropu]'
    );

    expect(hazard).toBeDefined();
    expect(hazard.type).toBe('falling');
    expect(hazard.fallHeightMeters).toBe(6);
    expect(hazard.defensiveSkill).toBe('Skakanie');
    expect(hazard.description).toContain('Załamanie stropu');
  });

  it('poprawnie parsuje truciznę z nazwą i potęgą', () => {
    const [hazard] = extractHazardEvents(
      'W kielichu unosi się zapach gorzkich migdałów.\n[ZAGROŻENIE: typ=trucizna | nazwa=Cyjanek | potega=90 | opis=Zatrute wino]'
    );

    expect(hazard).toBeDefined();
    expect(hazard.type).toBe('poison');
    expect(hazard.poisonName).toBe('Cyjanek');
    expect(hazard.poisonPotency).toBe(90);
    expect(hazard.defensiveSkill).toBe('Kondycja');
  });

  it('usuwa surowy klucz description i parsuje parametry RAW', () => {
    const [hazard] = extractHazardEvents(
      '[HAZARD: type=fall | height=4m | surface=hard | description=Broken fire escape]'
    );
    expect(hazard).toMatchObject({
      type: 'falling',
      fallHeightMeters: 4,
      surface: 'hard',
      description: 'Broken fire escape',
    });
    expect(hazard.description).not.toContain('description=');
  });

  it('parsuje kwas, tonięcie i kategorię trucizny', () => {
    expect(extractHazardEvents('[HAZARD: type=acid | potency=strong | desc=Vitriol]')[0])
      .toMatchObject({ type: 'acid', acidPotency: 'immersion' });
    expect(extractHazardEvents('[HAZARD: type=drowning | desc=Flooded tunnel]')[0])
      .toMatchObject({ type: 'drowning', airlessKind: 'water' });
    expect(extractHazardEvents('[HAZARD: type=poison | severity=lethal | desc=Cyanide]')[0])
      .toMatchObject({ type: 'poison', poisonSeverity: 'lethal' });
  });

  it('poprawnie obsługuje adresata w duecie', () => {
    const [hazard] = extractHazardEvents(
      '[ZAGROŻENIE:@Arthur Pendelton: typ=ogien | intensywnosc=major | Płonące belki]'
    );

    expect(hazard).toBeDefined();
    expect(hazard.characterName).toBe('Arthur Pendelton');
    expect(hazard.type).toBe('fire');
    expect(hazard.fireIntensity).toBe('major');
  });
});

describe('extractSpellCastEvents (CoC 7e RAW & Poradniki MG)', () => {
  it('parsuje poprawnie tag z kluczami, adresatem i rzutem spornym', () => {
    const [spell] = extractSpellCastEvents(
      '[CZAR: @Harvey Walters: id=wither-limb | alias=Pieśń Bólu | cel=Kultysta | pow=55 | opis=Klątwa usychającego ramienia]'
    );

    expect(spell).toBeDefined();
    expect(spell.characterName).toBe('Harvey Walters');
    expect(spell.spellId).toBe('wither-limb');
    expect(spell.alias).toBe('Pieśń Bólu');
    expect(spell.targetName).toBe('Kultysta');
    expect(spell.targetPow).toBe(55);
    expect(spell.description).toBe('Klątwa usychającego ramienia');
  });

  it('parsuje składnię pozycyjną bez prefiksu adresata', () => {
    const [spell] = extractSpellCastEvents('[CZAR: flesh-ward | Cielesna Tarcza | Ochrona przed ciosami]');

    expect(spell).toBeDefined();
    expect(spell.spellId).toBe('flesh-ward');
    expect(spell.alias).toBe('Cielesna Tarcza');
    expect(spell.description).toBe('Ochrona przed ciosami');
  });

  it('obsługuje tag angielski [SPELL:...]', () => {
    const [spell] = extractSpellCastEvents('[SPELL: id=dominate | alias=Dominate | target=Guard | pow=40]');

    expect(spell).toBeDefined();
    expect(spell.spellId).toBe('dominate');
    expect(spell.alias).toBe('Dominate');
    expect(spell.targetName).toBe('Guard');
    expect(spell.targetPow).toBe(40);
  });
});

describe('extractTomeStudyEvents (CoC 7e RAW & Poradniki MG)', () => {
  it('parsuje poprawnie tag z kluczami, adresatem i akcją wstępnego przeglądu', () => {
    const [tome] = extractTomeStudyEvents(
      '[TOM: @Harvey Walters: id=necronomicon-latin | akcja=skimming | tytul=Necronomicon]'
    );

    expect(tome).toBeDefined();
    expect(tome.characterName).toBe('Harvey Walters');
    expect(tome.tomeId).toBe('necronomicon-latin');
    expect(tome.action).toBe('skimming');
    expect(tome.title).toBe('Necronomicon');
  });

  it('parsuje sprawdzenie referencyjne z tematem poszukiwań w śledztwie', () => {
    const [tome] = extractTomeStudyEvents(
      '[TOM: @Arthur: id=de-vermis-mysteris | akcja=reference | temat=wskrzeszenie umarłych]'
    );

    expect(tome).toBeDefined();
    expect(tome.characterName).toBe('Arthur');
    expect(tome.tomeId).toBe('de-vermis-mysteris');
    expect(tome.action).toBe('reference');
    expect(tome.topic).toBe('wskrzeszenie umarłych');
  });

  it('obsługuje tag angielski [TOME:...] z akcją study', () => {
    const [tome] = extractTomeStudyEvents(
      '[TOME: @Eibon: id=book-of-eibon-english | action=study]'
    );

    expect(tome).toBeDefined();
    expect(tome.characterName).toBe('Eibon');
    expect(tome.tomeId).toBe('book-of-eibon-english');
    expect(tome.action).toBe('study');
  });

  it('ignoruje tagi bez identyfikatora tomu', () => {
    const tomes = extractTomeStudyEvents('[TOM: ]');
    expect(tomes).toHaveLength(0);
  });
});

describe('extractOpposedMagicEvents (CoC 7e RAW s. 99)', () => {
  it('parsuje tag z kluczami, adresatem i parametrami starcia', () => {
    const [opposed] = extractOpposedMagicEvents(
      '[OBRONA_MAGIA: @Harvey Walters: rzucajacy=Kultysta Silas | pow=65 | czar=dominate | nazwa=Dominacja | opis=Kultysta próbuje przełamać Twój umysł]'
    );

    expect(opposed).toBeDefined();
    expect(opposed.characterName).toBe('Harvey Walters');
    expect(opposed.attackerName).toBe('Kultysta Silas');
    expect(opposed.attackerPow).toBe(65);
    expect(opposed.spellId).toBe('dominate');
    expect(opposed.spellName).toBe('Dominacja');
    expect(opposed.description).toBe('Kultysta próbuje przełamać Twój umysł');
  });

  it('parsuje składnię pozycyjną obrony przed magią', () => {
    const [opposed] = extractOpposedMagicEvents(
      '[OBRONA_MAGIA: Czarnoksiężnik | 70 | wither-limb | Uschnięcie Kończyny | Złowrogi rytuał]'
    );

    expect(opposed).toBeDefined();
    expect(opposed.attackerName).toBe('Czarnoksiężnik');
    expect(opposed.attackerPow).toBe(70);
    expect(opposed.spellId).toBe('wither-limb');
    expect(opposed.spellName).toBe('Uschnięcie Kończyny');
    expect(opposed.description).toBe('Złowrogi rytuał');
  });

  it('obsługuje tag angielski [OPPOSED_MAGIC:...]', () => {
    const [opposed] = extractOpposedMagicEvents(
      '[OPPOSED_MAGIC: @Arthur: attacker=Sorcerer | pow=80 | spell=Dominate | name=Dominate]'
    );

    expect(opposed).toBeDefined();
    expect(opposed.characterName).toBe('Arthur');
    expect(opposed.attackerName).toBe('Sorcerer');
    expect(opposed.attackerPow).toBe(80);
    expect(opposed.spellId).toBe('dominate');
    expect(opposed.spellName).toBe('Dominate');
  });
});

describe('extractRefereeVetoEvents & stripRefereeVetoTags (CoC 7e RAW & Issue #380)', () => {
  it('parsuje poprawnie tag weta sędziego z kluczami, typem i alternatywami', () => {
    const text = '[WETO_SEDZIEGO: typ=anachronizm | powod=Smartfony nie istniały w 1920 r. | alternatywy=Telefon naścienny z korbką; Telegraf; Posłaniec]';
    const [veto] = extractRefereeVetoEvents(text);

    expect(veto).toBeDefined();
    expect(veto.type).toBe('anachronism');
    expect(veto.reason).toBe('Smartfony nie istniały w 1920 r.');
    expect(veto.suggestedAlternatives).toEqual([
      'Telefon naścienny z korbką',
      'Telegraf',
      'Posłaniec',
    ]);
  });

  it('parsuje angielski tag [REFEREE_VETO:...]', () => {
    const text = '[REFEREE_VETO: type=impossible | reason=Cannot dodge bullets point blank | alternatives=Take cover; Drop prone]';
    const [veto] = extractRefereeVetoEvents(text);

    expect(veto).toBeDefined();
    expect(veto.type).toBe('impossible');
    expect(veto.reason).toBe('Cannot dodge bullets point blank');
    expect(veto.suggestedAlternatives).toEqual([
      'Take cover',
      'Drop prone',
    ]);
  });

  it('czyści tagi weta z surowego tekstu narracji', () => {
    const raw = 'Próbujesz wyciągnąć telefon. [WETO_SEDZIEGO: typ=anachronizm | powod=Brak technologii] Co robisz dalej?';
    const cleaned = stripRefereeVetoTags(raw);

    expect(cleaned).toBe('Próbujesz wyciągnąć telefon.  Co robisz dalej?');
  });
});




describe('hazards never invent a fall height',()=>{
 it('rejects the actual Prabuty travel tag with an explicit zero height',()=>{
  expect(extractHazardEvents('[ZAGROŻENIE: @Tomasz Nowicki | typ=upadek | wys=0m | podloze=normalne | opis=Nocna podróż i chłód prowincji]')).toEqual([]);
 });
 it.each(['','0m','-3m','NaN','infinite','około bez pomiaru','3m lub 9m'])('rejects missing or invalid height %s',height=>{
  expect(extractHazardEvents('[HAZARD: type=fall | '+(height?'height='+height+' | ':'')+'description=Travel]')).toEqual([]);
 });
 it('does not turn an unknown hazard into a fall',()=>{
  expect(extractHazardEvents('[ZAGROŻENIE: typ=chłód | opis=Nocna podróż]')).toEqual([]);
 });
 it('preserves a real positive measured fall including its fractional height',()=>{
  expect(extractHazardEvents('[HAZARD: type=fall | height=3.5m | description=Broken stair]')[0]).toMatchObject({type:'falling',fallHeightMeters:3.5});
 });
});
