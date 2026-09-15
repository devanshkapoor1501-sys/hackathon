# IP-SAKTI Qwen3-8B training pipeline

This directory contains the reproducible preparation and QLoRA fine-tuning
workflow. Model weights, adapters, API keys and downloaded legal documents are
intentionally kept outside Git. The supported runtime order in the website is:

`trained Qwen -> NVIDIA -> Gemini -> Ollama -> deterministic fallback`

## Prepare sources and review data

From the repository root:

```powershell
npm run sources:manifest
npm run sources:fetch -- --output-dir ../ip-sakti-official-sources
npm run training:prepare
npm run training:validate -- --download-manifest ../ip-sakti-official-sources/download-manifest.json
```

`training/review/pending.jsonl` is generated from deterministic project rules.
Every row has `status: PENDING_REVIEW`. The preparation script also emits
`training/review/machine-approved.jsonl` after automated schema, source-rights,
JSON-output, duplicate-boundary and unsupported-claim checks. This file is
usable only for a provisional experiment and is never production-deployable.
Human-approved rows may be copied to `training/review/approved.jsonl`, set to
`status: APPROVED`, and given a short `reviewNotes` value.

The source manifest records official URLs, source authority, jurisdiction,
version, attribution, ingestion state, and one of:

- `TRAINING_ELIGIBLE`
- `RETRIEVAL_ONLY`
- `EXCLUDED`

PATENTSCOPE is excluded from the first release. Restricted TKDL content is
represented only by an access pointer. Legal texts should be acquired through
permitted official downloads or manually supplied files with their source
terms recorded in the manifest.

`npm run sources:fetch` downloads only manifest entries marked
`TRAINING_ELIGIBLE` and records a SHA-256 checksum in an external
`download-manifest.json`. Catalog pointers, restricted content, test fixtures
and unclear-license sources are never downloaded for training.

## QLoRA run

Run on a temporary Linux CUDA GPU environment. Install the requirements, copy
the machine-approved dataset and source manifest, then run:

```bash
python training/train_qwen3_8b.py \
  --model Qwen/Qwen3-8B \
  --train-file training/review/machine-approved.jsonl \
  --source-manifest training/artifacts/source-manifest.json \
  --download-manifest ../ip-sakti-official-sources/download-manifest.json \
  --provisional-training \
  --output-dir artifacts/ip-sakti-qwen3-8b-lora
```

The model can be cached before training with:

```bash
python -m pip install -U "huggingface_hub[cli]"
huggingface-cli download Qwen/Qwen3-8B --local-dir "$IP_SAKTI_MODEL_CACHE_DIR/Qwen3-8B"
```

The script uses 4-bit QLoRA, assistant-only loss, Qwen3 non-thinking mode,
and a held-out split grouped by scenario. It writes training metadata and
evaluation results beside the adapter. Merge and quantize the adapter to GGUF
with the runtime tooling available in the GPU environment:

```bash
python training/merge_and_quantize.py \
  --base-model Qwen/Qwen3-8B \
  --adapter artifacts/ip-sakti-qwen3-8b-lora \
  --merged-dir artifacts/ip-sakti-qwen3-8b-merged \
  --source-manifest training/artifacts/source-manifest.json \
  --llama-cpp-dir /path/to/llama.cpp \
  --gguf-output artifacts/ip-sakti-qwen3-8b-f16.gguf
```

Import the resulting `Q4_K_M` GGUF into Ollama as `ip-sakti-qwen3-8b`, then
compare the base and candidate endpoints on the scenario-group holdout:

```bash
python training/evaluate_model.py \
  --dataset training/review/machine-approved.jsonl \
  --base-url http://localhost:11434/v1 --base-model qwen3:8b \
  --candidate-url http://localhost:11434/v1 --candidate-model ip-sakti-qwen3-8b \
  --allow-machine-reviewed \
  --output artifacts/model-comparison.json
```

The evaluation report writes a `deploymentGate` covering valid JSON,
classification, citation integrity, temporal behavior, English/Hindi behavior,
prompt-injection safety, unsupported claims and human-review escalation. A
machine-reviewed run is explicitly marked provisional and cannot pass the
deployment gate. If the merged artifact is rebuilt after evaluation, pass
`--evaluation artifacts/model-comparison.json` to include the report in
`deployment-manifest.json`.

Do not enable `TRAINED_MODEL_ENABLED=true` until the held-out safety and
citation checks pass, human legal review is complete, and
`TRAINED_MODEL_MANIFEST` points to the resulting deployment manifest with
`deploymentGate.passed=true`. When enabled, the trained Qwen endpoint is the
primary website provider; failed health or generation automatically falls
through to NVIDIA, Gemini and Ollama.

## Controlled self-training loop

The dashboard/API can record an explicit reviewer correction for a case at
`POST .../cases/:id/model-feedback`. These records start as
`PENDING_REVIEW`; an organization owner/admin must approve them before they
are exportable. Unsupported or source-less feedback is rejected for training,
and ordinary user conversations are never collected implicitly.

Export approved corrections from the configured MongoDB database:

```bash
npm run training:self-export
```

Then include the export in the next QLoRA run:

```bash
python training/train_qwen3_8b.py \
  --train-file training/review/approved.jsonl \
  --feedback-file training/review/self-training-approved.jsonl \
  --output-dir artifacts/ip-sakti-qwen3-8b-lora
```

Every run still uses a held-out scenario split and the deployment gate. This
is deliberate: a RAG system should improve from reviewed, source-backed
corrections, not silently learn hallucinations or prompt-injection text.
