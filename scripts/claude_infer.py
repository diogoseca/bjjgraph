#!/usr/bin/env python3
"""claude_infer.py — shared, robust Claude CLI inference for the content scripts.

Replaces the raw, backoff-less `call_claude` previously copy-pasted into
regenerate_content_json.py and proofread_all_transitions.py. Three guarantees:

1. READ-ONLY tools — Claude may explore context (Read/Grep/Glob) but cannot write
   anything (Write/Edit/MultiEdit/NotebookEdit/Bash are denied). The ONLY output is
   the structured JSON, which the *caller* persists — never Claude.
2. FORCED structured output — an explicit output contract plus prose-detection retry,
   so Claude never returns "nothing to change" prose (or an empty object) instead of
   the JSON.
3. USAGE-LIMIT BACKOFF — ports scripts/retry-claude.zsh: on a real usage/rate limit,
   parse the server-stated reset (retry-after / epoch / "in 2h 14m" / "resets at 3pm")
   and wait until it (+buffer); never honor a multi-day weekly block or two parsed
   resets in a row (back off instead); for any other error, exponential backoff with
   jitter; never hot-loop (MIN_WAIT floor). A limit can arrive as a non-zero exit OR as
   exit 0 with `is_error:true` in the JSON — both route to backoff. Tunable via env
   (short caps for CI so a wait can't blow the Actions job timeout).

Keeps stdout clean (parses claude's JSON directly), unlike piping through the zsh
wrapper which merges stderr into stdout.
"""

from __future__ import annotations

import json
import os
import random
import re
import subprocess
import time
from datetime import datetime
from typing import Optional, Tuple

# Writes denied; read-only exploration allowed (Read/Grep/Glob remain auto-approved
# under dontAsk). Bash is denied because it can write via redirection.
DENY_TOOLS = "Write,Edit,MultiEdit,NotebookEdit,Bash"

# Backoff tunables (mirror retry-claude.zsh). Override via env — e.g. CI sets a short
# BACKOFF_CAP / MAX_PARSED_WAIT so a limit wait can't blow the Actions job timeout.
MAX_ATTEMPTS = int(os.environ.get("CLAUDE_MAX_ATTEMPTS", "12"))
MIN_WAIT = int(os.environ.get("CLAUDE_MIN_WAIT", "60"))
BUFFER = int(os.environ.get("CLAUDE_BUFFER", "15"))
BACKOFF_BASE = int(os.environ.get("CLAUDE_BACKOFF_BASE", "30"))
BACKOFF_CAP = int(os.environ.get("CLAUDE_BACKOFF_CAP", "900"))
MAX_PARSED_WAIT = int(os.environ.get("CLAUDE_MAX_PARSED_WAIT", "18000"))  # ~5h session window
PROSE_RETRIES = int(os.environ.get("CLAUDE_PROSE_RETRIES", "2"))

_OUTPUT_CONTRACT = (
    "\n\n## OUTPUT CONTRACT (mandatory)\n"
    "Return the COMPLETE object via the structured output every time — including when the "
    "input already looks valid (in that case return the current content unchanged as "
    "`fixed_content`). NEVER reply with prose, an explanation, or 'nothing to change'. "
    "You MAY use read-only tools (Read/Grep/Glob) to gather context, but you may not write "
    "any file — the only thing you produce is the structured JSON."
)


def _looks_like_limit(text: str) -> bool:
    """Heuristic: does the failure look like a usage/rate limit (vs a hard error)?"""
    return bool(
        re.search(
            r"rate.?limit|usage limit|limit reached|429|overloaded|too many requests|resets?\s+(at|in)|retry-after",
            text or "",
            re.I,
        )
    )


def _parse_wait(text: str) -> Optional[int]:
    """Seconds to wait from a limit message, or None. Ported from retry-claude.zsh::parse_wait.
    Only meaningful for genuine limit text — callers gate this on _looks_like_limit()."""
    now = int(time.time())
    # 1) HTTP "retry-after: N" (seconds)
    m = re.search(r'retry-after["\s:]+(\d+)', text, re.I)
    if m:
        return int(m.group(1))
    # 2) epoch reset (10-digit, this decade) e.g. anthropic-ratelimit-*-reset
    m = re.search(r"reset[^0-9]{0,24}(1\d{9})", text, re.I)
    if m:
        return max(0, int(m.group(1)) - now)
    # 3a) compact relative: "in 2h 14m 30s" / "in 45m" / "in 90s"
    m = re.search(r"in\s+((?:\d+\s*[hms]\s*)+)", text, re.I)
    if m:
        chunk = m.group(1)
        h = re.search(r"(\d+)\s*h", chunk, re.I)
        mm = re.search(r"(\d+)\s*m", chunk, re.I)
        s = re.search(r"(\d+)\s*s", chunk, re.I)
        t = (int(h.group(1)) if h else 0) * 3600 + (int(mm.group(1)) if mm else 0) * 60 + (int(s.group(1)) if s else 0)
        if t > 0:
            return t
    # 3b) worded: "in 5 minutes" / "try again in 30 seconds" / "in 1 hour"
    m = re.search(r"in\s+(\d+)\s*(second|minute|hour)", text, re.I)
    if m:
        n = int(m.group(1))
        unit = m.group(2).lower()
        return n * 3600 if unit == "hour" else n * 60 if unit == "minute" else n
    # 4) absolute clock: "resets at 3pm" / "at 3:30pm" / "at 15:30". Require a real clock
    #    (HH:MM, or H with am/pm) so a stray "at 2 attempts" can't match.
    m = re.search(r"at\s+(\d{1,2}:\d{2}\s*[ap]m|\d{1,2}:\d{2}|\d{1,2}\s*[ap]m)", text, re.I)
    if m:
        chunk = m.group(1)
        hh = int(re.search(r"\d{1,2}", chunk).group())
        mmm = re.search(r":(\d{2})", chunk)
        mm = int(mmm.group(1)) if mmm else 0
        ap = re.search(r"[ap]m", chunk, re.I)
        ap = ap.group().lower() if ap else ""
        if ap == "pm" and hh < 12:
            hh += 12
        if ap == "am" and hh == 12:
            hh = 0
        try:
            target = int(datetime.now().replace(hour=hh % 24, minute=mm % 60, second=0, microsecond=0).timestamp()) - now
            if target <= 0:
                target += 86400  # clock time already passed → next day
            return target
        except (ValueError, OverflowError):
            pass
    return None


