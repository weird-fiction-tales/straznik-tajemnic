import {resetActiveAdventure} from './new-adventure-reset';
test('fresh participant has no active story, clock, scope, chase or old dossier; keys, rules, saves and old scoped records survive',()=>{
 localStorage.clear();
 const keep={'zew-app-api-keys':'secret-placeholder',ai_settings:'settings',rules_onboarding_completed:'true',
 'zew-dossier-turn:old':'archived',characters:'[]',full_game_saves:'saved',language_selected:'en'};
 for(const [k,v]of Object.entries(keep))localStorage.setItem(k,v);
 for(const k of ['zew_chat_messages','chat-messages','zew-campaign-memory-scope','gm_npcs','gm_locations','adventure_context','coc7_game_time','zew_active_chase_state'])localStorage.setItem(k,'old');
 localStorage.setItem('pdf_memory',JSON.stringify({rulesUrl:'private-rule',rulesIndexedLocally:true,adventureId:'old',adventureDossierFingerprint:'old'}));
 resetActiveAdventure(localStorage);
 for(const[k,v]of Object.entries(keep))expect(localStorage.getItem(k)).toBe(v);
 for(const k of ['zew_chat_messages','chat-messages','zew-campaign-memory-scope','gm_npcs','gm_locations','adventure_context','coc7_game_time','zew_active_chase_state'])expect(localStorage.getItem(k)).toBeNull();
 expect(JSON.parse(localStorage.getItem('pdf_memory')!)).toEqual({rulesUrl:'private-rule',rulesIndexedLocally:true});
 expect(localStorage.getItem('has_started_game')).toBe('false');
 resetActiveAdventure(localStorage);expect(localStorage.getItem('has_started_game')).toBe('false');
});
