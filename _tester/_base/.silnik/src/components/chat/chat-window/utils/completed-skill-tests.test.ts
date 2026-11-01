import { completedSkillTestsFromHistory } from './completed-skill-tests';
import type { Message } from '@/lib/types';
import type { SkillRollResolution,SkillTestData } from '@/lib/parsers/types';
const scope={playthroughId:'run-a',adventureId:'prabuty'};
const test:SkillTestData={id:'test-a',characterId:'pc',skillName:'Psychologia',skillValue:60,difficulty:'zwykly',modifiers:[],justification:'Intencje'};
const roll:SkillRollResolution={testId:test.id,resolutionId:'roll-17',characterId:'pc',skillNames:['Psychologia'],requiredDifficulty:'regular',passedRequirement:true,outcome:'hard',luckSpent:0};
const prompt:Message={id:'prompt',role:'assistant',content:'Test',timestamp:new Date(0),skillTests:[test]};
const result=(r:SkillRollResolution=roll,bound:typeof scope|undefined=scope):Message=>({id:'result',role:'user',content:'17',timestamp:new Date(0),mechanicsContext:{skillRolls:[r],...(bound?{skillRollScope:bound}:{})}});
testCase('uses exact typed IDs from this loaded history and never a prose result or skill name',()=>{
 expect([...completedSkillTestsFromHistory([prompt,result()],scope)]).toEqual([test.id]);
 expect(completedSkillTestsFromHistory([prompt,{...result(),mechanicsContext:undefined}],scope).size).toBe(0);
 expect(completedSkillTestsFromHistory([prompt,result({outcome:'hard',luckSpent:0,skillNames:['Psychologia']})],scope).size).toBe(0);
 expect(completedSkillTestsFromHistory([prompt,{...result(),role:'assistant'}],scope).size).toBe(0);
});
testCase('rejects different playthrough, adventure, character, test and pending or mismatched outcomes',()=>{
 for(const other of [{...scope,playthroughId:'run-b'},{...scope,adventureId:'englewood'}])expect(completedSkillTestsFromHistory([prompt,result()],other).size).toBe(0);
 for(const changed of [{characterId:'other'},{testId:'other'},{passedRequirement:false},{requiredDifficulty:'hard' as const},{resolutionId:undefined}])expect(completedSkillTestsFromHistory([prompt,result({...roll,...changed})],scope).size).toBe(0);
});
testCase('failure is completed too and a new test of the same skill remains available',()=>{
 const next={...prompt,id:'next',skillTests:[{...test,id:'test-b'}]};
 expect([...completedSkillTestsFromHistory([prompt,result({...roll,outcome:'fail',passedRequirement:false}),next],scope)]).toEqual([test.id]);
});
testCase('reads older typed unscoped results without mutating or migrating history',()=>{
 const old=result();delete old.mechanicsContext!.skillRollScope;
 const messages=[prompt,old],before=JSON.stringify(messages);
 expect(completedSkillTestsFromHistory(messages,scope).has(test.id)).toBe(true);
 expect(JSON.stringify(messages)).toBe(before);
 expect(completedSkillTestsFromHistory([prompt],scope).size).toBe(0);
});
// Avoid shadowing Jest's test with the source test fixture.
function testCase(name:string,run:()=>void){it(name,run);}
