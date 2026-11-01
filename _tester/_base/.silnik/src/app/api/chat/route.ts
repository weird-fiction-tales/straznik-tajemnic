import { NextRequest, NextResponse } from 'next/server';
import { timeManager } from '@/lib/time-manager';
import { localVectorStore } from '@/lib/vector-db/local-vector-store';
import { logApiEvent, generateTraceId, startTimer } from '@/lib/telemetry';
import { runChatPipeline } from './_helpers/run-chat-pipeline';
import { CampaignContextBudgetError } from '@/lib/ai-providers/context-budget';
import { isInvalidKeyError } from './_helpers/model-fallback';

// Zew-App-Local: RAG na lokalnym magazynie wektorów (data/rag/), bez Pinecone.
// Init tworzy katalog danych przy cold start (idempotentne, nie wymaga klucza).
localVectorStore.initialize();

export async function POST(request: NextRequest) {
  const traceId = request.headers.get('x-trace-id') ?? generateTraceId();
  const timer = startTimer();
  console.log('🚀 POST /api/chat received', { traceId });

  try {
    const body = await request.json();

    if (!body?.message)
      return NextResponse.json(
        { error: 'Wiadomość jest wymagana' },
        { status: 400 }
      );

    // Synchronizuj czas gry z klienta
    if (body.gameTime) {
      timeManager.import(body.gameTime);
    }

    return await runChatPipeline({ request, body, traceId, timer });
  } catch (error) {
    if (error instanceof CampaignContextBudgetError) {
      await logApiEvent({ traceId, endpoint: '/api/chat', status: 422, durationMs: timer.elapsed(),
        result: 'error', errorCode: error.code }).catch(() => {});
      return NextResponse.json({ code: error.code }, { status: 422 });
    }
    const errorMsg =
      error instanceof Error ? error.stack || error.message : String(error);
    // IND-67: drop fs.appendFileSync('./src/api-debug.log') - Vercel READ-ONLY FS.
    // console.error → Vercel Logs auto-collect; logApiEvent niżej dodaje Sentry breadcrumb.
    console.error('❌ Błąd API chat:', errorMsg);

    if (isInvalidKeyError(error)) {
      await logApiEvent({
        traceId,
        endpoint: '/api/chat',
        status: 401,
        durationMs: timer.elapsed(),
        result: 'error',
        errorCode: 'BYOK_KEY_INVALID',
        errorMsg: error instanceof Error ? error.message : String(error),
      }).catch(() => {});

      return NextResponse.json(
        {
          error: 'Podany klucz Gemini API jest nieprawidłowy lub wygasł. Zaktualizuj klucz w Ustawieniach.',
          code: 'BYOK_KEY_INVALID',
          details: error instanceof Error ? error.message : undefined,
        },
        { status: 401 }
      );
    }

    // Telemetria błędu - nie fire-and-forget, żeby błąd zdążył się zapisać
    await logApiEvent({
      traceId,
      endpoint: '/api/chat',
      status: 500,
      durationMs: timer.elapsed(),
      result: 'error',
      errorCode:
        error instanceof Error ? error.constructor.name : 'UnknownError',
      errorMsg: error instanceof Error ? error.message : String(error),
    }).catch(() => {});

    return NextResponse.json(
      {
        error: 'Błąd serwera',
        details: error instanceof Error ? error.message : 'Nieznany błąd',
      },
      { status: 500 }
    );
  }
}
