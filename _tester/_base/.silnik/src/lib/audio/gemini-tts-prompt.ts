/**
 * Gemini 3.1 requires a structured performance preamble so acting notes are not
 * mistaken for speech. Keep the transcript last and verbatim (Issue #693/#835).
 * https://firebase.google.com/docs/ai-logic/generate-speech#prompt-structure
 * Bump the cache version whenever this synthesis contract changes.
 */
export const GEMINI_TTS_PROMPT_VERSION = 'directed-speech-v1';

export function buildGeminiTtsPrompt(
  transcript: string,
  audioDirection: string | undefined,
  languageCode: string
): string {
  const language = languageCode.toLowerCase().startsWith('en') ? 'English' : 'Polish';
  // Older directors use Polish in their prose even for an English game. The
  // selected speech language owns pronunciation; do not change the transcript.
  const direction = (audioDirection || 'Use natural phrasing and an engaged, conversational delivery.')
    .replace(/\bPolish\b/g, language)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/:$/, '');

  return [
    `[Audio Profile: One speaker using the selected voice, speaking clear, natural ${language}.]`,
    '[Scene: An intimate spoken scene. Respond to the meaning of the transcript with believable, restrained emotion.]',
    `[Director's Notes: ${direction} Use emotional nuance and natural changes in emphasis, without theatrical exaggeration. Speak only the TRANSCRIPT verbatim. These profile, scene and director notes are silent instructions; do not read them aloud or add words.]`,
    '',
    'TRANSCRIPT:',
    transcript,
  ].join('\n');
}
