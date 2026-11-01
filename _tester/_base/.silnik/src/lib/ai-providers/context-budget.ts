import type { ChatCompletionRequest } from './types';

export const CONTEXT_BUDGET_ERROR_CODE = 'CAMPAIGN_CONTEXT_BUDGET_EXCEEDED';
export const CACHE_ACKNOWLEDGEMENT =
  'Rozumiem kontekst gry, zasady epoki i protokół MG. Czekam na wiadomość gracza.';

export class CampaignContextBudgetError extends Error {
  readonly code = CONTEXT_BUDGET_ERROR_CODE;
  constructor(
    readonly requiredTokens: number,
    readonly availableTokens: number
  ) {
    super(
      `Campaign input requires ${requiredTokens} estimated tokens; ${availableTokens} available`
    );
    this.name = 'CampaignContextBudgetError';
  }
}

export const estimateTokens = (text: string): number =>
  Math.ceil(text.length / 4);

// Shared with the provider so the estimate includes the actual wire envelope.
export function formatChatTurn(
  request: Pick<ChatCompletionRequest, 'messages' | 'userMessage'>
): string {
  const history = request.messages
    .map((m) => `${m.role === 'user' ? 'G' : 'MG'}: ${m.content}`)
    .join('\n');
  return `\nHISTORIA:\n${history}\n\nAKTUALNA WIADOMOŚĆ:\n<user_input>\n${request.userMessage}\n</user_input>\n\nODPOWIEDŹ:`;
}

export function estimateRequestTokens(
  request: ChatCompletionRequest,
  cachedInstructions = ''
): number {
  const cache = request.geminiOptions?.resolvedCachedContent;
  const reported = cache?.usageMetadata?.totalTokenCount;
  const system = cache
    ? typeof reported === 'number' && Number.isFinite(reported) && reported > 0
      ? reported
      : estimateTokens(request.systemPrompt) +
        estimateTokens(cachedInstructions) +
        estimateTokens(CACHE_ACKNOWLEDGEMENT) +
        16
    : estimateTokens(request.systemPrompt);
  // Eight tokens per history entry conservatively cover role and boundary overhead.
  return (
    system +
    estimateTokens(formatChatTurn({ ...request, messages: [] })) +
    request.messages.reduce((n, m) => n + estimateTokens(m.content) + 8, 0) +
    (request.geminiOptions?.tools?.length
      ? estimateTokens(JSON.stringify(request.geminiOptions.tools)) + 8
      : 0) +
    (request.geminiOptions?.responseSchema
      ? estimateTokens(JSON.stringify(request.geminiOptions.responseSchema))
      : 0) +
    (
      request.geminiOptions?.additionalContext ??
      request.additionalContext ??
      []
    ).reduce((n, s) => n + estimateTokens(s), 0) +
    (request.geminiOptions?.fileAttachments ?? request.fileAttachments ?? [])
      .length *
      10_000
  );
}

export function remainingCampaignBudget(
  request: ChatCompletionRequest,
  contextLimit: number,
  cachedInstructions = ''
): number {
  return (
    Math.floor(contextLimit * 0.9) -
    request.maxOutputTokens -
    estimateRequestTokens(request, cachedInstructions)
  );
}

export function assertRequestBudget(
  request: ChatCompletionRequest,
  contextLimit: number,
  cachedInstructions = ''
): void {
  const available = Math.floor(contextLimit * 0.9) - request.maxOutputTokens;
  const required = estimateRequestTokens(request, cachedInstructions);
  if (!Number.isFinite(available) || required > available)
    throw new CampaignContextBudgetError(required, available);
}
