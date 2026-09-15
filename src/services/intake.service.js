import { validateFactSheet, extractFactsHeuristic, computeUnknowns } from '../rules/facts.schema.js';
import { nextQuestions } from '../rules/questions.js';
import { questionIn, normalizeLanguage } from '../i18n/index.js';
import { getProviderForTask } from '../ai/index.js';

const FACTS_SCHEMA_TS = `{
  intendedUse: "therapeutic_treatment" | "wellness_general" | "food_consumption" | "external_cosmetic" | "research" | "trade_raw_material" | "unknown",
  claims: string[],
  dosageForm: "tablet"|"capsule"|"powder_churna"|"liquid_syrup_arishta"|"oil_taila"|"cream_ointment"|"raw_herb_powder_bulk"|"extract_concentrate"|"other"|"none_stated",
  routeOfAdministration: "oral"|"topical"|"nasal"|"other"|"not_applicable"|"unknown",
  ingredients: { name: string, biologicalResource: boolean, classicalIngredient: boolean }[],
  formulationName: string,
  manufacturingMethod: string,
  manufacturingLocation: "india"|"unknown"|"outside_india",
  classicalSource: "authoritative_text_named"|"claims_classical_but_unnamed"|"not_from_any_text_new_formulation"|"unknown",
  newProcess: "yes"|"no"|"unknown",
  processDescription: string,
  biologicalOriginIndia: "yes"|"no"|"unknown",
  wildCollected: "wild_collected"|"cultivated"|"unknown",
  traditionalKnowledgeUse: "direct_traditional_use"|"modified_traditional"|"fully_novel"|"unknown",
  commercialIntent: "yes_commercial_sale_india"|"research_only"|"personal_use"|"export_related"|"unknown",
  targetMarket: "india_only"|"india_and_export"|"unknown",
  targetMarkets: ("EU"|"US"|"UAE"|"OTHER")[],
  targetMarketOther: string,
  userType: "startup_msme"|"practitioner"|"researcher_student"|"manufacturer"|"farmer_grower"|"other"|"unknown"
}`;

export class IntakeService {
  constructor() { this.lastError = null; }

  async extractFacts(description, existingFacts = {}) {
    const merged = { ...existingFacts };
    // Deterministic baseline always runs — the LLM only refines it.
    Object.assign(merged, extractFactsHeuristic(description));
    try {
      const provider = getProviderForTask('classification');
      if (!provider.chatModel) throw new Error('No model configured');
      const { data } = await provider.generateStructured({
        schema: FACTS_SCHEMA_TS,
        schemaName: 'FactSheet',
        system: 'You are a fact-extraction engine for Indian Ayurvedic product regulation. The user description may be in English, Hindi (Devanagari) or Hinglish — extract facts regardless of language, but enum values MUST be the canonical English tokens. Extract ONLY facts explicitly present or directly implied in the description. Use "unknown" when unstated. Never guess regulatory conclusions.',
        prompt: `Existing known facts to preserve unless contradicted:\n${JSON.stringify(existingFacts)}\n\nUser description:\n"""${String(description).slice(0, 4000)}"""`
      });
      const validated = validateFactSheet(data);
      if (validated.ok) {
        // Only accept LLM values that fill gaps or override heuristics with explicit signals
        for (const [key, value] of Object.entries(validated.facts)) {
          const empty = value == null || value === 'unknown' || value === 'none_stated' || value === '' || (Array.isArray(value) && !value.length);
          if (!empty) merged[key] = value;
          else if (!(key in merged)) merged[key] = value;
        }
      }
    } catch (error) {
      this.lastError = String(error.message || error).slice(0, 200); // graceful degradation to heuristics
    }
    const result = validateFactSheet(merged);
    return { facts: result.ok ? result.facts : merged, llmUsed: !this.lastError, llmError: this.lastError };
  }

