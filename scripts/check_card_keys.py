#!/usr/bin/env python3
"""THE CARD-KEY GATE (CARD1-S2, v1.303.0): no edit to content/ may take a flashcard's progress away from its players.

A card's progress (its grade, its schedule, its place among the decks that share it) is filed under its KEY: its `id`
when it carries one, else the hash of its question (scripts/_card_key.py). Before v1.303.0 the key was always the hash,
so every reworded question reset that card for every player (the v1.182.2 sweep orphaned 10,679 of them, DUE1). Now a
reworded card keeps its key by carrying `id: <the key of the text it replaced>`, and this gate fails an edit that does
not.

  python3 scripts/check_card_keys.py                       # 1 only: the keys of every flashcards array as they stand
  python3 scripts/check_card_keys.py --baseline-ref HEAD^1 # 1, and 2: every card against the base commit (ci-validate)

1. EVERY ARRAY AS IT STANDS (every content/**/*.json, every array under a key starting "flashcards"): an `id` is 8 lowercase
   hex digits; no key is held by two DIFFERENT questions (a duplicate id, or an id equal to another live card's text hash:
   the app would merge the two cards' progress). The neural emitter refuses the same on the wire decks it blends.
2. EVERY CARD AGAINST THE BASE (`--baseline-ref`): each card of each file at the base is paired with the working tree's
   (`pair_changes`): kept by its key, or else its id dropped or changed, or its question reworded without its id: those
   FAIL, naming the file, the array, the old question and the id to write. A card deleted or added is allowed, and
   counted. A file unchanged since the base counts its cards as compared (they are byte-identical; git says so).

ABSENCE MUST NOT READ AS A PASS (CLAUDE.md §6): both halves print a positive count and fail on zero arrays checked, zero
cards checked, or (with a base) zero cards compared; a base that cannot be read fails, it is never skipped. In CI the base
is HEAD^1, which on a pull request is the base branch's tip (ci-validate checks out two commits) and on a push the
previous commit; scripts/ci-local.sh replays it against the merge-base with origin/dev.

Mutants (tests/card_keys_gate.test.mjs runs this file on fixture trees; each red there): the id check dropped from
`array_faults`; step 1 (the same answer) dropped from `pair_changes`; the zero-compared floor removed.

BEFORE THE FIRST ID (CARD1 slice 4, the first content `id`; none of this is built yet: the PR #469 read measured each case,
its report's F2, F4, F5 and F6). Content carries no id today, so these gaps cost no player anything yet.
  · THE ID RULE IS MISSING. A card's id must be its own key at the base, or a key no other card in the corpus holds. Today
    this gate PASSES:
      - a reworded card with a WRONG id (any 8 hex): the old card counts as deleted, the new one as added, and its players'
        progress is orphaned;
      - an id equal to ANOTHER file's card text hash: `array_faults` and the emitter's `_card_key_census` see one array or
        deck only, so the shared index joins that unrelated card's group. A shared question reworded in one deck, its old
        text still in another, looks the same from one file and is right; only the base tells them apart;
      - a card reworded, its answer edited and moved, in one commit (no pairing step finds it).
    It FALSE-FAILS one honest edit: replacing the last card in place (deleted, and a new one added at its index) reads as
    a rewording. The way out is in its message: an id of its own.
  · WHERE IT RUNS. The base `HEAD^1` sees only the LAST commit of a multi-commit push to dev, and the bots' PRs run no
    ci-validate at all: they open with the workflow token, which starts no workflow. Before the first id, run this gate
    where the bots' PRs are checked, against the merge-base. (The bot cannot write an id today:
    `restore_questions` strips every id the original does not carry, in any array, and the schema it is shown leaves
    `id` out.)
  · THE EMITTER DEDUPES BY TEXT, THEN REFUSES BY KEY. `_blend_deck` and `dedupe_flashcards` (and the hub curation) dedupe
    a deck's cards by their question text; `_card_key_census` then refuses two texts under one key in one deck. So a
    question held by two tiers of one wire deck, with only one copy reworded, stops the emit, loudly. There are 0 such
    texts on the wire today (all 93 sit on hub nodes, which the wire does not carry). Before the first id: dedupe by
    `_card_key`, or have the rewrite reword every copy of a text.
  · `was:` IS NOT BUILT. A card merged from two cannot inherit the second one's progress, so no edit may merge two cards
    until that field exists. A split works today: one card keeps the id and the other takes an id of its own.
  · THE DEPLOY RULE. No id ships until production has run a build at or after v1.301.5 through at least one deploy. A
    v1.298.0 tab left open across the deploy that carries the first id loads the new deck lazily and DELETES the key's
    grade; on a device only that tab uses, the grade is gone for good. So: promote a build at or after v1.301.5, then
    ship ids no earlier than the promotion after it.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _card_key import array_faults, card_key, flashcard_arrays, is_card, pair_changes  # noqa: E402


def _git(root: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=root, capture_output=True, text=True)


def _at(o, path):
    for k in path:
        if isinstance(o, dict) and k in o:
            o = o[k]
        elif isinstance(o, list) and isinstance(k, int) and 0 <= k < len(o):
            o = o[k]
        else:
            return None
    return o


def check(root: Path, base: str | None) -> int:
    files = sorted((root / "content").rglob("*.json"))
    arrays = cards = with_id = 0
    faults: list[str] = []
    for f in files:
        try:
            data = json.loads(f.read_text())
        except (OSError, json.JSONDecodeError) as e:
            faults.append(f"{f.relative_to(root)}: unreadable ({e})")
            continue
        for path, arr in flashcard_arrays(data):
            arrays += 1
            got = [c for c in arr if is_card(c)]
            cards += len(got)
            with_id += sum(1 for c in got if c.get("id") is not None)
            for why in array_faults(arr):
                faults.append(f"{f.relative_to(root)} {'/'.join(map(str, path))}: {why}")
    print(f"card keys: {cards:,} cards in {arrays:,} flashcards arrays of {len(files):,} files "
          f"({with_id:,} carry an id)")
    if not files or not arrays or not cards:
        print("card keys: FAILED — nothing was checked (no content files, arrays or cards found): "
              "a check that looked at nothing must not read as a pass")
        return 1

    if base is not None:
        if _git(root, "rev-parse", "--verify", "--quiet", base + "^{commit}").returncode != 0:
            print(f"card keys: FAILED — the base {base!r} is not a commit here (fetch it): never skipped")
            return 1
        diff = _git(root, "diff", "--name-status", "-M", base, "--", "content")
        if diff.returncode != 0:
            print(f"card keys: FAILED — git diff against {base} did not run: {diff.stderr.strip()[:200]}")
            return 1
        changed: dict[str, str] = {}      # working-tree path -> base path (a rename keeps its old name)
        added = deleted_files = 0
        for line in diff.stdout.splitlines():
            parts = line.split("\t")
            st = parts[0]
            if not parts[-1].endswith(".json"):
                continue
            if st.startswith("A"):
                added += 1
            elif st.startswith("D"):
                deleted_files += 1
                changed[parts[1]] = parts[1]
            elif st.startswith("R") or st.startswith("C"):
                changed[parts[2]] = parts[1]
            else:
                changed[parts[1]] = parts[1]
        listed = _git(root, "ls-tree", "-r", "--name-only", base, "--", "content")
        if listed.returncode != 0:
            print(f"card keys: FAILED — the base's tree could not be listed: {listed.stderr.strip()[:200]}")
            return 1
        at_base = set(listed.stdout.splitlines())
        compared = kept = reworded = removed = new_cards = 0
        # the files unchanged since the base: byte-identical there, so every card in them is compared and kept. A file the
        # base does not hold (untracked, or added and not yet committed: `git diff` lists neither) is NEW, never compared.
        touched = set(changed) | {p for p in changed.values()}
        unchanged = 0
        for f in files:
            rel = str(f.relative_to(root))
            if rel in touched:
                continue
            n = sum(len([c for c in arr if is_card(c)]) for _p, arr in flashcard_arrays(json.loads(f.read_text())))
            if rel not in at_base:
                added += 1
                new_cards += n
                continue
            unchanged += 1
            compared += n
            kept += n
        for now, then in sorted(changed.items()):
            shown = _git(root, "show", f"{base}:{then}")
            if shown.returncode != 0:
                print(f"card keys: FAILED — {then} at {base} could not be read: {shown.stderr.strip()[:200]}")
                return 1
            try:
                old = json.loads(shown.stdout)
            except json.JSONDecodeError:
                continue                                   # it was not JSON then: nothing to pair
            p_now = root / now
            new = json.loads(p_now.read_text()) if p_now.exists() else {}
            for path, arr in flashcard_arrays(old):
                cur = _at(new, path)
                r = pair_changes(arr, cur if isinstance(cur, list) else [])
                compared += r["compared"]; kept += r["kept"]; reworded += r["reworded"]
                removed += r["deleted"]; new_cards += r["added"]
                for oc, nc, why in r["faults"]:
                    faults.append(f"{now} {'/'.join(map(str, path))}: {why}: {oc['question'][:80]!r} -> "
                                  f"{nc['question'][:80]!r}; write \"id\": \"{card_key(oc)}\" on that card "
                                  f"(or, if it is a new card that replaced a deleted one, an id of its own)")
            old_paths = {p for p, _ in flashcard_arrays(old)}
            for path, arr in flashcard_arrays(new):
                if path not in old_paths:
                    new_cards += len([c for c in arr if is_card(c)])
        print(f"card keys vs {base}: {compared:,} cards compared ({kept:,} kept by their key, {reworded:,} of them "
              f"reworded with their id; {removed:,} deleted, {new_cards:,} added) in {len(changed):,} changed and "
              f"{unchanged:,} unchanged files "
              f"({added} added, {deleted_files} deleted)")
        if not compared:
            print("card keys: FAILED — no card was compared against the base: a gate that compared nothing must not "
                  "read as a pass")
            return 1

    if faults:
        print(f"card keys: FAILED — {len(faults)} fault(s); a card keeps its players' progress only by its key:")
        for line in faults[:60]:
            print("  · " + line)
        if len(faults) > 60:
            print(f"  … and {len(faults) - 60} more")
        return 1
    print("card keys: OK")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--baseline-ref", default=None, help="compare every card against this commit (CI: HEAD^1)")
    ap.add_argument("--root", default=str(Path(__file__).resolve().parent.parent), help=argparse.SUPPRESS)
    a = ap.parse_args()
    return check(Path(a.root), a.baseline_ref)


if __name__ == "__main__":
    sys.exit(main())
