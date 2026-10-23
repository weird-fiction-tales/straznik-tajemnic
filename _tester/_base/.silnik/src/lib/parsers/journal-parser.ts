import { JournalTagEntry } from './types';
import type { ClueProvenance, ClueCategory } from '../journal/dossier-types';

/**
 * Wykrywa jawną deklarację proweniencji epistemicznej ze wskazanego segmentu tagu lub tekstu.
 * Obsługuje formaty z prefiksem (np. "źródło:obserwacja", "source:testimony")
 * oraz bezpośrednie słowa kluczowe w języku polskim i angielskim.
 */
export function parseClueProvenance(segment: string): ClueProvenance | undefined {
  if (!segment) return undefined;
  let s = segment.trim().toLowerCase();

  // Usuń prefiksy typu źródło:, zrodlo:, source:, proweniencja:, provenance:
  s = s.replace(/^(?:źródło|zrodlo|source|proweniencja|provenance)\s*:\s*/i, '').trim();

  // 1. Observed / Zaobserwowane
  if (
    /(?:^|[^\p{L}])(?:observed|observation|obserwacja|obserwacje|zaobserwowane|spostrzeżenie|spostrzezenie|widok|naoczne|naoczny|oględziny|ogledziny)(?:[^\p{L}]|$)/iu.test(
      s
    )
  ) {
    return 'observed';
  }

  // 2. Testimony / Usłyszane / Zeznanie
  if (
    /(?:^|[^\p{L}])(?:testimony|statement|witness|hearsay|interview|zeznanie|zeznania|usłyszane|uslyszane|świadek|swiadek|świadectwo|swiadectwo|wywiad|relacja|rozmowa)(?:[^\p{L}]|$)/iu.test(
      s
    )
  ) {
    return 'testimony';
  }

  // 3. Deduction / Dedukcja
  if (
    /(?:^|[^\p{L}])(?:deduction|insight|inference|conclusion|hypothesis|dedukcja|wniosek|wnioskowanie|analiza|pomysł|pomysl|hipoteza)(?:[^\p{L}]|$)/iu.test(
      s
    )
  ) {
    return 'deduction';
  }

  // 4. Handout / Dokument
  if (
    /(?:^|[^\p{L}])(?:handout|document|letter|clipping|record|file|tape|photo|photograph|dokument|list|wycinek|gazeta|prasa|artykuł|artykul|pismo|fotografia|zdjęcie|zdjecie|akta|notatka|notatki|zapiski|rejestr|taśma|tasma)(?:[^\p{L}]|$)/iu.test(
      s
    )
  ) {
    return 'handout';
  }

  return undefined;
}

/**
 * Automatyczna heurystyka wnioskowania proweniencji poszlaki (Zero-Effort Ledger).
 * Używana, gdy MG nie określił wprost proweniencji w tagu.
 */
export function inferClueProvenance(
  title: string,
  content: string,
  category?: ClueCategory
): ClueProvenance {
  if (category === 'document') return 'handout';
  if (category === 'testimony') return 'testimony';

  const text = `${title} ${content}`.toLowerCase();

  // Świadek / rozmowa / zeznanie (przed handoutem, aby zeznania specjalistów nie kolidowały ze słowem 'list')
  if (
    /(?:^|[^\p{L}])(?:mówi|mówił|mówiła|mówią|said|claims)(?:[^\p{L}]|$)|twierdzi|zeznaje|powiedział|powiedziała|relacjonuje|świadek|świadk|wywiad|rozmow|zeznan|słowa|informator|testified|witness|interview|statement|hearsay/iu.test(
      text
    )
  ) {
    return 'testimony';
  }

  // Handout / dokumenty - zabezpieczone granice słów dla krótkich/kolizyjnych rdzeni (list, akt, file, tape itp.)
  if (
    /(?:^|[^\p{L}])(?:akt|akta|aktach|aktów|file|book|list|listu|listem|liście|listy|listów|letter|letters|tape|tapes|photo|photos|prasa|prasy|prasie)(?:[^\p{L}]|$)|kopert|telegram|raport|dziennik|wycinek|gazet|artykuł|dokument|pismo|notatk|zapisk|fotografi|zdjęci|taśm|nagrani|rejestr|książk|księg|folder|teczk|document|clipping|article|recording|journal|diary/iu.test(
      text
    )
  ) {
    return 'handout';
  }

  // Dedukcja / wniosek
  if (
    /dedukcj|wniosek|wniosk|analiz|wynika z|pomysł|hipotez|zrozumiał|połączył|deduces|concludes|hypothesis|insight|realizes/iu.test(
      text
    )
  ) {
    return 'deduction';
  }

  // Domyślnie zaobserwowane (oględziny, ślad fizyczny, zmysły, forensic)
  return 'observed';
}

