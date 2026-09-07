import { KnowledgeChunk } from '../models/index.js';
import { env } from '../config/env.js';

export class AtlasVectorRepository {
  async search({ organizationId, botId, vector, limit = 6 }) {
    return KnowledgeChunk.aggregate([
      {
        $vectorSearch: {
          index: env.VECTOR_INDEX_NAME,
          path: 'embedding',
          queryVector: vector,
          numCandidates: Math.max(limit * 20, 100),
          limit,
          filter: { organizationId: { $eq: organizationId }, botId: { $eq: botId } }
        }
      },
      { $set: { score: { $meta: 'vectorSearchScore' } } },
      { $match: { organizationId, botId } },
      { $lookup: { from: 'knowledgesources', localField: 'sourceId', foreignField: '_id', as: 'source' } },
      { $set: { sourceName: { $ifNull: [{ $first: '$source.name' }, 'Knowledge source'] } } },
      { $project: { text: 1, sourceId: 1, sourceName: 1, chunkIndex: 1, score: 1, organizationId: 1, botId: 1 } }
    ]);
  }
}

export class RetrievalService {
  constructor(provider, repository = new AtlasVectorRepository()) { this.provider = provider; this.repository = repository; }
  async retrieve({ organizationId, botId, question }) {
    let vector;
    try {
      [vector] = await this.provider.embed([question], 'query');
    } catch {
      return { chunks: [], status: 'missing_context' };
    }
    if (!Array.isArray(vector) || !vector.length) return { chunks: [], status: 'missing_context' };
    const chunks = await this.repository.search({ organizationId, botId, vector });
    const relevant = chunks.filter(chunk =>
      String(chunk.organizationId) === String(organizationId) &&
      String(chunk.botId) === String(botId) &&
      chunk.score >= env.RETRIEVAL_MIN_SCORE
    );
    const conflict = relevant.length > 1 && relevant[0].score - relevant.at(-1).score > 0.3 && /\b(always|never|only|must)\b/i.test(relevant.map(c => c.text).join(' '));
    return { chunks: relevant, status: relevant.length ? (conflict ? 'conflicting_context' : 'supported') : 'missing_context' };
  }
}
