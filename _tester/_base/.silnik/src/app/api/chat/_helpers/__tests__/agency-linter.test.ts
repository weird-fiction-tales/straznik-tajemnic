import {
  lintAgencyViolations,
  sanitizeAgencyViolations,
  extractNameVariants,
  collectStreamChunks,
} from '../agency-linter';

describe('Agency Linter & Detector (CoC 7e RAW)', () => {
  describe('extractNameVariants', () => {
    it('generuje warianty dla imion z tytułami naukowymi lub grzecznościowymi', () => {
      const variants = extractNameVariants('Dr Constance Ward');
      expect(variants).toContain('Dr Constance Ward');
      expect(variants).toContain('Constance Ward');
      expect(variants).toContain('Constance');
    });

    it('obsługuje pojedyncze imiona i imiona z nazwiskiem bez tytułu', () => {
      const variants = extractNameVariants('Arthur Vance');
      expect(variants).toContain('Arthur Vance');
      expect(variants).toContain('Arthur');
    });

    it('generuje polskie formy deklinacyjne (przypadki zależne i wołacz)', () => {
      const variants = extractNameVariants('Stanisław Kowalski');
      expect(variants).toContain('Stanisław Kowalski');
      expect(variants).toContain('Stanisław');
      expect(variants).toContain('Stanisława');
      expect(variants).toContain('Stanisławowi');
      expect(variants).toContain('Stanisławem');
      expect(variants).toContain('Stanisławie');
      expect(variants).toContain('Kowalski');
      expect(variants).toContain('Kowalskiego');
      expect(variants).toContain('Kowalskiemu');
      expect(variants).toContain('Kowalskim');

      const femVariants = extractNameVariants('Katarzyna');
      expect(femVariants).toContain('Katarzyna');
      expect(femVariants).toContain('Katarzyny');
      expect(femVariants).toContain('Katarzynie');
      expect(femVariants).toContain('Katarzynę');
      expect(femVariants).toContain('Katarzyną');
      expect(femVariants).toContain('Katarzyno');
    });

    it('zwraca pustą tablicę dla pustego stringa', () => {
      expect(extractNameVariants('')).toEqual([]);
    });
  });

  describe('Czysta narracja bez naruszeń (False Positive Guard)', () => {
    it('nie flaguje czystego opisu sensorycznego, nastroju i wejścia NPC', () => {
      const narration =
        `[MYŚLI_MG: Wprowadzam stangreta z ranami po ataku.]\n` +
        `[NASTRÓJ: Posępny, deszczowy zmierzch.]\n` +
        `[LOKACJA: Gościniec pod Arkham | Błotnisty trakt w strugach deszczu.]\n\n` +
        `Krople deszczu bębnią miarowo o skórzaną plandekę powozu. Z mroku wyłania się sylwetka przydrożnego zajazdu. ` +
        `Woźnica osuwa się nagle z kozła na rozmokłą ziemię, a konie rżą nerwowo, wyczuwając coś w zaroślach.\n\n` +
        `[Co robicie?]\n\n` +
        `[AKTUALNY CZAS: 12 Października 1925, 21:30]`;

      const result = lintAgencyViolations(narration, ['Dr Constance Ward', 'Arthur Vance'], { isDuet: true });
      expect(result.hasViolation).toBe(false);
      expect(result.violations).toHaveLength(0);
    });

    it('nie flaguje percepcji i zmysłów adresowanych do badacza (@Postać jako odbiorca wrażeń)', () => {
      const narration =
        `Deszcz siecze po twarzach. @Dr Constance Ward, jako doświadczona lekarka natychmiast dostrzegasz ` +
        `nienaturalnie siny odcień skóry leżącego człowieka oraz woń gorzkich migdałów w powietrzu. ` +
        `Mężczyzna ledwo oddycha.\n\n` +
        `[Co robicie?]`;

      const result = lintAgencyViolations(narration, ['Dr Constance Ward'], { isDuet: true });
      expect(result.hasViolation).toBe(false);
    });

    it('nie flaguje akcji wykonywanych przez NPC', () => {
      const narration =
        `Woźnica zeskakuje z kozła, wyciąga rewolwer i podbiega do bramy dworu, krzycząc z przerażenia.\n\n` +
        `[Co robisz?]`;

      const result = lintAgencyViolations(narration, ['Dr Constance Ward']);
      expect(result.hasViolation).toBe(false);
    });
  });

  describe('Przypadek z wozem i Dr Constance Ward (Benchmark naruszeń)', () => {
    it('wykrywa potrójne naruszenie (ruch, ekwipunek, badanie ran) w klasycznym przypadku z wozem', () => {
      const violatingText =
        `[LOKACJA: Brama posiadłości]\n\n` +
        `Powóz zatrzymuje się z głośnym skrzypieniem kół przed kutą bramą dworu.\n` +
        `Dr Constance Ward zeskakuje z kozła, wyciąga z torby apteczkę i bada rany leżącego stangreta.\n\n` +
        `[Co robicie?]`;

      const result = lintAgencyViolations(violatingText, ['Dr Constance Ward'], { isDuet: true });

      expect(result.hasViolation).toBe(true);
      expect(result.violations.length).toBeGreaterThanOrEqual(2);

      const types = result.violations.map((v) => v.type);
      expect(types).toContain('movement'); // zeskakuje z kozła
      expect(types).toContain('inventory'); // wyciąga z torby apteczkę
      expect(types).toContain('examination'); // bada rany

      // Weryfikacja czyszczenia i zatrzymania narracji na progu zdarzenia
      expect(result.sanitizedText).toBeDefined();
      expect(result.sanitizedText).not.toContain('zeskakuje z kozła');
      expect(result.sanitizedText).not.toContain('wyciąga z torby apteczkę');
      expect(result.sanitizedText).not.toContain('bada rany');
      expect(result.sanitizedText).toContain('przed kutą bramą dworu.');
      expect(result.sanitizedText).toContain('[Co robicie?]');
    });

    it('wykrywa naruszenie gdy badacz jest oznaczony tagiem @ w trybie Hot Seat / Drużyna', () => {
      const violatingText =
        `Konie parskają głośno w gęstniejącej mgle.\n` +
        `@Dr Constance Ward zeskakuje z wozu, sięga do torby medycznej i bada rany rannego woźnicy.\n\n` +
        `[Co robicie?]`;

      const result = lintAgencyViolations(violatingText, ['Dr Constance Ward', 'Arthur Vance'], { isDuet: true });

      expect(result.hasViolation).toBe(true);
      const types = result.violations.map((v) => v.type);
      expect(types).toContain('movement');
      expect(types).toContain('inventory');
      expect(types).toContain('examination');
    });

    it('wykrywa wariant ze skróconym imieniem "Constance"', () => {
      const violatingText =
        `Ciemność spowija dziedziniec. Constance podchodzi do powozu i wyciąga latarkę z kieszeni.\n\n[Co robicie?]`;

      const result = lintAgencyViolations(violatingText, ['Dr Constance Ward'], { isDuet: true });
      expect(result.hasViolation).toBe(true);
      expect(result.violations.some((v) => v.type === 'movement')).toBe(true);
      expect(result.violations.some((v) => v.type === 'inventory')).toBe(true);
    });
  });

  describe('Naruszenia w 2. osobie (Solo i Drużyna)', () => {
    it('wykrywa samowolne przemieszczenie i jazdę wozem ("podjeżdżacie wozem", "zeskakujesz")', () => {
      const text = `Podjeżdżacie wozem pod wrota posiadłości. Zeskakujesz z kozła na błotnistą drogę. Co robisz?`;
      const result = lintAgencyViolations(text, ['Konrad']);

      expect(result.hasViolation).toBe(true);
      expect(result.violations.some((v) => v.type === 'movement')).toBe(true);
    });

    it('wykrywa narzucanie wejścia do budynku ("wchodzicie do środka")', () => {
      const text = `Stajecie przed magazynem. Wchodzicie do środka i przeszukujecie zakurzone skrzynie. [Co robicie?]`;
      const result = lintAgencyViolations(text, ['Arthur', 'Constance'], { isDuet: true });

      expect(result.hasViolation).toBe(true);
      expect(result.violations.some((v) => v.type === 'movement')).toBe(true);
      expect(result.violations.some((v) => v.type === 'examination')).toBe(true);
    });

    it('wykrywa sięganie do ekwipunku w 2. osobie ("wyciągasz apteczkę", "sięgasz po broń")', () => {
      const text = `Widzisz rannego w progu. Wyciągasz apteczkę ze skórzanej torby i badasz rany. [Co robisz?]`;
      const result = lintAgencyViolations(text, ['Thomas']);

      expect(result.hasViolation).toBe(true);
      expect(result.violations.some((v) => v.type === 'inventory')).toBe(true);
      expect(result.violations.some((v) => v.type === 'examination')).toBe(true);
    });
  });

  describe('Naruszenia motoryki ciała i generowania dialogów', () => {
    it('wykrywa wkładanie kwestii dialogowych w usta postaci gracza', () => {
      const text =
        `W drzwiach staje Eleonora, blada jak śmierć.\n\n` +
        `Dr Constance Ward: „Spokojnie, nic pani nie grozi. Proszę wejść do środka.”\n\n` +
        `Eleonora kiwa głową i siada w fotelu. [Co robisz?]`;

      const result = lintAgencyViolations(text, ['Dr Constance Ward']);
      expect(result.hasViolation).toBe(true);
      expect(result.violations.some((v) => v.type === 'dialogue')).toBe(true);
    });

    it('wykrywa manipulację motoryczną ("chwyta za lejce", "chwytasz za klamkę")', () => {
      const text = `Drzwi gabinetu są uchylone. Chwytasz za klamkę i szarpiesz za drzwi z całej siły. [Co robisz?]`;
      const result = lintAgencyViolations(text, ['Badacz']);

      expect(result.hasViolation).toBe(true);
      expect(result.violations.some((v) => v.type === 'motorics')).toBe(true);
    });
  });

  describe('Sanityzacja i zatrzymanie narracji na progu zdarzenia', () => {
    it('odcina tekst dokładnie przed zdaniem z naruszeniem i zamyka [Co robicie?]', () => {
      const rawText =
        `Kareta zatrzymuje się przed bramą cmentarza. Żelazne kraty giną w gęstniejących oparach mgły.\n` +
        `Dr Constance Ward zeskakuje z kozła, wyciąga z torby apteczkę i bada rany woźnicy.\n\n` +
        `[Co robicie?]\n` +
        `[AKTUALNY CZAS: 15 Listopada 1925, 23:45]`;

      const sanitized = sanitizeAgencyViolations(rawText, ['Dr Constance Ward'], { isDuet: true });

      expect(sanitized).toContain('Kareta zatrzymuje się przed bramą cmentarza. Żelazne kraty giną w gęstniejących oparach mgły.');
      expect(sanitized).not.toContain('zeskakuje z kozła');
      expect(sanitized).not.toContain('wyciąga z torby apteczkę');
      expect(sanitized).not.toContain('bada rany');
      expect(sanitized).toContain('[Co robicie?]');
      expect(sanitized).toContain('[AKTUALNY CZAS: 15 Listopada 1925, 23:45]');
    });

    it('zwraca oryginalny tekst jeśli brak naruszeń', () => {
      const rawText = `Stoisz przed bramą. Mgła snuje się po nagrobkach. [Co robisz?]`;
      const sanitized = sanitizeAgencyViolations(rawText, ['Konrad']);
      expect(sanitized).toBe(rawText);
    });
  });

  describe('Obsługa języka angielskiego (locale: "en")', () => {
    it('wykrywa naruszenia w angielskiej narracji (movement, inventory, examination)', () => {
      const text =
        `The carriage stops at the iron gate. ` +
        `Dr Constance Ward hops off the wagon, pulls out her medical kit, and examines the wounds of the driver. ` +
        `[What do you do?]`;

      const result = lintAgencyViolations(text, ['Dr Constance Ward'], { locale: 'en' });
      expect(result.hasViolation).toBe(true);
      expect(result.violations.some((v) => v.type === 'movement')).toBe(true);
      expect(result.violations.some((v) => v.type === 'inventory')).toBe(true);
      expect(result.violations.some((v) => v.type === 'examination')).toBe(true);
    });
  });

  describe('Adversarial Edge Cases & Boundary Probes (Reviewer Verifications)', () => {
    it('nie ucina tekstu na kropce w tytule Dr. ani nie pozostawia osieroconego Dr.', () => {
      const text =
        `Kareta zatrzymuje się przed bramą dworu.\n` +
        `Dr. Constance Ward zeskakuje z kozła na błotnistą drogę.`;

      const sanitized = sanitizeAgencyViolations(text, ['Dr. Constance Ward']);
      expect(sanitized).toContain('Kareta zatrzymuje się przed bramą dworu.');
      expect(sanitized).not.toMatch(/\nDr\.\s*$/m);
      expect(sanitized).not.toContain('Dr.\n\n[Co robisz?]');
      expect(sanitized).toContain('[Co robisz?]');
    });

    it('nie flaguje akcji NPC gdy badacz jest celem/dopełnieniem w zdaniu (prepositional object)', () => {
      const text1 = `Woźnica podchodzi do Constance i wyciąga nóż.\n\n[Co robisz?]`;
      const res1 = lintAgencyViolations(text1, ['Constance']);
      expect(res1.hasViolation).toBe(false);

      const text2 = `Kultysta rzuca się na Constance i wyciąga sztylet.\n\n[Co robisz?]`;
      const res2 = lintAgencyViolations(text2, ['Constance']);
      expect(res2.hasViolation).toBe(false);

      const text3 = `Szeryf spogląda na Arthura i wyciąga notatnik z kieszeni płaszcza.\n\n[Co robisz?]`;
      const res3 = lintAgencyViolations(text3, ['Arthur']);
      expect(res3.hasViolation).toBe(false);
    });

    it('nie flaguje zmysłów i percepcji w 3. osobie (badacz obserwuje akcję NPC)', () => {
      const text1 = `Constance widzi, jak woźnica zeskakuje z kozła i ucieka w las.\n\n[Co robisz?]`;
      const res1 = lintAgencyViolations(text1, ['Constance']);
      expect(res1.hasViolation).toBe(false);

      const text2 = `Arthur patrzy, jak szeryf wyciąga rewolwer i odbezpiecza go.\n\n[Co robisz?]`;
      const res2 = lintAgencyViolations(text2, ['Arthur']);
      expect(res2.hasViolation).toBe(false);

      const text3 = `Constance watches as the driver jumps down and runs away.\n\n[What do you do?]`;
      const res3 = lintAgencyViolations(text3, ['Constance'], { locale: 'en' });
      expect(res3.hasViolation).toBe(false);
    });

    it('nie flaguje zanegowanych akcji w 2. osobie i 3. osobie (negation guard)', () => {
      const text1 = `Nie wchodzicie do środka opuszczonej posiadłości. [Co robicie?]`;
      const res1 = lintAgencyViolations(text1, ['Arthur', 'Constance'], { isDuet: true });
      expect(res1.hasViolation).toBe(false);

      const text2 = `Nigdzie nie zeskakujesz z wozu, lecz czekasz na rozwój wypadków. [Co robisz?]`;
      const res2 = lintAgencyViolations(text2, ['Konrad']);
      expect(res2.hasViolation).toBe(false);

      const text3 = `Nie wyciągasz broni z kabury. [Co robisz?]`;
      const res3 = lintAgencyViolations(text3, ['Thomas']);
      expect(res3.hasViolation).toBe(false);

      const text4 = `You do not enter the crypt. [What do you do?]`;
      const res4 = lintAgencyViolations(text4, ['Thomas'], { locale: 'en' });
      expect(res4.hasViolation).toBe(false);
    });

    it('nie myli jednoliterowych imion ("A") ze spójnikami w języku polskim', () => {
      const text = `Koń rwie do przodu, a stangret wyciąga nóż.\n\n[Co robisz?]`;
      const res = lintAgencyViolations(text, ['A']);
      expect(res.hasViolation).toBe(false);

      const taggedText = `@A zeskakuje z wozu.\n\n[Co robisz?]`;
      const resTagged = lintAgencyViolations(taggedText, ['A']);
      expect(resTagged.hasViolation).toBe(true);
    });

    it('obsługuje imiona z inicjałami (Dr. A. J. Raffles)', () => {
      const text = `Dr. A. J. Raffles zeskakuje z kozła na ziemię.\n\n[Co robisz?]`;
      const res = lintAgencyViolations(text, ['Dr. A. J. Raffles']);
      expect(res.hasViolation).toBe(true);
      expect(res.violations.some((v) => v.type === 'movement')).toBe(true);
    });

    it('wykrywa naruszenia przy odwołaniu samym nazwiskiem lub Tytuł + Nazwisko', () => {
      const text1 = `Dr Ward zeskakuje z kozła i bada rany woźnicy.\n\n[Co robisz?]`;
      const res1 = lintAgencyViolations(text1, ['Dr Constance Ward']);
      expect(res1.hasViolation).toBe(true);
      expect(res1.violations.some((v) => v.type === 'movement')).toBe(true);
      expect(res1.violations.some((v) => v.type === 'examination')).toBe(true);

      const text2 = `Ward wyciąga apteczkę z torby.\n\n[Co robisz?]`;
      const res2 = lintAgencyViolations(text2, ['Dr Constance Ward']);
      expect(res2.hasViolation).toBe(true);
      expect(res2.violations.some((v) => v.type === 'inventory')).toBe(true);
    });

    it('wykrywa naruszenia w czasie przeszłym w języku polskim (3. osoba i 2. osoba)', () => {
      const text1 = `Constance zeskoczyła z kozła, wyciągnęła apteczkę i zbadała rany woźnicy.`;
      const res1 = lintAgencyViolations(text1, ['Constance']);
      expect(res1.hasViolation).toBe(true);
      expect(res1.violations.some((v) => v.type === 'movement')).toBe(true);
      expect(res1.violations.some((v) => v.type === 'inventory')).toBe(true);
      expect(res1.violations.some((v) => v.type === 'examination')).toBe(true);

      const text2 = `Zeskoczyłeś z kozła, wyciągnąłeś apteczkę i zbadałeś rany. [Co robisz?]`;
      const res2 = lintAgencyViolations(text2, ['Konrad']);
      expect(res2.hasViolation).toBe(true);
      expect(res2.violations.some((v) => v.type === 'movement')).toBe(true);
      expect(res2.violations.some((v) => v.type === 'inventory')).toBe(true);
      expect(res2.violations.some((v) => v.type === 'examination')).toBe(true);

      const text3 = `Weszliście do środka i przeszukaliście gabinet. [Co robicie?]`;
      const res3 = lintAgencyViolations(text3, ['Konrad', 'Arthur'], { isDuet: true });
      expect(res3.hasViolation).toBe(true);
      expect(res3.violations.some((v) => v.type === 'movement')).toBe(true);
      expect(res3.violations.some((v) => v.type === 'examination')).toBe(true);
    });

    it('wykrywa naruszenia w czasie przeszłym w języku angielskim', () => {
      const text1 = `Constance hopped off the wagon, pulled out her medical kit, and examined the wounds.`;
      const res1 = lintAgencyViolations(text1, ['Constance'], { locale: 'en' });
      expect(res1.hasViolation).toBe(true);
      expect(res1.violations.some((v) => v.type === 'movement')).toBe(true);
      expect(res1.violations.some((v) => v.type === 'inventory')).toBe(true);
      expect(res1.violations.some((v) => v.type === 'examination')).toBe(true);

      const text2 = `You entered the room and searched the desk. [What do you do?]`;
      const res2 = lintAgencyViolations(text2, ['Konrad'], { locale: 'en' });
      expect(res2.hasViolation).toBe(true);
      expect(res2.violations.some((v) => v.type === 'movement')).toBe(true);
      expect(res2.violations.some((v) => v.type === 'examination')).toBe(true);
    });

    it('nie duplikuje markera pytania gdy tekst bazowy już go posiada', () => {
      const text = `Stoisz przed bramą dworu. [Co robisz?]\nWchodzisz do środka i przeszukujesz pokój.`;
      const sanitized = sanitizeAgencyViolations(text, ['Konrad']);
      expect(sanitized).not.toContain('[Co robisz?]\n\n[Co robisz?]');
      expect(sanitized).toMatch(/\[Co robisz\?\]$/);
    });

    it('prawidłowo przypisuje naruszenie odpowiedniemu badaczowi w zdaniu wielokrotnie złożonym', () => {
      const text = `Thomas rozgląda się po cmentarzu, a Edward wyciąga rewolwer. [Co robicie?]`;
      const res = lintAgencyViolations(text, ['Thomas', 'Edward'], { isDuet: true });
      expect(res.hasViolation).toBe(true);
      const invViolation = res.violations.find((v) => v.type === 'inventory');
      expect(invViolation).toBeDefined();
      expect(invViolation?.characterName).toBe('Edward');
    });

    it('dla pojedynczego gracza (Solo) używa formy l.poj. w fallbacku gdy cały tekst był naruszeniem', () => {
      const text = `Wchodzisz do środka i przeszukujesz pokój.`;
      const sanitized = sanitizeAgencyViolations(text, ['Konrad'], { isDuet: false });
      expect(sanitized).toContain('Stoisz na progu zdarzenia, obserwując otoczenie.');
      expect(sanitized).not.toContain('Stoicie na progu');
    });

    it('wykrywa naruszenia sprawczości przy użyciu form deklinacyjnych polskich imion (biernik/dopełniacz/celownik)', () => {
      // Dłoń Stanisława (Dopełniacz)
      const text1 = `Dłoń Stanisława wyciąga rewolwer z kieszeni płaszcza. [Co robisz?]`;
      const res1 = lintAgencyViolations(text1, ['Stanisław Kowalski']);
      expect(res1.hasViolation).toBe(true);
      expect(res1.violations.some((v) => v.type === 'inventory')).toBe(true);

      // Ręka Katarzyny (Dopełniacz żeński)
      const text2 = `Ręka Katarzyny sięga po apteczkę z torby medycznej. [Co robisz?]`;
      const res2 = lintAgencyViolations(text2, ['Katarzyna']);
      expect(res2.hasViolation).toBe(true);
      expect(res2.violations.some((v) => v.type === 'inventory')).toBe(true);

      // Celownik + modal (Stanisławowi udaje się...)
      const text3 = `Stanisławowi udaje się zeskoczyć z kozła i zbadać rany woźnicy. [Co robisz?]`;
      const res3 = lintAgencyViolations(text3, ['Stanisław']);
      expect(res3.hasViolation).toBe(true);
      expect(res3.violations.some((v) => v.type === 'movement')).toBe(true);
      expect(res3.violations.some((v) => v.type === 'examination')).toBe(true);
    });

    it('nie flaguje akcji NPC przy rozszerzonych przyimkach w języku polskim (przed, w stronę, naprzeciw)', () => {
      const text1 = `Woźnica staje przed Stanisławem i wyciąga nóż.\n\n[Co robisz?]`;
      const res1 = lintAgencyViolations(text1, ['Stanisław']);
      expect(res1.hasViolation).toBe(false);

      const text2 = `Kultysta biegnie w stronę Katarzyny i dobywa sztyletu.\n\n[Co robisz?]`;
      const res2 = lintAgencyViolations(text2, ['Katarzyna']);
      expect(res2.hasViolation).toBe(false);

      const text3 = `Szeryf staje naprzeciwko Arthura i wyciąga rewolwer.\n\n[Co robisz?]`;
      const res3 = lintAgencyViolations(text3, ['Arthur']);
      expect(res3.hasViolation).toBe(false);
    });

    it('wykrywa kwestie dialogowe wkładane w usta badacza z czasownikami mowy, w formie myślnikowej oraz w wołaczu', () => {
      // Czasownik mowy przed dwukropkiem
      const text1 = `Constance mówi: „Nie bój się, stangrecie.” [Co robisz?]`;
      const res1 = lintAgencyViolations(text1, ['Constance']);
      expect(res1.hasViolation).toBe(true);
      expect(res1.violations.some((v) => v.type === 'dialogue')).toBe(true);

      // Dialog myślnikowy (standard polski)
      const text2 = `— Pomogę ci — odpowiada Arthur. [Co robicie?]`;
      const res2 = lintAgencyViolations(text2, ['Arthur'], { isDuet: true });
      expect(res2.hasViolation).toBe(true);
      expect(res2.violations.some((v) => v.type === 'dialogue')).toBe(true);

      // Dialog w wołaczu
      const text3 = `Stanisławie: „Musimy natychmiast uciekać!” [Co robisz?]`;
      const res3 = lintAgencyViolations(text3, ['Stanisław']);
      expect(res3.hasViolation).toBe(true);
      expect(res3.violations.some((v) => v.type === 'dialogue')).toBe(true);

      // Angielski speech verb
      const text4 = `"I will help you," says Constance. [What do you do?]`;
      const res4 = lintAgencyViolations(text4, ['Constance'], { locale: 'en' });
      expect(res4.hasViolation).toBe(true);
      expect(res4.violations.some((v) => v.type === 'dialogue')).toBe(true);
    });

    it('wykrywa narzucanie kwestii dialogowych w 2. osobie (Solo i Hot Seat)', () => {
      const text1 = `Mówisz woźnicy: „Spokojnie, nic ci nie grozi.” [Co robisz?]`;
      const res1 = lintAgencyViolations(text1, ['Konrad']);
      expect(res1.hasViolation).toBe(true);
      expect(res1.violations.some((v) => v.type === 'dialogue')).toBe(true);

      const text2 = `— Nic tu nie ma — odpowiadasz z rezygnacją. [Co robisz?]`;
      const res2 = lintAgencyViolations(text2, ['Konrad']);
      expect(res2.hasViolation).toBe(true);
      expect(res2.violations.some((v) => v.type === 'dialogue')).toBe(true);

      const text3 = `You say to the driver: "We will help you." [What do you do?]`;
      const res3 = lintAgencyViolations(text3, ['Thomas'], { locale: 'en' });
      expect(res3.hasViolation).toBe(true);
      expect(res3.violations.some((v) => v.type === 'dialogue')).toBe(true);
    });

    it('wykrywa konstrukcje modalne, bezokolicznikowe oraz imiesłowy (udaje się, zdołał, zeskakując)', () => {
      // Modal + bezokoliczniki w 3. osobie
      const text1 = `Constance zdołała zeskoczyć z kozła i wyciągnąć apteczkę. [Co robisz?]`;
      const res1 = lintAgencyViolations(text1, ['Constance']);
      expect(res1.hasViolation).toBe(true);
      expect(res1.violations.some((v) => v.type === 'movement')).toBe(true);
      expect(res1.violations.some((v) => v.type === 'inventory')).toBe(true);

      // Modal w 2. osobie
      const text2 = `Udaje ci się wejść do środka i przeszukać pokój. [Co robisz?]`;
      const res2 = lintAgencyViolations(text2, ['Konrad']);
      expect(res2.hasViolation).toBe(true);
      expect(res2.violations.some((v) => v.type === 'movement')).toBe(true);
      expect(res2.violations.some((v) => v.type === 'examination')).toBe(true);

      // Imiesłów przysłówkowy współczesny
      const text3 = `Stanisław, zeskakując z wozu, wyciąga rewolwer. [Co robisz?]`;
      const res3 = lintAgencyViolations(text3, ['Stanisław']);
      expect(res3.hasViolation).toBe(true);
      expect(res3.violations.some((v) => v.type === 'movement')).toBe(true);
      expect(res3.violations.some((v) => v.type === 'inventory')).toBe(true);
    });

    it('obsługuje formatowanie Markdown wokół imion badacza i orzeczeń', () => {
      const text1 = `Ciemność gęstnieje.\n**Constance** zeskakuje z kozła na ziemię. [Co robicie?]`;
      const res1 = lintAgencyViolations(text1, ['Constance'], { isDuet: true });
      expect(res1.hasViolation).toBe(true);
      expect(res1.violations.some((v) => v.type === 'movement')).toBe(true);

      const text2 = `Mgła opada na trakt.\nDr Constance Ward **wyciąga** apteczkę z torby. [Co robisz?]`;
      const res2 = lintAgencyViolations(text2, ['Dr Constance Ward']);
      expect(res2.hasViolation).toBe(true);
      expect(res2.violations.some((v) => v.type === 'inventory')).toBe(true);
    });

    it('prawidłowo zachowuje wypowiedzi w cudzysłowach, wielokropki i myślniki podczas sanityzacji', () => {
      // Zdanie kończące się cudzysłowem dialogowym NPC
      const text1 =
        `Kareta staje w błocie. Woźnica woła: „Pomocy!” ` +
        `Constance zeskakuje z kozła i bada rany leżącego stangreta.`;
      const san1 = sanitizeAgencyViolations(text1, ['Constance']);
      expect(san1).toContain('Kareta staje w błocie. Woźnica woła: „Pomocy!”');
      expect(san1).not.toContain('zeskakuje z kozła');
      expect(san1).toContain('[Co robisz?]');

      // Wielokropek Unicode (…)
      const text2 =
        `Kareta staje przed wrotami krypty… ` +
        `Constance zeskakuje z kozła na mokrą trawę.`;
      const san2 = sanitizeAgencyViolations(text2, ['Constance']);
      expect(san2).toContain('Kareta staje przed wrotami krypty…');
      expect(san2).not.toContain('zeskakuje z kozła');
      expect(san2).toContain('[Co robisz?]');

      // Myślnik jako separator klauzul („ — ”)
      const text3 =
        `Kareta zatrzymuje się przed bramą — Constance zeskakuje z kozła na błotnisty trakt.`;
      const san3 = sanitizeAgencyViolations(text3, ['Constance']);
      expect(san3).toContain('Kareta zatrzymuje się przed bramą.');
      expect(san3).not.toContain('zeskakuje z kozła');
      expect(san3).toContain('[Co robisz?]');
    });

    it('collectStreamChunks zachowuje odebrane chunki w razie przerwania strumienia w trakcie transmisji', async () => {
      async function* faultyStream() {
        yield { text: 'Początek narracji. ' };
        yield { text: 'Kareta staje przed dworem.' };
        throw new Error('Connection reset by peer');
      }

      const result = await collectStreamChunks(faultyStream());
      expect(result.chunks).toHaveLength(2);
      expect(result.fullText).toBe('Początek narracji. Kareta staje przed dworem.');
    });

    it('collectStreamChunks rzuca błąd gdy strumień zawiedzie przed odebraniem jakichkolwiek chunków', async () => {
      async function* emptyFaultyStream() {
        throw new Error('Immediate stream failure');
        yield { text: 'never reached' };
      }

      await expect(collectStreamChunks(emptyFaultyStream())).rejects.toThrow('Immediate stream failure');
    });

    it('wykrywa kwestie dialogowe i czasowniki w formacie Markdown (pogrubienie, kursywa)', () => {
      // 2. osoba z kursywą na czasowniku
      const text1 = `Ciemność zalewa pokój. *Wyciągasz* apteczkę z torby. [Co robisz?]`;
      const res1 = lintAgencyViolations(text1, ['Konrad']);
      expect(res1.hasViolation).toBe(true);
      expect(res1.violations.some((v) => v.type === 'inventory')).toBe(true);

      // Kwestia dialogowa: **Constance**: "..."
      const text2 = `Cisza w lesie.\n**Constance**: "Musimy natychmiast uciekać!"\n[Co robisz?]`;
      const res2 = lintAgencyViolations(text2, ['Constance']);
      expect(res2.hasViolation).toBe(true);
      expect(res2.violations.some((v) => v.type === 'dialogue')).toBe(true);

      // Dialog myślnikowy z pogrubionym imieniem badacza
      const text3 = `— Nie bój się — mówi **Constance**. [Co robicie?]`;
      const res3 = lintAgencyViolations(text3, ['Constance'], { isDuet: true });
      expect(res3.hasViolation).toBe(true);
      expect(res3.violations.some((v) => v.type === 'dialogue')).toBe(true);

      // Dialog z dywizem ASCII (-) zamiast pauzy
      const text4 = `- Uciekajmy stąd! - mówi Constance. [Co robisz?]`;
      const res4 = lintAgencyViolations(text4, ['Constance']);
      expect(res4.hasViolation).toBe(true);
      expect(res4.violations.some((v) => v.type === 'dialogue')).toBe(true);
    });

    it('zapewnia pełny parytet języka angielskiego dla dialogów i form mowy (says, speaks, replies, shout)', () => {
      // Format dwukropkowy ze słowem kluczowym says / speaks
      const text1 = `Arthur says: "Take cover behind the wall!" [What do you do?]`;
      const res1 = lintAgencyViolations(text1, ['Arthur'], { locale: 'en' });
      expect(res1.hasViolation).toBe(true);
      expect(res1.violations.some((v) => v.type === 'dialogue')).toBe(true);

      const text2 = `Constance speaks: "I will handle this wound." [What do you do?]`;
      const res2 = lintAgencyViolations(text2, ['Constance'], { locale: 'en' });
      expect(res2.hasViolation).toBe(true);
      expect(res2.violations.some((v) => v.type === 'dialogue')).toBe(true);

      // Angielski dialog myślnikowy z dywizem (-) i czasownikiem replies
      const text3 = `- Let's go through the tunnel - Arthur replies. [What do you do?]`;
      const res3 = lintAgencyViolations(text3, ['Arthur'], { locale: 'en' });
      expect(res3.hasViolation).toBe(true);
      expect(res3.violations.some((v) => v.type === 'dialogue')).toBe(true);

      // Angielski dialog w 2. osobie z dywizem (-)
      const text4 = `- Stop right there! - you shout into the fog. [What do you do?]`;
      const res4 = lintAgencyViolations(text4, ['Arthur'], { locale: 'en' });
      expect(res4.hasViolation).toBe(true);
      expect(res4.violations.some((v) => v.type === 'dialogue')).toBe(true);
    });

    it('nie flaguje akcji NPC przy angielskich przyimkach relacyjnych (behind, in front of, next to, opposite, across from)', () => {
      const text1 = `The cultist steps behind Arthur and raises a rusted dagger.\n\n[What do you do?]`;
      const res1 = lintAgencyViolations(text1, ['Arthur'], { locale: 'en' });
      expect(res1.hasViolation).toBe(false);

      const text2 = `The monstrosity drops in front of Constance and roars loudly.\n\n[What do you do?]`;
      const res2 = lintAgencyViolations(text2, ['Constance'], { locale: 'en' });
      expect(res2.hasViolation).toBe(false);

      const text3 = `The sheriff sits down next to Arthur and takes out a cigarette.\n\n[What do you do?]`;
      const res3 = lintAgencyViolations(text3, ['Arthur'], { locale: 'en' });
      expect(res3.hasViolation).toBe(false);

      const text4 = `A masked figure stands opposite Constance and watches in silence.\n\n[What do you do?]`;
      const res4 = lintAgencyViolations(text4, ['Constance'], { locale: 'en' });
      expect(res4.hasViolation).toBe(false);

      const text5 = `The stranger appears across from Arthur with a cold smile.\n\n[What do you do?]`;
      const res5 = lintAgencyViolations(text5, ['Arthur'], { locale: 'en' });
      expect(res5.hasViolation).toBe(false);
    });

    it('obsługuje deklinację obcojęzycznych nazwisk z apostrofem (Poe, Lovecraft)', () => {
      // Dopełniacz Poe'go z naruszeniem ekwipunku
      const text1 = `Cień pada na biurko, a dłoń Poe'go sięga po rewolwer z szuflady. [Co robisz?]`;
      const res1 = lintAgencyViolations(text1, ['Edgar Allan Poe']);
      expect(res1.hasViolation).toBe(true);
      expect(res1.violations.some((v) => v.type === 'inventory')).toBe(true);

      // Dopełniacz Lovecraft'a z naruszeniem ekwipunku
      const text2 = `Księga leży w kurzu. Dłoń Lovecraft'a wyciąga nóż ze skórzanej pochwy. [Co robisz?]`;
      const res2 = lintAgencyViolations(text2, ['H. P. Lovecraft']);
      expect(res2.hasViolation).toBe(true);
      expect(res2.violations.some((v) => v.type === 'inventory')).toBe(true);

      // Celownik Poe'mu z konstrukcją modalną ruchu
      const text3 = `Poe'mu udaje się zeskoczyć z kozła wprost w gęste błoto. [Co robisz?]`;
      const res3 = lintAgencyViolations(text3, ['Poe']);
      expect(res3.hasViolation).toBe(true);
      expect(res3.violations.some((v) => v.type === 'movement')).toBe(true);
    });

    it('zachowuje tagi systemowe (DZIENNIK, LOKACJA, OBECNI_NPC, ZMIANA_SCENY, AKTUALNY CZAS) przy odcięciu tekstu', () => {
      const rawText =
        `Deszcz bębni o dach krypty. Przed wrotami stoi stara latarnia.\n` +
        `Constance zeskakuje z kozła, wyciąga apteczkę i bada rany woźnicy.\n\n` +
        `[DZIENNIK: Odkryto wejście do krypty Rodziny Blackwood]\n` +
        `Grobowiec wydaje się nienaruszony od dziesięcioleci.\n` +
        `[/DZIENNIK]\n` +
        `[LOKACJA: Cmentarz Blackwood]\n` +
        `[OBECNI_NPC: Woźnica]\n` +
        `[ZMIANA_SCENY]\n` +
        `[Co robisz?]\n` +
        `[AKTUALNY CZAS: 12 Października 1925, 23:45]`;

      const sanitized = sanitizeAgencyViolations(rawText, ['Constance']);

      // Narracja powinna być ucięta przed naruszeniem
      expect(sanitized).toContain('Deszcz bębni o dach krypty. Przed wrotami stoi stara latarnia.');
      expect(sanitized).not.toContain('zeskakuje z kozła');
      expect(sanitized).not.toContain('wyciąga apteczkę');
      expect(sanitized).not.toContain('bada rany');

      // Tagi systemowe muszą zostać zachowane
      expect(sanitized).toContain('[DZIENNIK: Odkryto wejście do krypty Rodziny Blackwood]');
      expect(sanitized).toContain('Grobowiec wydaje się nienaruszony od dziesięcioleci.');
      expect(sanitized).toContain('[/DZIENNIK]');
      expect(sanitized).toContain('[LOKACJA: Cmentarz Blackwood]');
      expect(sanitized).toContain('[OBECNI_NPC: Woźnica]');
      expect(sanitized).toContain('[ZMIANA_SCENY]');

      // Question marker i czas na końcu
      expect(sanitized).toContain('[Co robisz?]');
      expect(sanitized).toMatch(/\[AKTUALNY CZAS: 12 Października 1925, 23:45\]$/);
      // Brak podwojonego [Co robisz?]
      expect(sanitized).not.toContain('[Co robisz?]\n\n[Co robisz?]');
    });
  });
});

