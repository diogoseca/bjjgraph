"""Derive the producer/action inventory from every workflow, then check its gates."""
from pathlib import Path
import re
import subprocess
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
                    self.assertEqual(steps[0]["with"]["ref"], "dev")
                    guard = next(i for i,s in enumerate(steps) if s.get("id") == "queue")
                    self.assertIn("scripts/bot_queue.py --bot", steps[guard]["run"])
                    for step in steps[1:guard]:
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

    def test_deterministic_and_final_graph_gates_are_not_suppressed(self):
        workflow = yaml.safe_load((ROOT / ".github/workflows/validation-fixer.yml").read_text())
        steps = workflow["jobs"]["fix"]["steps"]
        final_gate = next(i for i,s in enumerate(steps) if s["name"] == "Whole-graph gate after all edits")
        pr = next(i for i,s in enumerate(steps) if "gh pr create" in s.get("run", ""))
        self.assertLess(final_gate, pr)
        self.assertNotIn("||", steps[final_gate]["run"])
        self.assertFalse(steps[final_gate].get("continue-on-error", False))
        script = (ROOT / "scripts/fix_from_position.py").read_text()
        self.assertIn('with_name("validate_graph_integrity.py")', script)
        self.assertIn('check=True', script)

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
