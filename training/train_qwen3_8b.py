"""QLoRA SFT entry point for the reviewed IP-SAKTI dataset.

This script is intentionally self-contained so it can run in a temporary CUDA
environment. It does not download or scrape legal sources; the approved JSONL
and provenance manifest must be supplied by the project owner.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
from pathlib import Path


def sha256(path: Path) -> str:
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


def grouped_split(rows, test_fraction=0.2, seed=26045, minimum_groups=2):
    """Split complete scenario groups so product variants cannot leak."""
    groups = {}
    for row in rows:
        key = row.get("scenario") or row.get("id")
        groups.setdefault(key, []).append(row)
    if len(groups) < minimum_groups:
        raise ValueError(f"At least {minimum_groups} scenario groups are required for a held-out split")
    group_names = list(groups)
    random.Random(seed).shuffle(group_names)
    test_count = max(1, round(len(group_names) * test_fraction))
    test_names = set(group_names[:test_count])
    train_rows = [row for name in group_names if name not in test_names for row in groups[name]]
    test_rows = [row for name in group_names if name in test_names for row in groups[name]]
    return train_rows, test_rows


def load_training_rows(path: Path, allow_machine_reviewed=False):
    rows = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        row = json.loads(line)
        status = row.get("status")
        allowed = {"APPROVED"} | ({"MACHINE_REVIEWED"} if allow_machine_reviewed else set())
        if status not in allowed:
            expected = "APPROVED or MACHINE_REVIEWED with --provisional-training" if allow_machine_reviewed else "APPROVED"
            raise ValueError(f"{path}:{line_number} is not explicitly {expected}")
        if not row.get("messages") or row.get("reviewNotes") is None:
            raise ValueError(f"{path}:{line_number} is missing messages or reviewNotes")
        if not row.get("sourceRefs"):
            raise ValueError(f"{path}:{line_number} has no sourceRefs")
        rows.append(row)
    if not rows:
        raise ValueError("No approved training examples were supplied")
    return rows


def load_training_files(paths, allow_machine_reviewed=False):
    rows = []
    seen = set()
    for path in paths:
        for row in load_training_rows(path, allow_machine_reviewed=allow_machine_reviewed):
            key = row.get("id") or f"{path}:{len(rows)}"
            if key not in seen:
                rows.append(row)
                seen.add(key)
    return rows


def validate_duplicate_boundaries(rows):
    fingerprints = {}
    for row in rows:
        user_text = "\n".join(
            str(message.get("content", "")).strip().lower()
            for message in row.get("messages", [])
            if message.get("role") != "assistant"
        )
        normalized = " ".join(user_text.split())
        fingerprint = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        scenario = row.get("scenario") or row.get("id")
        tokens = set(token for token in normalized.split() if len(token) > 2)
        for previous in fingerprints.values():
            previous_tokens = previous["tokens"]
            union = tokens | previous_tokens
            similarity = len(tokens & previous_tokens) / len(union) if union else 1.0
            if previous["scenario"] != scenario and len(tokens) >= 6 and len(previous_tokens) >= 6 and similarity >= 0.92:
                raise ValueError(f"Near-duplicate user prompts cross scenario groups: {previous['id']} and {row.get('id')}")
        fingerprints[fingerprint] = {"id": row.get("id"), "scenario": scenario, "tokens": tokens}


def validate_source_rights(rows, manifest_path: Path, download_manifest_path: Path | None = None):
    if not manifest_path.exists():
        raise FileNotFoundError(f"Source manifest is required for training: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    eligibility = {source["sourceKey"]: source.get("trainingEligibility") for source in manifest.get("sources", [])}
    downloaded = {}
    if download_manifest_path:
        if not download_manifest_path.exists():
            raise FileNotFoundError(f"Downloaded-source manifest is required for training: {download_manifest_path}")
        download_report = json.loads(download_manifest_path.read_text(encoding="utf-8"))
        downloaded = {result.get("sourceKey"): result for result in download_report.get("results", [])}
    for row in rows:
        for source_key in row.get("sourceRefs", []):
            if eligibility.get(source_key) != "TRAINING_ELIGIBLE":
                raise ValueError(f"{row.get('id', '<row>')} cites non-training source {source_key!r}")
            if download_manifest_path:
                result = downloaded.get(source_key)
                if not result or result.get("status") != "DOWNLOADED" or not result.get("checksum"):
                    raise ValueError(f"{row.get('id', '<row>')} cites source without a verified downloaded artifact: {source_key!r}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="Qwen/Qwen3-8B")
    parser.add_argument("--train-file", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--feedback-file", type=Path, action="append", default=[], help="Additional approved JSONL exported from human feedback; repeatable")
    parser.add_argument("--source-manifest", type=Path, default=Path("training/artifacts/source-manifest.json"))
    parser.add_argument("--download-manifest", type=Path, default=None, help="Fetch report; every referenced source must be DOWNLOADED with a checksum")
    parser.add_argument("--epochs", type=float, default=2.0)
    parser.add_argument("--provisional-training", action="store_true", help="Allow MACHINE_REVIEWED rows for a non-deployable experiment")
    parser.add_argument("--minimum-scenario-groups", type=int, default=8)
    args = parser.parse_args()

    rows = load_training_files([args.train_file, *args.feedback_file], allow_machine_reviewed=args.provisional_training)
    if any(row.get("status") == "MACHINE_REVIEWED" for row in rows) and not args.provisional_training:
        raise ValueError("Machine-reviewed rows require --provisional-training and are never deployable by default")
    validate_duplicate_boundaries(rows)
    validate_source_rights(rows, args.source_manifest, args.download_manifest)
    # Imports stay inside main so local preparation does not require the GPU
    # training stack merely to inspect or review the generated data.
    import inspect
    import torch

    from datasets import Dataset
    from peft import LoraConfig
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer

    train_rows, test_rows = grouped_split(rows, minimum_groups=args.minimum_scenario_groups)
    dataset = Dataset.from_list([{"messages": row["messages"], "scenario": row.get("scenario", "unknown")} for row in train_rows])
    evaluation_dataset = Dataset.from_list([{"messages": row["messages"], "scenario": row.get("scenario", "unknown")} for row in test_rows])
    tokenizer = AutoTokenizer.from_pretrained(args.model, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    compute_dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    quantization = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=compute_dtype,
    )
    model = AutoModelForCausalLM.from_pretrained(
        args.model,
        quantization_config=quantization,
        device_map="auto",
        torch_dtype="auto",
    )
    lora = LoraConfig(
        r=64,
        lora_alpha=128,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    )
    args.output_dir.mkdir(parents=True, exist_ok=True)
    training_kwargs = dict(
        output_dir=str(args.output_dir),
        num_train_epochs=args.epochs,
        learning_rate=2e-4,
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=16,
        gradient_checkpointing=True,
        logging_steps=5,
        eval_strategy="steps",
        eval_steps=25,
        save_strategy="steps",
        save_steps=25,
        save_total_limit=2,
        packing=False,
        bf16=compute_dtype == torch.bfloat16,
        fp16=compute_dtype == torch.float16,
        report_to=[],
    )
    sft_parameters = inspect.signature(SFTConfig).parameters
    training_kwargs['max_length' if 'max_length' in sft_parameters else 'max_seq_length'] = 4096
    if 'assistant_only_loss' in sft_parameters:
        training_kwargs['assistant_only_loss'] = True
    else:
        training_kwargs['completion_only_loss'] = True
    if 'eval_strategy' not in sft_parameters and 'evaluation_strategy' in sft_parameters:
        training_kwargs['evaluation_strategy'] = training_kwargs.pop('eval_strategy')
    training = SFTConfig(**training_kwargs)
    trainer_kwargs = dict(
        model=model,
        train_dataset=dataset,
        eval_dataset=evaluation_dataset,
        args=training,
        peft_config=lora,
    )
    if 'processing_class' in inspect.signature(SFTTrainer).parameters:
        trainer_kwargs['processing_class'] = tokenizer
    else:
        trainer_kwargs['tokenizer'] = tokenizer
    trainer = SFTTrainer(
        **trainer_kwargs
    )
    trainer.train()
    trainer.save_model(str(args.output_dir))
    tokenizer.save_pretrained(str(args.output_dir))
    manifest = {
        "baseModel": args.model,
        "dataset": str(args.train_file),
        "feedbackFiles": [str(path) for path in args.feedback_file],
        "datasetSha256": sha256(args.train_file),
        "sourceManifest": str(args.source_manifest),
        "sourceManifestSha256": source_manifest_hash(args.source_manifest),
        "downloadManifest": str(args.download_manifest) if args.download_manifest else None,
        "approvedExamples": len(rows),
        "reviewStatuses": sorted({row.get("status") for row in rows}),
        "provisional": any(row.get("status") == "MACHINE_REVIEWED" for row in rows),
        "deploymentBlockedUntilHumanReview": any(row.get("status") == "MACHINE_REVIEWED" for row in rows),
        "trainExamples": len(train_rows),
        "evaluationExamples": len(test_rows),
        "scenarioGroups": len({row.get("scenario") or row.get("id") for row in rows}),
        "epochs": args.epochs,
        "method": "QLoRA-SFT",
        "thinkingMode": "disabled",
        "computeDtype": str(compute_dtype),
        "lora": {"r": 64, "alpha": 128, "dropout": 0.05},
        "trainingConfig": {
            "learningRate": 2e-4,
            "gradientAccumulationSteps": 16,
            "maxLength": 4096,
            "targetModules": ["q_proj", "k_proj", "v_proj", "o_proj"],
            "loss": "assistant_only_or_completion_only",
        },
        "outputDir": str(args.output_dir),
    }
    (args.output_dir / "training-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
