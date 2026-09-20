#!/usr/bin/env python3
"""Fingerprint an emitted static site tree, exhaustively and without guessing.

WHY THIS EXISTS
---------------
The project is replacing its vendored Quartz SSG with its own emitter. The loud failure
mode -- a broken build -- is not the one that matters. The one that matters is a
replacement that emits a plausible-looking page with a missing canonical tag or a dropped
JSON-LD block, passes every existing gate (`check_seo_parity.py` scopes only to the
`<article>`; `CategoryNav.tsx` has no gate at all), and costs search ranking for months.

So: before anything is replaced, the current emit is fingerprinted as a GOLDEN reference,
and every candidate emit is diffed against it by `scripts/emit_diff.py`.

TWO LAYERS, AND NEITHER REPLACES THE OTHER
------------------------------------------
  Layer 1  every file gets a sha256 over its raw bytes. Nothing is normalized away.
  Layer 2  files whose *meaning* is richer than their bytes additionally get a parsed
           fingerprint (HTML -> the SEO shell + the article; sitemap/RSS -> per-URL rows;
           the named site-level JSON/text artifacts -> canonical forms).

Layer 2 exists so a difference can be NAMED ("canonical href changed on 412 pages"),
not so differences can be forgiven. Every fingerprint field that is normalized is carried
ALONGSIDE its un-normalized twin, never instead of it -- see `raw_*` fields below. That is
the answer to the standing hazard in CLAUDE.md 6.9: over-normalizing is how a real
regression hides, so nothing here is ever only-normalized.

ABSENCE MUST NOT READ AS A PASS  (CLAUDE.md 6.6, the most repeated class in this repo)
--------------------------------------------------------------------------------------
A matcher that matched nothing and a clean tree emit the same output unless you stop it.
Every extractor here therefore emits a POSITIVE COVERAGE COUNT into `manifest["coverage"]`,
and `emit_diff.py` hard-fails when a count is zero or below a floor derived from golden.
Parse failures are counted, named and fatal -- a page that could not be parsed is never
silently fingerprinted as "no SEO elements found".

USAGE
-----
    python3 scripts/emit_fingerprint.py <tree-dir> --out <manifest.json.gz> [--jobs N]

The manifest is gzip-compressed JSON (the uncompressed form is ~120MB for this site).
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import re
import sys
from concurrent.futures import ProcessPoolExecutor
from html.parser import HTMLParser
from pathlib import Path

# ---------------------------------------------------------------------------
# File classification
# ---------------------------------------------------------------------------

# Void elements never have a closing tag. Quartz renders through Preact and self-closes
# them ("<meta ... />"), but html.parser reports those as `startendtag` only when the
# slash is present, so both paths are handled.
VOID = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}

# Elements that close an open instance of themselves / their peers. Generated markup from
# a JSX renderer is well-formed, so this list only has to cover the cases that appear;
# anything it misses surfaces as a parse warning rather than as silent mis-nesting.
IMPLICIT_CLOSE = {
    "li": {"li"},
    "dt": {"dt", "dd"},
    "dd": {"dt", "dd"},
    "p": {"p"},
    "option": {"option"},
    "thead": {"thead", "tbody"},
    "tbody": {"thead", "tbody"},
    "tr": {"tr"},
    "td": {"td", "th"},
    "th": {"td", "th"},
}

# Site-level artifacts that get a semantic form on top of their byte hash. Everything
# else -- notably the ~4,900 neural payload chunks under static/neural/ -- is a
# pass-through copy where byte identity is exactly the right question.
SEMANTIC_XML = {"sitemap.xml", "index.xml"}
SEMANTIC_JSON = {
    "site-index.json",
    "l-manifest.json",
    "openapi.json",
    "_routes.json",
    "static/contentIndex.json",
}
SEMANTIC_TEXT = {
    "_headers",
    "_redirects",
    "robots.txt",
    "llms.txt",
    "static/_headers",
    "static/_redirects",
    ".well-known/api-catalog",
}


def classify(rel: str) -> str:
    """The comparison class for a path. Drives which extractor runs."""
    low = rel.lower()
    if low.endswith(".html"):
        return "html"
    if rel in SEMANTIC_XML or low.endswith(".xml"):
        return "xml"
    if rel in SEMANTIC_JSON:
        return "json_semantic"
    if low.endswith(".json"):
        return "json_opaque"
    if rel in SEMANTIC_TEXT:
        return "text_semantic"
    if low.endswith((".md", ".txt")):
        return "text_opaque"
    if low.endswith(".css"):
        return "css"
    if low.endswith(".js"):
        return "js"
    if low.endswith(".gz"):
        return "gzip"
    return "binary"


# ---------------------------------------------------------------------------
# A minimal, strict DOM
# ---------------------------------------------------------------------------


class Node:
    __slots__ = ("tag", "attrs", "attrs_seq", "children", "parent")

    def __init__(self, tag, attrs=None, attrs_seq=None, parent=None):
        self.tag = tag
        self.attrs = attrs or {}
        # Source order, kept verbatim. NOT a duplicate of `attrs`: build_share_shell.mjs
        # matches literal strings against the emitted <head>, so an attribute REORDER that a
        # dict comparison forgives is a production build failure. Order is contract here.
        self.attrs_seq = attrs_seq or []
        self.children = []          # Node | str
        self.parent = parent

    def iter(self):
        yield self
        for c in self.children:
            if isinstance(c, Node):
                yield from c.iter()

    def find_all(self, tag):
        return [n for n in self.iter() if n.tag == tag]

    def find(self, tag):
        for n in self.iter():
            if n.tag == tag:
                return n
        return None

    def text(self) -> str:
        out = []
        for c in self.children:
            if isinstance(c, str):
                out.append(c)
            elif c.tag not in ("script", "style"):
                out.append(c.text())
        return "".join(out)


class DOM(HTMLParser):
    """Stack-based tree builder.

    `warnings` is the load-bearing field: a document that does not unwind cleanly is
    reported, counted, and made fatal upstream. A parser that silently mis-nests would
    make a page look like it has no <article>, which reads identically to a page whose
    <article> was dropped.
    """

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#document")
        self.stack = [self.root]
        self.warnings = []
        self.doctype = None

    # -- stack helpers ------------------------------------------------------
    def _open(self, tag, attrs):
        d = {}
        seq = []
        for k, v in attrs:
            seq.append([k, v if v is not None else ""])
            # A repeated attribute is a real defect in generated markup; keep the first
            # and say so rather than letting the last one win invisibly.
            if k in d:
                self.warnings.append(f"duplicate attribute {tag}@{k}")
                continue
            d[k] = v if v is not None else ""
        node = Node(tag, d, seq, self.stack[-1])
        self.stack[-1].children.append(node)
        return node

    def handle_decl(self, decl):
        self.doctype = decl.strip()

    def handle_starttag(self, tag, attrs):
        closers = IMPLICIT_CLOSE.get(tag)
        if closers and self.stack[-1].tag in closers:
            self.stack.pop()
        node = self._open(tag, attrs)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self._open(tag, attrs)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                if i != len(self.stack) - 1:
                    unclosed = [n.tag for n in self.stack[i + 1:]]
                    self.warnings.append(f"</{tag}> closed unclosed {unclosed}")
                del self.stack[i:]
                return
        self.warnings.append(f"stray </{tag}>")

    def handle_data(self, data):
        self.stack[-1].children.append(data)

    def close(self):
        super().close()
        if len(self.stack) > 1:
            self.warnings.append(f"unclosed at EOF: {[n.tag for n in self.stack[1:]]}")


# ---------------------------------------------------------------------------
# Normalization helpers -- each one is paired with an un-normalized twin
# ---------------------------------------------------------------------------

WS = re.compile(r"\s+")


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def shas(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def norm_text(s: str) -> str:
    """Collapse whitespace runs. Justified only for *display* text comparison, and the
    raw hash of the same subtree is always carried beside it."""
    return WS.sub(" ", s).strip()


def canon_json(obj) -> str:
    """Key-sorted, separator-fixed JSON. Lets a JSON-LD block that was re-serialized with
    a different key order compare equal SEMANTICALLY while the raw hash still records
    that the bytes moved."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


