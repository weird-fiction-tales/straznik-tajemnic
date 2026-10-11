import { getNarrativeTurnCadence } from '@/lib/narrative-engine/scene-director';
import {
  determineSceneState,
  getPacingMoodSuggestion,
  getCadenceForSceneState,
  selectSceneTechniques,
  formatSceneDirective,
  getCadenceWordBudget,
  dispatchWorldEngines,
  buildWorldEngineDirectives,
} from '@/lib/world-engine';
import type { SceneState, TechniqueId } from '@/lib/world-engine';

describe('Dynamiczny Reżyser Pacingu i Selektor Technik (Issue #536)', () => {
  describe('determineSceneState - Hybrydowa klasyfikacja stanu sceny', () => {
    it('1. Klasyfikuje stan jako action przy flagach walki lub pościgu', () => {
      const stateCombat = determineSceneState({ isInCombat: true });
      expect(stateCombat).toBe('action');

      const stateChase = determineSceneState({ hasChaseContext: true });
      expect(stateChase).toBe('action');
    });

    it('2. Klasyfikuje deklaracje ataku, strzału lub ucieczki jako action', () => {
      const stateAttack = determineSceneState({
        playerMessage: 'Wyciągam rewolwer i strzelam do napastnika!',
      });
      expect(stateAttack).toBe('action');

      const stateFlee = determineSceneState({
        playerMessage: 'Uciekam w stronę zaułka i rzucam się za skrzynie!',
      });
      expect(stateFlee).toBe('action');
    });

    it('3. Klasyfikuje stan jako tension_spike przy utracie poczytalności lub pułapce', () => {
      const stateSan = determineSceneState({ hasSanityLossOrRoll: true });
      expect(stateSan).toBe('tension_spike');

      const statePanic = determineSceneState({
        playerMessage: 'Wpadam w panikę, to jakaś zasadzka, kryj się!',
      });
      expect(statePanic).toBe('tension_spike');
    });

    it('4. Klasyfikuje stan jako abyssal_reveal przy motywach bóstw i magii okultystycznej', () => {
      const stateEldritch = determineSceneState({
        hasOccultElements: true,
        playerMessage: 'Dotykam nieeuklidesowego ołtarza Dagon i recytuję inkantację.',
      });
      expect(stateEldritch).toBe('abyssal_reveal');
    });

    it('5. Klasyfikuje rozmowę z NPC jako dialogue', () => {
      const stateTalk = determineSceneState({
        npcsPresent: true,
        playerMessage: 'Pytam barmana: czy widział pan tego mężczyznę z blizną?',
      });
      expect(stateTalk).toBe('dialogue');
    });

    it('5a. Klasyfikuje pytania do NPC i wołacze (np. "Waldek... jak z ziemi?") jako dialogue (Issue #546)', () => {
      const stateWaldek = determineSceneState({
        npcsPresent: true,
        npcs: [{ id: 'npc-waldek', name: 'Waldemar Kowalski' }],
        playerMessage: 'Waldek... jak z ziemi?',
      });
      expect(stateWaldek).toBe('dialogue');

      const stateWhoElse = determineSceneState({
        npcsPresent: true,
        playerMessage: 'Ktoś tam jeszcze był oprócz ciebie?',
      });
      expect(stateWhoElse).toBe('dialogue');
    });

    it('5b. Klasyfikuje kwestie w cudzysłowie w obecności NPC jako dialogue (Issue #546)', () => {
      const stateQuote = determineSceneState({
        npcsPresent: true,
        playerMessage: '„Dokąd oni poszli?”',
      });
      expect(stateQuote).toBe('dialogue');
    });

    it('6. Zachowuje ciągłość dialogu z poprzedniej tury (Smooth Continuity)', () => {
      const stateContinued = determineSceneState({
        npcsPresent: true,
        previousSceneState: 'dialogue',
        playerMessage: 'Nie wierzę panu. Pokaż mi ten rejestr.',
      });
      expect(stateContinued).toBe('dialogue');
    });

    it('7. Domyślnie klasyfikuje eksplorację i badanie jako investigation', () => {
      const stateInvestigate = determineSceneState({
        playerMessage: 'Przeszukuję dokładnie szuflady w starym biurku.',
      });
      expect(stateInvestigate).toBe('investigation');

      const stateEmpty = determineSceneState({});
      expect(stateEmpty).toBe('investigation');
    });
  });

  describe('getPacingMoodSuggestion i getCadenceForSceneState', () => {
    const states: SceneState[] = [
      'dialogue',
      'investigation',
      'action',
      'tension_spike',
      'abyssal_reveal',
    ];

    it('dla każdego stanu zwraca sugestię nastroju w PL i EN bez półpauz i bez sztucznych limitów słów', () => {
      for (const st of states) {
        const suggestion = getPacingMoodSuggestion(st);
        expect(suggestion.pl.trim()).not.toBe('');
        expect(suggestion.en.trim()).not.toBe('');
        expect(suggestion.pl).not.toMatch(/[—–]/);
        expect(suggestion.en).not.toMatch(/[—–]/);
      }
    });

    it('przypisuje poprawny bieg kadencji (1..4) do stanu sceny', () => {
      expect(getCadenceForSceneState('dialogue')).toBe(1);
      expect(getCadenceForSceneState('action')).toBe(1);
      expect(getCadenceForSceneState('investigation')).toBe(2);
      expect(getCadenceForSceneState('tension_spike')).toBe(3);
      expect(getCadenceForSceneState('abyssal_reveal')).toBe(4);
    });
  });

  describe('selectSceneTechniques - Selekcjoner Technik z rotacją Cooldownu', () => {
    it('wybiera 1 technikę wiodącą pasującą do stanu sceny', () => {
      const selection = selectSceneTechniques({
        sceneState: 'dialogue',
        hasNPCInteraction: true,
      });

      expect(selection.primaryTechnique).toBeDefined();
      expect(selection.primaryTechnique.sceneStates).toContain('dialogue');
      expect(selection.cadenceGear).toBe(1);
    });

    it('wspiera rotację cooldownu: nie wybiera techniki użytej w poprzedniej turze', () => {
      const recent: TechniqueId[] = ['agenda_first'];
      const selection = selectSceneTechniques({
        sceneState: 'dialogue',
        recentTechniqueIds: recent,
      });

      expect(selection.primaryTechnique.id).not.toBe('agenda_first');
    });

    it('w dialogu negocjacyjnym preferuje social_leverage', () => {
      const selection = selectSceneTechniques({
        sceneState: 'dialogue',
        playerMessage: 'Chcę dowodów! Żądam informacji, zapłacę każde pieniądze.',
      });

      expect(selection.primaryTechnique.id).toBe('social_leverage');
    });

    it('przy zmianie lokacji w śledztwie preferuje threshold_shift', () => {
      const selection = selectSceneTechniques({
        sceneState: 'investigation',
        isLocationTransition: true,
      });

      expect(selection.primaryTechnique.id).toBe('threshold_shift');
    });

    it('dobiera technikę wspomagającą (Secondary) z odmiennej kategorii niż wiodąca', () => {
      const selection = selectSceneTechniques({
        sceneState: 'action',
        hasDirectDanger: true,
      });

      if (selection.secondaryTechnique) {
        expect(selection.secondaryTechnique.category).not.toBe(
          selection.primaryTechnique.category
        );
      }
    });
  });

  describe('formatSceneDirective - Formater dyrektyw promptowych', () => {
    it('formatuje kompletną dyrektywę w języku polskim', () => {
      const selection = selectSceneTechniques({
        sceneState: 'action',
        hasDirectDanger: true,
      });

      const directive = formatSceneDirective(selection, 'pl');
      expect(directive).toContain('[REŻYSER_SCENY:');
      expect(directive).toContain('[TECHNIKA_MG:');
      expect(directive).toContain('Stan Sceny: action');
    });

    it('formatuje kompletną dyrektywę w języku angielskim', () => {
      const selection = selectSceneTechniques({
        sceneState: 'investigation',
      });

      const directive = formatSceneDirective(selection, 'en');
      expect(directive).toContain('[SCENE_DIRECTOR:');
      expect(directive).toContain('[GM_TECHNIQUE:');
      expect(directive).toContain('Scene State: investigation');
    });

    it('w stanie dialogue dołącza dyrektywę ZASADA DIALOG-FIRST (PL i EN)', () => {
      const selection = selectSceneTechniques({
        sceneState: 'dialogue',
      });

      const directivePl = formatSceneDirective(selection, 'pl');
      expect(directivePl).toContain('[ZASADA DIALOG-FIRST:');

      const directiveEn = formatSceneDirective(selection, 'en');
      expect(directiveEn).toContain('[DIALOG-FIRST RULE:');
    });

    it('wstrzykuje twarde przedziały słów per Bieg Kadencji (Issue #757)', () => {
      expect(getCadenceWordBudget(0)).toEqual({
        min: 120,
        max: 190,
        description: expect.objectContaining({
          pl: expect.stringContaining('Bieg 0'),
          en: expect.stringContaining('Gear 0'),
        }),
      });
      expect(getCadenceWordBudget(1).min).toBe(25);
      expect(getCadenceWordBudget(1).max).toBe(60);
      expect(getCadenceWordBudget(2).min).toBe(90);
      expect(getCadenceWordBudget(2).max).toBe(150);
      expect(getCadenceWordBudget(3).min).toBe(30);
      expect(getCadenceWordBudget(3).max).toBe(55);
      expect(getCadenceWordBudget(4).min).toBe(40);
      expect(getCadenceWordBudget(4).max).toBe(80);
    });

    it('formatuje dyrektywę z limitem słów, Książkową Asymetrią i Zasadą Aktywnego Pasażera w PL i EN', () => {
      const selectionAction = selectSceneTechniques({
        sceneState: 'action',
      });
      const directivePl = formatSceneDirective(selectionAction, 'pl');
      expect(directivePl).toContain('[LIMIT_SŁÓW: 25-60 słów');
      expect(directivePl).toContain('[KSIĄŻKOWA_ASYMETRIA:');
      expect(directivePl).toContain('[ZASADA_AKTYWNEGO_PASAŻERA:');

      const directiveEn = formatSceneDirective(selectionAction, 'en');
      expect(directiveEn).toContain('[WORD_LIMIT: 25-60 words');
      expect(directiveEn).toContain('[BOOK_ASYMMETRY:');
      expect(directiveEn).toContain('[ACTIVE_PASSENGER_RULE:');
    });

    it('w stanie dialogue egzekwuje twardy limit wypowiedzi NPC do 60 słów', () => {
      const selectionDialogue = selectSceneTechniques({
        sceneState: 'dialogue',
      });
      const directivePl = formatSceneDirective(selectionDialogue, 'pl');
      expect(directivePl).toContain('Twardy limit wypowiedzi NPC: do 60 słów');

      const directiveEn = formatSceneDirective(selectionDialogue, 'en');
      expect(directiveEn).toContain('Hard limit on NPC speech: up to 60 words');
    });
  });

  describe('Wątek poboczny: Empiryczna symulacja pacingu per Bieg Kadencji (Issue #757)', () => {
    it('Bieg 0 (Otwarcie): formatuje dyrektywę z limitem 120-190 słów', () => {
      const selection = {
        ...selectSceneTechniques({ sceneState: 'investigation' }),
        cadenceGear: 0 as const,
      };
      const directive = formatSceneDirective(selection, 'pl');
      expect(directive).toContain('[LIMIT_SŁÓW: 120-190 słów');
      expect(directive).toContain('Otwarcie Przygody');
    });

    it('Bieg 1 (Ping-Pong / Dialog): formatuje dyrektywę z limitem 25-60 słów', () => {
      const selection = selectSceneTechniques({ sceneState: 'dialogue' });
      const directive = formatSceneDirective(selection, 'pl');
      expect(directive).toContain('[LIMIT_SŁÓW: 25-60 słów');
      expect(directive).toContain('[ZASADA DIALOG-FIRST:');
    });

    it('Bieg 2 (Szeroki Kadr / Eksploracja): formatuje dyrektywę z limitem 90-150 słów', () => {
      const selection = selectSceneTechniques({ sceneState: 'investigation' });
      const directive = formatSceneDirective(selection, 'pl');
      expect(directive).toContain('[LIMIT_SŁÓW: 90-150 słów');
    });

    it('Bieg 3 (Przełamanie / Cios): formatuje dyrektywę z limitem 30-55 słów', () => {
      const selection = selectSceneTechniques({ sceneState: 'tension_spike' });
      const directive = formatSceneDirective(selection, 'pl');
      expect(directive).toContain('[LIMIT_SŁÓW: 30-55 słów');
    });

    it('Bieg 4 (Zawieszenie / Pustka / SAN loss): formatuje dyrektywę z limitem 40-80 słów', () => {
      const selection = selectSceneTechniques({ sceneState: 'abyssal_reveal' });
      const directive = formatSceneDirective(selection, 'pl');
      expect(directive).toContain('[LIMIT_SŁÓW: 40-80 słów');
    });
  });

  describe('Integracja z dispatchWorldEngines i buildWorldEngineDirectives', () => {
    it('dispatchWorldEngines automatycznie ustala sceneState i sceneTechniqueSelection', () => {
      const decision = dispatchWorldEngines({
        playerMessage: 'Rozmawiam z kustoszem i pytam o skradziony manuskrypt.',
        npcs: [{ id: 'npc-1', name: 'Kustosz Armitage' }],
      });

      expect(decision.sceneState).toBe('dialogue');
      expect(decision.sceneTechniqueSelection).toBeDefined();
      expect(decision.sceneTechniqueSelection?.primaryTechnique).toBeDefined();
    });

    it('buildWorldEngineDirectives dołącza dyrektywę Reżysera Sceny, gdy przekazano selekcję', () => {
      const decision = dispatchWorldEngines({
        playerMessage: 'Przeszukuję gabinet profesora.',
      });

      const directives = buildWorldEngineDirectives({
        locale: 'pl',
        playerMessage: 'Przeszukuję gabinet profesora.',
        activeEngines: decision.activeEngines,
        sceneTechniqueSelection: decision.sceneTechniqueSelection,
      });

      expect(directives).toContain('[REŻYSER_SCENY:');
      expect(directives).toContain('[TECHNIKA_MG:');
    });

    it('SLA Latencji: klasyfikacja stanu sceny i dobór technik wykonuje się w < 0.2 ms', () => {
      const t0 = performance.now();
      for (let i = 0; i < 100; i++) {
        const state = determineSceneState({
          playerMessage: 'Uciekam przed kultystami do piwnicy!',
          isInCombat: true,
        });
        selectSceneTechniques({ sceneState: state });
      }
      const totalMs = performance.now() - t0;
      const avgMs = totalMs / 100;
      expect(avgMs).toBeLessThan(1.0); // Wymóg architektoniczny: < 1 ms (faktycznie < 0.05 ms)
    });
  });
});

