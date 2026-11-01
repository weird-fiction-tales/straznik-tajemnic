# Przekazanie: build pokazowy PL/EN na Windows

Data: 2026-10-23. Repozytorium: `weird-fiction-tales/straznik-tajemnic`.
Gałąź: `codex/showcase-windows-handoff`.
Punkt wejścia: `START-CODEX-WINDOWS.md`.

## Zatwierdzony zakres

Użytkownik zlecił punkty 1 i 3: oprzeć źródła na `two-quicksetup`, zachować poprawkę dialogów, aktywować obie teczki i przygotować oznaczoną aplikację pokazową, chronioną przed publiczną aktualizacją. Następnie polecił przygotować repozytorium do kontynuacji na domowym Windows z Codexem.

Nie zlecił punktu 2, czyli pełnego przejścia przygód w tej sesji. Nie deklaruj pełnego odbioru ani czasu 3-5 sekund na odpowiedź AI. Nie wykonuj płatnych wywołań modelu w ramach samego sprawdzenia instalacji. Bez osobnej zgody nie wykonuj commitów, pushy, merge'ów ani publikacji, zgodnie z AGENTS.md.

## Pochodzenie plików

Bazą jest `main`, commit `9b04a60affd11b8405da479fa2f4385cda9f7b72`.
Zebrano bieżący stan `codex/two-quicksetup-integration`, checkpoint `3ebe9510c2bb5377c10acbf6faff693968755034`, wraz z niezacommitowanymi poprawkami i nowymi mediami.
Uwzględniono nowsze poprawki main dotyczące narracji EN i aktualizatora oraz poprawkę dialogów z `chat-dialogue-punctuation`.

Nie przeniesiono niezwiązanej zmiany `docs/audits/equipment/catalog-manifest-issue-594.json` ani lokalnego zastępczego `CLAUDE.md`. Pierwotne worktree pozostają zachowane.

Nie kopiowano całego `dossier-item-access`. Wszystkie 51 plików jego systemu teczek miało już odpowiedniki w bieżącym pokazie. „Pośród pradawnych drzew” ma osobne niedokończone prace i nie jest trzecią przygodą tego pokazu.

## Zawartość

- PL: `cien-nad-prabutami`, Tomasz Nowicki, solo.
- EN: `englewood-murder-castle-1893`, Frank Geyer, solo.
- Quick Start udostępnia jedną przygodę i jednego bohatera na język. Pozostałe opcje i Hot Seat są ukryte.
- Są sceny i graf, postacie, poszlaki, stan świata, ekwipunek i zegar.
- Każda przygoda ma 4 handouty i nagranie. Manifesty wskazują 23 materiały wizualne Prabut i 25 Englewood; wskazane pliki były obecne.
- Jest zapis/wczytanie, walidacja tur i rozstrzyganie mechaniki w kodzie.
- Dialogi obsługują interpunkcję za zamykającym cudzysłowem. Zachowano powiązania handoutów z teczką i filtrowanie THOUGHTS.
- Są kompaktowe instrukcje MG, usunięcie powtórzeń protokołu i ograniczanie historii. Szybkość wymaga osobnego pomiaru.

## Ustawienia, których nie wolno zgubić

`src/components/ui/quick-setup-showcase-profile.ts` ogranicza katalog.
`ZEW_LOCAL_PLAYTEST=showcase-pl-en` aktywuje obie lokalne teczki. Sam kod w paczce nie wystarcza.

Aktualizator blokuje sprawdzanie i instalację publicznej paczki, gdy `build-info.json` ma `channel: "showcase"` albo ustawiono `ZEW_DESKTOP_SHOWCASE=1`. Blokada wygrywa nawet nad `ZEW_DESKTOP_SELF_UPDATE=1`. Pokaz ma własną etykietę wersji.

`start-showcase.mjs` wymusza profil teczek i blokadę aktualizacji. Przy ponownym starcie sprawdza dokładny manifest, obie teczki i ochronę updatera. Nie otwiera starszej wersji, jeśli port obsługuje inny build.

## Uruchomienie na Windows

