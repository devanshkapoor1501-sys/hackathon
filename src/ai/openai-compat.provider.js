import OpenAI from 'openai';
import { AIProvider, coerceJson } from './provider.js';

export class OpenAICompatProvider extends AIProvider {
  constructor({ id, baseURL, apiKey, chatModel, embeddingModel, timeoutMs = 60000, structuredOutput = 'auto', temperature = 0.1, reasoningEffort = null, disabled = false }) {
    super();
    this.id = id;
    this.baseURL = baseURL;
    this.chatModel = chatModel;
    this.embeddingModel = embeddingModel;
    this.apiKey = apiKey || '';
    this.timeoutMs = timeoutMs;
    this.structuredOutput = structuredOutput;
    this.disabled = Boolean(disabled);
    this.temperature = temperature;
    this.reasoningEffort = reasoningEffort;
    this.jsonModeSupported = structuredOutput !== 'off' ? null : false;
    this.client = new OpenAI({ apiKey: apiKey || 'missing-key', baseURL, timeout: timeoutMs, maxRetries: 1 });
  }

  getModelInfo() {
    return { id: this.id, baseURL: this.baseURL, reasoningModel: this.chatModel, embeddingModel: this.embeddingModel || null };
  }

  isConfigured() {
    return !this.disabled && Boolean(this.chatModel);
  }

  withChatModel(chatModel) {
    return new OpenAICompatProvider({
      id: this.id,
      baseURL: this.baseURL,
      apiKey: this.apiKey,
      chatModel,
      embeddingModel: this.embeddingModel,
      timeoutMs: this.timeoutMs,
      structuredOutput: this.structuredOutput,
      temperature: this.temperature,
      reasoningEffort: this.reasoningEffort,
      disabled: this.disabled
    });
  }

  async #complete({ system, prompt, json = false, maxTokens = 1600, temperature }) {
    const messages = [{ role: 'system', content: system }, { role: 'user', content: prompt }];
    const body = { model: this.chatModel, temperature: temperature ?? this.temperature, max_tokens: maxTokens, messages };
    if (this.id === 'gemini' && this.reasoningEffort) body.reasoning_effort = this.reasoningEffort;
    if (json && this.jsonModeSupported !== false) body.response_format = { type: 'json_object' };
    try {
      const response = await this.client.chat.completions.create(body);
      if (json && this.jsonModeSupported === null) this.jsonModeSupported = true;
      return response.choices?.[0]?.message?.content ?? '';
    } catch (error) {
      if (json && body.response_format && /response_format|json_object|not support/i.test(String(error))) {
        this.jsonModeSupported = false;
        delete body.response_format;
        const retry = await this.client.chat.completions.create(body);
        return retry.choices?.[0]?.message?.content ?? '';
      }
      throw error;
    }
  }

  async generate({ system, prompt, maxTokens, temperature }) {
    const started = Date.now();
    const text = await this.#complete({ system, prompt, maxTokens, temperature });
    return { text, latencyMs: Date.now() - started };
  }

  async generateStructured({ system, prompt, schema, schemaName = 'Response', maxTokens = 1600 }) {
    const instruction = `${system}\n\nReturn ONLY a single JSON object conforming to this TypeScript type — no prose, no markdown fences:\n${schemaName}: ${schema}`;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const raw = await this.#complete({ system: instruction, prompt: `${prompt}\n\nJSON ${schemaName}:`, json: true, maxTokens });
      const parsed = coerceJson(raw);
      if (parsed != null && typeof parsed === 'object') return { data: parsed, raw, attempts: attempt };
    }
    throw new Error(`Structured output failed schema expectations after retries (model ${this.chatModel})`);
  }

  async embed(texts, inputType = 'passage') {
    if (!this.embeddingModel) throw new Error('No embedding model configured');
    const result = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: texts,
      encoding_format: 'float',
      ...(this.id === 'nvidia' ? { input_type: inputType, truncate: 'END' } : {})
    });
    return result.data.map(item => item.embedding);
  }

  async *stream({ system, prompt, maxTokens = 900 }) {
    const stream = await this.client.chat.completions.create({
      model: this.chatModel, stream: true, temperature: this.temperature, max_tokens: maxTokens,
      ...(this.id === 'gemini' && this.reasoningEffort ? { reasoning_effort: this.reasoningEffort } : {}),
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }]
    });
    for await (const part of stream) {
      const text = part.choices?.[0]?.delta?.content;
      if (text) yield { text, usage: part.usage };
    }
  }

  async healthCheck() {
    const started = Date.now();
    if (this.disabled) {
      return {
        connected: false,
        status: 'CONFIG_MISSING',
        latencyMs: 0,
        models: [],
        requestedModel: this.chatModel,
        reason: 'Provider credentials are not configured'
      };
    }
    if (!this.chatModel) {
      return {
        connected: false,
        status: 'MODEL_NOT_CONFIGURED',
        latencyMs: 0,
        models: [],
        reason: 'No chat model is configured'
      };
    }
    try {
      const models = await this.client.models.list({ timeout: 4000 });
      const ids = [];
      for await (const m of models) ids.push(m.id);
      // Google’s OpenAI-compatible models endpoint returns IDs such as
      // `models/gemini-3.6-flash`, while chat completions use the short ID.
      // Compare normalized IDs so a valid Gemini model is not shown as a
      // false mismatch in /health/llm.
      const normalizedIds = ids.map(id => String(id).replace(/^models\//, ''));
      const latencyMs = Date.now() - started;
      const base = {
        latencyMs,
        models: ids.slice(0, 25),
        structuredOutput: this.jsonModeSupported === false ? 'unsupported' : 'expected',
        requestedModel: this.chatModel
      };
      // Endpoint reachable but nothing usable behind it must NOT count as online.
      if (!ids.length) {
        return { ...base, connected: false, status: 'NO_MODEL_LOADED', reason: 'Server responded but no model is loaded — generation would fail' };
      }
      if (this.chatModel && !normalizedIds.includes(String(this.chatModel).replace(/^models\//, ''))) {
        return { ...base, connected: false, status: 'MODEL_MISMATCH', reason: `Requested model "${this.chatModel}" is not loaded. Loaded: ${ids.slice(0, 3).join(', ') || 'none'}` };
      }
      return { ...base, connected: true, status: 'READY', modelAvailable: true };
    } catch (error) {
      return {
        connected: false, status: 'OFFLINE', latencyMs: Date.now() - started,
        reason: error.message?.slice(0, 200) || 'unreachable',
        requestedModel: this.chatModel
      };
    }
  }
}
