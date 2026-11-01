import { lintAgencyViolations, type AgencyLintOptions } from './agency-linter';

/** Source adapters alone own inventory. Remove model motions; never authorize them. */
export function filterSourceOwnedInventoryNarration(text:string,names:string[],options:AgencyLintOptions,sourceOwned:boolean) {
  const lint=lintAgencyViolations(text,names,options);
  if(!sourceOwned || !lint.hasViolation || !lint.violations.every(violation=>violation.type==='inventory') || lint.sanitizedText===undefined) {
    return {text,lint};
  }
  // The validated source plan supplies the actual result, not the linter's generic filler.
  const safe=lint.sanitizedText.replace(/^(?:Stoicie na progu zdarzenia, obserwując otoczenie\.|Stoisz na progu zdarzenia, obserwując otoczenie\.|You stand on the threshold, taking in your surroundings\.)\s*/, '');
  return {text:safe,lint:lintAgencyViolations(safe,names,options)};
}
