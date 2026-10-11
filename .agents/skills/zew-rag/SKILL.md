---
name: zew-rag
description: "Lokalny asystent przeszukiwania i analizy wiedzy RPG Call of Cthulhu (/Volumes/Karta/Zew - materiały). Używa w 100% lokalnego modelu bge-m3 oraz binarnego indeksu wektorowego (.bin). Zwraca precyzyjne cytaty ze źródeł, numery stron i wierszy z podziałem na 5 namespaces: rules, craft, actual-play, worldbuilding, adventures."
---

# zew-rag - Lokalny RAG Materiałów Call of Cthulhu & RPG

Ten skill pozwala odpytywać bazę ponad 5000 transkrypcji wideo, poradników MG, podręczników RAW i scenariuszy znajdujących się na dysku `/Volumes/Karta/Zew - materiały/`.

Działa w 100% lokalnie i offline, korzystając z wielojęzycznego modelu `Xenova/bge-m3` (1024-dim) i binarnego formatu `Float32Array` (.bin).

---

## 5 Dostępnych Obszarów (Namespaces)

1. `rules` - Oficjalne podręczniki, mechanika RAW, tabele, rzuty, poczytalność, walka i pościgi.
2. `craft` - Warsztat Mistrza Gry, scenopisarstwo i techniki narracyjne (Seth Skorkowsky, HowtobeaGreatGM, Poradniki MG, Narratologia, ThePlottery).
3. `actual-play` - Transkrypcje rzeczywistych sesji RPG (RzucajNieGadaj, LansMacabre, IntoTheDarkness, GospodaRPG).
4. `worldbuilding` - Wiedza o świecie, bazy NPC, intrygi, WorldAnvil, astronomia, H.P. Lovecraft lore.
5. `adventures` - Gotowe scenariusze, antologie, kampanie i materiały Pulp Cthulhu.

---

## Jak Używać

### 1. Przez Narzędzie MCP (W czacie)

Gdy odpowiadasz na pytanie o reguły, techniki prowadzenia lub analizujesz scenariusz, wywołaj:
```json
zew_search({
  "query": "jak prowadzić pościgi piesze i samochodowe",
  "namespace": "craft",
  "top_k": 5
})
```

Aby sprawdzić stan indeksu:
```json
zew_namespaces({})
```

Aby podejrzeć pełny plik źródłowy:
```json
zew_get_file({
  "rel_path": "Poradniki MG/01-pościgi.md"
})
```

### 2. Przez Wiersz Poleceń (Terminal / CLI)

Z poziomu repozytorium:
```bash
# Wyszukiwanie semantyczne
node scripts/zew-rag/cli.mjs search "Zasady testu poczytalności i załamania nerwowego" --namespace rules --k 5

# Statystyki zindeksowanych wektorów
node scripts/zew-rag/cli.mjs stats

# Przeindeksowanie wybranego namespace
node scripts/zew-rag/cli.mjs index --namespace craft
```

---

## Inwarianty Pracy z Zew-RAG

1. **Cytat przed Tezą:** Każda zasada RPG lub technika MG cytowana w odpowiedzi musi zawierać link do pliku źródłowego `file:///Volumes/Karta/Zew%20-%20materia%C5%82y/...` oraz numer wiersza lub strony.
2. **Filtr Szumu:** Używaj precyzyjnego namespace'u (`rules` dla mechaniki, `craft` dla technik, `adventures` dla fabuły), aby uniknąć mieszania transkrypcji sesji z zasadami podręcznika.
3. **Zasada Ponytail:** W projektach RPG (np. Strażnik Tajemnic, Cyfrowy Demon Ruchu) przed modyfikacją kodu mechaniki zawsze najpierw odpytaj `zew_search`, aby upewnić się, że kod wiernie realizuje kanon.
