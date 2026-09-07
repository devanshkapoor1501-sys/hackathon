import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, OrganizationMember } from '../models/index.js';
import { AppError, forbidden } from '../utils/errors.js';

export async function authenticate(request) {
  const [scheme, token] = (request.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (payload.type !== 'access') throw new Error('Wrong token type');
    const user = await User.findById(payload.sub);
    if (!user || user.status !== 'active') throw new Error('User unavailable');
    request.user = user;
  } catch {
    throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Access token is invalid or expired');
  }
}

export function authorizeOrganization(roles = ['owner', 'admin', 'agent', 'viewer']) {
  return async request => {
    const organizationId = request.params.organizationId || request.body?.organizationId || request.query?.organizationId;
    const membership = await OrganizationMember.findOne({ organizationId, userId: request.user._id, status: 'active' });
    if (!membership || !roles.includes(membership.role)) throw forbidden('You do not have permission for this organization');
    request.organizationId = membership.organizationId;
    request.membership = membership;
  };
}

export function authorizeAccount(roles = []) {
  return async request => {
    if (!roles.includes(request.user?.accountRole || 'applicant')) throw forbidden('This area is restricted to an authorized account role');
  };
}
