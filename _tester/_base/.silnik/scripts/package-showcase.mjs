#!/usr/bin/env node
// Self-contained private macOS build. No credentials, private rules or user saves.
import {cpSync,existsSync,mkdirSync,readFileSync,writeFileSync,realpathSync,statSync,lstatSync,unlinkSync} from 'node:fs';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const source=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const showcasePort=Number(process.env.ZEW_SHOWCASE_PORT||4050);
if(!Number.isInteger(showcasePort)||showcasePort<1024||showcasePort>65535)throw Error('Invalid showcase port');
const buildId=readFileSync(join(source,'.next/BUILD_ID'),'utf8').trim();
if(!/^[a-zA-Z0-9_-]+$/.test(buildId))throw Error('Invalid build ID');
const createdAt=new Date().toISOString();
const date=createdAt.slice(0,10).replaceAll('-','');
const version=JSON.parse(readFileSync(join(source,'package.json'),'utf8')).version+'-showcase.'+date+'.'+createdAt.slice(11,16).replace(':','');
const target=join(source,'.local-playtest/showcase/releases',buildId+'-'+createdAt.replace(/\D/g,'').slice(0,14));
if(existsSync(target))throw Error('This frozen build already exists; never overwrite a release.');
const bundleName='Straznik Tajemnic - Pokaz '+date.slice(6,8)+'-'+date.slice(4,6)+'.app';
const bundle=join(target,bundleName);
const runtime=join(bundle,'Contents/Resources/runtime');
mkdirSync(runtime,{recursive:true});
cpSync(join(source,'.next'),join(runtime,'.next'),{recursive:true,filter:p=>!relative(join(source,'.next'),p).split('/').includes('cache')});
cpSync(join(source,'public'),join(runtime,'public'),{recursive:true});
for(const file of ['package.json','next.config.ts','tsconfig.json','LICENSE','NOTICE'])if(existsSync(join(source,file)))cpSync(join(source,file),join(runtime,file));
for(const dir of ['src/i18n','messages','data/mythos','data/pricing'])if(existsSync(join(source,dir)))cpSync(join(source,dir),join(runtime,dir),{recursive:true});
mkdirSync(join(runtime,'scripts'),{recursive:true});
cpSync(join(source,'scripts/start-showcase.mjs'),join(runtime,'scripts/start-showcase.mjs'));
const gitRoot=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:source,encoding:'utf8'}).trim();
cpSync(join(gitRoot,'desktop'),join(runtime,'desktop'),{recursive:true});
execFileSync('/usr/bin/ditto',[realpathSync(join(source,'node_modules')),join(runtime,'node_modules')]);
// An old workspace self-link is not a package and must not escape the frozen bundle.
const legacyModulesLink=join(runtime,'node_modules/node_modules');
if(existsSync(legacyModulesLink)&&lstatSync(legacyModulesLink).isSymbolicLink())unlinkSync(legacyModulesLink);
mkdirSync(join(runtime,'bin'),{recursive:true});
cpSync(process.execPath,join(runtime,'bin/node'));
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:gitRoot,encoding:'utf8'}).trim();
const names=execFileSync('git',['-c','core.fsmonitor=false','ls-files','--modified','--others','--exclude-standard','-z'],{cwd:gitRoot}).toString().split('\0').filter(Boolean).sort();
const digest=createHash('sha256');
for(const name of names){
 const p=join(gitRoot,name);
 if(existsSync(p)&&statSync(p).isFile()){digest.update(name+'\0');digest.update(readFileSync(p));}
}
const sourceChangesSha256=digest.digest('hex');
const buildInfo={version,channel:'showcase',commitSha:revision,shortCommit:revision.slice(0,7),builtAt:createdAt,buildId,sourceChangesSha256};
writeFileSync(join(runtime,'build-info.json'),JSON.stringify(buildInfo,null,2));
const receipt={...buildInfo,hasUncommittedChanges:names.length>0,credentialsCopied:false,rulesCopiedIntoBundle:false,userSavesCopied:false,externalWorktreeDependencies:false,node:process.version};
writeFileSync(join(target,'build-receipt.json'),JSON.stringify(receipt,null,2));
writeFileSync(join(bundle,'Contents/Resources/build-receipt.json'),JSON.stringify(receipt,null,2));
mkdirSync(join(bundle,'Contents/MacOS'),{recursive:true});
const plist='<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>'+
 '<key>CFBundleName</key><string>Strażnik Tajemnic - Pokaz '+date.slice(6,8)+'.'+date.slice(4,6)+'</string>'+
 '<key>CFBundleDisplayName</key><string>Strażnik Tajemnic - Pokaz '+date.slice(6,8)+'.'+date.slice(4,6)+'</string>'+
 '<key>CFBundleExecutable</key><string>launcher</string><key>CFBundleIdentifier</key><string>com.aios.straznik.showcase</string>'+
 '<key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>'+version+'</string>'+
 '<key>CFBundleVersion</key><string>'+date+createdAt.slice(11,16).replace(':','')+'</string>'+
 '<key>LSMinimumSystemVersion</key><string>11.0</string><key>NSHighResolutionCapable</key><true/>'+
 '<key>CFBundleIconFile</key><string>icon</string></dict></plist>';
