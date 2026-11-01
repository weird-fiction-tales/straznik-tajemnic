# Podgląd początku z perspektywy gracza

`renderPlayerOpening` z `scripts/gm-prep/player-opening-render.mjs` tworzy lokalny, interaktywny podgląd przygotowanych scen. Pokazuje rolę bohatera, narrację, obrazy, nagrania, decyzje i dziennik. Nie wczytuje technicznych rekordów ani rejestru akceptacji. Ma jawne oznaczenie próby przygotowanych wyborów; nie zastępuje sesji z modelem, mechaniką i zapisem kampanii.

Treść adaptacji i media pozostają w prywatnym katalogu poza `public/`, na przykład w ignorowanym `test-results/two-quicksetup/player-opening/`. Dane można później wykorzystać do integracji z właściwym startem, ale sam podgląd nie podłącza ich do Quick Setup.

## Dane i media

Wejście zawiera `role`, `initial_scene`, `scenes` i `journal_entries`. Scena określa tytuł, narratora, akapity tekstu, względne ścieżki obrazu/audio oraz wybory prowadzące do innych scen. Opcjonalny handout ma przód, czytelny opis odwrotu i osobne nagranie odwrotu. Renderer wybiera tylko pola przeznaczone dla gracza; metadane źródeł i sekrety nie należą do danych gracza.

Nagranie musi odpowiadać tekstowi aktualnej sceny. Obrót handoutu zatrzymuje poprzednie audio. Brak nagrania odwrotu nie może odtwarzać niepasującego nagrania przodu. Audio uruchamia gracz; podgląd nie wymusza autoplay. Obecność plików nie jest zgodą autora na ich jakość.

Dziennik zbiera unikalne informacje wskazane w wyborach. Cały stan pozostaje w pamięci strony; restart resetuje wyłącznie tę próbę. Podgląd nie zapisuje lokalnych kampanii, zgód autora ani stanu aplikacji.

## Przygotowanie prywatnego pliku

```js
import fs from 'node:fs';
import { renderPlayerOpening } from './scripts/gm-prep/player-opening-render.mjs';
const story = JSON.parse(fs.readFileSync('/prywatny/katalog/story.json', 'utf8'));
fs.writeFileSync('/prywatny/katalog/index.html', renderPlayerOpening({ story, mediaBase: 'assets/' }));
```

Obok HTML umieść folder `assets/` ze wszystkimi wskazanymi obrazami i nagraniami. Zachowaj teksty nagrań i pochodzenie obrazów poza danymi osadzonymi dla gracza. Generowane sceny historyczne są ilustracjami fikcji, nie autentycznym archiwum.

## Weryfikacja

`node --test scripts/gm-prep/player-opening-render.test.mjs scripts/gm-prep/player-opening-browser.test.mjs`

Przed przekazaniem konkretnej próby trzeba dodatkowo otworzyć jej rzeczywisty HTML, sprawdzić wszystkie obrazy i odtwarzanie rzeczywistych nagrań, przejść każdą dostępną drogę, obejrzeć handout z obu stron oraz sprawdzić restart, błędy konsoli, fokus i przewijanie. Testy syntetyczne renderera nie zastępują tej kontroli. Odbiór treści i pełnej aplikacji pozostaje osobnym etapem.
