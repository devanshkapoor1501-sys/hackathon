import { z } from 'zod';

export const FACT_FIELDS = [
  'intendedUse', 'claims', 'dosageForm', 'routeOfAdministration', 'ingredients', 'formulationName',
  'manufacturingMethod', 'manufacturingLocation', 'classicalSource', 'newProcess', 'processDescription',
  'biologicalOriginIndia', 'wildCollected', 'traditionalKnowledgeUse', 'commercialIntent', 'targetMarket',
  'targetMarkets', 'targetMarketOther', 'userType'
];

export const factSheetSchema = z.object({
  intendedUse: z.enum(['therapeutic_treatment', 'wellness_general', 'food_consumption', 'external_cosmetic', 'research', 'trade_raw_material', 'unknown']).default('unknown'),
  claims: z.array(z.string().max(300)).max(20).default([]),
  dosageForm: z.enum(['tablet', 'capsule', 'powder_churna', 'liquid_syrup_arishta', 'oil_taila', 'cream_ointment', 'raw_herb_powder_bulk', 'extract_concentrate', 'other', 'none_stated']).default('none_stated'),
  routeOfAdministration: z.enum(['oral', 'topical', 'nasal', 'other', 'not_applicable', 'unknown']).default('unknown'),
  ingredients: z.array(z.object({
    name: z.string().min(1).max(120),
    biologicalResource: z.boolean().default(true),
    classicalIngredient: z.boolean().default(false)
  })).max(40).default([]),
  formulationName: z.string().max(200).default(''),
  manufacturingMethod: z.string().max(1000).default(''),
  manufacturingLocation: z.enum(['india', 'unknown', 'outside_india']).default('unknown'),
  classicalSource: z.enum(['authoritative_text_named', 'claims_classical_but_unnamed', 'not_from_any_text_new_formulation', 'unknown']).default('unknown'),
  newProcess: z.enum(['yes', 'no', 'unknown']).default('unknown'),
  processDescription: z.string().max(1500).default(''),
  biologicalOriginIndia: z.enum(['yes', 'no', 'unknown']).default('unknown'),
  wildCollected: z.enum(['wild_collected', 'cultivated', 'unknown']).default('unknown'),
  traditionalKnowledgeUse: z.enum(['direct_traditional_use', 'modified_traditional', 'fully_novel', 'unknown']).default('unknown'),
  commercialIntent: z.enum(['yes_commercial_sale_india', 'research_only', 'personal_use', 'export_related', 'unknown']).default('unknown'),
  targetMarket: z.enum(['india_only', 'india_and_export', 'unknown']).default('unknown'),
  targetMarkets: z.array(z.enum(['EU', 'US', 'UAE', 'OTHER'])).max(4).default([]),
  targetMarketOther: z.string().max(120).default(''),
  userType: z.enum(['startup_msme', 'practitioner', 'researcher_student', 'manufacturer', 'farmer_grower', 'other', 'unknown']).default('unknown'),
  labelText: z.string().max(5000).default('')
});

export function validateFactSheet(input) {
  const parsed = factSheetSchema.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) };
  return { ok: true, facts: parsed.data };
}

const CLASSICAL_INGREDIENTS = ['neem', 'turmeric', 'haridra', 'nimba', 'triphala', 'ashwagandha', 'giloy', 'tulsi', 'ginger', 'shunthi', 'black pepper', 'marich', 'pippali', 'amla', 'bibhitaki', 'haritaki', 'ajwain', 'brahmi', 'shatavari', 'guggul', 'manjistha', 'licorice', 'yashtimadhu', 'cardamom', 'ela', 'cinnamon', 'dalchini', 'fenugreek', 'methi', 'bhringraj', 'punarnava', 'kutki', 'musta', 'daruharidra'];

