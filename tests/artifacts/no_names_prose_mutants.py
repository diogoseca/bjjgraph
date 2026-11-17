#!/usr/bin/env python3
"""Mutants for the PROSE check of scripts/check_no_names.py (v1.291.0), default mode. NOT a gate: a probe that proves
the check's PINNED claims, as tests/artifacts/no_names_mutants.py does for the built page.

The rule (owner U203 a and U206 a, 17 Nov 2026): a real person's name stays in our own text only where the name is the
thing itself. Each mutant is applied alone to a scratch copy of content/ and of the emitted payload (hard links where the
filesystem allows; a mutated file is unlinked first, never written through), the gate is run, and the file is put back.
Every control must be green and every mutant red AT THE CHECK IT NAMES (a substring of the gate's own message).
  python3 scripts/regenerate_neural_data.py && python3 tests/artifacts/no_names_prose_mutants.py
The scratch tree goes under TMPDIR (tempfile's default). About 20 seconds a mutant.

RECORDED NON-KILL (UNGUARDED, and the docstring of the gate says so): a surname that is an ordinary English word, used
alone and listed by nobody ("Hall shows the entry"), passes: mutant "non-kill" below must stay GREEN, so that nobody
reads this probe as covering it.
"""
import json, os, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NEURAL = "source/quartz/static/neural"
LEX, LABELS = "tests/artifacts/no_names_lexicon.json", "tests/artifacts/no_names_labels.json"


def link_or_copy(a, b):
    try: os.link(a, b)
    except OSError: shutil.copy2(a, b)