describe('declared entry regression from Prabuty player session',()=>{
 const names=['Tomasz Nowicki'];
 const options={locale:'pl' as const,declaredAction:{characterName:names[0],text:'Gaszę latarkę i wchodzę do sieni za zaproszeniem, zamykając cicho drzwi.'}};
 it('allows the exact entry and destination explicitly declared by this investigator',()=>{
  expect(lintAgencyViolations('Tomasz wchodzi do sieni. Tadeusz pokazuje dokument.',names,options).hasViolation).toBe(false);
  expect(lintAgencyViolations('Wchodzisz do sieni. Tadeusz pokazuje dokument.',names,options).hasViolation).toBe(false);
 });
 it('keeps other destinations and other investigators protected',()=>{
  expect(lintAgencyViolations('Tomasz wchodzi do krypty.',names,options).hasViolation).toBe(true);
  expect(lintAgencyViolations('Helena wchodzi do sieni.',[...names,'Helena Krawczyk'],options).hasViolation).toBe(true);
 });
 it.each(['Nie wchodzę do sieni.','Jeśli wchodzę do sieni, czy mogę zobaczyć dokument?','Mówię: „Wchodzę do sieni”.'])('does not authorize a negation, hypothetical, or dialogue: %s',text=>{
  expect(lintAgencyViolations('Tomasz wchodzi do sieni.',names,{...options,declaredAction:{characterName:names[0],text}}).hasViolation).toBe(true);
 });
 it('preserves unauthorized inventory protection even during an authorized entry',()=>{
  expect(lintAgencyViolations('Tomasz wchodzi do sieni. Tomasz wyciąga rewolwer.',names,options).violations.some(v=>v.type==='inventory')).toBe(true);
 });
 it('supports equivalent explicit EN entry without granting another destination',()=>{
  const en={locale:'en' as const,declaredAction:{characterName:'Frank Miller',text:'I enter the pharmacy.'}};
  expect(lintAgencyViolations('Frank enters the pharmacy.',['Frank Miller'],en).hasViolation).toBe(false);
  expect(lintAgencyViolations('You enter the basement.',['Frank Miller'],en).hasViolation).toBe(true);
 });
});

