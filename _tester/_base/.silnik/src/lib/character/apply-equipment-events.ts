import type { Character, EquipmentItem, EquipmentVisualEra } from '../types';
import { extractEquipmentEvents } from '../parsers/equipment-parser';
import { createEquipmentItem } from '../equipment-data';
import { safeResolveVisualEra } from '../equipment-catalog';
import type { EquipmentEvent } from '../parsers/types';

export interface EquipmentNotification {
  type: 'use' | 'remove' | 'add';
  itemName: string;
  quantity?: number;
  remaining?: number;
  characterName: string;
}

/**
 * Rozstrzyga do jakiej postaci należy zdarzenie (Duet/Hot Seat wspiera @Imię).
 */
function resolveTargetCharacter(
  characterName: string | undefined,
  characters: Character[],
  fallback: Character
): Character {
  if (!characterName) return fallback;
  const needle = characterName.trim().toLowerCase();
  const matched = characters.find(
    (c) => c.name.toLowerCase() === needle || c.name.toLowerCase().includes(needle)
  );
  return matched || fallback;
}

/**
 * Szuka przedmiotu w ekwipunku po nazwie (dokładnej lub zawieraniu).
 */
function findItemIndex(items: EquipmentItem[], searchName: string): number {
  const needle = searchName.trim().toLowerCase();
  // 1. Dokładne dopasowanie
  const exact = items.findIndex((it) => it.name.toLowerCase() === needle);
  if (exact !== -1) return exact;

  // 2. Zawieranie (np. "Morfina" vs "Morfina w ampułkach")
  return items.findIndex((it) => {
    const itName = it.name.toLowerCase();
    return itName.includes(needle) || needle.includes(itName);
  });
}

/**
 * Aplikuje zdarzenia ekwipunku [EKWIPUNEK: ...] wyciągnięte z narracji MG do drużyny.
 * Obsługuje zużycie zasobów (zdejmowanie dawek), usuwanie oraz dodawanie nowych przedmiotów.
 */