def _compute_wait(text: str, backoff_n: int, is_limit: bool, last_was_parsed: bool) -> Tuple[int, bool, bool]:
    """(seconds, used_backoff, honored_parse). Honor a sane server-stated reset only for a
    genuine limit and not two in a row; otherwise exponential backoff with jitter."""
    if is_limit and not last_was_parsed:
        wait = _parse_wait(text)
        weekly = bool(re.search(r"weekly|per\s+week|7[ -]?day", text, re.I))
        if wait is not None and not weekly and wait <= MAX_PARSED_WAIT:
            return max(MIN_WAIT, wait + BUFFER), False, True
    wait = min(BACKOFF_CAP, BACKOFF_BASE * (2 ** backoff_n)) + random.randint(0, 9)
    return max(MIN_WAIT, wait), True, False


def _extract_cli(stdout: str) -> Tuple[object, str, bool]:
    """From `--output-format json` stdout return (structured_output, result_text, is_error)."""
    try:
        cli = json.loads(stdout)
    except (json.JSONDecodeError, TypeError):
        return None, (stdout or "").strip(), False
    if isinstance(cli, dict):
        return cli.get("structured_output"), str(cli.get("result", stdout)).strip(), bool(cli.get("is_error"))
    return None, (stdout or "").strip(), False


def call_claude(
    prompt: str,
    response_schema: dict,
    model: str,
    effort: str,
    timeout: int = 1800,
    log=print,
) -> Tuple[Optional[str], Optional[str]]:
    """Run one structured-output Claude inference with read-only tools + limit backoff.
    Returns (json_string_of_structured_output, None) on success, or (None, error_message).
    `log` receives human-readable backoff/prose notices (default: print)."""
    cmd = [
        "claude", "-p", "-",
        "--model", model,
        "--effort", effort,
        "--permission-mode", "dontAsk",
        "--disallowedTools", DENY_TOOLS,  # read-only: explore, never write
        "--output-format", "json",
        "--json-schema", json.dumps(response_schema),
    ]
    cur_prompt = prompt + _OUTPUT_CONTRACT
    attempt = 0
    backoff_n = 0
    prose_n = 0
    last_was_parsed = False
    last_err = "(no attempts)"
    while attempt < MAX_ATTEMPTS:
        attempt += 1
        proc = None
        try:
            proc = subprocess.Popen(
                cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
            )
            stdout, stderr = proc.communicate(input=cur_prompt, timeout=timeout)
            rc = proc.returncode
        except subprocess.TimeoutExpired:
            if proc:
                proc.kill()
                proc.wait()
            rc, stdout, stderr = 1, "", "Claude CLI timeout"
        except FileNotFoundError:
            return None, "Claude CLI not found - ensure 'claude' is in PATH"
        except KeyboardInterrupt:
            if proc:
                proc.kill()
                proc.wait()
            raise

        structured, result_text, is_err = _extract_cli(stdout)

        # SUCCESS: exit 0 with a non-empty structured object (empty {} is NOT success).
        if rc == 0 and structured:
            return (json.dumps(structured) if isinstance(structured, (dict, list)) else structured), None

        # Classify the non-success outcome. A limit can be a non-zero exit OR exit-0 with
        # is_error + a limit message in `result`. Everything else with no structured output
        # but a clean exit is prose → force-retry.
        scan = (stdout or "") + "\n" + (stderr or "") + "\n" + result_text
        is_limit = _looks_like_limit(scan)
        hard_error = (rc != 0) or is_err

        if rc == 0 and not hard_error and not is_limit:
            if prose_n < PROSE_RETRIES:
                prose_n += 1
                log(f"  [claude] prose/empty instead of JSON — re-prompting ({prose_n}/{PROSE_RETRIES})")
                cur_prompt = (
                    prompt + _OUTPUT_CONTRACT
                    + "\n\nYour previous reply was prose/empty and was REJECTED. Emit ONLY the complete structured JSON now."
                )
                continue
            return None, "Claude returned prose/empty instead of structured output (after force-retries)"

        # Error / limit → back off and retry the same prompt.
        last_err = (result_text or stderr or stdout or "").strip() or "(empty)"
        if attempt >= MAX_ATTEMPTS:
            break
        wait, used_backoff, honored = _compute_wait(scan, backoff_n, is_limit, last_was_parsed)
        if is_limit:
            log(f"  [claude] usage/rate limit → waiting {wait}s (attempt {attempt}/{MAX_ATTEMPTS})")
        else:
            log(f"  [claude] error (exit {rc}) → backoff {wait}s (attempt {attempt}/{MAX_ATTEMPTS}): {last_err[:120]}")
        time.sleep(wait)
        last_was_parsed = honored
        if used_backoff:
            backoff_n += 1

    return None, f"Claude CLI error after {attempt} attempts: {last_err}"
