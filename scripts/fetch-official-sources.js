import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const getArg = (name, fallback = '') => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
};

const manifestPath = path.resolve(getArg('--manifest', 'training/artifacts/source-manifest.json'));
const outputDir = path.resolve(getArg('--output-dir', process.env.IP_SAKTI_SOURCE_DIR || path.resolve('..', 'ip-sakti-official-sources')));
const limit = Number(getArg('--limit', '0')) || 0;
const maxBytes = 50 * 1024 * 1024;

function checksum(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function extension(url, contentType = '') {
  if (/pdf/i.test(contentType) || /\.pdf(?:[?#]|$)/i.test(url)) return '.pdf';
  if (/html/i.test(contentType) || /\.html?(?:[?#]|$)/i.test(url)) return '.html';
  return '.bin';
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const eligible = manifest.sources.filter(source => source.trainingEligibility === 'TRAINING_ELIGIBLE' && /^https:\/\//i.test(source.url));
const selected = limit > 0 ? eligible.slice(0, limit) : eligible;
await mkdir(outputDir, { recursive: true });

const results = [];
for (const source of selected) {
  const record = { sourceKey: source.sourceKey, url: source.url, trainingEligibility: source.trainingEligibility };
  try {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(45_000), redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) throw new Error(`response exceeds ${maxBytes} byte safety limit`);
    const filePath = path.join(outputDir, `${source.sourceKey}${extension(source.url, response.headers.get('content-type') || '')}`);
    await writeFile(filePath, buffer);
    results.push({ ...record, status: 'DOWNLOADED', path: filePath, bytes: buffer.length, checksum: checksum(buffer), retrievedAt: new Date().toISOString(), contentType: response.headers.get('content-type') || '' });
  } catch (error) {
    results.push({ ...record, status: 'FAILED', error: String(error.message || error).slice(0, 240) });
  }
}

const report = {
  manifestPath,
  outputDir,
  sourcePolicy: 'Official primary sources only; catalog pointers and excluded/restricted sources are not downloaded',
  downloadedAt: new Date().toISOString(),
  selected: selected.length,
  results
};
const reportPath = path.join(outputDir, 'download-manifest.json');
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ reportPath, selected: selected.length, downloaded: results.filter(r => r.status === 'DOWNLOADED').length, failed: results.filter(r => r.status === 'FAILED').length }, null, 2));