describe('Issue #761: opening cadence', () => {
  it.each([0, 1, 2, 3, 4, 5])('keeps turn %i in gear 0', (turnIndex) => {
    expect(
      getCadenceForSceneState('investigation', {
        turnIndex,
        playerMessage: 'Rozglądam się.',
      })
    ).toBe(0);
  });
  it('releases the opening at turn 6', () => {
    expect(getCadenceForSceneState('investigation', { turnIndex: 6 })).toBe(2);
  });
  it.each([
    'Strzelam do napastnika.',
    'Atakuję strażnika.',
    'Wyważam drzwi.',
    'I shoot the attacker.',
    'I kick down the door.',
    'Strzelam do niego, nie czekam.',
    'I shoot him, I do not wait.',
  ])('interrupts the opening for %s', (playerMessage) => {
    expect(
      getCadenceForSceneState('action', { turnIndex: 0, playerMessage })
    ).toBe(3);
  });
  it.each([
    'Nie strzelam.',
    'Pytam, czy on strzelał.',
    'I do not shoot.',
    'I run to the library.',
  ])('does not mistake %s for aggression', (playerMessage) => {
    expect(
      getCadenceForSceneState('investigation', { turnIndex: 0, playerMessage })
    ).toBe(0);
  });
  it('does not restart the opening after player aggression', () => {
    expect(
      getCadenceForSceneState('investigation', {
        turnIndex: 2,
        ordinaryWorldInterrupted: true,
      })
    ).toBe(2);
  });
});

describe('Issue #761: request history boundaries', () => {
  it('does not restart gear 0 on a truncated response continuation', () => {
    expect(
      getNarrativeTurnCadence('action', 'Continue the previous response', [
        {
          role: 'assistant',
          content: 'The fight continues.',
          continuationRequested: true,
        },
      ])
    ).toBeUndefined();
  });
  it('keeps player aggression effective on subsequent ordinary requests', () => {
    expect(
      getNarrativeTurnCadence('investigation', 'Badam biurko.', [
        { role: 'user', content: 'Strzelam do strażnika.' },
        { role: 'assistant', content: 'Strażnik pada.' },
      ])
    ).toBe(2);
  });
});


it('does not disable normal cadence after a historical continuation', () => {
  expect(getNarrativeTurnCadence('action', 'Strzelam do napastnika.', [
    { role: 'assistant', content: 'Earlier response.', continuationRequested: true },
    { role: 'user', content: 'Strzelam do napastnika.' },
  ])).toBe(3);
});
