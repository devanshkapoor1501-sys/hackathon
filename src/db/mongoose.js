import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';

// Lifecycle hooks must be async (or explicitly call Fastify's `done`
// callback). Returning a promise lets Fastify continue immediately when the
// database is ready and prevents protected routes from hanging.
export async function requireDatabase() {
  if (mongoose.connection.readyState === 1) return;
  throw new AppError(
    503,
    'DATABASE_UNAVAILABLE',
    'MongoDB is unavailable',
    {
      userMessage: 'Registration is temporarily unavailable because the database is not connected. Please start MongoDB or check the database connection and try again.',
      retryable: true,
      recoveryHint: 'Check /ready and the server logs, then retry once MongoDB reports ready.'
    }
  );
}

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return;
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  logger.info('MongoDB connected');
}

// Keep trying after a transient DNS/network failure. Mongoose reconnects an
// established connection automatically, but an initial failed connection
// otherwise leaves the server permanently unavailable until restart.
export function startDatabaseReconnect() {
  let stopped = false;
  let delayMs = 1000;

  const attempt = async () => {
    while (!stopped && mongoose.connection.readyState !== 1) {
      try {
        await connectDatabase();
        delayMs = 1000;
      } catch (error) {
        logger.warn({ err: error, dependency: 'mongodb', retryInMs: delayMs }, 'MongoDB unavailable; retrying connection');
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs = Math.min(delayMs * 2, 30_000);
      }
    }
  };

  void attempt();
  return () => { stopped = true; };
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