  buildQuestions(facts, askedKeys = [], language = 'en') {
    const { criticalUnknowns } = computeUnknowns(facts);
    const candidates = nextQuestions(facts, { limit: 3 }).filter(q => !askedKeys.includes(q.key));
    return {
      questions: candidates.map(q => ({ ...questionIn(normalizeLanguage(language), q.key), key: q.key, critical: true })),
      criticalUnknowns,
      done: candidates.length === 0
    };
  }

  normalizeAnswer(key, answer) {
    if (answer == null) return answer;
    if (key === 'claims') return Array.isArray(answer) ? answer : [String(answer).trim()];
    const value = String(answer).trim();
    const normalized = value.toLowerCase().replace(/[\s/-]+/g, '_');
    if (key === 'dosageForm') {
      const forms = {
        tablet: 'tablet', tablets: 'tablet', pill: 'tablet', pills: 'tablet',
        capsule: 'capsule', capsules: 'capsule',
        powder: 'powder_churna', churna: 'powder_churna',
        syrup: 'liquid_syrup_arishta', arishta: 'liquid_syrup_arishta', liquid: 'liquid_syrup_arishta',
        oil: 'oil_taila', taila: 'oil_taila',
        cream: 'cream_ointment', ointment: 'cream_ointment',
        extract: 'extract_concentrate', concentrate: 'extract_concentrate',
        raw_herb_powder_bulk: 'raw_herb_powder_bulk', other: 'other', none_stated: 'none_stated'
      };
      return forms[normalized] || forms[normalized.replace(/_/g, '')] || 'other';
    }
    if (key === 'classicalSource') {
      if (['yes', 'authoritative_text_named', 'named_text'].includes(normalized)) return 'authoritative_text_named';
      if (['no', 'not_from_any_text_new_formulation', 'new_formulation'].includes(normalized)) return 'not_from_any_text_new_formulation';
      if (['not_sure', 'unknown', 'unsure'].includes(normalized)) return 'unknown';
    }
    if (key === 'intendedUse') {
      if (/therapeutic|treat|disease|condition|medicine/.test(normalized)) return 'therapeutic_treatment';
      if (/wellness|general_health/.test(normalized)) return 'wellness_general';
      if (/food|nutrition|drink|beverage/.test(normalized)) return 'food_consumption';
      if (/cosmetic|external/.test(normalized)) return 'external_cosmetic';
      if (/research|other/.test(normalized)) return 'research';
    }
    if (key === 'routeOfAdministration') {
      if (/oral|swallow|ingest/.test(normalized)) return 'oral';
      if (/topical|apply|skin/.test(normalized)) return 'topical';
      if (/nasal/.test(normalized)) return 'nasal';
      if (/other/.test(normalized)) return 'other';
    }
    if (key === 'commercialIntent') {
      if (/sell|commercial|india/.test(normalized)) return 'yes_commercial_sale_india';
      if (/research/.test(normalized)) return 'research_only';
      if (/personal/.test(normalized)) return 'personal_use';
      if (/export/.test(normalized)) return 'export_related';
    }
    if (key === 'newProcess') {
      if (normalized === 'yes' || normalized === 'true') return 'yes';
      if (normalized === 'no' || normalized === 'false') return 'no';
      if (normalized === 'unknown' || normalized === 'not_sure' || normalized === 'unsure') return 'unknown';
    }
    return answer;
  }

  applyAnswers(facts, answers = {}) {
    const original = validateFactSheet(facts).facts || { ...facts };
    const merged = { ...original };
    for (const [key, answer] of Object.entries(answers)) {
      if (!(key in merged)) continue;
      const normalized = this.normalizeAnswer(key, answer);
      if (key === 'claims') merged.claims = normalized;
      else if (typeof merged[key] === typeof normalized || typeof merged[key] === 'string') merged[key] = normalized;
    }
    const result = validateFactSheet(merged);
    return { facts: result.ok ? result.facts : original };
  }
}

export const intakeService = new IntakeService();
