# Odbiór teczki grupami scen

Narzędzie `scripts/gm-prep/review-scenes.mjs` przygotowuje lokalny podgląd autora. Grupuje rekordy w sytuacje ze `supplement.scene_frames`, zasady wspólne i jawne wyjątki. Nie zastępuje integracji ani próby gry.

## Przygotowanie

Z katalogu głównego repozytorium:

```sh
node scripts/gm-prep/prepare-quicksetup.mjs
node scripts/gm-prep/review-scenes.mjs _tester/_base/.silnik/test-results/two-quicksetup/authoring/cien-nad-prabutami
node scripts/gm-prep/review-scenes.mjs _tester/_base/.silnik/test-results/two-quicksetup/authoring/englewood-murder-castle-1893
```

Otwórz `scene-review/index.html` we wskazanym katalogu. Wszystkie materiały autora pozostają poza `public/`. Podgląd działa offline i nie wywołuje modeli. Źródła prywatnych przygód oraz wygenerowane podglądy nie należą do publicznego repozytorium.

Każda karta pokazuje streszczenie źródeł, sześć punktów kontroli, media, pełne rekordy, referencje i fragment grafu. Brakujące ustalenia pozostają widoczne. Przypisanie lokacji do sytuacji nie narzuca kolejności odwiedzania.

## Decyzje autora

Po sprawdzeniu sześciu punktów autor podaje nazwę recenzenta, wybiera treść albo media i pobiera decyzję: zatwierdzam, do poprawy lub odkładam. Wyjątki nie pozwalają zatwierdzić treści. Integracja i próba gry mają osobne domeny; podgląd nie wydaje za nie zgody. Decyzje w przeglądarce nie zapisują się bez eksportu.

Import do podglądu pozwala sprawdzić plik bez zmiany danych źródłowych. Trwały zapis wymaga jawnego polecenia:

```sh
node scripts/gm-prep/review-scenes.mjs /prywatny/katalog/przygody --decisions /prywatny/eksport.json --save-decisions
```

Rejestr autora to `preparation/scene-decisions.json`. Kompilator szkicu zachowuje aktualne decyzje i przenosi tylko świeże, jawne zgody na treść do zarządzanych rekordów. Manifest wydania nadal wymaga osobnego odbioru. Nie należy ręcznie zmieniać statusów wygenerowanych rekordów.

## Wersje i unieważnianie

Decyzja wskazuje przygodę, wydanie, grupę, domenę i hash zestawu. Hash obejmuje treść rekordów, warunki, powiązania, referencje, graf, zasady i manifest mediów. Zmiana zależnych danych unieważnia skuteczność zgody. Stare decyzje nie oznaczają zgody na nową treść. Walidator odrzuca błędną tożsamość, nieznane grupy, duplikaty i niepoprawny format decyzji.

Każdy rekord ma jednego właściciela odbioru. Referencja w innej scenie pokazuje kontekst, ale nie tworzy drugiego właściciela. Niejednoznaczne i nieprzypisane rekordy trafiają do wyjątków. Licznik pokrycia nie dowodzi kompletności mechaniki przygody.

Podgląd porównuje bieżące bajty plików mediów z inwentaryzacją. Zmiana obrazu lub audio wymaga odświeżenia szkicu przed odbiorem. Obecność pliku i poprawny format audio nie dowodzą jakości, języka ani właściwego momentu ujawnienia.

## Weryfikacja narzędzia

```sh
node --test scripts/gm-prep/scene-review.test.mjs scripts/gm-prep/scene-review-render.test.mjs scripts/gm-prep/scene-review-browser.test.mjs scripts/gm-prep/review-scenes.test.mjs scripts/gm-prep/prepare-quicksetup.test.mjs
```

Podgląd nie omija loadera teczek. Nieustalone reguły mechaniki, stan postaci, zegary, wyzwalacze mediów i powiązanie z uruchomioną sesją nadal blokują wydanie, nawet po odbiorze tekstów.

Przy zapisie nowego rejestru narzędzie zachowuje dokładne bajty poprzedniego pliku w `preparation/scene-decisions-history/<sha256>.json`. Scala wyłącznie poprawne, unikalne wpisy aktualnego wydania z bieżącym hashem grupy. Nowa decyzja zastępuje tylko tę samą grupę i domenę. Historia przechowuje także stare lub niepoprawne wpisy, ale nie nadaje im skuteczności.

## Czytanie opisu i profil pokazu

Fragment źródła (rekord) jest częścią jednego opisu sceny, nie osobnym zadaniem autora. Sześć potwierdzeń dotyczy sensu przedstawionej historii. Autor może zaznaczyć zgodne fragmenty albo wybrać „Do poprawy” i opisać wątpliwość. Agent odpowiada za sprawdzenie kodu, brakujących reguł i dowodów działania. Osoby z katalogu NPC mogą występować także jako grywalne presety; karta sceny nie wyznacza ich punktów startowych.

Przypisane podglądy sceny pojawiają się przed opisem. Przycisk „Obrazy i nagrania przygody” otwiera galerię materiałów objętych bieżącą inwentaryzacją, także nieprzypisanych do sceny. Galeria nie zmienia chwili ujawnienia ani stanu odbioru. Osobne rejestry briefingu i portretów mogą wymagać uzupełnienia inwentaryzacji.

Profil pokazu Quick Setup definiuje `quick-setup-showcase-profile.ts`: jedna przygoda i jeden bohater na język, tryb solo, automatycznie zaznaczony bohater. Rozgrywka nadal wymaga kliknięcia Start. Ustawienie `enabled: false` przywraca pozostałe opcje i Hot Seat; dane pozostają w katalogach.
