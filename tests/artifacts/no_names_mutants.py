#!/usr/bin/env python3
"""Mutants for scripts/check_no_names.py --built (v1.289.0). NOT a gate: a probe that proves the gate's PINNED claims.

The independent read of PR #433 built these 25 mutants (its scratch mutants.py; 19 survived the v1.288.0 gate). Rerun on a
scratch tree assembled from a BUILT site: one page (Transitions/Advance-to-Chill-Dog), three dossier chunks, and a link to
content/ (the gate's name list). Each mutant is applied alone to a fresh copy; the control must be green and every mutant
red, each at the check the gate names; two zero controls (an empty tree, pages with no payload) must be red.
  python3 tests/artifacts/no_names_mutants.py            # needs source/public from npm run build
"""
import json, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUB = ROOT / "source/public"
PAGE_REL = "Transitions/Advance-to-Chill-Dog.html"
NAME = "Marshall Stamper"          # a `by` value in content/ (Advance to Chill Dog's attacker clips)
CREDIT0 = '<p class="clip-credit"><strong>Meathook to Chill Dog to kimura finishes</strong> · 1:13'
VO0 = '"description":"Advance to Chill Dog film study: Meathook to Chill Dog to kimura finishes."'
VO0_URL = '"url":"https://www.youtube.com/watch?v=Q2aYW-20B44","duration":"PT73S"}'


def first_clip(d):
    found = []
    def walk(x):
        if isinstance(x, dict):
            if isinstance(x.get("id"), str) and len(x["id"]) == 11 and "title" in x and not found: found.append(x)
            for v in x.values(): walk(v)
        elif isinstance(x, list):
            for v in x: walk(v)
    walk(d); return found[0]


