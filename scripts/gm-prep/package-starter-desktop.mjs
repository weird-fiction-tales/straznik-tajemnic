// Local desktop delivery. Preserve the user's current bundle and its local fixes.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.join(root, '_tester/_base/.silnik');
const base = path.join(os.homedir(), 'Desktop/Straznik Tajemnic AI.app');
const bundle = path.join(root, '.local-playtest/starter-desktop/Straznik Tajemnic AI - Starter.app');
const runtime = path.join(bundle, 'Contents/Resources/runtime');
const dossier = path.join(root, '.local-playtest/starter-dossier');
const hash = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const originalRuntime = path.join(base, 'Contents/Resources/runtime');
const protectedFiles = ['Contents/MacOS/launcher', 'Contents/Info.plist', 'Contents/Resources/runtime/build-info.json', 'Contents/Resources/runtime/.next/BUILD_ID', 'Contents/Resources/runtime/src/app/api/chat/_helpers/run-chat-pipeline.ts'];
const original = Object.fromEntries(protectedFiles.map((f) => [f, hash(path.join(base, f))]));
if (!fs.existsSync(runtime)) {
  fs.mkdirSync(path.dirname(bundle), { recursive: true });
  execFileSync('rsync', ['-a', '--exclude', '.next/cache', base + '/', bundle + '/']);
}
const overlays = [
  'src/app/api/chat/_helpers/build-handouts-context.ts',
  'src/components/chat/narrative/render-handout.tsx',
  'src/lib/handout-resolver.ts',
  'src/lib/immersion/strefa-11-localization.ts',
  'src/lib/pdf/gold-master-registry.ts',
  'src/lib/starter-haunting-data.ts',
];
// Never overwrite a user's local fix with a stale worktree file.
for (const f of overlays) {
  const baseline = execFileSync('git', ['show', 'HEAD:_tester/_base/.silnik/' + f], { cwd: root });
  if (!baseline.equals(fs.readFileSync(path.join(originalRuntime, f)))) throw new Error('Desktop baseline changed: ' + f);
  fs.copyFileSync(path.join(source, f), path.join(runtime, f));
}
for (const name of ['prepared-dossier.ts', 'starter-handouts.ts', 'starter-scenes.ts', 'starter-audio.ts', 'starter-dossier.ts', 'starter-document.ts', 'starter-artwork.generated.ts']) {
  fs.mkdirSync(path.join(runtime, 'src/lib/adventures'), { recursive: true });
  fs.copyFileSync(path.join(source, 'src/lib/adventures', name), path.join(runtime, 'src/lib/adventures', name));
}
// The private catalog and photographic plates remain local to this bundle.
const catalog = path.join(runtime, 'src/lib/adventures-catalog.private.ts');
const originalCatalog = path.join(originalRuntime, 'src/lib/adventures-catalog.private.ts');
if (fs.existsSync(originalCatalog)) {
  const text = fs.readFileSync(originalCatalog, 'utf8');
  fs.writeFileSync(path.join(runtime, 'src/lib/adventures-catalog.desktop-base.ts'), text);
  fs.writeFileSync(catalog, "import { ADVENTURE_CATALOG as BASE } from './adventures-catalog.desktop-base';\nimport { STARTER_HAUNTING_ADVENTURE } from './starter-haunting-data';\nexport const ADVENTURE_CATALOG = [STARTER_HAUNTING_ADVENTURE, ...BASE.filter(a => a.id !== 'nawiedzony-dom')];\n");
} else {
  fs.writeFileSync(catalog, "import { STARTER_HAUNTING_ADVENTURE } from './starter-haunting-data';\nexport const ADVENTURE_CATALOG = [STARTER_HAUNTING_ADVENTURE];\n");
}
const publicDossier = path.join(runtime, 'public/starter-dossier');
fs.mkdirSync(publicDossier, { recursive: true });
for (const locale of ['pl', 'en']) {
  fs.cpSync(path.join(dossier, locale), path.join(publicDossier, locale), { recursive: true });
  const htmlPath = path.join(publicDossier, locale, 'index.html');
  const label = locale === 'pl' ? 'Otwórz aplikację' : 'Open application';
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace('<nav>', `<nav><a data-testid="open-application" href="/${locale}">${label}</a>`);
  fs.writeFileSync(htmlPath, html);
}
for (const f of ['index.html', 'audio-budget.json', 'render-report.json', 'schema-compatibility.json']) fs.copyFileSync(path.join(dossier, f), path.join(publicDossier, f));
fs.copyFileSync(path.join(dossier, 'source/ZC_Starter.pdf'), path.join(bundle, 'Contents/Resources/Starter-source.pdf'));

