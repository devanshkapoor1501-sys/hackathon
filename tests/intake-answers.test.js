import { describe, expect, it } from 'vitest';
import { IntakeService } from '../src/services/intake.service.js';

describe('clarification answer normalization', () => {
  it('normalizes human labels to canonical fact enums', () => {
    const intake = new IntakeService();
    const { facts } = intake.applyAnswers({
      intendedUse: 'unknown', claims: [], dosageForm: 'none_stated', routeOfAdministration: 'unknown',
      classicalSource: 'unknown', commercialIntent: 'unknown', newProcess: 'unknown'
    }, {
      intendedUse: 'Treat/prevent disease', dosageForm: 'Tablet', routeOfAdministration: 'Oral',
      classicalSource: 'No', commercialIntent: 'Sell commercially in India', newProcess: 'Not sure'
    });

    expect(facts).toMatchObject({
      intendedUse: 'therapeutic_treatment', dosageForm: 'tablet', routeOfAdministration: 'oral',
      classicalSource: 'not_from_any_text_new_formulation', commercialIntent: 'yes_commercial_sale_india', newProcess: 'unknown'
    });
  });
});
