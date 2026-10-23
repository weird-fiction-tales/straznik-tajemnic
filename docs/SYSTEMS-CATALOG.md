# Katalog systemów Strażnika Tajemnic

Stan na 2026-09-01. Ten dokument opisuje faktyczny runtime w `_tester/_base/.silnik`.
Dokumentacja w root `docs/` jest źródłem prawdy. Kopie w runtime nie są źródłem prawdy.

## Statusy

- `stable` - ma jedno źródło prawdy i działające bramki.
- `partial` - działa, ale ma rozproszone dane, fallbacki albo niepełne testy.
- `debt` - zawiera aktywny relikt, konflikt źródeł prawdy albo ścieżkę bez właściciela.
- `draft` - fundament istnieje, lecz integracja nie jest skończona.

## Katalog

| System | Odpowiedzialność i wejście | Źródło prawdy i storage | Kod, AI, RAG i fallback | Testy, stan i dług |
|---|---|---|---|---|
| Launcher i build | Uruchomienie Next.js jako aplikacji macOS. `desktop/launcher.sh`, `desktop/build-app.sh`. | Runtime `_tester/_base/.silnik`, dane użytkownika przez `ZEW_DATA_DIR`. | Kod. Health przez `/api/desktop/cold-start`. | Build działa. `partial`: wrapper i runtime mają osobne skrypty desktopowe. |
| Onboarding | Wybór języka, kluczy i pierwszego uruchomienia. `/welcome`, komponenty `onboarding/`. | `language_selected`, ustawienia i flagi w `localStorage`. | Kod, bez RAG. Fallback do PL istnieje w części starych ścieżek. | E2E i18n. `partial`: istnieją równoległe strony lokalizowane i nielokalizowane. |
| Języki | PL i EN w UI i przepływach gry. | `messages/pl.json`, `messages/en.json`, `next-intl`. | Kod i słowniki. | Walidator wiadomości, E2E. `partial`: dwa drzewa routingu zwiększają ryzyko driftu. |
| Klucze API | BYOK dla Gemini i opcjonalnych providerów. Modal `ApiKeysModal`. | `api-keys-service.ts`, `localStorage`, fallback serwerowy do env. | Kod. Nagłówki `X-*-Api-Key`. | Testy storage i endpointów. `debt`: nadal istnieje klucz Pinecone oraz wiele źródeł konfiguracji. |
| PDF | Parsowanie zasad i przygód, tworzenie chunków. UI ustawień PDF i upload przygody. | Lokalny plik wejściowy, `pdf-parser-service`, `pdf/adventure-extractor.ts`. | Kod plus Gemini do analizy i embeddingów. | Testy `ingest-local`. `debt`: równolegle istnieją lokalne, GCS i stare endpointy parse/upload. |
| Lokalny RAG | Indeks zasad, przygód, Mythos i pamięci. | `vector-db/local-vector-store.ts`, `data/rag`, `RAG_DATA_DIR`. | Embedding Gemini, wyszukiwanie cosine i BM25. Brak trafienia ma dać neutralny wynik. | Testy store i retrieval. `debt`: nazwa endpointu Pinecone oraz źródło Mythos wyłącznie w wrapperze. |
| Przygody | Presety i własne scenariusze. Selektor przygody. | `adventures-data.ts`, wygenerowany katalog i `custom-adventures-storage.ts`. | Kod, AI analizuje PDF. IndexedDB primary, localStorage fallback. | Testy storage i E2E. `partial`: kilka endpointów analizujących ten sam materiał. |
| Setup świata | Budowa otwarcia, postaci i kontekstu przygody. | `/api/adventure/setup`, `WorldSetupBundleV1`. Save zawiera opcjonalne `worldSetup`. | Kod waliduje, Gemini przygotowuje treść. | Testy walidacji i save. `draft`: brak pełnego grafu kanonu i retry faz. |
| Epoki | Rok, region, manifest i reguły wizualne. | `ResolvedEraContext`, `src/lib/era`, drafty `EraManifestV1`. | Kod wybiera kontekst, AI dostaje gotowe ograniczenia. | Testy epoki. `draft`: wiele ścieżek nadal ma fallback 1920. |
| Postacie | Presety, kreator, karta i rozwój. | `predefined-characters.ts`, `strefa-11-characters.ts`, `types.ts`. Roster w localStorage, obrazy w IndexedDB. | Kod ustala statystyki, AI może tworzyć opis. | Testy presetów, kreatora, Fazy Rozwoju i save. `stable`: 30 biografii, Faza Rozwoju d100 Weird Fiction wdrożona. |
| Hot Seat | Przypisanie do dwóch graczy i wspólny start. | `src/lib/hot-seat`, `useGameStart`, zapis przypisań w save. | Kod. | Testy przypisań i E2E. `partial`: część stanu przechodzi przez tymczasowe klucze localStorage. |
| Narracja | Streaming MG, kontekst, tagi mechaniczne i kontynuacja. | `/api/chat`, helpery pipeline, domyślny prompt MG. | Gemini opowiada. Kod ustala stan, RAG dostarcza wiedzę. | Liczne testy helperów i E2E. `stable` dla czatu i tagów, 4 Biegi Kadencji. |
| Pamięć rozmowy | Skróty, chunki i retrieval poprzednich scen. | `vector-db/conversation-memory.ts`, local RAG, pola wiadomości w save. | Kod, embeddingi i AI summarization. | Testy streamu i pamięci. `stable` dla zapisu i odczytu scen. |
| Mechanika | Kości, progi, broń, SAN, PŻ i rozwój. | `dice-utils.ts`, `skill-test-resolver.ts`, `combat/`, `economy/`, `development-phase.ts`. | Kod jest właścicielem wyniku. AI tylko opisuje. | Testy jednostkowe. `stable`: rzuty RAW, progi 1/2 i 1/5, testy SAN i Faza Rozwoju w 100% kodowane. |
| Ekwipunek | Zestawy startowe, katalog, mechanika i obrazy. | `equipment-data.ts`, `equipment-catalog.ts`, `predefined-equipment.ts`. | Kod wybiera zestaw. AI nie ustala ceny ani mechaniki. Katalog używa WebP lub ikony. | Testy katalogu, hooka i endpointu. `stable` pod kątem deterministycznego doboru wg profesji. |
| Obrazy | Sceny, NPC, portrety, przedmioty i cache. | `/api/imagen`, `VisualSceneSpec`, `use-media-cache`, IndexedDB. | Gemini Image, Replicate/Vertex jako pozostałe adaptery. Lokalny fallback dla katalogu. | Testy promptów i cache. `partial`: integracja z promptem epoki. |
| TTS | Narrator i głosy NPC. | `useTTS.ts`, provider w `voiceSettings`, endpointy TTS. | Gemini, Google TTS, ElevenLabs. Fallback providera. | Testy hooka i endpointów. `stable` dla Gemini TTS z instant streamingiem. |
| Dziennik | Kronika, odkrycia, encyklopedia i wpisy rzutów. | `session-journal.tsx`, `journal/`, `journal-storage.ts`. | Kod mapuje tagi narracji na wpisy. | Testy mapowania. `stable`: zoptymalizowana pamięć, brak wycieków. |
| Tablica Badacza | Węzły, połączenia, lightbox i trwałość. | `investigator-board.tsx`, `Character.investigatorBoard`. | Kod, obrazy z istniejących wpisów. | Testy UI. `stable`: trwała siatka współrzędnych, powiązania dowodowe, Idea Roll. |
| Save/load | Pełny zapis, migracje, obrazy i restore. | `full-game-save-manager.ts`, `/api/game-save`, `data/saves`, metadata w localStorage. | Kod. Stare save bez `worldSetup` pozostają zgodne. | Testy v0.9.3, v0.9.4 i worldSetup. `stable`. |
| GM Tools | NPC, lokacje, inicjatywa, zdarzenia i synchronizacja. | `gmTools` w AI settings oraz komponenty managerów. | Kod plus AI dla treści NPC i zdarzeń. | Nierówne pokrycie. `partial`. |
| Ustawienia | Modele, jakość, TTS, obrazy, pamięć i koszty. | `src/lib/ai-settings/`, localStorage. | Kod, ustawienia sterują providerami. | Testy storage. `stable`: ujednolicone liczniki tokenów i estymacje kosztów. |
| Koszty | Limity, tokeny i ceny wywołań. | `cost-event-emitter.ts`, `ai-cost-tracker.ts`, `ai-settings/cost-control.ts`. | Kod. | Testy token-counter. `stable`: Dark Art Déco panel i wspólny stan. |
| Telemetria | Metadane wywołań, błędy i opcjonalne statystyki produktu. | `telemetry.ts`, `monitoring.ts`, `posthog.tsx`, opcjonalny Sentry. | Kod, bez treści narracji według kontraktu. | Testy helperów. `stable`: telemetria lokalna domyślna. |
| Nawigacja | Trasy, modale i przejścia. | `navigation/navigation-registry.json`, generowany `docs/NAVIGATION_MAP.md`. | Kod i generator. | `navigation:check`, `navigation:guard`, E2E. `stable`: rejestr 31 węzłów jako SSOT. |
| Pomoc | Instrukcje UI, zasady i onboarding gracza. | `help-modal/`, `app-help-data.ts`, root `docs/USER_GUIDE.md`. | Kod i statyczne treści. | Testy i18n. `stable`: dwujęzyczna pomoc w sidebarze i kompendium. |
| Aktualizacje i backup | Backup danych, wersja i przyszła aktualizacja aplikacji. | `backup.mjs`, launcher, docelowo manifest GitHub Releases. | Kod. | Build i ręczny restore. `draft`: specyfikacja w v0.9.4. |

