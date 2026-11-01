import { SFXRequest } from './types';

// ============================================================================
// GM PROTOCOL TAGS (Priorytet wysoki - strukturalne tagi generowane przez AI)
// ============================================================================

/** [NPC: Imię: Opis] */
export const TAG_NPC_PATTERN = /\[NPC:\s*([^:\]]+):\s*([^\]]+)\]/gi;

/** [LOKACJA: Nazwa: Opis] or [LOKACJA: Nazwa | Opis] or [LOCATION: Name: Description] (opis opcjonalny) */
export const TAG_LOCATION_PATTERN = /\[(?:LOKACJA|LOCATION):\s*([^:\]|]+)(?:[:|]\s*([^\]]+))?\]/gi;

/** [PRZEDMIOT: Nazwa: Opis] */
export const TAG_ITEM_PATTERN = /\[PRZEDMIOT:\s*([^:\]]+):\s*([^\]]+)\]/gi;

/** [MYŚLI_MG: treść] — ukryty monolog wewnętrzny AI (nie wyświetlany graczowi) */
export const TAG_GM_THOUGHTS_PATTERN = /\[(?:MYŚLI_MG|THOUGHTS):\s*([^\]]+)\]/gi;

/** [NASTRÓJ: przymiotnik] — dyrektywa tonu sceny */
export const TAG_MOOD_PATTERN = /\[NASTRÓJ:\s*([^\]]+)\]/gi;

/** [CEL_NARRACYJNY: opis] — intencja narracyjna sceny */
export const TAG_NARRATIVE_GOAL_PATTERN = /\[CEL_NARRACYJNY:\s*([^\]]+)\]/gi;

/** [WALKA: START] lub [WALKA: KONIEC] */
export const TAG_COMBAT_PATTERN = /\[WALKA:\s*(START|KONIEC)\]/gi;

/** [SANITY: (-N|NdM): powód] lub [SANITY: @Imię: (-N|NdM): powód] */
export const TAG_SANITY_PATTERN = /\[SANITY:\s*(?:@([^:\]]+):\s*)?([+-]?(?:\d+[dDkK]\d+(?:[+-]\d+)?|\d+))(?:\s*:\s*([^\]]+))?\]/gi;

// ============================================================================
// LEGACY PATTERNS (Fallback - wykrywanie z języka naturalnego)
// ============================================================================

// Wydarzenia - NPC
export const NPC_PATTERNS = [
    /spotykasz\s+([A-ZŻŹĆĄŚĘŁÓŃ][a-ząćęłńóśźż]+(?:\s+[A-ZŻŹĆĄŚĘŁÓŃ][a-ząćęłńóśźż]+)?)/gi,
    /poznajesc?\s+([A-ZŻŹĆĄŚĘŁÓŃ][a-ząćęłńóśźż]+(?:\s+[A-ZŻŹĆĄŚĘŁÓŃ][a-ząćęłńóśźż]+)?)/gi,
    /([A-ZŻŹĆĄŚĘŁÓŃ][a-ząćęłńóśźż]+(?:\s+[A-ZŻŹĆĄŚĘŁÓŃ][a-ząćęłńóśźż]+)?)\s+(?:mówi|pyta|odpowiada|szepcze|krzyczy)/gi,
    /(?:dr\.|doktor|profesor|pan|pani)\s+([A-ZŻŹĆĄŚĘŁÓŃ][a-ząćęłńóśźż]+)/gi,
];

// Wydarzenia - Lokacje
export const LOCATION_PATTERNS = [
    /(?:przybywacie?|wchodzisz|docierasz|znajdujesz się)\s+(?:do|w|na)\s+([A-ZŻŹĆĄŚĘŁÓŃ][^.!?]+)/gi,
    /(?:jesteś|znajdujesz się)\s+(?:w|na|przed)\s+([A-ZŻŹĆĄŚĘŁÓŃ][^.!?]+)/gi,
    /(?:Arkham|Innsmouth|Dunwich|Kingsport|Miskatonic)/gi,
];

// Wydarzenia - Przedmioty
export const ITEM_PATTERNS = [
    /znajdujesz\s+([^.!?]+)/gi,
    /otrzymujesz\s+([^.!?]+)/gi,
    /zabierasz\s+([^.!?]+)/gi,
    /(?:stary|tajemniczy|dziwny)\s+(notes|książk[ęa]|list|klucz|amulet|miecz|pistolet)/gi,
];