const INVESTIGATIVE_EVIDENCE_PATTERNS =
  /(?:list|pism|dokument|notatk|dziennik|pamiętnik|pamietnik|książ|ksieg|księg|rejestr|raport|wycinek|gazet|artykuł|artykul|bilet|kopert|telegram|faktur|kwit|rachun|umow|testament|akt|akta|szyfr|kod|inskrypcj|napis|inicjał|inicjal|podpis|piecząt|pieczat|pieczęć|pieczec|znak|symbol|runa|runy|glify|hieroglif|mapa|plan|szkic|rysunek|fotografi|zdjęci|zdjeci|taśm|tasm|nagran|handout|document|letter|note|diary|journal|book|ledger|report|clipping|ticket|cipher|code|inscription|signature|seal|symbol|rune|glyph|map|photograph|photo|recording|zeznan|świadek|swiadek|świadk|swiadk|powiedział|powiedzial|twierdzi|przyznał|przyznal|kłam|klam|alibi|motyw|rozmow|wywiad|relacj|wspomniał|wspomnial|zdradził|zdradzil|informator|podejrzan|sprawc|ofiar|zabój|zaboj|morder|testimony|witness|said|claimed|confess|suspect|victim|murder|krew|krwi|krwaw|odcisk|ślad|slad|buta|butów|opon|pazur|bruzd|zadrapan|ran|postrzał|postrzal|pocisk|łusk|lusk|proch|trucizn|jad|zwłok|zwlok|trup|ciał|cial|kości|kosci|czaszk|popiół|popiol|spalenizn|klucz|zamek|zamkni|zapieczętow|zapieczetow|zamurow|ukryt|schowek|sejf|szuflad|kufer|kufr|skrzyn|sztylet|nóż|noz|rewolwer|pistolet|broń|bron|medalion|amulet|pierścień|pierscien|sygnet|zegarek|fiolk|butelk|ampułk|ampulk|próbk|probk|mechanizm|pułapk|pulapk|ołtarz|oltarz|rytuał|rytual|pentagram|krąg|krag|świec|swiec|wosk|śluz|sluz|ichor|siark|ozon|chloroform|cyjanek|arszenik|eter|kwas|formaldehyd|właman|wlaman|łom|lom|blood|fingerprint|footprint|track|claw|scratch|wound|bullet|shell|casing|gunpowder|poison|corpse|body|bone|skull|ash|key|lock|locked|sealed|walled|hidden|compartment|safe|drawer|chest|dagger|knife|revolver|pistol|weapon|medallion|amulet|ring|vial|sample|altar|ritual|sulfur|sulphur|slime)/iu;

const BANAL_SENSORY_PATTERNS =
  /(?:zapach\s+(?:karbolu|stęchlizny|stechlizny|wilgoci|kurzu|pleśni|plesni|starości|starosci|dymu|tytoniu|potu|zgnilizny)|woń\s+(?:karbolu|stęchlizny|stechlizny|wilgoci|kurzu|pleśni|plesni)|środk(?:i|ów)\s+czyszcząc|smell\s+of\s+(?:carbolic|mustiness|damp|dust|mold|mould)|brak\s+dymu(?:\s+z\s+komina)?|nie\s+unosi\s+się\s+(?:żaden\s+)?dym|zimny\s+komin|wygasł[ey]\s+(?:komin|piec|palenisk)|no\s+smoke\s+from\s+(?:the\s+)?chimney|przenikliw[ey]\s+(?:chłód|chlod|zimno|mróz|mroz)|lodowat[ey]\s+(?:chłód|chlod|powietrze|wiatr)|panuje\s+(?:przenikliwy\s+)?(?:chłód|chlod|zaduch|wilgoć|wilgoc|półmrok|polmrok|mrok|ciemność|ciemnosc)|piercing\s+cold|freezing\s+air|damp\s+air|gęst[ae]\s+mgł[ae]|zimn[ae]\s+mgł[ae]|deszcz\s+bębni|wiatr\s+wyje|thick\s+fog|heavy\s+rain|martw[ae]\s+cisza|grobow[ae]\s+cisza|absolutn[ae]\s+cisza|panuje\s+(?:absolutna\s+|głęboka\s+|gleboka\s+)?cisza|dead\s+silence|grave\s+silence|utter\s+silence|skrzypiąc[ae]\s+(?:podłog|podlog|desk|schod|drzwi)|deski\s+(?:podłogi\s+)?(?:cicho\s+)?skrzypi|creaking\s+(?:floor|boards|stairs)|lekko\s+uchylon[ey]\s+(?:drzwi|okno|okiennic|furtk)|uchylon[ey]\s+drzwi|drzwi\s+(?:są\s+|sa\s+|były\s+|byly\s+)?(?:lekko\s+)?uchylone|slightly\s+(?:open|ajar)\s+door|door\s+is\s+(?:slightly\s+)?(?:open|ajar)|ciemny\s+korytarz|mroczny\s+korytarz|półmrok\s+w\s+korytarzu|korytarz\s+tonie\s+w\s+(?:głębokim\s+)?(?:mroku|półmroku|ciemności)|warstwa\s+kurzu|grub[ae]\s+warstw[ae]\s+kurzu|wszędzie\s+pełno\s+kurzu|pokryt[ey]\s+kurzem\s+mebl)/iu;

