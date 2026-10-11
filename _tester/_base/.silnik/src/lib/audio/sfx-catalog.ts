/**
 * SFX Catalog & Sound Effects Registry
 *
 * Mapuje presetId na lokalne pliki audio w public/sounds/sfx/
 * oraz definiuje kalibrację głośności dla lektora TTS i muzyki w tle.
 */

export interface SFXDefinition {
  id: string;
  file: string;
  volume: number; // 0.0 - 1.0 (domyślnie 0.32 - tło pod lektora)
  category:
    | 'weapons'
    | 'trains'
    | 'city'
    | 'horror'
    | 'props'
    | 'nature'
    | 'combat';
  cooldownMs?: number;
}

export const SFX_CATALOG: Record<string, SFXDefinition> = {
  // --- Broń & Walka ---
  gunshot: { id: 'gunshot', file: '/sounds/sfx/gunshot.mp3', volume: 0.38, category: 'weapons' },
  revolver_shot: { id: 'revolver_shot', file: '/sounds/sfx/revolver_shot.mp3', volume: 0.38, category: 'weapons' },
  shotgun_blast: { id: 'shotgun_blast', file: '/sounds/sfx/shotgun_blast.mp3', volume: 0.40, category: 'weapons' },
  tommy_gun_burst: { id: 'tommy_gun_burst', file: '/sounds/sfx/tommy_gun_burst.mp3', volume: 0.38, category: 'weapons' },
  rifle_shot_bolt: { id: 'rifle_shot_bolt', file: '/sounds/sfx/rifle_shot_bolt.mp3', volume: 0.38, category: 'weapons' },
  pistol_9mm_shot: { id: 'pistol_9mm_shot', file: '/sounds/sfx/pistol_9mm_shot.mp3', volume: 0.38, category: 'weapons' },
  derringer_pocket_shot: { id: 'derringer_pocket_shot', file: '/sounds/sfx/derringer_pocket_shot.mp3', volume: 0.32, category: 'weapons' },
  empty_gun_click: { id: 'empty_gun_click', file: '/sounds/sfx/empty_gun_click.mp3', volume: 0.40, category: 'weapons' },
  explosion: { id: 'explosion', file: '/sounds/sfx/explosion.mp3', volume: 0.42, category: 'combat' },
  combat_ambience: { id: 'combat_ambience', file: '/sounds/sfx/combat_ambience.mp3', volume: 0.30, category: 'combat' },

  // --- Kolej & Pociągi ---
  train_rhythm_steam: { id: 'train_rhythm_steam', file: '/sounds/sfx/train_rhythm_steam.mp3', volume: 0.30, category: 'trains' },
  train_whistle_steam: { id: 'train_whistle_steam', file: '/sounds/sfx/train_whistle_steam.mp3', volume: 0.35, category: 'trains' },
  train_interior_ambience: { id: 'train_interior_ambience', file: '/sounds/sfx/train_interior_ambience.mp3', volume: 0.28, category: 'trains' },

  // --- Miasta per epoka ---
  city_ambience_1890s: { id: 'city_ambience_1890s', file: '/sounds/sfx/city_ambience_1890s.mp3', volume: 0.26, category: 'city' },
  city_ambience_1920s: { id: 'city_ambience_1920s', file: '/sounds/sfx/city_ambience_1920s.mp3', volume: 0.26, category: 'city' },
  city_ambience_1940s: { id: 'city_ambience_1940s', file: '/sounds/sfx/city_ambience_1940s.mp3', volume: 0.26, category: 'city' },
  city_ambience_1970s: { id: 'city_ambience_1970s', file: '/sounds/sfx/city_ambience_1970s.mp3', volume: 0.26, category: 'city' },
  city_ambience_1990s: { id: 'city_ambience_1990s', file: '/sounds/sfx/city_ambience_1990s.mp3', volume: 0.26, category: 'city' },
  city_ambience_modern: { id: 'city_ambience_modern', file: '/sounds/sfx/city_ambience_modern.mp3', volume: 0.26, category: 'city' },

  // --- Horror & Mitologia Cthulhu ---
  creaking_door: { id: 'creaking_door', file: '/sounds/sfx/creaking_door.mp3', volume: 0.32, category: 'horror' },
  heavy_door_creak: { id: 'heavy_door_creak', file: '/sounds/sfx/heavy_door_creak.mp3', volume: 0.32, category: 'horror' },
  door_slam: { id: 'door_slam', file: '/sounds/sfx/door_slam.mp3', volume: 0.36, category: 'horror' },
  whispers: { id: 'whispers', file: '/sounds/sfx/whispers.mp3', volume: 0.34, category: 'horror' },
  sanity_loss_whisper: { id: 'sanity_loss_whisper', file: '/sounds/sfx/sanity_loss_whisper.mp3', volume: 0.34, category: 'horror' },
  distant_scream: { id: 'distant_scream', file: '/sounds/sfx/distant_scream.mp3', volume: 0.35, category: 'horror' },
  heartbeat_panic: { id: 'heartbeat_panic', file: '/sounds/sfx/heartbeat_panic.mp3', volume: 0.36, category: 'horror' },
  eldritch_growl: { id: 'eldritch_growl', file: '/sounds/sfx/eldritch_growl.mp3', volume: 0.36, category: 'horror' },
  wet_tentacle_squelch: { id: 'wet_tentacle_squelch', file: '/sounds/sfx/wet_tentacle_squelch.mp3', volume: 0.34, category: 'horror' },
  ritual_chant: { id: 'ritual_chant', file: '/sounds/sfx/ritual_chant.mp3', volume: 0.32, category: 'horror' },
  groan: { id: 'groan', file: '/sounds/sfx/groan.mp3', volume: 0.32, category: 'horror' },
  glass_shatter_sanity: { id: 'glass_shatter_sanity', file: '/sounds/sfx/glass_shatter_sanity.mp3', volume: 0.36, category: 'horror' },
  metal_gate_chains: { id: 'metal_gate_chains', file: '/sounds/sfx/metal_gate_chains.mp3', volume: 0.34, category: 'horror' },

  // --- Rekwizyty & Otoczenie ---
  footsteps_wood: { id: 'footsteps_wood', file: '/sounds/sfx/footsteps_wood.mp3', volume: 0.32, category: 'props' },
  old_phone: { id: 'old_phone', file: '/sounds/sfx/old_phone.mp3', volume: 0.35, category: 'props' },
  rotary_dial_prl: { id: 'rotary_dial_prl', file: '/sounds/sfx/rotary_dial_prl.mp3', volume: 0.30, category: 'props' },
  dialup_modem: { id: 'dialup_modem', file: '/sounds/sfx/dialup_modem.mp3', volume: 0.32, category: 'props' },
  smartphone_vibrate: { id: 'smartphone_vibrate', file: '/sounds/sfx/smartphone_vibrate.mp3', volume: 0.38, category: 'props' },
  air_raid_siren: { id: 'air_raid_siren', file: '/sounds/sfx/air_raid_siren.mp3', volume: 0.35, category: 'props' },
  car_engine_1920s: { id: 'car_engine_1920s', file: '/sounds/sfx/car_engine_1920s.mp3', volume: 0.30, category: 'props' },
  horse_carriage_run: { id: 'horse_carriage_run', file: '/sounds/sfx/horse_carriage_run.mp3', volume: 0.32, category: 'props' },
  telegraph_morse: { id: 'telegraph_morse', file: '/sounds/sfx/telegraph_morse.mp3', volume: 0.30, category: 'props' },
  typewriter_typing: { id: 'typewriter_typing', file: '/sounds/sfx/typewriter_typing.mp3', volume: 0.32, category: 'props' },
  gramophone_scratch: { id: 'gramophone_scratch', file: '/sounds/sfx/gramophone_scratch.mp3', volume: 0.28, category: 'props' },
  clock_ticking: { id: 'clock_ticking', file: '/sounds/sfx/clock_ticking.mp3', volume: 0.28, category: 'props' },
  church_bell: { id: 'church_bell', file: '/sounds/sfx/church_bell.mp3', volume: 0.35, category: 'props' },
  wooden_chest_open: { id: 'wooden_chest_open', file: '/sounds/sfx/wooden_chest_open.mp3', volume: 0.32, category: 'props' },
  match_strike_candle: { id: 'match_strike_candle', file: '/sounds/sfx/match_strike_candle.mp3', volume: 0.34, category: 'props' },
  page_turn: { id: 'page_turn', file: '/sounds/sfx/page_turn.mp3', volume: 0.30, category: 'props' },
  dice_roll: { id: 'dice_roll', file: '/sounds/sfx/dice_roll.mp3', volume: 0.35, category: 'props' },

  // --- Natura & Żywioły ---
  thunder: { id: 'thunder', file: '/sounds/sfx/thunder.mp3', volume: 0.38, category: 'nature' },
  rain_heavy: { id: 'rain_heavy', file: '/sounds/sfx/rain_heavy.mp3', volume: 0.30, category: 'nature' },
  rain_window: { id: 'rain_window', file: '/sounds/sfx/rain_window.mp3', volume: 0.28, category: 'nature' },
  wind_howling: { id: 'wind_howling', file: '/sounds/sfx/wind_howling.mp3', volume: 0.30, category: 'nature' },
  ocean_waves: { id: 'ocean_waves', file: '/sounds/sfx/ocean_waves.mp3', volume: 0.30, category: 'nature' },
};

