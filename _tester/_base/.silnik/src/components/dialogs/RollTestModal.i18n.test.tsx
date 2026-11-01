import { render, screen } from '@testing-library/react';
import { RollTestModal } from './RollTestModal';
import { RollTestResult } from './roll-test-result';
import { createSkillRoll } from '@/lib/dice-utils';

jest.mock('./ArtDecoDice3D', () => ({ ArtDecoDice3D: () => null }));

const test = {
  testId: 'visual-locale',
  skill: 'Spostrzegawczość',
  value: 65,
  difficulty: 'zwykly' as const,
  bonusDice: 0,
};

describe('roll window visible language', () => {
  const previousLocale = process.env.NEXT_INTL_TEST_LOCALE;
  afterEach(() => {
    process.env.NEXT_INTL_TEST_LOCALE = previousLocale;
  });

  it.each(['pl', 'en'])(
    'localizes the canonical skill name in %s',
    (locale) => {
      process.env.NEXT_INTL_TEST_LOCALE = locale;
      render(<RollTestModal open onOpenChange={jest.fn()} test={test} />);
      expect(screen.getByRole('heading')).toHaveTextContent(
        locale === 'en' ? 'Test: Spot Hidden' : 'Test: Spostrzegawczość'
      );
      expect(test.skill).toBe('Spostrzegawczość');
    }
  );

  it.each(['pl', 'en'])(
    'localizes the verdict in %s and preserves the roll',
    (locale) => {
      process.env.NEXT_INTL_TEST_LOCALE = locale;
      const roll = createSkillRoll(test.skill, test.value, 42, false);
      render(
        <RollTestResult
          test={test}
          phase="done"
          animValue={42}
          roll={roll}
          availableLuck={0}
          luckNeeded={null}
          onRoll={jest.fn()}
          onSpendLuck={jest.fn()}
          onSend={jest.fn()}
          onClose={jest.fn()}
        />
      );
      expect(screen.getByTestId('roll-outcome-label')).toHaveTextContent(
        locale === 'en' ? 'SUCCESS' : 'SUKCES'
      );
      expect(roll).toMatchObject({ total: 42, outcome: 'regular' });
    }
  );
});