/**
 * Issue #568: Filtruje banalne obserwacje zmysłowe i atmosferyczne tła,
 * które nie niosą twardego faktu śledczego (np. zapach karbolu, brak dymu z komina,
 * przenikliwy chłód, martwa cisza, lekko uchylone drzwi bez śladów włamania).
 */
export function isBanalSensoryObservation(
  title: string,
  content?: string
): boolean {
  const cleanTitle = (title || '').trim();
  const cleanContent = (content || '').trim();
  if (!cleanTitle && !cleanContent) return false;

  const combined = `${cleanTitle} ${cleanContent}`.toLowerCase();
  if (INVESTIGATIVE_EVIDENCE_PATTERNS.test(combined)) {
    return false;
  }

  return BANAL_SENSORY_PATTERNS.test(combined);
}

// Wykrywanie wpisów dziennika (AI TAGS)
export function extractJournalTags(text: string): JournalTagEntry[] {
  const entries: JournalTagEntry[] = [];

  // Polish and English protocols share one persisted JournalEntry format.
  // [DZIENNIK:typ:tytuł]treść[/DZIENNIK] or [JOURNAL:type:title]body[/JOURNAL]
  // Duet adds an optional @name owner prefix.
  const journalPattern =
    /\[(?:DZIENNIK|JOURNAL):(?:@([^:\]\n]+?):)?([a-z]+):([^\]\n]+)\]([\s\S]*?)\[\/(?:DZIENNIK|JOURNAL)\]/gi;

  let match;
  while ((match = journalPattern.exec(text)) !== null) {
    const who = match[1]?.trim();
    const typeStr = match[2].toLowerCase().trim();
    const headerRest = match[3].trim();
    const content = match[4].trim();

    // Mapowanie typów
    const typeMap: Record<string, JournalTagEntry['type']> = {
      case: 'case',
      sprawa: 'case',
      cel: 'case',
      walka: 'combat',
      combat: 'combat',
      fight: 'combat',
      odkrycie: 'discovery',
      discovery: 'discovery',
      find: 'discovery',
      npc: 'npc',
      spotkanie: 'npc',
      postac: 'npc',
      poczytalnosc: 'sanity',
      sanity: 'sanity',
      san: 'sanity',
      trop: 'clue',
      clue: 'clue',
      wskazowka: 'clue',
      lokacja: 'location',
      location: 'location',
      miejsce: 'location',
      rytual: 'ritual',
      ritual: 'ritual',
      magia: 'ritual',
      smierc: 'death',
      death: 'death',
      zakladka: 'bookmark',
      bookmark: 'bookmark',
      wazne: 'bookmark',
      notatka: 'note',
      note: 'note',
      info: 'note',
      misja: 'quest',
      quest: 'quest',
      zadanie: 'quest',
      kronika: 'journal',
      dziennik: 'journal',
      wydarzenie: 'journal',
      przedmiot: 'item',
      item: 'item',
      rzecz: 'item'
    };

    const type = typeMap[typeStr] || 'note';

    let title = '';
    let inGameDate: string | undefined;
    let sourceNpc: string | undefined;
    let foundLocation: string | undefined;
    let dossierRecordId: string | undefined;

    const parseSegment = (part: string) => {
      if (!part) return;
      const npcMatch = part.match(/^(?:świadek|swiadek|witness|npc|źródło_npc|zrodlo_npc)\s*:\s*(.+)$/i);
      if (npcMatch) {
        sourceNpc = npcMatch[1].trim();
        return;
      }
      const locMatch = part.match(/^(?:lokacja|location|miejsce|place)\s*:\s*(.+)$/i);
      if (locMatch) {
        foundLocation = locMatch[1].trim();
        return;
      }
      const dateMatch = part.match(/^(?:data|date|czas|time|ingamedate)\s*:\s*(.+)$/i);
      if (dateMatch) {
        inGameDate = dateMatch[1].trim();
        return;
      }
      const dossierRecordMatch = part.match(/^(?:dossier_record_id|teczka_record_id)\s*:\s*(.+)$/i);
      if (dossierRecordMatch) dossierRecordId = dossierRecordMatch[1].trim().slice(0, 200);
    };

    // Obsługa nagłówka z pipe'ami lub tradycyjnym dwukropkiem z datą
    if (type === 'item') {
      title = headerRest;
    } else {
      const headerParts = headerRest.split('|').map((p) => p.trim());
      const firstPart = headerParts[0] || '';
      if (firstPart.includes(':')) {
        const colonIndex = firstPart.indexOf(':');
        title = firstPart.slice(0, colonIndex).trim();
        const possibleDate = firstPart.slice(colonIndex + 1).trim();
        if (possibleDate) {
          inGameDate = possibleDate;
        }
      } else {
        title = firstPart;
      }

      for (let i = 1; i < headerParts.length; i++) {
        parseSegment(headerParts[i]);
      }
    }

    // Przetwórz ewentualne segmenty pipe w treści
    if (content.includes('|')) {
      const contentParts = content.split('|').map((p) => p.trim());
      for (let i = 1; i < contentParts.length; i++) {
        parseSegment(contentParts[i]);
      }
    }

    // Issue #568: Odfiltruj banalne obserwacje zmysłowe i atmosferyczne z poszlak
    if (
      (type === 'clue' || type === 'discovery') &&
      isBanalSensoryObservation(title, `${headerRest} ${content}`)
    ) {
      continue;
    }

    if (title && content) {
      entries.push({
        type,
        title,
        content,
        inGameDate,
        who,
        sourceNpc,
        foundLocation,
        ...(dossierRecordId ? { dossierRecordId } : {}),
      });
    }
  }

  return entries;
}

