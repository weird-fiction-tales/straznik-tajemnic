import path from 'node:path';
import os from 'node:os';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadDossierAuthoringDirectory } from './authoring-loader';
import { buildEncryptedDossierPack, writeEncryptedDossierPack } from './packager';
import { decryptDossierPack } from './pack-container';
import type { DossierRagRecord } from './rag-schema';

const pdfBytes = Buffer.from('%PDF-1.7 synthetic authoring fixture; not a real book', 'utf8');
const fingerprint = `sha256:${createHash('sha256').update(pdfBytes).digest('hex')}`;
const recordIds = ['synthetic.scene.one', 'synthetic.fact.two'];
const expectedRecordCount = recordIds.length;

/** JSON-form YAML is accepted by the loader; approvals apply only to neutral test data. */
async function writeFixture(directory: string, manifestApproved = false, approvedRecordIds: string[] = []) {
  const approval = (approved: boolean): Pick<DossierRagRecord['evidence'], 'approval' | 'approved_by' | 'approved_at'> => ({ approval: approved ? 'approved' : 'pending',
    approved_by: approved ? 'synthetic-test-reviewer' : null,
    approved_at: approved ? '2026-10-11T00:00:00Z' : null });
  await mkdir(path.join(directory, 'records'), { recursive: true });
  await writeFile(path.join(directory, 'dossier.yaml'), JSON.stringify({ schema_version: 1,
    dossier_id: 'synthetic-authoring', adventure_id: 'synthetic-adventure', edition_id: 'synthetic-v1',
    edition_fingerprint: fingerprint, language: 'pl', source_ref: 'synthetic-test-fixture',
    records_directory: 'records', ...approval(manifestApproved) }));
  for (const [index, id] of recordIds.entries()) {
    const record: DossierRagRecord = { schema_version: 1, record_id: id,
      record_type: index === 0 ? 'scene' : 'fact', adventure_id: 'synthetic-adventure', edition_fingerprint: fingerprint,
      language: 'pl', content: `Neutral synthetic authoring fact ${index + 1}.`,
      tags: { entities: [], scenes: ['synthetic-room'], mechanics: [], topics: [], triggers: [] },
      retrieval: { visibility: 'gm_only', availability: 'when_scene_active', condition: null, priority: 1 },
      evidence: { provenance: 'approved_design', source_ref: 'synthetic-test-fixture', status: 'set',
        ...approval(approvedRecordIds.includes(id)) }, links: [] };
    await writeFile(path.join(directory, 'records', `${index + 1}.yaml`), JSON.stringify(record));
  }
}

describe('dossier authoring loader', () => {
  let temporaryRoot: string;
  let authoringDirectory: string;
  beforeEach(async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'dossier-authoring-'));
    authoringDirectory = path.join(temporaryRoot, 'dossier');
    await writeFixture(authoringDirectory);
  });
  afterEach(async () => { await rm(temporaryRoot, { recursive: true, force: true }); });

  it('loads authored YAML but keeps it out of release while approvals are pending', async () => {
    const result = await loadDossierAuthoringDirectory(authoringDirectory, fingerprint);
    expect(result.ok).toBe(true);
    expect(result.releaseReady).toBe(false);
    expect(result.recordCount).toBe(expectedRecordCount);
    expect(result.payload).toBeUndefined();
    expect(result.errors.join(' ')).toContain('pending approval');
    expect(result.errors.join(' ')).toContain(recordIds[0]);
    expect(result.errors.join(' ')).toContain(recordIds[1]);
    expect(await buildEncryptedDossierPack(authoringDirectory, pdfBytes)).toMatchObject({ ok: false });
  });

  it('rejects a recognized PDF fingerprint that does not match the authoring manifest', async () => {
    const result = await loadDossierAuthoringDirectory(authoringDirectory, 'sha256:another-edition');
    expect(result.ok).toBe(false);
    expect(result.releaseReady).toBe(false);
    expect(result.errors.join(' ')).toContain('fingerprint does not match');
  });

  it('returns a release payload only after the manifest and every record are approved', async () => {
    await writeFixture(authoringDirectory, true, [recordIds[0]]);
    const onePending = await loadDossierAuthoringDirectory(authoringDirectory, fingerprint);
    expect(onePending).toMatchObject({ ok: true, releaseReady: false, recordCount: expectedRecordCount });
    expect(onePending.payload).toBeUndefined();
    expect(onePending.errors.join(' ')).toContain(recordIds[1]);
    await writeFixture(authoringDirectory, false, recordIds);
    const pendingManifest = await loadDossierAuthoringDirectory(authoringDirectory, fingerprint);
    expect(pendingManifest).toMatchObject({ ok: true, releaseReady: false });
    expect(pendingManifest.payload).toBeUndefined();
    expect(pendingManifest.errors.join(' ')).toContain('pending approval');
    await writeFixture(authoringDirectory, true, recordIds);
    const result = await loadDossierAuthoringDirectory(authoringDirectory, fingerprint);
    if (!result.ok) throw new Error(result.errors.join('; '));
    expect(result.ok).toBe(true);
    expect(result.releaseReady).toBe(true);
    expect(result.payload?.records).toHaveLength(expectedRecordCount);

    const packaged = await buildEncryptedDossierPack(authoringDirectory, pdfBytes);
    expect(packaged.ok).toBe(true);
    expect(packaged.recordCount).toBe(expectedRecordCount);
    expect(packaged.pack).toBeDefined();
    expect(packaged.pack?.includes(Buffer.from(result.payload!.records[0].content))).toBe(false);
    expect(decryptDossierPack(packaged.pack!, pdfBytes, fingerprint)).toEqual(result.payload);
    const tampered = Buffer.from(packaged.pack!);
    tampered[tampered.length - 1] ^= 1;
    expect(() => decryptDossierPack(tampered, pdfBytes, fingerprint)).toThrow();
    expect(() => decryptDossierPack(packaged.pack!, Buffer.from('%PDF-1.7 different synthetic source'), fingerprint)).toThrow();

    const releaseDirectory = path.join(temporaryRoot, 'release');
    await mkdir(releaseDirectory);
    const outputPath = path.join(releaseDirectory, 'opaque-edition.stpack');
    const written = await writeEncryptedDossierPack(authoringDirectory, pdfBytes, outputPath);
    expect(written).toMatchObject({ ok: true, recordCount: expectedRecordCount, outputPath });
    const releaseBytes = await readFile(outputPath);
    expect(releaseBytes.includes(Buffer.from(result.payload!.records[0].content))).toBe(false);
    expect(decryptDossierPack(releaseBytes, pdfBytes, fingerprint)).toEqual(result.payload);
    await expect(writeEncryptedDossierPack(authoringDirectory, pdfBytes, outputPath)).resolves.toMatchObject({ ok: false });
  });
});
