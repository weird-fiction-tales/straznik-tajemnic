import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ChatWindow } from './index';
import pl from '../../../../messages/pl.json';
import en from '../../../../messages/en.json';

jest.mock('@/hooks/useResolvedPortrait', () => ({ useResolvedPortrait: () => null }));

const declaration = 'Gaszę latarkę i wchodzę do sieni za zaproszeniem.';
type Failure = {code:'DOSSIER_PROTOCOL_REJECTED';declaration:string};

describe('ChatWindow rejected dossier declaration recovery', () => {
  beforeEach(() => { jest.useFakeTimers(); localStorage.clear(); });
  afterEach(() => { delete process.env.NEXT_INTL_TEST_LOCALE; jest.useRealTimers(); });

  it.each(['pl','en'] as const)('keeps an actionable %s error after 45 seconds and restores without sending', async locale => {
    process.env.NEXT_INTL_TEST_LOCALE = locale;
    const copy = (locale === 'pl' ? pl : en).MessageInput;
    let rejectResponse: (accepted:boolean) => void = () => { throw new Error('No request'); };
    const send = jest.fn<Promise<boolean>, [string]>(() => new Promise<boolean>(resolve => { rejectResponse=resolve; }));
    function Harness() {
      const [text,setText]=useState(declaration);
      const [failure,setFailure]=useState<Failure|null>(null);
      const handleSendMessage=async (message:string) => {
        if(!await send(message)) setFailure({code:'DOSSIER_PROTOCOL_REJECTED',declaration:message});
      };
      const recoveryProps = {dossierProtocolFailure:failure};
      return <ChatWindow {...recoveryProps} messages={[{id:'earlier',role:'assistant',content:'Potwierdzona wcześniejsza scena.',timestamp:new Date(0)}]}
        newMessage={text} setNewMessage={setText} handleSendMessage={handleSendMessage}
        currentAudio={null} stopCurrentAudio={jest.fn()} isTTSEnabled={false} activeCharacter={null} hasStartedGame />;
    }
    render(<Harness />);
    const input=screen.getByRole('textbox');
    fireEvent.keyDown(input,{key:'Enter'});
    expect(input).toHaveValue('');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(declaration);
    await act(async()=>{rejectResponse(false);});
    const alert=screen.getByRole('alert');
    expect(alert).toHaveTextContent(copy.dossierProtocolFailureTitle);
    expect(alert).toHaveTextContent(copy.dossierProtocolFailureDescription);
    expect(alert).toHaveTextContent(declaration);
    act(()=>jest.advanceTimersByTime(46000));
    expect(alert).toBeVisible();
    fireEvent.click(within(alert).getByRole('button',{name:copy.restoreDeclaration}));
    expect(input).toHaveValue(declaration);
    expect(send).toHaveBeenCalledTimes(1);

    fireEvent.change(input,{target:{value:'Nowa własna deklaracja.'}});
    const restore=within(alert).getByRole('button',{name:copy.restoreDeclaration});
    expect(restore).toBeDisabled();
    expect(alert).toHaveTextContent(copy.restoreDeclarationOccupied);
    fireEvent.click(restore);
    expect(input).toHaveValue('Nowa własna deklaracja.');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not show a rejection banner without the specific failure prop', () => {
    render(<ChatWindow messages={[]} newMessage="" setNewMessage={jest.fn()} handleSendMessage={jest.fn()}
      currentAudio={null} stopCurrentAudio={jest.fn()} isTTSEnabled={false} activeCharacter={null} hasStartedGame />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
