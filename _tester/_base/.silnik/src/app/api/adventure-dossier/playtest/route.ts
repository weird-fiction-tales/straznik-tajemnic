import { isSameOriginLocalDossierRequest } from '@/lib/adventure-dossier/local-request';
import { NextRequest, NextResponse } from 'next/server';
import { createAuthoredEdition } from '@/lib/adventure-dossier/authored-editions';
import { isAuthoredAdventureId, isShowcaseServer } from '@/lib/adventure-dossier/authored-scenarios';
import { activateDossierRag } from '@/lib/adventure-dossier/rag-runtime';
import { resolveUserId, scopeSessionId } from '@/lib/auth-user';

export const runtime = 'nodejs';
export const maxDuration = 60;
const ADVENTURE_ID = 'cien-nad-prabutami';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
function guard(request: NextRequest): NextResponse | null {
  if (!isShowcaseServer()) return json({ code: 'LOCAL_PLAYTEST_DISABLED' }, 404);
  if (!isSameOriginLocalDossierRequest(request)) return json({ code: 'LOCAL_PLAYTEST_REQUIRED' }, 403);
  return null;
}
/** This fixed local authoring fixture is separate from purchased PDF release packs. */
export async function GET(request: NextRequest) {
  const denied = guard(request); if (denied) return denied;
  try {
    const adventureId = request.nextUrl.searchParams.get('adventureId') || ADVENTURE_ID;
    if (!isAuthoredAdventureId(adventureId)) return json({ code: 'LOCAL_PLAYTEST_INVALID' }, 404);
    const prepared = await createAuthoredEdition(adventureId);
    return json({ ...prepared, adventureId, mode: 'local_playtest', humanApproval: 'pending' });
  } catch { return json({ code: 'LOCAL_PLAYTEST_INVALID' }, 503); }
}
/** No client records, source paths or files are accepted. Rebuilds the exact server fixture. */
export async function POST(request: NextRequest) {
  const denied = guard(request); if (denied) return denied;
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ code: 'JSON_REQUIRED' }, 415);
  try {
    const text = await request.text();
    if (text.length > 2048) throw new Error();
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    const input = value as Record<string, unknown>;
    if (Object.keys(input).some(key => !['sessionId', 'adventureId', 'editionFingerprint'].includes(key)) ||
      typeof input.sessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(input.sessionId) || typeof input.adventureId !== 'string' || !isAuthoredAdventureId(input.adventureId)) throw new Error();
    const prepared = await createAuthoredEdition(input.adventureId);
    if (input.editionFingerprint !== prepared.editionFingerprint) throw new Error();
    const sessionId = scopeSessionId(await resolveUserId(''), input.sessionId);
    if (!sessionId) throw new Error();
    const result = await activateDossierRag(sessionId, input.adventureId, prepared.editionFingerprint, prepared.payload);
    if (!result.ok) return json({ code: 'LOCAL_PLAYTEST_INDEX_UNAVAILABLE' }, 503);
    return json({ success: true, activated: true, editionFingerprint: prepared.editionFingerprint, mode: 'local_playtest', humanApproval: 'pending' });
  } catch { return json({ code: 'LOCAL_PLAYTEST_ACTIVATION_REJECTED' }, 422); }
}
