/**
 * Typy i interfejsy dla Wewnętrznego Kodeksu Technik MG i Scenopisarstwa
 * Call of Cthulhu 7e RAW / d100 Weird Fiction
 */

export type TechniqueId =
  // Pacing i rytm
  | 'bang_hard_move'
  | 'soft_move'
  | 'foreshadowing'
  | 'cut_to_action'
  | 'slow_burn'
  | 'value_charge_shift'
  // Postacie NPC
  | 'agenda_first'
  | 'social_leverage'
  | 'distinct_voice'
  | 'status_dynamic'
  | 'prep_situations'
  // Informacja i śledztwo
  | 'three_clue_rule'
  | 'fail_forward'
  | 'cognitive_anchor'
  | 'exposition_through_action'
  // Sensoryka
  | 'single_sensory_anchor'
  // Kognitywistyka grozy i atmosfera
  | 'vacuum_variable'
  | 'threshold_shift'
  // Reguły RAW i arbitraż sędziowski
  | 'referee_veto';

export type TechniqueCategory =
  | 'pacing'
  | 'npc'
  | 'investigation'
  | 'sensory'
  | 'atmosphere'
  | 'referee';

/**
 * 4 Biegi Kadencji wg Kompendium Narracji:
 * 1 = Ping-Pong (Staccato) - 20-60 słów
 * 2 = Szeroki Kadr (Establishing Shot) - 70-150 słów
 * 3 = Przełamanie / Cios (Hard Move) - 30-70 słów
 * 4 = Zawieszenie / Pustka (The Void) - 40-90 słów
 */
export type CadenceGear = 0 | 1 | 2 | 3 | 4;

export type SceneState =
  | 'dialogue'
  | 'investigation'
  | 'action'
  | 'tension_spike'
  | 'abyssal_reveal';

export type Locale = 'pl' | 'en';

export interface LocalizedString {
  pl: string;
  en: string;
}

export interface TechniqueDefinition {
  id: TechniqueId;
  name: LocalizedString;
  category: TechniqueCategory;
  cadence: CadenceGear;
  sceneStates: SceneState[];
  whenToUse: LocalizedString;
  directive: LocalizedString;
  antiPatterns: LocalizedString;
}
