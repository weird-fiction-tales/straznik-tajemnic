import { embeddingService } from '@/lib/embedding-service';
import {
  activateDossierRag,
  clearDossierRag,
  retrieveDossierRag,
  renderDossierWorldStateSection,
} from './rag-runtime';

const fingerprint = 'sha256:approved-demo-edition';

function record(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    record_id: 'demo-actor-goal',
    record_type: 'actor',
    adventure_id: 'demo-adventure',
    edition_fingerprint: fingerprint,
    language: 'pl',
    content: 'Test-only synthetic fixture: this actor has a hidden goal; this is not an adventure fact.',
    tags: {
      entities: ['npc-lucas-strong'],
      scenes: ['town-prep'],
      mechanics: ['coc7:social-resistance'],
      topics: ['goal'],
      triggers: ['player-asks-motive'],
    },
    retrieval: {
      visibility: 'gm_only',
      availability: 'when_entity_present',
      condition: null,
      priority: 2,
    },
    evidence: {
      provenance: 'approved_design',
      source_ref: 'synthetic-fixture',
      status: 'set',
      approval: 'approved',
      approved_by: 'test-fixture',
      approved_at: '2026-10-11T00:00:00Z',
    },
    links: [],
    ...overrides,
  };
}

function payload(records: unknown[]) {
  return {
    schema_version: 1,
    adventure_id: 'demo-adventure',
    edition_fingerprint: fingerprint,
    records,
  };
}

