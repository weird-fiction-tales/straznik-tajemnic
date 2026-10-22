#!/usr/bin/env node
/** Bind a private source-review crosswalk to the exact current generated cards. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const runtime = path.join(root, '_tester/_base/.silnik');
const require = createRequire(path.join(runtime, 'package.json'));
const yaml = require('js-yaml');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

export function buildSourceReviewLedger({ recordsDir, reviewPath, generatedFilesPath, adventureId, createdAt = new Date().toISOString() }) {
  const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
  const receipt = JSON.parse(fs.readFileSync(generatedFilesPath, 'utf8'));
  const entries = Array.isArray(review.records) ? review.records : [];
  const byId = new Map();
  const errors = [];
  for (const entry of entries) {
    if (!entry || typeof entry.record_id !== 'string' || !entry.record_id ||
      typeof entry.classification !== 'string' || !entry.classification ||
      typeof entry.review_report !== 'string' || !entry.review_report) {
      errors.push('invalid_review_entry');
      continue;
    }
    if (byId.has(entry.record_id)) errors.push(`duplicate_review:${entry.record_id}`);
    else byId.set(entry.record_id, entry);
  }

  const records = [];
  const found = new Set();
  for (const filename of fs.readdirSync(recordsDir).filter(name => name.endsWith('.yaml')).sort()) {
    const file = path.join(recordsDir, filename);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      errors.push(`invalid_record_file:${filename}`);
      continue;
    }
    const bytes = fs.readFileSync(file);
    let record;
    try { record = yaml.load(bytes.toString('utf8'), { schema: yaml.JSON_SCHEMA }); }
    catch { errors.push(`invalid_yaml:${filename}`); continue; }
    const expectedHash = receipt[filename];
    if (!record || typeof record.record_id !== 'string' || (typeof expectedHash === 'string' && filename !== `${record.record_id}.yaml`)) {
      errors.push(`record_id_filename_mismatch:${filename}`);
      continue;
    }
    if (adventureId && record.adventure_id !== adventureId) errors.push(`wrong_adventure:${record.record_id}`);
    const reviewEntry = byId.get(record.record_id);
    if (!reviewEntry) errors.push(`missing_review:${record.record_id}`);
    else found.add(record.record_id);
    const actualHash = sha(bytes);
    const receiptMatches = typeof expectedHash === 'string' && expectedHash === actualHash;
    const content = typeof record.content === 'string' ? record.content : '';
    const sourceRef = typeof record.evidence?.source_ref === 'string' ? record.evidence.source_ref : '';
    const fileOwner = typeof expectedHash === 'string' ? 'generated' : 'manual';
    if (fileOwner === 'generated' && !receiptMatches) errors.push(`generated_hash_mismatch:${record.record_id}`);
    records.push({
      record_id: record.record_id,
      record_type: typeof record.record_type === 'string' ? record.record_type : 'unknown',
      file: filename,
      file_owner: fileOwner,
      record_sha256: actualHash,
      content_sha256: sha(content),
      source_ref_sha256: sha(sourceRef),
      source_review: reviewEntry?.classification ?? null,
      review_report: reviewEntry?.review_report ?? null,
      generated_receipt_matches: fileOwner === 'generated' ? receiptMatches : null,
    });
  }
  for (const id of byId.keys()) if (!found.has(id)) errors.push(`review_without_current_record:${id}`);
  if (Number.isInteger(review.reviewed_records) && review.reviewed_records !== byId.size) errors.push('review_count_mismatch');
  if (review.source_prose_stored === true) errors.push('source_prose_must_not_be_stored');
  errors.sort();
  return {
    exitCode: errors.length ? 1 : 0,
    ledger: {
      schema_version: 1,
      created_at: createdAt,
      adventure_id: adventureId ?? null,
      source_prose_stored: false,
      source_reviewed_records: records.length,
      matched_review_records: records.filter(record => record.source_review !== null).length,
      generated_receipt_matches: records.filter(record => record.generated_receipt_matches).length,
      manual_records: records.filter(record => record.file_owner === 'manual').length,
      records,
      errors,
    },
  };
}

function run(argv) {
  const directory = path.resolve(argv[0] || '');
  const reviewPath = path.resolve(argv[1] || '');
  const outIndex = argv.indexOf('--out');
  const outputPath = outIndex >= 0 ? path.resolve(argv[outIndex + 1] || '') : '';
  if (!argv[0] || !argv[1] || !outputPath || !fs.existsSync(directory) || !fs.existsSync(reviewPath)) {
    throw new Error('Usage: source-review-ledger.mjs <dossier-directory> <review.json> --out <private-report.json>');
  }
  const manifest = yaml.load(fs.readFileSync(path.join(directory, 'dossier.yaml'), 'utf8'), { schema: yaml.JSON_SCHEMA });
  let ancestor = outputPath;
  const missing = [];
  while (!fs.existsSync(ancestor)) { missing.unshift(path.basename(ancestor)); ancestor = path.dirname(ancestor); }
  const resolvedOut = path.join(fs.realpathSync(ancestor), ...missing);
  if (resolvedOut === fs.realpathSync(directory) || resolvedOut.startsWith(fs.realpathSync(directory) + path.sep) || resolvedOut.split(path.sep).includes('public')) {
    throw new Error('Source-review reports must be private and outside the dossier/public tree');
  }
  const result = buildSourceReviewLedger({
    recordsDir: path.join(directory, 'records'),
    reviewPath,
    generatedFilesPath: path.join(directory, 'preparation/generated-files.json'),
    adventureId: manifest?.adventure_id,
  });
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true, mode: 0o700 });
  fs.writeFileSync(resolvedOut, JSON.stringify(result.ledger, null, 2) + '\n', { mode: 0o600 });
  fs.chmodSync(resolvedOut, 0o600);
  console.log(JSON.stringify({ report: resolvedOut, records: result.ledger.source_reviewed_records, matched: result.ledger.matched_review_records, hashesMatched: result.ledger.generated_receipt_matches, errors: result.ledger.errors.length, exitCode: result.exitCode }));
  return result.exitCode;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { process.exitCode = run(process.argv.slice(2)); }
  catch (error) { console.error('SOURCE_REVIEW_LEDGER_FAILURE: ' + error.message); process.exitCode = 2; }
}
