import type { NextRequest } from 'next/server';
import { POST } from './route';
import { runChatPipeline } from './_helpers/run-chat-pipeline';
import { CampaignContextBudgetError } from '@/lib/ai-providers/context-budget';
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));
jest.mock('./_helpers/run-chat-pipeline', () => ({
  runChatPipeline: jest.fn(),
}));
jest.mock('@/lib/vector-db/local-vector-store', () => ({
  localVectorStore: { initialize: jest.fn() },
}));
jest.mock('@/lib/time-manager', () => ({ timeManager: { import: jest.fn() } }));
jest.mock('@/lib/telemetry', () => ({
  logApiEvent: jest.fn(async () => {}),
  generateTraceId: () => 'test',
  startTimer: () => ({ elapsed: () => 0 }),
}));
it.each(['pl', 'en'])(
  'returns a typed 422 without narration or technical details (%s)',
  async (locale) => {
    jest
      .mocked(runChatPipeline)
      .mockRejectedValueOnce(new CampaignContextBudgetError(100, 50));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await POST({
        headers: { get: () => null },
        json: async () => ({ message: 'wait', locale }),
      } as unknown as NextRequest);
      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        code: 'CAMPAIGN_CONTEXT_BUDGET_EXCEEDED',
      });
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  }
);
