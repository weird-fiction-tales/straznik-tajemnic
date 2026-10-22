import { act, fireEvent, render, screen } from '@testing-library/react';
import { ChatWindow } from './index';
import { SkillTestCard } from './components/skill-test-card';
import { PREDEFINED_CHARACTERS } from '@/lib/immersion/predefined-characters';
import type { Character, Message } from '@/lib/types';
import type { SkillTestData } from '@/lib/parsers/types';
import * as diceUtils from '@/lib/dice-utils';

jest.mock('@/hooks/useResolvedPortrait', () => ({ useResolvedPortrait: () => null }));

const character: Character = {
  ...PREDEFINED_CHARACTERS[0], id: 'tomasz-test', name: 'Tomasz', luck: 20,
  skills: { ...PREDEFINED_CHARACTERS[0].skills, Spostrzegawczość: 60 },
};
function makeTest(id: string, overrides: Partial<SkillTestData> = {}): SkillTestData {
  return {
    id, characterId: character.id, characterName: character.name,
    skillName: 'Spostrzegawczość', skillValue: 60, difficulty: 'zwykly',
    modifiers: [], justification: 'Sprawdź dokument.', targetNpcId: 'npc-helena',
    dossierConditionId: 'condition-photo', isCombat: true, ...overrides,
  };
}
function renderChat(tests: SkillTestData[]) {
  const handleSendMessage = jest.fn();
  const message: Message = {
    id: 'gm-test', role: 'assistant', content: 'Przyjrzyj się dokumentom.',
    timestamp: new Date(), skillTests: tests,
  };
  render(<ChatWindow messages={[message]} newMessage="" setNewMessage={jest.fn()}
    handleSendMessage={handleSendMessage} currentAudio={null} stopCurrentAudio={jest.fn()}
    isTTSEnabled={false} activeCharacter={character} characters={[character]} hasStartedGame />);
  return handleSendMessage;
}
function rollAndSend() {
  const next = screen.getAllByRole('button', { name: 'Rzuć kością' })
    .find((button) => !button.hasAttribute('disabled'));
  fireEvent.click(next!);
  fireEvent.click(screen.getByRole('button', { name: 'Rzuć' }));
  act(() => jest.advanceTimersByTime(700));
  fireEvent.click(screen.getByRole('button', { name: 'Do czatu' }));
}

describe('ChatWindow typed roll handoff', () => {
  beforeEach(() => { jest.useFakeTimers(); localStorage.clear(); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('przekazuje rzeczywisty rzut z modalu do handleSendMessage z tożsamością i progiem', () => {
    jest.spyOn(diceUtils, 'rollD100').mockReturnValue(30);
    const send = renderChat([makeTest('test-hard', { difficulty: 'trudny' })]);
    rollAndSend();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1]).toEqual({ skillRolls: [{
      testId: 'test-hard', resolutionId: expect.any(String), characterId: character.id,
      targetNpcId: 'npc-helena', requiredDifficulty: 'hard', passedRequirement: true,
      outcome: 'hard', luckSpent: 0, skillNames: ['Spostrzegawczość'],
    }] });
  });

  it('wysyła oba typed wyniki grupy jednym requestem dopiero po ostatnim rzucie', () => {
    jest.spyOn(diceUtils, 'rollD100').mockReturnValueOnce(30).mockReturnValueOnce(80);
    const send = renderChat([
      makeTest('group-one', { groupId: 'group', targetNpcId: 'npc-one' }),
      makeTest('group-two', { groupId: 'group', targetNpcId: 'npc-two' }),
    ]);
    rollAndSend();
    expect(send).not.toHaveBeenCalled();
    rollAndSend();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1]?.skillRolls).toEqual([
      expect.objectContaining({ testId: 'group-one', targetNpcId: 'npc-one', characterId: character.id,
        outcome: 'hard', passedRequirement: true, requiredDifficulty: 'regular', luckSpent: 0 }),
      expect.objectContaining({ testId: 'group-two', targetNpcId: 'npc-two', characterId: character.id,
        outcome: 'fail', passedRequirement: false, requiredDifficulty: 'regular', luckSpent: 0 }),
    ]);
    expect(new Set(send.mock.calls[0][1].skillRolls.map((roll: {resolutionId: string}) => roll.resolutionId)).size).toBe(2);
  });

  it('zachowuje powiązanie dossier i walkę w payloadzie onRoll karty testu', () => {
    const test = makeTest('metadata-test');
    const onRoll = jest.fn();
    render(<SkillTestCard {...test} onRoll={onRoll} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rzuć kością' }));
    expect(onRoll).toHaveBeenCalledWith(expect.objectContaining({
      id: test.id, targetNpcId: 'npc-helena', dossierConditionId: 'condition-photo', isCombat: true,
    }));
  });
});


