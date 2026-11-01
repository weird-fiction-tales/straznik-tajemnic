/** Local-only protocol telemetry. Never log text, identifiers, labels or violation snippets. */
export function logLocalProtocolDiagnostic(
  stage: 'initial' | 'retry' | 'sanitized' | 'final',
  text: string,
  correction: boolean,
  violationTypes: readonly string[] = [],
): void {
  if (process.env.ZEW_LOCAL_PLAYTEST !== 'prabuty-tomasz') return;
  const count = (pattern: RegExp) => [...text.matchAll(pattern)].length;
  const allowed = new Set(['movement','inventory','examination','motorics','dialogue']);
  console.info('[local-dossier-protocol]', {
    stage,
    correction,
    counts: {
      locationPl: count(/\[LOKACJA\s*:[^\]]*\]/gi),
      locationEn: count(/\[LOCATION\s*:[^\]]*\]/gi),
      offGraph: count(/\[(?:LOKACJA|LOCATION)\s*:\s*OFF_GRAPH\s*\|[^\]]*\]/g),
      time: count(/\[AKTUALNY CZAS\s*:[^\]]*\]/gi),
    },
    violationTypes: [...new Set(violationTypes.filter(type => allowed.has(type)))],
  });
}
