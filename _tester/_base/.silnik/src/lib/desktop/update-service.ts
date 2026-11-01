import { copyFile, mkdir, readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { getWritableDataDir } from '@/lib/paths';

export const UPDATE_BUNDLE_ID = 'com.aios.straznik-tajemnic-ai';
export const UPDATE_STATUS_FILE = 'status.json';
export const DEFAULT_GITHUB_REPO = 'InduPhantom-hash/straznik-tajemnic';

export interface BuildInfo {
  channel?: 'stable' | 'showcase';
  version?: string;
  commitSha?: string;
  shortCommit?: string;
  builtAt?: string;
}

export interface PackageInfo {
  name: string;
  url: string;
  size: number;
  sha256: string;
}

export interface DesktopUpdateManifest {
  schemaVersion: 1;
  version: string;
  commitSha?: string;
  shortCommit?: string;
  publishedAt?: string;
  channel: 'stable';
  bundleId: string;
  minimumMacOSVersion?: string;
  package?: PackageInfo;
  packages?: {
    darwin?: PackageInfo;
    win32?: PackageInfo;
    macos?: PackageInfo;
    windows?: PackageInfo;
    [key: string]: PackageInfo | undefined;
  };
  platforms?: {
    darwin?: PackageInfo;
    win32?: PackageInfo;
    macos?: PackageInfo;
    windows?: PackageInfo;
    [key: string]: PackageInfo | undefined;
  };
  releaseNotes: string;
}

export interface DesktopUpdateStatus {
  id: string;
  state: 'idle' | 'downloading' | 'verifying' | 'installing' | 'restarting' | 'succeeded' | 'rolled_back' | 'failed';
  version?: string;
  commitSha?: string;
  message?: string;
  updatedAt: string;
}

function parseVersion(value: string): [number, number, number] | null {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function isMacOSVersion(value: string): boolean {
  return /^\d+\.\d+(?:\.\d+)?$/.test(value);
}

export function isValidCommitSha(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{7,40}$/i.test(value.trim());
}

export function normalizeCommitSha(value?: string | null): string | undefined {
  if (!isValidCommitSha(value)) return undefined;
  return value.trim().toLowerCase();
}

export function toShortCommit(value?: string | null): string | undefined {
  const normalized = normalizeCommitSha(value);
  return normalized ? normalized.slice(0, 7) : undefined;
}

export function isSameCommit(a?: string | null, b?: string | null): boolean {
  const normA = normalizeCommitSha(a);
  const normB = normalizeCommitSha(b);
  if (!normA || !normB) return false;
  return normA === normB || normA.startsWith(normB) || normB.startsWith(normA);
}

function isValidPackageInfo(pkg: unknown): pkg is PackageInfo {
  if (!pkg || typeof pkg !== 'object') return false;
  const p = pkg as Partial<PackageInfo>;
  return (
    typeof p.name === 'string' &&
    p.name.length > 0 &&
    typeof p.url === 'string' &&
    p.url.startsWith('https://') &&
    Number.isSafeInteger(p.size) &&
    (p.size ?? 0) > 0 &&
    typeof p.sha256 === 'string' &&
    /^[a-f0-9]{64}$/i.test(p.sha256)
  );
}

export function isNewerStableVersion(current: string, candidate: string): boolean {
  const a = parseVersion(current);
  const b = parseVersion(candidate);
  if (!a || !b) return false;
  for (let index = 0; index < 3; index += 1) {
    if (b[index] !== a[index]) return b[index] > a[index];
  }
  return false;
}

export function getUpdatePackageForPlatform(
  manifest: DesktopUpdateManifest,
  platform: NodeJS.Platform = process.platform
): PackageInfo | null {
  if (platform === 'win32') {
    const pkg =
      manifest.packages?.win32 ??
      manifest.platforms?.windows ??
      manifest.packages?.windows ??
      null;
    if (pkg) return pkg;

    // Fallback wyłącznie jeśli pojedyncza paczka jawnie celuje w Windows
    if (manifest.package && manifest.package.name.toLowerCase().includes('win')) {
      return manifest.package;
    }
    return null;
  }

  if (platform === 'darwin') {
    const pkg =
      manifest.packages?.darwin ??
      manifest.platforms?.macos ??
      manifest.packages?.macos ??
      null;
    if (pkg) return pkg;

    // Fallback dla legacy manifestów (pojedyncza paczka bez oznaczenia Windows)
    if (manifest.package && !manifest.package.name.toLowerCase().includes('win')) {
      return manifest.package;
    }
    return null;
  }

  return manifest.packages?.[platform] ?? manifest.package ?? null;
}

export function validateManifest(value: unknown): DesktopUpdateManifest | null {
  if (!value || typeof value !== 'object') return null;
  const manifest = value as Partial<DesktopUpdateManifest>;

  if (
    manifest.schemaVersion !== 1 ||
    manifest.channel !== 'stable' ||
    manifest.bundleId !== UPDATE_BUNDLE_ID ||
    !parseVersion(manifest.version ?? '')
  ) {
    return null;
  }

  if (manifest.commitSha !== undefined && !isValidCommitSha(manifest.commitSha)) {
    return null;
  }

  if (manifest.shortCommit !== undefined && !isValidCommitSha(manifest.shortCommit)) {
    return null;
  }

  if (manifest.publishedAt !== undefined) {
    if (typeof manifest.publishedAt !== 'string' || Number.isNaN(Date.parse(manifest.publishedAt))) {
      return null;
    }
  }

  if (manifest.minimumMacOSVersion !== undefined) {
    if (typeof manifest.minimumMacOSVersion !== 'string' || !isMacOSVersion(manifest.minimumMacOSVersion)) {
      return null;
    }
  }

  if (typeof manifest.releaseNotes !== 'string') return null;
  if (manifest.releaseNotes !== '' && !manifest.releaseNotes.startsWith('https://')) return null;

  // Validate packages
  let hasValidPackage = false;

  if (manifest.package !== undefined) {
    if (!isValidPackageInfo(manifest.package)) return null;
    hasValidPackage = true;
  }

  if (manifest.packages !== undefined) {
    if (typeof manifest.packages !== 'object') return null;
    for (const val of Object.values(manifest.packages)) {
      if (val !== undefined) {
        if (!isValidPackageInfo(val)) return null;
        hasValidPackage = true;
      }
    }
  }

  if (manifest.platforms !== undefined) {
    if (typeof manifest.platforms !== 'object') return null;
    for (const val of Object.values(manifest.platforms)) {
      if (val !== undefined) {
        if (!isValidPackageInfo(val)) return null;
        hasValidPackage = true;
      }
    }
  }

  if (!hasValidPackage) return null;

  return manifest as DesktopUpdateManifest;
}

function getShowcaseBuildInfo(): BuildInfo | null {
  try {
    const filename = process.env.ZEW_BUILD_INFO_PATH ?? path.join(process.cwd(), 'build-info.json');
    const info = JSON.parse(fs.readFileSync(filename, 'utf8')) as BuildInfo;
    return info.channel === 'showcase' ? info : null;
  } catch {
    return null;
  }
}

export function canPerformSelfUpdate(): boolean {
  if (process.env.ZEW_DESKTOP_SHOWCASE === '1' || getShowcaseBuildInfo()) return false;
  if (process.env.ZEW_DESKTOP_SELF_UPDATE === '0') return false;
  if (process.env.ZEW_DESKTOP_SELF_UPDATE === '1') return true;

  if (process.platform === 'darwin') {
    const appBundle = process.env.ZEW_APP_BUNDLE;
    return !!(appBundle && appBundle.endsWith('.app'));
  }

  if (process.platform === 'win32') {
    if (process.env.STRAZNIK_DESKTOP_COLD_START === '1') return true;
    const explicit = process.env.ZEW_APP_DIR || process.env.ZEW_APP_BUNDLE;
    if (explicit && fs.existsSync(explicit)) {
      return (
        fs.existsSync(path.join(explicit, 'Graj - Strażnik Tajemnic.cmd')) ||
        fs.existsSync(path.join(explicit, 'runtime'))
      );
    }
    const cwd = process.cwd();
    const parent = path.resolve(cwd, '..');
    if (
      fs.existsSync(path.join(parent, 'Graj - Strażnik Tajemnic.cmd')) &&
      fs.existsSync(path.join(parent, 'runtime'))
    ) {
      return true;
    }
    return false;
  }

  return false;
}

export async function getCurrentVersion(): Promise<string> {
  const showcase = getShowcaseBuildInfo();
  if (showcase?.version) return showcase.version;
  const pkg = JSON.parse(await readFile(path.join(process.cwd(), 'package.json'), 'utf8')) as { version?: string };
  return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
}

export async function getCurrentCommitSha(): Promise<string | undefined> {
  const envCommit = process.env.ZEW_CURRENT_COMMIT_SHA;
  if (envCommit !== undefined) {
    if (envCommit === '' || envCommit.toLowerCase() === 'none') return undefined;
    return normalizeCommitSha(envCommit);
  }

  const explicitBuildInfo = process.env.ZEW_BUILD_INFO_PATH;
  if (explicitBuildInfo !== undefined) {
    try {
      const info = JSON.parse(await readFile(explicitBuildInfo, 'utf8')) as BuildInfo;
      return normalizeCommitSha(info.commitSha);
    } catch {
      return undefined;
    }
  }

  try {
    const info = JSON.parse(await readFile(path.join(process.cwd(), 'build-info.json'), 'utf8')) as BuildInfo;
    const parsed = normalizeCommitSha(info.commitSha);
    if (parsed) return parsed;
  } catch {
    // Fallback to git below if running from a source checkout
  }

  if (process.env.ZEW_DISABLE_GIT_FALLBACK === '1') return undefined;

  try {
    const out = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    });
    return normalizeCommitSha(out);
  } catch {
    return undefined;
  }
}

