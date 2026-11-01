# 🛠️ Contributor & Developer Guide / Przewodnik dla Współtwórców (v0.9.6)

[🇵🇱 Wersja Polska](#-przewodnik-dla-współtwórców---strażnik-tajemnic-ai-v096) | [🇺🇸 English Version](#-contributor-guide---keeper-of-arcane-lore-ai-v096)

---

# 🇵🇱 Przewodnik dla Współtwórców - Strażnik Tajemnic AI (v0.9.6)

Dokument ten jest technicznym źródłem prawdy dla inżynierów i współtwórców rozwijających silnik **Strażnik Tajemnic AI (v0.9.6)**.

## 🗺️ 1. Mental Model i Topologia Kodu

Repozytorium posiada specyficzną architekturę zabezpieczającą środowisko gracza i proces dystrybucji desktopowej:

```
straznik-tajemnic/ (Git Root / Wrapper)
├── _tester/_base/.silnik/       <-- 100% KODU APLIKACJI I TESTÓW (Next.js 16, React 19)
│   ├── src/                     <-- Kod źródłowy (App Router, komponenty, logika)
│   │   ├── app/                 <-- Ekrany i Route Handlers (/api/*)
│   │   ├── components/          <-- Komponenty Dark Art Déco (UI, dialogi, nawigacja)
│   │   └── lib/                 <-- Logika domenowa (d100 RAW, RAG, 7 silników świata)
│   ├── messages/                <-- Słowniki i18n: pl.json i en.json (100% symetrii!)
│   ├── navigation/              <-- navigation-registry.json (rejestr ekranów i modali)
│   └── package.json             <-- Zależności silnika, skrypty testowe i kompilacja
├── desktop/                     <-- Launchery macOS/Windows i Desktop Process Supervisor
├── docs/                        <-- Dokumentacja architektury, audyty i przewodniki
└── README.md                    <-- Wizytówka publiczna na GitHubie
```

> [!CAUTION]
> **Zasada topologii kodu:**  
> Całość prac deweloperskich, instalację paczek (`npm install`), uruchamianie serwera dev (`npm run dev`) oraz testy wykonujesz w katalogu `_tester/_base/.silnik/`.  
> **Nigdy nie twórz ani nie edytuj plików w katalogu `src/` w głównym katalogu repozytorium!** Główny katalog służy wyłącznie jako wrapper i launcher.

---

## 🛡️ 2. Żelazne Inwarianty Inżynieryjne

### 1. Determinizm Mechaniki d100 Weird Fiction (Klasyczne d100 RAW)
- **Kości i mechanikę liczy wyłącznie TypeScript:** Wszelkie rzuty k100, progi sukcesu (Zwykły, Trudny, Ekstremalny, Sukces Krytyczny, Pech), rzuty na Poczytalność (SAN), testy na Pomysł (Idea Roll) oraz Faza Rozwoju Postaci są liczone w 100% kodem aplikacji (`src/lib/dice-utils.ts`, `skill-test-resolver.ts`).
- **AI nigdy nie rzuca kośćmi w oknie czatu:** Model LLM otrzymuje gotowy, niezmienny wynik testu i jego zadaniem jest wyłącznie fabularny opis konsekwencji.
- **Doktryna Czystego Emulatora BYOB:** Nie wprowadzaj do kodu zastrzeżonych znaków towarowych ani nie publikuj autorskich treści. Silnik pozostaje neutralnym emulatorem, a gracz wnosi własny podręcznik zasad PDF.
- **Podwójny Kontrakt (Silnik ↔ Prompt MG):** Każdy nowy tag narracyjny wyemitowany przez prompt MG (`gm-protocol.ts`) musi posiadać parser w silniku (`apply-stat-changes.ts`, `mechanics-parser.ts`), regułę czyszczenia z tekstu (`text-cleaner.ts`) oraz obsługę w lektorze TTS.

### 2. Bezwzględna Symetria Językowa (PL + EN)
- Aplikacja działa równolegle w języku polskim i angielskim.
- **Zakaz hardcoded strings w UI:** Każdy tekst wyświetlany użytkownikowi musi korzystać z hooka `useTranslations()`.
- Każdy klucz dodany do `messages/pl.json` **musi natychmiast otrzymać swój dokładny odpowiednik** w `messages/en.json`.
- Weryfikacja: `npm run qa:quick`.

### 3. Rejestr Nawigacji (`navigation-registry.json`)
- Nawigacja aplikacji (ekrany, modale, drawery) jest ściśle rejestrowana w `navigation/navigation-registry.json`.
- Dodanie lub modyfikacja modala/trasy wymaga równoległej aktualizacji wpisu w rejestrze. CI w GitHub Actions blokuje PR w przypadku wykrycia dryfu (`npm run navigation:check`).

### 4. Design System Dark Art Déco 1920s
- Standaryzacja na styl historyczny lat 20. XX wieku (mosiądz, postarzane złoto, głęboka czerń, mahoń, szmaragd Cthulhu).
- **Zakaz klas nowoczesnego flat designu:** `bg-zinc-*`, `bg-gray-*`, `text-white`, `rounded-2xl`, `rounded-3xl`.
- **Tokeny semantyczne:**
  - Tła: `bg-background`, `bg-card`, `bg-input`
  - Tekst: `text-foreground`, `text-card-foreground`, `text-muted-foreground`
  - Akcenty i ramki: `text-brass`, `border-brass/30`, `border-border`, `text-gold`
  - Akcenty specjalne: `bg-primary` (szmaragd), `text-destructive` (karmin/krew)
  - Typografia: `font-display` (Cinzel), `font-mono` / `font-special-elite` (maszynopis).
  - Weryfikacja: `npm run audit:art-deco`.

### 5. Zasada Ponytail (Search before Write)
- Bezwzględny zakaz pisania nowych funkcji pomocniczych i utilsów bez uprzedniego przeszukania istniejącej bazy kodu w `src/lib/`.
- Maksymalne ponowne użycie istniejących prymitywów, mapperów i komponentów.

### 6. Bezpiecznik CPI (Circuit Breaker - Limit 2 Napraw)
- Jeśli po 2. próbie kompilacja lub testy nie przechodzą: natychmiastowy STOP.
- Zakaz halucynacji naprawczych: zakaz `any`, zakaz wyciszania linterów (`eslint-disable`) i modyfikacji niepowiązanych plików. W razie impasu następuje rollback (`git checkout -- .`) i konsultacja architektoniczna z Product Ownerem.

### 7. Aktualizacja Raportu Wersji Beta (`BetaWelcomeModal`)
- Przy każdym PR dodającym, zmieniającym status lub finalizującym moduł gry należy zaktualizować zawartość raportu gotowości w oknie Wersji Beta (`BetaWelcomeModal.tsx`, `messages/pl.json` i `messages/en.json`).
- Moduły gotowe w kodzie, ale wymagające dalszych testów przy stole/w grze, oznaczamy precyzyjnie: `moduł gotowy w kodzie (w trakcie testów rozgrywki)`.
- Weryfikacja: `npx jest src/tests/unit/beta-welcome-modal.test.tsx`.

---

## ⚡ 3. Developer Cheat Sheet

Wszystkie poniższe komendy wykonuj w katalogu `_tester/_base/.silnik/`:

```bash
# 1. Przejście do katalogu silnika
cd _tester/_base/.silnik

# 2. Uruchomienie lokalnego serwera deweloperskiego
npm run dev
# Serwer wystartuje pod adresem http://localhost:3000

# 3. Szybka bramka jakościowa (uruchom przed każdym commitem!)
npm run qa:quick
# Wykonuje: tsc (type-check), walidację symetrii i18n oraz navigation:check

# 4. Sprawdzenie zgodności z Design Systemem Art Déco
npm run audit:art-deco

# 5. Uruchomienie testów jednostkowych (Jest)
npm test

# 6. Pełny build produkcyjny silnika
npm run build
```

### Budowanie aplikacji desktopowej (z głównego katalogu repozytorium):

```bash
cd /Volumes/Karta/Developer/straznik-tajemnic
bash desktop/build-app.sh --rebuild
```

---

## 🔄 4. Przepływ Pracy (Workflow & Git Worktrees)

1. **GitHub Issues jako SSOT:** Każde zadanie lub błąd posiada swoje zgłoszenie na GitHubie.
2. **Izolacja w Worktree:** Prace toczą się w osobnym worktree (np. `.worktrees/issue-XX`).
3. **Czerwona Pętla Repro (Bugi):** Naprawa usterki zaczyna się od testu kończącego się błędem potwierdzającym problem, przed modyfikacją kodu produkcyjnego.
4. **Obowiązkowy Test Gracza E2E:** Zrzut ekranu Playwright potwierdzający poprawne wyświetlanie interfejsu oraz zero błędów w konsoli przeglądarki (`console.error` = 0).
5. **Dwuosiowy Code Review:**
   - Oś 1: Zgodność ze specyfikacją i brak scope creepu.
   - Oś 2: Standardy czystego kodu (Ponytail, brak duplikacji, reguły Art Déco).

---

# 🇺🇸 Contributor Guide - Keeper of Arcane Lore AI (v0.9.6)

This guide provides technical specifications and invariant standards for developers contributing to **Keeper of Arcane Lore AI (v0.9.6)**.

## 🗺️ 1. Mental Model & Code Topology

The repository utilizes a dual-tier structure separating the developer runtime from desktop launcher wrappers:

```
straznik-tajemnic/ (Git Root / Wrapper)
├── _tester/_base/.silnik/       <-- 100% PRODUCTION CODE & TESTS (Next.js 16, React 19)
│   ├── src/                     <-- Source files (App Router, components, logic)
│   │   ├── app/                 <-- Route handlers (/api/*) and screens
│   │   ├── components/          <-- Dark Art Déco UI, dialogs, drawers
│   │   └── lib/                 <-- Domain logic (d100 RAW, RAG, 7 world engines)
│   ├── messages/                <-- i18n dictionaries: pl.json & en.json (100% parity)
│   ├── navigation/              <-- navigation-registry.json (screen registry)
│   └── package.json             <-- Engine dependencies, test scripts, build
├── desktop/                     <-- macOS/Windows desktop launchers and Process Supervisor
├── docs/                        <-- Architecture records, audits, design specs
└── README.md                    <-- Public repository showcase
```

> [!CAUTION]
> **Topology Invariant:**  
> All development activities, package installs (`npm install`), dev server execution (`npm run dev`), and test runs must be conducted inside `_tester/_base/.silnik/`.  
> **Never create or edit files in `src/` located at the root of the repository!** The root directory functions strictly as a packaging wrapper.

---

## 🛡️ 2. Core Engineering Invariants

### 1. Deterministic d100 Weird Fiction Mechanics (Classic d100 RAW)
- **TypeScript resolves all mechanics:** All d100 rolls, success thresholds (Regular, Hard, Extreme, Critical, Fumble), Sanity (SAN) tests, Idea Rolls, and Character Development Phases are 100% computed in TypeScript (`src/lib/dice-utils.ts`, `skill-test-resolver.ts`).
- **AI never rolls dice in chat prompts:** The LLM receives immutable test outcomes and strictly narrates dramatic consequences.
- **Clean Room BYOB Emulator Doctrine:** Do not include proprietary trademarks or third-party copyrighted materials in the engine. The app is an emulator engine; players supply their own PDF rulebooks.
- **Dual Contract (Engine ↔ GM Prompt):** Any new narrative directive tag generated by the GM prompt (`gm-protocol.ts`) must have a corresponding engine parser (`apply-stat-changes.ts`, `mechanics-parser.ts`), text-cleaning regex (`text-cleaner.ts`), and TTS speech handler.

### 2. Strict Language Symmetry (PL + EN)
- The application runs simultaneously in Polish and English.
- **No hardcoded UI strings:** All interface text must be wrapped in `useTranslations()`.
- Every key added to `messages/pl.json` **must immediately receive an identical counterpart** in `messages/en.json`.
- Verification command: `npm run qa:quick`.

### 3. Navigation Registry (`navigation-registry.json`)
- Navigation nodes (screens, dialogs, drawers) are registered in `navigation/navigation-registry.json`.
- Any navigation change requires updating the registry. GitHub Actions CI blocks PRs on drift (`npm run navigation:check`).

### 4. Dark Art Déco 1920s Design System
- Standardized 1920s historical palette (brass, aged gold, charcoal black, mahogany, eldritch emerald).
- **No generic modern flat design classes:** `bg-zinc-*`, `bg-gray-*`, `text-white`, `rounded-2xl`, `rounded-3xl`.
- **Semantic tokens:**
  - Backgrounds: `bg-background`, `bg-card`, `bg-input`
  - Text: `text-foreground`, `text-card-foreground`, `text-muted-foreground`
  - Accents & borders: `text-brass`, `border-brass/30`, `border-border`, `text-gold`
  - Brand & alerts: `bg-primary` (emerald), `text-destructive` (crimson)
  - Typography: `font-display` (Cinzel), `font-mono` / `font-special-elite` (typewriter).
  - Verification: `npm run audit:art-deco`.

### 5. Ponytail Rule (Search before Write)
- Never implement new utility functions or helpers without first searching `src/lib/`.
- Reuse existing primitives and domain handlers wherever possible.

### 6. CPI Circuit Breaker (2-Repair Limit)
- If a build or test suite fails after 2 repair attempts: STOP immediately.
- Never use `any` casting, linter silencing (`eslint-disable`), or unrelated edits to force builds to pass. Perform `git checkout -- .` and review architecture with the Product Owner.

### 7. Beta Welcome Modal Report Synchronization (`BetaWelcomeModal`)
- Every PR that introduces, updates, or finalizes a game module must synchronize the readiness report in the Beta Welcome modal (`BetaWelcomeModal.tsx`, `messages/pl.json`, and `messages/en.json`).
- Modules completed in code that are still undergoing gameplay playtesting must be explicitly labeled: `feature implemented in engine (currently in gameplay testing)`.
- Verification: `npx jest src/tests/unit/beta-welcome-modal.test.tsx`.

---

## ⚡ 3. Developer Cheat Sheet

Execute all commands within `_tester/_base/.silnik/`:

```bash
# 1. Navigate to engine directory
cd _tester/_base/.silnik

# 2. Start local development server
npm run dev
# Access the UI at http://localhost:3000

# 3. Fast QA validation gate (run before every commit)
npm run qa:quick
# Runs type-checking, i18n symmetry checks, and navigation registry verification

# 4. Dark Art Déco design audit
npm run audit:art-deco

# 5. Unit test suite (Jest)
npm test

# 6. Production engine build
npm run build
```

### Building desktop releases (from repository root):

```bash
cd /Volumes/Karta/Developer/straznik-tajemnic
bash desktop/build-app.sh --rebuild
```

---

## 🔄 4. Engineering Workflow & Git Worktrees

1. **GitHub Issues as SSOT:** Every task, feature, or bug originates in GitHub Issues.
2. **Worktree Isolation:** Independent tasks execute in isolated git worktrees (`.worktrees/issue-XX`).
3. **Red Reproduction Loop (Bugs):** Reproduce defects with a failing test before editing production code.
4. **Mandatory Visual Player E2E Test:** Playwright visual verification with zero browser console errors (`console.error` = 0) and screenshot evidence.
5. **Two-Axis Code Review:**
   - Axis 1: Spec adherence & zero scope creep.
   - Axis 2: Clean code standards (Ponytail reuse, Art Déco tokens, maintainability).
