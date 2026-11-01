import { useCallback, useEffect, useRef } from 'react';
import type { Character, EquipmentItem, AdventureContext, EquipmentVisualEra } from '@/lib/types';
import { fetchWithApiKeys, isPureTextMode } from '@/lib/api-keys-service';
import {
  buildEquipmentImagePrompt,
  isCharacterBoundEquipment,
} from '@/lib/equipment-prompt-builder';
import { persistCharacters } from '@/lib/character-cloud-sync';
import { applyCatalogTemplate } from '@/lib/equipment-catalog';
import { resolveEraVisualProfile } from '@/lib/era-visual-style';

/**
 * IND-271: auto-generacja miniatur ekwipunku w tle przy starcie gry.
 *
 * Wcześniej każdą miniaturę trzeba było wyklikać osobno w EquipmentModal
 * (playtest Silas Blackwood: 10 itemów = same placeholdery). Ten hook robi to
 * automatycznie w tle PO starcie gry, bez interakcji - gracz otwiera Ekwipunek
 * i miniatury już są albo dociągają się sekwencyjnie.
 *
 * Cache: miniatura żyje jako `item.imageUrl` na postaci (persist do localStorage
 * przez roster) - ten sam mechanizm co ręczny przycisk w EquipmentModal. Item z
 * istniejącym `imageUrl` jest pomijany (zero ponownej generacji = zero kosztu).
 *
 * Koszt: sekwencyjna kolejka (NIE 10 równoległych requestów) + limit
 * MAX_THUMBNAILS itemów na start (~$0.02/item przez /api/imagen Gemini).
 */

/** Limit miniatur generowanych przy jednym starcie gry (kontrola kosztu ~$0.02/item). */
const MAX_THUMBNAILS = 12;

interface UseEquipmentThumbnailsProps {
  activeCharacter: Character | null;
  adventureContext: AdventureContext | null;
  imageGenerationEnabled: boolean;
  setActiveCharacter: React.Dispatch<React.SetStateAction<Character | null>>;
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
}

/** Era do promptu obrazu i dopasowania katalogowego. */
function resolveEra(adventureContext: AdventureContext | null): EquipmentVisualEra {
  const raw = adventureContext?.yearRange?.split('-')[0] || adventureContext?.era || '1920s';
  return resolveEraVisualProfile(raw) as EquipmentVisualEra;
}

/**
 * Generuje miniaturę pojedynczego przedmiotu przez /api/imagen (Gemini, jeden klucz).
 * Zwraca data URL obrazu lub null gdy generacja zawiodła (cicho - tło).
 */
interface GeneratedEquipmentImage {
  imageUrl: string;
  imagePrompt: string;
}

async function generateOneThumbnail(
  item: EquipmentItem,
  era: string,
  adventureTheme?: string,
  character?: Character | null
): Promise<GeneratedEquipmentImage | null> {
  if (isPureTextMode()) return null;
  try {
    const prompt = buildEquipmentImagePrompt(
      item,
      era,
      adventureTheme,
      character
    );
    const usePortraitReference = Boolean(
      character?.portraitUrl && isCharacterBoundEquipment(item)
    );
    const response = await fetchWithApiKeys(
      usePortraitReference ? '/api/flux-kontext' : '/api/imagen',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style: usePortraitReference
            ? 'realistic'
            : item.visualTreatment === 'supernatural' ||
                item.category === 'artifact'
              ? 'horror'
              : 'item',
          era,
          aspectRatio: '1:1',
          seed: `${character?.id || ''}-${item.id}`,
          ...(usePortraitReference
            ? { inputImageUrl: character!.portraitUrl }
            : {}),
        }),
      }
    );

    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.imageUrl === 'string'
      ? { imageUrl: data.imageUrl, imagePrompt: prompt }
      : null;
  } catch {
    // Tło - błąd pojedynczej miniatury nie przerywa kolejki ani gry.
    return null;
  }
}

/**
 * Hook zwraca fire-and-forget funkcję, którą startuje useGameStart PO starcie gry.
 * Nie blokuje startu (caller NIE awaituje).
 */
