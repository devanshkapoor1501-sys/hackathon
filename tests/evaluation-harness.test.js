import { describe, it, expect } from 'vitest';
import { runEvaluation } from '../src/evaluation/runner.js';
import { BENCHMARK_CASES, SUITE_VERSION } from '../src/evaluation/benchmark.cases.js';

describe('evaluation harness (persistent benchmark suite)', () => {
  it('exposes a stable suite with expected dimensions', () => {
    expect(SUITE_VERSION).toBe('v1');
    const dimensions = new Set(BENCHMARK_CASES.map(c => c.dimension));
    expect(dimensions).toEqual(new Set([
      'classification', 'regimes', 'jurisdiction', 'abs', 'tk',
      'temporal', 'citation_integrity', 'prompt_injection', 'multilingual',
      'safety', 'local_model_resilience'
    ]));
    expect(BENCHMARK_CASES.length).toBeGreaterThanOrEqual(20);
  });

  it('runs the full suite green against the deterministic engines + seeded corpus', async () => {
    const result = await runEvaluation({ organizationId: null, userId: null });
    expect(result.suiteVersion).toBe('v1');
    expect(result.summary.total).toBe(BENCHMARK_CASES.length);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    // every individual result carries latency for cost/latency tracking
    for (const r of result.results) {
      expect(r.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof r.passed).toBe('boolean');
    }
    if (result.summary.failed > 0) {
      const failures = result.results.filter(r => !r.passed);
      throw new Error(`Benchmark failures: ${failures.map(f => `${f.name} (${f.actual})`).join(' | ')}`);
    }
    expect(result.summary.passRate).toBe(100);
    // dimension math is internally consistent
    let counted = 0;
    for (const dim of Object.values(result.summary.dimensions)) counted += dim.total;
    expect(counted).toBe(result.summary.total);
    // environment records provider context without requiring an LLM
    expect(result.environment.llmUsedInSuite).toBe(false);
  }, 30000);
});
