# Pokaz PL/EN 22 października - stan prac 21 października

## Stan odbioru

**Praca nie ma jeszcze odbioru prezentacyjnego.** Główna aplikacja na Biurku pozostaje bez zmian. Zmiany są w odizolowanym worktree `two-quicksetup`; bez commitu, pushu ani publikacji.

Wymaganie użytkownika: pełna odpowiedź widoczna dla gracza w 3-5 sekund. Dotychczasowe próby go nie spełniają. Dodatkowa kontrola narracji przez AI pozostaje niewdrożona. Użytkownik zgodził się na trzy próbne pomiary przed decyzją o włączeniu jej do gry.

## Przygotowane zmiany

- Obie istniejące teczki: sytuacje, wiedza i motywacje NPC, powiązania poszlak, materiały i jawne adaptacje. Wspólna aktywacja, przepływ tury, fizyczny ekwipunek i zegar.
- Prabuty PL: zachowana polityka generatora, szczeliny i zakończenia; krótkie karty sytuacji.
- Englewood EN: pięć węzłów, dwanaście tropów, właściwe daty i język; test fizycznego zniszczenia zwornika oraz zakończenie uwzględniające rzeczywiste zdobycie listów.
- Ponowienie po błędzie zachowuje ten sam rozstrzygnięty rzut i wydane Szczęście. Zapis ręczny odmawia archiwizacji nierozliczonego rzutu.
- Nowa przygoda czyści aktywną kampanię i przeładowuje grę, aby odłączyć poprzednie żądania i lektora.
- Ukryte THOUGHTS nie trafiają do EN narracji. Nazwy umiejętności, wyników i okna rzutu mają EN warianty; kod zachowuje kanoniczne klucze.
- Kontrola literalnych cytatów z dokumentów blokuje wymyślone transkrypcje. To ograniczona kontrola cytatów, nie gwarancja poprawności całej prozy.
- Projekcje stanu świata i ekwipunku zapisują wyłącznie właściwe pola. Poprzednio kopiowały również cały wejściowy kontekst i teczkę.
- Przy aktywnej teczce narrator dostaje bieżący stan świata i wynik rozstrzygniętego testu w tym samym wywołaniu AI; instrukcja zabrania traktować możliwą stawkę jako potwierdzone zdarzenie. Nie dodano drugiego wywołania AI. Test przekazania PL/EN: 17/17; sprawdzenie TypeScript bez błędów. Rzeczywistej narracji po zmianie jeszcze nie odtworzono.
- Deterministyczna bramka odrzuca też jawne deklaracje `entityId=state` w `[MYŚLI_MG]` / `[THOUGHTS]`, jeśli przeczą stanowi po zaakceptowaniu tury. Test obejmuje sprzeczność przed aktywacją i poprawny stan po przejściu zegara. Bramka i strumień: 28/28 testów; TypeScript oraz `git diff --check` przechodzą. Nie sprawdza dowolnej prozy i nie zastępuje prawdziwej próby rozgrywki.
- Tomasz Nowicki: usunięto anachroniczne odniesienia do dyktafonu Sony z lat 90. z opisu PL i EN; profil PRL zachowuje ogólny reporterski dyktafon.
- Podsumowanie sceny ma ustawiony mały poziom myślenia i budżet na pełny JSON. Poprawka przeszła test; działanie z modelem po zmianie czeka na dostępne zapytania.

## Pomiary szybkości i kosztu

Zarejestrowane 16 rzeczywistych odpowiedzi: mediana 24,8 s, zakres 17,0-65,2 s. Szacowany koszt z telemetrii aplikacji: 0,0111-0,0603 USD na odpowiedź. LOW był już ustawiony. Wejście modelu miało około 60-80 tys. tokenów. Część wywołań po wyczerpaniu limitu przechodziła na model zastępczy; te wyniki nie są pomiarem samego Gemini 3.8 Flash.

Trzy krótkie kontrole istniejących odpowiedzi nie wykonały generowania: Google odrzucił wszystkie kodem 429, limit 20 dziennych zapytań Gemini 3.8 Flash w planie free. Inny klucz w głównej konfiguracji aplikacji również otrzymał tę odmowę. Nie ma wiarygodnego pomiaru opóźnienia ani skuteczności proponowanej kontroli. Nie należy traktować czasu szybkiej odmowy jako czasu odpowiedzi modelu.

