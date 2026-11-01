# 0.9.6 - skonsolidowana baza aplikacji

Wydanie łączy przygotowane prace nad teczkami, narracją, zapisem, dziennikiem i lokalnym sterowaniem światłem. Kod aplikacji pozostaje w `_tester/_base/.silnik`.

- Prabuty korzystają z manifestu przygotowanych materiałów oraz deterministycznego planu działań, wskazówek, ekwipunku i stanu świata. AI opisuje zaakceptowane skutki.
- Lektor zachowuje przypisanie głosów NPC, czyści prywatne znaczniki i synchronizuje jawne SFX z odtwarzaniem. Źródłowe audio ma stabilne odtwarzanie i pauzę.
- Dziennik, wyposażenie i pełny zapis zachowują poznane materiały, właścicieli i zaakceptowany stan. Starsze identyfikatory materiałów Startera nadal działają.
- Hue obsługuje lokalny transport v2, partyturę scen, Entertainment, dzierżawę i przywracanie ustawień. Ambilight obsługuje wykrywanie, PIN oraz przywracanie poprzedniego trybu. Potrzebny jest wybór urządzeń i odbiór na fizycznym sprzęcie.
- Ustawienia narratora są niezależne od presetów AI. Kontekst zachowuje obowiązkowe źródła i granice odbiorców pamięci.
- Interfejs i testy obejmują PL oraz EN. Materiały wymagające zgody autora zachowują status oczekujący.

## Instalacja lokalna

`scripts/package-unified-macos.mjs` w silniku pakuje istniejącą kompilację z własnym Node. Domyślnie aplikacja używa `127.0.0.1:4050` i dotychczasowego katalogu danych `ZewCthulhu`. Klucze, PDF-y, profil przeglądarki i zapisy pozostają poza pakietem. Launcher sprawdza tożsamość buildu i gotowość teczek. Nie wykonuje resetu profilu.

Pakiet zapisuje wersję, commit, BUILD_ID i sumę lokalnych materiałów w `build-receipt.json`. Prywatne plansze nie trafiają do Git. Kompilacja czystego repozytorium może używać zastępczego renderu materiałów.

Workflow wydania publicznego uruchamia się wyłącznie ręcznie albo dla tagu. Scalenie zmian do `main` nie publikuje instalatorów. Aktualizacja lokalna nie uruchamia samoczynnej dystrybucji.

## Zakres odbioru

Automatyczne bramki obejmują typy, tłumaczenia, nawigację, lint, testy jednostkowe, kompilację i render PL/EN. Prywatny raport instalacji zawiera ścieżki archiwum, zgodność kopii danych i kontrolę podpisu pakietu. Automatyczne testy sprzętu nie zastępują odbioru fizycznych lamp, telewizora ani odsłuchu przy stole.
