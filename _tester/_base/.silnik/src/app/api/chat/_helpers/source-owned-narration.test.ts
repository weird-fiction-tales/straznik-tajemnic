import { filterSourceOwnedInventoryNarration } from './source-owned-narration';
const names=['Tomasz Nowicki','Dr Barbara Zawadzka'];
const options={locale:'pl' as const,isDuet:true};
test.each([
 'Tomasz Nowicki bierze fotografię i chowa ją do torby.',
 'Tomasz Nowicki sięga po leżącą na biurku odbitkę.',
 'Tomasz Nowicki chowa fotografię do torby Barbary.',
 'Tomasz Nowicki wyciąga rewolwer.',
])('removes narrator inventory motions before source code publishes its actual result: %s',text=>{
 const result=filterSourceOwnedInventoryNarration(text+' [LOKACJA: loc-warszawa-redakcja] [AKTUALNY CZAS: 18 Października 1973, 19:30]',names,options,true);
 expect(result.lint.hasViolation).toBe(false);
 expect(result.text).not.toMatch(/chowa|sięga|wyciąga|rewolwer/);
 expect(result.text).toContain('[LOKACJA: loc-warszawa-redakcja]');
});
test('keeps strict legacy protection and rejects undeclared movement even for a source edition',()=>{
 expect(filterSourceOwnedInventoryNarration('Tomasz Nowicki wyciąga rewolwer.',names,options,false).lint.hasViolation).toBe(true);
 expect(filterSourceOwnedInventoryNarration('Tomasz Nowicki wsiada do samochodu.',names,options,true).lint.hasViolation).toBe(true);
});
