import data from './compact-keeper-data.json';

export const COMPACT_KEEPER_MARKER = '## KEEPER CONTRACT V2';
type Locale = 'pl' | 'en';

/** Keep every mechanical capability available: unusual actions must not depend on keyword routing. */
export function getCompactKeeperInstructions(
  locale: Locale,
  options: { mechanics?: boolean; voice?: boolean } = {},
): string {
  const text = data[locale];
  if (options.mechanics === false) {
    const tests = locale === 'pl' ? '### Test i rozstrzygnięcie' : '### Tests and resolution';
    const scenes = locale === 'pl' ? '### Sceny i wiedza' : '### Scenes and knowledge';
    const contract = text.contract.slice(0, text.contract.indexOf(tests)) +
      text.contract.slice(text.contract.indexOf(scenes));
    return [COMPACT_KEEPER_MARKER, text.core, contract, text.modules.opening,
      options.voice ? text.modules.voice : ''].filter(Boolean).join('\n\n');
  }
  return [COMPACT_KEEPER_MARKER, text.core, text.contract, text.profile,
    text.modules['health-sanity'], text.modules.combat, text.modules.magic,
    text.modules.chase, text.modules.opening, options.voice ? text.modules.voice : '']
    .filter(Boolean).join('\n\n');
}

export function getCompactKeeperReminder(locale: Locale): string {
  return data[locale].reminder;
}
