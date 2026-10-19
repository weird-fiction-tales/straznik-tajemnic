import { buildNarrativeClueGate } from '@/lib/journal/apply-journal-tags';
import { getNarrativeTurnCadence } from '@/lib/narrative-engine/scene-director';
import { getOrdinaryWorldDirective } from '@/lib/pacing-controller';
import { NextRequest, NextResponse } from 'next/server';
import { loadAISettings, getGameMasterPrompt } from '@/lib/ai-settings';
import { DEFAULT_GEMINI_MODEL } from '@/lib/ai-providers/constants';
import { getContextLimit } from '@/lib/model-registry';
import { Character, Message, type GameTime, type NPC, type GuardrailState } from '@/lib/types';
import {
  extractPutativeEvent,
  adjudicatePutativeEvent,
  updateGuardrailState,
} from '@/lib/concordia/event-resolution';
import type { CombatResolution } from '@/lib/combat/combat-resolver';
import { extractCommand, handleCommand } from '@/lib/command-handler';
import { evaluateEraGuardrail } from '@/lib/guardrails/era-guardrail';
import { detectGameContext } from '@/lib/prompt-section-parser';
import { GeminiChatProvider } from '@/lib/ai-providers';
import { getContextAwareGMProtocol } from '@/lib/prompts/gm-protocol';
import {
  isSessionResume,
  buildSessionRecapInstruction,
} from '@/lib/session-recap';
import { getEmbeddingDimensions } from '@/lib/embedding-service';
import {
  buildAdditionalContext,
  buildPlayerSkillsSection,
  buildPlayerEquipmentSection,
  buildPlayerFinancesSection,
  buildPlayerVisualProfileSection,
  buildPlayerMagicSection,
  buildPlayerPulpSection,
  HotSeatPlayerEntry,
} from './build-context';
import { buildHandoutsContext } from './build-handouts-context';
import type { AdventureHandout, AdventurePuzzle } from '@/lib/adventures-data';
import type { DocumentType } from '@/types/adventure';
import { buildGeminiOptions } from './build-gemini-options';
import { buildPdfStrategy, PdfMemoryAttachments } from './build-pdf-strategy';
import { buildTimeContext } from './build-time-context';
import { createSseStream } from './create-sse-stream';
import {
  lintAgencyViolations,
  collectStreamChunks,
  chunksToAsyncStream,
} from './agency-linter';
import type { StreamChunk } from '@/lib/ai-providers/types';
import {
  detectPendingSanityTestResolution,
  type PendingSanityResolution,
} from './sanity-resolution';
export { detectPendingSanityTestResolution, type PendingSanityResolution };
import { resolveGeminiCache } from './resolve-gemini-cache';
import { runRAGAndSummary } from './run-rag-summary';
import { resolveSettings } from './resolve-settings';
import { buildPlayerWeaponContext } from '@/lib/combat/weapon-context';
import { buildNpcMeleeOptionsContext } from '@/lib/combat/npc-combat-profile';
import { resolveUserId, scopeSessionId } from '@/lib/auth-user';
import { isModelNotFoundError, isInvalidKeyError } from './model-fallback';
import { fetchImmersionContext } from './build-immersion-context';
import {
  buildEraNarrativeRules,
  isResolvedEraContext,
  resolveGameEraContext,
  type ResolvedEraContext,
} from '@/lib/era';
import { VisualBeliefGraph } from '@/lib/images/visual-belief-graph';
import { assertExactEraContext } from '@/lib/world-setup';
import {
  formatChaseForSystemContext,
  type ChaseState,
} from '@/lib/chase/chase-engine';
import {
  isCampaignMemoryScope,
} from '@/core/memory/campaign-scope';
import type { CampaignMemoryScope } from '@/core/memory/types';
import {
  buildWorldEngineDirectives,
  deriveSceneSensoryMemoryFromMessages,
  dispatchWorldEngines,
  extractMacroLocation,
  isSameMacroLocation,
  type SecretInput,
} from '@/lib/world-engine';
import { buildLocationEraGuidanceSection } from '@/lib/location-era-validator';
import { buildActiveTurnAntiHabituationSection } from '@/lib/prompts/narrative-style-instructions';