Wycena samej krótkiej kontroli 0,002-0,005 USD/turę to wyliczenie, nie wynik pomiaru. Ponowna generacja błędnej odpowiedzi oznacza dodatkowy pełny koszt i czas narracji.

### Usunięta duplikacja instrukcji

Pełny protokół znajdował się już w systemPrompt i ponownie w dodatkowym kontekście lub cache. Usunięto wyłącznie identyczną drugą kopię w początkowych turach. Zachowano instrukcję reaktywną, późniejsze przypomnienie, pełne zasady w systemPrompt, teczkę, pamięć i mechanikę.

Pomiar lokalny:

| Język | Pełny systemPrompt | Usunięta powtórka |
|---|---:|---:|
| PL | 188 841 znaków | 79 534 znaków |
| EN | 168 682 znaków | 61 272 znaków |

Spadek o 30% PL / 27% EN dotyczy sumy systemPrompt + drugiego protokołu, nie całego żądania. Nie potwierdza jeszcze czasu 3-5 sekund.

## Dowody

Katalog wyników lokalnych: `/private/tmp/straznik-818-baseline-20261021`.

- `qa-after-state-guards.log`: 361 zestawów / 4010 testów, typy i słowniki poprawne.
- `build-after-state-guards.log`: kompilacja produkcyjna udana.
- `smoke-current-quick-start.log`: 2/2 PL/EN w prawdziwej przeglądarce. Wybór Tomasza / Franka, aktywny start; bez wywołań narratora.
- `green-protocol-dedup.log`: 58 testów kontekstu, cache i usuwania duplikacji; lokalne rozmiary PL/EN.
- `review-measurement.json` oraz `review-measurement-isolated-key-quota.json`: odmowy pomiarów przez limit Google.
- `qa-protocol-dedup.log`: 362 zestawy / 4014 testów po usunięciu duplikacji; typy i słowniki poprawne.
- `build-protocol-dedup.log`: kompilacja produkcyjna po usunięciu duplikacji udana.
- `smoke-dedup-build.log`: ponowny test szybkiego startu na tej kompilacji.

Rzeczywiste przebiegi i zrzuty są w ignorowanym `test-results/showcase-live/`. Wcześniejsze próby są dowodem diagnostycznym dla wcześniejszego buildu, nie odbiorem najnowszego.

## Pozostało do odbioru

1. Pomiary szybkości odpowiedzi i decyzję o dodatkowej kontroli AI odłożono na teraz. Wymaganie 3-5 s pozostaje niepotwierdzone.
2. Odtworzyć w aktualnej aplikacji nieudany test naprawy generatora. Bramka blokuje już wewnętrzny zapis `generator=active` / `rift=open`, jeśli wynik tury pozostawia je w innych stanach; trzeba jeszcze sprawdzić tekst widoczny dla gracza. Przed aktywacją generatora nie może twierdzić, że pracuje ani że szczelina się otworzyła.
3. Dokończyć pełne Prabuty i Englewood, rzeczywisty zapis końcowy oraz PL -> EN -> PL przez interfejs z czystą pamięcią. Nie zakładać sukcesu po rzeczywistej porażce kości.
4. Sprawdzić media i lektora w najnowszej wersji, a następnie zamrozić osobną aplikację pokazową. Skrypty pakowania są przygotowane, paczka nie ma jeszcze odbioru i nie zastępuje aplikacji na Biurku.

Automatyczny przegląd uprawnień wcześniej odrzucił publiczny komentarz GitHub oraz wdrożenie dodatkowej kontroli AI bez osobnej zgody. Nie opublikowano komentarza; dodatkowa kontrola narracji pozostaje niewłączona.


## Bieżący kandydat - smoke test, 21 października

- Build na porcie 3819 odpowiadał identyfikatorem manifestu zgodnym z lokalnym buildem.
- Endpoint teczki zwrócił Prabuty PL i Englewood EN. Lokalny indeks zasad zwrócił 50 rekordów, a lokalny lektor macOS Zosia odpowiadał prawidłowo.
- Istniejący test Playwright szybkiego startu przeszedł na tym buildzie: 2/2 w Chromium, po polsku i angielsku. Test wybiera Tomasza Nowickiego / Franka Geyera, potwierdza aktywny przycisk rozpoczęcia i brak błędów fatalnych.
- Test pomija pierwsze uruchomienie podręcznika i przechwytuje API. Nie wysyła żądań do modelu, nie sprawdza narracji ani pełnej rozgrywki. Lokalny serwer testowy na porcie 3819 został zatrzymany.


