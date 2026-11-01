'use client';

import { SafeImage } from '@/components/ui/safe-image';
/**
 * NarrativeFormatter renderNarrativeWithImages - IND-144 micro 6/8 (extract z NarrativeFormatter.tsx)
 *
 * Renderuje narrację z obsługą obrazów Markdown ![alt](url). Parser dzieli content
 * na fragmenty tekstu i obrazy, renderuje sekwencyjnie. Plain text bez obrazów →
 * single <p>.
 *
 * IND-172: raw <img> zamiast next/image. AI chat generuje obrazy inline jako
 * base64 data URLs (Gemini Image, Replicate Flux), które next/image NIE wspiera
 * domyślnie. ESLint disable dla single line `@next/next/no-img-element`.
 */

import type { ReactNode } from 'react';
import { isPureTextMode } from '@/lib/api-keys-service';

export function renderNarrativeWithImages(
  content: string,
  key: number,
  onImageClick?: (imgUrl: string, allImages: string[]) => void,
  allowInlineImages = true,
): ReactNode {
  // Dossier assets must use an acquired record ID, never a model-supplied URL.
  if (!allowInlineImages || isPureTextMode()) {
    const cleanText = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '').trim();
    return (
      <p
        key={key}
        className="text-foreground leading-relaxed whitespace-pre-wrap"
      >
        {cleanText}
      </p>
    );
  }
  // Regex do wykrywania obrazów Markdown: ![alt text](url)
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

  // Sprawdź czy są jakiekolwiek obrazy
  if (!imageRegex.test(content)) {
    // Brak obrazów - renderuj jako zwykły tekst
    return (
      <p
        key={key}
        className="text-foreground leading-relaxed whitespace-pre-wrap"
      >
        {content}
      </p>
    );
  }

  // Reset regex (test() przesuwa lastIndex)
  imageRegex.lastIndex = 0;

  // Podziel content na obrazy (na szczycie) i akapity tekstu (poniżej)
  const imageParts: ReactNode[] = [];
  const textParts: ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let partIndex = 0;

  while ((match = imageRegex.exec(content)) !== null) {
    // Dodaj tekst przed obrazem
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index).trim();
      if (textBefore) {
        textParts.push(
          <p
            key={`${key}-text-${partIndex}`}
            className="text-foreground leading-relaxed whitespace-pre-wrap"
          >
            {textBefore}
          </p>
        );
        partIndex++;
      }
    }

    // Dodaj obraz
    const altText = match[1] || 'Obraz';
    const imageUrl = match[2];

    // Sprawdź czy to base64 czy URL
    const isBase64 = imageUrl.startsWith('data:image');

    // IND-172: raw <img> zamiast next/image.
    imageParts.push(
      <div key={`${key}-img-${partIndex}`} className="mb-4">
        <SafeImage
          src={imageUrl}
          alt={altText}
          // Zachowaj cały wygenerowany kadr. Wysokość jest ograniczona tylko po
          // to, by pionowe obrazy nie zdominowały całego okna czatu.
          className={`rounded-lg shadow-lg w-full h-auto max-h-[70vh] object-contain bg-black/30 border border-brass/30 ${
            onImageClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
          }`}
          style={{
            filter: 'sepia(0.1) saturate(1.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
          loading={isBase64 ? 'eager' : 'lazy'}
          onClick={
            onImageClick
              ? () => onImageClick(imageUrl, [imageUrl])
              : undefined
          }
        />
      </div>
    );
    partIndex++;

    lastIndex = match.index + match[0].length;
  }

  // Dodaj pozostały tekst po ostatnim obrazie
  if (lastIndex < content.length) {
    const textAfter = content.slice(lastIndex).trim();
    if (textAfter) {
      textParts.push(
        <p
          key={`${key}-text-${partIndex}`}
          className="text-foreground leading-relaxed whitespace-pre-wrap"
        >
          {textAfter}
        </p>
      );
    }
  }

  // Obrazy zawsze na szczycie przed akapitami tekstu
  return <div key={key}>{[...imageParts, ...textParts]}</div>;
}
