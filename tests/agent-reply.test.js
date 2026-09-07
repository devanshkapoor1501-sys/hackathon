import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { Message } from '../src/models/index.js';

describe('support agent replies', () => {
  it('accepts an attributed agent message in a customer conversation', async () => {
    const id = () => new mongoose.Types.ObjectId();
    const message = new Message({ organizationId: id(), botId: id(), conversationId: id(), role: 'agent', content: 'I can help with that return.', authorUserId: id(), authorName: 'Support Agent' });

    await expect(message.validate()).resolves.toBeUndefined();
    expect(message).toMatchObject({ role: 'agent', authorName: 'Support Agent' });
  });
});