// Walka - Start
export const COMBAT_START_PATTERNS = [
    /walka\s+(?:rozpoczyna|zaczyna)\s+się/gi,
    /atakuje?\s+(?:cię|was|ciebie)/gi,
    /(?:rzuć|rzucaj)\s+(?:na\s+)?inicjatyw[ęy]/gi,
    /(?:rozpoczyna|zaczyna)\s+się\s+starcie/gi,
    /(?:napada|napadają)\s+(?:na\s+)?(?:ciebie|was)/gi,
];

// Walka - Obrażenia gracza
export const DAMAGE_PLAYER_PATTERNS = [
    /tracisz\s+(\d+)\s+punkt[ówy]?\s+życia/gi,
    /otrzymujesz\s+(\d+)\s+(?:punkt[ówy]?\s+)?obrażeń/gi,
    /(?:cios|atak)\s+zadaje\s+(?:ci\s+)?(\d+)\s+obrażeń/gi,
    /(\d+)\s+obrażeń/gi,
];

// Walka - Koniec
export const COMBAT_END_PATTERNS = [
    /walka\s+(?:kończy|dobiega)\s+się/gi,
    /pokonujesz\s+/gi,
    /(?:przeciwnik|wróg|potwór)\s+(?:pada|upada|ginie)/gi,
    /(?:uciekasz|wycofujesz się)/gi,
];

// Poczytalność
export const SANITY_PATTERNS = [
    /tracisz\s+(\d+)\s+punkt[ówy]?\s+poczytalności/gi,
    /(?:twoja\s+)?poczytalność\s+spada\s+o\s+(\d+)/gi,
    /test\s+poczytalności/gi,
];

