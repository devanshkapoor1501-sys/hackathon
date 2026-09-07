import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import crypto from 'node:crypto';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { authRoutes } from './routes/auth.routes.js';
import { organizationRoutes } from './routes/organization.routes.js';
import { botRoutes } from './routes/bot.routes.js';
import { knowledgeRoutes } from './routes/knowledge.routes.js';
import { conversationRoutes } from './routes/conversation.routes.js';
import { analyticsRoutes } from './routes/analytics.routes.js';
import { publicRoutes } from './routes/public.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { registerWidgetAssets } from './routes/widget-assets.routes.js';
import { sahayakRoutes } from './routes/sahayak.routes.js';
import { AppError } from './utils/errors.js';

// Map a thrown error to a safe user-facing message + recovery hint
function classifyError(error) {
  if (error instanceof ZodError) {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Request validation failed', userMessage: 'Some fields are invalid. Please check the form and try again.', retryable: false };
  }
  if (error instanceof AppError) {
    return {
      status: error.statusCode || 400,
      code: error.code || 'APP_ERROR',
      message: error.message,
      userMessage: error.userMessage || error.message,
      retryable: Boolean(error.retryable),
      recoveryHint: error.recoveryHint
    };
  }
  const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500;
  if (status >= 500) {
    return { status: 500, code: error.code || 'INTERNAL_ERROR', message: 'An unexpected error occurred', userMessage: 'Something went wrong on our side. Please try again — if it persists, contact support with the request ID shown.', retryable: true };
  }
  return { status, code: error.code || 'CLIENT_ERROR', message: error.message, userMessage: error.message, retryable: false };
}

export async function buildApp(options = {}) {
  const app = Fastify({ loggerInstance: options.logger || logger, trustProxy: true, bodyLimit: env.MAX_UPLOAD_BYTES });

  // Request IDs: accept client-provided (validated) or generate one. Echo in response and logs.
  app.addHook('onRequest', async (request, reply) => {
    const incoming = request.headers['x-request-id'];
    const id = (typeof incoming === 'string' && /^[a-zA-Z0-9_.-]{8,80}$/.test(incoming)) ? incoming : `req_${crypto.randomBytes(8).toString('hex')}`;
    request.requestId = id;
    reply.header('x-request-id', id);
  });

  // Stronger Helmet defaults — keep CORP open for the embedded widget to work.
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    strictTransportSecurity: env.NODE_ENV === 'production' ? { maxAge: 15552000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xDnsPrefetchControl: { allow: false }
  });

  await app.register(cors, {
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin(origin, callback) { if (!origin) return callback(null, true); try { const url = new URL(origin); callback(null, ['http:', 'https:'].includes(url.protocol)); } catch { callback(null, false); } }
  });
  await app.register(cookie, { secret: env.COOKIE_SECRET });
  await app.register(multipart, { limits: { files: 1, fileSize: env.MAX_UPLOAD_BYTES } });
  await app.register(rateLimit, { global: false, max: 100, timeWindow: '1 minute' });

  // Origin gate for protected APIs
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    const protectedApi = request.url.startsWith('/api/') && !request.url.startsWith('/api/public/');
    if (protectedApi && origin && origin !== env.APP_ORIGIN) return reply.code(403).send({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origin is not allowed' } });
  });

  // Unified error handler — returns { error: { code, message, userMessage, retryable, recoveryHint, requestId } }
  app.setErrorHandler((error, request, reply) => {
    const c = classifyError(error);
    if (c.status >= 500) request.log.error({ err: error, requestId: request.requestId }, 'Request failed');
    return reply.code(c.status).send({
      error: {
        code: c.code,
        message: c.message,
        userMessage: c.userMessage,
        retryable: c.retryable,
        recoveryHint: c.recoveryHint,
        requestId: request.requestId
      }
    });
  });

  await app.register(healthRoutes);
  // Auth gets a tighter rate limit (login/register are the brute-force vectors).
  await app.register(async instance => {
    instance.register(rateLimit, { max: 15, timeWindow: '1 minute' });
    await authRoutes(instance);
  }, { prefix: '/api/auth' });
  await app.register(organizationRoutes, { prefix: '/api/organizations' });
  await app.register(botRoutes, { prefix: '/api/organizations' });
  await app.register(knowledgeRoutes, { prefix: '/api/organizations' });
  await app.register(conversationRoutes, { prefix: '/api/organizations' });
  await app.register(analyticsRoutes, { prefix: '/api/organizations' });
  await app.register(publicRoutes, { prefix: '/api/public' });
  await registerWidgetAssets(app);
  // Sahayak assistant endpoints are expensive (LLM). Apply a focused limit.
  await app.register(async instance => {
    instance.register(rateLimit, { max: 30, timeWindow: '1 minute' });
    await sahayakRoutes(instance);
  });
  return app;
}