export function useEquipmentThumbnails({
  activeCharacter,
  adventureContext,
  imageGenerationEnabled,
  setActiveCharacter,
  setCharacters,
}: UseEquipmentThumbnailsProps) {
  const imageGenerationEnabledRef = useRef(imageGenerationEnabled);
  const activeCharacterIdRef = useRef(activeCharacter?.id);
  const runningCharacterIdsRef = useRef(new Set<string>());
  const failedItemIdsRef = useRef(new Set<string>());

  useEffect(() => {
    imageGenerationEnabledRef.current = imageGenerationEnabled;
  }, [imageGenerationEnabled]);

  useEffect(() => {
    activeCharacterIdRef.current = activeCharacter?.id;
  }, [activeCharacter?.id]);

  const generateThumbnailsInBackground = useCallback(
    async (characterOverride?: Character): Promise<void> => {
      const character = characterOverride ?? activeCharacter;
      if (!character) return;
      if (runningCharacterIdsRef.current.has(character.id)) return;

      runningCharacterIdsRef.current.add(character.id);

      try {
        const era = resolveEra(adventureContext);
        const adventureTheme = adventureContext?.title;

        // Krok 1: Wzbogacenie o lokalne assety katalogu (deterministyczne, 0 kosztu, natychmiastowe)
        let catalogUpdated = false;
        const enrichedEquipment = (character.equipment ?? []).map((item) => {
          const enriched = applyCatalogTemplate(item, era);
          if (item.visualSource === 'catalog' && item.imageUrl === enriched.imageUrl) {
            return item;
          }

          if (enriched.imageUrl && enriched.imageUrl !== item.imageUrl) {
            catalogUpdated = true;
            return enriched;
          }
          return item;
        });

        let currentCharacter = character;
        if (catalogUpdated) {
          currentCharacter = { ...character, equipment: enrichedEquipment };
          setCharacters((prevList) => {
            const updatedList = prevList.map((c) =>
              c.id === character.id ? currentCharacter : c
            );
            if (typeof window !== 'undefined') {
              persistCharacters(updatedList);
            }
            return updatedList;
          });
          setActiveCharacter((prev) =>
            prev && prev.id === character.id ? currentCharacter : prev
          );
        }

        if (!imageGenerationEnabledRef.current) return;

        // Krok 2: Sekwencyjna generacja AI w tle dla przedmiotów bez lokalnego WebP
        const pending = (currentCharacter.equipment ?? [])
          .filter((item) => {
            if (item.dossierBinding) return false;
            if (
              item.imageUrl &&
              !item.imageUrl.endsWith('.svg') &&
              !item.imageUrl.includes('/predefined/') &&
              !item.imageUrl.includes('/equipment/predefined/')
            ) {
              return false;
            }
            if (failedItemIdsRef.current.has(item.id)) {
              return false;
            }
            return true;
          })
          .slice(0, MAX_THUMBNAILS);

        if (pending.length === 0) return;

        // Sekwencyjnie - jedna miniatura na raz (zamiast N równoległych requestów).
        for (const item of pending) {
          if (
            !imageGenerationEnabledRef.current ||
            activeCharacterIdRef.current !== character.id
          ) {
            break;
          }

          const generated = await generateOneThumbnail(
            item,
            era,
            adventureTheme,
            currentCharacter
          );
          if (!generated) {
            failedItemIdsRef.current.add(item.id);
            const fallbackFields = {
              visualSource: 'fallback' as const,
            };
            setCharacters((prevList) => {
              const updatedList = prevList.map((c) => {
                if (c.id !== character.id) return c;
                return {
                  ...c,
                  equipment: (c.equipment ?? []).map((it) =>
                    it.id === item.id ? { ...it, ...fallbackFields } : it
                  ),
                };
              });
              if (typeof window !== 'undefined') {
                persistCharacters(updatedList);
              }
              return updatedList;
            });
            setActiveCharacter((prev) => {
              if (!prev || prev.id !== character.id) return prev;
              return {
                ...prev,
                equipment: (prev.equipment ?? []).map((it) =>
                  it.id === item.id ? { ...it, ...fallbackFields } : it
                ),
              };
            });
            continue;
          }

          const generatedFields = {
            imageUrl: generated.imageUrl,
            imagePrompt: generated.imagePrompt,
            visualSource: 'generated' as const,
          };

          setCharacters((prevList) => {
            const updatedList = prevList.map((c) => {
              if (c.id !== character.id) return c;
              return {
                ...c,
                equipment: (c.equipment ?? []).map((it) =>
                  it.id === item.id ? { ...it, ...generatedFields } : it
                ),
              };
            });
            if (typeof window !== 'undefined') {
              persistCharacters(updatedList);
            }
            return updatedList;
          });

          setActiveCharacter((prev) => {
            if (!prev || prev.id !== character.id) return prev;
            return {
              ...prev,
              equipment: (prev.equipment ?? []).map((it) =>
                it.id === item.id ? { ...it, ...generatedFields } : it
              ),
            };
          });

          // Throttling 500ms, zapobieganie błędom HTTP 429 Too Many Requests
          await new Promise((res) => setTimeout(res, 500));
        }
      } finally {
        runningCharacterIdsRef.current.delete(character.id);
      }
    },
    [activeCharacter, adventureContext, setActiveCharacter, setCharacters]
  );

  return { generateThumbnailsInBackground };
}
