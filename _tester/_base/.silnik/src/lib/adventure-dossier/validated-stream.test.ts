import { DossierEffectsRejectedError } from './narration-correction';
import { parseValidatedDossierStream } from './validated-stream';
import { parseSSEStream } from '../sse-parser';
jest.mock('../sse-parser',()=>({parseSSEStream:jest.fn()}));
const response={} as Response;
beforeEach(()=>{jest.clearAllMocks();jest.mocked(parseSSEStream).mockImplementation(async(_r,c)=>{
 c?.onText?.('False success');c?.onMetadata?.({type:'metadata',dossierFinalizationToken:'token'});return 'False success';
});});
test('does not deliver text or metadata before validation and rejects the token',async()=>{
 const onText=jest.fn(),onMetadata=jest.fn(),reject=jest.fn(async()=>{});
 await expect(parseValidatedDossierStream(response,{onText,onMetadata},{validate:()=>{throw new Error('rejected');},reject})).rejects.toThrow('rejected');
 expect(onText).not.toHaveBeenCalled();expect(onMetadata).not.toHaveBeenCalled();expect(reject).toHaveBeenCalledWith('token');
});
test('delivers accepted text once, after validation',async()=>{
 const order:string[]=[];
 await parseValidatedDossierStream(response,{onText:()=>{order.push('text');},onMetadata:()=>{order.push('metadata');}},
 {validate:()=>{order.push('validate');},reject:async()=>{}});
 expect(order).toEqual(['validate','text','metadata']);
});
test.each(['missing','malformed','broken'])('fails closed for %s stream',async(kind)=>{
 jest.mocked(parseSSEStream).mockImplementation(async(_r,c)=>{
 c?.onText?.('Partial');
 if(kind==='malformed')c?.onParseError?.(new Error('bad'),'bad');
 if(kind==='broken')throw new Error('broken');
 return 'Partial';
 });
 const onText=jest.fn(),validate=jest.fn();
 await expect(parseValidatedDossierStream(response,{onText},{validate,reject:async()=>{}})).rejects.toThrow();
 expect(onText).not.toHaveBeenCalled();expect(validate).not.toHaveBeenCalled();
});


test.each([false,true])('allows one correction and revalidates it (second rejected=%s)',async(secondRejected)=>{
 let draft=0;
 jest.mocked(parseSSEStream).mockImplementation(async(_r,c)=>{
  const n=++draft;c?.onMetadata?.({type:'metadata',dossierFinalizationToken:`token-${n}`});return n===1?'Rejected draft':'Corrected draft';
 });
 const onText=jest.fn(),reject=jest.fn(async()=>{}),correct=jest.fn(async()=>({ok:true} as Response));
 const validate=jest.fn((text:string)=>{if(text==='Rejected draft'||secondRejected)throw new DossierEffectsRejectedError(['door']);});
 const result=parseValidatedDossierStream(response,{onText},{validate,reject,correct});
 if(secondRejected){await expect(result).rejects.toThrow('DOSSIER_EFFECTS_REJECTED');expect(onText).not.toHaveBeenCalled();expect(reject).toHaveBeenCalledTimes(2);}
 else{await expect(result).resolves.toBe('Corrected draft');expect(onText).toHaveBeenCalledTimes(1);expect(onText).toHaveBeenCalledWith('Corrected draft');}
 expect(correct).toHaveBeenCalledTimes(1);expect(correct).toHaveBeenCalledWith({token:'token-1',rejectedIds:['door']});
 expect(validate).toHaveBeenCalledTimes(2);
});
test('never corrects after an unconfirmed rejection or a changed campaign',async()=>{
 const correct=jest.fn(async()=>response),onText=jest.fn();
 await expect(parseValidatedDossierStream(response,{onText},{validate:()=>{throw new DossierEffectsRejectedError(['door']);},reject:async()=>{throw new Error('offline');},correct})).rejects.toThrow('DOSSIER_EFFECTS_REJECTED');
 expect(correct).not.toHaveBeenCalled();expect(onText).not.toHaveBeenCalled();
 await expect(parseValidatedDossierStream(response,{onText},{validate:()=>{throw new Error('DOSSIER_STATE_CHANGED');},reject:async()=>{},correct})).rejects.toThrow('DOSSIER_STATE_CHANGED');
 expect(correct).not.toHaveBeenCalled();
});
