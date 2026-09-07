import { env } from '../config/env.js';
import { OpenAICompatProvider } from './openai-compat.provider.js';
import { HybridProvider } from './hybrid.provider.js';
import { NoneProvider } from './none.provider.js';

function cloudConfig() {
  return {
    id: 'nvidia',
    baseURL: env.NVIDIA_BASE_URL,
    apiKey: env.NVIDIA_API_KEY || 'missing-key',
    chatModel: env.MAIN_REASONING_MODEL || env.NVIDIA_CHAT_MODEL,
    embeddingModel: env.EMBEDDING_MODEL || env.NVIDIA_EMBEDDING_MODEL,
    timeoutMs: env.NVIDIA_REQUEST_TIMEOUT_MS,
    disabled: !env.NVIDIA_API_KEY
  };
}

function geminiConfig() {
  return {
    id: 'gemini',
    baseURL: env.GEMINI_BASE_URL,
    apiKey: env.GEMINI_API_KEY || 'missing-key',
    chatModel: env.GEMINI_CHAT_MODEL,
    reasoningEffort: env.GEMINI_REASONING_EFFORT,
    // Gemini embeddings are intentionally opt-in: the app's existing Atlas
    // vector index has a fixed dimension, so lexical retrieval remains the
    // safe fallback until a compatible embedding index is configured.
    embeddingModel: '',
    timeoutMs: env.GEMINI_REQUEST_TIMEOUT_MS,
    structuredOutput: env.LLM_STRUCTURED_OUTPUT,
    disabled: !env.GEMINI_API_KEY
  };
}

function lmstudioConfig() {
  return {
    id: 'lmstudio',
    baseURL: env.LMSTUDIO_BASE_URL,
    apiKey: env.LMSTUDIO_API_KEY || 'lm-studio',
    // Never assume a model id: LM Studio serves whatever model is loaded; it is configurable.
    chatModel: env.MAIN_REASONING_MODEL || env.LMSTUDIO_MODEL || '',
    embeddingModel: env.EMBEDDING_MODEL || '',
    structuredOutput: env.LLM_STRUCTURED_OUTPUT
  };
}

export function createProvider(override) {
  if (override) return new OpenAICompatProvider(override);
  if (env.LLM_PROVIDER === 'none') return new NoneProvider();
  if (env.LLM_PROVIDER === 'gemini') return new OpenAICompatProvider(geminiConfig());
  if (env.LLM_PROVIDER === 'lmstudio') return new OpenAICompatProvider(lmstudioConfig());
  if (env.LLM_PROVIDER === 'cloud') return new OpenAICompatProvider(cloudConfig());
  return new HybridProvider({
    providers: [
      new OpenAICompatProvider(cloudConfig()),
      new OpenAICompatProvider(lmstudioConfig()),
      new NoneProvider()
    ]
  });
}

let cached = null;
export function getProvider() {
  if (!cached) cached = createProvider();
  return cached;
}

export function getProviderForTask(task = 'reasoning') {
  // Task-level routing hook: CLASSIFICATION_MODEL / MAIN_REASONING_MODEL may differ.
  const provider = getProvider();
  const roleModel = task === 'classification' ? (env.CLASSIFICATION_MODEL || '').trim() : '';
  if (roleModel && provider.chatModel !== roleModel) {
    if (provider.id === 'hybrid' && provider.withCloudModel) return provider.withCloudModel(roleModel);
    if (provider.id === 'none') return provider;
    if (provider.withChatModel) return provider.withChatModel(roleModel);
    const base = provider.getModelInfo();
    return new OpenAICompatProvider({
      id: `${provider.id}:${task}`,
      baseURL: base.baseURL,
      apiKey: provider.id === 'lmstudio' ? env.LMSTUDIO_API_KEY : provider.id === 'gemini' ? env.GEMINI_API_KEY : env.NVIDIA_API_KEY,
      chatModel: roleModel, embeddingModel: base.embeddingModel,
      structuredOutput: env.LLM_STRUCTURED_OUTPUT,
      reasoningEffort: provider.id === 'gemini' ? env.GEMINI_REASONING_EFFORT : null
    });
  }
  return provider;
}

export { AIProvider } from './provider.js';
export { OpenAICompatProvider } from './openai-compat.provider.js';
export { HybridProvider } from './hybrid.provider.js';
export { NoneProvider } from './none.provider.js';