// Hindi/Devanagari equivalents so intake works without translation middleware.
const HINDI_INGREDIENTS = [['नीम', 'neem'], ['हल्दी', 'turmeric'], ['हरड़', 'haritaki'], ['बहेड़ा', 'bibhitaki'], ['आंवला', 'amla'], ['अश्वगंधा', 'ashwagandha'], ['गिलोय', 'giloy'], ['तुलसी', 'tulsi'], ['अदरक', 'ginger'], ['काली मिर्च', 'black pepper'], ['पिप्पली', 'pippali'], ['ब्राह्मी', 'brahmi'], ['शतावरी', 'shatavari'], ['गुग्गुल', 'guggul'], ['मेथी', 'methi']];
const HINDI_PATTERNS = {
  // NOTE: \b word boundaries are unreliable around Devanagari in JS regex — use plain alternation.
  therapeutic: /(इलाज|उपचार|रोग|बीमारी|सूजन|संक्रमण|शोथ|मधुमेह|गठिया)/,
  wellness: /(तंदुरुस्ती|वेलनेस|सेहत|स्वास्थ्य)/,
  food: /(खाद्य|भोजन|पेय|चाय|शरबत|जैम|पौष्टिक|खाने योग्य)/,
  cosmetic: /(क्रीम|लोशन|सौंदर्य|त्वचा|बालों का तेल|निखार)/,
  research: /(अनुसंधान|थीसिस|शोध|प्रयोगशाला)/,
  tablet: /टैबलेट|गोली/, capsule: /कैप्सूल/, churna: /चूर्ण/, syrup: /काढ़ा|सिरप|आरिष्ट/, oilTaila: /तेल|तैल/, cream: /क्रीम|मलहम/, powder: /पाउडर/
};

