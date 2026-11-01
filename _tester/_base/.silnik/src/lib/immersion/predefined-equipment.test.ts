import { buildPredefinedEquipment } from './predefined-equipment';
import { getStrefa11CharactersForAdventure } from './strefa-11-characters';
import type { EquipmentItem } from '@/lib/types';

const tomasz = getStrefa11CharactersForAdventure('cien-nad-prabutami').find(
  (character) => character.id === 'strefa11_tomasz_nowicki'
)!;

describe('starting kit light coverage', () => {
  it('keeps Tomasz’s personal flashlight without adding a second default one', () => {
    const equipment = buildPredefinedEquipment(tomasz, 'prl-1970s');
    const lights = equipment.filter((item) => /latark/i.test(item.name));

    expect(lights).toHaveLength(1);
    expect(lights[0]).toMatchObject({
      id: 'eq_tom_latarka',
      name: 'Mocna latarka policyjna',
      imageUrl: '/equipment/catalog/police-flashlight-prl.webp',
      source: 'starting',
    });
    expect(equipment).toHaveLength(5);
  });

  it('still supplies a default flashlight when the personal kit has none', () => {
    const equipment = buildPredefinedEquipment({ ...tomasz, equipment: [] }, 'prl-1970s');

    expect(equipment.filter((item) => /latark/i.test(item.name))).toEqual([
      expect.objectContaining({ name: 'Latarka elektryczna', source: 'starting' }),
    ]);
  });

  it('preserves two explicitly owned lights and their individual state', () => {
    const personalLights: EquipmentItem[] = [
      { id: 'personal-1', name: 'Mocna latarka policyjna', category: 'tool', condition: 'damaged' },
      { id: 'personal-2', name: 'Latarka milicyjna', category: 'tool', condition: 'new' },
    ];
    const equipment = buildPredefinedEquipment({ ...tomasz, equipment: personalLights }, 'prl-1970s');

    expect(equipment.filter((item) => /latark/i.test(item.name))).toEqual([
      expect.objectContaining(personalLights[0]),
      expect.objectContaining(personalLights[1]),
    ]);
  });

  it('preserves an additional acquired light instead of merging inventory instances', () => {
    const equipment = buildPredefinedEquipment({
      ...tomasz,
      equipment: [
        ...tomasz.equipment!,
        { id: 'found-flashlight', name: 'Latarka elektryczna', category: 'tool', source: 'acquired' },
      ],
    }, 'prl-1970s');

    expect(equipment.filter((item) => /latark/i.test(item.name))).toHaveLength(2);
    expect(equipment.find((item) => item.id === 'found-flashlight')?.source).toBe('acquired');
  });

  it('is idempotent and leaves the input equipment unchanged', () => {
    const before = JSON.stringify(tomasz.equipment);
    const equipment = buildPredefinedEquipment(tomasz, 'prl-1970s');

    expect(buildPredefinedEquipment({ ...tomasz, equipment }, 'prl-1970s')).toEqual(equipment);
    expect(JSON.stringify(tomasz.equipment)).toBe(before);
  });
});
