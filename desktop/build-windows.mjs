#!/usr/bin/env node
/**
 * Strażnik Tajemnic AI - Generator Paczki Dystrybucyjnej dla Windows (Zero-Setup)
 *
 * Tworzy samowystarczalne archiwum ZIP (straznik-tajemnic-windows.zip):
 * 1. Kopiuje pliki produkcyjne gry (build Next.js, zależności z natywnym better-sqlite3 win32-x64, public, desktop).
 * 2. Pobiera oficjalną binarkę portable Node.js dla Windows x64 (brak wymogu instalacji Node w systemie gracza).
 * 3. Dołącza główny launcher "Graj - Strażnik Tajemnic.cmd" i instrukcję "INSTRUKCJA-WINDOWS.txt".
 * 4. Kompresuje strukturę do straznik-tajemnic-windows.zip.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parsowanie argumentów CLI
const args = process.argv.slice(2);
let outputDir = path.resolve(__dirname, '..', 'dist');
let nodeVersion = 'v22.12.0';
let skipDownload = false;
let commitShaArg = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output' && args[i + 1]) {
    outputDir = path.resolve(args[++i]);
  } else if (args[i] === '--node-version' && args[i + 1]) {
    nodeVersion = args[++i];
  } else if (args[i] === '--skip-download') {
    skipDownload = true;
  } else if (args[i] === '--commit' && args[i + 1]) {
    commitShaArg = args[++i];
  }
}

const rootDir = path.resolve(__dirname, '..');
let gameDir = rootDir;
const engineDir = path.join(rootDir, '_tester', '_base', '.silnik');
if (fs.existsSync(path.join(engineDir, 'package.json'))) {
  gameDir = engineDir;
}

const pkg = JSON.parse(fs.readFileSync(path.join(gameDir, 'package.json'), 'utf8'));
const version = pkg.version || '0.9.5';

function resolveCommitSha() {
  if (commitShaArg && /^[a-f0-9]{7,40}$/i.test(commitShaArg.trim())) {
    return commitShaArg.trim().toLowerCase();
  }
  if (process.env.GITHUB_SHA && /^[a-f0-9]{7,40}$/i.test(process.env.GITHUB_SHA.trim())) {
    return process.env.GITHUB_SHA.trim().toLowerCase();
  }
  try {
    const out = execSync('git rev-parse HEAD', { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (/^[a-f0-9]{7,40}$/i.test(out)) return out.toLowerCase();
  } catch (_) {}
  try {
    const existing = JSON.parse(fs.readFileSync(path.join(gameDir, 'build-info.json'), 'utf8'));
    if (typeof existing.commitSha === 'string' && /^[a-f0-9]{7,40}$/i.test(existing.commitSha.trim())) {
      return existing.commitSha.trim().toLowerCase();
    }
  } catch (_) {}
  return '';
}

const commitSha = resolveCommitSha();
const shortCommit = commitSha ? commitSha.slice(0, 7) : '';
const builtAt = new Date().toISOString();

console.log('====================================================');
console.log(` Strażnik Tajemnic AI v${version}${shortCommit ? ` (${shortCommit})` : ''} - Budowanie Paczki Windows`);
console.log('====================================================\n');

const stagingRoot = path.join(outputDir, '_staging');
const packageFolderName = 'straznik-tajemnic-windows';
const packageDir = path.join(stagingRoot, packageFolderName);
const runtimeDir = path.join(packageDir, 'runtime');
const binDir = path.join(runtimeDir, 'bin');
const zipFile = path.join(outputDir, 'straznik-tajemnic-windows.zip');

// 1. Czyszczenie i przygotowanie katalogów roboczych
console.log('[1/5] Przygotowanie katalogów tymczasowych...');
fs.rmSync(stagingRoot, { recursive: true, force: true });
fs.mkdirSync(binDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });

// 2. Kopiowanie punktu wejścia i instrukcji
console.log('[2/5] Kopiowanie plików startowych gracza...');
const launcherSource = path.join(rootDir, 'desktop', 'graj-windows.cmd');
const instructionSource = path.join(rootDir, 'desktop', 'INSTRUKCJA-WINDOWS.txt');

if (fs.existsSync(launcherSource)) {
  fs.copyFileSync(launcherSource, path.join(packageDir, 'Graj - Strażnik Tajemnic.cmd'));
} else {
  throw new Error(`Nie znaleziono pliku źródłowego: ${launcherSource}`);
}

if (fs.existsSync(instructionSource)) {
  fs.copyFileSync(instructionSource, path.join(packageDir, 'INSTRUKCJA-WINDOWS.txt'));
} else {
  throw new Error(`Nie znaleziono pliku źródłowego: ${instructionSource}`);
}

// Przygotowanie katalogów dla pełnej przenośności (Zero-Setup Portable):
// data/ - baza danych SQLite, sejwy, profil Chrome, RAG
// logs/ - pliki logów sesyjnych i diagnostycznych
fs.mkdirSync(path.join(packageDir, 'data'), { recursive: true });
fs.mkdirSync(path.join(packageDir, 'logs'), { recursive: true });

// 3. Kopiowanie runtime gry z wykluczeniami
console.log('[3/5] Kopiowanie zasobów aplikacji (Next.js build, node_modules, public)...');

const isExcluded = (filePath) => {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('/.next/cache')) return true;
  if (normalized.includes('/.git')) return true;
  if (normalized.includes('/.worktrees')) return true;
  if (normalized.includes('/.agent')) return true;
  if (normalized.includes('/.agents')) return true;
  if (normalized.includes('/data/saves')) return true;
  if (normalized.includes('/data/sessions')) return true;
  if (normalized.includes('/data/results')) return true;
  if (normalized.includes('/data/usage')) return true;
  if (normalized.includes('/data/pricing')) return true;
  if (normalized.includes('/data/rag/rules')) return true;
  if (normalized.includes('/data/rag/rules-profile.json')) return true;
  if (normalized.includes('/data/rag/capabilities.json')) return true;
  if (normalized.includes('/data/rag/campaigns__')) return true;
  if (normalized.endsWith('.DS_Store')) return true;
  return false;
};

// Kopiowanie .next
const nextDir = path.join(gameDir, '.next');
if (fs.existsSync(nextDir)) {
  console.log('  -> Kopiowanie .next...');
  fs.cpSync(nextDir, path.join(runtimeDir, '.next'), {
    recursive: true,
    filter: (src) => !isExcluded(src)
  });
} else {
  console.warn('  [UWAGA] Brak katalogu .next! Upewnij się, że uruchomiono npm run build.');
}

// Kopiowanie node_modules
const modulesDir = path.join(gameDir, 'node_modules');
if (fs.existsSync(modulesDir)) {
  console.log('  -> Kopiowanie node_modules...');
  fs.cpSync(modulesDir, path.join(runtimeDir, 'node_modules'), {
    recursive: true,
    filter: (src) => !isExcluded(src)
  });
} else {
  console.warn('  [UWAGA] Brak katalogu node_modules!');
}

// Kopiowanie public
const publicDir = path.join(gameDir, 'public');
if (fs.existsSync(publicDir)) {
  console.log('  -> Kopiowanie public...');
  fs.cpSync(publicDir, path.join(runtimeDir, 'public'), {
    recursive: true,
    filter: (src) => !isExcluded(src)
  });
}

// Kopiowanie desktop
const desktopDir = path.join(rootDir, 'desktop');
if (fs.existsSync(desktopDir)) {
  console.log('  -> Kopiowanie desktop...');
  fs.cpSync(desktopDir, path.join(runtimeDir, 'desktop'), {
    recursive: true,
    filter: (src) => !isExcluded(src)
  });
}

// Kopiowanie package.json i zapis build-info.json
fs.copyFileSync(path.join(gameDir, 'package.json'), path.join(runtimeDir, 'package.json'));
fs.writeFileSync(
  path.join(runtimeDir, 'build-info.json'),
  `${JSON.stringify({ version, commitSha, shortCommit, builtAt }, null, 2)}\n`
);

// Kopiowanie opcjonalnych danych startowych (np. data/ z wykluczeniami)
const dataDir = path.join(gameDir, 'data');
if (fs.existsSync(dataDir)) {
  console.log('  -> Kopiowanie data/ (wykluczając wrażliwe dane i zapisy)...');
  fs.cpSync(dataDir, path.join(runtimeDir, 'data'), {
    recursive: true,
    filter: (src) => !isExcluded(src)
  });
}

// 4. Pobieranie oficjalnego portable Node.js x64 dla Windows
console.log(`[4/5] Przygotowanie środowiska portable Node.js (${nodeVersion})...`);
const nodeExePath = path.join(binDir, 'node.exe');

async function ensurePortableNode() {
  if (skipDownload && fs.existsSync(nodeExePath)) {
    console.log(`  Używam istniejącego pliku: ${nodeExePath}`);
    return;
  }

  const url = `https://nodejs.org/dist/${nodeVersion}/win-x64/node.exe`;
  console.log(`  Pobieram: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Błąd pobierania Node.js: HTTP ${response.status} ${response.statusText}`);
  }

  const fileStream = fs.createWriteStream(nodeExePath);
  await finished(Readable.fromWeb(response.body).pipe(fileStream));
  
  const stats = fs.statSync(nodeExePath);
  console.log(`  Pomyślnie zapisano portable node.exe (${(stats.size / 1024 / 1024).toFixed(1)} MB).`);
}

await ensurePortableNode();

// 5. Kompresja do archiwum ZIP
console.log('[5/5] Kompresja do archiwum ZIP...');
fs.rmSync(zipFile, { force: true });

try {
  if (process.platform === 'win32') {
    let compressed = false;
    // 1. 7z (standard w GitHub Actions Windows runners, szybki i odporny na litery dysków)
    try {
      console.log('  Używam 7z do kompresji ZIP...');
      execSync(`7z a -tzip -mx=5 "${zipFile}" "${packageFolderName}"`, { cwd: stagingRoot, stdio: 'inherit' });
      compressed = true;
    } catch (_) {}

    // 2. Natywny tar.exe z System32 z flagą --force-local (blokuje mylenie litery dysku np. D: ze zdalnym hostem)
    if (!compressed) {
      try {
        console.log('  Fallback: Używam System32\\tar.exe (--force-local)...');
        const tarExe = fs.existsSync('C:\\Windows\\System32\\tar.exe') ? 'C:\\Windows\\System32\\tar.exe' : 'tar.exe';
        execSync(`"${tarExe}" --force-local -a -c -f "${zipFile}" -C "${stagingRoot}" "${packageFolderName}"`, { stdio: 'inherit' });
        compressed = true;
      } catch (_) {}
    }

    // 3. Fallback do PowerShell Compress-Archive
    if (!compressed) {
      console.log('  Fallback: Używam PowerShell Compress-Archive...');
      const sourceFolder = path.join(stagingRoot, packageFolderName);
      execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${sourceFolder}' -DestinationPath '${zipFile}' -Force"`, { stdio: 'inherit' });
      compressed = true;
    }
  } else {
    // macOS / Linux runner
    try {
      console.log('  Używam systemowego zip...');
      execSync(`zip -r -q "${zipFile}" "${packageFolderName}"`, { cwd: stagingRoot, stdio: 'inherit' });
    } catch (_) {
      console.log('  Fallback do tar.exe / tar...');
      execSync(`tar -a -c -f "${zipFile}" -C "${stagingRoot}" "${packageFolderName}"`, { stdio: 'inherit' });
    }
  }

  const zipStats = fs.statSync(zipFile);
  console.log(`\n====================================================`);
  console.log(` Sukces! Paczka Windows gotowa do dystrybucji:`);
  console.log(` Ścieżka: ${zipFile}`);
  console.log(` Rozmiar: ${(zipStats.size / 1024 / 1024).toFixed(1)} MB`);
  console.log(`====================================================\n`);
} finally {
  // Czyszczenie katalogu staging po spakowaniu
  fs.rmSync(stagingRoot, { recursive: true, force: true });
}