function isChaseState(value: unknown): value is ChaseState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<ChaseState>;
  const isFiniteInteger = (candidate: unknown): candidate is number =>
    typeof candidate === 'number' &&
    Number.isFinite(candidate) &&
    Number.isInteger(candidate);
  const isBoundedString = (candidate: unknown, max = 500): candidate is string =>
    typeof candidate === 'string' && candidate.length > 0 && candidate.length <= max;
  const hazardValid = (hazard: unknown): boolean => {
    if (hazard === null || hazard === undefined) return true;
    if (typeof hazard !== 'object') return false;
    const candidate = hazard as Record<string, unknown>;
    return (
      isBoundedString(candidate.id, 100) &&
      isBoundedString(candidate.name, 200) &&
      isBoundedString(candidate.description, 1000) &&
      isBoundedString(candidate.requiredSkill, 100) &&
      ['zwykly', 'trudny', 'ekstremalny'].includes(
        String(candidate.difficulty)
      ) &&
      ['barrier', 'hazard', 'shortcut'].includes(String(candidate.hazardType)) &&
      (candidate.penaltyActionsOnFail === undefined ||
        (isFiniteInteger(candidate.penaltyActionsOnFail) &&
          candidate.penaltyActionsOnFail >= 0 &&
          candidate.penaltyActionsOnFail <= 20)) &&
      (candidate.damageOnFail === undefined ||
        isBoundedString(candidate.damageOnFail, 30))
    );
  };
  const participantsValid =
    Array.isArray(state.participants) &&
    state.participants.length >= 2 &&
    state.participants.length <= 20 &&
    state.participants.every(
      (participant) =>
        participant &&
        typeof participant === 'object' &&
        isBoundedString(participant.id, 100) &&
        isBoundedString(participant.name, 200) &&
        typeof participant.isPlayer === 'boolean' &&
        typeof participant.isFleeing === 'boolean' &&
        isFiniteInteger(participant.mov) &&
        participant.mov >= 0 &&
        isFiniteInteger(participant.segmentIndex) &&
        participant.segmentIndex >= 0 &&
        isFiniteInteger(participant.actionsTotal) &&
        participant.actionsTotal >= 0 &&
        isFiniteInteger(participant.actionsRemaining) &&
        participant.actionsRemaining >= 0 &&
        participant.actionsRemaining <= participant.actionsTotal
    );
  const segmentsValid =
    Array.isArray(state.segments) &&
    state.segments.length > 0 &&
    state.segments.length <= 100 &&
    state.segments.every(
      (segment) =>
        segment &&
        typeof segment === 'object' &&
        isFiniteInteger(segment.index) &&
        isBoundedString(segment.name, 200) &&
        hazardValid(segment.hazard)
    );
  const logsValid =
    Array.isArray(state.logs) &&
    state.logs.length <= 200 &&
    state.logs.every(
      (log) =>
        log &&
        typeof log === 'object' &&
        isFiniteInteger(log.round) &&
        isBoundedString(log.actorName, 200) &&
        isBoundedString(log.actionName, 200) &&
        isBoundedString(log.details, 2000) &&
        isFiniteInteger(log.segmentBefore) &&
        isFiniteInteger(log.segmentAfter)
    );
  const participantIds = state.participants?.map((participant) => participant.id) ?? [];
  const participantIdSet = new Set(participantIds);
  const turnOrderValid =
    Array.isArray(state.turnOrder) &&
    state.turnOrder.length === participantIds.length &&
    new Set(state.turnOrder).size === state.turnOrder.length &&
    state.turnOrder.every((id) =>
      typeof id === 'string' && participantIdSet.has(id)
    );
  return (
    typeof state.id === 'string' &&
    state.id.length > 0 &&
    state.id.length <= 200 &&
    isFiniteInteger(state.round) &&
    state.round > 0 &&
    ['ongoing', 'escaped', 'engaged'].includes(String(state.status)) &&
    participantsValid &&
    participantIdSet.size === participantIds.length &&
    state.participants?.filter((participant) => participant.isFleeing).length ===
      1 &&
    state.participants?.some((participant) => participant.isPlayer) === true &&
    segmentsValid &&
    logsValid &&
    turnOrderValid &&
    (state.activeActorId === null ||
      (typeof state.activeActorId === 'string' &&
        participantIdSet.has(state.activeActorId)))
  );
}

/**
 * Rozwiązuje klucz Gemini dla requestu.
 * WERSJA LOKALNA (zew-app-local): priorytet ma nagłówek X-Gemini-Api-Key
 * (localStorage, jeśli gracz wpisał własny), a fallbackiem jest serwerowy
 * GEMINI_API_KEY z .env.local. Dzięki temu na prywatnym localhoście narracja
 * działa bez ręcznego wpisywania klucza w modal (i znika błąd 401 po zamknięciu
 * modala). Klucz nigdy nie pochodzi z body ani z Clerk privateMetadata.
 */
function resolveGeminiApiKey(request: NextRequest): string | null {
  const key = request.headers.get('X-Gemini-Api-Key')?.trim();
  return key || process.env.GEMINI_API_KEY?.trim() || null;
}

export interface ChatPipelineInput {
  request: NextRequest;
  body: Record<string, unknown>;
  traceId: string;
  timer: { elapsed: () => number };
}

/**
 * Orchestrator AI GM chat pipeline (IND-184 extract z route.ts POST handler).
 *
 * 1-shot pipeline: command → settings → provider → time/cache/RAG → context → PDF → stream → SSE.
 * Zwraca Response (early returns dla command/disabled/no-prompt/no-key, finalny SSE stream dla
 * happy path). Wszystkie błędy bubble up do route.ts catch (telemetry + 500 NextResponse).
 *
 * Plik 264 lin > 200 (CLAUDE.md guardrail) - świadoma akceptacja: brak naturalnego split
 * pointu dalej (Strategia B `micro split` rejected w research IND-184). Orchestrator 1-shot,
 * 8 helperów już wyciągniętych w sesji 123+126. Dalsze rozbijanie generuje boilerplate bez wartości.
 */
