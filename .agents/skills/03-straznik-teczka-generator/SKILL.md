---
name: 03-straznik-teczka-generator
description: "Etap 3 rurociągu przygód Strażnika Tajemnic: Kompilacja kompletnej fizycznej Teczki Przygody w standardzie Wzorce-i-Szablon (meta.json, scenariusz.md, 4-warstwowe NPC z RAW CoC 7e, treść handoutów, stawki forsowania i testy umiejętności z 38 mechanik)."
---

# 03-straznik-teczka-generator - Kompilacja Teczki Przygody (CoC 7e RAW)

Skill przyjmuje ustalenia z `01-straznik-transkrypcja` oraz `02-straznik-rezyseria-graf`, a następnie generuje kompletną, gotową do uruchomienia w aplikacji i na sesji teczkę przygody.

Lokalizacja docelowa teczki:
`/Volumes/Karta/Zew - materiały/Przygody/<slug-przygody>/`

---

## 1. Struktura Teczki Przygody

Teczka musi odzwierciedlać kanoniczny wzorzec projektu (`Wzorce-i-Szablon`):

```text
/Volumes/Karta/Zew - materiały/Przygody/<slug-przygody>/
├── meta.json               # SSOT dla silnika aplikacji Next.js i promptów AI
├── scenariusz.md           # Pełny scenariusz z opisem węzłów, moodboardem i grafem Mermaid
├── npc/                    # Karty postaci niezależnych (tekst + metadane)
│   ├── <npc_id>.json       # RAW statystyki CoC 7e, maska, motywacja, odporność na presję
│   └── <npc_id>.md         # Portret psychologiczny, cytaty, manieryzmy
├── handouty/               # Rekwizyty i dokumenty dla graczy
│   ├── H-01-<nazwa>.md     # Dokładna treść pisma, telegramu, artykułu w realiach epoki
│   └── meta-handouts.json  # Tabela odkrywania (która poszlaka odblokowuje jaki handout)
├── grafy/                  # Schematy powiązań i grafy śledztwa
│   └── sledztwo.mermaid    # Kod źródłowy diagramu relacji i węzłów
├── audio/                  # Wygenerowane pliki MP3 (ElevenLabs lub fallback vintage)
└── video/                  # Wizualia / wideo intro (placeholder)
```

---

## 1.1 Rurociąg Multimedialny Handoutów (Grafika + Audio)

Generator teczki automatycznie tworzy kompletne artefakty:
1. **Generowanie Wizualiów Handoutu (`generate_image`):**
   - Dla każdego rekwizytu (list, telegram, wycinek prasowy, fotografia, bilet) skill natychmiast wywołuje `generate_image`.
   - **Styl wizualny:** ściśle dostosowany do wybranej epoki (np. żółknięty papier czerpany, plamy atramentu, nagłówek z epoki, pieczęcie lakowe, vintage 1920s lub PRL-owski papier maszynowy z lat 70.).
   - Plik zapisywany jest bezpośrednio do `handouty/<id>.webp` lub `handouty/<id>.png`.

2. **Generowanie Audio (ElevenLabs z automatycznym fallbackiem):**
   - Jeśli w środowisku dostępny jest klucz `ELEVENLABS_API_KEY`:
     - Skill od razu generuje plik narracyjny MP3 do `audio/<id>.mp3` z użyciem odpowiedniego głosu (np. chłodny oficer SB, przerażony badacz, chrapliwy starzec z Massachusetts) w oparciu o mechanizm z `scripts/bake-handout-audio.mjs`.
   - Jeśli klucz ElevenLabs nie jest dostępny lub endpoint zwróci błąd:
     - Skill zapisuje kompletny, gotowy tekst i specyfikację głosu (Voice ID, Model, Stability, Text) w pliku `handouty/AUDIO_PROMPTS.md` oraz formuje treść do wklejenia w zadaniu / Issue na GitHubie do późniejszej syntezy.

---

## 2. Standard 4-Warstwowego Modelu NPC (Mechanika 1)

Każda postać w `npc/` oraz w `meta.json` musi posiadać 4 warstwy:
1. **Warstwa Powierzchniowa (Persona):** Jak widzą go inni (ubiór epoki, tik nerwowy, ton głosu, zawód).
2. **Warstwa Relacyjna (Maska & Blokada Uległości - Mechanika 25):** 
   - Postacie w CoC 7e to żywi ludzie, nie automaty do questów. Nie poddają się przy pierwszym teście Perswazji/Zastraszania.
   - Zdefiniuj warunek przełamania nieufności (np. łapówka, przysługa, ujawnienie sekretu loży).
3. **Warstwa Ukryta (Cel i Prawdziwa Motywacja):** Czego naprawdę chce postać? Czego się śmiertelnie boi?
4. **Warstwa Mechaniczna (CoC 7e RAW):**
   - Pełne statystyki: STR, CON, SIZ, DEX, APP, INT, POW, EDU, HP, MP, Sanity (jeśli dotyczy), Krzepa (Build), DB (Damage Bonus).
   - Umiejętności z wartościami Regular / Hard / Extreme (np. Spostrzegawczość 60/30/12).
   - Manewry bojowe i broń epoki (Mechaniki 29-31).

---

## 3. Ścisłe Egzekwowanie 38 Mechanik w Scenariuszu

W pliku `scenariusz.md` każdy węzeł śledztwa musi zawierać:
- **Poszlaki i Wymagania:**
  - `Poszlaka Krytyczna`: Bez rzutu (automatyczna przy przeszukaniu).
  - `Poszlaka Zaawansowana`: Test z konkretnym poziomem (Regularny / Trudny / Ekstremalny).
- **Forsowanie Rzutu (Pushed Roll - Mechanika 15):**
  - Wyjaśnienie, jak gracz może ponowić rzut (dodatkowy czas, ryzyko, użycie łomu).
  - **Stawka Forsowania:** Co się stanie przy porażce forsowanego rzutu (utrata ekwipunku, hałas, rany, tyknięcie Doom Clocka).
- **Testy Poczytalności (SAN - Mechaniki 3 & 19):**
  - Dokładny koszt: np. `SAN 1/1k4` za widok zmasakrowanego ciała, `SAN 1k3/1k10` za kontakt z bytem z Mitów.
  - Zakaz wydawania Szczęścia na testy SAN (Mechanika 19).

---

## 4. Format pliku `meta.json`

Format zgodny z silnikiem gry:

```json
{
  "tytul": "<Tytuł Przygody>",
  "rok_i_miejsce": "<Miesiąc Rok, Miasto, Państwo>",
  "epoka": "1920s-classic",
  "krotki_opis": "<Zwięzły zarys intrygi>",
  "notatki_mg": "<Kluczowe rady, Doom Clock i planting>",
  "poczatkowy_graf": {
    "scena_startowa": "<Nazwa sceny początkowej>",
    "opis_otwarcia": "<Atmosferyczny opis wejścia badaczy>",
    "kroki_setupu": [
      {
        "id": "W-01",
        "nazwa": "<Nazwa węzła>",
        "poszlaki": ["<Poszlaka 1>", "<Poszlaka 2>", "<Poszlaka 3>"],
        "kolejne_sceny": ["<Scena B>", "<Scena C>"]
      }
    ]
  },
  "postacie_npc": [
    {
      "imie": "<Imię i Nazwisko>",
      "rola": "<Rola w scenariuszu>",
      "opis": "<Krótki opis zmysłowy>",
      "motywacja": "<Główny cel>",
      "obrazek": "<plik.png>"
    }
  ]
}
```
