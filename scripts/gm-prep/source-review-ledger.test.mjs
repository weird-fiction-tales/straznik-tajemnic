import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildSourceReviewLedger } from './source-review-ledger.mjs';

const sha = value => import('node:crypto').then(({default: crypto}) => crypto.createHash('sha256').update(value).digest('hex'));

test('binds each reviewed card to its exact current file hash without storing card prose', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-source-ledger-'));
  try {
    const records = path.join(root, 'records'); fs.mkdirSync(records);
    const recordText = [
      'record_id: auto.one',
      'record_type: fact',
      'adventure_id: fixture',
      'content: Private authored card text',
      'evidence:',
      '  source_ref: printed page 4',
    ].join('\n') + '\n';
    fs.writeFileSync(path.join(records, 'auto.one.yaml'), recordText);
    const reviewPath = path.join(root, 'source-review.json');
    fs.writeFileSync(reviewPath, JSON.stringify({
      reviewed_records: 1,
      records: [{ record_id: 'auto.one', classification: 'source_reviewed:source_consistent', review_report: 'batch.json' }],
      historical_superseded_record_ids: [],
      source_prose_stored: false,
    }));
    const recordHash = await sha(recordText);
    const receiptPath = path.join(root, 'generated-files.json');
    fs.writeFileSync(receiptPath, JSON.stringify({ 'auto.one.yaml': recordHash }));

    const result = buildSourceReviewLedger({
      recordsDir: records,
      reviewPath,
      generatedFilesPath: receiptPath,
      adventureId: 'fixture',
      createdAt: '2026-10-17T12:00:00.000Z',
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.ledger.records[0].record_sha256, recordHash);
    assert.equal(result.ledger.records[0].generated_receipt_matches, true);
    assert.equal(JSON.stringify(result.ledger).includes('Private authored card text'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('does not bind a reviewed card when its generated file hash no longer matches', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-source-ledger-'));
  try {
    const records = path.join(root, 'records'); fs.mkdirSync(records);
    const recordText = 'record_id: auto.one\nrecord_type: fact\nadventure_id: fixture\nevidence:\n  source_ref: page 4\n';
    fs.writeFileSync(path.join(records, 'auto.one.yaml'), recordText);
    const reviewPath = path.join(root, 'source-review.json');
    fs.writeFileSync(reviewPath, JSON.stringify({ reviewed_records: 1, records: [{ record_id: 'auto.one', classification: 'source_reviewed:source_consistent', review_report: 'batch.json' }], historical_superseded_record_ids: [] }));
    const receiptPath = path.join(root, 'generated-files.json'); fs.writeFileSync(receiptPath, JSON.stringify({ 'auto.one.yaml': '0'.repeat(64) }));

    const result = buildSourceReviewLedger({ recordsDir: records, reviewPath, generatedFilesPath: receiptPath, adventureId: 'fixture' });

    assert.equal(result.exitCode, 1);
    assert.equal(result.ledger.records[0].generated_receipt_matches, false);
    assert.deepEqual(result.ledger.errors, ['generated_hash_mismatch:auto.one']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('binds a reviewed manually authored card without requiring a generated-file receipt', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-source-ledger-'));
  try {
    const records = path.join(root, 'records'); fs.mkdirSync(records);
    fs.writeFileSync(path.join(records, 'manual-scene.yaml'), 'record_id: manual.card\nrecord_type: scene\nadventure_id: fixture\ncontent: authored\nevidence:\n  source_ref: page 4\n');
    const reviewPath = path.join(root, 'source-review.json');
    fs.writeFileSync(reviewPath, JSON.stringify({ reviewed_records: 1, records: [{ record_id: 'manual.card', classification: 'source_derived_reviewed:source_derived_claim_checked', review_report: 'batch.json' }], historical_superseded_record_ids: [] }));
    const receiptPath = path.join(root, 'generated-files.json'); fs.writeFileSync(receiptPath, JSON.stringify({}));

    const result = buildSourceReviewLedger({ recordsDir: records, reviewPath, generatedFilesPath: receiptPath, adventureId: 'fixture' });

    assert.equal(result.exitCode, 0);
    assert.equal(result.ledger.records[0].file_owner, 'manual');
    assert.equal(result.ledger.records[0].generated_receipt_matches, null);
    assert.equal(result.ledger.records[0].source_review, 'source_derived_reviewed:source_derived_claim_checked');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
