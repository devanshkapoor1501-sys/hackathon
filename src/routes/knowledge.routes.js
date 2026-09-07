import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sanitizeFilename from 'sanitize-filename';
import { z } from 'zod';
import { authenticate, authorizeOrganization } from '../middleware/auth.js';
import { Bot, KnowledgeSource, KnowledgeChunk } from '../models/index.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const allowedMime = new Map([['text/plain', 'txt'], ['application/pdf', 'pdf'], ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx']]);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

async function requireBot(organizationId, botId) {
  const bot = await Bot.exists({ _id: botId, organizationId });
  if (!bot) throw new AppError(404, 'BOT_NOT_FOUND', 'Bot not found');
}

export async function knowledgeRoutes(app) {
  app.addHook('preHandler', authenticate);
  app.get('/:organizationId/bots/:botId/sources', { preHandler: authorizeOrganization() }, async request => KnowledgeSource.find({ organizationId: request.organizationId, botId: request.params.botId }).select('-content -faqEntries -filePath').sort({ createdAt: -1 }).lean());
  app.post('/:organizationId/bots/:botId/sources', { preHandler: authorizeOrganization(['owner', 'admin', 'agent']) }, async request => {
    await requireBot(request.organizationId, request.params.botId);
    const body = z.object({ type: z.enum(['text', 'faq', 'url']), name: z.string().min(1).max(200), content: z.string().max(2_000_000).optional(), url: z.string().url().optional(), faqEntries: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).max(1000).optional() }).parse(request.body);
    if (body.type === 'text' && !body.content) throw new AppError(400, 'CONTENT_REQUIRED', 'Text content is required');
    if (body.type === 'url' && !body.url) throw new AppError(400, 'URL_REQUIRED', 'Website URL is required');
    if (body.type === 'faq' && !body.faqEntries?.length) throw new AppError(400, 'FAQ_REQUIRED', 'At least one FAQ is required');
    const fingerprint = hash(JSON.stringify({ type: body.type, content: body.content, url: body.url, faqEntries: body.faqEntries }));
    const existing = await KnowledgeSource.findOne({ organizationId: request.organizationId, botId: request.params.botId, contentHash: fingerprint });
    if (existing) throw new AppError(409, 'DUPLICATE_SOURCE', 'This source has already been added');
    const source = await KnowledgeSource.create({ ...body, organizationId: request.organizationId, botId: request.params.botId, contentHash: fingerprint });
    return source;
  });
  app.post('/:organizationId/bots/:botId/sources/upload', { preHandler: authorizeOrganization(['owner', 'admin', 'agent']) }, async request => {
    await requireBot(request.organizationId, request.params.botId);
    const file = await request.file({ limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 } });
    if (!file || !allowedMime.has(file.mimetype)) throw new AppError(415, 'UNSUPPORTED_FILE', 'Upload a TXT, PDF, or DOCX file');
    const data = await file.toBuffer();
    if (data.length > env.MAX_UPLOAD_BYTES) throw new AppError(413, 'FILE_TOO_LARGE', 'File is too large');
    const fingerprint = hash(data);
    if (await KnowledgeSource.exists({ organizationId: request.organizationId, botId: request.params.botId, contentHash: fingerprint })) throw new AppError(409, 'DUPLICATE_SOURCE', 'This file has already been added');
    const safeName = sanitizeFilename(file.filename).slice(0, 180) || `upload.${allowedMime.get(file.mimetype)}`;
    const directory = path.resolve('uploads', request.organizationId.toString(), request.params.botId);
    await fs.mkdir(directory, { recursive: true });
    const filePath = path.join(directory, `${crypto.randomUUID()}-${safeName}`);
    await fs.writeFile(filePath, data, { flag: 'wx' });
    const source = await KnowledgeSource.create({ organizationId: request.organizationId, botId: request.params.botId, type: allowedMime.get(file.mimetype), name: safeName, mimeType: file.mimetype, filePath, contentHash: fingerprint });
    return source;
  });
  app.post('/:organizationId/bots/:botId/sources/:sourceId/reprocess', { preHandler: authorizeOrganization(['owner', 'admin', 'agent']) }, async request => {
    const source = await KnowledgeSource.findOneAndUpdate({ _id: request.params.sourceId, organizationId: request.organizationId, botId: request.params.botId }, { $set: { status: 'queued', error: null }, $inc: { processingVersion: 1 } }, { new: true });
    if (!source) throw new AppError(404, 'SOURCE_NOT_FOUND', 'Source not found');
    return source;
  });
  app.delete('/:organizationId/bots/:botId/sources/:sourceId', { preHandler: authorizeOrganization(['owner', 'admin']) }, async request => {
    const filter = { _id: request.params.sourceId, organizationId: request.organizationId, botId: request.params.botId };
    const source = await KnowledgeSource.findOne(filter);
    if (!source) throw new AppError(404, 'SOURCE_NOT_FOUND', 'Source not found');
    await Promise.all([KnowledgeChunk.deleteMany({ organizationId: request.organizationId, botId: request.params.botId, sourceId: source._id }), source.deleteOne(), source.filePath ? fs.rm(source.filePath, { force: true }) : Promise.resolve()]);
    return { ok: true };
  });
}
