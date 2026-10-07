#!/usr/bin/env python3
"""Emit complete deterministic worker mechanics from an actual emitted game corpus.

Run AFTER regenerate_neural_data.py, against that build's graph-data.json and
submission-details, with --source-root pointing at the SAME gameplay source.
No hydration, browser snapshot, source edit, network, training, or model solve.
Root owns invoking this in the build and deferring the manifest/worker requests.

Example (after modules are integrated):
  python3 scripts/regenerate_mdp_data.py --output source/quartz/static/neural/mdp

Default fail-closed: all rulesets and emitted loss-aversion presets are covered;
missing positive support emits an UNAVAILABLE manifest and exits 1. Structural
input errors exit 2. --allow-incomplete is only for inspection and keeps status.
The manifest is atomic, content addressed, and has no wall-clock/path entropy.
Older parts are preserved so an already-running worker can finish its revision.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from _mdp_mechanics import PRODUCER_VERSION, digest, number, produce_metadata, stable
from _mdp_transport import CODEC, atomic_write, sizes, write_transport

ROOT = Path(__file__).resolve().parents[1]
LAW_FILES = {"adapter": "mdp-adapter.src.js", "model": "mdp-model.src.js", "knowledge": "knowledge-profile.src.js"}
LAW_VERSIONS = {"NG_MDP_API_VERSION": 2, "NG_MDP_ADAPTER_VERSION": 1, "NG_KNOWLEDGE_VERSION": 1}
LAW_CONSTANTS = {"model": "NG_MDP_API_VERSION", "adapter": "NG_MDP_ADAPTER_VERSION", "knowledge": "NG_KNOWLEDGE_VERSION"}


def qhash(text):
    value = 2166136261
    units = text.encode("utf-16-le")
    for i in range(0, len(units), 2):
        value = ((value ^ int.from_bytes(units[i:i + 2], "little")) * 16777619) & 0xffffffff
    return format(value, "08x")


def read_json(path):
    # Reject nonfinite JSON and duplicate property names instead of silently changing
    # mass or destination identity at parse time.
    def object_pairs(pairs):
        out = {}
        for k, v in pairs:
            if k in out:
                raise ValueError("duplicate-json-key:" + k)
            out[k] = v
        return out

    def invalid(value):
        raise ValueError("nonfinite-json:" + value)

    def numeric(text):
        v = float(text) if any(c in text for c in ".eE") else int(text)
        if not number(v):
            raise ValueError("unsupported-js-number:" + text)
        return v

    data = path.read_bytes()
    return json.loads(data, object_pairs_hook=object_pairs, parse_constant=invalid, parse_int=numeric, parse_float=numeric), data


def source_inputs(graph_path, details_path, source_root, laws):
    wire, raw = read_json(graph_path)
    details, detail_hashes = {}, {}
    for path in sorted(details_path.glob("*.json")):
        bucket, data = read_json(path)
        if not isinstance(bucket, dict):
            raise ValueError("malformed-defense-bucket:" + path.name)
        for title, body in bucket.items():
            if title in details:
                raise ValueError("duplicate-submission-details:" + title)
            if path.stem != qhash(title):
                raise ValueError("unloadable-submission-details:" + title)
            details[title] = body
        detail_hashes[path.name] = digest(data)
    law_hashes = {}
    identity_path = laws["adapter"].with_name("mdp-identity.src.js")
    identity_bytes = identity_path.read_bytes() if identity_path.exists() else None
    if identity_bytes is not None:
        law_hashes["identity"] = digest(identity_bytes)
    # The worker-only solver is part of the model law even though it declares no
    # separate API version. Follow --model-source for split-worktree audits too.
    certified_path = laws["model"].with_name("mdp-certified.src.js")
    if certified_path.exists():
        law_hashes["certified"] = digest(certified_path.read_bytes())
    for name, path in laws.items():
        data = path.read_bytes()
        constant = LAW_CONSTANTS[name]
        match = re.search(r"\b(?:const|var|let)\s+" + constant + r"\s*=\s*(\d+)\b", data.decode())
        if not match and name == "model" and identity_bytes is not None:
            match = re.search(r"\b(?:const|var|let)\s+" + constant + r"\s*=\s*(\d+)\b", identity_bytes.decode())
        if not match or int(match[1]) != LAW_VERSIONS[constant]:
            raise ValueError("unsupported-law-version:" + constant)
        law_hashes[name] = digest(data)
    model_hash = digest({"files": law_hashes, "versions": LAW_VERSIONS})
    # Raw graph identity is intentionally NOT the canonicalized projection hash.
    provenance = {"graphHash": digest(raw), "detailsHash": digest(detail_hashes),
                  "detailsFiles": len(detail_hashes), "gameplayHash": digest((source_root / "neural/src/app.src.jsx").read_bytes()),
                  "lawHashes": law_hashes, "lawVersions": LAW_VERSIONS, "producerVersion": PRODUCER_VERSION,
                  "producerHash": digest({p.name: digest(p.read_bytes()) for p in
                      (Path(__file__), *sorted(Path(__file__).parent.glob("_mdp_*.py")))}),
                  "modelHash": model_hash}
    for filename in ("neural/submission-states.json", "scripts/submission_choices.py", "scripts/regenerate_neural_data.py"):
        path = source_root / filename
        provenance.setdefault("emitterHashes", {})[filename] = digest(path.read_bytes())
    provenance["sourceHash"] = digest(provenance)
    return wire, details, provenance


def emit(args):
    source_root = args.source_root.resolve()
    data_root = args.data_root or source_root / "source/quartz/static/neural"
    laws = {name: getattr(args, name + "_source") or source_root / "neural/src" / filename for name, filename in LAW_FILES.items()}
    wire, details, provenance = source_inputs(data_root / "graph-data.json", data_root / "submission-details", source_root, laws)
    lambdas = wire.get("evLam") or [None]
    variants = []
    for frame in ("gi", "nogi"):
        for lam in lambdas:
            metadata = produce_metadata(wire, details, frame, lam)
            # mechanicsHash binds all metadata, including the selected opponent rows,
            # plus the exact adapter/probability law and content/source provenance.
            mechanics_hash = digest({"metadata": metadata, "provenance": provenance})
            descriptor = write_transport(args.output, metadata)
            variant = {"ruleset": frame, "lossAversion": lam, "mechanicsHash": mechanics_hash,
                       "coverage": metadata["coverage"], **descriptor}
            encoded_variant = stable(variant).encode()
            if len(encoded_variant) > 40000:
                raise ValueError("metadata-descriptor-exceeds-chunk-budget")
            filename = "variant-" + digest(encoded_variant) + ".json"
            atomic_write(args.output / filename, encoded_variant)
            variants.append({"ruleset": frame, "lossAversion": lam, "mechanicsHash": mechanics_hash,
                             "status": metadata["coverage"]["status"], "file": filename, **sizes(encoded_variant),
                             "transfer": descriptor["transfer"]})
            if args.decoded_output:
                args.decoded_output.mkdir(parents=True, exist_ok=True)
                atomic_write(args.decoded_output / f"{frame}-lambda-{lam}.json", stable(metadata).encode())
            print(f"[mdp] {frame} lambda={lam} {metadata['coverage']['status']} "
                  f"nodes={len(metadata['nodes'])} hands={len(metadata['hands'])} actions={metadata['coverage']['actions']} "
                  f"defenses={metadata['coverage']['defenseRows']} issues={len(metadata['coverage']['issues'])} "
                  f"raw={descriptor['transfer']['rawBytes']} gzip={descriptor['transfer']['gzipBytes']} "
                  f"parts={descriptor['transfer']['requests']}")
    # The sources may be in separately owned worktrees during integration. Never
    # publish a mixed-generation manifest if another writer changed an input.
    _, _, final_provenance = source_inputs(data_root / "graph-data.json", data_root / "submission-details", source_root, laws)
    if final_provenance != provenance:
        raise ValueError("source-changed-during-metadata-emission")
    manifest = {"version": 1, "producerVersion": PRODUCER_VERSION, "codec": CODEC,
                "status": "COMPLETE" if all(v["status"] == "COMPLETE" for v in variants) else "UNAVAILABLE",
                "provenance": provenance, "variants": variants,
                "loading": {"audience": "worker", "registration": "once-per-mechanicsHash",
                            "runtime": ["deckReady", "residencyRevision"], "maxConcurrentRequests": 4,
                            "eagerGraphDeltaBytes": 0, "chunkMaxBytes": 40000}}
    encoded = stable(manifest).encode()
    if len(encoded) > 40000:
        raise ValueError("metadata-manifest-exceeds-chunk-budget")
    # This may hold diagnostics for an unavailable corpus. It is explicitly NOT an
    # eagerly fetched underscore manifest. Loading/gate declarations belong to root.
    atomic_write(args.output / ("manifest-" + digest(encoded) + ".json"), encoded)
    atomic_write(args.output / "manifest.json", encoded)
    print("[mdp] manifest " + stable(sizes(encoded)))
    print("[mdp] provenance " + stable(provenance))
    if manifest["status"] != "COMPLETE" and not args.allow_incomplete:
        return 1
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source-root", type=Path, default=ROOT)
    parser.add_argument("--data-root", type=Path, help="Actual neural emission directory; never a runtime snapshot")
    parser.add_argument("--output", type=Path, default=ROOT / "source/quartz/static/neural/mdp")
    parser.add_argument("--decoded-output", type=Path, help="Optional audit JSON directory, outside published assets")
    for name in LAW_FILES:
        parser.add_argument("--" + name + "-source", type=Path, help="Exact integrated law file (split worktree audit only)")
    parser.add_argument("--allow-incomplete", action="store_true", help="Inspection only: retain UNAVAILABLE status but exit 0")
    args = parser.parse_args()
    try:
        return emit(args)
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print("[mdp] unavailable: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
