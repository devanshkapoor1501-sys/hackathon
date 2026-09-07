import { describe, expect, it, vi } from 'vitest';
import { TenantRepository } from '../src/repositories/tenant.repository.js';

describe('bot CRUD tenant scoping', () => {
  it('scopes delete by both private id and organization', async () => {
    const model={deleteOne:vi.fn().mockResolvedValue({deletedCount:1})}; await new TenantRepository(model).deleteOne('org-1',{_id:'bot-1'});
    expect(model.deleteOne).toHaveBeenCalledWith({_id:'bot-1',organizationId:'org-1'});
  });
});
