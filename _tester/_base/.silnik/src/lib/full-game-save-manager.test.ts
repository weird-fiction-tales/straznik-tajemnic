import type { AISettings } from './ai-settings';
import type { HotSeatConfig, Character } from './types';
import { FullGameSaveManager } from './full-game-save-manager';
import type { WorldSetupBundleV1 } from './world-setup';
import { PREDEFINED_CHARACTERS } from './immersion/predefined-characters';

describe('FullGameSaveManager duet persistence', () => {
  it('preserves a dossier clue record ID across a full save and load', () => {
    const character: Character = {
      ...PREDEFINED_CHARACTERS[0],
      id: 'char-dossier-clue',
      investigatorDossier: {
        clues: [{
          id: 'player-clue-1',
          dossierRecordId: 'adventure.synthetic.clue.lead',
          title: 'Ślad w archiwum',
          description: 'Zapisany testowy ślad.',
          category: 'document',
          status: 'confirmed',
          discoveryStatus: 'discovered',
          epistemicLayer: 'player_clue',
        }],
        npcs: [],
        locations: [],
        notes: [],
      },
    };
    const save = FullGameSaveManager.createFullSave({
      name: 'Dossier clue save',
      userId: 'local',
      messages: [],
      gameSettings: { aiSettings: {} as AISettings },
      characters: [character],
      campaigns: [],
      npcs: [],
      locations: [],
    });

    const loaded = FullGameSaveManager.decompressSave(
      FullGameSaveManager.compressSave(save)
    );

    expect(loaded?.characters[0].investigatorDossier?.clues[0]).toMatchObject({
      id: 'player-clue-1',
      dossierRecordId: 'adventure.synthetic.clue.lead',
      discoveryStatus: 'discovered',
    });
  });

  it('preserves scene chronicle text across a full save and load', () => {
    const character: Character = {
      ...PREDEFINED_CHARACTERS[0],
      id: 'char-chronicle',
      chronicleSession: { playthroughId: 'run', campaignDefinitionId: 'scenario', adventureId: 'archive', sessionId: 'session-1', sessionNumber: 1, closedByMessageId: 'end' },
      sceneCards: [
        {
          id: 'scene-card-chronicle',
          sceneNumber: 1,
          chronicleChapter: { playthroughId: 'run', campaignDefinitionId: 'scenario', adventureId: 'archive', adventureTitle: 'Archiwum', sessionId: 'session-1', sessionNumber: 1 },
          location: 'Archiwum',
          title: 'Wizyta w archiwum',
          timestamp: '2026-10-10T10:00:00.000Z',
          people: ['Stanisław'],
          findings: ['Telegram'],
          keyTakeaways: ['Stanisław wspomniał o dokach.'],
          chronicleSummaryByLocale: {
            pl: 'Stanisław twierdził, że list wysłano z doków.',
            en: 'Stanisław claimed the letter came from the docks.',
          },
          isSealed: true,
        },
      ],
    };
    const save = FullGameSaveManager.createFullSave({
      name: 'Chronicle roundtrip',
      userId: 'local',
      messages: [],
      gameSettings: { aiSettings: {} as AISettings },
      characters: [character],
      campaigns: [],
      npcs: [],
      locations: [],
    });

    const loaded = FullGameSaveManager.decompressSave(
      FullGameSaveManager.compressSave(save)
    );

    expect(
      loaded?.characters[0].sceneCards?.[0].chronicleSummaryByLocale
    ).toEqual({
      pl: 'Stanisław twierdził, że list wysłano z doków.',
      en: 'Stanisław claimed the letter came from the docks.',
    });
    expect(loaded?.characters[0].chronicleSession).toEqual(character.chronicleSession);
    expect(loaded?.characters[0].sceneCards?.[0].chronicleChapter).toEqual(character.sceneCards?.[0].chronicleChapter);
  });

  it('writes save version 2.1.0 and preserves campaign memory identity', () => {
    const campaignMemory = {
      schemaVersion: 1 as const,
      campaignDefinitionId: 'masks-of-nyarlathotep',
      playthroughId: 'run-one',
      adventureId: 'masks-of-nyarlathotep',
      kind: 'official' as const,
    };
    const save = FullGameSaveManager.createFullSave({
      name: 'Campaign memory',
      userId: 'local',
      messages: [],
      gameSettings: { aiSettings: {} as AISettings },
      characters: [],
      campaigns: [],
      campaignMemory,
      memorySnapshot: { schemaVersion: 1, scope: campaignMemory, revision: 4, entries: [], checkpoints: [] },
      npcs: [],
      locations: [],
    });

    expect(save.version).toBe('2.1.0');
    expect(FullGameSaveManager.decompressSave(JSON.stringify(save))?.campaignMemory)
      .toEqual(campaignMemory);
    expect(FullGameSaveManager.decompressSave(FullGameSaveManager.compressSave(save))?.memorySnapshot)
      .toEqual(save.memorySnapshot);
  });

  it('round-trips edition-bound dossier world state with the full save', () => {
    const dossierWorldState = {
      schemaVersion: 1 as const,
      playthroughId: 'run-one',
      adventureId: 'ancient-trees',
      editionFingerprint: `sha256:${'a'.repeat(64)}`,
      objects: [{ entityId: 'obj-hoist', state: 'disabled', updatedByTurnId: 'turn-1', lastTransitionId: 'disable' }],
      appliedTurnIds: ['turn-1'],
    };
    const save = FullGameSaveManager.createFullSave({
      name: 'Dossier world state',
      userId: 'local',
      messages: [],
      gameSettings: { aiSettings: {} as AISettings },
      characters: [],
      campaigns: [],
      dossierWorldState,
      npcs: [],
      locations: [],
    });

    expect(FullGameSaveManager.decompressSave(FullGameSaveManager.compressSave(save))?.dossierWorldState)
      .toEqual(dossierWorldState);
  });

  it('loads a 2.0.0 save without campaign memory and without dropping data', () => {
    const save = FullGameSaveManager.createFullSave({
      name: 'Legacy 2.0 campaign',
      userId: 'local',
      messages: [],
      gameSettings: { aiSettings: {} as AISettings },
      characters: [],
      campaigns: [],
      npcs: [],
      locations: [],
    });
    save.version = '2.0.0';
    delete save.campaignMemory;
    const restored = FullGameSaveManager.decompressSave(JSON.stringify(save));
    expect(restored?.version).toBe('2.0.0');
    expect(restored?.name).toBe('Legacy 2.0 campaign');
    expect(restored?.campaignMemory).toBeUndefined();
  });

  it('keeps explicit player-to-character assignments in the save payload', () => {
    const hotSeatConfig: HotSeatConfig = {
      enabled: true,
      activePlayerIndex: 0,
      allowInterruptions: true,
      showPlayerIndicator: true,
      players: [
        {
          id: 'player-1',
          name: 'Aga',
          color: '#4ade80',
          characterId: 'character-1',
          isActive: true,
          turnCount: 0,
        },
        {
          id: 'player-2',
          name: 'Bartek',
          color: '#f472b6',
          characterId: 'character-2',
          isActive: false,
          turnCount: 0,
        },
      ],
    };

    const save = FullGameSaveManager.createFullSave({
      name: 'Duet',
      userId: 'local',
      messages: [],
      gameSettings: { aiSettings: {} as AISettings },
      characters: [],
      hotSeatConfig,
      campaigns: [],
      npcs: [],
      locations: [],
    });

    expect(save.hotSeatConfig).toEqual(hotSeatConfig);
  });

  it('keeps the equipment visual era required for catalog migration', () => {
    const save = FullGameSaveManager.createFullSave({
      name: 'PRL',
      userId: 'local',
      messages: [],
      gameSettings: { aiSettings: {} as AISettings },
      equipmentVisualEra: 'prl-1970s',
      characters: [],
      campaigns: [],
      npcs: [],
      locations: [],
    });

    const restored = FullGameSaveManager.decompressSave(
      FullGameSaveManager.compressSave(save)
    );

    expect(restored?.equipmentVisualEra).toBe('prl-1970s');
  });

  it('loads a v0.9.3-compatible save without worldSetup', () => {
    const save = FullGameSaveManager.createFullSave({
      name: 'Legacy compatible',
      userId: 'local',
      messages: [],
      gameSettings: { aiSettings: {} as AISettings },
      characters: [],
      campaigns: [],
      npcs: [],
      locations: [],
    });

    delete save.worldSetup;
    expect(FullGameSaveManager.decompressSave(JSON.stringify(save))?.worldSetup).toBeUndefined();
  });

  it('persists the versioned world setup canon', () => {
    const worldSetup = {
      schemaVersion: 1,
      id: 'world-1',
      scenarioId: 'scenario-1',
      adventureTitle: 'Test',
      createdAt: '2026-08-31T00:00:00.000Z',
      canonRevision: 1,
      eraContext: {
        schemaVersion: 1,
        sceneDate: null,
        effectiveYear: 2001,
        countryCode: 'PL',
        regionProfile: 'PL',
        source: 'user-selection',
        rulesVersion: '1.0.0',
      },
      eraManifestId: 'pl-2000-2005',
      adventureGraph: {},
      factions: [],
      npcs: [],
      locations: [],
      items: [],
      events: [],
      openingScene: {},
      nearestBranches: [],
      adventureContent: 'Treść testowa',
      supplementalInformation: [],
      sources: [],
      knowledgeGaps: [],
      exceptions: [],
      phaseResults: [],
    } satisfies WorldSetupBundleV1;
    const save = FullGameSaveManager.createFullSave({
      name: 'New canon',
      userId: 'local',
      messages: [],
      gameSettings: { aiSettings: {} as AISettings },
      characters: [],
      campaigns: [],
      npcs: [],
      locations: [],
      worldSetup,
    });

    const restored = FullGameSaveManager.decompressSave(JSON.stringify(save));
    expect(restored?.worldSetup).toEqual(worldSetup);
  });

  it('preserves investigatorBoard and initializes clean investigatorDossier in characters round-trip', () => {
    const boardState = {
      nodes: [
        {
          id: 'node-1',
          type: 'clue' as const,
          title: 'Tajemniczy medalion',
          description: 'Znaleziony w dokach',
          status: 'confirmed' as const,
          position: { x: 120, y: 300 },
          createdAt: '2026-09-06T00:00:00.000Z',
          tags: ['okultyzm'],
        },
      ],
      relations: [
        {
          id: 'conn-1',
          fromNodeId: 'node-1',
          toNodeId: 'node-2',
          label: 'powiązany z',
          color: '#c5a059',
        },
      ],
      viewport: { zoom: 1, panX: 0, panY: 0 },
      lastUpdated: '2026-09-06T00:00:00.000Z',
    };

    // Postać ze starym journalem i bez zainicjalizowanego dossier
    const character = {
      id: 'char-1',
      name: 'Thomas Malone',
      str: 50,
      dex: 60,
      con: 55,
      app: 45,
      pow: 70,
      edu: 75,
      siz: 65,
      int: 80,
      luck: 50,
      hp: 12,
      san: 70,
      mp: 14,
      skills: {},
      occupation: 'Detektyw',
      age: 38,
      background: 'Policja nowojorska',
      playerName: 'Kuba',
      isActive: true,
      lastUsed: new Date(),
      notes: '',
      experience: { totalXP: 0, availableXP: 0, earnedThisSession: 0, maxEarnedThisSession: 10 },
      developmentHistory: [],
      journal: [
        {
          id: 'clue-1',
          title: 'Krwawy ślad',
          content: 'Ślad krwi prowadzi ku piwnicy',
          type: 'clue' as const,
          category: 'forensic',
          timestamp: new Date(),
          tags: ['poszlaka', 'ślad'],
        },
      ],
    };

    const save = FullGameSaveManager.createFullSave({
      name: 'Dossier Roundtrip',
      userId: 'local',
      messages: [],
      gameSettings: { aiSettings: {} as AISettings },
      characters: [character as unknown as Character],
      investigatorBoard: boardState,
      campaigns: [],
      npcs: [],
      locations: [],
    });

    const serialized = FullGameSaveManager.compressSave(save);
    const loaded = FullGameSaveManager.decompressSave(serialized);

    expect(loaded?.investigatorBoard).toEqual(boardState);
    expect(loaded?.characters[0].investigatorDossier).toBeDefined();
    expect(loaded?.characters[0].investigatorDossier?.clues).toHaveLength(1);
    expect(loaded?.characters[0].investigatorDossier?.clues[0].title).toBe('Krwawy ślad');
  });

  describe('locale field in FullGameSave (Issue #490)', () => {
    it('serializes and deserializes locale during save/load round-trip', () => {
      const saveEn = FullGameSaveManager.createFullSave({
        name: 'English Save',
        userId: 'local',
        locale: 'en',
        messages: [],
        gameSettings: { aiSettings: {} as AISettings },
        characters: [],
        campaigns: [],
        npcs: [],
        locations: [],
      });

      expect(saveEn.locale).toBe('en');
      const loadedEn = FullGameSaveManager.decompressSave(
        FullGameSaveManager.compressSave(saveEn)
      );
      expect(loadedEn?.locale).toBe('en');

      const savePl = FullGameSaveManager.createFullSave({
        name: 'Polish Save',
        userId: 'local',
        locale: 'pl',
        messages: [],
        gameSettings: { aiSettings: {} as AISettings },
        characters: [],
        campaigns: [],
        npcs: [],
        locations: [],
      });

      expect(savePl.locale).toBe('pl');
      const loadedPl = FullGameSaveManager.decompressSave(
        FullGameSaveManager.compressSave(savePl)
      );
      expect(loadedPl?.locale).toBe('pl');
    });

    it('retains backward compatibility when locale is absent (legacy saves)', () => {
      const saveLegacy = FullGameSaveManager.createFullSave({
        name: 'Legacy Save Without Locale',
        userId: 'local',
        messages: [],
        gameSettings: { aiSettings: {} as AISettings },
        characters: [],
        campaigns: [],
        npcs: [],
        locations: [],
      });

      expect(saveLegacy.locale).toBeUndefined();
      const loadedLegacy = FullGameSaveManager.decompressSave(
        FullGameSaveManager.compressSave(saveLegacy)
      );
      expect(loadedLegacy?.locale).toBeUndefined();

      const migrated = FullGameSaveManager.migrateLegacySave({
        name: 'Old Format',
        userId: 'local',
        messages: [],
      });
      expect(migrated?.locale).toBeUndefined();

      const migratedWithLocale = FullGameSaveManager.migrateLegacySave({
        name: 'Old Format With Locale',
        userId: 'local',
        locale: 'en',
        messages: [],
      });
      expect(migratedWithLocale?.locale).toBe('en');
    });

    it('validates locale correctly in validateSave', () => {
      const baseSave = FullGameSaveManager.createFullSave({
        name: 'Validation test',
        userId: 'local',
        messages: [],
        gameSettings: { aiSettings: {} as AISettings },
        characters: [],
        campaigns: [],
        npcs: [],
        locations: [],
      });

      // undefined locale is valid (backward compat)
      expect(FullGameSaveManager.validateSave({ ...baseSave, locale: undefined })).toBe(true);
      // 'pl' and 'en' are valid
      expect(FullGameSaveManager.validateSave({ ...baseSave, locale: 'pl' })).toBe(true);
      expect(FullGameSaveManager.validateSave({ ...baseSave, locale: 'en' })).toBe(true);

      // Other values are invalid
      expect(FullGameSaveManager.validateSave({ ...baseSave, locale: 'de' as unknown as 'pl' })).toBe(false);
      expect(FullGameSaveManager.validateSave({ ...baseSave, locale: 'fr' as unknown as 'en' })).toBe(false);
      expect(FullGameSaveManager.validateSave({ ...baseSave, locale: 123 as unknown as 'pl' })).toBe(false);
    });

    it('sanitizes invalid locale in createFullSave and migrateLegacySave to undefined', () => {
      const saveInvalid = FullGameSaveManager.createFullSave({
        name: 'Invalid Locale Save',
        userId: 'local',
        locale: 'de' as unknown as 'pl',
        messages: [],
        gameSettings: { aiSettings: {} as AISettings },
        characters: [],
        campaigns: [],
        npcs: [],
        locations: [],
      });
      expect(saveInvalid.locale).toBeUndefined();
      expect(FullGameSaveManager.validateSave(saveInvalid)).toBe(true);

      const migratedCorrupt = FullGameSaveManager.migrateLegacySave({
        name: 'Corrupt Legacy',
        userId: 'local',
        locale: 'fr' as unknown as 'pl',
        messages: [],
      });
      expect(migratedCorrupt?.locale).toBeUndefined();
      expect(FullGameSaveManager.validateSave(migratedCorrupt!)).toBe(true);
    });

    it('re-validates and normalizes locale when decompressing saves with invalid locale', () => {
      const corruptCompressed = JSON.stringify({
        id: 'save_corrupt_1',
        name: 'Corrupt Compressed Save',
        version: '2.1.0',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        userId: 'local',
        locale: 'de',
        messages: [],
        images: [],
        descriptions: [],
        gameSettings: { aiSettings: {} },
        characters: [],
        campaigns: [],
        npcs: [],
        locations: [],
        activeGameState: {},
        pdfMemory: {},
        gmTools: {},
        notes: '',
        sessionMetadata: {
          startTime: '',
          endTime: '',
          duration: 0,
          messageCount: 0,
          imageCount: 0,
          sessionCost: 0,
        },
      });

      const decompressed = FullGameSaveManager.decompressSave(corruptCompressed);
      expect(decompressed).not.toBeNull();
      expect(decompressed?.locale).toBeUndefined();
      expect(FullGameSaveManager.validateSave(decompressed!)).toBe(true);
    });

    it('sanitizes locale in addToSavesList and getSavesList', () => {
      localStorage.clear();
      const baseSave = FullGameSaveManager.createFullSave({
        id: 'save_list_test',
        name: 'List test',
        userId: 'local',
        locale: 'en',
        messages: [],
        gameSettings: { aiSettings: {} as AISettings },
        characters: [],
        campaigns: [],
        npcs: [],
        locations: [],
      });

      FullGameSaveManager.addToSavesList(baseSave);
      const saves = FullGameSaveManager.getSavesList();
      expect(saves).toHaveLength(1);
      expect(saves[0].locale).toBe('en');

      // Test with artificially corrupted locale on save object
      const corruptedObject = { ...baseSave, id: 'save_list_corrupt', locale: 'de' as unknown as 'pl' };
      FullGameSaveManager.addToSavesList(corruptedObject);
      const updatedSaves = FullGameSaveManager.getSavesList();
      expect(updatedSaves).toHaveLength(2);
      expect(updatedSaves[0].locale).toBeUndefined();
    });
  });
});
