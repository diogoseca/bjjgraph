"""Derive the producer/action inventory from every workflow, then check its gates."""
from pathlib import Path
import json
import os
import re
import shlex
import subprocess
import tempfile
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[1]


class WorkflowTests(unittest.TestCase):
    def test_clips_corpus_auth_stops_categories_and_skips_report(self):
        # Run the real shell in a disposable tree; the child stub records every
        # invocation. Removing its exit-2 handler must turn this test red.
        with tempfile.TemporaryDirectory(prefix="fixbots-clips-corpus-") as temp:
            root = Path(temp)
            (root / "scripts").mkdir()
            script = root / "scripts/run_clips_corpus.sh"
            script.write_text((ROOT / "scripts/run_clips_corpus.sh").read_text())
            python = root / "python3"
            python.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$CALL_LOG"\nexit "$STUB_EXIT"\n')
            python.chmod(0o755)
            calls = root / "calls"
            for status in (0, 1, 2, 3, 127, 130):
                with self.subTest(status=status):
                    calls.write_text("")
                    log = root / "clips_sourcing/run.log"
                    if log.exists():
                        log.unlink()
                    result = subprocess.run(["bash", str(script)], capture_output=True, text=True,
                                            env={**os.environ, "PATH": temp + ":" + os.environ["PATH"],
                                                 "STUB_EXIT": str(status), "CALL_LOG": str(calls)})
                    self.assertEqual(result.returncode, 2 if status == 2 else 0, result.stderr)
                    expected = [f"scripts/source_clips.py --stage all --category {category}"
                                for category in ("Positions", "Submissions", "Transitions", "Principles")]
                    expected = expected[:1] if status == 2 else expected + ["scripts/source_clips.py --stage report"]
                    self.assertEqual(calls.read_text().splitlines(), expected)
                    self.assertEqual("CORPUS RUN COMPLETE" in log.read_text(), status != 2)
        print("Checked clip corpus exits 0, 1, 2, 3, 127, 130; auth stopped after one category")

    def test_every_claude_action_job_has_oidc_permission(self):
        actions = 0
        for path in (ROOT / ".github/workflows").glob("*.y*ml"):
            workflow = yaml.safe_load(path.read_text())
            for name, job in workflow["jobs"].items():
                for step in job.get("steps", []):
                    if not step.get("uses", "").startswith("anthropics/claude-code-action@"):
                        continue
                    actions += 1
                    with self.subTest(workflow=path.name, job=name):
                        permissions = job.get("permissions", workflow.get("permissions", {}))
                        self.assertEqual(permissions.get("id-token"), "write")
        # 6 -> 5 at v1.265.1: the content bot's PAA step went (its tool never existed on npm).
        self.assertEqual(actions, 5)
        print(f"Checked OIDC permission on all {actions} Claude action invocations")

    def test_proofread_auth_failure_blocks_following_steps_but_partial_failure_does_not(self):
        workflow = yaml.safe_load((ROOT / ".github/workflows/proofread-bot.yml").read_text())
        audit = next(step for job in workflow["jobs"].values() for step in job["steps"]
                     if step.get("id") == "audit")
        self.assertFalse(audit.get("continue-on-error", False))
        command = re.sub(r"\$\{\{.*?\}\}", "test-value", audit["run"])
        with tempfile.TemporaryDirectory(prefix="fixbots-auth-workflow-") as temp:
            python = Path(temp) / "python3"
            python.write_text('#!/bin/sh\nexit "$STUB_EXIT"\n')
            python.chmod(0o755)
            for status in (0, 1, 2):
                with self.subTest(status=status):
                    result = subprocess.run(["bash", "-eo", "pipefail", "-c", command + '\necho NEXT-STEP'],
                                            capture_output=True, text=True,
                                            env={**os.environ, "PATH": temp + ":" + os.environ["PATH"],
                                                 "STUB_EXIT": str(status)})
                    self.assertEqual(result.returncode, 2 if status == 2 else 0, result.stderr)
                    self.assertEqual("NEXT-STEP" in result.stdout, status != 2)

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
        # 4 -> 3 at v1.265.1: the content bot's PAA step went (its tool never existed on npm).
        self.assertEqual(actions, 3)
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

    # SUPPLY CHAIN (v1.265.1). Mutants, each applied alone, killed at the named case:
    #   `curl -fsSL https://claude.ai/install.sh | bash` back in validation-fixer.yml -> test_claude_cli_is_the_pinned_build
    #   the CLI pin loosened to ^2.1.311, or moved without its lockfile            -> test_claude_cli_is_the_pinned_build
    #   the install without --ignore-scripts, or a third workflow installing it    -> test_claude_cli_is_the_pinned_build
    #   `npx -y @modelcontextprotocol/server-dataforseo` back in seo-monitor.yml    -> test_no_workflow_runs_a_package_outside_a_lockfile
    #   supabase-keepalive.yml without its permissions block                       -> test_every_workflow_declares_permissions
    CLI_DIR = ".github/tools/claude-cli"
    CLI_INSTALL = (
        "npm ci --ignore-scripts --no-audit --no-fund --prefix .github/tools/claude-cli\n"
        'echo "$GITHUB_WORKSPACE/.github/tools/claude-cli/node_modules/@anthropic-ai/claude-code-linux-x64" >> "$GITHUB_PATH"\n'
        'echo "DISABLE_AUTOUPDATER=1" >> "$GITHUB_ENV"\n'
        ".github/tools/claude-cli/node_modules/@anthropic-ai/claude-code-linux-x64/claude --version\n"
    )

    @staticmethod
    def _strings(node):
        if isinstance(node, str):
            yield node
        elif isinstance(node, dict):
            for key, value in node.items():
                yield from WorkflowTests._strings(key)
                yield from WorkflowTests._strings(value)
        elif isinstance(node, list):
            for value in node:
                yield from WorkflowTests._strings(value)

    def _workflows(self):
        paths = sorted((ROOT / ".github/workflows").glob("*.y*ml"))
        self.assertGreaterEqual(len(paths), 16)
        return [(path.name, yaml.safe_load(path.read_text())) for path in paths]

    def test_claude_cli_is_the_pinned_build(self):
        # The raw CLI comes from one exact build whose sha512 the committed lockfile holds, installed with no script.
        pkg = json.loads((ROOT / self.CLI_DIR / "package.json").read_text())
        lock = json.loads((ROOT / self.CLI_DIR / "package-lock.json").read_text())
        (name, version), = pkg["dependencies"].items()
        self.assertEqual(name, "@anthropic-ai/claude-code-linux-x64")
        self.assertRegex(version, r"^\d+\.\d+\.\d+$", "an exact version, never a range")
        self.assertEqual(set(lock["packages"]), {"", f"node_modules/{name}"}, "the native build has no dependencies")
        self.assertEqual(lock["packages"][""]["dependencies"], pkg["dependencies"], "the lockfile was made from this pin")
        entry = lock["packages"][f"node_modules/{name}"]
        self.assertEqual(entry["version"], version)
        self.assertTrue(entry["resolved"].startswith(f"https://registry.npmjs.org/{name}/-/"), entry["resolved"])
        self.assertRegex(entry["integrity"], r"^sha512-[A-Za-z0-9+/]{86}==$")
        self.assertNotIn("hasInstallScript", entry)
        installers = []
        for workflow_name, workflow in self._workflows():
            for job in workflow["jobs"].values():
                for step in job.get("steps", []):
                    run = step.get("run", "")
                    for line in run.splitlines():
                        self.assertNotRegex(line, r"\b(curl|wget)\b[^#]*\|\s*(sudo\s+)?(ba|z|da)?sh\b",
                                            f"{workflow_name}: a download piped into a shell runs whatever it serves today")
                    if step.get("name") == "Install Claude CLI" or self.CLI_DIR in run:
                        installers.append(workflow_name)
                        self.assertEqual(run, self.CLI_INSTALL, f"{workflow_name}: the pinned install, exactly")
        self.assertEqual(sorted(installers), ["proofread-bot.yml", "validation-fixer.yml"])
        print(f"Checked the CLI pin {name}@{version} (sha512 in the lockfile) and its {len(installers)} installers")

    def test_no_workflow_runs_a_package_outside_a_lockfile(self):
        _PackageRuns(self).check()

    # THE MODEL BOTS' TOOLS ARE THEIR JOBS (v1.265.3). Every claude-code-action step has a row here, and its
    # --allowedTools / --disallowedTools are exactly that row. The three agent-mode bots that edit or write hold: reads
    # outside the tree only of the folder their prefetch writes, edits only under paths their commit stages, no Write
    # where they only edit, no Bash at all (validation and dates come from the steps around them), and `.git` denied,
    # since the action writes its own token into .git/config's remote while it runs. A job whose later step sets its own
    # authenticated remote checks out with persist-credentials: false. Mutants, each applied alone, killed here:
    #   analytics: bare `Edit` back; `Bash(cat:*)` back; `Bash(python3 scripts/validate_json.py:*)` back; bare `Read`
    #     back; `Bash` dropped from the deny list; `Read(.git/**)` dropped; `Write` dropped; the old "run the validator"
    #     prompt step back.
    #   seo-monitor: bare `Write` back; `Bash(mkdir:*)` back; `Edit(scripts/**)` added; `Read(//tmp/**)` widened.
    #   content bot: bare `Edit` back; `Bash(date:*)` back; `Edit(.github/**)` added.
    #   any bot: persist-credentials: false removed (votes-refresh); a sixth Claude action step with no row.
    GRANTS = {
        ("analytics-content-improvement.yml", "improve_content"): (
            {"Read(//tmp/analytics/**)", "Edit(content/**/*.json)", "Glob", "Grep"}, {"Bash", "Write", "Read(.git/**)"}),
        ("seo-monitor.yml", "seo_report"): (
            {"Read(//tmp/seo/**)", "Edit(tests/artifacts/seo_trends.md)"}, {"Bash", "Read(.git/**)"}),
        ("content-improvement-bot.yml", "improve_content"): (
            {"Read(//tmp/preprocessing/**)", "Edit(content/**)", "Edit(tests/artifacts/suggested_new_files.csv)"},
            {"Bash", "Write", "Read(.git/**)"}),
        # read-only bots: the action's own mode decides the rest (tag mode adds its own tools); pinned as reviewed
        ("claude.yml", "claude"): (
            {"Read", "Grep", "Glob", "Bash(gh pr view:*)", "Bash(gh pr diff:*)", "Bash(gh pr list:*)", "Bash(gh pr comment:*)",
             "Bash(gh issue view:*)", "Bash(gh issue list:*)", "Bash(gh issue comment:*)", "Bash(gh search:*)"}, set()),
        ("claude-code-review.yml", "claude-review"): (
            {"Bash(gh issue view:*)", "Bash(gh search:*)", "Bash(gh issue list:*)", "Bash(gh pr comment:*)",
             "Bash(gh pr diff:*)", "Bash(gh pr view:*)", "Bash(gh pr list:*)"}, set()),
    }

    @staticmethod
    def _tool_flags(claude_args):
        import shlex
        text = "\n".join(line for line in claude_args.splitlines() if not line.strip().startswith("#"))
        text = re.sub(r"\$\{\{.*?\}\}", "expr", text)
        words, flags, current = shlex.split(text), {"allow": [], "deny": []}, None
        for word in words:
            if word.startswith("--"):
                current = {"--allowedTools": "allow", "--allowed-tools": "allow",
                           "--disallowedTools": "deny", "--disallowed-tools": "deny"}.get(word)
                continue
            if current:
                flags[current] += [t.strip() for t in word.split(",") if t.strip()]
        return set(flags["allow"]), set(flags["deny"])

    def test_model_bots_hold_only_their_jobs_tools(self):
        seen = set()
        for workflow_name, workflow in self._workflows():
            for job in workflow["jobs"].values():
                steps = job.get("steps", [])
                for i, step in enumerate(steps):
                    if not str(step.get("uses", "")).startswith("anthropics/claude-code-action@"):
                        continue
                    key = (workflow_name, step.get("id"))
                    self.assertIn(key, self.GRANTS, f"{key}: a Claude action step with no reviewed grant")
                    seen.add(key)
                    allow, deny = self._tool_flags(step.get("with", {}).get("claude_args", ""))
                    want_allow, want_deny = self.GRANTS[key]
                    self.assertEqual(allow, want_allow, f"{key}: --allowedTools")
                    self.assertEqual(deny, want_deny, f"{key}: --disallowedTools")
                    edits = [t for t in allow if t.startswith(("Edit", "Write", "MultiEdit", "NotebookEdit"))]
                    if not edits:
                        continue
                    # an editing bot: path-scoped edits inside what its commit stages, scoped outside reads, no shell
                    for tool in allow:
                        self.assertNotIn(tool, {"Read", "Edit", "Write", "MultiEdit", "NotebookEdit"}, f"{key}: {tool} is not scoped")
                        self.assertFalse(tool.startswith("Bash"), f"{key}: {tool}: no shell for an editing bot")
                    self.assertTrue({"Bash", "Read(.git/**)"} <= deny, f"{key}: Bash and .git denied")
                    later = "\n".join(s.get("run", "") for s in steps[i + 1:])
                    staged = re.findall(r"^\s*(?:git add|cp \S+) (.+)$", later, re.M)
                    for tool in edits:
                        path = re.fullmatch(r"Edit\(([^)]+)\)", tool).group(1)
                        self.assertTrue(any(path.startswith(t.rstrip("/").split()[0].rstrip("/")) or t.strip().endswith(path)
                                            for line in staged for t in line.split()),
                                        f"{key}: {path} is not a path a later step stages")
                    for tool in allow:
                        m = re.fullmatch(r"Read\(//(tmp/[a-z]+)/\*\*\)", tool)
                        if tool.startswith("Read("):
                            self.assertIsNotNone(m, f"{key}: {tool}: an outside read is one prefetch folder")
                            self.assertIn(f"/{m.group(1)}/", "\n".join(s.get("run", "") for s in steps[:i]),
                                          f"{key}: {tool}: no earlier step writes that folder")
                    prompt = step["with"].get("prompt", "")
                    self.assertNotIn("```bash", prompt, f"{key}: the prompt asks a shell-less agent to run a command")
                    self.assertNotRegex(prompt, r"\(run `", f"{key}: the prompt asks a shell-less agent to run a command")
        self.assertEqual(seen, set(self.GRANTS), "every reviewed row is a real step")
        remotes = 0
        for workflow_name, workflow in self._workflows():
            for name, job in workflow["jobs"].items():
                steps = job.get("steps", [])
                if not any("git remote set-url origin https://x-access-token:" in s.get("run", "") for s in steps):
                    continue
                remotes += 1
                checkout = next(s for s in steps if str(s.get("uses", "")).startswith("actions/checkout@"))
                self.assertIs(checkout.get("with", {}).get("persist-credentials"), False,
                              f"{workflow_name} {name}: a later step sets its own remote, so the checkout keeps no token")
        self.assertEqual(remotes, 6)
        print(f"Checked {len(seen)} Claude action grants and {remotes} checkouts that keep no token")

    def test_secrets_reach_shells_only_through_env(self):
        # A `${{ secrets.X }}` inside a run block is pasted into the script's text before the shell parses it, so a value
        # holding a quote or `$(` becomes shell. Secrets reach a run step only through its env: mapping (v1.265.3).
        # Mutant: supabase-keepalive.yml's URL back in its script text -> red.
        runs = 0
        for workflow_name, workflow in self._workflows():
            for job in workflow["jobs"].values():
                for step in job.get("steps", []):
                    if "run" not in step:
                        continue
                    runs += 1
                    self.assertNotRegex(step["run"], r"\$\{\{[^}]*\bsecrets\.", f"{workflow_name}: {step.get('name')}")
        self.assertGreater(runs, 150)
        print(f"Checked {runs} run blocks take secrets only through env")

    def test_every_workflow_declares_permissions(self):
        declared = 0
        for workflow_name, workflow in self._workflows():
            jobs = workflow["jobs"].values()
            with self.subTest(workflow=workflow_name):
                self.assertTrue("permissions" in workflow or all("permissions" in job for job in jobs),
                                "every workflow declares the token scope it needs, instead of inheriting the repository's default")
                declared += 1
        print(f"Checked {declared} workflows declare their permissions")

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


