import { loadAuthoredPrabutyEdition, activateAuthoredPrabutySession } from './authored-client';
import { authorizeLocalDraftPayload } from './runtime-authorization';
import { initializeDossierActors } from './actor-initialization';
jest.mock('./runtime-authorization', () => ({ authorizeLocalDraftPayload: jest.fn(async (p: unknown) => p) }));
jest.mock('./actor-initialization', () => ({ initializeDossierActors: jest.fn() }));
const fp = `sha256:${'c'.repeat(64)}`;
const payload = { adventure_id: 'cien-nad-prabutami', records: [] };
const edition = { adventureId: 'cien-nad-prabutami', editionFingerprint: fp, payload, mode: 'local_playtest', humanApproval: 'pending' };
describe('fixed local authored edition client', () => {
  beforeEach(() => { jest.clearAllMocks(); global.fetch = jest.fn(); });
  it('does not activate unrelated adventures or absent local fixtures', async () => {
    expect(await loadAuthoredPrabutyEdition('other')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    jest.mocked(fetch).mockResolvedValue({ status: 404 } as Response);
    expect(await loadAuthoredPrabutyEdition('cien-nad-prabutami')).toBeNull();
  });
  it('rejects a stale edition without enrolling or initializing its records', async () => {
    jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => edition } as Response);
    expect(await loadAuthoredPrabutyEdition('cien-nad-prabutami', `sha256:${'d'.repeat(64)}`)).toBeNull();
    expect(authorizeLocalDraftPayload).not.toHaveBeenCalled();
    expect(initializeDossierActors).not.toHaveBeenCalled();
  });
  it('hash-verifies the fixture and posts binding only before hydrating actors', async () => {
    jest.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => edition } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ activated: false }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ activated: true }) } as Response);
    expect(await activateAuthoredPrabutySession('session-1', 'cien-nad-prabutami')).toMatchObject({ editionFingerprint: fp });
    expect(authorizeLocalDraftPayload).toHaveBeenCalledWith(payload, { adventureId: 'cien-nad-prabutami', editionFingerprint: fp });
    const post = jest.mocked(fetch).mock.calls[2][1];
    expect(JSON.parse(String(post?.body))).toEqual({ sessionId: 'session-1', adventureId: 'cien-nad-prabutami', editionFingerprint: fp });
    expect(String(post?.body)).not.toContain('records');
    expect(initializeDossierActors).toHaveBeenCalledTimes(1);
  });
  it('restores from the trusted fixture cache and reactivates after a server restart', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ activated: false }) } as Response)
      .mockResolvedValueOnce({ ok: false } as Response);
    await expect(activateAuthoredPrabutySession('session-2', 'cien-nad-prabutami', fp)).rejects.toThrow('LOCAL_PLAYTEST_ACTIVATION_FAILED');
    expect(initializeDossierActors).not.toHaveBeenCalled();
  });
});


test('English edition activates independently and never reuses the cached Polish dossier', async () => {
  jest.clearAllMocks(); global.fetch = jest.fn();
  const englishPayload = { adventure_id: 'englewood-murder-castle-1893', records: [] };
  const englishEdition = { ...edition, adventureId: englishPayload.adventure_id, payload: englishPayload };
  jest.mocked(fetch)
    .mockResolvedValueOnce({ ok: true, json: async () => englishEdition } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ activated: false }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ activated: true }) } as Response);
  expect(await activateAuthoredPrabutySession('english-session', englishPayload.adventure_id, fp)).toMatchObject({ adventureId: englishPayload.adventure_id });
  expect(jest.mocked(fetch).mock.calls[0][0]).toContain('adventureId=englewood-murder-castle-1893');
  expect(initializeDossierActors).toHaveBeenLastCalledWith(expect.objectContaining({ adventureId: englishPayload.adventure_id, sessionId: 'english-session', freshSession: undefined }));
});
