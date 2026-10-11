/**
 * @file light-director.test.ts
 * Testy jednostkowe dla Reżysera Światła (LightDirector).
 */

import { LightDirector } from './light-director';
import { HueClient } from './hue-client';

describe('LightDirector (Reżyser Światła CoC 7e)', () => {
  let client: HueClient;
  let director: LightDirector;

  beforeEach(() => {
    client = new HueClient({
      enabled: true,
      bridgeIp: '192.168.1.120',
      appKey: 'test-key',
      selectedLightIds: ['light-1'],
    });
    director = new LightDirector(client);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('wczytuje definicje presetów z pliku konfiguracyjnego (24 kanoniczne presety)', () => {
    const presets = director.getPresets();
    expect(Object.keys(presets)).toHaveLength(24);
    expect(presets.kerosene_lamp).toBeDefined();
    expect(presets.new_england_fog).toBeDefined();
    expect(presets.subterranean_dark).toBeDefined();
    expect(presets.cosmic_horror).toBeDefined();
    expect(presets.colour_out_of_space).toBeDefined();
    expect(presets.bloody_ritual).toBeDefined();
    expect(presets.frozen_rlyeh).toBeDefined();
    expect(presets.speakeasy_jazz).toBeDefined();
    expect(presets.prl_fluorescent).toBeDefined();
    expect(presets.investigator_study).toBeDefined();
    expect(presets.kerosene_lamp.brightness).toBe(35);
  });

  it('deterministycznie dopasowuje nastrój do pory dnia i cech lokacji', () => {
    expect(
      director.evaluateEnvironmentMood({ isOccultScene: true })
    ).toBe('cosmic_horror');

    expect(
      director.evaluateEnvironmentMood({ isUnderground: true })
    ).toBe('subterranean_dark');

    expect(
      director.evaluateEnvironmentMood({ isSanatoriumOrClinic: true })
    ).toBe('institutional_cold');

    expect(
      director.evaluateEnvironmentMood({ hour: 12, isOutdoor: true })
    ).toBe('new_england_fog');

    expect(
      director.evaluateEnvironmentMood({ hour: 23, isOutdoor: false })
    ).toBe('candlelight');

    expect(
      director.evaluateEnvironmentMood({ hour: 19, isOutdoor: false })
    ).toBe('kerosene_lamp');
  });

  it('obsługuje awaryjne włączenie światła (Emergency Light)', async () => {
    const applySpy = jest
      .spyOn(client, 'applyToSelectedLights')
      .mockResolvedValue();

    await director.triggerEmergencyLight();

    expect(applySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        on: { on: true },
        dimming: { brightness: 80 },
        color_temperature: { mirek: 370 },
      })
    );
  });

  it('wykonuje sekwencję szoku Poczytalności (SAN shock): ciemność i adaptacja wzroku', async () => {
    const applySpy = jest
      .spyOn(client, 'applyToSelectedLights')
      .mockResolvedValue();

    await director.triggerSanityShock();

    // Krok 1: natychmiastowe zgaśnięcie
    expect(applySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dimming: { brightness: 3 },
        dynamics: { duration: 200 },
      })
    );

    // Krok 2: powrót po upływie czasu
    jest.advanceTimersByTime(1300);

    expect(applySpy).toHaveBeenCalledTimes(2);
  });

  it('poprawnie klasyfikuje 12 nowych biomów na podstawie tekstu lokacji (Q1 -> C)', () => {
    expect(director.evaluateEnvironmentMood({ locationText: 'Gęsty las sosnowy koło Prabut' })).toBe('deep_forest');
    expect(director.evaluateEnvironmentMood({ locationText: 'Czarne mokradła i torfowisko' })).toBe('murky_swamp');
    expect(director.evaluateEnvironmentMood({ locationText: 'Opuszczona sztolnia kopalni Kowary' })).toBe('mine_shaft');
    expect(director.evaluateEnvironmentMood({ locationText: 'Skaliste wybrzeże i port rybacki' })).toBe('foggy_coast');
    expect(director.evaluateEnvironmentMood({ locationText: 'Zaułek w deszczu, ulica Marszałkowska' })).toBe('rainy_noir_street');
    expect(director.evaluateEnvironmentMood({ locationText: 'Krypta pod kościołem i stary grobowiec' })).toBe('monastery_crypt');
    expect(director.evaluateEnvironmentMood({ locationText: 'Rozdzielnia telewizji kablowej i radio' })).toBe('radio_shack_electronic');
    expect(director.evaluateEnvironmentMood({ locationText: 'Stare archiwum parafialne i biblioteka' })).toBe('parish_archive');
    expect(director.evaluateEnvironmentMood({ locationText: 'Cela aresztu śledczego i pokój przesłuchań' })).toBe('police_interrogation');
    expect(director.evaluateEnvironmentMood({ locationText: 'Zatopione ruiny w morskiej głębinie' })).toBe('abyssal_deep');
    expect(director.evaluateEnvironmentMood({ locationText: 'Płonący dwór i szalejący pożar' })).toBe('raging_fire');
    expect(director.evaluateEnvironmentMood({ locationText: 'Zamknięta izolatka szpitala psychiatrycznego' })).toBe('asylum_solitary');
    expect(director.evaluateEnvironmentMood({ locationText: 'Uderzył dziwny meteoryt i blask z kosmosu, kolor z innego świata' })).toBe('colour_out_of_space');
    expect(director.evaluateEnvironmentMood({ locationText: 'Krwawy ołtarz ofiarny i bluźnierczy rytuał' })).toBe('bloody_ritual');
    expect(director.evaluateEnvironmentMood({ locationText: 'Cyklopowe mury i lodowata otchłań zatopionego R\'lyeh' })).toBe('frozen_rlyeh');
    expect(director.evaluateEnvironmentMood({ locationText: 'Dym tytoniowy, nielegalny klub jazzowy i speakeasy' })).toBe('speakeasy_jazz');
    expect(director.evaluateEnvironmentMood({ locationText: 'Brzęcząca świetlówka na korytarzu milicji' })).toBe('prl_fluorescent');
    expect(director.evaluateEnvironmentMood({ locationText: 'Bezpieczny gabinet badaczy i narada przy biurku' })).toBe('investigator_study');
  });

  it('daje pierwszeństwo jawnemu wyborowi explicitMood przed tekstem lokacji', () => {
    expect(
      director.evaluateEnvironmentMood({
        explicitMood: 'cosmic_horror',
        locationText: 'Spokojny las sosnowy',
      })
    ).toBe('cosmic_horror');
  });

  it('stosuje modyfikatory Silnika Atmosferycznego na presety (Q2 -> B)', () => {
    const forestPreset = director.getPresets().deep_forest;
    const stormy = director.applyWeatherModifier(forestPreset, 'Gwałtowna nawałnica i burza');
    expect(stormy.brightness).toBeLessThan(forestPreset.brightness);
    expect(stormy.duration).toBe(2000);

    const foggy = director.applyWeatherModifier(forestPreset, 'Gęsta poranna mgła');
    expect(foggy.brightness).toBeLessThan(forestPreset.brightness);
    expect(foggy.duration).toBe(4500);
  });
});