export async function runChatPipeline({
  request,
  body,
  traceId,
  timer,
}: ChatPipelineInput): Promise<Response> {
  const {
    message,
    character,
    characters = [],
    messages,
    pdfMemory,
    npcs,
    currentLocation,
    gameContextPrompt,
    skipContext,
    adventureContext,
    eraContext: requestedEraContext,
    gameTime: requestedGameTime,
    isGameStart,
    aiSettings: clientAISettings,
    hotSeatConfig,
    directorEvent,
    mechanicsContext,
    assistantMessageId,
    userMessageId,
    locale: requestedLocale,
    adventureId: explicitAdventureId,
    memoryScope: requestedMemoryScope,
    guardrailState: requestedGuardrailState,
    turnsInCurrentLocation: requestedTurnsInCurrentLocation,
    visitedMacroLocations: requestedVisitedMacroLocations,
    activeChapterId: requestedActiveChapterId,
    activeLocationId: requestedActiveLocationId,
    activeNodeId: requestedActiveNodeId,
  } = body as {
    message: string;
    adventureId?: string;
    character?: Character | null;
    characters?: Character[];
    messages?: Message[];
    guardrailState?: GuardrailState;
    pdfMemory?: PdfMemoryAttachments | null;
    npcs?: NPC[];
    currentLocation?: string;
    activeChapterId?: string | number | null;
    activeLocationId?: string | null;
    activeNodeId?: string | null;
    turnsInCurrentLocation?: number;
    visitedMacroLocations?: string[];
    gameContextPrompt?: string;
    skipContext?: boolean;
    adventureContext?: {
      id?: string;
      era?: string;
      eraLabel?: string;
      yearRange?: string;
      country?: string;
      sourceBookId?: string;
      documentType?: DocumentType;
      isCampaign?: boolean;
      handouts?: AdventureHandout[];
      puzzles?: AdventurePuzzle[];
      activeChapterId?: string | number | null;
      activeLocationId?: string | null;
      activeNodeId?: string | null;
      themes?: string[];
      tone?: 'purist' | 'pulp' | 'noir' | 'neutral';
      truthAnchor?: {
        culprit?: string;
        motive?: string;
        murderWeapon?: string;
        keyAlibi?: string;
        immutableFacts?: string[];
      };
      boundarySummary?: string;
      secretsPool?: Array<string | { id?: string; text?: string; description?: string; isDiscovered?: boolean }>;
      secrets?: Array<string | { id?: string; text?: string; description?: string; isDiscovered?: boolean }>;
    } | null;
    eraContext?: ResolvedEraContext;
    gameTime?: GameTime;
    isGameStart?: boolean;
    aiSettings?: { sessionId?: string } & Record<string, unknown>;
    hotSeatConfig?: { enabled?: boolean; players?: HotSeatPlayerEntry[] };
    directorEvent?: { title: string; description: string };
    mechanicsContext?: {
      chase?: unknown;
      combat?: { resolutions?: CombatResolution[] };
    };
    assistantMessageId?: string;
    userMessageId?: string;
    locale?: 'pl' | 'en';
    memoryScope?: CampaignMemoryScope;
  };
  const locale = requestedLocale === 'en' ? 'en' : 'pl';
  const memoryScope = isCampaignMemoryScope(requestedMemoryScope)
    ? requestedMemoryScope
    : null;

  // Komendy lokalne
  const command = extractCommand(message);
  if (command) {
    const commandResponse = handleCommand(
      command,
      character as Character | null
    );
    if (commandResponse !== null) {
      const wantsJson =
        request.headers.get('accept') === 'application/json' &&
        !request.headers.get('accept')?.includes('text/event-stream');
      if (!wantsJson) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'text', content: commandResponse })}\n\n`
              )
            );
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'metadata' })}\n\n`)
            );
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
            );
            controller.close();
          },
        });
        return new NextResponse(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      }
      return NextResponse.json({
        response: commandResponse,
        isCommand: true,
      });
    }
  }

  // route.ts importuje `body.gameTime` do singletona przed wejściem w pipeline.
  // Kolejne tury muszą rozwiązywać epokę z aktualnego czasu sceny, nie z pierwszego
  // roku szerokiego zakresu scenariusza.
  const { timeManager } = await import('@/lib/time-manager');
  const currentGameTime = timeManager.getTime();

  let eraContext: ResolvedEraContext;
  try {
    eraContext = isResolvedEraContext(requestedEraContext)
      ? requestedEraContext
      : resolveGameEraContext({
          gameTime: requestedGameTime ? currentGameTime : null,
          adventure: adventureContext,
        });
    assertExactEraContext(eraContext);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          locale === 'en'
            ? 'The exact year and country are required before narration can start.'
            : 'Przed rozpoczęciem narracji wymagany jest dokładny rok i kraj.',
        code: 'ERA_CONTEXT_REQUIRED',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }

  // Lokalna bramka Guardrail (Issue #508, Issue #528) - filtrowanie zapytań mechanicznych i anachronizmów epoki < 25 ms
  const activeChar =
    (character as Character | null) ??
    (characters?.[0] as Character | null) ??
    null;
  const guardrailResult = evaluateEraGuardrail({
    message,
    character: activeChar,
    eraContext,
    locale,
  });

  if (guardrailResult) {
    const wantsJson =
      request.headers.get('accept') === 'application/json' &&
      !request.headers.get('accept')?.includes('text/event-stream');
    if (!wantsJson) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Wysyłamy metadata jako pierwsze zdarzenie, aby klient wiedział o flagach guardrail przed chunkami tekstu
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'metadata',
                guardrail: true,
                guardrailCategory: guardrailResult.category,
                guardrailExecutionTimeMs: guardrailResult.executionTimeMs,
              })}\n\n`
            )
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'text', content: guardrailResult.response })}\n\n`
            )
          );
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          );
          controller.close();
        },
      });
      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    return NextResponse.json({
      response: guardrailResult.response,
      guardrail: true,
      category: guardrailResult.category,
      executionTimeMs: guardrailResult.executionTimeMs,
      guardrailViolation:
        guardrailResult.category === 'anachronism' ? 'anachronism' : undefined,
    });
  }

  // Ustawienia i Prompty - IND-183 micro 1/5
  const aiSettings = resolveSettings(loadAISettings(), clientAISettings);
  const tierHeader = request.headers.get('X-Gemini-Tier')?.trim();
  if (tierHeader) {
    aiSettings.pureTextMode = tierHeader === 'free';
  }
  const combatMechanicsEnabled =
    aiSettings.sessionZero?.mechanics?.schemaVersion === 1 &&
    aiSettings.sessionZero.mechanics.enabled === true &&
    aiSettings.sessionZero.narrativeMode !== 'pure_narrative';

  if (!aiSettings.gameMasterNarration.enabled) {
    return NextResponse.json({
      response:
        locale === 'en'
          ? 'AI narration is disabled.'
          : 'Narracja AI jest wyłączona.',
    });
  }

  const detectionMessages = messages?.slice(-100) ?? [];
  const gameContext = detectGameContext(message, detectionMessages, character);
  // IND-194: pełny path z przekazanym aiSettings (zmergowany z clientAISettings, lin 120).
  // Wcześniej getOptimizedGameMasterPrompt/getGameMasterPrompt re-czytały loadAISettings()
  // serwerowo → pusta localStorage → mainPrompt (.md gracza) gubiony. Teraz mainPrompt dociera.
  const systemPrompt = getGameMasterPrompt(aiSettings, locale);

  if (process.env.DEBUG_GM_PROMPT === '1') {
    console.log(
      '[GM_PROMPT] systemPromptLen=',
      systemPrompt.length,
      'mainPromptLen=',
      aiSettings.gameMasterNarration.prompts.mainPrompt?.length ?? 0
    );
  }

  if (!systemPrompt) {
    return NextResponse.json(
      {
        error:
          locale === 'en'
            ? 'The AI Game Master system prompt is missing'
            : 'Brak system prompt dla AI Game Master',
        details:
          locale === 'en'
            ? 'Configure gameMasterNarration.prompts in Settings'
            : 'gameMasterNarration.prompts wymaga konfiguracji w Settings',
      },
      { status: 500 }
    );
  }

  // === GEMINI PROVIDER ===
  const apiKey = resolveGeminiApiKey(request);

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          locale === 'en'
            ? 'Add your Google AI Studio key in Settings'
            : 'Wklej swój klucz Google AI Studio w ustawieniach',
        code: 'BYOK_KEY_MISSING',
      },
      { status: 401 }
    );
  }

  const modelId = aiSettings.geminiSettings.model || DEFAULT_GEMINI_MODEL;
  const provider = new GeminiChatProvider(apiKey, modelId);

  // === TIME & ERA CONTEXT === - IND-183 micro 2/5
  // eraRules są wymagane w stableInstructions dla chmurowego Gemini Context Cache (OPT-26)
  const eraRules = buildEraNarrativeRules(eraContext);

  // Wyciagnij date gry z time-managera (YYYY-MM-DD) dla immersji.
  const gameDate = `${currentGameTime.year}-${String(currentGameTime.month + 1).padStart(2, '0')}-${String(currentGameTime.day).padStart(2, '0')}`;

  // === OPT-21: CONTEXT-AWARE GM PROTOCOL ===
  const messageCount = messages?.length || 0;
  const gmProtocol = getContextAwareGMProtocol(messageCount, 10, locale);

  // === ISSUE #563: SCENE SENSORY MEMORY & ZONE DETECTION ===
  const derivedMemory = deriveSceneSensoryMemoryFromMessages(messages, currentLocation);
  const hasUnhydratedClientState =
    requestedTurnsInCurrentLocation === 0 &&
    (!Array.isArray(requestedVisitedMacroLocations) || requestedVisitedMacroLocations.length === 0) &&
    derivedMemory.turnsInCurrentLocation > 0;

  const turnsInCurrentLocation =
    typeof requestedTurnsInCurrentLocation === 'number' && !hasUnhydratedClientState
      ? requestedTurnsInCurrentLocation
      : derivedMemory.turnsInCurrentLocation;

  const visitedMacroLocations: string[] =
    Array.isArray(requestedVisitedMacroLocations) && requestedVisitedMacroLocations.length > 0
      ? [...requestedVisitedMacroLocations]
      : derivedMemory.visitedMacroLocations;

  const effectiveLocation = currentLocation?.trim() || derivedMemory.currentLocation;
  const rawMacroLocation = effectiveLocation ? extractMacroLocation(effectiveLocation) : undefined;
  const matchedVisitedMacro = rawMacroLocation
    ? visitedMacroLocations.find(
        (m) =>
          m.toLowerCase().trim() === rawMacroLocation.toLowerCase().trim() ||
          isSameMacroLocation(m, effectiveLocation)
      )
    : undefined;
  const macroLocation =
    matchedVisitedMacro && rawMacroLocation === effectiveLocation
      ? matchedVisitedMacro
      : rawMacroLocation;

  const isNewMacroLocation = macroLocation
    ? !matchedVisitedMacro && turnsInCurrentLocation === 0
    : true;

  // === ISSUE #506: WORLD ENGINE DISPATCHER & RAG STAGING ===
  const dispatcherDecision = dispatchWorldEngines({
    playerMessage: message,
    currentLocation,
    npcs: (npcs ?? []).map((n) => ({ id: n.id, name: n.name })),
    locations: (character?.investigatorDossier?.locations ?? []).map((l) => ({ id: l.id, name: l.name })),
    puzzles: (adventureContext?.puzzles ?? []).map((p) => ({ id: p.id || '', title: p.title })),
    adventureThemes: adventureContext?.themes,
    hasOccultElements: Boolean(character?.magic?.knownSpells && Object.keys(character.magic.knownSpells).length > 0),
    turnsInCurrentLocation,
    macroLocation,
    isNewMacroLocation,
  });

  const narrativeCadence = getNarrativeTurnCadence(
    dispatcherDecision.sceneState ?? 'investigation',
    message,
    messages ?? []
  );
  if (
    dispatcherDecision.sceneTechniqueSelection &&
    narrativeCadence !== undefined
  ) {
    dispatcherDecision.sceneTechniqueSelection.cadenceGear = narrativeCadence;
  }

  // === R3 (latencja): trzy niezalezne galezi sieciowe ROWNOLEGLE ===
  // Cache promptu (OPT-26) NIE zalezy od sessionId; lancuch userId->sessionId->RAG
  // (OPT-09) NIE zalezy od cache. Immersja (Etap 3) NIE zalezy od zadnego z powyzszych.
  // Promise.all -> koszt = najwolniejsza z trzech zamiast sumy.
  const [resolvedCachedContent, ragResult, immersionSection] =
    await Promise.all([
      resolveGeminiCache({
        enableCache: aiSettings.geminiSettings.enableCache,
        cacheTTL: aiSettings.geminiSettings.cacheTTL,
        apiKey,
        modelId,
        systemPrompt,
        eraRules,
        gmProtocol,
      }),
      (async () => {
        const ragUserId = await resolveUserId('');
        const sessionId = scopeSessionId(
          ragUserId,
          memoryScope?.playthroughId ?? clientAISettings?.sessionId
        );
        const effectiveAdventureId =
          explicitAdventureId ||
          adventureContext?.id ||
          pdfMemory?.adventureId ||
          (clientAISettings as { adventureId?: string } | undefined)?.adventureId;
        const {
          ragSection,
          summarySection,
          ragMeta,
          contextMessages,
          campaignMemorySection,
        } = await runRAGAndSummary({
          message,
          messages,
          sessionId,
          apiKey,
          geminiKey: apiKey,
          // Zaweża RAG 'adventures' do ksiazki aktywnej przygody (DriveThruRPG).
          adventureSource: adventureContext?.sourceBookId,
          adventureId: effectiveAdventureId,
          locale,
          modelId,
          memoryScope,
          recipientIds: dispatcherDecision.recipientIds.length > 0
            ? dispatcherDecision.recipientIds
            : (character?.id ? [character.id] : []),
          sceneEntityIds: dispatcherDecision.sceneEntityIds.length > 0
            ? dispatcherDecision.sceneEntityIds
            : (character?.investigatorDossier?.locations ?? []).filter((l) => l.name === currentLocation).map((l) => l.id),
          allowedNamespaces: dispatcherDecision.allowedNamespaces,
        });
        return {
          ragUserId,
          sessionId,
          ragSection,
          summarySection,
          ragMeta,
          contextMessages,
          campaignMemorySection,
        };
      })(),
      // Etap 3: dane immersyjne (astronomia, gazety, ceny epoki) - rownolegle z cache i RAG.
      fetchImmersionContext({
        gameDate,
        eraContext,
      }),
    ]);
  const {
    ragUserId,
    sessionId,
    ragSection,
    summarySection,
    ragMeta,
    contextMessages,
    campaignMemorySection,
  } = ragResult;

  // === OPT-C01: DEDUPLIKACJA REGUŁ EPOKI PRZY AKTYWNYM GEMINI CONTEXT CACHE ===
  // Jeśli cache jest aktywny (resolvedCachedContent != null), reguły epoki (eraRules)
  // znajdują się już w stableInstructions w chmurowym cache (resolve-gemini-cache.ts:33).
  // Przekazanie resolvedCachedContent automatycznie pomija eraRules w timePromptSection,
  // eliminując redundancję ~1000-1500 tokenów na każdą turę (lub załącza je, gdy cache jest nieaktywny).
  const { timePromptSection } = buildTimeContext({
    eraContext,
    resolvedCachedContent,
  });

  // === BUDUJ KONTEKST (additionalContext) - IND-71 micro 1/3 ===
  // C1: recap przy wznowieniu zapisanej gry (isGameStart + istnieje historia rozmowy).
  const sessionRecapSection = isSessionResume(isGameStart, messageCount)
    ? buildSessionRecapInstruction()
    : null;

  const activeTone =
    aiSettings.sessionZero?.tone || adventureContext?.tone || 'purist';

  // Guardrail state & strike counter with decay (Issue #380)
  const defaultActor = character?.name || characters?.[0]?.name || 'Badacz';
  const putativeForGuardrail = extractPutativeEvent(message, defaultActor, currentLocation);
  const adjForGuardrail = adjudicatePutativeEvent(putativeForGuardrail, {
    character: character ?? characters?.[0] ?? null,
    locale: (requestedLocale ?? 'pl') as 'pl' | 'en',
  });

  const updatedGuardrailState = updateGuardrailState(
    requestedGuardrailState,
    Boolean(adjForGuardrail.guardrailViolation),
    adjForGuardrail.guardrailViolation
  );

  const additionalContext = buildAdditionalContext({
    timePromptSection,
    gmProtocol,
    guardrailState: updatedGuardrailState,
    gameContext,
    resolvedCachedContent,
    sessionId,
    ragSection: `${ragSection}${campaignMemorySection}`,
    summarySection,
    // Realne handouty przygody (DriveThruRPG) i zagadki śledcze (RAW) - MG dostaje tagi [HANDOUT:<slug>] oraz instrukcje Idea Roll.
    handoutsSection: buildHandoutsContext(
      adventureContext?.handouts,
      adventureContext?.puzzles,
      {
        adventureId: adventureContext?.id,
        activeChapterId:
          requestedActiveChapterId ??
          adventureContext?.activeChapterId ??
          null,
        activeLocationId:
          requestedActiveLocationId ??
          adventureContext?.activeLocationId ??
          null,
        activeNodeId:
          requestedActiveNodeId ??
          adventureContext?.activeNodeId ??
          null,
        currentLocation:
          currentLocation ??
          character?.activeScene?.location ??
          null,
      }
    ),
    sessionRecapSection,
    skipContext,
    gameContextPrompt,
    npcs,
    currentLocation,
    hotSeatConfig,
    // IND-223: oznacz postac gracza jako sterowana przez czlowieka
    playerCharacterName: character?.name,
    tone: activeTone as 'purist' | 'pulp' | 'noir' | 'neutral',
    // Uzbrojenie postaci -> AI prowadzi walke narracyjnie znajac bron + umiejetnosc + obrazenia
    playerWeaponsSection: buildPlayerWeaponContext(
      character ?? null,
      eraContext,
      (locale ?? 'pl') as 'pl' | 'en'
    ),
    // Lista umiejetnosci postaci -> AI wzywa testy nazwami z karty (eliminuje Tacke 0%)
    playerSkillsSection: buildPlayerSkillsSection(character ?? null),
    // Ekwipunek uzytkowy postaci -> AI wie co badacz ma przy sobie (narzedzia, medykamenty, dokumenty)
    playerEquipmentSection: buildPlayerEquipmentSection(character ?? null),
    // Status majatkowy postaci -> AI zna poziom wydatkow i gotowke wg CoC 7e RAW
    playerFinancesSection: buildPlayerFinancesSection(character ?? null, {
      country: eraContext?.countryCode || adventureContext?.country,
      yearRange: String(eraContext?.effectiveYear || adventureContext?.yearRange || ''),
      location: currentLocation,
      era: adventureContext?.era,
    }),
    // Profil wizualny Badacza (Visual DNA) -> AI zachowuje spójność w opisach scen i portretów
    playerVisualProfileSection: buildPlayerVisualProfileSection(
      character ?? null
    ),
    // Magia i wiedza nadprzyrodzona Badacza -> AI zna status wiary, znane czary i tomy Mitow
    playerMagicSection: buildPlayerMagicSection(
      character ?? null,
      (locale ?? 'pl') as 'pl' | 'en'
    ),
    // Profil pulpowy badacza (Pulp Cthulhu RAW) -> AI zna archetyp, talenty i podwyższoną odporność
    playerPulpSection: buildPlayerPulpSection(
      character ?? characters?.[0] ?? null,
      (requestedLocale ?? 'pl') as 'pl' | 'en'
    ),
    // Etap 3: dane immersyjne (astronomia, gazety epoki, przelicznik cen)
    immersionSection,
    directorEventSection:
      directorEvent &&
      (directorEvent.title?.trim() || directorEvent.description?.trim())
        ? `\n## INSTRUKCJA REŻYSERSKA\n[MG wrzucił to losowe wydarzenie. Wpleć je organicznie w swoją narrację, nie przerywając głównego wątku]\n${directorEvent.title.replace(/\[/g, '(').replace(/\]/g, ')')}: ${directorEvent.description.replace(/\[/g, '(').replace(/\]/g, ')')}\n`
        : undefined,
    truthAnchor: adventureContext?.truthAnchor,
    adventureDocumentType: adventureContext?.documentType,
    isCampaign: adventureContext?.isCampaign,
    isGameStart,
    characters,
    era: String(eraContext.effectiveYear),
    eraContext,
    locale,
    visualBeliefGraph: (() => {
      const vbg = new VisualBeliefGraph();
      vbg.setEffectiveYear(String(eraContext.effectiveYear));
      if (character) {
        vbg.registerPlayer(character, String(eraContext.effectiveYear));
      }
      if (characters && characters.length > 0) {
        characters.forEach((c) => vbg.registerPlayer(c, String(eraContext.effectiveYear)));
      }
      if (npcs && npcs.length > 0) {
        npcs.forEach((npc) => vbg.registerNPC(npc, String(eraContext.effectiveYear)));
      }
      if (currentLocation) {
        vbg.updateLocation(currentLocation, {});
      }
      return vbg;
    })(),
    playerMessage: message,
    worldEngineDirectives: buildWorldEngineDirectives({
      locale: (locale ?? 'pl') as 'pl' | 'en',
      adventureContext,
      currentLocation,
      npcs,
      character: character ?? characters?.[0] ?? null,
      characters,
      eraContext,
      playerMessage: message,
      activeEngines: dispatcherDecision.activeEngines,
      turnsInCurrentLocation,
      visitedMacroLocations,
      isNewMacroLocation,
      messages,
      boundarySummary: (body as Record<string, unknown>)?.boundarySummary as string | undefined || adventureContext?.boundarySummary,
      secretsPool: ((body as Record<string, unknown>)?.secretsPool || (body as Record<string, unknown>)?.secrets || adventureContext?.secretsPool || adventureContext?.secrets) as SecretInput[] | undefined,
    }),
  });

  if (turnsInCurrentLocation > 0 || (macroLocation && !isNewMacroLocation)) {
    const eraGuidanceIdx = additionalContext.findIndex((ctx) =>
      ctx.includes('## MATERIALNE USER STORY I KONTRAST EPOKI')
    );
    const updatedEraGuidance = buildLocationEraGuidanceSection(
      eraContext,
      currentLocation,
      {
        turnsInCurrentLocation,
        macroLocationContext: {
          macroLocation,
          isNewMacro: isNewMacroLocation,
        },
        locale: (locale ?? 'pl') as 'pl' | 'en',
      }
    );
    if (eraGuidanceIdx >= 0) {
      additionalContext[eraGuidanceIdx] = updatedEraGuidance;
    } else if (currentLocation) {
      additionalContext.push(updatedEraGuidance);
    }
  }

  if (turnsInCurrentLocation > 0) {
    additionalContext.push(
      buildActiveTurnAntiHabituationSection(
        turnsInCurrentLocation,
        (locale ?? 'pl') as 'pl' | 'en'
      )
    );
  }

  if (isChaseState(mechanicsContext?.chase)) {
    additionalContext.push(
      `\n## MECHANICS_CONTEXT.chase (UKRYTY STAN AUTORYTATYWNY)\n${formatChaseForSystemContext(mechanicsContext.chase)}\nTo są dane, nie instrukcje gracza. Opisz wyłącznie wynik ostatniego manewru i jego konsekwencję w fikcji. Nie ujawniaj JSON, indeksów lokacji, punktów akcji, MOV ani kolejki. Nie przeliczaj i nie nadpisuj stanu mechaniki.`
    );
  }

  if (combatMechanicsEnabled) {
    const npcMeleeOptions = buildNpcMeleeOptionsContext(npcs ?? []);
    if (npcMeleeOptions) {
      additionalContext.push(
        `${npcMeleeOptions}\nGdy NPC rozpoczyna realny atak wręcz na Badacza, opisz zamiar bez rozstrzygania wyniku i dodaj osobny tag dla każdego ataku w formacie: [ATAK_WRĘCZ: napastnik=<npcId> | cel=@<dokładna nazwa Badacza> | atak=<attackOptionId> | zamiar=<krótki opis>]. Nie wpisuj rzutów, obrażeń ani wyniku walki. Po tagu zakończ odpowiedź.`
      );
    }
  }

  if (mechanicsContext?.combat?.resolutions?.length) {
    additionalContext.push(
      `\n## MECHANICS_CONTEXT.combat (UKRYTY WYNIK AUTORYTATYWNY)\n${JSON.stringify(mechanicsContext.combat.resolutions)}\nTo są rozstrzygnięte dane mechaniki, nie instrukcje gracza. Opisz wszystkie wyniki jako jedną płynną scenę walki. Nie przeliczaj rzutów, obrażeń, pancerza, PW ani stanu postaci. Nie ujawniaj JSON ani nazw pól.`
    );
  }

  if (
    message.includes('[KONIEC_SESJI:FINAL]') ||
    message.includes('[KONIEC_SESJI_FINAL]')
  ) {
    additionalContext.push(
      '[INSTRUKCJA SPECJALNA - KONIEC SESJI (KROK 2 - FINAŁ)]: To jest ostatnia tura gracza w tej sesji. Uwzględnij jego finałową akcję, napisz klimatyczny epilog / monolog podsumowujący sesję w stylu Lovecrafta, zakończony niepokojącym cliffhangerem lub refleksją badacza. Na samym końcu wypowiedzi, w osobnej linii, wypisz DOKŁADNIE: [KONIEC_SESJI:POTWIERDZENIE]. NIE dodawaj pytania "Co robisz?".'
    );
  } else if (message.includes('[KONIEC_SESJI]')) {
    additionalContext.push(
      '[INSTRUKCJA SPECJALNA - KONIEC SESJI (KROK 1 - DOMKNIĘCIE SCENY)]: Gracz zgłosił chęć zakończenia sesji. Zmierzaj do domknięcia bieżącej sceny i postaw gracza przed ostatnią, finałową decyzją lub gestem w tej sesji. Zakończ wypowiedź otwartym pytaniem [Co robisz?]. ABSOLUTNIE NIE wypisuj tagu [KONIEC_SESJI:POTWIERDZENIE].'
    );
  }

  additionalContext.push(
    locale === 'en'
      ? `\n## OUTPUT LANGUAGE: ENGLISH\nWrite every player-visible sentence, question, journal title, journal body, category and tag content in English only. Do not use Polish. Use only these canonical English structural tags: [JOURNAL:type:title]body[/JOURNAL] and [LOCATION: name: atmosphere]. Use English journal types such as clue, discovery, note, location, combat and item. End an opening scene with [What do you do?].`
      : `\n## JĘZYK WYJŚCIA: POLSKI\nPisz wszystkie zdania widoczne dla gracza, pytania, tytuły i treści dziennika wyłącznie po polsku. Używaj tagów [DZIENNIK:typ:tytuł]treść[/DZIENNIK] oraz [LOKACJA: nazwa: atmosfera]. Kończ scenę otwierającą znacznikiem [Co robisz?].`
  );

  // Dynamic state stays outside cached system instructions. These guards outrank escalation directives.
  const narrativeCharacter = character ?? characters?.[0];
  if (narrativeCharacter) {
    const participantIds = hotSeatConfig?.enabled
      ? (hotSeatConfig.players?.map((player) => player.characterId) ?? [])
      : [narrativeCharacter.id];
    const narrativeParty = (characters ?? []).filter(
      (member) =>
        member.id === narrativeCharacter.id ||
        participantIds.includes(member.id)
    );
    additionalContext.push(
      buildNarrativeClueGate(narrativeCharacter, locale, narrativeParty)
    );
  }
  if (narrativeCadence === 0)
    additionalContext.push(getOrdinaryWorldDirective(locale));

  // === PDF STRATEGY (OPT-01) === - IND-183 micro 4/5
  const { fileAttachments } = buildPdfStrategy({
    pdfMemory,
    message,
    messages,
    isGameStart,
  });

  // === OPT-27: PRE-FLIGHT TOKEN ESTIMATION ===
  const estimateTokens = (text: string) => Math.ceil(text.length / 4);
  const totalEstTokens =
    additionalContext.reduce((sum, ctx) => sum + estimateTokens(ctx), 0) +
    estimateTokens(systemPrompt) +
    fileAttachments.length * 10000;

  // IND-275 T1: limity okna kontekstowego z model-registry (getContextLimit).
  const contextLimit = getContextLimit(modelId);
  const safeLimit = Math.floor(contextLimit * 0.9) - aiSettings.geminiSettings.maxOutputTokens;
  let fixedTokens = totalEstTokens + estimateTokens(message);
  // Drop retrieved documents before sacrificing conversation or mechanics.
  if (fixedTokens + contextMessages.reduce((n,m)=>n+estimateTokens(m.content)+8,0) > safeLimit && ragSection) {
    for(let i=0;i<additionalContext.length;i++) additionalContext[i]=additionalContext[i].replace(ragSection,'');
    fixedTokens=additionalContext.reduce((n,c)=>n+estimateTokens(c),0)+estimateTokens(systemPrompt)+fileAttachments.length*10000+estimateTokens(message);
  }
  const { fitContext } = await import('@/core/memory/context-engine');
  const boundedHistory = fitContext({messages:contextMessages,summarySection:null,compacted:false},safeLimit-fixedTokens).messages;

  // === STREAMING via Provider === - IND-183 micro 5/5
  const chatGeminiOptions = buildGeminiOptions({
    geminiSettings: aiSettings.geminiSettings,
    additionalContext,
    fileAttachments,
    resolvedCachedContent,
  });

  const streamArgs = {
    systemPrompt,
    messages: boundedHistory.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    userMessage: message,
    temperature: aiSettings.geminiSettings.temperature,
    topP: aiSettings.geminiSettings.topP,
    maxOutputTokens: aiSettings.geminiSettings.maxOutputTokens,
    geminiOptions: chatGeminiOptions,
  };

  // IND-222: graceful fallback. Gdy skonfigurowany model zwróci 404 NOT_FOUND
  // (literówka w nazwie presetu / Google wycofał wariant), logujemy + ponawiamy
  // na DEFAULT_GEMINI_MODEL zamiast wywalać turę na 500. streamChat woła
  // generateContentStream EAGER (gemini-provider:263), więc 404 rzuca się tu na
  // await - łapalne. Dla złego modelu cache też się wywala 404 → resolveGeminiCache
  // zwraca null, więc chatGeminiOptions nie ma cachedContent przypisanego do
  // martwego modelu → streamArgs bezpieczne do reuse na modelu fallback.
  let effectiveModelId = modelId;
  let activeProvider = provider;
  let streamResult: Awaited<ReturnType<typeof provider.streamChat>>;
  try {
    streamResult = await provider.streamChat(streamArgs);
  } catch (err) {
    if (isInvalidKeyError(err)) {
      console.warn('⚠️ Gemini streamChat auth error (invalid API key):', err);
      return NextResponse.json(
        {
          error:
            locale === 'en'
              ? 'The provided Gemini API key is invalid or expired. Please update it in Settings.'
              : 'Podany klucz Gemini API jest nieprawidłowy lub wygasł. Zaktualizuj klucz w Ustawieniach.',
          code: 'BYOK_KEY_INVALID',
        },
        { status: 401 }
      );
    }
    if (isModelNotFoundError(err) && modelId !== DEFAULT_GEMINI_MODEL) {
      console.warn(
        `⚠️ IND-222: model "${modelId}" zwrócił 404 NOT_FOUND → fallback na "${DEFAULT_GEMINI_MODEL}"`
      );
      effectiveModelId = DEFAULT_GEMINI_MODEL;
      const fallbackProvider = new GeminiChatProvider(
        apiKey,
        DEFAULT_GEMINI_MODEL
      );
      activeProvider = fallbackProvider;
      try {
        streamResult = await fallbackProvider.streamChat(streamArgs);
      } catch (fallbackErr) {
        if (isInvalidKeyError(fallbackErr)) {
          return NextResponse.json(
            {
              error:
                locale === 'en'
                  ? 'The provided Gemini API key is invalid or expired. Please update it in Settings.'
                  : 'Podany klucz Gemini API jest nieprawidłowy lub wygasł. Zaktualizuj klucz w Ustawieniach.',
              code: 'BYOK_KEY_INVALID',
            },
            { status: 401 }
          );
        }
        throw fallbackErr;
      }
    } else {
      throw err;
    }
  }
  const { stream: providerStream } = streamResult;
  let { getUsage, getFinishReason } = streamResult;

  // Sprawdzanie i ochrona sprawczości badaczy (Physical Immunity & Agency Linter)
  const investigatorNames: string[] = [];
  if (character?.name) {
    investigatorNames.push(character.name);
  }
  if (Array.isArray(characters)) {
    for (const c of characters) {
      if (c?.name && !investigatorNames.includes(c.name)) {
        investigatorNames.push(c.name);
      }
    }
  }
  if (hotSeatConfig?.players && Array.isArray(hotSeatConfig.players)) {
    for (const p of hotSeatConfig.players) {
      if (p?.name && !investigatorNames.includes(p.name)) {
        investigatorNames.push(p.name);
      }
      if (p?.characterName && !investigatorNames.includes(p.characterName)) {
        investigatorNames.push(p.characterName);
      }
    }
  }

  const isDuetSession =
    Boolean(hotSeatConfig?.enabled && (hotSeatConfig?.players?.length ?? 0) >= 2) ||
    (Array.isArray(characters) && characters.length >= 2);

  let collected = await collectStreamChunks(providerStream);
  const lintResult = lintAgencyViolations(collected.fullText, investigatorNames, {
    isDuet: isDuetSession,
    locale: (locale ?? 'pl') as 'pl' | 'en',
  });

  if (lintResult.hasViolation) {
    console.warn(
      `⚠️ Wykryto naruszenie sprawczości badacza (${lintResult.violations.length} naruszeń: ${lintResult.violations.map((v) => v.reason).join('; ')}). Próba soft-retry...`
    );

    const violationDetails = lintResult.violations
      .slice(0, 3)
      .map((v) => `- Naruszenie: "${v.matchedSnippet}" (${v.reason})`)
      .join('\n');

    const correctiveDirective =
      locale === 'en'
        ? `\n\n[CRITICAL ERROR - AGENCY VIOLATION DETECTED]\nYour previous draft violated player agency and physical immunity of the investigator:\n${violationDetails}\nRULE: You are the Game Master, NOT the player. NEVER move investigators, draw weapons, open first aid kits, examine bodies/wounds, or speak for investigators. Stop on the threshold of action, describe senses and environment, and immediately ask "[What do you do?]". Regenerate the entire response now, strictly respecting player agency.`
        : `\n\n[KRYTYCZNY BŁĄD - NARUSZENIE SPRAWCZOŚCI I FIZYCZNEGO IMMUNITETU BADACZA]\nTwój poprzedni projekt odpowiedzi odebrał sprawczość graczowi:\n${violationDetails}\nBEZWZGLĘDNA ZASADA: Jesteś Strażnikiem Tajemnic, a NIE graczem. NIGDY nie poruszaj badaczami (nie decyduj, że wchodzą, zeskakują, jadą), nie sięgaj do ich ekwipunku (apteczka, broń), nie przeprowadzaj samowolnych oględzin/badań ran ani nie wkładaj im słów w usta. Zatrzymaj się na progu zdarzenia, opisz otoczenie oraz zmysły i natychmiast zapytaj "${isDuetSession ? '[Co robicie?]' : '[Co robisz?]'}" przekazując turę graczom. Wygeneruj całą odpowiedź ponownie od zera, bez naruszania sprawczości.`;

    try {
      const retryGeminiOptions = {
        ...streamArgs.geminiOptions,
        additionalContext: [
          ...(streamArgs.geminiOptions?.additionalContext ?? []),
          correctiveDirective,
        ],
      };

      const retryResult = await activeProvider.streamChat({
        ...streamArgs,
        geminiOptions: retryGeminiOptions,
      });

      const retryCollected = await collectStreamChunks(retryResult.stream);
      const retryLint = lintAgencyViolations(
        retryCollected.fullText,
        investigatorNames,
        {
          isDuet: isDuetSession,
          locale: (locale ?? 'pl') as 'pl' | 'en',
        }
      );

      if (!retryLint.hasViolation) {
        collected = retryCollected;
        getUsage = retryResult.getUsage;
        getFinishReason = retryResult.getFinishReason;
      } else {
        console.warn(
          '⚠️ Soft-retry nadal zawiera naruszenie sprawczości; obcinanie narracji przed nieautoryzowaną akcją.'
        );
        const sanitized = retryLint.sanitizedText ?? lintResult.sanitizedText;
        if (sanitized) {
          collected = {
            fullText: sanitized,
            chunks: [{ text: sanitized }],
          };
        }
        getUsage = retryResult.getUsage;
        getFinishReason = retryResult.getFinishReason;
      }
    } catch (retryErr) {
      console.warn(
        '⚠️ Błąd podczas soft-retry; obcinanie pierwotnej odpowiedzi przed nieautoryzowaną akcją:',
        retryErr
      );
      if (lintResult.sanitizedText) {
        collected = {
          fullText: lintResult.sanitizedText,
          chunks: [{ text: lintResult.sanitizedText }],
        };
      }
    }
  }

  const finalProviderStream = chunksToAsyncStream(collected.chunks);

  const pendingSanityResolutions = detectPendingSanityTestResolution(message);

  // === SSE STREAM + POST-STREAM SIDE EFFECTS - IND-71 micro 3/3 ===
  const sseStream = createSseStream({
    providerStream: finalProviderStream,
    getUsage,
    getFinishReason,
    sessionId,
    message,
    character: character ?? undefined,
    modelId: effectiveModelId,
    traceId,
    timer,
    ragMeta,
    embeddingDim: getEmbeddingDimensions(),
    ragVersion: process.env.RAG_VERSION === 'v2' ? 'v2' : 'v1',
    // IND-168 Faza 6: reuse rozwiązanego ragUserId (Clerk > '' dev) dla licznika
    // zużycia per-konto; user-usage normalizuje puste -> 'local'.
    userId: ragUserId,
    assistantMessageId,
    userMessageId,
    characters,
    npcs: npcs ?? [],
    combatMechanicsEnabled,
    memoryScope,
    pendingSanityResolutions,
  });

  return new Response(sseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