it.each([
 ['pl','Wchodzę do starej apteki.','Tomasz wchodzi do starej kaplicy.'],
 ['en','I enter the red pharmacy.','Tomasz enters the red chapel.'],
 ['pl','Jeżeli Helena zaprosi, wchodzę do sieni.','Tomasz wchodzi do sieni.'],
 ['pl','Wchodzę do sieni, jeśli Helena zaprosi.','Tomasz wchodzi do sieni.'],
 ['en','I enter the pharmacy if Helena invites me.','Tomasz enters the pharmacy.'],
] as const)('keeps ambiguous or conditional entry protected: %s %s',(locale,text,response)=>{
 expect(lintAgencyViolations(response,['Tomasz Nowicki'],{locale,declaredAction:{characterName:'Tomasz Nowicki',text}}).hasViolation).toBe(true);
});

it.each([
 ['pl',"Mówię: 'Wchodzę do sieni.'",'Tomasz wchodzi do sieni.'],
 ['en',"I say: 'I enter the pharmacy.'",'Tomasz enters the pharmacy.'],
 ['en','Do you think I enter the pharmacy?','Tomasz enters the pharmacy.'],
] as const)('does not treat quoted or interrogative entry as a physical declaration: %s %s',(locale,text,response)=>{
 expect(lintAgencyViolations(response,['Tomasz Nowicki'],{locale,declaredAction:{characterName:'Tomasz Nowicki',text}}).hasViolation).toBe(true);
});

