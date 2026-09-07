import { CRITICAL_FOR_CLASSIFICATION } from './facts.schema.js';

// Question bank keyed by critical fact field. Only asked when the field is a
// critical unknown — progressive questioning, max N at a time.
export const QUESTION_BANK = {
  intendedUse: {
    question: 'What is this product intended to do?',
    why: 'Intended use decides whether this is regulated as a medicine, food, or cosmetic in India.',
    options: ['Treat/prevent a disease or condition', 'General wellness support', 'Consumed as food/drink', 'External cosmetic use', 'Research only']
  },
  claims: {
    question: 'What exact claims will you make on the label or marketing?',
    why: 'Claims are decisive: disease claims push products into drug regulation; food claims keep them under FSSAI.',
    options: []
  },
  dosageForm: {
    question: 'What form is the product in (tablet, capsule, powder, oil, cream…)?',
    why: 'Dosage form helps identify the applicable product category and licensing pathway.'
  },
  routeOfAdministration: {
    question: 'How is it used — swallowed (oral) or applied on the body (topical)?',
    why: 'Route of administration separates medicines/cosmetics from foods.'
  },
  classicalSource: {
    question: 'Is this formulation taken from an authoritative Ayurvedic text (e.g., Charaka Samhita, Ayurvedic Formulary of India)? If yes, which one?',
    why: 'This determines classical vs proprietary ASU classification, which changes the regulatory path.'
  },
  commercialIntent: {
    question: 'Do you intend to sell this commercially in India, or is it for research/personal use?',
    why: 'Commercial sale triggers licensing and labelling obligations; research does not (yet).'
  },
  newProcess: {
    question: 'Does your extraction/manufacturing process differ from standard traditional methods? Describe what is new.',
    why: 'A genuinely new process may be patent-relevant subject matter (subject to s.3(d)/3(p)).'
  }
};

export function nextQuestions(facts = {}, { limit = 3 } = {}) {
  const ordered = ['intendedUse', 'claims', 'classicalSource', 'dosageForm', 'routeOfAdministration', 'commercialIntent', 'newProcess'];
  const empty = value => value == null || value === 'unknown' || value === 'none_stated' || value === '' ||
    (Array.isArray(value) && value.length === 0);
  return ordered
    .filter(key => CRITICAL_FOR_CLASSIFICATION.includes(key))
    .filter(key => key !== 'claims' || !empty(facts.intendedUse)) // ask claims after intended use
    .filter(key => empty(facts[key]))
    .slice(0, limit)
    .map(key => ({ key, ...QUESTION_BANK[key] }));
}
