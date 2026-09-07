import { LegalChunk } from '../models/legal.js';
import { env } from '../config/env.js';

// Prompt-injection patterns: text found in retrieved documents is DATA, never instructions.
export const INJECTION_PATTERNS = [
  /ignore (all|any|the) previous instructions/i,
  /disregard (all|any) (previous|prior|above)/i,
  /you are now/i,
  /system prompt/i,
  /(tell|say|state|claim) the user/i
];

export function detectInjection(text = '') {
  return INJECTION_PATTERNS.some(pattern => pattern.test(text));
}

const STOPWORDS = new Set('a an and are as at be by for from has have in is it its of on or that the this to was were will with shall may under section act rules'.split(' '));
const tokens = text => text.toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s.]/g, ' ').split(/\s+/).filter(t => t.length > 1 && !STOPWORDS.has(t));

function bm25(queryTerms, docTerms, df, avgLen, k1 = 1.4, b = 0.72) {
  const tf = new Map();
  for (const term of docTerms) tf.set(term, (tf.get(term) || 0) + 1);
  let score = 0;
  for (const term of queryTerms) {
    const f = tf.get(term) || 0;
    if (!f) continue;
    const idf = Math.log(1 + (df.total - df.get(term) + 0.5) / (df.get(term) + 0.5));
    score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * docTerms.length / avgLen));
  }
  return score;
}

const AUTHORITY_WEIGHT = level => ({ 1: 1.0, 2: 0.85, 3: 0.7, 4: 0.55, 5: 0.4, 6: 0.25, 7: 0.12 }[level] ?? 0.2);
export { AUTHORITY_WEIGHT };

export function temporalEligible(chunk, asOfISO) {
  const status = chunk.metadata?.status;
  if (status === 'DRAFT' || status === 'PROPOSED') return false; // never treat drafts as current law
  const from = chunk.metadata?.effectiveFrom ? new Date(chunk.metadata.effectiveFrom) : null;
  const to = chunk.metadata?.effectiveTo ? new Date(chunk.metadata.effectiveTo) : null;
  const asOf = asOfISO ? new Date(asOfISO) : new Date();
  if (asOf < new Date('2000-01-01')) return true; // guard against malformed dates
  if (from && asOf < from) return false;
  if (to && asOf > to) return false;
  return true;
}

export class LegalRetrievalService {
  constructor(provider, getEmbeddingModel = () => provider?.embeddingModel) {
    this.provider = provider;
    this.cache = null;
    this.getEmbeddingModel = getEmbeddingModel;
  }

  async loadIndex() {
    const count = await LegalChunk.countDocuments();
    if (!this.cache || this.cache.count !== count) {
      this.cache = { count, docs: await LegalChunk.find().lean() };
    }
    return this.cache.docs;
  }

  async lexicalScores(queries, { regimes = [], statuses = ['CURRENT'], asOf = undefined, includeTestDocs = false, jurisdiction = 'IN' } = {}) {
    const docs = (await this.loadIndex()).filter(doc =>
      temporalEligible(doc, asOf) &&
      (statuses.includes('*') || statuses.includes(doc.metadata?.status)) &&
      (!regimes.length || (doc.metadata?.regimes || []).some(r => regimes.includes(r))) &&
      (doc.metadata?.jurisdiction || 'IN') === jurisdiction &&
      (includeTestDocs || doc.metadata?.documentType !== 'test')
    );
    const allTerms = docs.map(doc => tokens(`${doc.text} ${doc.sectionLabel}`));
    const df = new Map();
    for (const terms of allTerms) {
      for (const term of new Set(terms)) df.set(term, (df.get(term) || 0) + 1);
    }
    df.total = docs.length;
    const avgLen = allTerms.reduce((sum, t) => sum + t.length, 0) / Math.max(1, allTerms.length);
    const results = [];
    docs.forEach((doc, i) => {
      let best = 0;
      for (const query of queries) {
        best = Math.max(best, bm25(tokens(query), allTerms[i], df, avgLen));
      }
      if (best <= 0) return;
      // authority + current-status boost
      const authorityBoost = AUTHORITY_WEIGHT(doc.metadata?.sourceLevel);
      const currentBoost = doc.metadata?.status === 'CURRENT' ? 1 : doc.metadata?.status === 'HISTORICAL' ? 0.45 : 0.2;
      results.push({ chunk: doc, score: best * (0.55 + 0.35 * currentBoost) * (0.75 + 0.25 * authorityBoost), lexicalScore: best });
    });
    return results.sort((a, b) => b.score - a.score);
  }

  async vectorScores(queries, limit = 24, jurisdiction = 'IN') {
    if (!this.provider?.embed || !this.getEmbeddingModel()) return [];
    try {
      const [vector] = await this.provider.embed([queries.join(' ')], 'query');
      const results = await LegalChunk.aggregate([
        // Ask for a wider candidate set because the Atlas index may contain
        // both India and international records; jurisdiction is enforced
        // again in application code below as defense-in-depth.
        { $vectorSearch: { index: env.VECTOR_INDEX_NAME, path: 'embedding', queryVector: vector, numCandidates: 150, limit: Math.max(limit * 4, 24) } }
      ]).then(rows => rows
        .filter(row => (row.metadata?.jurisdiction || 'IN') === jurisdiction)
        .slice(0, limit)
        .map(row => ({ chunk: row, score: row.score ?? 0.5, vectorScore: row.score ?? 0.5 })));
      return results;
    } catch {
      return []; // Atlas vector index unavailable → pure lexical path keeps working
    }
  }

  /** Hybrid retrieval: BM25 ⊕ vector ⊕ authority ⊕ temporal filters, then rerank. */
  async retrieve({ queries, regimes = [], statuses = ['CURRENT'], asOf = undefined, limit = 8, includeTestDocs = false, jurisdiction = 'IN' }) {
    const [lexical, vector] = await Promise.all([
      this.lexicalScores(queries, { regimes, statuses, asOf, includeTestDocs, jurisdiction }),
      this.vectorScores(queries, 24, jurisdiction)
    ]);
    const merged = new Map();
    const add = (item, weight) => {
      const key = String(item.chunk._id);
      const existing = merged.get(key);
      const weighted = item.score * weight;
      if (existing) existing.score += weighted;
      else merged.set(key, { ...item, score: weighted });
    };
    const maxLexical = Math.max(0.0001, ...lexical.map(i => i.score));
    lexical.slice(0, 40).forEach(item => add(item, 1 / maxLexical));
    vector.filter(v => temporalEligible(v.chunk, asOf) && (statuses.includes('*') || statuses.includes(v.chunk.metadata?.status)) && (v.chunk.metadata?.jurisdiction || 'IN') === jurisdiction)
      .forEach(item => add(item, 0.6));

    const reranked = [...merged.values()]
      .map(item => ({
        ...item,
        sourceKey: item.chunk.sourceKey,
        sectionLabel: item.chunk.sectionLabel,
        text: item.chunk.text,
        metadata: item.chunk.metadata,
        flagged: detectInjection(item.chunk.text),
        finalScore: item.score * (item.flagged ? 0.5 : 1)
      }))
      .sort((a, b) => b.finalScore - a.finalScore);

    return reranked.slice(0, limit);
  }
}
