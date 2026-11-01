import { validateStarterState } from '@/lib/adventures/starter-runtime';
import { getStarterStore } from '@/lib/adventures/starter-store';
import { NextRequest, NextResponse } from 'next/server';
import { createCampaignMemoryScope, isCampaignMemoryScope } from '@/core/memory/campaign-scope';
import { getCampaignMemoryLedgerStore } from '@/core/memory/ledger-store';
import { buildLegacySnapshot, validateMemorySnapshot } from '@/core/memory/snapshot';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 });
  }
  if (!body || typeof body.requestId !== 'string' || !body.requestId.trim()
    || !/^[a-zA-Z0-9_-]{1,160}$/.test(body.requestId) || !Array.isArray(body.messages)
    || !body.messages.every((m: { id?: unknown; role?: unknown; content?: unknown } | null) =>
      m && typeof m.id === 'string' && (m.role === 'user' || m.role === 'assistant')
      && typeof m.content === 'string')
    || !Array.isArray(body.characters) || !body.characters.every((c: {id?: unknown; name?: unknown} | null) => c && typeof c.id === 'string' && typeof c.name === 'string')
    || (body.scope !== undefined && !isCampaignMemoryScope(body.scope))) {
    return NextResponse.json({ error: 'Nieprawidłowe dane odtwarzania' }, { status: 400 });
  }
  if (body.snapshot !== undefined) {
    try { validateMemorySnapshot(body.snapshot); }
    catch { return NextResponse.json({ error: 'Nieprawidłowa migawka pamięci' }, { status: 400 }); }
    if (body.scope && (body.snapshot.scope.campaignDefinitionId !== body.scope.campaignDefinitionId || body.snapshot.scope.playthroughId !== body.scope.playthroughId)) {
      return NextResponse.json({ error: 'Zakres migawki nie pasuje do zapisu' }, { status: 400 });
    }
  }
  if (body.snapshot !== undefined && (!body.snapshot || body.snapshot.schemaVersion !== 1
    || !isCampaignMemoryScope(body.snapshot.scope)
    || !Number.isSafeInteger(body.snapshot.revision) || body.snapshot.revision < 0
    || !Array.isArray(body.snapshot.entries) || !Array.isArray(body.snapshot.checkpoints))) {
    return NextResponse.json({ error: 'Nieprawidłowa migawka pamięci' }, { status: 400 });
  }
  if (body.dossierState !== undefined) {
    try { validateStarterState(body.dossierState); } catch { return NextResponse.json({ error: 'Invalid starter snapshot' }, { status: 400 }); }
    if (body.scope && body.dossierState.playthroughId !== body.scope.playthroughId) return NextResponse.json({ error: 'Starter scope mismatch' }, { status: 400 });
  }
  try {
    const scope = isCampaignMemoryScope(body.scope) ? body.scope : createCampaignMemoryScope({
      id: typeof body.id === 'string' ? body.id : 'legacy-save',
      title: typeof body.name === 'string' ? body.name : 'Legacy save',
      isCustom: true,
    }, () => body.requestId);
    // Legacy imports use only the file's history, never the live ledger.
    const snapshot = body.snapshot ?? buildLegacySnapshot(scope, body.messages, body.characters, body.activeCharacterId);
    const restoredScope = getCampaignMemoryLedgerStore().restoreSnapshot(snapshot, body.requestId);
    const dossierState = body.dossierState ? getStarterStore().restore(restoredScope.playthroughId, body.dossierState) : undefined;
    return NextResponse.json({ success: true, scope: restoredScope, dossierState });
  } catch (error) {
    console.error('Memory restore failed:', error);
    return NextResponse.json({ error: 'Nie udało się odtworzyć pamięci' }, { status: 500 });
  }
}
