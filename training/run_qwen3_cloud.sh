#!/usr/bin/env bash
set -euo pipefail

# Run from the repository root on a Linux CUDA host with enough VRAM for QLoRA.
# Keep model weights and source downloads outside the repository.
MODEL_CACHE_DIR="${IP_SAKTI_MODEL_CACHE_DIR:-$(pwd)/../ip-sakti-model-cache}"
SOURCE_DIR="${IP_SAKTI_SOURCE_DIR:-$(pwd)/../ip-sakti-official-sources}"
ARTIFACT_DIR="${IP_SAKTI_ARTIFACT_DIR:-$(pwd)/../ip-sakti-artifacts}"
mkdir -p "$MODEL_CACHE_DIR" "$SOURCE_DIR" "$ARTIFACT_DIR"

python -m pip install -r training/requirements.txt
python -m pip install -U "huggingface_hub[cli]"
huggingface-cli download Qwen/Qwen3-8B --local-dir "$MODEL_CACHE_DIR/Qwen3-8B"

npm run sources:manifest
npm run sources:fetch -- --output-dir "$SOURCE_DIR"
npm run training:prepare
npm run training:validate -- --download-manifest "$SOURCE_DIR/download-manifest.json"

python training/train_qwen3_8b.py \
  --model "$MODEL_CACHE_DIR/Qwen3-8B" \
  --train-file training/review/machine-approved.jsonl \
  --source-manifest training/artifacts/source-manifest.json \
  --download-manifest "$SOURCE_DIR/download-manifest.json" \
  --provisional-training \
  --output-dir "$ARTIFACT_DIR/ip-sakti-qwen3-8b-lora"

echo "Adapter training complete. Serve the adapter/base model for evaluation, then run training/evaluate_model.py."
