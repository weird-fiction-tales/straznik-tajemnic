import {resolveTestValue} from './skill-test-resolver';
import {PREDEFINED_CHARACTERS} from './immersion/predefined-characters';
test('English physical action uses the actual investigator characteristic',()=>{
 const character={...PREDEFINED_CHARACTERS[0],str:65,dex:60,con:70,int:75,pow:75,edu:70,siz:65,app:55};
 expect(resolveTestValue('Strength',character)).toBe(65);
 expect(resolveTestValue('Dexterity',character)).toBe(60);
 expect(resolveTestValue('Constitution',character)).toBe(70);
});