# ---------------------------------------------------------------------------
# HTML fingerprint
# ---------------------------------------------------------------------------


# Named structural markers. The recon's Tier-1 list: each of these is something a page is
# supposed to carry, something downstream reads, and something whose silent loss no current
# gate reports. Counting them turns "the shell looks fine" into a number per marker.
#   #quartz-root / #quartz-body   the SPA mount points
#   #sidebar-overlay              CategoryNav's container -- the site's only persistent
#                                 static nav, and NO gate guards it (CLAUDE.md 6.8)
#   nav.category-nav / div.search the nav and search components themselves
#   #page-graph-data              read through a bare catch, so its loss is silent
#   __rollPositions               an inline head script the app boots from
# NOTE: window.__bjjAuth is deliberately NOT here. It is installed by postscript.js, not
# written into any page, so a per-page marker for it reads 0 on all 6,149 pages -- a
# constant with a function around it, which can never go red. It is checked against the
# BUNDLE instead, in check_build_fingerprint.py's BUNDLE_TOKENS.
#   meta robots                   12 pages carry it; the agent-discovery exporter reads it
MARKERS = (
    "id:quartz-root", "id:quartz-body", "id:sidebar-overlay", "id:page-graph-data",
    "tag:article", "tag:nav", "tag:footer", "tag:main",
    "class:category-nav", "class:search", "class:popover-hint",
    "js:__rollPositions", "meta:robots",
    "body:data-slug", "body:data-current-role",
)


