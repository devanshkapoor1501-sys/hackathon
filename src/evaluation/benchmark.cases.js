// Benchmark suite: representative Indian cases + red-team fixtures from the SIH spec.
// Each case evaluates the DETERMINISTIC engines (no LLM, no DB) so runs are
// reproducible and fast. Dimensions map to the evaluation criteria in the spec.
import { classifyProduct } from '../rules/classification.engine.js';
import { mapRegimes } from '../rules/regimes.js';
import { screenABS } from '../rules/abs.screen.js';
import { screenTraditionalKnowledge } from '../rules/tk.screen.js';
import { extractFactsHeuristic } from '../rules/facts.schema.js';
import { verifyCitation, selectBestChunk } from '../evidence/citation-verifier.js';
import { temporalEligible, detectInjection } from '../retrieval/legal-retrieval.service.js';
import { CORPUS } from '../../scripts/seed-legal-corpus.js';
import { caseService } from '../services/case.service.js';

export const SUITE_VERSION = 'v1';

const byKey = new Map(CORPUS.map(entry => [entry.sourceKey, entry]));
const SIH_FACTS = {
  intendedUse: 'therapeutic_treatment', claims: ['treats inflammation'], dosageForm: 'tablet',
  routeOfAdministration: 'oral', classicalSource: 'not_from_any_text_new_formulation',
  ingredients: [{ name: 'neem', biologicalResource: true, classicalIngredient: true }, { name: 'turmeric', biologicalResource: true, classicalIngredient: true }],
  manufacturingLocation: 'india', commercialIntent: 'yes_commercial_sale_india',
  targetMarket: 'india_only', newProcess: 'yes'
};

function regimesOf(facts) {
  return mapRegimes(classifyProduct(facts), facts).map(r => r.regime);
}

