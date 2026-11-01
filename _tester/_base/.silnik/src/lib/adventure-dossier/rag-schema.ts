import { isReviewedDossierCheck, type DossierItemAccessCheck } from './reviewed-check';
export type { DossierItemAccessCheck } from './reviewed-check';
import { isDossierActorTransition, isDossierActorInitialState, type DossierActorInitialState, type DossierActorTransition } from './actor-transition';
import { isDossierMechanicId, type DossierMechanicId } from './mechanic-registry';

export const DOSSIER_RECORD_TYPES = [
  'fact',
  'actor',
  'location',
  'scene',
  'clue',
  'event',
  'mechanic_hook',
  'pacing',
  'media',
  'handout_locator',
  'director_note',
] as const;

export type DossierRecordType = (typeof DOSSIER_RECORD_TYPES)[number];
export type DossierProvenance =
  | 'source_confirmed'
  | 'source_derived'
  | 'approved_design'
  | 'asset_inventory';
export type DossierAvailability =
  | 'always'
  | 'when_entity_present'
  | 'when_scene_active'
  | 'after_reveal'
  | 'state_condition';

export type DossierConditionClause =
  | { kind: 'entity_present'; id: string }
  | { kind: 'target_entity'; id: string }
  | { kind: 'scene_active'; id: string }
  | { kind: 'reveal_acquired'; id: string }
  | { kind: 'mechanic_active'; id: DossierMechanicId };
export interface DossierCondition {
  all: DossierConditionClause[];
}

/** Extraction coordinates and pixel identity only; original image bytes never enter a pack or prompt. */
export interface DossierLocalHandout {
  kind: 'embedded_image';
  pdf_page: number;
  width: number;
  height: number;
  rgba_sha256: string;
  title: string;
  audience: 'party';
}

export function isDossierLocalHandout(value: unknown): value is DossierLocalHandout {
  if (!isObject(value)) return false;
  return Object.keys(value).every(k => ['kind', 'pdf_page', 'width', 'height', 'rgba_sha256', 'title', 'audience'].includes(k)) &&
    value.kind === 'embedded_image' && value.audience === 'party' &&
    typeof value.title === 'string' && value.title.length > 0 && value.title.length <= 200 &&
    typeof value.rgba_sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.rgba_sha256) &&
    [value.pdf_page, value.width, value.height].every(n => typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= 20000) &&
    (value.width as number) * (value.height as number) <= 16777216;
}



/** Explicit scenario-state contract for one non-portable object in the world. */
export interface DossierWorldObjectBinding {
  entity_id: string;
  initial_state: string;
  states: string[];
  transitions: Array<{
    id: string;
    from: string;
    to: string;
    /** If present, a successful local roll carrying this dossier condition is required. */
    condition_id?: string;
    access_check?: DossierItemAccessCheck;
    /** Cross-object state prerequisites prevent advancing a dependent track out of order. */
    requires?: Array<{ entity_id: string; state: string }>;
  }>;
  /** Individually persisted objects in a collection. Each instance owns its state machine. */
  instances?: Array<{
    entity_id: string;
    initial_state: string;
    states: string[];
    transitions: Array<{
      id: string;
      from: string;
      to: string;
      condition_id?: string;
      access_check?: DossierItemAccessCheck;
      requires?: Array<{ entity_id: string; state: string }>;
    }>;
  }>;
}

