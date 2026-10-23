import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { formatVersionWithCommit } from './update-client';
import {
  canPerformSelfUpdate,
  checkForDesktopUpdate,
  getCandidateWorkerPaths,
  getCurrentCommitSha,
  getCurrentVersion,
  getUpdatePackageForPlatform,
  isNewerStableVersion,
  isSameCommit,
  readUpdateStatus,
  resolveAppTarget,
  startDetachedUpdate,
  resolveUpdateWorkerPath,
  validateManifest,
} from './update-service';

const sha = 'a'.repeat(64);
const commitOld = '1111111111111111111111111111111111111111';
const commitNew = '2222222222222222222222222222222222222222';
const manifest = {
  schemaVersion: 1,
  version: '0.9.6',
  channel: 'stable',
  bundleId: 'com.aios.straznik-tajemnic-ai',
  minimumMacOSVersion: '11.0',
  package: { name: 'app.zip', url: 'https://example.com/app.zip', size: 123, sha256: sha },
  releaseNotes: 'https://example.com/notes',
} as const;

describe('desktop update service', () => {
  const previousManifestUrl = process.env.ZEW_UPDATE_MANIFEST_URL;
  const previousSelfUpdate = process.env.ZEW_DESKTOP_SELF_UPDATE;
  const previousDataDir = process.env.ZEW_DATA_DIR;
  const previousCommitSha = process.env.ZEW_CURRENT_COMMIT_SHA;
  const previousBuildInfoPath = process.env.ZEW_BUILD_INFO_PATH;

  afterEach(() => {
    if (previousManifestUrl === undefined) delete process.env.ZEW_UPDATE_MANIFEST_URL; else process.env.ZEW_UPDATE_MANIFEST_URL = previousManifestUrl;
    if (previousSelfUpdate === undefined) delete process.env.ZEW_DESKTOP_SELF_UPDATE; else process.env.ZEW_DESKTOP_SELF_UPDATE = previousSelfUpdate;
    if (previousDataDir === undefined) delete process.env.ZEW_DATA_DIR; else process.env.ZEW_DATA_DIR = previousDataDir;
    if (previousCommitSha === undefined) delete process.env.ZEW_CURRENT_COMMIT_SHA; else process.env.ZEW_CURRENT_COMMIT_SHA = previousCommitSha;
    if (previousBuildInfoPath === undefined) delete process.env.ZEW_BUILD_INFO_PATH; else process.env.ZEW_BUILD_INFO_PATH = previousBuildInfoPath;
  });

  it('accepts only stable V1 manifests with HTTPS and the expected bundle ID', () => {
    expect(validateManifest(manifest)?.version).toBe('0.9.6');
    expect(validateManifest({ ...manifest, commitSha: commitNew, shortCommit: '2222222', publishedAt: '2026-10-04T12:00:00.000Z' })?.commitSha).toBe(commitNew);
    expect(validateManifest({ ...manifest, commitSha: 'not-a-hex-sha!' })).toBeNull();
    expect(validateManifest({ ...manifest, publishedAt: 'invalid-date' })).toBeNull();
    expect(validateManifest({ ...manifest, version: '0.9.6-beta.1' })).toBeNull();
    expect(validateManifest({ ...manifest, bundleId: 'evil.bundle' })).toBeNull();
    expect(validateManifest({ ...manifest, minimumMacOSVersion: 'latest' })).toBeNull();
    expect(validateManifest({ ...manifest, package: { ...manifest.package, url: 'http://example.com/app.zip' } })).toBeNull();
  });

  it('compares semantic stable versions without accepting prereleases', () => {
    expect(isNewerStableVersion('0.9.3', '0.10.0')).toBe(true);
    expect(isNewerStableVersion('0.9.3', '0.9.3')).toBe(false);
    expect(isNewerStableVersion('0.9.3', '0.9.4-beta.1')).toBe(false);
  });

  it('compares commit SHAs and formats version labels with short commit', () => {
    expect(isSameCommit(commitOld, commitOld)).toBe(true);
    expect(isSameCommit(commitOld, '1111111')).toBe(true);
    expect(isSameCommit(commitOld, commitNew)).toBe(false);
    expect(formatVersionWithCommit('0.9.5', commitNew)).toBe('0.9.5 (2222222)');
    expect(formatVersionWithCommit('0.9.5')).toBe('0.9.5');
  });

  it('reads current commit SHA from build-info.json when present', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-info-'));
    const buildInfoFile = path.join(tmpDir, 'build-info.json');
    fs.writeFileSync(buildInfoFile, JSON.stringify({ version: '0.9.5', commitSha: commitOld, shortCommit: '1111111' }));
    delete process.env.ZEW_CURRENT_COMMIT_SHA;
    process.env.ZEW_BUILD_INFO_PATH = buildInfoFile;

    await expect(getCurrentCommitSha()).resolves.toBe(commitOld);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('protects a frozen showcase even when stable updates are explicitly enabled', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-build-'));
    const info = path.join(tmpDir, 'build-info.json');
    fs.writeFileSync(info, JSON.stringify({ channel: 'showcase', version: '0.9.5-showcase.20261023', commitSha: commitOld }));
    process.env.ZEW_BUILD_INFO_PATH = info;
    process.env.ZEW_DESKTOP_SELF_UPDATE = '1';
    process.env.ZEW_UPDATE_MANIFEST_URL = 'https://example.com/manifest.json';
    const fetcher = jest.fn() as unknown as jest.MockedFunction<typeof fetch>;
    try {
      expect(canPerformSelfUpdate()).toBe(false);
      await expect(getCurrentVersion()).resolves.toBe('0.9.5-showcase.20261023');
      await expect(checkForDesktopUpdate(fetcher)).resolves.toMatchObject({
        available: false, configured: false, canSelfUpdate: false,
        currentVersion: '0.9.5-showcase.20261023',
      });
      expect(fetcher).not.toHaveBeenCalled();
      await expect(startDetachedUpdate(manifest)).rejects.toThrow('Self-update is unavailable');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('reports an update but disables installation outside an app bundle', async () => {
    process.env.ZEW_UPDATE_MANIFEST_URL = 'https://example.com/manifest.json';
    process.env.ZEW_DESKTOP_SELF_UPDATE = '0';
    const fetcher = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => manifest,
    })) as unknown as typeof fetch;
    const result = await checkForDesktopUpdate(fetcher);
    expect(result).toMatchObject({ available: true, currentVersion: '0.9.5', canSelfUpdate: false });
  });

  it('detects commit-based updates on the same version and reports commitsBehind', async () => {
    process.env.ZEW_UPDATE_MANIFEST_URL = 'https://example.com/manifest.json';
    process.env.ZEW_CURRENT_COMMIT_SHA = commitOld;
    process.env.ZEW_DESKTOP_SELF_UPDATE = '1';

    const sameVersionManifest = {
      ...manifest,
      version: '0.9.5',
      commitSha: commitNew,
    };

    const fetcher = jest.fn(async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes('/compare/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ahead_by: 4, behind_by: 0 }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => sameVersionManifest,
      };
    }) as unknown as typeof fetch;

    const result = await checkForDesktopUpdate(fetcher);
    expect(result).toMatchObject({
      available: true,
      currentVersion: '0.9.5',
      currentCommitSha: commitOld,
      currentShortCommit: '1111111',
      commitsBehind: 4,
      canSelfUpdate: true,
    });
    expect(result.manifest?.shortCommit).toBe('2222222');
  });

  it('reports up-to-date when version and commitSha match', async () => {
    process.env.ZEW_UPDATE_MANIFEST_URL = 'https://example.com/manifest.json';
    process.env.ZEW_CURRENT_COMMIT_SHA = commitNew;

    const sameCommitManifest = {
      ...manifest,
      version: '0.9.5',
      commitSha: commitNew,
    };

    const fetcher = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => sameCommitManifest,
    })) as unknown as typeof fetch;

    const result = await checkForDesktopUpdate(fetcher);
    expect(result.available).toBe(false);
  });

  it('does not offer a downgrade when local checkout is ahead of release commit', async () => {
    process.env.ZEW_UPDATE_MANIFEST_URL = 'https://example.com/manifest.json';
    process.env.ZEW_CURRENT_COMMIT_SHA = commitNew;

    const olderCommitManifest = {
      ...manifest,
      version: '0.9.5',
      commitSha: commitOld,
    };

    const fetcher = jest.fn(async (url: string | URL | Request) => {
      if (String(url).includes('/compare/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ahead_by: 0, behind_by: 2 }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => olderCommitManifest,
      };
    }) as unknown as typeof fetch;

    const result = await checkForDesktopUpdate(fetcher);
    expect(result.available).toBe(false);
    expect(result.commitsBehind).toBe(0);
  });

  it('does not offer an update when compare returns ahead_by: 0 without behind_by', async () => {
    process.env.ZEW_UPDATE_MANIFEST_URL = 'https://example.com/manifest.json';
    process.env.ZEW_CURRENT_COMMIT_SHA = commitNew;

    const diffCommitManifest = {
      ...manifest,
      version: '0.9.5',
      commitSha: commitOld,
    };

    const fetcher = jest.fn(async (url: string | URL | Request) => {
      if (String(url).includes('/compare/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ahead_by: 0 }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => diffCommitManifest,
      };
    }) as unknown as typeof fetch;

    const result = await checkForDesktopUpdate(fetcher);
    expect(result.available).toBe(false);
    expect(result.commitsBehind).toBe(0);
  });

  it('offers an update when local package has no build-info commitSha yet but manifest has commitSha', async () => {
    process.env.ZEW_UPDATE_MANIFEST_URL = 'https://example.com/manifest.json';
    process.env.ZEW_CURRENT_COMMIT_SHA = 'none';

    const commitManifest = {
      ...manifest,
      version: '0.9.5',
      commitSha: commitNew,
    };

    const fetcher = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => commitManifest,
    })) as unknown as typeof fetch;

    const result = await checkForDesktopUpdate(fetcher);
    expect(result.available).toBe(true);
  });

  it('returns a durable idle status when no worker result exists', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'update-status-'));
    process.env.ZEW_DATA_DIR = directory;
    await expect(readUpdateStatus()).resolves.toMatchObject({ id: 'none', state: 'idle' });
    fs.rmSync(directory, { recursive: true, force: true });
  });

  describe('getUpdatePackageForPlatform', () => {
    const macPkg = { name: 'straznik-macos.zip', url: 'https://example.com/mac.zip', size: 100, sha256: sha };
    const winPkg = { name: 'straznik-windows.zip', url: 'https://example.com/win.zip', size: 200, sha256: sha };

    it('returns the platform-specific package when available in packages/platforms', () => {
      const unifiedManifest = {
        ...manifest,
        packages: { darwin: macPkg, win32: winPkg },
        platforms: { macos: macPkg, windows: winPkg },
      };
      expect(getUpdatePackageForPlatform(unifiedManifest as never, 'darwin')).toEqual(macPkg);
      expect(getUpdatePackageForPlatform(unifiedManifest as never, 'win32')).toEqual(winPkg);
    });

    it('rejects macOS fallback package on Windows and Windows fallback package on macOS', () => {
      const macOnlyManifest = {
        ...manifest,
        package: macPkg,
        packages: { darwin: macPkg },
      };
      expect(getUpdatePackageForPlatform(macOnlyManifest as never, 'win32')).toBeNull();
      expect(getUpdatePackageForPlatform(macOnlyManifest as never, 'darwin')).toEqual(macPkg);

      const winOnlyManifest = {
        ...manifest,
        package: winPkg,
        packages: { win32: winPkg },
      };
      expect(getUpdatePackageForPlatform(winOnlyManifest as never, 'darwin')).toBeNull();
      expect(getUpdatePackageForPlatform(winOnlyManifest as never, 'win32')).toEqual(winPkg);
    });

    it('falls back to manifest.package on non-windows non-darwin platforms (e.g. linux CI)', () => {
      const genericManifest = {
        ...manifest,
        package: macPkg,
      };
      expect(getUpdatePackageForPlatform(genericManifest as never, 'linux')).toEqual(macPkg);
    });
  });

  describe('canPerformSelfUpdate and resolveAppTarget', () => {
    const origPlatform = process.platform;
    const origAppBundle = process.env.ZEW_APP_BUNDLE;
    const origColdStart = process.env.STRAZNIK_DESKTOP_COLD_START;

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: origPlatform });
      if (origAppBundle === undefined) delete process.env.ZEW_APP_BUNDLE; else process.env.ZEW_APP_BUNDLE = origAppBundle;
      if (origColdStart === undefined) delete process.env.STRAZNIK_DESKTOP_COLD_START; else process.env.STRAZNIK_DESKTOP_COLD_START = origColdStart;
    });

    it('rejects self-update on Windows when only ZEW_DATA_DIR is set', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.ZEW_DATA_DIR = 'C:\\Some\\Data\\Dir';
      delete process.env.STRAZNIK_DESKTOP_COLD_START;
      delete process.env.ZEW_APP_DIR;
      delete process.env.ZEW_APP_BUNDLE;
      delete process.env.ZEW_DESKTOP_SELF_UPDATE;

      expect(canPerformSelfUpdate()).toBe(false);
      expect(() => resolveAppTarget()).toThrow('Self-update is unavailable outside a packaged desktop installation');
    });

    it('allows self-update on Windows when cold-start flag is active', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.STRAZNIK_DESKTOP_COLD_START = '1';
      delete process.env.ZEW_DESKTOP_SELF_UPDATE;

      expect(canPerformSelfUpdate()).toBe(true);
    });
  });

  describe('resolveUpdateWorkerPath and candidate worker paths', () => {
    it('includes root relative paths (../../..) and bundle paths in candidate paths', () => {
      process.env.ZEW_APP_BUNDLE = '/Applications/TestApp.app';
      const candidates = getCandidateWorkerPaths('/Volumes/Karta/Developer/straznik-tajemnic/_tester/_base/.silnik');
      expect(candidates).toContain(
        path.resolve('/Volumes/Karta/Developer/straznik-tajemnic/_tester/_base/.silnik', '../../..', 'desktop', 'update-worker.mjs')
      );
      expect(candidates).toContain(
        path.join('/Applications/TestApp.app', 'Contents', 'Resources', 'runtime', 'desktop', 'update-worker.mjs')
      );
      delete process.env.ZEW_APP_BUNDLE;
    });

    it('resolves update-worker.mjs from root directory when running inside _tester/_base/.silnik', () => {
      const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-root-'));
      const desktopDir = path.join(tmpRoot, 'desktop');
      fs.mkdirSync(desktopDir, { recursive: true });
      const workerFile = path.join(desktopDir, 'update-worker.mjs');
      fs.writeFileSync(workerFile, '// worker content');

      const engineDir = path.join(tmpRoot, '_tester', '_base', '.silnik');
      fs.mkdirSync(engineDir, { recursive: true });

      const resolved = resolveUpdateWorkerPath(engineDir);
      expect(resolved).toBe(workerFile);

      fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    it('throws a descriptive error when update-worker.mjs cannot be found', () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-dir-'));
      expect(() => resolveUpdateWorkerPath(emptyDir, false)).toThrow('Update worker script (update-worker.mjs) not found');
      fs.rmSync(emptyDir, { recursive: true, force: true });
    });
  });
});