# NO WORKFLOW RUNS A PACKAGE THAT IS NOT INSTALLED FROM A COMMITTED LOCKFILE (v1.265.3). What it reads: every `run:`
# block of every workflow (heredoc bodies and comments aside; `$(...)` and backticks read as commands of their own;
# `bash -c` strings and the root/source npm scripts a step runs, with their pre/post hooks, read the same way), and
# every `uses:` step. What each simple command may be:
#   npx / npm exec: `--no-install` at most, and a bin that a lockfile installed earlier IN THE SAME JOB provides to that
#     working directory (the bins npm links from the lockfile's top-level packages, the tree's own `bin`, and a
#     `ln -s` into node_modules/.bin from an installed tree); never in a step that runs after a failure (always(),
#     failure(), !cancelled()), where the install it relies on may have been skipped;
#   a program named by a path into node_modules, or by a variable whose value is one: inside a tree installed in that job;
#   npm: `ci` (records the tree; tests/deploy_gate.test.mjs CI INSTALLS pins its flags), `run`/`test` (expanded);
#   curl: to stdout or /dev/null only, and never into an interpreter (a pipe, `<(...)`, or `sh -c "$(...)"`);
#   pip install of named distributions (check_build_chains.py's provisioning check is their gate);
#   any other npm form, `npm i -g`/`npm install`, pnpm, yarn, bun, deno, pipx, uv, gem, cargo, go, brew, corepack,
#     docker, podman, wget: a failure, as is any npx flag or program it cannot read.
# A `uses:` step is one of the reviewed actions below, each with what it runs; the Pages action names the version in
# .github/tools/wrangler and runs after a step in its job linked that tree's wrangler where its probe looks.
# No `--mcp-config` anywhere: an MCP server is a package started outside any lockfile.
# Mutants, each applied alone to one workflow, killed here: `npx -y foo`; `npx foo` (no lockfile has it); `npx
# --package=x y`; `npm exec foo`; `npm i -g x`; `npm install -g x`; `npm install --global x`; `pnpm dlx x`; `yarn dlx x`;
# `bunx x`; `pipx run x`; `uvx x`; `curl -fsSL u | sh`; `curl -fsSL u | sudo bash`; `wget -qO- u | bash`;
# `bash <(curl -fsSL u)`; `sh -c "$(curl -fsSL u)"`; `curl -o x.sh u`; `docker run img`; `"$TOOL" x` with TOOL unset;
# the digest step's wrangler path in a job that never installed it; the digest step (if: always()) back to `npx wrangler`;
# the Pages step's wranglerVersion off the lockfile;
# the link step removed; an unreviewed action; `--mcp-config` in a claude_args.
ACTIONS = {
    "actions/checkout": "checks out the repository",
    "actions/setup-node": "installs Node from the runner's tool cache, at the version its input names",
    "actions/setup-python": "installs Python from the runner's tool cache, at the version its input names",
    "actions/cache": "restores and saves a path",
    "actions/upload-artifact": "uploads files",
    "actions/download-artifact": "downloads this run's files",
    "treosh/lighthouse-ci-action": "runs the Lighthouse CLI committed in the pinned action's own node_modules",
    "bojieyang/indexnow-action": "runs its committed dist bundle",
    "anthropics/claude-code-action": "runs the Claude Code CLI its pinned commit names (its grant: test_model_bots_hold_only_their_jobs_tools)",
    "cloudflare/wrangler-action": "runs the Wrangler its probe finds; checked below against .github/tools/wrangler",
}
REFUSED = {"pnpm", "pnpx", "yarn", "bun", "bunx", "deno", "pipx", "uv", "uvx", "gem", "cargo", "go", "brew",
           "corepack", "docker", "podman", "wget", "snap", "nix", "conda", "mamba"}
