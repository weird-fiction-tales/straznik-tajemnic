<div align="center">

<img src="docs/assets/06-banner-1500x500.png" alt="Strażnik Tajemnic AI / Keeper of Arcane Lore AI" width="820">

# 𓂀 Strażnik Tajemnic AI / Keeper of Arcane Lore AI (v0.9.6)

**Nieoficjalny, fanowski Mistrz Gry AI do sesji RPG w klimacie lovecraftowskim.**  
*An unofficial, fan-made AI Game Master for RPG sessions in the Lovecraftian setting.*

> Kod i lokalna aplikacja macOS: **0.9.6**. Instalatory publiczne poniżej pozostają w wersji **0.9.5**. [Zakres 0.9.6](docs/RELEASE-0.9.6.md).<br>
> Source and local macOS application: **0.9.6**. Public installers below remain at **0.9.5**.<br>
> v0.9.5 jest stabilnym wydaniem na Windows oraz macOS. Pobierz paczkę ZIP poniżej.<br>
> v0.9.5 is a stable release for Windows and macOS. Download the ZIP package below.

---

[🇵🇱 Wersja Polska](#-straznik-tajemnic-ai-v095) | [🇺🇸 English Version](#-keeper-of-arcane-lore-ai-v095)

</div>

---

# 🇵🇱 Strażnik Tajemnic AI (v0.9.6)

Prowadź sesje śledczego RPG grozy w klimacie weird fiction solo lub przy jednym laptopie (Hot Seat). Wklejasz własny klucz Gemini, wgrywasz **swój** podręcznik, a zapisy stanu gry lądują na Twoim dysku. Nie potrzebujesz konta, subskrypcji ani zewnętrznej bazy danych. Wszystko działa lokalnie na Twoim komputerze.

## ⚔️ Dlaczego Strażnik Tajemnic, a nie zwykły prompt w ChatGPT?

Próba grania w RPG z domyślnym modelem językowym w oknie czatu szybko uderza w mur: sztuczna inteligencja zmyśla rzuty kośćmi, zapomina zebrane poszlaki po kilkunastu turach i daje graczowi taryfę ulgową. **Strażnik Tajemnic AI** rozwiązuje ten problem, rozdzielając literacką narrację od żelaznej mechaniki:

| Wymiar rozgrywki | Zwykły prompt w ChatGPT / Claude | Dedykowany Strażnik Tajemnic AI |
|---|---|---|
| **Rzuty kośćmi** | Halucynowane w tekście ("Wyrzuciłeś 14..."), brak prawdziwego RNG | 100% kodowane rzuty k100 w TypeScript - AI dostaje twardy wynik z silnika |
| **Pamięć śledztwa** | Gubi fakty, nazwiska NPC i wątki po zapełnieniu okna kontekstu | Dedykowany Dziennik Śledztwa, Raporty Aktów i Licznik Poszlak |
| **Zasady i stawka** | Brak reguł, ciągłe ułatwianie gry, niechęć do ranienia badacza | Klasyczna mechanika d100 RAW: rany, obłęd, panika i bezwzględne starcia |
| **Źródło wiedzy** | Uogólniona, rozmyta wiedza modelu z internetu | Twój własny podręcznik przeszukiwany lokalnym RAG (wektory Float32) |
| **Prywatność i koszty** | Dane w chmurze korporacji, abonamenty rzędu $20 miesięcznie | 100% lokalne pliki na dysku, darmowy osobisty klucz API (model BYOK) |

## 👥 Dla kogo

Przychodzi taki etap życia, że zebranie stałej ekipy na sesję RPG graniczy z cudem: kalendarze się nie spinają, ludzie się rozjeżdżają, a chęć na dobrą opowieść zostaje. **Strażnik Tajemnic** sprawia, że nie musisz na nikogo czekać. Bierze rolę Mistrza Gry na siebie, żebyś mógł przeżywać mroczne śledztwa na własnej kanapie.

- **Solo** - zagraj sam, kiedy tylko masz wolny wieczór. AI prowadzi narrację, pilnuje zasad i pamięta każdy Twój wybór przez całą kampanię.
- **We dwoje (Hot Seat)** - jeden laptop, wspólny wieczór z grozą: każde z Was ma własną postać i unikalny kolor interfejsu, a AI zwraca się do graczy po imieniu.

## ⬇️ Pobierz

- 🪟 **[Pobierz paczkę Windows (ZIP)](https://github.com/InduPhantom-hash/straznik-tajemnic/releases/download/v0.9.5/straznik-tajemnic-windows.zip)** - samowystarczalna paczka Zero-Setup dla Windows (rozpakuj i kliknij `Graj - Strażnik Tajemnic.cmd`).
- 🍎 **[Pobierz paczkę macOS (ZIP)](https://github.com/InduPhantom-hash/straznik-tajemnic/releases/download/v0.9.5/straznik-tajemnic-macos.zip)** - uruchom aplikację na macOS dwuklikiem.

Paczki nie zawierają klucza API ani podręcznika: przy pierwszym starcie wklejasz **własny** klucz Gemini (`https://aistudio.google.com/apikey`) i wgrywasz **swój** PDF z zasadami.

> Wszystkie pliki wydań i sumy kontrolne znajdziesz w [GitHub Releases](https://github.com/InduPhantom-hash/straznik-tajemnic/releases/tag/v0.9.5).
> Wolisz uruchomić ze źródeł? Sprawdź instrukcję poniżej (**Szybki start**).

> [!IMPORTANT]
> **Projekt fanowski, nieoficjalny (Doktryna Czystego Emulatora BYOB).** Nie jest powiązany z Chaosium Inc. ani Black Monk Games.
> Aplikacja to **sam silnik emulatora** (model ScummVM / RetroArch) z **dwuskładnikowym blokerem sesji** (Klucz API + własny PDF z zasadami). Nie zawiera żadnego podręcznika ani zastrzeżonych tabel. Grasz na **własnym, legalnie nabytym** egzemplarzu (darmowy Starter d100 lub pełna Księga Zasad). _Call of Cthulhu_ / _Zew Cthulhu_ to znaki towarowe Chaosium Inc. Szczegóły: [`NOTICE`](./NOTICE).

## ✨ Co potrafi silnik

Możliwości Strażnika Tajemnic łączą immersję literackiej opowieści z bezwzględną dyscypliną kodu.

### 🎭 Doświadczenie przy stole (Dla Gracza)

- **Śledztwo z Prawdziwą Stawką (Dziennik, Raporty Aktów i Licznik Poszlak):** Reżyseria scen dzieli przygodę na przejrzyste akty. Dziennik podsumowuje zebrane fakty, dynamiczny licznik pilnuje potwierdzonych tropów, a wiodąca hipoteza robocza pozwala jednym kliknięciem zacytować ustalenia prosto do pola akcji (Quote-to-Input). Gdy utkniesz, Rzut na Pomysł (Idea Roll RAW) posuwa akcję naprzód bez zatrzymywania fabuły (zasada Fail-Forward).
- **Bezkompromisowa Walka Wręcz d100 (Starcia Przeciwstawne):** Karty starcia `OpposedMeleeCard`, przeciwstawne rzuty Uniku i Kontrataku, manewry bojowe, modyfikatory Budowy (Build), przewaga liczebna wrogów oraz rzuty padnij za osłonę (Dive for Cover). Walka jest śmiertelna i szybka.
- **Kompendium Badacza & Kodeks Zasad:** Boczny pasek narzędzi w stylu Dark Art Déco zawierający podręczny Mini-Obsidian: kompendium reguł d100, leksykon mitologii weird fiction oraz lokalną wyszukiwarkę zagadnień z Twojego podręcznika.
- **Świadomy Ekwipunek i Finanse Epoki:** Pełnoekranowy widok ekwipunku bez żargonu technicznego, świadome podnoszenie rekwizytów (brak niechcianego auto-lootu dokumentów do torby), kompaktowy pasek poziomu życia i gotówki dostosowany do 6 kanonicznych epok (`1920s-us`, `1920s-pl`, `prl-1970s`, `1890s-uk`, `modern-pl`, `modern-us`), tabele zamożności (w tym funty wiktoriańskie £/s/d) oraz deterministyczne grafiki przedmiotów SVG/WebP.
- **Klimatyczne Wprowadzenie i Wybór Języka Sesji:** Ostrzeżenie 18+ (Mature Audience / Content Warning) z dwujęzycznym epitafium H.P. Lovecrafta, powiększony modal wyboru języka wiążący sesję (ochrona przed mieszaniem języków w dialogach), automatyczna synchronizacja języka zapisu oraz bezspoilerowe, nastrojowe dossier Badacza w oknie przygotowania sesji.
- **Stylistyka Dark Art Déco 1920s:** Głęboka czerń węgla, mosiądz, mahoń, postarzane złoto, typografia epoki (`Special Elite`, `Cinzel`) oraz 12 klimatycznych retro-rycin wektorowych SVG dla profesji badaczy.
- **Lektor (TTS) i Kinowe Ilustracje Scen:** Natychmiastowy streaming głosu Mistrza Gry (głosy Charon / Gacrux) oraz generowanie pełnokadrowych ilustracji lokacji (16:9), portretów NPC i artefaktów przez `gemini-3.1-flash-image` z powiększeniem w lightboxie.
- **Sesja Zero i Bezpieczeństwo przy Stole:** Narzędzie kalibracji granic opowieści (Linie i Zasłony) pozwalające wykluczyć niechciane motywy ze scenariusza.
- **Autorscy Badacze i 30 Gotowych Postaci:** Wymóg powołania autorskiego Badacza w trybie ręcznym (Manual Setup) z kalkulacją współczynników d100 i filtrem umiejętności oraz błyskawiczny start sesji z predefiniowanymi postaciami w trybie Szybka Przygoda.
- **Autozapis Kroniki Sesji:** Bezpieczna procedura zamknięcia sesji z automatycznym zapisem stanu gry i trójstanową kartą statusu (zapisywanie, kronika zapisana, ponowienie).

### ⚙️ Inżynieria pod maską (Architektura)

- **Deterministyczna Matematyka d100 w TypeScript:** AI **nigdy nie rzuca kośćmi w oknie czatu**. Testy cech i umiejętności, kalkulacje progów sukcesu (Zwykły, Trudny, Ekstremalny, Sukces Krytyczny, Pech), testy Poczytalności (SAN) oraz Faza Rozwoju Postaci są w 100% obliczane kodem TypeScript. Model otrzymuje twardy wynik i opisuje wyłącznie jego fabularne następstwa.
- **7 Dynamicznych Silników Świata w Locie (World Engine Director):** Architektura dynamicznych wstrzyknięć behawioralnych do promptu: `NPCEngine` (fasada, skaza, opór), `SensoryEngine` (triada zmysłowa, somatyka, Zmienna Próżni), `NarrativeGraphEngine` (struktura branch-and-bottleneck), `PlotFrictionEngine` (plotki 70/30, tarcie społeczne), `MysteryClueEngine` (zasada 3 poszlak, fail-forward), `GeographyEngine` (chokepoints, hydraulika podziemi) oraz `OccultEngine` (prawa magii Sandersona, cena somatyczna).
- **16 Technik Narracyjnych i Dynamiczny Reżyser Pacingu:** Wbudowany zestaw technik narracyjnych i scenopisarskich (pacing, budowanie napięcia, zmysły, chłód kosmiczny) rotowanych dynamicznie w locie z zachowaniem przerw (cooldown) zapobiegających monotonii opisu.
- **Lokalny Mikromodel CPU i Guardrail Epoki (0 Tokenów, <30 ms):** Wbudowany dyspozytor klasyfikacyjny na CPU orkiestrujący silniki świata i odciążający prompt o >35% w turach spokojnych, połączony z lokalnym strażnikiem epoki (`era-guardrail.ts`), który odcina pytania techniczne i anachronizmy epoki w czasie <1 ms bez zużycia tokenów API.
- **Lokalny RAG Podręcznika:** Aplikacja parsuje **Twój** plik PDF, tworzy binarny indeks wektorowy (`Float32`) na dysku i wstrzykuje właściwe reguły do kontekstu w locie. AI nie zmyśla tabel ani procedur.
- **Samodzielny Launcher Desktopowy i 100% Tryb Offline:** Nadzorca procesów (Desktop Process Supervisor w czystym Node.js - eliminacja procesów zombie przez kaskadowy `tree-kill`, dynamiczny przydział portów, Single Instance) oraz 100% self-hosted fonty WOFF2 (brak jakichkolwiek zapytań do zewnętrznych CDN-ów).

## 📸 Zrzuty ekranu

<table>
  <tr>
    <td width="50%"><img src="docs/assets/screenshots/01-menu-glowne.png" alt="Menu główne"><br><sub><b>Menu główne v0.9.5</b> - stylizowany wybór trybu Solo, Hot Seat, Sesji Zero i gotowych śledztw w Dark Art Déco.</sub></td>
    <td width="50%"><img src="docs/assets/screenshots/02-pierwsze-uruchomienie.png" alt="Pierwsze uruchomienie"><br><sub><b>Pierwszy start</b> - bezpieczne wklejanie klucza Gemini oraz podpinanie własnego podręcznika zasad PDF (BYOB).</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/screenshots/03-sesja-zero-linie-zaslony.png" alt="Sesja Zero"><br><sub><b>Sesja Zero</b> - kalibracja granic narracyjnych oraz filtrów wrażliwości (Linie i Zasłony).</sub></td>
    <td width="50%"><img src="docs/assets/screenshots/04-scena-i-narracja-lovecrafta.png" alt="Ekran gry z AI"><br><sub><b>Ekran śledztwa</b> - ilustracja lokacji w 16:9, narracja grozy, Dziennik Śledztwa i panel narzędzi Badacza.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/screenshots/05-karta-postaci.png" alt="Karta badacza"><br><sub><b>Karta badacza</b> - współczynniki d100, Faza Rozwoju Postaci, 12 retro-rycin SVG i filtr umiejętności.</sub></td>
    <td width="50%"><img src="docs/assets/screenshots/06-ekwipunek-i-finanse.png" alt="Ekwipunek i finanse"><br><sub><b>Ekwipunek v0.9.5</b> - pełnoekranowy widok przedmiotów, majątek epoki i stan zamożności bez żargonu.</sub></td>
  </tr>
</table>

## 🚀 Szybki start

> Najprościej: [pobierz gotową paczkę ZIP](https://github.com/InduPhantom-hash/straznik-tajemnic/releases/latest) i uruchom dwuklikiem. Poniżej instrukcja dla deweloperów uruchamiających ze źródeł.

> Wymagania: **Node.js 18+** i darmowy **klucz Gemini** (`https://aistudio.google.com/apikey`).

```bash
# 1. Sklonuj repozytorium
git clone https://github.com/InduPhantom-hash/straznik-tajemnic.git
cd straznik-tajemnic

# 2. Przejdź do katalogu silnika i zainstaluj zależności
cd _tester/_base/.silnik
npm install

# 3. Uruchom serwer deweloperski
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000):
1. **Wklej klucz Gemini** (jeden klucz do czatu, lektora TTS i generowania obrazów).
2. **Wgraj swój PDF** z zasadami d100 - aplikacja utworzy lokalny indeks wektorowy na dysku (`data/rag/`).
3. Wybierz scenariusz, stwórz lub wybierz postać i ruszaj na śledztwo.

Pełna instrukcja: [`SETUP.md`](./SETUP.md). Podręcznik gracza: [`docs/USER_GUIDE.md`](./docs/USER_GUIDE.md). Wytyczne techniczne: [`CONTRIBUTING.md`](./CONTRIBUTING.md).

### macOS - launcher na biurku (opcjonalnie)

```bash
bash desktop/build-app.sh --rebuild
```
Tworzy `Strażnik Tajemnic AI.app` w `~/Applications` oraz alias na Biurku.

## ⚙️ Konfiguracja

Klucz Gemini wklejasz wprost w aplikacji przy pierwszym starcie lub w oknie Ustawień. Jeśli wolisz plik środowiskowy, skopiuj `.env.example` do `.env.local` w katalogu `_tester/_base/.silnik/`. Jedyna wymagana zmienna to `GEMINI_API_KEY`.

## 🏚️ Profile Jakości i Szacowane Koszty

Konfiguracja w panelu **Ustawienia → Profil Jakości** (sesja ≈ 3h gry, domyślnie **HIGH**):

| Profil | Model czatu | Lektor (TTS) | Ilustracje scen | Szacowany koszt sesji 3h |
|---|---|---|---|---|
| **LOW** | Gemini Flash-Lite | brak | wyłączone | ~$0.02 - $0.05 USD |
| **MID** | Gemini Flash | Gemini TTS (Charon) | Gemini Image | ~$0.15 - $0.20 USD |
| **HIGH** ⭐ *(Domyślny)* | **Gemini 3.8 Flash (High)** | **Gemini TTS (Charon)** | **Gemini Image** | **~$0.40 - $0.50 USD** |
| **ULTRA** | Gemini 3.1 Pro (High) | Multi-voice słuchowisko | Gemini Image HD | ~$1.00 - $1.50 USD |

*Jeden klucz Google AI Studio: Wszystkie komponenty (czat, lektor TTS, obrazy i embeddingi) działają w oparciu o to samo konto Google. Panel Ustawień na żywo zlicza zużyte tokeny i szacuje koszty sesji.*

## 🖥️ Wymagania sprzętowe

| Komponent | Wymagania minimalne | Wymagania rekomendowane |
|---|---|---|
| **System operacyjny** | macOS 12+ / Windows 10 (64-bit) / Ubuntu 22.04+ | macOS 14+ / Windows 11 (64-bit) |
| **Procesor (CPU)** | Intel Core i3 / AMD Ryzen 3 (4 rdzenie, 2.0 GHz) z AVX2 | Apple Silicon (M1+) lub Intel Core i5 / Ryzen 5 (6+ rdzeni) |
| **Pamięć RAM** | 8 GB RAM (aplikacja zużywa ~450 MB w szczycie) | 16 GB RAM |
| **Karta graficzna (GPU)** | Zintegrowana (Intel UHD 620 / AMD Vega) | Zintegrowana Apple GPU lub dedykowana GTX 1050+ |
| **Dysk** | 1.5 GB wolnego miejsca (SSD) | 2.0 GB wolnego miejsca (NVMe SSD) |
| **Lokalny Silnik Decyzji** | Wbudowany mikromodel CPU (zero konfiguracji, <30 ms) | Wbudowany mikromodel CPU z akceleracją sprzętową (<5 ms) |
| **Połączenie sieciowe** | Wymagane wyłącznie do zapytań Gemini API (BYOK) | Szerokopasmowe połączenie internetowe |

*Aplikacja posiada wbudowany bezpiecznik sprzętowy (timeout 100 ms): na starszych maszynach silnik automatycznie przełącza się na natywne heurystyki TypeScript bez żadnego opóźnienia w interfejsie.*

## 🗺️ Rozwój projektu

- **Szlif kluczowych fundamentów:** Dalsza ewolucja Kompendium Badacza, Ekwipunku i Dziennika Śledztwa - w wersji v0.9.5 zyskały one właściwy kierunek architektoniczny, lecz pozostają w fazie aktywnego szlifowania UX i dojrzałości.
- **Paczka desktopowa i aktualizacje:** Dalsza stabilizacja środowiska uruchomieniowego Windows (Zero-Setup) i macOS oraz bezpieczny mechanizm sprawdzania nowych wydań.
- **Scenariusze i społeczność:** Przygotowanie narzędzi do wygodnego importu i edycji własnych śledztw społeczności.

Zasady architektury, inwarianty inżynieryjne i dev cheat-sheet znajdziesz w [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## 🔧 Technologie

Next.js 16 (App Router) · React 19 + TypeScript (strict) · Tailwind + shadcn/ui (Dark Art Déco 1920s) · Google Gemini API (BYOK) · lokalny RAG (Float32 binarny, podobieństwo cosinusowe) · Jest + Playwright.

## 🧪 Program Beta i Zgłaszanie Uwag

Bierzesz udział w testach wersji Beta Strażnika Tajemnic AI? Wszelkie uwagi, spostrzeżenia do mechaniki d100, błędy audio czy sugestie możesz przekazywać na kilka wygodnych sposobów:
1. **W aplikacji:** Kliknij **"Zgłoś uwagę lub błąd"** w menu bocznym (Pomoce Badacza) lub na ekranie powitalnym. Modal pozwala wysłać e-mail jednym kliknięciem, skopiować gotowy szablon Markdown pod GitHub Issue lub pobrać plik JSON z danymi diagnostycznymi.
2. **Dedykowany e-mail:** Wyślij swoje spostrzeżenia bezpośrednio na adres: `issue@callofchtulhu.pl`.
3. **GitHub Issues:** Otwórz zgłoszenie w oficjalnym rejestrze błędów [GitHub Issues](https://github.com/InduPhantom-hash/straznik-tajemnic/issues).

## 📚 Dokumentacja

| Dokument | Dla kogo |
| --- | --- |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | **Programista** - topologia kodu, inwarianty i developer cheat sheet |
| [`SETUP.md`](./SETUP.md) | **Instalacja** - przewodnik uruchomienia aplikacji krok po kroku |
| [`docs/USER_GUIDE.md`](./docs/USER_GUIDE.md) | **Gracz** - jak grać, rzuty k100, Faza Rozwoju i Dziennik |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | **Architektura** - silnik offline, lokalny RAG i granice sieci |
| [`docs/DESIGN-SYSTEM-ART-DECO.md`](./docs/DESIGN-SYSTEM-ART-DECO.md) | **UI/UX** - specyfikacja tokenów Dark Art Déco 1920s |
| [`docs/KOMPENDIUM_NARRACJI_I_IMMERSJI.md`](./docs/KOMPENDIUM_NARRACJI_I_IMMERSJI.md) | **Narracja** - proza Lovecrafta, kognitywistyka i 4 Biegi Kadencji |
| [`docs/PROJECT-WORKFLOW.md`](./docs/PROJECT-WORKFLOW.md) | **Workflow** - zasady pracy nad kodem i zadaniami |
| [`docs/TESTING.md`](./docs/TESTING.md) | **QA** - procedury testowe i weryfikacja automatyczna |
| [`NOTICE`](./NOTICE) | Status prawny, znaki towarowe i licencje |

## 📄 Licencja

Kod: **MIT** (patrz [`LICENSE`](./LICENSE)). Projekt fanowski i niekomercyjny. Silnik nie zawiera żadnych podręczników ani zastrzeżonych treści.

---

# 🇺🇸 Keeper of Arcane Lore AI (v0.9.6)

Run your d100 investigative weird fiction RPG sessions solo or with a friend on a single laptop (Hot Seat). You provide your own Gemini API key, upload **your own** rulebook, and saves are stored on your local disk. The app requires no account, subscription, or external databases. Everything runs locally on your machine.

## ⚔️ Why Keeper of Arcane Lore AI instead of a generic ChatGPT prompt?

Trying to run a tabletop RPG with a standard chat prompt quickly hits a wall: generic AI models fabricate dice rolls, forget uncovered clues after a few turns, and constantly pull punches. **Keeper of Arcane Lore AI** solves this by strictly separating literary prose from hard-coded mechanics:

| Aspect | Generic ChatGPT / Claude Prompt | Dedicated Keeper of Arcane Lore AI |
|---|---|---|
| **Dice Rolls** | Fabricated in chat ("You rolled 14..."), no genuine RNG | 100% deterministic d100 rolls in TypeScript - AI only receives hard outcomes |
| **Investigation Memory** | Loses track of clues, NPC motives, and leads when context fills up | Dedicated Investigation Journal, Act Reports, and live Clue Counter |
| **Rules & Stakes** | Inconsistent rulings, soft consequences, avoids harming characters | Classic d100 mechanics RAW: real wounds, sanity loss, panic, brutal opposed clashes |
| **Knowledge Source** | Generic training data from the public web | Your own rulebook PDF queried via local binary RAG (Float32 vectors) |
| **Privacy & Cost** | Cloud storage, recurring $20/month subscription | 100% local files on your machine, free personal API key (BYOK model) |

## 👥 Who is it for?

There comes a stage in life where gathering a full table for an RPG session is a miracle: schedules clash, people move away, but the hunger for a dark adventure remains. **Keeper of Arcane Lore AI** ensures you don't have to wait. It takes the role of the Game Master, allowing you to experience dark investigations right from your couch.

- **Solo** - play alone whenever you have a free evening. The AI leads the narrative, enforces the rules, and remembers your choices throughout the campaign.
- **Coop (Hot Seat)** - one laptop, two players: each has their own character and interface color, and the AI addresses players by name.

## ⬇️ Download

- 🪟 **[Download Windows package (ZIP)](https://github.com/InduPhantom-hash/straznik-tajemnic/releases/download/v0.9.5/straznik-tajemnic-windows.zip)** - standalone Zero-Setup bundle for Windows (extract and run `Graj - Strażnik Tajemnic.cmd`).
- 🍎 **[Download macOS package (ZIP)](https://github.com/InduPhantom-hash/straznik-tajemnic/releases/download/v0.9.5/straznik-tajemnic-macos.zip)** - launch the app on macOS with a double-click.

The packages do not include an API key or rulebook: during the first run, you paste your **own** Gemini key (`https://aistudio.google.com/apikey`) and upload **your** PDF rulebook.

> All release assets and checksums are available on [GitHub Releases](https://github.com/InduPhantom-hash/straznik-tajemnic/releases/tag/v0.9.5).
> Prefer running from source code? Follow the **Quick Start** guide below.

> [!IMPORTANT]
> **Fan project, unofficial (Clean Room BYOB Emulator Doctrine).** Not affiliated with Chaosium Inc. or Black Monk Games.
> The application is **only the emulator engine** (ScummVM / RetroArch model) equipped with a **Two-Factor Session Blocker** (API Key + your own PDF rulebook). It contains no rulebooks or proprietary tables. You play using your **own, legally acquired** copy (free d100 Quick-Start Rules or Keeper Rulebook). _Call of Cthulhu_ is a trademark of Chaosium Inc. Details: [`NOTICE`](./NOTICE).

## ✨ Engine Features

Keeper of Arcane Lore AI marries atmospheric literary storytelling with uncompromising code discipline.

### 🎭 Tabletop Experience (For Players)

- **High-Stakes Investigation (Journal, Act Reports & Clue Counter):** Scene pacing structures adventures into distinct acts. The Journal tracks established findings, the Clue Counter monitors confirmed leads, and the working hypothesis summary can be quoted directly into the action input with a single click (Quote-to-Input). When an investigation stalls, the Idea Roll RAW pushes the plot forward without halting gameplay (Fail-Forward rule).
- **Brutal d100 Melee Combat (Opposed Clashes):** Opposed clash cards (`OpposedMeleeCard`), Dodge vs Counterattack resolution, combat maneuvers, Build modifiers, outnumbered penalties, and Dive for Cover reactions. Combat is deadly, fast, and decisive.
- **Investigator Compendium & Rulebook:** Dark Art Déco reference panel integrated into the sidebar: Mini-Obsidian for d100 rules, Mythos creature lore, and a local semantic search engine for your rulebook.
- **Intentional Equipment & Historical Finances:** Full-screen equipment manager free of technical jargon, deliberate item acquisition (eliminating unwanted auto-looting of notes and documents into bags), living standard and wealth header bar calibrated across 6 canonical eras (`1920s-us`, `1920s-pl`, `prl-1970s`, `1890s-uk`, `modern-pl`, `modern-us`), historical currency tables (including Victorian pounds £/s/d), and deterministic SVG/WebP item graphics.
- **Atmospheric Introduction & Session-Bound Language:** Mature Audience / Content Warning modal featuring H.P. Lovecraft's bilingual epitaph, enlarged session-bound language selection (preventing mid-dialogue bilingual splits), automatic save locale synchronization, and spoiler-free atmospheric dossier generation during session preparation.
- **Dark Art Déco 1920s Visual Design:** Charcoal black, brass, mahogany, aged gold accents, vintage typewriter typography (`Special Elite`, `Cinzel`), and 12 retro vector SVG investigator portraits.
- **Voice (TTS) & Cinematic Scene Illustrations:** Low-latency Game Master streaming narration (Charon / Gacrux voices) and full-frame cinematic 16:9 generation of locations, NPC portraits, and artifacts via `gemini-3.1-flash-image` with lightbox zoom.
- **Session Zero & Tabletop Safety:** Calibration tool to establish narrative boundaries (Lines & Veils), keeping unwanted themes away from the session.
- **Custom Investigators & 30 Predefined Characters:** Mandatory custom character generation in Manual Setup with d100 attribute calculation and skill category filters, alongside instant session starts with pre-generated investigators in Quick Adventure.
- **Session Chronicle Auto-Save:** Reliable end-of-session archival procedure with automatic game state commits and a 3-state feedback card (saving, archived, retry).

### ⚙️ Under the Hood (Architecture)

- **Deterministic d100 Mathematics in TypeScript:** The AI **never rolls dice in the chat prompt**. Skill checks, success threshold calculations (Regular, Hard, Extreme, Critical, Fumble), Sanity (SAN) tests, and Character Development Phase progressions are 100% computed in TypeScript. The LLM receives immutable results and strictly narrates outcomes.
- **7 Dynamic World Engines (World Engine Director):** Modular prompt runtime injecting deep world simulation: `NPCEngine` (facade, flaw, resistance), `SensoryEngine` (sensory triad, somatics, void variable), `NarrativeGraphEngine` (branch-and-bottleneck structure), `PlotFrictionEngine` (70/30 rumors, social friction), `MysteryClueEngine` (3-clue rule, fail-forward), `GeographyEngine` (chokepoints, underworld hydrology), and `OccultEngine` (Sanderson's occult laws, somatic cost).
- **16 Narrative Techniques & Scene Pacing Director:** Canonical suite of narrative staging techniques (tension, sensory grounding, cosmic void, investigative pacing) dynamically rotated on the CPU with cooldown locks to eliminate repetitive prose.
- **Local CPU Micro-Model & Era Guardrail (0 Tokens, <30 ms):** Embedded CPU dispatch classifier orchestrating world engines and trimming system prompts by >35% in calm turns, paired with a local guardrail (`era-guardrail.ts`) deflecting rules inquiries and modern anachronisms in <1 ms without API token usage.
- **Local Rulebook RAG:** The app parses **your** PDF, builds a local binary vector index (`Float32`) on disk, and injects exact rule excerpts into context on demand. The AI never invents rules or stat blocks.
- **Standalone Desktop Launcher & 100% Offline Mode:** Pure Node.js Desktop Process Supervisor (eliminates zombie processes via cascading `tree-kill`, dynamic port fallback, Single Instance enforcement) and 100% self-hosted WOFF2 fonts (zero external network CDN calls).

## 📸 Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/assets/screenshots/01-menu-glowne.png" alt="Main menu"><br><sub><b>Main menu v0.9.5</b> - styled selection of Solo mode, Hot Seat, custom scenarios, and Session Zero in Dark Art Déco.</sub></td>
    <td width="50%"><img src="docs/assets/screenshots/02-pierwsze-uruchomienie.png" alt="First run setup"><br><sub><b>First run setup</b> - secure Gemini API key input and personal PDF rulebook indexing (BYOB).</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/screenshots/03-sesja-zero-linie-zaslony.png" alt="Session Zero"><br><sub><b>Session Zero</b> - narrative boundaries calibration and content filtering (Lines & Veils).</sub></td>
    <td width="50%"><img src="docs/assets/screenshots/04-scena-i-narracja-lovecrafta.png" alt="Gameplay screen"><br><sub><b>Investigation screen</b> - 16:9 scene illustration, cosmic dread narrative, Journal, and Investigator tools.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/screenshots/05-karta-postaci.png" alt="Investigator sheet"><br><sub><b>Investigator sheet</b> - d100 statistics, Development Phase, 12 retro SVG portraits, and skill filters.</sub></td>
    <td width="50%"><img src="docs/assets/screenshots/06-ekwipunek-i-finanse.png" alt="Equipment and finances"><br><sub><b>Equipment v0.9.5</b> - full-screen item manager, era wealth status, and living standards free of jargon.</sub></td>
  </tr>
</table>

## 🚀 Quick Start

> Simplest way: [Download the ZIP release](https://github.com/InduPhantom-hash/straznik-tajemnic/releases/latest) and double-click to run. Below are instructions for developers running from source.

> Requirements: **Node.js 18+** and a free **Gemini API key** (`https://aistudio.google.com/apikey`).

```bash
# 1. Clone repository
git clone https://github.com/InduPhantom-hash/straznik-tajemnic.git
cd straznik-tajemnic

# 2. Navigate to the engine directory and install dependencies
cd _tester/_base/.silnik
npm install

# 3. Start development server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**:
1. **Paste your Gemini API key** (one key covers chat, TTS voice, and scene images).
2. **Upload your d100 rulebook PDF** - the app extracts text and builds a local binary vector index (`data/rag/`).
3. Select a scenario, pick or create an investigator, and begin playing.

Full documentation: [`SETUP.md`](./SETUP.md), [`docs/USER_GUIDE.md`](./docs/USER_GUIDE.md), and [`CONTRIBUTING.md`](./CONTRIBUTING.md).

### macOS - desktop launcher (optional)

```bash
bash desktop/build-app.sh --rebuild
```
Creates `Strażnik Tajemnic AI.app` in your `~/Applications` folder.

## ⚙️ Configuration

Paste your Gemini key directly in the app upon first launch or in the Settings modal. To use environment variables, copy `.env.example` to `.env.local` inside `_tester/_base/.silnik/`. The only required variable is `GEMINI_API_KEY`.

## 🏚️ Quality Profiles & Estimated Costs

Direct reflection of settings in **Settings → Quality Profile** (session ≈ 3h gameplay, default is **HIGH**):

| Profile | Chat Model | TTS Voice | Scene Illustrations | Est. 3h Session Cost |
|---|---|---|---|---|
| **LOW** | Gemini Flash-Lite | None | Disabled | ~$0.02 - $0.05 USD |
| **MID** | Gemini Flash | Gemini TTS (Charon) | Gemini Image | ~$0.15 - $0.20 USD |
| **HIGH** ⭐ *(Default)* | **Gemini 3.8 Flash (High)** | **Gemini TTS (Charon)** | **Gemini Image** | **~$0.40 - $0.50 USD** |
| **ULTRA** | Gemini 3.1 Pro (High) | Multi-voice radio drama | Gemini Image HD | ~$1.00 - $1.50 USD |

*Single Google AI Studio Key: All capabilities (chat, voice TTS, scene generation, and vector embeddings) operate under your single Google API key. The Settings panel tracks token consumption and estimated session costs live.*

## 🖥️ System Requirements

| Component | Minimum Requirements | Recommended Requirements |
|---|---|---|
| **Operating System** | macOS 12+ / Windows 10 (64-bit) / Ubuntu 22.04+ | macOS 14+ / Windows 11 (64-bit) |
| **Processor (CPU)** | Intel Core i3 / AMD Ryzen 3 (4 cores, 2.0 GHz) with AVX2 | Apple Silicon (M1+) or Intel Core i5 / Ryzen 5 (6+ cores) |
| **RAM** | 8 GB RAM (app uses ~450 MB peak) | 16 GB RAM |
| **Graphics (GPU)** | Integrated (Intel UHD 620 / AMD Vega) | Integrated Apple GPU or dedicated GTX 1050+ |
| **Storage** | 1.5 GB available space (SSD) | 2.0 GB available space (NVMe SSD) |
| **Local Decision Engine** | Embedded CPU micro-model (zero config, <30 ms) | Embedded CPU micro-model with hardware acceleration (<5 ms) |
| **Network** | Required only for Gemini narration API (BYOK) | Broadband Internet connection |

*The app features an integrated hardware circuit breaker (100 ms timeout): on older systems, the engine automatically falls back to native TypeScript heuristics without UI stutter.*

## 🗺️ Roadmap

- **Polishing Core Pillars:** Continuous evolution of the Investigator Compendium, Equipment, and Investigation Journal - in v0.9.5 they gained their proper architectural foundation, but remain under active UX refinement and development.
- **Desktop Packaging & Updates:** Further hardening of the Windows (Zero-Setup) and macOS standalone runtimes and a safe release update checker.
- **Community Scenarios:** Tooling for streamlined import and editing of custom community investigations.

System architecture, invariants, and developer guidelines are documented in [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## 🔧 Technologies

Next.js 16 (App Router) · React 19 + TypeScript (strict) · Tailwind + shadcn/ui (Dark Art Déco 1920s) · Google Gemini API (BYOK) · Local vector DB (Float32 binary, cosine similarity) · Jest + Playwright.

## 🧪 Beta Program & Feedback Reporting

Participating in the Beta testing of Keeper of Arcane Lore AI? You can report d100 mechanics observations, audio anomalies, and feature requests in several convenient ways:
1. **In-app:** Click **"Report Issue or Feedback"** in the sidebar (Investigator Tools) or welcome dialog. The modal lets you dispatch an email with one click, copy a structured Markdown report for a GitHub Issue, or download a diagnostic JSON package.
2. **Dedicated Email:** Send findings and session dumps directly to: `issue@callofchtulhu.pl`.
3. **GitHub Issues:** Submit an issue in the official [GitHub Issues](https://github.com/InduPhantom-hash/straznik-tajemnic/issues) tracker.

## 📚 Documentation

| Document | Audience |
| --- | --- |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | **Developer** - System architecture, invariants, and cheat sheet |
| [`SETUP.md`](./SETUP.md) | **Setup** - Step-by-step installation instructions |
| [`docs/USER_GUIDE.md`](./docs/USER_GUIDE.md) | **Player** - Gameplay manual, checks, Development Phase, and Journal |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | **Architecture** - Offline engine, RAG pipeline, and network boundary |
| [`docs/DESIGN-SYSTEM-ART-DECO.md`](./docs/DESIGN-SYSTEM-ART-DECO.md) | **UI/UX** - 1920s Dark Art Déco design tokens |
| [`docs/KOMPENDIUM_NARRACJI_I_IMMERSJI.md`](./docs/KOMPENDIUM_NARRACJI_I_IMMERSJI.md) | **Narrative** - Lovecraftian storytelling, cognitive pacing, and 4 Cadence Gears |
| [`docs/PROJECT-WORKFLOW.md`](./docs/PROJECT-WORKFLOW.md) | **Workflow** - Repository conventions and workflow |
| [`docs/TESTING.md`](./docs/TESTING.md) | **QA** - Testing guidelines and automated checks |
| [`NOTICE`](./NOTICE) | Legal status, trademarks, and disclaimers |

## 📄 License

Code: **MIT** (see [`LICENSE`](./LICENSE)). Non-commercial fan project. The engine contains no rulebooks or proprietary content.

---

<div align="center"><sub>Created by Phantom · fan-made, non-profit project</sub></div>
