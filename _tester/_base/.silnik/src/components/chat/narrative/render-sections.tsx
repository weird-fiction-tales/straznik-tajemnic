'use client';

import { SafeImage } from '@/components/ui/safe-image';

/**
 * NarrativeFormatter renderSection - IND-144 micro 7/8 (extract z NarrativeFormatter.tsx)
 *
 * Switch router dla 7 typów sekcji. Inline JSX dla prostych case'ów (dialogue,
 * roll, whisper). Delegacja do dedykowanych modułów dla złożonych
 * (handout/perspective/narrative-with-images).
 */

import type { ReactNode } from 'react';
import type { Section } from './types';
import type { DossierHandoutBinding } from '@/lib/adventure-dossier/local-handouts';
import type { AnyAdventureContext } from '@/lib/handout-resolver';
import { renderHandout } from './render-handout';
import { renderPerspective } from './render-perspective';
import { renderNarrativeWithImages } from './render-narrative-with-images';
import { DirectorNotes } from './render-director-notes';
import { resolveNpcPortrait } from '@/lib/npc-voice-mapping';

function getSpeakerInitials(name?: string): string {
  if (!name) return '?';
  const clean = name.replace(/^(doktor|dr|profesor|prof|inspektor|insp|kapitan|kap|pan|pani|panna|ojciec|brat|siostra)\.?\s+/i, '');
  const parts = clean.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function renderSection(
  section: Section,
  key: number,
  playerColors?: Map<string, string>,
  onImageClick?: (imgUrl: string, allImages: string[]) => void,
  adventureContext?: AnyAdventureContext | null,
  allowedDossierHandoutRecordIds?: string[],
  dossierHandoutBinding?: DossierHandoutBinding,
): ReactNode {
  switch (section.type) {
    case 'dialogue': {
      const portraitUrl = section.speaker ? resolveNpcPortrait(section.speaker) : undefined;
      return (
        <div key={key} className="my-3 flex items-start gap-3 pl-2">
          <div className="flex-shrink-0 mt-1">
            {portraitUrl ? (
              <SafeImage
                src={portraitUrl}
                alt={section.speaker || 'NPC'}
                className="w-10 h-10 rounded-full object-cover border border-brass/40 shadow-md grayscale"
              />
            ) : null}
            <div 
              className="w-10 h-10 rounded-full bg-brass/20 border border-brass/40 flex items-center justify-center text-brass text-xs font-bold shadow-md"
              style={{ display: portraitUrl ? 'none' : 'flex' }}
            >
              {getSpeakerInitials(section.speaker)}
            </div>
          </div>
          <div className="flex-1 border-l-2 border-brass/60 bg-brass/5 py-2 px-3 rounded-r-lg">
            {section.speaker && (
              <span className="text-brass text-xs font-semibold block mb-1">
                {section.speaker}
              </span>
            )}
            <p className="text-foreground/90 italic">
              „
              {section.content
                .replace(/^[\u201E\u201C\u201D\u0022]/, '')
                .replace(/[\u201E\u201C\u201D\u0022]$/, '')}
              &rdquo;
            </p>
          </div>
        </div>
      );
    }

    case 'handout':
      return renderHandout(section, key, adventureContext, allowedDossierHandoutRecordIds, dossierHandoutBinding);

    case 'roll':
      return (
        <div
          key={key}
          className="my-3 bg-brass/10 border border-brass/30 rounded-lg p-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-brass">🎲</span>
            <span className="text-brass font-mono text-sm">
              {section.content.replace(/^\[|\]$/g, '')}
            </span>
          </div>
        </div>
      );

    case 'whisper': {
      const isJournalUpdated = /zaktualizowano dziennik|journal updated/i.test(section.content);
      if (isJournalUpdated) {
        return (
          <div
            key={key}
            className="my-1.5 text-xs text-brass/75 font-serif italic tracking-wide select-none"
          >
            {section.content}
          </div>
        );
      }
      const isLocationExhausted = /lokacja zbadana wyczerpująco|location thoroughly searched/i.test(section.content);
      if (isLocationExhausted) {
        return (
          <div
            key={key}
            className="my-1.5 text-xs text-emerald-400/80 font-serif italic tracking-wide select-none flex items-center gap-1.5"
          >
            <span>✓</span>
            <span>{section.content}</span>
          </div>
        );
      }
      const isActReportUpdated = /zaktualizowano raport aktu|act report updated/i.test(section.content);
      if (isActReportUpdated) {
        return (
          <div
            key={key}
            className="my-1.5 text-xs text-brass/85 font-serif italic tracking-wide select-none flex items-center gap-1.5"
          >
            <span>📑</span>
            <span>{section.content}</span>
          </div>
        );
      }
      return (
        <div
          key={key}
          className="my-2 text-muted-foreground text-xs italic px-3 py-1 bg-muted/30 rounded"
        >
          ℹ️ {section.content}
        </div>
      );
    }

    case 'perspective':
      return renderPerspective(section, key, playerColors);

    case 'director-notes':
      return <DirectorNotes key={key} content={section.content} />;

    case 'narrative':
    default:
      return renderNarrativeWithImages(section.content, key, onImageClick, !dossierHandoutBinding);
  }
}
