import type {DossierRagRecord} from './rag-schema';
type Documents={records:ReadonlyArray<Pick<DossierRagRecord,'record_type'|'content'>>};
const normalize=(text:string)=>text.normalize('NFKC').replace(/\s+/g,' ').trim();
const documentary=/(?:odwroci|rewers|awers|adnotacj|inskrypcj|napis|dokument|list(?:u|em|ach|y)?\b|fotograf|nagran|raport|transkrypcj|reverse|verso|inscription|document|letter|photograph|recording|transcript|ledger|blueprint)/iu;
/** Summaries authorize paraphrase, never a newly invented literal document. Dialogue remains improvisable. */
export function unsupportedDocumentQuotes(text:string,payload:Documents):string[]{
 const transcripts:string[]=[];let hasDocuments=false;
 for(const record of payload.records){
  if(record.record_type!=='media')continue;
  try{
   const value:unknown=JSON.parse(record.content);
   if(!value||typeof value!=='object'||!('documentAuthority'in value))continue;
   const authority=value.documentAuthority;
   if(!authority||typeof authority!=='object'||!('canonicalText'in authority)||typeof authority.canonicalText!=='string')continue;
   hasDocuments=true;
   if('literalTranscriptionAvailable'in authority&&authority.literalTranscriptionAvailable===true)transcripts.push(normalize(authority.canonicalText));
  }catch{/* Non-document media have no quotation authority. */}
 }
 if(!hasDocuments)return [];
 const narrative=text.replace(/\[(?:MYŚLI_MG|THOUGHTS):(?:[^\[\]]|\[[^\]]*\])*\]/giu,'');
 for(const paragraph of narrative.split(/\n\s*\n/)){
  if(!documentary.test(paragraph))continue;
  for(const match of paragraph.matchAll(/[„“"]([^"”\n]{12,2000})[”"]/gu)){
   const prefix=paragraph.slice(Math.max(0,(match.index??0)-240),match.index);
   const introduces=/(?:odwroci|rewers|awers|adnotacj|inskrypcj|napis|zapisano|widnieje|brzmi|tekst|reverse|verso|inscription|reads?|written|inscribed|wording|states?)/iu;
   const literalClaim=(documentary.test(prefix)&&introduces.test(prefix))||
     (documentary.test(match[1])&&introduces.test(match[1]));
   if(literalClaim&&!transcripts.some(source=>source.includes(normalize(match[1]))))return ['DOSSIER_DOCUMENT_QUOTE_UNSUPPORTED'];
  }
 }
 return [];
}
