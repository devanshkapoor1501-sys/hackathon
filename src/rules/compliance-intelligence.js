// Deterministic product-readiness helpers. These are deliberately conservative:
// they flag work to verify, but never declare approval, compliance or safety.

const clean = value => String(value || '').trim();

const CLAIM_RULES = [
  {
    type: 'DISEASE_TREATMENT', severity: 'RED',
    pattern: /\b(cure|treat|prevent|diagnos|heals?|arthritis|diabetes|infection|inflammation|pain relief|disease)\b|इलाज|उपचार|रोग|सूजन|संक्रमण|मधुमेह/iu,
    title: 'Disease or treatment claim',
    reason: 'Disease and treatment wording can change the product pathway and should be reviewed before publication.',
    suggestion: 'Do not publish this claim until the applicable AYUSH/FSSAI route and evidence are reviewed.',
    sourceKey: 'drugs_cosmetics_act_asu', sourceSection: 'ASU framework'
  },
  {
    type: 'HEALTH_BENEFIT', severity: 'YELLOW',
    pattern: /\b(boosts? immunity|supports? immunity|healthy|wellness|detox|improves? digestion|energy|stress relief)\b|प्रतिरक्षा|स्वास्थ्य|वेलनेस|पाचन/iu,
    title: 'Health or wellness claim',
    reason: 'Health-benefit wording requires a claim review against the selected product category.',
    suggestion: 'Keep the wording aligned with the verified category and retain supporting evidence for review.',
    sourceKey: 'fssai_ayurveda_aahara_notification_2022', sourceSection: 'label claims'
  },
  {
    type: 'COSMETIC_CLAIM', severity: 'YELLOW',
    pattern: /\b(fairness|whitening|removes? wrinkles?|anti[- ]?aging|glowing skin|hair growth|beauty)\b|सौंदर्य|निखार|झुर्रियां|बालों? की वृद्धि/iu,
    title: 'Cosmetic appearance claim',
    reason: 'Appearance claims can affect the cosmetic boundary and the wording permitted on packaging.',
    suggestion: 'Confirm the cosmetic route and permitted label wording before launch.',
    sourceKey: 'drugs_cosmetics_act_asu', sourceSection: 'cosmetic framework'
  },
  {
    type: 'APPROVAL_ASSERTION', severity: 'RED',
    pattern: /\b(government approved|approved by ayush|ayush approved|fssai approved|100% safe|no side effects|certified cure)\b/iu,
    title: 'Unverified approval or safety assertion',
    reason: 'The system cannot establish an approval or absolute safety claim from the current case evidence.',
    suggestion: 'Remove the assertion or attach the specific official approval and have a professional verify it.',
    sourceKey: '', sourceSection: ''
  }
];

export function analyzeClaims({ facts = {}, classification = {}, labelText = '' } = {}) {
  const supplied = [
    ...(Array.isArray(facts.claims) ? facts.claims : []),
    ...clean(labelText).split(/[\n;]+/).map(clean).filter(Boolean)
  ].map(clean).filter(Boolean);
  const claims = [...new Set(supplied)].slice(0, 40);
  const findings = [];
  for (const claim of claims) {
    const rules = CLAIM_RULES.filter(rule => rule.pattern.test(claim));
    if (!rules.length) {
      findings.push({ claim, type: 'NO_TRIGGER_IDENTIFIED', severity: 'GREY', title: 'No trigger identified',
        reason: 'No configured claim trigger was found. This is not a clearance or approval decision.', suggestion: 'Keep the source wording and request professional review where required.', sourceKey: '', sourceSection: '', supportLevel: 'UNSUPPORTED' });
      continue;
    }
    for (const rule of rules) findings.push({ claim, type: rule.type, severity: rule.severity, title: rule.title,
      reason: rule.reason, suggestion: rule.suggestion, sourceKey: rule.sourceKey, sourceSection: rule.sourceSection,
      supportLevel: rule.sourceKey ? 'REVIEW_REQUIRED' : 'UNSUPPORTED', classification: classification.primary });
  }
  const hasDualLabel = /(?:fssai.{0,60}ayush|ayush.{0,60}fssai)/iu.test(clean(labelText));
  if (hasDualLabel) findings.push({ claim: clean(labelText).slice(0, 240), type: 'DUAL_REGULATORY_LABEL', severity: 'RED',
    title: 'Potential dual-regulatory label', reason: 'The draft mentions both AYUSH and FSSAI identifiers; category and label treatment must be resolved before printing.',
    suggestion: 'Resolve the product category first and show only the identifiers permitted for that route.',
    sourceKey: 'fssai_ayurveda_aahara_notification_2022', sourceSection: 'category boundary', supportLevel: 'REVIEW_REQUIRED' });
  if (!findings.length) findings.push({ claim: '', type: 'NO_CLAIMS_PROVIDED', severity: 'GREY', title: 'No claims provided',
    reason: 'Add the exact label or marketing wording for a meaningful claim review.', suggestion: 'Upload or paste the draft label before publication.', sourceKey: '', sourceSection: '', supportLevel: 'UNSUPPORTED' });
  return { claims, findings, summary: { total: findings.length, highRisk: findings.filter(f => f.severity === 'RED').length, review: findings.filter(f => f.severity === 'YELLOW').length } };
}

