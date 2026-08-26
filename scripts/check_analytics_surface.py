#!/usr/bin/env python3
"""check_analytics_surface.py — the analytics surface must match the environment it was built in,
in BOTH directions, and neither direction had a gate before this file existed.

WHY THIS EXISTS. v1.136.1 fixed a real bug: `source/quartz.config.ts` reads
`process.env.POSTHOG_API_KEY || ""` (the `|| ""` only satisfies the required `apiKey: string` in
cfg.ts), the build runs from `source/` so dotenv resolves `source/.env` — which carries no PostHog
vars — and the emitter therefore wrote a literal `posthog.init("")` into postscript.js. posthog-js
fetches array.js from the CDN, then rejects the empty token with a console.error on every page
load. The fix guards the WHOLE injection (`provider === "posthog" && cfg.analytics.apiKey`) and
prints a line when it skips.

That fix shipped with no gate. A mutant that deletes `&& cfg.analytics.apiKey` from
`source/quartz/plugins/emitters/componentResources.ts` turned no named spec red, which by CLAUDE.md
section 8 means the claim was not gated at all. It cannot be gated in `ci-validate.yml` either:
that job installs no node dependencies and never builds, so there is no postscript.js there to
read. It has to run where the built bytes are — which is both deploy workflows, after the Quartz
build. `tests/analytics_surface_gate.test.mjs` gates THIS script's own discrimination logic on
every PR, against synthetic fixtures, with no build.

THE CONTRACT, BOTH DIRECTIONS. A one-directional check is half a gate, and the half it omits here
is the more expensive one:

  * KEY SET  -> the emitted JS must carry EXACTLY ONE `posthog.init(`, and that init must carry the
    key this environment actually holds — compared against the real value, not merely "non-empty",
    because a build that shipped a stale or someone else's key looks identical to a correct one.
    The stub loader must be present too: init without the snippet above it is a call into nothing.
    ZERO occurrences here is not "safe", it is analytics silently ceasing to be collected in
    production — CLAUDE.md section 6.7's "deleting an emitter deletes its telemetry, and no gate
    reports it" class, and exactly as bad as the empty-token bug in the other direction.

  * KEY UNSET/EMPTY -> ZERO `posthog.init(` and ZERO stub-loader occurrences anywhere in the
    emitted JS. Guarding only `init` would still ship the stub, and the stub is the problem: it
    installs a `window.posthog` whose `capture` is a queue-pushing shim, so every consumer guard in
    the app passes and queues events forever against an instance that never initialised.

WHICH BRANCH IS DECIDED BY THE ENVIRONMENT, AND THE ENV VAR NAME COMES FROM THE CONFIG. Reading a
hard-coded "POSTHOG_API_KEY" here would reintroduce the repo's most repeated failure class: rename
the variable in quartz.config.ts and this gate would read an empty env forever, take the no-key
branch on a production build that has a key, find zero inits, and report the *wrong* failure — or,
worse, if both directions happened to look empty, pass while measuring nothing. So the provider and
the env var name are PARSED OUT OF `source/quartz.config.ts`, and a config this gate cannot parse is
a hard failure rather than a default.

The same reasoning is why both deploy workflows put `POSTHOG_API_KEY` on this step's `env:`
explicitly, the way the build step does. The gate reads the env at GATE time; the emitter read it at
BUILD time. If the step does not receive it, the gate takes the wrong branch of its own contract and
passes vacuously — so every failure message below names BOTH possible causes (a real regression, or
a step that was not given the secret), because a CI reader cannot tell them apart from the outcome.

SCOPING, AND WHY A GUARDED READ IS NOT A FALSE POSITIVE. The app legitimately READS the object it
never creates: `variant.inline.ts` compiles into prescript.js as
`let n=window.posthog;n?.capture&&n.capture(...)`, and `app.src.jsx`'s `track()` compiles into
neural.js as `const ph = window.posthog; if (ph && ph.capture) ...`. Those must survive the no-key
branch untouched — they are the shape the fix deliberately restored (`window.posthog` undefined, so
the guards short-circuit). Every CREATE pattern below is therefore a write or a call that only the
injected snippet performs — an assignment to `window.posthog` (never a read of it), the snippet's
own CDN asset-host rewrite, and the `.init(` call itself. No consumer assigns, no consumer calls
init. The READ pattern is counted and PRINTED as the positive proof that the scoping discriminates:
a run that reports creates=0 alongside reads>0 has demonstrably looked at real analytics code and
correctly declined to flag it.

POSITIVE COVERAGE, ALWAYS (CLAUDE.md section 6.6). Files scanned, bytes scanned and every
occurrence count are printed on every run, pass or fail, and a scan that reached zero files — or
that never found postscript.js — is a hard failure rather than a clean-looking pass. "Found no
problems" and "never looked" must not produce the same output.

Usage:  python3 scripts/check_analytics_surface.py [--out DIR]
        POSTHOG_API_KEY=phc_xxx python3 scripts/check_analytics_surface.py --out /tmp/out
Exit:   0 = the built analytics surface matches this environment, 1 = it does not.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG = PROJECT_ROOT / "source" / "quartz.config.ts"
DEFAULT_OUT = PROJECT_ROOT / "source" / "public"
EMITTER = "source/quartz/plugins/emitters/componentResources.ts"

# The emitter's only sink is postscript.js (afterDOMLoaded scripts are joined and written there),
# so its absence means the scan is looking at something that is not a Quartz build.
PRIMARY_SINK = "postscript.js"

# CREATE markers — every one of these is a WRITE or a CALL that only the injected snippet performs.
# A consumer guard reads `window.posthog` and calls `.capture`; it never assigns the global, never
# names the asset host, and never calls `.init`. That is the whole basis for the scoping claim, and
# `tests/analytics_surface_gate.test.mjs` pins it with a fixture that contains only consumer reads.
#
# The labels are named constants rather than positions in the tuple: every count below is looked up
# by label, so nothing here can drift into an index-keyed join (CLAUDE.md section 6.6 — those fail
# by printing a plausible number for the wrong thing).
INIT_LABEL = "posthog.init("
ASSIGN_LABEL = "window.posthog assignment"
LOADER_LABEL = "posthog assets host (array.js loader)"

# `posthog.init(` — the initialisation call. `e.init=function(...)` inside the stub defines a method
# on a local and does not match; that negative case is pinned by the unit test.
INIT_PATTERN = re.compile(r"posthog\s*\.\s*init\s*\(")

CREATE_PATTERNS = (
    (INIT_LABEL, INIT_PATTERN),
    # An ASSIGNMENT to the global (`(window.posthog=e,e._i=[]`). `(?!=)` keeps `window.posthog ==`
    # out of it; a bare read like `window.posthog||[]` cannot match at all.
    (ASSIGN_LABEL, re.compile(r"window\s*\.\s*posthog\s*=(?!=)")),
    # The snippet rewrites the api_host to fetch its loader:
    #   p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js"
    # That asset host appears nowhere else in this site's JS, and it is the thing that actually
    # costs a visitor a CDN round-trip on a keyless build.
    (LOADER_LABEL, re.compile(r"-assets\.i\.posthog\.com")),
)

# The `posthog.init(` call with its first argument captured as a JSON string literal. The emitter
# writes `posthog.init(${JSON.stringify(cfg.analytics.apiKey)},{api_host:...})` inside a template
# literal, so esbuild's minifier passes the bytes through unchanged.
INIT_WITH_KEY = re.compile(r"posthog\s*\.\s*init\s*\(\s*(\"(?:[^\"\\]|\\.)*\")")

# A READ of the global that is not an assignment to it — the shape every consumer guard compiles to.
READ_PATTERN = re.compile(r"window\s*\.\s*posthog\b(?!\s*=(?!=))")


def analytics_contract() -> tuple[str, str]:
    """(provider, env var name) as declared in quartz.config.ts.

    Parsed, never assumed: the env var this gate reads MUST be the env var the emitter read, or the
    gate silently grades the wrong branch. A config shape this cannot parse is a failure, because
    the alternative is defaulting to a guess that reads as a pass.
    """
    src = CONFIG.read_text(encoding="utf-8")
    block = re.search(r"analytics\s*:\s*\{(.*?)\}", src, re.S)
    if not block:
        raise ValueError(
            f"{CONFIG.relative_to(PROJECT_ROOT)}: no `analytics: {{ … }}` block — this gate encodes "
            f"the PostHog injection contract and cannot verify a surface it cannot find")
    body = block.group(1)
    provider = re.search(r"provider\s*:\s*\"([^\"]+)\"", body)
    env_name = re.search(r"apiKey\s*:\s*process\.env\.([A-Za-z_][A-Za-z0-9_]*)", body)
    if not provider:
        raise ValueError(
            f"{CONFIG.relative_to(PROJECT_ROOT)}: the analytics block declares no `provider` — "
            f"cannot tell which vendor's bytes should be in the build")
    if provider.group(1) != "posthog":
        raise ValueError(
            f"{CONFIG.relative_to(PROJECT_ROOT)}: analytics provider is "
            f"{provider.group(1)!r}, not 'posthog'. This gate asserts the PostHog injection in "
            f"{EMITTER}; a provider change needs the gate changed in the same commit, not a gate "
            f"that quietly starts checking nothing")
    if not env_name:
        raise ValueError(
            f"{CONFIG.relative_to(PROJECT_ROOT)}: `apiKey` is not read from `process.env.<NAME>`. "
            f"This gate derives the env var name from the config on purpose — hard-coding it means "
            f"a rename leaves the gate reading an empty env forever and grading the wrong branch")
    return provider.group(1), env_name.group(1)


def emitted_js(out_dir: Path) -> list[Path]:
    """Every .js file the build emitted. Scanning the whole tree rather than postscript.js alone is
    what makes 'zero stub loader occurrences ANYWHERE' checkable: a future emitter that writes the
    snippet into a different file is still covered, and the consumer bundles (prescript.js,
    static/neural/app/neural.js) are exactly the false-positive material the scoping must survive."""
    return sorted(p for p in out_dir.rglob("*.js") if p.is_file())


def scan(files: list[Path], out_dir: Path) -> dict:
    """Occurrence counts per marker, plus where each `init` lives and what key it carries."""
    hits = {label: 0 for label, _ in CREATE_PATTERNS}
    per_file_creates: dict[str, int] = {}
    reads = 0
    reads_outside_injection = 0
    inits: list[tuple[str, str | None]] = []   # (path relative to out_dir, key literal or None)
    total_bytes = 0

    for path in files:
        # Relative, never the basename: two bundles can share a name in a deep tree, and a message
        # naming the wrong one sends the reader to the wrong file.
        rel = path.relative_to(out_dir).as_posix()
        # errors="replace": a stray non-UTF8 byte in a vendored bundle must not crash a gate whose
        # whole job is to be more informative than silence.
        text = path.read_text(encoding="utf-8", errors="replace")
        total_bytes += len(text)
        creates_here = 0
        for label, pat in CREATE_PATTERNS:
            n = len(pat.findall(text))
            hits[label] += n
            creates_here += n
        if creates_here:
            per_file_creates[rel] = creates_here
        file_reads = len(READ_PATTERN.findall(text))
        reads += file_reads
        if creates_here == 0:
            # A file that reads the global without creating it is, by construction, a consumer —
            # so this count cannot be satisfied by the injected snippet's own three internal reads.
            reads_outside_injection += file_reads
        with_key = [m.group(1) for m in INIT_WITH_KEY.finditer(text)]
        inits.extend((rel, literal) for literal in with_key)
        # An init whose first argument is NOT a plain string literal is filed with key None: the
        # gate can see the call but cannot read the token out of it, which is a different — and
        # separately reported — failure from "no init at all".
        unreadable = len(INIT_PATTERN.findall(text)) - len(with_key)
        inits.extend((rel, None) for _ in range(max(0, unreadable)))

    return {
        "hits": hits,
        "per_file_creates": per_file_creates,
        "reads": reads,
        "reads_outside_injection": reads_outside_injection,
        "inits": inits,
        "bytes": total_bytes,
    }


def mask(value: str) -> str:
    """Enough of a token to debug a mismatch, never the token. PostHog project keys are public by
    design (they ship in the page), but a CI log is not the place to re-publish one."""
    if not value:
        return "<empty>"
    if len(value) <= 6:
        return f"<{len(value)} chars>"
    return f"{value[:4]}…{value[-2:]} ({len(value)} chars)"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(DEFAULT_OUT),
                    help="the BUILT output directory to read (default: source/public)")
    args = ap.parse_args()

    try:
        provider, env_name = analytics_contract()
    except (OSError, ValueError) as exc:
        print(f"[check_analytics_surface] FAIL\n  - {exc}", file=sys.stderr)
        sys.exit(1)

    out_dir = Path(args.out).resolve()
    if not out_dir.is_dir():
        print(f"[check_analytics_surface] FAIL\n  - {out_dir} is not a directory. This gate reads "
              f"BUILT bytes; run it after the Quartz build, or point it at the build with --out.",
              file=sys.stderr)
        sys.exit(1)

    files = emitted_js(out_dir)
    # THE ZERO-COVERAGE FLOOR (CLAUDE.md section 6.6). Every assertion below is of the form "N
    # occurrences", and every one of them is trivially satisfied by an empty file set. A scan that
    # found nothing must fail loudly instead of printing the same OK as a scan that verified a site.
    if not files:
        print(f"[check_analytics_surface] FAIL\n  - scanned 0 .js files under {out_dir}. Every "
              f"check here is an occurrence count, so an empty scan would satisfy the no-key "
              f"branch perfectly while proving nothing. Build first, or fix --out.",
              file=sys.stderr)
        sys.exit(1)
    if not any(p.name == PRIMARY_SINK for p in files):
        print(f"[check_analytics_surface] FAIL\n  - scanned {len(files)} .js file(s) under "
              f"{out_dir} but none of them is {PRIMARY_SINK}, which is the ONLY file the analytics "
              f"injection is written to ({EMITTER} pushes onto afterDOMLoaded). Either this is not "
              f"a Quartz build output, or the emitter's sink moved and this gate needs updating.",
              file=sys.stderr)
        sys.exit(1)

    # The env is read RAW: `cfg.analytics.apiKey` is falsy in JS only when it is the empty string,
    # so a key of " " would make the emitter inject. Stripping here would move the boundary and let
    # the gate and the emitter disagree about which branch the build took.
    key = os.environ.get(env_name, "")
    key_set = key != ""

    r = scan(files, out_dir)
    hits, inits = r["hits"], r["inits"]
    init_count = hits[INIT_LABEL]
    stub_count = hits[ASSIGN_LABEL] + hits[LOADER_LABEL]

    coverage = (f"scanned {len(files)} emitted .js file(s), {r['bytes']:,} chars, under {out_dir}; "
                f"occurrences: init={init_count} "
                f"window.posthog-assignment={hits[ASSIGN_LABEL]} "
                f"assets-host={hits[LOADER_LABEL]} "
                f"guarded-reads={r['reads']} (of which {r['reads_outside_injection']} in files that "
                f"create nothing)")

    errors: list[str] = []
    warnings: list[str] = []

    # THE BRANCH, AND WHY — printed on every run, pass or fail.
    if key_set:
        print(f"[check_analytics_surface] branch: KEY SET — {env_name} is non-empty "
              f"({mask(key)}), provider={provider!r}, so this build MUST carry exactly one "
              f"posthog.init() bearing that key, plus the stub loader above it.")
    else:
        print(f"[check_analytics_surface] branch: NO KEY — {env_name} is unset or empty, "
              f"provider={provider!r}, so this build MUST carry no posthog.init() and no stub "
              f"loader anywhere in its JS (window.posthog stays undefined; the app's guarded reads "
              f"short-circuit, which is the documented no-op).")
    print(f"[check_analytics_surface] coverage: {coverage}")

    if key_set:
        expected = json.dumps(key, ensure_ascii=False)  # matches JS JSON.stringify for any token
        if init_count == 0:
            errors.append(
                f"{env_name} is set but the build carries ZERO posthog.init(). Analytics is not "
                f"being collected from this deploy at all — the same class as deleting an emitter "
                f"(CLAUDE.md section 6.7), and it fails silently in production because nothing "
                f"errors when no events are sent. Causes, in order of likelihood: the guard in "
                f"{EMITTER} was widened/broken, the build step did not receive {env_name} in its "
                f"env:, or the provider was changed.")
        elif init_count > 1:
            errors.append(
                f"the build carries {init_count} posthog.init() calls ({', '.join(sorted({f for f, _ in inits}))}). "
                f"A second init re-registers the library and double-counts every pageview; there "
                f"must be exactly one.")
        else:
            where, literal = inits[0]
            if literal is None:
                errors.append(
                    f"{where}: posthog.init() is called with something other than a string literal, "
                    f"so this gate cannot read the key out of the emitted bytes and cannot tell a "
                    f"correct build from one shipping the wrong project's token. If the emitter now "
                    f"builds the key at runtime, this gate must be rewritten to match.")
            elif literal != expected:
                errors.append(
                    f"{where}: posthog.init() carries a DIFFERENT key from this environment's "
                    f"{env_name}. emitted={mask(json.loads(literal))} env={mask(key)}. A build that "
                    f"ships someone else's (or a stale) project token reports real user traffic "
                    f"into the wrong PostHog project, and looks completely healthy while doing it.")
        # Only meaningful once an init exists: with zero inits the error above already says the
        # whole injection is missing, and a second "…and the stub is missing too" would contradict
        # its own first clause.
        if init_count and stub_count == 0:
            errors.append(
                f"{env_name} is set and posthog.init() is present, but the stub loader is NOT "
                f"(0 assignments to window.posthog, 0 references to the -assets.i.posthog.com "
                f"loader host). init() without the snippet above it is a call into an object "
                f"nothing created — the library never loads and every event is dropped.")
    else:
        if init_count:
            errors.append(
                f"{env_name} is unset/empty but the build carries {init_count} posthog.init() "
                f"call(s) in {', '.join(sorted({f for f, _ in inits}))}. If the key really is "
                f"absent, this is the v1.136.1 bug back: posthog.init(\"\") makes posthog-js fetch "
                f"array.js from the CDN and then console.error on every page load. Restore the "
                f"`&& cfg.analytics.apiKey` guard in {EMITTER}. If the key is NOT really absent, "
                f"then this step was not given {env_name} in its env: while the build step was — "
                f"fix the workflow, because a gate reading a different environment from the build "
                f"grades the wrong branch.")
        if stub_count:
            errors.append(
                f"{env_name} is unset/empty but the PostHog stub loader is still in the build "
                f"({hits[ASSIGN_LABEL]} assignment(s) to window.posthog, "
                f"{hits[LOADER_LABEL]} reference(s) to the "
                f"-assets.i.posthog.com loader host, in "
                f"{', '.join(sorted(r['per_file_creates']))}). Guarding only the init line is the "
                f"tempting half-fix and is wrong: the stub installs a window.posthog whose capture "
                f"is a queue-pushing shim, so every consumer guard in the app passes and queues "
                f"events forever against an instance that never initialised. The WHOLE injection "
                f"is guarded in {EMITTER}; keep it that way.")

    # Both branches: something in the emitted JS must still READ the global, or no product event
    # can ever be reported even when the key IS set. Counted only in files that create nothing, so
    # the injected snippet's own internal reads cannot satisfy it.
    if r["reads_outside_injection"] == 0:
        errors.append(
            "no emitted .js file READS window.posthog without also creating it — so nothing in "
            "this build can report a product event, with or without a key. The two known consumers "
            "are source/quartz/components/scripts/variant.inline.ts (compiles into prescript.js) "
            "and app.src.jsx's track() (compiles into static/neural/app/neural.js). Either both "
            "were removed — a capability lost, and every PostHog dashboard fed by them goes flat "
            "from this deploy — or they moved into the file that carries the injection, in which "
            "case this gate needs updating.")

    for w in warnings:
        print(f"[check_analytics_surface] WARN — {w}")
    if errors:
        # The branch line and the coverage counts above are the context for every message below;
        # stdout is block-buffered when piped, so without this flush a CI log shows the failures
        # first and the evidence that produced them last.
        sys.stdout.flush()
        print("[check_analytics_surface] FAIL", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    if key_set:
        print(f"[check_analytics_surface] OK — exactly 1 posthog.init() carrying this "
              f"environment's {env_name}, with the stub loader present; "
              f"{r['reads_outside_injection']} guarded read(s) of window.posthog in consumer "
              f"bundles were correctly ignored (they read the object, they do not create it).")
    else:
        print(f"[check_analytics_surface] OK — 0 posthog.init() and 0 stub-loader occurrences in "
              f"{len(files)} emitted .js file(s); the {r['reads_outside_injection']} guarded "
              f"read(s) of window.posthog that ARE present are the app's own consumers and are "
              f"correctly not flagged (they read the object, they do not create it) — which is "
              f"also the positive proof that this scan looked at real analytics code.")


if __name__ == "__main__":
    main()
