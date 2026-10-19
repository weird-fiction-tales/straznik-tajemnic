#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync, spawnSync, spawn } from 'node:child_process';
import http from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Parse CLI arguments
const rawArgs = process.argv.slice(2);
const args = {};
for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const val = rawArgs[i + 1] && !rawArgs[i + 1].startsWith('--') ? rawArgs[++i] : 'true';
    args[key] = val;
  }
}

const target = path.resolve(args.target || args.bundle || '');
const url = args.url || '';
const expectedSha256 = (args.sha256 || '').toLowerCase();
const version = args.version || '';
const expectedCommit = (args.commit || '').trim().toLowerCase();
const bundleId = args['bundle-id'] || 'com.aios.straznik-tajemnic-ai';
const expectedSize = parseInt(args.size || '0', 10);
const dataDir = path.resolve(args['data-dir'] || '');
const port = parseInt(args.port || '4050', 10);
const platform = args.platform || process.platform;
const minimumMacOS = args['minimum-macos'] || '';
const testMode = args['test-mode'] === 'true' || process.env.TEST_MODE === '1';
const desktopPid = parseInt(args['desktop-pid'] || process.env.DESKTOP_PID || '0', 10);
let splashProcess = null;

function showUpdateSplash(statusMessage) {
  if (testMode || process.env.TEST_MODE === '1' || splashProcess) return;
  const splashPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'updater-splash.html');
  if (!fs.existsSync(splashPath)) return;

  try {
    const encodedStatus = encodeURIComponent(statusMessage || 'Przebudowa mechanizmów Strażnika Tajemnic…');
    const splashUrl = `file://${splashPath}?status=${encodedStatus}`;

    if (platform === 'darwin') {
      // Uruchomienie minimalistycznego okna w trybie app lub przez Safari/Chrome
      splashProcess = spawn('open', ['-n', '-a', 'Safari', splashUrl], { detached: true, stdio: 'ignore' });
      splashProcess.unref();
    } else if (platform === 'win32') {
      splashProcess = spawn('mshta', [`${splashPath}#${encodedStatus}`], { detached: true, stdio: 'ignore' });
      splashProcess.unref();
    }
  } catch (_) {}
}

function closeUpdateSplash() {
  if (splashProcess && splashProcess.pid) {
    try {
      if (platform === 'win32') {
        spawnSync('taskkill', ['/F', '/PID', String(splashProcess.pid)], { stdio: 'ignore' });
      } else {
        process.kill(splashProcess.pid, 'SIGTERM');
      }
    } catch (_) {}
    splashProcess = null;
  }
}

if (!target || !url || !expectedSha256 || !version || !dataDir) {
  console.error('Błąd: brakujące wymagane argumenty dla update-worker.');
  process.exit(2);
}

const updatesDir = path.join(dataDir, 'updates');
const statusFile = path.join(updatesDir, 'status.json');
const lockDir = path.join(updatesDir, 'update.lock');
const workDir = path.join(updatesDir, `work-${version}-${process.pid}`);
const operationId = `${version}-${Date.now()}-${process.pid}`;

let swapped = false;
let backupLocation = null;
let liveLocation = null;

function verifyOrWriteBuildInfo(runtimeRoot) {
  if (!runtimeRoot || !fs.existsSync(runtimeRoot)) return true;
  const buildInfoPath = path.join(runtimeRoot, 'build-info.json');
  if (fs.existsSync(buildInfoPath)) {
    try {
      const info = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
      const actualCommit = typeof info.commitSha === 'string' ? info.commitSha.trim().toLowerCase() : '';
      if (expectedCommit && actualCommit) {
        if (actualCommit !== expectedCommit && !actualCommit.startsWith(expectedCommit) && !expectedCommit.startsWith(actualCommit)) {
          return false;
        }
      }
      if (expectedCommit && !actualCommit) {
        info.commitSha = expectedCommit;
        info.shortCommit = expectedCommit.slice(0, 7);
        fs.writeFileSync(buildInfoPath, `${JSON.stringify(info, null, 2)}\n`);
      }
      return true;
    } catch (_) {
      return !expectedCommit;
    }
  }
  if (expectedCommit) {
    try {
      const info = {
        version,
        commitSha: expectedCommit,
        shortCommit: expectedCommit.slice(0, 7),
        builtAt: new Date().toISOString(),
      };
      fs.writeFileSync(buildInfoPath, `${JSON.stringify(info, null, 2)}\n`);
    } catch (_) {}
  }
  return true;
}

