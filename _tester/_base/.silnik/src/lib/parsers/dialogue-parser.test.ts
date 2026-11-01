import { extractAttributedDialogueSpans } from './dialogue-parser';

describe('extractAttributedDialogueSpans', () => {
  it('zwraca dokładne zakresy podpisanych cytatów bez otaczającej narracji', () => {
    const text = 'Zegar tyka. Helena: „Przeczytaj raport dr. Nowaka”. Dr Smith: "Understood"! Drzwi się zamykają.';
    const spans = extractAttributedDialogueSpans(text);

    expect(spans.map(span => ({ speaker: span.speaker, text: span.text }))).toEqual([
      { speaker: 'Helena', text: 'Przeczytaj raport dr. Nowaka' },
      { speaker: 'Dr Smith', text: 'Understood' },
    ]);
    expect(spans.map(span => text.slice(span.start, span.end))).toEqual([
      'Helena: „Przeczytaj raport dr. Nowaka”.', 'Dr Smith: "Understood"!',
    ]);
  });

  it('obsługuje podpis markdown i cytat wielowierszowy bez dzielenia zdań', () => {
    expect(extractAttributedDialogueSpans('**Helena:** „Pierwsze zdanie.\nDrugie zdanie”.')[0])
      .toMatchObject({ speaker: 'Helena', text: 'Pierwsze zdanie.\nDrugie zdanie', punctuationAfterQuote: '.' });
  });

  it('nie przypisuje mówcy cytowanemu tytułowi ani niedomkniętej kwestii', () => {
    expect(extractAttributedDialogueSpans('Czyta gazetę „Wieczór”.')).toEqual([]);
    expect(extractAttributedDialogueSpans('Helena: „Urwana kwestia')).toEqual([]);
  });

  it('zachowuje pełne imię po skróconym angielskim tytule z kropką', () => {
    expect(extractAttributedDialogueSpans('Dr. Smith: “The report is ready”.')[0])
      .toMatchObject({ speaker: 'Dr. Smith', text: 'The report is ready' });
  });
});
