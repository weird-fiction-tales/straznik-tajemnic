#!/usr/bin/env node
/**
 * scripts/bake-briefing-audio.mjs
 *
 * Skrypt generujący pre-baked briefingi audio (Aktowe Intro) dla spraw Quick i Startera.
 * Używa ElevenLabs API (jeśli ELEVENLABS_API_KEY jest w .env.local) lub diegetycznego fallbacku macOS 'say' + ffmpeg.
 *
 * Użycie:
 *   node scripts/bake-briefing-audio.mjs [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const MANIFEST_PATH = path.join(ROOT_DIR, 'public/audio/briefings/briefings-manifest.json');
const OUTPUT_DIR_PUBLIC = path.join(ROOT_DIR, 'public/audio/briefings');
const OUTPUT_DIR_ENGINE = path.join(ROOT_DIR, '_tester/_base/.silnik/public/audio/briefings');

function loadEnv() {
  const envPaths = [
    path.join(ROOT_DIR, '.env.local'),
    path.join(ROOT_DIR, '.env'),
    path.join(ROOT_DIR, '_tester/_base/.silnik/.env.local')
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  }
}

loadEnv();

const apiKey = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
const isDryRun = process.argv.includes('--dry-run');

console.log('🎙️ === GENERATOR BRIEFINGÓW AUDIO (AKTOWE INTRO) ===');
console.log(`ElevenLabs API Key: ${apiKey ? 'WYKRYTO' : 'BRAK (użycie syntezy systemowej)'}`);
console.log(`Tryb Dry-Run: ${isDryRun ? 'TAK' : 'NIE'}\n`);

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`❌ Brak pliku manifestu: ${MANIFEST_PATH}`);
  process.exit(1);
}

const items = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
console.log(`Załadowano pozycji z manifestu: ${items.length}\n`);

async function generate() {
  for (const item of items) {
    const targetFile = path.join(OUTPUT_DIR_PUBLIC, item.outputFilename);
    const targetDir = path.dirname(targetFile);

    if (fs.existsSync(targetFile)) {
      console.log(`⏭️ Pominięto (istnieje): ${item.outputFilename}`);
      syncToEngine(item.outputFilename);
      continue;
    }

    if (isDryRun) {
      console.log(`[DRY-RUN] Wygenerowano by: ${item.outputFilename} (${item.title}) - ${item.text.length} znaków`);
      continue;
    }

    fs.mkdirSync(targetDir, { recursive: true });

    if (apiKey) {
      console.log(`⏳ Generowanie ElevenLabs [${item.id}] (${item.title})...`);
      try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${item.elevenVoiceId}`, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
          },
          body: JSON.stringify({
            text: item.text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.52,
              similarity_boost: 0.88,
              style: 0.25,
              use_speaker_boost: true
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Błąd API ElevenLabs: ${response.status} ${response.statusText}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(targetFile, buffer);
        console.log(`✅ Zapisano ElevenLabs: ${item.outputFilename} (${buffer.length} bajtów)`);
        syncToEngine(item.outputFilename);
        continue;
      } catch (e) {
        console.error(`❌ Błąd przy ElevenLabs dla ${item.id}:`, e.message);
      }
    }

    // Fallback: macOS say + ffmpeg bandpass vintage filter
    console.log(`🎙️ Fallback systemowy say + ffmpeg [${item.id}]...`);
    try {
      const { execFileSync } = await import('child_process');
      const tempAiff = path.join(targetDir, `temp_${Date.now()}_${item.id}.aiff`);
      const macVoice = item.lang === 'en' ? 'Daniel' : 'Zosia';

      execFileSync('say', ['-v', macVoice, '-o', tempAiff, item.text], { stdio: 'ignore' });

      execFileSync('ffmpeg', [
        '-y',
        '-i', tempAiff,
        '-af', 'highpass=f=250,lowpass=f=3800,volume=1.2',
        '-codec:a', 'libmp3lame',
        '-b:a', '128k',
        targetFile,
      ], { stdio: 'ignore' });

      if (fs.existsSync(tempAiff)) {
        fs.unlinkSync(tempAiff);
      }
      console.log(`✅ Zapisano fallback audio: ${item.outputFilename}`);
      syncToEngine(item.outputFilename);
    } catch (e) {
      console.error(`❌ Błąd generowania fallback dla ${item.id}:`, e.message);
    }
  }

  console.log('\n🏁 Generowanie briefingów zakończone.');
}

function syncToEngine(relPath) {
  const src = path.join(OUTPUT_DIR_PUBLIC, relPath);
  const dst = path.join(OUTPUT_DIR_ENGINE, relPath);
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

generate().catch(err => {
  console.error('Błąd krytyczny:', err);
  process.exit(1);
});