## Kandydat desktopowy uruchomiony - 21 października

- Osobna paczka z `/private/tmp/straznik-showcase-2026-10-21/Straznik Tajemnic AI.app` uruchomiła swój lokalny serwer na 127.0.0.1:4050. Strony `/pl` i `/en` zwróciły HTTP 200.
- Ten sam test szybkiego startu przeszedł bezpośrednio na serwerze paczki: Chromium 2/2, 3,5 s. Zweryfikował właściwy wybór postaci, aktywny przycisk startu i brak błędów krytycznych.
- Test przechwytywał API i nie wysłał żądań do modelu. Nie potwierdza narracji, mechaniki podczas pełnej gry, zapisu końcowego ani czasu odpowiedzi modelu. Kandydat pozostaje uruchomiony do dalszej konfiguracji i próby.


## Prywatna paczka pokazu - 21 października, aktualizacja

- Nowy build: `B42D6Gp0GK33xi4NSmER0`. Osobna aplikacja: `_tester/_base/.silnik/.local-playtest/showcase/releases/B42D6Gp0GK33xi4NSmER0/Straznik Tajemnic - Pokaz 22-10.app`. Poprzednia aplikacja na Biurku pozostała nietknięta.
- Pakiet uruchamia serwer na osobnym porcie 3821 i przed otwarciem przeglądarki sprawdza identyfikator własnego buildu. Start nie wymaga klucza serwerowego; gracz może wpisać klucz Gemini w ustawieniach aplikacji. Paczka nie zawiera klucza ani prywatnych plików zasad.
- Dokładny pakiet: `/pl`, `/en`, manifest buildu, dwa endpointy przygód, lokalny indeks zasad i lektor Zosia odpowiedziały poprawnie. Prabuty PL zwróciły 47 rekordów, Englewood EN 35; oba endpointy oznaczają status treści `humanApproval: pending`, więc to nadal prywatny pilot.
- Szybki start na tej paczce przeszedł w Chromium: 2/2, 2,8 s. Zapisano zrzuty PL i EN w `/private/tmp/str-a-quicksetup-package-results/`; widoczne były właściwe postacie. Osobny test konfiguracji Quick Setup przeszedł 8/8 i potwierdza parę Prabuty + Tomasz Nowicki oraz Englewood + Frank Geyer, także po kliknięciu startu.
- Test przeglądarkowy przechwytuje API i używa klucza testowego. Nie wykonano żadnego wywołania Gemini. Zrzuty potwierdzają wygląd Quick Setup, nie przebieg gry.
- Testy startu wstępnej sceny i resetu kampanii: 9/9. Obejmują akceptację lub odrzucenie wstępnych skutków, wznowienie zapisu i zmianę przygody; to testy kodu z atrapami, nie narracja modelu.
- Build przeszedł w 27 s. Nadal zgłasza ostrzeżenia dla `stream/web`, `unpdf` i wiele plików blokad w repozytorium. Nie blokują tego buildu, ale pozostają do osobnej diagnozy.

**Do odpowiedzi na pytanie „czy mogę teraz zagrać?” brakuje realnej tury po wpisaniu klucza.** W otwartym kandydacie wpisz klucz w ustawieniach, uruchom jedną krótką rozmowę i napisz, czy pojawiła się odpowiedź. Wtedy sprawdzę tę turę, mechanikę i zapis bez proszenia o sam klucz.


## Kandydat desktopowy z konfiguracją klucza w aplikacji - 21 października, aktualizacja

