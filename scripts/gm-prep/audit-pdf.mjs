/** Executes the existing browser extractor locally, using the application's pinned PDF.js/WASM. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {runtime,require} from './audit-read.mjs';
export async function verifyPdfHandouts(bytes,records){
 const {chromium}=require('@playwright/test'),ts=require('typescript');
 const source=fs.readFileSync(path.join(runtime,'src/lib/adventure-dossier/local-handouts.ts'),'utf8');
 const adapter=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const moduleFile=path.join(path.dirname(require.resolve('unpdf')),'index.mjs');
 const assets=new Set(['pdf.min.mjs','pdf.worker.min.mjs','openjpeg.wasm','openjpeg_nowasm_fallback.js']);
 const server=http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><script type="importmap">{"imports":{"unpdf":"/unpdf.mjs"}}</script>');}
  else if(req.url==='/input.pdf'){res.setHeader('Content-Type','application/pdf');res.end(bytes);}
  else if(req.url==='/adapter.mjs'){res.setHeader('Content-Type','text/javascript');res.end(adapter);}
  else if(req.url==='/unpdf.mjs'){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(moduleFile));}
  else if(req.url?.startsWith('/pdfjs/6.1.200/')&&assets.has(req.url.slice('/pdfjs/6.1.200/'.length))){const name=req.url.slice('/pdfjs/6.1.200/'.length);res.setHeader('Content-Type',name.endsWith('.wasm')?'application/wasm':'text/javascript');res.end(fs.readFileSync(path.join(runtime,'public/pdfjs/6.1.200',name)));}
  else {res.statusCode=404;res.end();}
 });
 let browser;
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true});const context=await browser.newContext();
  await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(60000);const warnings=[];
  page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
  await page.goto(base);const results=[];
  for(const r of records){
   warnings.length=0;
   const result=await page.evaluate(async record=>{
    try{const {extractLocalDossierImages}=await import('/adapter.mjs');const pdf=await(await fetch('/input.pdf')).blob();const images=await extractLocalDossierImages(pdf,{records:[record]});return {ok:images.length===1,width:images[0]?.width,height:images[0]?.height};}
    catch(e){return {ok:false,error:String(e.message||e)};}
   },r);
   const decoderFailed=warnings.some(w=>/decode|OpenJPEG|JpxError/i.test(w));
   results.push({recordId:r.record_id,status:result.ok?'checked':decoderFailed?'unverifiable':result.error==='DOSSIER_HANDOUT_PIXEL_MISMATCH'?'discrepancy':'unverifiable',actual:result,evidence:['existing extractLocalDossierImages; application PDF.js 6.1.200 + local OpenJPEG',...warnings]});
  }
  return results;
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
