import mongoose from 'mongoose';
import { connectDatabase } from '../src/db/mongoose.js';
import { env } from '../src/config/env.js';
import { KnowledgeChunk } from '../src/models/index.js';

await connectDatabase();

const existing = await KnowledgeChunk.collection
  .listSearchIndexes(env.VECTOR_INDEX_NAME)
  .toArray();

if (!existing.length) {
  await KnowledgeChunk.collection.createSearchIndex({
    name: env.VECTOR_INDEX_NAME,
    type: 'vectorSearch',
    definition: {
      fields: [
        { type: 'vector', path: 'embedding', numDimensions: env.VECTOR_DIMENSIONS, similarity: 'cosine' },
        { type: 'filter', path: 'organizationId' },
        { type: 'filter', path: 'botId' }
      ]
    }
  });
  console.log(`Created ${env.VECTOR_INDEX_NAME}; Atlas is building it asynchronously.`);
} else {
  const index = existing[0];
  console.log(`${env.VECTOR_INDEX_NAME} already exists (${index.status || 'status unavailable'}).`);
}

await mongoose.disconnect();
