import mongoose from 'mongoose';
import { authenticate, authorizeOrganization } from '../middleware/auth.js';
import { Conversation, Message, Visitor, UsageRecord, Subscription } from '../models/index.js';

export async function analyticsRoutes(app) {
  app.addHook('preHandler', authenticate);
  app.get('/:organizationId/analytics', { preHandler: authorizeOrganization() }, async request => {
    const organizationId = new mongoose.Types.ObjectId(request.organizationId);
    const since = new Date(Date.now() - 30 * 86400000);
    const base = { organizationId, createdAt: { $gte: since } };
    const [visitors, conversations, messages, escalations, usage, daily, dailyConversations, questions] = await Promise.all([
      Visitor.countDocuments(base), Conversation.countDocuments(base), Message.countDocuments(base), Conversation.countDocuments({ ...base, status: 'escalated' }),
      UsageRecord.aggregate([{ $match: { organizationId, occurredAt: { $gte: since } } }, { $group: { _id: null, promptTokens: { $sum: '$promptTokens' }, completionTokens: { $sum: '$completionTokens' }, avgLatencyMs: { $avg: '$latencyMs' } } }]),
      UsageRecord.aggregate([{ $match: { organizationId, occurredAt: { $gte: since } } }, { $group: { _id: { $dateToString: { date: '$occurredAt', format: '%Y-%m-%d' } }, chats: { $sum: { $cond: [{ $eq: ['$type', 'chat'] }, 1, 0] } }, tokens: { $sum: { $add: ['$promptTokens', '$completionTokens'] } } } }, { $sort: { _id: 1 } }]),
      Conversation.aggregate([{ $match: base }, { $group: { _id: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d' } }, conversations: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Message.aggregate([{ $match: { ...base, role: 'user' } }, { $group: { _id: { $toLower: '$content' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }])
    ]);
    return { visitors, conversations, messages, escalations, usage: usage[0] || { promptTokens: 0, completionTokens: 0, avgLatencyMs: 0 }, daily, dailyConversations, commonQuestions: questions };
  });
  app.get('/:organizationId/usage', { preHandler: authorizeOrganization() }, async request => ({ subscription: await Subscription.findOne({ organizationId: request.organizationId }).lean(), records: await UsageRecord.find({ organizationId: request.organizationId }).sort({ occurredAt: -1 }).limit(100).lean() }));
}