```powershell
git status --short
git branch --show-current
Set-Location _tester/_base/.silnik
npm ci
npm run qa:quick
npm run build
powershell -NoProfile -File scripts/start-showcase-windows.ps1
```

Użyj Node zgodnego z zależnościami; sprawdź też wersję w `desktop/build-windows.mjs`. `better-sqlite3` musi pasować do Windows i ABI Node. Nie kopiuj binariów, zależności ani buildu z macOS.

Nowy skrypt PowerShell zapisuje ignorowany `build-info.json`, ustawia dane w `%LOCALAPPDATA%\StraznikTajemnicShowcase` i uruchamia wspólny serwer. Obsługuje `-Port` i `-DataDirectory`. Nie został wykonany na Windows w tej sesji.

Otwórz `http://127.0.0.1:4050/pl` albo `/en`. Klucz API skonfiguruj lokalnie w interfejsie. Zaimportuj własne zasady. Klucze, zapisy i prywatny indeks zasad nie należą do repozytorium.

## Faktycznie wykonane sprawdzenia

Przed połączeniem z nowszym main przeszły:
- 6 zestawów, 86 testów: aktualizator, dialogi, endpoint teczek, start gry i Quick Setup.
- `npm run qa:quick`: TypeScript, 6851 zgodnych kluczy PL/EN i nawigacja.
- Kompilacja produkcyjna Next.js.

Pierwsza lokalna próba paczki udostępniła obie teczki, zgodny manifest i odmowę aktualizacji. Audyt wykrył stare dowiązanie `node_modules/node_modules` poza pakiet; pakowanie usuwa już ten link.

Nowsza paczka macOS zawierała skopiowany Node, który nie odpowiedział nawet na `--version` w limicie 12 sekund. Jego bajty odpowiadały działającemu systemowemu Node. Nie ustalono przyczyny; nie przypisuj jej mechanice gry i nie wyłączaj systemowych zabezpieczeń bez diagnozy.

Paczka macOS nie przeszła końcowego odbioru i nie została zainstalowana w tej sesji. Poprzednia aplikacja na Biurku pozostała zachowana. Udany build nie dowodzi działania launchera.

Kontrole po połączeniu gałęzi mają osobny raport w `docs/handoff/evidence/`. Poprzednie logi z `/private/tmp` nie są dostępne na Windows.

## Następny krok

Na Windows odtwórz zależności i uruchom oba endpointy za pomocą nowego skryptu.

Następnie dopnij samodzielną paczkę Windows. `desktop/build-windows.mjs` i `desktop/graj-windows.cmd` istnieją, ale trzeba zapewnić w produkcie ten sam profil teczek, etykietę wersji i blokadę updatera. Nie uruchamiaj macOS-owego `package-showcase.mjs` na Windows.

Sprawdź faktycznie spakowany produkt: BUILD_ID, oba endpointy, jedną przygodę na język, komplet mediów i odmowę publicznej aktualizacji. Pełna gra z modelem, odbiór materiałów i pomiar szybkości pozostają osobnym etapem.

## Sprawdzenia tej gałęzi po połączeniu

Aktualny stan przeszedł `npm run qa:quick`, 9 zestawów / 180 testów jednostkowych, produkcyjny build oraz 5 testów Chromium. Testy potwierdziły Quick Start PL/EN, osobne dialogi i karty informacji, oba endpointy teczek, dostępność 8 obrazów handoutów i blokadę aktualizacji. Błędów krytycznych przeglądarki: 0. Wywołań AI: 0.

Dowody: `docs/handoff/evidence/verification.json`, pliki tekstowe i 4 zrzuty. Ścieżki lokalne w logach zastąpiono `<repo>`, a kody ANSI usunięto. To sprawdzenie źródeł na macOS, nie odbiór paczki macOS ani test Windows.

Do powtórzenia na Windows po kompilacji: `npx playwright install chromium`, następnie `npx playwright test --config playwright.showcase.config.ts`. Testy uruchamiają własny serwer na porcie 4055 i nie wykonują generowania AI.
