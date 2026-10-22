import { beginDossierTurnTransaction, resumeDossierTurnTransaction, loadDossierTurnTransaction } from './turn-transaction';
import type { StorageLike } from '../combat/combat-transaction';
const binding={playthroughId:'p',adventureId:'neutral',editionFingerprint:'sha256:'+'a'.repeat(64)};
function fixture(){
 const values=new Map<string,string>([['gm_npcs','old-npc'],['zew-dossier-world-state:p','old-world'],['zew_chat_messages','old-chat']]);
 const storage:StorageLike={getItem:k=>values.get(k)??null,setItem:jest.fn((k,v)=>{values.set(k,v);}),removeItem:k=>{values.delete(k);}};
 const input={...binding,turnId:'t',token:'token',writes:[
   {key:'gm_npcs',before:'old-npc',after:'new-npc'},
   {key:'zew-dossier-world-state:p',before:'old-world',after:'new-world'}],
   publication:{key:'zew_chat_messages',before:'old-chat',after:'accepted-chat'}};
 const prepare=jest.fn(async()=>{}),accept=jest.fn(async()=>({accepted:true}));
 return {storage,values,input,prepare,accept};
}
test('writes recovery intent before state, memory acceptance, and published chat',async()=>{
 const x=fixture();beginDossierTurnTransaction(x.storage,x.input);
 expect(x.values.get('gm_npcs')).toBe('old-npc');
 x.prepare.mockImplementation(async()=>{expect(x.values.get('gm_npcs')).toBe('old-npc');expect(loadDossierTurnTransaction(x.storage,binding)?.phase).toBe('ready');});
 x.accept.mockImplementation(async()=>{expect(x.values.get('gm_npcs')).toBe('new-npc');expect(x.values.get('zew_chat_messages')).toBe('old-chat');return {accepted:true};});
 await resumeDossierTurnTransaction(x.storage,binding,{prepare:x.prepare,accept:x.accept,isCurrent:()=>true});
 expect(x.values.get('zew_chat_messages')).toBe('accepted-chat');expect(loadDossierTurnTransaction(x.storage,binding)).toBeNull();
});
test('recovers a partial local write without rerunning mechanics or reapplying the first patch',async()=>{
 const x=fixture();beginDossierTurnTransaction(x.storage,x.input);
 const real=x.storage.setItem;let fail=true;
 x.storage.setItem=jest.fn((k,v)=>{if(k==='zew-dossier-world-state:p'&&fail){fail=false;throw new Error('disk');}real(k,v);});
 await expect(resumeDossierTurnTransaction(x.storage,binding,{prepare:x.prepare,accept:x.accept,isCurrent:()=>true})).rejects.toThrow('disk');
 expect(x.values.get('gm_npcs')).toBe('new-npc');expect(x.accept).not.toHaveBeenCalled();
 await resumeDossierTurnTransaction(x.storage,binding,{prepare:x.prepare,accept:x.accept,isCurrent:()=>true});
 expect(jest.mocked(x.storage.setItem).mock.calls.filter(([k])=>k==='gm_npcs')).toHaveLength(1);
 expect(x.prepare).toHaveBeenCalledTimes(1);expect(x.accept).toHaveBeenCalledTimes(1);
});
test('keeps accepted local state private until a lost memory acknowledgement is retried',async()=>{
 const x=fixture();beginDossierTurnTransaction(x.storage,x.input);
 x.accept.mockRejectedValueOnce(new Error('connection'));
 await expect(resumeDossierTurnTransaction(x.storage,binding,{prepare:x.prepare,accept:x.accept,isCurrent:()=>true})).rejects.toThrow('connection');
 expect(x.values.get('zew_chat_messages')).toBe('old-chat');expect(loadDossierTurnTransaction(x.storage,binding)?.phase).toBe('applied');
 await resumeDossierTurnTransaction(x.storage,binding,{prepare:x.prepare,accept:x.accept,isCurrent:()=>true});
 expect(x.accept.mock.calls).toEqual([['token'],['token']]);expect(x.values.get('zew_chat_messages')).toBe('accepted-chat');
});
test('rejects conflict before applying remaining writes or committing memory',async()=>{
 const x=fixture();beginDossierTurnTransaction(x.storage,x.input);x.values.set('gm_npcs','external-edit');
 await expect(resumeDossierTurnTransaction(x.storage,binding,{prepare:x.prepare,accept:x.accept,isCurrent:()=>true})).rejects.toThrow('DOSSIER_TRANSACTION_CONFLICT');
 expect(x.values.get('zew-dossier-world-state:p')).toBe('old-world');expect(x.prepare).not.toHaveBeenCalled();
});
test('a campaign change during preparation prevents local writes',async()=>{
 const x=fixture();beginDossierTurnTransaction(x.storage,x.input);let current=true;
 x.prepare.mockImplementation(async()=>{current=false;});
 await expect(resumeDossierTurnTransaction(x.storage,binding,{prepare:x.prepare,accept:x.accept,isCurrent:()=>current})).rejects.toThrow('DOSSIER_TRANSACTION_SCOPE_CHANGED');
 expect(x.values.get('gm_npcs')).toBe('old-npc');expect(x.accept).not.toHaveBeenCalled();
});
test('refuses unrelated storage keys and a second turn while recovery is pending',()=>{
 const x=fixture();expect(()=>beginDossierTurnTransaction(x.storage,{...x.input,writes:[{key:'api-keys',before:null,after:'unsafe'}]})).toThrow('DOSSIER_TRANSACTION_INVALID');
 beginDossierTurnTransaction(x.storage,x.input);
 expect(()=>beginDossierTurnTransaction(x.storage,{...x.input,turnId:'another'})).toThrow('DOSSIER_TRANSACTION_PENDING');
});