/**
 * Syntetyzuje treść poszlaki/odkrycia do zwięzłego, 1-zdaniowego faktu śledczego (Zero-Effort Ledger).
 * Usuwa metadane, znaczniki, formatowanie markdown i przycina tekst do jednego precyzyjnego zdania.
 */
export function synthesizeClueFact(title: string, rawContent: string): string {
  if (!rawContent || !rawContent.trim()) {
    return title ? `${title.trim()}.` : '';
  }

  // 1. Usuń tagi strukturalne AI (np. [TAG: ...], [DZIENNIK:...], [/DZIENNIK], [ZMIANA_SCENY:...])
  let text = rawContent
    .replace(/\[\/?(?:DZIENNIK|JOURNAL|NPC|LOKACJA|LOCATION|PRZEDMIOT|ITEM|TEST|SANITY|HP|ZMIANA_SCENY|SCENE_CHANGE|KARTA_SCENY|SCENE_CARD|LOKACJA_WYCZERPANA|LOCATION_EXHAUSTED|NOTATKA_BADACZA|STICKY_NOTE|INVESTIGATOR_NOTE)[^\]]*\]/gi, '')
    .trim();

  // 2. Jeśli treść zawiera metadane oddzielone pipe (| M|I|C|E, | źródło:...), bierzemy samą treść faktu
  if (text.includes('|')) {
    text = text.split('|')[0].trim();
  }

  // 3. Usuń prefiksy typu "Poszlaka:", "Wskazówka:", "Fakt:", "Odkryto:", "Clue:", "Fact:"
  text = text.replace(/^(?:poszlaka|wskazówka|fakt|odkryto|notatka|trop|clue|discovery|fact|note)\s*:\s*/i, '');

  // 3. Usuń formatowanie Markdown (**bold**, *italic*, cytaty, listy)
  text = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^[-*•>]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 4. Wyodrębnij pierwsze pełne zdanie
  const sentenceMatch = text.match(/^([^.!?]+[.!?])/);
  let firstSentence = sentenceMatch ? sentenceMatch[1].trim() : text;

  // Jeśli pierwsze zdanie jest bardzo krótkie (< 15 znaków) i jest drugie zdanie, dołącz drugie
  if (firstSentence.length < 15 && text.length > firstSentence.length) {
    const remaining = text.slice(firstSentence.length).trim();
    const secondMatch = remaining.match(/^([^.!?]+[.!?])/);
    if (secondMatch) {
      firstSentence = `${firstSentence} ${secondMatch[1].trim()}`;
    }
  }

  // Ogranicz do max 150 znaków z zachowaniem słów
  if (firstSentence.length > 150) {
    firstSentence = firstSentence.slice(0, 147);
    const lastSpace = firstSentence.lastIndexOf(' ');
    if (lastSpace > 100) {
      firstSentence = firstSentence.slice(0, lastSpace);
    }
    firstSentence = `${firstSentence}...`;
  }

  // Upewnij się, że kończy się kropką (jeśli nie ma znaku końca)
  if (!/[.!?]$/.test(firstSentence)) {
    firstSentence += '.';
  }

  return firstSentence;
}

export interface ExtractedNpcTag {
  name: string;
  description: string;
  who?: string;
}

/**
 * Ekstrahuje tagi NPC z surowego tekstu odpowiedzi MG:
 * - [NPC: Imię: Opis]
 * - [DZIENNIK:npc:Imię]Opis[/DZIENNIK]
 */
