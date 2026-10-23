import fs from 'fs';
import os from 'os';
import path from 'path';
import { CampaignMemoryLedgerStore } from './ledger-store';
import { commitMemoryTurn, retainFailedTurn, retryMemoryTurn, stageDossierTurn, finalizeDossierTurn, prepareDossierTurn, consumeDossierCorrection } from './commit-turn';
import type { CampaignMemoryScope } from './types';

let mockLedger: CampaignMemoryLedgerStore;
jest.mock('./ledger-store', () => ({
  ...jest.requireActual('./ledger-store'),
  getCampaignMemoryLedgerStore: () => mockLedger,
}));
jest.mock('./index-queue', () => ({ drainMemoryIndex: jest.fn(async () => {}) }));
const scope: CampaignMemoryScope = { schemaVersion: 1, campaignDefinitionId: 'c', playthroughId: 'run-test', adventureId: 'a', kind: 'custom' };
const turn = { scope, sessionId: 's', messageId: 'm', userText: 'Question', assistantText: 'Answer' };

describe('canonical commit and recoverable retry', () => {
  let directory: string;
  const originalDataDir = process.env.ZEW_DATA_DIR;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-commit-'));
    process.env.ZEW_DATA_DIR = directory;
    mockLedger = new CampaignMemoryLedgerStore(path.join(directory, 'ledger.sqlite3'));
  });
  afterEach(() => {
    mockLedger.close();
    fs.rmSync(directory, { recursive: true, force: true });
    if (originalDataDir === undefined) delete process.env.ZEW_DATA_DIR;
    else process.env.ZEW_DATA_DIR = originalDataDir;
  });

  it('acknowledges only durable entries and makes the retry idempotent', () => {
    const saved = commitMemoryTurn(turn);
    expect(saved).toEqual({ messageId: 'm', status: 'saved', revision: 2 });
    expect(mockLedger.list(scope)).toHaveLength(2);
    const token = retainFailedTurn(turn);
    expect(retryMemoryTurn(token)).toEqual(saved);
    expect(retryMemoryTurn(token)).toEqual(saved);
    expect(mockLedger.list(scope)).toHaveLength(2);
  });

  it('recovers the exact failed turn after losing the in-process retry map', () => {
    const token = retainFailedTurn(turn);
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const freshModule: typeof import('./commit-turn') = require('./commit-turn');
      expect(freshModule.retryMemoryTurn(token).status).toBe('saved');
    });
    expect(mockLedger.list(scope).map(e => e.text)).toEqual(['Question', 'Answer']);
  });

  it('shares volatile retry across route modules when disk persistence is unavailable', () => {
    const warning=jest.spyOn(console,'warn').mockImplementation(()=>{});
    const write=jest.spyOn(fs,'writeFileSync').mockImplementationOnce(()=>{throw new Error('disk unavailable');});
    const token=retainFailedTurn(turn);
    write.mockRestore();warning.mockRestore();
    expect(fs.existsSync(path.join(directory,'memory','pending-turns',token+'.json'))).toBe(false);
    jest.isolateModules(()=>{
      const other:typeof import('./commit-turn')=require('./commit-turn');
      expect(other.retryMemoryTurn(token)).toMatchObject({status:'saved',messageId:turn.messageId});
    });
    expect(mockLedger.list(scope).map(entry=>entry.text)).toEqual(['Question','Answer']);
  });

  it('propagates ledger errors instead of acknowledging an unsaved turn', () => {
    jest.spyOn(mockLedger, 'recordConversationTurn').mockImplementationOnce(() => { throw new Error('disk failure'); });
    expect(() => commitMemoryTurn(turn)).toThrow('disk failure');
    expect(mockLedger.list(scope)).toEqual([]);
  });

  it('rejects arbitrary retry paths', () => {
    expect(() => retryMemoryTurn('../ledger.sqlite3')).toThrow('INVALID_RETRY_TOKEN');
  });
});


