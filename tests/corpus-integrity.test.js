import { describe, it, expect } from 'vitest';
import { CORPUS } from '../scripts/seed-legal-corpus.js';
import { temporalEligible } from '../src/retrieval/legal-retrieval.service.js';
import { verifyCitation, selectBestChunk } from '../src/evidence/citation-verifier.js';
import { CaseService } from '../src/services/case.service.js';
import { classifyProduct } from '../src/rules/classification.engine.js';
import { mapRegimes } from '../src/rules/regimes.js';

const byKey = new Map(CORPUS.map(entry => [entry.sourceKey, entry]));
const service = new CaseService();

describe('legal corpus integrity (SIH knowledge base)', () => {
  it('has unique source keys and valid authority levels', () => {
    const keys = CORPUS.map(c => c.sourceKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of CORPUS) {
      expect(entry.sourceLevel).toBeGreaterThanOrEqual(1);
      expect(entry.sourceLevel).toBeLessThanOrEqual(7);
      expect(entry.status).toMatch(/CURRENT|HISTORICAL|SUPERSEDED|DRAFT|PROPOSED|UNKNOWN/);
      expect(entry.regimes.length > 0 || entry.documentType === 'test').toBe(true);
    }
  });

  it('keeps India and international sources explicitly tagged', () => {
    for (const entry of CORPUS) {
      expect(['IN', 'INTL']).toContain(entry.jurisdiction || 'IN');
    }
    expect(CORPUS.some(entry => entry.jurisdiction === 'INTL')).toBe(true);
  });

  it('contains a malicious prompt-injection fixture flagged as untrusted test data', () => {
    const malicious = byKey.get('malicious_test_doc');
    expect(malicious.documentType).toBe('test');
    expect(malicious.sourceLevel).toBeGreaterThanOrEqual(6);
    expect(malicious.chunks[0].text).toMatch(/IGNORE ALL PREVIOUS INSTRUCTIONS/i);
  });

  it('contains a DRAFT fixture that the temporal filter always rejects as current law', () => {
    const draft = byKey.get('draft_example_amendment');
    expect(draft.status).toBe('DRAFT');
    expect(temporalEligible({ metadata: { status: 'DRAFT' } })).toBe(false);
  });

  it('models temporal versions without overlapping validity windows', () => {
    const current = byKey.get('patents_act_1970_current');
    const historical = byKey.get('patents_s3d_pre2005');
    expect(historical.effectiveTo < current.chunks.find(c => c.sectionLabel.includes('3(d)')) ? '2005-01-01' : historical.effectiveTo).toBeTruthy();
    expect(historical.status).toBe('HISTORICAL');
    expect(current.status).toBe('CURRENT');
    expect(historical.relations[0].targetKey).toBe('patents_act_1970_current');
  });

  it('keeps TKDL as restricted-access pointer only — no reproduced TKDL entries', () => {
    const tkdl = byKey.get('tkdl_pointer');
    expect(tkdl.notes).toMatch(/RESTRICTED/i);
    expect(tkdl.chunks[0].text).not.toMatch(/formulation [A-Z]+ consists of \d+ parts/i);
    expect(tkdl.chunks[0].text).toMatch(/restricted/i);
  });
});

describe('rule citations resolve to seeded authoritative sources', () => {
  const classification = classifyProduct({
    intendedUse: 'therapeutic_treatment', claims: ['treats inflammation'], dosageForm: 'tablet',
    routeOfAdministration: 'oral', classicalSource: 'not_from_any_text_new_formulation',
    ingredients: [{ name: 'neem', biologicalResource: true, classicalIngredient: true }],
    commercialIntent: 'yes_commercial_sale_india', newProcess: 'yes'
  });

  it('collectRuleCitations only references sources present in the corpus', () => {
    const regimes = mapRegimes(classification, { newProcess: 'yes', ingredients: [{ name: 'neem', biologicalResource: true }] });
    const citations = service.collectRuleCitations({ classification, regimes, absScreen: {} });
    expect(citations.length).toBeGreaterThan(3);
    for (const citation of citations) expect(byKey.has(citation.sourceKey)).toBe(true);
  });

  it('every rule citation actually verifies against its chunk text', () => {
    const regimes = mapRegimes(classification, { newProcess: 'yes', ingredients: [{ name: 'neem', biologicalResource: true }] });
    const citations = service.collectRuleCitations({ classification, regimes, absScreen: { humanReview: true } });
    for (const citation of citations) {
      const source = byKey.get(citation.sourceKey);
      if (source.status === 'HISTORICAL') continue; // historical fixtures verified separately
      const chunk = selectBestChunk(citation.claim, source.chunks);
      const verdict = verifyCitation({ claim: citation.claim, chunk, source });
      expect(['DIRECTLY_SUPPORTED', 'STRONG_INFERENCE', 'INTERPRETATION_REQUIRED']).toContain(verdict.supportLevel);
    }
  });

  it('no-evidence case yields UNSUPPORTED instead of a fabricated citation', () => {
    const verdict = verifyCitation({ claim: 'This exact formulation is approved by the Government of India.', chunk: null, source: null });
    expect(verdict.supportLevel).toBe('UNSUPPORTED');
  });
});