export function extractNpcTags(text: string): ExtractedNpcTag[] {
  const npcs: ExtractedNpcTag[] = [];
  const seen = new Set<string>();

  // 1. [NPC: Imię: Opis] (opcjonalny prefiks @Who dla hot seat)
  const standaloneNpcPattern =
    /\[NPC:(?:@([^:\]\n]+?):)?\s*([^:\]\n]+):\s*([^\]]+)\]/gi;
  let match;
  while ((match = standaloneNpcPattern.exec(text)) !== null) {
    const who = match[1]?.trim();
    const name = match[2].trim();
    const description = match[3].trim();
    const key = name.toLowerCase();
    if (name && description && !seen.has(key)) {
      seen.add(key);
      npcs.push({ name, description, who });
    }
  }

  // 2. [DZIENNIK:npc:Imię]Opis[/DZIENNIK]
  const journalTags = extractJournalTags(text);
  for (const tag of journalTags) {
    if (tag.type === 'npc' && tag.title && tag.content) {
      const key = tag.title.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        npcs.push({
          name: tag.title.trim(),
          description: tag.content.trim(),
          who: tag.who,
        });
      }
    }
  }

  return npcs;
}

export interface ExtractedItemTag {
  name: string;
  description: string;
  category?: string;
  condition?: 'new' | 'used' | 'damaged' | 'broken';
  who?: string;
}

function parseItemCondition(str?: string): 'new' | 'used' | 'damaged' | 'broken' | undefined {
  if (!str) return undefined;
  const s = str.toLowerCase().trim();
  if (['new', 'nowy', 'idealny'].includes(s)) return 'new';
  if (['used', 'używany', 'noszony'].includes(s)) return 'used';
  if (['damaged', 'uszkodzony', 'zniszczony', 'nadpalony', 'poplamiony'].includes(s)) return 'damaged';
  if (['broken', 'zepsuty', 'połamany', 'rozbity'].includes(s)) return 'broken';
  return undefined;
}

/**
 * Ekstrahuje tagi przedmiotów z surowego tekstu odpowiedzi MG:
 * - [PRZEDMIOT: Nazwa: Opis] lub [PRZEDMIOT: Nazwa | kategoria | stan | opis]
 * - [ITEM: Name: Description] lub [ITEM: Name | category | condition | description]
 * - [DZIENNIK:przedmiot:Nazwa]Opis[/DZIENNIK]
 */
export function extractItemTags(text: string): ExtractedItemTag[] {
  const items: ExtractedItemTag[] = [];
  const seen = new Set<string>();

  // 1. [PRZEDMIOT: ...] i [ITEM: ...]
  const standaloneItemPattern =
    /\[(?:PRZEDMIOT|ITEM):(?:@([^:\]\n]+?):)?\s*([^:\]\n|]+)(?:[:|]\s*([^\]]+))?\]/gi;
  let match;
  while ((match = standaloneItemPattern.exec(text)) !== null) {
    const who = match[1]?.trim();
    const name = match[2].trim();
    const rawRest = match[3]?.trim() || '';
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      let category: string | undefined;
      let condition: 'new' | 'used' | 'damaged' | 'broken' | undefined;
      let description = rawRest;
      if (rawRest.includes('|')) {
        const parts = rawRest.split('|').map((p) => p.trim());
        category = parts[0];
        if (parts.length >= 3) {
          condition = parseItemCondition(parts[1]);
          description = condition ? parts.slice(2).join(' - ') : parts.slice(1).join(' - ');
        } else {
          condition = parseItemCondition(parts[1]);
          description = condition ? parts[0] : (parts.slice(1).join(' - ') || parts[0]);
        }
      }
      items.push({ name, description, category, condition, who });
    }
  }

  // 2. [DZIENNIK:przedmiot:Nazwa]Opis[/DZIENNIK]
  const journalTags = extractJournalTags(text);
  for (const tag of journalTags) {
    if (tag.type === 'item' && tag.title && tag.content) {
      let name = tag.title.trim();
      let category: string | undefined;
      let condition: 'new' | 'used' | 'damaged' | 'broken' | undefined;
      if (name.includes('|')) {
        const parts = name.split('|').map((p) => p.trim());
        name = parts[0];
        category = parts[1];
        if (parts.length >= 3) {
          condition = parseItemCondition(parts[2]);
        }
      }
      const key = name.toLowerCase().trim();
      if (name && !seen.has(key)) {
        seen.add(key);
        items.push({
          name,
          description: tag.content.trim(),
          category,
          condition,
          who: tag.who,
        });
      }
    }
  }

  return items;
}


export interface ExtractedLocationGuardian {
  locationName: string;
  entryCondition?: string;
  availableClues?: string[];
}

/**
 * Wykrywa tag ustrukturyzowanej karty lokacji (bramkowanie):
 * [STRAŻNIK_LOKACJI: Nazwa Lokacji]
 * WARUNEK_WSTĘPU: ...
 * DOSTĘPNE_POSZLAKI: ...
 * [/STRAŻNIK_LOKACJI]
 */