const DOC_LABELS = {
  formulation: 'Formula / ingredient sheet', ingredients: 'Species and source provenance',
  label: 'Draft label or advertisement', quality: 'Quality / laboratory evidence',
  manufacturing: 'Manufacturing and process record', licence: 'Licence or application reference'
};

export function buildCompliancePassport({ facts = {}, classification = {}, documents = [] } = {}) {
  const required = ['formulation', 'ingredients', 'label', 'quality', 'manufacturing'];
  if (facts.commercialIntent === 'yes_commercial_sale_india' || facts.commercialIntent === 'export_related') required.push('licence');
  const present = new Set((documents || []).map(d => d.type));
  const checks = required.map(type => ({ type, label: DOC_LABELS[type], status: present.has(type) ? 'ADDED' : 'MISSING', required: true }));
  const added = checks.filter(c => c.status === 'ADDED').length;
  const missing = checks.filter(c => c.status === 'MISSING').map(c => c.label);
  const completeness = Math.round((added / Math.max(1, checks.length)) * 100);
  const provenance = {
    ingredientOrigin: facts.biologicalOriginIndia || 'unknown', cultivation: facts.wildCollected || 'unknown',
    traditionalKnowledge: facts.traditionalKnowledgeUse || 'unknown', manufacturingLocation: facts.manufacturingLocation || 'unknown'
  };
  return { status: completeness >= 80 ? 'READY_FOR_REVIEW' : 'GAPS_REMAIN', completeness, checks, missing, documents: documents || [], provenance,
    note: 'Completeness is an evidence checklist, not a compliance or approval decision.' };
}

export function buildMarketRoutes({ facts = {}, classification = {}, jurisdictionMode = 'IN' } = {}) {
  if (jurisdictionMode === 'INTL') {
    const routes = [{ id: 'WIPO', name: 'WIPO systems', status: 'IP_ROUTE', authority: 'World Intellectual Property Organization', officialUrl: 'https://www.wipo.int/', steps: ['Choose the right PCT, Madrid, Hague or Budapest route', 'Confirm applicant eligibility and designated jurisdictions', 'Do not treat a system filing as a worldwide grant'] }];
    if (facts.commercialIntent === 'export_related' || facts.targetMarket === 'india_and_export') {
      routes.push({ id: 'EU', name: 'European Union', status: 'MARKET_POINTER', authority: 'European Commission', officialUrl: 'https://health.ec.europa.eu/medicinal-products/herbal-medicinal-products_en', steps: ['Decide food, cosmetic or medicinal route', 'Check traditional-use evidence and labelling', 'Confirm Member State requirements'] });
      routes.push({ id: 'US', name: 'United States', status: 'MARKET_POINTER', authority: 'U.S. Food and Drug Administration', officialUrl: 'https://www.fda.gov/drugs/guidance-compliance-regulatory-information/guidances-drugs', steps: ['Classify dietary supplement vs botanical drug route', 'Review claims, ingredient status and manufacturing controls', 'Confirm current FDA requirements before marketing'] });
    }
    return routes;
  }
  const routes = [{ id: 'IN', name: 'India', status: 'PRIMARY', authority: classification.primary?.includes('ASU') ? 'State AYUSH Licensing Authority' : classification.primary === 'AYURVEDA_AAHARA' || classification.primary?.includes('FOOD') ? 'FSSAI / FoSCoS' : 'Relevant Indian authority',
    officialUrl: classification.primary === 'AYURVEDA_AAHARA' || classification.primary?.includes('FOOD') ? 'https://foscos.fssai.gov.in/' : 'https://ayush.gov.in/', steps: ['Confirm classification', 'Prepare route-specific documents', 'Verify current authority requirements'] }];
  if (facts.commercialIntent === 'export_related' || facts.targetMarket === 'india_and_export') {
    routes.push({ id: 'WIPO_PCT', name: 'WIPO / PCT', status: 'IP_ROUTE', authority: 'World Intellectual Property Organization', officialUrl: 'https://patentscope.wipo.int/search/en/search.jsf', steps: ['Run international prior-art search', 'Confirm priority and filing strategy with a patent agent', 'Do not treat search results as patentability advice'] });
    routes.push({ id: 'EU', name: 'European Union · export pointer', status: 'JURISDICTION_PACK', authority: 'European Commission', officialUrl: 'https://health.ec.europa.eu/medicinal-products/herbal-medicinal-products_en', steps: ['Switch to International mode for the separately cited market route', 'Decide food, cosmetic or medicinal route', 'Confirm country-specific market requirements'] });
  }
  return routes;
}