- Nowy build: `jtY0zGvxEr9JcxMcG39hR`. Osobna paczka została utworzona pod `.local-playtest/showcase/releases/jtY0zGvxEr9JcxMcG39hR/`; działa pod `127.0.0.1:3821`. Poprzednia, należąca do tego zadania instancja została zatrzymana i zastąpiona; aplikacja na Biurku nie była ruszana.
- Starter usuwa z procesu pokazu odziedziczone `GEMINI_API_KEY` i `GOOGLE_API_KEY`. Dzięki temu czysty profil nie omija ekranu konfiguracji klucza i gracz może podać go w aplikacji.
- Świeży, odizolowany kontekst przeglądarki po wybraniu „Rozpocznij po polsku” pokazał modal konfiguracji Gemini z polem hasła. Wszystkie żądania API były przechwycone atrapą; nie wpisano ani nie sprawdzano żadnego klucza i nie wykonano wywołania modelu. Nie było błędów JavaScript.
- Po zmianie ponownie uruchomiłem testy stanu Prabut i bramki odpowiedzi: **31/31**. Nieudany rzut nie zmienia stanu przygotowywanych generatorów; bramka odrzuca wewnętrzne deklaracje, że przed aktywacją generatory już działają lub szczelina jest otwarta. Testy nie sprawdzają dowolnej naturalnej prozy ani rzeczywistej odpowiedzi Gemini.
- Testy Englewood: **6/6**. Nieudany test zniszczenia zwornika pozostawia go nienaruszonym; sukces sam nie ogłasza zwycięstwa — zakończenie wymaga też fizycznego zdobycia wskazanego listu. To weryfikacja kodu z atrapami, nie gra z modelem.
- Prawdziwy lokalny endpoint TTS zwrócił poprawne pliki WAV dla PL i EN: Zosia, 24 kHz, mono, 16-bit, 3,73 s audio w 0,97 s; Samantha, 24 kHz, mono, 16-bit, 3,40 s audio w 1,01 s. To synteza krótkiej próbki, nie odtwarzanie w interfejsie ani pomiar narracji AI.
- Strony `/pl` i `/en` zwróciły HTTP 200; identyfikator buildu widoczny w odpowiedzi PL zgadza się z nowym wydaniem.
- Ponowny audyt endpointów nowej paczki: PL Prabuty 47 rekordów i EN Englewood 35, oba `humanApproval: pending`; lokalny indeks zasad 50 rekordów; możliwości TTS Zosia/Samantha zwrócone dla właściwych języków.
- Quick Setup na dokładnym nowym pakiecie: Chromium **2/2** dla PL/EN z atrapami API; test akceptacyjny wyboru scenariusza i postaci: **8/8**. Potwierdza start właściwej pary, nie grę z AI.
- To potwierdza uruchomienie paczki i dostępność ekranu klucza. Nadal nie potwierdza rzeczywistej narracji, czasu odpowiedzi, zapisu ani gry PL/EN.

## Krótka próba z prawdziwym modelem - do wykonania po konfiguracji klucza

1. **PL / Prabuty / Tomasz:** zacznij w Quick Setup; zaproponuj dostępnemu NPC nietypową, wiarygodną pomoc, a później nawiąż do tej samej propozycji. Sprawdź, czy Igor pamięta rozmowę i reaguje zgodnie z motywacją NPC, bez nadawania propozycji nieuzgodnionego efektu mechanicznego. Jeśli dotrzesz do generatorów przed 19 października 1973, 16:59, wykonaj próbę ich unieruchomienia. Po porażce stan ma pozostać `preparing`, a szczelina `latent`.
2. **EN / Englewood / Frank:** przy zworniku w piecu spróbuj fizycznie go zniszczyć. Po nieudanym teście zwornik ma pozostać `intact`; po udanym aplikacja nie może ogłosić zabezpieczenia sprawy, dopóki list Alice Pitezel nie znajduje się w ekwipunku Franka.
3. Po każdej wersji językowej zapisz i wczytaj sesję; zanotuj czas każdej odpowiedzi AI i sprawdź, czy właściwy lektor rzeczywiście odtwarza narrację. Bez dodatkowego sprawdzacza AI.

Próba mierzy konkretny fragment i nie zastępuje pełnego przejścia obu przygód. Status gotowości pokazowej pozostaje otwarty do czasu wykonania tej próby.


## Recheck bieżącego kandydata - 21 października

