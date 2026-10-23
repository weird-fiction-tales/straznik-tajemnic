/**
 * NarrativeFormatter types - IND-144 micro 1/8 (extract z NarrativeFormatter.tsx)
 *
 * Leaf module bez deps. Reuse przez: parse-sections, render-*, formatter, index.
 */

export type SectionType =
  | 'narrative'
  | 'dialogue'
  | 'handout'
  | 'mechanic'
  | 'roll'
  | 'whisper'
  | 'perspective'
  | 'director-notes';

export type HandoutType =
  | 'newspaper'
  | 'letter'
  | 'telegram'
  | 'report'
  | 'diary'
  | 'book'
  | 'map'
  | 'note';

export interface StickyNote {
  who: string;
  about: string;
  clue: string;
}

export interface Section {
  type: SectionType;
  content: string;
  title?: string;
  speaker?: string;
  /** Znak interpunkcyjny zapisany po zamykającym cudzysłowie kwestii. */
  punctuationAfterQuote?: string;
  handoutType?: HandoutType;
  handoutSlug?: string;
  stickyNote?: StickyNote;
  audioUrl?: string; // Opcjonalny URL nagrania audio / pliku dźwiękowego
  imageUrl?: string; // Opcjonalny URL skanu / ryciny / fotografii
  characterName?: string; // dla type='perspective' - imię postaci kierowanej
  characterColor?: string; // opcjonalny kolor ramki
}

export interface HandoutSection extends Section {
  type: 'handout';
  handoutSlug?: string;
}

