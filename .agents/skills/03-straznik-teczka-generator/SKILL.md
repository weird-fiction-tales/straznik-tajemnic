---
name: 03-straznik-teczka-generator
description: "Etap 3 rurociÄgu przygÃ³d StraÅ¼nika Tajemnic: Kompilacja kompletnej fizycznej Teczki Przygody w standardzie Wzorce-i-Szablon (meta.json, scenariusz.md, 4-warstwowe NPC z RAW CoC 7e, treÅÄ handoutÃ³w, stawki forsowania i testy umiejÄtnoÅci z 38 mechanik)."
---

# 03-straznik-teczka-generator - Kompilacja Teczki Przygody (CoC 7e RAW)

Skill przyjmuje ustalenia z `01-straznik-transkrypcja` oraz `02-straznik-rezyseria-graf`, a nastÄpnie generuje kompletnÄ, gotowÄ do uruchomienia w aplikacji i na sesji teczkÄ przygody.

Lokalizacja docelowa teczki:
`/Volumes/Karta/Zew - materiaÅy/Przygody/<slug-przygody>/`

---

## 1. Struktura Teczki Przygody

Teczka musi odzwierciedlaÄ kanoniczny wzorzec projektu (`Wzorce-i-Szablon`):

```text
/Volumes/Karta/Zew - materiaÅy/Przygody/<slug-przygody>/
âââ meta.json               # SSOT dla silnika aplikacji Next.js i promptÃ³w AI
âââ scenariusz.md           # PeÅny scenariusz z opisem wÄzÅÃ³w, moodboardem i grafem Mermaid
âââ npc/                    # Karty postaci niezaleÅ¼nych (tekst + metadane)
â   âââ <npc_id>.json       # RAW statystyki CoC 7e, maska, motywacja, odpornoÅÄ na presjÄ
â   âââ <npc_id>.md         # Portret psychologiczny, cytaty, manieryzmy
âââ handouty/               # Rekwizyty i dokumenty dla graczy
â   âââ H-01-<nazwa>.md     # DokÅadna treÅÄ pisma, telegramu, artykuÅu w realiach epoki
â   âââ meta-handouts.json  # Tabela odkrywania (ktÃ³ra poszlaka odblokowuje jaki handout)
âââ grafy/                  # Schematy powiÄzaÅ i grafy Åledztwa
â   âââ sledztwo.mermaid    # Kod ÅºrÃ³dÅowy diagramu relacji i wÄzÅÃ³w
âââ audio/                  # Wygenerowane pliki MP3 (ElevenLabs lub fallback vintage)
âââ video/                  # Wizualia / wideo intro (placeholder)
```

---

## 1.1 RurociÄg Multimedialny HandoutÃ³w (Grafika + Audio)

Generator teczki automatycznie tworzy kompletne artefakty:
1. **Generowanie WizualiÃ³w Handoutu (`generate_image`):**
   - Dla kaÅ¼dego rekwizytu (list, telegram, wycinek prasowy, fotografia, bilet) skill natychmiast wywoÅuje `generate_image`.
   - **Styl wizualny:** ÅciÅle dostosowany do wybranej epoki (np. Å¼Ã³ÅkniÄty papier czerpany, plamy atramentu, nagÅÃ³wek z epoki, pieczÄcie lakowe, vintage 1920s lub PRL-owski papier maszynowy z lat 70.).
   - Plik zapisywany jest bezpoÅrednio do `handouty/<id>.webp` lub `handouty/<id>.png`.

2. **Generowanie Audio (ElevenLabs z automatycznym fallbackiem):**
   - JeÅli w Årodowisku dostÄpny jest klucz `ELEVENLABS_API_KEY`:
     - Skill od razu generuje plik narracyjny MP3 do `audio/<id>.mp3` z uÅ¼yciem odpowiedniego gÅosu (np. chÅodny oficer SB, przeraÅ¼ony badacz, chrapliwy starzec z Massachusetts) w oparciu o mechanizm z `scripts/bake-handout-audio.mjs`.
   - JeÅli klucz ElevenLabs nie jest dostÄpny lub endpoint zwrÃ³ci bÅÄd:
     - Skill zapisuje kompletny, gotowy tekst i specyfikacjÄ gÅosu (Voice ID, Model, Stability, Text) w pliku `handouty/AUDIO_PROMPTS.md` oraz formuje treÅÄ do wklejenia w zadaniu / Issue na GitHubie do pÃ³Åºniejszej syntezy.