describe('trailing location protocol parity after agency sanitization', () => {
  const blockedProse = 'Deszcz bębni o dach. Constance zeskakuje z kozła, wyciąga apteczkę i bada rany woźnicy.';
  it.each(['loc-prabuty-krypta', 'OFF_GRAPH | Telefon przy szosie'])('preserves exact PL and EN location tags: %s', reference => {
    for (const tagName of ['LOKACJA', 'LOCATION']) {
      const tag = `[${tagName}: ${reference}]`;
      const raw = `${blockedProse}\n\n${tag}\n[AKTUALNY CZAS: 19 Października 1973, 03:00]`;
      expect(lintAgencyViolations(raw, ['Constance'], {locale:'pl'}).hasViolation).toBe(true);
      const sanitized = sanitizeAgencyViolations(raw, ['Constance'], {locale:'pl'});
      expect(sanitized).not.toContain('zeskakuje z kozła');
      expect(sanitized).toContain(tag);
      expect(sanitized.split(tag)).toHaveLength(2);
      expect(sanitized).toContain('[AKTUALNY CZAS: 19 Października 1973, 03:00]');
    }
  });

  it('does not invent either location tag when the raw narration has none', () => {
    const sanitized = sanitizeAgencyViolations(blockedProse, ['Constance'], {locale:'pl'});
    expect(sanitized).not.toContain('zeskakuje z kozła');
    expect(sanitized).not.toMatch(/\[(?:LOKACJA|LOCATION):/i);
  });
});
