import { describe, expect, it } from 'vitest';
import { CORPUS } from '../scripts/seed-legal-corpus.js';
import { buildSourceManifest } from '../src/data/source-manifest.js';

describe('source provenance and rights manifest', () => {
  const manifest = buildSourceManifest(CORPUS);

  it('contains one manifest record for every corpus source', () => {
    expect(manifest.sources).toHaveLength(CORPUS.length);
    expect(new Set(manifest.sources.map(source => source.sourceKey)).size).toBe(CORPUS.length);
    for (const source of manifest.sources) {
      expect(source.authority).toBeTruthy();
      expect(['IN', 'INTL']).toContain(source.jurisdiction);
      expect(['RETRIEVAL_ONLY', 'TRAINING_ELIGIBLE', 'EXCLUDED']).toContain(source.trainingEligibility);
      expect(source.ingestionStatus).toBeTruthy();
    }
  });

  it('keeps PATENTSCOPE excluded and TKDL restricted', () => {
    expect(manifest.sources.find(source => source.sourceKey === 'wipo_patentscope_bibliographic_excluded')).toMatchObject({ trainingEligibility: 'EXCLUDED' });
    expect(manifest.sources.find(source => source.sourceKey === 'tkdl_pointer')).toMatchObject({ trainingEligibility: 'EXCLUDED' });
  });

  it('catalogues the requested WIPO treaty and system families', () => {
    const keys = new Set(manifest.sources.map(source => source.sourceKey));
    for (const key of ['wipo_pct_legal_texts_2026', 'wipo_paris_convention', 'wipo_patent_law_treaty', 'wipo_madrid_legal_texts', 'wipo_hague_legal_texts', 'wipo_budapest_legal_texts', 'wipo_gratk_resource_center']) {
      expect(keys.has(key)).toBe(true);
    }
  });
});
