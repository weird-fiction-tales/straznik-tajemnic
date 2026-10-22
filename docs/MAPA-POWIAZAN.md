# Mapa powiązań runtime

Stan na 2026-09-01. Mapa opisuje faktyczny runtime w `_tester/_base/.silnik`.
Root `docs/` jest źródłem prawdy dokumentacji. `navigation/navigation-registry.json`
jest źródłem prawdy nawigacji. Istniejący graf Graft jest materiałem pomocniczym,
nie dowodem aktualnego przebiegu runtime.

## Główny przepływ gry

```mermaid
flowchart LR
    Welcome[Welcome i onboarding] --> Setup[Wybór przygody i setup]
    Setup --> Era[ResolvedEraContext]
    Setup --> Characters[Postacie i Hot Seat]
    Era --> Preflight[Preflight świata]
    Characters --> Preflight
    PDF[PDF przygody i zasad] --> RAG[Lokalny RAG]
    RAG --> Preflight
    Preflight --> Save[WorldSetupBundleV1 i FullGameSave]
    Save --> Chat[Pipeline narracji]
    RAG --> Chat
    Chat --> Mechanics[Mechanika w kodzie]
    Chat --> Journal[Dziennik i Tablica Badacza]
    Chat --> Images[VisualSceneSpec i obrazy]
    Chat --> TTS[TTS]
    Mechanics --> Save
    Journal --> Save
    Images --> Save
```

## Kontrakty między systemami

| Producent | Kontrakt | Konsument | Trwałość |
|---|---|---|---|
| Setup epoki | `ResolvedEraContext` | preflight, prompty, ekwipunek, obrazy | `FullGameSave.worldSetup` i stan sesji |
| Manifest epoki | `EraManifestV1` | preflight i centralny kontrakt promptów | wersjonowane dane runtime |
| Analiza przygody i preflight | `WorldSetupBundleV1` | chat, pamięć, save/load | `FullGameSave.worldSetup` |
| Specyfikacja sceny | `VisualSceneSpec` | adapter obrazu i test promptu | cache obrazu i metadata |
| Kreator postaci | `Character` | Hot Seat, karta, mechanika, save | localStorage i `FullGameSave` |
| Katalog ekwipunku | `templateId` i `EquipmentItem` | postać, dziennik, renderer | save i lokalny asset WebP |
| Magia i tomiska d100 Weird Fiction | `CharacterMagicState`, `SpellDefinition`, `TomeDefinition` | silnik magii, karta postaci, save | stan postaci (`Character.magic`) i save |
| Wynik testu | wynik mechaniczny z kodu | narracja i dziennik | wiadomości i save |
| Adjudykacja intencji (Concordia) | `PutativeEvent`, `RealEvent`, `CheckRequirement` | pipeline narracji, prompt MG | wiadomości sesji i prompt dodatkowy |
| Lokalny RAG | trafienia z namespace rules, adventure, mythos, memory | preflight i chat | dane na dysku |
| Rejestr nawigacji | 31 węzłów i 30 akcji | guard, generator mapy, E2E | JSON w runtime |

## Granice odpowiedzialności

- Kod ustala mechanikę, stan gry, dostępność, ceny i wybór wyposażenia.
- AI redaguje narrację i opis, ale nie zmienia po cichu kanonu zapisanego w `WorldSetupBundleV1`.
- Każda ścieżka epoki ma używać `ResolvedEraContext`. Brak roku nie może dawać cichego fallbacku do 1920.
- Research online może działać przed sesją, ale nie podczas gry.
- Katalogowy przedmiot nie uruchamia API obrazu. Brak WebP daje ikonę kategorii.
- Samodzielny runtime nie może zależeć od danych istniejących wyłącznie w wrapperze.
- Dokumentacja systemowa żyje w root `docs/`; kopie runtime są generowane albo usuwane.

## Stan grafu i nawigacji

- `graft/.graph/wiring.json` ma 203 węzły i 377 krawędzi, ale pochodzi z commitu z 2026-08-24 i indeksuje głównie stare skrypty patchujące.
- Polecenie `graft` nie jest dostępne w środowisku, więc grafu nie można dziś odtworzyć ani uznać za żywy gate.
- Rejestr nawigacji ma 11 tras, 18 modali, 2 stany i 30 akcji. Jest sprawdzany przez `navigation:check` oraz `navigation:guard`.
- Faktyczny przepływ należy potwierdzać testami runtime i E2E, nie samym grafem statycznym.

## Lokalne przygotowanie i odbiór teczki

Źródło przygody -> `prepare-quicksetup.mjs` -> prywatny szkic rekordów i manifest mediów -> `scene-review.mjs` -> podgląd `review-scenes.mjs` -> eksport decyzji autora -> walidowany rejestr decyzji -> ponowna kompilacja szkicu. Hash zestawu łączy zgodę z rekordami, warunkami, referencjami, grafem, zasadami i mediami. Ten przepływ przygotowania nie aktywuje samodzielnie teczki w sesji gry. [Instrukcja](adventure-dossiers/GROUPED-REVIEW.md).

Scenariusz + prywatny szkic teczki + inwentaryzacja mediów + opcjonalny początek gracza -> `adventure-map-model.mjs` -> węzły i relacje autora -> prywatna paczka `build-adventure-map.mjs` -> przestrzenny HTML `adventure-map-render.mjs`. Źródłowe sceny, zdarzenia adaptacji, materiały i sekrety zachowują odrębne znaczenie. [Opis mapy](adventure-dossiers/ADVENTURE-MAP.md).