writeFileSync(join(bundle,'Contents/Info.plist'),plist);
const launcher=[
 '#!/bin/zsh','set -eu',
 'SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"',
 'GAME_DIR="$(cd "$SCRIPT_DIR/../Resources/runtime" && pwd)"',
 'export ZEW_APP_BUNDLE="$(cd "$SCRIPT_DIR/../.." && pwd)"',
 'export ZEW_DATA_DIR="$HOME/Library/Application Support/ZewCthulhu"',
 'export RAG_DATA_DIR="$ZEW_DATA_DIR/rag"',
 'export ZEW_DESKTOP_SHOWCASE=1',
 'export ZEW_DESKTOP_SELF_UPDATE=0',
 'export ZEW_LOCAL_PLAYTEST=showcase-pl-en',
 'export ZEW_SHOWCASE_PORT='+showcasePort,
 'export PATH="$GAME_DIR/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"',
 'SHOWCASE_HOME="$ZEW_DATA_DIR/showcase"',
 'PROFILE_DIR="$ZEW_DATA_DIR/desktop/chrome-profile"',
 'mkdir -p "$SHOWCASE_HOME" "$PROFILE_DIR"',
 'nohup "$GAME_DIR/bin/node" "$GAME_DIR/scripts/start-showcase.mjs" >> "$SHOWCASE_HOME/launcher.log" 2>&1 &',
 'for attempt in {1..45}; do',
 ' if "$GAME_DIR/bin/node" "$GAME_DIR/scripts/start-showcase.mjs" --check >/dev/null 2>&1; then break; fi',
 ' /bin/sleep 1','done',
 'if ! "$GAME_DIR/bin/node" "$GAME_DIR/scripts/start-showcase.mjs" --check >/dev/null 2>&1; then',
 ' print -u2 "Pokaz nie uruchomił właściwego buildu i obu teczek. Sprawdź $SHOWCASE_HOME/launcher.log."',
 ' exit 1','fi',
 '/usr/bin/open -na "Google Chrome" --args --app=http://127.0.0.1:'+showcasePort+'/pl --user-data-dir="$PROFILE_DIR" --start-fullscreen --autoplay-policy=no-user-gesture-required --no-first-run --no-default-browser-check',
 '',
].join('\n');
writeFileSync(join(bundle,'Contents/MacOS/launcher'),launcher,{mode:0o755});
const icon=join(gitRoot,'desktop/icon.icns');
if(existsSync(icon))cpSync(icon,join(bundle,'Contents/Resources/icon.icns'));
console.log(JSON.stringify({bundle,runtime,receipt:join(target,'build-receipt.json'),version,buildId}));
