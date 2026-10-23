# Kontynuacja pokazu na Windows

Aktualna gałąź: `codex/showcase-windows-handoff`.
Kod gry: `_tester/_base/.silnik/`.

Przeczytaj [przekazanie pracy](docs/handoff/SHOWCASE-WINDOWS-2026-10-23.md), następnie `AGENTS.md`, `CONTRIBUTING.md` i `docs/PROJECT-WORKFLOW.md`.

Cel: dopiąć dwie przygotowane przygody Quick Start i zbudować lokalną wersję pokazową. PL: Prabuty + Tomasz Nowicki. EN: Englewood + Frank Geyer. Obie mają teczki, grafy, handouty i nagrania.

Gałąź zawiera aktualne źródła i media, także wcześniejsze niezacommitowane poprawki. Nie zastępuj ich starszym main ani innym worktree. Nie kopiuj `node_modules`, `.next`, aplikacji `.app`, kluczy API, zapisów ani prywatnych zasad z macOS.

Po `npm ci` i `npm run build` w katalogu silnika:

```powershell
powershell -NoProfile -File scripts/start-showcase-windows.ps1
```

Otwórz `http://127.0.0.1:4050/pl` albo `/en`. Skrypt włącza obie teczki i ochronę aktualizacji. Wymaga sprawdzenia na prawdziwym Windows; nie jest gotową paczką dystrybucyjną.

Następny krok dla Codexa: uruchom ten stan na Windows, sprawdź aktywację obu teczek i dopnij samodzielną paczkę Windows z tym samym profilem. Pełna rozgrywka nie ma jeszcze odbioru.
