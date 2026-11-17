#!/usr/bin/env python3
"""Mutants for the PROSE check of scripts/check_no_names.py (v1.291.0), default mode. NOT a gate: a probe that proves
the check's PINNED claims, as tests/artifacts/no_names_mutants.py does for the built page.

The rule (owner U203 a and U206 a, 17 Nov 2026): a real person's name stays in our own text only where the name is the
thing itself. Each mutant is applied alone to a scratch copy of content/ and of the emitted payload (hard links where the
filesystem allows; a mutated file is unlinked first, never written through), the gate is run, and the file is put back.
Every control must be green and every mutant red AT THE CHECK IT NAMES (a substring of the gate's own message).
  python3 scripts/regenerate_neural_data.py && python3 tests/artifacts/no_names_prose_mutants.py [k/n]
The scratch tree goes under TMPDIR (tempfile's default). About 20 seconds a mutant; `k/n` (0/3, 1/3, 2/3) runs every
n-th mutant with the control, so that n processes share the list.

The independent read of PR #437 added the second half (PROSE-R1): a listed person's surname alone (derived by the gate
from the full names), free text in a field that mostly holds wiring, a listed sentence outside its own field or twice in
it, a link that cites nothing, a Systems guide's title in a sentence nobody listed, and a lexicon that holds something
other than people or lost one of them.

RECORDED NON-KILLS (each must stay GREEN, so that nobody reads this probe as covering it; the gate's docstring says so):
  1. a surname the lexicon file NAMES as an ordinary word (`ordinary_surnames`: Brown, Hall, Hill, Shields), used alone
     ("Hall shows the entry"), passes;
  2. a name written into a GENERATED page only passes HERE: the gate reads prose from the source JSON, never from the
     page. What refuses a hand-edited page is ci-validate's "Generated content matches its generator" (the generator
     rewrites the page, and the tree then differs from the commit).
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
            p.parent.mkdir(parents=True, exist_ok=True)
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
        origin = {(r["page"], r["field"]): r["sentence"] for r in lex["origin_lines"]}
        kimura = origin[("content/Submissions/Kimura.json", ".overview")]; dlr = origin[("content/Positions/De La Riva Guard.json", ".overview")]
        assert kimura.endswith("in a 1951 victory."), "the probe's Kimura origin line moved"
        PR = "content/Transitions/Peterson Roll.json"; peterson = origin[(PR, ".overview")]
        pr = json.loads((ROOT / PR).read_text(encoding="utf-8"))
        assert isinstance(pr["attacker"]["flashcards"][0]["answer"], str) and isinstance(pr["description"], str), "the probe's Peterson Roll card or description moved"
        ESC = "content/Submissions/Americana/from Mount.json"
        assert isinstance(json.loads((ROOT / ESC).read_text(encoding="utf-8"))["defender"]["escape_clips"][0]["escape"], str), "the probe's escape label moved"
        TMD = "content/Transitions/Half Guard to Back Take.md"; TMD_END = "</section>\n\n\n\n</main>"
        def made_up(d):
            # Every entry replaced by a made-up name of a person's SHAPE, the count kept: the floor cannot see it.
            word = lambda i, a: a + "".join(chr(97 + (i // 26 ** k) % 26) for k in range(3)) + "x"
            d["full_names"] = [f"{word(i, 'Q')} {word(i, 'Z')}" for i in range(len(d["full_names"]))]
            d["single_tokens"] = [word(i, "V") for i in range(len(d["single_tokens"]))]
        def new_place(d): d["origin_lines"].append({"page": "content/Positions/X-Guard.json", "field": ".overview", "names": ["Ricardo De La Riva"], "sentence": dlr})
        def swap_ordinary(d): d["ordinary_surnames"].pop("Hill"); d["ordinary_surnames"]["Stone"] = "an ordinary word"
        def clip_key(d): d["attacker"]["clips"][0]["teacher"] = "Gordon Ryan"
        def derived_title(d):
            found = []
            def walk(x):
                if isinstance(x, dict):
                    if isinstance(x.get("id"), str) and len(x["id"]) == 11 and "title" in x and "url" not in x and not found: found.append(x)
                    for v in x.values(): walk(v)
                elif isinstance(x, list):
                    for v in x: walk(v)
            walk(d); found[0]["title"] = "Butterfly sweep, the Wardzinski way"
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
            ("a listed origin line gone from its field", text_mut("content/Submissions/Tarikoplata.json", "Named after its innovator Tarik Hopstock, who showcased it across modern no-gi competition, the Tarikoplata", "The Tarikoplata"), "an allowed origin line is gone from its field"),
            # origin lines: by record, FIELD and exact sentence, once, up to the cap (PROSE-R1)
            ("a listed origin line copied into a card's answer of its own record", append(PR, ["attacker", "flashcards", 0, "answer"], " " + peterson), "a flashcard names 'John Peterson'"),
            ("a listed origin line copied into another field of its own record", append(PR, ["description"], " " + peterson), "authored prose names 'John Peterson'"),
            ("a listed origin line twice in its own field", append("content/Submissions/Kimura.json", ["overview"], " " + kimura), "authored prose names 'Masahiko Kimura'"),
            ("a new origin place listed, and its sentence written, without the cap", both(lex_mut(new_place), append("content/Positions/X-Guard.json", ["overview"], " " + dlr)), "above its cap of 29"),
            # allowed kinds: green controls
            ("green control: a name inside a cited-source link", append(LW, ["overview"], " Instructional sources: [Gordon Ryan — a passing lesson](https://example.org/x)."), 0),
            ("a Systems guide's title in a sentence nobody listed", append(T, ["overview"], " See the Gordon Ryan Passing System."), "inside a Systems guide's title, in a sentence that is not listed"),
            ("a name in a link that cites nothing", append(LW, ["overview"], " [Gordon Ryan does it best](#)."), "authored prose names 'Gordon Ryan'"),
            ("a name in a cited link inside a card's answer", append(AOKI, ["bottom", "flashcards", 4, "answer"], " See [Gordon Ryan — a lesson](https://example.org/x)."), "a flashcard names 'Gordon Ryan'"),
            ("green control: a Systems guide names its author", append(system, ["overview"], " Taught by Gordon Ryan and John Danaher."), 0),
            ("green control: a Learning page's reference names its author", setv("content/Learning/Funneling.json", ["references", 0, "author"], "Gordon Ryan"), 0),
            ("green control: eponyms in prose (Estima grip, Peterson, Williams Guard, Kimura)", append(T, ["overview"], " Chain it with the Estima grip, a Peterson, the Williams Guard or a Kimura."), 0),
            ("green control: surnames that are an ordinary word the file names ('Shields the neck', 'Brown belt')", append(T, ["overview"], " Shields the neck first. Brown belt minimum for the live version."), 0),
            # a listed person's surname alone: derived by the gate from the full names (PROSE-R1)
            ("a listed person's surname alone, derived by the gate", append(T, ["overview"], " Wardzinski shows this."), "authored prose names 'Wardzinski'"),
            ("a derived surname as a possessive in a card's answer", append(AOKI, ["bottom", "flashcards", 4, "answer"], " Wardzinski's version differs."), "a flashcard names 'Wardzinski'"),
            ("a derived surname in a shipped clip's title", json_mut(clip_rel, derived_title), "title names the person 'Wardzinski'"),
            # every field is read but a clip's own keys and a Learning page's references (PROSE-R1)
            ("a name in a decision tree's free-text technique", setv(AOKI, ["top", "decision_tree", 0, "actions", 0, "technique"], "Gordon Ryan's body lock pass"), "authored prose names 'Gordon Ryan'"),
            ("a person in an escape's label (escape_clips[].escape)", setv(ESC, ["defender", "escape_clips", 0, "escape"], "The Lachlan Giles bridge"), "authored prose names 'Lachlan Giles'"),
            ("a new key on a source clip (`teacher`)", json_mut(T, clip_key), "authored prose names 'Gordon Ryan'"),
            ("a `references` list on a technique (only a Learning page's is a bibliography)", setv(T, ["references"], [{"author": "Gordon Ryan", "title": "A passing lesson"}]), "authored prose names 'Gordon Ryan'"),
            ("a record in a new section (content/Concepts/)", lambda: put("content/Concepts/Grip Fighting.json", json.dumps({"name": "Grip Fighting", "overview": "Gordon Ryan teaches it this way."})), "authored prose names 'Gordon Ryan'"),
            ("a name in a tag", setv(T, ["tags"], ["bjj", "transition", "Gordon Ryan"]), "authored prose names 'Gordon Ryan'"),
            ("a name in plain text after a cited-source run", append(LW, ["overview"], " Gordon Ryan shows the same pass."), "authored prose names 'Gordon Ryan'"),
            # what the app and the page are served
            ("a stale shipped card (the source is clean, the payload is not)", json_mut(chunk_rel, stale_card), "a shipped card of the deck"),
            ("a surname alone in a shipped clip's title", json_mut(clip_rel, clip_title), "title names the person 'Faria'"),
            ("a person who is no clip's `by` in a credit line", text_mut(md_rel, '<p class="clip-credit"><strong>', '<p class="clip-credit"><strong>From the Nino Schembri guard: '), "credit line names the person 'Nino Schembri'"),
            # the lists themselves
            ("the lexicon missing", remove(LEX), "is missing or unreadable"),
            ("one person taken off the lexicon", lex_mut(lambda d: d["full_names"].remove("Adam Wardzinski")), "below its floor of 232"),
            ("one person added without the floor", lex_mut(lambda d: d["full_names"].append("Zed Quuxley")), "above its floor of 232"),
            ("a gym put back on the lexicon", lex_mut(lambda d: d["full_names"].append("Gracie Barra")), "does not parse as a person's name"),
            ("every entry replaced by a made-up name, the count kept", lex_mut(made_up), "the row and the lexicon disagree"),
            ("a person's surname moved to the ordinary words", lex_mut(lambda d: d["ordinary_surnames"].__setitem__("Wardzinski", "moved")), "above its cap of 4"),
            ("an ordinary word that is no listed person's surname", lex_mut(swap_ordinary), "is no listed person's surname"),
            ("the lexicon cut to five names", lex_mut(lambda d: (d.__setitem__("full_names", d["full_names"][:5]), d.__setitem__("single_tokens", []))), "below its floor"),
            ("a technique word listed as a person: 'Kimura'", lex_mut(lambda d: d["single_tokens"].append("Kimura")), "lists the technique word 'Kimura'"),
            ("a position's own word listed as a person: 'Mount'", lex_mut(lambda d: d["single_tokens"].append("Mount")), "is a word of the technique or position name"),
            ("one label taken off the label list", json_mut(LABELS, lambda d: d["labels"].pop(next(iter(d["labels"])))), "below its floor of"),
            # zero controls
            ("zero control: no shipped cards (flashcards/ removed)", remove(f"{NEURAL}/flashcards"), "0 shipped cards"),
            # the recorded non-kills
            ("non-kill 1, recorded: a surname the file names as an ordinary word, alone ('Hall shows…')", append(T, ["overview"], " Hall shows the entry from the knee shield."), 0),
            ("non-kill 2, recorded: a name in a generated page's prose only (CI's generator parity refuses the page)", text_mut(TMD, TMD_END, "Gordon Ryan shows the entry.\n\n" + TMD_END), 0),
        ]
        # `k/n` as the only argument runs every n-th mutant (the control always), so N processes share the list.
        k, n = (int(x) for x in sys.argv[1].split("/")) if len(sys.argv) > 1 else (0, 1)
        M = [row for i, row in enumerate(M) if i == 0 or i % n == k]
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
                elif src.exists(): link_or_copy(src, p)
                elif not any(p.parent.iterdir()): p.parent.rmdir()               # a file the mutant created: its folder goes too
        n_green = sum(1 for _, _, w in M if not w); n_nk = sum(1 for name, _, _ in M if name.startswith("non-kill"))
        print(("PASS" if not bad else "FAIL") + f": {len(M) - n_green} mutants red at their named checks and {n_green} green controls ({n_nk} of them a recorded non-kill), {bad} wrong")
        return 1 if bad else 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