- W katalogu `two-quicksetup` ponownie przeszły 4 zestawy testów dla bramki narracji oraz stanów Prabut i Englewood: **37/37**.
- `npm run qa:quick` zakończył się kodem 0: symetria 6851 kluczy PL/EN, rejestr nawigacji i TypeScript.
- `git diff --check` zakończył się bez błędów.
- Uruchomiona prywatna paczka `jtY0zGvxEr9JcxMcG39hR` nadal odpowiada pod `127.0.0.1:3821`; strony `/pl` i `/en` zwracają HTTP 200. Test Chromium na dokładnym serwerze paczki przeszedł **2/2** w 3,0 s.
- Test Playwright przechwytuje wszystkie `/api/**` i podstawia `mock-key`; **nie wywołuje Gemini**. Potwierdza wybór właściwej pary Quick Setup i brak wybranych błędów przeglądarki, nie rozmowę, narrację ani mechanikę w żywej sesji.
- Dodatkowy przegląd kodu potwierdza granicę zabezpieczenia: bramka sprawdza sprzeczne oznaczenia stanu w `[MYŚLI_MG]` / `[THOUGHTS]`, efekty teczki, czas, lokalizację i literalne cytaty. Nie ocenia znaczenia dowolnego zdania narracji. Dlatego tekst „generatory już pracują” bez znacznika stanu może wymagać sprawdzenia w prawdziwej odpowiedzi; same testy bramki nie dowodzą, że gracz nie zobaczy takiej sprzeczności.

**Wniosek:** kandydat uruchamia Quick Setup PL/EN i jego deterministyczne testy przechodzą. Odbiór pełnej gry wciąż wymaga prawdziwej odpowiedzi AI, sprawdzenia tego tekstu wobec stanu w grze, zapisu/wczytania oraz media/TTS w interfejsie. Nie zmieniałem aplikacji na Biurku ani nie uruchamiałem dodatkowego sprawdzacza AI.

## Najnowsza paczka po audycie ekranów - 21 października

- Build `IJbuZUqX3h96qV3M_7TGr` skompilował się bez błędów w 48,5 s. Next zgłosił wcześniejsze ostrzeżenia: wiele lockfile, `stream/web`, `unpdf` i konwencja middleware.
- Osobna aplikacja: `.local-playtest/showcase/releases/IJbuZUqX3h96qV3M_7TGr/Straznik Tajemnic - Pokaz 22-10.app`; działa pod `127.0.0.1:3821`. Pakiet nie kopiuje kluczy API ani plików zasad. Aplikacja z Biurka pozostaje nietknięta.
- Po przebudowie `/pl`, `/en`, manifest buildu, teczki Prabut i Englewood, lokalny indeks zasad oraz możliwości lektora PL/EN zwracają HTTP 200.
- Chromium na tej paczce: Quick Setup PL/EN **2/2** w 3,2 s; zrzuty `pl-quick-setup.png` i `en-quick-setup.png` potwierdzają właściwe tytuły oraz Tomasza Nowickiego i Franka Geyera. Test przechwytuje wszystkie endpointy `/api/**`, więc nie sprawdza AI.
- Po zmianach kolorów przeszły trzy testy komponentów: karta wiadomości, render handoutu i granica mediów teczki. Pełna bramka przed zmianami stylistycznymi: **362 zestawy / 4019 testów**.
- Audyt całego źródła zgłasza 379 istniejących naruszeń w 744 plikach. W 19 plikach ekranów pokazu po korekcie: **0 naruszeń**. Osiem zgłoszeń w czterech używanych komponentach istniało już w bazie.
- Bezpośredni test endpointu lokalnego lektora na tej paczce: PL/Zosia wygenerował niepusty WAV trwający 3,21 s w 0,66 s; EN/Samantha — 3,10 s w 0,89 s. Oba pliki miały poprawny nagłówek RIFF/WAVE i niezerowe próbki. To synteza macOS, bez Gemini; potwierdza zwrot audio przez usługę, ale nie odtwarzanie w interfejsie.

**Ograniczenie odbioru:** nie wykonano prawdziwej tury Gemini, nie sprawdzono tekstu widocznego dla gracza wobec stanu po rzucie, nie przetestowano zapisu/wczytania w aplikacji ani odtwarzania TTS przez interfejs. Wynik odpowiedzi 3-5 s pozostaje niezmierzony. Testy z atrapami API nie zastępują tych prób.


## Prywatna paczka po poprawkach uruchomienia - 21 października

