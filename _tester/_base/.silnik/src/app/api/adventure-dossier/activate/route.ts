import { isSameOriginLocalDossierRequest } from '@/lib/adventure-dossier/local-request';
import { NextResponse, type NextRequest } from 'next/server';
import { activateDossierRag, getDossierRagBinding } from '@/lib/adventure-dossier/rag-runtime';
import { resolveUserId, scopeSessionId } from '@/lib/auth-user';
import { validateDossierRagPayload, isIndexableDossierRecord } from '@/lib/adventure-dossier/rag-schema';

export const runtime = 'nodejs';
export const maxDuration = 60;
const ID_PATTERN = /^[a-zA-Z0-9._:/-]{1,200}$/;
const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/;
const MAX_REQUEST_BYTES = 17 * 1024 * 1024;

const localRequest = isSameOriginLocalDossierRequest;

function validBinding(value: unknown): value is { sessionId: string; adventureId: string; editionFingerprint: string } {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.sessionId === 'string' && ID_PATTERN.test(v.sessionId) &&
    typeof v.adventureId === 'string' && ID_PATTERN.test(v.adventureId) &&
    typeof v.editionFingerprint === 'string' && FINGERPRINT_PATTERN.test(v.editionFingerprint);
}

/** Only metadata. Allows the client to restore its local index after a server restart. */
export async function GET(request: NextRequest) {
  if (!localRequest(request)) return NextResponse.json({ activated: false }, { status: 403 });
  const input = Object.fromEntries(request.nextUrl.searchParams);
  if (!validBinding(input)) return NextResponse.json({ activated: false }, { status: 400 });
  const id = scopeSessionId(await resolveUserId(''), input.sessionId);
  const binding = id ? getDossierRagBinding(id) : null;
  return NextResponse.json({ activated: binding?.adventureId === input.adventureId &&
    binding?.editionFingerprint === input.editionFingerprint }, { headers: { 'Cache-Control': 'no-store' } });
}

/** PDF uploads are deliberately unsupported. Browser sends the approved authored payload only. */
export async function POST(request: NextRequest) {
  if (!localRequest(request)) return NextResponse.json({ success: false, code: 'DOSSIER_LOCAL_RUNTIME_REQUIRED' }, { status: 403 });
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ success: false, code: 'DOSSIER_JSON_REQUIRED' }, { status: 415 });
  }
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_REQUEST_BYTES) { await reader.cancel(); throw new Error(); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const input: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!validBinding(input) || Object.keys(input).some(k => !['sessionId', 'adventureId', 'editionFingerprint', 'payload'].includes(k))) throw new Error();
    const sessionId = scopeSessionId(await resolveUserId(''), input.sessionId);
    if (!sessionId) throw new Error();
    const payload = (input as unknown as { payload: unknown }).payload;
    const checked = validateDossierRagPayload(payload);
    if (!checked.ok || !checked.payload?.records.length || !checked.payload.records.every(isIndexableDossierRecord)) throw new Error();
    const activated = await activateDossierRag(sessionId, input.adventureId, input.editionFingerprint, checked.payload);
    if (!activated.ok) throw new Error();
    return NextResponse.json({ success: true, activated: true });
  } catch {
    return NextResponse.json({ success: false, code: 'DOSSIER_ACTIVATION_REJECTED' }, { status: 422 });
  }
}
