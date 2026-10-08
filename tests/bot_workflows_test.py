"""Derive the producer/action inventory from every workflow, then check its gates."""
from pathlib import Path
import os
import re
import subprocess
import tempfile
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[1]


class WorkflowTests(unittest.TestCase):
    def test_all_producers_guard_the_entire_job_and_target_dev(self):
        producers = 0
        for path in (ROOT / ".github/workflows").glob("*.y*ml"):
            workflow = yaml.safe_load(path.read_text())
            for job in workflow["jobs"].values():
                steps = job.get("steps", [])
                creates = [s for s in steps if "gh pr create" in s.get("run", "")]
                if not creates:
                    continue
                producers += 1
                with self.subTest(workflow=path.name):
                    self.assertNotIn("BOT_QUEUE_STATE", job.get("env", {}))
                    self.assertEqual(steps[0]["name"], "Set bot queue state path")
                    with tempfile.TemporaryDirectory(prefix="fixbots-env-") as temp:
                        output = Path(temp) / "github-env"
                        subprocess.run(["bash", "-e", "-c", steps[0]["run"]], check=True,
                                       env={**os.environ, "RUNNER_TEMP": temp, "GITHUB_ENV": str(output)})
                        self.assertEqual(output.read_text(), f"BOT_QUEUE_STATE={temp}/bot-queue.json\n")
                    self.assertEqual(steps[1]["with"]["ref"], "dev")
                    guard = next(i for i,s in enumerate(steps) if s.get("id") == "queue")
                    self.assertIn("scripts/bot_queue.py --bot", steps[guard]["run"])
                    for step in steps[2:guard]:
                        self.assertIn(step["name"], ["Setup Python", "Setup Node", "Install Python dependencies"])
                    concurrency = job.get("concurrency", workflow.get("concurrency"))
                    self.assertEqual(concurrency["group"], "bot-proposals")
                    self.assertFalse(concurrency["cancel-in-progress"])
                    for step in steps[guard + 1:]:
                        self.assertIn("steps.queue.outputs.proceed == 'true'", step["if"])
                    for step in creates:
                        self.assertIn("--base dev", step["run"])
                        self.assertIn("bot_queue.py --check-changes", step["run"])
        self.assertEqual(producers, 5)
        print(f"Checked {producers} PR producers, including every post-guard step")

    def test_all_model_inputs_and_execution_gates(self):
        parsed = actions = 0
        for path in (ROOT / ".github/workflows").glob("*.y*ml"):
            parsed += 1
            workflow = yaml.safe_load(path.read_text())
            for job in workflow["jobs"].values():
                steps = job.get("steps", [])
                for i, step in enumerate(steps):
                    for key, value in step.get("with", {}).items():
                        self.assertNotIn("$(", str(value), f"{path.name}: {step.get('name')} {key}")
                    args = step.get("with", {}).get("claude_args", "")
                    if "steps.model.outputs.model" in args:
                        actions += 1
                        self.assertIn("GITHUB_OUTPUT", next(s["run"] for s in steps[:i] if s.get("id") == "model"))
                        following = steps[i + 1]
                        self.assertIn("check-execution", following["run"])
                        self.assertIn(f"steps.{step['id']}.outputs.execution_file", following["env"]["EXECUTION_FILE"])
                        self.assertFalse(following.get("continue-on-error", False))
        self.assertEqual(actions, 4)
        self.assertGreaterEqual(parsed, 16)
        print(f"Parsed {parsed} workflows; checked {actions} model/output contracts")

    def test_final_graph_gate_is_not_suppressed(self):
        workflow = yaml.safe_load((ROOT / ".github/workflows/validation-fixer.yml").read_text())
        steps = workflow["jobs"]["fix"]["steps"]
        final_gate = next(i for i,s in enumerate(steps) if s["name"] == "Whole-graph gate after all edits")
        pr = next(i for i,s in enumerate(steps) if "gh pr create" in s.get("run", ""))
        self.assertLess(final_gate, pr)
        self.assertNotIn("||", steps[final_gate]["run"])
        self.assertFalse(steps[final_gate].get("continue-on-error", False))

    def test_report_failure_reaches_repair_but_final_failure_blocks_pr(self):
        workflow = yaml.safe_load((ROOT / ".github/workflows/validation-fixer.yml").read_text())
        steps = workflow["jobs"]["fix"]["steps"]
        repair = next(s for s in steps if s.get("id") == "claudepass")
        final = next(s for s in steps if s["name"] == "Whole-graph gate after all edits")
        self.assertLess(steps.index(repair), steps.index(final))
        with tempfile.TemporaryDirectory(prefix="fixbots-wiring-") as temp:
            root = Path(temp)
            (root / "scripts").mkdir()
            (root / "tests/artifacts").mkdir(parents=True)
            (root / "content").mkdir()
            (root / "content/Broken File.json").write_text('{}')
            (root / "scripts/bot_queue.py").write_text('def filter_candidates(files): return files\n')
            (root / "scripts/validate_graph_integrity.py").write_text(
                'from pathlib import Path\n'
                'Path("tests/artifacts/audit_report.json").write_text(\'{"issues": ['
                '{"severity": "error", "file": "content/Broken File.json"}]}\')\n'
                'raise SystemExit(1)\n')
            (root / "scripts/regenerate_content_json.py").write_text(
                'from pathlib import Path\nPath("repair-reached").touch()\n')
            command = repair["run"].replace('/tmp/errfiles.txt', str(root / 'errfiles.txt'))
            result = subprocess.run(['bash', '-eo', 'pipefail', '-c', command], cwd=root,
                                    env={**os.environ, 'MAX_CLAUDE_FILES': '1'}, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue((root / 'repair-reached').exists())
            result = subprocess.run(['bash', '-eo', 'pipefail', '-c', final['run'] + '\ntouch pr-reached'],
                                    cwd=root, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((root / 'pr-reached').exists())
        print('Report exit 1 reached repair; final exit 1 blocked PR publication')

    def test_votes_known_batch_matches_the_workflow_staging_scope(self):
        import sys
        sys.path.insert(0, str(ROOT / "scripts"))
        from bot_queue import KNOWN_BATCHES
        workflow = yaml.safe_load((ROOT / ".github/workflows/votes-refresh.yml").read_text())
        creates = next(s['run'] for s in workflow['jobs']['votes']['steps'] if 'gh pr create' in s.get('run', ''))
        staged = re.findall(r'^git add (.+)$', creates, re.M)
        self.assertEqual(len(staged), 1)
        self.assertEqual(set(staged[0].split()), set(KNOWN_BATCHES['votes-refresh']))

    def test_changed_workflow_shell_blocks_parse(self):
        count = 0
        for name in ["content-improvement-bot", "analytics-content-improvement", "validation-fixer",
                     "proofread-bot", "votes-refresh", "seo-monitor"]:
            workflow = yaml.safe_load((ROOT / f".github/workflows/{name}.yml").read_text())
            for job in workflow["jobs"].values():
                for step in job.get("steps", []):
                    if "run" not in step:
                        continue
                    # Actions resolves expressions before invoking the shell.
                    command = re.sub(r"\$\{\{.*?\}\}", "test-value", step["run"])
                    result = subprocess.run(["bash", "-n"], input=command, text=True, capture_output=True)
                    self.assertEqual(result.returncode, 0, f"{name}: {step['name']}: {result.stderr}")
                    count += 1
        self.assertGreater(count, 40)
        print(f"Parsed {count} changed-workflow shell blocks")


if __name__ == "__main__":
    unittest.main(verbosity=2)
