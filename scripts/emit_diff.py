#!/usr/bin/env python3
"""Diff a candidate emitted site tree against the GOLDEN emit, and classify every
difference by what it costs.

    python3 scripts/emit_diff.py GOLDEN.json.gz CANDIDATE.json.gz \
        [--allow normalization.json] [--json report.json] [--examples 5]

Exit codes
    0   no differences outside the declared normalizations
    1   differences found in the CANDIDATE -- including a regressed coverage count
    2   the DIFFER is not trustworthy, so there is no verdict on the candidate at all
        (floor breach, an unparseable page, a normalization rule that matched nothing,
        an empty manifest)

    1 and 2 are kept apart on purpose. If a candidate that genuinely dropped canonicals
    also exited 2, then "2" would mean "something is wrong" in general, the operator
    would learn to wave it through, and the instrument check would stop being one.

WHY EXIT 2 EXISTS
-----------------
CLAUDE.md 6.6: "A CHECK THAT NEVER RAN REPORTS CLEAN -- absence produces a plausible
answer." A differ whose HTML extractor silently broke would find no SEO differences and
print the same "no differences" a perfect migration prints. So every run re-derives the
positive coverage counts from both manifests and hard-fails when:

  * either tree has zero HTML pages, or fewer than HARD_FLOORS says;
  * any page failed to parse, or any JSON-LD block did not parse, or any file was unreadable;
  * a declared normalization rule suppressed ZERO differences (a rule matching nothing
    is a rule that has rotted -- the same failure the `ruleset_surfaces.json` gate
    catches for enumerations).

NORMALIZATION
-------------
Nothing is normalized by default. Not timestamps, not hashes, not build ids. A rule only
exists once a difference has actually been OBSERVED between two builds of identical
source, and each rule must carry a `reason`. The rules live in a JSON file passed with
--allow, so they are reviewable in one place and greppable in the report:

  {"rules": [
     {"id": "...", "field": "<regex over the field path>",
      "path": "<regex over the file path, optional>",
      "reason": "why this varies between two builds of identical source",
      "evidence": "how it was observed"}
  ]}

Each rule prints the number of differences it suppressed. A rule that suppresses
everything is visible as a large number, not as a clean report.
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
from collections import defaultdict

# A tree this small is not this site; it is a broken or partial build, and no verdict
# from it is worth anything. Deliberately far below the real figures (~15,700 files /
# ~6,100 pages) so it catches catastrophe, not drift -- drift is caught by comparing
# the candidate's coverage against the golden's, below.
HARD_FLOORS = {
    "files": 1000,
    "html_pages": 1000,
    "jsonld_blocks": 1000,
    "meta_tags": 1000,
}

# Coverage counts that must not regress from golden to candidate. A migration that is
# "at no loss" cannot emit fewer canonicals than it used to.
COVERAGE_MUST_NOT_DROP = [
    "files", "html_pages", "pages_with_title", "pages_with_canonical",
    "pages_with_description", "pages_with_og_title", "pages_with_article",
    "pages_with_outside_links", "jsonld_blocks", "meta_tags", "head_links",
    "article_headings", "article_links", "outside_links",
    "semantic_xml", "semantic_json", "semantic_text", "static_files", "gzip_files",
]

SEVERITIES = [
    "S0_FILE_SET",
    "S1_SEO_HEAD",
    "S2_CONTENT",
    "S3_SHELL",
    "S4_ASSET",
    "S5_FORMAT_ONLY",
]

SEV_BLURB = {
    "S0_FILE_SET": "a URL appeared or disappeared",
    "S1_SEO_HEAD": "something a crawler reads out of <head> changed",
    "S2_CONTENT": "the <article>, or a semantic data artifact, changed",
    "S3_SHELL": "the ungated surface outside <article> changed (nav, footer, selectors)",
    "S4_ASSET": "a stylesheet, script, image or asset reference changed -- NOT cosmetic: "
                "index.css / prescript.js / postscript.js are emitter output too",
    "S5_FORMAT_ONLY": "bytes moved while every field the differ extracted stayed equal "
                      "(only reachable for a file that WAS parsed)",
}


# ---------------------------------------------------------------------------
# Field -> severity
# ---------------------------------------------------------------------------

SEO_META_PREFIXES = (
    "property=og:", "name=twitter:", "name=description", "name=robots",
    "name=keywords", "charset=", "property=article:", "name=generator",
)


SEMANTIC_CLASSES = ("html", "xml", "json_semantic", "text_semantic", "gzip")


def severity_for(cls: str, field: str) -> str:
    if cls == "html":
        if field in ("title", "n_title", "canonical", "html_attrs", "doctype",
                     "jsonld", "jsonld_types", "n_jsonld", "n_jsonld_unparseable"):
            return "S1_SEO_HEAD"
        if field.startswith("meta_map[") or field.startswith("meta["):
            key = field.split("[", 1)[1].rstrip("]").strip("'\"")
            return "S1_SEO_HEAD" if key.startswith(SEO_META_PREFIXES) else "S4_ASSET"
        if field.startswith("links[") and "canonical" in field:
            return "S1_SEO_HEAD"
        if field in ("n_meta", "n_links") or field.startswith("head_seq"):
            return "S1_SEO_HEAD"
        if field.startswith("marker["):
            # #quartz-root / #sidebar-overlay / nav / search / __rollPositions are the
            # shell; article / robots are crawler-facing.
            return ("S1_SEO_HEAD" if "meta:robots" in field or "tag:article" in field
                    else "S3_SHELL")
        if field.startswith("article"):
            return "S2_CONTENT"
        if field.startswith("outside") or field.startswith("body_regions") or field == "body_attrs":
            return "S3_SHELL"
        if field in ("jsonld_raw_sha", "head_raw_sha", "meta_order"):
            return "S5_FORMAT_ONLY"
        if field == "parse_warnings":
            return "S2_CONTENT"
        return "S4_ASSET"
    if cls in ("xml", "json_semantic", "text_semantic"):
        if field in ("order_sha",):
            return "S5_FORMAT_ONLY"
        return "S2_CONTENT"
    if cls in ("json_opaque", "text_opaque"):
        # the neural payload chunks and the emitted markdown copies -- content, not chrome
        return "S2_CONTENT"
    if cls in ("css", "js", "binary", "gzip"):
        return "S4_ASSET"
    return "S4_ASSET"


# ---------------------------------------------------------------------------
# Fingerprint comparison
# ---------------------------------------------------------------------------

def _short(v, n=180):
    s = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    return s if len(s) <= n else s[:n] + f"...<+{len(s) - n}>"


def diff_html(g: dict, c: dict):
    """Yield (field, golden, candidate). Scalars compared directly; lists compared as
    ordered sequences AND, where order is not meaningful, as sets -- reported as
    distinct fields so neither reading is lost."""
    for k in ("parse_error",):
        if g.get(k) != c.get(k):
            yield k, g.get(k), c.get(k)
            return
    if (c.get("parse_warnings") or []) != (g.get("parse_warnings") or []):
        yield "parse_warnings", g.get("parse_warnings"), c.get("parse_warnings")

    for k in ("doctype", "html_attrs", "title", "n_title", "canonical", "n_meta",
              "n_links", "n_jsonld", "n_jsonld_unparseable", "jsonld_types",
              "head_other", "head_raw_sha", "n_head_scripts", "body_attrs",
              "body_regions"):
        if g.get(k) != c.get(k):
            yield k, g.get(k), c.get(k)

    # <head> element order AND attribute order. Not normalizable: build_share_shell.mjs
    # matches literal strings against this markup, so a reorder is a production failure.
    if (g.get("head_seq") or []) != (c.get("head_seq") or []):
        gseq, cseq = g.get("head_seq") or [], c.get("head_seq") or []
        if [t for t, _a in gseq] != [t for t, _a in cseq]:
            yield "head_seq.order", [t for t, _a in gseq], [t for t, _a in cseq]
        else:
            for i, (gt, ct) in enumerate(zip(gseq, cseq)):
                if gt != ct:
                    yield f"head_seq.attrs[{gt[0]}]", gt[1], ct[1]
                    break

    # named structural markers -- each one's silent loss is invisible to current gates
    gm2, cm2 = g.get("markers") or {}, c.get("markers") or {}
    for key in sorted(set(gm2) | set(cm2)):
        if gm2.get(key) != cm2.get(key):
            yield f"marker[{key}]", gm2.get(key), cm2.get(key)

    # meta: per-key, so "og:description changed" is one field and not "the meta list"
    gm, cm = g.get("meta_map") or {}, c.get("meta_map") or {}
    for key in sorted(set(gm) | set(cm)):
        if gm.get(key) != cm.get(key):
            yield f"meta_map[{key}]", gm.get(key), cm.get(key)
    if [k for k, _ in (g.get("meta") or [])] != [k for k, _ in (c.get("meta") or [])]:
        yield "meta_order", shashort(g.get("meta")), shashort(c.get("meta"))

    # head links, keyed by (rel, href) so an added/removed one names itself
    gl = {(r, h): a for r, h, _t, a in (g.get("links") or [])}
    cl = {(r, h): a for r, h, _t, a in (c.get("links") or [])}
    for key in sorted(set(gl) | set(cl)):
        if gl.get(key) != cl.get(key):
            def side(v):
                return "<absent>" if v is None else f"href={key[1]} {v}"
            yield f"links[rel={key[0]}]", side(gl.get(key)), side(cl.get(key))

    # JSON-LD: semantic first (canonical, key-sorted), raw second
    gj, cj = g.get("jsonld") or [], c.get("jsonld") or []
    if sorted(map(str, gj)) != sorted(map(str, cj)):
        gs, cs = set(map(str, gj)), set(map(str, cj))
        for lost in sorted(gs - cs):
            yield "jsonld", lost, None
        for got in sorted(cs - gs):
            yield "jsonld", None, got
    elif (g.get("jsonld_raw_sha") or []) != (c.get("jsonld_raw_sha") or []):
        yield "jsonld_raw_sha", g.get("jsonld_raw_sha"), c.get("jsonld_raw_sha")

    gs_ = {tuple(s) for s in (g.get("head_scripts") or [])}
    cs_ = {tuple(s) for s in (c.get("head_scripts") or [])}
    if gs_ != cs_:
        yield "head_scripts", sorted(map(list, gs_ - cs_)), sorted(map(list, cs_ - gs_))

    ga, ca = g.get("article"), c.get("article")
    if (ga is None) != (ca is None):
        yield "article", "present" if ga else None, "present" if ca else None
    elif ga and ca:
        for k in ("headings", "n_headings", "n_links", "n_images", "n_images_no_alt",
                  "text_sha", "text_len", "attrs", "tags"):
            if ga.get(k) != ca.get(k):
                yield f"article.{k}", ga.get(k), ca.get(k)
        gL = {tuple(x) for x in ga.get("links") or []}
        cL = {tuple(x) for x in ca.get("links") or []}
        if gL != cL:
            yield "article.links", sorted(map(list, gL - cL))[:8], sorted(map(list, cL - gL))[:8]
        gI = {tuple(x) for x in ga.get("images") or []}
        cI = {tuple(x) for x in ca.get("images") or []}
        if gI != cI:
            yield "article.images", sorted(map(list, gI - cI))[:8], sorted(map(list, cI - gI))[:8]

    go, co = g.get("outside") or {}, c.get("outside") or {}
    for k in ("n_links", "link_targets", "selectors", "n_selectors", "tags"):
        if go.get(k) != co.get(k):
            if k in ("link_targets", "selectors"):
                gset, cset = set(go.get(k) or []), set(co.get(k) or [])
                yield f"outside.{k}", sorted(gset - cset)[:12], sorted(cset - gset)[:12]
            else:
                yield f"outside.{k}", go.get(k), co.get(k)


def shashort(v):
    return _short(v, 120)


def diff_generic(g: dict, c: dict, keys):
    for k in keys:
        if g.get(k) != c.get(k):
            if isinstance(g.get(k), list) and isinstance(c.get(k), list):
                gs, cs = set(map(str, g[k])), set(map(str, c[k]))
                yield k, sorted(gs - cs)[:12], sorted(cs - gs)[:12]
            elif isinstance(g.get(k), dict) and isinstance(c.get(k), dict):
                lost = {kk: v for kk, v in g[k].items() if c[k].get(kk) != v}
                got = {kk: v for kk, v in c[k].items() if g[k].get(kk) != v}
                yield k, dict(list(lost.items())[:8]), dict(list(got.items())[:8])
            else:
                yield k, g.get(k), c.get(k)


def diff_record(rel, gr, cr):
    """All differences for one path, as (severity, field, golden, candidate)."""
    cls = gr.get("cls", "?")
    out = []
    gfp, cfp = gr.get("fp"), cr.get("fp")

    if cls == "html":
        if gfp is None or cfp is None:
            if gr["sha"] != cr["sha"]:
                out.append(("S4_ASSET", "sha", gr["sha"][:12], cr["sha"][:12]))
        else:
            for f, gv, cv in diff_html(gfp, cfp):
                out.append((severity_for(cls, f), f, gv, cv))
    elif cls == "xml" and gfp and cfp:
        out += [(severity_for(cls, f), f, gv, cv) for f, gv, cv in
                diff_generic(gfp, cfp, ("n_entries", "root_tag", "keys_sorted",
                                        "by_key", "order_sha"))]
    elif cls == "json_semantic" and gfp and cfp:
        out += [(severity_for(cls, f), f, gv, cv) for f, gv, cv in
                diff_generic(gfp, cfp, ("parse_error", "type", "canon_sha", "n_keys",
                                        "keys", "n_items", "per_key_sha", "item_shas"))]
    elif cls == "text_semantic" and gfp and cfp:
        out += [(severity_for(cls, f), f, gv, cv) for f, gv, cv in
                diff_generic(gfp, cfp, ("n_lines", "nonblank", "set_sha", "order_sha"))]
    elif cls == "gzip" and gfp and cfp:
        for f, gv, cv in diff_generic(gfp, cfp, ("decompress_error", "inner_sha",
                                                 "inner_size", "header_mtime")):
            # the decompressed payload is the contract; the container is not
            out.append(("S5_FORMAT_ONLY" if f == "header_mtime" else "S2_CONTENT",
                        f, gv, cv))

    # The byte hash is checked for EVERY class, always -- including html.
    if gr["sha"] != cr["sha"]:
        g_side = f"{gr['sha'][:12]} ({gr['size']:,}B)"
        c_side = f"{cr['sha'][:12]} ({cr['size']:,}B)"
        parsed_both = cls in SEMANTIC_CLASSES and gfp is not None and cfp is not None
        if parsed_both:
            # Only here can "the bytes moved but nothing we extracted did" be an honest
            # statement, because something really was extracted and really did match.
            if not out:
                out.append(("S5_FORMAT_ONLY", "sha", g_side, c_side))
        else:
            # No semantic view of this file exists, so silence about its fields is
            # ignorance, not equality. Never S5.
            out.append((severity_for(cls, "sha"), "sha", g_side, c_side))
    return out


# ---------------------------------------------------------------------------
# Normalization rules
# ---------------------------------------------------------------------------

class Allow:
    """Declared normalizations.

    MODES. `mode` defaults to "value", which is the important one and is lifted straight
    from this repo's own prior art: scripts/check_seo_parity.py does not drop its volatile
    date fields, it replaces the VALUE with a sentinel and still compares PRESENCE, because
    "the timestamp moved" and "the tag is gone" are not the same event and only one of them
    is acceptable.

      value  (default)  suppress only when BOTH sides have a non-empty value and only the
                        value differs. If the field vanished, appeared, or emptied on one
                        side, the difference is REPORTED however well the rule matches.
      full              suppress unconditionally. Needs a reason that explains why the
                        field disappearing would also be acceptable -- which is rare, so
                        `full` is refused unless the rule spells it out in `absence_ok`.
    """

    def __init__(self, spec):
        self.rules = []
        for r in (spec or {}).get("rules", []):
            for req in ("id", "field", "reason", "evidence"):
                if not r.get(req):
                    sys.exit(f"normalization rule {r.get('id', '?')} is missing '{req}' "
                             f"-- every rule states why the value varies between two "
                             f"builds of identical source")
            mode = r.get("mode", "value")
            if mode not in ("value", "full"):
                sys.exit(f"normalization rule {r['id']}: mode must be 'value' or 'full'")
            if mode == "full" and not r.get("absence_ok"):
                sys.exit(f"normalization rule {r['id']}: mode 'full' also forgives the "
                         f"field DISAPPEARING. Say why that is acceptable in an "
                         f"'absence_ok' field, or use the default mode 'value'.")
            self.rules.append({
                "id": r["id"],
                "mode": mode,
                "field_re": re.compile(r["field"]),
                "path_re": re.compile(r["path"]) if r.get("path") else None,
                "reason": r["reason"],
                "evidence": r["evidence"],
                "absence_ok": r.get("absence_ok", ""),
                "hits": 0,
                "presence_kept": 0,
            })

    @staticmethod
    def _empty(v):
        return v is None or v == "" or v == [] or v == {}

    def suppress(self, rel, field, gv, cv):
        for r in self.rules:
            if not r["field_re"].fullmatch(field):
                continue
            if r["path_re"] is not None and not r["path_re"].search(rel):
                continue
            if r["mode"] == "value" and (self._empty(gv) or self._empty(cv)):
                # the field appeared or vanished -- that is never what a volatility rule
                # was written for, so let it through
                r["presence_kept"] += 1
                return None
            r["hits"] += 1
            return r["id"]
        return None


# ---------------------------------------------------------------------------


def pair_up(missing, extra):
    """When a candidate changes a PATH CONVENTION rather than losing pages, the raw
    answer is thousands of MISSING beside thousands of EXTRA, which reads like a
    catastrophe and buries the real losses. Find the paths that have an obvious twin on
    the other side, report the transformation once with its count, and leave the
    genuinely unpaired ones -- the actual losses -- visible on their own.

    This NEVER forgives anything: a paired path is still reported, and a renamed URL is
    still a changed URL. It only separates "the convention moved" from "a page is gone".
    """
    def variants(p):
        out = {p}
        if p.endswith("/index.html"):
            out.add(p[: -len("/index.html")] + ".html")
        elif p.endswith(".html"):
            out.add(p[: -len(".html")] + "/index.html")
        out.add(p.lower())
        return out

    ex = set(extra)
    shapes, paired_m, paired_e = defaultdict(list), set(), set()
    for m in missing:
        for v in variants(m):
            if v != m and v in ex and v not in paired_e:
                kind = ("dir-index" if v.endswith("/index.html") or m.endswith("/index.html")
                        else "case")
                shapes[kind].append((m, v))
                paired_m.add(m)
                paired_e.add(v)
                break
    return shapes, [m for m in missing if m not in paired_m], \
        [e for e in extra if e not in paired_e]


def load(p):
    with gzip.open(p, "rt", encoding="utf-8") as fh:
        return json.load(fh)


def check_floors(name, cov, problems):
    for k, floor in HARD_FLOORS.items():
        if cov.get(k, 0) < floor:
            problems.append(
                f"{name}: coverage['{k}'] = {cov.get(k, 0):,} is below the hard floor "
                f"{floor:,}. Either this is not a full emit, or the extractor is broken. "
                f"Refusing to report a verdict.")
    if cov.get("html_parse_errors", 0):
        problems.append(f"{name}: {cov['html_parse_errors']} page(s) failed to parse -- "
                        f"an unparsed page reports no SEO elements, which is "
                        f"indistinguishable from a page that lost them.")
    if cov.get("read_errors", 0):
        problems.append(f"{name}: {cov['read_errors']} file(s) could not be read.")
    if cov.get("jsonld_unparseable", 0):
        problems.append(f"{name}: {cov['jsonld_unparseable']} JSON-LD block(s) did not parse.")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("golden")
    ap.add_argument("candidate")
    ap.add_argument("--allow", help="JSON file of declared normalization rules")
    ap.add_argument("--json", help="write the full machine-readable report here")
    ap.add_argument("--examples", type=int, default=4)
    ap.add_argument("--max-rows", type=int, default=60,
                    help="max aggregated rows printed per severity")
    a = ap.parse_args()

    G, C = load(a.golden), load(a.candidate)
    gs, cs = G.get("schema"), C.get("schema")
    if gs != cs:
        sys.exit(f"EXIT 2 -- manifest schema mismatch: golden={gs} candidate={cs}. These "
                 f"were produced by different versions of emit_fingerprint.py, so fields "
                 f"would differ for reasons that have nothing to do with the emit. "
                 f"Re-fingerprint both trees with the current script.")
    gcov, ccov = G["coverage"], C["coverage"]
    allow = Allow(json.load(open(a.allow)) if a.allow else None)

    problems = []
    check_floors("GOLDEN", gcov, problems)
    check_floors("CANDIDATE", ccov, problems)

    cov_regressions = []
    for k in COVERAGE_MUST_NOT_DROP:
        gv, cv = gcov.get(k, 0), ccov.get(k, 0)
        if cv != gv:
            cov_regressions.append((k, gv, cv))
    # Per-marker page counts. "#sidebar-overlay on 6,138 pages -> 0" is the shape of the
    # CategoryNav loss that no existing gate reports, and it must be one loud line, not
    # 6,138 quiet ones.
    gmk, cmk = gcov.get("markers") or {}, ccov.get("markers") or {}
    for k in sorted(set(gmk) | set(cmk)):
        if gmk.get(k, 0) != cmk.get(k, 0):
            cov_regressions.append((f"marker:{k}", gmk.get(k, 0), cmk.get(k, 0)))

    gf, cf = G["files"], C["files"]
    missing = sorted(set(gf) - set(cf))
    extra = sorted(set(cf) - set(gf))
    common = sorted(set(gf) & set(cf))

    # aggregate: (severity, cls, field) -> {count, examples, suppressed_by}
    rows = defaultdict(lambda: {"count": 0, "examples": []})
    suppressed = defaultdict(int)
    identical = 0

    for rel in common:
        gr, cr = gf[rel], cf[rel]
        ds = diff_record(rel, gr, cr)
        if not ds:
            identical += 1
            continue
        for sev, field, gv, cv in ds:
            rid = allow.suppress(rel, field, gv, cv)
            if rid:
                suppressed[rid] += 1
                continue
            key = (sev, gr.get("cls", "?"), field)
            rows[key]["count"] += 1
            if len(rows[key]["examples"]) < a.examples:
                rows[key]["examples"].append(
                    {"path": rel, "golden": _short(gv), "candidate": _short(cv)})

    # "never matched at all" and "matched but declined every time" are different
    # diagnoses and deserve different sentences.
    dead_rules = [r["id"] for r in allow.rules if r["hits"] == 0 and not r["presence_kept"]]
    idle_rules = [r["id"] for r in allow.rules if r["hits"] == 0 and r["presence_kept"]]

    # ------------------------------------------------------------------ print
    W = 96
    print("=" * W)
    print("GOLDEN EMIT DIFF")
    print("=" * W)
    print(f"golden    : {a.golden}\n            {G.get('label') or G['tree']}")
    print(f"candidate : {a.candidate}\n            {C.get('label') or C['tree']}")
    print()
    print(f"{'coverage':28s} {'golden':>12s} {'candidate':>12s}")
    for k in COVERAGE_MUST_NOT_DROP + ["html_parse_errors", "html_parse_warnings",
                                       "jsonld_unparseable", "gzip_decompress_errors",
                                       "read_errors"]:
        gv, cv = gcov.get(k, 0), ccov.get(k, 0)
        flag = "" if gv == cv else "   <-- DELTA"
        print(f"  {k:26s} {gv:>12,} {cv:>12,}{flag}")
    gmk_, cmk_ = gcov.get("markers") or {}, ccov.get("markers") or {}
    if gmk_ or cmk_:
        print(f"  {'-- structural markers --':26s}")
        for k in sorted(set(gmk_) | set(cmk_)):
            gv, cv = gmk_.get(k, 0), cmk_.get(k, 0)
            flag = "" if gv == cv else "   <-- DELTA"
            print(f"  {k:26s} {gv:>12,} {cv:>12,}{flag}")
    print()
    print(f"files compared : {len(common):,} common, {identical:,} byte-identical")
    print(f"missing        : {len(missing):,}   (in golden, absent from candidate)")
    print(f"extra          : {len(extra):,}   (in candidate, absent from golden)")
    print()

    total_diffs = sum(r["count"] for r in rows.values()) + len(missing) + len(extra)

    shapes, unpaired_m, unpaired_e = pair_up(missing, extra)
    if missing or extra:
        print("-" * W)
        print("S0_FILE_SET  --", SEV_BLURB["S0_FILE_SET"])
        print("-" * W)
        if shapes:
            print("  PATH CONVENTION CHANGED -- these paths moved rather than vanished.")
            print("  Still a changed URL on every one of them; only grouped so the")
            print("  genuinely lost pages below stay visible.")
            for kind, pairs in sorted(shapes.items()):
                print(f"    {len(pairs):,}x  {kind}")
                for m, e in pairs[:3]:
                    print(f"           {m}  ->  {e}")
            print()
        for label, lst, blurb in (
            ("MISSING", unpaired_m, "in golden, absent from candidate, no twin"),
            ("EXTRA", unpaired_e, "in candidate, absent from golden, no twin"),
        ):
            if lst:
                print(f"  {label} ({len(lst):,}) -- {blurb}:")
                bydir = defaultdict(int)
                for p in lst:
                    bydir[p.split("/")[0] if "/" in p else "<root>"] += 1
                print("    by top-level: " + ", ".join(
                    f"{k}={v:,}" for k, v in sorted(bydir.items(), key=lambda kv: -kv[1])[:12]))
                for p in lst[:30]:
                    print(f"    {p}")
                if len(lst) > 30:
                    print(f"    ... and {len(lst) - 30:,} more")
        print()

    for sev in SEVERITIES[1:]:
        sub = sorted(((k, v) for k, v in rows.items() if k[0] == sev),
                     key=lambda kv: -kv[1]["count"])
        if not sub:
            continue
        n = sum(v["count"] for _k, v in sub)
        print("-" * W)
        print(f"{sev}  --  {SEV_BLURB[sev]}     [{n:,} difference(s), "
              f"{len(sub)} distinct field(s)]")
        print("-" * W)
        for (_s, cls, field), v in sub[:a.max_rows]:
            print(f"  {v['count']:>7,}x  [{cls}] {field}")
            for ex in v["examples"]:
                print(f"            {ex['path']}")
                print(f"              golden    : {ex['golden']}")
                print(f"              candidate : {ex['candidate']}")
        if len(sub) > a.max_rows:
            print(f"  ... and {len(sub) - a.max_rows} more distinct field(s)")
        print()

    if allow.rules:
        print("-" * W)
        print("DECLARED NORMALIZATIONS  (each suppressed this many differences)")
        print("-" * W)
        for r in allow.rules:
            print(f"  {r['hits']:>7,}x  {r['id']}  [mode={r['mode']}]")
            print(f"            reason   : {r['reason']}")
            print(f"            evidence : {r['evidence']}")
            if r["absence_ok"]:
                print(f"            absence  : {r['absence_ok']}")
            if r["presence_kept"]:
                print(f"            NOT suppressed: {r['presence_kept']:,} case(s) where "
                      f"the field was absent on one side -- reported above")
        print()

    print("=" * W)
    verdict_problems = list(problems)
    if dead_rules:
        verdict_problems.append(
            f"normalization rule(s) matched nothing: {', '.join(dead_rules)}. A rule that "
            f"suppresses no difference has rotted and must be deleted or fixed -- leaving "
            f"it in place is how a future difference gets silently forgiven.")
    if idle_rules:
        verdict_problems.append(
            f"normalization rule(s) matched only cases where the field was ABSENT on one "
            f"side, and therefore suppressed nothing: {', '.join(idle_rules)}. Those "
            f"appearances/disappearances are reported above and are real findings; the "
            f"rule itself is doing no work and should be deleted or re-scoped.")

    if verdict_problems:
        print("EXIT 2 -- THE DIFFER ITSELF IS NOT TRUSTWORTHY. No verdict on the candidate.")
        for p in verdict_problems:
            print(f"  ! {p}")
        code = 2
    elif total_diffs or cov_regressions:
        if cov_regressions:
            print("COVERAGE REGRESSED -- a no-loss emit does not change a positive "
                  "coverage count:")
            for k, gv, cv in cov_regressions:
                print(f"  ! {k}: {gv:,} -> {cv:,}  ({cv - gv:+,})")
        print(f"DIFFERENCES FOUND: {total_diffs:,}")
        code = 1
    else:
        print(f"NO DIFFERENCES.  {len(common):,} files compared, "
              f"{gcov['html_pages']:,} pages parsed, "
              f"{gcov['jsonld_blocks']:,} JSON-LD blocks, "
              f"{gcov['pages_with_canonical']:,} canonicals, "
              f"{gcov['outside_links']:,} links outside <article> -- all equal.")
        code = 0
    print("=" * W)

    if a.json:
        json.dump({
            "golden": a.golden, "candidate": a.candidate,
            "coverage": {"golden": gcov, "candidate": ccov,
                         "regressions": cov_regressions},
            "missing": missing, "extra": extra,
            "path_shape_changes": {k: v for k, v in shapes.items()},
            "unpaired_missing": unpaired_m, "unpaired_extra": unpaired_e,
            "identical": identical, "common": len(common),
            "rows": [{"severity": k[0], "cls": k[1], "field": k[2], **v}
                     for k, v in sorted(rows.items(), key=lambda kv: (kv[0][0], -kv[1]["count"]))],
            "normalizations": [{"id": r["id"], "mode": r["mode"], "hits": r["hits"],
                                "presence_kept": r["presence_kept"],
                                "reason": r["reason"], "evidence": r["evidence"]}
                               for r in allow.rules],
            "problems": verdict_problems,
            "exit": code,
        }, open(a.json, "w"), indent=1)
        print(f"full report -> {a.json}")

    sys.exit(code)


if __name__ == "__main__":
    main()
