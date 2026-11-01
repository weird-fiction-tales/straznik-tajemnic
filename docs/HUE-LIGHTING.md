# Reżyseria światła Hue i Prabuty

Moduł jest opcjonalny. Fizyczny mostek obsługuje lokalny serwer aplikacji, a przeglądarka komunikuje się wyłącznie z `/api/hue`. Odbiór przy lampach i pomiar czasu reakcji stanowią osobną bramkę od testów automatycznych.

## Włączenie

W ustawieniach rozwiń Hue. Wykryj mostek albo podaj jego lokalny adres IPv4 i identyfikator. Parowanie wymaga przycisku na mostku. Dotychczasowy klucz z przeglądarki migruje dopiero po sprawdzeniu go przez HTTPS. Entertainment wymaga dodatkowego klucza klienta; starsze parowanie może wymagać ponowienia.

Wybierz lampy dla spokojnej atmosfery albo strefę Entertainment. Cała strefa uczestniczy w sterowaniu; interfejs pokazuje jej lampy przed zapisaniem ustawień. Domyślnie Hue i błyski są wyłączone. Jasność atmosfery pozostaje w zakresie 10-70%. Akcenty są dostępne po osobnym włączeniu w Entertainment. REST zapewnia spokojne przejścia i nie zastępuje szybkiego strumienia animacji.

Podgląd partytury pozwala wybrać scenę, sprawdzić jej atmosferę i akcenty oraz wyeksportować dane do JSON i druku. Zakończenie podglądu zwalnia lampy. Światło awaryjne zatrzymuje automat i pozostawia ciepłą biel 100% do wznowienia lub zakończenia sesji.

## Partytura i źródło prawdy

`data/adventures/predefined/cien-nad-prabutami.json` przechowuje `nodes[].scenes[]`. Scena zawiera stabilne `sceneId`, `nodeId`, nazwy PL/EN, aliasy oraz `lighting`: tryb, preset, jasność, czas przejścia i akcenty z warunkami uruchomienia i powrotem do bazy. Rejestr obejmuje pięć węzłów Prabut. Modele urządzeń, adresy i klucze nie należą do partytury.

Runtime odczytuje tę samą definicję, a normalizacja grafu zachowuje sceny. Walidator sprawdza kompletność, identyfikatory, odwołania i presety. Starsze przygody bez scen pozostają zgodne.

Eksport z katalogu runtime:

```sh
node scripts/export-prabuty-lighting.mjs <katalog-docelowy>
```

Eksport obejmuje `lighting.json`, `lighting.html` do druku oraz `meta-lighting.json` z projekcją węzłów teczki. Projekcję należy scalać z istniejącą teczką, zachowując jej pozostałe treści. Nie utrzymujemy ręcznie drugiej kopii partytury.

## Przepływ zdarzeń

Parser przyjmuje wyłącznie kompletne i znane `[SCENA:id]` / `[SCENE:id]` oraz `[CUE:id]`. Identyfikator zdarzenia łączy wiadomość i pozycję znacznika. Każdy znacznik wykonuje się najwyżej raz. Autorski akcent musi należeć do bieżącej sceny; wskazanie testu nie oznacza wykonanego strzału ani straty Poczytalności.

`ImmersionCue` łączy zdarzenie, scenę, efekt, wiadomość, kotwicę tekstową i segment lektora. Faktyczny start odtwarzania segmentu uruchamia dźwięk i światło. Zdarzenia mechaniczne wymagają zatwierdzonego wyniku. Spóźnione efekty, Stop i odczyt historii nie odtwarzają starych akcentów. Ukryte znaczniki nie trafiają do prozy ani lektora.

Zapis gry przechowuje scenę i stan pauzy, bez kolejki efektów i danych sprzętu. Wczytanie przywraca atmosferę bez powtarzania zdarzeń.

## Własność i przywracanie

Serwer przechowuje migawkę fizycznego stanu przed pierwszą zmianą. Kolejne żądania tej samej sesji jej nie nadpisują. Dzierżawa chroni przed drugą kartą; brak kontaktu z oknem zwalnia lampy po 10 sekundach. Polecenia zarządzania sesją mają wspólną kolejkę. Nie przejmujemy aktywnej strefy innej aplikacji.

Wyłączenie Hue i zakończenie sesji przywracają włączenie, jasność oraz aktywny sposób ustawienia barwy. Przy błędzie przywracania migawka pozostaje do ponowienia. Po awarii procesu następny start podejmuje odzyskiwanie, z zachowaniem ochrony zajętej strefy. Supervisor wysyła ograniczone czasowo, uwierzytelnione polecenie zwolnienia przed zabiciem serwera. Awaria lamp nie zatrzymuje narracji.

## Transport i dane

HTTPS sprawdza łańcuch Signify CA i zgodność certyfikatu z identyfikatorem mostka. Nie ma globalnego wyłączenia TLS ani podmiany DNS. Stary numer lampy mapuje się przez `id_v1`. Zasoby lamp wyznaczają dostępne funkcje i zakres temperatur. Żądania mają limity czasu; polecenia REST do lamp są ograniczone do ośmiu na sekundę.

Entertainment używa `node-dtls-client@2.0.3`, Node >=22, DTLS 1.2 z `TLS_PSK_WITH_AES_128_GCM_SHA256` i HueStream v2. Strumień wysyła klatki co 20 ms, z rzeczywistymi identyfikatorami kanałów i interpolacją. Utrata strumienia przełącza na spokojną atmosferę. Pierwsza wersja stosuje wspólną barwę do wszystkich kanałów strefy.

Klucze oraz migawka mieszkają w `hardware/hue.json` pod `ZEW_DATA_DIR`, z uprawnieniami pliku 0600. Nie trafiają do odpowiedzi API, save'ów, teczki ani logów. Endpoint sterowania wymaga lokalnego originu. Diagnostyka wykonuje odczyt mostka i rozróżnia zapis konfiguracji od rzeczywistej dostępności.

Certyfikat CA pochodzi z Hue-Sync (Apache-2.0): https://github.com/jdmg94/Hue-Sync/blob/main/signify.pem. Wskazówki producenta: https://developers.meethue.com/new-hue-api/.

## Dowody odbioru

Raport lokalny: `docs/audits/hue-lighting/README.md`. Pełna gotowość sprzętu wymaga pięciu scen, 20 akcentów bez duplikatów, światła awaryjnego, rozłączenia i przywrócenia. Cel różnicy światło/SFX do 150 ms musi potwierdzić nagranie fizycznych lamp; test na atrapach i potwierdzenie połączenia nie zastępują pomiaru.
