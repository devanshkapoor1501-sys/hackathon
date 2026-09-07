import { describe, expect, it } from 'vitest';
import { AIProvider } from '../src/ai/provider.js';
import { HybridProvider } from '../src/ai/hybrid.provider.js';
import { NoneProvider } from '../src/ai/none.provider.js';
import { OpenAICompatProvider } from '../src/ai/openai-compat.provider.js';

class FakeProvider extends AIProvider {
  constructor(id, { configured = true, health = {}, failures = {} } = {}) {
    super();
    this.id = id;
    this.configured = configured;
    this.health = health;
    this.failures = failures;
    this.calls = [];
    this.chatModel = `${id}-chat`;
    this.embeddingModel = `${id}-embedding`;
  }

  isConfigured() { return this.configured; }
  getModelInfo() { return { id: this.id, baseURL: `https://${this.id}.test`, reasoningModel: this.chatModel, embeddingModel: this.embeddingModel }; }
  async healthCheck() {
    return this.configured
      ? { connected: true, status: 'READY', ...this.health }
      : { connected: false, status: 'CONFIG_MISSING', reason: 'Provider is not configured' };
  }

  async generate() { this.calls.push('generate'); if (this.failures.generate) throw new Error(`${this.id} generate failed`); return { text: this.id }; }
  async generateStructured() { this.calls.push('generateStructured'); if (this.failures.generateStructured) throw new Error(`${this.id} structured failed`); return { data: { provider: this.id } }; }
  async embed() { this.calls.push('embed'); if (this.failures.embed) throw new Error(`${this.id} embed failed`); return [[1, 2, 3]]; }
  async *stream() { this.calls.push('stream'); if (this.failures.stream) throw new Error(`${this.id} stream failed`); yield { text: this.id }; }
}

describe('AI provider fallback chain', () => {
  it('uses cloud before local and deterministic providers', async () => {
    const cloud = new FakeProvider('nvidia');
    const local = new FakeProvider('lmstudio');
    const none = new NoneProvider();
    const provider = new HybridProvider({ providers: [cloud, local, none] });

    await expect(provider.generateStructured({})).resolves.toEqual({ data: { provider: 'nvidia' } });
    expect(cloud.calls).toContain('generateStructured');
    expect(local.calls).toEqual([]);
  });

  it('exposes the configured fallback model to capability checks', () => {
    const provider = new HybridProvider({ providers: [
      new FakeProvider('nvidia', { configured: false }),
      new FakeProvider('lmstudio')
    ] });

    expect(provider.chatModel).toBe('lmstudio-chat');
    expect(provider.embeddingModel).toBe('lmstudio-embedding');
  });

  it('falls back from cloud to LM Studio for generation, streaming and embeddings', async () => {
    const cloud = new FakeProvider('nvidia', { failures: { generateStructured: true, stream: true, embed: true } });
    const local = new FakeProvider('lmstudio');
    const provider = new HybridProvider({ providers: [cloud, local, new NoneProvider()] });

    await expect(provider.generateStructured({})).resolves.toEqual({ data: { provider: 'lmstudio' } });
    await expect(provider.embed(['text'])).resolves.toEqual([[1, 2, 3]]);
    const parts = [];
    for await (const part of provider.stream({})) parts.push(part.text);
    expect(parts).toEqual(['lmstudio']);
  });

  it('falls back to the caller-safe error when no AI provider is available', async () => {
    const provider = new HybridProvider({ providers: [
      new FakeProvider('nvidia', { configured: false }),
      new FakeProvider('lmstudio', { configured: false }),
      new NoneProvider()
    ] });

    await expect(provider.generate({})).rejects.toMatchObject({ code: 'NO_AI_PROVIDER' });
    await expect(provider.embed(['text'])).rejects.toMatchObject({ code: 'NO_AI_PROVIDER' });
  });

  it('reports the active fallback provider and does not probe unconfigured providers', async () => {
    const cloud = new FakeProvider('nvidia', { configured: false });
    const local = new FakeProvider('lmstudio');
    const provider = new HybridProvider({ providers: [cloud, local, new NoneProvider()] });
    const health = await provider.healthCheck();

    expect(health).toMatchObject({ connected: true, status: 'READY', activeProvider: 'lmstudio', fallbackUsed: true });
    expect(cloud.calls).toEqual([]);
    expect(health.attempts[0]).toMatchObject({ provider: 'nvidia', status: 'CONFIG_MISSING' });
    expect(health.attempts[1]).toMatchObject({ provider: 'lmstudio', status: 'READY' });
    expect(health.attempts).toHaveLength(2);
  });

  it('keeps explicit deterministic mode network-free', async () => {
    const provider = new NoneProvider();
    const health = await provider.healthCheck();

    expect(health).toMatchObject({ connected: false, status: 'DISABLED', latencyMs: 0 });
    await expect(provider.generate({})).rejects.toMatchObject({ code: 'AI_DISABLED' });
    await expect(provider.embed(['text'])).rejects.toMatchObject({ code: 'AI_DISABLED' });
  });

  it('does not probe the network when cloud credentials are missing', async () => {
    const provider = new OpenAICompatProvider({
      id: 'nvidia', baseURL: 'https://example.invalid/v1', apiKey: '', chatModel: 'model', disabled: true
    });
    await expect(provider.healthCheck()).resolves.toMatchObject({ connected: false, status: 'CONFIG_MISSING', latencyMs: 0 });
  });
});