---

## 2. Standard 4-Warstwowego Modelu NPC (Mechanika 1)

KaÅ¼da postaÄ w `npc/` oraz w `meta.json` musi posiadaÄ 4 warstwy:
1. **Warstwa Powierzchniowa (Persona):** Jak widzÄ go inni (ubiÃ³r epoki, tik nerwowy, ton gÅosu, zawÃ³d).
2. **Warstwa Relacyjna (Maska & Blokada UlegÅoÅci - Mechanika 25):** 
   - Postacie w CoC 7e to Å¼ywi ludzie, nie automaty do questÃ³w. Nie poddajÄ siÄ przy pierwszym teÅcie Perswazji/Zastraszania.
   - Zdefiniuj warunek przeÅamania nieufnoÅci (np. ÅapÃ³wka, przysÅuga, ujawnienie sekretu loÅ¼y).
3. **Warstwa Ukryta (Cel i Prawdziwa Motywacja):** Czego naprawdÄ chce postaÄ? Czego siÄ Åmiertelnie boi?
4. **Warstwa Mechaniczna (CoC 7e RAW):**
   - PeÅne statystyki: STR, CON, SIZ, DEX, APP, INT, POW, EDU, HP, MP, Sanity (jeÅli dotyczy), Krzepa (Build), DB (Damage Bonus).
   - UmiejÄtnoÅci z wartoÅciami Regular / Hard / Extreme (np. SpostrzegawczoÅÄ 60/30/12).
   - Manewry bojowe i broÅ epoki (Mechaniki 29-31).

---

## 3. ÅcisÅe Egzekwowanie 38 Mechanik w Scenariuszu

W pliku `scenariusz.md` kaÅ¼dy wÄzeÅ Åledztwa musi zawieraÄ:
- **Poszlaki i Wymagania:**
  - `Poszlaka Krytyczna`: Bez rzutu (automatyczna przy przeszukaniu).
  - `Poszlaka Zaawansowana`: Test z konkretnym poziomem (Regularny / Trudny / Ekstremalny).
- **Forsowanie Rzutu (Pushed Roll - Mechanika 15):**
  - WyjaÅnienie, jak gracz moÅ¼e ponowiÄ rzut (dodatkowy czas, ryzyko, uÅ¼ycie Åomu).
  - **Stawka Forsowania:** Co siÄ stanie przy poraÅ¼ce forsowanego rzutu (utrata ekwipunku, haÅas, rany, tykniÄcie Doom Clocka).
- **Testy PoczytalnoÅci (SAN - Mechaniki 3 & 19):**
  - DokÅadny koszt: np. `SAN 1/1k4` za widok zmasakrowanego ciaÅa, `SAN 1k3/1k10` za kontakt z bytem z MitÃ³w.
  - Zakaz wydawania SzczÄÅcia na testy SAN (Mechanika 19).

---

## 4. Format pliku `meta.json`

Format zgodny z silnikiem gry:

```json
{
  "tytul": "<TytuÅ Przygody>",
  "rok_i_miejsce": "<MiesiÄc Rok, Miasto, PaÅstwo>",
  "epoka": "1920s-classic",
  "krotki_opis": "<ZwiÄzÅy zarys intrygi>",
  "notatki_mg": "<Kluczowe rady, Doom Clock i planting>",
  "poczatkowy_graf": {
    "scena_startowa": "<Nazwa sceny poczÄtkowej>",
    "opis_otwarcia": "<Atmosferyczny opis wejÅcia badaczy>",
    "kroki_setupu": [
      {
        "id": "W-01",
        "nazwa": "<Nazwa wÄzÅa>",
        "poszlaki": ["<Poszlaka 1>", "<Poszlaka 2>", "<Poszlaka 3>"],
        "kolejne_sceny": ["<Scena B>", "<Scena C>"]
      }
    ]
  },
  "postacie_npc": [
    {
      "imie": "<ImiÄ i Nazwisko>",
      "rola": "<Rola w scenariuszu>",
      "opis": "<KrÃ³tki opis zmysÅowy>",
      "motywacja": "<GÅÃ³wny cel>",
      "obrazek": "<plik.png>"
    }
  ]
}
```