async function fetchCommitsComparison(
  currentCommitSha: string,
  targetCommitSha: string,
  fetcher: typeof fetch
): Promise<{ aheadBy?: number; behindBy?: number }> {
  const repo = process.env.ZEW_GITHUB_REPO || DEFAULT_GITHUB_REPO;
  const compareUrl = `https://api.github.com/repos/${repo}/compare/${currentCommitSha}...${targetCommitSha}`;
  try {
    const res = await fetcher(compareUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res || !res.ok || typeof res.json !== 'function') return {};
    const payload = (await res.json()) as { ahead_by?: unknown; behind_by?: unknown } | null;
    if (!payload || typeof payload !== 'object') return {};
    const aheadBy =
      typeof payload.ahead_by === 'number' && Number.isInteger(payload.ahead_by) && payload.ahead_by >= 0
        ? payload.ahead_by
        : undefined;
    const behindBy =
      typeof payload.behind_by === 'number' && Number.isInteger(payload.behind_by) && payload.behind_by >= 0
        ? payload.behind_by
        : undefined;
    return { aheadBy, behindBy };
  } catch {
    return {};
  }
}

export interface DesktopUpdateCheckResult {
  available: boolean;
  configured: boolean;
  currentVersion: string;
  currentCommitSha?: string;
  currentShortCommit?: string;
  commitsBehind?: number;
  manifest?: DesktopUpdateManifest;
  canSelfUpdate?: boolean;
}