def detect_markers(root, body, text) -> dict:
    ids, classes, tags = set(), set(), set()
    for n in root.iter():
        tags.add(n.tag)
        if "id" in n.attrs:
            ids.add(n.attrs["id"])
        if "class" in n.attrs:
            classes.update(n.attrs["class"].split())
    out = {}
    for m in MARKERS:
        kind, name = m.split(":", 1)
        if kind == "id":
            out[m] = name in ids
        elif kind == "class":
            out[m] = name in classes
        elif kind == "tag":
            out[m] = name in tags
        elif kind == "js":
            out[m] = name in text
        elif kind == "meta":
            out[m] = any(n.tag == "meta" and n.attrs.get("name") == name
                         for n in root.iter())
        elif kind == "body":
            out[m] = bool(body) and name in body.attrs
    return out


META_KEYS = ("name", "property", "http-equiv", "itemprop", "charset")


def meta_key(attrs: dict) -> str:
    for k in META_KEYS:
        if k in attrs:
            return f"{k}={attrs[k]}"
    return "meta=<keyless>"


def fingerprint_html(raw: bytes, rel: str) -> dict:
    text = raw.decode("utf-8", errors="replace")
    dom = DOM()
    try:
        dom.feed(text)
        dom.close()
    except Exception as e:                                    # pragma: no cover
        return {"parse_error": f"{type(e).__name__}: {e}"}

    fp: dict = {"parse_warnings": dom.warnings, "doctype": dom.doctype}

    html_el = dom.root.find("html")
    fp["html_attrs"] = dict(sorted(html_el.attrs.items())) if html_el else None

    head = dom.root.find("head")
    body = dom.root.find("body")
    if head is None:
        fp["parse_error"] = "no <head>"
        return fp

    # -- head: title --------------------------------------------------------
    titles = head.find_all("title")
    fp["title"] = titles[0].text() if titles else None
    fp["n_title"] = len(titles)

    # -- head: meta ---------------------------------------------------------
    metas = []
    for m in head.find_all("meta"):
        metas.append([meta_key(m.attrs), m.attrs.get("content", "")])
    fp["meta"] = metas                                  # document order preserved
    fp["meta_map"] = {k: v for k, v in metas}           # last-wins lookup view
    fp["n_meta"] = len(metas)

    # -- head: link ---------------------------------------------------------
    links = []
    for l in head.find_all("link"):
        links.append(
            [l.attrs.get("rel", ""), l.attrs.get("href", ""),
             l.attrs.get("type", ""), canon_json(dict(sorted(l.attrs.items())))]
        )
    fp["links"] = links
    fp["n_links"] = len(links)
    fp["canonical"] = next((h for r, h, _t, _a in links if r == "canonical"), None)

    # -- head: JSON-LD ------------------------------------------------------
    # Both forms, always. `jsonld` is the semantic comparison; `jsonld_raw_sha` records
    # that the literal bytes moved even when the meaning did not.
    jsonld, jsonld_raw, jsonld_types, jsonld_bad = [], [], [], 0
    scripts = []
    for s in head.find_all("script"):
        stype = s.attrs.get("type", "")
        inner = "".join(c for c in s.children if isinstance(c, str))
        if stype == "application/ld+json":
            jsonld_raw.append(shas(inner))
            try:
                obj = json.loads(inner)
            except Exception:
                jsonld_bad += 1
                jsonld.append({"__unparseable__": shas(inner)})
                jsonld_types.append("__unparseable__")
                continue
            jsonld.append(canon_json(obj))
            t = obj.get("@type") if isinstance(obj, dict) else None
            jsonld_types.append(t if isinstance(t, str) else canon_json(t))
        else:
            scripts.append(
                [s.attrs.get("src", ""), stype,
                 shas(inner) if inner else "",
                 canon_json(dict(sorted(s.attrs.items())))]
            )
    fp["jsonld"] = jsonld
    fp["jsonld_raw_sha"] = jsonld_raw
    fp["jsonld_types"] = jsonld_types
    fp["n_jsonld"] = len(jsonld)
    fp["n_jsonld_unparseable"] = jsonld_bad
    fp["head_scripts"] = scripts
    fp["n_head_scripts"] = len(scripts)

    # Any head element class that is none of the above -- so a construct nobody
    # anticipated still shows up as a difference instead of vanishing.
    # The <head> as an ORDERED sequence of (tag, attrs-in-source-order). Element order and
    # attribute order are both contract, so neither is allowed to be normalized away.
    fp["head_seq"] = [[c.tag, c.attrs_seq] for c in head.children if isinstance(c, Node)]
    fp["head_other"] = sorted(
        {c.tag for c in head.children if isinstance(c, Node)}
        - {"title", "meta", "link", "script", "style"}
    )
    fp["head_raw_sha"] = shas(text.split("</head>")[0]) if "</head>" in text else None

    fp["markers"] = detect_markers(dom.root, body, text)

    if body is None:
        fp["body"] = None
        return fp

    # -- body: the article --------------------------------------------------
    article = body.find("article")
    if article is None:
        fp["article"] = None
    else:
        headings = []
        for n in article.iter():
            if n.tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
                headings.append([n.tag, norm_text(n.text())])
        a_links = [[a.attrs.get("href", ""), norm_text(a.text())]
                   for a in article.find_all("a")]
        imgs = [[i.attrs.get("src", ""), i.attrs.get("alt", "")]
                for i in article.find_all("img")]
        atext = norm_text(article.text())
        fp["article"] = {
            "headings": headings,
            "n_headings": len(headings),
            "links": a_links,
            "n_links": len(a_links),
            "images": imgs,
            "n_images": len(imgs),
            "n_images_no_alt": sum(1 for _s, alt in imgs if not alt),
            "text_sha": shas(atext),
            "text_len": len(atext),
            "text_head": atext[:240],
            "attrs": dict(sorted(article.attrs.items())),
            # tag histogram: catches a structural rewrite that leaves the text identical
            "tags": dict(sorted(
                (t, sum(1 for n in article.iter() if n.tag == t))
                for t in {n.tag for n in article.iter()}
            )),
        }

    # -- body: EVERYTHING OUTSIDE THE ARTICLE ------------------------------
    # This is the explicitly ungated surface: check_seo_parity.py scopes to <article>,
    # and CategoryNav.tsx (the site's only persistent static nav) has no gate at all.
    art_ids = {id(n) for n in article.iter()} if article is not None else set()
    outside_links, outside_imgs, selectors, outside_tags = [], [], [], {}
    for n in body.iter():
        if id(n) in art_ids or n is body:
            continue
        outside_tags[n.tag] = outside_tags.get(n.tag, 0) + 1
        if n.tag == "a":
            outside_links.append([n.attrs.get("href", ""), norm_text(n.text())])
        if n.tag == "img":
            outside_imgs.append([n.attrs.get("src", ""), n.attrs.get("alt", "")])
        # the selector surface: what e2e specs, the neural app and the CF Functions key off
        if "id" in n.attrs:
            selectors.append("#" + n.attrs["id"])
        for k in n.attrs:
            if k.startswith("data-"):
                selectors.append(f"[{k}]")
        if "class" in n.attrs:
            for c in n.attrs["class"].split():
                selectors.append("." + c)

    fp["outside"] = {
        "links": outside_links,
        "n_links": len(outside_links),
        "link_targets": sorted({h for h, _t in outside_links}),
        "images": outside_imgs,
        "selectors": sorted(set(selectors)),
        "n_selectors": len(set(selectors)),
        "tags": dict(sorted(outside_tags.items())),
    }
    fp["body_attrs"] = dict(sorted(body.attrs.items()))

    # Named top-level regions, hashed individually so "the nav changed" is one row and
    # not 6,149 rows.
    regions = {}
    for child in body.children:
        if not isinstance(child, Node):
            continue
        key = child.tag
        if "id" in child.attrs:
            key += "#" + child.attrs["id"]
        elif "class" in child.attrs:
            key += "." + child.attrs["class"].split()[0]
        regions[key] = regions.get(key, 0) + 1
    fp["body_regions"] = dict(sorted(regions.items()))

    return fp