export function applyEquipmentEventsToParty(
  characters: Character[],
  activeCharacter: Character,
  rawText: string,
  onNotify?: (notification: EquipmentNotification) => void,
  defaultEra: EquipmentVisualEra | string = '1920s',
  options?: { events?: EquipmentEvent[]; protectedItemIds?: Set<string> },
): {
  characters: Character[];
  activeCharacter: Character;
  changed: boolean;
  notifications: EquipmentNotification[];
} {
  const events = options?.events ?? extractEquipmentEvents(rawText);
  if (events.length === 0) {
    return { characters, activeCharacter, changed: false, notifications: [] };
  }

  let changed = false;
  const notifications: EquipmentNotification[] = [];

  // Kopia robocza postaci
  const charMap = new Map<string, Character>();
  for (const c of characters) {
    charMap.set(c.id, { ...c, equipment: [...(c.equipment || [])] });
  }

  // Upewnij się, że activeCharacter też jest w mapie
  if (!charMap.has(activeCharacter.id)) {
    charMap.set(activeCharacter.id, {
      ...activeCharacter,
      equipment: [...(activeCharacter.equipment || [])],
    });
  }

  for (const event of events) {
    const target = resolveTargetCharacter(event.characterName, Array.from(charMap.values()), activeCharacter);
    const charInMap = charMap.get(target.id);
    if (!charInMap) continue;

    const currentEq = charInMap.equipment || [];
    const itemIndex = () => {
      if (event.itemId) return currentEq.findIndex(item => item.id === event.itemId);
      const eligible = currentEq.filter(item => !options?.protectedItemIds?.has(item.id));
      const index = findItemIndex(eligible, event.itemName);
      return index < 0 ? -1 : currentEq.findIndex(item => item.id === eligible[index].id);
    };

    if (event.action === 'use') {
      const idx = itemIndex();
      if (idx !== -1) {
        const item = currentEq[idx];
        const qtyToUse = event.quantity && event.quantity > 0 ? event.quantity : 1;

        if (typeof item.charges === 'number') {
          const nextCharges = Math.max(0, item.charges - qtyToUse);
          const isDepleted = nextCharges === 0;
          charInMap.equipment = currentEq.map((it, i) =>
            i === idx
              ? {
                  ...item,
                  charges: nextCharges,
                  condition: isDepleted ? 'depleted' : item.condition,
                }
              : it
          );
          changed = true;
          const notif: EquipmentNotification = {
            type: 'use',
            itemName: item.name,
            quantity: qtyToUse,
            remaining: nextCharges,
            characterName: charInMap.name,
          };
          notifications.push(notif);
          onNotify?.(notif);
        } else if (typeof item.currentAmmo === 'number') {
          const nextAmmo = Math.max(0, item.currentAmmo - qtyToUse);
          charInMap.equipment = currentEq.map((it, i) =>
            i === idx ? { ...item, currentAmmo: nextAmmo } : it
          );
          changed = true;
          const notif: EquipmentNotification = {
            type: 'use',
            itemName: item.name,
            quantity: qtyToUse,
            remaining: nextAmmo,
            characterName: charInMap.name,
          };
          notifications.push(notif);
          onNotify?.(notif);
        } else if (typeof item.quantity === 'number') {
          const nextQty = item.quantity - qtyToUse;
          if (nextQty <= 0) {
            // Wyczerpanie zasobu - usunięcie z karty
            charInMap.equipment = currentEq.filter((_, i) => i !== idx);
            changed = true;
            const notif: EquipmentNotification = {
              type: 'remove',
              itemName: item.name,
              remaining: 0,
              characterName: charInMap.name,
            };
            notifications.push(notif);
            onNotify?.(notif);
          } else {
            // Zmniejszenie ilości
            charInMap.equipment = currentEq.map((it, i) =>
              i === idx ? { ...item, quantity: nextQty } : it
            );
            changed = true;
            const notif: EquipmentNotification = {
              type: 'use',
              itemName: item.name,
              quantity: qtyToUse,
              remaining: nextQty,
              characterName: charInMap.name,
            };
            notifications.push(notif);
            onNotify?.(notif);
          }
        } else if (item.isConsumable) {
          // Przedmiot zużywalny bez licznika (np. 1 sztuka) - znika po użyciu
          charInMap.equipment = currentEq.filter((_, i) => i !== idx);
          changed = true;
          const notif: EquipmentNotification = {
            type: 'remove',
            itemName: item.name,
            remaining: 0,
            characterName: charInMap.name,
          };
          notifications.push(notif);
          onNotify?.(notif);
        }
      }
    } else if (event.action === 'remove') {
      const idx = itemIndex();
      if (idx !== -1) {
        const item = currentEq[idx];
        charInMap.equipment = currentEq.filter((_, i) => i !== idx);
        changed = true;
        const notif: EquipmentNotification = {
          type: 'remove',
          itemName: item.name,
          remaining: 0,
          characterName: charInMap.name,
        };
        notifications.push(notif);
        onNotify?.(notif);
      }
    } else if (event.action === 'add') {
      const itemEra = safeResolveVisualEra(charInMap.era || defaultEra);
      // Dodaj nowy przedmiot
      const newItem = createEquipmentItem(
        {
          name: event.itemName,
          category: event.category || 'personal',
          description: event.description,
        },
        'found',
        itemEra
      );
      charInMap.equipment = [...currentEq, newItem];
      changed = true;
      const notif: EquipmentNotification = {
        type: 'add',
        itemName: newItem.name,
        characterName: charInMap.name,
      };
      notifications.push(notif);
      onNotify?.(notif);
    }
  }

  const updatedCharacters = characters.map((c) => charMap.get(c.id) ?? c);
  const updatedActive = charMap.get(activeCharacter.id) ?? activeCharacter;

  return {
    characters: updatedCharacters,
    activeCharacter: updatedActive,
    changed,
    notifications,
  };
}
