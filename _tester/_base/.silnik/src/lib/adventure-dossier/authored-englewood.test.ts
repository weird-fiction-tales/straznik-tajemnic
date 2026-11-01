import { createAuthoredEnglewoodPayload } from './authored-englewood';
import { validateDossierRagPayload } from './rag-schema';
import { getAdventureById } from '../adventures-data';
const id = 'englewood-murder-castle-1893';
const fingerprint = 'sha256:' + 'e'.repeat(64);
test('English showcase has all source situations, actors and clues, with canon available in every scene', () => {
  const source = getAdventureById(id)!;
  const before = JSON.stringify(source);
  const payload = createAuthoredEnglewoodPayload(fingerprint);
  expect(validateDossierRagPayload(payload)).toMatchObject({ ok: true });
  expect(payload.adventure_id).toBe(id);
  expect(payload.records.filter(r => r.record_type === 'scene')).toHaveLength(5);
  expect(payload.records.filter(r => r.record_type === 'clue')).toHaveLength(12);
  expect(payload.records.filter(r => r.actor_binding)).toHaveLength(6);
  expect(payload.records.filter(r => r.inventory_item)).toHaveLength(4);
  expect(payload.records.every(r => r.language === 'en' && r.evidence.approval === 'pending')).toBe(true);
  const canon = payload.records.find(r => r.record_id === 'englewood.canon')!;
  expect(canon.retrieval.availability).toBe('always');
  expect(canon.content).toContain(source.truthAnchor!.culprit);
  for (const node of payload.records.filter(r => r.record_type === 'scene')) {
    const card = JSON.parse(node.content);
    expect(card.situation).toBeTruthy();
    expect(card.leads).toBeInstanceOf(Array);
    expect(card.improvisation).toContain('canon');
  }
  expect(JSON.stringify(source)).toBe(before);
});
test('English deadline matches the source date rather than silently moving the climax into December', () => {
  const source = getAdventureById(id)!;
  expect(source.startDate).toBe('1894-11-19T18:30');
  expect(source.doomClock).toMatchObject({ deadline: { year: 1894, month: 10, day: 20, hour: 2, minute: 0 }, totalHours: 7.5 });
});
