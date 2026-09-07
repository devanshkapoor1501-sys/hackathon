import { SUITE_VERSION, BENCHMARK_CASES } from './benchmark.cases.js';
import { getProvider } from '../ai/index.js';

/**
 * Runs the benchmark suite against the deterministic engines.
 * Pure: returns a plain result object; persistence is the caller's job.
 */
export async function runEvaluation({ organizationId, userId }) {
  const started = Date.now();
  const provider = getProvider();
  const modelInfo = provider.getModelInfo();

  const results = [];
  for (const testCase of BENCHMARK_CASES) {
    const caseStarted = Date.now();
    try {
      const outcome = await Promise.resolve(testCase.run());
      results.push({
        name: testCase.name, dimension: testCase.dimension,
        passed: Boolean(outcome.passed),
        expected: outcome.expected ?? null,
        actual: String(outcome.actual ?? '').slice(0, 400),
        detail: outcome.detail ? String(outcome.detail).slice(0, 300) : '',
        latencyMs: Date.now() - caseStarted
      });
    } catch (error) {
      results.push({
        name: testCase.name, dimension: testCase.dimension,
        passed: false, expected: 'no throw', actual: `error: ${error.message}`.slice(0, 400), detail: '', latencyMs: Date.now() - caseStarted
      });
    }
  }

  const dimensions = {};
  for (const result of results) {
    dimensions[result.dimension] = dimensions[result.dimension] || { total: 0, passed: 0 };
    dimensions[result.dimension].total++;
    if (result.passed) dimensions[result.dimension].passed++;
  }
  for (const key of Object.keys(dimensions)) dimensions[key].rate = Math.round(100 * dimensions[key].passed / dimensions[key].total);

  const passed = results.filter(r => r.passed).length;
  return {
    suiteVersion: SUITE_VERSION,
    ranAt: new Date(),
    durationMs: Date.now() - started,
    summary: { total: results.length, passed, failed: results.length - passed, passRate: Math.round(100 * passed / results.length), dimensions },
    results,
    environment: { provider: modelInfo.id, model: modelInfo.reasoningModel || '(offline)', llmUsedInSuite: false }
  };
}
