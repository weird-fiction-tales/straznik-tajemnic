import { authoredScenarioSource } from './authored-scenarios';
import type { DossierRagPayload, DossierRagRecord, DossierRecordType, DossierWorldObjectBinding } from './rag-schema';

export const ENGLEWOOD_AUTHORING_VERSION = 'englewood-situations-v1';
export const ENGLEWOOD_WORLD_IDS = { keystone: 'obj-englewood-keystone', ending: 'obj-englewood-ending' } as const;
const actorIntent: Record<string, { goal: string; fear: string }> = {
  'npc-inspector-shea': { goal: 'Resolve the disappearances while keeping his investigation alive under political pressure.', fear: 'City Hall exposing or suppressing his earlier decisions.' },
  'npc-horace-gary': { goal: 'Secure reliable evidence of the insurance fraud and the missing children.', fear: 'Evidence being destroyed before it can be documented.' },
  'npc-charles-chappell': { goal: 'Avoid being made responsible for Holmes’s crimes; decide whether to cooperate.', fear: 'Prosecution and what he saw in the skulls.' },
  'npc-pat-quinlan': { goal: 'Silence the voices by carrying out his plan to burn the building.', fear: 'The voices and the consequences of Holmes’s work.' },
  'npc-emeline-echo': { goal: 'Direct attention toward the chute and the letters.', fear: 'Remaining trapped in the vault’s geometry.' },
  'npc-threshold-manifestation': { goal: 'Maintain its source-defined anchor in the kiln.', fear: 'The engraved keystone being destroyed.' },
};

