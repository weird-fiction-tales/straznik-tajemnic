import { ParsedEvent } from './types';
import {
  NPC_PATTERNS,
  LOCATION_PATTERNS,
  ITEM_PATTERNS,
  TAG_LOCATION_PATTERN,
} from './patterns';

/**
 * Wykrywa wycieki promptów wizualnych w tagach lokacji i poszlak
 * (np. "35mm film photograph", "1990s authentic", "cinematic lighting", "towering gothic bookshelves").
 */
export function isVisualPromptLeak(text?: string | null): boolean {
  if (!text) return false;
  return /\b(35mm|film photograph|photograph|photography|photo|cinematic|moody lighting|dramatic lighting|lighting|authentic 19\d\ds|19\d\ds authentic|octane render|unreal engine|hyperrealistic|realistic|establishing shot|wide angle|bokeh|vintage furniture|vintage photograph|Scena #\d+|exterior|interior|gothic bookshelves|bookshelves|dust motes|study tables|period-accurate|atmospheric lighting|high resolution)\b/i.test(
    text
  );
}

/**
 * Czyści nazwę lokacji ze zbędnych prefiksów, separatorów i resztek promptów technicznych.
 */
export function sanitizeLocationName(name?: string | null): string {
  if (!name) return '';
  let clean = name
    .replace(/^Lokacja:\s*/i, '')
    .replace(/^Location:\s*/i, '');

  // Odetnij separator pionowej kreski lub dwukropka, jeśli pozostał w nazwie
  if (clean.includes('|')) {
    clean = clean.split('|')[0];
  }
  if (clean.includes(':')) {
    clean = clean.split(':')[0];
  }

  // Odetnij przecinek, jeśli po nim następuje opis wizualny / prompt po angielsku
  const commaIdx = clean.indexOf(',');
  if (commaIdx !== -1) {
    const tail = clean.substring(commaIdx + 1);
    if (
      isVisualPromptLeak(tail) ||
      /\b(19\d\ds|authentic|35mm|film|cinematic|towering|gothic|detailed|period-accurate|photo|interior|exterior|lighting|realistic|atmospheric|dark|fog|misty|vintage|bookshelves|dust|study|tables|books)\b/i.test(tail) ||
      tail.trim().length > 20
    ) {
      clean = clean.substring(0, commaIdx);
    }
  }

  clean = clean
    .replace(/["'«»\u201E\u201C\u201D]/g, '')
    .trim();

  // Twarde zabezpieczenie: jeśli nazwa nadal przekracza 45 znaków, przytnij na granicy słowa
  if (clean.length > 45) {
    const truncated = clean.substring(0, 45);
    const lastSpace = truncated.lastIndexOf(' ');
    clean = (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated).trim();
  }

  return clean;
}

/**
 * IND-267: Wyłuskuje NAJNOWSZY znacznik `[LOKACJA: Nazwa: opis]` lub `[LOKACJA: Nazwa | opis]` z surowej narracji MG.
 * AI emituje go co turę, więc bierzemy ostatni (bieżąca lokacja bohatera) jako pojedyncze
 * źródło prawdy dla pineski w headerze, kategorii "Lokacje" w dzienniku i `currentLocation`
 * wstrzykiwanego z powrotem do promptu. Zwraca `null`, gdy w tekście nie ma znacznika.
 */
export function extractLatestTagLocation(
  text: string
): { name: string; description: string } | null {
  const regex = new RegExp(TAG_LOCATION_PATTERN.source, 'gi');
  let match;
  let last: { name: string; description: string } | null = null;
  while ((match = regex.exec(text)) !== null) {
    const rawTagContent = match[1].trim();
    const hasExplicitSeparator = match[2] !== undefined;

    // Jeśli mamy już poprawną lokację strukturalną (: lub |), a kolejny tag w tym samym tekście
    // to wyciek promptu bez jawnego separatora, zachowujemy dotychczasową lokację
    if (last && !hasExplicitSeparator && isVisualPromptLeak(rawTagContent)) {
      continue;
    }

    const cleanName = sanitizeLocationName(rawTagContent);
    let desc = (match[2] || '').trim();

    // Jeśli nie było separatora : ani |, ale w rawTagContent był przecinek z opisem, wyciągnij opis
    if (!desc && rawTagContent.includes(',')) {
      const commaIdx = rawTagContent.indexOf(',');
      const candidateTail = rawTagContent.substring(commaIdx + 1).trim();
      if (
        isVisualPromptLeak(candidateTail) ||
        /\b(19\d\ds|authentic|35mm|film|cinematic|towering|gothic|detailed|period-accurate|photo|interior|exterior|lighting|realistic|atmospheric|dark|fog|misty|vintage|bookshelves|dust|study|tables)\b/i.test(candidateTail)
      ) {
        desc = candidateTail;
      }
    }

    if (cleanName && cleanName.length <= 45 && !isVisualPromptLeak(cleanName)) {
      last = { name: cleanName, description: desc };
    }
  }
  return last;
}

export function extractNPCs(text: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const seenNPCs = new Set<string>();

  for (const pattern of NPC_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const npcName = match[1]?.trim();
      if (
        npcName &&
        npcName.length > 2 &&
        !seenNPCs.has(npcName.toLowerCase())
      ) {
        if (!/^(ty|ja|on|ona|to|ten|ta|ci|te|tam|tu)$/i.test(npcName)) {
          seenNPCs.add(npcName.toLowerCase());
          events.push({
            type: 'npc',
            title: `Spotkano: ${npcName}`,
            description: `Nowa postać w przygodzie`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  return events;
}

export function extractLocations(text: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const seenLocations = new Set<string>();

  for (const pattern of LOCATION_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const rawLocation = (match[1] || match[0])?.trim();
      if (!rawLocation || isVisualPromptLeak(rawLocation)) {
        continue;
      }
      const location = sanitizeLocationName(rawLocation);
      if (
        location &&
        location.length > 2 &&
        location.length <= 45 &&
        !isVisualPromptLeak(location) &&
        !seenLocations.has(location.toLowerCase())
      ) {
        seenLocations.add(location.toLowerCase());
        events.push({
          type: 'location',
          title: `Lokacja: ${location}`,
          description: `Odwiedzone miejsce`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  return events;
}

export function extractItems(text: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];

  for (const pattern of ITEM_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const item = match[1]?.trim();
      if (item && item.length > 2 && item.length < 50) {
        events.push({
          type: 'item',
          title: `Przedmiot: ${item}`,
          description: `Znaleziono/otrzymano`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  return events;
}

export interface ParsedChaseTag {
  type: 'pieszy' | 'kolowy';
  distance: number;
  opponent?: string;
  opponentMov?: number;
  role?: 'fleeing' | 'pursuer';
  isShort?: boolean;
}

/**
 * Wyłuskuje znacznik rozpoczęcia pościgu [POŚCIG: typ=... | dystans=...] z narracji MG.
 */
export function extractChaseTag(text: string): ParsedChaseTag | null {
  if (!text) return null;
  const match = text.match(/\[(?:POŚCIG|POSCIG|CHASE):\s*([^\]]+)\]/i);
  if (!match) return null;

  const content = match[1].trim();
  const isVehicle = /\b(kolowy|kołowy|pojazd|samoch[oó]d|auto|vehicle)\b/i.test(content);

  let distance = 2;
  const distMatch =
    content.match(/\b(?:dystans|distance)\s*=\s*(\d+)/i) ||
    content.match(/\b(\d+)\s*(?:p[oó]l|segment[oó]w|krok[oó]w)?\b/);
  if (distMatch) {
    const parsed = parseInt(distMatch[1], 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 5) {
      distance = parsed;
    }
  }

  let opponent: string | undefined;
  const oppMatch = content.match(/\b(?:wrog|wróg|enemy|przeciwnik|cel_poscigu|cel_pościgu)\s*=\s*([^|;\]]+)/i);
  if (oppMatch) {
    opponent = oppMatch[1].trim();
  }

  let opponentMov: number | undefined;
  const movMatch = content.match(/\b(?:wrog_mov|wróg_mov|mov)\s*=\s*(\d+)/i);
  if (movMatch) {
    const parsedMov = parseInt(movMatch[1], 10);
    if (!isNaN(parsedMov) && parsedMov > 0) {
      opponentMov = parsedMov;
    }
  }

  let role: 'fleeing' | 'pursuer' | undefined;
  const roleMatch = content.match(/\b(?:cel|rola|role|mode)\s*=\s*([^|;\]]+)/i);
  if (roleMatch) {
    const val = roleMatch[1].trim().toLowerCase();
    if (/\b(schwytanie|z[lł]apanie|dogonienie|pursuer|[sś]cigaj[aą]cy|capture|catch)\b/i.test(val)) {
      role = 'pursuer';
    } else if (/\b(ucieczka|escape|fleeing|uciekaj[aą]cy)\b/i.test(val)) {
      role = 'fleeing';
    }
  }

  const isShort = /\b(kr[oó]tki|short|ograniczony|podw[oó]rze|korytarz|dom)\s*=\s*(?:true|1|tak|yes)\b/i.test(content) ||
    /\b(kr[oó]tki|short)\b/i.test(content);

  return {
    type: isVehicle ? 'kolowy' : 'pieszy',
    distance,
    opponent,
    opponentMov,
    role,
    isShort,
  };
}

export interface ParsedChaseEndTag {
  outcome: 'ucieczka' | 'schwytanie' | 'walka';
}

/**
 * Wyłuskuje znacznik zakończenia pościgu [KONIEC_POŚCIGU: wynik=...] z narracji MG.
 */
export function extractChaseEndTag(text: string): ParsedChaseEndTag | null {
  if (!text) return null;
  const match = text.match(/\[(?:KONIEC_POŚCIGU|KONIEC_POSCIGU|CHASE_END):\s*([^\]]+)\]/i);
  if (!match) return null;

  const content = match[1].trim();
  if (/\b(schwytanie|zlapanie|złapanie|caught)\b/i.test(content)) {
    return { outcome: 'schwytanie' };
  }
  if (/\b(walka|starciu|starcie|combat|engaged)\b/i.test(content)) {
    return { outcome: 'walka' };
  }
  return { outcome: 'ucieczka' };
}

export interface ParsedDreamTag {
  variantId: string; // 'restless-night' | 'dark-cabin' | 'forest-path' | 'thing-in-lake'
  investigatorName?: string;
  nightNumber?: number;
}

/**
 * Wyłuskuje znacznik wizji sennej [SEN: wariant | badacz | noc] z narracji MG.
 * Przykłady:
 * - [SEN: dark-cabin | Thomas]
 * - [SEN: 2 | Thomas | noc=2]
 * - [SENNE_WEZWANIE: Chata w ciemnościach]
 * - [DREAM: restless-night]
 */
export function extractDreamVisionTag(text: string): ParsedDreamTag | null {
  if (!text) return null;
  const match = text.match(
    /\[(?:SEN|SENNE_WEZWANIE|DREAM|DREAM_VISION):\s*([^\]]+)\]/i
  );
  if (!match) return null;

  const content = match[1].trim();
  const parts = content.split(/[|;]/).map((p) => p.trim());
  const rawVariant = parts[0].toLowerCase();

  let variantId = 'restless-night';
  if (
    rawVariant.includes('cabin') ||
    rawVariant.includes('chata') ||
    rawVariant === '2' ||
    rawVariant.includes('dark-cabin')
  ) {
    variantId = 'dark-cabin';
  } else if (
    rawVariant.includes('path') ||
    rawVariant.includes('ścieżka') ||
    rawVariant.includes('sciezka') ||
    rawVariant === '3' ||
    rawVariant.includes('forest-path')
  ) {
    variantId = 'forest-path';
  } else if (
    rawVariant.includes('lake') ||
    rawVariant.includes('jezior') ||
    rawVariant === '4' ||
    rawVariant.includes('thing-in-lake')
  ) {
    variantId = 'thing-in-lake';
  } else {
    variantId = 'restless-night';
  }

  let investigatorName: string | undefined;
  let nightNumber: number | undefined;

  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    const nightMatch = p.match(/(?:noc|night)\s*=\s*(\d+)/i);
    if (nightMatch) {
      nightNumber = parseInt(nightMatch[1], 10);
      continue;
    }
    if (!investigatorName) {
      investigatorName = p;
    }
  }

  return {
    variantId,
    investigatorName,
    nightNumber: nightNumber || 1,
  };
}
