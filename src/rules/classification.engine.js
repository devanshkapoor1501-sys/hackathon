import { computeUnknowns } from './facts.schema.js';

export const CATEGORY_LABELS = {
  CLASSICAL_ASU_MEDICINE: 'Classical Ayurvedic medicine (ASU drug)',
  PROPRIETARY_ASU_MEDICINE: 'Patent/Proprietary ASU medicine candidate',
  NEW_ASU_CANDIDATE_REVIEW: 'New/non-classical product requiring further assessment',
  AYURVEDA_AAHARA: 'Ayurveda Aahara (food prepared per Ayurvedic principles)',
  FOOD_NUTRACEUTICAL: 'Food / nutraceutical category candidate',
  COSMETIC: 'Cosmetic',
  PLANT_VARIETY_INNOVATION: 'Plant variety-related innovation',
  RAW_BIORESOURCE_TRADE: 'Raw biological resource trade',
  RESEARCH_BIOLOGICAL_MATERIAL: 'Research-related biological material',
  MIXED_AMBIGUOUS: 'Mixed / ambiguous product',
  UNKNOWN_HUMAN_REVIEW: 'Unknown — human review'
};

const THERAPEUTIC_CLAIM_RE = /\b(treat|treatment|cure|therapeutic|disease|inflammation|infection|diabet|arthritis|analgesic|antibacterial|heal)\b/i;

function therapeuticSignal(facts) {
  if (facts.intendedUse === 'therapeutic_treatment') return true;
  return (facts.claims || []).some(claim => THERAPEUTIC_CLAIM_RE.test(claim));
}

function cosmeticSignal(facts) {
  if (facts.intendedUse === 'external_cosmetic' || facts.routeOfAdministration === 'topical') return true;
  return (facts.claims || []).some(claim => /\b(beauty|fairness|moisturis|cleansing|glow|anti[- ]?ageing|skin tone)\b/i.test(claim));
}

/**
 * Deterministic rule-based classification. The LLM never decides classification;
 * it may only help phrase questions and explain the outcome.
 */
export function classifyProduct(facts) {
  const { knownFacts, unknownFacts, criticalUnknowns } = computeUnknowns(facts);
  const signals = {
    therapeutic: therapeuticSignal(facts),
    foodUse: facts.intendedUse === 'food_consumption',
    cosmetic: cosmeticSignal(facts),
    researchOnly: facts.intendedUse === 'research',
    rawTrade: facts.intendedUse === 'trade_raw_material' || facts.dosageForm === 'raw_herb_powder_bulk',
    classicalNamed: facts.classicalSource === 'authoritative_text_named',
    classicalUnnamed: facts.classicalSource === 'claims_classical_but_unnamed',
    explicitlyNovel: facts.classicalSource === 'not_from_any_text_new_formulation',
    hasIngredients: (facts.ingredients || []).length > 0,
    commercialIntent: facts.commercialIntent === 'yes_commercial_sale_india' || facts.commercialIntent === 'export_related',
    newProcess: facts.newProcess === 'yes'
  };

  let primary = null;
  let alternatives = [];
  const rationale = [];

  // Decisive rules first
  if (!signals.therapeutic && !signals.foodUse && !signals.cosmetic && !signals.researchOnly && !signals.rawTrade && facts.intendedUse !== 'wellness_general') {
    primary = criticalUnknowns.length >= 4 ? 'UNKNOWN_HUMAN_REVIEW' : 'MIXED_AMBIGUOUS';
    rationale.push('Intended use is unknown, which is decisive for the medicines/food/cosmetics boundary.');
  } else if (signals.researchOnly) {
    primary = 'RESEARCH_BIOLOGICAL_MATERIAL';
    rationale.push('Stated purpose is research only; commercial regulatory pathways are not yet triggered.');
  } else if (signals.rawTrade && !signals.therapeutic) {
    primary = 'RAW_BIORESOURCE_TRADE';
    rationale.push('Raw herb/bulk powder trade without therapeutic claims points to biological-resource handling rather than a finished regulated product.');
  } else if (signals.cosmetic && !signals.therapeutic && !signals.foodUse) {
    primary = 'COSMETIC';
    alternatives = ['MIXED_AMBIGUOUS'];
    rationale.push('External/topical application with appearance-related claims matches the cosmetics category.');
  } else if (signals.foodUse && !signals.therapeutic) {
    primary = signals.classicalNamed ? 'AYURVEDA_AAHARA' : 'FOOD_NUTRACEUTICAL';
    alternatives = ['AYURVEDA_AAHARA', 'FOOD_NUTRACEUTICAL'].filter(c => c !== primary);
    rationale.push('Consumption as food with no disease claims places this under the food framework; Ayurveda-derived recipes may qualify for the Ayurveda Aahara pathway when traceable to authoritative texts.');
  } else if ((signals.classicalNamed || signals.classicalUnnamed) && !signals.explicitlyNovel) {
    primary = 'CLASSICAL_ASU_MEDICINE';
    alternatives = signals.classicalUnnamed ? ['PROPRIETARY_ASU_MEDICINE', 'MIXED_AMBIGUOUS'] : [];
    rationale.push(signals.classicalNamed
      ? 'Formulation is traced to an authoritative Ayurvedic text, matching the classical ASU medicine definition.'
      : 'Classical formulation is claimed but no authoritative text was named — must be verified against the Ayurvedic Formulary/Pharmacopoeia of India.');
  } else if (signals.therapeutic) {
    primary = 'PROPRIETARY_ASU_MEDICINE';
    alternatives = ['CLASSICAL_ASU_MEDICINE', 'NEW_ASU_CANDIDATE_REVIEW'];
    rationale.push('Therapeutic/disease-related claims with an apparently non-classical composition match a patent or proprietary ASU medicine.');
    if (signals.explicitlyNovel) rationale.push('User states the formulation is not from any classical text, supporting the proprietary path over classical.');
  }

  // Confidence from decisiveness + missing criticals
  const decisiveKnown = ['intendedUse', 'dosageForm', 'classicalSource'].filter(f => knownFacts.includes(f)).length;
  let confidence = 'LOW';
  if (primary && primary !== 'UNKNOWN_HUMAN_REVIEW') {
    if (decisiveKnown === 3 && criticalUnknowns.length <= 2) confidence = 'HIGH';
    else if (decisiveKnown >= 1 && signals.hasIngredients) confidence = 'MEDIUM';
    else confidence = 'LOW';
  }
  if (primary === 'UNKNOWN_HUMAN_REVIEW') confidence = 'ESCALATE';
  if (criticalUnknowns.includes('classicalSource')) {
    if (confidence === 'HIGH') confidence = 'MEDIUM';
    else if (confidence !== 'ESCALATE') confidence = 'LOW';
  }

  const humanReviewRequired = confidence === 'ESCALATE' || primary === 'UNKNOWN_HUMAN_REVIEW' ||
    (signals.classicalUnnamed && signals.therapeutic);

  return {
    primary,
    alternatives,
    confidence,
    rationale: rationale.join(' ') || 'Classification derived from structured intake facts.',
    factsUsed: knownFacts,
    missingInformation: criticalUnknowns,
    humanReviewRequired,
    engineVersion: 'v1'
  };
}
