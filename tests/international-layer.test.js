import { describe, expect, it } from 'vitest';
import { INTERNATIONAL_CORPUS, mapInternationalRegimes } from '../src/rules/international.js';
import { verifyCitation, selectBestChunk } from '../src/evidence/citation-verifier.js';

describe('international jurisdiction layer', () => {
  it('maps treaty, filing-system and market routes without Indian regimes', () => {
    const facts = {
      intendedUse: 'therapeutic_treatment',
      ingredients: [{ name: 'neem', biologicalResource: true }],
      traditionalKnowledgeUse: 'modified_traditional',
      commercialIntent: 'export_related',
      targetMarket: 'india_and_export',
      newProcess: 'yes'
    };
    const regimes = mapInternationalRegimes({ primary: 'PROPRIETARY_ASU_MEDICINE' }, facts).map(r => r.regime);
    expect(regimes).toEqual(expect.arrayContaining(['TRIPS', 'CBD_NAGOYA', 'WIPO_GRATK', 'PCT', 'MADRID', 'HAGUE', 'EXPORT_MARKET_ACCESS']));
    expect(regimes).not.toEqual(expect.arrayContaining(['AYUSH', 'BIODIVERSITY_ABS', 'PATENT', 'TRADEMARK']));
  });

  it('verifies international evidence only when the expected jurisdiction is INTL', () => {
    const source = INTERNATIONAL_CORPUS.find(entry => entry.sourceKey === 'pct_system');
    const claim = 'The PCT provides a single international patent application route that preserves the option to pursue patent protection in selected national or regional offices';
    const chunk = selectBestChunk(claim, source.chunks);
    const international = verifyCitation({ claim, chunk, source, expectedJurisdiction: 'INTL' });
    const india = verifyCitation({ claim, chunk, source, expectedJurisdiction: 'IN' });
    expect(international.verified).toBe(true);
    expect(international.supportLevel).toBe('DIRECTLY_SUPPORTED');
    expect(india.verified).toBe(false);
    expect(india.notes.join(' ')).toMatch(/jurisdiction mismatch/i);
  });
});

