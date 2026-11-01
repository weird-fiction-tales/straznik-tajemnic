import {
  estimateRequestTokens,
  remainingCampaignBudget,
  assertRequestBudget,
  CACHE_ACKNOWLEDGEMENT,
} from './context-budget';
import type { ChatCompletionRequest } from './types';

const request: ChatCompletionRequest = {
  systemPrompt: 'S'.repeat(40),
  userMessage: 'hello',
  messages: [],
  maxOutputTokens: 100,
  temperature: 0.7,
  topP: 0.9,
  geminiOptions: { additionalContext: ['fixed'] },
};
describe('shared outbound budget', () => {
  it('accepts the exact boundary and rejects one token less without mutating input', () => {
    const cost = estimateRequestTokens(request);
    const limit = Math.ceil((cost + 100) / 0.9);
    expect(remainingCampaignBudget(request, limit)).toBe(
      Math.floor(limit * 0.9) - 100 - cost
    );
    expect(() => assertRequestBudget(request, limit)).not.toThrow();
    expect(() =>
      assertRequestBudget(request, Math.floor((cost + 99) / 0.9))
    ).toThrow();
    expect(request.messages).toEqual([]);
  });
  it('counts cache metadata once instead of system instructions', () => {
    const cached = {
      ...request,
      geminiOptions: {
        ...request.geminiOptions,
        resolvedCachedContent: {
          name: 'cache',
          usageMetadata: { totalTokenCount: 250 },
        },
      },
    };
    expect(estimateRequestTokens(cached)).toBe(
      estimateRequestTokens(request) - 10 + 250
    );
  });
  it('counts the actual cached payload if usage metadata is absent', () => {
    const cached = {
      ...request,
      geminiOptions: {
        ...request.geminiOptions,
        resolvedCachedContent: { name: 'cache' },
      },
    };
    const stable = 'era\n\nprotocol';
    expect(estimateRequestTokens(cached, stable)).toBeGreaterThanOrEqual(
      estimateRequestTokens(request) +
        Math.ceil(stable.length / 4) +
        Math.ceil(CACHE_ACKNOWLEDGEMENT.length / 4)
    );
  });
  it('includes history, the current message and wire envelope', () => {
    const withHistory = {
      ...request,
      messages: [{ role: 'user' as const, content: 'hello' }],
    };
    expect(estimateRequestTokens(withHistory)).toBeGreaterThan(
      estimateRequestTokens(request)
    );
    expect(estimateRequestTokens(request)).toBeGreaterThan(10 + 2 + 2);
  });
  it('reserves space for configured tool declarations and response schemas', () => {
    const configured = {
      ...request,
      geminiOptions: {
        tools: [{ name: 'lookup', description: 'x'.repeat(400) }],
        responseSchema: { description: 'y'.repeat(400) },
      },
    };
    expect(
      estimateRequestTokens(configured) - estimateRequestTokens(request)
    ).toBeGreaterThanOrEqual(200);
  });
});
