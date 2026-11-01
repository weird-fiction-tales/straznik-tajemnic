# Prabuty dla Tomasza - odbiór lokalny, 20 października 2026

Odbiór trwa. Nie potwierdzamy jeszcze całej przygody od początku do finału. Test rzeczywistej gry wykrył utratę oczekującego wyniku rzutu po błędzie dostawcy; poprawka i jej odbiór trwają.

## Wersja do zagrania

- Aplikacja: http://127.0.0.1:3818/pl
- Przygoda: Cień nad Prabutami: Widzenie Ojca Klimuszki.
- Postać: Tomasz Nowicki. Inne opcje Quick Setup są ukryte, zachowane w danych.
- Ponowne uruchomienie: `npm run playtest:prabuty` w `_tester/_base/.silnik` tego worktree.
- Prywatny klucz pozostaje na serwerze. Zasady pochodzą z rzeczywistego lokalnego indeksu. Trwałe, oddzielne dane pilota są ignorowane przez Git.
- Lektor Zosia działa lokalnie, bez limitu Gemini TTS. Narracja czatu wymaga dostępnego modelu.
- Do próby wybrano przez UI `gemini-flash-lite-latest`. Modele 3.8 Flash i 2.5 Flash zgłaszały limit dzienny, a 2.5 Flash Lite zwrócił komunikat o wycofaniu mimo obecności w wykazie.

## Faktyczna gra

Pierwsza trasa obejmuje redakcję, przejazd do Prabut, rozmowę z Tadeuszem, oględziny wyłomu i alternatywny wyjazd do telefonu koło Iławy. Gracz rzeczywiście rzucił 17/60, 29/65 i 47/70, zabrał teczkę do torby i zachował te rzeczy po F5. Rozstrzygnięte testy nie oferują ponownego rzutu.

Świadome zakończenie wyprawy ujawniło błędny test Zastraszania 15%. Powtórka tej samej wielozdaniowej deklaracji kończy teraz wyprawę bez rzutu: epilog, zamknięta sesja, nieaktywne wejście i F5 zachowujące finał. Zegar pozostał 03:55, a epilog ma potwierdzony commit w pamięci serwera. Drugie, niezależne przejście prowadzi tropem fotografii do Elbląga; tester opiera decyzje na UI, bez wstrzykiwania stanu i wiedzy o ukrytym finale.

Przygotowane okno początku gry ma rzeczywistą narrację, obraz redakcji 1672 x 941 oraz fotografię ruin. Podgląd zdjęcia i przybliżanie działają po poprawce. Pełny ekran działa bez przycięcia, Escape go zamyka i przywraca fokus przycisku. F5 zachowuje otwarcie i ekran gry, bez nowego wywołania modelu.

Lektor faktycznie odtwarza narrację: synteza 200, głos Zosia, zdarzenia playing i postęp audio. Zapis początku wykonano przez normalny interfejs. Powtórka manualnego wczytania na osobnym, świeżym profilu przechodzi: właściwy tytuł Prabut i fotografia po wczytaniu i F5, poprawny model i lektor, zero nowych wywołań czatu.

Gotowy zapis do wczytania: **Prabuty - Tomasz - graj** (Wczytaj). Zawiera bezpośrednio wybrany model Gemini 3.1 Flash Lite. Świeży profil przywraca jedną postać i zaakceptowane otwarcie; F5 zachowuje Prabuty, fotografię i lektora. Generowanie dodatkowych obrazów jest wyłączone. Domyślny prompt zawiera Markdown, a nie stronę błędu HTML. Poprzednie zapisy pozostają zachowane.

## Naprawy

