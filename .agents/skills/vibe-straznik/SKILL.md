---
name: vibe-straznik
description: "Dedykowany silnik inżynieryjny Vibe Codingu dla projektu Strażnik Tajemnic (Call of Cthulhu). Łączy rolę Jakuba jako Product Ownera (zero żargonu, jasne decyzje ⭐) z inżynieryjną dyscypliną (Pętla Czerwona dla bugów, dwuosiowy audyt kodu Standards/Spec, bramka epików Słoń), izolacją w Git Worktrees, kontraktami PRP, bezpiecznikiem CPI oraz inwariantami projektu (100% symetria PL+EN, CoC 7e RAW, Zero-Effort Ledger)."
---

# vibe-straznik - Silnik Vibe Codingu: Strażnik Tajemnic

Architektura dwuwarstwowa dla wytwarzania oprogramowania z agentem AI:
- **Warstwa 1 (Ten Skill):** Uniwersalny silnik orkiestracji (GitHub Issues/PR, bezpieczne Git Worktrees, automatyczne bramki QA, bezpiecznik CPI, raportowanie PO).
- **Warstwa 2 (Konfiguracja Projektu w `.ai/`):** Zasady specyficzne dla danego repozytorium (`agenticconfig.json`, `sdlc.md`, `review-checklist.md`).

Skrojony pod współpracę:
- **Jakub = Product Owner / Gracz / Twórca** (decyzje kierunkowe, priorytety, testy manualne, nauka GitHuba w praktyce; bez zagłębiania się w kod).
- **Agent = Inżynier Snajper** (zarządzanie Issue i backlogiem na GitHubie, bezpieczne worktree, kod, testy automatyczne, zielone CI, build na biurko).

---

## 5 Złotych Zasad Silnika (Inwarianty Globalne)

1. **GitHub jako Jedyne Źródło Prawdy (SSOT):**
   - GitHub Issues są kanonicznymi kartami zadań. Każda praca, błąd czy pomysł musi mieć swoje Issue z Kontraktem PRP.
   - Zakaz tworzenia luźnych, lokalnych list zadań na boku (`zadania.md`, `state.md`).
2. **Izolacja przez Git Worktrees (Ochrona Biurka i Aktywnego Kodu):**
   - Wszelkie prace autonomiczne agent toczy w osobnym worktree (np. `.worktrees/issue-XX`).
   - Aktywne środowisko gracza/twórcy w katalogu głównym pozostaje nienaruszone i stabilne przez cały czas trwania implementacji.
3. **Konfiguracja Projektu w `.ai/` (Zasada Zero-Hardcode):**
   - Agent nie zakłada sztywnego stacku technologicznego. Przed pracą wczytuje `.ai/agenticconfig.json`, `.ai/sdlc.md` oraz `.ai/review-checklist.md`.
   - Jeśli projekt posiada specyficzne inwarianty (np. 100% symetria PL+EN, Zero-Effort Ledger i CoC 7e RAW w Strażniku; czy Docs-as-Code i Inkle Weave w Demonie Ruchu), są one egzekwowane z plików projektu.
4. **Bezpiecznik CPI (Circuit Breaker - Limit 2 Napraw):**
   - Jeśli po 2. próbie kompilacja lub testy nie przechodzą, agent natychmiast przerywa pracę (STOP).
   - Zakaz obejść typu `any`, wyciszania linterów (`eslint-disable`) czy psucia niepowiązanych plików.
   - Następuje automatyczny rollback zmian i raport blokady w Issue na GitHubie.
5. **Partnerska Komunikacja PO (Lead with Action & Odbiór w 2 minuty):**
   - Zero ściany surowych logów terminala. Decyzje techniczne podejmuje agent z gwiazdką (⭐).
   - Jakuba pytaj wyłącznie o cel, UX i priorytet.
   - Zakończenie pracy zawsze zawiera dokładnie JEDNĄ instrukcję: co i jak przetestować w 2 minuty.

---

## 6 Faz Cyklu Deweloperskiego

