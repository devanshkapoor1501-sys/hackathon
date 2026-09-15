import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { connectDatabase, disconnectDatabase } from '../src/db/mongoose.js';
import { SelfTrainingFeedback, LegalSource } from '../src/models/legal.js';

const output = path.resolve(process.argv[2] || 'training/review/self-training-approved.jsonl');

await connectDatabase();
try {
  const records = await SelfTrainingFeedback.find({ status: 'APPROVED', rating: { $ne: 'UNSUPPORTED' } }).sort({ createdAt: 1 }).lean();
  const sourceKeys = [...new Set(records.flatMap(record => record.sourceRefs || []))];
  const sources = await LegalSource.find({ sourceKey: { $in: sourceKeys } }).select('sourceKey trainingEligibility').lean();
  const eligibleSources = new Set(sources.filter(source => source.trainingEligibility === 'TRAINING_ELIGIBLE').map(source => source.sourceKey));
  const rows = records.filter(record => (record.sourceRefs || []).length > 0 && (record.sourceRefs || []).every(sourceKey => eligibleSources.has(sourceKey))).map(record => ({
    ...record.example,
    status: 'APPROVED',
    reviewNotes: record.correctionNotes || 'Approved by an organization owner/admin after human review.',
    sourceRefs: record.sourceRefs,
    metadata: { ...(record.example?.metadata || {}), feedbackId: String(record._id), approvedAt: record.reviewedAt || new Date().toISOString() }
  }));
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, rows.length ? `${rows.map(row => JSON.stringify(row)).join('\n')}\n` : '', 'utf8');
  console.log(JSON.stringify({ output, approvedExamples: rows.length }, null, 2));
} finally {
  await disconnectDatabase();
}
