import { fireEvent, render, screen } from '@testing-library/react';
import { MessageCard } from './message-card';
import type { Character, Message } from '@/lib/types';
import { PREDEFINED_CHARACTERS } from '@/lib/immersion/predefined-characters';

const baseMessage: Message = {
  id: 'assistant-partial',
  role: 'assistant',
  content: 'Urwany fragment narracji',
  timestamp: new Date('2026-08-23T12:00:00.000Z'),
};

const baseProps = {
  activeCharacter: null,
  isTTSEnabled: false,
  currentAudio: null,
  stopCurrentAudio: jest.fn(),
  playerColors: new Map<string, string>(),
  onImageClick: jest.fn(),
};

describe('MessageCard - ręczna kontynuacja narracji', () => {
  afterEach(() => {
    delete process.env.NEXT_INTL_TEST_LOCALE;
  });

  it('renders the Game Master label for the English locale', () => {
    process.env.NEXT_INTL_TEST_LOCALE = 'en';

    render(<MessageCard {...baseProps} message={baseMessage} />);

    expect(screen.getByText('Game Master')).toBeInTheDocument();
    expect(screen.queryByText('Mistrz Gry')).not.toBeInTheDocument();
  });

  it('pokazuje akcję tylko dla ostatniego MAX_TOKENS i wywołuje callback', () => {
    const onContinueNarration = jest.fn();
    render(
      <MessageCard
        {...baseProps}
        message={{ ...baseMessage, finishReason: 'MAX_TOKENS' }}
        isLastMessage
        onContinueNarration={onContinueNarration}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Kontynuuj narrację' })
    );
    expect(onContinueNarration).toHaveBeenCalledWith('assistant-partial');
  });

  it.each([
    ['STOP', true],
    ['MAX_TOKENS', false],
  ])('ukrywa akcję dla finishReason=%s, isLast=%s', (finishReason, isLast) => {
    render(
      <MessageCard
        {...baseProps}
        message={{ ...baseMessage, finishReason }}
        isLastMessage={isLast}
        onContinueNarration={jest.fn()}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Kontynuuj narrację' })
    ).not.toBeInTheDocument();
  });

  it('blokuje akcję po pierwszym kliknięciu', () => {
    render(
      <MessageCard
        {...baseProps}
        message={{
          ...baseMessage,
          finishReason: 'MAX_TOKENS',
          continuationRequested: true,
        }}
        isLastMessage
        onContinueNarration={jest.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Kontynuacja zamówiona' })
    ).toBeDisabled();
  });

  it('renderuje wygenerowany obraz na szczycie wiadomości, przed tekstem narracji', () => {
    const { container } = render(
      <MessageCard
        {...baseProps}
        message={{
          ...baseMessage,
          content: 'Tekst narracji po obrazku',
          generatedImages: ['https://example.com/test-scene.jpg'],
          generatedImageTypes: ['scene'],
        }}
      />
    );

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();

    const narrative = container.querySelector('.narrative-content');
    expect(narrative).toBeInTheDocument();

    // Sprawdź kolejność w drzewie DOM: obraz występuje PRZED narracją
    expect(img!.compareDocumentPosition(narrative!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('stosuje dynamiczny filtr CSS odpowiadający danej epoce (getEraImageFilter)', () => {
    const { container } = render(
      <MessageCard
        {...baseProps}
        era="1890s"
        message={{
          ...baseMessage,
          content: 'Wiktoriański kadr',
          generatedImages: ['https://example.com/gaslight.jpg'],
          generatedImageTypes: ['scene'],
        }}
      />
    );

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveStyle({
      filter: 'sepia(0.5) saturate(0.58) contrast(1.06) brightness(0.96)',
    });
  });

  it('renderuje obrazy typu item na pełną szerokość w-full zamiast miniatury w-48 (Issue #569)', () => {
    const { container } = render(
      <MessageCard
        {...baseProps}
        message={{
          ...baseMessage,
          content: 'Odnaleziony artefakt w ciemnościach.',
          generatedImages: ['https://example.com/silver-key.jpg'],
          generatedImageTypes: ['item'],
        }}
      />
    );

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    const imageContainer = img!.parentElement;
    expect(imageContainer).toHaveClass('w-full');
    expect(imageContainer).not.toHaveClass('w-48');
    expect(imageContainer).not.toHaveClass('flex-shrink-0');
    expect(img).toHaveClass('h-auto', 'max-h-[70vh]', 'object-contain', 'bg-black/30');
    expect(img).not.toHaveClass('aspect-square');
  });

  it('renderuje obrazy typu portrait w formacie kompaktowym w-48 sm:w-56 flex-shrink-0', () => {
    const { container } = render(
      <MessageCard
        {...baseProps}
        message={{
          ...baseMessage,
          content: 'Spotykasz profesora Armitage.',
          generatedImages: ['https://example.com/armitage.jpg'],
          generatedImageTypes: ['portrait'],
        }}
      />
    );

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    const imageContainer = img!.parentElement;
    expect(imageContainer).toHaveClass('w-48', 'sm:w-56', 'flex-shrink-0');
    expect(imageContainer).not.toHaveClass('w-full');
    expect(img).toHaveClass('aspect-[3/4]', 'object-cover', 'object-top');
  });

  it('renderuje obraz bez podanego generatedImageTypes na pełną szerokość w-full (bezpieczny fallback)', () => {
    const { container } = render(
      <MessageCard
        {...baseProps}
        message={{
          ...baseMessage,
          content: 'Tajemniczy widok na wrzosowiska.',
          generatedImages: ['https://example.com/moors.jpg'],
        }}
      />
    );

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    const imageContainer = img!.parentElement;
    expect(imageContainer).toHaveClass('w-full');
    expect(imageContainer).not.toHaveClass('w-48');
    expect(img).toHaveClass('h-auto', 'max-h-[70vh]', 'object-contain', 'bg-black/30');
  });

  it('poprawnie obsługuje mieszaną listę obrazów (portrait + item) w jednej wiadomości', () => {
    const { container } = render(
      <MessageCard
        {...baseProps}
        message={{
          ...baseMessage,
          content: 'Profesor podaje ci starożytny sztylet.',
          generatedImages: [
            'https://example.com/armitage.jpg',
            'https://example.com/dagger.jpg',
          ],
          generatedImageTypes: ['portrait', 'item'],
        }}
      />
    );

    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(2);

    // Pierwszy obraz: portrait (kompaktowy)
    const portraitImg = images[0];
    const portraitContainer = portraitImg.parentElement;
    expect(portraitContainer).toHaveClass('w-48', 'sm:w-56', 'flex-shrink-0');
    expect(portraitContainer).not.toHaveClass('w-full');
    expect(portraitImg).toHaveClass('aspect-[3/4]', 'object-cover', 'object-top');

    // Drugi obraz: item (pełna szerokość)
    const itemImg = images[1];
    const itemContainer = itemImg.parentElement;
    expect(itemContainer).toHaveClass('w-full');
    expect(itemContainer).not.toHaveClass('w-48');
    expect(itemImg).toHaveClass('h-auto', 'max-h-[70vh]', 'object-contain', 'bg-black/30');
  });
});

describe('MessageCard - zagrożenia', () => {
  const alice: Character = { ...PREDEFINED_CHARACTERS[0], id: 'alice', name: 'Alice', hp: 12 };
  const bob: Character = { ...PREDEFINED_CHARACTERS[1], id: 'bob', name: 'Bob', hp: 10 };
  const hazardMessage: Message = {
    ...baseMessage,
    id: 'hazard-message',
    content: 'Pod Bobem pęka podłoga.',
    hazardEvents: [{
      id: 'hazard-bob',
      type: 'falling',
      description: 'Krucha podłoga',
      characterName: 'Bob',
      fallHeightMeters: 3,
      surface: 'normal',
    }],
  };

  it('does not expose damage from stale saved metadata when the original tag explicitly has zero fall height',()=>{
    const onCharacterUpdate=jest.fn(),onSendHazardResult=jest.fn();
    render(<MessageCard {...baseProps} message={{...hazardMessage,content:'Przyjazd do Prabut. [ZAGROŻENIE: @Tomasz Nowicki | typ=upadek | wys=0m | podloze=normalne | opis=Nocna podróż i chłód prowincji]'}} activeCharacter={alice} characters={[alice,bob]} onCharacterUpdate={onCharacterUpdate} onSendHazardResult={onSendHazardResult}/>);
    expect(screen.queryByRole('button',{name:'Bez amortyzacji (pełny upadek)'})).not.toBeInTheDocument();
    expect(screen.queryByText('Upadek z wysokości')).not.toBeInTheDocument();
    expect(onCharacterUpdate).not.toHaveBeenCalled();expect(onSendHazardResult).not.toHaveBeenCalled();
  });

  it('does not borrow another investigator fall height and preserves the real completed event id',()=>{
    const oldAlice={...hazardMessage.hazardEvents![0],id:'old-alice',characterName:'Alice',description:'Podróż'};
    render(<MessageCard {...baseProps} message={{...hazardMessage,content:'[HAZARD:@Alice: type=fall | height=0m | description=Podróż] [HAZARD:@Bob: type=fall | height=3m | description=Krucha podłoga]',hazardEvents:[oldAlice,hazardMessage.hazardEvents![0]]}} activeCharacter={alice} characters={[alice,bob]} resolvedHazardIds={new Set(['hazard-bob'])} onCharacterUpdate={jest.fn()} onSendHazardResult={jest.fn()}/>);
    expect(screen.getAllByText('Upadek z wysokości')).toHaveLength(1);
    expect(screen.getByText('Rozstrzygnięto')).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Bez amortyzacji (pełny upadek)'})).not.toBeInTheDocument();
  });

  it('stosuje obrażenia do wskazanego badacza i wysyła stabilny identyfikator', () => {
    const onCharacterUpdate = jest.fn();
    const onSendHazardResult = jest.fn();
    render(
      <MessageCard
        {...baseProps}
        message={hazardMessage}
        activeCharacter={alice}
        characters={[alice, bob]}
        onCharacterUpdate={onCharacterUpdate}
        onSendHazardResult={onSendHazardResult}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Bez amortyzacji (pełny upadek)' }));

    expect(onCharacterUpdate).toHaveBeenCalledTimes(1);
    expect(onCharacterUpdate.mock.calls[0][0].id).toBe('bob');
    expect(onCharacterUpdate.mock.calls[0][0].hp).toBeLessThan(10);
    expect(onSendHazardResult).toHaveBeenCalledWith(expect.stringContaining('id=hazard-bob'));
  });

  it('nie pozwala rozstrzygnąć zdarzenia zapisanego wcześniej w historii', () => {
    render(
      <MessageCard
        {...baseProps}
        message={hazardMessage}
        activeCharacter={alice}
        characters={[alice, bob]}
        resolvedHazardIds={new Set(['hazard-bob'])}
        onCharacterUpdate={jest.fn()}
        onSendHazardResult={jest.fn()}
      />
    );
    expect(screen.getByText('Rozstrzygnięto')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bez amortyzacji (pełny upadek)' })).not.toBeInTheDocument();
  });

  it.each([
    ['acid', 'Substancja żrąca / Kwas', 'Rzuć kośćmi na obrażenia od kwasu'],
    ['drowning', 'Tonięcie', 'Test Kondycji (60%) przeciw uduszeniu'],
  ] as const)('renderuje bezpośrednią kartę dla typu %s', (type, expectedLabel, expectedAction) => {
    render(
      <MessageCard
        {...baseProps}
        message={{
          ...hazardMessage,
          hazardEvents: [{
            id: `hazard-${type}`,
            type,
            description: 'Test zagrożenia',
            characterName: 'Bob',
            ...(type === 'acid' ? { acidPotency: 'splash' as const } : { airlessKind: 'water' as const }),
          }],
        }}
        activeCharacter={alice}
        characters={[alice, bob]}
        onCharacterUpdate={jest.fn()}
        onSendHazardResult={jest.fn()}
      />
    );

    expect(screen.getByText(expectedLabel, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: expectedAction })).toBeInTheDocument();
  });
});

describe('MessageCard - pościg w czacie', () => {
  const alice: Character = { ...PREDEFINED_CHARACTERS[0], id: 'alice', name: 'Alice', hp: 12, dex: 60 };
  const chaseMessage: Message = {
    ...baseMessage,
    id: 'chase-msg',
    content: 'Kultyści depczą ci po piętach w zaułku!',
    chaseState: {
      id: 'chase-msg-state',
      status: 'ongoing',
      round: 1,
      maxRounds: 6,
      turnOrder: ['alice', 'cultist'],
      activeActorId: 'alice',
      participants: [
        {
          id: 'alice',
          name: 'Alice',
          isPlayer: true,
          isFleeing: true,
          mov: 8,
          actionsTotal: 2,
          actionsRemaining: 2,
          segmentIndex: 3,
        },
        {
          id: 'cultist',
          name: 'Kultysta',
          isPlayer: false,
          isFleeing: false,
          mov: 7,
          actionsTotal: 1,
          actionsRemaining: 1,
          segmentIndex: 1,
        },
      ],
      segments: [
        { index: 0, name: 'Lokacja 1' },
        { index: 1, name: 'Lokacja 2' },
        { index: 2, name: 'Lokacja 3' },
        { index: 3, name: 'Zaułek' },
        { index: 4, name: 'Lokacja 5' },
      ],
      logs: [],
    },
  };

  it('renderuje kartę pościgu w strumieniu wiadomości i pozwala wykonać manewr', () => {
    const onChaseManeuver = jest.fn();
    render(
      <MessageCard
        {...baseProps}
        message={chaseMessage}
        activeCharacter={alice}
        characters={[alice]}
        isLastMessage
        onChaseManeuver={onChaseManeuver}
      />
    );

    expect(screen.getByText('Pościg d100 Weird Fiction')).toBeInTheDocument();
    expect(screen.getByText('Runda 1/6')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sprint naprzód/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Brawurowy skrót/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sprint naprzód/i }));
    expect(onChaseManeuver).toHaveBeenCalledWith(
      'sprint',
      expect.objectContaining({ status: 'ongoing' }),
      expect.stringContaining('Alice: Sprint naprzód')
    );
  });
});

describe('MessageCard - czary i rytuały (Issue #252)', () => {
  const alice: Character = {
    ...PREDEFINED_CHARACTERS[0],
    id: 'alice',
    name: 'Alice',
    pow: 60,
    mp: 12,
    hp: 12,
    san: 55,
    magic: {
      schemaVersion: 1,
      belief: 'believer',
      deferredSanLoss: 0,
      knownSpells: {},
      tomeStudies: {},
    },
  };

  const spellMessage: Message = {
    ...baseMessage,
    id: 'spell-message',
    content: 'Pradawna inkantacja odbija się echem w krypcie.',
    spellCastEvents: [
      {
        id: 'spell-cast-1',
        spellId: 'wither-limb',
        alias: 'Pieśń Bólu',
        characterName: 'Alice',
      },
    ],
  };

  it('renderuje kartę zaklęcia z nazwą diegetyczną i pozwala rzucić czar', () => {
    const onCharacterUpdate = jest.fn();
    const onSendSpellResult = jest.fn();

    render(
      <MessageCard
        {...baseProps}
        message={spellMessage}
        activeCharacter={alice}
        characters={[alice]}
        onCharacterUpdate={onCharacterUpdate}
        onSendSpellResult={onSendSpellResult}
      />
    );

    expect(screen.getByText('Pieśń Bólu')).toBeInTheDocument();
    expect(screen.getByText('Uschnięcie Kończyny')).toBeInTheDocument();

    const castBtn = screen.getByRole('button', { name: /Rzuć zaklęcie/i });
    fireEvent.click(castBtn);

    expect(onCharacterUpdate).toHaveBeenCalled();
    expect(onSendSpellResult).toHaveBeenCalledWith(
      expect.stringContaining('[WYNIK_CZARU: id=spell-cast-1')
    );
  });

  it('oznacza kartę jako rozstrzygniętą, gdy id znajduje się w resolvedSpellIds', () => {
    render(
      <MessageCard
        {...baseProps}
        message={spellMessage}
        activeCharacter={alice}
        characters={[alice]}
        resolvedSpellIds={new Set(['spell-cast-1'])}
      />
    );

    expect(screen.getByText(/Inkantacja rozstrzygnięta/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rzuć zaklęcie/i })).not.toBeInTheDocument();
  });

  const tomeMessage: Message = {
    ...baseMessage,
    id: 'tome-message',
    content: 'Na dębowym pulpicie spoczywa ciężki, oprawny w skórę wolumin.',
    tomeStudyEvents: [
      {
        id: 'tome-study-1',
        tomeId: 'necronomicon-latin',
        characterName: 'Alice',
      },
    ],
  };

  it('renderuje kartę tomu Mitów i pozwala wykonać wstępny przegląd', () => {
    const onCharacterUpdate = jest.fn();
    const onSendTomeResult = jest.fn();

    render(
      <MessageCard
        {...baseProps}
        message={tomeMessage}
        activeCharacter={alice}
        characters={[alice]}
        onCharacterUpdate={onCharacterUpdate}
        onSendTomeResult={onSendTomeResult}
      />
    );

    expect(screen.getByText(/Necronomicon/i)).toBeInTheDocument();
    expect(screen.getByText(/Abdul Alhazred/i)).toBeInTheDocument();

    const skimBtn = screen.getByRole('button', { name: /Wstępny przegląd/i });
    fireEvent.click(skimBtn);

    expect(onCharacterUpdate).toHaveBeenCalled();
    expect(onSendTomeResult).toHaveBeenCalledWith(
      expect.stringContaining('[WYNIK_TOMU: id=tome-study-1')
    );
  });

  it('oznacza kartę tomu jako rozstrzygniętą, gdy id znajduje się w resolvedTomeIds', () => {
    render(
      <MessageCard
        {...baseProps}
        message={tomeMessage}
        activeCharacter={alice}
        characters={[alice]}
        resolvedTomeIds={new Set(['tome-study-1'])}
      />
    );

    expect(screen.getByText(/Badanie tomu zakończone/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Wstępny przegląd/i })).not.toBeInTheDocument();
  });

  it('renderuje kartę obrony przed wrogą magią (OpposedMagicCard) i pozwala na rzut obronny', () => {
    const onSendOpposedMagicResult = jest.fn();
    const opposedMessage: Message = {
      id: 'msg-opposed-1',
      role: 'assistant',
      content: 'Wrogi czarownik rzuca zaklęcie!',
      timestamp: new Date(),
      opposedMagicEvents: [
        {
          id: 'opposed-1',
          attackerName: 'Kultysta Silas',
          attackerPow: 65,
          spellId: 'dominate',
          spellName: 'Dominacja',
          characterName: 'Alice',
          description: 'Kultysta próbuje przełamać Twoją wolę.',
        },
      ],
    };

    const { rerender } = render(
      <MessageCard
        {...baseProps}
        message={opposedMessage}
        activeCharacter={alice}
        characters={[alice]}
        onSendOpposedMagicResult={onSendOpposedMagicResult}
      />
    );

    expect(screen.getByText(/Wroga Magia: Starcie Woli/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Broń się siłą woli/i })).toBeInTheDocument();

    // Po rozstrzygnięciu (id w resolvedOpposedMagicIds)
    rerender(
      <MessageCard
        {...baseProps}
        message={opposedMessage}
        activeCharacter={alice}
        characters={[alice]}
        resolvedOpposedMagicIds={new Set(['opposed-1'])}
      />
    );

    expect(screen.getByText(/Starcie woli rozstrzygnięte/i)).toBeInTheDocument();
  });
});

describe('MessageCard - Bliskie starcie wręcz (CombatCard)', () => {
  const combatAttack = {
    schemaVersion: 1 as const,
    eventId: 'combat-event-1',
    roundId: 'round-1',
    ordinal: 0,
    intent: 'Cięcie nożem w pierś',
    attacker: {
      id: 'npc-thug',
      name: 'Bandyta z zaułka',
      build: 0,
      hp: 9,
      maxHp: 9,
      armor: 0,
      attackSkill: 45,
      damageBonus: '0',
    },
    target: {
      characterId: 'char-alice',
      name: 'Alice',
    },
    weapon: {
      attackOptionId: 'switchblade',
      name: 'nóż sprężynowy',
      damageFormula: '1d4',
      damageClass: 'impaling' as const,
    },
  };

  const combatMessage: Message = {
    id: 'msg-combat',
    role: 'assistant',
    content: 'Z mroku wyłania się Bandyta z zaułka!',
    timestamp: new Date('2026-08-23T12:00:00.000Z'),
    pendingMeleeAttacks: [combatAttack],
  };

  const alice = {
    id: 'char-alice',
    name: 'Alice',
    hp: 12,
    maxHp: 12,
    con: 60,
    dex: 50,
    build: 0,
    skills: {
      Unik: 40,
      'Walka Wręcz': 45,
    },
  } as unknown as Character;

  it('renderuje CombatCard bezpośrednio w czacie, gdy pendingMeleeAttacks są obecne', () => {
    render(
      <MessageCard
        {...baseProps}
        message={combatMessage}
        activeCharacter={alice}
        characters={[alice]}
      />
    );

    expect(screen.getByText('Bandyta z zaułka')).toBeInTheDocument();
    expect(screen.getAllByText(/nóż sprężynowy/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Wykonaj zwinny unik/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wejdź w zwarcie i kontratakuj/i })).toBeInTheDocument();
  });

  it('wykonuje unik i wysyła raport WYNIK_WALKI do czatu', () => {
    const onSendCombatResult = jest.fn();
    render(
      <MessageCard
        {...baseProps}
        message={combatMessage}
        activeCharacter={alice}
        characters={[alice]}
        onSendCombatResult={onSendCombatResult}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Wykonaj zwinny unik/i }));

    expect(onSendCombatResult).toHaveBeenCalledWith(
      expect.stringContaining('[WYNIK_WALKI: id=combat-event-1')
    );
  });

  it('oznacza CombatCard jako rozstrzygniętą, gdy id znajduje się w resolvedCombatIds', () => {
    render(
      <MessageCard
        {...baseProps}
        message={combatMessage}
        activeCharacter={alice}
        characters={[alice]}
        resolvedCombatIds={new Set(['combat-event-1'])}
      />
    );

    expect(screen.getByText(/Starcie rozstrzygnięte/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Wykonaj zwinny unik/i })).not.toBeInTheDocument();
  });
});

