import { z } from 'zod';
import process from 'node:process';

try { process.loadEnvFile(); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_ORIGIN: z.string().url().default('http://localhost:5173'),
  PUBLIC_API_ORIGIN: z.string().url().default('http://localhost:3000'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/aiden_support'),
  JWT_ACCESS_SECRET: z.string().min(32).default('dev-access-secret-change-me-32chars'),
  JWT_REFRESH_SECRET: z.string().min(32).default('dev-refresh-secret-change-me-32chars'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECRET: z.string().min(32).default('dev-cookie-secret-change-me-32chars'),
  NVIDIA_API_KEY: z.string().default(''),
  NVIDIA_BASE_URL: z.string().url().default('https://integrate.api.nvidia.com/v1'),
  NVIDIA_CHAT_MODEL: z.string().default('meta/llama-3.1-8b-instruct'),
  NVIDIA_EMBEDDING_MODEL: z.string().default('nvidia/llama-nemotron-embed-1b-v2'),
  NVIDIA_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_BASE_URL: z.string().url().default('https://generativelanguage.googleapis.com/v1beta/openai/'),
  GEMINI_CHAT_MODEL: z.string().default('gemini-3.6-flash'),
  GEMINI_REASONING_EFFORT: z.enum(['minimal', 'low', 'medium', 'high']).default('low'),
  GEMINI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  LLM_PROVIDER: z.enum(['hybrid', 'cloud', 'gemini', 'lmstudio', 'none']).default('hybrid'),
  LMSTUDIO_BASE_URL: z.string().url().default('http://localhost:1234/v1'),
  LMSTUDIO_API_KEY: z.string().default('lm-studio'),
  LMSTUDIO_MODEL: z.string().default(''),
  MAIN_REASONING_MODEL: z.string().default(''),
  CLASSIFICATION_MODEL: z.string().default(''),
  EMBEDDING_MODEL: z.string().default(''),
  LLM_STRUCTURED_OUTPUT: z.enum(['auto', 'json_mode', 'off']).default('auto'),
  LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.1),
  VECTOR_INDEX_NAME: z.string().default('knowledge_vector_index'),
  VECTOR_DIMENSIONS: z.coerce.number().int().positive().default(2048),
  RETRIEVAL_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.68),
  ENCRYPTION_KEY: z.string().default(''),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  LOG_LEVEL: z.string().default('info')
});

export const env = schema.parse(process.env);
