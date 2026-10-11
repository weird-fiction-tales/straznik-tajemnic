# Mapa nawigacji PL/EN

Źródło: `_tester/_base/.silnik/navigation/navigation-registry.json`. Nie edytuj
ręcznie grafu. Po zmianie rejestru uruchom `npm run navigation:generate` w
`_tester/_base/.silnik`.

`PL / EN` w każdym węźle i na każdej krawędzi oznacza etykiety dwóch wersji
językowych tego samego działania.

```mermaid
graph TD
    home["Strona główna / Home<br/>`/`"]
    welcome["Wybór języka / Language selection<br/>`/welcome`"]
    settings["Ustawienia / Settings<br/>`/settings`"]
    campaigns["Kampanie / Campaigns<br/>`/campaigns`"]
    campaign_new["Nowa kampania / New campaign<br/>`/campaigns/new`"]
    characters["Postacie / Characters<br/>`/characters`"]
    character_new["Nowa postać / New character<br/>`/characters/new`"]
    dice_route["Kości / Dice<br/>`/dice`"]
    prototypes["Prototypy / Prototypes<br/>`/prototypes`"]
    cutscene["Prototyp cutsceny / Cutscene prototype<br/>`/prototypes/cutscene`"]
    sanity_prototype["Prototyp testu poczytalności / Sanity check prototype<br/>`/prototypes/sanity-check`"]
    quick_setup["Szybka przygoda / Quick adventure"]
    manual_setup["Ręczne ustawianie gry / Manual game setup"]
    adventure_selector["Wybór przygody / Adventure selector"]
    adventure_builder["Kreator przygód i pakiet MG / Adventure builder and campaign kit"]
    predefined_characters["Gotowe postacie / Predefined characters"]
    character_wizard["Kreator postaci / Character wizard"]
    hot_seat["Wybór trybu gry / Play mode"]
    session_zero["Sesja Zero (Briefing śledczy) / Session Zero (Investigative Briefing)"]
    loading_screen["Ekran ładowania (Dark Art Déco) / Loading screen (Dark Art Déco)"]
    game["Aktywna sesja / Active session"]
    api_keys["Klucze API / API keys"]
    character_sheet["Karta badacza (Dark Art Déco d100 Weird Fiction) / Investigator sheet (Dark Art Déco d100 Weird Fiction)"]
    equipment["Ekwipunek (Broń, Wyposażenie, Fabularne) / Equipment (Weapons, Gear, Story Items)"]
    equipment_detail["Szczegóły przedmiotu / Equipment detail"]
    journal["Czytnik kroniki przygód i sesji / Reader for adventure and session chronicle"]
    idea_roll_modal["Test Pomysłu d100 Weird Fiction (Idea Roll) / Idea Roll d100 Weird Fiction"]
    dice["Rzuty kośćmi / Dice rolls"]
    gm_tools["Narzędzia MG / GM tools"]
    development["Faza rozwoju / Development phase"]
    save_game["Zapis gry / Save game"]
    load_game["Wczytanie gry / Load game"]
    help["Kompendium Badacza / Investigator's Compendium"]
    new_adventure_confirm["Potwierdzenie nowej przygody / New adventure confirmation"]
    full_reset["Pełny reset / Full reset"]
    reset_settings_confirm["Reset parametrów / Reset settings"]
    rulebook_modal["Podręcznik zasad / Rulebook"]
    chase_card["Pościg narracyjny i tor przeszkód w czacie (Fiction First d100 Weird Fiction) / In-chat narrative chase and hazard track (Fiction First d100 Weird Fiction)"]
    hazard_card["Zagrożenia środowiskowe i trucizny w czacie (d100 Weird Fiction) / In-chat environmental hazards and poisons (d100 Weird Fiction)"]
    sanity_therapy_modal["Terapia i rekonwalescencja psychiczna (d100 Weird Fiction) / Sanity therapy and recovery (d100 Weird Fiction)"]
    medical_care_modal["Rekonwalescencja i opieka medyczna (d100 Weird Fiction) / Convalescence and medical care (d100 Weird Fiction)"]
    opposed_roll_modal["Test przeciwstawny d100 Weird Fiction (Opposed Roll) / Opposed Roll d100 Weird Fiction"]
    roll_test_modal["Tacka testu umiejętności d100 Weird Fiction / d100 Weird Fiction Skill Test Tray"]
    combat_card["Obrona w walce wręcz w czacie (d100 Weird Fiction) / In-chat melee combat defense (d100 Weird Fiction)"]
    spell_card["Rzucanie zaklęć w czacie (d100 Weird Fiction) / In-chat spell casting (d100 Weird Fiction)"]
    tome_card["Badanie tomów w czacie (d100 Weird Fiction) / In-chat tome study (d100 Weird Fiction)"]
    beta_welcome_modal["Status wersji Beta / Beta Version Status"]
    beta_feedback_modal["Zgłoś błąd / uwagę / Report Issue / Feedback"]
    retro_portrait_gallery_modal["Kolekcja rycin noir z lat 20. / 1920s Noir Engravings Collection"]
    game_over_card["Kres postaci i diegetyczny epilog (d100 Weird Fiction) / Investigator end and diegetic epilogue (d100 Weird Fiction)"]
    audio_handout["Handout audio / Audio handout"]

    welcome -->|Polski / Polish| home
    welcome -->|English / English| home
    home -->|Szybka przygoda / Quick adventure| quick_setup
    home -->|Ustaw ręcznie / Set up manually| manual_setup
    home -->|Wczytaj zapis / Load save| load_game
    home -->|Kompendium / Compendium| help
    home -->|Klucze API / API keys| api_keys
    quick_setup -->|Wybierz przygodę / Choose adventure| adventure_selector
    quick_setup -->|Rozpocznij przygodę / Start adventure| home
    adventure_selector -->|Otwórz kreator przygód / Open adventure builder| adventure_builder
    adventure_selector -->|Wybierz postać / Choose character| predefined_characters
    manual_setup -->|Wybierz tryb gry / Choose play mode| hot_seat
    manual_setup -->|Wybierz przygodę / Choose adventure| adventure_selector
    manual_setup -->|Katalog postaci / Character catalog| characters
    manual_setup -->|Stwórz postać / Create character| character_wizard
    predefined_characters -->|Wybierz badacza / Choose investigator| session_zero
    character_wizard -->|Zakończ i zapisz / Finish and save| manual_setup
    hot_seat -->|Rozpocznij tryb / Start mode| session_zero
    session_zero -->|Zatwierdź i przygotuj sesję / Confirm and prepare session| loading_screen
    loading_screen -->|Rozpocznij przygodę (bramka CTA) / Begin adventure (CTA gate)| game
    loading_screen -->|Wróć do wyboru (błąd startu) / Back to selection (start error)| home
    loading_screen -->|Ustawienia API (błąd startu) / API settings (start error)| api_keys
    game -->|Karta postaci / Character sheet| character_sheet
    game -->|Ekwipunek / Equipment| equipment
    equipment -->|Szczegóły przedmiotu / Equipment details| equipment_detail
    game -->|Dziennik / Journal| journal
    journal -->|Zamknij dziennik / Close journal| game
    game -->|Rzuć kośćmi / Roll dice| dice
    game -->|Narzędzia MG / GM tools| gm_tools
    game -->|Faza rozwoju (po sesji) / Development phase (after session)| development
    game -->|Zapisz grę / Save game| save_game
    game -->|Wczytaj grę / Load game| load_game
    game -->|Kompendium Badacza / Investigator's Compendium| help
    game -->|Ustawienia / Settings| settings
    game -->|Nowa przygoda / New adventure| new_adventure_confirm
    settings -->|Pełny reset / Full reset| full_reset
    settings -->|Reset parametrów / Reset settings| reset_settings_confirm
    campaigns -->|Nowa kampania / New campaign| campaign_new
    characters -->|Nowa postać / New character| character_new
    home -->|Wgraj zasady / Upload rules| rulebook_modal
    home -->|Podręcznik zasad / Rulebook| rulebook_modal
    api_keys -->|Dalej do zasad / Continue to rules| rulebook_modal
    rulebook_modal -->|Gotowe, przejdź do gry / Ready, proceed to game| home
    character_sheet -->|Terapia i rekonwalescencja psychiczna / Sanity therapy and recovery| sanity_therapy_modal
    character_sheet -->|Rekonwalescencja i opieka medyczna / Convalescence and medical care| medical_care_modal
    game -->|Obrona w walce wręcz / Melee combat defense| combat_card
    game -->|Rzucanie zaklęcia / Cast spell| spell_card
    game -->|Badanie tomu / Study tome| tome_card
    home -->|Status wersji Beta / Beta Version Status| beta_welcome_modal
    home -->|Zgłoś błąd / uwagę / Report Issue / Feedback| beta_feedback_modal
    beta_welcome_modal -->|Zgłoś uwagę lub błąd / Report Issue or Feedback| beta_feedback_modal
    game -->|Kres postaci i epilog / Investigator end and epilogue| game_over_card
    character_new -->|Wybierz rycinę z epoki / Choose period engraving| retro_portrait_gallery_modal
    game -->|Rzut przeciwstawny / Opposed roll| opposed_roll_modal
    game -->|Rzut na umiejętność / Roll skill test| roll_test_modal
    game -->|Ponów zapis kroniki po błędzie / Retry chronicle save after error| game
    game -->|Oś Pościgu w nagłówku czatu / Chase header tracker| chase_card
    game -->|Odkryj nagranie po zbadaniu nośnika / Discover recording after examining its carrier| audio_handout
    audio_handout -->|Odtwórz lub wstrzymaj nagranie / Play or pause recording| audio_handout
```

