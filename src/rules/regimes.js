import { CATEGORY_LABELS } from './classification.engine.js';

// Deterministic classification -> potentially applicable Indian regimes.
export const REGIME_LABELS = {
  AYUSH: 'AYUSH / ASU medicines (Drugs & Cosmetics Act and Rules)',
  FOOD: 'Food safety (FSSAI)',
  COSMETIC: 'Cosmetics (Drugs & Cosmetics Act rules for cosmetics)',
  PATENT: 'Patents (Patents Act, 1970)',
  TRADEMARK: 'Trademarks (Trade Marks Act, 1999)',
  GI: 'Geographical Indications (GI Act, 1999)',
  DESIGN: 'Designs (Designs Act, 2000)',
  COPYRIGHT: 'Copyright (Copyright Act, 1957)',
  PLANT_VARIETY: 'Plant variety protection (PPV&FR Act, 2001)',
  BIODIVERSITY_ABS: 'Biodiversity / ABS (Biological Diversity Act)',
  TRADITIONAL_KNOWLEDGE: 'Traditional knowledge screening (incl. Patents Act s.3(p))',
  LABELLING_CLAIMS: 'Labelling & claims (Legal Metrology / applicable rules)'
};

const BASE_IP = { PATENT: 'POSSIBLY_APPLICABLE', TRADEMARK: 'REVIEW_RECOMMENDED' };