# ---------------------------------------------------------------------------
# Non-HTML semantic fingerprints
# ---------------------------------------------------------------------------

def fingerprint_xml(raw: bytes, rel: str) -> dict:
    """sitemap.xml / index.xml: compare the URL SET and each entry's fields, and the
    ORDER separately. Order matters to nobody in a sitemap but a reordering that is not
    understood is still a signal, so it is reported as its own low-severity field."""
    text = raw.decode("utf-8", errors="replace")
    entries = []
    for m in re.finditer(r"<(url|item)\b[^>]*>(.*?)</\1>", text, re.S):
        block = m.group(2)
        fields = {}
        for f in re.finditer(r"<([A-Za-z0-9:_-]+)\s*>(.*?)</\1>", block, re.S):
            fields.setdefault(f.group(1), []).append(f.group(2).strip())
        entries.append(fields)
    key_field = "loc" if any("loc" in e for e in entries) else "link"
    keys = [e.get(key_field, [""])[0] for e in entries]
    return {
        "n_entries": len(entries),
        "keys_sorted": sorted(keys),
        "order_sha": shas("\n".join(keys)),
        "by_key": {k: canon_json(e) for k, e in zip(keys, entries)},
        "root_tag": (re.search(r"<([A-Za-z0-9:_-]+)[\s>]", text.split("?>")[-1]) or [None, None])[1]
        if "<" in text else None,
    }


