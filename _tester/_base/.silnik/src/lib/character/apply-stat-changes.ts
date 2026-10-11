/**
 * Most między tagami MG a kartą postaci - automatyczna utrata/odzysk SAN, HP i Szczęścia
 * w trakcie sesji (Faza 5 audytu mechaniki, BRAK-1 + Issue #48 Poczytalność RAW + Issue #763).
 *
 * AI zgłasza zmiany strukturalnymi tagami w surowej narracji:
 *   [SANITY: -3: widok rozkładających się zwłok]
 *   [UTRATA_SAN: 1k4: widok abominacji]
 *   [HP: -5: cios nożem]
 *   [OBRAŻENIA: 1k6: poparzenia od artefaktu]
 *   [SZCZĘŚCIE: +5: nagroda za brawurę]
 *   [LUCK: -15: uniknięcie kuli]
 *
 * Aplikacja sumuje delty i odejmuje/dodaje do karty z pełną egzekucją progów CoC 7e RAW:
 *   - utrata >= 5 SAN -> zdarzenie 'int_check_required'
 *   - utrata 1/5 dziennej SAN -> Czasowa Niepoczytalność + 'underlyingInsanity'
 *   - 'underlyingInsanity' -> każda utrata odpala atak szaleństwa
 *   - próg Mity Cthulhu > SAN -> redukcja strat SAN o 50%
 *
 * Zwraca ustrukturyzowane zdarzenia statChangeEvents dla kart w czacie (Issue #763).
 */

import type { Character, StatChangeEventData, StatChangeItem } from '@/lib/types';
import { rollDiceFormula } from '@/lib/dice-utils';
import { resolveCharacterByName } from './match-by-name';
import { applySanityDelta, type SanityEvent } from '@/lib/sanity/sanity-engine';
import { generateHitLocationScar } from '@/lib/health/recovery-tracker';

export type { SanityEvent };

// Delta: stała ze znakiem (±N) ALBO notacja kości (±NdM, ±NdM±K). Obrażenia CoC są
// prawie zawsze kościowe (szpony 1d6, upadek 1d4), więc MG emituje np. [HP: -1D6: ...].
// Opcjonalny prefiks `@Imię:` wskazuje właściciela zmiany w duecie (fallback: aktywna
// postać). Powód dowolny do ']'. Globalne - sumujemy wszystkie wystąpienia.
const DELTA = String.raw`[+-]?(?:\d+[dDkK]\d+(?:[+-]\d+)?|\d+)`;

const SANITY_TAG = new RegExp(
  `\\[(?<tag>SANITY|SAN|POCZYTALNOŚĆ|POCZYTALNOSC|UTRATA_SAN):\\s*(?:@(?<who>[^:\\]]+?)\\s*:\\s*)?(?<delta>${DELTA})(?:\\s*:\\s*(?<reason>[^\\]]*))?\\]`,
  'gi'
);

const HP_TAG = new RegExp(
  `\\[(?<tag>HP|OBRAŻENIA|OBRAZENIA|RANY):\\s*(?:@(?<who>[^:\\]]+?)\\s*:\\s*)?(?<delta>${DELTA})(?:\\s*:\\s*(?<reason>[^\\]]*))?\\]`,
  'gi'
);

const LUCK_TAG = new RegExp(
  `\\[(?<tag>LUCK|SZCZĘŚCIE|SZCZESCIE):\\s*(?:@(?<who>[^:\\]]+?)\\s*:\\s*)?(?<delta>${DELTA})(?:\\s*:\\s*(?<reason>[^\\]]*))?\\]`,
  'gi'
);

/**
 * Zamienia surową deltę na liczbę. Notacja kości (zawiera `d`/`D` lub `k`/`K`) jest rzucana
 * przez `rollDiceFormula` ("Tacka liczy wszystko") - znak z przodu steruje kierunkiem.
 * Gdy `isDamageOrLoss` = true i brak jawnego plusa, wartość traktowana jest jako ujemna.
 */
function parseDelta(raw: string, isDamageOrLoss = false): number {
  const trimmed = raw.trim();
  const hasExplicitPlus = trimmed.startsWith('+');
  const hasExplicitMinus = trimmed.startsWith('-');
  const isNegative = hasExplicitMinus || (isDamageOrLoss && !hasExplicitPlus);

  if (/[dDkK]/.test(trimmed)) {
    const formula = trimmed.replace(/^[+-]/, '');
    const rolled = rollDiceFormula(formula);
    const value = rolled ? Math.abs(rolled.total) : 0;
    return isNegative ? -value : value;
  }
  const parsed = parseInt(trimmed.replace(/^[+-]/, ''), 10);
  if (isNaN(parsed)) return 0;
  return isNegative ? -parsed : parsed;
}

