import type { NextRequest } from 'next/server';
const mockGenerate = jest.fn();
const mockLocal = jest.fn();
jest.mock('@/lib/gemini-client-pool', () => ({ getGeminiClient: () => ({ models: { generateContent: mockGenerate } }) }));
jest.mock('@/lib/audio/macos-tts', () => ({ synthesizeMacOsSpeech: (...args: unknown[]) => mockLocal(...args) }), { virtual: true });
jest.mock('@/lib/auth-user', () => ({ resolveUserId: jest.fn().mockResolvedValue('local') }));
jest.mock('@/lib/user-usage', () => ({ recordUserUsage: jest.fn(), ttsCostPerChar: () => 0 }));
jest.mock('@sentry/nextjs', () => ({ addBreadcrumb: jest.fn(), captureException: jest.fn() }));
jest.mock('next/server',()=>({NextResponse:{json:(body:unknown,init?:{status?:number;headers?:Record<string,string>})=>({status:init?.status??200,headers:new Headers(init?.headers),json:async()=>body})}}));
import { GET, POST } from './route';
const readCapabilities=GET as unknown as (request:NextRequest)=>ReturnType<typeof GET>;
const originalEnv = { ...process.env };
function req(body: unknown, options: { origin?: string; host?: string; url?: string } = {}) {
 const url = options.url || 'http://localhost:3818/api/tts/gemini';
 const headers = new Headers({ host: options.host || '127.0.0.1:3818', origin: options.origin || 'http://127.0.0.1:3818' });
 return { json: async () => body, headers, nextUrl: new URL(url) } as unknown as NextRequest;
}
beforeEach(() => {
 jest.clearAllMocks();process.env.ZEW_LOCAL_TTS='macos';process.env.ZEW_LOCAL_PLAYTEST='prabuty-tomasz';process.env.GEMINI_API_KEY='test-only';
 mockLocal.mockImplementation(async (_text, languageCode) => ({ audioUrl:'data:audio/wav;base64,UklGRg==', provider:languageCode==='en-US'?'macos-samantha':'macos-zosia', voice:languageCode==='en-US'?'Samantha':'Zosia' }));
 mockGenerate.mockResolvedValue({ candidates: [{ content: { parts: [{ inlineData: { data: 'AAAA' } }] } }] });
});
afterEach(() => { process.env = { ...originalEnv }; });
it.each([['pl-PL','macos-zosia','Zosia'],['en-US','macos-samantha','Samantha']])('local %s returns real queue contract without a provider call', async(languageCode,provider,voice)=>{
 delete process.env.GEMINI_API_KEY;
 const response=await POST(req({text:'Tekst narracji.',voice:'untrusted-voice',languageCode}));
 expect(response.status).toBe(200);expect(await response.json()).toMatchObject({success:true,audioUrl:expect.stringMatching(/^data:audio\/wav;base64,/),provider,voice});
 expect(mockLocal).toHaveBeenCalledWith('Tekst narracji.',languageCode);expect(mockGenerate).not.toHaveBeenCalled();
});
it.each([{origin:'https://attacker.test'},{host:'attacker.test'},{url:'https://attacker.test/api/tts/gemini'}])('rejects untrusted local synthesis %j',async(options)=>{
 expect((await POST(req({text:'hello',languageCode:'pl-PL'},options))).status).toBe(403);expect(mockLocal).not.toHaveBeenCalled();expect(mockGenerate).not.toHaveBeenCalled();
});
it('requires both local environment switches and never silently calls cloud',async()=>{
 delete process.env.ZEW_LOCAL_PLAYTEST;
 expect((await POST(req({text:'hello',languageCode:'pl-PL'}))).status).toBe(403);expect(mockGenerate).not.toHaveBeenCalled();
});
it('rejects unsupported locale and exposes only safe capabilities',async()=>{
 expect((await POST(req({text:'hello',languageCode:'de-DE'}))).status).toBe(400);
 const response=await readCapabilities(req(null));expect(await response.json()).toMatchObject({provider:'macos-zosia',voice:'Zosia'});
 expect((await readCapabilities(req(null,{origin:'https://attacker.test'}))).status).toBe(403);expect(mockGenerate).not.toHaveBeenCalled();
});
it('marks daily quota as non-retryable while retaining the full deadline',async()=>{
 delete process.env.ZEW_LOCAL_TTS;
 mockGenerate.mockRejectedValue(Object.assign(new Error(JSON.stringify({quotaId:'GenerateRequestsPerDayPerProjectPerModel',retryDelay:'63378s'})),{status:429}));
 const response=await POST(req({text:'hello',languageCode:'pl-PL'}));
 expect(response.status).toBe(429);expect(response.headers.get('Retry-After')).toBe('63378');expect(await response.json()).toMatchObject({retryable:false,code:'TTS_DAILY_QUOTA_EXCEEDED'});expect(mockGenerate).toHaveBeenCalledTimes(1);
});

it.each([false,true])('a browser free-tier header does not override the server key; explicit free BYOK=%s remains text-only',async clientKey=>{
 delete process.env.ZEW_LOCAL_TTS;
 const request=req({text:'Tekst narracji.',voice:'Charon',languageCode:'pl-PL'});
 request.headers.set('X-Gemini-Tier','free');
 if(clientKey)request.headers.set('X-Gemini-Api-Key','synthetic-client-free');
 const response=await POST(request);const result=await response.json();
 if(clientKey){expect(result).toMatchObject({success:false,code:'PURE_TEXT_MODE_ACTIVE'});expect(mockGenerate).not.toHaveBeenCalled();}
 else{expect(result).toMatchObject({success:true,provider:'gemini'});expect(mockGenerate).toHaveBeenCalledTimes(1);}
});

it.each([
 ['pl-PL', 'Nie otwieraj tych drzwi.', 'Polish'],
 ['en-US', 'Do not open that door.', 'English'],
])('passes silent acting notes and a separate verbatim %s transcript to Gemini', async(languageCode,text,language)=>{
 delete process.env.ZEW_LOCAL_TTS;
 const response=await POST(req({text,voice:'Aoede',languageCode,audioDirection:'Read the following in clear Polish with restrained urgency:'}));
 expect(response.status).toBe(200);
 const request=mockGenerate.mock.calls[0][0];
 expect(request.model).toBe('gemini-3.1-flash-tts-preview');
 expect(request.config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Aoede');
 const prompt=request.contents[0].parts[0].text;
 const [notes,transcript]=prompt.split('\nTRANSCRIPT:\n');
 expect(notes).toContain('Audio Profile:');
 expect(notes).toContain('Scene:');
 expect(notes).toContain("Director's Notes:");
 expect(notes).toContain('restrained urgency');
 expect(notes).toContain(language);
 expect(notes).toContain('Speak only the TRANSCRIPT');
 if(language==='English')expect(notes).not.toContain('Polish');
 expect(transcript).toBe(text);
});
