# Design System Dark Art Déco 1920s

Dokument określa kanon wizualny i zasady stylizacji interfejsu aplikacji **Strażnik Tajemnic AI** (zgodnie z Issue #165).

---

## 1. Filozofia Stylu & Klimat

Interfejs łączy historyczny styl lat 20. XX wieku (złoty wiek Art Déco, drewniane biurka detektywistyczne, mosiężne okucia, pożółkły papier akt śledczych) z mrocznym, kosmicznym horrorem Lovecrafta i mechaniką Call of Cthulhu 7e RAW:

- **Baza kolorystyczna:** Głęboka, ciepła czerń węgla drzewnego (`--background: #0a0c0f`), ciemne mahoniowe i dębowe panele (`--card: #16130f`), przyciemnione pola wejściowe (`--input: #1f1a14`).
- **Akcenty Déco (Mosiądz i Złoto):** Zamiast jaskrawych kolorów nowoczesnych UI stosujemy mosiądz (`--brass: #c9a227`) oraz postarzane złoto (`--gold: #b8860b`).
- **Kolor Marki (Lovecraft Emerald):** Szmaragdowa zieleń Cthulhu (`--primary: #0d9488`) dla kluczowych akcji i aktywnych elementów.
- **Krew i Zagłada (Destructive):** Karminowa, bordowa czerwień (`--destructive: #b3322c`) dla utraty Poczytalności, obrażeń i zagrożeń.

---

## 2. Tokeny Semantyczne (Tailwind)

Każdy komponent interfejsu musi korzystać ze słownika tokenów semantycznych zdefiniowanych w `tailwind.config.ts` i `globals.css`:

| Rola w UI | Dozwolona klasa Tailwind | Zakazana klasa (Modern Flat) |
|---|---|---|
| Tło okna / ekranu | `bg-background` | `bg-slate-900`, `bg-gray-950` |
| Panele, karty, modale | `bg-card`, `text-card-foreground` | `bg-zinc-900`, `bg-stone-900` |
| Pola formularzy, inputy | `bg-input`, `border-brass/30` | `bg-gray-800`, `border-gray-700` |
| Tekst główny | `text-foreground` | `text-white`, `text-gray-100` |
| Tekst drugorzędny / wyciszony | `text-muted-foreground` | `text-gray-400`, `text-slate-400` |
| Ramki i separatory | `border-border`, `border-brass/20` | `border-gray-800`, `border-zinc-700` |
| Akcenty ozdobne i krawędzie | `text-brass`, `border-brass`, `bg-brass/10` | `text-amber-400`, `bg-amber-950` |
| Wyciszony stan zablokowany | `text-muted-foreground`, `border-border/60` | `text-zinc-500`, `border-zinc-800` |
| Status New / Aktywny | `bg-primary text-primary-foreground` | `bg-emerald-500 text-black` |
| Zaokrąglenia rogów | `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-full` | `rounded-xl`, `rounded-2xl`, `rounded-3xl` |

---

## 3. Geometria Art Déco

- **Rogi:** Zakaz miękkich, obłych rogów typowych dla aplikacji mobilnych z 2024 roku (`rounded-2xl`, `rounded-3xl`, `rounded-xl`).
- **Ścięte narożniki:** Klasa `.deco-corners` lub precyzyjne zaokrąglenia geometryczne (`rounded-md`, `rounded-lg`).
- **Ramki:** Podwójne linie, cienkie złote podziały (`border-brass/30`), linie ze zmiennym gradientem (`via-brass/40 to-transparent`).
- **Cienie:** Cienie atmosferyczne i głębokie: `shadow-deco`, `shadow-glow-brass`.

---

## 4. Typografia

1. **Nagłówki i Tytuły Wyświetlacza:** `font-display` (`Cinzel`), `font-display-decorative` (`Cinzel Decorative`).
2. **Klimat Maszynopisu / Dokumentów Śledczych:** `font-special-elite` / `font-mono` (`Special Elite`).
3. **Teksty Księgowe i Powieściowe:** `font-serif` (`Cormorant Garamond`).
4. **Czytelne Etykiety Systemowe:** `font-sans` (`Inter`).

---

## 5. Automatyczna Weryfikacja Linterem

Weryfikacja zgodności z Design Systemem odbywa się za pomocą skryptu:

```bash
# Skan całego projektu:
npm run audit:art-deco

# Skan konkretnego pliku:
node scripts/audit-art-deco.mjs src/components/sidebar/CthulhuSidebar.tsx
```

Skrypt ten jest zintegrowany z bramką jakościową i wyłapuje relikty szarości, nowoczesnych zaokrągleń oraz niespójnych kolorów.


## 6. Standard każdego nowego i przebudowywanego modalu

Ten rozdział jest referencją do odbioru modali. Obowiązuje razem z zasadami powyżej. Wzorzec wizualny: **Karta Badacza** (`_tester/_base/.silnik/src/components/ui/character-sheet/index.tsx`), szczególnie nagłówek, narożniki panelu oraz zielone wyróżnienia w `components/stat-card.tsx` i `components/stat-bars.tsx`.

### Mosiądz i szmaragd mają różne zadania

| Element | Rola koloru | Klasy referencyjne |
|---|---|---|
| Ramka dokumentu, narożniki, romby, ozdobny separator | Mosiądz buduje geometrię Art Deco | `border-brass/30`, `deco-corners`, `deco-separator`, `text-brass` |
| Aktywna zakładka, wybrany wpis lub karta | Szmaragd pokazuje aktualny wybór | `border-primary/50 bg-primary/10 text-foreground` |
| Ikona aktywnego elementu | Szmaragd wzmacnia wybór | `text-primary` |
| Główna akcja lub rozwinięcie treści | Szmaragd wskazuje interakcję | istniejący `Button`, albo `text-primary` dla dyskretnej akcji tekstowej |
| Fokus klawiatury | Szmaragd wskazuje element gotowy do obsługi | `focus-visible:outline-primary` lub `focus-visible:ring-ring` |
| Tekst czytanej treści | Ciepła jasna biel, czytelność | `text-foreground` |
| Źródło, podpis, informacja pomocnicza | Czytelny kolor wyciszony | `text-muted-foreground` |

Nie zastępuj szmaragdu mosiądzem w aktywnych stanach. Nie zamieniaj całego panelu na zielone tło. W modalu informacyjnym bez zakładek zielony akcent może wystąpić w akcji i fokusie; nie dodawaj sztucznej funkcji tylko dla koloru. Wybór musi mieć też ramkę, oznaczenie ikony lub podkreślenie oraz `aria-current`, `aria-selected` albo `aria-expanded` odpowiednie do roli. Kolor nie może być jedynym nośnikiem stanu.

### Konstrukcja

1. Użyj istniejących `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` i `Button`, jeśli obsługują wymagany układ. Szukaj wspólnego wzorca przed pisaniem nowego.
2. Zachowaj bazę `bg-background` / `bg-card`, ramkę mosiężną i lokalne fonty aplikacji. Gradient Karty Badacza od `#14110c` do `#0a0c0f` jest dopuszczonym wzorcem powierzchni dokumentu. Kolory semantyczne odczytuj z `src/app/globals.css` i `tailwind.config.ts`; nie twórz kolejnej palety dla jednego okna.
3. Tytuł modalu: `font-display-decorative`, tytuły kart: `font-display`, krótkie oznaczenia dokumentu: `font-special-elite`, narracja: `font-serif`, nawigacja i instrukcje: `font-sans`. Ozdobny krój stosuj do krótkich nagłówków.
4. Użyj `deco-corners` i `deco-separator` lub istniejących ornamentów Karty Badacza. Ornamenty nie przechwytują kliknięć i nie zasłaniają tekstu. Nie kopiuj całego komponentu Karty Badacza do innego modalu.
5. Zwykły tekst UI: co najmniej 16 px; pomocniczy: co najmniej 14 px; narracja: 18 px i wygodna interlinia. Sprawdzaj rozmiar wynikowy - aplikacja zwiększa `text-xs` i `text-sm`. Nie zmniejszaj podpisów do 9-10 px dla zmieszczenia treści.
6. Tekst zwykły utrzymuje kontrast co najmniej 4,5:1, duży tekst i istotne granice kontrolek co najmniej 3:1. Mały tekst pozostaje czytelny również bez poświaty. Osłabianie krycia tekstu wymaga sprawdzenia kontrastu.
7. Na telefonie nagłówki mogą się zawijać. Treść przewija się wewnątrz panelu, zamknięcie pozostaje dostępne, a poziome przewijanie służy wyłącznie celowo zaprojektowanej nawigacji. Portrety pokazują pełny obraz; kadrowanie innych ilustracji musi pasować do rodzaju materiału.
8. Modal ma dostępną nazwę, pułapkę fokusu, zamknięcie Escape i powrót fokusu do przycisku otwierającego. Nowy modal używa wspólnego dialogu; własna implementacja wymaga dowodu obsługi tych zachowań. Rozwijane opisy używają natywnego `details/summary` lub równoważnej dostępnej kontrolki.
9. Treści, nazwy i etykiety dostępności mają wersję PL i EN. Zachowaj identyfikatory testowe i aktualizuj rejestr nawigacji oraz generowaną mapę.

### Kontrola odbioru

- [ ] Porównaj render z Kartą Badacza: ciemna baza, mosiężna geometria **i szmaragdowe stany aktywne**.
- [ ] Sprawdź w przeglądarce rzeczywisty kolor aktywnego elementu, jego ramkę i fokus. Samo wystąpienie klasy w kodzie nie potwierdza wyglądu.
- [ ] Użyj wspieranych wartości krycia (np. `/10`, `/30`, `/40`, `/50`) lub jawnej składni arbitralnej, np. `/[0.28]`. Nie zakładaj, że `/28` wygeneruje styl w obecnej konfiguracji.
- [ ] Otwórz PL i EN na komputerze i telefonie: brak uciętych tytułów, pełne portrety, czytelne źródła, dostępne zamknięcie.
- [ ] Sprawdź klawiaturę: Tab, Shift+Tab, Escape i przywrócenie fokusu.
- [ ] Zapisz zrzuty widoków i sprawdź je wzrokowo; testuj wybór i rozwinięcie, nie tylko pusty modal.
- [ ] Uruchom audyt Art Deco oraz bramki projektu. Audyt klas nie wykrywa braku zielonych akcentów, błędów kadrowania ani całej dostępności - potrzebny jest też test renderu.

`DESIGN-ELDRITCH-DESK.md` opisuje kierunek rekwizytów i tekstur. Nazwy planowanych tam tokenów nie zastępują tokenów faktycznie dostępnych w kodzie. Przy rozbieżności użyj obecnej palety oraz tego standardu modali; rozszerzenie palety wymaga osobnej, spójnej zmiany systemu.
