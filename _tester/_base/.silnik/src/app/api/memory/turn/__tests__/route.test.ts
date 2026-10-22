import type { NextRequest } from 'next/server';
import { POST } from '../route';
import { finalizeDossierTurn, retryMemoryTurn, prepareDossierTurn } from '@/core/memory/commit-turn';
jest.mock('@/core/memory/commit-turn',()=>({finalizeDossierTurn:jest.fn(),retryMemoryTurn:jest.fn(),prepareDossierTurn:jest.fn()}));
jest.mock('next/server',()=>({NextResponse:{json:(body:unknown,init?:{status?:number})=>({status:init?.status??200,json:async()=>body})}}));
const request=(body:unknown)=>({json:async()=>body}) as NextRequest;
beforeEach(()=>jest.resetAllMocks());
test('keeps the existing retry protocol',async()=>{
 jest.mocked(retryMemoryTurn).mockReturnValue({messageId:'m',status:'saved',revision:2});
 const response=await POST(request({retryToken:'legacy'}));
 expect(response.status).toBe(200);expect(retryMemoryTurn).toHaveBeenCalledWith('legacy');expect(finalizeDossierTurn).not.toHaveBeenCalled();
});
test.each([true,false])('passes only the explicit acceptance decision %s',async accepted=>{
 jest.mocked(finalizeDossierTurn).mockReturnValue({accepted});
 const response=await POST(request({dossierFinalizationToken:'opaque',accepted}));
 expect(response.status).toBe(200);expect(finalizeDossierTurn).toHaveBeenCalledWith('opaque',accepted);expect(retryMemoryTurn).not.toHaveBeenCalled();
});
test.each([{dossierFinalizationToken:'x'},{dossierFinalizationToken:'x',accepted:'true'},null])('rejects malformed finalization %j',async body=>{
 expect((await POST(request(body))).status).toBe(400);expect(finalizeDossierTurn).not.toHaveBeenCalled();
});
test('does not report acceptance for an expired or rejected token',async()=>{
 jest.mocked(finalizeDossierTurn).mockImplementation(()=>{throw new Error('expired');});
 const response=await POST(request({dossierFinalizationToken:'x',accepted:true}));
 expect(response.status).toBe(409);expect(await response.json()).toEqual({error:'DOSSIER_FINALIZATION_FAILED'});
});

test('prepares durable recovery without acknowledging the local mutations',async()=>{
 jest.mocked(prepareDossierTurn).mockReturnValue({prepared:true});
 const response=await POST(request({dossierFinalizationToken:'opaque',phase:'prepare'}));
 expect(response.status).toBe(200);expect(prepareDossierTurn).toHaveBeenCalledWith('opaque');
 expect(finalizeDossierTurn).not.toHaveBeenCalled();expect(retryMemoryTurn).not.toHaveBeenCalled();
});
test('rejects a contradictory prepare/reject request',async()=>{
 expect((await POST(request({dossierFinalizationToken:'opaque',phase:'prepare',accepted:false}))).status).toBe(400);
 expect(prepareDossierTurn).not.toHaveBeenCalled();
});