export interface DossierRagRecord {
  schema_version: 1;
  record_id: string;
  record_type: DossierRecordType;
  adventure_id: string;
  edition_fingerprint: string;
  language: string;
  content: string;
  tags: {
    entities: string[];
    scenes: string[];
    mechanics: DossierMechanicId[];
    topics: string[];
    triggers: string[];
  };
  retrieval: {
    visibility: 'gm_only' | 'player_projection';
    availability: DossierAvailability;
    condition: DossierCondition | null;
    priority: 0 | 1 | 2 | 3;
  };
  evidence: {
    provenance: DossierProvenance;
    source_ref: string;
    status: 'set' | 'unspecified' | 'pending_review';
    approval: 'approved' | 'pending';
    approved_by: string | null;
    approved_at: string | null;
  };
  links: string[];
  /** Direct context prerequisites, a subset of links. Ordinary relationships are not prerequisites. */
  context_links?: string[];
  local_handout?: DossierLocalHandout;
  /** Exact reviewed identity; never fuzzy matching against a source document. */
  actor_binding?: { entity_id: string; name: string; transitions?: DossierActorTransition[]; initial_state?: DossierActorInitialState };
  /** Authored identity of one portable object. Collections/stock need their own quantity model. */
  inventory_item?: { entity_id: string; name: string; category: 'story' | 'document' | 'weapon'; source_location: string;
    access_check?: DossierItemAccessCheck;
    initial_state?: { condition?: 'new' | 'used' | 'damaged' | 'broken' | 'working' | 'depleted'; is_jammed?: boolean } };
  world_object_binding?: DossierWorldObjectBinding;
}

export interface DossierRagPayload {
  schema_version: 1;
  adventure_id: string;
  edition_fingerprint: string;
  records: DossierRagRecord[];
}

export interface DossierValidationResult {
  ok: boolean;
  payload?: DossierRagPayload;
  errors: string[];
}

const RECORD_TYPE_SET = new Set<string>(DOSSIER_RECORD_TYPES);
const PROVENANCE_SET = new Set<string>([
  'source_confirmed',
  'source_derived',
  'approved_design',
  'asset_inventory',
]);
const AVAILABILITY_SET = new Set<string>([
  'always',
  'when_entity_present',
  'when_scene_active',
  'after_reveal',
  'state_condition',
]);
const ALLOWED_VISIBILITY = new Set(['gm_only', 'player_projection']);
const ALLOWED_STATUS = new Set(['set', 'unspecified', 'pending_review']);
const ALLOWED_APPROVAL = new Set(['approved', 'pending']);
const MAX_RECORD_CONTENT_CHARS = 4000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0)
  );
}