/** Source situations plus a small, explicitly authored operational layer. No release approval is fabricated. */
export function createAuthoredEnglewoodPayload(editionFingerprint: string): DossierRagPayload {
  if (!/^sha256:[a-f0-9]{64}$/.test(editionFingerprint)) throw new Error('Exact edition fingerprint required');
  const adventure = authoredScenarioSource('englewood-murder-castle-1893');
  if (!adventure?.graph?.nodes?.length) throw new Error('English source graph required');
  const graph = adventure.graph, nodes = graph.nodes!, records: DossierRagRecord[] = [];
  const scenes = (id: string) => {
    const node = nodes.find(n => n.id === id);
    const location = graph.locations.find(l => l.id === node?.locationId);
    return [...new Set([id, node?.locationId, location?.name].filter((v): v is string => Boolean(v)))];
  };
  const add = (id: string, type: DossierRecordType, content: unknown, tags: { scenes?: string[]; entities?: string[]; always?: boolean; links?: string[] } = {}) => {
    const record: DossierRagRecord = {
      schema_version: 1, record_id: 'englewood.' + id, record_type: type, adventure_id: adventure.id,
      edition_fingerprint: editionFingerprint, language: 'en', content: JSON.stringify(content),
      tags: { scenes: tags.scenes ?? [], entities: tags.entities ?? [], mechanics: [], topics: [ENGLEWOOD_AUTHORING_VERSION], triggers: [] },
      retrieval: { visibility: 'gm_only', availability: tags.always ? 'always' : tags.scenes?.length ? 'when_scene_active' : 'when_entity_present', condition: null, priority: 3 },
      evidence: { provenance: 'source_derived', source_ref: 'runtime:american-cold-cases-data/' + adventure.id + '; authored:' + ENGLEWOOD_AUTHORING_VERSION,
        status: 'set', approval: 'pending', approved_by: null, approved_at: null }, links: tags.links ?? [],
    };
    records.push(record); return record;
  };
  for (const node of nodes) {
    const localClues = graph.clues.filter(c => c.sourceNodeId === node.id);
    add('scene.' + node.id, 'scene', {
      title: node.name, situation: node.description, atmosphere: node.atmosphere, keeperSecret: node.secret,
      actors: node.npcIds ?? [], leads: localClues.map(c => ({ id: c.id, fact: c.description, destination: c.targetNodeId })),
      improvisation: 'Accept plausible player approaches. Improvise dialogue, minor people and places consistently with canon, period and confirmed campaign memory; retain new recurring facts. Never move a canonical clue or change its contents to agree with a false theory.',
      adjudication: 'Use the existing d100 resolver for uncertain risky actions. Ordinary reading or a credible approach to an obvious lead need not require a roll. A failed roll does not become a success. Keep other source routes available.',
    }, { scenes: scenes(node.id), links: localClues.map(c => 'englewood.clue.' + c.id) });
  }
  for (const clue of graph.clues) add('clue.' + clue.id, 'clue', {
    title: clue.name, fact: clue.description, destination: clue.targetNodeId, relevantSkill: clue.requiredSkill,
    access: 'Use the source location and a credible player action. Do not require one prescribed conversational phrase. Test uncertainty or risk with the existing rules, not the ability to read an already visible word.',
  }, { scenes: scenes(clue.sourceNodeId!), links: ['englewood.scene.' + clue.targetNodeId] });
  for (const actor of graph.npcs) {
    const node = nodes.find(n => n.npcIds?.includes(actor.id));
    if (!node?.locationId) throw new Error('Source actor location required: ' + actor.id);
    const location = graph.locations.find(l => l.id === node.locationId)!;
    const record = add('actor.' + actor.id, 'actor', {
      name: actor.name, description: actor.description, knowledge: actor.secret,
      authoredPortrayal: actorIntent[actor.id],
      agency: 'Roleplay from this knowledge and these motives. Other NPCs cannot hear this conversation remotely. Frank Geyer is the player investigator, never a second NPC. Do not invent numeric bonuses or rule exceptions.',
    }, { entities: [actor.id] });
    record.actor_binding = { entity_id: actor.id, name: actor.name, initial_state: { status: 'alive', location_id: location.id, location_name: location.name,
      effects: [], source_ref: record.evidence.source_ref }, transitions: [] };
  }
  for (const handout of adventure.handouts ?? []) {
    const node = nodes.find(n => n.id === handout.nodeId);
    if (!node?.locationId) throw new Error('Source handout location required');
    const item = add('item.' + handout.slug, 'fact', {
      title: handout.title, sourceText: handout.textContent,
      lifecycle: 'Showing a document does not transfer ownership. Add only after explicit acquisition with real access; reading does not consume it.',
      addTag: '[EKWIPUNEK: DODAJ | @englewood.item.' + handout.slug + ']', dropTag: '[EKWIPUNEK: ODLOZ | @englewood.item.' + handout.slug + ']',
    }, { scenes: scenes(node.id), entities: ['obj-' + handout.slug] });
    item.inventory_item = { entity_id: 'obj-' + handout.slug, name: handout.title, category: handout.audioUrl ? 'story' : 'document', source_location: node.locationId, initial_state: { condition: 'used' } };
    add('media.' + handout.slug, 'media', {
      ...handout, reveal: 'Show the exact source material only after real access, using [HANDOUT:englewood.media.' + handout.slug + '].',
      documentAuthority: { canonicalText: handout.textContent, representation: 'source-summary', literalTranscriptionAvailable: false },
    }, { scenes: scenes(node.id), links: [item.record_id] });
  }
  const objects: Array<{ key: string; binding: DossierWorldObjectBinding; description: string }> = [
    { key: 'keystone', binding: { entity_id: ENGLEWOOD_WORLD_IDS.keystone, initial_state: 'intact', states: ['intact', 'broken'],
      transitions: [{ id: 'break-keystone', from: 'intact', to: 'broken', condition_id: 'englewood-break-keystone',
        access_check: { id: 'englewood-break-keystone', skill_names: ['Strength', 'STR', 'Siła', 'Fighting (Brawl)', 'Brawl', 'Walka wręcz (Bijatyka)', 'Mechanical Repair', 'Naprawa mechaniczna'], difficulty: 'regular' } }] },
      description: 'The source identifies this physical anchor. Only propose [TECZKA_STANU: obj-englewood-keystone | break-keystone] after the investigator explicitly carries out a feasible destruction at the kiln. Operational adaptation: opposition at the source climax requires an ordinary physical-action roll before destruction is confirmed. Match the investigator’s chosen method to an existing skill (Strength, Fighting/Brawl or Mechanical Repair). Request [TEST: STR | regular | | Destroy the physical anchor under pressure | DOSSIER_ACCESS: englewood-break-keystone], replacing STR with the chosen existing skill. The local resolver supplies the result; never apply the state tag before a matching successful resolution.' },
    { key: 'ending', binding: { entity_id: ENGLEWOOD_WORLD_IDS.ending, initial_state: 'ongoing', states: ['ongoing', 'secured', 'lost', 'withdrawn'],
      transitions: [{ id: 'secure', from: 'ongoing', to: 'secured', requires: [{ entity_id: ENGLEWOOD_WORLD_IDS.keystone, state: 'broken' }] },
        { id: 'deadline', from: 'ongoing', to: 'lost' }, { id: 'withdraw', from: 'ongoing', to: 'withdrawn' }] },
      description: 'The application confirms the ending from accepted state: collapse the source anchor and secure the letters, or explicitly withdraw, or reach the source deadline with the threat uncontained. Narration or a session-end tag alone does not prove success.' },
  ];
  for (const object of objects) {
    const record = add('world.' + object.key, 'fact', { description: object.description, operationalDesign: 'Local operational adaptation of the source objective; not an additional historical fact.', binding: object.binding },
      { scenes: object.key === 'keystone' ? scenes('node-castle-basement-climax') : undefined, entities: [object.binding.entity_id], always: object.key === 'ending' });
    record.world_object_binding = object.binding;
  }
  add('clock', 'pacing', { startDate: adventure.startDate, doomClock: adventure.doomClock,
    procedure: 'The application owns elapsed time. Midnight is the source caretaker’s planned fire; 02:00 is the final deadline. Plans are not accomplished events if the player intervenes. Never move the deadline or advance time to force a scene.' }, { always: true });
  add('canon', 'director_note', { truthAnchor: adventure.truthAnchor,
    improvisation: 'Preserve source identities, evidence and mystery. New minor details must not solve the mystery by invention; keep them in accepted campaign memory. NPC knowledge is limited to their own perspective.' }, { always: true });
  return { schema_version: 1, adventure_id: adventure.id, edition_fingerprint: editionFingerprint, records };
}
