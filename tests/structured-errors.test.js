import { describe, it, expect } from 'vitest';
import { AppError, llmOffline, retrievalEmpty, notFound, forbidden } from '../src/utils/errors.js';

describe('structured error contract', () => {
  it('AppError carries userMessage, retryable, recoveryHint, code, statusCode', () => {
    const e = new AppError(503, 'LLM_OFFLINE', 'Provider unreachable', { userMessage: 'AI is offline', retryable: true, recoveryHint: 'Start LM Studio' });
    expect(e.statusCode).toBe(503);
    expect(e.code).toBe('LLM_OFFLINE');
    expect(e.message).toBe('Provider unreachable');
    expect(e.userMessage).toBe('AI is offline');
    expect(e.retryable).toBe(true);
    expect(e.recoveryHint).toBe('Start LM Studio');
    expect(e instanceof Error).toBe(true);
  });

  it('llmOffline helper sets the right defaults', () => {
    const e = llmOffline();
    expect(e.code).toBe('LLM_OFFLINE');
    expect(e.statusCode).toBe(503);
    expect(e.retryable).toBe(true);
    expect(e.userMessage).toMatch(/deterministic mode/i);
    expect(e.recoveryHint).toMatch(/LM Studio|cloud provider/i);
  });

  it('retrievalEmpty helper sets the right defaults', () => {
    const e = retrievalEmpty('asdf qwer');
    expect(e.code).toBe('RETRIEVAL_EMPTY');
    expect(e.statusCode).toBe(404);
    expect(e.retryable).toBe(false);
    expect(e.userMessage).toMatch(/No authoritative source/i);
    expect(e.message).toContain('asdf qwer');
  });

  it('notFound carries a user-friendly userMessage', () => {
    const e = notFound('Case');
    expect(e.statusCode).toBe(404);
    expect(e.code).toBe('NOT_FOUND');
    expect(e.userMessage).toMatch(/couldn't find/i);
  });

  it('forbidden is a 403', () => {
    const e = forbidden();
    expect(e.statusCode).toBe(403);
    expect(e.code).toBe('FORBIDDEN');
  });
});
