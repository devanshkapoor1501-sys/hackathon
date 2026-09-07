import mongoose from 'mongoose';
import { Bot, AllowedDomain, Visitor, Conversation, Message, UsageRecord } from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { hashIp, normalizeDomain, randomId } from '../utils/security.js';
import { RetrievalService } from '../retrieval/vector.repository.js';
import { nvidiaProvider } from '../ai/nvidia.provider.js';

export class PublicChatService {
  constructor({ provider = nvidiaProvider, retrieval = new RetrievalService(provider) } = {}) { this.provider = provider; this.retrieval = retrieval; }

  builtInAnswer({ bot, question }) {
    const text = question.trim().toLowerCase().replace(/\s+/g, ' ');
    const name = bot.name || 'your support assistant';
    if (/\b(who are you|what are you|what(?:'s| is) your name|tell me about yourself)\b/.test(text)) return `I'm ${name}, an AI customer support assistant. I use this company's verified knowledge to answer questions and hand anything uncertain to the support team.`;
    if (/\b(what can you do|how can you help|what do you help with)\b/.test(text)) return `I can answer customer support questions using this company's verified knowledge. Ask me about its products, services, orders, or policies, and I'll safely hand off anything I can't verify.`;
    if (/^(hi|hello|hey|good morning|good afternoon|good evening)[!.?\s]*$/.test(text)) return `Hi! I'm ${name}. How can I help you today?`;
    if (/^(thanks|thank you|thank you so much|thx)[!.?\s]*$/.test(text)) return `You're welcome! Is there anything else I can help with?`;
    if (/^(bye|goodbye|see you|talk to you later)[!.?\s]*$/.test(text)) return `Goodbye! If you need anything else, ${name} will be here to help.`;
    return null;
  }

  async resolveBot(publicId, origin) {
    const bot = await Bot.findOne({ publicId, enabled: true });
    if (!bot) throw new AppError(404, 'BOT_NOT_FOUND', 'Bot not found');
    const domain = normalizeDomain(origin);
    if (!domain) throw new AppError(403, 'DOMAIN_REQUIRED', 'A valid website origin is required');
    const allowed = await AllowedDomain.exists({ organizationId: bot.organizationId, botId: bot._id, hostname: domain, enabled: true });
    if (!allowed) throw new AppError(403, 'DOMAIN_NOT_ALLOWED', 'This website is not allowed to use the bot');
    return { bot, organizationId: bot.organizationId, domain };
  }

  async getConfiguration(publicId, origin) {
    const { bot } = await this.resolveBot(publicId, origin);
    return { publicId: bot.publicId, name: bot.name, welcomeMessage: bot.welcomeMessage, fallbackMessage: bot.fallbackMessage, appearance: bot.appearance };
  }

  async prepareMessage({ publicId, origin, visitorKey, conversationPublicId, question, ip, userAgent }) {
    const { bot, organizationId, domain } = await this.resolveBot(publicId, origin);
    return this.prepareConversation({ bot, organizationId, domain, visitorKey, conversationPublicId, question, ip, userAgent });
  }

  async prepareTestMessage({ organizationId, botId, userId, conversationPublicId, question, ip, userAgent }) {
    const bot = await Bot.findOne({ _id: botId, organizationId });
    if (!bot) throw new AppError(404, 'BOT_NOT_FOUND', 'Bot not found');
    return this.prepareConversation({ bot, organizationId, domain: 'dashboard-test', visitorKey: `dashboard:${userId}`, conversationPublicId, question, ip, userAgent });
  }

  async prepareConversation({ bot, organizationId, domain, visitorKey, conversationPublicId, question, ip, userAgent }) {
    const visitor = await Visitor.findOneAndUpdate(
      { organizationId, botId: bot._id, visitorKey },
      { $set: { lastSeenAt: new Date(), userAgent }, $setOnInsert: { firstSeenAt: new Date(), ipHash: hashIp(ip) } },
      { upsert: true, new: true }
    );
    let conversation;
    if (conversationPublicId) conversation = await Conversation.findOne({ organizationId, botId: bot._id, publicId: conversationPublicId, visitorId: visitor._id });
    if (!conversation) conversation = await Conversation.create({ organizationId, botId: bot._id, visitorId: visitor._id, publicId: randomId('con_'), domain });
    await Message.create({ organizationId, botId: bot._id, conversationId: conversation._id, role: 'user', content: question });
    conversation.lastMessageAt = new Date(); await conversation.save();
    return { bot, organizationId, conversation, question };
  }

  async *answer(context) {
    const started = Date.now();
    let answer = '';
    let usage = {};
    let answerStatus = 'supported';
    let sources = [];
    const builtIn = this.builtInAnswer(context);
    if (builtIn) {
      answer = builtIn;
      yield { type: 'delta', text: answer };
    } else {
      const retrieval = await this.retrieval.retrieve({ organizationId: context.organizationId, botId: context.bot._id, question: context.question });
      sources = retrieval.chunks.map(chunk => ({ sourceId: chunk.sourceId, name: chunk.sourceName, chunkIndex: chunk.chunkIndex, score: chunk.score }));
      if (retrieval.status !== 'supported') {
        answerStatus = 'escalated';
        answer = context.bot.fallbackMessage;
        context.conversation.status = 'escalated'; context.conversation.escalatedAt = new Date(); context.conversation.escalationReason = retrieval.status; await context.conversation.save();
        yield { type: 'delta', text: answer };
      } else {
        try {
          for await (const part of this.provider.streamAnswer({ question: context.question, contexts: retrieval.chunks, instructions: context.bot.instructions })) {
            answer += part.text; usage = part.usage || usage; yield { type: 'delta', text: part.text };
          }
        } catch {
          answerStatus = 'escalated';
          answer = context.bot.fallbackMessage;
          context.conversation.status = 'escalated'; context.conversation.escalatedAt = new Date(); context.conversation.escalationReason = 'provider_error'; await context.conversation.save();
          yield { type: 'replace', text: answer };
        }
      }
    }
    const latencyMs = Date.now() - started;
    const message = await Message.create({ organizationId: context.organizationId, botId: context.bot._id, conversationId: context.conversation._id, role: 'assistant', content: answer, answerStatus, sources, latencyMs, usage: { promptTokens: usage.prompt_tokens || 0, completionTokens: usage.completion_tokens || 0, totalTokens: usage.total_tokens || 0 } });
    await UsageRecord.create({ organizationId: context.organizationId, botId: context.bot._id, conversationId: context.conversation._id, type: 'chat', promptTokens: usage.prompt_tokens || 0, completionTokens: usage.completion_tokens || 0, latencyMs });
    yield { type: 'done', conversationId: context.conversation.publicId, messageId: message._id.toString(), status: answerStatus, sources };
  }

  async history({ publicId, origin, visitorKey, conversationPublicId }) {
    const { bot, organizationId } = await this.resolveBot(publicId, origin);
    const visitor = await Visitor.findOne({ organizationId, botId: bot._id, visitorKey });
    if (!visitor) return [];
    const conversation = await Conversation.findOne({ organizationId, botId: bot._id, visitorId: visitor._id, publicId: conversationPublicId });
    if (!conversation) return [];
    return Message.find({ organizationId, botId: bot._id, conversationId: conversation._id, role: { $in: ['user', 'assistant', 'agent'] } }).select('role content authorName answerStatus sources createdAt').sort({ createdAt: 1 }).lean();
  }
}

export const publicChatService = new PublicChatService();