export async function checkForDesktopUpdate(
  fetcher: typeof fetch = fetch
): Promise<DesktopUpdateCheckResult> {
  const currentVersion = await getCurrentVersion();
  const currentCommitSha = await getCurrentCommitSha();
  const currentShortCommit = toShortCommit(currentCommitSha);
  if (process.env.ZEW_DESKTOP_SHOWCASE === '1' || getShowcaseBuildInfo()) {
    return {
      available: false, configured: false, canSelfUpdate: false, currentVersion,
      ...(currentCommitSha ? { currentCommitSha, currentShortCommit } : {}),
    };
  }
  const manifestUrl = process.env.ZEW_UPDATE_MANIFEST_URL?.trim();
  if (!manifestUrl) {
    return {
      available: false,
      configured: false,
      currentVersion,
      ...(currentCommitSha ? { currentCommitSha, currentShortCommit } : {}),
    };
  }
  if (!manifestUrl.startsWith('https://')) throw new Error('Update manifest URL must use HTTPS');
  const response = await fetcher(manifestUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Manifest download failed: ${response.status}`);
  const manifest = validateManifest(await response.json());
  if (!manifest) throw new Error('Invalid update manifest');

  const manifestCommitSha = normalizeCommitSha(manifest.commitSha);
  const manifestShortCommit = toShortCommit(manifest.shortCommit ?? manifestCommitSha);
  const normalizedManifest: DesktopUpdateManifest = {
    ...manifest,
    ...(manifestCommitSha ? { commitSha: manifestCommitSha, shortCommit: manifestShortCommit } : {}),
  };

  const targetPackage = getUpdatePackageForPlatform(normalizedManifest);
  const newerVersion = isNewerStableVersion(currentVersion, normalizedManifest.version);
  const sameVersion = currentVersion === normalizedManifest.version;

  let commitUpdateAvailable = false;
  let commitsBehind: number | undefined;

  if (sameVersion && manifestCommitSha) {
    if (!currentCommitSha) {
      commitUpdateAvailable = true;
    } else if (!isSameCommit(currentCommitSha, manifestCommitSha)) {
      commitUpdateAvailable = true;
      const comparison = await fetchCommitsComparison(currentCommitSha, manifestCommitSha, fetcher);
      if (comparison.aheadBy !== undefined) {
        if (comparison.aheadBy > 0) {
          commitsBehind = comparison.aheadBy;
        } else if (comparison.aheadBy === 0) {
          // Local commit is equal to or ahead of the published manifest commit
          commitUpdateAvailable = false;
          commitsBehind = 0;
        }
      }
    }
  } else if (newerVersion && currentCommitSha && manifestCommitSha && !isSameCommit(currentCommitSha, manifestCommitSha)) {
    const comparison = await fetchCommitsComparison(currentCommitSha, manifestCommitSha, fetcher);
    if (comparison.aheadBy !== undefined && comparison.aheadBy > 0) {
      commitsBehind = comparison.aheadBy;
    }
  }

  const isAvailable = (newerVersion || (sameVersion && commitUpdateAvailable)) && targetPackage !== null;
  const selfUpdateAvailable = canPerformSelfUpdate();

  // If running in desktop mode on Windows where self-update is available, ensure env is synced for API routes
  if (process.platform === 'win32' && selfUpdateAvailable && process.env.ZEW_DESKTOP_SELF_UPDATE === undefined) {
    process.env.ZEW_DESKTOP_SELF_UPDATE = '1';
  }

  return {
    available: isAvailable,
    configured: true,
    currentVersion,
    ...(currentCommitSha ? { currentCommitSha, currentShortCommit } : {}),
    ...(commitsBehind !== undefined ? { commitsBehind } : {}),
    manifest: normalizedManifest,
    canSelfUpdate: selfUpdateAvailable,
  };
}

export function updatesDirectory(): string {
  return path.join(getWritableDataDir(), 'updates');
}

export async function readUpdateStatus(): Promise<DesktopUpdateStatus> {
  try {
    return JSON.parse(await readFile(path.join(updatesDirectory(), UPDATE_STATUS_FILE), 'utf8')) as DesktopUpdateStatus;
  } catch {
    return { id: 'none', state: 'idle', updatedAt: new Date(0).toISOString() };
  }
}

export function resolveAppTarget(): string {
  const platform = process.platform;
  if (platform === 'darwin') {
    const appBundle = process.env.ZEW_APP_BUNDLE;
    if (appBundle && appBundle.endsWith('.app')) return appBundle;
    throw new Error('Self-update is unavailable outside an application bundle');
  }

  if (platform === 'win32') {
    const explicit = process.env.ZEW_APP_DIR || process.env.ZEW_APP_BUNDLE;
    if (explicit && fs.existsSync(explicit)) {
      if (
        fs.existsSync(path.join(explicit, 'Graj - Strażnik Tajemnic.cmd')) ||
        fs.existsSync(path.join(explicit, 'runtime'))
      ) {
        return explicit;
      }
    }

    const cwd = process.cwd();
    const parent = path.resolve(cwd, '..');
    if (
      fs.existsSync(path.join(parent, 'Graj - Strażnik Tajemnic.cmd')) &&
      fs.existsSync(path.join(parent, 'runtime'))
    ) {
      return parent;
    }
    if (
      fs.existsSync(path.join(cwd, 'Graj - Strażnik Tajemnic.cmd')) &&
      fs.existsSync(path.join(cwd, 'runtime'))
    ) {
      return cwd;
    }
    throw new Error('Self-update is unavailable outside a packaged desktop installation');
  }

  const explicit = process.env.ZEW_APP_DIR;
  if (explicit && fs.existsSync(explicit)) return explicit;
  throw new Error('Self-update is unavailable outside an application bundle');
}

export function getCandidateWorkerPaths(cwd: string = process.cwd(), includeGlobalFallbacks: boolean = true): string[] {
  const candidates: string[] = [
    path.join(cwd, 'desktop', 'update-worker.mjs'),
    path.join(cwd, 'runtime', 'desktop', 'update-worker.mjs'),
    path.resolve(cwd, '..', 'desktop', 'update-worker.mjs'),
    path.resolve(cwd, '..', 'runtime', 'desktop', 'update-worker.mjs'),
    path.resolve(cwd, '../..', 'desktop', 'update-worker.mjs'),
    path.resolve(cwd, '../../..', 'desktop', 'update-worker.mjs'),
    path.resolve(cwd, '../../..', 'runtime', 'desktop', 'update-worker.mjs'),
  ];

  if (includeGlobalFallbacks) {
    if (process.env.ZEW_APP_BUNDLE) {
      candidates.push(
        path.join(process.env.ZEW_APP_BUNDLE, 'Contents', 'Resources', 'runtime', 'desktop', 'update-worker.mjs'),
        path.join(process.env.ZEW_APP_BUNDLE, 'Contents', 'Resources', 'desktop', 'update-worker.mjs')
      );
    }

    if (process.env.ZEW_APP_DIR) {
      candidates.push(
        path.join(process.env.ZEW_APP_DIR, 'desktop', 'update-worker.mjs'),
        path.join(process.env.ZEW_APP_DIR, 'runtime', 'desktop', 'update-worker.mjs')
      );
    }

    candidates.push(
      path.resolve(__dirname, '../../../../desktop/update-worker.mjs'),
      path.resolve(__dirname, '../../../../../desktop/update-worker.mjs'),
      path.resolve(__dirname, '../../../../../../desktop/update-worker.mjs')
    );
  }

  return candidates;
}

export function resolveUpdateWorkerPath(cwd: string = process.cwd(), includeGlobalFallbacks: boolean = true): string {
  const candidates = getCandidateWorkerPaths(cwd, includeGlobalFallbacks);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`Update worker script (update-worker.mjs) not found in candidate paths for cwd: ${cwd}`);
  }
  return found;
}

export async function startDetachedUpdate(manifest: DesktopUpdateManifest): Promise<number> {
  if (!canPerformSelfUpdate()) {
    throw new Error('Self-update is unavailable outside an application bundle');
  }

  const platform = process.platform;
  const targetPackage = getUpdatePackageForPlatform(manifest, platform);
  if (!targetPackage) {
    throw new Error(`No compatible package found for platform: ${platform}`);
  }

  const targetPath = resolveAppTarget();
  const updateDir = updatesDirectory();
  await mkdir(updateDir, { recursive: true });

  const sourceWorker = resolveUpdateWorkerPath();
  const detachedWorker = path.join(updateDir, 'update-worker.mjs');
  await copyFile(sourceWorker, detachedWorker);

  // Kopiujemy również ekran ładowania updater-splash.html, jeśli istnieje w tej samej lokalizacji
  const sourceSplash = path.join(path.dirname(sourceWorker), 'updater-splash.html');
  if (fs.existsSync(sourceSplash)) {
    try {
      await copyFile(sourceSplash, path.join(updateDir, 'updater-splash.html'));
    } catch {
      // Ignorujemy błąd kopiowania splash - nie blokuje on procesu aktualizacji
    }
  }

  let workerExecPath = process.execPath;
  if (platform === 'win32') {
    // Na Windows uruchomienie workera bezpośrednio z runtime/bin/node.exe blokuje katalog runtime przed podmianą.
    // Kopiujemy Node do katalogu updates (poza runtime), aby worker mógł bezpiecznie wykonać renameSync.
    try {
      const entries = await fs.promises.readdir(updateDir);
      for (const entry of entries) {
        if (entry.startsWith('updater-node') && entry.endsWith('.exe')) {
          try {
            await fs.promises.unlink(path.join(updateDir, entry));
          } catch {
            // ignore unlink errors
          }
        }
      }
    } catch {
      // ignore readdir errors
    }

    const detachedNode = path.join(updateDir, 'updater-node.exe');
    try {
      await copyFile(process.execPath, detachedNode);
      workerExecPath = detachedNode;
    } catch {
      const fallbackNode = path.join(updateDir, `updater-node-${Date.now()}.exe`);
      try {
        await copyFile(process.execPath, fallbackNode);
        workerExecPath = fallbackNode;
      } catch {
        workerExecPath = process.execPath;
      }
    }
  }

  const args = [
    detachedWorker,
    '--target', targetPath,
    '--url', targetPackage.url,
    '--sha256', targetPackage.sha256,
    '--version', manifest.version,
    '--bundle-id', manifest.bundleId,
    '--size', String(targetPackage.size),
    '--data-dir', getWritableDataDir(),
    '--port', process.env.ZEW_APP_PORT || '4050',
    '--platform', platform,
    '--desktop-pid', String(process.pid),
  ];

  if (manifest.minimumMacOSVersion) {
    args.push('--minimum-macos', manifest.minimumMacOSVersion);
  }
  if (manifest.commitSha) {
    args.push('--commit', manifest.commitSha);
  }

  const child = spawn(workerExecPath, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  return child.pid ?? 0;
}
