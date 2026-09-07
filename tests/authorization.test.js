import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrganizationMember } from '../src/models/index.js';
import { authorizeOrganization } from '../src/middleware/auth.js';

describe('organization authorization', () => {
  afterEach(() => vi.restoreAllMocks());
  it('rejects a viewer from admin operations', async () => {
    vi.spyOn(OrganizationMember, 'findOne').mockResolvedValue({ organizationId: 'org', role: 'viewer' });
    await expect(authorizeOrganization(['owner','admin'])({ params: { organizationId: 'org' }, user: { _id: 'user' } })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
