import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { CORPUS } from './seed-legal-corpus.js';
import { buildSourceManifest } from '../src/data/source-manifest.js';

const cliArgs = process.argv.slice(2);
let file = 'training/review/machine-approved.jsonl';
for (let index = 0; index < cliArgs.length; index += 1) {
  if (cliArgs[index] === '--download-manifest') { index += 1; continue; }
  if (!cliArgs[index].startsWith('--')) { file = cliArgs[index]; break; }
}
const downloadManifestArg = process.argv.indexOf('--download-manifest');
const downloadManifestPath = downloadManifestArg >= 0
  ? process.argv[downloadManifestArg + 1]
  : process.env.IP_SAKTI_DOWNLOAD_MANIFEST;
const sourceByKey = new Map(buildSourceManifest(CORPUS).sources.map(source => [source.sourceKey, source]));
let downloadedByKey = new Map();
const seenPrompts = new Map();
const failures = [];
const rows = [];

function promptTokens(prompt) {
  return new Set(prompt.split(/[^a-z0-9\u0900-\u097f]+/i).filter(token => token.length > 2));
}

function jaccard(left, right) {
  const intersection = [...left].filter(token => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 1;
}

if (downloadManifestPath) {
  try {
    const downloadManifest = JSON.parse(await readFile(downloadManifestPath, 'utf8'));
    downloadedByKey = new Map((downloadManifest.results || []).map(result => [result.sourceKey, result]));
  } catch (error) {
    failures.push(`download manifest ${downloadManifestPath}: cannot read (${error.message})`);
  }
}

const lines = (await readFile(file, 'utf8')).split(/\r?\n/).filter(Boolean);
for (let index = 0; index < lines.length; index += 1) {
  const lineNumber = index + 1;
  let row;
  try { row = JSON.parse(lines[index]); } catch (error) { failures.push(`${file}:${lineNumber}: invalid JSON (${error.message})`); continue; }
  rows.push(row);
  if (!['APPROVED', 'MACHINE_REVIEWED'].includes(row.status)) failures.push(`${file}:${lineNumber}: status is not approved`);
  if (!row.id || !row.scenario || !row.task) failures.push(`${file}:${lineNumber}: missing id/scenario/task`);
  if (!Array.isArray(row.sourceRefs) || !row.sourceRefs.length) failures.push(`${file}:${lineNumber}: missing sourceRefs`);
  for (const sourceKey of row.sourceRefs || []) {
    const source = sourceByKey.get(sourceKey);
    if (!source) failures.push(`${file}:${lineNumber}: unknown source ${sourceKey}`);
    else if (source.trainingEligibility !== 'TRAINING_ELIGIBLE') failures.push(`${file}:${lineNumber}: source ${sourceKey} is ${source.trainingEligibility}`);
    if (downloadManifestPath) {
      const download = downloadedByKey.get(sourceKey);
      if (!download || download.status !== 'DOWNLOADED' || !download.checksum) {
        failures.push(`${file}:${lineNumber}: source ${sourceKey} has no verified downloaded artifact in ${downloadManifestPath}`);
      }
    }
  }
  try { JSON.parse(row.messages?.at(-1)?.content || ''); } catch { failures.push(`${file}:${lineNumber}: assistant completion is not JSON`); }
  const prompt = (row.messages || []).filter(message => message.role !== 'assistant').map(message => message.content).join('\n').toLowerCase().replace(/\s+/g, ' ').trim();
  const fingerprint = createHash('sha256').update(prompt).digest('hex');
  const tokens = promptTokens(prompt);
  for (const previous of seenPrompts.values()) {
    if (previous.scenario !== row.scenario && tokens.size >= 6 && previous.tokens.size >= 6 && jaccard(tokens, previous.tokens) >= 0.92) {
      failures.push(`${file}:${lineNumber}: near-duplicate prompt crosses scenario groups (${previous.id} vs ${row.id})`);
      break;
    }
  }
  seenPrompts.set(fingerprint, { id: row.id, scenario: row.scenario, tokens });
}

const report = { file, downloadManifest: downloadManifestPath || null, rows: rows.length, scenarios: new Set(rows.map(row => row.scenario)).size, failures, valid: failures.length === 0 };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