describe('dossier finalization', () => {
  it('keeps rejected/unacknowledged narration out of durable memory and director', () => {
    const effect = jest.fn();
    const token = stageDossierTurn(effect);
    expect(effect).not.toHaveBeenCalled();
    expect(() => retryMemoryTurn(token)).toThrow();
    expect(effect).not.toHaveBeenCalled();
    expect(finalizeDossierTurn(token, false)).toEqual({ accepted: false });
    expect(() => finalizeDossierTurn(token, true)).toThrow('DOSSIER_TURN_REJECTED');
    expect(effect).not.toHaveBeenCalled();
  });
  it('finalizes an accepted turn once even after a lost acknowledgement', () => {
    const result = { memoryCommit: { messageId: 'm', status: 'saved' as const, revision: 2 } };
    const effect = jest.fn(() => result);
    const token = stageDossierTurn(effect);
    expect(finalizeDossierTurn(token, true)).toEqual({ accepted: true, ...result });
    expect(finalizeDossierTurn(token, true)).toEqual({ accepted: true, ...result });
    expect(effect).toHaveBeenCalledTimes(1);
    expect(() => finalizeDossierTurn(token, false)).toThrow('DOSSIER_TURN_ALREADY_ACCEPTED');
  });
});


test('shares the pending decision across route module instances in the same server process',async()=>{
 const commit=jest.fn(()=>({}));const token=stageDossierTurn(commit);
 await jest.isolateModulesAsync(async()=>{
   const fresh=await import('./commit-turn');
   expect(fresh.finalizeDossierTurn(token,true).accepted).toBe(true);
 });
 expect(commit).toHaveBeenCalledTimes(1);
});


describe('durable preparation after local validation',()=>{
 let directory:string;let previous:string|undefined;
 beforeEach(()=>{
   previous=process.env.ZEW_DATA_DIR;directory=fs.mkdtempSync(path.join(os.tmpdir(),'dossier-prepared-'));
   process.env.ZEW_DATA_DIR=directory;mockLedger=new CampaignMemoryLedgerStore(path.join(directory,'ledger.sqlite3'));
 });
 afterEach(()=>{mockLedger.close();fs.rmSync(directory,{recursive:true,force:true});
   if(previous===undefined)delete process.env.ZEW_DATA_DIR;else process.env.ZEW_DATA_DIR=previous;
 });
 const forgetQueue=()=>{
   const globalQueue=globalThis as typeof globalThis & {__zewStagedDossierTurns?:Map<string,unknown>};
   globalQueue.__zewStagedDossierTurns?.clear();
 };
 it('persists nothing before validation, then survives process queue loss without a premature ledger entry',()=>{
   const token=stageDossierTurn({turn});
   expect(fs.existsSync(path.join(directory,'memory','dossier-turns'))).toBe(false);
   expect(prepareDossierTurn(token)).toEqual({prepared:true});
   expect(mockLedger.list(scope)).toHaveLength(0);
   forgetQueue();
   expect(finalizeDossierTurn(token,true)).toMatchObject({accepted:true,memoryCommit:{status:'saved'}});
   expect(mockLedger.list(scope)).toHaveLength(2);
   forgetQueue();
   expect(finalizeDossierTurn(token,true)).toMatchObject({accepted:true,memoryCommit:{status:'saved'}});
   expect(mockLedger.list(scope)).toHaveLength(2);
 });
 it('retains rejection after a prepared transaction is abandoned and the server restarts',()=>{
   const token=stageDossierTurn({turn});prepareDossierTurn(token);
   expect(finalizeDossierTurn(token,false)).toEqual({accepted:false});forgetQueue();
   expect(()=>finalizeDossierTurn(token,true)).toThrow('DOSSIER_TURN_REJECTED');
   expect(mockLedger.list(scope)).toHaveLength(0);
   const file=fs.readFileSync(path.join(directory,'memory','dossier-turns',token+'.json'),'utf8');
   expect(file).not.toContain('Answer');
 });
 it('does not allow a durable turn to finalize before preparation',()=>{
   const token=stageDossierTurn({turn});
   expect(()=>finalizeDossierTurn(token,true)).toThrow('DOSSIER_TURN_NOT_PREPARED');
   expect(mockLedger.list(scope)).toHaveLength(0);
 });
 it('retries a lost durable receipt without duplicate ledger entries',()=>{
   const token=stageDossierTurn({turn});prepareDossierTurn(token);
   const rename=jest.spyOn(fs,'renameSync').mockImplementationOnce(()=>{throw new Error('receipt failed');});
   expect(()=>finalizeDossierTurn(token,true)).toThrow('receipt failed');rename.mockRestore();
   expect(mockLedger.list(scope)).toHaveLength(2);
   forgetQueue();
   expect(finalizeDossierTurn(token,true)).toMatchObject({accepted:true,memoryCommit:{status:'saved'}});
   expect(mockLedger.list(scope)).toHaveLength(2);
 });
 it('keeps a prepared turn recoverable after a ledger failure',()=>{
   const token=stageDossierTurn({turn});prepareDossierTurn(token);
   jest.spyOn(mockLedger,'recordConversationTurn').mockImplementationOnce(()=>{throw new Error('ledger failure');});
   expect(()=>finalizeDossierTurn(token,true)).toThrow('ledger failure');
   expect(mockLedger.list(scope)).toHaveLength(0);forgetQueue();
   expect(finalizeDossierTurn(token,true)).toMatchObject({accepted:true});
   expect(mockLedger.list(scope)).toHaveLength(2);
 });
 it('does not report preparation when durable writing fails',()=>{
   const token=stageDossierTurn({turn});
   const write=jest.spyOn(fs,'writeFileSync').mockImplementationOnce(()=>{throw new Error('disk full');});
   expect(()=>prepareDossierTurn(token)).toThrow('disk full');write.mockRestore();
   expect(()=>finalizeDossierTurn(token,true)).toThrow('DOSSIER_TURN_NOT_PREPARED');
   expect(mockLedger.list(scope)).toHaveLength(0);
 });
});