def fingerprint_json(raw: bytes, rel: str) -> dict:
    try:
        obj = json.loads(raw.decode("utf-8"))
    except Exception as e:
        return {"parse_error": f"{type(e).__name__}: {e}"}
    out = {"canon_sha": shas(canon_json(obj)), "type": type(obj).__name__}
    if isinstance(obj, dict):
        out["keys"] = sorted(obj.keys())[:2000]
        out["n_keys"] = len(obj)
        out["per_key_sha"] = {k: shas(canon_json(v)) for k, v in list(obj.items())[:20000]}
    elif isinstance(obj, list):
        out["n_items"] = len(obj)
        out["item_shas"] = [shas(canon_json(v)) for v in obj[:20000]]
    return out


def fingerprint_gzip(raw: bytes, rel: str) -> dict:
    """A .gz sibling's compressed bytes are an implementation detail of whichever zlib
    built it; the CONTENT is the contract. Both producers here already pin the header's
    mtime to 0 (zlib's default, and scripts/apply_affiliate_ref.py:215 passes mtime=0
    explicitly), so the bytes happen to be reproducible today -- but that is a property of
    this toolchain, not of the artifact. Compare the decompressed payload, and keep the
    raw sha beside it so a compression-level change is still visible, just not alarming."""
    try:
        import gzip as _gz
        inner = _gz.decompress(raw)
    except Exception as e:
        return {"decompress_error": f"{type(e).__name__}: {e}"}
    return {"inner_sha": sha(inner), "inner_size": len(inner),
            "header_mtime": int.from_bytes(raw[4:8], "little") if len(raw) >= 8 else None}


