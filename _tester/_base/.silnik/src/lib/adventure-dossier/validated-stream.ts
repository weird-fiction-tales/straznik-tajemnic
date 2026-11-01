import { DossierEffectsRejectedError, type DossierCorrectionRequest } from './narration-correction';
import { parseSSEStream, type SSECallbacks, type SSEMetadataEvent } from '../sse-parser';

/** No consumer (UI, audio, journal, clock) sees an unvalidated dossier response. */
export async function parseValidatedDossierStream(response: Response, callbacks: SSECallbacks, gate: {
  validate: (text: string, metadata: SSEMetadataEvent) => void | Promise<void>;
  reject: (token: string) => Promise<void>;
  correct?: (request: DossierCorrectionRequest) => Promise<Response>;
}): Promise<string> {
  let metadata: SSEMetadataEvent | undefined;
  let malformed = false;
  let text: string;
  try {
    text = await parseSSEStream(response, {
      onMetadata: value => { if (metadata) malformed = true; metadata = value; },
      onParseError: () => { malformed = true; },
    });
    if (malformed || !metadata) throw new Error('DOSSIER_STREAM_INCOMPLETE');
    await gate.validate(text, metadata);
  } catch (error) {
    if (typeof metadata?.dossierFinalizationToken === 'string') {
      // A failed rejection request never turns into approval; the volatile token expires.
      let rejected = false;
      try { await gate.reject(metadata.dossierFinalizationToken); rejected = true; } catch { /* Never retry an unconfirmed rejection. */ }
      if (rejected && error instanceof DossierEffectsRejectedError && gate.correct) {
        const corrected = await gate.correct({token: metadata.dossierFinalizationToken, rejectedIds: error.rejectedIds});
        if (!corrected.ok) throw new Error('DOSSIER_CORRECTION_FAILED');
        // The second draft passes the same gate, but cannot request a second correction.
        return parseValidatedDossierStream(corrected, callbacks, {...gate, correct: undefined});
      }
    }
    throw error;
  }
  // Callback failures must propagate, not be swallowed by the transport parser.
  callbacks.onText?.(text);
  callbacks.onMetadata?.(metadata);
  return text;
}

export async function acknowledgeDossierTurn(token: string, accepted: boolean): Promise<Record<string, unknown>> {
  const response = await fetch('/api/memory/turn', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dossierFinalizationToken: token, accepted }),
  });
  const result: unknown = await response.json();
  if (!response.ok || !result || typeof result !== 'object' || !('accepted' in result) || result.accepted !== accepted) {
    throw new Error('DOSSIER_FINALIZATION_FAILED');
  }
  return result as Record<string, unknown>;
}

/** Called only after local preview acceptance, before any campaign writes. */
export async function prepareDossierTurnOnServer(token: string): Promise<void> {
  const response=await fetch('/api/memory/turn',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({dossierFinalizationToken:token,phase:'prepare'}),
  });
  const result:unknown=await response.json();
  if(!response.ok || !result || typeof result!=='object' || !('prepared' in result) || result.prepared!==true) {
    throw new Error('DOSSIER_PREPARATION_FAILED');
  }
}
