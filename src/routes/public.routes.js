import { z } from 'zod';
import { publicChatService } from '../services/public-chat.service.js';

const origin = request => request.query?.origin || request.headers.origin || request.headers.referer;
const bodySchema = z.object({ visitorKey: z.string().min(16).max(128), conversationId: z.string().max(128).optional(), question: z.string().min(1).max(2000) });

export async function publicRoutes(app) {
  app.get('/widget/:publicId/config', async request => publicChatService.getConfiguration(request.params.publicId, origin(request)));
  app.get('/widget/:publicId/history', async request => {
    const query = z.object({ visitorKey: z.string().min(16), conversationId: z.string().min(1) }).parse(request.query);
    return publicChatService.history({ publicId: request.params.publicId, origin: origin(request), ...query, conversationPublicId: query.conversationId });
  });
  app.post('/widget/:publicId/chat', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = bodySchema.parse(request.body);
    const context = await publicChatService.prepareMessage({ publicId: request.params.publicId, origin: origin(request), visitorKey: body.visitorKey, conversationPublicId: body.conversationId, question: body.question, ip: request.ip, userAgent: request.headers['user-agent'] });
    reply.hijack();
    reply.raw.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no', 'access-control-allow-origin': request.headers.origin || '*' });
    try { for await (const event of publicChatService.answer(context)) reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`); }
    catch { reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: 'The assistant is temporarily unavailable.', status: 'error' })}\n\n`); }
    finally { reply.raw.end(); }
  });
}
