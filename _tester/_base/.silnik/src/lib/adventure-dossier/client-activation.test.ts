import { initializeDossierActors } from './actor-initialization';
jest.mock('./actor-initialization', () => ({ initializeDossierActors: jest.fn() }));
import { activateLocalDossierPack, ensureLocalDossierSession } from './client-activation';
import { openDossierInBrowser } from './browser-pack';

jest.mock('./browser-pack', () => ({ openDossierInBrowser: jest.fn() }));
const openPack = jest.mocked(openDossierInBrowser);
const fingerprint = 'sha256:synthetic-edition';
const input = () => ({
  sessionId: 'session-1', adventureId: 'synthetic-adventure',
  expectedFingerprint: fingerprint,
  sourcePdf: new File(['%PDF-1.7 private-source'], 'source.pdf', { type: 'application/pdf' }),
  encryptedPack: new Blob(['opaque-pack']),
});

// Decoder cryptography is tested separately; this suite checks the activation boundary.
describe('local dossier client activation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts only locally decoded operational data, never PDF or encrypted bytes', async () => {
    const request = input();
    const payload = { schema_version: 1, adventure_id: request.adventureId,
      edition_fingerprint: fingerprint, records: [] };
    openPack.mockResolvedValue(payload as Awaited<ReturnType<typeof openDossierInBrowser>>);
    const fetcher = jest.fn().mockResolvedValue({ ok: true,
      json: async () => ({ success: true, activated: true }) });
    expect(await activateLocalDossierPack(request, fetcher)).toEqual({ ok: true });
    expect(openPack).toHaveBeenCalledWith(request.sourcePdf, request.encryptedPack, fingerprint);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('/api/adventure-dossier/activate');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options.body)).toEqual({ sessionId: request.sessionId,
      adventureId: request.adventureId, editionFingerprint: fingerprint, payload });
    expect(options.body).not.toContain('private-source');
    expect(options.body).not.toContain('opaque-pack');
  });

  it('does not send anything when the local decoder rejects the edition or package', async () => {
    openPack.mockRejectedValue(new Error('DOSSIER_PACK_REJECTED'));
    const fetcher = jest.fn();
    expect(await activateLocalDossierPack(input(), fetcher)).toEqual({ ok: false, reason: 'activation_failed' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not activate data belonging to another adventure', async () => {
    openPack.mockResolvedValue({ adventure_id: 'foreign-adventure' } as Awaited<ReturnType<typeof openDossierInBrowser>>);
    const fetcher = jest.fn();
    expect(await activateLocalDossierPack(input(), fetcher)).toEqual({ ok: false, reason: 'activation_failed' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});


test('hydrates opening NPC state only after successful local activation',async()=>{
 const request=input();
 const payload={schema_version:1 as const,adventure_id:request.adventureId,edition_fingerprint:fingerprint,records:[]};
 openPack.mockResolvedValue(payload);
 const failed=jest.fn().mockResolvedValue({ok:false});
 jest.mocked(initializeDossierActors).mockClear();
 expect((await activateLocalDossierPack(request,failed)).ok).toBe(false);
 expect(initializeDossierActors).not.toHaveBeenCalled();
 const success=jest.fn().mockResolvedValue({ok:true,json:async()=>({success:true,activated:true})});
 expect((await activateLocalDossierPack(request,success)).ok).toBe(true);
 expect(initializeDossierActors).toHaveBeenCalledWith(expect.objectContaining({payload,sessionId:request.sessionId,adventureId:request.adventureId,editionFingerprint:fingerprint,storage:localStorage}));
 jest.mocked(initializeDossierActors).mockImplementationOnce(()=>{throw new Error('storage conflict');});
 expect((await activateLocalDossierPack(request,success)).ok).toBe(false);
});


test('an already active server cannot bypass a failed local NPC initialization on resume',async()=>{
 const request=input();openPack.mockResolvedValue({schema_version:1,adventure_id:request.adventureId,edition_fingerprint:fingerprint,records:[]});
 await activateLocalDossierPack(request,jest.fn().mockResolvedValue({ok:true,json:async()=>({success:true,activated:true})}));
 const original=global.fetch;
 try {
  global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({activated:true})});
  jest.mocked(initializeDossierActors).mockImplementationOnce(()=>{throw new Error('storage conflict');});
  expect(await ensureLocalDossierSession(request.sessionId,request.adventureId,fingerprint)).toEqual({ok:false,reason:'activation_failed'});
  expect((await ensureLocalDossierSession(request.sessionId,request.adventureId,fingerprint)).ok).toBe(true);
 } finally {global.fetch=original;}
});