- Nowy prywatny build: `3zGxyDoAO8a_amEKYAYtn`. Aplikacja: `_tester/_base/.silnik/.local-playtest/showcase/releases/3zGxyDoAO8a_amEKYAYtn/Straznik Tajemnic - Pokaz 22-10.app`. Serwer kandydata działa na `127.0.0.1:3822`; poprzedni kandydat na 3821 pozostał nienaruszony podczas weryfikacji.
- Usunięto ze startowego warmupu `GET /api/chat-test`, bo ten adres przyjmuje tylko `POST`. Test regresji wcześniej wykazał błąd przed poprawką; po poprawce cały plik `useGameStart.dossier.test.tsx` przeszedł **9/9**. Pełne `npm run qa:quick` przeszło: 6851 zgodnych kluczy PL/EN, nawigacja i TypeScript.
- `npm run build` zakończył się kodem 0 w 35,41 s. Zgłosił ostrzeżenia dotyczące wielu lockfile, konwencji middleware, `stream/web` i importu `unpdf`; nie zablokowały kompilacji.
- Przegląd dokładnego pakietu w Chromium: szybki start **2/2** (PL/EN) w 2,6 s. Sprawdza właściwego badacza, aktywny przycisk rozpoczęcia i brak wybranych błędów renderowania. Test atrapuje API, więc nie wywołuje Gemini.
- Przegląd czystej strony startowej odczekał 5,5 s: `/api/desktop/update/status` i `/api/desktop/update/check` zwróciły 200; nie pojawiło się `GET /api/chat-test`. W przeglądarce nie było błędów JavaScript ani konsoli. W prywatnym procesie usuwamy odziedziczony adres manifestu aktualizacji; nie ma pobierania aktualizacji ani ruchu do zewnętrznego serwera aktualizacji.
- Lokalny lektor na dokładnym buildzie: PL Zosia 3,21 s i EN Samantha 3,10 s. Obie próbki odegrały się do końca w przeglądarce; brak błędów dekodowania, konsoli i odpowiedzi HTTP 4xx/5xx. To sprawdza bezpośrednie odtworzenie próbki TTS, nie kolejkę narracji w grze.
- `git diff --check` przeszedł. Paczka jest prywatna, bez kluczy API i plików zasad.

### Co ta wersja mówi po nieudanym teście generatorów

Źródłowy start przygody to 18 października 1973, 19:30. Autorski harmonogram pokazu uruchamia generatory i szczelinę 19 października o 16:59; końcowy termin operacji to 23:59. Ta adaptacja nie przypisuje stałej kary czasu za nieudany test. Porażka przed 16:59 pozostawia generatory w przygotowaniu, a szczelinę uśpioną, jeśli zatwierdzony czas tury nie przekroczył progu. Jeśli czas akcji zapisany w metadanych przesunie zegar przez 16:59, kod uruchamia generatory i szczelinę. To skutek harmonogramu, nie rzutu ani deklaracji narratora. Obrażeń ani alarmu sama porażka nie dodaje. Testy kodu sprawdzają zapis stanu; naturalna wypowiedź Gemini po porażce nadal nie została zweryfikowana, bo próba modelu jest odłożona.

**Otwarty odbiór:** nadal brakuje prawdziwej tury PL i EN z modelem, tekstu widocznego dla gracza wobec wyniku kości, zapisu i wczytania w UI oraz sprawdzenia narracji na całej przygodzie. Wymagane 3-5 s dla odpowiedzi AI nie jest zmierzone.
- Plik startowy `.app` przeszedł `zsh -n`; manifest konkretnego buildu z portu 3822 zwrócił 200; końcowe `git diff --check` bez uwag. Zrzuty Quick Setup PL/EN są w `/private/tmp/straznik-showcase-3zGxyDoAO8a_amEKYAYtn-e2e/`.


## Kontrola czasu i skutków nieudanego testu - 21 października

- Zweryfikowane źródła: start przygody 18 października 1973, 19:30; `GameTime.month: 9` oznacza październik; termin źródłowy to 19 października, 23:59; autorska adaptacja pokazu uruchamia generatory i szczelinę o 16:59 tego dnia.
- Ta adaptacja nie dodaje stałej kary czasu za nieudany test. Jeśli zatwierdzony czas tury pozostaje przed progiem, stan zostaje `preparing/latent`. Jeśli metadane czasu przeprowadzą turę przez 16:59, stan przechodzi automatycznie do `active/open`; to efekt zegara przygody, nie sukces rzutu.
- Cztery zestawy testów mechaniki i bramki: **66/66**. Nowy przypadek obejmuje nieudany test wyłączenia przygotowywanych generatorów, którego zatwierdzony czas kończy się dokładnie na 16:59.
- Zapis, wczytanie, reset i blokada zapisu przy nierozliczonym rzucie: **33/33** testy.
- Raport poprawiono: wcześniejsze „19 września” było błędne. Brak prawdziwych tur Gemini, zapisu/wczytania w UI i pomiaru 3-5 s pozostaje bez zmian.


