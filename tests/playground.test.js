import { afterEach, describe, expect, it, vi } from 'vitest';
import { Bot, Conversation, Message, UsageRecord, Visitor } from '../src/models/index.js';
import { PublicChatService } from '../src/services/public-chat.service.js';

describe('authenticated AI playground', () => {
  afterEach(() => vi.restoreAllMocks());

  it('prepares a tenant-scoped dashboard test conversation without an allowed domain', async () => {
    const bot = { _id: 'bot', organizationId: 'org' };
    const visitor = { _id: 'visitor' };
    const conversation = { _id: 'conversation', publicId: 'con_test', lastMessageAt: null, save: vi.fn() };
    const findBot = vi.spyOn(Bot, 'findOne').mockResolvedValue(bot);
    const findVisitor = vi.spyOn(Visitor, 'findOneAndUpdate').mockResolvedValue(visitor);
    vi.spyOn(Conversation, 'create').mockResolvedValue(conversation);
    vi.spyOn(Message, 'create').mockResolvedValue({ _id: 'message' });

    const context = await new PublicChatService().prepareTestMessage({ organizationId: 'org', botId: 'bot', userId: 'user', question: 'What is the return policy?', ip: '127.0.0.1', userAgent: 'vitest' });

    expect(findBot).toHaveBeenCalledWith({ _id: 'bot', organizationId: 'org' });
    expect(findVisitor).toHaveBeenCalledWith(expect.objectContaining({ visitorKey: 'dashboard:user' }), expect.anything(), expect.anything());
    expect(context).toMatchObject({ bot, organizationId: 'org', conversation, question: 'What is the return policy?' });
    expect(conversation.save).toHaveBeenCalled();
  });

  it('answers bot identity questions without retrieval or escalation', async () => {
    const retrieval = { retrieve: vi.fn() }, provider = { streamAnswer: vi.fn() };
    const conversation = { _id: 'conversation', publicId: 'con_test', status: 'open', save: vi.fn() };
    vi.spyOn(Message, 'create').mockResolvedValue({ _id: 'message' });
    vi.spyOn(UsageRecord, 'create').mockResolvedValue({});
    const events = [];

    for await (const event of new PublicChatService({ provider, retrieval }).answer({ organizationId: 'org', bot: { _id: 'bot', name: 'Testing Support' }, conversation, question: 'Who are you?' })) events.push(event);

    expect(events[0]).toMatchObject({ type: 'delta', text: expect.stringContaining("I'm Testing Support") });
    expect(events.at(-1)).toMatchObject({ type: 'done', status: 'supported', sources: [] });
    expect(retrieval.retrieve).not.toHaveBeenCalled();
    expect(provider.streamAnswer).not.toHaveBeenCalled();
    expect(conversation.status).toBe('open');
  });
});
