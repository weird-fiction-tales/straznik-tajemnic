import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const script = readFileSync(new URL('./build-app.sh', import.meta.url), 'utf8');
assert.doesNotMatch(script, /bash\s+"\$DESKTOP_DIR\/cold-start\.sh"/, 'Rebuilding an app must never reset a player profile');
assert.match(script, /--no-desktop-copy/);
assert.match(script, /--output/);
console.log('PASS: isolated rebuild preserves player data');
