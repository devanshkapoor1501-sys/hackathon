import { z } from 'zod';
import mongoose from 'mongoose';
import { authenticate, authorizeOrganization } from '../middleware/auth.js';
import { Organization, OrganizationMember, Subscription, User } from '../models/index.js';
import { randomId } from '../utils/security.js';
import { writeAudit } from '../services/audit.service.js';
import { AppError } from '../utils/errors.js';

export async function organizationRoutes(app) {
  app.addHook('preHandler', authenticate);
  app.get('/', async request => OrganizationMember.find({ userId: request.user._id, status: 'active' }).populate('organizationId').lean());
  app.post('/', async request => {
    const { name } = z.object({ name: z.string().min(2).max(120) }).parse(request.body);
    const org = await Organization.create({ name, slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${randomId().slice(0, 6)}`, createdBy: request.user._id });
    await Promise.all([OrganizationMember.create({ organizationId: org._id, userId: request.user._id, role: 'owner' }), Subscription.create({ organizationId: org._id })]);
    await writeAudit({ organizationId: org._id, actorUserId: request.user._id, action: 'organization.created', targetType: 'organization', targetId: org._id, ip: request.ip });
    return org;
  });
  app.patch('/:organizationId', { preHandler: authorizeOrganization(['owner', 'admin']) }, async request => {
    const { name } = z.object({ name: z.string().trim().min(2).max(120) }).parse(request.body);
    const organization = await Organization.findOneAndUpdate({ _id: request.organizationId }, { $set: { name } }, { new: true, runValidators: true });
    if (!organization) throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found');
    await writeAudit({ organizationId: request.organizationId, actorUserId: request.user._id, action: 'organization.updated', targetType: 'organization', targetId: organization._id, ip: request.ip, metadata: { fields: ['name'] } });
    return organization;
  });
  app.get('/:organizationId/members', { preHandler: authorizeOrganization() }, async request => OrganizationMember.find({ organizationId: request.organizationId }).populate('userId', 'name email').lean());
  app.post('/:organizationId/members', { preHandler: authorizeOrganization(['owner', 'admin']) }, async request => {
    const body = z.object({ email: z.string().email(), role: z.enum(['admin', 'agent', 'viewer']) }).parse(request.body);
    const user = await User.findOne({ email: body.email.toLowerCase() });
    const email = body.email.toLowerCase();
    const membership = await OrganizationMember.findOneAndUpdate({ organizationId: request.organizationId, ...(user ? { userId: user._id } : { invitedEmail: email }) }, { $set: { organizationId: request.organizationId, userId: user?._id || new mongoose.Types.ObjectId(), invitedEmail: user ? undefined : email, role: body.role, status: user ? 'active' : 'invited' } }, { upsert: true, new: true, runValidators: true }).populate('userId', 'name email');
    await writeAudit({ organizationId: request.organizationId, actorUserId: request.user._id, action: 'member.invited', targetType: 'organizationMember', targetId: membership._id, ip: request.ip, metadata: { email, role: body.role } });
    return membership;
  });
  app.patch('/:organizationId/members/:memberId', { preHandler: authorizeOrganization(['owner', 'admin']) }, async request => {
    const { role } = z.object({ role: z.enum(['admin', 'agent', 'viewer']) }).parse(request.body);
    const member = await OrganizationMember.findOne({ _id: request.params.memberId, organizationId: request.organizationId });
    if (!member) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Team member not found');
    if (member.role === 'owner') throw new AppError(400, 'OWNER_ROLE_LOCKED', 'The workspace owner role cannot be changed');
    member.role = role;
    await member.save();
    await member.populate('userId', 'name email');
    await writeAudit({ organizationId: request.organizationId, actorUserId: request.user._id, action: 'member.role_updated', targetType: 'organizationMember', targetId: member._id, ip: request.ip, metadata: { role } });
    return member;
  });
  app.delete('/:organizationId/members/:memberId', { preHandler: authorizeOrganization(['owner', 'admin']) }, async request => {
    const member = await OrganizationMember.findOne({ _id: request.params.memberId, organizationId: request.organizationId });
    if (!member) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Team member not found');
    if (member.role === 'owner') throw new AppError(400, 'OWNER_REQUIRED', 'The workspace owner cannot be removed');
    await member.deleteOne();
    await writeAudit({ organizationId: request.organizationId, actorUserId: request.user._id, action: 'member.removed', targetType: 'organizationMember', targetId: member._id, ip: request.ip });
    return { ok: true };
  });
}
