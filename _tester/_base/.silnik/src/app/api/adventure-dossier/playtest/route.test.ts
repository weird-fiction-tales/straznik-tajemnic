jest.mock('next/server', () => ({
  NextRequest: class { nextUrl: URL; headers: Map<string, string>; body: string;
    constructor(url: string, init?: { headers?: Record<string,string>; body?: string }) { this.nextUrl=new URL(url); this.headers=new Map(Object.entries(init?.headers ?? {})); this.body=init?.body ?? ''; }
    async text() { return this.body; }
  },
  NextResponse: { json: (body: unknown, init?: { status?:number; headers?:Record<string,string> }) => ({ status:init?.status ?? 200, json:async()=>body, headers:new Map(Object.entries(init?.headers ?? {}).map(([k,v])=>[k.toLowerCase(),v])) }) },
}));
import { NextRequest } from 'next/server';
jest.mock('@/lib/adventure-dossier/authored-prabuty', () => ({ createAuthoredPrabutyPayload: jest.fn(() => ({ adventure_id: 'cien-nad-prabutami', records: [] })) }), { virtual: true });
jest.mock('@/lib/adventure-dossier/runtime-authorization', () => ({ fingerprintLocalDraftPayload: jest.fn(async () => `sha256:${'a'.repeat(64)}`), authorizeLocalDraftPayload: jest.fn(async (payload: unknown) => payload) }), { virtual: true });
jest.mock('@/lib/adventure-dossier/rag-runtime', () => ({ activateDossierRag: jest.fn(async () => ({ ok: true })) }));
jest.mock('@/lib/auth-user', () => ({ resolveUserId: jest.fn(async () => 'local'), scopeSessionId: jest.fn((user: string, session: string) => `${user}:${session}`) }));
jest.mock('@/lib/adventure-dossier/authored-editions',()=>({createAuthoredEdition:jest.fn(async (id:string)=>({editionFingerprint:'sha256:'+'a'.repeat(64),payload:{adventure_id:id,records:[]}}))}));
import { GET, POST } from './route';
import { activateDossierRag } from '@/lib/adventure-dossier/rag-runtime';
const fingerprint = `sha256:${'a'.repeat(64)}`;
const request = (body: unknown) => new NextRequest('http://127.0.0.1:3818/api/adventure-dossier/playtest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
describe('local authored playtest endpoint', () => {
  const previous = process.env.ZEW_LOCAL_PLAYTEST;
  beforeEach(() => { process.env.ZEW_LOCAL_PLAYTEST = 'prabuty-tomasz'; jest.clearAllMocks(); });
  afterAll(() => { if (previous === undefined) delete process.env.ZEW_LOCAL_PLAYTEST; else process.env.ZEW_LOCAL_PLAYTEST = previous; });
  it('requires explicit local playtest configuration', async () => {
    delete process.env.ZEW_LOCAL_PLAYTEST;
    expect((await GET(new NextRequest('http://localhost/api/adventure-dossier/playtest'))).status).toBe(404);
  });
  it('rejects remote and cross-origin calls', async () => {
    expect((await GET(new NextRequest('https://example.com/api/adventure-dossier/playtest'))).status).toBe(403);
    expect((await GET(new NextRequest('http://localhost/api/adventure-dossier/playtest', { headers: { origin: 'https://example.com' } }))).status).toBe(403);
  });
  it('accepts same-origin browser Host when Next normalizes its internal URL to localhost', async () => {
    const response = await GET(new NextRequest('http://localhost:3818/api/adventure-dossier/playtest', { headers: { host: '127.0.0.1:3818', origin: 'http://127.0.0.1:3818' } }));
    expect(response.status).toBe(200);
  });
  it('returns a fixed edition explicitly labelled as awaiting human approval', async () => {
    const response = await GET(new NextRequest('http://localhost/api/adventure-dossier/playtest'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: 'local_playtest', humanApproval: 'pending', editionFingerprint: fingerprint });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('activates only the exact server edition and scoped session', async () => {
    expect((await POST(request({ sessionId: 'test-1', adventureId: 'cien-nad-prabutami', editionFingerprint: fingerprint }))).status).toBe(200);
    expect(activateDossierRag).toHaveBeenCalledWith('local:test-1', 'cien-nad-prabutami', fingerprint, expect.any(Object));
  });
  it.each([
    { sessionId: 'test-1', adventureId: 'other', editionFingerprint: fingerprint },
    { sessionId: 'test-1', adventureId: 'cien-nad-prabutami', editionFingerprint: `sha256:${'b'.repeat(64)}` },
    { sessionId: '../private', adventureId: 'cien-nad-prabutami', editionFingerprint: fingerprint },
    { sessionId: 'test-1', adventureId: 'cien-nad-prabutami', editionFingerprint: fingerprint, payload: {} },
  ])('rejects arbitrary editions, paths and client payloads', async body => {
    expect((await POST(request(body))).status).toBe(422);
    expect(activateDossierRag).not.toHaveBeenCalled();
  });
});

test('showcase serves and activates the English fixture independently',async()=>{
 process.env.ZEW_LOCAL_PLAYTEST='showcase-pl-en';
 const id='englewood-murder-castle-1893';
 const response=await GET(new NextRequest('http://127.0.0.1:3818/api/adventure-dossier/playtest?adventureId='+id));
 expect(await response.json()).toMatchObject({adventureId:id,payload:{adventure_id:id}});
 expect((await POST(request({sessionId:'en-fresh',adventureId:id,editionFingerprint:fingerprint}))).status).toBe(200);
 expect(activateDossierRag).toHaveBeenCalledWith('local:en-fresh',id,fingerprint,expect.any(Object));
});
