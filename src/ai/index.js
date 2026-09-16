import { env } from '../config/env.js';
import fs from 'node:fs';
import { OpenAICompatProvider } from './openai-compat.provider.js';
import { HybridProvider } from './hybrid.provider.js';
import { NoneProvider } from './none.provider.js';
import path from 'node:path';

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

function trainedConfig() {
  const deployment = readTrainedDeploymentGate();
  const disabledReason = !env.TRAINED_MODEL_ENABLED
    ? { status: 'CONFIG_MISSING', reason: 'Provider is not enabled' }
    : !env.TRAINED_MODEL
      ? { status: 'MODEL_NOT_CONFIGURED', reason: 'No trained model id is configured' }
      : !deployment.verified
        ? { status: deployment.status, reason: deployment.reason }
        : null;
  return {
    id: 'trained',
    baseURL: env.TRAINED_MODEL_BASE_URL,
    apiKey: env.TRAINED_MODEL_API_KEY,
    chatModel: env.TRAINED_MODEL,
    // The fine-tuned chat model is deliberately not used for embeddings. The
    // Atlas index remains 2048-dimensional and keeps its configured embedding
    // provider independent from the chat-model fallback chain.
    embeddingModel: '',
    timeoutMs: env.NVIDIA_REQUEST_TIMEOUT_MS,
    structuredOutput: env.LLM_STRUCTURED_OUTPUT,
    disableThinking: true,
    nativeOllama: /:\/\/(?:localhost|127\.0\.0\.1):11434(?:\/|$)/i.test(env.TRAINED_MODEL_BASE_URL),
    ollamaKeepAlive: env.OLLAMA_KEEP_ALIVE,
    ollamaNumCtx: env.OLLAMA_NUM_CTX,
    ollamaNumPredict: env.OLLAMA_NUM_PREDICT,
    disabled: Boolean(disabledReason),
    disabledReason,
    deployment
  };
}

function readTrainedDeploymentGate() {
  const configuredPath = env.TRAINED_MODEL_MANIFEST.trim();
  const manifestPath = configuredPath ? path.resolve(process.cwd(), configuredPath) : '';
  if (!manifestPath) {
    return {
      verified: false,
      status: 'DEPLOYMENT_MANIFEST_MISSING',
      reason: 'A passed trained-model deployment manifest is required before activation',
      manifestPath: null
    };
  }
  try {
    if (!fs.existsSync(manifestPath)) {
      return {
        verified: false,
        status: 'DEPLOYMENT_MANIFEST_MISSING',
        reason: `Deployment manifest was not found at ${manifestPath}`,
        manifestPath
      };
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const gate = manifest?.deploymentGate;
    if (gate?.passed !== true) {
      return {
        verified: false,
        status: 'DEPLOYMENT_GATE_FAILED',
        reason: gate?.reason || 'The trained-model deployment gate has not passed the held-out evaluation',
        manifestPath
      };
    }
    const deploymentModelId = String(manifest?.deploymentModelId || '').trim();
    if (deploymentModelId && env.TRAINED_MODEL && deploymentModelId !== env.TRAINED_MODEL) {
      return {
        verified: false,
        status: 'MODEL_MANIFEST_MISMATCH',
        reason: `Deployment manifest is for "${deploymentModelId}", not the configured trained model`,
        manifestPath
      };
    }
    return { verified: true, status: 'DEPLOYMENT_VERIFIED', deploymentModelId: deploymentModelId || null, manifestPath };
  } catch (error) {
    return {
      verified: false,
      status: 'DEPLOYMENT_MANIFEST_INVALID',
      reason: `Unable to read the trained-model deployment manifest: ${error.message?.slice(0, 160) || 'invalid manifest'}`,
      manifestPath
    };
  }
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
    chatModel: env.LMSTUDIO_MODEL || '',
    embeddingModel: env.EMBEDDING_MODEL || '',
    structuredOutput: env.LLM_STRUCTURED_OUTPUT
  };
}

function ollamaConfig(model = env.OLLAMA_MODEL, id = 'ollama') {
  return {
    id,
    baseURL: env.OLLAMA_BASE_URL,
    apiKey: env.OLLAMA_API_KEY,
    chatModel: model || '',
    embeddingModel: '',
    timeoutMs: env.NVIDIA_REQUEST_TIMEOUT_MS,
    structuredOutput: env.LLM_STRUCTURED_OUTPUT,
    disableThinking: !env.OLLAMA_THINK,
    nativeOllama: true,
    ollamaKeepAlive: env.OLLAMA_KEEP_ALIVE,
    ollamaNumCtx: env.OLLAMA_NUM_CTX,
    ollamaNumPredict: env.OLLAMA_NUM_PREDICT,
    disabled: !model
  };
}

export function createProvider(override) {
  if (override) return new OpenAICompatProvider(override);
  if (env.LLM_PROVIDER === 'none') return new NoneProvider();
  if (env.LLM_PROVIDER === 'trained') return new HybridProvider(buildQwenFirstChain());
  if (env.LLM_PROVIDER === 'ollama') return new HybridProvider({
    providers: [
      new OpenAICompatProvider(ollamaConfig(env.OLLAMA_MODEL, 'ollama-primary')),
      ...(env.OLLAMA_FALLBACK_MODEL && env.OLLAMA_FALLBACK_MODEL !== env.OLLAMA_MODEL
        ? [new OpenAICompatProvider(ollamaConfig(env.OLLAMA_FALLBACK_MODEL, 'ollama-fallback'))]
        : []),
      new NoneProvider()
    ]
  });
  if (env.LLM_PROVIDER === 'gemini') return new OpenAICompatProvider(geminiConfig());
  if (env.LLM_PROVIDER === 'lmstudio') return new OpenAICompatProvider(lmstudioConfig());
  if (env.LLM_PROVIDER === 'cloud') return new OpenAICompatProvider(cloudConfig());
  return new HybridProvider(buildQwenFirstChain());
}

function buildQwenFirstChain() {
  return {
    providers: [
      new OpenAICompatProvider(trainedConfig()),
      // Keep the trained Qwen model first. The remaining providers are ordered
      // from the preferred cloud legs to the base local Qwen fallbacks, then a
      // deterministic provider that never fabricates an AI explanation.
      new OpenAICompatProvider(cloudConfig()),
      new OpenAICompatProvider(geminiConfig()),
      new OpenAICompatProvider(ollamaConfig(env.OLLAMA_MODEL, 'ollama-primary')),
      ...(env.OLLAMA_FALLBACK_MODEL && env.OLLAMA_FALLBACK_MODEL !== env.OLLAMA_MODEL
        ? [new OpenAICompatProvider(ollamaConfig(env.OLLAMA_FALLBACK_MODEL, 'ollama-fallback'))]
        : []),
      new NoneProvider()
    ]
  };
}

let cached = null;
export function getProvider() {
  if (!cached) cached = createProvider();
  return cached;
}

export function getProviderForTask(task = 'reasoning') {
  // Task-level routing hook: CLASSIFICATION_MODEL may override the cloud leg
  // while the trained model remains the default primary provider.
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
