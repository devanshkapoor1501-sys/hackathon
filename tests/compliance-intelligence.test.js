import { describe, expect, it } from 'vitest';
import { analyzeClaims, buildCompliancePassport, buildMarketRoutes, buildSafetySummary } from '../src/rules/compliance-intelligence.js';

describe('advanced compliance intelligence', () => {
  it('flags disease, approval and dual-regulatory claims conservatively', () => {
    const result = analyzeClaims({
      facts: { claims: ['treats diabetes'] },
      classification: { primary: 'AYURVEDA_AAHARA' },
      labelText: 'FSSAI licence + AYUSH approved, 100% safe'
    });
    expect(result.findings.map(f => f.type)).toEqual(expect.arrayContaining(['DISEASE_TREATMENT', 'APPROVAL_ASSERTION', 'DUAL_REGULATORY_LABEL']));
    expect(result.findings.every(f => f.severity)).toBe(true);
  });

  it('calculates a dossier readiness gap without calling it compliance', () => {
    const result = buildCompliancePassport({
      facts: { commercialIntent: 'yes_commercial_sale_india', biologicalOriginIndia: 'yes' },
      classification: { primary: 'PROPRIETARY_ASU_MEDICINE' },
      documents: [{ type: 'formulation', name: 'formula.xlsx', status: 'ADDED' }]
    });
    expect(result.status).toBe('GAPS_REMAIN');
    expect(result.missing).toContain('Draft label or advertisement');
    expect(result.note).toMatch(/not a compliance/i);
  });

  it('keeps export guidance jurisdiction-specific', () => {
    const result = buildMarketRoutes({ facts: { commercialIntent: 'export_related', targetMarket: 'india_and_export' }, classification: { primary: 'PROPRIETARY_ASU_MEDICINE' } });
    expect(result.map(r => r.id)).toEqual(['IN', 'WIPO_PCT', 'EU']);
    expect(result.find(r => r.id === 'WIPO_PCT').officialUrl).toMatch(/wipo/i);
  });

  it('creates a post-market setup and recall escalation state', () => {
    expect(buildSafetySummary({ facts: { commercialIntent: 'yes_commercial_sale_india' }, events: [] }).readiness).toBe('POST_MARKET_SETUP_REQUIRED');
    expect(buildSafetySummary({ facts: { commercialIntent: 'yes_commercial_sale_india' }, events: [{ type: 'recall' }] }).readiness).toBe('RECALL_REVIEW_REQUIRED');
  });
});
