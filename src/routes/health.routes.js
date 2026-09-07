import mongoose from 'mongoose';

export async function healthRoutes(app) {
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  app.get('/ready', async (_, reply) => {
    const mongo = mongoose.connection.readyState === 1;
    if (!mongo) reply.code(503);
    return { status: mongo ? 'ready' : 'not_ready', checks: { mongo } };
  });
}
