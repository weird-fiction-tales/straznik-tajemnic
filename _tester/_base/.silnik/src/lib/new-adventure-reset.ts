/** Reset the active table only. Saved campaigns, private rules and credentials remain available. */
export function resetActiveAdventure(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>):void {
 const keys=['zew_chat_messages','chat-messages','zew-campaign-memory-scope','adventure_context',
 'zew_active_chase_state','combat_round_journal_v1','coc7_game_time','coc7_game_weather',
 'gm_npcs','gm_locations','session_started_at','hotSeatCreatingPlayerName'];
 for(const key of keys)storage.removeItem(key);
 const raw=storage.getItem('pdf_memory');
 if(raw){try{const memory=JSON.parse(raw);storage.setItem('pdf_memory',JSON.stringify(
 Object.fromEntries(Object.entries(memory).filter(([key])=>!key.startsWith('adventure')))));
 }catch{storage.removeItem('pdf_memory');}}
 storage.setItem('has_started_game','false');
 storage.setItem('session_zero_completed','false');
}