/**
 * Zwalnia deterministycznie zasoby elementu HTMLAudioElement (pause, src = '', load).
 */
export function releaseSFXAudioElement(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  try {
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.src = '';
    audio.load();
  } catch {
    // Ignoruj błędy w środowiskach bez pełnej implementacji Audio (np. jsdom)
  }
}

/**
 * Globalny odtwarzacz SFX offline z kalibracją głośności.
 */
export const SFX_ENABLED = true;
export const SFX_VOLUME_STORAGE_KEY = 'sfx_volume';
export const SFX_MUTED_STORAGE_KEY = 'sfx_muted';

export function getSFXVolume(): number {
  if (typeof window === 'undefined') return 1.0;
  try {
    const muted = window.localStorage.getItem(SFX_MUTED_STORAGE_KEY);
    if (muted === 'true') return 0;
    const val = window.localStorage.getItem(SFX_VOLUME_STORAGE_KEY);
    if (val !== null) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed)) return Math.max(0, Math.min(100, parsed)) / 100;
    }
  } catch {
    // fallback
  }
  return 1.0;
}

export function setSFXVolume(volume0to100: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SFX_VOLUME_STORAGE_KEY, String(Math.max(0, Math.min(100, volume0to100))));
  } catch {
    // fallback
  }
}

