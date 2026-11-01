import { act, renderHook } from '@testing-library/react';
import { useTTS } from '@/hooks/useTTS';
import { persistentMediaCache } from '@/lib/persistent-media-cache';
import { isPureTextMode } from '@/lib/api-keys-service';
import { toast } from '@/components/ui/use-toast';
jest.mock('@/lib/ai-settings',()=>({loadAISettings:()=>({qualityPreset:'high',voiceSettings:{voiceId:'Algenib',volume:75,speed:1,narratorOnly:false}}),saveAISettings:jest.fn()}));
jest.mock('@/lib/api-keys-service',()=>({getApiKeyHeaders:()=>({}),isPureTextMode:jest.fn(()=>false)}));
jest.mock('@/components/ui/use-toast',()=>({toast:jest.fn()}));
jest.mock('@/lib/persistent-media-cache',()=>({persistentMediaCache:{isAvailable:jest.fn(()=>false),getTtsAudio:jest.fn(),setTtsAudio:jest.fn().mockResolvedValue(true),generateTtsCacheKey:jest.fn((text,voice)=>voice+':'+text)}}));
const originalFetch=global.fetch, originalAudio=global.Audio;
let mockPlay: jest.Mock;
beforeEach(()=>{
 jest.useFakeTimers();jest.clearAllMocks();jest.mocked(isPureTextMode).mockReturnValue(false);jest.mocked(persistentMediaCache.isAvailable).mockReturnValue(false);
 mockPlay=jest.fn().mockResolvedValue(undefined);
 class TestAudio {src:string;volume=1;playbackRate=1;paused=false;onended=null;onerror=null;constructor(src=''){this.src=src;}play=mockPlay;pause=jest.fn();load=jest.fn();}
 global.Audio=TestAudio as unknown as typeof Audio;
 global.fetch=jest.fn().mockResolvedValue({status:429,ok:false,headers:new Headers({'Retry-After':'63378'}),json:async()=>({retryable:false,code:'TTS_DAILY_QUOTA_EXCEEDED'})});
});
afterEach(()=>{global.fetch=originalFetch;global.Audio=originalAudio;jest.useRealTimers();});
const paragraphs='Deszcz stuka o szyby redakcji. Helena odkłada fotografię. Tomasz siada przy biurku. Drzwi pozostają otwarte.';
it('one quota response blocks the whole queue and subsequent messages, rather than retrying every segment',async()=>{
 const {result,unmount}=renderHook(()=>useTTS('pl'));
 await act(async()=>{result.current.startInitialBuffering();result.current.addToQueue(paragraphs,'one',true);});
 await act(async()=>{await jest.advanceTimersByTimeAsync(30000);result.current.addToQueue(paragraphs+' Patrzysz na korytarz.','two',true);});
 expect(global.fetch).toHaveBeenCalledTimes(1);expect(result.current.isInitialBuffering).toBe(false);expect(toast).toHaveBeenCalledTimes(1);unmount();
});
it('does not shorten even a non-daily Retry-After; a new message can synthesize only after the deadline',async()=>{
 jest.mocked(global.fetch).mockResolvedValue({status:429,ok:false,headers:new Headers({'Retry-After':'35'}),json:async()=>({retryable:true})} as Response);
 const {result,unmount}=renderHook(()=>useTTS('pl'));
 await act(async()=>{result.current.addToQueue(paragraphs,'one',true);await jest.advanceTimersByTimeAsync(30000);result.current.addToQueue(paragraphs,'two',true);});
 expect(global.fetch).toHaveBeenCalledTimes(1);
 await act(async()=>{await jest.advanceTimersByTimeAsync(6000);result.current.addToQueue(paragraphs,'three',true);});
 expect(global.fetch).toHaveBeenCalledTimes(2);unmount();
});
it.each([['pl','macos-zosia','Zosia'],['en','macos-samantha','Samantha']] as const)('namespaces local %s audio and announces its actual voice once',async(locale,provider,voice)=>{
 jest.mocked(persistentMediaCache.isAvailable).mockReturnValue(true);
 jest.mocked(persistentMediaCache.getTtsAudio).mockResolvedValue(null);
 global.fetch=jest.fn().mockImplementation(async(_url,init)=>!init?.method||init.method==='GET'?{ok:true,json:async()=>({provider,voice})}:{ok:true,status:200,json:async()=>({success:true,audioUrl:'data:audio/wav;base64,UklGRg==',provider,voice})});
 const {result,unmount}=renderHook(()=>useTTS(locale));
 await act(async()=>{result.current.addToQueue(paragraphs,'local',true);});
 const postCalls=jest.mocked(global.fetch).mock.calls.filter(([,init])=>init?.method==='POST');
 expect(postCalls.length).toBeGreaterThan(0);expect(JSON.parse(String(postCalls[0][1]?.body)).languageCode).toBe(locale==='pl'?'pl-PL':'en-US');
 expect(persistentMediaCache.generateTtsCacheKey).toHaveBeenCalledWith(expect.any(String),expect.stringContaining(provider));
 expect(persistentMediaCache.setTtsAudio).toHaveBeenCalledWith(expect.stringContaining(provider),expect.stringMatching(/^data:audio\/wav/),expect.objectContaining({voiceId:voice}));
 expect(mockPlay).toHaveBeenCalled();expect(toast).toHaveBeenCalledTimes(1);unmount();
});
it('refreshes the authoritative local voice when the mounted locale changes',async()=>{
 jest.mocked(persistentMediaCache.isAvailable).mockReturnValue(true);jest.mocked(persistentMediaCache.getTtsAudio).mockResolvedValue(null);
 global.fetch=jest.fn().mockImplementation(async(url,init)=>{const english=String(url).includes('en-US')||(init?.body&&JSON.parse(String(init.body)).languageCode==='en-US');return {ok:true,status:200,json:async()=>({success:true,audioUrl:'data:audio/wav;base64,UklGRg==',provider:english?'macos-samantha':'macos-zosia',voice:english?'Samantha':'Zosia'})};});
 const {result,rerender,unmount}=renderHook(({locale}:{locale:'pl'|'en'})=>useTTS(locale),{initialProps:{locale:'pl'}});
 await act(async()=>{result.current.addToQueue(paragraphs,'pl',true);});rerender({locale:'en'});
 await act(async()=>{result.current.addToQueue('The rain taps against the window.','en',true);});
 expect(jest.mocked(global.fetch).mock.calls.filter(([,init])=>init?.method==='GET')).toHaveLength(2);unmount();
});
it('fails closed on unavailable capabilities without repeatedly requesting or reading another provider cache',async()=>{
 jest.mocked(persistentMediaCache.isAvailable).mockReturnValue(true);global.fetch=jest.fn().mockResolvedValue({ok:false,status:503});
 const {result,unmount}=renderHook(()=>useTTS('pl'));
 await act(async()=>{result.current.startInitialBuffering();result.current.addToQueue(paragraphs,'offline',true);await jest.advanceTimersByTimeAsync(5000);result.current.addToQueue(paragraphs,'offline-again',true);});
 expect(global.fetch).toHaveBeenCalledTimes(1);expect(result.current.isInitialBuffering).toBe(false);expect(persistentMediaCache.getTtsAudio).not.toHaveBeenCalled();unmount();
});
it.each([['macos-zosia',1],['gemini',0]] as const)('free/no-client-key mode resolves %s before deciding whether synthesis is allowed, without IndexedDB',async(provider,expectedPosts)=>{
 jest.mocked(isPureTextMode).mockReturnValue(true);
 jest.mocked(persistentMediaCache.isAvailable).mockReturnValue(false);
 global.fetch=jest.fn().mockImplementation(async(_url,init)=>({ok:true,status:200,json:async()=>init?.method==='GET'?{provider,voice:provider==='gemini'?'Algenib':'Zosia'}:{success:true,audioUrl:'data:audio/wav;base64,UklGRg==',provider,voice:'Zosia'}}));
 const {result,unmount}=renderHook(()=>useTTS('pl'));
 await act(async()=>{result.current.startInitialBuffering();await result.current.generateVoiceForMessage({id:'free-opening',role:'assistant',content:paragraphs,timestamp:new Date()},[]);});
 expect(jest.mocked(global.fetch).mock.calls.filter(([,init])=>init?.method==='GET')).toHaveLength(1);
 expect(jest.mocked(global.fetch).mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(expectedPosts);
 expect(persistentMediaCache.getTtsAudio).not.toHaveBeenCalled();
 if(provider==='gemini')expect(result.current.isInitialBuffering).toBe(false);
 act(()=>result.current.stopCurrentAudio());unmount();
});
