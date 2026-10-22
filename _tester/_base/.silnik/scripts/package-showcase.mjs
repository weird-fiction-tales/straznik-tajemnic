#!/usr/bin/env node
// Private local artifact. No commits, uploads, installed-app replacement or credential copying.
import {cpSync,existsSync,mkdirSync,readFileSync,writeFileSync,symlinkSync,realpathSync,statSync} from 'node:fs';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const source=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const showcasePort=Number(process.env.ZEW_SHOWCASE_PORT||3821);
if(!Number.isInteger(showcasePort)||showcasePort<1024||showcasePort>65535)throw Error('Invalid showcase port');
const buildId=readFileSync(join(source,'.next/BUILD_ID'),'utf8').trim();
if(!/^[a-zA-Z0-9_-]+$/.test(buildId))throw Error('Invalid build ID');
const home=join(source,'.local-playtest/showcase');
const target=join(home,'releases',buildId),runtime=join(target,'runtime');
if(existsSync(target))throw Error('This frozen build already exists; never overwrite a verified release.');
mkdirSync(runtime,{recursive:true});
cpSync(join(source,'.next'),join(runtime,'.next'),{recursive:true,filter:p=>!relative(join(source,'.next'),p).split('/').includes('cache')});
cpSync(join(source,'public'),join(runtime,'public'),{recursive:true});
for(const file of ['package.json','next.config.ts','tsconfig.json'])cpSync(join(source,file),join(runtime,file));
for(const dir of ['src/i18n','messages','data/mythos','data/pricing'])if(existsSync(join(source,dir)))cpSync(join(source,dir),join(runtime,dir),{recursive:true});
mkdirSync(join(runtime,'scripts'),{recursive:true});cpSync(join(source,'scripts/start-showcase.mjs'),join(runtime,'scripts/start-showcase.mjs'));
symlinkSync(realpathSync(join(source,'node_modules')),join(runtime,'node_modules'),'dir');
const gitRoot=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:source,encoding:'utf8'}).trim();
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:gitRoot,encoding:'utf8'}).trim();
const names=execFileSync('git',['ls-files','--modified','--others','--exclude-standard','-z'],{cwd:gitRoot}).toString().split('\0').filter(Boolean).sort();
const digest=createHash('sha256');for(const name of names){const p=join(gitRoot,name);if(existsSync(p)&&statSync(p).isFile()){digest.update(name+'\0');digest.update(readFileSync(p));}}
const receipt={buildId,sourceRevision:revision,hasUncommittedChanges:names.length>0,sourceChangesSha256:digest.digest('hex'),createdAt:new Date().toISOString(),node:process.version,
 purpose:'Private PL/EN showcase, 22 October 2026',runtime,credentialsCopied:false,rulesCopiedIntoBundle:false,dependencies:realpathSync(join(runtime,'node_modules'))};
writeFileSync(join(target,'build-receipt.json'),JSON.stringify(receipt,null,2));
const bundle=join(target,'Straznik Tajemnic - Pokaz 22-10.app');
mkdirSync(join(bundle,'Contents/MacOS'),{recursive:true});mkdirSync(join(bundle,'Contents/Resources'),{recursive:true});
writeFileSync(join(bundle,'Contents/Info.plist'),`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleName</key><string>Strażnik Tajemnic - Pokaz 22-10</string><key>CFBundleDisplayName</key><string>Strażnik Tajemnic - Pokaz 22-10</string><key>CFBundleExecutable</key><string>launcher</string><key>CFBundleIdentifier</key><string>com.aios.straznik.showcase.20261022</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>0.9.5-showcase</string><key>CFBundleVersion</key><string>20261022</string><key>CFBundleIconFile</key><string>icon</string></dict></plist>`);
const quote=s=>{if(s.includes("'"))throw Error('Unsupported apostrophe in local path');return "'"+s+"'";};
const launcher=`#!/bin/zsh
set -eu
export ZEW_SHOWCASE_HOME=${quote(home)}
export ZEW_SHOWCASE_PRIVATE_ROOT=${quote(join(source,'.local-playtest/prabuty'))}
export ZEW_SHOWCASE_PORT=${quote(String(showcasePort))}
mkdir -p "$ZEW_SHOWCASE_HOME/browser-profile"
nohup ${quote(process.execPath)} ${quote(join(runtime,'scripts/start-showcase.mjs'))} >> "$ZEW_SHOWCASE_HOME/launcher.log" 2>&1 &
for attempt in {1..45}; do
 if /usr/bin/curl --silent --fail http://127.0.0.1:${showcasePort}/_next/static/${buildId}/_buildManifest.js > /dev/null && /usr/bin/curl --silent --fail http://127.0.0.1:${showcasePort}/api/adventure-dossier/playtest > /dev/null; then break; fi
 /bin/sleep 1
done
if ! /usr/bin/curl --silent --fail http://127.0.0.1:${showcasePort}/_next/static/${buildId}/_buildManifest.js > /dev/null; then
 print -u2 "Pokaz nie uruchomił właściwego wydania na porcie ${showcasePort}. Sprawdź launcher.log."
 exit 1
fi
/usr/bin/open -na 'Google Chrome' --args --app=http://127.0.0.1:${showcasePort}/pl --user-data-dir="$ZEW_SHOWCASE_HOME/browser-profile" --no-first-run --no-default-browser-check
`;
writeFileSync(join(bundle,'Contents/MacOS/launcher'),launcher,{mode:0o755});
if(existsSync(join(source,'desktop/icon.icns')))cpSync(join(source,'desktop/icon.icns'),join(bundle,'Contents/Resources/icon.icns'));
console.log(JSON.stringify({bundle,runtime,receipt:join(target,'build-receipt.json')}));