test('joins concurrent recovery attempts instead of accepting and publishing twice',async()=>{
 const x=fixture();beginDossierTurnTransaction(x.storage,x.input);
 const ports={prepare:x.prepare,accept:x.accept,isCurrent:()=>true};
 const results=await Promise.all([resumeDossierTurnTransaction(x.storage,binding,ports),resumeDossierTurnTransaction(x.storage,binding,ports)]);
 expect(results).toEqual([{accepted:true},{accepted:true}]);
 expect(x.prepare).toHaveBeenCalledTimes(1);expect(x.accept).toHaveBeenCalledTimes(1);
});

test.each(['gm_npcs','characters','zew-dossier-world-state:p','zew-dossier-inventory:p','coc7_game_time','zew_active_chase_state','combat_round_journal_v1'])('recovers a complete turn interrupted at %s', async failedKey => {
 const x=fixture();
 const keys=['gm_npcs','characters','zew-dossier-world-state:p','zew-dossier-inventory:p','coc7_game_time','zew_active_chase_state','combat_round_journal_v1'];
 const writes=keys.map(key=>({key,before:x.storage.getItem(key),after:JSON.stringify({fixture:key})}));
 beginDossierTurnTransaction(x.storage,{...x.input,writes});
 const original=x.storage.setItem;let fail=true;
 x.storage.setItem=(key,value)=>{if(key===failedKey&&fail){fail=false;throw new Error('interrupted');}original(key,value);};
 await expect(resumeDossierTurnTransaction(x.storage,binding,{prepare:x.prepare,accept:x.accept,isCurrent:()=>true})).rejects.toThrow('interrupted');
 expect(x.accept).not.toHaveBeenCalled();expect(x.storage.getItem('zew_chat_messages')).toBe('old-chat');
 await resumeDossierTurnTransaction(x.storage,binding,{prepare:x.prepare,accept:x.accept,isCurrent:()=>true});
 for(const write of writes)expect(x.storage.getItem(write.key)).toBe(write.after);
 expect(x.accept).toHaveBeenCalledTimes(1);expect(x.storage.getItem('zew_chat_messages')).toBe('accepted-chat');
});
