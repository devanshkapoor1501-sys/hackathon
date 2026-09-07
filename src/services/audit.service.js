import { AuditLog } from '../models/index.js';

export function writeAudit({ organizationId, actorUserId, action, targetType, targetId, ip, metadata }) {
  return AuditLog.create({ organizationId, actorUserId, action, targetType, targetId: targetId?.toString(), ip, metadata });
}
