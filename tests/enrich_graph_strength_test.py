"""The strength join must resolve punctuation and refuse an incomplete layout.

Run with python3 -B -S: ci-validate has no numpy, and this gate needs only stdlib.
The Node wrapper includes it in both test:units and CI's tests/*.test.mjs glob.
"""

import contextlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import enrich_graph_strength as strength


class LayoutStrengthTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.layout = Path(self.tmp.name) / "layout.json"
        self.graph = Path(self.tmp.name) / "graph.json"
        self.output = io.StringIO()
        self.enterContext(patch.object(strength, "LAYOUT_JSON", str(self.layout)))
        self.enterContext(contextlib.redirect_stdout(self.output))

    def write_nodes(self, ids):
        # Include a stale pair: failure must not silently retain it or overwrite the file.
        self.layout.write_text(json.dumps({"nodes": [
            {"id": node_id, "x": i, "s": [0.9, -0.9]} for i, node_id in enumerate(ids)
        ]}))

    def test_apostrophes_and_percent_resolve_to_graph_pairs(self):
        self.write_nodes([
            "Transitions/Fireman's-Carry",
            "Transitions/Counter-Entry-to-Opponent's-Leg",
            "Transitions/100%-Sweep",
        ])
        pairs = [[-0.099, 0.099], [-0.158, 0.158], [0.016, -0.016]]
        lookup = {"transitions": dict(zip([
            "firemans-carry", "counter-entry-to-opponents-leg", "100-percent-sweep",
        ], pairs))}
        self.assertEqual(strength.enrich_layout(lookup), (3, 3))
        nodes = json.loads(self.layout.read_text())["nodes"]
        self.assertEqual([n["s"] for n in nodes], pairs)
        self.assertEqual([n["x"] for n in nodes], [0, 1, 2])
        self.assertIn("3/3 nodes carry strength", self.output.getvalue())
        first = self.layout.read_bytes()
        strength.enrich_layout(lookup)
        self.assertEqual(self.layout.read_bytes(), first)

    def test_candidate_precedence_and_cross_section_fallback_stay_intact(self):
        self.write_nodes([
            "Positions/Parent/Leaf", "Positions/Other/Leaf", "Positions/Parent/Unknown",
            "Submissions/Kimura/from-Mount", "Transitions/Misfiled-Submission",
        ])
        lookup = {
            "positions": {"parent-leaf": [1, 2], "leaf": [3, 4], "parent": [5, 6]},
            "transitions": {"parent-leaf": [7, 8]},
            "submissions": {"kimura-from-mount": [9, 10], "misfiled-submission": [11, 12]},
        }
        self.assertEqual(strength.enrich_layout(lookup), (5, 5))
        self.assertEqual([n["s"] for n in json.loads(self.layout.read_text())["nodes"]],
                         [[1, 2], [3, 4], [5, 6], [9, 10], [11, 12]])

    def test_every_unknown_id_is_named_and_failed_layout_is_not_written(self):
        unknown = [f"Transitions/Unknown-{i}" for i in range(14)] + ["Other/Unknown"]
        self.write_nodes(["Positions/Mount", *unknown])
        before = self.layout.read_bytes()
        with self.assertRaises(ValueError) as failure:
            strength.enrich_layout({"positions": {"mount": [0.6, -0.4]}})
        for node_id in unknown:
            self.assertIn(node_id, str(failure.exception))
        self.assertIn("1/16 nodes carry strength", self.output.getvalue())
        self.assertEqual(self.layout.read_bytes(), before)

    def test_empty_and_missing_layout_cannot_pass_as_zero_issues(self):
        self.write_nodes([])
        with self.assertRaisesRegex(ValueError, "matched zero nodes"):
            strength.enrich_layout({})
        self.assertIn("0/0 nodes carry strength", self.output.getvalue())
        self.layout.unlink()
        with self.assertRaises(FileNotFoundError):
            strength.enrich_layout({})

    def test_exemption_must_be_explicit_and_print_its_reason(self):
        self.write_nodes(["Positions/Mount", "Other/Legend"])
        reason = "Fixture legend is a decoration, not scored content."
        with patch.object(strength, "LAYOUT_STRENGTH_EXEMPTIONS", {"Other/Legend": reason}):
            self.assertEqual(strength.enrich_layout({"positions": {"mount": [0.6, -0.4]}}), (1, 2))
        self.assertIn(f"exempt: Other/Legend: {reason}", self.output.getvalue())
        self.assertNotIn("s", json.loads(self.layout.read_text())["nodes"][1])
        with patch.object(strength, "LAYOUT_STRENGTH_EXEMPTIONS", {"Other/Legend": ""}):
            with self.assertRaisesRegex(ValueError, "needs a reason"):
                strength.enrich_layout({"positions": {"mount": [0.6, -0.4]}})

    def test_main_exits_nonzero_so_npm_regeneration_stops_on_a_miss(self):
        self.write_nodes(["Transitions/Unknown-Technique"])
        self.graph.write_text('{}')
        # Execute the real main()/SystemExit path against private fixture paths.
        code = (
            "import sys; sys.path.insert(0, sys.argv[1]); import enrich_graph_strength as s; "
            "s.GRAPH_JSON=sys.argv[2]; s.LAYOUT_JSON=sys.argv[3]; s._REPO_ROOT=sys.argv[4]; "
            "raise SystemExit(s.main())"
        )
        result = subprocess.run([
            sys.executable, "-B", "-S", "-c", code, str(ROOT / "scripts"),
            str(self.graph), str(self.layout), self.tmp.name,
        ], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("0/1 nodes carry strength", result.stdout)
        self.assertIn("Transitions/Unknown-Technique", result.stderr)
        scripts = json.loads((ROOT / "package.json").read_text())["scripts"]
        self.assertEqual(scripts["regenerate:graph-strength"], "python3 scripts/enrich_graph_strength.py")
        self.assertIn("&& npm run regenerate:graph-strength", scripts["regenerate:graph"])
        self.assertIn("&& npm run regenerate:graph &&", scripts["regenerate"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
