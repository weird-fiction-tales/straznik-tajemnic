import fs from 'fs';
import path from 'path';
import {
  STREFA_11_ADVENTURES,
  AMERICAN_COLD_CASES_ADVENTURES,
  getQuickSetupAdventures,
  getAdventureById,
} from '@/lib/adventures-data';
import {
  getStrefa11CharactersForAdventure,
  AMERICAN_COLD_CASES_CHARACTERS,
} from '@/lib/immersion/strefa-11-characters';

describe('Strefa 11 & American Mythos Cold Cases Adventures & Handouts Assets (Issues #258-#261, #659)', () => {
  const publicDir = path.resolve(__dirname, '../../../public');

  it('każdy ze 4 scenariuszy Strefy 11 ma zdefiniowane co najmniej 3 predefiniowane handouty', () => {
    expect(STREFA_11_ADVENTURES).toHaveLength(4);
    for (const adv of STREFA_11_ADVENTURES) {
      expect(adv.isStrefa11).toBe(true);
      expect(adv.handouts).toBeDefined();
      expect(adv.handouts!.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('każdy handout w Strefie 11 posiada fizycznie istniejący plik obrazu PNG lub WebP na dysku', () => {
    for (const adv of STREFA_11_ADVENTURES) {
      for (const handout of adv.handouts || []) {
        expect(handout.image).toMatch(/^\/handouts\/.*\.(?:webp|png)$/);
        const diskPath = path.join(publicDir, handout.image);
        expect(fs.existsSync(diskPath)).toBe(true);
        const stats = fs.statSync(diskPath);
        expect(stats.size).toBeGreaterThan(1000); // nie pusty plik
        const bytes = fs.readFileSync(diskPath);
        if (handout.image.endsWith('.png')) expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
        else { expect(bytes.subarray(0,4).toString()).toBe('RIFF'); expect(bytes.subarray(8,12).toString()).toBe('WEBP'); }
      }
    }
  });

  it('każdy handout audio w Strefie 11 posiada fizycznie istniejący plik MP3 na dysku', () => {
    let audioHandoutCount = 0;
    for (const adv of STREFA_11_ADVENTURES) {
      for (const handout of adv.handouts || []) {
        if (handout.audioUrl) {
          audioHandoutCount++;
          expect(handout.audioUrl).toMatch(/^\/audio\/handouts\/.*\.mp3$/);
          const diskPath = path.join(publicDir, handout.audioUrl);
          expect(fs.existsSync(diskPath)).toBe(true);
          const stats = fs.statSync(diskPath);
          expect(stats.size).toBeGreaterThan(5000); // realne nagranie audio
        }
      }
    }
    expect(audioHandoutCount).toBe(4);
  });

  it('handouts-manifest.json zawiera poprawne wpisy dla wszystkich 4 nagrań Strefy 11 oraz 4 nagrań American Cold Cases', () => {
    const manifestPath = path.join(publicDir, 'audio/handouts/handouts-manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(Array.isArray(content)).toBe(true);

    const expectedIds = [
      'strefa11_prabuty_wiretap',
      'strefa11_kowary_crash',
      'strefa11_traszyn_interview',
      'strefa11_glogow_broadcast',
      'coldcase_holmes_cylinder_1893',
      'coldcase_franks_inquest_1924',
      'coldcase_circleville_wiretap_1977',
      'coldcase_ovidhall_voicemail_2005',
    ];

    for (const id of expectedIds) {
      const entry = content.find((item: { id: string }) => item.id === id);
      expect(entry).toBeDefined();
      expect(entry.text.length).toBeGreaterThan(50);
      expect(entry.outputFilename).toMatch(/\.mp3$/);
    }
  });

  it('Quick Setup rozdziela przygody wg locale (PL -> Strefa 11, EN -> American Mythos Cold Cases), a getAdventureById widzi wszystkie 8 (Issue #659)', () => {
    expect(getQuickSetupAdventures('pl').map((a) => a.id)).toEqual([
      'cien-nad-prabutami',
      'tajemnica-pendnika-lagiewki',
      'tajemnica-dzieci-z-traszyna',
      'przybysz-z-matriksa-glogow',
    ]);
    expect(getQuickSetupAdventures('en').map((a) => a.id)).toEqual([
      'englewood-murder-castle-1893',
      'almer-coe-spectacles-1924',
      'circleville-letters-1983',
      'ovidhall-lake-anomaly-2005',
    ]);

    for (const adv of [...STREFA_11_ADVENTURES, ...AMERICAN_COLD_CASES_ADVENTURES]) {
      expect(getAdventureById(adv.id)?.id).toBe(adv.id);
    }
  });

  it('każdy ze 4 scenariuszy American Mythos Cold Cases ma 5 węzłów, 12 wskazówek, 4 handouty (3 WebP + 1 MP3) oraz 4 asymetrycznych badaczy (Issue #659)', () => {
    expect(AMERICAN_COLD_CASES_ADVENTURES).toHaveLength(4);
    expect(AMERICAN_COLD_CASES_CHARACTERS).toHaveLength(16);

    let enAudioCount = 0;
    for (const adv of AMERICAN_COLD_CASES_ADVENTURES) {
      expect(adv.isAmericanColdCase).toBe(true);
      expect(adv.graph?.nodes).toHaveLength(5);
      expect(adv.graph?.clues).toHaveLength(12);
      expect(adv.graph?.connections).toHaveLength(12);
      expect(adv.secretsPool).toHaveLength(6);
      expect(adv.doomClock?.stages).toHaveLength(4);
      expect(adv.handouts).toHaveLength(4);

      const nodeIds = new Set((adv.graph?.nodes ?? []).map((n) => n.id));
      const chars = getStrefa11CharactersForAdventure(adv.id);
      expect(chars).toHaveLength(4);

      const startingNodes = new Set<string>();
      for (const char of chars) {
        expect(char.startingNodeId).toBeDefined();
        expect(nodeIds.has(char.startingNodeId!)).toBe(true);
        expect(char.openingHook?.length).toBeGreaterThan(40);
        startingNodes.add(char.startingNodeId!);
      }
      // Każdy z 4 badaczy w danym scenariuszu startuje w innym węźle śledztwa
      expect(startingNodes.size).toBe(4);

      for (const handout of adv.handouts || []) {
        expect(handout.image).toMatch(/^\/handouts\/.*\.webp$/);
        const imgDiskPath = path.join(publicDir, handout.image);
        expect(fs.existsSync(imgDiskPath)).toBe(true);
        expect(fs.statSync(imgDiskPath).size).toBeGreaterThan(1000);

        if (handout.audioUrl) {
          enAudioCount++;
          expect(handout.audioUrl).toMatch(/^\/audio\/handouts\/.*\.mp3$/);
          const audioDiskPath = path.join(publicDir, handout.audioUrl);
          expect(fs.existsSync(audioDiskPath)).toBe(true);
          expect(fs.statSync(audioDiskPath).size).toBeGreaterThan(5000);
        }
      }
    }
    expect(enAudioCount).toBe(4);
  });
});