export function extractLocationGuardianTag(text: string): ExtractedLocationGuardian | null {
  if (!text) return null;
  const match = text.match(/\[(?:STRAŻNIK_LOKACJI|LOCATION_GUARDIAN):?\s*([^\]]*)\]([\s\S]*?)\[\/(?:STRAŻNIK_LOKACJI|LOCATION_GUARDIAN)\]/i);
  if (!match) return null;

  const locationName = match[1].trim();
  const body = match[2].trim();
  
  let entryCondition = undefined;
  const availableClues = [];
  
  const lines = body.split('\n');
  let currentSection = '';
  
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    
    if (/^(?:WARUNEK_WSTĘPU|WARUNEK_WSTEPU|ENTRY_CONDITION)\s*:/i.test(line)) {
      currentSection = 'condition';
      const inline = line.replace(/^(?:WARUNEK_WSTĘPU|WARUNEK_WSTEPU|ENTRY_CONDITION)\s*:\s*/i, '').trim();
      if (inline) entryCondition = inline;
      continue;
    }
    
    if (/^(?:DOSTĘPNE_POSZLAKI|DOSTEPNE_POSZLAKI|AVAILABLE_CLUES)\s*:/i.test(line)) {
      currentSection = 'clues';
      const inline = line.replace(/^(?:DOSTĘPNE_POSZLAKI|DOSTEPNE_POSZLAKI|AVAILABLE_CLUES)\s*:\s*/i, '').trim();
      if (inline) {
        availableClues.push(...inline.split(/[,;]/).map(p => p.trim()).filter(Boolean));
      }
      continue;
    }
    
    const cleanItem = line.replace(/^[-•*]\s*/, '').trim();
    if (!cleanItem) continue;
    
    if (currentSection === 'condition') {
      entryCondition = entryCondition ? `${entryCondition} ${cleanItem}` : cleanItem;
    } else if (currentSection === 'clues') {
      availableClues.push(cleanItem);
    }
  }
  
  return { locationName, entryCondition, availableClues: availableClues.length > 0 ? availableClues : undefined };
}

export interface ExtractedSceneChange {
  newLocation: string;
  transitionType?: string;
}

export interface ExtractedSceneCard {
  title: string;
  location?: string;
  inGameDate?: string;
  people: string[];
  findings: string[];
  keyTakeaways: string[];
  nextStep?: string;
}

/**
 * Wykrywa tag zmiany sceny lub cięcia montażowego:
 * [ZMIANA_SCENY: Lokacja] lub [ZMIANA_SCENY: typ=montaż | lokacja=Boston Globe]
 * lub [SCENE_CHANGE: Location]
 */
export function extractSceneChangeTag(text: string): ExtractedSceneChange | null {
  if (!text) return null;
  const match = text.match(/\[(?:ZMIANA_SCENY|SCENE_CHANGE):\s*([^\]]+)\]/i);
  if (!match) return null;

  const raw = match[1].trim();
  let newLocation = raw;
  let transitionType: string | undefined;

  if (raw.includes('|')) {
    const parts = raw.split('|').map((p) => p.trim());
    for (const part of parts) {
      const typeMatch = part.match(/^(?:typ|type)\s*=\s*(.+)$/i);
      const locMatch = part.match(/^(?:lokacja|location|miejsce)\s*=\s*(.+)$/i);
      if (typeMatch) transitionType = typeMatch[1].trim();
      else if (locMatch) newLocation = locMatch[1].trim();
      else if (!newLocation || newLocation === raw) newLocation = part;
    }
  }

  return { newLocation, transitionType };
}

/**
 * Wykrywa tag wyczerpania lokacji (bramkowanie śledztwa / anty-pixel-hunting):
 * [LOKACJA_WYCZERPANA: Lokacja] lub [LOKACJA_WYCZERPANA]
 * lub [LOCATION_EXHAUSTED: Location]
 */
export function extractLocationExhaustedTag(text: string): { locationName?: string } | null {
  if (!text) return null;
  const match = text.match(/\[(?:LOKACJA_WYCZERPANA|LOCATION_EXHAUSTED)(?::\s*([^\]]+))?\]/i);
  if (!match) return null;
  return { locationName: match[1]?.trim() };
}

/**
 * Wykrywa i parsuje ustrukturyzowany blok Karty Akt Śledczych po zakończeniu sceny:
 * [KARTA_SCENY: Tytuł / Lokacja]
 * OSOBY: ...
 * CO_ZDOBYTO: ...
 * USTALENIA: ...
 * CEL: ...
 * [/KARTA_SCENY]
 */