describe('dossier RAG runtime', () => {
  const embedding = jest.spyOn(embeddingService, 'generateLocalEmbedding');

  beforeEach(() => {
    embedding.mockResolvedValue([1, 0]);
    clearDossierRag('test-session');
  });

  afterAll(() => embedding.mockRestore());

  it('tells the narrator about a proven discovery separately from possession', async () => {
    const item=record({record_id:'item',record_type:'fact',inventory_item:{entity_id:'key',name:'Test key',category:'story',source_location:'town-prep',
      access_check:{id:'key-check',skill_names:['Spot Hidden'],difficulty:'hard'}},retrieval:{visibility:'gm_only',availability:'always',condition:null,priority:1}});
    await activateDossierRag('test-session','demo-adventure',fingerprint,payload([item]));
    const context={activationId:'test-session',adventureId:'demo-adventure',editionFingerprint:fingerprint,query:'key',
      activeSceneIds:['town-prep'],presentEntityIds:[],acquiredRecordIds:[],mechanicIds:[],
      inventory:{playthroughId:'run',adventureId:'demo-adventure',editionFingerprint:fingerprint,entries:[]}};
    expect((await retrieveDossierRag(context))[0].content).toContain('DOSSIER_ACCESS: key-check');
    const accessChecks=[{testId:'test',conditionId:'key-check',characterId:'pc',location:'town-prep',skillName:'Spot Hidden',
      requiredDifficulty:'hard' as const,resolution:{id:'roll',outcome:'hard' as const}}];
    const revealed=await retrieveDossierRag({...context,inventory:{...context.inventory,accessChecks}});
    expect(revealed[0].content).toContain('Dostęp odkryty i zapamiętany');
    expect(revealed[0].content).toContain('To nie oznacza zabrania');
  });

  it('retrieves only the current state of the bound world object', async () => {
    const edition = 'sha256:' + 'a'.repeat(64);
    const objectRecord = record({
      record_id: 'world-object', record_type: 'fact', edition_fingerprint: edition,
      content: 'Synthetic object fixture.', tags: { entities: ['obj-hoist'], scenes: ['crater'], mechanics: [], topics: [], triggers: [] },
      world_object_binding: { entity_id: 'obj-hoist', initial_state: 'built', states: ['built', 'disabled'],
        transitions: [{ id: 'disable', from: 'built', to: 'disabled' }] },
      retrieval: { visibility: 'gm_only', availability: 'always', condition: null, priority: 1 },
    });
    const activated = await activateDossierRag('world-state-session', 'demo-adventure', edition, {
      ...payload([objectRecord]), edition_fingerprint: edition,
    });
    expect(activated.ok).toBe(true);
    const context = { activationId: 'world-state-session', adventureId: 'demo-adventure', editionFingerprint: edition,
      query: 'hoist state', activeSceneIds: ['crater'], presentEntityIds: [], acquiredRecordIds: [], mechanicIds: [],
      worldObjectState: { playthroughId: 'run-1', adventureId: 'demo-adventure', editionFingerprint: edition,
        objects: [{ entityId: 'obj-hoist', state: 'disabled' }] } };
    expect((await retrieveDossierRag(context))[0].content).toContain('Bieżące stany obiektu świata: obj-hoist=disabled');
    const invalid = { ...context, worldObjectState: { ...context.worldObjectState, objects: [{ entityId: 'obj-hoist', state: 'unknown' }] } };
    expect((await retrieveDossierRag(invalid))[0].content).not.toContain('Bieżący stan obiektu świata');
  });

  it('retrieves each current state from an authored world-object collection', async () => {
    const edition = 'sha256:' + 'b'.repeat(64);
    const collection = record({
      record_id: 'sarcophagi', record_type: 'fact', edition_fingerprint: edition,
      content: 'Synthetic collection fixture.', tags: { entities: ['obj-sarcophagi'], scenes: ['crypt'], mechanics: [], topics: [], triggers: [] },
      world_object_binding: {
        entity_id: 'obj-sarcophagi', initial_state: 'collection', states: ['collection'], transitions: [],
        instances: [
          { entity_id: 'obj-sarcophagi-1', initial_state: 'occupied', states: ['occupied', 'empty'], transitions: [] },
          { entity_id: 'obj-sarcophagi-2', initial_state: 'empty', states: ['occupied', 'empty'], transitions: [] },
        ],
      },
      retrieval: { visibility: 'gm_only', availability: 'always', condition: null, priority: 1 },
    });
    const activated = await activateDossierRag('collection-state-session', 'demo-adventure', edition, {
      ...payload([collection]), edition_fingerprint: edition,
    });
    expect(activated.ok).toBe(true);
    const hits = await retrieveDossierRag({ activationId: 'collection-state-session', adventureId: 'demo-adventure',
      editionFingerprint: edition, query: 'sarcophagi', activeSceneIds: ['crypt'], presentEntityIds: [], acquiredRecordIds: [],
      mechanicIds: [], worldObjectState: { playthroughId: 'run-collection', adventureId: 'demo-adventure', editionFingerprint: edition,
        objects: [{ entityId: 'obj-sarcophagi', state: 'collection' }, { entityId: 'obj-sarcophagi-1', state: 'empty' },
          { entityId: 'obj-sarcophagi-2', state: 'occupied' }] } });
    expect(hits[0].content).toContain('obj-sarcophagi-1=empty');
    expect(hits[0].content).toContain('obj-sarcophagi-2=occupied');
  });


  it.each(['pl', 'en'] as const)('builds mandatory narrator context from every verified world-object state (%s)', async (locale) => {
    const edition = 'sha256:' + 'c'.repeat(64);
    const worldObject = (recordId: string, entityId: string, initial: string, states: string[]) => record({
      record_id: recordId, record_type: 'fact', edition_fingerprint: edition,
      content: 'Synthetic world-object fixture.',
      tags: { entities: [entityId], scenes: ['plant-room'], mechanics: [], topics: [], triggers: [] },
      world_object_binding: { entity_id: entityId, initial_state: initial, states, transitions: [] },
      retrieval: { visibility: 'gm_only', availability: 'always', condition: null, priority: 1 },
    });
    const activated = await activateDossierRag('mandatory-state-session', 'demo-adventure', edition, {
      ...payload([
        worldObject('generator', 'obj-generator', 'preparing', ['preparing', 'active']),
        worldObject('rift', 'obj-rift', 'latent', ['latent', 'open']),
      ]),
      edition_fingerprint: edition,
    });
    expect(activated.ok).toBe(true);

    const worldObjectState = {
      playthroughId: 'run-authoritative-state', adventureId: 'demo-adventure', editionFingerprint: edition,
      objects: [{ entityId: 'obj-generator', state: 'preparing' }, { entityId: 'obj-rift', state: 'latent' }],
    };
    const noSemanticHits = await retrieveDossierRag({
      activationId: 'mandatory-state-session', adventureId: 'demo-adventure', editionFingerprint: edition,
      query: 'unrelated question', activeSceneIds: [], presentEntityIds: [], acquiredRecordIds: [], mechanicIds: [],
      minimumScore: 2,
    });
    expect(noSemanticHits).toEqual([]);

    const section = renderDossierWorldStateSection({
      activationId: 'mandatory-state-session', adventureId: 'demo-adventure', editionFingerprint: edition,
      worldObjectState, locale,
    });
    expect(section).toContain('obj-generator=preparing');
    expect(section).toContain('obj-rift=latent');
    expect(section).toContain(locale === 'pl' ? 'nieudanego testu' : 'failed roll');
    expect(renderDossierWorldStateSection({
      activationId: 'mandatory-state-session', adventureId: 'demo-adventure', editionFingerprint: edition,
      worldObjectState: { ...worldObjectState, objects: [{ entityId: 'obj-generator', state: 'invented' }, { entityId: 'obj-rift', state: 'latent' }] },
      locale,
    })).toBe('');
  });

  it('indexes only approved records and retrieves one only in its active scene/entity context', async () => {
    const hiddenUntilPresent = record();
    const unrelatedScene = record({
      record_id: 'demo-other-scene',
      tags: {
        entities: ['npc-lucas-strong'],
        scenes: ['demo-other-scene'],
        mechanics: [],
        topics: ['other'],
        triggers: [],
      },
      retrieval: {
        visibility: 'gm_only',
        availability: 'when_scene_active',
        condition: null,
        priority: 1,
      },
    });
    const pending = record({
      record_id: 'demo-pending',
      evidence: {
        provenance: 'approved_design',
        source_ref: 'synthetic-fixture',
        status: 'pending_review',
        approval: 'approved',
        approved_by: 'test-fixture',
        approved_at: '2026-10-11T00:00:00Z',
      },
    });

    const activated = await activateDossierRag(
      'test-session',
      'demo-adventure',
      fingerprint,
      payload([hiddenUntilPresent, unrelatedScene, pending]),
    );
    expect(activated).toEqual({ ok: true, errors: [] });

    const outsideScene = await retrieveDossierRag({
      activationId: 'test-session',
      adventureId: 'demo-adventure',
      editionFingerprint: fingerprint,
      query: 'What does the actor want?',
      activeSceneIds: ['forest-search'],
      presentEntityIds: [],
      acquiredRecordIds: [],
      mechanicIds: ['coc7:social-resistance'],
    });
    expect(outsideScene).toEqual([]);

    const inScene = await retrieveDossierRag({
      activationId: 'test-session',
      adventureId: 'demo-adventure',
      editionFingerprint: fingerprint,
      query: 'What does the actor want?',
      activeSceneIds: ['town-prep'],
      presentEntityIds: ['npc-lucas-strong'],
      acquiredRecordIds: [],
      mechanicIds: ['coc7:social-resistance'],
    });
    expect(inScene.map((hit) => hit.recordId)).toEqual(['demo-actor-goal']);
    expect(inScene[0].provenance).toBe('approved_design');
  });

  it('refuses a payload for a different recognized edition and removes the prior index', async () => {
    const firstActivation = await activateDossierRag(
      'test-session',
      'demo-adventure',
      fingerprint,
      payload([record()]),
    );
    expect(firstActivation.ok).toBe(true);

    const wrongEdition = await activateDossierRag(
      'test-session',
      'demo-adventure',
      'sha256:other-edition',
      payload([record()]),
    );
    expect(wrongEdition.ok).toBe(false);

    const hits = await retrieveDossierRag({
      activationId: 'test-session',
      adventureId: 'demo-adventure',
      editionFingerprint: fingerprint,
      query: 'What does the actor want?',
      activeSceneIds: ['town-prep'],
      presentEntityIds: ['npc-lucas-strong'],
      acquiredRecordIds: [],
      mechanicIds: ['skill-check'],
    });
    expect(hits).toEqual([]);
  });

  it('fails closed when a retrieval condition is not met', async () => {
    const gatedRecord = record({
      retrieval: {
        visibility: 'gm_only',
        availability: 'state_condition',
        condition: {
          all: [{ kind: 'reveal_acquired', id: 'demo-clue-found' }],
        },
        priority: 2,
      },
    });
    const activated = await activateDossierRag(
      'test-session',
      'demo-adventure',
      fingerprint,
      payload([gatedRecord]),
    );
    expect(activated.ok).toBe(true);

    const unavailable = await retrieveDossierRag({
      activationId: 'test-session',
      adventureId: 'demo-adventure',
      editionFingerprint: fingerprint,
      query: 'What is behind the clue?',
      activeSceneIds: ['town-prep'],
      presentEntityIds: ['npc-lucas-strong'],
      acquiredRecordIds: [],
      mechanicIds: [],
    });
    expect(unavailable).toEqual([]);

    const available = await retrieveDossierRag({
      activationId: 'test-session',
      adventureId: 'demo-adventure',
      editionFingerprint: fingerprint,
      query: 'What is behind the clue?',
      activeSceneIds: ['town-prep'],
      presentEntityIds: ['npc-lucas-strong'],
      acquiredRecordIds: ['demo-clue-found'],
      mechanicIds: [],
    });
    expect(available.map((hit) => hit.recordId)).toEqual(['demo-actor-goal']);
  });

  it('does not gate records by mechanic tags alone', async () => {
    const actor = record({
      tags: {
        entities: ['npc-lucas-strong'],
        scenes: ['town-prep'],
        mechanics: ['coc7:social-resistance'],
        topics: ['goal'],
        triggers: [],
      },
    });
    const mechanicHook = record({
      record_id: 'demo-hook-social',
      record_type: 'mechanic_hook',
      tags: {
        entities: [],
        scenes: ['town-prep'],
        mechanics: ['coc7:social-resistance'],
        topics: ['social resistance'],
        triggers: [],
      },
      retrieval: {
        visibility: 'gm_only',
        availability: 'when_scene_active',
        condition: null,
        priority: 2,
      },
    });
    const activated = await activateDossierRag(
      'test-session', 'demo-adventure', fingerprint, payload([actor, mechanicHook]),
    );
    expect(activated.ok).toBe(true);

    const hits = await retrieveDossierRag({
      activationId: 'test-session',
      adventureId: 'demo-adventure',
      editionFingerprint: fingerprint,
      query: 'What does the actor want?',
      activeSceneIds: ['town-prep'],
      presentEntityIds: ['npc-lucas-strong'],
      acquiredRecordIds: [],
      mechanicIds: ['coc7:chase-movement'],
    });
    expect(hits.map((hit) => hit.recordId)).toEqual(['demo-actor-goal', 'demo-hook-social']);
  });

  it('gates a mechanic hook only when an explicit active-mechanic condition requires it', async () => {
    const mechanicHook = record({
      record_id: 'demo-hook-social',
      record_type: 'mechanic_hook',
      tags: {
        entities: [],
        scenes: ['town-prep'],
        mechanics: ['coc7:social-resistance'],
        topics: ['social resistance'],
        triggers: [],
      },
      retrieval: {
        visibility: 'gm_only',
        availability: 'state_condition',
        condition: { all: [{ kind: 'mechanic_active', id: 'coc7:social-resistance' }] },
        priority: 2,
      },
    });
    const activated = await activateDossierRag(
      'test-session', 'demo-adventure', fingerprint, payload([mechanicHook]),
    );
    expect(activated.ok).toBe(true);

    const retrieve = (mechanicIds: string[]) => retrieveDossierRag({
      activationId: 'test-session',
      adventureId: 'demo-adventure',
      editionFingerprint: fingerprint,
      query: 'How does social resistance work?',
      activeSceneIds: ['town-prep'],
      presentEntityIds: [],
      acquiredRecordIds: [],
      mechanicIds,
    });
    await expect(retrieve(['coc7:chase-movement'])).resolves.toEqual([]);
    await expect(retrieve(['coc7:social-resistance'])).resolves.toHaveLength(1);
  });
});