def fingerprint_text(raw: bytes, rel: str) -> dict:
    text = raw.decode("utf-8", errors="replace")
    lines = text.splitlines()
    stripped = [l.rstrip() for l in lines]
    return {
        "n_lines": len(lines),
        "order_sha": shas("\n".join(stripped)),
        "set_sha": shas("\n".join(sorted(stripped))),
        "nonblank": sum(1 for l in stripped if l.strip()),
    }


# ---------------------------------------------------------------------------
# Per-file driver
# ---------------------------------------------------------------------------

def fingerprint_file(args):
    root, rel = args
    p = os.path.join(root, rel)
    try:
        raw = open(p, "rb").read()
    except Exception as e:
        return rel, {"read_error": f"{type(e).__name__}: {e}"}
    cls = classify(rel)
    rec = {"cls": cls, "size": len(raw), "sha": sha(raw)}
    try:
        if cls == "html":
            rec["fp"] = fingerprint_html(raw, rel)
        elif cls == "xml":
            rec["fp"] = fingerprint_xml(raw, rel)
        elif cls == "json_semantic":
            rec["fp"] = fingerprint_json(raw, rel)
        elif cls == "text_semantic":
            rec["fp"] = fingerprint_text(raw, rel)
        elif cls == "gzip":
            rec["fp"] = fingerprint_gzip(raw, rel)
    except Exception as e:                                    # pragma: no cover
        rec["fp"] = {"parse_error": f"{type(e).__name__}: {e}"}
    return rel, rec


def walk(root: str):
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames.sort()
        for fn in sorted(filenames):
            out.append(os.path.relpath(os.path.join(dirpath, fn), root))
    return sorted(out)


# ---------------------------------------------------------------------------
# Coverage -- the positive counts that make "found nothing" distinguishable from
# "never looked". emit_diff.py hard-fails on a zero here.
# ---------------------------------------------------------------------------

# Fields whose DISTINCT-VALUE COUNT is tracked site-wide. Keep this short: it is a
# detector for "this stopped varying", not a general census.
DISTINCT_TRACK = (
    "property=article:modified_time",   # git commit date -- collapses if git lookup fails
    "property=article:published_time",  # birthtime -- collapses if the fs loses birthtime
    "name=description",
    "property=og:title",
)