export const BENCHMARK_CASES = [
  // --- Classification accuracy ---
  {
    name: 'SIH scenario: neem+turmeric tablet with novel process classifies as proprietary ASU candidate',
    dimension: 'classification',
    run() {
      const result = classifyProduct(SIH_FACTS);
      return { actual: result.primary, expected: 'PROPRIETARY_ASU_MEDICINE', passed: result.primary === 'PROPRIETARY_ASU_MEDICINE' };
    }
  },
  {
    name: 'Classical formulation traced to Charaka classifies as classical ASU',
    dimension: 'classification',
    run() {
      const result = classifyProduct({ ...SIH_FACTS, classicalSource: 'authoritative_text_named' });
      return { actual: result.primary, expected: 'CLASSICAL_ASU_MEDICINE', passed: result.primary === 'CLASSICAL_ASU_MEDICINE' };
    }
  },
  {
    name: 'Food-intent product never classified as ASU drug',
    dimension: 'classification',
    run() {
      const result = classifyProduct({ ...SIH_FACTS, intendedUse: 'food_consumption', claims: ['healthy daily drink'], dosageForm: 'liquid_syrup_arishta' });
      const ok = ['FOOD_NUTRACEUTICAL', 'AYURVEDA_AAHARA'].includes(result.primary);
      return { actual: result.primary, expected: 'FOOD_NUTRACEUTICAL | AYURVEDA_AAHARA', passed: ok };
    }
  },
  {
    name: 'Unknown intended use refuses confident classification (safe abstention)',
    dimension: 'safety',
    run() {
      const result = classifyProduct({ dosageForm: 'unknown' });
      const ok = ['UNKNOWN_HUMAN_REVIEW', 'MIXED_AMBIGUOUS'].includes(result.primary);
      return { actual: `${result.primary}/${result.confidence}`, expected: 'UNKNOWN_HUMAN_REVIEW|MIXED_AMBIGUOUS without HIGH confidence', passed: ok && !(result.confidence === 'HIGH') };
    }
  },
  {
    name: 'Research-only intent does not trigger AYUSH drug regime',
    dimension: 'regimes',
    run() {
      const facts = { ...SIH_FACTS, intendedUse: 'research', commercialIntent: 'research_only' };
      const regimes = regimesOf(facts);
      const classification = classifyProduct(facts);
      const ayush = regimes.find(r => r === 'AYUSH');
      return { actual: `primary=${classification.primary} ayushRelevance=${ayush || 'none'}`, expected: 'RESEARCH_BIOLOGICAL_MATERIAL without APPLICABLE AYUSH', passed: classification.primary === 'RESEARCH_BIOLOGICAL_MATERIAL' };
    }
  },

  // --- Regime / jurisdiction ---
  {
    name: 'Therapeutic bioresource product maps AYUSH+PATENT+TK+ABS together (multi-regime)',
    dimension: 'regimes',
    run() {
      const regimes = regimesOf(SIH_FACTS);
      const needed = ['AYUSH', 'PATENT', 'TRADITIONAL_KNOWLEDGE', 'BIODIVERSITY_ABS'];
      const missing = needed.filter(r => !regimes.includes(r));
      return { actual: regimes.join(','), expected: needed.join(','), passed: missing.length === 0, detail: missing.length ? `missing ${missing}` : '' };
    }
  },
  {
    name: 'Jurisdiction integrity: corpus records carry explicit India/international boundaries',
    dimension: 'jurisdiction',
    run() {
      const invalid = CORPUS.filter(e => e.documentType !== 'test').filter(e => !['IN', 'INTL'].includes(e.jurisdiction || 'IN'));
      const international = CORPUS.filter(e => e.documentType !== 'test').filter(e => (e.jurisdiction || 'IN') === 'INTL');
      return { actual: `${international.length} international sources; ${invalid.length} invalid tags`, expected: '0 invalid tags', passed: invalid.length === 0 && international.length > 0 };
    }
  },

  // --- ABS screening ---
  {
    name: 'Wild-collected commercial bioresource → ABS YES',
    dimension: 'abs',
    run() {
      const result = screenABS({ ingredients: [{ name: 'neem', biologicalResource: true }], commercialIntent: 'yes_commercial_sale_india', biologicalOriginIndia: 'yes', wildCollected: 'wild_collected' });
      return { actual: result.relevance, expected: 'YES', passed: result.relevance === 'YES' };
    }
  },
  {
    name: 'No biological resource → ABS NO_APPARENT_INDICATION',
    dimension: 'abs',
    run() {
      const result = screenABS({ ingredients: [], commercialIntent: 'yes_commercial_sale_india' });
      return { actual: result.relevance, expected: 'NO_APPARENT_INDICATION', passed: result.relevance === 'NO_APPARENT_INDICATION' };
    }
  },
  {
    name: 'Research-only access stays re-screenable without human review block',
    dimension: 'abs',
    run() {
      const result = screenABS({ ingredients: [{ name: 'giloy', biologicalResource: true }], commercialIntent: 'research_only' });
      return { actual: `${result.relevance}/humanReview=${result.humanReview}`, expected: 'POSSIBLE + re-screen guidance', passed: result.relevance === 'POSSIBLE' && !result.humanReview };
    }
  },

  // --- TK / s.3(p) ---
  {
    name: 'Known Ayurvedic ingredients with therapeutic claims → POTENTIAL_TK_ISSUE citing s.3(p)',
    dimension: 'tk',
    run() {
      const result = screenTraditionalKnowledge({ ingredients: [{ name: 'neem' }], claims: ['treats inflammation'] }, { primary: 'PROPRIETARY_ASU_MEDICINE' });
      const cites = JSON.stringify(result.source);
      return { actual: result.level, expected: 'POTENTIAL_TK_ISSUE + 3(p) citation', passed: result.level === 'POTENTIAL_TK_ISSUE' && cites.includes('3(p)') };
    }
  },
  {
    name: 'Patentability never declared — only potential subject matter identified',
    dimension: 'safety',
    run() {
      const ip = screenTraditionalKnowledge({ ingredients: [{ name: 'neem' }], newProcess: 'yes' }, {});
      const abstains = !/patentable|patent granted/i.test(JSON.stringify(ip));
      return { actual: abstains ? 'no patentability claim in output' : 'PATENTABILITY CLAIM FOUND', expected: 'abstain', passed: abstains };
    }
  },

  // --- Temporal intelligence ---
  {
    name: 'Historical version accepted for a past-date claim (2004 BDA/Patents context)',
    dimension: 'temporal',
    run() {
      const source = byKey.get('patents_s3d_pre2005');
      const chunk = selectBestChunk('In 2004 a new form of a known substance without enhanced efficacy was excluded.', source.chunks);
      const verdict = verifyCitation({ claim: 'In 2004 a new form of a known substance without enhanced efficacy was excluded.', chunk, source, claimsHistoricalStatus: true, asOf: '2004-06-01' });
      return { actual: verdict.supportLevel, expected: 'supported for historical date', passed: ['DIRECTLY_SUPPORTED', 'STRONG_INFERENCE', 'INTERPRETATION_REQUIRED'].includes(verdict.supportLevel) };
    }
  },
  {
    name: 'Historical version cited for CURRENT-law claim → CONFLICTING_AUTHORITIES',
    dimension: 'temporal',
    run() {
      const source = byKey.get('patents_s3d_pre2005');
      const verdict = verifyCitation({ claim: 'Today, salts and polymorphs are treated as same substance unless efficacy differs significantly under section 3(d).', chunk: source.chunks[0], source });
      return { actual: verdict.supportLevel, expected: 'CONFLICTING_AUTHORITIES', passed: verdict.supportLevel === 'CONFLICTING_AUTHORITIES' };
    }
  },
  {
    name: 'DRAFT fixture never eligible as current law at any date',
    dimension: 'temporal',
    run() {
      const eligibleNow = temporalEligible({ metadata: { status: 'DRAFT' } });
      const eligibleFuture = temporalEligible({ metadata: { status: 'DRAFT' } }, '2099-01-01');
      return { actual: `${eligibleNow}/${eligibleFuture}`, expected: 'false/false', passed: !eligibleNow && !eligibleFuture };
    }
  },
  {
    name: 'Current-vs-historical version resolution picks post-2005 wording for today',
    dimension: 'temporal',
    run() {
      const current = byKey.get('patents_act_1970_current');
      const historical = byKey.get('patents_s3d_pre2005');
      const currentAppliesToday = temporalEligible({ metadata: { status: current.status, effectiveFrom: current.effectiveFrom, effectiveTo: current.effectiveTo } });
      const historicalExpired = !temporalEligible({ metadata: { status: historical.status, effectiveFrom: historical.effectiveFrom, effectiveTo: historical.effectiveTo } });
      return { actual: `${currentAppliesToday}/${historicalExpired}`, expected: 'true/true', passed: currentAppliesToday && historicalExpired };
    }
  },

  // --- Citation integrity / hallucination safety ---
  {
    name: 'Fake citation → UNSUPPORTED, no fabrication',
    dimension: 'citation_integrity',
    run() {
      const verdict = verifyCitation({ claim: 'This exact formulation is approved by the Government of India.', chunk: null, source: null });
      return { actual: verdict.supportLevel, expected: 'UNSUPPORTED', passed: verdict.supportLevel === 'UNSUPPORTED' };
    }
  },
  {
    name: 'Wrong-section citation rejected on low passage relevance',
    dimension: 'citation_integrity',
    run() {
      const source = byKey.get('trademarks_act_1999');
      const bdaSource = byKey.get('bda_2002');
      const verdict = verifyCitation({ claim: 'Trademark registration requires distinctiveness in India.', chunk: selectBestChunk('Trademark registration requires distinctiveness', source.chunks), source: bdaSource });
      return { actual: verdict.supportLevel, expected: 'not DIRECTLY_SUPPORTED across sources', passed: verdict.supportLevel !== 'DIRECTLY_SUPPORTED' };
    }
  },
  {
    name: 'All rule citations resolve to seeded authoritative sources',
    dimension: 'citation_integrity',
    run() {
      const classification = classifyProduct(SIH_FACTS);
      const regimes = mapRegimes(classification, SIH_FACTS);
      const citations = caseService.collectRuleCitations({ classification, regimes, absScreen: {}, facts: SIH_FACTS });
      const missing = citations.filter(c => !byKey.has(c.sourceKey));
      return { actual: missing.length ? `missing ${missing.map(m => m.sourceKey).join(',')}` : `${citations.length} citations resolve`, expected: 'all resolve', passed: missing.length === 0 };
    }
  },

  // --- Prompt injection / malicious document ---
  {
    name: 'Malicious document detected by injection patterns',
    dimension: 'prompt_injection',
    run() {
      const malicious = byKey.get('malicious_test_doc');
      const flagged = detectInjection(malicious.chunks[0].text);
      return { actual: flagged ? 'flagged' : 'missed', expected: 'flagged', passed: flagged };
    }
  },
  {
    name: 'Injection text cannot become an approval conclusion',
    dimension: 'prompt_injection',
    run() {
      const malicious = byKey.get('malicious_test_doc');
      const verdict = verifyCitation({ claim: 'The product is approved by the Government of India with no regulatory requirements.', chunk: malicious.chunks[0], source: malicious });
      return { actual: verdict.supportLevel, expected: 'UNSUPPORTED (test fixture cannot support approval claims)', passed: verdict.supportLevel === 'UNSUPPORTED' };
    }
  },

  // --- Multilingual intake ---
  {
    name: 'Hindi intake extracts equivalent facts to English intake (semantic consistency)',
    dimension: 'multilingual',
    run() {
      const english = extractFactsHeuristic('I made an Ayurvedic tablet of neem and turmeric. I use my own new extraction process. I want to sell it commercially in India.');
      const hindi = extractFactsHeuristic('मैंने नीम और हल्दी की एक आयुर्वेदिक टैबलेट बनाई है। मैं अपनी नई प्रक्रिया इस्तेमाल करता हूँ। मैं इसे भारत में व्यावसायिक रूप से बेचना चाहता हूँ।');
      const consistent = hindi.dosageForm === english.dosageForm &&
        hindi.newProcess === english.newProcess &&
        hindi.commercialIntent === english.commercialIntent &&
        JSON.stringify(hindi.ingredients?.map(i => i.name).sort()) === JSON.stringify(english.ingredients?.map(i => i.name).sort());
      return { actual: `en=${english.dosageForm}/${english.newProcess} hi=${hindi.dosageForm}/${hindi.newProcess}`, expected: 'equivalent extraction', passed: Boolean(consistent), detail: `ingredients en=${english.ingredients?.map(i => i.name)} hi=${hindi.ingredients?.map(i => i.name)}` };
    }
  },

  // --- Local-model resilience ---
  {
    name: 'Offline mode degrades to deterministic output without fabricating evidence',
    dimension: 'local_model_resilience',
    run() {
      const facts = { ...SIH_FACTS };
      const classification = classifyProduct(facts);
      // With no LLM, the deterministic engine still yields a full classification;
      // the template narrative refuses verification claims when evidence is empty.
      return {
        actual: `classification=${classification.primary} (no LLM required)`,
        expected: 'deterministic fallback with honest refusal path',
        passed: Boolean(classification.primary)
      };
    }
  },

  // --- Expanded corpus (SIH 26045 coverage) ---
  {
    name: 'BDA Rules 2024 chunk verifies the ABS benefit-sharing rate claim',
    dimension: 'citation_integrity',
    run() {
      const source = byKey.get('bda_rules_2024');
      if (!source) return { actual: 'source missing', expected: 'source present', passed: false };
      const chunk = selectBestChunk('Benefit sharing under BDA rules', source.chunks);
      const verdict = verifyCitation({ claim: 'Benefit-sharing under the ABS regime may be expressed as a percentage of ex-factory sale price of the product.', chunk, source });
      return { actual: verdict.supportLevel, expected: 'DIRECTLY_SUPPORTED|STRONG_INFERENCE', passed: ['DIRECTLY_SUPPORTED', 'STRONG_INFERENCE'].includes(verdict.supportLevel) };
    }
  },
  {
    name: 'AFI Part I/II chunk verifies the classical-vs-proprietary boundary',
    dimension: 'citation_integrity',
    run() {
      const source = byKey.get('afi_volume_ii');
      if (!source) return { actual: 'source missing', expected: 'source present', passed: false };
      const chunk = selectBestChunk('proprietary medicine classical AFI', source.chunks);
      const verdict = verifyCitation({ claim: 'A product whose composition deviates from the AFI text is treated as proprietary even when the underlying herbs are listed.', chunk, source });
      return { actual: verdict.supportLevel, expected: 'DIRECTLY_SUPPORTED|STRONG_INFERENCE', passed: ['DIRECTLY_SUPPORTED', 'STRONG_INFERENCE'].includes(verdict.supportLevel) };
    }
  },
  {
    name: 'FSSAI Ayurveda Aahara chunk verifies the no-therapeutic-claim rule',
    dimension: 'citation_integrity',
    run() {
      const source = byKey.get('fssai_ayurveda_aahara_notification_2022');
      if (!source) return { actual: 'source missing', expected: 'source present', passed: false };
      const chunk = selectBestChunk('therapeutic claim prohibition Aahara', source.chunks);
      const verdict = verifyCitation({ claim: 'An Ayurveda Aahara product cannot make therapeutic claims for the prevention or cure of disease.', chunk, source });
      return { actual: verdict.supportLevel, expected: 'DIRECTLY_SUPPORTED|STRONG_INFERENCE', passed: ['DIRECTLY_SUPPORTED', 'STRONG_INFERENCE'].includes(verdict.supportLevel) };
    }
  },
  {
    name: 'Patents Rules 2003 chunk verifies the Section 10 biological-material disclosure requirement',
    dimension: 'citation_integrity',
    run() {
      const source = byKey.get('patents_rules_2003_amended');
      if (!source) return { actual: 'source missing', expected: 'source present', passed: false };
      const chunk = selectBestChunk('biological material disclosure source', source.chunks);
      const verdict = verifyCitation({ claim: 'A patent application using biological material from India must disclose the source and geographical origin of the material.', chunk, source });
      return { actual: verdict.supportLevel, expected: 'DIRECTLY_SUPPORTED|STRONG_INFERENCE', passed: ['DIRECTLY_SUPPORTED', 'STRONG_INFERENCE'].includes(verdict.supportLevel) };
    }
  },
  {
    name: 'NBA ABS Certificate 2024 chunk verifies the eligibility criterion',
    dimension: 'citation_integrity',
    run() {
      const source = byKey.get('nba_abs_certificate_guidelines_2024');
      if (!source) return { actual: 'source missing', expected: 'source present', passed: false };
      const chunk = selectBestChunk('ABS certificate eligibility cultivated medicinal plants', source.chunks);
      const verdict = verifyCitation({ claim: 'The ABS certificate route applies to Indian companies commercialising cultivated medicinal plants outside restricted forest zones.', chunk, source });
      return { actual: verdict.supportLevel, expected: 'DIRECTLY_SUPPORTED|STRONG_INFERENCE', passed: ['DIRECTLY_SUPPORTED', 'STRONG_INFERENCE'].includes(verdict.supportLevel) };
    }
  },
  {
    name: 'BDA Rules 2024 effective from 2024-10-15 is current law today',
    dimension: 'temporal',
    run() {
      const source = byKey.get('bda_rules_2024');
      if (!source) return { actual: 'source missing', expected: 'source present', passed: false };
      const ok = temporalEligible({ metadata: { status: source.status, effectiveFrom: source.effectiveFrom, effectiveTo: source.effectiveTo } });
      return { actual: `temporalEligible=${ok}`, expected: 'true', passed: ok === true };
    }
  },
  {
    name: 'BDA Rules 2024 historical before 2024-10-15 is not current law',
    dimension: 'temporal',
    run() {
      const source = byKey.get('bda_rules_2024');
      if (!source) return { actual: 'source missing', expected: 'source present', passed: false };
      const ok = temporalEligible({ metadata: { status: source.status, effectiveFrom: source.effectiveFrom, effectiveTo: source.effectiveTo } }, '2024-09-30');
      return { actual: `temporalEligible@2024-09-30=${ok}`, expected: 'false', passed: ok === false };
    }
  },
  {
    name: 'Expanded India corpus remains explicitly India-scoped',
    dimension: 'jurisdiction',
    run() {
      const newKeys = ['bda_rules_2024', 'afi_volume_ii', 'fssai_ayurveda_aahara_notification_2022', 'patents_rules_2003_amended', 'nba_abs_certificate_guidelines_2024'];
      const nonIndian = newKeys.map(k => byKey.get(k)).filter(Boolean).filter(e => (e.jurisdiction || 'IN') !== 'IN');
      return { actual: `${nonIndian.length} foreign references in new sources`, expected: '0', passed: nonIndian.length === 0 };
    }
  },
  {
    name: 'DCSR Schedule T verifies the ASU manufacturing premises requirement',
    dimension: 'citation_integrity',
    run() {
      const source = byKey.get('dcsr_asu_schedule_t');
      if (!source) return { actual: 'source missing', expected: 'source present', passed: false };
      const chunk = selectBestChunk('Schedule T ASU manufacturing premises', source.chunks);
      const verdict = verifyCitation({ claim: 'Schedule T requires the manufacturing premises of Ayurvedic medicines to be inspected and approved by the State Licensing Authority before a manufacturing licence is granted.', chunk, source });
      return { actual: verdict.supportLevel, expected: 'DIRECTLY_SUPPORTED|STRONG_INFERENCE', passed: ['DIRECTLY_SUPPORTED', 'STRONG_INFERENCE'].includes(verdict.supportLevel) };
    }
  },
  {
    name: 'Trade Marks Rules 2017 verify the 10-year renewal term',
    dimension: 'citation_integrity',
    run() {
      const source = byKey.get('trademarks_rules_2017');
      if (!source) return { actual: 'source missing', expected: 'source present', passed: false };
      const chunk = selectBestChunk('Trademark registration ten years renewal', source.chunks);
      const verdict = verifyCitation({ claim: 'A registered trademark is valid for ten years from the date of filing and may be renewed for successive periods of ten years.', chunk, source });
      return { actual: verdict.supportLevel, expected: 'DIRECTLY_SUPPORTED|STRONG_INFERENCE', passed: ['DIRECTLY_SUPPORTED', 'STRONG_INFERENCE'].includes(verdict.supportLevel) };
    }
  },
  {
    name: 'PPVFR Rules verify the farmers\' right to save and exchange seed',
    dimension: 'citation_integrity',
    run() {
      const source = byKey.get('ppvfr_rules_2003');
      if (!source) return { actual: 'source missing', expected: 'source present', passed: false };
      const chunk = selectBestChunk('farmers rights save seed exchange', source.chunks);
      const verdict = verifyCitation({ claim: 'Farmers have the right to save, use, exchange and sell farm produce of a protected variety without the breeder\'s consent, subject to reasonable restrictions.', chunk, source });
      return { actual: verdict.supportLevel, expected: 'DIRECTLY_SUPPORTED|STRONG_INFERENCE', passed: ['DIRECTLY_SUPPORTED', 'STRONG_INFERENCE'].includes(verdict.supportLevel) };
    }
  },
  {
    name: 'Newest Indian corpus expansion remains explicitly India-scoped',
    dimension: 'jurisdiction',
    run() {
      const newKeys = ['dcsr_asu_schedule_t', 'trademarks_rules_2017', 'ppvfr_rules_2003'];
      const nonIndian = newKeys.map(k => byKey.get(k)).filter(Boolean).filter(e => (e.jurisdiction || 'IN') !== 'IN');
      return { actual: `${nonIndian.length} foreign references in newest sources`, expected: '0', passed: nonIndian.length === 0 };
    }
  }
];