test('separate route module loads share activation, retrieval and clear in process memory', async () => {
  jest.resetModules();
  const routeA = await import('./rag-runtime');
  const serviceA = await import('../embedding-service');
  const embeddingA = jest.spyOn(serviceA.embeddingService, 'generateLocalEmbedding').mockResolvedValue([1, 0]);
  const activationId = 'cross-route-session';
  try {
    await expect(routeA.activateDossierRag(activationId, 'demo-adventure', fingerprint, payload([record()]))).resolves.toEqual({ok: true, errors: []});
    jest.resetModules();
    const routeB = await import('./rag-runtime');
    const serviceB = await import('../embedding-service');
    const embeddingB = jest.spyOn(serviceB.embeddingService, 'generateLocalEmbedding').mockResolvedValue([1, 0]);
    try {
      expect(routeB.getDossierRagBinding(activationId)).toEqual({adventureId: 'demo-adventure', editionFingerprint: fingerprint});
      const hits = await routeB.retrieveDossierRag({activationId, adventureId: 'demo-adventure', editionFingerprint: fingerprint,
        query: 'neutral', activeSceneIds: ['town-prep'], presentEntityIds: ['npc-lucas-strong'], acquiredRecordIds: [], mechanicIds: []});
      expect(hits.map(hit => hit.recordId)).toEqual(['demo-actor-goal']);
      routeB.clearDossierRag(activationId);
      expect(routeA.getDossierRagBinding(activationId)).toBeNull();
    } finally { embeddingB.mockRestore(); }
  } finally { routeA.clearDossierRag(activationId); embeddingA.mockRestore(); }
});

