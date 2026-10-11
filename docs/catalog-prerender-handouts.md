# Katalog Prerenderu Mediów i Handoutów - Strażnik Tajemnic AI

> **Status:** Indeks Główny (SSOT Backlogu Produkcyjnego)  
> **Data aktualizacji:** 2026-10-08  
> **Wersja silnika:** v0.9.5+ (Zgodna z architekturą Issue #661 / #700 oraz tagami `[DOWÓD: slug]`, `[HANDOUT: slug]`, `[AUDIO: slug]`, `[LOKACJA: slug]`)  
> **Liczba objętych spraw:** 30 scenariuszy (3 Fale Realizacyjne)

---

## 1. Architektura Standardu Produkcyjnego

### 1.1. Czy wszystkie przygody są pisane „wg jednego klucza”?
**Nie w warstwie scenariopisarskiej, ale TAK w warstwie technicznej silnika gry:**
- **Różnorodność fabularna (Kanon RAW):** Każda przygoda ma swoją unikalną mechanikę prowadzenia:
  - *Klasyczne śledztwo piaskownicy (Sandbox):* np. *Nawiedzony dom*, *Szkarłatne litery*, *Horror nad Wartą* - swobodne badanie archiwów, bibliotek, przepytywanie świadków.
  - *Liniowy survival / wyścig z czasem (Action/Event-Driven):* np. *Pośród pradawnych drzew*, *Noc zagłady*, *Babie Lato* - presja uciekających godzin, zasadzki, starcia.
  - *Zamknięty krąg podejrzanych / eksperymenty narracyjne:* np. *Prosta robota* (brak NPC, tylko sekwencja listów i dźwięków) czy *Kwiat Paproci* (nagrania AR audio/wideo).
  - *Pulpowy spektakl akcji:* 4 scenariusze z *Pulp Cthulhu* - dynamiczne tempo, pościgi, aukcje artefaktów.
- **Jednolity standard techniczny silnika (Klucz Strażnika Tajemnic AI):**  
  Niezależnie od struktury fabularnej, każdy produkowany asset wpina się w deterministyczny resolver silnika (`adventure-asset-resolver.ts`) poprzez 4 ujednolicone kategorie:
  1. `[DOWÓD: slug]` / `[HANDOUT: slug]` - fizyczny rekwizyt gracza (dokument, list, telegram, wycinek prasowy, fotografia, mapa z perspektywy gracza).
  2. `[AUDIO: slug]` - diegetyczne nagranie lektorskie (czytana taśma, audycja radiowa, list, zeznanie) lub dedykowany motyw słuchowiskowy.
  3. `[LOKACJA: slug]` - ilustracja otoczenia w formacie kinowym 16:9 z promptem wstrzykiwanym do tła sceny.
  4. `[PORTRET: slug]` - portret kluczowej postaci NPC w formacie 3:4.

---

### 1.2. 3-Warstwowy Model Produkcji Assetów

Dla każdego scenariusza wykaz rozróżnia trzy precyzyjne stany materiałów:

| Warstwa | Oznaczenie | Opis i Rola w Produkcji |
|---|---|---|
| **Kanon z PDF** | `[KANON-PDF]` | Pomoce fizycznie wydrukowane w podręczniku/zbiorze. Wymagają ekstrakcji graficznej z PDF, OCR tekstu i wdrożenia do paczki przygody. |
| **Adaptacja Mediów** | `[PROD-AUDIO/WIDEO]` | Przedłużenie kanonicznego tekstu na inne zmysły: tekst listu/pamiętnika staje się skryptem lektora TTS (ElevenLabs), a mapa lub stara taśma zamienia się w animowaną pętlę MP4. |
| **Uzupełnienie Luki** | `[AI-EXPANDED]` | Materiały, których autorzy scenariusza nie zilustrowali (opisani słownie NPC, kluczowe punkty zwrotne, biomy akustyczne, efekty SFX). |

---

### 1.3. Model Realizacji: 1 Przygoda = 1 Dedykowane Issue na GitHubie

Zgodnie z zasadą orkiestracji `aios-vibe-coder`, każda przygoda z poniższego wykazu otrzymuje **własne, niezależne Issue na GitHubie** z kompletnym PRP:
- Etykiety: `area:assets`, `pack:prerender`, `fala-1` (lub `fala-2` / `fala-3`), `tone:[purist/pulp/noir]`.
- Zawartość Issue:
  1. Wykaz kanonicznych plików źródłowych z dokładnymi stronami w podręczniku.
  2. Kompletne prompty graficzne (Midjourney/Flux) z zachowaniem Visual DNA epoki (np. ziarno fotografii z lat 20., orthochromatic film, druk zecerski).
  3. Skrypty lektorskie audio (z podziałem na role, akcenty i modulację głosu).
  4. Wytyczne biomu akustycznego (ambient tła + triggery SFX dla słuchowiska).
  5. Kryteria odbioru: 100% plików w formacie WEBP / MP3 w `public/adventure-packs/<slug>/` + test Playwright sprawdzający wywołanie tagu `[DOWÓD: slug]`.

---

## 2. Zestawienie Zbiorcze 30 Scenariuszy

| Lp. | Scenariusz | Źródło / Książka | Epoka / Lokacja | Kanon PDF | Audio Lektor | Słuchowisko/SFX | Wideo/Pętle | Fala |
|:--:|---|---|---|:--:|:--:|:--:|:--:|:--:|
| 1 | **Nawiedzony dom** | Starter Klasyczny | 1920 (Boston) | 9 | 4 | 3 | 1 | **Fala 1** (Issue #700, #703, #704) |
| 2 | **Noc zagłady** | Starter Mity Wojny | 1940 (Klasztor, Polska) | 6 | 3 | 4 | 1 | **Fala 1** (Issue #715, #705) |
| 3 | **Tajemnica Czarnego Sarkofagu** | Starter Maski (Prolog) | 1919 (Lima, Andy, Peru) | 5 | 2 | 4 | 1 | **Fala 1** (Issue #716, #706) |
| 4 | **Pośród pradawnych drzew** | Podręcznik Główny 7e | 1927 (Vermont, lasy) | 3 | 2 | 5 | 1 | **Fala 1** |
| 5 | **Szkarłatne litery** | Podręcznik Główny 7e | 1920s (Arkham, Miskatonic) | 7 | 4 | 3 | 1 | **Fala 1** |
| 6 | **Cień nad Prabutami** | Quick Setup PL (Strefa 11) | 1973 (PRL, Prabuty) | 4 | 3 | 4 | 1 | **Fala 1** (Issue #717, #707) |
| 7 | **Tajemnica Pędnika Łągiewki** | Quick Setup PL (Strefa 11) | 1996 (PRL/PL, Łódź) | 3 | 2 | 3 | 1 | **Fala 1** (Issue #718, #708) |
| 8 | **Tajemnica Dzieci z Traszyna** | Quick Setup PL (Strefa 11) | 1999 (Mazury, Traszyn) | 3 | 2 | 3 | 1 | **Fala 1** (Issue #719, #709) |
| 9 | **Przybysz z Matriksa (Głogów)** | Quick Setup PL (Strefa 11) | 2001 (Dolny Śląsk) | 3 | 2 | 3 | 1 | **Fala 1** (Issue #720, #710) |
| 10 | **The Englewood Labyrinth** | Quick Setup EN (Cold Cases) | 1894 (Chicago, Holmes) | 4 | 3 | 4 | 1 | **Fala 1** (Issue #721, #711) |
| 11 | **The Almer Coe Spectacles** | Quick Setup EN (Cold Cases) | 1924 (Chicago, Franks) | 3 | 2 | 3 | 1 | **Fala 1** (Issue #722, #712) |
| 12 | **The Circleville Letters** | Quick Setup EN (Cold Cases) | 1983 (Ohio, Circleville) | 3 | 3 | 3 | 1 | **Fala 1** (Issue #723, #713) |
| 13 | **The Ovidhall Lake Anomaly** | Quick Setup EN (Cold Cases) | 2005 (Michigan, Muskegon) | 3 | 2 | 3 | 1 | **Fala 1** (Issue #724, #714) |
| 14 | **Dorośli we mgle** | Horror nad Wartą | 1920s (Poznań) | 8 | 4 | 3 | 1 | **Fala 2** |
| 15 | **Koszmar Poznania** | Horror nad Wartą | 1920s (Poznań) | 2 | 1 | 4 | 1 | **Fala 2** |
| 16 | **Miłość ci wszystko wybaczy?** | Horror nad Wartą | 1920s (Poznań, Cytadela) | 15 | 5 | 4 | 1 | **Fala 2** |
| 17 | **W cieniu świateł** | Horror nad Wartą | 1920s (Poznań, targi) | 12 | 3 | 4 | 1 | **Fala 2** |
| 18 | **Sprawa małego Cohna** | Usłysz Zew Cthulhu | 1924 (Warszawa/Łódź) | 6 | 3 | 3 | 1 | **Fala 2** |
| 19 | **Dawno temu w Dusznikach** | Usłysz Zew Cthulhu | 1826 (Duszniki-Zdrój) | 8 | 3 | 5 | 1 | **Fala 2** |
| 20 | **Babie Lato** | Usłysz Zew Cthulhu | 1943 (Lubelszczyzna) | 7 | 4 | 5 | 1 | **Fala 2** |
| 21 | **Na dnie smętnego jeziora** | Usłysz Zew Cthulhu | 1930s (Mazury) | 4 | 2 | 4 | 1 | **Fala 2** |
| 22 | **Dom, którego nie ma** | Usłysz Zew Cthulhu | 1920s (Kresy / Mazowsze) | 5 | 3 | 4 | 1 | **Fala 2** |
| 23 | **Dziedzictwo Tatr** | Cienie Tatr | 1920s (Zakopane) | 3 | 2 | 4 | 1 | **Fala 2** |
| 24 | **Pełzająca kontrrewolucja** | Cienie Tatr | 1980s (Tatry / PRL) | 3 | 2 | 3 | 1 | **Fala 2** |
| 25 | **Pociąg do szaleństwa** | Cienie Tatr | 1945/1970s (Góry Sowie) | 7 | 3 | 5 | 1 | **Fala 2** |
| 26 | **Pozdrowienia z Polski** | Cienie Tatr | 1920s (Małopolska) | 5 | 3 | 3 | 1 | **Fala 2** |
| 27 | **Dezintegrator** | Pulp Cthulhu | 1930s (Szanghaj) | 6 | 2 | 4 | 1 | **Fala 3** |
| 28 | **Czekając na huragan** | Pulp Cthulhu | 1930s (Key West, Floryda) | 5 | 2 | 5 | 1 | **Fala 3** |
| 29 | **Puszka Pandory** | Pulp Cthulhu | 1930s (Nowy Jork) | 6 | 3 | 4 | 1 | **Fala 3** |
| 30 | **Powolny rejs do Chin** | Pulp Cthulhu | 1930s (Pacyfik, liniowiec) | 5 | 2 | 4 | 1 | **Fala 3** |

---

## 3. FALA 1 - Fundament Systemowy (13 Scenariuszy)

### 3.1. Startery Oficjalne (3 Sprawy)

#### [CASE-S01] Nawiedzony dom (*The Haunting*)
- **Źródło:** `ZC_Starter.pdf` (str. 15-32)
- **Epoka / Rejestr:** 1920, Boston, Massachusetts | Purist / Classic Investigation
- **Katalog A (Grafika & Dokumenty):**
  - `[KANON-PDF]` Pomoc 1: Zlecenie i klucze pana Stevena Knotta (str. 30).
  - `[KANON-PDF]` Pomoc 2: Nieopublikowany artykuł „Boston Globe” z 1918 r. o rodzinach French i Macario (str. 30).
  - `[KANON-PDF]` Pomoc 3: Rejestr gruntów z 1852 r. (zakup przez Waltera Corbitta) (str. 30).
  - `[KANON-PDF]` Pomoc 4: Pozew sąsiedzki przeciw Corbittowi z 1853 r. (str. 30).
  - `[KANON-PDF]` Pomoc 5: Nekrolog Waltera Corbitta z 1866 r. (str. 30).
  - `[KANON-PDF]` Pomoc 7: Akta wykonawcy testamentu (pastor Michael Thomas) (str. 30).
  - `[KANON-PDF]` Pomoc 8: Raport policyjny z nalotu na Kaplicę Kontemplacji z 1912 r. (str. 30).
  - `[KANON-PDF]` Pomoc 9: Mistyczny symbol Kaplicy Kontemplacji (trzy litery Y z okiem) (str. 30).
  - `[KANON-PDF]` Plan domu Corbitta (parter, piętro, piwnica) (str. 21).
  - `[AI-EXPANDED]` Portrety NPC: Walter Corbitt (zmumifikowany czarnoksiężnik), Steven Knott, Gabriela Macario, redaktor Arty Wilmot.
  - `[AI-EXPANDED]` Kadry lokacji 16:9: Front Corbitt House pośród nowszych kamienic, zrujnowana Kaplica Kontemplacji o zmierzchu.
- **Katalog B (Audio / Słuchowisko):**
  - `[PROD-AUDIO]` Lektor: Zeznanie pani Macario ze szpitala w Roxbury (głos znerwicowany, urywany).
  - `[PROD-AUDIO]` Lektor: Transkrypcja fragmentu *Dziennika Waltera Corbitta* (łacińskie wezwanie Otwierającego Drogi).
  - `[PROD-AUDIO]` Lektor: Artykuł Boston Globe (stylizowany lektor kroniki radiowej z lat 20.).
  - `[PROD-AUDIO]` Biomy ambient: Złowroga cisza starego domu ze skrzypieniem belek, szum pras drukarskich Boston Globe.
  - `[PROD-AUDIO]` SFX słuchowiskowe: Grzechotanie okna na piętrze, nagły łomot rzucanego łóżka, brzęk lewitującego sztyletu, chrobot stada szczurów za boazerią piwnicy.
- **Katalog C (Wideo):**
  - `[PROD-WIDEO]` Cinemagraph 16:9: Pusta sypialnia gościnna z trzaskającymi okiennicami i kapiącą plamą krwi na suficie.

---

#### [CASE-S02] Noc zagłady (*World War Cthulhu*)
- **Źródło:** `ZC_Starter-MityWojny.pdf` (str. 17-38)
- **Epoka / Rejestr:** Jesień 1940, okupowana Polska, odcięty klasztor | Wojna, Konspiracja, Groza psychologiczna
- **Katalog A (Grafika & Dokumenty):**
  - `[KANON-PDF]` Mapa taktyczna klasztoru i dziedzińca z rozstawieniem posterunków niemieckich.
  - `[KANON-PDF]` Meldunek polowy niemieckiego dowódcy garnizonu (rozkaz pacyfikacji).
  - `[KANON-PDF]` Fałszywa kenkarta / przepustka z pieczęcią Generalnego Gubernatorstwa.
  - `[KANON-PDF]` Odręczny gryps więźnia politycznego ukryty w różańcu.
  - `[KANON-PDF]` Szkic podziemnych krypt klasztornych z oznaczeniem zamurowanego przejścia.
  - `[AI-EXPANDED]` Portrety NPC: Oficer Gestapo Hans von Weber, Ojciec przeor Augustyn, konspiratorka „Kalina”.
  - `[AI-EXPANDED]` Kadry lokacji 16:9: Zamglony las jodłowy z sylwetką klasztoru w deszczu, reflektory strażnicze na dziedzińcu.
- **Katalog B (Audio / Słuchowisko):**
  - `[PROD-AUDIO]` Lektor: Odczyt niemieckiego obwieszczenia wojskowego z megafonu ulicznego (szczekaczka).
  - `[PROD-AUDIO]` Lektor: Szeptany gryps konspiracyjny odtwarzany w chwili przeszukiwania skrytki.
  - `[PROD-AUDIO]` Biomy ambient: Jesienna ulewa dudniąca o blaszany dach klasztoru, daleki warkot ciężarówek Opel Blitz na niskich obrotach.
  - `[PROD-AUDIO]` SFX słuchowiskowe: Krok podkutych butów na kamiennej posadzce klasztoru, szczęk zamka Mausera 98k, nieludzki charkot uwięzionej w krypcie bestii.
- **Katalog C (Wideo):**
  - `[PROD-WIDEO]` Cinemagraph: Deszcz za zakratowanym oknem celi klasztornej z przemykającym snopem wojskowego reflektora.

---

#### [CASE-S03] Tajemnica Czarnego Sarkofagu (*Prolog Peru*)
- **Źródło:** `ZC_Starter-Maski.pdf` (str. 17-38)
- **Epoka / Rejestr:** Kwiecień 1919, Lima i płaskowyż Andyjski, Peru | Ekspedycja archeologiczna, Pulp/Classic
- **Katalog A (Grafika & Dokumenty):**
  - `[KANON-PDF]` List Jacksona Eliasa zapraszający do ekspedycji w głąb Andów.
  - `[KANON-PDF]` Wycinek prasowy z gazety „El Comercio” o zbezczeszczeniu grobowców w rejonie Puno.
  - `[KANON-PDF]` Odręczna mapa szlaku górskiego Augusta Larkina w stronę kopalni srebra i piramidy.
  - `[KANON-PDF]` Złoty amulet z symbolem Kharisiri (szkic i rycina artefaktu).
  - `[KANON-PDF]` Zapiski z pamiętnika hiszpańskiego konkwistadora z 1542 r. o „wysysaczach tłuszczu”.
  - `[AI-EXPANDED]` Portrety NPC: Młody Jackson Elias (1919), chory na pasożyta Augustus Larkin, przewodnik Luis de Mendoza.
  - `[AI-EXPANDED]` Kadry lokacji 16:9: Kolonialna weranda Hotelu Maury w Limie, skalny wąwóz w Andach w świetle księżyca.
- **Katalog B (Audio / Słuchowisko):**
  - `[PROD-AUDIO]` Lektor: Głos Jacksona Eliasa odczytujący swoje wczesne notatki o kulcie Kharisiri.
  - `[PROD-AUDIO]` Lektor: Gorączkowy, urywany monolog majaczącego Larkina w ataku gorączki andyjskiej.
  - `[PROD-AUDIO]` Biomy ambient: Szum fal Pacyfiku i gwar targowiska w Limie, lodowaty wicher wiejący przez Andyjskie przełęcze.
  - `[PROD-AUDIO]` SFX słuchowiskowe: Dźwięk bębna tubylców z oddali, niepokojący świszczący oddech Kharisiri zbliżającego się do namiotu, metaliczny trzask otwierania kamiennego sarkofagu.
- **Katalog C (Wideo):**
  - `[PROD-WIDEO]` Cinemagraph: Płonące ognisko w wysokogórskim obozie w Andach z majaczącym w mroku cieniem bestii.

---

### 3.2. Podręcznik Główny CoC 7e (2 Sprawy)

#### [CASE-M01] Pośród pradawnych drzew (*Amidst the Ancient Trees*)
- **Źródło:** `ZewCthulhu_KsiegaStraznika_v.1.3.pdf` (str. 395-414) oraz `KS_materialy.pdf`
- **Epoka / Rejestr:** Październik 1927, lasy w stanie Vermont, Bennington | Dzika natura, Senne wizje, Gla'aki
- **Katalog A (Grafika & Dokumenty):**
  - `[KANON-PDF]` Mapa #1: Hrabstwo Bennington i obóz poszukiwawczy Jane Collins.
  - `[KANON-PDF]` Mapa #2: Rejon jeziora i zalanego kamieniołomu.
  - `[KANON-PDF / NARRACJA]` Pomoce dla graczy: Senne Wezwania (cztery warianty onirycznej narracji w diegetycznym oknie czatu: Niespokojna noc, Chata w ciemnościach, Ścieżka przez las, Coś w jeziorze; bez stanu przedmiotu w ekwipunku).
  - `[AI-EXPANDED]` List gończy za porywaczami i fotografia zaginionej Jane Collins.
  - `[AI-EXPANDED]` Portrety NPC: Szeryf Baker, przywódca porywaczy Harris, ranny geolog Otis.
  - `[AI-EXPANDED]` Kadry lokacji 16:9: Gęsty, prastary las sosnowy w gęstej mgle, czarna tafla zalanego kamieniołomu z wystającym żelaznym słupem.
- **Katalog B (Audio / Słuchowisko):**
  - `[PROD-AUDIO]` Lektor: Odczytanie sennego wezwania Gla'akiego (hipnotyczny, wielogłosowy szept).
  - `[PROD-AUDIO]` Lektor: List pożegnalny jednego z oszalałych porywaczy.
  - `[PROD-AUDIO]` Biomy ambient: Szum wierzchołków sosen na wietrze, odgłosy nocnego lasu (puchacze, trzask łamanych gałęzi), głuche dudnienie spod wody kamieniołomu.
  - `[PROD-AUDIO]` SFX słuchowiskowe: Strzał ze sztucera z echem niosącym się po dolinie, chlupot wody i metaliczny rezonans uderzanego kryształu sługi Gla'akiego.
- **Katalog C (Wideo):**
  - `[PROD-WIDEO]` Cinemagraph: Mgła snująca się nad lustrem czarnego jeziora z delikatnie pulsującym podwodnym szmaragdowym blaskiem.

---

#### [CASE-M02] Szkarłatne litery (*Crimson Letters*)
- **Źródło:** `ZewCthulhu_KsiegaStraznika_v.1.3.pdf` (str. 415-436) oraz `KS_materialy.pdf`
- **Epoka / Rejestr:** Październik 1920s, Uniwersytet Miskatonic, Arkham | Śledztwo akademickie, Okultyzm, Demon Rogaty
- **Katalog A (Grafika & Dokumenty):**
  - `[KANON-PDF]` Mapa #1: Domek zmarłego profesora Charlesa Leitera.
  - `[KANON-PDF]` Mapa #2: Antykwariat „Niedostrzeżone Drobiazgi” Abnery Doane'a.
  - `[KANON-PDF]` List dziekana Fallona zlecający odzyskanie zaginionych dokumentów uniwersyteckich.
  - `[KANON-PDF]` Papiery Leitera: fragment przekładu zwoju w języku akadyjskim z krwawym tuszem.
  - `[KANON-PDF]` Kartka z groźbą podłożona pod drzwi akademika.
  - `[KANON-PDF]` Raport policyjny z oględzin zwłok profesora Leitera (dziwny paraliż twarzy).
  - `[AI-EXPANDED]` Portrety NPC: Dziekan Fallon, antykwariusz Abner Doane, studentka Emilia Court, lichwiarz Roach.
  - `[AI-EXPANDED]` Kadry lokacji 16:9: Dziedziniec Uniwersytetu Miskatonic w deszczowy jesienny wieczór, zagracone wnętrze antykwariatu Doane'a.
- **Katalog B (Audio / Słuchowisko):**
  - `[PROD-AUDIO]` Lektor: Oficjalna rozmowa zleceniodawcy z graczami w gabinecie dziekana.
  - `[PROD-AUDIO]` Lektor: Ostatnie nagranie na woskowym cylindrze dyktafonu profesora Leitera (przerwane demonicznym rykiem).
  - `[PROD-AUDIO]` Biomy ambient: Odgłosy jesiennego deszczu na bruku Arkham, skrzypienie drewnianych podłóg w bibliotece uniwersyteckiej.
  - `[PROD-AUDIO]` SFX słuchowiskowe: Syczenie atramentu palącego papier, kroki Istoty ze Ścian, trzask wyłamywanych drzwi domku Leitera.
- **Katalog C (Wideo):**
  - `[PROD-WIDEO]` Cinemagraph: Pióro leżące na biurku, z którego powoli sączy się i rozlewa szkarłatny, żywy atrament układający się w przeklęte litery.

---

### 3.3. Scenariusze Quick Setup z Silnika Gry (8 Spraw)

#### Seria Polska: Strefa 11 (PRL / III RP)
- **[CASE-Q01] Cień nad Prabutami: Widzenie Ojca Klimuszki (1973):**
  - *Materiały w repozytorium:* `public/handouts/cien-nad-prabutami/`
  - *Kanon / Dedykowane:* Fotografia ruin kościoła św. Wojciecha w Prabutach (1947), Teczka operacyjna SB kryptonim „KLIN” (Wydz. IV KWMO Elbląg), Odręczna receptura zielarska nr 152 ojca Klimuszki.
  - *Audio:* Szum aparatury podsłuchowej SB, lektor odczytujący raport podsłuchu celi zakonnej.
  - *Wideo:* Archiwalne zniekształcenia taśmy czarno-białej z kadrem ruin kościoła.
- **[CASE-Q02] Tajemnica Pędnika Łągiewki (Łódź, 1996):**
  - *Materiały w repozytorium:* `public/handouts/tajemnica-pendnika-lagiewki/`
  - *Kanon / Dedykowane:* Wykres rezonansu czasoprzestrzennego pędnika kinetycznego, Ściśle tajny raport Wojskowej Akademii Technicznej, Schemat zderzaka hydraulicznego z obcymi runami Mi-Go.
  - *Audio:* Dźwięk uderzenia pędnika pochłaniającego 100% energii kinetycznej (nienaturalna cisza), nagranie wywiadu radiowego z inżynierem Łągiewką.
- **[CASE-Q03] Tajemnica Dzieci z Traszyna (Warmia, 1999):**
  - *Materiały w repozytorium:* `public/handouts/tajemnica-dzieci-z-traszyna/`
  - *Kanon / Dedykowane:* Szkic wyschniętego drewnianego krzyża na stodole, Kserokopia księgi meldunkowej parafii z 1945 r., Notatka lekarska o mutacji krwi u dzieci.
  - *Audio:* Monotonny, hipnotyzujący śpiew dzieci dobiegający ze stodoły w nocy, szum polskiej prowincji i szczekanie psów w oddali.
- **[CASE-Q04] Przybysz z Matriksa: Eksperyment Głogów (2001):**
  - *Materiały w repozytorium:* `public/handouts/przybysz-z-matriksa-glogow/`
  - *Kanon / Dedykowane:* Etykieta taśmy VHS z nagraniem przesłuchania w bunkrze, Karta szpitalna z zakładu psychiatrycznego w Lubiążu, Schemat wojskowej anteny nadawczej.
  - *Audio:* Zniekształcony sygnał modemu i pisk zakłóceń 50 Hz ze starych kineskopów, głos przesłuchiwanego twierdzącego, że świat jest symulacją Yuggoth.

#### Seria Angielska: American Mythos Cold Cases
- **[CASE-Q05] The Englewood Labyrinth: Holmes's Castle (Chicago, 1894):**
  - *Materiały:* Plan drugiego piętra Zamku Morderstw (35 ślepych pokoi), Odlew stopy Emeline Cigrand wytrawiony kwasem na drzwiach skarbca, Puszka z niewysłanymi listami dzieci Pitezel.
  - *Audio:* Syk zaworów gazowych w ścianach sypialni, echo kroków w ślepym korytarzu.
- **[CASE-Q06] The Almer Coe Spectacles: Leopold & Loeb (Chicago, 1924):**
  - *Materiały:* Karta recepturowa optyka Almer Coe & Co. z unikalnym zawiasem szylkretowym, List z żądaniem okupu pisany na maszynie Underwood No. 3, Notatki hermetyczne z Uniwersytetu Chicagowskiego.
  - *Audio:* Monotonny stukot maszyny do pisania z defektem czcionki „e”, zeznanie Leopolda z arogancją Übermenscha.
- **[CASE-Q07] The Circleville Letters (Ohio, 1983):**
  - *Materiały:* Anonimowy list pisany drukowanymi literami z pogróżkami dla Mary Gillespie, Schemat pułapki pistoletowej na tablicy drogowej Pickaway County, Raport koronera po wypadku Rona Gillespiego.
  - *Audio:* Zniekształcony głos z budki telefonicznej odtwarzany przez CB-radio, szum wiatru na wiejskiej drodze w Ohio.
- **[CASE-Q08] The Ovidhall Lake Anomaly: Todd Geib (Michigan, 2005):**
  - *Materiały:* Raport toksykologiczny z jeziora Muskegon (brak wody w płucach mimo zanurzenia), Logi logowania telefonu komórkowego do masztu BTS, Fotografia graffiti uśmiechniętej buźki (Smiley Face) na pomoście.
  - *Audio:* Ostatnia urwana wiadomość na poczcie głosowej z bulgotem wody, ambient trzcinowisk jeziora Michigan.

---

## 4. FALA 2 - Polskie Antologie Przygód (13 Scenariuszy)

### 4.1. Horror nad Wartą (Poznań, 4 Sprawy)
*Źródło:* `ZewCthulhu_HorrornadWarta_v.1.2.pdf` oraz paczka `HnW_materialy.zip`

#### [CASE-H01] Dorośli we mgle
- **Katalog A (Grafika & Dokumenty):** 8 kanonicznych pomocy (`Dorośli_we_mgle - pomoc 1` do `8`): wycinki z „Kuriera Poznańskiego”, dokumenty szpitala miejskiego przy ul. Szkolnej, policyjne notatki o zaginięciu dzieci we mgle nadwarciańskiej, plan dzielnicy Chwaliszewo.
- **Katalog B (Audio):** Komunikat radiowy o ograniczeniu ruchu pieszego z powodu gęstej mgły, płacz dziecka dobiegający z nadrzecznych szuwarów, lektor czytający dramatyczny list matki.
- **Katalog C (Wideo):** Pętla mgły kłębiącej się nad mostem Chwaliszewskim z gazowymi latarniami.

#### [CASE-H02] Koszmar Poznania
- **Katalog A (Grafika & Dokumenty):** Kanoniczny plan podziemnych pomieszczeń i kazamatów Fortu Winiary (Cytadeli), akta 4 gotowych Badaczy (Antoni Zasępa, Denis Potocki, Janina Głowacka, Stefan Jaworski).
- **Katalog B (Audio):** Marszowy rytm wojskowy z oddali, kapanie wody w ceglanych kazamatach, nieludzki ryk z lochów Cytadeli.
- **Katalog C (Wideo):** Korytarz forteczny oświetlany chwiejącym się płomieniem latarni naftowej.

#### [CASE-H03] Miłość ci wszystko wybaczy?
- **Katalog A (Grafika & Dokumenty):** Aż 13 kanonicznych pomocy (`Miłość - pomoc 1` do `13`): plany podziemi Cytadeli, rzuty krypt zadżumionych, szkic piwnicy przy Krzywym Kole, bilety do Teatru Wielkiego, listy miłosne z szyfrem okultystycznym.
- **Katalog B (Audio):** Stare trzeszczące nagranie gramofonowe tanga z lat 20. z ukrytym fałszywym tonem powodującym ból głowy, lektor czytający namiętny list podszyty obłędem.
- **Katalog C (Wideo):** Gramofon z obracającą się płytą i tańczącym cieniem na ścianie.

#### [CASE-H04] W cieniu świateł
- **Katalog A (Grafika & Dokumenty):** 12 kanonicznych pomocy (`W_cieniu_świateł - pomoc 1` do `10b`): plany Powszechnej Wystawy Krajowej (PeWuKa 1929), fotografie pawilonów przemysłowych, telegramy z Warszawy, schematy instalacji elektrycznych wysokiego napięcia.
- **Katalog B (Audio):** Buczenie potężnych transformatorów PeWuKi, gwar tłumu zwiedzających na targach, trzask iskier elektrycznych i nienaturalny skowyt istoty zrodzonej z prądu.
- **Katalog C (Wideo):** Podświetlona wieża targowa PeWuKa nocą z migoczącą instalacją neonową.

---

### 4.2. Usłysz Zew Cthulhu (5 Spraw)
*Źródło:* `ZewCthulhu_UslyszZewCthulhu_v.1.1.pdf` oraz paczka `UZC_materialy.zip`

#### [CASE-U01] Sprawa małego Cohna
- **Katalog A (Grafika & Dokumenty):** List zamożnego fabrykanta Cohna, wycinek prasowy o porwaniu na Starym Rynku w 1924 r., szkic rzeźby z manufaktury włókienniczej, raport prywatnego detektywa.
- **Katalog B (Audio):** Gwar bankietu fabrykantów przerwany nagłym stłuczeniem szkła, lektor odczytujący list z żądaniem okupu w złotych carskich rublach.

#### [CASE-U02] Dawno temu w Dusznikach
- **Katalog A (Grafika & Dokumenty):** 8 kanonicznych pomocy (`Dawno_temu_w_Dusznikach - pomoc 1` do `4`, znak wodny młyn, znak Hellerów, znak Kretschmerów, diagramy fabularne): mapa uzdrowiska Bad Reinerz (Duszniki) z 1826 r., zapis nutowy inspirowany etiudami Chopina i muzyką Ericha Zanna.
- **Katalog B (Audio):** Niepokojąca, dysonansowa melodia fortepianowa na granicy słyszalności przeplatana odgłosami kurortu zdrojowego.

#### [CASE-U03] Babie Lato (Minikampania partyzancka - 4 akty)
- **Katalog A (Grafika & Dokumenty):** 7 kanonicznych pomocy (`Babie_Lato - pomoc 1` do `7`): niemieckie plany transportu więźniów „A”, schematy ściśle tajnej aparatury radarowej *Netzwaffe*, partyzanckie grypsy Batalionów Chłopskich, mapa Puszczy Solskiej.
- **Katalog B (Audio):** Odgłosy leśnego obozowiska partyzanckiego, niemiecki radiotelefon polowy nadający zakodowane koordynaty, szum wiatru w babim lecie na polanie.

#### [CASE-U04] Na dnie smętnego jeziora
- **Katalog A (Grafika & Dokumenty):** Wycinki ze wschodniopruskich gazet o utonięciach rybaków, stara mapa batymetryczna jeziora, szkic zatopionej kapliczki pogańskiej.
- **Katalog B (Audio):** Plusk wioseł na spokojnej tafli jeziora, głuche bicie dzwonu spod wody, krzyk mew i szum trzcin.

#### [CASE-U05] Dom, którego nie ma
- **Katalog A (Grafika & Dokumenty):** Akt własności opuszczonego dworku szlacheckiego, plan piętra ze ślepym pokojem lustrzanym, portret rodowy dziedzica z zamazaną twarzą.
- **Katalog B (Audio):** Zegar wahadłowy wybijający trzynastą godzinę, szelest sukni w pustym korytarzu, lektor czytający stary pamiętnik z powstania styczniowego.

---

### 4.3. Cienie Tatr (Podhale & Dolny Śląsk, 4 Sprawy)
*Źródło:* `ZewCthulhu_CienieTatr_v.1.4.pdf` oraz paczka `CT_materialy.zip`

#### [CASE-T01] Dziedzictwo Tatr
- **Katalog A (Grafika & Dokumenty):** Kanoniczny dokument `DZIEDZICTWO_TATR_Legenda.tif.pdf`, rycina tatrzańskiej jaskini, mapa szlaków w rejonie Morskiego Oka i Czerwonych Wierchów z lat 20.
- **Katalog B (Audio):** Huk wiatru halnego uderzającego o okna zakopiańskiej willi, głuche echo spadających kamieni w tatrzańskiej szczelinie, góralska pieśń z archaicznymi słowami.

#### [CASE-T02] Pełzająca kontrrewolucja
- **Katalog A (Grafika & Dokumenty):** Kanoniczny `FragmentKsiazki.pdf`, `RaportMilicyjny.pdf` z posterunku MO w Zakopanem z lat 80., przepustki straży granicznej (WOP).
- **Katalog B (Audio):** Radiostacja milicyjna z charakterystycznym trzaskiem pasma VHF, odgłos kroków na zmrożonym śniegu w nocy.

#### [CASE-T03] Pociąg do szaleństwa
- **Katalog A (Grafika & Dokumenty):** Komplet 7 pomocy: mapa Walimia (wersja pusta i z oznaczeniami), plan domu Fritza, plan domu profesora, przekrój sztolni górnej i dolnej kompleksu Riese w Górach Sowich, diagram fabularny.
- **Katalog B (Audio):** Daleki stukot kół pociągu widma pod ziemią, echo kapiącej wody w wyrobisku sztolni, niemiecki rozkaz z 1945 r. o zaminowaniu wlotu.

#### [CASE-T04] Pozdrowienia z Polski
- **Katalog A (Grafika & Dokumenty):** Kanoniczna koperta z pieczęciami pocztowymi (`POZDROWIENIA_Z_POLSKI_Koperta.pdf`), 4 pomoce narracyjne z listami i pocztówkami z podróży po Małopolsce.
- **Katalog B (Audio):** Dźwięk rozrywanego papieru listowego, lektor czytający zaniepokojony list zagranicznego korespondenta.

---

## 5. FALA 3 - Pulp Cthulhu (4 Duże Scenariusze)
*Źródło:* `Zew_Cthulhu_7ed._Pulp_Cthulhu.pdf` (Rozdziały 11-15, str. 159-275)

#### [CASE-P01] Dezintegrator (*The Disintegrator*)
- **Lokacja / Czas:** 1930s, Hotel Shanghai, Szanghaj, Chiny
- **Katalog A (Grafika & Dokumenty):** Katalog licytacji cudownego wynalazku dr. Hardena, plan luksusowego Hotelu Shanghai, telegram brytyjskiego wywiadu MI6, bilety na rejs parowcem.
- **Katalog B (Audio / SFX):** Gwar międzynarodowego kasyna w Szanghaju, buczenie i świst ładującego się promienia dezintegratora, odgłosy walki wręcz i strzelaniny na korytarzu hotelowym.
- **Katalog C (Wideo):** Oświetlony neonami Bund w Szanghaju w strugach deszczu z przemykającymi rikszami.

#### [CASE-P02] Czekając na huragan (*Waiting for the Hurricane*)
- **Lokacja / Czas:** 1930s, Key West, Floryda
- **Katalog A (Grafika & Dokumenty):** Ostrzeżenie meteorologiczne o huraganie 5. kategorii, mapa wyspy Key West i bazy rybackiej, manifest ładunkowy przemytników rumu, szkic morskiego ołtarza Dagonitów.
- **Katalog B (Audio / SFX):** Ryk huraganowego wiatru zrywającego dachy, uderzenia fal sztormowych o nabrzeże, podwodny ryk bestii przebijający się przez nawałnicę.
- **Katalog C (Wideo):** Palmy wyginające się pod naporem huraganu na tle granatowego, sztormowego nieba.

#### [CASE-P03] Puszka Pandory (*Pandora's Box*)
- **Lokacja / Czas:** 1930s, Nowy Jork (Harlem & Manhattan)
- **Katalog A (Grafika & Dokumenty):** Plan klubu jazzowego w Harlemie, nekrolog gangstera z Chinatown, wycinek z „New York Times” o dziwnej skrzyni z czarnego dębu, policyjny raport z prosektorium Bellevue.
- **Katalog B (Audio / SFX):** Energetyczny swing jazzowy grany na żywo w zadymionym klubie, syreny policyjne Nowego Jorku, złowrogie szepty uwalniane po uchyleniu wieka Puszki Pandory.
- **Katalog C (Wideo):** Zadymiona sala klubu muzycznego ze światłami reflektorów i tańczącymi parami.

#### [CASE-P04] Powolny rejs do Chin (*Slow Boat to China*)
- **Lokacja / Czas:** 1930s, Pacyfik, luksusowy liniowiec pasażerski SS President Coolidge
- **Katalog A (Grafika & Dokumenty):** Przekrój pokładów luksusowego transatlantyku, lista pasażerów pierwszej klasy, menu kolacji kapitańskiej z ukrytą wiadomością, szyfrogram radiotelegraficzny.
- **Katalog B (Audio / SFX):** Monotonny pomruk potężnych turbin parowych statku, plusk fal oceanu, tajemnicze odgłosy drapania od strony ładowni pod linią zanurzenia.
- **Katalog C (Wideo):** Dziób liniowca rozcinający fale nocnego oceanu pod rozgwieżdżonym niebem.

---

## 6. Szablon Issue GitHub dla Każdej Przygody (Asset Pack Contract)

Gdy przystępujemy do produkcji konkretnej przygody, tworzymy Issue o poniższej strukturze:

```markdown
---
title: "Asset Pack: [KOD_PRZYGODY] - [Nazwa Przygody]"
labels: ["area:assets", "pack:prerender", "fala-X", "tone:[purist/pulp/noir]"]
---

### 🎯 Cel i Ramy Sprawy
- **Scenariusz:** [Nazwa]
- **Katalog docelowy:** `public/adventure-packs/[slug]/`
- **Kontekst epoki i filtr wizualny:** [np. 1920s USA / sepia, orthochromatic film grain]

### 📋 Zakres Produkcji (Checklista Mediów)

#### 1. Grafika & Handouty (`[DOWÓD: slug]`)
- [ ] `[KANON]` `clue-01-nazwa.webp` - Ekstrakcja i remaster pomocy ze str. XX
- [ ] `[KANON]` `map-01-teren.webp` - Mapa lokacji z perspektywy Badacza
- [ ] `[AI-EXPANDED]` `portrait-npc-nazwa.webp` - Portret postaci (3:4)
- [ ] `[AI-EXPANDED]` `location-nazwa.webp` - Kinowy kadr lokacji (16:9)

#### 2. Audio & Lektor (`[AUDIO: slug]`)
- [ ] `audio-clue-01.mp3` - Odczytanie listu/dokumentu przez lektora TTS (ElevenLabs)
- [ ] `ambience-biom.mp3` - Pętla tła akustycznego lokacji (deszcz/wiatr/piwnica)
- [ ] `sfx-kluczowy.mp3` - Dedykowany efekt dźwiękowy sceny zwrotnej

#### 3. Wideo & Animacje (`[WIDEO: slug]`)
- [ ] `cinemagraph-intro.mp4` - 5-sekundowa bezszwowa pętla sceny otwierającej

### 🧪 Kryteria Akceptacji (Verification Gate)
1. Wszystkie grafiki skonwertowane do formatu `.webp` (rozmiar < 300 KB).
2. Pliki zarejestrowane w resolverze `src/lib/immersion/adventure-asset-resolver.ts`.
3. Test E2E / jednostkowy potwierdzający poprawne wyświetlenie tagu `[DOWÓD: slug]` w czacie.
```