def main():
    assert (ROOT / NEURAL / "flashcards").is_dir(), "no emitted payload: run python3 scripts/regenerate_neural_data.py first"
    tmp = Path(tempfile.mkdtemp(prefix="nonames-prose-mut-"))
    touched = []
    try:
        (tmp / "scripts").mkdir(); shutil.copy(ROOT / "scripts/check_no_names.py", tmp / "scripts/")
        (tmp / "tests/artifacts").mkdir(parents=True)
        for rel in (LEX, LABELS): shutil.copy(ROOT / rel, tmp / rel)
        shutil.copytree(ROOT / "content", tmp / "content", copy_function=link_or_copy)
        (tmp / NEURAL).parent.mkdir(parents=True)
        shutil.copytree(ROOT / NEURAL, tmp / NEURAL, copy_function=link_or_copy)

        def put(rel, text):
            p = tmp / rel
            if p.exists() or p.is_symlink(): p.unlink()
            p.write_text(text, encoding="utf-8"); touched.append(rel)

        def text_mut(rel, old, new):
            def m():
                t = (ROOT / rel).read_text(encoding="utf-8"); assert old in t, f"the probe's anchor moved in {rel}: {old[:60]!r}"
                put(rel, t.replace(old, new, 1))
            return m

        def json_mut(rel, fn):
            def m():
                d = json.loads((ROOT / rel).read_text(encoding="utf-8")); fn(d)
                put(rel, json.dumps(d, ensure_ascii=False, indent=2) + "\n")
            return m

        def append(rel, key_path, tail):
            def fn(d):
                x = d
                for k in key_path[:-1]: x = x[k]
                assert isinstance(x[key_path[-1]], str); x[key_path[-1]] += tail
            return json_mut(rel, fn)

        def setv(rel, key_path, value):
            def fn(d):
                x = d
                for k in key_path[:-1]: x = x[k]
                x[key_path[-1]] = value
            return json_mut(rel, fn)

        def lex_mut(fn): return json_mut(LEX, fn)

        def both(*fs): return lambda: [f() for f in fs]

        def remove(rel):
            def m():
                p = tmp / rel
                shutil.rmtree(p) if p.is_dir() else p.unlink()
                touched.append(rel)
            return m

        lex = json.loads((ROOT / LEX).read_text(encoding="utf-8"))
        origin = {r["page"]: r["sentence"] for r in lex["origin_lines"]}
        kimura = origin["content/Submissions/Kimura.json"]; dlr = origin["content/Positions/De La Riva Guard.json"]
        assert kimura.endswith("in a 1951 victory."), "the probe's Kimura origin line moved"
        chunk = next(p for p in sorted((ROOT / NEURAL / "flashcards").glob("*.json")) if p.name != "_index.json" and not p.name.startswith("live-"))
        chunk_rel = f"{NEURAL}/flashcards/{chunk.name}"
        def stale_card(d):
            deck = next(iter(d.values())); deck["cards"][0]["a"] += " Kesting shows it."
        clip_chunk = next(p for p in sorted((ROOT / NEURAL / "content").glob("*.json")) if '"title"' in p.read_text(encoding="utf-8"))
        clip_rel = f"{NEURAL}/content/{clip_chunk.name}"
        def clip_title(d):
            found = []
            def walk(x):
                if isinstance(x, dict):
                    if isinstance(x.get("id"), str) and len(x["id"]) == 11 and "title" in x and "url" not in x and not found: found.append(x)
                    for v in x.values(): walk(v)
                elif isinstance(x, list):
                    for v in x: walk(v)
            walk(d); found[0]["title"] = "Deep Half Sweep - Faria Sweep"
        md = next(p for p in sorted((ROOT / "content/Transitions").glob("*.md")) if '<p class="clip-credit"><strong>' in p.read_text(encoding="utf-8"))
        md_rel = md.relative_to(ROOT).as_posix()
        system = sorted((ROOT / "content/Systems").glob("*.json"))[0].relative_to(ROOT).as_posix()
        T = "content/Transitions/Half Guard to Back Take.json"; LW = "content/Positions/Leg Weave.json"
        AOKI = "content/Positions/Aoki Lock Control.json"
        assert "Instructional sources:" in json.loads((ROOT / LW).read_text(encoding="utf-8"))["overview"], "the probe's cited-source page moved"

        M = [
            ("control: unmodified", lambda: None, 0),
            # authored prose
            ("a full name back in a technique's overview", append(T, ["overview"], " Developed by experts like Gordon Ryan."), "authored prose names 'Gordon Ryan'"),
            ("a full name in lower case", append(T, ["overview"], " As gordon ryan teaches it."), "authored prose names 'gordon ryan'"),
            ("a surname alone", append(T, ["position_integration"], " It follows the Danaher approach."), "authored prose names 'Danaher'"),
            ("a possessive with a curly apostrophe", append(T, ["overview"], " In Kesting’s version the hook comes first."), "authored prose names 'Kesting'"),
            # cards in the source
            ("a name in a card's answer (source)", append(AOKI, ["bottom", "flashcards", 4, "answer"], " Kesting shows that post being collected."), "a flashcard names 'Kesting'"),
            ("a name in a card's wrong option (source)", setv(AOKI, ["bottom", "flashcards", 4, "distractors", "plausible", 0], "Ask Eddie Bravo"), "a flashcard names 'Eddie Bravo'"),
            # origin lines: by page and exact sentence
            ("a second person added to a listed origin line", text_mut("content/Submissions/Kimura.json", "in a 1951 victory.", "in a 1951 victory over Helio Gracie."), "authored prose names 'Helio Gracie'"),
            ("a listed origin line copied onto another page", append("content/Positions/X-Guard.json", ["overview"], " " + dlr), "authored prose names 'Ricardo De La Riva'"),
            ("a listed origin line gone from its page", text_mut("content/Submissions/Tarikoplata.json", "Named after its innovator Tarik Hopstock, who showcased it across modern no-gi competition, the Tarikoplata", "The Tarikoplata"), "an allowed origin line is gone from its page"),
            # allowed kinds: green controls
            ("green control: a name inside a cited-source link", append(LW, ["overview"], " Instructional sources: [Gordon Ryan — a passing lesson](https://example.org/x)."), 0),
            ("green control: a Systems guide's title inside prose", append(T, ["overview"], " See the Gordon Ryan Passing System."), 0),
            ("green control: a Systems guide names its author", append(system, ["overview"], " Taught by Gordon Ryan and John Danaher."), 0),
            ("green control: a Learning page's reference names its author", setv("content/Learning/Funneling.json", ["references", 0, "author"], "Gordon Ryan"), 0),
            ("green control: eponyms in prose (Estima grip, Peterson, Williams Guard, Kimura)", append(T, ["overview"], " Chain it with the Estima grip, a Peterson, the Williams Guard or a Kimura."), 0),
            ("a name in plain text after a cited-source run", append(LW, ["overview"], " Gordon Ryan shows the same pass."), "authored prose names 'Gordon Ryan'"),
            # what the app and the page are served
            ("a stale shipped card (the source is clean, the payload is not)", json_mut(chunk_rel, stale_card), "a shipped card of the deck"),
            ("a surname alone in a shipped clip's title", json_mut(clip_rel, clip_title), "title names the person 'Faria'"),
            ("a person who is no clip's `by` in a credit line", text_mut(md_rel, '<p class="clip-credit"><strong>', '<p class="clip-credit"><strong>From the Nino Schembri guard: '), "credit line names the person 'Nino Schembri'"),
            # the lists themselves
            ("the lexicon missing", remove(LEX), "is missing or unreadable"),
            ("the lexicon cut to five names", lex_mut(lambda d: (d.__setitem__("full_names", d["full_names"][:5]), d.__setitem__("single_tokens", []))), "below its floor"),
            ("a technique word listed as a person: 'Kimura'", lex_mut(lambda d: d["single_tokens"].append("Kimura")), "lists the technique word 'Kimura'"),
            ("a position's own word listed as a person: 'Mount'", lex_mut(lambda d: d["single_tokens"].append("Mount")), "is a word of the technique or position name"),
            ("one label taken off the label list", json_mut(LABELS, lambda d: d["labels"].pop(next(iter(d["labels"])))), "below its floor of"),
            # zero controls
            ("zero control: no shipped cards (flashcards/ removed)", remove(f"{NEURAL}/flashcards"), "0 shipped cards"),
            # the recorded non-kill
            ("non-kill, recorded: an unlisted ordinary-word surname alone ('Hall shows…')", append(T, ["overview"], " Hall shows the entry from the knee shield."), 0),
        ]
        bad = 0
        for name, mut, want in M:
            touched.clear(); mut()
            r = subprocess.run([sys.executable, "-B", "scripts/check_no_names.py"], cwd=tmp, capture_output=True, text=True)
            found = [l.strip() for l in r.stdout.splitlines() if l.startswith("  ")] if r.returncode else []
            named = [l for l in found if isinstance(want, str) and want in l]
            ok = bool(r.returncode) == bool(want) and (not isinstance(want, str) or bool(named)); bad += not ok
            why = (named or found or [""])[0]
            print(f"{'RED  ' if r.returncode else 'green'} {'ok ' if ok else 'BAD'} {name}" + (f"  :: {why[:150]}" if why else "") + (f"  [{len(found)} finding(s)]" if found else ""), flush=True)
            for rel in dict.fromkeys(touched):                                    # put every touched path back
                p, src = tmp / rel, ROOT / rel
                if p.is_dir(): shutil.rmtree(p)
                elif p.exists(): p.unlink()
                if src.is_dir(): shutil.copytree(src, p, copy_function=link_or_copy)
                else: link_or_copy(src, p)
        n_green = sum(1 for _, _, w in M if not w)
        print(("PASS" if not bad else "FAIL") + f": {len(M) - n_green} mutants red at their named checks and {n_green} green controls (one of them the recorded non-kill), {bad} wrong")
        return 1 if bad else 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
