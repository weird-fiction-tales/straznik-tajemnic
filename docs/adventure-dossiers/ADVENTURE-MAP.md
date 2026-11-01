# Przestrzenna mapa teczki

Mapa HTML służy autorowi do wizualnego sprawdzenia powiązań całej przygody. `adventure-map-model.mjs` łączy scenariusz, szkic teczki, media i opcjonalną adaptację początku. `adventure-map-render.mjs` pokazuje graf w rzeczywistych współrzędnych XYZ z obrotem i projekcją perspektywiczną. Mapa działa lokalnie bez bibliotek z sieci i bez modelu AI.

## Przygotowanie i obsługa

Z katalogu repozytorium uruchom `node scripts/gm-prep/build-adventure-map.mjs`. Domyślna mapa PL trafi do ignorowanego `_tester/_base/.silnik/test-results/two-quicksetup/adventure-map/prabuty/index.html`, obok folderu mediów. HTML i dane autora pozostają poza `public/`.

- Przeciągnij mapę, aby ją obrócić. Kółko lub przyciski zmieniają przybliżenie.
- Kliknij węzeł albo wybierz go z listy. Panel pokazuje opis, media i pogrupowanych sąsiadów.
- „Wejdź w węzeł” ogranicza widok do jego otoczenia. Przegląd scen i widok całej teczki przywracają szerszą mapę.
- Wyszukiwanie i filtr rodzaju pozwalają znaleźć postacie, miejsca, wydarzenia, tropy, przedmioty, media i reguły.
- Przełącznik autora ujawnia węzły z sekretami i pełnymi danymi prowadzącego. Nie przekazuj takiego pliku graczom.
- Pełne fragmenty i źródła pozostają w rozwijanych szczegółach. Mapa nie nadaje zgód autora i nie zmienia danych aplikacji.

## Znaczenie powiązań

Sceny źródłowe pozostają odrębne od zdarzeń przygotowanych do podglądu początku. Wydarzenia adaptacji mają status podglądu, a ich przejścia nie zastępują kanonicznej sieci scen. Bohater podglądu jest odrębny od NPC. Powiązanie materiału z miejscem oznacza skojarzenie zapisane w źródle; nie dowodzi gotowego wyzwalacza ujawnienia w grze.

Handouty są materiałami fabularnymi z odrębnymi węzłami plików obrazu/audio. Bez jawnych reguł nie stają się działającymi przedmiotami ekwipunku. Mapa pokazuje brak ustaleń zabrania, przekazania i zużycia. Obecny plik nie oznacza zaakceptowanej jakości ani działającej integracji.

Każdy rekord teczki ma reprezentację w mapie. Nieprzypisany rekord trafia do jawnego wyjątku; rekord zawierający sekret pozostaje w węźle autora. Pełne pokrycie danych nie dowodzi kompletności treści lub mechaniki.

## Sprawdzenie

Uruchom `node --test scripts/gm-prep/adventure-map-model.test.mjs scripts/gm-prep/adventure-map-render.test.mjs scripts/gm-prep/adventure-map-browser.test.mjs`. Konkretny wygenerowany HTML trzeba dodatkowo sprawdzić na rzeczywistych danych: wszystkie karty, media, obrót, przybliżenie, filtry, fokus i czytelność. Zmiana perspektywy nie zmienia danych ani zgód. Sam podgląd mapy nie integruje teczki z aplikacją.
