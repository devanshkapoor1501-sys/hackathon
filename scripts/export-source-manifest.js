import { mkdir, writeFile } from 'node:fs/promises';
import { CORPUS } from './seed-legal-corpus.js';
import { buildSourceManifest, sourceManifestHash } from '../src/data/source-manifest.js';

const manifest = buildSourceManifest(CORPUS);
manifest.manifestHash = sourceManifestHash(manifest);
const output = JSON.stringify(manifest, null, 2) + '\n';

await mkdir('training/artifacts', { recursive: true });
await writeFile('training/artifacts/source-manifest.json', output, 'utf8');
console.log(JSON.stringify({ output: 'training/artifacts/source-manifest.json', sources: manifest.sources.length, manifestHash: manifest.manifestHash }, null, 2));
