"""Producer mechanics, integrity, identity, and packaging contracts; no built fixtures."""
import copy
import hashlib
import json
import random
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from _mdp_mechanics import produce_metadata, response_identity, stable
from _mdp_transport import CODEC, pack, unpack, write_transport, read_transport
from regenerate_mdp_data import LAW_CONSTANTS, LAW_FILES, LAW_VERSIONS, qhash, read_json


def fixture():
    def pos(name, alias=None):
        return {"id": "Positions/" + name, "t": name + " Top", "ty": "positions", "posId": name.lower(),
                "s": [.5, -.5], "cal": {"avail": {"gi": True, "nogi": True}, **({"stateAlias": alias} if alias else {})}}

    def tech(name, ty, role, **cal):
        return {"id": ("Submissions/" if ty == "submissions" else "Transitions/") + name, "t": name, "ty": ty,
                "s": [.8, -.8], "fromPositionId": "mount", "fromRole": role,
                "cal": {"avail": {"gi": True, "nogi": True}, "successRate": 60,
                        "outcomes": [[0 if ty == "submissions" else 1, 60, "s"], [2, 20, "f"], [3, 20, "c"]], **cal}}

    nodes = [pos("Mount"), pos("Guard"), tech("Bottom Sweep", "transitions", "bottom"),
             tech("Lock", "submissions", "bottom", successRateByRuleset={"gi": 70, "nogi": None}, stateMoves=["bottom-sweep"]),
             pos("Alias", "lock"), tech("Cloth", "transitions", "top", avail={"gi": True, "nogi": False})]
    # Slugs are taken from IDs, not title guesses.
    nodes[2]["id"] = "Transitions/Bottom-Sweep"
    nodes[0]["cal"]["ev"] = {"bottom": [[2, 3, 5], [0, 70, 30], [2, 8, 3, 9, -1, 12], [4, 16, 6, 18, -2, 24]]}
    wire = {"nodes": nodes, "links": [[0, 2], [0, 3], [1, 2], [0, 5]],
            "evLam": [1, 2], "evFrame": "nogi", "toTab": ["game-over", "guard/top", "mount/bottom", "guard/bottom"]}
    details = {"Lock": {"choices": [{"label": "Frame", "to": "mount/top", "detail": 0}, {"label": "Frame", "to": "mount/top", "detail": 1}],
                        "details": [{"action": "Frame with left hand", "risk": "example"}, {"action": "Frame with right hand", "risk": "example"}]}}
    return wire, details


def node(metadata, nid):
    return next(n for n in metadata["nodes"] if n["id"] == nid)


