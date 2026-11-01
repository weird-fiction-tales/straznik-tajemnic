import {
  isModelNotFoundError,
  isInvalidKeyError,
  isQuotaOrCreditsError,
  isPrepaymentCreditsError,
} from './model-fallback';

describe('model-fallback helper functions', () => {
  describe('isModelNotFoundError', () => {
    it('returns true for status 404', () => {
      expect(isModelNotFoundError({ status: 404, message: 'Not found' })).toBe(true);
    });

    it('returns true for message containing NOT_FOUND', () => {
      expect(isModelNotFoundError({ message: 'models/gemini-2.0-flash is NOT_FOUND' })).toBe(true);
    });

    it('returns false for unrelated errors', () => {
      expect(isModelNotFoundError({ status: 500, message: 'Server error' })).toBe(false);
      expect(isModelNotFoundError(null)).toBe(false);
    });
  });

  describe('isInvalidKeyError', () => {
    it.each([
      { status: 400, message: '{"error":{"code":400,"message":"Request contains an invalid argument.","status":"INVALID_ARGUMENT"}}' },
      { status: 400, message: 'INVALID_ARGUMENT: temperature/topP/topK are unsupported for this model' },
      { status: 400, message: 'INVALID_ARGUMENT: thinkingBudget is not supported' },
      { status: 403, message: 'PERMISSION_DENIED: this project cannot access the selected model' },
      { status: 403, message: 'PERMISSION_DENIED: API key restrictions block this service' },
      { status: 429, message: 'RESOURCE_EXHAUSTED: daily quota exceeded' },
      { status: 503, message: 'UNAVAILABLE: high demand' },
    ])('does not classify configuration, permission or availability failures as an invalid key: %j', (error) => {
      expect(isInvalidKeyError(error)).toBe(false);
    });

    it.each([
      { status: 400, message: 'API key expired. Please renew the API key.' },
      { status: 403, message: 'API key is invalid' },
      { status: 400, message: 'Invalid API key supplied' },
      { status: 401, message: 'UNAUTHENTICATED: credentials are invalid' },
      { status: 'UNAUTHENTICATED', message: 'Request has invalid authentication credentials' },
      { code: 401, message: 'Unauthorized' },
      { status: 400, message: '{"error":{"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}' },
    ])('retains explicit authentication failures: %j', (error) => {
      expect(isInvalidKeyError(error)).toBe(true);
    });

    it('returns true for the explicit API_KEY_INVALID reason', () => {
      expect(isInvalidKeyError({ status: 400, message: 'API_KEY_INVALID' })).toBe(true);
    });

    it('returns true for API key not valid message', () => {
      expect(isInvalidKeyError(new Error('API key not valid. Please pass a valid API key.'))).toBe(true);
    });
  });

  describe('isQuotaOrCreditsError', () => {
    it('detects HTTP 402 prepayment credits depleted from Google AI Studio SDK', () => {
      const googleRawError = new Error(
        '{"error":{"code":402,"message":"Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing. Learn more at https://ai.google.dev/gemini-api/docs/billing#prepay. ","status":"RESOURCE_EXHAUSTED"}}'
      );
      expect(isQuotaOrCreditsError(googleRawError)).toBe(true);
      expect(isPrepaymentCreditsError(googleRawError)).toBe(true);
    });

    it('detects 429 RESOURCE_EXHAUSTED quota limits', () => {
      const quotaError = { status: 429, message: 'Quota exceeded for quota metric' };
      expect(isQuotaOrCreditsError(quotaError)).toBe(true);
      expect(isPrepaymentCreditsError(quotaError)).toBe(false);
    });

    it('returns false for unrelated errors', () => {
      expect(isQuotaOrCreditsError(new Error('SyntaxError: Unexpected token'))).toBe(false);
      expect(isPrepaymentCreditsError(new Error('SyntaxError: Unexpected token'))).toBe(false);
    });
  });
});