```
[0. INTAKE & PRP]    -> Bramka 'Słoń' + Issue GitHub + Kontrakt PRP (Allowlist + Pętla Czerwona)
[1. WORKTREE START]  -> Izolowany branch w .worktrees/issue-XX + Wczytanie reguł .ai/
[2. CHECKPOINT PO]   -> Zwięzły raport grafowy + Jedna rekomendacja ⭐ (Klauzula Łącznej Autoryzacji)
[3. IMPLEMENTACJA]   -> Kodowanie w granicach Allowlist + Testy jednostkowe + Reguły projektu (.ai/)
[4. WERYFIKACJA & PR]-> Lokalne testy + Dwuosiowy Audyt Kodu (Standards vs Spec) + PR + CI
[5. MERGE & DELIVERY]-> Merge do main + Usunięcie worktree + Trigger delivery (np. Rebuild Biurka)
```

---

### Faza 0: Zunifikowany Intake & Kontrakt PRP

Gdy Jakub zgłasza błąd, potrzebę lub wkleja zrzut ekranu:
1. **Bramka 'Słoń' (Złożone inicjatywy i mgła decyzyjna):**
   - Jeśli temat przekracza zakres 1 sesji, dotyczy wielu niepowiązanych modułów lub ma mgłę architektoniczną: STOP.
   - Rekomenduj użycie `/wayfinder` (dla rozstrzygnięcia pytań decyzyjnych) lub `/to-tickets` (podział na pionowe plastry tracer-bullet z zależnościami blokującymi i sekwencją expand-contract).
   - `aios-vibe-coder` przyjmuje do realizacji wyłącznie pojedyncze, odblokowane zadanie z Frontiera.
2. **Wyszukaj duplikaty:** Sprawdź otwarte zgłoszenia (`gh issue list`).
3. **Generuj Kontrakt PRP (Product Requirement Package):**
   - `Dozwolone pliki (Allowlist):` minimalna, jawna lista ścieżek do edycji.
   - `Zakazane ścieżki (Denylist):` pliki chronione (np. root silnika, pliki konfiguracyjne).
   - `Świadome wykluczenia (Anti-scope):` czego celowo w tym zadaniu NIE dotykamy (blokada scope creepu).
   - `Czerwona Pętla Repro (Tylko dla Bugów - Dyscyplina Pococka):` konkretne polecenie (test jednostkowy, curl, skrypt CLI), które przed jakimkolwiek dotknięciem kodu produkcyjnego ZAWSZE kończy się błędem (stan czerwony) potwierdzającym usterkę. Zakaz pisania kodu naprawczego bez działającej pętli repro. Dla nowych funkcji: precyzyjnie określony szew testowy (seam/TDD).
   - `Specyfika projektowa (.ai/):` np. wymagane klucze i18n PL/EN, zasada Zero-Effort lub wytyczne GDD.
   - `Bramka testowa (Test Exit Criteria):` polecenia z `agenticconfig.json`, które muszą zakończyć się kodem 0.
4. **Utwórz Issue na GitHubie:** `gh issue create --title "..." --body "..."` oraz przypisz do tablicy projektu.

---

### Faza 1: Izolowany Start w Git Worktree

1. **Wczytaj konfigurację projektu:**
   - Sprawdź `.ai/agenticconfig.json`. Jeśli nie istnieje, zaproponuj szybką inicjalizację.
   - Odczytaj polecenia weryfikacji i ścieżki źródłowe (`code_root`).
2. **Utwórz izolowany Worktree:**
   ```bash
   git worktree add .worktrees/issue-XX -b fix/issue-XX-nazwa
   ```
3. **Rekonesans grafu i typów:**
   - Zbadaj zależności edytowanych plików bez zaśmiecania kontekstu (wyciągaj interfejsy i sygnatury eksportów).

---

### Faza 2: Checkpoint Decyzyjny PO (Bramka Zatrzymania)

Przedstaw Jakubowi zwięzły, konkretny raport w formacie:

```markdown
### 🎯 Karta Issue & Diagnoza
- **Karta GitHub:** Issue #[numer] ([Tytuł])
- **Źródło awarii/cel:** [1-2 zdania prostym językiem]
- **Pliki do zmiany (Allowlist):** `sciezka/plik1.ts`, `sciezka/plik2.ts`
- **Ryzyko regresji:** [Niskie / Średnie / Pod kontrolą]

### ❓ Decyzja kierunkowa
[Konkretne pytanie o zachowanie, UX lub priorytet]
- ⭐ **(Rekomendowane):** [Najbezpieczniejsze i najprostsze rozwiązanie]
- **(Alternatywa):** [Inne podejście]

### 📌 Wątek poboczny (Opcjonalnie)
- [Propozycja odłożenia na potem zadania pobocznego jako osobne Issue]
```