class Mechanics(unittest.TestCase):
    def setUp(self):
        self.wire, self.details = fixture()

    def build(self, **kw):
        return produce_metadata(self.wire, self.details, kw.pop("ruleset", "gi"), **kw)

    def test_deterministic_non_mutating_and_node_permutation(self):
        before = stable([self.wire, self.details])
        expected = stable(self.build())
        self.assertEqual(expected, stable(self.build()))
        self.assertEqual(before, stable([self.wire, self.details]))
        order = list(range(len(self.wire["nodes"])))
        random.Random(53).shuffle(order)
        inverse = {old: new for new, old in enumerate(order)}
        self.wire["nodes"] = [self.wire["nodes"][i] for i in order]
        self.wire["links"] = [[inverse[a], inverse[b]] for a, b in self.wire["links"]]
        for n in self.wire["nodes"]:
            for block in n["cal"].get("ev", {}).values():
                block[0] = [inverse[i] for i in block[0]]
        self.assertEqual(expected, stable(self.build()))

    def test_roles_canonical_aliases_and_both_member_hands(self):
        m = self.build()
        self.assertEqual(m["coverage"]["status"], "COMPLETE")
        sub = node(m, "Submissions/Lock")
        self.assertEqual(sub["fromRole"], "bottom")
        self.assertEqual(sub["role"], "attacker")
        self.assertEqual(sub["deckKey"], "Lock|Attacker")
        self.assertEqual(node(m, sub["pairId"])["deckKey"], "Lock|Defender")
        self.assertEqual(node(m, "Positions/Mount/Bottom")["deckKey"], "Mount|Bottom")
        self.assertEqual(m["canonical"][stable(["Positions/Alias", "top"])], sub["pairId"])
        self.assertEqual(m["canonical"][stable(["Positions/Alias/Bottom", "bottom"])], sub["id"])
        for seat in ("Positions/Mount", "Positions/Mount/Bottom"):
            hand = m["hands"][stable([seat, "bottom"])]
            self.assertEqual({o["techniqueId"] for o in hand}, {"Submissions/Lock", "Transitions/Bottom-Sweep"})
        self.assertEqual(m["hands"][stable([sub["pairId"], "bottom"])][0]["kind"], "finish")
        self.assertEqual(len(m["hands"][stable([sub["id"], "top"])]), 2)

    def test_frame_mask_null_scalar_weights_and_zero_attempt_are_distinct(self):
        gi, nogi = self.build(), self.build(ruleset="nogi")
        self.assertTrue(node(gi, "Transitions/Cloth")["allowed"])
        self.assertFalse(node(nogi, "Transitions/Cloth")["allowed"])
        for frame in (gi, nogi):
            sub = node(frame, "Submissions/Lock")
            self.assertEqual(sub["cal"]["successRateByRuleset"], {"gi": 70, "nogi": None})
            self.assertEqual(sub["cal"]["outcomes"], node(gi, sub["id"])["cal"]["outcomes"])
            sweep = next(o for o in frame["hands"][stable(["Positions/Mount", "bottom"])] if "Sweep" in o["techniqueId"])
            self.assertEqual(sweep["ev"]["att"], 0)
            self.assertNotIn("outcomesByRuleset", sub["cal"])
        self.assertEqual(nogi["coverage"]["explicitNullFrameRates"], 1)

    def test_ev_keeps_filtered_rows_and_binds_lambda(self):
        key = stable(["Positions/Mount", "bottom"])
        m, alt = self.build(), self.build(loss_aversion=1)
        self.assertEqual(len(m["evHands"][key]), 3)
        self.assertEqual(len(m["hands"][key]), 2)
        self.assertNotEqual(m["evHands"][key], alt["evHands"][key])
        self.assertEqual(m["lossAversion"], 2)

    def test_defense_ids_use_authored_content_and_keep_duplicate_destinations(self):
        m = self.build()
        rows = m["hands"][stable(["Submissions/Lock", "top"])]
        self.assertEqual(len({r["defenseId"] for r in rows}), 2)
        self.assertEqual(len({r["destinationId"] for r in rows}), 1)
        body = self.details["Lock"]
        body["choices"].reverse()
        body["details"].reverse()
        for c in body["choices"]:
            c["detail"] = 1 - c["detail"]
        changed = self.build()["hands"][stable(["Submissions/Lock", "top"])]
        self.assertEqual({r["defenseId"] for r in rows}, {r["defenseId"] for r in changed})
        self.assertEqual({r["defense"]["detail"] for r in rows}, {0, 1})
        self.assertNotIn("left hand", stable(m))
        self.assertNotIn('"label":"Frame"', stable(m))

    def test_missing_defense_or_positive_destination_never_complete(self):
        self.details.clear()
        m = self.build()
        self.assertEqual(m["coverage"]["status"], "UNAVAILABLE")
        self.assertEqual(m["coverage"]["missingDefenseStateIds"], ["Submissions/Lock"])
        self.wire, self.details = fixture()
        self.wire["toTab"][2] = "missing/top"
        m = self.build()
        self.assertEqual(m["destinations"]["missing/top"]["nodeId"], None)
        self.assertGreater(m["coverage"]["unresolvedDestinations"], 0)
        self.assertEqual(m["coverage"]["status"], "UNAVAILABLE")

    def test_malformed_mass_missing_continuations_and_defense_identity(self):
        for bad in (-3, None, "unknown", True, float("nan")):
            self.wire["nodes"][2]["cal"]["outcomes"][1][1] = bad
            m = self.build()
            self.assertEqual(m["coverage"]["status"], "UNAVAILABLE", str(bad))
        self.wire, self.details = fixture()
        self.wire["nodes"][3]["cal"]["stateMoves"] = ["missing"]
        self.details["Lock"]["choices"].append(copy.deepcopy(self.details["Lock"]["choices"][0]))
        kinds = {i["kind"] for i in self.build()["coverage"]["issues"]}
        self.assertIn("missing-continuation", kinds)
        self.assertIn("ambiguous-defense-identity", kinds)

    def test_strict_hand_is_uncapped_fallback_only_relaxes_origin(self):
        # More than ten feasible actions stay in the strict hand even at zero attempts.
        for i in range(12):
            move = copy.deepcopy(self.wire["nodes"][2])
            move.update(id=f"Transitions/Sweep-{i}", t=f"Sweep {i}")
            self.wire["links"].append([0, len(self.wire["nodes"])])
            self.wire["nodes"].append(move)
        m = self.build()
        self.assertEqual(len(m["hands"][stable(["Positions/Mount", "bottom"])]), 14)
        self.wire["nodes"][0]["posId"] = "different-origin"
        hand = self.build()["hands"][stable(["Positions/Mount", "bottom"]) ]
        self.assertEqual(len(hand), 6)
        self.assertTrue(all(o["relaxed"] for o in hand))
        self.assertTrue(all("Cloth" not in o["techniqueId"] for o in hand))

    def test_no_question_card_layout_or_residency_payload(self):
        self.wire["nodes"][0].update(x=55, y=99, question="private question", cards=["card body"])
        m = self.build()
        text = stable(m)
        for forbidden in ('"x":', '"y":', "private question", "card body", "deckReady", '"idx":', '"choiceLabel":'):
            self.assertNotIn(forbidden, text)
        self.assertGreater(m["coverage"]["seats"]["positions/bottom"], 0)
        self.assertGreater(m["coverage"]["seats"]["submissions/defender"], 0)

    def test_zero_mass_is_unavailable_but_scalar_raw_weights_are_not_rewritten(self):
        self.wire["nodes"][2]["cal"]["outcomes"][0][1] = 800
        m = self.build()
        self.assertEqual(node(m, "Transitions/Bottom-Sweep")["cal"]["outcomes"][0]["probability"], 800)
        self.assertEqual(m["coverage"]["status"], "COMPLETE")
        self.wire["nodes"][2]["cal"]["outcomes"][0][1] = 0
        self.assertEqual(self.build()["coverage"]["status"], "UNAVAILABLE")

    def test_frame_unknown_null_and_malformed_verdicts_remain_visible(self):
        self.wire["nodes"][2]["cal"]["avail"] = {"gi": None}
        m = self.build()
        self.assertTrue(node(m, "Transitions/Bottom-Sweep")["allowed"])
        self.assertIn("Transitions/Bottom-Sweep", m["coverage"]["rulesetMask"]["nullNodeIds"])
        m = self.build(ruleset="nogi")
        self.assertIn("Transitions/Bottom-Sweep", m["coverage"]["rulesetMask"]["unknownNodeIds"])
        self.wire["nodes"][2]["cal"]["avail"] = {"gi": "false"}
        self.assertEqual(self.build()["coverage"]["status"], "UNAVAILABLE")

    def test_js_unsafe_numbers_rejected_and_stable_spelling_matches_identity(self):
        self.wire["nodes"][2]["cal"]["outcomes"][1][1] = 9007199254740993
        self.assertEqual(self.build()["coverage"]["status"], "UNAVAILABLE")
        with self.assertRaisesRegex(ValueError, "unsupported-js-number"):
            stable(9007199254740993)
        self.assertEqual(stable([1.0, -0.0, 1e-7, 1e-6, 1.23456789e-5]), '[1,0,1e-7,0.000001,0.0000123456789]')
        self.assertEqual(stable({"\ue000": 1, "😎": 2}), '{"😎":2,"\ue000":1}')

    def test_allowed_submission_without_legal_defense_is_unavailable(self):
        self.wire["nodes"][0]["cal"]["avail"]["nogi"] = False
        m = self.build(ruleset="nogi")
        self.assertEqual(m["coverage"]["status"], "UNAVAILABLE")
        issues = [i for i in m["coverage"]["issues"] if i["kind"] == "no-legal-submission-defense"]
        self.assertEqual({i["nodeId"] for i in issues}, {"Submissions/Lock", "Submissions/Lock/Defender"})
        self.assertTrue(all(i["role"] == "top" for i in issues))
        self.assertGreater(m["coverage"]["defenseRowsExcludedByFrame"], 0)


