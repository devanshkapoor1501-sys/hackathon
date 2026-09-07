import { afterEach, describe, expect, it, vi } from 'vitest';
import { Bot, AllowedDomain } from '../src/models/index.js';
import { PublicChatService } from '../src/services/public-chat.service.js';

describe('public widget domain validation', () => {
  afterEach(() => vi.restoreAllMocks());
  it('resolves organization before checking an organization-and-bot-scoped domain', async () => {
    vi.spyOn(Bot, 'findOne').mockResolvedValue({ _id: 'bot-private', organizationId: 'org-private', publicId: 'bot_public' });
    const allowed = vi.spyOn(AllowedDomain, 'exists').mockResolvedValue({ _id: 'domain' });
    await new PublicChatService().resolveBot('bot_public', 'https://shop.example.com/path');
    expect(allowed).toHaveBeenCalledWith({ organizationId: 'org-private', botId: 'bot-private', hostname: 'shop.example.com', enabled: true });
  });
  it('rejects unlisted domains', async () => {
    vi.spyOn(Bot, 'findOne').mockResolvedValue({ _id: 'b', organizationId: 'o' }); vi.spyOn(AllowedDomain, 'exists').mockResolvedValue(null);
    await expect(new PublicChatService().resolveBot('bot_public', 'https://evil.example')).rejects.toMatchObject({ code: 'DOMAIN_NOT_ALLOWED' });
  });
});
