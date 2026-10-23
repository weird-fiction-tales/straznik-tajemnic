import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let active = false;
const voices = { 'pl-PL': 'Zosia', 'en-US': 'Samantha' } as const;
export async function synthesizeMacOsSpeech(text: string, languageCode: string) {
  if (languageCode !== 'pl-PL' && languageCode !== 'en-US') throw new Error('LOCAL_TTS_LANGUAGE');
  if (!text.trim() || text.length > 6000) throw new Error('LOCAL_TTS_TEXT_LIMIT');
  if (process.platform !== 'darwin') throw new Error('LOCAL_TTS_UNAVAILABLE');
  if (active) throw new Error('LOCAL_TTS_BUSY');
  active = true;
  let directory: string | undefined;
  const run = (file: string, args: string[]) => new Promise<void>((resolve, reject) => {
    execFile(file, args, { timeout: 20000, maxBuffer: 65536, shell: false }, error => error ? reject(new Error('LOCAL_TTS_FAILED')) : resolve());
  });
  try {
    directory = await mkdtemp(join(tmpdir(), 'zew-local-tts-'));
    const input = join(directory, 'narration.txt');
    const aiff = join(directory, 'narration.aiff');
    const wav = join(directory, 'narration.wav');
    const voice = voices[languageCode as keyof typeof voices];
    await writeFile(input, text, { mode: 0o600 });
    await run('/usr/bin/say', ['-v', voice, '-o', aiff, '-f', input]);
    await run('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16@24000', aiff, wav]);
    const bytes = await readFile(wav);
    if (bytes.length <= 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error('LOCAL_TTS_INVALID_AUDIO');
    return { audioUrl: `data:audio/wav;base64,${bytes.toString('base64')}`, provider: languageCode === 'pl-PL' ? 'macos-zosia' : 'macos-samantha', voice };
  } finally {
    try { if (directory) await rm(directory, { recursive: true, force: true }); } finally { active = false; }
  }
}
