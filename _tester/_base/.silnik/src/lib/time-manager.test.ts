import { timeManager } from './time-manager';

describe('timeManager weather state', () => {
  beforeEach(() => {
    timeManager.setWeather('Lekka mgła, rześkie powietrze');
  });

  test('should return default weather state', () => {
    expect(timeManager.getWeather()).toBe('Lekka mgła, rześkie powietrze');
  });

  test('should update weather state via setWeather', () => {
    timeManager.setWeather('Gęsta ulewa i pioruny');
    expect(timeManager.getWeather()).toBe('Gęsta ulewa i pioruny');
  });

  test('should trim whitespace when setting weather', () => {
    timeManager.setWeather('   Gęsta mgła nad Arkham   ');
    expect(timeManager.getWeather()).toBe('Gęsta mgła nad Arkham');
  });

  test('should ignore empty weather strings', () => {
    timeManager.setWeather('Początkowa pogoda');
    timeManager.setWeather('   ');
    expect(timeManager.getWeather()).toBe('Początkowa pogoda');
  });
});

describe('timeManager.resetForAdventure - dynamic start dates and weather', () => {
  test('ustawia dokładną datę i pogodę, gdy przygoda ma zdefiniowane startDate i initialWeather', () => {
    const adventure = {
      id: 'cien-nad-prabutami',
      title: 'Cień nad Prabutami',
      era: 'prl' as const,
      yearRange: '1973-1974',
      startDate: {
        year: 1973,
        month: 9, // Październik (0-indexed)
        day: 18,
        hour: 19,
        minute: 30,
      },
      initialWeather: 'Zimna mżawka i gęsty smog nad Elblągiem',
    };

    timeManager.resetForAdventure(adventure);
    const time = timeManager.getTime();

    expect(time.year).toBe(1973);
    expect(time.month).toBe(9); // Październik
    expect(time.day).toBe(18);
    expect(time.hour).toBe(19);
    expect(time.minute).toBe(30);
    expect(timeManager.getWeather()).toBe('Zimna mżawka i gęsty smog nad Elblągiem');
  });

  test('parsuje startDate w formacie stringa ISO lub daty tekstowej', () => {
    const adventure = {
      id: 'tajemnica-pendnika-lagiewki',
      title: 'Tajemnica Pędnika',
      era: 'custom' as const,
      yearRange: '1995-1999',
      startDate: '1996-05-12T14:15',
      initialWeather: 'Ciepłe majowe popołudnie, bezwietrznie',
    };

    timeManager.resetForAdventure(adventure);
    const time = timeManager.getTime();

    expect(time.year).toBe(1996);
    expect(time.month).toBe(4); // Maj (0-indexed)
    expect(time.day).toBe(12);
    expect(time.hour).toBe(14);
    expect(time.minute).toBe(15);
    expect(timeManager.getWeather()).toBe('Ciepłe majowe popołudnie, bezwietrznie');
  });

  test('wykrywa porę roku/miesiąc z opisu/haczyka i dobiera nastrojową datę oraz pogodę zamiast 14 stycznia', () => {
    const adventure = {
      id: 'jesienny-rytual',
      title: 'Jesienny Rytuał',
      era: 'classic' as const,
      yearRange: '1925',
      hook: 'Późną jesienią 1925 roku w lasach Arkham zaczynają znikać wędrowcy...',
      description: 'Listopadowe mgły otulają dolinę Miskatonic.',
      tone: 'noir' as const,
    };

    timeManager.resetForAdventure(adventure);
    const time = timeManager.getTime();

    expect(time.year).toBe(1925);
    // Wykryto listopad lub jesień - nie może być styczeń (0) ani dzień 14
    expect(time.month).toBe(10); // Listopad (0-indexed)
    expect(time.hour).toBe(19); // Ton noir -> zmierzch (19:00)
    expect(timeManager.getWeather()).toMatch(/mgł|deszcz|chłód|wilgoć/i);
  });

  test('dla tonu noir/purist bez podanej godziny ustawia zmierzch (19:00), a dla pulp poranek (09:30)', () => {
    const pulpAdventure = {
      id: 'pulp-ekspedycja',
      title: 'Pulp Ekspedycja',
      era: 'classic' as const,
      yearRange: '1930',
      tone: 'pulp' as const,
    };

    timeManager.resetForAdventure(pulpAdventure);
    const timePulp = timeManager.getTime();
    expect(timePulp.hour).toBe(9);
    expect(timePulp.minute).toBe(30);

    const noirAdventure = {
      id: 'noir-sprawa',
      title: 'Noir Sprawa',
      era: 'noir' as const,
      yearRange: '1946',
      tone: 'noir' as const,
    };

    timeManager.resetForAdventure(noirAdventure);
    const timeNoir = timeManager.getTime();
    expect(timeNoir.hour).toBe(19);
    expect(timeNoir.minute).toBe(0);
  });
});


test('previews a pushed time cost across a year boundary without changing the campaign', () => {
  timeManager.setTime({year:1925,month:11,day:31,hour:23,minute:50});
  const before=timeManager.getSnapshot();
  const stored=localStorage.getItem('coc7_game_time');
  expect(timeManager.previewAdvanceTime(20)).toEqual({year:1926,month:0,day:1,hour:0,minute:10});
  expect(timeManager.getSnapshot()).toEqual(before);
  expect(localStorage.getItem('coc7_game_time')).toBe(stored);
  expect(timeManager.advanceTime(20)).toEqual({year:1926,month:0,day:1,hour:0,minute:10});
});


test('restores deadline and weather after reload while retaining English date formatting', () => {
  const snapshot = {
    time: { year: 1973, month: 9, day: 18, hour: 19, minute: 30 },
    weather: 'Cold rain',
    deadline: { year: 1973, month: 9, day: 19, hour: 19, minute: 30 },
    deadlineTotalHours: 24,
  };
  timeManager.restoreSnapshot(snapshot);
  jest.isolateModules(() => {
    const reloaded = jest.requireActual<typeof import('./time-manager')>('./time-manager').timeManager;
    expect(reloaded.getSnapshot()).toEqual(snapshot);
    expect(reloaded.formatDate('en')).toBe('October 18, 1973');
    expect(reloaded.formatForPrompt('en')).toContain('[CURRENT TIME: October 18, 1973, 19:30, Thursday');
    expect(reloaded.formatDate('pl')).toBe('18 Października 1973');
  });
});

test('resetting an English adventure clears a restored deadline and keeps localized fallback weather', () => {
  timeManager.restoreSnapshot({
    time: { year: 1973, month: 9, day: 18, hour: 19, minute: 30 },
    weather: 'Old weather',
    deadline: { year: 1973, month: 9, day: 19, hour: 19, minute: 30 },
    deadlineTotalHours: 24,
  });
  timeManager.resetForAdventure({
    id: 'synthetic', startDate: '1893-12-01T10:00',
  }, 'en');
  expect(timeManager.getDeadline()).toBeNull();
  expect(timeManager.getWeather()).toBe('Bitter frost, grey snow and freezing wind');
  expect(timeManager.formatDate('en')).toBe('December 1, 1893');
});