// Exclude the private static dossier from locale rewriting.
const middleware = path.join(runtime, 'src/middleware.ts');
let mw = fs.readFileSync(path.join(originalRuntime, 'src/middleware.ts'), 'utf8');
if (!mw.includes("startsWith('/starter-dossier/')")) {
  mw = mw.replace('  return intlMiddleware(request);', "  if (request.nextUrl.pathname.startsWith('/starter-dossier/')) return NextResponse.next();\n  return intlMiddleware(request);");
  fs.writeFileSync(middleware, mw);
}
// Preserve the desktop supervisor, adding only an initial local document path.
const supervisorPath = path.join(runtime, 'desktop/supervisor.mjs');
let supervisor = fs.readFileSync(path.join(originalRuntime, 'desktop/supervisor.mjs'), 'utf8');
supervisor = supervisor.replace('const basePort = options.basePort || 4050;', "const basePort = options.basePort || 4050;\n  const startPath = options.startPath || '';\n  if (startPath && (!startPath.startsWith('/') || startPath.startsWith('//'))) throw new Error('Invalid desktop start path');");
supervisor = supervisor.replace('`http://127.0.0.1:${basePort}`', '`http://127.0.0.1:${basePort}${startPath}`');
supervisor = supervisor.replace('const windowUrl = `http://127.0.0.1:${targetPort}`;', 'const windowUrl = `http://127.0.0.1:${targetPort}${startPath}`;');
fs.writeFileSync(supervisorPath, supervisor);
fs.writeFileSync(path.join(runtime, 'desktop/starter-supervisor.mjs'), "import { runSupervisor } from './supervisor.mjs';\nimport { fileURLToPath } from 'node:url';\nawait runSupervisor({ appDir: fileURLToPath(new URL('../', import.meta.url)), basePort: 4065, startPath: '/starter-dossier/pl/index.html' });\n");

const nodeDir = path.dirname(execFileSync('which', ['node'], { encoding: 'utf8' }).trim());
fs.writeFileSync(path.join(bundle, 'Contents/MacOS/launcher'), `#!/bin/zsh\nset -eu\nexport PATH=${JSON.stringify(nodeDir + ':/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin')}\nBUNDLE_DIR="$(cd "$(dirname "$0")/.." && pwd)"\nRUNTIME="$BUNDLE_DIR/Resources/runtime"\nexport ZEW_DATA_DIR="$HOME/Library/Application Support/ZewCthulhu-Starter"\nexport ZEW_LOGS_DIR="$ZEW_DATA_DIR/logs"\nexport ZEW_LOG_FILE="$ZEW_LOGS_DIR/starter.log"\nexport ZEW_DESKTOP_SELF_UPDATE=0\nmkdir -p "$ZEW_LOGS_DIR"\ncd "$RUNTIME"\nexec node desktop/starter-supervisor.mjs >>"$ZEW_LOG_FILE" 2>&1\n`, { mode: 0o755 });
const plist = path.join(bundle, 'Contents/Info.plist');
let info = fs.readFileSync(path.join(base, 'Contents/Info.plist'), 'utf8').replaceAll('com.aios.straznik-tajemnic-ai', 'com.aios.straznik-tajemnic-ai.starter').replaceAll('<string>Strażnik Tajemnic AI</string>', '<string>Strażnik Tajemnic AI - Starter</string>');
fs.writeFileSync(plist, info);
if (process.argv.includes('--finalize')) {
  const baseInfo = JSON.parse(fs.readFileSync(path.join(originalRuntime, 'build-info.json'), 'utf8'));
  const buildId = fs.readFileSync(path.join(runtime, '.next/BUILD_ID'), 'utf8').trim();
  if (buildId === baseInfo.buildId) throw new Error('Starter must have its own completed build');
  const sourceChanges = [...overlays, 'src/middleware.ts', 'desktop/supervisor.mjs', 'src/lib/adventures-catalog.private.ts', ...['prepared-dossier.ts', 'starter-handouts.ts', 'starter-scenes.ts', 'starter-audio.ts', 'starter-dossier.ts', 'starter-document.ts', 'starter-artwork.generated.ts'].map((f) => 'src/lib/adventures/' + f)].sort().map((f) => [f, hash(path.join(runtime, f))]);
  fs.writeFileSync(path.join(runtime, 'build-info.json'), JSON.stringify({
    ...baseInfo,
    builtAt: new Date().toISOString(),
    buildId,
    channel: 'starter-dossier-review',
    sourceBranch: 'codex/starter-dossier',
    baseDesktopBuildId: baseInfo.buildId,
    baseDesktopSourceChangesSha256: baseInfo.sourceChangesSha256,
    sourceChangesSha256: createHash('sha256').update(JSON.stringify(sourceChanges)).digest('hex'),
    localTestOnly: true,
    starter: { edition: 'blackmonk-2019-v1.3-prepared-1', handoutArtwork: 'approved', sceneContent: 'pending', runtimeIntegration: 'pending', audioProduction: 'pending', gameplay: 'not_run' },
  }, null, 2) + '\n');
}
fs.writeFileSync(path.join(root, '.local-playtest/starter-desktop/staging-manifest.json'), JSON.stringify({ base, bundle, original, overlays, port: 4065, dataDirectory: 'ZewCthulhu-Starter', selfUpdate: false, gameplayTested: false, audioProduced: false }, null, 2) + '\n');
for (const [f, digest] of Object.entries(original)) if (hash(path.join(base, f)) !== digest) throw new Error('Original bundle changed: ' + f);
console.log(JSON.stringify({ staged: bundle, originalPreserved: true, overlays: overlays.length, next: 'Build the staged runtime with NEXT_PUBLIC_LOCAL_MODE=true.' }));
