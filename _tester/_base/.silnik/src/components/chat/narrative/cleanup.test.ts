import { cleanupContent } from './cleanup';
import { formatNarrative } from './formatter';
import { renderToStaticMarkup } from 'react-dom/server';

describe('cleanupContent', () => {
  it('usuwa inline SFX bez pozostawienia nawiasu i bez ucinania dalszej narracji', () => {
    const input = 'Trzask rozlega się niczym wystrzał z pistoletu [SFX: camera_shutter]\n\nTadeusz: „Co pan robi?”';
    const cleaned = cleanupContent(input);
    expect(cleaned).toBe('Trzask rozlega się niczym wystrzał z pistoletu \n\nTadeusz: „Co pan robi?”');
    const markup = formatNarrative(input).map(node => renderToStaticMarkup(node)).join('');
    expect(markup).toContain('niczym wystrzał z pistoletu');
    expect(markup).toContain('Co pan robi?');
    expect(markup).not.toContain('[');
  });

  it('usuwa pełny angielski tag SFX i zachowuje tekst po nim w tej samej linii', () => {
    expect(cleanupContent('A flash. [SFX: camera_shutter] The room falls silent.'))
      .toBe('A flash.  The room falls silent.');
  });
  it('wycina tag [KONIEC_SESJI:POTWIERDZENIE] z tekstu narracji', () => {
    const input = 'Fabuła dochodzi do końca. Mrok spowija gabinet.\n\n[KONIEC_SESJI:POTWIERDZENIE]';
    const output = cleanupContent(input);
    expect(output).not.toContain('[KONIEC_SESJI:POTWIERDZENIE]');
    expect(output).toBe('Fabuła dochodzi do końca. Mrok spowija gabinet.');
  });

  it('nie ucina pytania [Co robisz?] przy zapytaniu o finałową akcję', () => {
    const input = 'Cienie gęstnieją przy drzwiach. Ostatni promień słońca znika za horyzontem.\n\n[Co robisz?]';
    const output = cleanupContent(input);
    expect(output).toContain('[Co robisz?]');
  });

  it('wycina kompletny angielski blok JOURNAL z narracji', () => {
    const input = 'The phone rings.\n\n[JOURNAL:clue:Telephone]\nA caller interrupts the morning.\n[/JOURNAL]';

    expect(cleanupContent(input)).toBe('The phone rings.');
  });

  it('wycina osierocony znacznik zamykający JOURNAL', () => {
    const input = 'The phone rings.[/JOURNAL]';

    expect(cleanupContent(input)).toBe('The phone rings.');
  });

  it('zachowuje angielskie pytanie narracyjne w nawiasach', () => {
    const input = 'The door opens.\n\n[What do you do?]';

    expect(cleanupContent(input)).toContain('[What do you do?]');
  });

  it('wycina różnorodne formy promptów obrazów wyciekające z LLM', () => {
    const cases = [
      '**Prompt:** Mroczny pokój',
      '**Prompt LLM:** Zjawa w lesie',
      'Prompt graficzny: Cień'
    ];
    cases.forEach(input => {
      expect(cleanupContent(input)).toBe('');
    });
  });

  it('wycina tagi protokołu BOP oraz ich ucięte linie bez nawiasów', () => {
    const inputWithBrackets = `[MYŚLI_MG: plan działania | MASKA_NPC: uprzejmy profesor, skrywa szaleństwo | RETRO_ZIARNO: pył na mankietach | KORELACJA: pasuje do zbrodni | ECHO_AKCJI: policja krąży wokół]
Kroki cichną w korytarzu.`;
    expect(cleanupContent(inputWithBrackets)).toBe('Kroki cichną w korytarzu.');

    const inputTruncated = `MASKA_NPC: ukryty motyw
RETRO_ZIARNO: zapach ozonu
KORELACJA: trop prowadzi do piwnicy
ECHO_AKCJI: portier obserwuje badacza
Na biurku leży stary telegram.`;
    expect(cleanupContent(inputTruncated)).toBe('Na biurku leży stary telegram.');
  });

  it('formatNarrative poprawnie ekstrahuje MYŚLI_MG z zagnieżdżonymi nawiasami w trybie Director Mode', () => {
    const input = `[MYŚLI_MG: plan [serious] działania | MASKA_NPC: profesor [calm]]
Wkraczasz do gabinetu.`;
    const nodes = formatNarrative(input, undefined, undefined, true);
    expect(nodes.length).toBeGreaterThan(0);
    // Sprawdź czy sekcja director-notes została poprawnie wygenerowana
    const nonDirectorNodes = formatNarrative(input, undefined, undefined, false);
    expect(nonDirectorNodes.length).toBeLessThan(nodes.length);
  });

  it('zamienia tag [LOKACJA_WYCZERPANA] oraz [LOCATION_EXHAUSTED] na whisper w czacie', () => {
    const inputPl = 'Przeszukujesz szuflady, ale nic więcej tu nie ma.\n\n[LOKACJA_WYCZERPANA]\n\n[Co robisz?]';
    const outputPl = cleanupContent(inputPl);
    expect(outputPl).toContain('[Lokacja zbadana wyczerpująco]');
    expect(outputPl).not.toContain('[LOKACJA_WYCZERPANA]');

    const inputEn = 'You search the shelves thoroughly.\n\n[LOCATION_EXHAUSTED: Archives]\n\n[What do you do?]';
    const outputEn = cleanupContent(inputEn);
    expect(outputEn).toContain('[Lokacja zbadana wyczerpująco]');
    expect(outputEn).not.toContain('[LOCATION_EXHAUSTED');
  });

  it('nie usuwa tagu [NOTATKA_BADACZA] z narracji aby parser sekcji mógł utworzyć Sticky Note', () => {
    const input = '[NOTATKA_BADACZA: Kto: Dr Armitage | Dotyczy: Przekład z łaciny | Trop: Ostrzeżenie przed formułą]\n📰 KURIER ARKHAM\nWczorajszej nocy doszło do włamania.';
    const output = cleanupContent(input);
    expect(output).toContain('[NOTATKA_BADACZA:');
  });

  it('zamienia tag [RAPORT_AKTU] oraz [ACT_REPORT] na diegetyczny whisper w czacie (Mechanika 8)', () => {
    const inputPl = 'Podsumowujecie dotychczasowe śledztwo.\n\n[RAPORT_AKTU: Akt 1: Początek]\nFAKTY:\n- Zbrodnia w dokach\n[/RAPORT_AKTU]\n\n[Co robisz?]';
    const outputPl = cleanupContent(inputPl);
    expect(outputPl).toContain('[Zaktualizowano raport aktu]');
    expect(outputPl).not.toContain('[RAPORT_AKTU');

    const inputEn = 'Investigation proceeds.\n\n[ACT_REPORT: Act 2: Coven]\nFACTS:\n- Book found\n[/ACT_REPORT]\n\n[What do you do?]';
    const outputEn = cleanupContent(inputEn);
    expect(outputEn).toContain('[Zaktualizowano raport aktu]');
    expect(outputEn).not.toContain('[ACT_REPORT');
  });

  it('automatycznie rozdziela dialogi i narracje podwójną nową linią', () => {
    const input = 'Wszedłeś do pokoju i zamknąłeś drzwi.\nJanusz: „Musimy uważać na zbiega!”\nCisza zaległa w całym korytarzu.';
    const output = cleanupContent(input);
    expect(output).toBe('Wszedłeś do pokoju i zamknąłeś drzwi.\n\nJanusz: „Musimy uważać na zbiega!”\n\nCisza zaległa w całym korytarzu.');
  });

  it('zachowuje tag [HANDOUT:<slug>] w czystej narracji (Issue #649)', () => {
    const input = 'Na biurku proboszcza lezy dokument:\n[HANDOUT:teczka-sb-klin]\nCo robicie dalej?';
    const output = cleanupContent(input);
    expect(output).toContain('[HANDOUT:teczka-sb-klin]');
  });
});



test.each([
 '[THOUGHTS: hidden culprit | NPC_MASK: guarded [calm] | CORRELATION: secret]\nThe door creaks.',
 '[THOUGHTS: hidden culprit | NPC_MASK: guarded | ENEMY_RE\n\nThe door creaks.',
])('English keeper-only planning never reaches rendered player prose: %s',text=>{
 expect(cleanupContent(text)).toBe('The door creaks.');
 const html=formatNarrative(text,undefined,undefined,false).map(node=>renderToStaticMarkup(node)).join('');
 expect(html).toContain('The door creaks.');expect(html).not.toMatch(/hidden culprit|NPC_MASK|THOUGHTS/);
});