/** Clamp do [0, max]; gdy max nieokreślony - tylko dolne ograniczenie (0). */
function clampStat(value: number, max: number | undefined): number {
  const lower = Math.max(0, value);
  return max != null ? Math.min(max, lower) : lower;
}

export interface StatTagMatch {
  who?: string;
  delta: number;
  reason?: string;
}

/**
 * Zbiera tagi SAN z tekstu z rozbiciem na deltę i powód.
 */
function collectSanityMatches(text: string): StatTagMatch[] {
  const matches: StatTagMatch[] = [];
  SANITY_TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SANITY_TAG.exec(text)) !== null) {
    const tagName = match.groups?.tag?.toUpperCase() ?? '';
    const isLoss = tagName === 'UTRATA_SAN';
    const delta = parseDelta(match.groups?.delta ?? '0', isLoss);
    if (delta !== 0) {
      matches.push({
        who: match.groups?.who?.trim(),
        delta,
        reason: match.groups?.reason?.trim() || undefined,
      });
    }
  }
  return matches;
}

/** Zbiera tagi HP z tekstu z rozbiciem na deltę i powód. */
function collectHpMatches(text: string): StatTagMatch[] {
  const matches: StatTagMatch[] = [];
  HP_TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HP_TAG.exec(text)) !== null) {
    const tagName = match.groups?.tag?.toUpperCase() ?? '';
    const isDamage = tagName === 'OBRAŻENIA' || tagName === 'OBRAZENIA' || tagName === 'RANY';
    const delta = parseDelta(match.groups?.delta ?? '0', isDamage);
    if (delta !== 0) {
      matches.push({
        who: match.groups?.who?.trim(),
        delta,
        reason: match.groups?.reason?.trim() || undefined,
      });
    }
  }
  return matches;
}

/** Zbiera tagi Szczęścia z tekstu z rozbiciem na deltę i powód. */
function collectLuckMatches(text: string): StatTagMatch[] {
  const matches: StatTagMatch[] = [];
  LUCK_TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LUCK_TAG.exec(text)) !== null) {
    const delta = parseDelta(match.groups?.delta ?? '0', false);
    if (delta !== 0) {
      matches.push({
        who: match.groups?.who?.trim(),
        delta,
        reason: match.groups?.reason?.trim() || undefined,
      });
    }
  }
  return matches;
}

/** Sumuje wszystkie delty HP pasujące do wzorca dla pojedynczej postaci. */
function sumHpDeltas(text: string): number {
  return collectHpMatches(text).reduce((total, m) => total + m.delta, 0);
}

/** Sumuje wszystkie delty Luck pasujące do wzorca dla pojedynczej postaci. */
function sumLuckDeltas(text: string): number {
  return collectLuckMatches(text).reduce((total, m) => total + m.delta, 0);
}

/**
 * Aplikuje zmiany SAN/HP/LUCK z tagów w surowym tekście MG dla pojedynczego badacza.
 * Zwraca TEN SAM obiekt (referencyjnie), gdy nie ma żadnej zmiany - caller
 * może tanio pominąć zapis/persist (jak przy appendJournalFromText).
 */
export function applyStatChangesFromText(
  character: Character,
  rawText: string,
  onSanityEvent?: (event: SanityEvent) => void
): Character {
  const sanMatches = collectSanityMatches(rawText);
  const hpDelta = sumHpDeltas(rawText);
  const luckDelta = sumLuckDeltas(rawText);
  if (sanMatches.length === 0 && hpDelta === 0 && luckDelta === 0) return character;

  let next = { ...character };

  // Aplikuj każdą zmianę SAN przez regułowy silnik Poczytalności CoC 7e
  for (const match of sanMatches) {
    const result = applySanityDelta(next, match.delta, match.reason);
    next = result.nextCharacter;
    for (const event of result.events) {
      onSanityEvent?.(event);
    }
  }

  if (hpDelta !== 0) {
    next.hp = clampStat(character.hp + hpDelta, character.maxHp);
    const maxHp = character.maxHp || character.hp || 10;
    const isPulp = character.rulesetVariant === 'pulp';
    const majorWoundThreshold = isPulp ? maxHp : Math.floor(maxHp / 2);
    if (hpDelta <= -majorWoundThreshold) {
      next.hasMajorWound = true;
    }
    if (next.hp <= 0) {
      next.isUnconscious = true;
      if (isPulp) {
        const dyingThreshold = Math.floor(maxHp / 2);
        if (-hpDelta >= dyingThreshold || next.hasMajorWound) {
          next.isDying = true;
        }
      } else {
        if (next.hasMajorWound) {
          next.isDying = true;
        }
      }
      // Tarcza ocalenia Fail-Forward przy 0 HP (Seth Skorkowsky style, Issue #372)
      if ((next.deathSavesUsed ?? 0) === 0) {
        next.deathSavesUsed = 1;
        const scar = generateHitLocationScar();
        const scarList = next.scars ? [...next.scars] : [];
        if (!scarList.includes(scar.descriptionPl)) {
          scarList.push(scar.descriptionPl);
        }
        next.scars = scarList;
      } else {
        // Po wyczerpaniu tarczy ocalenia kolejna utrata HP przy 0 oznacza zgon
        next.isDead = true;
      }
    } else if (next.hp > 0 && next.isDying) {
      next.isDying = false;
    }
  }

  if (luckDelta !== 0) {
    const currentLuck = character.luck ?? 50;
    next.luck = Math.max(0, Math.min(99, currentLuck + luckDelta));
  }

  return next;
}