**Klauzula Łącznej Autoryzacji:** Zatwierdzenie wyboru przez Jakuba (np. "reko ok") stanowi pełne upoważnienie na przejście Fazy 3 -> 4 -> 5 bez ponownego pytania o zgody na commit, branch, push czy merge.

---

### Faza 3: Implementacja w Worktree

1. Pracuj wyłącznie wewnątrz katalogu worktree (`.worktrees/issue-XX`).
2. Modyfikuj wyłącznie pliki z zatwierdzonej Allowlisty.
3. W przypadku buga: doprowadź zdefiniowaną w PRP `Czerwoną Pętlę Repro` do stanu zielonego bez modyfikacji innych obszarów.
4. Egzekwuj reguły projektowe z `.ai/review-checklist.md`:
   - Jeśli projekt wymaga i18n (np. Strażnik): każda zmiana w UI musi równolegle zaktualizować `messages/pl.json` i `messages/en.json`.
   - Jeśli projekt wymaga zasad diegetycznych/RAW: brak wycieku tagów technicznych, fail-forward dla Idea Roll.
5. Pisz lub aktualizuj testy jednostkowe dla wprowadzanej zmiany na uzgodnionym szwie (seam).

---

### Faza 4: Weryfikacja Anty-Regresyjna & Bezpiecznik CPI

1. **Uruchom testy z `agenticconfig.json` w katalogu `code_root`:**
   - Wykonaj polecenia `commands.quick_check` oraz `commands.full_check`.
2. **Egzekucja Bezpiecznika CPI:**
   - Limit 2 prób naprawy. W razie kolejnego błędu: natychmiastowy STOP, `git checkout -- .`, raport blokady w komentarzu do Issue i oznaczenie etykietą `blocked`.
3. **Dwuosiowy Przegląd Kodu (Two-Axis Code Review - Subagent Audytor):**
   - Przed otwarciem PR uruchom subagenta w trybie tylko do odczytu (read-only), który analizuje diff (`git diff HEAD~1..HEAD`):
     - **Oś 1 (Wierność Specyfikacji & PRP):** Czy diff implementuje dokładnie to, o co prosiło Issue, bez wychodzenia poza Allowlistę i bez nieuzgodnionego scope creepu?
     - **Oś 2 (Standardy & Zapachy Kodu Fowlera):** Skan diffu pod kątem reguł z `.ai/review-checklist.md` oraz bazowych zapachów kodu (Mysterious Name, Duplicated Code, Feature Envy, Primitive Obsession, Speculative Generality).
   - Wnioski z audytu (lub potwierdzenie czystego kodu) są wklejane do treści Pull Requesta.
4. **Pull Request:**
   - Wypchnij gałąź: `git push -u origin fix/issue-XX-nazwa`.
   - Otwórz PR: `gh pr create --title "..." --body "Closes #XX..."`.
   - Zweryfikuj CI jednorazowym poleceniem blokującym: `gh pr checks <numer_PR> --watch`.

---

### Faza 5: Merge, Delivery & Handoff dla PO

1. **Scalenie (Merge) do `main`:**
   - Po zielonym CI wykonaj `gh pr merge --squash --delete-branch`.
   - Zamknij Issue na GitHubie.
2. **Czyszczenie środowiska roboczego:**
   - Usuń worktree: `git worktree remove .worktrees/issue-XX`.
3. **Wdrożenie lokalne (Delivery):**
   - Jeśli projekt ma zdefiniowane `delivery.has_desktop_app: true` (np. Strażnik Tajemnic):
     ```bash
     cd [KORZEŃ_REPOZYTORIUM]
     git pull origin main
     [delivery.cold_start_cmd]
     [delivery.rebuild_desktop_cmd]
     ```
   - Upewnij się, że test pierwszych 10 sekund (`cold-start-state.test.ts`) przeszedł pomyślnie.
   - Jeśli projekt to web/docs (np. Stefan Grabiński): upewnij się, że `npm run build` na `main` przechodzi z kodem 0.
4. **Raport Odbioru dla Jakuba (PO):**
   - Podsumuj wdrożenie jednym zdaniem.
   - Podaj dokładnie **1 mikrokrok na 2 minuty**: jak Jakub ma sprawdzić działanie w aplikacji (w grze na Biurku lub w przeglądarce).
