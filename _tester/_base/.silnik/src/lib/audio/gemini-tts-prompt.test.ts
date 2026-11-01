import { buildGeminiTtsPrompt } from './gemini-tts-prompt';

describe('Gemini 3.1 performance prompt', () => {
  it.each(['pl-PL', 'en-US'])('keeps a verbatim %s transcript after the silent sections', (language) => {
    const text = 'Wait... „Czy to on?”\nDo not move!';
    const prompt = buildGeminiTtsPrompt(text, 'Speak with restrained concern.', language);
    expect(prompt.split('\nTRANSCRIPT:\n')).toEqual([expect.stringContaining("Director's Notes: Speak with restrained concern."), text]);
    expect(prompt.indexOf('Audio Profile:')).toBeLessThan(prompt.indexOf('Scene:'));
    expect(prompt.indexOf('Scene:')).toBeLessThan(prompt.indexOf("Director's Notes:"));
  });

  it('keeps the chosen language consistent when a legacy director says Polish', () => {
    const prompt = buildGeminiTtsPrompt('Hello.', 'Read in clear Polish pronunciation:', 'en-US');
    expect(prompt).toContain('clear English pronunciation');
    expect(prompt).not.toContain('Polish');
    expect(prompt).toContain('without theatrical exaggeration');
  });
});
