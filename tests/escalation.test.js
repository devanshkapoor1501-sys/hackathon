import { afterEach, describe, expect, it, vi } from 'vitest';
import { Message, UsageRecord } from '../src/models/index.js';
import { PublicChatService } from '../src/services/public-chat.service.js';

describe('unsupported-question escalation', () => {
  afterEach(() => vi.restoreAllMocks());
  it('uses the configured fallback without calling the chat model', async () => {
    const provider = { streamAnswer: vi.fn() }, retrieval = { retrieve: vi.fn().mockResolvedValue({ status: 'missing_context', chunks: [] }) };
    const conversation = { _id: 'c', publicId: 'con_public', status: 'open', save: vi.fn() };
    vi.spyOn(Message, 'create').mockResolvedValue({ _id: 'm' }); vi.spyOn(UsageRecord, 'create').mockResolvedValue({});
    const events=[]; for await (const event of new PublicChatService({ provider, retrieval }).answer({ organizationId: 'o', bot: { _id: 'b', fallbackMessage: 'Let me escalate that.' }, conversation, question: 'Do this action' })) events.push(event);
    expect(events[0]).toMatchObject({ type: 'delta', text: 'Let me escalate that.' }); expect(events.at(-1).status).toBe('escalated'); expect(conversation.status).toBe('escalated'); expect(provider.streamAnswer).not.toHaveBeenCalled();
  });
  it('stores a safe escalation when the model provider fails', async () => {
    const provider = { async *streamAnswer() { throw new Error('provider unavailable'); } };
    const retrieval = { retrieve: vi.fn().mockResolvedValue({ status: 'supported', chunks: [{ sourceId: 's', sourceName: 'Policy', chunkIndex: 0, score: 0.9 }] }) };
    const conversation = { _id: 'c', publicId: 'con_public', status: 'open', save: vi.fn() };
    const createMessage = vi.spyOn(Message, 'create').mockResolvedValue({ _id: 'm' }); vi.spyOn(UsageRecord, 'create').mockResolvedValue({});
    const events=[]; for await (const event of new PublicChatService({ provider, retrieval }).answer({ organizationId: 'o', bot: { _id: 'b', fallbackMessage: 'Let me escalate that.' }, conversation, question: 'What is the policy?' })) events.push(event);
    expect(events[0]).toMatchObject({ type: 'replace', text: 'Let me escalate that.' }); expect(events.at(-1).status).toBe('escalated'); expect(conversation).toMatchObject({ status: 'escalated', escalationReason: 'provider_error' }); expect(createMessage).toHaveBeenCalledWith(expect.objectContaining({ content: 'Let me escalate that.', answerStatus: 'escalated' }));
  });
});