describe('one correction of a rejected narrative', () => {
 const identity={scope,sessionId:'s',messageId:'m',userText:'Question',contextHash:'same-mechanics'};
 const draft=()=>({turn,correctionContextHash:identity.contextHash});
 it('allows one correction only after rejection, with the same scope and mechanics',()=>{
  const token=stageDossierTurn(draft());
  expect(()=>consumeDossierCorrection(token,identity)).toThrow('DOSSIER_CORRECTION_UNAVAILABLE');
  finalizeDossierTurn(token,false);
  expect(()=>consumeDossierCorrection(token,{...identity,contextHash:'changed-roll'})).toThrow('DOSSIER_CORRECTION_SCOPE');
  expect(consumeDossierCorrection(token,identity)).toBe('Answer');
  expect(()=>consumeDossierCorrection(token,identity)).toThrow('DOSSIER_CORRECTION_UNAVAILABLE');
 });
 it('rejects another campaign, player session or message without consuming the retry',()=>{
  const token=stageDossierTurn(draft());finalizeDossierTurn(token,false);
  for(const change of [{scope:{...scope,playthroughId:'other'}},{sessionId:'other'},{messageId:'other'},{userText:'different'}]){
   expect(()=>consumeDossierCorrection(token,{...identity,...change})).toThrow('DOSSIER_CORRECTION_SCOPE');
  }
  expect(consumeDossierCorrection(token,identity)).toBe('Answer');
 });
 it('does not create a second correction slot for the corrected response',()=>{
  const token=stageDossierTurn({...draft(),correctionAttempt:true});finalizeDossierTurn(token,false);
  expect(()=>consumeDossierCorrection(token,identity)).toThrow('DOSSIER_CORRECTION_UNAVAILABLE');
 });
});


test('correction remains single-use and scope-bound across separately loaded route modules',()=>{
 const identity={scope,sessionId:'s',messageId:'m',userText:'Question',contextHash:'exact-request'};
 const token=stageDossierTurn({turn,correctionContextHash:identity.contextHash});
 jest.isolateModules(()=>{
   const other:typeof import('./commit-turn')=require('./commit-turn');
   other.finalizeDossierTurn(token,false);
   expect(()=>other.consumeDossierCorrection(token,{...identity,scope:{...scope,playthroughId:'other'}})).toThrow('DOSSIER_CORRECTION_SCOPE');
   expect(other.consumeDossierCorrection(token,identity)).toBe('Answer');
 });
 expect(()=>consumeDossierCorrection(token,identity)).toThrow('DOSSIER_CORRECTION_UNAVAILABLE');
});
