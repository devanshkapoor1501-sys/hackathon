import { describe, it, expect } from 'vitest';
import { classifyProduct } from '../src/rules/classification.engine.js';
import { mapRegimes, deriveConfidence } from '../src/rules/regimes.js';
import { extractFactsHeuristic, computeUnknowns, validateFactSheet } from '../src/rules/facts.schema.js';

const base = { intendedUse: 'therapeutic_treatment', claims: ['treats inflammation'], dosageForm: 'tablet', routeOfAdministration: 'oral', ingredients: [{ name: 'neem', biologicalResource: true, classicalIngredient: true }], commercialIntent: 'yes_commercial_sale_india' };

describe('SIH 26045 classification engine (deterministic)', () => {
  it('classifies a non-classical therapeutic tablet as proprietary ASU candidate', () => {
    const result = classifyProduct({ ...base, classicalSource: 'not_from_any_text_new_formulation' });
    expect(result.primary).toBe('PROPRIETARY_ASU_MEDICINE');
    expect(result.alternatives).toContain('CLASSICAL_ASU_MEDICINE');
  });

  it('classifies a formulation traced to an authoritative text as classical ASU', () => {
    const result = classifyProduct({ ...base, classicalSource: 'authoritative_text_named' });
    expect(result.primary).toBe('CLASSICAL_ASU_MEDICINE');
    expect(result.humanReviewRequired).toBe(false);
  });

  it('flags unnamed classical claims for human review', () => {
    const result = classifyProduct({ ...base, classicalSource: 'claims_classical_but_unnamed' });
    expect(result.primary).toBe('CLASSICAL_ASU_MEDICINE');
    expect(result.humanReviewRequired).toBe(true);
  });

  it('routes food-intent products to the food framework, not AYUSH drugs', () => {
    const result = classifyProduct({ ...base, intendedUse: 'food_consumption', claims: ['healthy daily drink'], dosageForm: 'liquid_syrup_arishta' });
    expect(['FOOD_NUTRACEUTICAL', 'AYURVEDA_AAHARA']).toContain(result.primary);
    expect(result.primary).not.toBe('PROPRIETARY_ASU_MEDICINE');
  });

  it('routes topical appearance-claim products to cosmetics', () => {
    const result = classifyProduct({ intendedUse: 'external_cosmetic', routeOfAdministration: 'topical', claims: ['improves skin glow'], dosageForm: 'cream_ointment' });
    expect(result.primary).toBe('COSMETIC');
  });

  it('refuses to classify with unknown intended use and escalates instead of guessing', () => {
    const result = classifyProduct({ dosageForm: 'unknown', claims: [] });
    expect(['UNKNOWN_HUMAN_REVIEW', 'MIXED_AMBIGUOUS']).toContain(result.primary);
    if (result.primary === 'UNKNOWN_HUMAN_REVIEW') expect(result.confidence).toBe('ESCALATE');
  });

  it('research-only intent does not trigger drug regimes', () => {
    const result = classifyProduct({ intendedUse: 'research', commercialIntent: 'research_only' });
    expect(result.primary).toBe('RESEARCH_BIOLOGICAL_MATERIAL');
  });

  it('tracks critical unknown facts for adaptive questioning', () => {
    const { criticalUnknowns } = computeUnknowns({ dosageForm: 'tablet' });
    expect(criticalUnknowns).toContain('intendedUse');
    expect(criticalUnknowns).toContain('classicalSource');
    expect(criticalUnknowns).not.toContain('dosageForm');
  });

  it('heuristic extraction captures neem/turmeric + new process from SIH demo description', () => {
    const facts = extractFactsHeuristic(`I have created an Ayurvedic herbal tablet containing neem and turmeric. I am using a new extraction process that I developed myself. I want to sell it commercially in India.`);
    expect(facts.dosageForm).toBe('tablet');
    expect(facts.ingredients.map(i => i.name)).toEqual(expect.arrayContaining(['neem', 'turmeric']));
    expect(facts.newProcess).toBe('yes');
    expect(facts.commercialIntent).toBe('yes_commercial_sale_india');
  });

  it('validates fact sheets against the schema and rejects garbage', () => {
    expect(validateFactSheet({ intendedUse: 'banana' }).ok).toBe(false);
    expect(validateFactSheet({}).ok).toBe(true);
  });

  it('maps regimes: therapeutic product triggers AYUSH+PATENT+TK+ABS overlays', () => {
    const classification = classifyProduct(base);
    const regimes = mapRegimes(classification, { ...base, newProcess: 'yes' }).map(r => r.regime);
    expect(regimes).toContain('AYUSH');
    expect(regimes).toContain('PATENT');
    expect(regimes).toContain('TRADITIONAL_KNOWLEDGE');
    expect(regimes).toContain('BIODIVERSITY_ABS');
  });
});

describe('derived confidence (never arbitrary)', () => {
  it('escalates on source conflicts regardless of other signals', () => {
    const result = deriveConfidence({
      classification: { confidence: 'HIGH' },
      evidence: [{ supportLevel: 'DIRECTLY_SUPPORTED', status: 'CURRENT' }],
      conflicts: 1, unresolvedCriticals: 0
    });
    expect(result.level).toBe('ESCALATE');
  });

  it('HIGH requires current primary authority directly supporting conclusions', () => {
    const result = deriveConfidence({
      classification: { confidence: 'HIGH' },
      evidence: Array.from({ length: 3 }, () => ({ supportLevel: 'DIRECTLY_SUPPORTED', status: 'CURRENT' })),
      conflicts: 0, unresolvedCriticals: 0
    });
    expect(result.level).toBe('HIGH');
  });

  it('LOW when evidence is thin even if classification looks fine', () => {
    const result = deriveConfidence({ classification: { confidence: 'MEDIUM' }, evidence: [], conflicts: 0, unresolvedCriticals: 1 });
    expect(result.level).toBe('LOW');
  });
});
