import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GeminiSettings } from './gemini-settings';
import { defaultAISettings } from '@/lib/ai-settings/defaults';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));
jest.mock('@/lib/api-keys-service', () => ({ getApiKeyHeaders: () => ({}) }));
jest.mock('../../ui/tooltip', () => ({ HelpIcon: () => null }));

describe('Gemini voice preview', () => {
  const originalFetch = global.fetch;
  const originalAudio = global.Audio;

  afterEach(() => {
    global.fetch = originalFetch;
    global.Audio = originalAudio;
  });

  it.each([undefined, 0.9, 1.0, 1.3])('uses the interface language and saved speed %s or natural 1.0', async (speed) => {
    const play = jest.fn().mockResolvedValue(undefined);
    const audio = { playbackRate: 1, volume: 1, play };
    global.Audio = jest.fn(() => audio) as unknown as typeof Audio;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ audioUrl: 'blob:preview' }) });
    const settings = { ...defaultAISettings, voiceSettings: { ...defaultAISettings.voiceSettings } };
    if (speed === undefined) Reflect.deleteProperty(settings.voiceSettings, 'speed');
    else settings.voiceSettings.speed = speed;
    render(<GeminiSettings settings={settings} setSettings={jest.fn()} isLoading={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'playSample' }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    const request = JSON.parse(jest.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(request.languageCode).toBe('en-US');
    expect(audio.playbackRate).toBe(speed ?? 1.0);
  });
});