## Zapis i wczytanie przez interfejs prywatnej paczki - 21 października

- Dokładny build `3zGxyDoAO8a_amEKYAYtn` uruchomiłem na osobnym porcie 3823. Dane tej próby trafiły do `/private/tmp/straznik-ui-save-load-3823/runtime/data`; port 3822 i aplikacja na Biurku pozostały nietknięte.
- W świeżym profilu Chromium wybrałem Prabuty i Tomasza w Quick Setup, otworzyłem grę i zapisałem ją z interfejsu jako „Prabuty - próba zapisu”. Rzeczywisty lokalny endpoint zapisu odpowiedział HTTP 200; na dysku powstał zapis 151,33 KB z jedną wiadomością.
- Po ponownym uruchomieniu aplikacji w świeżym kontekście przeglądarki zapis pojawił się na liście „Wczytaj”. Wczytałem go przyciskiem w interfejsie; aplikacja ponownie pokazała tę samą wiadomość otwierającą. Odczyt pliku zwrócił HTTP 200. Usunięcie zapisu testowego przez aplikację zwróciło HTTP 200.
- Zrzut po wczytaniu: `/private/tmp/straznik-ui-save-load-3823/ui-save-load-after-reload.png`. Izolowany serwer na porcie 3823 został zatrzymany, a tymczasowy katalog aplikacji usunięty.
- Narrację, potwierdzenie transakcji pamięci, aktywację teczki i odtworzenie pamięci test przechwycił atrapami; Gemini nie otrzymał żadnego żądania, a błędów JavaScript nie było. Ponieważ atrapowa narracja nie tworzy wpisu w serwerowym dzienniku pamięci, test wyczyścił zakres pamięci kampanii w jednorazowym profilu przed zapisem. Sprawdza to rzeczywisty zapis plikowy i interfejs wczytania, ale nie potwierdza jeszcze zapisu ani wznowienia prawdziwej pamięci kampanii po rozmowie z Gemini.


## Englewood - naprawa przegranej po terminie (21 października)

- Potwierdziłem błąd: po terminie sprawa pozostawała otwarta, jeśli zwornik pieca był zniszczony, ale Frank nie zdobył listów Alice. Dodałem test regresyjny; przed poprawką kończył się oczekiwanym `lost`, a kod zwracał `null`.
- Zmiana w `authored-scenario-turn.ts` uznaje sprawę za przegraną po terminie, gdy brakuje choć jednego z dwóch warunków zwycięstwa: zniszczonego zwornika i listów w ekwipunku.
- Testy `authored-englewood-turn.test.ts` i `authored-englewood.test.ts`: 2 zestawy / 7 testów PASS. `npm run qa:quick`: PASS, 6851 zgodnych kluczy PL/EN, nawigacja i TypeScript. Ostrzeżenie Jest o zduplikowanym `package.json` w prywatnym buildzie nie zmieniło wyniku.
- Prywatna paczka działająca na `127.0.0.1:3821` nadal odpowiada HTTP 200 i pozostaje jedyną instancją testową. Nie przebudowałem jej po poprawce; testowane zmiany są w źródle worktree. Rzeczywista tura Gemini nie została wykonana.


## Korekta manifestów mediów PL/EN (21 października)

- Test przed poprawką potwierdził błędne `clueId` w obu manifestach. Ustawiłem kanoniczne ID dla teczki SB i fotografii Prabut oraz planu i odcisku stopy Englewood.
- Kategorie portretów ujednoliciłem z resolverem. Pliki audio przeniosłem do osobnego `audioAssets`, aby resolver obrazów nie traktował nagrań jak grafik.
- Test resolvera i manifestów: 1 zestaw / 26 testów PASS, w tym bezpośrednie rozpoznanie czterech obrazów po kanonicznym ID i istnienie plików. `npm run qa:quick`: PASS, typy, słowniki PL/EN i rejestr nawigacji.
- To sprawdza konfigurację plików i lokalny resolver. Nie potwierdza jeszcze użycia tych manifestów w aktywnej grze ani odpowiedzi modelu.


## Aktualny prywatny pakiet z poprawkami - 21 października

