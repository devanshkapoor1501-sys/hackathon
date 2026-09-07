import { AIProvider } from './provider.js';

/**
 * Explicit no-LLM provider. It is deliberately network-free: callers can
 * catch the error and use the deterministic application path instead.
 */
export class NoneProvider extends AIProvider {
  id = 'none';
  chatModel = '';
  embeddingModel = '';

  getModelInfo() {
    return {
      id: this.id,
      baseURL: null,
      reasoningModel: null,
      embeddingModel: null
    };
  }

  isConfigured() { return false; }

  async healthCheck() {
    return {
      connected: false,
      status: 'DISABLED',
      reason: 'No AI provider configured; deterministic mode is active',
      latencyMs: 0,
      models: []
    };
  }

  #disabled() {
    const error = new Error('AI provider is disabled');
    error.code = 'AI_DISABLED';
    return error;
  }

  async generate() { throw this.#disabled(); }
  async generateStructured() { throw this.#disabled(); }
  async embed() { throw this.#disabled(); }
  async *stream() { throw this.#disabled(); }
}