## Routy

| URL | PL | EN | E2E |
| --- | --- | --- | --- |
| `/{locale}` | Strona główna | Home | tak |
| `/{locale}/welcome` | Wybór języka | Language selection | tak |
| `/{locale}/settings` | Ustawienia | Settings | tak |
| `/{locale}/campaigns` | Kampanie | Campaigns | tak |
| `/{locale}/campaigns/new` | Nowa kampania | New campaign | tak |
| `/{locale}/characters` | Postacie | Characters | tak |
| `/{locale}/characters/new` | Nowa postać | New character | tak |
| `/{locale}/dice` | Kości | Dice | tak |
| `/{locale}/prototypes` | Prototypy | Prototypes | tak |
| `/{locale}/prototypes/cutscene` | Prototyp cutsceny | Cutscene prototype | tak |
| `/{locale}/prototypes/sanity-check` | Prototyp testu poczytalności | Sanity check prototype | tak |

## Kluczowe akcje

| Z widoku | Akcja PL / EN | Otwiera lub wykonuje | Źródło |
| --- | --- | --- | --- |
| Wybór języka | Polski / Polish | Strona główna | `src/app/welcome/page.tsx` |
| Wybór języka | English / English | Strona główna | `src/app/welcome/page.tsx` |
| Strona główna | Szybka przygoda / Quick adventure | Szybka przygoda | `src/components/chat/welcome/components/start-mode-cards.tsx` |
| Strona główna | Ustaw ręcznie / Set up manually | Ręczne ustawianie gry | `src/components/chat/welcome/components/start-mode-cards.tsx` |
| Strona główna | Wczytaj zapis / Load save | Wczytanie gry | `src/components/chat/welcome/components/bottom-links.tsx` |
| Strona główna | Kompendium / Compendium | Kompendium Badacza | `src/components/chat/welcome/components/bottom-links.tsx` |
| Strona główna | Klucze API / API keys | Klucze API | `src/components/chat/welcome/index.tsx` |
| Szybka przygoda | Wybierz przygodę / Choose adventure | Wybór przygody | `src/components/ui/quick-setup-modal.tsx` |
| Szybka przygoda | Rozpocznij przygodę / Start adventure | Strona główna | `src/components/ui/quick-setup-modal.tsx` |
| Wybór przygody | Otwórz kreator przygód / Open adventure builder | Kreator przygód i pakiet MG | `src/components/ui/adventure-selector.tsx` |
| Wybór przygody | Wybierz postać / Choose character | Gotowe postacie | `src/components/ui/adventure-selector.tsx` |
| Ręczne ustawianie gry | Wybierz tryb gry / Choose play mode | Wybór trybu gry | `src/components/chat/welcome/components/manual-setup-panel.tsx` |
| Ręczne ustawianie gry | Wybierz przygodę / Choose adventure | Wybór przygody | `src/components/chat/welcome/components/manual-setup-panel.tsx` |
| Ręczne ustawianie gry | Katalog postaci / Character catalog | Postacie | `src/components/chat/welcome/components/manual-setup-panel.tsx` |
| Ręczne ustawianie gry | Stwórz postać / Create character | Kreator postaci | `src/components/chat/welcome/components/manual-setup-panel.tsx` |
| Gotowe postacie | Wybierz badacza / Choose investigator | Sesja Zero (Briefing śledczy) | `src/components/ui/predefined-characters-selector.tsx` |
| Kreator postaci | Zakończ i zapisz / Finish and save | Ręczne ustawianie gry | `src/components/ui/character-wizard.tsx` |
| Wybór trybu gry | Rozpocznij tryb / Start mode | Sesja Zero (Briefing śledczy) | `src/components/ui/hot-seat-setup.tsx` |
| Sesja Zero (Briefing śledczy) | Zatwierdź i przygotuj sesję / Confirm and prepare session | Ekran ładowania (Dark Art Déco) | `src/components/ui/session-zero-modal.tsx` |
| Ekran ładowania (Dark Art Déco) | Rozpocznij przygodę (bramka CTA) / Begin adventure (CTA gate) | Aktywna sesja | `src/components/chat/chat-window/components/tts-hard-loading-screen.tsx` |
| Ekran ładowania (Dark Art Déco) | Wróć do wyboru (błąd startu) / Back to selection (start error) | Strona główna | `src/components/chat/chat-window/components/tts-hard-loading-screen.tsx` |
| Ekran ładowania (Dark Art Déco) | Ustawienia API (błąd startu) / API settings (start error) | Klucze API | `src/components/chat/chat-window/components/tts-hard-loading-screen.tsx` |
| Aktywna sesja | Karta postaci / Character sheet | Karta badacza (Dark Art Déco d100 Weird Fiction) | `src/components/sidebar/CthulhuSidebar.tsx` |
| Aktywna sesja | Ekwipunek / Equipment | Ekwipunek (Broń, Wyposażenie, Fabularne) | `src/components/sidebar/CthulhuSidebar.tsx` |
| Ekwipunek (Broń, Wyposażenie, Fabularne) | Szczegóły przedmiotu / Equipment details | Szczegóły przedmiotu | `src/components/ui/equipment-detail-dialog.tsx` |
| Aktywna sesja | Dziennik / Journal | Czytnik kroniki przygód i sesji | `src/components/sidebar/CthulhuSidebar.tsx` |
| Czytnik kroniki przygód i sesji | Zamknij dziennik / Close journal | Aktywna sesja | `src/components/ui/session-journal.tsx` |
| Aktywna sesja | Rzuć kośćmi / Roll dice | Rzuty kośćmi | `src/components/sidebar/CthulhuSidebar.tsx` |
| Aktywna sesja | Narzędzia MG / GM tools | Narzędzia MG | `src/components/sidebar/CthulhuSidebar.tsx` |
| Aktywna sesja | Faza rozwoju (po sesji) / Development phase (after session) | Faza rozwoju | `src/components/sidebar/CthulhuSidebar.tsx` |
| Aktywna sesja | Zapisz grę / Save game | Zapis gry | `src/components/sidebar/CthulhuSidebar.tsx` |
| Aktywna sesja | Wczytaj grę / Load game | Wczytanie gry | `src/components/desk/DeskTools.tsx` |
| Aktywna sesja | Kompendium Badacza / Investigator's Compendium | Kompendium Badacza | `src/components/compendium-modal/CompendiumModal.tsx` |
| Aktywna sesja | Ustawienia / Settings | Ustawienia | `src/components/sidebar/CthulhuSidebar.tsx` |
| Aktywna sesja | Nowa przygoda / New adventure | Potwierdzenie nowej przygody | `src/components/sidebar/CthulhuSidebar.tsx` |
| Ustawienia | Pełny reset / Full reset | Pełny reset | `src/components/ui/settings-modal.tsx` |
| Ustawienia | Reset parametrów / Reset settings | Reset parametrów | `src/components/ui/settings-modal.tsx` |
| Kampanie | Nowa kampania / New campaign | Nowa kampania | `src/app/[locale]/campaigns/page.tsx` |
| Postacie | Nowa postać / New character | Nowa postać | `src/app/[locale]/characters/page.tsx` |
| Strona główna | Wgraj zasady / Upload rules | Podręcznik zasad | `src/components/chat/welcome/index.tsx` |
| Strona główna | Podręcznik zasad / Rulebook | Podręcznik zasad | `src/components/chat/welcome/components/bottom-links.tsx` |
| Klucze API | Dalej do zasad / Continue to rules | Podręcznik zasad | `src/app/[locale]/page.tsx` |
| Podręcznik zasad | Gotowe, przejdź do gry / Ready, proceed to game | Strona główna | `src/app/[locale]/page.tsx` |
| Karta badacza (Dark Art Déco d100 Weird Fiction) | Terapia i rekonwalescencja psychiczna / Sanity therapy and recovery | Terapia i rekonwalescencja psychiczna (d100 Weird Fiction) | `src/components/ui/character-sheet/index.tsx` |
| Karta badacza (Dark Art Déco d100 Weird Fiction) | Rekonwalescencja i opieka medyczna / Convalescence and medical care | Rekonwalescencja i opieka medyczna (d100 Weird Fiction) | `src/components/ui/character-sheet/index.tsx` |
| Aktywna sesja | Obrona w walce wręcz / Melee combat defense | Obrona w walce wręcz w czacie (d100 Weird Fiction) | `src/components/chat/chat-window/components/opposed-melee-card.tsx` |
| Aktywna sesja | Rzucanie zaklęcia / Cast spell | Rzucanie zaklęć w czacie (d100 Weird Fiction) | `src/components/chat/chat-window/components/spell-card.tsx` |
| Aktywna sesja | Badanie tomu / Study tome | Badanie tomów w czacie (d100 Weird Fiction) | `src/components/chat/chat-window/components/tome-card.tsx` |
| Strona główna | Status wersji Beta / Beta Version Status | Status wersji Beta | `src/components/sidebar/CthulhuSidebar.tsx` |
| Strona główna | Zgłoś błąd / uwagę / Report Issue / Feedback | Zgłoś błąd / uwagę | `src/components/sidebar/CthulhuSidebar.tsx` |
| Status wersji Beta | Zgłoś uwagę lub błąd / Report Issue or Feedback | Zgłoś błąd / uwagę | `src/components/dialogs/BetaWelcomeModal.tsx` |
| Aktywna sesja | Kres postaci i epilog / Investigator end and epilogue | Kres postaci i diegetyczny epilog (d100 Weird Fiction) | `src/components/chat/chat-window/components/game-over-card.tsx` |
| Nowa postać | Wybierz rycinę z epoki / Choose period engraving | Kolekcja rycin noir z lat 20. | `src/components/ui/character-wizard.tsx` |
| Aktywna sesja | Rzut przeciwstawny / Opposed roll | Test przeciwstawny d100 Weird Fiction (Opposed Roll) | `src/components/dialogs/OpposedRollModal.tsx` |
| Aktywna sesja | Rzut na umiejętność / Roll skill test | Tacka testu umiejętności d100 Weird Fiction | `src/components/dialogs/RollTestModal.tsx` |
| Aktywna sesja | Ponów zapis kroniki po błędzie / Retry chronicle save after error | Aktywna sesja | `src/components/chat/chat-window/components/message-card.tsx` |
| Aktywna sesja | Oś Pościgu w nagłówku czatu / Chase header tracker | Pościg narracyjny i tor przeszkód w czacie (Fiction First d100 Weird Fiction) | `src/components/chat/chat-window/components/chase-header-tracker.tsx` |
| Aktywna sesja | Odkryj nagranie po zbadaniu nośnika / Discover recording after examining its carrier | Handout audio | `src/components/chat/narrative/render-handout.tsx` |
| Handout audio | Odtwórz lub wstrzymaj nagranie / Play or pause recording | Handout audio | `src/components/ui/audio-reel-player.tsx` |

## Zasady aktualizacji

- Każda zmiana routingu, modala lub przycisku prowadzącego do innego widoku
  aktualizuje rejestr, ten dokument i właściwy test E2E.
- `npm run navigation:check` sprawdza strukturę rejestru i zgodność
  wygenerowanego dokumentu.
- CI odrzuca zmianę `src/app` lub `src/components`, gdy pull request nie
  zmienia rejestru nawigacji.