- Normalna transakcja teczki: walidacja, kandydat, prepare, ACK i trwały zapis otwarcia oraz tur.
- Bieżąca kanoniczna lokacja steruje doborem kart i warunkami. Proza nie zmienia miejsca; nieznane miejsce nie wraca do redakcji.
- Jawne miejsca poza grafem nie otrzymują miejscowych kart, NPC ani efektów. Zegar i termin operacji nadal działają. Opóźnione wczytanie teczki nie gubi tego stanu.
- Zapis wiąże odtwarzanych NPC z nową, zweryfikowaną sesją wyłącznie wtedy, gdy należeli do zapisanej sesji tej samej przygody; obcy NPC nadal blokują turę.
- Zapis i F5 zachowują czas, historię, przedmioty i wyniki. Manualne wczytanie poprawnej historii z aktywną postacią otwiera ekran gry.
- Ochrona sprawczości nie zatrzymuje już automatycznie podróży zadeklarowanej przez gracza. Nadal blokuje dodatkowe decyzje, dialog i ruch postaci.
- Zwykła odpowiedź wymaga prawidłowego czasu oraz źródłowej lokacji lub jawnego miejsca poza grafem. Jedna nieudana korekta pozostawia poprzedni stan bez kary technicznej.
- Epilog świadomego wycofania tworzy kod, bez kości, zmiany przedmiotów i dopisanej podróży. Cytaty, warunki i rozważane opcje nie kończą gry. Wciąż obowiązuje zwykła bramka z ACK i pierwszeństwo terminu operacji.
- Domyślne prompty PL/EN trafiają bezpośrednio do plików Markdown, bez przekierowania na stronę aplikacji. Odpowiedź HTML nie zapisze się jako domyślny prompt.
- Fotografię ukrywało płótno o wysokości 0. Host podglądu ma już określony rozmiar; rzeczywisty OSD pokazuje PNG i reaguje na zoom.
- Model awaryjny otrzymuje własną konfigurację. Ogólne 400 i 403 nie udają już błędnego klucza.
- Lokalny TTS ma osobny cache. Wyczerpanie limitu nie powoduje nieustannych ponowień segmentów.
- Usunięto urywanie narracji po znaczniku dźwięku aparatu.
- Zapis/przerwę sesji rozdzielono od świadomego wycofania z całego śledztwa. Rezygnacja wymaga drugiego potwierdzenia.
- Niezaakceptowany błąd sieci lub dostawcy nie trafia do historii jak wypowiedź narratora i nie psuje kolejnego zapisu. Niepewny ACK pozostaje do odzyskania; błąd TTS po commicie nie cofa zaakceptowanej tury.
- Jawne 0 m nie zamienia się w upadek z 3 m. Stara błędna karta znika po F5 bez zmiany statystyk, historii ani wyników. Prawidłowe mierzalne upadki nadal przechodzą testy.

## Media

Pięć PNG i nagranie SB zwracają 200, właściwy typ oraz treść zgodną z manifestem: redakcja 1973, ilustracja fotografii ruin 1947, raport KLIN, recepta 152, kaseta ZK140 i meldunek SB z Elbląga. Meldunek funkcjonariusza nie udaje surowego zapisu modlitwy.

Ilustracje i opracowania dokumentów są rekwizytami gry, nie autentycznymi archiwaliami. Nie uruchamiano kolejnej płatnej partii ani wideo.

## Dowody

- qa: 347 zestawów / 3866 testów, exit 0; i18n, nawigacja, kontrola tras, TypeScript i Jest.
- qa:quick: exit 0 przed ostatnimi poprawkami; najnowsze pełne QA obejmuje te same kontrole.
- Wycofanie i rzeczywista bramka odpowiedzi: 47/47; niezależny przegląd usunął wykryte przypadki cytatów i warunków.
- Zapis/wznowienie ze stronami PL/EN i F5: 65/65.
- Rzeczywisty DocumentViewer: test przeglądarkowy przechodzi, płótno 898 x 360, zoom zmienia obraz; produkcyjny podgląd, pełny ekran, Escape i powrót fokusu sprawdzone w aplikacji.
- Produkcyjny build po ostatnich poprawkach: exit 0 (58,60 s). Pełne QA: exit 0 (90,73 s).
- Zimny restart bez klucza w zmiennych procesu: zdrowie serwera, zasady, lokalny TTS i teczka zwracają 200.
- git diff --check: exit 0.

Dowody w runtime:
`test-results/currentintegration-runtime-port/`,
`test-results/currentintegration-withdrawal-20261020/`,
`test-results/currentintegration-save-started-20261020/`,
`test-results/currentintegration-save-adventure-20261020/`,
`test-results/currentintegration-save-npc-session-20261020/`,
`test-results/currentintegration-offgraph-hydration-20261020/`,
`test-results/currentintegration-playtest/player-handoff-20261020/`,
`test-results/currentintegration-playtest/photo-render-diagnostic-20261020/`,
`test-results/currentintegration-playtest/chaos-transport-save-20261020/`,
`test-results/currentintegration-playtest/chaos-save-continuation-20261020/`,
`test-results/blind-player-prabuty/`.

