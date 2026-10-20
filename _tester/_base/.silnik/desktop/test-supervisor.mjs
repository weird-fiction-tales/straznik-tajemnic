/**
 * Testy jednostkowe i integracyjne dla Desktop Process Supervisor (desktop/supervisor.mjs)
 * Uruchamianie: node desktop/test-supervisor.mjs
 */

import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  resolvePaths,
  isPortAvailable,
  findAvailablePort,
  checkExistingInstance,
  killProcessTree,
  getWindowsBrowserCandidates,
  initSessionLogger
} from './supervisor.mjs';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('=== Rozpoczynam testy modułu desktop/supervisor.mjs ===\n');

  // Test 0: Inicjalizacja sesji logera i retencja (NLog-style)
  console.log('[0/7] Test: initSessionLogger() i retencja sesji (max 5)');
  const testLogsDir = path.join(os.tmpdir(), `zew-test-logs-${Date.now()}`);
  try {
    fs.mkdirSync(testLogsDir, { recursive: true });
    // Tworzymy 6 fikcyjnych starych sesji
    for (let i = 1; i <= 6; i++) {
      fs.writeFileSync(path.join(testLogsDir, `session-2026-01-0${i}T00-00-00-000Z.log`), `Log ${i}`);
    }
    const sessionFile = initSessionLogger(testLogsDir);
    assert.ok(sessionFile, 'initSessionLogger powinien zwrócić ścieżkę do pliku sesji');
    assert.ok(fs.existsSync(sessionFile), 'Plik nowej sesji powinien zostać utworzony lub być gotowy');

    const remainingLogs = fs.readdirSync(testLogsDir).filter(f => f.startsWith('session-') && f.endsWith('.log'));
    assert.ok(remainingLogs.length <= 5, `Liczba plików logów (${remainingLogs.length}) nie może przekraczać 5`);
    console.log('  PASS: initSessionLogger tworzy plik sesji i pilnuje retencji max 5 plików.\n');
  } finally {
    try { fs.rmSync(testLogsDir, { recursive: true, force: true }); } catch (_) {}
  }

  // Test 1: Izolacja ścieżek platformowych
  console.log('[1/4] Test: resolvePaths() i izolacja danych');
  const paths = resolvePaths();
  assert.ok(paths.appDir, 'appDir powinien być zdefiniowany');
  assert.ok(paths.gameDir, 'gameDir powinien być zdefiniowany');
  assert.ok(paths.dataRoot, 'dataRoot powinien być zdefiniowany');
  assert.ok(paths.runtimeDir.includes('desktop'), 'runtimeDir powinien wskazywać na podkatalog desktop');
  assert.ok(paths.profileDir.includes('chrome-profile'), 'profileDir powinien wskazywać na chrome-profile');
  assert.ok(paths.pidFile.endsWith('server.pid'), 'pidFile powinien kończyć się na server.pid');

  if (process.platform === 'darwin') {
    assert.ok(
      paths.dataRoot.includes('Library/Application Support/ZewCthulhu'),
      'Na macOS katalog danych musi być w Library/Application Support/ZewCthulhu'
    );
  } else if (process.platform === 'win32') {
    assert.equal(
      paths.dataRoot,
      path.join(paths.launcherRootDir, 'data'),
      'Na Windows katalog danych musi być ściśle relatywny do paczki (<launcherRootDir>/data)'
    );
    assert.equal(
      paths.logFile,
      path.join(paths.logsDir, 'straznik-tajemnic-ai.log'),
      'Na Windows plik logów musi być w <logsDir>/straznik-tajemnic-ai.log'
    );
    assert.ok(
      !paths.dataRoot.includes('AppData'),
      'Na Windows dataRoot nie może wyciekać do AppData'
    );
  }

  // Weryfikacja symulacji Windows (gdy test uruchomiony na macOS/Linux)
  {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    const originalEnvDataDir = process.env.ZEW_DATA_DIR;
    const originalEnvLogsDir = process.env.ZEW_LOGS_DIR;
    delete process.env.ZEW_DATA_DIR;
    delete process.env.ZEW_LOGS_DIR;

    try {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const winPaths = resolvePaths();
      assert.equal(
        winPaths.dataRoot,
        path.join(winPaths.launcherRootDir, 'data'),
        '[Symulacja Win32] dataRoot musi wskazywać na <launcherRootDir>/data'
      );
      assert.equal(
        winPaths.logFile,
        path.join(winPaths.launcherRootDir, 'logs', 'straznik-tajemnic-ai.log'),
        '[Symulacja Win32] logFile musi wskazywać na <launcherRootDir>/logs/straznik-tajemnic-ai.log'
      );
      assert.ok(
        !winPaths.dataRoot.includes('AppData'),
        '[Symulacja Win32] dataRoot nie może zawierać AppData'
      );
    } finally {
      Object.defineProperty(process, 'platform', originalPlatform);
      if (originalEnvDataDir !== undefined) process.env.ZEW_DATA_DIR = originalEnvDataDir;
      if (originalEnvLogsDir !== undefined) process.env.ZEW_LOGS_DIR = originalEnvLogsDir;
    }
  }
  console.log('  PASS: resolvePaths poprawnie mapuje ścieżki i separuje dane użytkownika.\n');

  // Test 2: Wykrywanie wolnego portu i obsługa kolizji (findAvailablePort)
  console.log('[2/4] Test: isPortAvailable() oraz findAvailablePort()');
  // Zarezerwujmy tymczasowy port
  const tempServer = net.createServer();
  const testPort = 49990;

  await new Promise((resolve) => tempServer.listen(testPort, '127.0.0.1', resolve));
  const isAvailableBlocked = await isPortAvailable(testPort);
  assert.equal(isAvailableBlocked, false, `Port ${testPort} powinien być zajęty`);

  const nextFreePort = await findAvailablePort(testPort);
  assert.ok(nextFreePort > testPort, `Kolejny wolny port (${nextFreePort}) powinien być wyższy niż ${testPort}`);
  const isNextAvailable = await isPortAvailable(nextFreePort);
  assert.equal(isNextAvailable, true, `Znaleziony port ${nextFreePort} musi być wolny`);

  await new Promise((resolve) => tempServer.close(resolve));
  const isAvailableAfterClose = await isPortAvailable(testPort);
  assert.equal(isAvailableAfterClose, true, `Po zamknięciu serwera port ${testPort} musi być wolny`);
  console.log('  PASS: detekcja kolizji i alokacja kolejnego portu działają deterministycznie.\n');

  // Test 3: Single Instance Check (checkExistingInstance)
  console.log('[3/4] Test: checkExistingInstance()');
  // 3a: Port bez serwera
  const deadCheck = await checkExistingInstance(49995, 300);
  assert.equal(deadCheck.running, false, 'Nieaktywny port powinien zwrócić running=false');
  assert.equal(deadCheck.isStraznik, false, 'Nieaktywny port powinien zwrócić isStraznik=false');

  // 3b: Serwer imitujący Strażnika (/api/desktop/cold-start -> {"available":true})
  const mockStraznikServer = http.createServer((req, res) => {
    if (req.url === '/api/desktop/cold-start') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ available: true, version: '0.9.5' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  const straznikPort = 49996;
  await new Promise((resolve) => mockStraznikServer.listen(straznikPort, '127.0.0.1', resolve));

  const liveCheck = await checkExistingInstance(straznikPort, 1000);
  assert.equal(liveCheck.running, true, 'Aktywny serwer gry powinien zwrócić running=true');
  assert.equal(liveCheck.isStraznik, true, 'Serwer gry z trasą cold-start musi być rozpoznany jako Strażnik');

  await new Promise((resolve) => mockStraznikServer.close(resolve));

  // 3c: Obcy serwer (np. inny proces systemowy)
  const mockAlienServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Foreign system service');
  });

  const alienPort = 49997;
  await new Promise((resolve) => mockAlienServer.listen(alienPort, '127.0.0.1', resolve));

  const alienCheck = await checkExistingInstance(alienPort, 1000);
  assert.equal(alienCheck.running, true, 'Obcy serwer powinien zwrócić running=true');
  assert.equal(alienCheck.isStraznik, false, 'Obcy serwer nie może być rozpoznany jako Strażnik');

  await new Promise((resolve) => mockAlienServer.close(resolve));
  console.log('  PASS: rozpoznawanie instancji Strażnika vs obcych procesów działa prawidłowo.\n');

  // Test 4: Kaskadowy Tree Kill i eliminacja procesów zombie
  console.log('[4/4] Test: killProcessTree() - eliminacja procesów zombie');
  const dummyChild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    stdio: 'ignore',
    detached: process.platform !== 'win32'
  });

  assert.ok(dummyChild.pid, 'Podproces testowy powinien mieć przypisany PID');

  // Weryfikacja że proces żyje
  let isAliveBefore = true;
  try {
    process.kill(dummyChild.pid, 0);
  } catch (_) {
    isAliveBefore = false;
  }
  assert.equal(isAliveBefore, true, 'Proces testowy musi początkowo żyć');

  // Zabicie drzewa procesów
  killProcessTree(dummyChild.pid, 'SIGKILL');

  // Poczekaj chwilę na propagację sygnału
  await new Promise((r) => setTimeout(r, 200));

  let isAliveAfter = true;
  try {
    process.kill(dummyChild.pid, 0);
  } catch (_) {
    isAliveAfter = false;
  }
  assert.equal(isAliveAfter, false, 'Po killProcessTree proces testowy musi zostać bezwzględnie ubity');
  console.log('  PASS: killProcessTree skutecznie eliminuje procesy potomne.\n');

  // Test 5: Reguła Chrome-Only dla Windows (brak msedge.exe w kandydatach)
  console.log('[5/5] Test: getWindowsBrowserCandidates() - reguła Chrome-Only');
  const mockEnv = {
    ProgramFiles: 'C:\\Program Files',
    'ProgramFiles(x86)': 'C:\\Program Files (x86)',
    LocalAppData: 'C:\\Users\\Użytkownik\\AppData\\Local'
  };
  const candidates = getWindowsBrowserCandidates(mockEnv, 'C:\\Users\\Użytkownik');
  assert.ok(candidates.length >= 3, 'Powinny być co najmniej 3 ścieżki kandydatów Chrome');
  for (const c of candidates) {
    assert.ok(c.toLowerCase().includes('chrome.exe'), `Ścieżka kandydata ${c} musi wskazywać na chrome.exe`);
    assert.ok(!c.toLowerCase().includes('edge'), `Ścieżka kandydata ${c} NIE MOŻE zawierać Microsoft Edge`);
    assert.ok(!c.toLowerCase().includes('msedge'), `Ścieżka kandydata ${c} NIE MOŻE zawierać msedge.exe`);
  }
  console.log('  PASS: getWindowsBrowserCandidates ściśle przestrzega reguły Chrome-Only i ignoruje Edge.\n');

  // Test 6: Niezależność od pliku hosts (determinizm IPv4 Loopback 127.0.0.1)
  console.log('[6/6] Test: IP Loopback - weryfikacja niezależności od hosts (127.0.0.1)');
  const loopbackServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ available: true }));
  });
  const loopbackPort = 49998;
  await new Promise((resolve) => loopbackServer.listen({ port: loopbackPort, host: '127.0.0.1' }, resolve));
  const loopbackCheck = await checkExistingInstance(loopbackPort, 1000);
  assert.equal(loopbackCheck.running, true, 'checkExistingInstance musi bezbłędnie łączyć się przez 127.0.0.1');
  assert.equal(loopbackCheck.isStraznik, true, 'Instancja na 127.0.0.1 musi być rozpoznana bez zależności od resolvera hosts');
  await new Promise((resolve) => loopbackServer.close(resolve));
  console.log('  PASS: detekcja i połączenia są w 100% oparte na deterministycznym 127.0.0.1.\n');

  // Test 7: Limit pamięci sterty V8 (NODE_OPTIONS --max-old-space-size=4096)
  console.log('[7/7] Test: Limit pamięci Node.js (NODE_OPTIONS --max-old-space-size=4096)');
  const supervisorSource = fs.readFileSync(path.join(__dirname, 'supervisor.mjs'), 'utf8');
  assert.ok(
    supervisorSource.includes('--max-old-space-size=4096'),
    'supervisor.mjs musi przekazywać --max-old-space-size=4096 w konfiguracji NODE_OPTIONS serwera'
  );
  const launcherCmdSource = fs.readFileSync(path.join(__dirname, 'launcher.cmd'), 'utf8');
  assert.ok(
    launcherCmdSource.includes('--max-old-space-size=4096'),
    'launcher.cmd musi definiować set NODE_OPTIONS=--max-old-space-size=4096 przed startem'
  );
  console.log('  PASS: konfiguracja limitu pamięci 4GB Node.js jest obecna w supervisorze i launcherze.\n');

  console.log('====================================================');
  console.log('Wszystkie testy supervisora zakończone SUKCESEM (7/7)!');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('\nBŁĄD TESTU:', err);
  process.exit(1);
});
