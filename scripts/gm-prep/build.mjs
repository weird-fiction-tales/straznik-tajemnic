#!/usr/bin/env node
/** Local authoring compiler. Reads inspected notes, never PDFs, and never approves/publishes. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtime = path.join(root, '_tester/_base/.silnik');
const require = createRequire(path.join(runtime, 'package.json'));
const yaml = require('js-yaml');
const ts = require('typescript');
// Use the actual application's schema/loader; compile TS in this authoring CLI process only.
const oldExtension = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(path.join(runtime, 'src/lib/adventure-dossier/')) && !['time-manager.ts','dice-utils.ts'].some(name => filename === path.join(runtime, 'src/lib', name))) {
    throw new Error('Unexpected TypeScript dependency: ' + filename);
  }
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
};
const { validateDossierRagPayload } = require(path.join(runtime, 'src/lib/adventure-dossier/rag-schema.ts'));
const { loadDossierAuthoringDirectory } = require(path.join(runtime, 'src/lib/adventure-dossier/authoring-loader.ts'));
const { DOSSIER_MECHANICS } = require(path.join(runtime, 'src/lib/adventure-dossier/mechanic-registry.ts'));
if (oldExtension) require.extensions['.ts'] = oldExtension;
else delete require.extensions['.ts'];

import { readBuildModel } from './build-model.mjs';
const {directory, manifest, payload, records, review, readiness, previous, receiptPath, recordsDir} = readBuildModel(process.argv[2] || path.join(root,'docs/adventure-dossiers/posrod-pradawnych-drzew-v1.3'));
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const generated={};
for(const record of records) {
  const name=record.record_id+'.yaml', file=path.join(recordsDir,name);
  if(fs.existsSync(file)&&!Object.hasOwn(previous,name)) throw new Error('Refuse overwrite of unmanaged record '+name);
  const text=yaml.dump(record,{lineWidth:110,noRefs:true,quotingType:'"'});
  generated[name]=hash(text); fs.writeFileSync(file,text,{mode:0o600});
}
for(const name of Object.keys(previous)) if(!Object.hasOwn(generated,name)) fs.unlinkSync(path.join(recordsDir,name));
fs.writeFileSync(receiptPath,JSON.stringify(generated,null,2)+'\n',{mode:0o600});
fs.writeFileSync(path.join(directory,'preparation/review-data.json'),JSON.stringify(review,null,2)+'\n',{mode:0o600});
fs.writeFileSync(path.join(directory,'preparation/readiness.json'),JSON.stringify(readiness,null,2)+'\n',{mode:0o600});
const template=fs.readFileSync(path.join(root,'scripts/gm-prep/review.html'),'utf8');
const embedded=JSON.stringify(review).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
fs.writeFileSync(path.join(directory,'teczka.html'),template.replace('/*__DOSSIER_DATA__*/',embedded),{mode:0o600});
const loaded=await loadDossierAuthoringDirectory(directory,manifest.edition_fingerprint);
if(!loaded.ok) throw new Error(loaded.errors.join('\n'));
console.log(JSON.stringify({output:path.join(directory,'teczka.html'),...readiness.counts,schema_valid:true,release_ready:loaded.releaseReady,approval:manifest.approval,reference_only_nodes:readiness.reference_only_nodes},null,2));
