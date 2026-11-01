import {
  cleanResponseText,
  sanitizeDiegeticProse,
  stripMultilineArtifacts,
} from '@/lib/parsers/text-cleaner';
describe('hidden lighting protocol', () => {
  it('does not leak IDs into prose or TTS', () => {
    const text =
      'Cisza. [SCENA:scene-prabuty-krypta-climax] [CUE:prabuty-time-anomaly] Kamień drży.';
    for (const clean of [
      cleanResponseText,
      sanitizeDiegeticProse,
      stripMultilineArtifacts,
    ]) {
      const result = clean(text);
      expect(result).not.toContain('scene-prabuty');
      expect(result).not.toContain('prabuty-time');
      expect(result).toContain('Kamień drży');
    }
  });
});
