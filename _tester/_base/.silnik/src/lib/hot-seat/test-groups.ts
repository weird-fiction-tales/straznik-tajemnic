import type { SkillTestData } from '@/lib/parsers/types';

export interface CollectedTestResult {
  testId: string;
  chatMessage: string;
  systemContext: string;
  skillRolls?: import('@/lib/parsers/types').SkillRollResolution[];
}

export interface TestGroupProgress {
  results: CollectedTestResult[];
  complete: boolean;
  combinedMessage?: string;
}

/**
 * Dokłada wynik do grupy bez duplikowania rzutu. Dopiero komplet testów zwraca
 * jedną wiadomość do MG, w kolejności kart z odpowiedzi.
 */
export function collectTestGroupResult(
  groupTests: SkillTestData[],
  currentResults: CollectedTestResult[],
  nextResult: CollectedTestResult
): TestGroupProgress {
  const results = [
    ...currentResults.filter((result) => result.testId !== nextResult.testId),
    nextResult,
  ];
  const complete =
    groupTests.length > 0 &&
    groupTests.every((test) =>
      results.some((result) => result.testId === test.id)
    );

  if (!complete) return { results, complete: false };

  const byTestId = new Map(results.map((result) => [result.testId, result]));
  return {
    results,
    complete: true,
    combinedMessage: [
      'Wyniki testów obojga badaczy:',
      ...groupTests.map(
        (test) =>
          byTestId.get(test.id)?.systemContext ??
          byTestId.get(test.id)?.chatMessage ??
          ''
      ),
    ]
      .filter(Boolean)
      .join('\n'),
  };
}
