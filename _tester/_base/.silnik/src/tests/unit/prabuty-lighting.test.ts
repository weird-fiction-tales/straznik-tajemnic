import {
  PRABUTY_SCENES,
  validateLightingScenes,
  resolveLightingScene,
} from '@/lib/hardware/hue/score';
import { normalizeAdventureGraph } from '@/lib/custom-adventures-storage';
import { getAdventureById } from '@/lib/adventures-data';
describe('Prabuty lighting score', () => {
  it('covers all five nodes and survives runtime normalization', () => {
    expect(PRABUTY_SCENES).toHaveLength(5);
    expect(validateLightingScenes(PRABUTY_SCENES)).toEqual([]);
    const graph = normalizeAdventureGraph(
      getAdventureById('cien-nad-prabutami')?.graph
    );
    expect(graph.nodes.flatMap((n) => n.scenes ?? [])).toEqual(PRABUTY_SCENES);
  });
  it('resolves stable IDs and PL EN aliases equally', () => {
    for (const s of PRABUTY_SCENES) {
      expect(resolveLightingScene(s.sceneId)?.sceneId).toBe(s.sceneId);
      expect(resolveLightingScene(s.name.en)?.sceneId).toBe(s.sceneId);
    }
    expect(resolveLightingScene('Unrelated town')).toBeUndefined();
  });
  it('reports unknown presets and missing instructions without silently repairing them', () => {
    expect(validateLightingScenes([{ sceneId: 'broken' }])).not.toEqual([]);
    expect(
      validateLightingScenes([
        {
          ...PRABUTY_SCENES[0],
          lighting: { ...PRABUTY_SCENES[0].lighting, presetId: 'missing' },
        },
      ])
    ).not.toEqual([]);
  });
});
