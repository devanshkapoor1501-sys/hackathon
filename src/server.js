import { buildApp } from './app.js';
import { disconnectDatabase, startDatabaseReconnect } from './db/mongoose.js';
import { env } from './config/env.js';

const app = await buildApp();
let stopDatabaseReconnect;

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  stopDatabaseReconnect = startDatabaseReconnect();
} catch (error) {
  app.log.fatal({ err: error }, 'Unable to start server');
  process.exitCode = 1;
}

async function shutdown(signal) {
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  stopDatabaseReconnect?.();
  await Promise.race([disconnectDatabase(), new Promise(resolve => setTimeout(resolve, 2000))]);
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
