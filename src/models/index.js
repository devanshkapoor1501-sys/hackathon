import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;
const objectId = { type: Schema.Types.ObjectId, required: true, index: true };
const timestamps = { timestamps: true, versionKey: false };
const named = (name, schema) => models[name] || model(name, schema);

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  accountRole: { type: String, enum: ['applicant', 'professional', 'government', 'platform_admin'], default: 'applicant', index: true },
  emailVerifiedAt: Date,
  emailVerificationTokenHash: String,
  passwordResetTokenHash: String,
  passwordResetExpiresAt: Date,
  status: { type: String, enum: ['active', 'disabled'], default: 'active' }
}, timestamps);

const refreshTokenSchema = new Schema({
  userId: objectId,
  familyId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  revokedAt: Date,
  replacedByHash: String,
  userAgent: String,
  ip: String
}, timestamps);

const organizationSchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  createdBy: objectId
}, timestamps);

const memberSchema = new Schema({
  organizationId: { ...objectId, ref: 'Organization' },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  role: { type: String, enum: ['owner', 'admin', 'agent', 'viewer'], default: 'viewer' },
  invitedEmail: { type: String, lowercase: true },
  status: { type: String, enum: ['invited', 'active'], default: 'active' }
}, timestamps);
memberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
memberSchema.index({ organizationId: 1, invitedEmail: 1 }, { unique: true, partialFilterExpression: { invitedEmail: { $type: 'string' } } });

const botSchema = new Schema({
  organizationId: objectId,
  publicId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  enabled: { type: Boolean, default: true },
  instructions: { type: String, default: '' },
  welcomeMessage: { type: String, default: 'Hi! How can I help?' },
  fallbackMessage: { type: String, default: "I don't have enough verified information to answer that. A support teammate can help." },
  supportEmail: { type: String, default: '' },
  escalationRules: { type: [String], default: ['missing_context', 'weak_context', 'conflicting_context'] },
  appearance: {
    color: { type: String, default: '#6857f5' },
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
    position: { type: String, enum: ['bottom-left', 'bottom-right'], default: 'bottom-right' },
    avatarUrl: { type: String, default: '' }
  }
}, timestamps);
botSchema.index({ organizationId: 1, createdAt: -1 });

const allowedDomainSchema = new Schema({
  organizationId: objectId,
  botId: objectId,
  hostname: { type: String, required: true, lowercase: true },
  enabled: { type: Boolean, default: true }
}, timestamps);
allowedDomainSchema.index({ organizationId: 1, botId: 1, hostname: 1 }, { unique: true });

const sourceSchema = new Schema({
  organizationId: objectId,
  botId: objectId,
  type: { type: String, enum: ['text', 'faq', 'txt', 'pdf', 'docx', 'url'], required: true },
  name: { type: String, required: true },
  url: String,
  filePath: String,
  mimeType: String,
  content: String,
  faqEntries: [{ question: String, answer: String }],
  contentHash: { type: String, index: true },
  status: { type: String, enum: ['queued', 'processing', 'ready', 'failed'], default: 'queued' },
  processingStartedAt: Date,
  error: String,
  processedAt: Date,
  processingVersion: { type: Number, default: 0 }
}, timestamps);
sourceSchema.index({ organizationId: 1, botId: 1, createdAt: -1 });
sourceSchema.index({ status: 1, processingStartedAt: 1, createdAt: 1 });
sourceSchema.index({ organizationId: 1, botId: 1, contentHash: 1 }, { unique: true, sparse: true });

const chunkSchema = new Schema({
  organizationId: objectId,
  botId: objectId,
  sourceId: objectId,
  text: { type: String, required: true },
  embedding: { type: [Number], required: true, select: false },
  chunkIndex: { type: Number, required: true },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, timestamps);
chunkSchema.index({ organizationId: 1, botId: 1, sourceId: 1, chunkIndex: 1 }, { unique: true });

const visitorSchema = new Schema({
  organizationId: objectId,
  botId: objectId,
  visitorKey: { type: String, required: true },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  userAgent: String,
  ipHash: String
}, timestamps);
visitorSchema.index({ organizationId: 1, botId: 1, visitorKey: 1 }, { unique: true });

const conversationSchema = new Schema({
  organizationId: objectId,
  botId: objectId,
  visitorId: objectId,
  publicId: { type: String, required: true, unique: true },
  status: { type: String, enum: ['open', 'resolved', 'escalated'], default: 'open' },
  escalatedAt: Date,
  escalationReason: String,
  domain: String,
  lastMessageAt: { type: Date, default: Date.now }
}, timestamps);
conversationSchema.index({ organizationId: 1, botId: 1, lastMessageAt: -1 });

const messageSchema = new Schema({
  organizationId: objectId,
  botId: objectId,
  conversationId: objectId,
  role: { type: String, enum: ['user', 'assistant', 'agent', 'system'], required: true },
  content: { type: String, required: true },
  authorUserId: Schema.Types.ObjectId,
  authorName: String,
  answerStatus: { type: String, enum: ['supported', 'escalated', 'error'] },
  sources: [{ sourceId: Schema.Types.ObjectId, name: String, chunkIndex: Number, score: Number }],
  latencyMs: Number,
  usage: { promptTokens: Number, completionTokens: Number, totalTokens: Number }
}, timestamps);
messageSchema.index({ organizationId: 1, botId: 1, conversationId: 1, createdAt: 1 });

const usageSchema = new Schema({
  organizationId: objectId,
  botId: objectId,
  conversationId: Schema.Types.ObjectId,
  type: { type: String, enum: ['chat', 'embedding'], required: true },
  promptTokens: { type: Number, default: 0 },
  completionTokens: { type: Number, default: 0 },
  latencyMs: Number,
  occurredAt: { type: Date, default: Date.now, index: true }
}, timestamps);
usageSchema.index({ organizationId: 1, botId: 1, occurredAt: -1 });

const subscriptionSchema = new Schema({
  organizationId: { ...objectId, unique: true },
  plan: { type: String, default: 'starter' },
  status: { type: String, enum: ['trialing', 'active', 'past_due', 'canceled'], default: 'trialing' },
  currentPeriodEnd: Date,
  externalCustomerId: String
}, timestamps);

const auditSchema = new Schema({
  organizationId: objectId,
  actorUserId: Schema.Types.ObjectId,
  action: { type: String, required: true },
  targetType: String,
  targetId: String,
  ip: String,
  metadata: { type: Schema.Types.Mixed, default: {} }
}, timestamps);
auditSchema.index({ organizationId: 1, createdAt: -1 });

export const User = named('User', userSchema);
export const RefreshToken = named('RefreshToken', refreshTokenSchema);
export const Organization = named('Organization', organizationSchema);
export const OrganizationMember = named('OrganizationMember', memberSchema);
export const Bot = named('Bot', botSchema);
export const AllowedDomain = named('AllowedDomain', allowedDomainSchema);
export const KnowledgeSource = named('KnowledgeSource', sourceSchema);
export const KnowledgeChunk = named('KnowledgeChunk', chunkSchema);
export const Visitor = named('Visitor', visitorSchema);
export const Conversation = named('Conversation', conversationSchema);
export const Message = named('Message', messageSchema);
export const UsageRecord = named('UsageRecord', usageSchema);
export const Subscription = named('Subscription', subscriptionSchema);
export const AuditLog = named('AuditLog', auditSchema);
