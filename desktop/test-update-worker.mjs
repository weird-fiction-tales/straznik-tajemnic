#!/usr/bin/env node

import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKER_SCRIPT = path.join(__dirname, 'update-worker.mjs');
const TEST_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'zew-update-test-'));

console.log('=== Testy jednostkowe i regresyjne update-worker (Two-Phase Stage & Swap) ===\n');

function cleanupRoot() {
  try {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  } catch (_) {}
}
process.on('exit', cleanupRoot);

function createZip(sourceDir, zipPath) {
  try {
    execSync(`zip -r -q "${zipPath}" .`, { cwd: sourceDir });
  } catch (_) {
    execSync(`tar -a -c -f "${zipPath}" -C "${sourceDir}" .`);
  }
}

function prepareWindowsCase(caseName, { version = '0.9.4', archiveVersion = '0.9.4' } = {}) {
  const caseDir = path.join(TEST_ROOT, caseName);
  const dataDir = path.join(caseDir, 'data');
  const appDir = path.join(caseDir, 'straznik-tajemnic-windows');
  const liveRuntime = path.join(appDir, 'runtime');
  const pkgStaging = path.join(caseDir, 'pkg-staging', 'straznik-tajemnic-windows', 'runtime');
  const zipPath = path.join(caseDir, 'update.zip');

  fs.mkdirSync(liveRuntime, { recursive: true });
  fs.mkdirSync(pkgStaging, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  // Live old app
  fs.writeFileSync(path.join(appDir, 'Graj - Strażnik Tajemnic.cmd'), '@echo off\nREM old launcher\n');
  fs.writeFileSync(path.join(liveRuntime, 'marker.txt'), 'old');
  fs.writeFileSync(path.join(liveRuntime, 'package.json'), JSON.stringify({ name: 'straznik-tajemnic', version: '0.9.3' }));

  // New archive payload
  fs.writeFileSync(path.join(path.dirname(pkgStaging), 'Graj - Strażnik Tajemnic.cmd'), '@echo off\nREM new launcher\n');
  fs.writeFileSync(path.join(pkgStaging, 'marker.txt'), 'new');
  fs.writeFileSync(path.join(pkgStaging, 'package.json'), JSON.stringify({ name: 'straznik-tajemnic', version: archiveVersion }));

  createZip(path.join(caseDir, 'pkg-staging'), zipPath);

  const bytes = fs.readFileSync(zipPath);
  const size = bytes.length;
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');

  return { caseDir, dataDir, appDir, liveRuntime, zipPath, size, sha256, version };
}

function prepareMacCase(caseName, { version = '0.9.4', archiveVersion = '0.9.4' } = {}) {
  const caseDir = path.join(TEST_ROOT, caseName);
  const dataDir = path.join(caseDir, 'data');
  const currentApp = path.join(caseDir, 'Straznik Tajemnic AI.app');
  const pkgStaging = path.join(caseDir, 'pkg-mac', 'Straznik Tajemnic AI.app');
  const zipPath = path.join(caseDir, 'update-mac.zip');

  fs.mkdirSync(path.join(currentApp, 'Contents', 'MacOS'), { recursive: true });
  fs.mkdirSync(path.join(pkgStaging, 'Contents', 'MacOS'), { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  // Plist helper
  function writePlist(appPath, ver) {
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.aios.straznik-tajemnic-ai</string>
  <key>CFBundleShortVersionString</key>
  <string>${ver}</string>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
</dict>
</plist>`;
    fs.writeFileSync(path.join(appPath, 'Contents', 'Info.plist'), content);
    fs.writeFileSync(path.join(appPath, 'Contents', 'MacOS', 'launcher'), '#!/bin/sh\nexit 0\n');
    fs.chmodSync(path.join(appPath, 'Contents', 'MacOS', 'launcher'), 0o755);
  }

  writePlist(currentApp, '0.9.3');
  fs.writeFileSync(path.join(currentApp, 'marker.txt'), 'old');

  writePlist(pkgStaging, archiveVersion);
  fs.writeFileSync(path.join(pkgStaging, 'marker.txt'), 'new');

  createZip(path.join(caseDir, 'pkg-mac'), zipPath);

  const bytes = fs.readFileSync(zipPath);
  const size = bytes.length;
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');

  return { caseDir, dataDir, appDir: currentApp, zipPath, size, sha256, version };
}

function runWorker(env, argsList) {
  return spawnSync(process.execPath, [WORKER_SCRIPT, ...argsList], {
    env: { ...process.env, TEST_MODE: '1', ...env },
    encoding: 'utf8',
  });
}

// -------------------------------------------------------------
// Test 1: Sukces podmiany runtime Windows
// -------------------------------------------------------------
{
  const c = prepareWindowsCase('win-success');
  const res = runWorker({}, [
    '--target', c.appDir,
    '--url', 'https://example.com/update.zip',
    '--sha256', c.sha256,
    '--version', c.version,
    '--size', String(c.size),
    '--data-dir', c.dataDir,
    '--platform', 'win32',
    '--test-archive', c.zipPath,
  ]);

  assert.strictEqual(res.status, 0, `Worker powinien zakończyć z kodem 0. stderr: ${res.stderr}`);
  const status = JSON.parse(fs.readFileSync(path.join(c.dataDir, 'updates', 'status.json'), 'utf8'));
  assert.strictEqual(status.state, 'succeeded');
  assert.strictEqual(fs.readFileSync(path.join(c.liveRuntime, 'marker.txt'), 'utf8').trim(), 'new');
  assert.strictEqual(fs.readFileSync(path.join(`${c.liveRuntime}.rollback`, 'marker.txt'), 'utf8').trim(), 'old');
  console.log('✓ PASS: Sukces dwufazowej podmiany runtime Windows (Stage & Swap)');
}

// -------------------------------------------------------------
// Test 2: Sukces podmiany pakietu macOS (.app bundle)
// -------------------------------------------------------------
{
  const c = prepareMacCase('mac-success');
  const res = runWorker({}, [
    '--target', c.appDir,
    '--url', 'https://example.com/update.zip',
    '--sha256', c.sha256,
    '--version', c.version,
    '--size', String(c.size),
    '--data-dir', c.dataDir,
    '--platform', 'darwin',
    '--test-archive', c.zipPath,
  ]);

  assert.strictEqual(res.status, 0, `Worker powinien zakończyć z kodem 0. stderr: ${res.stderr}`);
  const status = JSON.parse(fs.readFileSync(path.join(c.dataDir, 'updates', 'status.json'), 'utf8'));
  assert.strictEqual(status.state, 'succeeded');
  assert.strictEqual(fs.readFileSync(path.join(c.appDir, 'marker.txt'), 'utf8').trim(), 'new');
  assert.strictEqual(fs.readFileSync(path.join(`${c.appDir}.rollback`, 'marker.txt'), 'utf8').trim(), 'old');
  console.log('✓ PASS: Sukces dwufazowej podmiany pakietu macOS (.app bundle)');
}

// -------------------------------------------------------------
// Test 3: Niezgodność sumy kontrolnej SHA-256 (odmowa podmiany)
// -------------------------------------------------------------
{
  const c = prepareWindowsCase('checksum-mismatch');
  const fakeSha = '0'.repeat(64);
  const res = runWorker({}, [
    '--target', c.appDir,
    '--url', 'https://example.com/update.zip',
    '--sha256', fakeSha,
    '--version', c.version,
    '--size', String(c.size),
    '--data-dir', c.dataDir,
    '--platform', 'win32',
    '--test-archive', c.zipPath,
  ]);

  assert.strictEqual(res.status, 1, 'Worker powinien zakończyć błędem (kod 1)');
  const status = JSON.parse(fs.readFileSync(path.join(c.dataDir, 'updates', 'status.json'), 'utf8'));
  assert.strictEqual(status.state, 'failed');
  assert(status.message.includes('checksum mismatch'), 'Status powinien wskazywać checksum mismatch');
  assert.strictEqual(fs.readFileSync(path.join(c.liveRuntime, 'marker.txt'), 'utf8').trim(), 'old');
  console.log('✓ PASS: Blokada przy niezgodności sumy SHA-256 (oryginał nienaruszony)');
}

// -------------------------------------------------------------
// Test 4: Niezgodność deklarowanego rozmiaru archiwum
// -------------------------------------------------------------
{
  const c = prepareWindowsCase('size-mismatch');
  const res = runWorker({}, [
    '--target', c.appDir,
    '--url', 'https://example.com/update.zip',
    '--sha256', c.sha256,
    '--version', c.version,
    '--size', '99999999',
    '--data-dir', c.dataDir,
    '--platform', 'win32',
    '--test-archive', c.zipPath,
  ]);

  assert.strictEqual(res.status, 1);
  const status = JSON.parse(fs.readFileSync(path.join(c.dataDir, 'updates', 'status.json'), 'utf8'));
  assert.strictEqual(status.state, 'failed');
  assert(status.message.includes('size mismatch'));
  assert.strictEqual(fs.readFileSync(path.join(c.liveRuntime, 'marker.txt'), 'utf8').trim(), 'old');
  console.log('✓ PASS: Blokada przy niezgodności rozmiaru paczki');
}

// -------------------------------------------------------------
// Test 5: Błąd pobierania archiwum
// -------------------------------------------------------------
{
  const c = prepareWindowsCase('download-failed');
  const res = runWorker({ DOWNLOAD_FAIL: '1' }, [
    '--target', c.appDir,
    '--url', 'https://example.com/update.zip',
    '--sha256', c.sha256,
    '--version', c.version,
    '--size', String(c.size),
    '--data-dir', c.dataDir,
    '--platform', 'win32',
    '--test-archive', c.zipPath,
  ]);

  assert.strictEqual(res.status, 1);
  const status = JSON.parse(fs.readFileSync(path.join(c.dataDir, 'updates', 'status.json'), 'utf8'));
  assert.strictEqual(status.state, 'failed');
  assert(status.message.includes('download failed'));
  assert.strictEqual(fs.readFileSync(path.join(c.liveRuntime, 'marker.txt'), 'utf8').trim(), 'old');
  console.log('✓ PASS: Bezpieczna obsługa błędu pobierania (brak ingerencji w aplikację)');
}

// -------------------------------------------------------------
// Test 6: Niezgodność wersji wewnątrz rozpakowanego pakietu
// -------------------------------------------------------------
{
  const c = prepareWindowsCase('version-mismatch', { version: '0.9.4', archiveVersion: '0.9.5' });
  const res = runWorker({}, [
    '--target', c.appDir,
    '--url', 'https://example.com/update.zip',
    '--sha256', c.sha256,
    '--version', '0.9.4',
    '--size', String(c.size),
    '--data-dir', c.dataDir,
    '--platform', 'win32',
    '--test-archive', c.zipPath,
  ]);

  assert.strictEqual(res.status, 1);
  const status = JSON.parse(fs.readFileSync(path.join(c.dataDir, 'updates', 'status.json'), 'utf8'));
  assert.strictEqual(status.state, 'failed');
  assert(status.message.includes('version mismatch'));
  assert.strictEqual(fs.readFileSync(path.join(c.liveRuntime, 'marker.txt'), 'utf8').trim(), 'old');
  console.log('✓ PASS: Blokada przy niezgodności wersji wewnątrz paczki');
}

// -------------------------------------------------------------
// Test 7: Ochrona przed współbieżnymi procesami (Lock Contention)
// -------------------------------------------------------------
{
  const c = prepareWindowsCase('lock-contention');
  const lockDir = path.join(c.dataDir, 'updates', 'update.lock');
  fs.mkdirSync(lockDir, { recursive: true });
  fs.writeFileSync(path.join(c.dataDir, 'updates', 'status.json'), JSON.stringify({ id: 'active', state: 'downloading' }));

  const res = runWorker({}, [
    '--target', c.appDir,
    '--url', 'https://example.com/update.zip',
    '--sha256', c.sha256,
    '--version', c.version,
    '--size', String(c.size),
    '--data-dir', c.dataDir,
    '--platform', 'win32',
    '--test-archive', c.zipPath,
  ]);

  assert.strictEqual(res.status, 1);
  const status = JSON.parse(fs.readFileSync(path.join(c.dataDir, 'updates', 'status.json'), 'utf8'));
  assert.strictEqual(status.id, 'active');
  assert.strictEqual(fs.readFileSync(path.join(c.liveRuntime, 'marker.txt'), 'utf8').trim(), 'old');
  console.log('✓ PASS: Blokada współbieżnej aktualizacji (aktywny lock)');
}

// -------------------------------------------------------------
// Test 8: Odmowa przy braku miejsca na dysku (Mock Disk Full)
// -------------------------------------------------------------
{
  const c = prepareWindowsCase('disk-full');
  const res = runWorker({ MOCK_DISK_FULL: '1' }, [
    '--target', c.appDir,
    '--url', 'https://example.com/update.zip',
    '--sha256', c.sha256,
    '--version', c.version,
    '--size', String(c.size),
    '--data-dir', c.dataDir,
    '--platform', 'win32',
    '--test-archive', c.zipPath,
  ]);

  assert.strictEqual(res.status, 1);
  const status = JSON.parse(fs.readFileSync(path.join(c.dataDir, 'updates', 'status.json'), 'utf8'));
  assert.strictEqual(status.state, 'failed');
  assert(status.message.includes('insufficient disk space'));
  assert.strictEqual(fs.readFileSync(path.join(c.liveRuntime, 'marker.txt'), 'utf8').trim(), 'old');
  console.log('✓ PASS: Odmowa i czyste przerwanie przy braku miejsca na dysku');
}

// -------------------------------------------------------------
// Test 9: Atomowy Rollback przy awarii Health Checka (Windows)
// -------------------------------------------------------------
{
  const c = prepareWindowsCase('win-rollback');
  const res = runWorker({ MOCK_HEALTH_FAIL: '1' }, [
    '--target', c.appDir,
    '--url', 'https://example.com/update.zip',
    '--sha256', c.sha256,
    '--version', c.version,
    '--size', String(c.size),
    '--data-dir', c.dataDir,
    '--platform', 'win32',
    '--test-archive', c.zipPath,
  ]);

  assert.strictEqual(res.status, 1);
  const status = JSON.parse(fs.readFileSync(path.join(c.dataDir, 'updates', 'status.json'), 'utf8'));
  assert.strictEqual(status.state, 'rolled_back');
  assert(status.message.includes('health check failed'));
  // Kluczowa weryfikacja: wersja 'old' musi być nienaruszona i przywrócona na swoje pierwotne miejsce!
  assert.strictEqual(fs.readFileSync(path.join(c.liveRuntime, 'marker.txt'), 'utf8').trim(), 'old');
  console.log('✓ PASS: Atomowy Rollback przy awarii health checka na Windows (przywrócenie stanu pierwotnego)');
}

// -------------------------------------------------------------
// Test 10: Atomowy Rollback przy awarii Health Checka (macOS)
// -------------------------------------------------------------
{
  const c = prepareMacCase('mac-rollback');
  const res = runWorker({ MOCK_HEALTH_FAIL: '1' }, [
    '--target', c.appDir,
    '--url', 'https://example.com/update.zip',
    '--sha256', c.sha256,
    '--version', c.version,
    '--size', String(c.size),
    '--data-dir', c.dataDir,
    '--platform', 'darwin',
    '--test-archive', c.zipPath,
  ]);

  assert.strictEqual(res.status, 1);
  const status = JSON.parse(fs.readFileSync(path.join(c.dataDir, 'updates', 'status.json'), 'utf8'));
  assert.strictEqual(status.state, 'rolled_back');
  assert(status.message.includes('health check failed'));
  assert.strictEqual(fs.readFileSync(path.join(c.appDir, 'marker.txt'), 'utf8').trim(), 'old');
  console.log('✓ PASS: Atomowy Rollback przy awarii health checka na macOS (przywrócenie stanu pierwotnego)');
}

// -------------------------------------------------------------
// Test 11: Bezpieczne zatrzymywanie serwera (PID) i start z zewnętrznej binarki
// -------------------------------------------------------------
{
  const c = prepareWindowsCase('win-detached-node');
  // Symulacja pliku server.pid i profilu w dataDir
  const desktopDataDir = path.join(c.dataDir, 'desktop');
  fs.mkdirSync(desktopDataDir, { recursive: true });
  fs.writeFileSync(path.join(desktopDataDir, 'server.pid'), '999999');

  // Symulacja uruchomienia workera z kopii Node poza runtime (np. %APPDATA%/updates/updater-node)
  const updatesDir = path.join(c.dataDir, 'updates');
  fs.mkdirSync(updatesDir, { recursive: true });
  const detachedNode = path.join(updatesDir, 'updater-node-test');
  fs.copyFileSync(process.execPath, detachedNode);
  fs.chmodSync(detachedNode, 0o755);

  const res = spawnSync(detachedNode, [WORKER_SCRIPT, ...[
    '--target', c.appDir,
    '--url', 'https://example.com/update.zip',
    '--sha256', c.sha256,
    '--version', c.version,
    '--size', String(c.size),
    '--data-dir', c.dataDir,
    '--platform', 'win32',
    '--test-archive', c.zipPath,
  ]], {
    env: { ...process.env, TEST_MODE: '1' },
    encoding: 'utf8',
  });

  assert.strictEqual(res.status, 0, `Worker z zewnętrznej binarki powinien zakończyć z kodem 0. stderr: ${res.stderr}`);
  const status = JSON.parse(fs.readFileSync(path.join(c.dataDir, 'updates', 'status.json'), 'utf8'));
  assert.strictEqual(status.state, 'succeeded');
  assert.strictEqual(fs.readFileSync(path.join(c.liveRuntime, 'marker.txt'), 'utf8').trim(), 'new');
  console.log('✓ PASS: Sukces aktualizacji przy uruchomieniu workera z zewnętrznej binarki Node poza runtime');
}

// -------------------------------------------------------------
// Test 12: Weryfikacja i zapis build-info.json przy aktualizacji commit-aware
// -------------------------------------------------------------
{
  const c = prepareWindowsCase('win-commit-success', { version: '0.9.5', archiveVersion: '0.9.5' });
  const targetCommit = 'ac826c9d11111111111111111111111111111111';
  const res = runWorker({}, [
    '--target', c.appDir,
    '--url', 'https://example.com/update.zip',
    '--sha256', c.sha256,
    '--version', '0.9.5',
    '--commit', targetCommit,
    '--size', String(c.size),
    '--data-dir', c.dataDir,
    '--platform', 'win32',
    '--test-archive', c.zipPath,
  ]);

  assert.strictEqual(res.status, 0, `Worker powinien zakończyć z kodem 0. stderr: ${res.stderr}`);
  const status = JSON.parse(fs.readFileSync(path.join(c.dataDir, 'updates', 'status.json'), 'utf8'));
  assert.strictEqual(status.state, 'succeeded');
  assert.strictEqual(status.commitSha, targetCommit);
  const buildInfo = JSON.parse(fs.readFileSync(path.join(c.liveRuntime, 'build-info.json'), 'utf8'));
  assert.strictEqual(buildInfo.commitSha, targetCommit);
  assert.strictEqual(buildInfo.shortCommit, 'ac826c9');
  console.log('✓ PASS: Aktualizacja commit-aware zapisuje i weryfikuje build-info.json');
}

// -------------------------------------------------------------
// Test 13: Blokada przy niezgodności commitSha w build-info.json
// -------------------------------------------------------------
{
  const caseDir = path.join(TEST_ROOT, 'commit-mismatch');
  const dataDir = path.join(caseDir, 'data');
  const appDir = path.join(caseDir, 'straznik-tajemnic-windows');
  const liveRuntime = path.join(appDir, 'runtime');
  const pkgStaging = path.join(caseDir, 'pkg-staging', 'straznik-tajemnic-windows', 'runtime');
  const zipPath = path.join(caseDir, 'update.zip');

  fs.mkdirSync(liveRuntime, { recursive: true });
  fs.mkdirSync(pkgStaging, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  fs.writeFileSync(path.join(liveRuntime, 'marker.txt'), 'old');
  fs.writeFileSync(path.join(liveRuntime, 'package.json'), JSON.stringify({ name: 'straznik-tajemnic', version: '0.9.5' }));
  fs.writeFileSync(path.join(pkgStaging, 'marker.txt'), 'new');
  fs.writeFileSync(path.join(pkgStaging, 'package.json'), JSON.stringify({ name: 'straznik-tajemnic', version: '0.9.5' }));
  fs.writeFileSync(path.join(pkgStaging, 'build-info.json'), JSON.stringify({
    version: '0.9.5',
    commitSha: '1111111111111111111111111111111111111111',
    shortCommit: '1111111',
  }));

  createZip(path.join(caseDir, 'pkg-staging'), zipPath);
  const bytes = fs.readFileSync(zipPath);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');

  const res = runWorker({}, [
    '--target', appDir,
    '--url', 'https://example.com/update.zip',
    '--sha256', sha256,
    '--version', '0.9.5',
    '--commit', '2222222222222222222222222222222222222222',
    '--size', String(bytes.length),
    '--data-dir', dataDir,
    '--platform', 'win32',
    '--test-archive', zipPath,
  ]);

  assert.strictEqual(res.status, 1);
  const status = JSON.parse(fs.readFileSync(path.join(dataDir, 'updates', 'status.json'), 'utf8'));
  assert.strictEqual(status.state, 'failed');
  assert(status.message.includes('commit mismatch'));
  assert.strictEqual(fs.readFileSync(path.join(liveRuntime, 'marker.txt'), 'utf8').trim(), 'old');
  console.log('✓ PASS: Blokada przy niezgodności commitSha wewnątrz paczki (commit mismatch)');
}

// -------------------------------------------------------------
// Test 14: Generator manifestu zapisuje commitSha, shortCommit i publishedAt
// -------------------------------------------------------------
{
  const c = prepareWindowsCase('manifest-gen', { version: '0.9.5', archiveVersion: '0.9.5' });
  const assetsDir = path.join(c.caseDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.copyFileSync(c.zipPath, path.join(assetsDir, 'straznik-tajemnic-windows.zip'));
  const manifestOut = path.join(assetsDir, 'update-manifest.json');
  const testCommit = 'ac826c9d99999999999999999999999999999999';

  const manifestScript = path.join(__dirname, 'create-update-manifest.mjs');
  const res = spawnSync(process.execPath, [
    manifestScript,
    '--assets-dir', assetsDir,
    '--output', manifestOut,
    '--tag', 'v0.9.5',
    '--commit', testCommit,
    '--repo', 'InduPhantom-hash/straznik-tajemnic',
  ], { encoding: 'utf8' });

  assert.strictEqual(res.status, 0, `create-update-manifest powinien zakończyć z kodem 0: ${res.stderr}`);
  const generated = JSON.parse(fs.readFileSync(manifestOut, 'utf8'));
  assert.strictEqual(generated.version, '0.9.5');
  assert.strictEqual(generated.commitSha, testCommit);
  assert.strictEqual(generated.shortCommit, 'ac826c9');
  assert.ok(generated.publishedAt && !Number.isNaN(Date.parse(generated.publishedAt)));
  assert.ok(generated.packages.win32);
  console.log('✓ PASS: Generator manifestu (create-update-manifest.mjs) zapisuje commitSha, shortCommit i publishedAt');
}

// -------------------------------------------------------------
// Test 15: Oczekiwanie wait-out na zniknięcie procesu desktop-pid
// -------------------------------------------------------------
{
  const c = prepareMacCase('wait-out-pid');
  const res = runWorker({}, [
    '--target', c.appDir,
    '--url', 'https://example.com/update.zip',
    '--sha256', c.sha256,
    '--version', c.version,
    '--size', String(c.size),
    '--data-dir', c.dataDir,
    '--platform', 'darwin',
    '--test-archive', c.zipPath,
    '--desktop-pid', String(process.pid + 999999), // nieistniejący PID -> waitOutDesktopProcess natychmiast zwraca true
  ]);

  assert.strictEqual(res.status, 0, `update-worker powinien zakończyć z kodem 0: ${res.stderr}`);
  const status = JSON.parse(fs.readFileSync(path.join(c.dataDir, 'updates', 'status.json'), 'utf8'));
  assert.strictEqual(status.state, 'succeeded');
  assert.strictEqual(fs.readFileSync(path.join(c.appDir, 'marker.txt'), 'utf8').trim(), 'new');
  console.log('✓ PASS: Oczekiwanie wait-out i bezpieczny start z parametrem desktop-pid');
}

// -------------------------------------------------------------
// Test 16: Odporne pobieranie strumieniowe z ponowieniem (retry) przez serwer HTTP
// -------------------------------------------------------------
{
  const c = prepareWindowsCase('stream-retry-download');
  const http = await import('node:http');

  let requestsCount = 0;
  const mockServer = http.createServer((req, res) => {
    requestsCount++;
    if (requestsCount === 1) {
      // Pierwsza próba: symulacja błędu 500
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Temporary server error');
    } else {
      // Druga próba: sukces strumieniowania
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Length': c.size,
      });
      fs.createReadStream(c.zipPath).pipe(res);
    }
  });

  await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
  const serverPort = mockServer.address().port;
  const downloadUrl = `http://127.0.0.1:${serverPort}/update.zip`;

  try {
    const { spawn } = await import('node:child_process');
    const child = spawn(process.execPath, [WORKER_SCRIPT, ...[
      '--target', c.appDir,
      '--url', downloadUrl,
      '--sha256', c.sha256,
      '--version', c.version,
      '--size', String(c.size),
      '--data-dir', c.dataDir,
      '--platform', 'win32',
    ]], {
      env: { ...process.env, TEST_MODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });

    const exitCode = await new Promise((resolve) => {
      child.on('close', resolve);
    });

    assert.strictEqual(exitCode, 0, `Worker powinien zakończyć z kodem 0 po retry. stderr: ${stderr}`);
    assert.strictEqual(requestsCount, 2, 'Pobieranie powinno wykonać dokładnie 2 próby');
    const status = JSON.parse(fs.readFileSync(path.join(c.dataDir, 'updates', 'status.json'), 'utf8'));
    assert.strictEqual(status.state, 'succeeded');
    assert.strictEqual(fs.readFileSync(path.join(c.liveRuntime, 'marker.txt'), 'utf8').trim(), 'new');
    console.log('✓ PASS: Odporne pobieranie strumieniowe z automatycznym ponowieniem (retry)');
  } finally {
    mockServer.close();
  }
}

console.log('\n============================================================');
console.log(' Wszystkie testy update-worker zakończone sukcesem (16/16)!');
console.log('============================================================\n');


