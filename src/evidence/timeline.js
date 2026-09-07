import { LegalSource } from '../models/legal.js';

/** Pure: assemble nodes/edges from fetched source documents + cited keys. */
export function assembleTimeline(allSources, citedKeys) {
  const keySet = new Set(allSources.map(s => s.sourceKey));
  const nodes = allSources.map(source => ({
    sourceKey: source.sourceKey,
    title: source.title,
    authority: source.authority,
    status: source.status,
    version: source.version,
    effectiveFrom: source.effectiveFrom || null,
    effectiveTo: source.effectiveTo || null,
    publicationDate: source.publicationDate || null,
    url: source.url || '',
    regimes: source.regimes,
    cited: citedKeys.includes(source.sourceKey)
  }));
  const edges = [];
  for (const source of allSources) {
    for (const relation of source.relations || []) {
      if (!relation.targetKey || !keySet.has(relation.targetKey)) continue;
      edges.push({ from: source.sourceKey, to: relation.targetKey, type: relation.relationType, note: relation.note || '' });
    }
  }
  nodes.sort((a, b) => String(a.effectiveFrom || a.publicationDate || '9999').localeCompare(String(b.effectiveFrom || b.publicationDate || '9999')));
  return { nodes, edges };
}

/**
 * Builds a version/relation timeline for a set of cited source keys.
 * Expands one hop of relations (AMENDS/AMENDED_BY/SUPERSEDES/SUPERSEDED_BY/
 * REFERENCES/REPLACED_BY) so the UI can show how law evolved.
 */
export async function buildSourceTimeline(sourceKeys = []) {
  const keys = [...new Set(sourceKeys.filter(Boolean))];
  if (!keys.length) return { nodes: [], edges: [] };

  const primary = await LegalSource.find({ sourceKey: { $in: keys } }).lean();
  const relatedKeys = new Set(keys);
  for (const source of primary) {
    for (const relation of source.relations || []) if (relation.targetKey) relatedKeys.add(relation.targetKey);
  }
  // inverse relations pointing at our keys
  const inverse = await LegalSource.find({ relations: { $elemMatch: { targetKey: { $in: keys } } } }).lean();
  for (const source of inverse) relatedKeys.add(source.sourceKey);

  const all = await LegalSource.find({ sourceKey: { $in: [...relatedKeys] } }).lean();
  return assembleTimeline(all, keys);
}