/**
 * Wariant party-aware (duet / Hot Seat): kieruje każdą zmianę SAN/HP/LUCK do postaci
 * wskazanej prefiksem `@Imię` w tagu (`[SANITY:@Eleanor: -1]`), a bez prefiksu - do
 * `activeCharacter` (fallback, zachowuje zachowanie single-player).
 *
 * Zwraca zaktualizowaną listę postaci + zsynchronizowaną aktywną + flagę `changed`,
 * listę wyemitowanych zdarzeń psychicznych `sanityEvents` oraz ustrukturyzowane
 * karty zmian `statChangeEvents` dla interfejsu czatu.
 */
export function applyStatChangesToParty(
  characters: Character[],
  activeCharacter: Character,
  rawText: string,
  onSanityEvent?: (event: SanityEvent) => void
): {
  characters: Character[];
  activeCharacter: Character;
  changed: boolean;
  sanityEvents: SanityEvent[];
  statChangeEvents: StatChangeEventData[];
} {
  const sanMatches = collectSanityMatches(rawText);
  const hpMatches = collectHpMatches(rawText);
  const luckMatches = collectLuckMatches(rawText);

  if (sanMatches.length === 0 && hpMatches.length === 0 && luckMatches.length === 0) {
    return {
      characters,
      activeCharacter,
      changed: false,
      sanityEvents: [],
      statChangeEvents: [],
    };
  }

  // Zgrupuj zmiany po identyfikatorze postaci
  const sanByChar = new Map<string, StatTagMatch[]>();
  for (const m of sanMatches) {
    const target = resolveCharacterByName(characters, m.who, activeCharacter);
    const list = sanByChar.get(target.id) ?? [];
    list.push(m);
    sanByChar.set(target.id, list);
  }

  const hpByChar = new Map<string, StatTagMatch[]>();
  for (const m of hpMatches) {
    const target = resolveCharacterByName(characters, m.who, activeCharacter);
    const list = hpByChar.get(target.id) ?? [];
    list.push(m);
    hpByChar.set(target.id, list);
  }

  const luckByChar = new Map<string, StatTagMatch[]>();
  for (const m of luckMatches) {
    const target = resolveCharacterByName(characters, m.who, activeCharacter);
    const list = luckByChar.get(target.id) ?? [];
    list.push(m);
    luckByChar.set(target.id, list);
  }

  let changed = false;
  const allEvents: SanityEvent[] = [];
  const statChangeEvents: StatChangeEventData[] = [];

  const apply = (c: Character): Character => {
    const charSanMatches = sanByChar.get(c.id) ?? [];
    const charHpMatches = hpByChar.get(c.id) ?? [];
    const charLuckMatches = luckByChar.get(c.id) ?? [];

    if (charSanMatches.length === 0 && charHpMatches.length === 0 && charLuckMatches.length === 0) {
      return c;
    }

    changed = true;
    let next = { ...c };
    const prevHp = c.hp ?? c.maxHp ?? 10;
    const prevSan = c.san ?? 50;
    const prevLuck = c.luck ?? 50;
    let charIntCheckRequired = false;

    // 1. Poczytalność
    for (const entry of charSanMatches) {
      const res = applySanityDelta(next, entry.delta, entry.reason);
      next = res.nextCharacter;
      if (entry.delta <= -5) {
        charIntCheckRequired = true;
      }
      for (const ev of res.events) {
        allEvents.push(ev);
        if (ev.type === 'int_check_required') {
          charIntCheckRequired = true;
        }
        onSanityEvent?.(ev);
      }
    }

    // 2. Punkty Życia
    const totalHpDelta = charHpMatches.reduce((acc, m) => acc + m.delta, 0);
    if (totalHpDelta !== 0) {
      next.hp = clampStat(c.hp + totalHpDelta, c.maxHp);
      const maxHp = c.maxHp || c.hp || 10;
      const isPulp = c.rulesetVariant === 'pulp';
      const majorWoundThreshold = isPulp ? maxHp : Math.floor(maxHp / 2);
      if (totalHpDelta <= -majorWoundThreshold) {
        next.hasMajorWound = true;
      }
      if (next.hp <= 0) {
        next.isUnconscious = true;
        if (isPulp) {
          const dyingThreshold = Math.floor(maxHp / 2);
          if (-totalHpDelta >= dyingThreshold || next.hasMajorWound) {
            next.isDying = true;
          }
        } else {
          if (next.hasMajorWound) {
            next.isDying = true;
          }
        }
        // Tarcza ocalenia Fail-Forward przy 0 HP (Seth Skorkowsky style, Issue #372)
        if ((next.deathSavesUsed ?? 0) === 0) {
          next.deathSavesUsed = 1;
          const scar = generateHitLocationScar();
          const scarList = next.scars ? [...next.scars] : [];
          if (!scarList.includes(scar.descriptionPl)) {
            scarList.push(scar.descriptionPl);
          }
          next.scars = scarList;
        } else {
          // Po wyczerpaniu tarczy ocalenia kolejna utrata HP przy 0 oznacza zgon
          next.isDead = true;
        }
      } else if (next.hp > 0 && next.isDying) {
        next.isDying = false;
      }
    }

    // 3. Szczęście
    const totalLuckDelta = charLuckMatches.reduce((acc, m) => acc + m.delta, 0);
    if (totalLuckDelta !== 0) {
      next.luck = Math.max(0, Math.min(99, prevLuck + totalLuckDelta));
    }

    // Budowanie pozycji zmian dla karty w czacie (Issue #763)
    const items: StatChangeItem[] = [];

    if (charHpMatches.length > 0 && totalHpDelta !== 0) {
      const reasons = charHpMatches.map((m) => m.reason).filter(Boolean);
      items.push({
        type: 'hp',
        delta: totalHpDelta,
        reason: reasons.length > 0 ? reasons.join('; ') : undefined,
        previousValue: prevHp,
        currentValue: next.hp,
        maxValue: next.maxHp || 10,
      });
    }

    if (charSanMatches.length > 0) {
      const totalSanDelta = charSanMatches.reduce((acc, m) => acc + m.delta, 0);
      if (totalSanDelta !== 0) {
        const reasons = charSanMatches.map((m) => m.reason).filter(Boolean);
        items.push({
          type: 'san',
          delta: totalSanDelta,
          reason: reasons.length > 0 ? reasons.join('; ') : undefined,
          previousValue: prevSan,
          currentValue: next.san,
          maxValue: 99,
        });
      }
    }

    if (charLuckMatches.length > 0 && totalLuckDelta !== 0) {
      const reasons = charLuckMatches.map((m) => m.reason).filter(Boolean);
      items.push({
        type: 'luck',
        delta: totalLuckDelta,
        reason: reasons.length > 0 ? reasons.join('; ') : undefined,
        previousValue: prevLuck,
        currentValue: next.luck ?? 50,
        maxValue: 99,
      });
    }

    if (items.length > 0) {
      statChangeEvents.push({
        id: `stat-change-${Date.now()}-${c.id}-${Math.random().toString(36).slice(2, 6)}`,
        characterId: c.id,
        characterName: c.name,
        avatarUrl: c.portraitUrl,
        changes: items,
        intCheckRequired: charIntCheckRequired,
        majorWound: Boolean(next.hasMajorWound && !c.hasMajorWound),
        unconscious: Boolean(next.isUnconscious && !c.isUnconscious),
        dying: Boolean(next.isDying && !c.isDying),
      });
    }

    return next;
  };

  const nextCharacters = characters.map(apply);
  const nextActive =
    nextCharacters.find((c) => c.id === activeCharacter.id) ??
    apply(activeCharacter);

  return {
    characters: nextCharacters,
    activeCharacter: nextActive,
    changed,
    sanityEvents: allEvents,
    statChangeEvents,
  };
}
