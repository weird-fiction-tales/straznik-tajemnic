import { render, cleanup } from '@testing-library/react';
import { NarrativeFormatter } from './index';
import { renderSection } from './render-sections';
import type { AnyAdventureContext } from '@/lib/handout-resolver';

// Media decoding is outside this test: assert that unauthorized URLs never reach either viewer.
jest.mock('@/components/ui/document-viewer', () => ({
  DocumentViewer: ({ imageUrl, title }: { imageUrl: string; title?: string }) => <img src={imageUrl} alt={title} />,
}));
jest.mock('@/components/ui/audio-reel-player', () => ({
  AudioReelPlayer: ({ audioUrl }: { audioUrl: string }) => <audio src={audioUrl} />,
}));
const adventure = { id: 'cien-nad-prabutami' } as AnyAdventureContext;
const binding = { adventureId: adventure.id!, editionFingerprint: 'sha256:' + 'a'.repeat(64) };

beforeEach(() => {
  localStorage.clear();
  // The media branch must be tested with images enabled, not hidden by free-tier text mode.
  localStorage.setItem('zew-app-api-keys', JSON.stringify({ GEMINI_TIER: 'paid' }));
  localStorage.setItem('ai_settings', JSON.stringify({ qualityPreset: 'high' }));
});
afterEach(cleanup);

it.each([
  '/handouts/cien-nad-prabutami/clue-herbal-recipe-152.webp',
  'https://example.invalid/not-authorized.webp',
  'data:image/png;base64,aGVsbG8=',
])('nie renderuje markdown URL %s przy aktywnym bindingu teczki', (url) => {
  const { container } = render(<NarrativeFormatter
    content={`Pozostaje widoczna narracja. ![Ukryty materiał](${url})`}
    adventureContext={adventure} dossierHandoutBinding={binding}
    allowedDossierHandoutRecordIds={['prabuty.media.clue-photo-prabuty-1947']} />);
  expect(container.querySelector('img')).toBeNull();
  expect(container.textContent).toContain('Pozostaje widoczna narracja.');
});

it('nie przepuszcza slugless obrazu ani audio do legacy rendererów z aktywną teczką', () => {
  const { container } = render(<>{renderSection({
    type: 'handout', content: 'Nieautoryzowany dokument.',
    imageUrl: 'https://example.invalid/secret.webp', audioUrl: 'https://example.invalid/secret.mp3',
  }, 0, undefined, undefined, adventure, [], binding)}</>);
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('audio')).toBeNull();
});

it('zachowuje istniejące markdown obrazy poza teczką', () => {
  const url = '/equipment/catalog/letter-shared.webp';
  const { container } = render(<NarrativeFormatter content={`![List](${url})`} />);
  expect(container.querySelector('img')?.getAttribute('src')).toBe(url);
});

it('zachowuje legacy slugless obraz i audio poza teczką', () => {
  const { container } = render(<>{renderSection({
    type: 'handout', content: 'List z nagraniem.',
    imageUrl: '/equipment/catalog/letter-shared.webp', audioUrl: '/audio/handouts/starter_friend_letter.mp3',
  }, 0)}</>);
  expect(container.querySelector('img')?.getAttribute('src')).toBe('/equipment/catalog/letter-shared.webp');
  expect(container.querySelector('audio')?.getAttribute('src')).toBe('/audio/handouts/starter_friend_letter.mp3');
});

it('nie wyświetla exact authored handoutu bez acquisition', () => {
  const { container } = render(<NarrativeFormatter
    content="[HANDOUT:prabuty.media.clue-photo-prabuty-1947]"
    adventureContext={adventure} dossierHandoutBinding={binding} allowedDossierHandoutRecordIds={[]} />);
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('audio')).toBeNull();
});
