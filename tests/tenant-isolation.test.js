import { describe, expect, it, vi } from 'vitest';
import { TenantRepository } from '../src/repositories/tenant.repository.js';

describe('tenant repository', () => {
  it('always adds organizationId to reads and updates', async () => {
    const model = { modelName: 'Bot', findOne: vi.fn().mockResolvedValue({}), findOneAndUpdate: vi.fn().mockResolvedValue({}) };
    const repo = new TenantRepository(model);
    await repo.findOne('org-a', { _id: 'bot-a' }); await repo.updateOne('org-a', { _id: 'bot-a' }, { name: 'Updated' });
    expect(model.findOne).toHaveBeenCalledWith({ _id: 'bot-a', organizationId: 'org-a' });
    expect(model.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: 'bot-a', organizationId: 'org-a' });
  });
  it('rejects a cross-tenant create', async () => {
    const repo = new TenantRepository({ create: vi.fn() });
    expect(() => repo.create('org-a', { organizationId: 'org-b' })).toThrowError(expect.objectContaining({ code: 'FORBIDDEN' }));
  });
});