export function extractSceneCardTag(text: string): ExtractedSceneCard | null {
  if (!text) return null;
  const cardMatch = text.match(
    /\[(?:KARTA_SCENY|SCENE_CARD):?\s*([^\]]*)\]([\s\S]*?)\[\/(?:KARTA_SCENY|SCENE_CARD)\]/i
  );
  if (!cardMatch) return null;

  const header = cardMatch[1].trim();
  const body = cardMatch[2].trim();

  let title = header || 'Akta Sceny';
  let location: string | undefined;
  let inGameDate: string | undefined;
  const people: string[] = [];
  const findings: string[] = [];
  const keyTakeaways: string[] = [];
  let nextStep: string | undefined;

  if (header.includes('|')) {
    const parts = header.split('|').map((p) => p.trim());
    title = parts[0] || title;
    location = parts[1];
  }

  const lines = body.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Osoby
    const peopleMatch = line.match(/^(?:OSOBY|PEOPLE|POSTACIE|ŚWIADKOWIE)\s*:\s*(.+)$/i);
    if (peopleMatch) {
      const split = peopleMatch[1].split(/[,;]/).map((p) => p.trim()).filter(Boolean);
      people.push(...split);
      continue;
    }

    // Co zdobyto
    const findingsMatch = line.match(
      /^(?:CO_ZDOBYTO|ZDOBYTO|FINDINGS|PRZEDMIOTY|POSZLAKI|ITEMS|DOWODY)\s*:\s*(.+)$/i
    );
    if (findingsMatch) {
      const split = findingsMatch[1].split(/[,;]/).map((p) => p.trim()).filter(Boolean);
      findings.push(...split);
      continue;
    }

    // Ustalenia
    const takeawaysMatch = line.match(
      /^(?:USTALENIA|KLUCZOWE_USTALENIA|TAKEAWAYS|KEY_TAKEAWAYS|WNIOSKI|FAKTY|SUMMARY)\s*:\s*(.+)$/i
    );
    if (takeawaysMatch) {
      const split = takeawaysMatch[1].split(/(?:\. |\n|;)/).map((p) => p.trim()).filter(Boolean);
      keyTakeaways.push(...split);
      continue;
    }

    // Cel / Kolejny krok
    const nextStepMatch = line.match(
      /^(?:CEL|KOLEJNY_KROK|NEXT_STEP|CEL_SLEDZTWA|NASTĘPNY_KROK|NASTEPNY_KROK)\s*:\s*(.+)$/i
    );
    if (nextStepMatch) {
      nextStep = nextStepMatch[1].trim();
      continue;
    }

    // Data w grze
    const dateMatch = line.match(/^(?:DATA|DATE|CZAS|INGAMEDATE)\s*:\s*(.+)$/i);
    if (dateMatch) {
      inGameDate = dateMatch[1].trim();
      continue;
    }

    // Fallback: jeśli linia to punkt listy (np. "- ...") a nie ma prefiksu
    if (line.startsWith('-') || line.startsWith('•')) {
      const clean = line.replace(/^[-•*]\s*/, '').trim();
      if (clean) keyTakeaways.push(clean);
    }
  }

  return {
    title,
    location,
    inGameDate,
    people,
    findings,
    keyTakeaways,
    nextStep,
  };
}

/**
 * Ekstrahuje tag mini-podsumowania etapowego i raportu aktu:
 * [RAPORT_AKTU: Akt 1: Tytuł | Status: W toku]
 * FAKTY:
 * - Fakt 1
 * PODEJRZANI:
 * - Podejrzany 1
 * LUKI:
 * - Pytanie 1
 * HIPOTEZA:
 * Wiodąca robocza hipoteza
 * [/RAPORT_AKTU]
 *
 * lub [ACT_REPORT: ...] ... [/ACT_REPORT]
 */
