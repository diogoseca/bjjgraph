#!/usr/bin/env python3
"""Mutants for scripts/check_no_names.py --built (v1.289.0; the names lexicon in v1.291.0). NOT a gate: a probe that proves
the gate's PINNED claims on a built page. The prose check's own mutants (source prose, source cards, origin lines, the
lexicon's self-checks) are tests/artifacts/no_names_prose_mutants.py, in default mode.

The independent read of PR #433 built the first 25 mutants (19 survived the v1.288.0 gate); the read of PR #435 added the
rest (the export uncounted, a removed label back, a `by` beside a `url`, an unreadable VideoObject block, a name list
that shrank). v1.291.0 added the lexicon's four: a person by surname in a credit, in a shipped title and in an exported
credit, and a shipped card that names one. Run on a scratch tree assembled from a BUILT site: one page (Transitions/Advance-to-Chill-Dog), one dossier
chunk, one deck chunk, the page's agent export, llms.txt, the label list, the names lexicon, and a link to content/ (the
gate's name list and the prose it reads). Each mutant is
applied alone to a fresh copy; every control must be green and every mutant red, the new ones at the check they NAME (a
substring of the gate's own message); two zero controls (an empty tree, pages with no payload) must be red.
  python3 tests/artifacts/no_names_mutants.py [built-tree]   # default source/public, from npm run build
The scratch tree goes under TMPDIR (tempfile's default).
"""
import json, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUB = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "source/public"
EXPORT_REL = "markdown/Transitions/Advance-to-Chill-Dog.md"
LABELS_REL = "tests/artifacts/no_names_labels.json"
LEXICON_REL = "tests/artifacts/no_names_lexicon.json"
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
    deck_chunk = next(c for c in sorted((PUB / "static/neural/flashcards").glob("*.json")) if c.name != "_index.json" and not c.name.startswith("live-"))
    export = (PUB / EXPORT_REL).read_text(); llms = (PUB / "llms.txt").read_text()
    assert "Watch on YouTube" in export, "the probe's export page has no credit line"
    tmp = Path(tempfile.mkdtemp(prefix="nonames-mut-"))
    try:
        (tmp / "scripts").mkdir(); shutil.copy(ROOT / "scripts/check_no_names.py", tmp / "scripts/")
        base = tmp / "source/public"; content = tmp / "content"; labels = tmp / LABELS_REL

        def fresh():
            if base.exists(): shutil.rmtree(base)
            (base / "Transitions").mkdir(parents=True); (base / PAGE_REL).write_text(page)
            (base / "static/neural/content").mkdir(parents=True)
            shutil.copy(chunk_with_clip, base / "static/neural/content" / chunk_with_clip.name)
            (base / "static/neural/flashcards").mkdir(parents=True); shutil.copy(deck_chunk, base / "static/neural/flashcards" / deck_chunk.name)
            (base / EXPORT_REL).parent.mkdir(parents=True); (base / EXPORT_REL).write_text(export)
            (base / "llms.txt").write_text(llms)
            if content.is_symlink(): content.unlink()
            elif content.exists(): shutil.rmtree(content)
            content.symlink_to(ROOT / "content")
            labels.parent.mkdir(parents=True, exist_ok=True); shutil.copy(ROOT / LABELS_REL, labels)
            shutil.copy(ROOT / LEXICON_REL, tmp / LEXICON_REL)

        def short_names():
            # a content/ whose clips name five people only: the list falls far below NAME_FLOOR
            content.unlink(); content.mkdir()
            (content / "x.json").write_text(json.dumps({"clips": [{"id": "Q2aYW-20B44", "title": "t", "by": f"Person {i}"} for i in range(5)]}))
            (base / PAGE_REL).write_text(page.replace(CREDIT0, CREDIT0.replace("</strong>", " by Gracie Charlottesville</strong>"), 1))

        def both(*fs):
            return lambda: [f() for f in fs]

        def page_mut(old, new):
            return lambda: (base / PAGE_REL).write_text(page.replace(old, new, 1))

        def chunk_mut(fn):
            def m():
                p = base / "static/neural/content" / chunk_with_clip.name; d = json.loads(p.read_text()); fn(d); p.write_text(json.dumps(d))
            return m

        def card_mut():
            p = base / "static/neural/flashcards" / deck_chunk.name; d = json.loads(p.read_text())
            next(iter(d.values()))["cards"][0]["a"] += " Kesting shows it."; p.write_text(json.dumps(d))

        def extra(rel, text):
            def m():
                p = base / rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(text)
            return m

        s = lambda t: CREDIT0.replace("</strong>", "</strong>" + t)
        t = lambda title: CREDIT0.replace("Meathook to Chill Dog to kimura finishes", title)
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
            # the read of PR #435 (NONAMES2-R1): each red at the check it names
            ("green control: eponyms in a credit (the London, Kimura, De La Riva)", page_mut(CREDIT0, t("The London and Why It Left the System: Kimura from De La Riva")), 0),
            ("the agent export removed (no markdown/, no llms.txt)", lambda: (shutil.rmtree(base / "markdown"), (base / "llms.txt").unlink()), "the agent export is absent"),
            ("no llms.txt", lambda: (base / "llms.txt").unlink(), "llms.txt: absent"),
            ("an export with 0 credit lines", extra(EXPORT_REL, "# Advance to Chill Dog\n\nNo film here.\n"), "0 exported credit lines"),
            ("a removed label back in a credit: 'TMG Clips #104 - …'", page_mut(CREDIT0, t("TMG Clips #104 - Easy Shin To Shin Sweep")), "removed label 'TMG Clips'"),
            ("the owner's case in a credit: 'Why left the 10th Planet system'", page_mut(CREDIT0, t("Why left the 10th Planet system")), "removed label '10th Planet'"),
            ("a gym as a glued tag in a credit: '…closedguard#graciewestchase'", page_mut(CREDIT0, t("Breaking posture in closed guard #closedguard#graciewestchase")), "removed label '#graciewestchase'"),
            ("a removed label in a shipped clip's title", chunk_mut(lambda d: first_clip(d).__setitem__("title", "WazaTube: Monoplata Counter")), "title carries the removed label 'WazaTube'"),
            ("a removed label in an exported credit", extra(EXPORT_REL, "**MTS 195 Advanced Arm Triangle** · 1:13 · [Watch on YouTube](<https://www.youtube.com/watch?v=Q2aYW-20B44>)\n"), "exported credit carries the removed label 'MTS'"),
            ("the label list emptied", lambda: labels.write_text(json.dumps({"labels": {}})), "0 labels on the list"),
            ("the label list missing", lambda: labels.unlink(), "0 labels on the list"),
            ("by on a shipped clip that also has url", chunk_mut(lambda d: first_clip(d).update({"by": NAME, "url": "https://example.org/x"})), "ships a `by` key"),
            ("by on a clip in a .js under static/neural", extra("static/neural/app/x.js", 'var c=[{"id":"Q2aYW-20B44","title":"t","by":"' + NAME + '"}];'), "ships a `by` key"),
            ("by on a clip in a JSON file that does not parse", extra("static/neural/content/broken.json", '[{"id":"Q2aYW-20B44","title":"t","by":"' + NAME + '"},]'), "ships a `by` key"),
            ("a VideoObject block that does not parse", page_mut('<script type="application/ld+json">', '<script type="application/ld+json">{"@type":"VideoObject","name":"x","creator":{"name":"' + NAME + '"},}</script><script type="application/ld+json">'), "does not parse"),
            ("the name list shrunk to 5, a gym back in a credit", short_names, "below its floor"),
            # v1.291.0, the names lexicon (persons by surname, held in titles and credits as in prose and cards)
            ("a person by surname in a credit: '… - Faria Sweep'", page_mut(CREDIT0, t("Deep Half Sweep - Faria Sweep")), "credit line names the person 'Faria'"),
            ("a person by surname in a shipped clip's title", chunk_mut(lambda d: first_clip(d).__setitem__("title", "Danaher's kimura details")), "title names the person 'Danaher'"),
            ("a person by surname in an exported credit", extra(EXPORT_REL, "**Deep Half Sweep - Faria Sweep** · 1:13 · [Watch on YouTube](<https://www.youtube.com/watch?v=Q2aYW-20B44>)\n"), "an exported credit names the person 'Faria'"),
            ("a shipped card names a person", card_mut, "a shipped card of the deck"),
            ("no deck chunk under static/neural/flashcards", lambda: shutil.rmtree(base / "static/neural/flashcards"), "0 shipped cards"),
        ]
        bad = 0
        for name, mut, want in M:
            fresh(); mut()
            r = subprocess.run([sys.executable, "-B", "scripts/check_no_names.py", "--built"], cwd=tmp, capture_output=True, text=True)
            found = [l.strip() for l in r.stdout.splitlines() if l.startswith("  ")] if r.returncode else []
            named = [l for l in found if isinstance(want, str) and want in l]      # a new mutant must be red AT ITS CHECK
            ok = bool(r.returncode) == bool(want) and (not isinstance(want, str) or bool(named)); bad += not ok
            why = (named or found or [""])[0]
            print(f"{'RED  ' if r.returncode else 'green'} {'ok ' if ok else 'BAD'} {name}" + (f"  :: {why[:120]}" if why else ""))
        fresh(); shutil.rmtree(base); base.mkdir(parents=True)
        r = subprocess.run([sys.executable, "-B", "scripts/check_no_names.py", "--built"], cwd=tmp, capture_output=True, text=True)
        print(f"{'RED  ' if r.returncode else 'green'} {'ok ' if r.returncode else 'BAD'} zero control: empty tree"); bad += not r.returncode
        (base / PAGE_REL).parent.mkdir(parents=True); (base / PAGE_REL).write_text(page)
        r = subprocess.run([sys.executable, "-B", "scripts/check_no_names.py", "--built"], cwd=tmp, capture_output=True, text=True)
        print(f"{'RED  ' if r.returncode else 'green'} {'ok ' if r.returncode else 'BAD'} zero control: pages, no payload"); bad += not r.returncode
        n_green = sum(1 for _, _, w in M if not w)
        print(("PASS" if not bad else "FAIL") + f": {len(M) - n_green} mutants, {n_green} green controls and 2 zero controls, {bad} wrong")
        return 1 if bad else 0
    finally:
        shutil.rmtree(tmp)


if __name__ == "__main__":
    sys.exit(main())
