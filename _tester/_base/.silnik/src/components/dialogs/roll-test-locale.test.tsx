import {render,screen,cleanup} from '@testing-library/react';
import {RollTestModal} from './RollTestModal';
import {RollTestResult} from './roll-test-result';
import {createSkillRoll,formatRollForChat} from '@/lib/dice-utils';
import {SkillTestCard} from '@/components/chat/chat-window/components/skill-test-card';
const test={testId:'test',skill:'Prawo',value:65,difficulty:'zwykly' as const,bonusDice:0};
afterEach(()=>{cleanup();delete process.env.NEXT_INTL_TEST_LOCALE;});
it('English dice dialog and card use localized display names without changing test identity',()=>{
 process.env.NEXT_INTL_TEST_LOCALE='en';
 render(<RollTestModal open onOpenChange={()=>{}} test={test}/>);
 expect(screen.getByRole('heading')).toHaveTextContent('Test: Law');
 expect(screen.getByText('Let fate decide')).toBeInTheDocument();
 expect(screen.queryByText(/Niech zadecyduje/)).not.toBeInTheDocument();
 cleanup();render(<SkillTestCard id="test" skillName="Prawo" skillValue={65} difficulty="zwykly" modifiers={[]} justification="A legal approach"/>);
 expect(screen.getByText('Law')).toBeInTheDocument();
});
it('English result and submitted chat text preserve the actual roll and required threshold',()=>{
 process.env.NEXT_INTL_TEST_LOCALE='en';const roll=createSkillRoll('Prawo',65,57,false,'Frank',0,'hard');
 render(<RollTestResult test={{...test,difficulty:'trudny'}} phase="done" animValue={57} roll={roll} availableLuck={60} luckNeeded={25} onRoll={()=>{}} onSpendLuck={()=>{}} onSend={()=>{}} onClose={()=>{}}/>);
 expect(screen.getByText(/FAILURE/)).toBeInTheDocument();expect(screen.queryByText(/PORAŻKA/)).not.toBeInTheDocument();
 const text=formatRollForChat(roll,'en');expect(text).toContain('57');expect(text).toContain('Law');expect(text).toContain('Hard');expect(text).not.toMatch(/Wynik|Progi|SUKCES|ZDANY/);
});
