import { AIProvider } from './provider.js';

/**
 * Qwen-first provider chain. The wrapper is intentionally small and keeps
 * provider-specific protocol details inside each underlying provider.
 */
export class HybridProvider extends AIProvider {
  id = 'hybrid';

  constructor({ providers = [] } = {}) {
    super();
    this.providers = providers;
    this.lastActiveProvider = null;
  }

  #preferredProvider() {
    // Keep the configured order authoritative. A temporary outage in Qwen (or
    // another earlier provider) must not permanently pin the process to a
    // fallback after the primary comes back online.
    return this.providers.find(provider => provider.isConfigured?.()) || null;
  }

  #embeddingProvider() {
    return this.providers.find(provider => provider.isConfigured?.() && provider.embeddingModel) || null;
  }

  get chatModel() {
    return this.#preferredProvider()?.chatModel || '';
  }

  get embeddingModel() {
    return this.#embeddingProvider()?.embeddingModel || '';
  }

  getModelInfo() {
    const configured = this.#preferredProvider();
    const info = (configured || this.providers[0])?.getModelInfo?.() || {};
    return {
      id: this.id,
      activeProvider: this.lastActiveProvider,
      baseURL: info.baseURL || null,
      reasoningModel: info.reasoningModel || null,
      embeddingModel: this.#embeddingProvider()?.embeddingModel || null,
      embeddingProvider: this.#embeddingProvider()?.id || null,
      providers: this.providers.map(provider => provider.getModelInfo?.()).filter(Boolean)
    };
  }

  #candidates() {
    return this.providers.filter(provider => provider.isConfigured?.());
  }

  async #withFallback(operation) {
    let lastError = null;
    for (const provider of this.#candidates()) {
      try {
        const result = await operation(provider);
        this.lastActiveProvider = provider.id;
        return result;
      } catch (error) {
        lastError = error;
      }
    }
    const error = lastError || new Error('No AI provider is configured');
    error.code ||= 'NO_AI_PROVIDER';
    throw error;
  }

  async generate(options) { return this.#withFallback(provider => provider.generate(options)); }
  async generateStructured(options) { return this.#withFallback(provider => provider.generateStructured(options)); }
  async embed(texts, inputType) {
    const providers = this.providers.filter(provider => provider.isConfigured?.() && provider.embeddingModel);
    let lastError = null;
    for (const provider of providers) {
      try {
        const result = await provider.embed(texts, inputType);
        this.lastActiveProvider = provider.id;
        return result;
      } catch (error) {
        lastError = error;
      }
    }
    const error = lastError || new Error('No AI embedding provider is configured');
    error.code ||= 'NO_AI_PROVIDER';
    throw error;
  }

  async *stream(options) {
    let lastError = null;
    for (const provider of this.#candidates()) {
      let yielded = false;
      try {
        for await (const part of provider.stream(options)) {
          yielded = true;
          this.lastActiveProvider = provider.id;
          yield part;
        }
        if (!yielded) this.lastActiveProvider = provider.id;
        return;
      } catch (error) {
        // Once a stream has emitted content, retrying would duplicate partial
        // output. Let the caller use its normal safe fallback in that case.
        if (yielded) throw error;
        lastError = error;
      }
    }
    const error = lastError || new Error('No AI provider is configured');
    error.code ||= 'NO_AI_PROVIDER';
    throw error;
  }

  async healthCheck() {
    const attempts = [];
    for (const provider of this.providers) {
      const info = provider.getModelInfo?.() || {};
      if (!provider.isConfigured?.()) {
        const unavailable = await provider.healthCheck?.();
        attempts.push({
          provider: info.id || provider.id,
          model: info.reasoningModel || null,
          embeddingModel: info.embeddingModel || null,
          baseURL: info.baseURL || null,
          ...(unavailable || { status: 'CONFIG_MISSING', reason: 'Provider is not configured' })
        });
        continue;
      }
      const health = await provider.healthCheck();
      attempts.push({
        provider: info.id || provider.id,
        model: info.reasoningModel || null,
        embeddingModel: info.embeddingModel || null,
        baseURL: info.baseURL || null,
        ...health
      });
      if (health.connected) {
        this.lastActiveProvider = provider.id;
        return {
          ...health,
          status: 'READY',
          activeProvider: provider.id,
          fallbackUsed: attempts.length > 1,
          attempts
        };
      }
    }
    return {
      connected: false,
      status: attempts.some(attempt => attempt.status === 'OFFLINE') ? 'OFFLINE' : 'NO_PROVIDER_CONFIGURED',
      activeProvider: null,
      fallbackUsed: false,
      latencyMs: attempts.reduce((sum, attempt) => sum + (attempt.latencyMs || 0), 0),
      attempts,
      reason: 'No configured AI provider is currently available'
    };
  }

  /** Apply a classification/reasoning model override to the cloud leg only. */
  withCloudModel(model) {
    const providers = this.providers.map(provider =>
      provider.id === 'nvidia' && provider.withChatModel ? provider.withChatModel(model) : provider
    );
    return new HybridProvider({ providers });
  }
}
