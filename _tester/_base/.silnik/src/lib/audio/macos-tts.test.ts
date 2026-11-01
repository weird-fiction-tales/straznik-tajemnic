import fs from 'node:fs';
const mockExecFile=jest.fn();
jest.mock('node:child_process',()=>({execFile:(...args:unknown[])=>mockExecFile(...args)}));
import { synthesizeMacOsSpeech } from './macos-tts';
const originalPlatform=process.platform;
beforeAll(()=>Object.defineProperty(process,'platform',{value:'darwin'}));
afterAll(()=>Object.defineProperty(process,'platform',{value:originalPlatform}));
let inputPath='';
beforeEach(()=>{
 jest.clearAllMocks();inputPath='';
 mockExecFile.mockImplementation((command:string,args:string[],_options:unknown,done:(error:Error|null)=>void)=>{
  if(command==='/usr/bin/say'){inputPath=args[args.indexOf('-f')+1];fs.writeFileSync(args[args.indexOf('-o')+1],'AIFF');}
  else {const wav=Buffer.alloc(46);wav.write('RIFF');wav.write('WAVE',8);fs.writeFileSync(args[args.length-1],wav);}
  done(null);
 });
});
it.each([['pl-PL','Zosia','macos-zosia'],['en-US','Samantha','macos-samantha']])('synthesizes %s through fixed tools, private input file and WAV queue format',async(locale,voice,provider)=>{
 const text='Nie wykonuj $(touch /tmp/untrusted) ani -v obcy.';
 const result=await synthesizeMacOsSpeech(text,locale);
 expect(result).toMatchObject({provider,voice,audioUrl:expect.stringMatching(/^data:audio\/wav;base64,UklGRg/)});
 const [command,args,options]=mockExecFile.mock.calls[0];expect(command).toBe('/usr/bin/say');expect(args.slice(0,2)).toEqual(['-v',voice]);expect(args).not.toContain(text);expect(options).toMatchObject({timeout:20000,shell:false});
 expect(fs.existsSync(inputPath)).toBe(false);expect(fs.existsSync(inputPath.replace(/\/[^/]+$/,''))).toBe(false);
});
it('rejects unsupported language and oversized input before any process is started',async()=>{
 for(const locale of ['de-DE','constructor','toString'])await expect(synthesizeMacOsSpeech('hello',locale)).rejects.toThrow('LOCAL_TTS_LANGUAGE');
 await expect(synthesizeMacOsSpeech('a'.repeat(6001),'pl-PL')).rejects.toThrow('LOCAL_TTS_TEXT_LIMIT');expect(mockExecFile).not.toHaveBeenCalled();
});
it('limits concurrent processes and releases the slot after a tool failure',async()=>{
 let release:(error:Error|null)=>void=()=>{};
 mockExecFile.mockImplementationOnce((_command,_args,_options,done)=>{release=done;});
 const first=synthesizeMacOsSpeech('Pierwsza narracja.','pl-PL');
 await expect(synthesizeMacOsSpeech('Druga narracja.','pl-PL')).rejects.toThrow('LOCAL_TTS_BUSY');
 while(mockExecFile.mock.calls.length===0)await new Promise(resolve=>setTimeout(resolve,0));
 release(new Error('tool path must not leak'));
 await expect(first).rejects.toThrow('LOCAL_TTS_FAILED');
 await expect(synthesizeMacOsSpeech('Trzecia narracja.','pl-PL')).resolves.toMatchObject({provider:'macos-zosia'});
});