let currentSFXAudio: HTMLAudioElement | null = null;
const lastPlayedTimestamps: Record<string, number> = {};

export function stopCurrentSFX(): void {
  if (currentSFXAudio) {
    releaseSFXAudioElement(currentSFXAudio);
    currentSFXAudio = null;
  }
}

export function playSFX(presetId: string, customVolumeMultiplier: number = 1.0): void {
  if (!SFX_ENABLED) return;
  if (typeof window === 'undefined') return;

  const sfxDef = SFX_CATALOG[presetId];
  if (!sfxDef) {
    console.warn(`[SFX] Nieznany preset SFX: "${presetId}"`);
    return;
  }

  const userVolume = getSFXVolume();
  if (userVolume <= 0) {
    return;
  }

  // Cooldown anty-spamowy (min. 4 sekundy dla tego samego efektu)
  const now = Date.now();
  const lastPlayed = lastPlayedTimestamps[presetId] || 0;
  const cooldown = sfxDef.cooldownMs ?? 4000;
  if (now - lastPlayed < cooldown) {
    return;
  }
  lastPlayedTimestamps[presetId] = now;

  try {
    // Zwolnij poprzedni SFX jeśli istnieje
    if (currentSFXAudio) {
      if (currentSFXAudio.paused || sfxDef.category === 'weapons' || sfxDef.category === 'combat') {
        releaseSFXAudioElement(currentSFXAudio);
        currentSFXAudio = null;
      }
    }

    const audio = new Audio(sfxDef.file);
    const targetVolume = Math.min(1.0, Math.max(0.01, sfxDef.volume * customVolumeMultiplier * userVolume));
    audio.volume = targetVolume;

    // Audio Ducking: przyciszenie muzyki i lektora dla głośnych efektów uderzeniowych
    if (sfxDef.category === 'weapons' || sfxDef.category === 'combat' || presetId === 'thunder' || presetId === 'explosion') {
      window.dispatchEvent(
        new CustomEvent('zew:sfx-ducking', {
          detail: { durationMs: 1500 },
        })
      );
    }

    const cleanupThisAudio = () => {
      releaseSFXAudioElement(audio);
      if (currentSFXAudio === audio) {
        currentSFXAudio = null;
      }
    };
    audio.onended = cleanupThisAudio;
    audio.onerror = cleanupThisAudio;

    currentSFXAudio = audio;

    const playPromise = audio.play();
    if (playPromise !== undefined && typeof playPromise.catch === 'function') {
      playPromise.catch((err) => {
        console.warn(`[SFX] Błąd odtwarzania ${presetId}:`, err);
        cleanupThisAudio();
      });
    }
    console.log(`🔊 [SFX] Odtworzono: ${presetId} (plik: ${sfxDef.file}, vol: ${(targetVolume * 100).toFixed(0)}%)`);
  } catch (e) {
    console.warn(`[SFX] Wyjątek podczas odtwarzania ${presetId}:`, e);
  }
}