- `npm run build`: PASS. Next zgłosił wcześniejsze ostrzeżenia o wielu lockfile, `stream/web`, konwencji middleware i `unpdf`; kompilacja oraz TypeScript zakończyły się poprawnie.
- Prywatny pakiet `TK0E3t2JieKq5RqHnoYKs` utworzony pod `.local-playtest/showcase/releases/`. `zsh -n` launchera i `plutil -lint` Info.plist: PASS. Receipt wskazuje ten sam identyfikator buildu, `credentialsCopied: false`, `rulesCopiedIntoBundle: false`.
- Spakowane manifesty są identyczne ze źródłowymi; każdy zawiera 4 obrazy i 1 nagranie. Walidacja pliku sprawdza obecność obu manifestów i ich wskazanych mediów. Nowego pakietu nie uruchamiałem.
- Jedyna uruchomiona sesja pozostaje na release `3zGxyDoAO8a_amEKYAYtn`, port 3821; pozostałe sprawdzone porty 3818-3825 i 4050 są wolne. `/pl` zwraca 200. Zaktualizowany pakiet zawiera poprawki źródła, ale nie jest aktywną sesją.


## Przełączenie jedynej sesji na poprawiony pakiet - 21 października

- Zatrzymałem serwer i okno przeglądarki release `3zGxyDoAO8a_amEKYAYtn` po wcześniejszej zgodzie PO na zamknięcie sesji i start jednej testowej. Uruchomiłem prywatny pakiet `TK0E3t2JieKq5RqHnoYKs` na tym samym porcie i profilu przeglądarki.
- Sprawdzone porty 3818-3825 i 4050: tylko `127.0.0.1:3821` nasłuchuje. Chrome otworzył nową paczkę; `/pl`, `_next/static/TK0E3t2JieKq5RqHnoYKs/_buildManifest.js` i `/api/adventure-dossier/playtest` zwróciły HTTP 200.
- Aktualna sesja zawiera poprawkę końca Englewood i ujednolicone manifesty. Nie wysłano żadnej tury modelu. Ręczny odbiór rozmowy i narracji nadal czeka; narzędzie sterowania oknem nie działa.


## Ponowna bramka i stan jednej sesji - 21 października

- Po wznowieniu aplikacji sprawdziłem porty 3818-3825 i 4050: jedynym listenerem jest 127.0.0.1:3821 (PID 10933). Launcher PID 10928 wskazuje release TK0E3t2JieKq5RqHnoYKs, a okno Chrome PID 10939 otwiera /pl z profilem pokazu. /pl i /api/adventure-dossier/playtest zwracają HTTP 200.
- npm run qa: **362 zestawy / 4024 testy PASS**, w tym 6851 zgodnych kluczy PL/EN, rejestr nawigacji, TypeScript i pełny zestaw testów jednostkowych.
- npm run audit:art-deco: kod wyjścia 0; raportuje 371 naruszeń w 32 z 744 skanowanych plików. Audyt kończy się kodem 0; te zgłoszenia pozostają do ewentualnego przeglądu wizualnego i nie blokują bramki mechaniki.
- Sterowanie oknem w tej sesji Codexa zakończyło się przed odczytem ekranu z błędem konfiguracji workspace. Nie wysłano wiadomości do MG, więc nie ma dowodu na prawdziwą turę Gemini ani zgodność narracji z wynikiem gry. Poprawki po wcześniejszym błędzie HTTP 500 nie zostały sprawdzone w aktywnej rozmowie.

**Stan:** jedna poprawiona paczka Prabuty/Englewood działa i bramki kodu przechodzą. Nadal brakuje ręcznego testu AI w PL i EN na prawdziwych turach; testy automatyczne nie zastępują tego odbioru.


## Otwarcie w domyślnej przeglądarce - 21 października

- Polecenie systemowe `open http://127.0.0.1:3821/pl` zakończyło się poprawnie i przekazało stronę do domyślnej przeglądarki.
- Zamknąłem wcześniejsze okno Chrome w trybie aplikacji (PID 10939). Serwer release TK0E3t2JieKq5RqHnoYKs nadal działa jako jedyny listener na porcie 3821 (PID 10933); strona /pl zwraca HTTP 200.
- Nie mogę potwierdzić wyglądu renderowanej strony ani wysłać tury MG: sterownik ekranu nadal odrzuca skonfigurowany skrót ścieżki uprawnień.