// SFX Patterns - wzorce detekcji efektów dźwiękowych w narracji
export const SFX_PATTERNS: { pattern: RegExp; presetId: string; category: SFXRequest['category'] }[] = [
    // --- Broń & Walka (precyzyjne typy broni mają pierwszeństwo przed ogólnym gunshot) ---
    { pattern: /shotgun|strzelb[aąęy]|dubeltówk[aąęy]|obrzyn/gi, presetId: 'shotgun_blast', category: 'combat' },
    { pattern: /thompson|tommy gun|seri[aąę]\s+z\s+automatu|pistolet\s+maszynow/gi, presetId: 'tommy_gun_burst', category: 'combat' },
    { pattern: /karabin|sztucer|zamek\s+karabinu|przeładowan/gi, presetId: 'rifle_shot_bolt', category: 'combat' },
    { pattern: /derringer|mały\s+pistolet/gi, presetId: 'derringer_pocket_shot', category: 'combat' },
    { pattern: /9mm|glock|beretta|pistolet\s+półautomatyczn/gi, presetId: 'pistol_9mm_shot', category: 'combat' },
    { pattern: /pust[aey]\s+komor[aey]|suchy\s+klik|brak(?:ło)?\s+amunicji|zaciął\s+się/gi, presetId: 'empty_gun_click', category: 'combat' },
    { pattern: /strzał|wystrzał|pistolet|rewolwer|palb[aey]/gi, presetId: 'gunshot', category: 'combat' },
    { pattern: /eksplozja|wybuch|dynamit|granat/gi, presetId: 'explosion', category: 'combat' },

    // --- Pociąg & Kolej ---
    { pattern: /stukot\s+kół|pociąg\s+(?:sunie|pędzi|toczy|jedzie)|tu[- ]?tum|wagon(?:ie)?\s+kołysz/gi, presetId: 'train_rhythm_steam', category: 'ambient' },
    { pattern: /gwizd\s+lokomotywy|parowóz\s+gwizd/gi, presetId: 'train_whistle_steam', category: 'ambient' },

    // --- Horror & Zjawiska Nadprzyrodzone ---
    { pattern: /skrzypią?ce?\s+(?:drzwi|podłog|schod|wrot)|zawiasy\s+skrzypi/gi, presetId: 'creaking_door', category: 'horror' },
    { pattern: /ciężkie\s+wrota|masywne\s+drzwi/gi, presetId: 'heavy_door_creak', category: 'horror' },
    { pattern: /trzasn(?:ięcie|ęły|ął)\s+drzwiami|zatrzasn/gi, presetId: 'door_slam', category: 'horror' },
    { pattern: /szept|szepcze|szepnął|obce\s+głosy/gi, presetId: 'whispers', category: 'supernatural' },
    { pattern: /krzyk|wrzask|wrzasnął/gi, presetId: 'distant_scream', category: 'horror' },
    { pattern: /bicie\s+serca|tętno\s+dudni|puls\s+wali|panik/gi, presetId: 'heartbeat_panic', category: 'horror' },
    { pattern: /warkot|ryk\s+bestii|nieludzki\s+ryk|pomruk\s+monstrum|bulgot/gi, presetId: 'eldritch_growl', category: 'horror' },
    { pattern: /mack[aąęi]|oślizgł|śluz|wijąc[aey]ch\s+się/gi, presetId: 'wet_tentacle_squelch', category: 'supernatural' },
    { pattern: /rytuał|zaklęcie|inkantacj|chorał/gi, presetId: 'ritual_chant', category: 'supernatural' },
    { pattern: /jęk|jęczy|stęka/gi, presetId: 'groan', category: 'horror' },
    { pattern: /pękł[aoy]\s+lustr|tłuczone\s+szkł|odłamki\s+szkła|brzęk\s+szyb/gi, presetId: 'glass_shatter_sanity', category: 'horror' },
    { pattern: /łańcuch[yów]|kłódk[aąę]|bram[aey]\s+cmentar/gi, presetId: 'metal_gate_chains', category: 'horror' },

    // --- Rekwizyty & Dźwięki Epokowe ---
    { pattern: /powóz|bryczk[aąę]|dorożk[aąę]|końsk[ieych]\s+kopyt|tętent/gi, presetId: 'horse_carriage_run', category: 'city_1920s' },
    { pattern: /telegraf|morse|stukanie\s+klucza/gi, presetId: 'telegraph_morse', category: 'city_1920s' },
    { pattern: /maszyn[aey]\s+do\s+pisania|czcionk[aey]\s+maszyny/gi, presetId: 'typewriter_typing', category: 'city_1920s' },
    { pattern: /gramofon|płyt[aey]\s+winyl|igł[aey]\s+na\s+płycie/gi, presetId: 'gramophone_scratch', category: 'city_1920s' },
    { pattern: /syren[aąę]\s+przeciwlotnicz|alarm\s+lotniczy/gi, presetId: 'air_raid_siren', category: 'city_1920s' },
    { pattern: /telefon.*tarcza|wybiera(?:sz)?\s+numer\s+na\s+tarczy|aparat\s+RWT/gi, presetId: 'rotary_dial_prl', category: 'city_1920s' },
    { pattern: /modem|dial[- ]?up|0202122|dźwięk\s+łączenia\s+z\s+internet/gi, presetId: 'dialup_modem', category: 'city_1920s' },
    { pattern: /wibracj[aey]\s+telefonu|smartfon.*wibruje|piknięcie\s+komórk/gi, presetId: 'smartphone_vibrate', category: 'city_1920s' },
    { pattern: /dzwonienie?\s+telefon|aparat\s+dzwoni/gi, presetId: 'old_phone', category: 'city_1920s' },
    { pattern: /samochód|auto|silnik\s+(?:forda|pojazdu)|klakson/gi, presetId: 'car_engine_1920s', category: 'city_1920s' },
    { pattern: /kufer|skrzyni[aąę]|otwiera(?:sz)?\s+wieko/gi, presetId: 'wooden_chest_open', category: 'ambient' },
    { pattern: /zapałk[aąęi]|płomień\s+świec|rozpala(?:sz)?\s+ogień/gi, presetId: 'match_strike_candle', category: 'ambient' },
    { pattern: /kroki|stąpanie|kroczenie/gi, presetId: 'footsteps_wood', category: 'ambient' },
    { pattern: /zegar|tyka|wybija/gi, presetId: 'clock_ticking', category: 'ambient' },
    { pattern: /kościół|dzwon|bije\s+dzwon/gi, presetId: 'church_bell', category: 'city_1920s' },

    // --- Natura & Żywioły ---
    { pattern: /grzmot|błyskawica|piorun/gi, presetId: 'thunder', category: 'nature' },
    { pattern: /deszcz|pada|ulewa/gi, presetId: 'rain_heavy', category: 'nature' },
    { pattern: /wiatr|wieje|szum\s+wichru/gi, presetId: 'wind_howling', category: 'nature' },
    { pattern: /fale|morze|ocean|przybrzeżn/gi, presetId: 'ocean_waves', category: 'nature' },
];