export function buildFilingPack({ facts = {}, classification = {}, regimes = [], jurisdictionMode = 'IN' } = {}) {
  const applicable = regimes.filter(r => ['APPLICABLE', 'POSSIBLY_APPLICABLE', 'REVIEW_RECOMMENDED'].includes(r.relevance));
  const internationalAuthority = { TRIPS: 'World Trade Organization', CBD_NAGOYA: 'CBD Secretariat', WIPO_GRATK: 'World Intellectual Property Organization', PCT: 'World Intellectual Property Organization', MADRID: 'World Intellectual Property Organization', HAGUE: 'World Intellectual Property Organization', BUDAPEST: 'World Intellectual Property Organization', EXPORT_MARKET_ACCESS: 'Target-market regulator' };
  const internationalUrl = { TRIPS: 'https://www.wto.org/trips', CBD_NAGOYA: 'https://www.cbd.int/abs/', WIPO_GRATK: 'https://www.wipo.int/wipolex/en/text/592806', PCT: 'https://www.wipo.int/pct/en/', MADRID: 'https://www.wipo.int/madrid/en/', HAGUE: 'https://www.wipo.int/hague/en/', BUDAPEST: 'https://www.wipo.int/treaties/en/registration/budapest/' };
  return applicable.map(r => ({ regime: r.regime, title: r.label || r.regime, authority: jurisdictionMode === 'INTL' ? (internationalAuthority[r.regime] || 'Relevant target-country authority') : r.regime === 'FOOD' ? 'FSSAI / FoSCoS' : r.regime === 'AYUSH' ? 'State AYUSH Licensing Authority' : r.regime === 'BIODIVERSITY_ABS' ? 'NBA / State Biodiversity Board' : r.regime === 'PATENT' ? 'IP India / WIPO' : 'Relevant authority',
    officialUrl: jurisdictionMode === 'INTL' ? (internationalUrl[r.regime] || '') : r.regime === 'FOOD' ? 'https://foscos.fssai.gov.in/' : r.regime === 'AYUSH' ? 'https://ayush.gov.in/' : r.regime === 'PATENT' ? 'https://ipindia.gov.in/' : r.regime === 'BIODIVERSITY_ABS' ? 'https://nbaindia.org/' : '',
    requiredDocuments: ['Product description', 'Ingredient/source details', 'Draft label and claims', 'Supporting quality evidence'], nextActions: r.whatToDo || [], lastVerified: new Date().toISOString().slice(0, 10), disclaimer: 'Checklist for professional preparation; not an application or approval.' }));
}

export function buildSafetySummary({ facts = {}, events = [], jurisdictionMode = 'IN' } = {}) {
  const hasCommercial = ['yes_commercial_sale_india', 'export_related'].includes(facts.commercialIntent);
  const required = hasCommercial ? ['Batch/lot traceability', 'Quality evidence', 'Adverse-event process', 'Recall procedure'] : ['Source and access record', 'Re-screen before commercialisation'];
  const officialLinks = jurisdictionMode === 'INTL'
    ? [{ label: 'CBD / Nagoya', url: 'https://www.cbd.int/abs/' }, { label: 'WIPO', url: 'https://www.wipo.int/' }]
    : [{ label: 'Ayush Suraksha', url: 'https://suraksha.ayush.gov.in/about' }, { label: 'FSSAI Food Recall', url: 'https://fssai.gov.in/food-law/food-recall' }];
  return { readiness: events.some(e => e.type === 'recall') ? 'RECALL_REVIEW_REQUIRED' : hasCommercial ? 'POST_MARKET_SETUP_REQUIRED' : 'PRE_MARKET', required, events: events || [], officialLinks };
}

export function buildChangeAlerts(evidence = []) {
  return evidence.filter(e => ['HISTORICAL', 'SUPERSEDED', 'DRAFT', 'PROPOSED'].includes(e.status)).map(e => ({ sourceKey: e.sourceKey, title: e.sourceTitle || e.sourceKey, status: e.status, message: 'This cited source is not current; reassessment or professional review is recommended.' }));
}

export function compareScenario({ facts = {}, patch = {}, assessFacts } = {}) {
  const nextFacts = { ...facts, ...patch };
  const current = assessFacts(facts);
  const next = assessFacts(nextFacts);
  return { patch, current, next, changed: { classification: current.classification !== next.classification, regimes: JSON.stringify(current.regimes) !== JSON.stringify(next.regimes), claims: JSON.stringify(current.claims) !== JSON.stringify(next.claims) } };
}