function isDossierCondition(value: unknown): value is DossierCondition {
  if (!isObject(value) || Object.keys(value).some((key) => key !== 'all')) return false;
  if (!Array.isArray(value.all) || value.all.length === 0) return false;
  return value.all.every((clause) => {
    if (!isObject(clause)) return false;
    if (clause.kind === 'entity_present' || clause.kind === 'target_entity' || clause.kind === 'scene_active' || clause.kind === 'reveal_acquired') {
      return Object.keys(clause).every((key) => key === 'kind' || key === 'id') && isNonEmptyString(clause.id);
    }
    if (clause.kind === 'mechanic_active') {
      return Object.keys(clause).every((key) => key === 'kind' || key === 'id') && isDossierMechanicId(clause.id);
    }
    return false;
  });
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  errors: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${path}: unknown field "${key}"`);
  }
}

function validateRecord(
  value: unknown,
  index: number,
  payloadAdventureId: string,
  payloadFingerprint: string,
  errors: string[],
): void {
  const path = `records[${index}]`;
  if (!isObject(value)) {
    errors.push(`${path}: expected object`);
    return;
  }

  hasOnlyKeys(
    value,
    [
      'schema_version',
      'record_id',
      'record_type',
      'adventure_id',
      'edition_fingerprint',
      'language',
      'content',
      'tags',
      'retrieval',
      'evidence',
      'links',
      'context_links',
      'local_handout',
      'actor_binding',
      'inventory_item',
      'world_object_binding',
    ],
    path,
    errors,
  );

  if (value.schema_version !== 1) errors.push(`${path}.schema_version: expected 1`);
  if (value.actor_binding !== undefined) {
    const actor = value.actor_binding;
    if (value.record_type !== 'actor' || !isObject(actor) ||
      Object.keys(actor).some(key => !['entity_id', 'name', 'transitions', 'initial_state'].includes(key)) ||
      !['entity_id', 'name'].every(key => typeof actor[key] === 'string' && (actor[key] as string).trim().length > 0 && (actor[key] as string).length <= 200) ||
      !isObject(value.tags) || !Array.isArray(value.tags.entities) ||
      value.tags.entities.length !== 1 || value.tags.entities[0] !== actor.entity_id) {
      errors.push(`${path}.actor_binding: expected one identified actor matching its entity tag`);
    }
    if (isObject(actor) && actor.initial_state !== undefined && !isDossierActorInitialState(actor.initial_state)) {
      errors.push(`${path}.actor_binding.initial_state: invalid opening state`);
    }
    if (isObject(actor) && actor.transitions !== undefined && (!Array.isArray(actor.transitions) || actor.transitions.length > 128 ||
      !actor.transitions.every(isDossierActorTransition) || new Set(actor.transitions.filter(isObject).map(t => t.id)).size !== actor.transitions.length)) {
      errors.push(`${path}.actor_binding.transitions: invalid or duplicate reviewed transitions`);
    }
  }
  if (value.local_handout !== undefined && (value.record_type !== 'handout_locator' || !isDossierLocalHandout(value.local_handout))) {
    errors.push(`${path}.local_handout: expected an exact player image locator`);
  }
  if (value.inventory_item !== undefined) {
    const item = value.inventory_item;
    if (value.record_type !== 'fact' || !isObject(item) ||
      Object.keys(item).some(key => !['entity_id', 'name', 'category', 'source_location', 'initial_state', 'access_check'].includes(key)) ||
      !['entity_id', 'name', 'source_location'].every(key => typeof item[key] === 'string' && (item[key] as string).trim().length > 0 && (item[key] as string).length <= 200) ||
      !['story', 'document', 'weapon'].includes(String(item.category))) {
      errors.push(`${path}.inventory_item: expected one identified portable item`);
    }
    if (isObject(item) && item.access_check !== undefined) {
      const check = item.access_check;
      if (!isReviewedDossierCheck(check)) {
        errors.push(`${path}.inventory_item.access_check: invalid reviewed check`);
      }
    }
    if (isObject(item) && item.initial_state !== undefined) {
      const state = item.initial_state;
      if (!isObject(state) || Object.keys(state).some(key => !['condition', 'is_jammed'].includes(key)) ||
        (state.condition !== undefined && !['new', 'used', 'damaged', 'broken', 'working', 'depleted'].includes(String(state.condition))) ||
        (state.is_jammed !== undefined && typeof state.is_jammed !== 'boolean')) {
        errors.push(`${path}.inventory_item.initial_state: invalid equipment state`);
      }
    }
  }
  if (value.world_object_binding !== undefined) {
    const binding = value.world_object_binding;
    const validId = (v: unknown) => typeof v === 'string' && /^[a-z0-9][a-z0-9._-]{0,119}$/.test(v);
    const tags = isObject(value.tags) && Array.isArray(value.tags.entities) ? value.tags.entities : [];
    const validStateMachine = (definition: unknown): boolean => {
      if (!isObject(definition)) return false;
      const states = Array.isArray(definition.states) ? definition.states : [];
      const transitions = Array.isArray(definition.transitions) ? definition.transitions : [];
      const stateSet = new Set(states);
      return validId(definition.entity_id) && validId(definition.initial_state) && states.length > 0 && states.length <= 32 &&
        states.every(s => validId(s)) && new Set(states).size === states.length && stateSet.has(definition.initial_state) &&
        transitions.length <= 128 && transitions.every(t => isObject(t) &&
          Object.keys(t).every(key => ['id', 'from', 'to', 'condition_id', 'access_check', 'requires'].includes(key)) && validId(t.id) &&
          validId(t.from) && validId(t.to) && t.from !== t.to && stateSet.has(t.from) && stateSet.has(t.to) &&
          (t.condition_id === undefined || validId(t.condition_id)) &&
          (t.access_check === undefined || (isReviewedDossierCheck(t.access_check) && t.condition_id === t.access_check.id)) &&
          (t.requires === undefined || (Array.isArray(t.requires) && t.requires.length <= 16 &&
            t.requires.every(requirement => isObject(requirement) && Object.keys(requirement).every(key => ['entity_id', 'state'].includes(key)) &&
              validId(requirement.entity_id) && validId(requirement.state))))) &&
        new Set(transitions.filter(isObject).map(t => t.id)).size === transitions.length;
    };
    const instances = isObject(binding) && Array.isArray(binding.instances) ? binding.instances : [];
    if (value.record_type !== 'fact' || !isObject(binding) ||
      Object.keys(binding).some(key => !['entity_id', 'initial_state', 'states', 'transitions', 'instances'].includes(key)) ||
      !validStateMachine(binding) || tags.length !== 1 || tags[0] !== binding.entity_id ||
      instances.length > 32 || (binding.instances !== undefined && (!Array.isArray(binding.instances) || instances.length === 0)) ||
      instances.some(instance => !validStateMachine(instance) || !isObject(instance) ||
        !String(instance.entity_id).startsWith(`${binding.entity_id}-`)) ||
      new Set(instances.filter(isObject).map(instance => instance.entity_id)).size !== instances.length) {
      errors.push(`${path}.world_object_binding: invalid object identity, states, or transitions`);
    }
  }
  if (!isNonEmptyString(value.record_id)) errors.push(`${path}.record_id: required`);
  if (!isNonEmptyString(value.record_type) || !RECORD_TYPE_SET.has(value.record_type)) {
    errors.push(`${path}.record_type: unsupported value`);
  }
  if (value.adventure_id !== payloadAdventureId) {
    errors.push(`${path}.adventure_id: does not match payload`);
  }
  if (value.edition_fingerprint !== payloadFingerprint) {
    errors.push(`${path}.edition_fingerprint: does not match payload`);
  }
  if (!isNonEmptyString(value.language)) errors.push(`${path}.language: required`);
  if (!isNonEmptyString(value.content)) {
    errors.push(`${path}.content: required`);
  } else if (value.content.length > MAX_RECORD_CONTENT_CHARS) {
    errors.push(`${path}.content: exceeds ${MAX_RECORD_CONTENT_CHARS} characters`);
  }
  if (value.context_links !== undefined && (!isStringArray(value.context_links) ||
    new Set(value.context_links).size !== value.context_links.length ||
    value.context_links.some(id => id === value.record_id || !Array.isArray(value.links) || !value.links.includes(id)))) {
    errors.push(`${path}.context_links: expected unique non-self subset of links`);
  }
  if (!Array.isArray(value.links) || !isStringArray(value.links)) {
    errors.push(`${path}.links: expected string array`);
  }

  if (!isObject(value.tags)) {
    errors.push(`${path}.tags: expected object`);
  } else {
    hasOnlyKeys(value.tags, ['entities', 'scenes', 'mechanics', 'topics', 'triggers'], `${path}.tags`, errors);
    for (const key of ['entities', 'scenes', 'mechanics', 'topics', 'triggers'] as const) {
      if (!isStringArray(value.tags[key])) {
        errors.push(`${path}.tags.${key}: expected string array`);
      } else if (key === 'mechanics' && value.tags[key].some((id) => !isDossierMechanicId(id))) {
        errors.push(`${path}.tags.mechanics: contains an unknown mechanic ID`);
      }
    }
  }

  if (!isObject(value.retrieval)) {
    errors.push(`${path}.retrieval: expected object`);
  } else {
    hasOnlyKeys(value.retrieval, ['visibility', 'availability', 'condition', 'priority'], `${path}.retrieval`, errors);
    if (!isNonEmptyString(value.retrieval.visibility) || !ALLOWED_VISIBILITY.has(value.retrieval.visibility)) {
      errors.push(`${path}.retrieval.visibility: unsupported value`);
    }
    if (!isNonEmptyString(value.retrieval.availability) || !AVAILABILITY_SET.has(value.retrieval.availability)) {
      errors.push(`${path}.retrieval.availability: unsupported value`);
    }
    if (
      value.retrieval.condition !== null &&
      !isDossierCondition(value.retrieval.condition)
    ) {
      errors.push(`${path}.retrieval.condition: unsupported condition structure`);
    }
    if (
      (value.retrieval.availability === 'state_condition' ||
        value.retrieval.availability === 'after_reveal') &&
      value.retrieval.condition === null
    ) {
      errors.push(`${path}.retrieval.condition: required for conditional availability`);
    }
    if (![0, 1, 2, 3].includes(value.retrieval.priority as number)) {
      errors.push(`${path}.retrieval.priority: expected integer 0..3`);
    }
  }

  if (!isObject(value.evidence)) {
    errors.push(`${path}.evidence: expected object`);
  } else {
    hasOnlyKeys(
      value.evidence,
      ['provenance', 'source_ref', 'status', 'approval', 'approved_by', 'approved_at'],
      `${path}.evidence`,
      errors,
    );
    if (!isNonEmptyString(value.evidence.provenance) || !PROVENANCE_SET.has(value.evidence.provenance)) {
      errors.push(`${path}.evidence.provenance: unsupported value`);
    }
    if (!isNonEmptyString(value.evidence.source_ref)) errors.push(`${path}.evidence.source_ref: required`);
    if (!isNonEmptyString(value.evidence.status) || !ALLOWED_STATUS.has(value.evidence.status)) {
      errors.push(`${path}.evidence.status: unsupported value`);
    }
    if (!isNonEmptyString(value.evidence.approval) || !ALLOWED_APPROVAL.has(value.evidence.approval)) {
      errors.push(`${path}.evidence.approval: unsupported value`);
    }
    if (value.evidence.approved_by !== null && !isNonEmptyString(value.evidence.approved_by)) {
      errors.push(`${path}.evidence.approved_by: expected string or null`);
    }
    if (value.evidence.approved_at !== null && !isNonEmptyString(value.evidence.approved_at)) {
      errors.push(`${path}.evidence.approved_at: expected string or null`);
    }
    if (
      value.evidence.provenance === 'source_confirmed' &&
      !isNonEmptyString(value.evidence.source_ref)
    ) {
      errors.push(`${path}.evidence.source_ref: source_confirmed needs a source locator`);
    }
    if (
      value.evidence.approval === 'approved' &&
      (!isNonEmptyString(value.evidence.approved_by) ||
        !isNonEmptyString(value.evidence.approved_at) ||
        !Number.isFinite(Date.parse(value.evidence.approved_at)))
    ) {
      errors.push(`${path}.evidence: approved record needs approver and timestamp`);
    }
  }

}

/**
 * Strictly validates the decrypted JSON payload before any record is indexed.
 * This accepts parsed data; YAML authoring files must be compiled by the packager.
 */
export function validateDossierRagPayload(value: unknown): DossierValidationResult {
  const errors: string[] = [];
  if (!isObject(value)) return { ok: false, errors: ['payload: expected object'] };

  hasOnlyKeys(
    value,
    ['schema_version', 'adventure_id', 'edition_fingerprint', 'records'],
    'payload',
    errors,
  );
  if (value.schema_version !== 1) errors.push('payload.schema_version: expected 1');
  if (!isNonEmptyString(value.adventure_id)) errors.push('payload.adventure_id: required');
  if (!isNonEmptyString(value.edition_fingerprint)) errors.push('payload.edition_fingerprint: required');
  if (!Array.isArray(value.records)) errors.push('payload.records: expected array');

  if (Array.isArray(value.records)) {
    const seenIds = new Set<string>();
    const accessChecks = new Map<string, string>();
    const actorAccessChecks = new Map<string, {signature:string;index:number}>();
    const worldStates = new Map<string, Set<string>>();
    const worldAccessChecks = new Map<string, number>();
    const worldTransitions: Array<{ recordIndex: number; entityId: string; transitionId: string; requirements: unknown }> = [];
    value.records.forEach((record, index) => {
      validateRecord(
        record,
        index,
        typeof value.adventure_id === 'string' ? value.adventure_id : '',
        typeof value.edition_fingerprint === 'string' ? value.edition_fingerprint : '',
        errors,
      );
      if (isObject(record) && isObject(record.inventory_item) && isObject(record.inventory_item.access_check)) {
        const item = record.inventory_item, check = item.access_check as Record<string, unknown>;
        if (typeof check.id === 'string') {
          const signature = JSON.stringify([item.source_location, check.skill_names, check.difficulty]);
          if (accessChecks.has(check.id) && accessChecks.get(check.id) !== signature) errors.push(`records[${index}]: conflicting access check`);
          accessChecks.set(check.id, signature);
        }
      }
      if (isObject(record) && isObject(record.actor_binding) && Array.isArray(record.actor_binding.transitions)) {
        const actor=record.actor_binding;
        for(const transition of actor.transitions as unknown[]) {
          if(!isObject(transition) || !isReviewedDossierCheck(transition.access_check)) continue;
          const check=transition.access_check;
          const signature=JSON.stringify([actor.entity_id,transition.source_location_id,check.skill_names,check.difficulty]);
          if(actorAccessChecks.has(check.id) && actorAccessChecks.get(check.id)!.signature!==signature) {
            errors.push(`records[${index}].actor_binding.transitions: conflicting actor access check "${check.id}"`);
          }
          actorAccessChecks.set(check.id,{signature,index});
        }
      }
      if (isObject(record) && isObject(record.world_object_binding)) {
        const binding = record.world_object_binding;
        const definitions = [binding, ...(Array.isArray(binding.instances) ? binding.instances : [])];
        for (const definition of definitions) {
          if (!isObject(definition) || typeof definition.entity_id !== 'string' || !Array.isArray(definition.states)) continue;
          if (worldStates.has(definition.entity_id)) errors.push(`records[${index}].world_object_binding: duplicate state identity "${definition.entity_id}"`);
          worldStates.set(definition.entity_id, new Set(definition.states.filter((state): state is string => typeof state === 'string')));
          if (Array.isArray(definition.transitions)) definition.transitions.forEach(transition => {
            if (isObject(transition) && isReviewedDossierCheck(transition.access_check)) {
              const checkId=transition.access_check.id;
              if(worldAccessChecks.has(checkId)) errors.push(`records[${index}].world_object_binding: ambiguous world access check "${checkId}"`);
              worldAccessChecks.set(checkId,index);
            }
            if (isObject(transition) && typeof transition.id === 'string' && transition.requires !== undefined) {
              worldTransitions.push({ recordIndex: index, entityId: definition.entity_id as string, transitionId: transition.id, requirements: transition.requires });
            }
          });
        }
      }
      if (isObject(record) && isNonEmptyString(record.record_id)) {
        if (seenIds.has(record.record_id)) errors.push(`records[${index}].record_id: duplicate`);
        seenIds.add(record.record_id);
      }
    });

    for(const [id,owner] of actorAccessChecks) {
      if(accessChecks.has(id)) errors.push(`records[${owner.index}].actor_binding.transitions: access check "${id}" is shared with inventory`);
    }

    for(const [id,index] of worldAccessChecks) {
      if(accessChecks.has(id)||actorAccessChecks.has(id)) errors.push(`records[${index}].world_object_binding: access check "${id}" is shared with another adapter`);
    }

    for (const transition of worldTransitions) {
      if (!Array.isArray(transition.requirements)) continue;
      for (const requirement of transition.requirements) {
        if (!isObject(requirement) || typeof requirement.entity_id !== 'string' || typeof requirement.state !== 'string') continue;
        const states = worldStates.get(requirement.entity_id);
        if (!states || !states.has(requirement.state)) {
          errors.push(`records[${transition.recordIndex}].world_object_binding: transition "${transition.entityId}/${transition.transitionId}" requires missing state "${requirement.entity_id}=${requirement.state}"`);
        }
      }
    }

    value.records.forEach((record, index) => {
      if (!isObject(record) || !Array.isArray(record.links)) return;
      record.links.forEach((linkedId) => {
        if (typeof linkedId === 'string' && !seenIds.has(linkedId)) {
          errors.push(`records[${index}].links: unknown record "${linkedId}"`);
        }
      });
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, payload: value as unknown as DossierRagPayload, errors: [] };
}

/** Only fully reviewed records may enter the dossier retrieval index. */
export function isIndexableDossierRecord(record: DossierRagRecord): boolean {
  return record.evidence.status === 'set' && record.evidence.approval === 'approved';
}
