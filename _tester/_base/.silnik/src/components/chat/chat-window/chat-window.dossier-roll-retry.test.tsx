import {act,fireEvent,render,screen,within} from '@testing-library/react';
import {ChatWindow} from './index';
import {PREDEFINED_CHARACTERS} from '@/lib/immersion/predefined-characters';
import type {Character,Message} from '@/lib/types';
import * as diceUtils from '@/lib/dice-utils';
import pl from '../../../../messages/pl.json';
import en from '../../../../messages/en.json';

jest.mock('@/hooks/useResolvedPortrait',()=>({useResolvedPortrait:()=>null}));
const character:Character={...PREDEFINED_CHARACTERS[0],id:'pc-retry',name:'Tomasz'};
const messages:Message[]=[{id:'prompt',role:'assistant',content:'Przeskocz przeszkodę.',timestamp:new Date(0),skillTests:[{id:'dex-test',skillName:'Zręczność',skillValue:57,difficulty:'zwykly',modifiers:[],justification:'Przeszkoda.',characterId:character.id}]}];

describe('ChatWindow pending dossier roll retry',()=>{
 beforeEach(()=>{jest.useFakeTimers();localStorage.clear();});
 afterEach(()=>{jest.restoreAllMocks();jest.useRealTimers();delete process.env.NEXT_INTL_TEST_LOCALE;});
 it.each(['pl','en'] as const)('keeps the %s typed retry actionable without another roll or plain declaration',async locale=>{
  process.env.NEXT_INTL_TEST_LOCALE=locale;const copy=(locale==='pl'?pl:en);
  const rng=jest.spyOn(diceUtils,'rollD100');const send=jest.fn();const luck=jest.fn();let finish:(accepted:boolean)=>void=()=>{throw Error('No retry');};
  const retry=jest.fn<Promise<boolean>,[]>(()=>new Promise(resolve=>{finish=resolve;}));
  const props={messages,newMessage:'Moja kolejna deklaracja.',setNewMessage:jest.fn(),handleSendMessage:send,currentAudio:null,stopCurrentAudio:jest.fn(),isTTSEnabled:false,activeCharacter:character,characters:[character],hasStartedGame:true,onSpendLuck:luck,pendingDossierSkillRollRetry:{testIds:['dex-test']},retryDossierSkillRoll:retry};
  let mounted=render(<ChatWindow {...props}/>);
  const alert=screen.getByRole('alert');expect(alert).toHaveTextContent(copy.MessageInput.dossierSkillRollRetryDescription);
  const input=screen.getByRole('textbox');expect(input).toBeDisabled();expect(input).toHaveValue(props.newMessage);
  expect(screen.getByTitle(copy.MessageInput.sendMessage)).toBeDisabled();
  expect(screen.getByRole('button',{name:copy.SkillTestCard.resultSaved})).toBeDisabled();
  const button=within(alert).getByRole('button',{name:copy.MessageInput.retryDossierSkillRoll});
  fireEvent.click(button);fireEvent.click(button);expect(retry).toHaveBeenCalledTimes(1);expect(button).toBeDisabled();
  await act(async()=>{finish(false);});act(()=>jest.advanceTimersByTime(46000));
  expect(alert).toBeVisible();expect(button).toBeEnabled();expect(send).not.toHaveBeenCalled();expect(rng).not.toHaveBeenCalled();expect(luck).not.toHaveBeenCalled();
  mounted.unmount();mounted=render(<ChatWindow {...props}/>);
  expect(screen.getByRole('button',{name:copy.SkillTestCard.resultSaved})).toBeDisabled();expect(screen.getByRole('textbox')).toBeDisabled();
  mounted.rerender(<ChatWindow {...props} isLoading/>);expect(screen.getByRole('button',{name:copy.MessageInput.retryDossierSkillRoll})).toBeDisabled();
  mounted.rerender(<ChatWindow {...props} pendingDossierSkillRollRetry={null}/>);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.getByRole('textbox')).toBeEnabled();
  expect(screen.getByRole('button',{name:copy.SkillTestCard.rollDiceButton})).toBeEnabled();expect(retry).toHaveBeenCalledTimes(1);
 });
 it('keeps the existing protocol banner and blocks its plain-text restoration while a typed result is pending',()=>{
  const restore=jest.fn();const props={messages,newMessage:'',setNewMessage:restore,handleSendMessage:jest.fn(),currentAudio:null,stopCurrentAudio:jest.fn(),isTTSEnabled:false,activeCharacter:character,hasStartedGame:true,pendingDossierSkillRollRetry:{testIds:['dex-test']},retryDossierSkillRoll:jest.fn().mockResolvedValue(false),dossierProtocolFailure:{code:'DOSSIER_PROTOCOL_REJECTED' as const,declaration:'Poprzednia deklaracja.'}};
  render(<ChatWindow {...props}/>);expect(screen.getAllByRole('alert')).toHaveLength(2);expect(screen.getByRole('button',{name:pl.MessageInput.restoreDeclaration})).toBeDisabled();expect(restore).not.toHaveBeenCalled();
 });
});
