import type { Character, HotSeatPlayer } from '@/lib/types';
import type { SkillTestData } from '@/lib/parsers/types';
import {
  composeTurnFromDeclarations,
  isTurnReady,
  resolveSkillTestValues,
} from './useChat';

const players: HotSeatPlayer[] = [
  {
    id: 'p1',
    name: 'Aga',
    characterId: 'margaret',
    color: '#fff',
    isActive: true,
    turnCount: 0,
  },
  {
    id: 'p2',
    name: 'Phantom',
    characterId: 'dyer',
    color: '#000',
    isActive: false,
    turnCount: 0,
  },
];

const makeCharacter = (
  id: string,
  name: string,
  skillValue: number
): Character =>
  ({
    id,
    name,
    skills: { Spostrzegawczość: skillValue },
  }) as unknown as Character;

describe('duet turn helpers', () => {
  const declarations = [
    {
      playerId: 'p1',
      playerName: 'Aga',
      characterName: 'Margaret Sullivan',
      text: 'Nasłuchuję',
    },
    {
      playerId: 'p2',
      playerName: 'Phantom',
      characterName: 'Prof. William Dyer',
      text: 'Rozglądam się',
    },
  ];

  it('nie pozwala wysłać niepełnej tury', () => {
    expect(isTurnReady(declarations.slice(0, 1), players)).toBe(false);
    expect(isTurnReady(declarations, players)).toBe(true);
  });

  it('składa obie podpisane deklaracje w jedną wiadomość', () => {
    expect(composeTurnFromDeclarations(declarations)).toContain(
      'Aga (@Margaret Sullivan): Nasłuchuję'
    );
    expect(composeTurnFromDeclarations(declarations)).toContain(
      'Phantom (@Prof. William Dyer): Rozglądam się'
    );
  });
});

describe('resolveSkillTestValues - duet', () => {
  it('pobiera wartość umiejętności z karty adresata', () => {
    const margaret = makeCharacter('margaret', 'Margaret Sullivan', 60);
    const dyer = makeCharacter('dyer', 'Prof. William Dyer', 45);
    const tests: SkillTestData[] = [
      {
        id: 't1',
        skillName: 'Spostrzegawczość',
        skillValue: 0,
        difficulty: 'zwykly',
        modifiers: [],
        justification: 'Test Margaret',
        characterName: 'Margaret Sullivan',
      },
      {
        id: 't2',
        skillName: 'Spostrzegawczość',
        skillValue: 0,
        difficulty: 'zwykly',
        modifiers: [],
        justification: 'Test Dyera',
        characterName: 'Prof. William Dyer',
      },
    ];

    const resolved = resolveSkillTestValues(tests, margaret, [margaret, dyer]);

    expect(resolved[0]).toMatchObject({
      characterId: 'margaret',
      skillValue: 60,
    });
    expect(resolved[1]).toMatchObject({
      characterId: 'dyer',
      skillValue: 45,
    });
  });
});


test('preserves the planned actor ID and value when the other investigator is selected',()=>{
 const tomasz=makeCharacter('tomasz','Tomasz Nowicki',70);
 const barbara=makeCharacter('barbara','Dr Barbara Zawadzka',55);
 const planned={id:'photo',characterId:barbara.id,skillName:'Spostrzegawczość',skillValue:0,difficulty:'zwykly',modifiers:[],justification:'Fotografia'} as SkillTestData;
 expect(resolveSkillTestValues([planned],tomasz,[tomasz,barbara])[0]).toMatchObject({characterId:barbara.id,characterName:barbara.name,skillValue:55});
});