describe('persisted exact roll completion',()=>{
  beforeEach(()=>{jest.useFakeTimers();localStorage.clear();});
  afterEach(()=>{jest.restoreAllMocks();jest.useRealTimers();});
  const scope={schemaVersion:1,campaignDefinitionId:'scenario:prabuty',kind:'scenario',playthroughId:'run-one',adventureId:'cien-nad-prabutami'};
  it('restores real modal result after rerender, F5 and JSON save/load; leaves new same-skill tests available',()=>{
    localStorage.setItem('zew-campaign-memory-scope',JSON.stringify(scope));
    jest.spyOn(diceUtils,'rollD100').mockReturnValue(17);
    const tests=[makeTest('old-psychology',{skillName:'Psychologia'}),makeTest('new-psychology',{skillName:'Psychologia'})];
    const history:Message[]=[{id:'prompt',role:'assistant',content:'Sprawdź intencje.',timestamp:new Date(),skillTests:tests}];
    const send=jest.fn();
    const props={messages:history,newMessage:'',setNewMessage:jest.fn(),handleSendMessage:send,currentAudio:null,stopCurrentAudio:jest.fn(),isTTSEnabled:false,activeCharacter:character,characters:[character],hasStartedGame:true};
    let mounted=render(<ChatWindow {...props}/>);rollAndSend();
    expect(send).toHaveBeenCalledTimes(1);
    const result=send.mock.calls[0];
    const saved=JSON.parse(JSON.stringify([...history,{id:'result',role:'user',content:result[0],timestamp:new Date(),mechanicsContext:{...result[1],skillRollScope:{playthroughId:scope.playthroughId,adventureId:scope.adventureId}}}])) as Message[];
    saved.forEach(m=>{m.timestamp=new Date(m.timestamp);});
    mounted.rerender(<ChatWindow {...props} messages={saved}/>);
    expect(screen.getAllByRole('button',{name:'Wynik zapisany'})).toHaveLength(1);
    expect(screen.getAllByRole('button',{name:'Rzuć kością'})).toHaveLength(1);
    mounted.unmount();mounted=render(<ChatWindow {...props} messages={JSON.parse(JSON.stringify(saved)).map((m:Message)=>({...m,timestamp:new Date(m.timestamp)}))}/>);
    expect(screen.getAllByRole('button',{name:'Wynik zapisany'})).toHaveLength(1);
    expect(screen.getAllByRole('button',{name:'Rzuć kością'})).toHaveLength(1);
    expect(diceUtils.rollD100).toHaveBeenCalledTimes(1);
    mounted.rerender(<ChatWindow {...props} messages={JSON.parse(JSON.stringify(history)).map((m:Message)=>({...m,timestamp:new Date(m.timestamp)}))}/>);
    expect(screen.getAllByRole('button',{name:'Rzuć kością'})).toHaveLength(2);
    mounted.rerender(<ChatWindow {...props} messages={saved}/>);
    expect(screen.getAllByRole('button',{name:'Wynik zapisany'})).toHaveLength(1);
    localStorage.setItem('zew-campaign-memory-scope',JSON.stringify({...scope,playthroughId:'run-two'}));
    mounted.rerender(<ChatWindow {...props} messages={saved}/>);
    expect(screen.queryByRole('button',{name:'Wynik zapisany'})).not.toBeInTheDocument();
    expect(screen.getAllByRole('button',{name:'Rzuć kością'})).toHaveLength(2);
  });
});
