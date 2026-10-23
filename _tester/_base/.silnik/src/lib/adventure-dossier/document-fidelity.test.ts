import {unsupportedDocumentQuotes} from './document-fidelity';
const payload={records:[{record_type:'media' as const,content:JSON.stringify({documentAuthority:{canonicalText:'Fotografia ruin z 1947 roku. Adnotacja kieruje do klasztoru w Elblągu i dzienników wizji.',literalTranscriptionAvailable:false}})}]};
test('source summary cannot acquire invented quotations on the back of a photograph',()=>{
 expect(unsupportedDocumentQuotes('Na rewersie widnieje adnotacja: *„Dzienniki wizji z 1947 roku zabezpieczone przed wzrokiem ciekawskich. Prawda o szczelinie leży pod posadzką”*.',payload)).toEqual(['DOSSIER_DOCUMENT_QUOTE_UNSUPPORTED']);
 expect(unsupportedDocumentQuotes('The reverse of the photograph reads: "The secret tunnel opens at midnight."',payload)).toHaveLength(1);
});
test('ordinary source paraphrase and attributed NPC dialogue remain flexible',()=>{
 expect(unsupportedDocumentQuotes('Adnotacja kieruje do klasztoru w Elblągu i dzienników wizji.',payload)).toEqual([]);
 expect(unsupportedDocumentQuotes('Helena: „Nie chcę, żeby ta fotografia trafiła do cenzury.”',payload)).toEqual([]);
 expect(unsupportedDocumentQuotes('Inspector Shea: "I want the file safe before the press arrive."',payload)).toEqual([]);
});
test('literal source quotation needs an explicit transcript and exact words',()=>{
 const literal={records:[{record_type:'media' as const,content:JSON.stringify({documentAuthority:{canonicalText:'Dearest Mama, we may not go outside until Papa returns.',literalTranscriptionAvailable:true}})}]};
 expect(unsupportedDocumentQuotes('The letter reads: "Dearest Mama, we may not go outside until Papa returns."',literal)).toEqual([]);
 expect(unsupportedDocumentQuotes('The letter reads: "Meet the killer at midnight."',literal)).toHaveLength(1);
});

test('dialogue next to a prop remains free, but quoting a source inscription through an NPC does not bypass authority',()=>{
 expect(unsupportedDocumentQuotes('Helena odkłada fotografię. „Nie oddam jej bez gwarancji bezpieczeństwa.”',payload)).toEqual([]);
 expect(unsupportedDocumentQuotes('Helena: „Na rewersie fotografii napisano: Tajne przejście otwiera się o północy.”',payload)).toHaveLength(1);
});
