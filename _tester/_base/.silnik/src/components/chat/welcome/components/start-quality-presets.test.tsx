import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StartQualityPresets } from './start-quality-presets';
import { loadAISettings } from '@/lib/ai-settings';
import { renderHandout } from '../../narrative/render-handout';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'pl',
}));
jest.mock('@/components/ui/document-viewer', () => ({
  DocumentViewer: () => <div>document</div>,
}));
jest.mock('@/components/ui/audio-reel-player', () => ({
  AudioReelPlayer: () => <div>audio</div>,
}));

describe('start quality selection', () => {
  beforeEach(() => localStorage.clear());
  it('starts with ULTRA and persists a MID selection', async () => {
    render(<StartQualityPresets />);
    expect(screen.getByTestId('start-preset-ultra')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getAllByRole('button')).toHaveLength(4);
    fireEvent.click(screen.getByTestId('start-preset-mid'));
    expect(loadAISettings().qualityPreset).toBe('mid');
    expect(loadAISettings().voiceSettings.enabled).toBe(false);
    expect(loadAISettings().imageGenerationEnabled).toBe(false);
    await waitFor(() =>
      expect(screen.getByTestId('start-preset-mid')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    );
  });
  it('preserves CUSTOM without selecting or overwriting a preset', () => {
    localStorage.setItem(
      'ai_settings',
      JSON.stringify({
        qualityPreset: 'custom',
        geminiSettings: { temperature: 0.23 },
      })
    );
    render(<StartQualityPresets />);
    expect(screen.getByRole('status')).toHaveTextContent('custom');
    for (const button of screen.getAllByRole('button'))
      expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(loadAISettings().geminiSettings.temperature).toBe(0.23);
  });
  it('disables selection during game start', async () => {
    render(<StartQualityPresets disabled />);
    await waitFor(() => {
      for (const button of screen.getAllByRole('button')) {
        expect(button).toBeDisabled();
      }
    });
  });
  it('keeps clue content as plain text in LOW, without image or audio', () => {
    localStorage.setItem(
      'ai_settings',
      JSON.stringify({ qualityPreset: 'low' })
    );
    render(
      <>
        {renderHandout(
          {
            type: 'handout',
            content: 'The suspect left at midnight.',
            handoutType: 'letter',
            imageUrl: '/letter.png',
            audioUrl: '/letter.mp3',
          },
          0
        )}
      </>
    );
    expect(screen.getByTestId('plain-text-handout')).toHaveTextContent(
      'The suspect left at midnight.'
    );
    expect(screen.getByTestId('plain-text-handout')).toHaveTextContent(
      '✉️ LIST'
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('audio')).not.toBeInTheDocument();
  });
  it('formats custom titles alongside document headers in LOW plain text', () => {
    localStorage.setItem(
      'ai_settings',
      JSON.stringify({ qualityPreset: 'low' })
    );
    render(
      <>
        {renderHandout(
          {
            type: 'handout',
            content: 'Meet me at the pier.',
            title: 'Depesza z portu',
            handoutType: 'telegram',
          },
          2
        )}
      </>
    );
    const element = screen.getByTestId('plain-text-handout');
    expect(element).toHaveTextContent('📧 TELEGRAM - Depesza z portu');
    expect(element).toHaveTextContent('Meet me at the pier.');
  });
  it('keeps diegetic handout formatting in MID mode', () => {
    localStorage.setItem(
      'ai_settings',
      JSON.stringify({ qualityPreset: 'mid' })
    );
    render(
      <>
        {renderHandout(
          {
            type: 'handout',
            content: 'Secret cipher found in desk.',
            handoutType: 'letter',
            imageUrl: '/letter.png',
          },
          1
        )}
      </>
    );
    expect(screen.queryByTestId('plain-text-handout')).not.toBeInTheDocument();
    expect(screen.getByText('Secret cipher found in desk.')).toBeInTheDocument();
  });
});
