# IP-SAKTI Qwen3-8B training pipeline

This directory contains the reproducible preparation and QLoRA fine-tuning
workflow. Model weights, adapters, API keys and downloaded legal documents are
intentionally kept outside Git.

## Prepare sources and review data

From the repository root:

```powershell
npm run sources:manifest
npm run training:prepare
```

`training/review/pending.jsonl` is generated from deterministic project rules.
Every row has `status: PENDING_REVIEW`. A reviewer must copy approved rows to
`training/review/approved.jsonl`, set `status` to `APPROVED`, and add a short
`reviewNotes` value. The training script refuses any row that is not explicitly
approved.

The source manifest records official URLs, source authority, jurisdiction,
version, attribution, ingestion state, and one of:

- `TRAINING_ELIGIBLE`
- `RETRIEVAL_ONLY`
- `EXCLUDED`

PATENTSCOPE is excluded from the first release. Restricted TKDL content is
represented only by an access pointer. Legal texts should be acquired through
permitted official downloads or manually supplied files with their source
terms recorded in the manifest.

## QLoRA run

Run on a temporary CUDA GPU environment. Install the requirements, copy the
approved dataset and source manifest, then run:

```bash
python training/train_qwen3_8b.py \
  --model Qwen/Qwen3-8B \
  --train-file training/review/approved.jsonl \
  --output-dir artifacts/ip-sakti-qwen3-8b-lora
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
  --dataset training/review/approved.jsonl \
  --base-url http://localhost:11434/v1 --base-model qwen3:8b \
  --candidate-url http://localhost:11434/v1 --candidate-model ip-sakti-qwen3-8b \
  --output artifacts/model-comparison.json
```

The evaluation report writes a `deploymentGate` that requires no regression in
valid JSON or classification accuracy, no increase in unsupported claims, and
a passing safety check. If the merged artifact is rebuilt after evaluation,
pass `--evaluation artifacts/model-comparison.json` to include the report in
`deployment-manifest.json`. Enable the candidate only when that gate passes
and the existing deterministic safety/citation suite remains green.

Do not enable `TRAINED_MODEL_ENABLED=true` until the held-out safety and
citation checks pass and `TRAINED_MODEL_MANIFEST` points to the resulting
deployment manifest with `deploymentGate.passed=true`. The application continues to use NVIDIA, Gemini,
Ollama/LM Studio, and deterministic fallbacks when the trained model is not
available.

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