export function extractActReportTag(text: string): import('@/lib/types').ActReport | null {
  if (!text) return null;
  const match = text.match(
    /\[(?:RAPORT_AKTU|ACT_REPORT):?\s*([^\]]*)\]([\s\S]*?)\[\/(?:RAPORT_AKTU|ACT_REPORT)\]/i
  );
  if (!match) return null;

  const rawHeader = match[1].trim();
  const body = match[2].trim();

  let actNumber = 1;
  let title = 'Raport Aktu';
  let status: 'in_progress' | 'completed' = 'in_progress';
  let inGameDate: string | undefined;

  const headerParts = rawHeader ? rawHeader.split('|').map((p) => p.trim()) : [];
  const mainPart = headerParts[0] || '';

  const actMatch = mainPart.match(/(?:Akt|Act)\s*(\d+)[:\s-]*(.*)/i);
  if (actMatch) {
    actNumber = parseInt(actMatch[1], 10) || 1;
    const rest = actMatch[2]?.trim();
    if (rest) title = rest;
  } else if (mainPart) {
    title = mainPart;
  }

  for (let i = 1; i < headerParts.length; i++) {
    const part = headerParts[i];
    const statusMatch = part.match(/^(?:status)\s*:\s*(.+)$/i);
    if (statusMatch) {
      const s = statusMatch[1].toLowerCase().trim();
      if (s.includes('zakończ') || s.includes('complet')) {
        status = 'completed';
      } else {
        status = 'in_progress';
      }
      continue;
    }
    const dateMatch = part.match(/^(?:data|date|czas|ingamedate)\s*:\s*(.+)$/i);
    if (dateMatch) {
      inGameDate = dateMatch[1].trim();
      continue;
    }
  }

  const confirmedFacts: string[] = [];
  const suspects: string[] = [];
  const unresolvedQuestions: string[] = [];
  let leadHypothesis: string | undefined;

  type SectionType = 'facts' | 'suspects' | 'gaps' | 'hypothesis' | null;
  let currentSection: SectionType = null;

  const lines = body.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Nagłówki sekcji
    if (/^(?:FAKTY|FACTS|DOWODY|USTALENIA)\s*:/i.test(line)) {
      currentSection = 'facts';
      const inline = line.replace(/^(?:FAKTY|FACTS|DOWODY|USTALENIA)\s*:\s*/i, '').trim();
      if (inline) confirmedFacts.push(inline);
      continue;
    }
    if (/^(?:PODEJRZANI|SUSPECTS|OSOBY|PODEJRZANY)\s*:/i.test(line)) {
      currentSection = 'suspects';
      const inline = line.replace(/^(?:PODEJRZANI|SUSPECTS|OSOBY|PODEJRZANY)\s*:\s*/i, '').trim();
      if (inline) suspects.push(inline);
      continue;
    }
    if (/^(?:LUKI|BIAŁE_PLAMY|BIALE_PLAMY|GAPS|QUESTIONS|UNRESOLVED|PYTANIA)\s*:/i.test(line)) {
      currentSection = 'gaps';
      const inline = line.replace(/^(?:LUKI|BIAŁE_PLAMY|BIALE_PLAMY|GAPS|QUESTIONS|UNRESOLVED|PYTANIA)\s*:\s*/i, '').trim();
      if (inline) unresolvedQuestions.push(inline);
      continue;
    }
    if (/^(?:HIPOTEZA|HYPOTHESIS|LEAD_HYPOTHESIS|TEORIA)\s*:/i.test(line)) {
      currentSection = 'hypothesis';
      const inline = line.replace(/^(?:HIPOTEZA|HYPOTHESIS|LEAD_HYPOTHESIS|TEORIA)\s*:\s*/i, '').trim();
      if (inline) leadHypothesis = inline;
      continue;
    }

    const cleanItem = line.replace(/^[-•*]\s*/, '').trim();
    if (!cleanItem) continue;

    if (currentSection === 'facts') {
      confirmedFacts.push(cleanItem);
    } else if (currentSection === 'suspects') {
      suspects.push(cleanItem);
    } else if (currentSection === 'gaps') {
      unresolvedQuestions.push(cleanItem);
    } else if (currentSection === 'hypothesis') {
      leadHypothesis = leadHypothesis ? `${leadHypothesis} ${cleanItem}` : cleanItem;
    }
  }

  const id = `act-report-${actNumber}-${Date.now()}`;

  return {
    id,
    actNumber,
    title,
    inGameDate,
    status,
    confirmedFacts,
    suspects,
    unresolvedQuestions,
    leadHypothesis,
  };
}

/**
 * Czyści surowy tekst wiadomości z tagów sceny, karty akt i raportu aktu,
 * aby nie wyciekały do widoku czatu ani TTS.
 */
export function cleanSceneTagsFromText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[(?:KARTA_SCENY|SCENE_CARD)[^\]]*\][\s\S]*?(?:\[\/(?:KARTA_SCENY|SCENE_CARD)\]|$)/gi, '')
    .replace(/\[(?:RAPORT_AKTU|ACT_REPORT)[^\]]*\][\s\S]*?(?:\[\/(?:RAPORT_AKTU|ACT_REPORT)\]|$)/gi, '')
    .replace(/\[(?:ZMIANA_SCENY|SCENE_CHANGE)[^\]]*\]/gi, '')
    .replace(/\[(?:LOKACJA_WYCZERPANA|LOCATION_EXHAUSTED)[^\]]*\]/gi, '')
    .replace(/\[(?:STRAŻNIK_LOKACJI|LOCATION_GUARDIAN)[^\]]*\][\s\S]*?(?:\[\/(?:STRAŻNIK_LOKACJI|LOCATION_GUARDIAN)\]|$)/gi, '')
    .replace(/\[(?:NOTATKA_BADACZA|STICKY_NOTE|INVESTIGATOR_NOTE)[^\]]*\]/gi, '')
    .trim();
}

