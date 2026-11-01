import {
  findGoldMasterMatch,
  validateAdventureQualityGate,
} from '@/lib/pdf/gold-master-registry';
import type { CustomAdventure } from '@/lib/adventures-data';

describe('Gold Master Registry & Reject Gate (Issue #737)', () => {
  it('rozpoznaje Starter ZC (Nawiedzony dom) i ładuje certyfikowaną przygodę Gold Master z kompletem NPC i handoutów', () => {
    const starterSampleText = `
      Zew Cthulhu Księga Wprowadzająca. Starter d100.
      Scenariusz Nawiedzony dom. Posiadłość Waltera Corbitta w Bostonie.
      Steven Knott, Arty Wilmot, Ruth Blake, Vittorio Macario.
    `;

    const matched = findGoldMasterMatch(
      starterSampleText,
      'Zew_Cthulhu_Starter_7e.pdf',
      'starter-d100'
    );

    expect(matched).not.toBeNull();
    expect(matched?.title.toLowerCase()).toContain('nawiedzony dom');
    expect(matched?.graph?.npcs.map((n) => n.name)).toEqual(
      expect.arrayContaining([
        'Steven Knott',
        'Arty Wilmot',
        'Ruth Blake',
        'Walter Corbitt',
      ])
    );
    expect(matched?.graph?.nodes?.length).toBeGreaterThanOrEqual(5);
    expect(matched?.handouts?.length).toBe(14);
  });

  it('przepuszcza przez Bramkę Jakości kompletną certyfikowaną przygodę Gold Master', () => {
    const starterSampleText = `Zew Cthulhu Starter - Nawiedzony dom`.repeat(50);
    const matched = findGoldMasterMatch(
      starterSampleText,
      'ZC_Starter.pdf',
      'starter-d100'
    )!;

    const gate = validateAdventureQualityGate(matched, starterSampleText);
    expect(gate.isValid).toBe(true);
  });

  it('odrzuca w Bramce Jakości (Reject Gate) zepsuty plik PDF bez struktury scenariusza, postaci ani węzłów', () => {
    const corruptedAdventure: CustomAdventure = {
      id: 'corrupted-pdf-adv',
      title: 'Nieznany dokument',
      era: 'classic',
      eraLabel: 'Klasyczne lata 20.',
      yearRange: '1920',
      location: 'Nieznana',
      country: 'USA',
      tone: 'purist',
      themes: [],
      suggestedOccupations: [],
      suggestedArchetypes: [],
      hook: '',
      description: '',
      estimatedSessions: '1',
      playerCount: '1-4',
      difficulty: 'easy',
      isCustom: true,
      pdfUrl: '',
      geminiFileUri: '',
      fileName: 'pusty.pdf',
      uploadedAt: new Date().toISOString(),
      isAnalyzed: true,
      documentType: 'scenario',
      isCampaign: false,
      graph: {
        nodes: [],
        npcs: [],
        locations: [],
        clues: [],
        connections: [],
      },
      source: 'Własny',
      sourceCategory: 'custom',
    };

    const gate = validateAdventureQualityGate(
      corruptedAdventure,
      'Zbyt krótki tekst'
    );
    expect(gate.isValid).toBe(false);
    expect(gate.reason).toMatch(/węzłów|postaci|warstwa tekstowa/i);
  });
});
