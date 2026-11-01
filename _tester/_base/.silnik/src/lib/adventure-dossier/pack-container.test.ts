import { createHash } from 'node:crypto';
import { decryptDossierPack, encryptDossierPack } from './pack-container';

const pdfBytes = Buffer.from('%PDF-1.7 synthetic dossier fixture; not a real book', 'utf8');
const fingerprint = `sha256:${createHash('sha256').update(pdfBytes).digest('hex')}`;

function payload(approval: 'approved' | 'pending' = 'approved') {
  return {
    schema_version: 1,
    adventure_id: 'synthetic-adventure',
    edition_fingerprint: fingerprint,
    records: [{
      schema_version: 1,
      record_id: 'synthetic.scene.one',
      record_type: 'scene',
      adventure_id: 'synthetic-adventure',
      edition_fingerprint: fingerprint,
      language: 'pl',
      content: 'Synthetic test fact only.',
      tags: { entities: [], scenes: ['scene-one'], mechanics: [], topics: [], triggers: [] },
      retrieval: { visibility: 'gm_only', availability: 'when_scene_active', condition: null, priority: 1 },
      evidence: {
        provenance: 'approved_design',
        source_ref: 'synthetic-test-fixture',
        status: 'set',
        approval,
        approved_by: approval === 'approved' ? 'test' : null,
        approved_at: approval === 'approved' ? '2026-10-11T00:00:00Z' : null,
      },
      links: [],
    }],
  };
}

describe('encrypted adventure dossier container', () => {
  it('round-trips an approved payload with the exact source PDF bytes', () => {
    const pack = encryptDossierPack(payload(), pdfBytes, fingerprint);
    expect(pack.subarray(0, 4).toString('ascii')).toBe('STDP');
    expect(pack.includes(Buffer.from('Synthetic test fact only.'))).toBe(false);
    expect(decryptDossierPack(pack, pdfBytes, fingerprint)).toEqual(payload());
  });

  it('rejects a different PDF and an incorrect expected fingerprint', () => {
    const pack = encryptDossierPack(payload(), pdfBytes, fingerprint);
    expect(() => decryptDossierPack(pack, Buffer.from('%PDF changed'), fingerprint)).toThrow();
    expect(() => decryptDossierPack(pack, pdfBytes, 'sha256:wrong')).toThrow();
  });

  it('rejects tampering and unapproved records', () => {
    const pack = encryptDossierPack(payload(), pdfBytes, fingerprint);
    const changed = Buffer.from(pack);
    changed[changed.length - 1] ^= 1;
    expect(() => decryptDossierPack(changed, pdfBytes, fingerprint)).toThrow();
    expect(() => encryptDossierPack(payload('pending'), pdfBytes, fingerprint)).toThrow();
  });
});