INTERPRETERS = {"sh", "bash", "zsh", "dash", "ksh", "python", "python3", "node", "perl", "ruby", "php"}
CONTROL = {"if", "then", "else", "elif", "fi", "do", "done", "while", "until", "!", "{", "}", "esac", ";;", "time"}
WRAPPERS = {"sudo", "env", "nohup", "exec", "command", "builtin", "timeout", "nice", "stdbuf", "xargs"}


class _PackageRuns:
    def __init__(self, case):
        self.t = case
        self.counts = {"steps": 0, "commands": 0, "npx": 0, "paths": 0, "scripts": 0, "uses": 0}
        self.lockfiles = {}
        for lock in subprocess.run(["git", "ls-files", "*package-lock.json"], cwd=ROOT, capture_output=True,
                                   text=True, check=True).stdout.split():
            if "node_modules" in lock:
                continue
            tree = str(Path(lock).parent).replace("\\", "/")
            packages = json.loads((ROOT / lock).read_text())["packages"]
            bins = set((packages.get("", {}).get("bin") or {}))
            for key, entry in packages.items():
                rest = key[len("node_modules/"):] if key.startswith("node_modules/") else None
                if rest and "/node_modules/" not in "/" + rest:
                    bins |= set(entry.get("bin") or {})
            self.lockfiles["." if tree in ("", ".") else tree] = {"bins": bins, "packages": packages}
        case.assertTrue({".", "source", ".github/tools/wrangler"} <= set(self.lockfiles), sorted(self.lockfiles))

    # ── the shell, read only as far as this check needs ──
    @staticmethod
    def logical_lines(run):
        lines, out, heredoc, buf = run.split("\n"), [], None, ""
        for raw in lines:
            if heredoc is not None:
                if raw.strip() == heredoc:
                    heredoc = None
                continue
            m = re.search(r"(?<!<)<<-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1(?!<)", raw)
            if m:
                heredoc = m.group(2)
            if raw.rstrip().endswith("\\"):
                buf += raw.rstrip()[:-1] + " "
                continue
            out.append(buf + raw)
            buf = ""
        if buf:
            out.append(buf)
        return out

    def commands(self, run):
        """Yield (words, pipeline_rest) for every simple command, with substitutions read as commands too."""
        pending = list(self.logical_lines(run))
        while pending:
            line = pending.pop(0)
            if not line.strip() or line.strip().startswith("#"):
                continue
            for inner in re.findall(r"[$<]\(((?:[^()]|\([^()]*\))*)\)|`([^`]*)`", line):
                pending.append(inner[0] or inner[1])
            line = re.sub(r"<\((?:[^()]|\([^()]*\))*\)", " PSUBST ", line)
            line = re.sub(r"\$\((?:[^()]|\([^()]*\))*\)|`[^`]*`", "SUBST", line)
            try:
                lexer = shlex.shlex(line, posix=True, punctuation_chars=";&|()<>")
                lexer.whitespace_split = True
                lexer.commenters = "#"
                words = list(lexer)
            except ValueError as exc:
                self.t.fail(f"cannot read: {line.strip()[:120]} ({exc})")
            pipeline, current = [], []
            for w in words + [";"]:
                if w in (";", "&&", "||", "&", "(", ")", ";;", "|", "|&", ";&"):
                    if current:
                        pipeline.append(current)
                    current = []
                    if w not in ("|", "|&"):
                        for i, cmd in enumerate(pipeline):
                            yield cmd, pipeline[i + 1:]
                        pipeline = []
                    if w in ("(", ")"):
                        yield [w], []  # a subshell scopes its `cd`
                elif w in ("<", ">", ">>", "<<", "<<<", ">&", "<&") or (current and current[-1] in ("<", ">", ">>", "<<<", ">&", "<&")):
                    current.append(w)  # redirections stay with their command
                else:
                    current.append(w)

    def program(self, words):
        # drop redirections and their targets (`2>/dev/null`, `>> "$GITHUB_OUTPUT"`, `<<< "$x"`, `&>file`)
        kept, skip = [], False
        for j, w in enumerate(words):
            if skip:
                skip = False
                continue
            if re.fullmatch(r"[<>&]+", w):
                skip = True
                continue
            if w.isdigit() and j + 1 < len(words) and re.fullmatch(r"[<>&]+", words[j + 1]):
                continue
            kept.append(w)
        words = kept
        i = 0
        while i < len(words):
            w = words[i]
            if w in CONTROL or re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", w):
                i += 1
            elif w in WRAPPERS:
                i += 1
                while i < len(words) and (words[i].startswith("-") or re.fullmatch(r"[0-9.]+[smhd]?", words[i])):
                    i += 1
            elif w in ("for", "case", "function", "select"):
                return None, []
            else:
                return w, words[i + 1:]
        return None, []

    # ── the rules ──
    @staticmethod
    def norm(path):
        return os.path.normpath(path or ".").replace("\\", "/")

    def tree_of(self, path, installed):
        path = self.norm(path)
        for tree in sorted(installed, key=len, reverse=True):
            if tree == "." or path == tree or path.startswith(tree + "/"):
                return tree
        return None

    def check_command(self, words, rest, ctx):
        prog, args = self.program(words)
        if prog is None:
            return
        self.counts["commands"] += 1
        where = f"{ctx['where']}: `{' '.join(words)[:110]}`"
        if prog.startswith("$") or prog.startswith('"$'):
            name = prog.strip('"').lstrip("$").strip("{}")
            value = ctx["env"].get(name)
            self.t.assertIsNotNone(value, f"{where}: a program named by a variable the step does not define")
            prog = re.sub(r"\$\{\{[^}]*\}\}/?", "", value)
        if "node_modules/" in prog or (prog in ("node",) and args and "node_modules/" in args[0]):
            target = prog if "node_modules/" in prog else args[0]
            self.counts["paths"] += 1
            tree = self.norm(target.split("/node_modules/")[0] if "/node_modules/" in target else ".")
            self.t.assertTrue(tree in ctx["installed"], f"{where}: runs from {tree}/node_modules, which no earlier step of this job installed")
            return
        if prog in INTERPRETERS | {"source", ".", "eval"}:
            self.t.assertNotIn("PSUBST", args, f"{where}: {prog} runs a process substitution")
            if prog in ("source", ".", "eval"):
                self.t.assertFalse(any("SUBST" in a for a in args), f"{where}: {prog} runs a substitution")
        if prog in REFUSED:
            self.t.fail(f"{where}: `{prog}` installs or runs packages outside a committed lockfile")
        if prog in ("npx",) or (prog == "npm" and args[:1] in (["exec"], ["x"])):
            if prog == "npm":
                args = args[1:]
            self.counts["npx"] += 1
            self.t.assertFalse(ctx["after_failure"], f"{where}: npx in a step that runs after a failure: an install skipped by "
                               "that failure leaves npx to fetch from the registry; call the binary by its path")
            flags = []
            while args and args[0].startswith("-"):
                flags.append(args.pop(0))
            self.t.assertTrue(set(flags) <= {"--no-install", "--no"}, f"{where}: npx {flags}: a form this check does not read")
            self.t.assertTrue(args, f"{where}: npx with no command")
            available = ctx["bins"].get(self.tree_of(ctx["cwd"], ctx["bins"]) or "", set())
            self.t.assertTrue(args[0] in available, f"{where}: `{args[0]}` is no bin of a lockfile this job installed for {ctx['cwd']}")
            return
        if prog == "npm":
            sub = args[0] if args else ""
            if sub == "ci":
                prefix = args[args.index("--prefix") + 1] if "--prefix" in args else ctx["cwd"]
                tree = self.norm(prefix)
                self.t.assertTrue(tree in self.lockfiles, f"{where}: npm ci of a tree with no committed lockfile")
                ctx["installed"].add(tree)
                ctx["bins"].setdefault(tree, set()).update(self.lockfiles[tree]["bins"])
                return
            if sub in ("run", "run-script", "test", "t"):
                name = "test" if sub in ("test", "t") else (args[1] if len(args) > 1 else "")
                self.npm_script(name, ctx, where)
                return
            self.t.fail(f"{where}: `npm {sub}` is a form this check does not read (npm install re-resolves the lockfile)")
        if prog in ("pip", "pip3") or (prog in ("python", "python3") and args[:2] in (["-m", "pip"],)):
            pip = args[2:] if prog.startswith("python") else args
            self.t.assertEqual(pip[:1], ["install"], f"{where}: a pip form this check does not read")
            for value in pip[1:]:
                self.t.assertRegex(value, r"^(-U|--upgrade|-q|--quiet|--disable-pip-version-check|--no-cache-dir|[A-Za-z0-9][A-Za-z0-9_.-]*(\[[^]]+\])?([<>=!~]=?[^ ]*)?)$",
                                   f"{where}: pip install of {value!r}: named distributions only")
            return
        if prog == "curl":
            for i, a in enumerate(args):
                if a in ("-o", "--output") and args[i + 1:i + 2] != ["/dev/null"]:
                    self.t.fail(f"{where}: curl writing a file")
                if a.startswith("-O") or a == "--remote-name" or (re.fullmatch(r"-[a-zA-Z]*o", a) and args[i + 1:i + 2] != ["/dev/null"]):
                    self.t.fail(f"{where}: curl writing a file")
            for later in rest:
                lp, _ = self.program(later)
                self.t.assertNotIn(lp, INTERPRETERS, f"{where}: a download piped into {lp}")
            return
        if prog in ("sh", "bash", "zsh", "dash") and "-c" in args:
            body = args[args.index("-c") + 1] if args.index("-c") + 1 < len(args) else ""
            self.t.assertNotIn("SUBST", body, f"{where}: {prog} -c of a substitution")
            self.scan(body, ctx, where + " (-c)")
            return
        if prog == "ln" and args and "-s" in "".join(a for a in args if a.startswith("-")):
            target, link = [a for a in args if not a.startswith("-")][-2:]
            if link.endswith("node_modules/.bin/" + Path(link).name):
                resolved = self.norm(os.path.join(ctx["cwd"], os.path.dirname(link), target))
                tree = resolved.split("/node_modules/")[0]
                self.t.assertTrue(tree in ctx["installed"], f"{where}: links a bin from {tree}, which no earlier step installed")
                into = self.norm(os.path.join(ctx["cwd"], os.path.dirname(os.path.dirname(os.path.dirname(link))) or "."))
                ctx["bins"].setdefault(into, set()).add(Path(link).name)
            return
        if ctx["script"] and prog in set().union(*(v["bins"] for v in self.lockfiles.values())):
            # inside an npm script, a bare bin name runs from that tree's node_modules/.bin
            self.t.assertTrue(prog in ctx["bins"].get(self.tree_of(ctx["cwd"], ctx["bins"]) or "", set()),
                              f"{where}: `{prog}` is no bin of a lockfile this job installed")

    def npm_script(self, name, ctx, where):
        tree = self.tree_of(ctx["cwd"], self.lockfiles) or "."
        scripts = json.loads((ROOT / tree / "package.json").read_text()).get("scripts", {})
        self.t.assertIn(name, scripts, f"{where}: no npm script {name!r} in {tree}/package.json")
        for hook in ("pre" + name, name, "post" + name):
            if hook in scripts:
                self.counts["scripts"] += 1
                self.scan(scripts[hook], {**ctx, "script": True}, f"{where} › npm script {hook}")

    def scan(self, run, ctx, where):
        cwd0, stack = ctx["cwd"], []
        for words, rest in self.commands(run):
            if words == ["("]:
                stack.append(ctx["cwd"])
                continue
            if words == [")"]:
                ctx["cwd"] = stack.pop() if stack else ctx["cwd"]
                continue
            if words and words[0] == "cd" and len(words) == 2:
                ctx["cwd"] = self.norm(os.path.join(ctx["cwd"], words[1]))
                continue
            self.check_command(words, rest, {**ctx, "where": where})
        ctx["cwd"] = cwd0

    def check(self):
        for workflow_name, workflow in self.t._workflows():
            for text in WorkflowTests._strings(workflow):
                self.t.assertNotIn("--mcp-config", text, f"{workflow_name}: an MCP server runs outside any lockfile")
            for job_name, job in workflow["jobs"].items():
                installed, bins = set(), {}
                env_base = {**(workflow.get("env") or {}), **(job.get("env") or {})}
                for i, step in enumerate(job.get("steps", [])):
                    self.counts["steps"] += 1
                    where = f"{workflow_name} › {step.get('name') or job_name + ' step ' + str(i)}"
                    if "uses" in step:
                        self.counts["uses"] += 1
                        action = step["uses"].split("@")[0]
                        self.t.assertIn(action, ACTIONS, f"{where}: {step['uses']} is no reviewed action")
                        if action == "cloudflare/wrangler-action":
                            self.wrangler_action(step, bins, installed, where)
                        continue
                    if "run" not in step:
                        continue
                    run = re.sub(r"\$\{\{.*?\}\}", "expr", step["run"])
                    cwd = (step.get("working-directory") or (job.get("defaults") or {}).get("run", {}).get("working-directory") or ".")
                    ctx = {"cwd": self.norm(cwd), "installed": installed, "bins": bins,
                           "env": {**env_base, **(step.get("env") or {})}, "script": False,
                           "after_failure": bool(re.search(r"always\(\)|failure\(\)|cancelled\(\)", str(step.get("if", ""))))}
                    self.scan(run, ctx, where)
        c = self.counts
        # positive coverage, floors under the counts measured at v1.265.3 (246 steps, 64 uses:, 822 commands, 14 npx,
        # 11 node_modules paths, 60 npm scripts): a reader that stopped reading cannot pass by finding nothing
        self.t.assertGreater(c["steps"], 200)
        self.t.assertGreater(c["uses"], 50)
        self.t.assertGreater(c["commands"], 700)
        self.t.assertGreaterEqual(c["npx"], 10)
        self.t.assertGreaterEqual(c["paths"], 8)
        self.t.assertGreater(c["scripts"], 40)
        print("Package runs: {steps} steps ({uses} uses:), {commands} commands, {npx} npx resolved, "
              "{paths} node_modules paths, {scripts} npm scripts expanded".format(**c))

    def wrangler_action(self, step, bins, installed, where):
        tool = self.lockfiles[".github/tools/wrangler"]
        pin = json.loads((ROOT / ".github/tools/wrangler/package.json").read_text())["dependencies"]
        self.t.assertEqual(list(pin), ["wrangler"])
        self.t.assertRegex(pin["wrangler"], r"^\d+\.\d+\.\d+$", "an exact version, never a range")
        entry = tool["packages"]["node_modules/wrangler"]
        self.t.assertEqual(entry["version"], pin["wrangler"], "the lockfile was made from this pin")
        self.t.assertEqual(tool["packages"][""]["dependencies"], pin)
        self.t.assertTrue(all(v.get("resolved", "").startswith("https://registry.npmjs.org/") and v.get("integrity", "").startswith("sha512-")
                              for k, v in tool["packages"].items() if k), "every package from the registry, by its sha512")
        self.t.assertEqual(str(step.get("with", {}).get("wranglerVersion")), pin["wrangler"],
                           f"{where}: wranglerVersion names the lockfile's version, or the action installs its own")
        self.t.assertTrue(".github/tools/wrangler" in installed, f"{where}: the tool's lockfile installed earlier in this job")
        self.t.assertTrue("wrangler" in bins.get(".", set()), f"{where}: the tool linked where the action's probe looks, earlier in this job")
        self.t.assertFalse(step.get("with", {}).get("workingDirectory"), f"{where}: the probe runs in the repository root")


if __name__ == "__main__":
    unittest.main(verbosity=2)