def scan_tree(tree, jobs: int = 4) -> dict:
    """Walk an emitted tree and fingerprint every file. ONE implementation.

    Shared by scripts/check_build_fingerprint.py and scripts/check_payload_budget.py so
    that "how many pages / JSON-LD blocks / in-article links does this build have" has a
    single answer. Two counters would eventually disagree, and the one that disagreed
    quietly would be the one a gate trusted (CLAUDE.md 6.5).
    """
    tree = str(tree)
    rels = walk(tree)
    if not rels:
        raise RuntimeError(f"{tree} holds no files")
    files = {}
    with ProcessPoolExecutor(max_workers=jobs) as ex:
        for rel, rec in ex.map(fingerprint_file, ((tree, r) for r in rels), chunksize=32):
            files[rel] = rec
    return files


def coverage(files: dict) -> dict:
    _seen: dict[str, set] = {k: set() for k in DISTINCT_TRACK}
    cov = {
        "files": len(files),
        "bytes": sum(r.get("size", 0) for r in files.values()),
        "by_class": {},
        "html_pages": 0,
        "html_parse_errors": 0,
        "html_parse_warnings": 0,
        "pages_with_title": 0,
        "pages_with_canonical": 0,
        "pages_with_description": 0,
        "pages_with_og_title": 0,
        "pages_with_article": 0,
        "pages_with_outside_links": 0,
        "jsonld_blocks": 0,
        "jsonld_unparseable": 0,
        "meta_tags": 0,
        "head_links": 0,
        "article_headings": 0,
        "article_links": 0,
        "outside_links": 0,
        "distinct_jsonld_types": {},
        "distinct_meta_keys": {},
        # How many DISTINCT values a field takes across the whole site. A field that is
        # supposed to vary and stops varying is the shape of a real defect that equality
        # checks cannot see (CLAUDE.md 6.6: "a value identical across a whole category is
        # a CONSTANT until proven otherwise").
        #
        # The case this is aimed at: article:modified_time is the file's last GIT commit
        # date (lastmod.ts:117). If the pathspec is wrong or the clone is shallow the
        # lookup throws and falls back to st.mtimeMs -- every page then shows the checkout
        # time instead of its commit date. That is exactly the v1.148.0 bug, which lived
        # for ~70 versions because the fallback "returns a perfectly plausible date, so
        # nothing downstream looked wrong". Per-page equality cannot catch it if both
        # sides degrade; a collapse from ~27 distinct values toward 1-3 can.
        "distinct_values": {},
        "semantic_xml": 0,
        "semantic_json": 0,
        "semantic_text": 0,
        "static_files": 0,
        "gzip_files": 0,
        "gzip_decompress_errors": 0,
        "markers": {m: 0 for m in MARKERS},
        "read_errors": 0,
    }
    for rel, r in files.items():
        cov["by_class"][r.get("cls", "?")] = cov["by_class"].get(r.get("cls", "?"), 0) + 1
        if rel.startswith("static/"):
            cov["static_files"] += 1
        if "read_error" in r:
            cov["read_errors"] += 1
            continue
        fp = r.get("fp")
        if r.get("cls") == "html":
            cov["html_pages"] += 1
            if not fp or "parse_error" in fp:
                cov["html_parse_errors"] += 1
                continue
            cov["html_parse_warnings"] += len(fp.get("parse_warnings") or [])
            if fp.get("title"):
                cov["pages_with_title"] += 1
            if fp.get("canonical"):
                cov["pages_with_canonical"] += 1
            mm = fp.get("meta_map") or {}
            if mm.get("name=description"):
                cov["pages_with_description"] += 1
            if mm.get("property=og:title"):
                cov["pages_with_og_title"] += 1
            if fp.get("article"):
                cov["pages_with_article"] += 1
                cov["article_headings"] += fp["article"]["n_headings"]
                cov["article_links"] += fp["article"]["n_links"]
            if (fp.get("outside") or {}).get("n_links"):
                cov["pages_with_outside_links"] += 1
                cov["outside_links"] += fp["outside"]["n_links"]
            cov["jsonld_blocks"] += fp.get("n_jsonld", 0)
            cov["jsonld_unparseable"] += fp.get("n_jsonld_unparseable", 0)
            cov["meta_tags"] += fp.get("n_meta", 0)
            cov["head_links"] += fp.get("n_links", 0)
            for t in fp.get("jsonld_types") or []:
                cov["distinct_jsonld_types"][t] = cov["distinct_jsonld_types"].get(t, 0) + 1
            for k, _v in fp.get("meta") or []:
                cov["distinct_meta_keys"][k] = cov["distinct_meta_keys"].get(k, 0) + 1
            for k in DISTINCT_TRACK:
                v = mm.get(k)
                if v:
                    _seen[k].add(v)
            for m, present in (fp.get("markers") or {}).items():
                if present:
                    cov["markers"][m] = cov["markers"].get(m, 0) + 1
        elif r.get("cls") == "xml" and fp:
            cov["semantic_xml"] += 1
        elif r.get("cls") == "json_semantic" and fp:
            cov["semantic_json"] += 1
        elif r.get("cls") == "text_semantic" and fp:
            cov["semantic_text"] += 1
        elif r.get("cls") == "gzip":
            cov["gzip_files"] += 1
            if fp and "decompress_error" in fp:
                cov["gzip_decompress_errors"] += 1
    cov["distinct_values"] = {k: len(v) for k, v in sorted(_seen.items())}
    cov["distinct_jsonld_types"] = dict(sorted(cov["distinct_jsonld_types"].items()))
    cov["distinct_meta_keys"] = dict(sorted(cov["distinct_meta_keys"].items()))
    return cov


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("tree")
    ap.add_argument("--out", required=True, help="manifest path (.json.gz)")
    ap.add_argument("--jobs", type=int, default=min(8, (os.cpu_count() or 4)))
    ap.add_argument("--label", default="", help="free-text note stored in the manifest")
    a = ap.parse_args()

    root = os.path.abspath(a.tree)
    if not os.path.isdir(root):
        sys.exit(f"not a directory: {root}")

    rels = walk(root)
    if not rels:
        sys.exit(f"FATAL: {root} holds no files -- refusing to write an empty manifest")
    print(f"fingerprinting {len(rels)} files under {root} with {a.jobs} workers ...",
          flush=True)

    files = scan_tree(root, a.jobs)

    cov = coverage(files)
    manifest = {
        # Bump whenever a fingerprint FIELD is added, removed or changes meaning.
        # emit_diff.py refuses to compare across versions: two manifests built by
        # different extractors would differ in fields that never differed in the emit,
        # and the operator would be reading the tool's history as the site's.
        "schema": 2,
        "tree": root,
        "label": a.label,
        "coverage": cov,
        "files": files,
    }
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(a.out, "wt", encoding="utf-8") as fh:
        json.dump(manifest, fh)

    print(f"\nwrote {a.out} ({os.path.getsize(a.out):,} bytes)")
    print("COVERAGE")
    for k in ("files", "bytes", "html_pages", "html_parse_errors", "html_parse_warnings",
              "pages_with_title", "pages_with_canonical", "pages_with_description",
              "pages_with_og_title", "pages_with_article", "pages_with_outside_links",
              "jsonld_blocks", "jsonld_unparseable", "meta_tags", "head_links",
              "article_headings", "article_links", "outside_links",
              "semantic_xml", "semantic_json", "semantic_text", "static_files",
              "gzip_files", "gzip_decompress_errors", "read_errors"):
        print(f"  {k:26s} {cov[k]:,}")
    print("  markers (pages carrying each):")
    for m, n in cov["markers"].items():
        print(f"    {m:28s} {n:,}")
    print(f"  by_class                 {cov['by_class']}")
    print(f"  jsonld @types            {cov['distinct_jsonld_types']}")
    print("  distinct values (a collapse here means a field stopped varying):")
    for k, n in cov["distinct_values"].items():
        print(f"    {k:34s} {n:,}")
    print(f"  meta keys                {len(cov['distinct_meta_keys'])} distinct")


if __name__ == "__main__":
    main()