function writeStatus(state, message) {
  const payload = {
    id: operationId,
    state,
    version,
    ...(expectedCommit ? { commitSha: expectedCommit } : {}),
    message,
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(updatesDir, { recursive: true });
  const tmp = path.join(updatesDir, `status.${process.pid}.tmp`);
  fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`);
  fs.renameSync(tmp, statusFile);
}

function cleanup() {
  try {
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  } catch (_) {}
  try {
    if (fs.existsSync(lockDir)) {
      fs.rmdirSync(lockDir);
    }
  } catch (_) {}
}

function rollback(reason) {
  writeStatus('rolled_back', reason);
  if (swapped && backupLocation && fs.existsSync(backupLocation)) {
    try {
      if (liveLocation && fs.existsSync(liveLocation)) {
        const failedTarget = path.join(workDir, 'failed-install');
        try { fs.renameSync(liveLocation, failedTarget); } catch (_) {}
      }
      fs.renameSync(backupLocation, liveLocation);
      console.log(`Pomyślnie przywrócono poprzednią wersję z: ${backupLocation}`);
      // Próba ponownego uruchomienia starej wersji
      launchApplication(liveLocation);
    } catch (err) {
      console.error(`Błąd podczas rollbacku: ${err.message}`);
    }
  }
  cleanup();
  process.exit(1);
}

function onSignal(signal) {
  console.log(`Odebrano sygnał ${signal}`);
  if (signal === 'SIGTERM' && desktopPid > 0) {
    // Sprawdzamy czy stary proces desktopu właśnie znika (teardown noise)
    try {
      process.kill(desktopPid, 0);
    } catch (_) {
      // Stary proces zniknął - ignorujemy pierwszy SIGTERM wyemitowany podczas zamknięcia
      console.log(`Zignorowano sygnał SIGTERM wywołany zamknięciem procesu nadrzędnego (PID ${desktopPid}).`);
      return;
    }
  }
  if (swapped) {
    rollback('update interrupted; previous version restored');
  } else {
    writeStatus('failed', 'update interrupted');
    cleanup();
    process.exit(130);
  }
}

process.on('SIGINT', () => onSignal('SIGINT'));
process.on('SIGTERM', () => onSignal('SIGTERM'));
process.on('SIGHUP', () => onSignal('SIGHUP'));

// Oczekiwanie na pełne wygaszenie poprzedniego procesu aplikacji (wzorzec Hermes Agent wait-out)
async function waitOutDesktopProcess(pid) {
  if (!pid || pid <= 0) return true;
  for (let i = 0; i < 100; i++) {
    try {
      process.kill(pid, 0);
      await new Promise((r) => setTimeout(r, 300));
    } catch (_) {
      // Proces zakończył działanie
      return true;
    }
  }
  return false;
}

// 1. Sprawdzenie i zajęcie blokady (Lock)
try {
  fs.mkdirSync(updatesDir, { recursive: true });
  fs.mkdirSync(lockDir);
} catch (err) {
  console.error('Inna operacja aktualizacji jest już w toku.');
  process.exit(1);
}

// 2. Weryfikacja minimalnej wersji macOS (jeśli dotyczy)
if (platform === 'darwin' && minimumMacOS) {
  let currentMacOs = '';
  try {
    const swVersBin = process.env.SW_VERS_BIN || '/usr/bin/sw_vers';
    currentMacOs = execFileSync(swVersBin, ['-productVersion'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (_) {}

  if (currentMacOs) {
    const currParts = currentMacOs.split('.').map((n) => parseInt(n, 10) || 0);
    const minParts = minimumMacOS.split('.').map((n) => parseInt(n, 10) || 0);
    let meets = true;
    for (let i = 0; i < 3; i++) {
      const c = currParts[i] || 0;
      const m = minParts[i] || 0;
      if (c > m) { meets = true; break; }
      if (c < m) { meets = false; break; }
    }
    if (!meets) {
      writeStatus('failed', 'minimum macOS version not met');
      cleanup();
      process.exit(1);
    }
  }
}

// 3. Sprawdzenie miejsca na dysku (lub wymuszony błąd w teście)
if (process.env.MOCK_DISK_FULL === '1' || args['mock-disk-full'] === 'true') {
  writeStatus('failed', 'insufficient disk space');
  cleanup();
  process.exit(1);
}

// 4. Pobieranie archiwum aktualizacji
fs.mkdirSync(workDir, { recursive: true });
const archivePath = path.join(workDir, 'update.zip');

writeStatus('downloading', 'downloading update');

async function downloadArchive() {
  if (process.env.DOWNLOAD_FAIL === '1' || process.env.MOCK_DOWNLOAD_FAIL === '1' || args['mock-download-fail'] === 'true') {
    throw new Error('download failed');
  }

  // Wsparcia dla lokalnego pliku testowego
  const testArchive = process.env.TEST_ARCHIVE || args['test-archive'];
  if (testArchive && fs.existsSync(testArchive)) {
    fs.copyFileSync(testArchive, archivePath);
    return;
  }

  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const tempPartPath = `${archivePath}.part`;
    try {
      if (fs.existsSync(tempPartPath)) {
        try { fs.unlinkSync(tempPartPath); } catch (_) {}
      }

      console.log(`Pobieranie paczki aktualizacji (próba ${attempt}/${maxAttempts})...`);
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) {
        throw new Error(`download failed with status ${res.status}`);
      }
      if (!res.body) {
        throw new Error('download failed: empty response body');
      }

      const fileStream = fs.createWriteStream(tempPartPath);
      await pipeline(Readable.fromWeb(res.body), fileStream);

      // Atomowe przeniesienie gotowej pobranej paczki
      fs.renameSync(tempPartPath, archivePath);
      return;
    } catch (err) {
      lastError = err;
      console.warn(`Niepowodzenie pobierania w próbie ${attempt}/${maxAttempts}: ${err.message}`);
      if (fs.existsSync(tempPartPath)) {
        try { fs.unlinkSync(tempPartPath); } catch (_) {}
      }
      if (attempt < maxAttempts) {
        // Krótkie opóźnienie przed ponowieniem
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw lastError || new Error('download failed');
}

async function verifyArchiveChecksum(filePath) {
  const hash = crypto.createHash('sha256');
  const readStream = fs.createReadStream(filePath);
  await pipeline(readStream, hash);
  return hash.digest('hex').toLowerCase();
}

async function run() {
  try {
    await downloadArchive();
  } catch (err) {
    writeStatus('failed', 'download failed');
    cleanup();
    process.exit(1);
  }

  // Weryfikacja rozmiaru
  const stats = fs.statSync(archivePath);
  if (expectedSize > 0 && stats.size !== expectedSize) {
    writeStatus('failed', 'package size mismatch');
    cleanup();
    process.exit(1);
  }

  // Weryfikacja sumy SHA-256 strumieniowo (bezpieczna dla dużych archiwów)
  const actualHash = await verifyArchiveChecksum(archivePath);
  if (actualHash !== expectedSha256) {
    writeStatus('failed', 'checksum mismatch');
    cleanup();
    process.exit(1);
  }

  // 5. Wypakowanie archiwum i weryfikacja zawartości (Stage)
  writeStatus('verifying', 'verifying package');
  const unpackedDir = path.join(workDir, 'unpacked');
  fs.mkdirSync(unpackedDir, { recursive: true });

  try {
    if (process.platform === 'darwin') {
      execFileSync('ditto', ['-x', '-k', archivePath, unpackedDir]);
    } else {
      // Windows / Linux
      try {
        execFileSync('tar', ['-xf', archivePath, '-C', unpackedDir]);
      } catch (_) {
        execFileSync('powershell', ['-NoProfile', '-Command', 'Expand-Archive', '-LiteralPath', archivePath, '-DestinationPath', unpackedDir, '-Force']);
      }
    }
  } catch (err) {
    writeStatus('failed', 'archive extraction failed');
    cleanup();
    process.exit(1);
  }

  let stagedNewApp = null;
  let stagedNewRuntime = null;

  if (platform === 'darwin') {
    // Szukamy bundle'a .app
    function findApp(dir) {
      const entries = fs.readdirSync(dir);
      for (const e of entries) {
        if (e.endsWith('.app')) return path.join(dir, e);
      }
      return null;
    }
    stagedNewApp = findApp(unpackedDir);
    if (!stagedNewApp) {
      writeStatus('failed', 'application bundle missing');
      cleanup();
      process.exit(1);
    }

    // Weryfikacja Info.plist
    const plist = path.join(stagedNewApp, 'Contents', 'Info.plist');
    if (!fs.existsSync(plist)) {
      writeStatus('failed', 'bundle metadata missing');
      cleanup();
      process.exit(1);
    }

    let plistContent = '';
    try {
      plistContent = fs.readFileSync(plist, 'utf8');
    } catch (_) {}

    // Odczyt właściwości plist
    let actualId = '';
    let actualVersion = '';
    let actualExecutable = '';
    try {
      actualId = execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleIdentifier', plist], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      actualVersion = execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleShortVersionString', plist], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      actualExecutable = execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleExecutable', plist], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (_) {
      // Fallback prosty parser XML
      const idMatch = plistContent.match(/<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/);
      const verMatch = plistContent.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/);
      const exeMatch = plistContent.match(/<key>CFBundleExecutable<\/key>\s*<string>([^<]+)<\/string>/);
      if (idMatch) actualId = idMatch[1];
      if (verMatch) actualVersion = verMatch[1];
      if (exeMatch) actualExecutable = exeMatch[1];
    }

    if (bundleId && actualId && actualId !== bundleId) {
      writeStatus('failed', 'bundle id mismatch');
      cleanup();
      process.exit(1);
    }

    if (version && actualVersion && actualVersion !== version) {
      writeStatus('failed', 'version mismatch');
      cleanup();
      process.exit(1);
    }

    const exePath = path.join(stagedNewApp, 'Contents', 'MacOS', actualExecutable || 'launcher');
    if (!fs.existsSync(exePath)) {
      writeStatus('failed', 'executable missing');
      cleanup();
      process.exit(1);
    }

    const macRuntimeDir = path.join(stagedNewApp, 'Contents', 'Resources', 'runtime');
    if (!verifyOrWriteBuildInfo(fs.existsSync(macRuntimeDir) ? macRuntimeDir : stagedNewApp)) {
      writeStatus('failed', 'commit mismatch');
      cleanup();
      process.exit(1);
    }
  } else {
    // Windows: Szukamy struktury runtime / package.json
    function findWindowsRuntime(dir) {
      const candidates = [
        path.join(dir, 'runtime'),
        path.join(dir, 'straznik-tajemnic-windows', 'runtime'),
        dir,
      ];
      for (const c of candidates) {
        if (fs.existsSync(path.join(c, 'package.json'))) return c;
      }
      return null;
    }

    stagedNewRuntime = findWindowsRuntime(unpackedDir);
    if (!stagedNewRuntime) {
      writeStatus('failed', 'runtime directory missing');
      cleanup();
      process.exit(1);
    }

    const pkgPath = path.join(stagedNewRuntime, 'package.json');
    let pkgVersion = '';
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkgVersion = pkg.version;
    } catch (_) {}

    if (version && pkgVersion && pkgVersion !== version) {
      writeStatus('failed', 'version mismatch');
      cleanup();
      process.exit(1);
    }

    if (!verifyOrWriteBuildInfo(stagedNewRuntime)) {
      writeStatus('failed', 'commit mismatch');
      cleanup();
      process.exit(1);
    }
  }

  // 6. Zatrzymanie działających procesów serwera i zwalnianie blokad plików
  writeStatus('installing', 'installing update');
  showUpdateSplash('Przebudowa mechanizmów Strażnika Tajemnic i podmiana plików…');
  stopRunningServer();

  // Oczekiwanie na pełne wygaśnięcie procesu desktopu (wzorzec Hermes wait-out loop)
  if (desktopPid > 0) {
    console.log(`Oczekiwanie na wygaszenie procesu nadrzędnego PID: ${desktopPid}...`);
    const exited = await waitOutDesktopProcess(desktopPid);
    if (!exited) {
      writeStatus('failed', 'desktop process did not exit in time');
      cleanup();
      process.exit(1);
    }
  }

  // 7. Dwufazowa atomowa podmiana (Swap)
  if (platform === 'darwin') {
    liveLocation = target;
    backupLocation = `${target}.rollback`;

    try {
      if (fs.existsSync(backupLocation)) {
        fs.rmSync(backupLocation, { recursive: true, force: true });
      }
      fs.renameSync(liveLocation, backupLocation);
    } catch (err) {
      writeStatus('failed', 'cannot preserve previous bundle');
      cleanup();
      process.exit(1);
    }

    swapped = true;

    try {
      fs.renameSync(stagedNewApp, liveLocation);
    } catch (err) {
      rollback('cannot install new bundle');
    }

    // Synchronizacja lustrzana (Desktop <-> Applications) jeśli istnieją obie kopie
    try {
      const desktopApp = path.join(process.env.HOME || '', 'Desktop', 'Straznik Tajemnic AI.app');
      const appsApp = path.join(process.env.HOME || '', 'Applications', 'Straznik Tajemnic AI.app');
      if (target === desktopApp && fs.existsSync(appsApp)) {
        console.log('Synchronizowanie zaktualizowanego pakietu do ~/Applications...');
        execFileSync('ditto', [liveLocation, appsApp]);
      } else if (target === appsApp && fs.existsSync(desktopApp)) {
        console.log('Synchronizowanie zaktualizowanego pakietu na Biurko...');
        execFileSync('ditto', [liveLocation, desktopApp]);
      }
    } catch (syncErr) {
      console.warn(`Ostrzeżenie przy synchronizacji kopii aplikacji: ${syncErr.message}`);
    }
  } else {
    // Windows: podmiana katalogu runtime
    const targetHasRuntime = fs.existsSync(path.join(target, 'runtime'));
    liveLocation = targetHasRuntime ? path.join(target, 'runtime') : target;
    backupLocation = `${liveLocation}.rollback`;

    try {
      if (fs.existsSync(backupLocation)) {
        fs.rmSync(backupLocation, { recursive: true, force: true });
      }
      fs.renameSync(liveLocation, backupLocation);
    } catch (err) {
      writeStatus('failed', 'cannot preserve previous runtime');
      cleanup();
      process.exit(1);
    }

    swapped = true;

    try {
      fs.renameSync(stagedNewRuntime, liveLocation);
    } catch (err) {
      rollback('cannot install new runtime');
    }

    // Aktualizacja Graj - Strażnik Tajemnic.cmd jeśli występuje
    const stagedLauncher = path.join(unpackedDir, 'straznik-tajemnic-windows', 'Graj - Strażnik Tajemnic.cmd');
    const liveLauncher = path.join(target, 'Graj - Strażnik Tajemnic.cmd');
    if (fs.existsSync(stagedLauncher) && fs.existsSync(liveLauncher)) {
      try {
        fs.copyFileSync(stagedLauncher, liveLauncher);
      } catch (_) {}
    }
  }

  // 8. Uruchomienie nowej wersji i weryfikacja zdrowia (Health Check)
  writeStatus('restarting', 'restarting application');
  launchApplication(liveLocation);

  const healthy = await pollHealthCheck();
  if (healthy) {
    swapped = false;
    writeStatus('succeeded', 'update installed');
    closeUpdateSplash();
    cleanup();
    process.exit(0);
  } else {
    closeUpdateSplash();
    rollback('health check failed');
  }
}

function stopRunningServer() {
  const profile = path.join(dataDir, 'desktop', 'chrome-profile');
  const pidFile = path.join(dataDir, 'desktop', 'server.pid');

  if (process.platform === 'win32') {
    if (fs.existsSync(pidFile)) {
      try {
        const pid = fs.readFileSync(pidFile, 'utf8').trim();
        if (/^\d+$/.test(pid)) {
          spawnSync('taskkill', ['/F', '/T', '/PID', pid], { stdio: 'ignore' });
        }
      } catch (_) {}
    }
    // Zwolnienie portu
    try {
      const output = execFileSync('netstat', ['-ano'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const lines = output.trim().split('\n');
      for (const line of lines) {
        if (line.includes(`:${port}`)) {
          const match = line.trim().match(/\s+(\d+)$/);
          if (match && match[1] && match[1] !== '0') {
            spawnSync('taskkill', ['/F', '/PID', match[1]], { stdio: 'ignore' });
          }
        }
      }
    } catch (_) {}
  } else {
    // macOS / Linux
    try {
      spawnSync('pkill', ['-f', `user-data-dir=${profile}`], { stdio: 'ignore' });
    } catch (_) {}
    if (fs.existsSync(pidFile)) {
      try {
        const serverPid = fs.readFileSync(pidFile, 'utf8').trim();
        if (/^\d+$/.test(serverPid)) {
          spawnSync('pkill', ['-P', serverPid], { stdio: 'ignore' });
          spawnSync('kill', [serverPid], { stdio: 'ignore' });
        }
      } catch (_) {}
    }
    try {
      if (Number.isInteger(port) && port > 0) {
        const lsofOut = execFileSync('lsof', ['-ti', `:${port}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (lsofOut) {
          const pids = lsofOut.split(/\s+/).filter((p) => /^\d+$/.test(p));
          for (const p of pids) {
            spawnSync('kill', [p], { stdio: 'ignore' });
          }
        }
      }
    } catch (_) {}
  }
}

