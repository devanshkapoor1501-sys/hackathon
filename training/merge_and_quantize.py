"""Merge a reviewed QLoRA adapter and optionally invoke llama.cpp conversion."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path


def sha256(path: Path) -> str | None:
    if not path.exists():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def source_manifest_hash(path: Path):
    if not path.exists():
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value.get("manifestHash") or sha256(path)
    except (json.JSONDecodeError, OSError):
        return sha256(path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-model", default="Qwen/Qwen3-8B")
    parser.add_argument("--adapter", type=Path, required=True)
    parser.add_argument("--merged-dir", type=Path, required=True)
    parser.add_argument("--gguf-output", type=Path)
    parser.add_argument("--llama-cpp-dir", type=Path)
    parser.add_argument("--quant-type", default="Q4_K_M")
    parser.add_argument("--source-manifest", type=Path, default=Path("training/artifacts/source-manifest.json"))
    parser.add_argument("--evaluation", type=Path)
    args = parser.parse_args()

    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer

    args.merged_dir.mkdir(parents=True, exist_ok=True)
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, use_fast=True)
    base = AutoModelForCausalLM.from_pretrained(args.base_model, torch_dtype="auto", device_map="auto")
    merged = PeftModel.from_pretrained(base, str(args.adapter)).merge_and_unload()
    merged.save_pretrained(str(args.merged_dir), safe_serialization=True)
    tokenizer.save_pretrained(str(args.merged_dir))

    gguf = None
    if args.gguf_output:
        if not args.llama_cpp_dir:
            raise ValueError("--llama-cpp-dir is required when --gguf-output is used")
        converter = args.llama_cpp_dir / "convert_hf_to_gguf.py"
        if not converter.exists():
            raise FileNotFoundError(converter)
        args.gguf_output.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["python", str(converter), str(args.merged_dir), "--outfile", str(args.gguf_output), "--outtype", "bf16"], check=True)
        quantizer = shutil.which("llama-quantize") or shutil.which("quantize")
        if not quantizer:
            raise FileNotFoundError("llama-quantize/quantize executable not found on PATH")
        quantized = args.gguf_output.with_name(f"{args.gguf_output.stem}-{args.quant_type}.gguf")
        subprocess.run([quantizer, str(args.gguf_output), str(quantized), args.quant_type], check=True)
        gguf = str(quantized)

    training_manifest_path = args.adapter / "training-manifest.json"
    training_manifest = json.loads(training_manifest_path.read_text(encoding="utf-8")) if training_manifest_path.exists() else {}
    evaluation = None
    if args.evaluation:
        evaluation = json.loads(args.evaluation.read_text(encoding="utf-8"))
    manifest = {
        "baseModel": args.base_model,
        "adapter": str(args.adapter),
        "datasetSha256": training_manifest.get("datasetSha256"),
        "sourceManifest": str(args.source_manifest),
        "sourceManifestSha256": source_manifest_hash(args.source_manifest),
        "trainingConfig": training_manifest.get("trainingConfig", training_manifest),
        "mergedDirectory": str(args.merged_dir),
        "gguf": gguf,
        "quantization": args.quant_type if gguf else None,
        "evaluationResults": evaluation,
        "deploymentGate": evaluation.get("deploymentGate") if evaluation else "PENDING_EVALUATION",
        "deploymentModelId": "ip-sakti-qwen3-8b",
    }
    (args.merged_dir / "deployment-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
