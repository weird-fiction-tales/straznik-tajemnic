import { NextRequest, NextResponse } from 'next/server';
import { retryMemoryTurn, finalizeDossierTurn, prepareDossierTurn } from '@/core/memory/commit-turn';
export const runtime = 'nodejs';
export async function POST(request:NextRequest) {
  const body: unknown = await request.json().catch(()=>null);
  if (body && typeof body === 'object' && 'dossierFinalizationToken' in body) {
    if ('phase' in body && body.phase === 'prepare' && !('accepted' in body) && typeof body.dossierFinalizationToken === 'string') {
      try { return NextResponse.json(prepareDossierTurn(body.dossierFinalizationToken)); }
      catch { return NextResponse.json({error:'DOSSIER_PREPARATION_FAILED'},{status:409}); }
    }
    if ('phase' in body) return NextResponse.json({error:'INVALID_REQUEST'},{status:400});
    if (typeof body.dossierFinalizationToken !== 'string' || !('accepted' in body) || typeof body.accepted !== 'boolean') {
      return NextResponse.json({error:'INVALID_REQUEST'},{status:400});
    }
    try { return NextResponse.json(finalizeDossierTurn(body.dossierFinalizationToken, body.accepted)); }
    catch { return NextResponse.json({error:'DOSSIER_FINALIZATION_FAILED'},{status:409}); }
  }
  if (!body || typeof body !== 'object' || !('retryToken' in body) || typeof body.retryToken !== 'string') return NextResponse.json({error:'INVALID_REQUEST'},{status:400});
  try { return NextResponse.json({memoryCommit:retryMemoryTurn(body.retryToken)}); }
  catch { return NextResponse.json({error:'MEMORY_SAVE_FAILED'},{status:503}); }
}
