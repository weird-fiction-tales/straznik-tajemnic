import type { NextRequest } from 'next/server';
import { POST } from './route';

const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
  ThinkingLevel: { MINIMAL: 'MINIMAL' },
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

describe('POST /api/summarize-scene', () => {
  const makeRequest = (
    messages: Array<{ role: string; content: string }>,
    locale: 'pl' | 'en' = 'pl'
  ): NextRequest =>
    ({
      headers: { get: (name: string) => name.toLowerCase() === 'x-gemini-api-key' ? 'test-key' : null },
      json: async () => ({ messages, locale }),
    }) as unknown as NextRequest;

  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it('uses the entire scene transcript and returns a neutral recap with rumor attribution', async () => {
    const messages = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `Wiadomość sceny ${index + 1}`,
    }));
    messages[0].content = 'Stanisław twierdził, że list wysłano z doków.';
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        title: 'Rozmowa w archiwum',
        type: 'dialogue',
        summaryPl: 'Stanisław twierdził, że list wysłano z doków.',
        summaryEn: 'Stanisław claimed the letter had been sent from the docks.',
        location: 'Archiwum',
        npcs: ['Stanisław'],
      }),
    });

    const response = await POST(makeRequest(messages));
    const result = await response.json();
    const prompt = mockGenerateContent.mock.calls[0][0].contents[0].parts[0].text as string;

    expect(mockGenerateContent.mock.calls[0][0].config).toMatchObject({
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingLevel: 'MINIMAL' },
      responseMimeType: 'application/json',
    });
    expect(response.status).toBe(200);
    expect(prompt).toContain('Wiadomość sceny 12');
    expect(prompt).toContain('Stanisław twierdził, że list wysłano z doków.');
    expect(prompt).toContain('Wiadomości Badacza są deklaracjami lub pytaniami');
    expect(prompt).not.toContain('"significance"');
    expect(prompt).not.toContain('"playerActions"');
    expect(result.entry.content).toBe('Stanisław twierdził, że list wysłano z doków.');
    expect(result.summaries).toEqual({
      pl: 'Stanisław twierdził, że list wysłano z doków.',
      en: 'Stanisław claimed the letter had been sent from the docks.',
    });
  });

  it('does not invent a recap when the model returns invalid JSON', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'not json' });

    const response = await POST(
      makeRequest([
        { role: 'user', content: 'Zapytaliśmy o list.' },
        { role: 'assistant', content: 'Świadek milczał.' },
      ])
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Nie udało się wygenerować podsumowania sceny.',
    });
  });

  it('returns the English recap when the interface locale is English', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        title: 'Archive conversation',
        type: 'dialogue',
        summaryPl: 'Stanisław twierdził, że list wysłano z doków.',
        summaryEn: 'Stanisław claimed the letter had been sent from the docks.',
        location: 'Archive',
        npcs: ['Stanisław'],
      }),
    });

    const response = await POST(
      makeRequest(
        [
          { role: 'user', content: 'We asked about a letter.' },
          { role: 'assistant', content: 'The witness was silent.' },
        ],
        'en'
      )
    );

    expect((await response.json()).entry.content).toBe(
      'Stanisław claimed the letter had been sent from the docks.'
    );
  });
});