class Transport(unittest.TestCase):
    def test_lossless_dag_and_integrity_checked_fragments(self):
        value = produce_metadata(*fixture(), "gi")
        value["unicode"] = "😎é" * 200
        packed = pack(value)
        self.assertEqual(unpack(packed), value)
        with tempfile.TemporaryDirectory() as directory:
            descriptor = write_transport(directory, value, chunk_bytes=400)
            self.assertGreater(len(descriptor["parts"]), 2)
            self.assertLessEqual(descriptor["transfer"]["maxChunkBytes"], 400)
            self.assertEqual(read_transport(directory, descriptor), value)
            before = {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in Path(directory).iterdir()}
            self.assertEqual(write_transport(directory, value, chunk_bytes=400), descriptor)
            self.assertEqual(before, {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in Path(directory).iterdir()})
            path = Path(directory) / descriptor["parts"][0]["file"]
            path.write_bytes(b"corrupt")
            with self.assertRaisesRegex(ValueError, "integrity"):
                read_transport(directory, descriptor)

    def test_bad_references_and_duplicate_json_rejected(self):
        with self.assertRaisesRegex(ValueError, "reference"):
            unpack({"codec": CODEC, "root": 0, "records": [[0]]})
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input.json"
            for text in ('{"a":1,"a":2}', '{"mass":NaN}', '{"mass":9007199254740993}', '{"mass":1e999}'):
                path.write_text(text)
                with self.assertRaises(ValueError):
                    read_json(path)

    def test_cli_determinism_exact_provenance_and_incomplete_exit(self):
        script = Path(__file__).resolve().parents[1] / "scripts/regenerate_mdp_data.py"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "neural/src"
            source.mkdir(parents=True)
            (source / "app.src.jsx").write_text("// fixture only, never corpus support\n")
            (root / "neural/submission-states.json").write_text("{}")
            (root / "scripts").mkdir()
            for filename in ("submission_choices.py", "regenerate_neural_data.py"):
                (root / "scripts" / filename).write_text("# fixture only\n")
            for name, filename in LAW_FILES.items():
                constant = LAW_CONSTANTS[name]
                (source / filename).write_text(f"const {constant} = {LAW_VERSIONS[constant]};\n")
            identity_bytes = b"const NG_MDP_API_VERSION = 2;\n"
            (source / "mdp-identity.src.js").write_bytes(identity_bytes)
            data = root / "source/quartz/static/neural"
            details_dir = data / "submission-details"
            details_dir.mkdir(parents=True)
            wire, details = fixture()
            (data / "graph-data.json").write_text(stable(wire))
            details_file = details_dir / (qhash("Lock") + ".json")
            details_file.write_text(stable(details))
            output = root / "out"
            command = [sys.executable, "-B", str(script), "--source-root", str(root), "--output", str(output)]
            first = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(first.returncode, 0, first.stderr)
            original = {p.name: p.read_bytes() for p in output.iterdir()}
            second = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(second.returncode, 0, second.stderr)
            self.assertEqual(original, {p.name: p.read_bytes() for p in output.iterdir()})
            manifest = json.loads(original["manifest.json"])
            self.assertEqual(manifest["status"], "COMPLETE")
            self.assertTrue(all(len(b) <= 40000 for b in original.values()))
            self.assertEqual(len(manifest["variants"]), 4)
            descriptor = json.loads(original[manifest["variants"][0]["file"]])
            self.assertEqual(read_transport(output, descriptor), produce_metadata(wire, details, "gi", 1))
            self.assertEqual(manifest["provenance"]["lawHashes"]["identity"], hashlib.sha256(identity_bytes).hexdigest())
            self.assertNotIn("certified", manifest["provenance"]["lawHashes"])
            # A solver-only byte change must invalidate model/mechanics identity
            # without changing graph metadata or transport. Its location follows
            # the selected model, not the adapter or the default source root.
            worker_laws = root / "worker-laws"
            worker_laws.mkdir()
            model_path = worker_laws / LAW_FILES["model"]
            model_path.write_bytes((source / LAW_FILES["model"]).read_bytes())
            certified_path = model_path.with_name("mdp-certified.src.js")
            (source / "mdp-certified.src.js").write_bytes(b"// unrelated model sibling\n")
            selected_command = command + ["--model-source", str(model_path)]
            previous = manifest
            for certified_bytes in (b"// certificate law\r\n", b"// certificate law\n"):
                certified_path.write_bytes(certified_bytes)
                certified = subprocess.run(selected_command, capture_output=True, text=True)
                self.assertEqual(certified.returncode, 0, certified.stderr)
                current = json.loads((output / "manifest.json").read_text())
                self.assertEqual(current["provenance"]["lawHashes"], {
                    **manifest["provenance"]["lawHashes"], "certified": hashlib.sha256(certified_bytes).hexdigest()})
                for key in ("modelHash", "sourceHash"):
                    self.assertNotEqual(current["provenance"][key], previous["provenance"][key])
                self.assertEqual(current["provenance"]["graphHash"], manifest["provenance"]["graphHash"])
                for variant, prior in zip(current["variants"], previous["variants"]):
                    self.assertNotEqual(variant["mechanicsHash"], prior["mechanicsHash"])
                current_descriptor = json.loads((output / current["variants"][0]["file"]).read_bytes())
                for key in ("decoded", "transfer", "parts"):
                    self.assertEqual(current_descriptor[key], descriptor[key])
                self.assertEqual(read_transport(output, current_descriptor), produce_metadata(wire, details, "gi", 1))
                previous = current
            certified_path.unlink()
            removed = subprocess.run(selected_command, capture_output=True, text=True)
            self.assertEqual(removed.returncode, 0, removed.stderr)
            self.assertEqual((output / "manifest.json").read_bytes(), original["manifest.json"])
            (source / "mdp-certified.src.js").unlink()
            # Exact original bytes, not a reserialized stand-in, bind graphHash.
            (data / "graph-data.json").write_text(json.dumps(wire, indent=2))
            changed = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(changed.returncode, 0, changed.stderr)
            new = json.loads((output / "manifest.json").read_text())
            self.assertNotEqual(new["provenance"]["graphHash"], manifest["provenance"]["graphHash"])
            self.assertNotEqual(new["variants"][0]["mechanicsHash"], manifest["variants"][0]["mechanicsHash"])
            self.assertEqual(new["provenance"]["modelHash"], manifest["provenance"]["modelHash"])
            for name, body in original.items():
                if name != "manifest.json":
                    self.assertEqual((output / name).read_bytes(), body, "previous immutable version retained")
            details_file.unlink()
            bad = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(bad.returncode, 1, bad.stderr)
            self.assertEqual(json.loads((output / "manifest.json").read_text())["status"], "UNAVAILABLE")
            (source / LAW_FILES["adapter"]).write_text("const NG_MDP_ADAPTER_VERSION=999;")
            invalid = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(invalid.returncode, 2)
            self.assertIn("unsupported-law-version", invalid.stderr)
            (source / LAW_FILES["adapter"]).write_text("const NG_MDP_ADAPTER_VERSION=1;")
            (root / "neural/submission-states.json").unlink()
            missing = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(missing.returncode, 2)
            self.assertIn("submission-states.json", missing.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