describe('MessageCard - zakończenie sesji i autozapis (Issue #559)', () => {
  const sessionEndMessage: Message = {
    ...baseMessage,
    id: 'session-end-msg',
    content: 'Sesja została oficjalnie zakończona.\n[KONIEC_SESJI:POTWIERDZENIE]',
  };

  it('wyświetla wskaźnik zapisu, gdy sessionSaveStatus to saving', () => {
    render(
      <MessageCard
        {...baseProps}
        message={sessionEndMessage}
        sessionSaveStatus="saving"
      />
    );

    expect(
      screen.getByText('Zapisywanie kroniki w archiwum...')
    ).toBeInTheDocument();
  });

  it('wyświetla błąd zapisu z przyciskiem ponowienia, gdy sessionSaveStatus to error', () => {
    const onRetry = jest.fn();
    render(
      <MessageCard
        {...baseProps}
        message={sessionEndMessage}
        sessionSaveStatus="error"
        onRetrySessionSave={onRetry}
      />
    );

    expect(
      screen.getByText('Nie udało się zapisać kroniki w archiwum.')
    ).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Spróbuj zapisać ponownie/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('wyświetla potwierdzenie zapisu, gdy sessionSaveStatus to saved', () => {
    render(
      <MessageCard
        {...baseProps}
        message={sessionEndMessage}
        sessionSaveStatus="saved"
      />
    );

    expect(
      screen.getByText('𓂀 KRONIKA ZAPISANA 𓂀')
    ).toBeInTheDocument();
  });

  it('nie wyświetla potwierdzenia zapisu, gdy gra jest aktywna (sessionSaveStatus idle, isSessionEnded false)', () => {
    render(
      <MessageCard
        {...baseProps}
        message={sessionEndMessage}
        sessionSaveStatus="idle"
        isSessionEnded={false}
      />
    );

    expect(
      screen.queryByText('𓂀 KRONIKA ZAPISANA 𓂀')
    ).not.toBeInTheDocument();
  });
});


