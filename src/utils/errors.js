export class AppError extends Error {
  constructor(statusCode, code, message, { details, userMessage, retryable, recoveryHint } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.userMessage = userMessage || message;
    this.retryable = Boolean(retryable);
    this.recoveryHint = recoveryHint;
  }
}

export const notFound = (name = 'Resource') => new AppError(404, 'NOT_FOUND', `${name} not found`, { userMessage: `We couldn't find the requested ${name.toLowerCase()}. It may have been deleted or you may not have access.` });
export const forbidden = (message = 'Forbidden') => new AppError(403, 'FORBIDDEN', message, { userMessage: message });
export const llmOffline = (message = 'LLM provider is offline') => new AppError(503, 'LLM_OFFLINE', message, { userMessage: 'The AI service is currently unavailable. The system is running in deterministic mode — conclusions are still produced from the engines, no content is fabricated.', retryable: true, recoveryHint: 'You can continue without the LLM. To re-enable, ensure LM Studio is running on the configured port or set a cloud provider in the backend .env.' });
export const retrievalEmpty = (query) => new AppError(404, 'RETRIEVAL_EMPTY', `No sources matched: ${query}`, { userMessage: 'No authoritative source could be found for this query. Human review is recommended for the affected area.', retryable: false, recoveryHint: 'Try broadening the query, or ingest additional sources in the System page.' });