def main():
    page = (PUB / PAGE_REL).read_text()
    for s in (CREDIT0, VO0, VO0_URL): assert s in page, "the probe's anchor moved: " + s[:60]
    chunks = sorted((PUB / "static/neural/content").glob("*.json"))
    chunk_with_clip = next(c for c in chunks if '"title"' in c.read_text())
    tmp = Path(tempfile.mkdtemp(prefix="nonames-mut-", dir="/home/user/tmp-pw"))
    try:
        (tmp / "scripts").mkdir(); shutil.copy(ROOT / "scripts/check_no_names.py", tmp / "scripts/")
        (tmp / "content").symlink_to(ROOT / "content")
        base = tmp / "source/public"

        def fresh():
            if base.exists(): shutil.rmtree(base)
            (base / "Transitions").mkdir(parents=True); (base / PAGE_REL).write_text(page)
            (base / "static/neural/content").mkdir(parents=True)
            shutil.copy(chunk_with_clip, base / "static/neural/content" / chunk_with_clip.name)

        def page_mut(old, new):
            return lambda: (base / PAGE_REL).write_text(page.replace(old, new, 1))

        def chunk_mut(fn):
            def m():
                p = base / "static/neural/content" / chunk_with_clip.name; d = json.loads(p.read_text()); fn(d); p.write_text(json.dumps(d))
            return m

        def extra(rel, text):
            def m():
                p = base / rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(text)
            return m

        s = lambda t: CREDIT0.replace("</strong>", "</strong>" + t)
        M = [
            ("control: unmodified", lambda: None, 0),
            ("credit '— taught by X'", page_mut(CREDIT0, s(" — taught by " + NAME)), 1),
            ("credit '— Taught By X' (case)", page_mut(CREDIT0, s(" — Taught By " + NAME)), 1),
            ("credit '— by X'", page_mut(CREDIT0, s(" — by " + NAME)), 1),
            ("credit '— with X'", page_mut(CREDIT0, s(" — with " + NAME)), 1),
            ("credit ' · X' (the bare name)", page_mut(CREDIT0, s(" · " + NAME)), 1),
            ("credit 'taught&nbsp;by X'", page_mut(CREDIT0, s(" — taught&nbsp;by " + NAME)), 1),
            ("name in a <small> before the credit", page_mut(CREDIT0, '<small class="clip-by">' + NAME + '</small>' + CREDIT0), 1),
            ("credit paragraph with a second class + name", page_mut('<p class="clip-credit"><strong>Meathook', '<p class="clip-credit film"><strong>' + NAME + ' Meathook'), 1),
            ("VideoObject creator", page_mut(VO0_URL, VO0_URL[:-1] + ',"creator":{"@type":"Person","name":"' + NAME + '"}}'), 1),
            ("VideoObject contributor", page_mut(VO0_URL, VO0_URL[:-1] + ',"contributor":{"@type":"Person","name":"' + NAME + '"}}'), 1),
            ("VideoObject actor", page_mut(VO0_URL, VO0_URL[:-1] + ',"actor":{"@type":"Person","name":"' + NAME + '"}}'), 1),
            ("VideoObject publisher", page_mut(VO0_URL, VO0_URL[:-1] + ',"publisher":{"@type":"Organization","name":"' + NAME + '"}}'), 1),
            ("description ', taught by X.'", page_mut(VO0, VO0.replace('finishes."', 'finishes, taught by ' + NAME + '."')), 1),
            ("description ', by X.'", page_mut(VO0, VO0.replace('finishes."', 'finishes, by ' + NAME + '."')), 1),
            ("@type as a list with creator", page_mut('{"@type":"VideoObject","position":1', '{"@type":["VideoObject"],"creator":{"@type":"Person","name":"' + NAME + '"},"position":1'), 1),
            ("ItemList author", page_mut('"@type":"ItemList"', '"@type":"ItemList","author":{"@type":"Person","name":"' + NAME + '"}'), 1),
            ("JSON-LD tag with an extra attribute + creator", page_mut('<script type="application/ld+json">', '<script type="application/ld+json" data-x="1">{"@type":"VideoObject","name":"x","creator":{"@type":"Person","name":"' + NAME + '"}}</script><script type="application/ld+json">'), 1),
            ("shipped clip carries by", chunk_mut(lambda d: first_clip(d).__setitem__("by", NAME)), 1),
            ("shipped clip carries channel", chunk_mut(lambda d: first_clip(d).__setitem__("channel", NAME)), 1),
            ("shipped clip carries teacher", chunk_mut(lambda d: first_clip(d).__setitem__("teacher", NAME)), 1),
            ("shipped clip title names the teacher", chunk_mut(lambda d: first_clip(d).__setitem__("title", first_clip(d)["title"] + " with " + NAME)), 1),
            ("by on a clip in a subfolder chunk", extra("static/neural/content/system-records/x.json", json.dumps([{"id": "Q2aYW-20B44", "title": "t", "by": NAME}])), 1),
            ("by on a clip in concepts.json", extra("static/neural/concepts.json", json.dumps({"c": {"clips": [{"id": "Q2aYW-20B44", "title": "t", "by": NAME}]}})), 1),
            ("credit in the agent export", extra("markdown/Transitions/Advance-to-Chill-Dog.md", "**Meathook** — taught by " + NAME + " · 1:13 · [Watch on YouTube](<https://www.youtube.com/watch?v=Q2aYW-20B44>)\n"), 1),
            ("credit in llms.txt", extra("llms.txt", "Meathook to Chill Dog — taught by " + NAME + "\n"), 1),
        ]
        bad = 0
        for name, mut, want in M:
            fresh(); mut()
            r = subprocess.run([sys.executable, "-B", "scripts/check_no_names.py", "--built"], cwd=tmp, capture_output=True, text=True)
            ok = bool(r.returncode) == bool(want); bad += not ok
            why = next((l.strip() for l in r.stdout.splitlines() if l.startswith("  ")), "") if r.returncode else ""
            print(f"{'RED  ' if r.returncode else 'green'} {'ok ' if ok else 'BAD'} {name}" + (f"  :: {why[:110]}" if why else ""))
        shutil.rmtree(base); base.mkdir(parents=True)
        r = subprocess.run([sys.executable, "-B", "scripts/check_no_names.py", "--built"], cwd=tmp, capture_output=True, text=True)
        print(f"{'RED  ' if r.returncode else 'green'} {'ok ' if r.returncode else 'BAD'} zero control: empty tree"); bad += not r.returncode
        (base / PAGE_REL).parent.mkdir(parents=True); (base / PAGE_REL).write_text(page)
        r = subprocess.run([sys.executable, "-B", "scripts/check_no_names.py", "--built"], cwd=tmp, capture_output=True, text=True)
        print(f"{'RED  ' if r.returncode else 'green'} {'ok ' if r.returncode else 'BAD'} zero control: pages, no payload"); bad += not r.returncode
        print(("PASS" if not bad else "FAIL") + f": {len(M) - 1} mutants and 2 zero controls, {bad} wrong")
        return 1 if bad else 0
    finally:
        shutil.rmtree(tmp)


if __name__ == "__main__":
    sys.exit(main())
