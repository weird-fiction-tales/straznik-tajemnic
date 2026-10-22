import { act, renderHook, cleanup, waitFor } from '@testing-library/react';
import { useChat } from './useChat';
import { fetchWithApiKeys, hasRequiredKeys } from '@/lib/api-keys-service';
import { parseSSEStream } from '@/lib/sse-parser';
import { defaultAISettings } from '@/lib/ai-settings/defaults';
import { checkLocalPlaytestTransport, hasLocalPlaytestTransport } from '@/lib/local-playtest-transport';
jest.mock('@/lib/api-keys-service',()=>({fetchWithApiKeys:jest.fn(),hasRequiredKeys:jest.fn(()=>false)}));
jest.mock('@/lib/sse-parser',()=>({parseSSEStream:jest.fn(),createSseParseErrorHandler:jest.fn(()=>jest.fn())}));
jest.mock('@/lib/posthog',()=>({trackEvent:jest.fn()}));
jest.mock('@/lib/persistent-media-cache',()=>({persistentMediaCache:{isAvailable:()=>false}}));
const options:Parameters<typeof useChat>[0]={pdfMemory:{},activeCharacter:null,characters:[],setCharacters:jest.fn(),setActiveCharacter:jest.fn(),voiceEnabled:false,isTTSEnabled:false,generateVoiceForMessage:jest.fn(),addToQueue:jest.fn(),aiSettings:{...defaultAISettings,imageGenerationEnabled:false}};
const ok=(body:unknown)=>({ok:true,json:async()=>body}) as Response;
const configured={status:'ok',keyValid:true,serverConfigured:true};
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
beforeEach(()=>{jest.clearAllMocks();localStorage.clear();jest.replaceProperty(process,'env',{...process.env,NODE_ENV:'production'});jest.mocked(hasRequiredKeys).mockReturnValue(false);jest.mocked(fetchWithApiKeys).mockResolvedValue({ok:true} as Response);jest.mocked(parseSSEStream).mockImplementation(async(_r,c)=>{c?.onText?.('Narration');return 'Narration';});});
afterEach(()=>{cleanup();jest.restoreAllMocks();localStorage.clear();});
it('Enter waits for the shared cold health and real rules before any publication or auth error',async()=>{
 const health=deferred<Response>();const rules=deferred<Response>();
 const http=jest.spyOn(globalThis,'fetch').mockReturnValueOnce(health.promise).mockReturnValueOnce(rules.promise);
 const initialCheck=checkLocalPlaytestTransport(true);const modal=jest.fn();window.addEventListener('open-api-keys-modal',modal);
 try{
  const {result}=renderHook(()=>useChat(options));let send!:Promise<unknown>;
  act(()=>{send=result.current.handleSendMessage('Zgłaszam zagrożenie przez telefon.');});
  expect(result.current.isLoading).toBe(true);expect(result.current.messages).toEqual([]);expect(modal).not.toHaveBeenCalled();expect(fetchWithApiKeys).not.toHaveBeenCalled();
  expect(http).toHaveBeenCalledTimes(1);
  await act(async()=>{health.resolve(ok(configured));await Promise.resolve();});
  await waitFor(()=>expect(http).toHaveBeenCalledTimes(2));expect(result.current.messages).toEqual([]);expect(modal).not.toHaveBeenCalled();
  await act(async()=>{rules.resolve(ok({hasBaseRules:true}));await initialCheck;expect(await send).toBe(true);});
  expect(modal).not.toHaveBeenCalled();expect(result.current.messages.some(m=>/API/.test(m.content))).toBe(false);
  expect(fetchWithApiKeys).toHaveBeenCalledTimes(1);expect(JSON.parse(String(jest.mocked(fetchWithApiKeys).mock.calls[0][1]?.body)).message).toBe('Zgłaszam zagrożenie przez telefon.');
  expect(hasRequiredKeys()).toBe(false);expect(localStorage.getItem('zew-app-api-keys')).toBeNull();expect(localStorage.getItem('rules_onboarding_completed')).toBeNull();
 }finally{window.removeEventListener('open-api-keys-modal',modal);health.resolve(ok({}));rules.resolve(ok({}));await initialCheck;}
});
it('rechecks one failed cached initial handshake on demand without creating client credentials',async()=>{
 const http=jest.spyOn(globalThis,'fetch').mockResolvedValueOnce(ok({status:'network_error'}));await checkLocalPlaytestTransport(true);expect(hasLocalPlaytestTransport()).toBe(false);
 http.mockResolvedValueOnce(ok(configured)).mockResolvedValueOnce(ok({hasBaseRules:true}));
 const {result}=renderHook(()=>useChat(options));await act(async()=>{expect(await result.current.handleSendMessage('Rozglądam się.')).toBe(true);});
 expect(http).toHaveBeenCalledTimes(3);expect(fetchWithApiKeys).toHaveBeenCalledTimes(1);expect(hasRequiredKeys()).toBe(false);
});
it('a failed on-demand handshake stays unauthorized with no message publication or fake key',async()=>{
 const http=jest.spyOn(globalThis,'fetch').mockResolvedValue(ok({status:'invalid_key',keyValid:false,serverConfigured:false}));await checkLocalPlaytestTransport(true);http.mockClear();
 const modal=jest.fn();window.addEventListener('open-api-keys-modal',modal);
 try{const {result}=renderHook(()=>useChat(options));await act(async()=>{expect(await result.current.handleSendMessage('Rozglądam się.')).toBe(false);});
 expect(http).toHaveBeenCalledTimes(1);expect(fetchWithApiKeys).not.toHaveBeenCalled();expect(result.current.messages).toEqual([]);expect(modal).toHaveBeenCalledTimes(1);expect(hasRequiredKeys()).toBe(false);expect(localStorage.getItem('zew-app-api-keys')).toBeNull();
 }finally{window.removeEventListener('open-api-keys-modal',modal);}
});
it('a second Enter and Stop during cold handshake cannot publish or send a late request',async()=>{
 const health=deferred<Response>();
 const http=jest.spyOn(globalThis,'fetch').mockResolvedValueOnce(ok({status:'network_error'}));await checkLocalPlaytestTransport(true);
 http.mockReturnValueOnce(health.promise).mockResolvedValueOnce(ok({hasBaseRules:true}));
 const initial=checkLocalPlaytestTransport(true);const {result}=renderHook(()=>useChat(options));let first!:Promise<unknown>;
 act(()=>{first=result.current.handleSendMessage('Moja deklaracja.');});
 await act(async()=>{expect(await result.current.handleSendMessage('Drugi Enter.')).toBe(false);result.current.stopGeneration();});
 await act(async()=>{health.resolve(ok(configured));await initial;expect(await first).toBe(false);});
 expect(fetchWithApiKeys).not.toHaveBeenCalled();expect(result.current.messages).toEqual([]);expect(result.current.newMessage).toBe('Moja deklaracja.');
});
it('existing BYOK bypasses the local readiness handshake',async()=>{
 jest.replaceProperty(process,'env',{...process.env,NODE_ENV:'test'});
 jest.mocked(hasRequiredKeys).mockReturnValue(true);
 const http=jest.spyOn(globalThis,'fetch').mockRejectedValue(new Error('Readiness must not run for BYOK'));
 const {result}=renderHook(()=>useChat(options));await act(async()=>{expect(await result.current.handleSendMessage('Rozglądam się.')).toBe(true);});
 expect(http).not.toHaveBeenCalled();expect(fetchWithApiKeys).toHaveBeenCalledTimes(1);
});
