import { describe, expect, it, vi } from 'vitest';
import { RetrievalService } from '../src/retrieval/vector.repository.js';

describe('retrieval filtering', () => {
  it('drops results belonging to another organization or bot', async () => {
    const provider = { embed: vi.fn().mockResolvedValue([[0.1, 0.2]]) };
    const repository = { search: vi.fn().mockResolvedValue([
      { organizationId: 'org-a', botId: 'bot-a', score: 0.91, text: 'Approved' },
      { organizationId: 'org-b', botId: 'bot-a', score: 0.99, text: 'Leaked' },
      { organizationId: 'org-a', botId: 'bot-b', score: 0.99, text: 'Wrong bot' }
    ]) };
    const result = await new RetrievalService(provider, repository).retrieve({ organizationId: 'org-a', botId: 'bot-a', question: 'Policy?' });
    expect(result.chunks).toHaveLength(1); expect(result.chunks[0].text).toBe('Approved');
  });
  it('marks weak retrieval as missing context', async () => {
    const service = new RetrievalService({ embed: vi.fn().mockResolvedValue([[1]]) }, { search: vi.fn().mockResolvedValue([{ organizationId: 'o', botId: 'b', score: 0.2 }]) });
    expect((await service.retrieve({ organizationId: 'o', botId: 'b', question: 'x' })).status).toBe('missing_context');
  });
  it('safely escalates when no embedding provider is available', async () => {
    const repository = { search: vi.fn() };
    const service = new RetrievalService({ embed: vi.fn().mockRejectedValue(new Error('AI disabled')) }, repository);
    const result = await service.retrieve({ organizationId: 'o', botId: 'b', question: 'x' });
    expect(result).toEqual({ chunks: [], status: 'missing_context' });
    expect(repository.search).not.toHaveBeenCalled();
  });
});