test('shared activation registry retains the 16-entry LRU limit and 12-hour idle expiry', async () => {
  jest.resetModules();
  const routeA = await import('./rag-runtime');
  const service = await import('../embedding-service');
  const embedding = jest.spyOn(service.embeddingService, 'generateLocalEmbedding').mockResolvedValue([1, 0]);
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  const ids = Array.from({length: 17}, (_, i) => 'shared-limit-' + i);
  try {
    clearDossierRag('test-session');
    for (const id of ids.slice(0, 16)) expect((await routeA.activateDossierRag(id, 'demo-adventure', fingerprint, payload([record()]))).ok).toBe(true);
    jest.resetModules();
    const routeB = await import('./rag-runtime');
    expect(routeB.getDossierRagBinding(ids[0])).not.toBeNull();
    expect((await routeA.activateDossierRag(ids[16], 'demo-adventure', fingerprint, payload([record()]))).ok).toBe(true);
    expect(routeB.getDossierRagBinding(ids[1])).toBeNull();
    expect(routeB.getDossierRagBinding(ids[0])).not.toBeNull();
    now.mockReturnValue(1000 + 12 * 60 * 60 * 1000);
    expect(routeB.getDossierRagBinding(ids[0])).not.toBeNull();
    now.mockReturnValue(1001 + 24 * 60 * 60 * 1000);
    expect(routeA.getDossierRagBinding(ids[0])).toBeNull();
  } finally { ids.forEach(routeA.clearDossierRag); now.mockRestore(); embedding.mockRestore(); }
});
