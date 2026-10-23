import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import {chromium} from '@playwright/test';

const require=createRequire(import.meta.url);
const webpack=require('webpack');
const runtime=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const component=path.join(runtime,'src/components/ui/document-viewer.tsx');
const photograph=path.join(runtime,'public/handouts/cien-nad-prabutami/playtest/photo-1947.png');

// Run after a production build: node --test src/components/ui/document-viewer.browser.test.mjs
test('real DocumentViewer draws the source PNG and responds to zoom in a nonzero OSD viewport',{timeout:45000},async()=>{
  const output=fs.mkdtempSync(path.join(runtime,'test-results/document-viewer-browser-'));
  fs.writeFileSync(path.join(output,'loader.mjs'),"import ts from 'typescript';export default function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;}");
  fs.writeFileSync(path.join(output,'entry.js'),[
    "import React from 'react';import {createRoot} from 'react-dom/client';import {NextIntlClientProvider} from 'next-intl';",
    'import messages from '+JSON.stringify(path.join(runtime,'messages/pl.json'))+';',
    'import {DocumentViewer} from '+JSON.stringify(component)+';',
    "createRoot(document.getElementById('root')).render(React.createElement(NextIntlClientProvider,{locale:'pl',messages},React.createElement(DocumentViewer,{imageUrl:'/photo.png',title:'Fotografia 1947',preserveOriginal:true})));",
  ].join('\n'));
  const compiler=webpack({mode:'development',target:'web',entry:path.join(output,'entry.js'),
    output:{path:path.join(output,'bundle'),filename:'entry.js',publicPath:'/'},
    resolve:{extensions:['.tsx','.ts','.js'],alias:{'@':path.join(runtime,'src')}},
    module:{rules:[{test:/\.tsx?$/,use:path.join(output,'loader.mjs')}]}});
  const stats=await new Promise((resolve,reject)=>compiler.run((error,result)=>error?reject(error):resolve(result)));
  await new Promise((resolve,reject)=>compiler.close(error=>error?reject(error):resolve()));
  assert(!stats.hasErrors(),stats.toString({all:false,errors:true}));
  const css=fs.readdirSync(path.join(runtime,'.next/static/css')).filter(name=>name.endsWith('.css'))
    .map(name=>fs.readFileSync(path.join(runtime,'.next/static/css',name),'utf8')).join('\n');
  const server=http.createServer((request,response)=>{
    if(request.url==='/'){
      response.setHeader('Content-Type','text/html;charset=utf-8');
      response.end('<meta charset="utf-8"><style>'+css+'</style><div id="root" style="width:900px;height:700px;transform:translateZ(0);overflow:hidden;margin:50px"></div><script src="/entry.js"></script>');
    }else if(request.url==='/photo.png'){
      response.setHeader('Content-Type','image/png');response.end(fs.readFileSync(photograph));
    }else if(request.url.startsWith('/fonts/')){
      const font=path.join(runtime,'public/fonts',path.basename(request.url));
      if(fs.existsSync(font)){response.setHeader('Content-Type','font/woff2');response.end(fs.readFileSync(font));}
      else{response.statusCode=404;response.end();}
    }else{
      const file=path.join(output,'bundle',path.basename(request.url));
      if(fs.existsSync(file)){response.setHeader('Content-Type','application/javascript');response.end(fs.readFileSync(file));}
      else{response.statusCode=404;response.end();}
    }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1200,height:900}});
    const errors=[],requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    page.on('request',request=>requests.push({url:request.url(),method:request.method()}));
    const address=server.address();
    await page.goto('http://127.0.0.1:'+address.port);
    const decoded=await page.evaluate(async()=>{
      const image=new Image();image.src='/photo.png';await image.decode();
      return {width:image.naturalWidth,height:image.naturalHeight};
    });
    assert(decoded.width>0&&decoded.height>0,'The exact source PNG must decode');
    const canvas=page.locator('.openseadragon-canvas canvas');
    await canvas.waitFor({state:'attached'});
    await page.waitForTimeout(1200);
    const viewport=await canvas.boundingBox();
    fs.writeFileSync(path.join(output,'before.json'),JSON.stringify({decoded,viewport,errors},null,2));
    assert(viewport?.height>300,'OSD canvas viewport must have a real height above 300px; received '+viewport?.height);
    assert(viewport.width>800);
    const before=await canvas.screenshot({path:path.join(output,'before.png')});
    await page.getByRole('button',{name:'Przybliż',exact:true}).click();
    await page.waitForTimeout(700);
    const after=await canvas.screenshot({path:path.join(output,'zoomed.png')});
    assert(!before.equals(after),'Real zoom must change the source-photo canvas pixels');
    await page.getByRole('button',{name:'Pełny ekran',exact:true}).click();
    await page.waitForTimeout(700);
    const fullscreen=await canvas.boundingBox();
    assert(fullscreen.height>500,'Fullscreen OSD must also have definite viewport height');
    const close=page.getByRole('button',{name:'Zamknij pełny ekran',exact:true});
    const control=await close.boundingBox();
    assert(control.y+control.height<900,'Fullscreen close control must remain inside the viewport despite transformed/clipped chat ancestors');
    const accessible=await close.evaluate(element=>{const r=element.getBoundingClientRect();return element.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
    assert(accessible,'Fullscreen toolbar must not be clipped by the chat ancestor');
    await page.screenshot({path:path.join(output,'fullscreen.png')});
    await close.click();
    await page.waitForTimeout(700);
    const restored=await canvas.boundingBox();
    assert.equal(restored.height,360,'Leaving fullscreen must reattach a usable inline OSD canvas');
    await page.getByRole('button',{name:'Pełny ekran',exact:true}).click();
    await page.waitForTimeout(700);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
    assert.equal((await canvas.boundingBox()).height,360,'Escape must restore the inline OSD viewer');
    assert(await page.getByRole('button',{name:'Pełny ekran',exact:true}).evaluate(element=>document.activeElement===element),'Escape must return focus to the inline fullscreen control');
    assert.deepEqual(errors,[]);
    assert(requests.every(request=>request.method==='GET'));
    assert(requests.every(request=>new URL(request.url).hostname==='127.0.0.1'));
    fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify({decoded,viewport,fullscreen,zoomChangedPixels:true,errors,requests},null,2));
    console.log('DocumentViewer browser evidence: '+output);
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
});