function launchApplication(appPath) {
  if (testMode || process.env.TEST_MODE === '1') {
    return;
  }
  try {
    if (platform === 'darwin') {
      // Usunięcie kwarantanny macOS przed startem aplikacji pobranej z sieci
      try {
        execFileSync('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', appPath], { stdio: 'ignore' });
      } catch (_) {}
      spawn('open', [appPath], { detached: true, stdio: 'ignore' }).unref();
    } else {
      const targetNode = path.join(appPath, 'bin', 'node.exe');
      const supervisorPath = path.join(appPath, 'desktop', 'supervisor.mjs');
      if (fs.existsSync(targetNode) && fs.existsSync(supervisorPath)) {
        spawn(targetNode, [supervisorPath], { detached: true, stdio: 'ignore', cwd: appPath }).unref();
      } else if (fs.existsSync(supervisorPath)) {
        spawn(process.execPath, [supervisorPath], { detached: true, stdio: 'ignore', cwd: appPath }).unref();
      }
    }
  } catch (_) {}
}

async function pollHealthCheck() {
  if (process.env.HEALTH_FAIL === '1' || process.env.MOCK_HEALTH_FAIL === '1' || args['mock-health-fail'] === 'true') {
    return false;
  }
  if (testMode || process.env.TEST_MODE === '1') {
    return true;
  }

  const endpoint = `http://127.0.0.1:${port}/api/desktop/cold-start`;
  // Sprawdzamy do 150 prób (150 * 300ms = 45s) na uruchomienie i pełną gotowość serwera
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.available === true) {
          return true;
        }
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

run();
