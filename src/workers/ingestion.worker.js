import { connectDatabase } from '../db/mongoose.js';
import { KnowledgeSource, KnowledgeChunk, UsageRecord } from '../models/index.js';
import { extractSource, chunkText } from '../ingestion/extract.js';
import { nvidiaProvider } from '../ai/nvidia.provider.js';
import { logger } from '../config/logger.js';

await connectDatabase();

async function processNextSource() {
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
  const source = await KnowledgeSource.findOneAndUpdate(
    { $or: [{ status: 'queued' }, { status: 'processing', processingStartedAt: { $lt: staleBefore } }] },
    { $set: { status: 'processing', processingStartedAt: new Date(), error: null } },
    { new: true, sort: { createdAt: 1 } }
  );
  if (!source) return false;
  const sourceId = source._id;
  const organizationId = source.organizationId;
  const botId = source.botId;
  try {
    const text = await extractSource(source);
    const chunks = chunkText(text);
    if (!chunks.length) throw new Error('No useful text could be extracted');
    const embeddings = [];
    for (let i = 0; i < chunks.length; i += 32) embeddings.push(...await nvidiaProvider.embed(chunks.slice(i, i + 32)));
    await KnowledgeChunk.deleteMany({ organizationId, botId, sourceId });
    await KnowledgeChunk.insertMany(chunks.map((value, index) => ({ organizationId, botId, sourceId, text: value, embedding: embeddings[index], chunkIndex: index, metadata: { sourceName: source.name, sourceType: source.type } })));
    source.status = 'ready'; source.processedAt = new Date(); source.processingStartedAt = undefined; await source.save();
    await UsageRecord.create({ organizationId, botId, type: 'embedding', promptTokens: Math.ceil(text.length / 4) });
    logger.info({ sourceId, organizationId, botId, chunks: chunks.length }, 'Knowledge source processed');
  } catch (error) {
    source.status = 'failed'; source.processingStartedAt = undefined; source.error = error.message.slice(0, 1000); await source.save();
    logger.error({ sourceId, organizationId, botId, err: error }, 'Knowledge source processing failed');
  }
  return true;
}

let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

logger.info('MongoDB-backed knowledge ingestion worker started');
while (!stopping) {
  const processed = await processNextSource();
  if (!processed) await new Promise(resolve => setTimeout(resolve, 1500));
}
process.exit(0);
