import { z } from 'zod';
import { authenticate, authorizeOrganization } from '../middleware/auth.js';
import { Conversation, Message } from '../models/index.js';
import { pagination } from '../schemas/common.js';
import { AppError } from '../utils/errors.js';

const replyBody = z.object({ content: z.string().trim().min(1).max(4000) });

export async function conversationRoutes(app) {
  app.addHook('preHandler', authenticate);
  app.get('/:organizationId/conversations', { preHandler: authorizeOrganization() }, async request => {
    const query = pagination.extend({ botId: z.string().optional(), status: z.enum(['open', 'resolved', 'escalated']).optional() }).parse(request.query);
    const filter = { organizationId: request.organizationId, ...(query.botId && { botId: query.botId }), ...(query.status && { status: query.status }) };
    const [items, total] = await Promise.all([Conversation.find(filter).sort({ lastMessageAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(), Conversation.countDocuments(filter)]);
    return { items, total, page: query.page, limit: query.limit };
  });
  app.get('/:organizationId/conversations/:conversationId/messages', { preHandler: authorizeOrganization() }, async request => {
    const conversation = await Conversation.findOne({ _id: request.params.conversationId, organizationId: request.organizationId });
    if (!conversation) throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found');
    return Message.find({ organizationId: request.organizationId, botId: conversation.botId, conversationId: conversation._id }).sort({ createdAt: 1 }).lean();
  });
  app.post('/:organizationId/conversations/:conversationId/replies', { preHandler: authorizeOrganization(['owner', 'admin', 'agent']) }, async request => {
    const { content } = replyBody.parse(request.body);
    const conversation = await Conversation.findOne({ _id: request.params.conversationId, organizationId: request.organizationId });
    if (!conversation) throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found');
    const message = await Message.create({ organizationId: request.organizationId, botId: conversation.botId, conversationId: conversation._id, role: 'agent', content, authorUserId: request.user._id, authorName: request.user.name || request.user.email });
    conversation.lastMessageAt = new Date();
    await conversation.save();
    return message;
  });
  app.patch('/:organizationId/conversations/:conversationId', { preHandler: authorizeOrganization(['owner', 'admin', 'agent']) }, async request => {
    const { status } = z.object({ status: z.enum(['open', 'resolved', 'escalated']) }).parse(request.body);
    const record = await Conversation.findOneAndUpdate({ _id: request.params.conversationId, organizationId: request.organizationId }, { status }, { new: true });
    if (!record) throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found'); return record;
  });
}
