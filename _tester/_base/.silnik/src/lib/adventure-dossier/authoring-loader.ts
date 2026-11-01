import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { JSON_SCHEMA, load as parseYaml } from 'js-yaml';
import {
  isIndexableDossierRecord,
  validateDossierRagPayload,
  type DossierRagPayload,
} from './rag-schema';

interface DossierAuthoringManifest {
  schema_version: 1;
  dossier_id: string;
  adventure_id: string;
  edition_id: string;
  edition_fingerprint: string;
  language: string;
  source_ref: string;
  approval: 'approved' | 'pending';
  approved_by?: string | null;
  approved_at?: string | null;
  records_directory: string;
}

export interface DossierAuthoringLoadResult {
  ok: boolean;
  releaseReady: boolean;
  recordCount?: number;
  dossier?: DossierAuthoringManifest;
  /** Present only when the dossier manifest and every record are approved. */
  payload?: DossierRagPayload;
  errors: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseYamlObject(source: string, filePath: string): Record<string, unknown> {
  const parsed: unknown = parseYaml(source, { schema: JSON_SCHEMA });
  if (!isObject(parsed)) throw new Error(`${filePath}: expected a YAML object`);
  return parsed;
}

function validateManifest(value: Record<string, unknown>, errors: string[]): boolean {
  const allowedKeys = [
    'schema_version',
    'dossier_id',
    'adventure_id',
    'edition_id',
    'edition_fingerprint',
    'language',
    'source_ref',
    'approval',
    'approved_by',
    'approved_at',
    'records_directory',
  ];
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) errors.push(`dossier.yaml: unknown field "${key}"`);
  }
  if (value.schema_version !== 1) errors.push('dossier.yaml: schema_version must be 1');
  for (const key of ['dossier_id', 'adventure_id', 'edition_id', 'edition_fingerprint', 'language', 'source_ref', 'records_directory']) {
    if (!isNonEmptyString(value[key])) errors.push(`dossier.yaml: ${key} is required`);
  }
  if (value.approval !== 'approved' && value.approval !== 'pending') {
    errors.push('dossier.yaml: approval must be approved or pending');
  }
  if (
    value.approval === 'approved' &&
    (!isNonEmptyString(value.approved_by) ||
      !isNonEmptyString(value.approved_at) ||
      !Number.isFinite(Date.parse(value.approved_at)))
  ) {
    errors.push('dossier.yaml: approved manifest needs a valid approver and timestamp');
  }
  return errors.length === 0;
}

/** Loads and validates authored YAML records. This never writes a plaintext release file. */
export async function loadDossierAuthoringDirectory(
  directory: string,
  expectedFingerprint: string,
): Promise<DossierAuthoringLoadResult> {
  const errors: string[] = [];
  const absoluteDirectory = path.resolve(directory);
  if (!isNonEmptyString(expectedFingerprint)) {
    return { ok: false, releaseReady: false, errors: ['recognized PDF fingerprint is required'] };
  }

  let manifest: DossierAuthoringManifest;
  try {
    const manifestPath = path.join(absoluteDirectory, 'dossier.yaml');
    const manifestStat = await lstat(manifestPath);
    if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) {
      return { ok: false, releaseReady: false, errors: ['dossier.yaml must be a regular file'] };
    }
    const parsedManifest = parseYamlObject(await readFile(manifestPath, 'utf8'), manifestPath);
    if (!validateManifest(parsedManifest, errors)) {
      return { ok: false, releaseReady: false, errors };
    }
    manifest = parsedManifest as unknown as DossierAuthoringManifest;
  } catch (error) {
    return {
      ok: false,
      releaseReady: false,
      errors: [error instanceof Error ? error.message : 'Unable to read dossier.yaml'],
    };
  }

  if (expectedFingerprint !== manifest.edition_fingerprint) {
    errors.push('dossier.yaml: fingerprint does not match the recognized PDF');
  }

  if (manifest.records_directory !== 'records') {
    return { ok: false, releaseReady: false, errors: ['records_directory must be "records"'] };
  }
  const recordsPath = path.join(absoluteDirectory, 'records');

  const records: unknown[] = [];
  try {
    const directoryStat = await lstat(recordsPath);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
      return { ok: false, releaseReady: false, errors: ['records_directory must be a regular directory'] };
    }
    const names = (await readdir(recordsPath)).sort();
    if (names.length === 0) errors.push('records_directory contains no YAML records');
    for (const name of names) {
      const recordPath = path.join(recordsPath, name);
      const fileStat = await lstat(recordPath);
      if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
        errors.push(`${name}: record must be a regular file`);
        continue;
      }
      if (!name.endsWith('.yaml')) {
        errors.push(`${name}: only .yaml record files are allowed`);
        continue;
      }
      try {
        records.push(parseYamlObject(await readFile(recordPath, 'utf8'), name));
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `${name}: invalid YAML`);
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unable to read dossier records');
  }

  if (errors.length > 0) return { ok: false, releaseReady: false, dossier: manifest, errors };

  const validation = validateDossierRagPayload({
    schema_version: 1,
    adventure_id: manifest.adventure_id,
    edition_fingerprint: manifest.edition_fingerprint,
    records,
  });
  if (!validation.ok || !validation.payload) {
    return { ok: false, releaseReady: false, dossier: manifest, errors: validation.errors };
  }

  const unapproved = validation.payload.records
    .filter((record) => !isIndexableDossierRecord(record))
    .map((record) => record.record_id);
  const releaseReady = manifest.approval === 'approved' && unapproved.length === 0;
  return {
    ok: true,
    releaseReady,
    recordCount: validation.payload.records.length,
    dossier: manifest,
    ...(releaseReady ? { payload: validation.payload } : {}),
    errors: releaseReady ? [] : [
      ...(manifest.approval !== 'approved' ? ['dossier manifest is pending approval'] : []),
      ...(unapproved.length > 0 ? [`records are not approved/indexable: ${unapproved.join(', ')}`] : []),
    ],
  };
}
