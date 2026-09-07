import { describe, it, expect } from 'vitest';
import { t, questionIn, normalizeLanguage } from '../src/i18n/index.js';
import { extractFactsHeuristic } from '../src/rules/facts.schema.js';
import { classifyProduct } from '../src/rules/classification.engine.js';
import { assembleTimeline } from '../src/evidence/timeline.js';
import { CORPUS } from '../scripts/seed-legal-corpus.js';
import { renderCaseReportPDF } from '../src/reports/case-report.pdf.js';

describe('Hindi / multilingual intake', () => {
  it('extracts equivalent facts from a Hindi description of the SIH scenario', () => {
    const facts = extractFactsHeuristic('मैंने नीम और हल्दी की आयुर्वेदिक टैबलेट बनाई है। मैं अपनी नई प्रक्रिया उपयोग करता हूँ। मैं इसे भारत में व्यावसायिक रूप से बेचना चाहता हूँ।');
    expect(facts.dosageForm).toBe('tablet');
    expect(facts.ingredients.map(i => i.name)).toEqual(expect.arrayContaining(['neem', 'turmeric']));
    expect(facts.newProcess).toBe('yes');
    expect(facts.commercialIntent).toBe('yes_commercial_sale_india');
    expect(facts.targetMarket).toBe('india_only');
  });

  it('detects Hindi therapeutic intent and classical text references', () => {
    const facts = extractFactsHeuristic('यह मिश्रण चरक संहिता से लिया गया है और इलाज के लिए है।');
    expect(facts.classicalSource).toBe('authoritative_text_named');
    expect(facts.intendedUse).toBe('therapeutic_treatment');
  });

  it('classifies Hindi-extracted facts identically to English facts (semantic parity)', () => {
    const english = extractFactsHeuristic('Ayurvedic neem and turmeric tablet, my own new process, sell in India.');
    const hindi = extractFactsHeuristic('नीम और हल्दी की आयुर्वेदिक टैबलेट, अपनी नई प्रक्रिया, भारत में व्यापार करना चाहता हूँ।');
    hindi.intendedUse = english.intendedUse; // intended use arrives via clarification in both languages
    const en = classifyProduct(english);
    const hi = classifyProduct(hindi);
    expect(hi.primary).toBe(en.primary);
  });
});

describe('i18n label layer', () => {
  it('returns Hindi labels for classification, regimes and relevance', () => {
    expect(t('hi', 'CLASSIFICATION_LABELS', 'PROPRIETARY_ASU_MEDICINE')).toMatch(/प्रोप्राइटरी|पेटेंट/);
    expect(t('hi', 'REGIME_LABELS', 'AYUSH')).toMatch(/आयुष/);
    expect(t('hi', 'RELEVANCE_LABELS', 'APPLICABLE')).toBeTruthy();
    expect(t('hi', 'CONFIDENCE_LABELS', 'HIGH')).toBe('उच्च');
  });

  it('falls back to English when a key is missing in the requested language', () => {
    expect(t('hi', 'REGIME_LABELS', 'NOT_A_REAL_KEY')).toBe('NOT_A_REAL_KEY');
    expect(t('en', 'CLASSIFICATION_LABELS', 'COSMETIC')).toBe('Cosmetic');
  });

  it('localizes clarifying questions', () => {
    expect(questionIn('hi', 'intendedUse').question).toMatch(/उद्देश्य/);
    expect(questionIn('hi', 'intendedUse').why).toBeTruthy();
    expect(questionIn('en', 'dosageForm').question).toMatch(/form/i);
    expect(normalizeLanguage('HI')).toBe('en'); // strict allowlist
    expect(normalizeLanguage('hi')).toBe('hi');
  });
});

describe('source-relation timeline assembly', () => {
  const patentsCurrent = CORPUS.find(c => c.sourceKey === 'patents_act_1970_current');
  const patentsHistorical = CORPUS.find(c => c.sourceKey === 'patents_s3d_pre2005');

  it('links AMENDS/AMENDED_BY edges between temporal versions', () => {
    // simulate the relation that exists in the DB seed between versions
    const sources = [
      { ...patentsCurrent },
      { ...patentsHistorical, relations: [{ relationType: 'AMENDED_BY', targetKey: patentsCurrent.sourceKey, note: '' }] }
    ];
    const { nodes, edges } = assembleTimeline(sources, ['patents_s3d_pre2005']);
    expect(nodes.length).toBe(2);
    expect(edges.length).toBe(1);
    expect(edges[0]).toMatchObject({ from: 'patents_s3d_pre2005', to: 'patents_act_1970_current', type: 'AMENDED_BY' });
    const historicalNode = nodes.find(n => n.sourceKey === 'patents_s3d_pre2005');
    expect(historicalNode.cited).toBe(true);
    expect(nodes.find(n => n.sourceKey === 'patents_act_1970_current').cited).toBe(false); // related but not cited
  });

  it('orders nodes chronologically by effective date', () => {
    const { nodes } = assembleTimeline([
      { sourceKey: 'b', title: 'B', relations: [], effectiveFrom: '2020-01-01' },
      { sourceKey: 'a', title: 'A', relations: [], publicationDate: '2001-01-01' },
      { sourceKey: 'c', title: 'C', relations: [] }
    ], []);
    expect(nodes.map(n => n.sourceKey)).toEqual(['a', 'b', 'c']); // undated sorts last
  });
});

describe('exportable PDF case report', () => {
  it('renders a valid PDF document for an assessed case', async () => {
    const kase = {
      publicId: 'case_test123', title: 'Neem & Turmeric tablet', status: 'assessed',
      language: 'en', productName: 'Neem-Turmeric tablet',
      productDescription: 'Herbal tablet with new extraction process for commercial sale in India.'
    };
    const assessment = {
      confidence: 'MEDIUM',
      narrative: { assessment: 'Appears to be a proprietary ASU candidate.', meaning: 'Supported by verified references.' },
      classification: { primary: 'PROPRIETARY_ASU_MEDICINE', labelLocalized: 'Patent/Proprietary ASU medicine candidate', missingInformation: ['wildCollected'] },
      regimes: [{ regime: 'AYUSH', relevance: 'APPLICABLE', why: 'Therapeutic claims under D&C Act.' }],
      absScreen: { relevance: 'POSSIBLE', reason: 'Commercial bioresource use.', obligations: ['Intimate State Biodiversity Board'], authority: 'NBA/SBB' },
      tkConsiderations: { level: 'POTENTIAL_TK_ISSUE', why: 'Known ingredients.', whatToVerify: ['Prior-art search'] },
      actions: [{ priority: 'HIGH', title: 'Verify AYUSH licensing pathway', requiresProfessional: true }],
      risks: [{ severity: 'YELLOW', description: 'Classification may change.' }],
      unknowns: ['No approval evidence exists.'],
      evidence: [{ claim: 'ASU medicines regulated under D&C Act', sourceTitle: 'Drugs and Cosmetics Act, 1940', authority: 'Parliament of India', section: 's.3(a)', status: 'CURRENT', supportLevel: 'DIRECTLY_SUPPORTED' }],
      humanReview: { required: true, reason: 'Classical vs proprietary pending', recommendedProfessional: 'Registered patent agent', unresolvedQuestions: ['classicalSource'] },
      llmUsed: false
    };
    const pdf = await renderCaseReportPDF({ kase, assessment });
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.slice(0, 5).toString()).toBe('%PDF-');
    const text = pdf.toString('latin1');
    expect(text.length).toBeGreaterThan(1200);
    expect(text).toContain('/Type /Catalog'); // valid structure
  }, 15000);
});
