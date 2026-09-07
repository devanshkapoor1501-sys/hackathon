import { afterEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { User, RefreshToken, OrganizationMember } from '../src/models/index.js';
import { AuthService } from '../src/services/auth.service.js';

describe('authentication', () => {
  afterEach(() => vi.restoreAllMocks());
  it('hashes passwords during registration', async () => {
    vi.spyOn(User, 'exists').mockResolvedValue(null); const create = vi.spyOn(User, 'create').mockImplementation(async value => ({ ...value, _id: 'user1' }));
    vi.spyOn(OrganizationMember, 'updateMany').mockResolvedValue({ modifiedCount: 0 });
    await new AuthService().register({ name: 'Alex', email: 'ALEX@example.com', password: 'long-password' });
    expect(create.mock.calls[0][0].email).toBe('alex@example.com'); expect(await bcrypt.compare('long-password', create.mock.calls[0][0].passwordHash)).toBe(true);
  });
  it('activates pending organization invitations when the invited user registers', async () => {
    vi.spyOn(User, 'exists').mockResolvedValue(null);
    vi.spyOn(User, 'create').mockImplementation(async value => ({ ...value, _id: 'user2' }));
    const activate = vi.spyOn(OrganizationMember, 'updateMany').mockResolvedValue({ modifiedCount: 1 });
    await new AuthService().register({ name: 'Taylor', email: 'Invited@Example.com', password: 'long-password' });
    expect(activate).toHaveBeenCalledWith(
      { invitedEmail: 'invited@example.com', status: 'invited' },
      { $set: { userId: 'user2', status: 'active' }, $unset: { invitedEmail: 1 } },
    );
  });
  it('issues separate access and refresh tokens and stores a hash only', async () => {
    const create = vi.spyOn(RefreshToken, 'create').mockResolvedValue({}); const result = await new AuthService().issueSession({ _id: '507f191e810c19729de860ea', email: 'a@b.com', name: 'A' });
    expect(result.accessToken).not.toBe(result.refreshToken); expect(create.mock.calls[0][0].tokenHash).not.toContain(result.refreshToken); expect(create.mock.calls[0][0].familyId).toMatch(/^fam_/);
  });
});