Jedna negatywna asercja testowa wypisała klucz serwera w diagnostyce. Zredagowano lokalny plik dowodowy; test używa teraz wyłącznie sztucznego klucza. Raport nie zawiera jego wartości.

## Granice

Po dotarciu do 09:25 i przygotowaniu naparu prawdziwy rzut Zręczności 57/60 trafił na HTTP 500. Stary kod usunął wynik z historii, lecz pozostawił przycisk jako zapisany. Nie powtarzamy tego rzutu ani nie dopisujemy wyniku ręcznie. Poprawka ma zachować dokładne rozstrzygnięcie w osobnej kolejce i ponawiać jego wysyłkę bez losowania oraz bez ponownego wydawania Szczęścia. Nie potwierdzamy jej działania przed testem.

Po wznowieniu właściwej gry o 08:55 narracja nie przyjęła kolejnego ruchu: alias i zapasowy 3.1 Flash Lite zwróciły 503 po ponowieniach, a drugi model miał wyczerpany limit dzienny. Serwer zwrócił 500 po 21,15 s. Gra cofnęła nieprzyjętą turę bez zmiany czasu, statystyk i historii. Po przerwie i wyborze w UI bezpośredniego modelu 3.1 Flash Lite ta sama deklaracja dostała odpowiedź 200 i przeszła odbiór tury: spotkanie Tadeusza odsłoniło wejście do podziemi, historia wzrosła z 19 do 22 pozycji, statystyki i 08:55 pozostały poprawne. Dostępność usług zewnętrznych nadal nie ma gwarancji.

Pełny rzeczywisty finał nadal nie ma odbioru. Wyłączenie generatorów, zamknięcie szczeliny i upływ terminu przechodzą testy kodu; nie zastępuje to rozgrywki. Harmonogram udostępnia okno kulminacji jako jawną adaptację pilota.

Globalny audyt Art Déco nadal zgłasza 379 zastanych naruszeń w 36 plikach. Nie deklarujemy zaliczenia całej aplikacji, wszystkich wariantów ani pełnej angielskiej przygody. Automatyczny skrót scen chwilowo nie powstaje z powodu wyczerpanego limitu modelu używanego przez tę opcjonalną funkcję; pełna rozmowa i zatwierdzone fakty zapisują się oddzielnie.

Robocza teczka v4 obejmuje 47 kart wykonawczych, ze zgodą człowieka nadal pending:
`sha256:d925f9637d13f977ccdb337c5e150ea7f3905a0e3fe0620228b1e5724fd952f8`.

Zmiany pozostają lokalne w worktree two-quicksetup. Bez commitu, push, merge i publikacji. Zastane pliki, zapisy i osobna praca EN pozostały zachowane.

Dodatkowy dowód: nowa, czysta trasa ma manualny zapis 200 po Elblągu. Gracz wydał 29 punktów Szczęścia, zmieniając rzut 89 na 60 i zasób 55 na 26. Stara próba zawiera trzy niezatwierdzone komunikaty techniczne; zabezpieczenie odmawia ich archiwizacji, bez przepisywania ich do zatwierdzonej pamięci i bez usuwania tej historii. Osobny test odporności nowej wersji potwierdził trzy przerwane próby jednego wysłania, odzyskanie dokładnego wpisu, zachowanie poprzedniej historii i brak technicznej odpowiedzi w historii. Następne świadome wycofanie przeszło rzeczywiste /chat 200, prepare 200 i ACK accepted:true, a automatyczny zapis zwrócił 200. Interfejs pokazał zamkniętą sesję. Pierwszy skrypt zatrzymał się na zbyt ścisłym selektorze komunikatu z ikoną. Oddzielna kontynuacja zweryfikowała dokładną sesję eksportem przez UI, wczytała jej automatyczny zapis i wykonała ręczny zapis „Test odporności - Prabuty” (200), eksport oraz F5. Zamknięta sesja, trzy wiadomości, brak odrzuconej deklaracji i technicznej odpowiedzi w historii: PASS; zero wywołań czatu i błędów strony w kontynuacji. Dowody obu etapów łącznie potwierdzają cały przypadek awarii, bez ukrywania błędów skryptu.
