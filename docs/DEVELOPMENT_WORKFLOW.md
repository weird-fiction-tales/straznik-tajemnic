# Workflow rozwoju Strażnika Tajemnic AI (v0.9.5)

Zasady inżynieryjne i procedury wytwórcze obowiązujące w projekcie **Strażnik Tajemnic AI**, oparte na uniwersalnym silniku `aios-vibe-coder` (V2.2).

---

## 🗺️ 1. Granice projektu i topologia

- **Git Root:** `/Volumes/Karta/Developer/straznik-tajemnic`.
- **Środowisko deweloperskie i testowe:** `_tester/_base/.silnik`.
- **Artefakt testowy macOS:** `~/Applications/Straznik Tajemnic AI.app` oraz kopia na Biurku, tworzona przez `bash desktop/build-app.sh --rebuild` w głównym katalogu repozytorium.
- **Jedno źródło prawdy (SSOT):** Wszystkie zadania, błędy i inicjatywy żyją wyłącznie w **GitHub Issues**. Zakaz tworzenia luźnych, lokalnych plików stanu (`state.md`, `zadania.md`).

---

## 🔄 2. Sześć Faz Cyklu Deweloperskiego (`aios-vibe-coder`)

```
[0. INTAKE & PRP]    -> Bramka 'Słoń' + Issue GitHub + Kontrakt PRP (Allowlist + Pętla Czerwona)
[1. WORKTREE START]  -> Izolowany branch w .worktrees/issue-XX + Wczytanie reguł projektu
[2. CHECKPOINT PO]   -> Zwięzły raport grafowy + Rekomendacja ⭐ (Klauzula Łącznej Autoryzacji)
[3. IMPLEMENTACJA]   -> Kodowanie w granicach Allowlist + Testy jednostkowe + Zasada Ponytail
[4. WERYFIKACJA & PR]-> Lokalne testy + Dwuosiowy Audyt Kodu + Obowiązkowy Test Gracza E2E + PR
[5. MERGE & DELIVERY]-> Merge do main + Usunięcie worktree + Rebuild na Biurku
```

### Faza 0: Intake i Kontrakt PRP
1. Każde zadanie posiada swoje Issue na GitHubie.
2. Zdefiniowany zostaje ścisły Kontrakt PRP:
   - **Allowlist (Dozwolone pliki):** Minimalna lista plików do edycji.
   - **Denylist & Anti-scope:** Ścieżki chronione i świadome wykluczenia.
   - **Czerwona Pętla Repro (Bugi):** Test jednostkowy lub polecenie CLI potwierdzające usterkę przed dotknięciem kodu produkcyjnego.
   - **Bramka testowa (Exit Criteria):** Polecenia kończące się kodem 0 (`npm run qa:quick`, `npm test`, `npm run build`).

### Faza 1: Izolowany Start w Git Worktree
Wszystkie prace developerskie prowadzone są w osobnym katalogu worktree, chroniąc stabilne środowisko głównego katalogu:
```bash
git worktree add .worktrees/issue-XX -b fix/issue-XX-nazwa
```

### Faza 2: Checkpoint Decyzyjny PO
Przedstawienie zwięzłego raportu decyzyjnego dla Product Ownera (PO) z jedną rekomendowaną opcją ⭐. Zatwierdzenie stanowi łączną autoryzację na przejście do wdrożenia.

### Faza 3: Implementacja w Worktree
1. Modyfikowane są wyłącznie pliki z zatwierdzonej Allowlisty.
2. **Zasada Ponytail (Search before Write):** Zakaz tworzenia zduplikowanych funkcji pomocniczych bez uprzedniego przeszukania `src/lib/`.
3. **Symetria językowa:** Zmiany UI muszą równolegle zaktualizować `messages/pl.json` i `messages/en.json`.
4. **Standard modali:** Każdy nowy lub przebudowywany modal spełnia [standard Art Deco](DESIGN-SYSTEM-ART-DECO.md#6-standard-każdego-nowego-i-przebudowywanego-modalu), w tym mosiężne ornamenty i szmaragdowe stany aktywne. Karta Badacza stanowi wzorzec do porównania renderu.
5. **Rejestr nawigacji:** Zmiany w ekranach lub modalach wymagają aktualizacji `navigation/navigation-registry.json`.

### Faza 4: Weryfikacja Anty-Regresyjna & Bezpiecznik CPI
1. **Bezpiecznik CPI (Circuit Breaker):** Limit 2 prób naprawy. W razie niepowodzenia: natychmiastowy STOP, rollback i raport blokady.
2. **Obowiązkowy Test Gracza E2E:** Symulacja sesji Playwright ze zrzutem ekranu jako dowodem wizualnym oraz asercją na zero błędów w konsoli (`console.error` = 0).
3. **Dwuosiowy Przegląd Kodu (Two-Axis Code Review):**
   - **Oś 1 (Wierność Specyfikacji):** Sprawdzenie braku scope creepu i zgodności z PRP.
   - **Oś 2 (Standardy i Czysty Kod):** Analiza tokenów Dark Art Déco, brak duplikacji (Ponytail) i zapachów Fowlera.
4. **PR Impact Report:** Pull Request zawiera podsumowanie dotkniętych modułów, poziomu ryzyka i liczby linii.

### Faza 5: Merge, Delivery & Handoff
1. Scalenie do `main` po przejściu zielonego CI w GitHub Actions (`gh pr merge --squash --delete-branch`).
2. Usunięcie katalogu worktree (`git worktree remove .worktrees/issue-XX`).
3. Przebudowa aplikacji na Biurku (`bash desktop/build-app.sh --rebuild`).
4. Raport odbioru dla PO z dokładnie jednym mikrokrokiem na 2 minuty.