export function extractFactsHeuristic(text = '') {
  const t = text.toLowerCase();
  const facts = {};
  if (/\b(treat|cure|therapy|therapeutic|disease|inflammation|infection|diabet|arthritis|immunity boost for patients?)\b/.test(t) || HINDI_PATTERNS.therapeutic.test(t)) facts.intendedUse = 'therapeutic_treatment';
  else if (/\b(wellness|general health|daily supplement|healthy lifestyle)\b/.test(t) || HINDI_PATTERNS.wellness.test(t)) facts.intendedUse = 'wellness_general';
  else if (/\b(food|beverage|snack|tea|drink|jam|nutrition|eat|edible)\b/.test(t) || HINDI_PATTERNS.food.test(t)) facts.intendedUse = 'food_consumption';
  else if (/\b(skin cream|lotion|cosmetic|beauty|fairness|moisturis|hair oil for styling|cleansing)\b/.test(t) || HINDI_PATTERNS.cosmetic.test(t)) facts.intendedUse = 'external_cosmetic';
  else if (/\b(research|thesis|study only|laboratory)\b/.test(t) || HINDI_PATTERNS.research.test(t)) facts.intendedUse = 'research';
  const forms = [['tablet', 'tablet'], ['टैबलेट', 'tablet'], ['गोली', 'tablet'], ['कैप्सूल', 'capsule'], ['capsule', 'capsule'], ['चूर्ण', 'powder_churna'], ['churna', 'powder_churna'], ['powder', 'raw_herb_powder_bulk'], ['पाउडर', 'raw_herb_powder_bulk'], ['सिरप', 'liquid_syrup_arishta'], ['syrup', 'liquid_syrup_arishta'], ['arishta', 'liquid_syrup_arishta'], ['आरिष्ट', 'liquid_syrup_arishta'], ['काढ़ा', 'liquid_syrup_arishta'], ['kadha', 'liquid_syrup_arishta'], ['तेल', 'oil_taila'], ['taila', 'oil_taila'], ['oil', 'oil_taila'], ['cream', 'cream_ointment'], ['क्रीम', 'cream_ointment'], ['ointment', 'cream_ointment'], ['मलहम', 'cream_ointment'], ['extract', 'extract_concentrate']];
  for (const [needle, form] of forms) if (t.includes(needle)) { facts.dosageForm = form; break; }
  if (facts.dosageForm === 'raw_herb_powder_bulk') {
    if (/\b(tablets? made|compressed|granulat)/.test(t)) facts.dosageForm = 'tablet';
    if (/\bsell(ing)? (the )?(raw|bulk|powder)\b/.test(t)) facts.intendedUse = facts.intendedUse === 'unknown' ? 'trade_raw_material' : facts.intendedUse;
  }
  if (/\boral\b|swallow|drink it|consume/.test(t)) facts.routeOfAdministration = 'oral';
  else if (/apply|topical|on the skin|massage|लगायें|लगाते/.test(t)) facts.routeOfAdministration = 'topical';
  const ingredients = CLASSICAL_INGREDIENTS.filter(item => t.includes(item)).slice(0, 12)
    .map(name => ({ name, biologicalResource: true, classicalIngredient: true }));
  for (const [hindiName, englishName] of HINDI_INGREDIENTS) {
    if (t.includes(hindiName) && !ingredients.some(i => i.name === englishName)) ingredients.push({ name: englishName, biologicalResource: true, classicalIngredient: true });
  }
  if (ingredients.length) facts.ingredients = ingredients.slice(0, 12);
  if (/(charaka|sushruta|ashtanga|bhavaprakasha|sharangadhara|ayurvedic formulary of india|ayurvedic pharmacopoeia of india|api\b|afi\b|चरक|सुश्रुत|भावप्रकाश|शारंगधर)/.test(t)) facts.classicalSource = /named|from the|listed in|से लिया|ग्रंथ/.test(t) ? 'authoritative_text_named' : 'claims_classical_but_unnamed';
  else if (/\b(new formulation|my own formula|novel combination|developed myself|i created this formulation)\b/.test(t) || /अपनी .*मिश्रण|खुद .*बनाया|नया मिश्रण/.test(t)) facts.classicalSource = 'not_from_any_text_new_formulation';
  if (/\b(new|novel|my own|proprietary|patented-pending|self[- ]developed) (extraction |process|method|technique)\b/.test(t) || /\bextraction process that i developed\b/.test(t) || /(नई|नया|अपनी).*(प्रक्रिया|विधि)/.test(t)) { facts.newProcess = 'yes'; facts.processDescription = text.slice(0, 400); }
  else if (/\bstandard (extraction|process)|traditional method\b/.test(t)) facts.newProcess = 'no';
  if (/\b(sell|commercial|market|business|launch|revenue|customers?)\b/.test(t) || /बेचना|बेचूंगा|बेचें|व्यापार|व्यवसाय|बाज़ार|बाजार/.test(t)) facts.commercialIntent = 'yes_commercial_sale_india';
  if (/\bexport|abroad|usa|europe|middle east\b/.test(t)) { facts.targetMarket = 'india_and_export'; facts.commercialIntent = 'export_related'; }
  else if (/\bin india\b|\bindian market\b|भारत में/.test(t)) facts.targetMarket = 'india_only';
  return facts;
}

export const CRITICAL_FOR_CLASSIFICATION = [
  'intendedUse', 'dosageForm', 'routeOfAdministration', 'classicalSource',
  'claims', 'commercialIntent', 'newProcess'
];

export function computeUnknowns(facts) {
  const knownFacts = [], unknownFacts = [], criticalUnknowns = [];
  for (const field of FACT_FIELDS) {
    const value = facts[field];
    const isEmpty = value == null || value === 'unknown' || value === 'none_stated' || value === '' || (Array.isArray(value) && value.length === 0);
    if (isEmpty) unknownFacts.push(field);
    else knownFacts.push(field);
    if (isEmpty && CRITICAL_FOR_CLASSIFICATION.includes(field)) criticalUnknowns.push(field);
  }
  return { knownFacts, unknownFacts, criticalUnknowns };
}
