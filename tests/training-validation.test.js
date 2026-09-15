import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const validator = path.resolve('scripts/validate-training-data.js');

async function validate(row, downloadManifest = null) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ip-sakti-training-'));
  const dataset = path.join(directory, 'dataset.jsonl');
  const args = [validator, dataset];
  if (downloadManifest) {
    const report = path.join(directory, 'download-manifest.json');
    await writeFile(report, JSON.stringify(downloadManifest));
    args.push('--download-manifest', report);
  }
  await writeFile(dataset, `${JSON.stringify(row)}\n`);
  try {
    return execFileSync(process.execPath, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    return `${error.stdout || ''}${error.stderr || ''}`;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function row(sourceRefs, status = 'MACHINE_REVIEWED') {
  return {
    id: 'training-test-row', status, scenario: 'training-test', task: 'safety', sourceRefs,
    reviewNotes: 'test',
    messages: [{ role: 'assistant', content: JSON.stringify({ response: 'requires review' }) }]
  };
}

describe('training provenance gates', () => {
  it('rejects rows that are still pending review', async () => {
    const output = await validate(row(['patents_act_1970_current'], 'PENDING_REVIEW'));
    expect(output).toContain('status is not approved');
  });

  it('rejects rows that cite excluded or retrieval-only sources', async () => {
    const output = await validate(row(['tkdl_pointer']));
    expect(output).toContain('source tkdl_pointer is EXCLUDED');
  });

  it('rejects rows when a referenced eligible source was not downloaded and hashed', async () => {
    const output = await validate(row(['patents_act_1970_current']), { results: [] });
    expect(output).toContain('no verified downloaded artifact');
  });
});