## Właściciele źródeł prawdy

- Stan mechaniczny i zapis gry: kod TypeScript oraz `FullGameSave`.
- Wiedza z PDF: lokalny RAG na dysku, nie Pinecone ani GCS.
- Epoka: `ResolvedEraContext` i zatwierdzony manifest.
- Nawigacja: `navigation-registry.json`, a mapa Markdown jest generowana.
- Dokumentacja: root `docs/`.
- Assety katalogowe: `public/equipment/catalog` i `equipment-catalog.ts`.


## Odbiór autorski teczek

`draft`: `scripts/gm-prep/prepare-quicksetup.mjs` zachowuje źródła presetów, a `review-scenes.mjs` tworzy prywatny podgląd grup scen. `scene-review.mjs` przypisuje rekordom właścicieli i wiąże decyzje z hashem treści oraz zależności. Oddzielne statusy dotyczą treści, mediów, integracji i próby gry. Szczegóły: [odbiór grupami](adventure-dossiers/GROUPED-REVIEW.md). Zgoda autora nie zastępuje aktywacji teczki w Quick Setup ani testów rozgrywki.

`draft`: osobny [podgląd początku dla gracza](adventure-dossiers/PLAYER-OPENING.md) używa `player-opening-render.mjs`. Przygotowane wybory, media i dziennik działają lokalnie; renderer nie aktywuje teczki ani sesji AI i nie nadaje akceptacji autora.

`draft`: [przestrzenna mapa teczki](adventure-dossiers/ADVENTURE-MAP.md) łączy kanon, rekordy i media przez `adventure-map-model.mjs`; lokalny HTML z `adventure-map-render.mjs` pokazuje powiązania XYZ i pełne karty autora. `build-adventure-map.mjs` kopiuje media do prywatnej paczki. Narzędzie nie aktywuje teczki w grze ani nie nadaje zgód.
