import { z } from 'zod';
import { authenticate, authorizeOrganization } from '../middleware/auth.js';
import { Bot, AllowedDomain, KnowledgeSource, KnowledgeChunk, Conversation, Message } from '../models/index.js';
import { TenantRepository } from '../repositories/tenant.repository.js';
import { randomId, normalizeDomain } from '../utils/security.js';
import { env } from '../config/env.js';
import { publicChatService } from '../services/public-chat.service.js';

const repo = new TenantRepository(Bot);
const botCreate = z.object({ name: z.string().min(2).max(80), instructions: z.string().max(4000).optional(), welcomeMessage: z.string().max(500).optional(), fallbackMessage: z.string().max(500).optional(), supportEmail: z.string().email().or(z.literal('')).optional(), enabled: z.boolean().optional(), appearance: z.object({ color: z.string().regex(/^#[0-9a-f]{6}$/i), theme: z.enum(['light', 'dark', 'auto']), position: z.enum(['bottom-left', 'bottom-right']), avatarUrl: z.string().url().or(z.literal('')) }).partial().optional() });
const botUpdate = botCreate.partial();
const testChatBody = z.object({ conversationId: z.string().max(128).optional(), question: z.string().min(1).max(2000) });

export async function botRoutes(app) {
  app.addHook('preHandler', authenticate);
  app.get('/:organizationId/bots', { preHandler: authorizeOrganization() }, request => repo.list(request.organizationId).lean());
  app.post('/:organizationId/bots', { preHandler: authorizeOrganization(['owner', 'admin']) }, async request => repo.create(request.organizationId, { ...botCreate.parse(request.body), publicId: randomId('bot_') }));
  app.get('/:organizationId/bots/:botId', { preHandler: authorizeOrganization() }, request => repo.requireOne(request.organizationId, { _id: request.params.botId }));
  app.patch('/:organizationId/bots/:botId', { preHandler: authorizeOrganization(['owner', 'admin']) }, async request => repo.updateOne(request.organizationId, { _id: request.params.botId }, { $set: botUpdate.parse(request.body) }));
  app.post('/:organizationId/bots/:botId/test-chat', { preHandler: authorizeOrganization(), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = testChatBody.parse(request.body);
    const context = await publicChatService.prepareTestMessage({ organizationId: request.organizationId, botId: request.params.botId, userId: request.user._id.toString(), conversationPublicId: body.conversationId, question: body.question, ip: request.ip, userAgent: request.headers['user-agent'] });
    reply.hijack();
    reply.raw.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no', 'access-control-allow-origin': env.APP_ORIGIN, 'access-control-allow-credentials': 'true' });
    try { for await (const event of publicChatService.answer(context)) reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`); }
    catch { reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: 'The assistant is temporarily unavailable.', status: 'error' })}\n\n`); }
    finally { reply.raw.end(); }
  });
  app.delete('/:organizationId/bots/:botId', { preHandler: authorizeOrganization(['owner']) }, async request => {
    const filter = { organizationId: request.organizationId, botId: request.params.botId };
    await Promise.all([AllowedDomain.deleteMany(filter), KnowledgeChunk.deleteMany(filter), KnowledgeSource.deleteMany(filter), Message.deleteMany(filter), Conversation.deleteMany(filter), repo.deleteOne(request.organizationId, { _id: request.params.botId })]);
    return { ok: true };
  });
  app.get('/:organizationId/bots/:botId/domains', { preHandler: authorizeOrganization() }, request => AllowedDomain.find({ organizationId: request.organizationId, botId: request.params.botId }).lean());
  app.put('/:organizationId/bots/:botId/domains', { preHandler: authorizeOrganization(['owner', 'admin']) }, async request => {
    await repo.requireOne(request.organizationId, { _id: request.params.botId });
    const domains = z.object({ domains: z.array(z.string()).max(50) }).parse(request.body).domains.map(normalizeDomain);
    if (domains.some(value => !value)) throw new Error('Invalid domain');
    await AllowedDomain.deleteMany({ organizationId: request.organizationId, botId: request.params.botId });
    return AllowedDomain.insertMany([...new Set(domains)].map(hostname => ({ organizationId: request.organizationId, botId: request.params.botId, hostname })));
  });
  app.get('/:organizationId/bots/:botId/embed', { preHandler: authorizeOrganization() }, async request => {
    const bot = await repo.requireOne(request.organizationId, { _id: request.params.botId });
    return { snippet: `<script src="${env.PUBLIC_API_ORIGIN}/widget.js" data-bot-id="${bot.publicId}" async></script>` };
  });
}