export function mapRegimes(classification, facts = {}) {
  const primary = classification?.primary;
  const entries = [];
  const add = (regime, relevance, why, whatToDo) => entries.push({ regime, relevance, why, whatToDo });

  switch (primary) {
    case 'CLASSICAL_ASU_MEDICINE':
      add('AYUSH', 'APPLICABLE', 'Classical ASU medicines are regulated as drugs under the Drugs and Cosmetics Act; manufacture for sale requires State Licensing Authority licensing.', ['Verify the formulation appears in the Ayurvedic Formulary of India / Pharmacopoeia', 'Check State AYUSH licensing requirements before manufacture for sale']);
      break;
    case 'PROPRIETARY_ASU_MEDICINE':
      add('AYUSH', 'APPLICABLE', 'Proprietary ASU medicines are regulated under the Drugs and Cosmetics Act framework with additional scrutiny for non-classical formulations.', ['Confirm the exact ASU regulatory pathway with the State Licensing Authority', 'Compile safety and quality documentation for the proprietary formulation']);
      break;
    case 'NEW_ASU_CANDIDATE_REVIEW':
      add('AYUSH', 'REVIEW_RECOMMENDED', 'The product may fall within ASU regulation but its nature is not yet established.', ['Complete classification intake first']);
      break;
    case 'AYURVEDA_AAHARA':
      add('FOOD', 'APPLICABLE', 'Ayurveda Aahara products are foods prepared per Ayurvedic principles under FSSAI regulations.', ['Verify recipe traceability to authoritative Ayurvedic books per the FSSAI Ayurveda Aahara framework', 'Review FSSAI registration/licensing obligations for the food business']);
      break;
    case 'FOOD_NUTRACEUTICAL':
      add('FOOD', 'APPLICABLE', 'Consumable product without therapeutic claims falls in the food regulatory space administered by FSSAI.', ['Determine the precise food category (standardised/nutraceutical/proprietary food)', 'Check FSSAI licence requirements']);
      break;
    case 'COSMETIC':
      add('COSMETIC', 'APPLICABLE', 'External-use appearance-related products are regulated as cosmetics.', ['Verify cosmetic classification boundaries (cosmetic vs drug claims)', 'Check labelling declarations']);
      break;
    case 'PLANT_VARIETY_INNOVATION':
      add('PLANT_VARIETY', 'APPLICABLE', 'A new plant variety may be registrable under the PPV&FR Act.', ['Characterise the variety against PPV&FR criteria (novelty, distinctness, uniformity, stability)']);
      break;
    case 'RAW_BIORESOURCE_TRADE':
      add('BIODIVERSITY_ABS', 'POSSIBLY_APPLICABLE', 'Trading raw biological resources can attract Biological Diversity Act obligations depending on access, use and entity type.', ['Screen ABS implications with the State Biodiversity Board']);
      break;
    case 'RESEARCH_BIOLOGICAL_MATERIAL':
      add('BIODIVERSITY_ABS', 'REVIEW_RECOMMENDED', 'Research access to biological resources has separate treatment under biodiversity law; commercialisation later changes obligations.', ['Record source and access details now for later commercialisation screening']);
      break;
    default:
      add('OTHER', 'INSUFFICIENT_INFORMATION', 'Classification is unresolved, so regime mapping is provisional only.', ['Answer outstanding classification questions']);
  }

  // Cross-cutting overlays
  if (facts.commercialIntent === 'yes_commercial_sale_india' || facts.commercialIntent === 'export_related') {
    add('LABELLING_CLAIMS', 'POSSIBLY_APPLICABLE', 'Packaged goods sold commercially carry labelling/declaration obligations.', ['Review packaged commodity labelling requirements']);
    if (!['RAW_BIORESOURCE_TRADE'].includes(primary)) add('TRADEMARK', BASE_IP.TRADEMARK, 'A brand/name for a commercial product may warrant trademark protection and clearance searching.', ['Run a trademark availability search on ipindia before branding spend']);
  }
  if ((facts.ingredients || []).some(i => i.biologicalResource)) {
    if (!['BIODIVERSITY_ABS'].some(r => entries.some(e => e.regime === r))) {
      add('BIODIVERSITY_ABS', 'REVIEW_RECOMMENDED', 'Formulation uses biological resources (plant-derived ingredients).', ['Screen Biological Diversity Act applicability']);
    }
    add('TRADITIONAL_KNOWLEDGE', 'REVIEW_RECOMMENDED', 'Ayurvedic ingredient combinations overlap documented traditional knowledge; patent claims over TK as such are excluded.', ['Screen formulation against classical texts and TKDL workflow']);
    add('PATENT', facts.newProcess === 'yes' ? 'POSSIBLY_APPLICABLE' : 'REVIEW_RECOMMENDED',
      facts.newProcess === 'yes'
        ? 'A new process may be patent-relevant subject matter, subject to novelty, inventive step and excluded subject matter (including s.3(p)).'
        : 'The composition itself may face traditional-knowledge exclusions; assess any genuinely new technical contribution.',
      ['Conduct prior-art search including Indian publications', 'Screen Section 3 exclusions, especially 3(c), 3(d), 3(e), 3(i), 3(p)']);
  }

  return entries;
}

export function deriveConfidence({ classification, evidence, conflicts, unresolvedCriticals }) {
  const factors = {
    authorityStrength: 0, temporalValidity: true, jurisdictionMatch: true,
    classificationCertainty: classification?.confidence ?? 'LOW', evidenceCompleteness: 0, sourceConflict: conflicts > 0
  };
  let score = 0;
  for (const item of evidence || []) {
    if (item.supportLevel === 'DIRECTLY_SUPPORTED' && item.status === 'CURRENT' && item.jurisdictionMatch !== false) score += 2;
    else if (item.supportLevel === 'STRONG_INFERENCE') score += 1;
    else if (item.supportLevel === 'INTERPRETATION_REQUIRED') score += 0.5;
  }
  factors.authorityStrength = score;
  factors.evidenceCompleteness = Math.min(1, (evidence?.length || 0) / 4);
  if (conflicts > 0) return { level: 'ESCALATE', factors };
  if (unresolvedCriticals >= 4) return { level: 'ESCALATE', factors };
  if (score >= 6 && classification?.confidence === 'HIGH' && unresolvedCriticals <= 1) return { level: 'HIGH', factors };
  if (score >= 2) return { level: 'MEDIUM', factors };
  return { level: 'LOW', factors };
}
