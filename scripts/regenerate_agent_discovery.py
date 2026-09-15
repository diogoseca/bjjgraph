#!/usr/bin/env python3
"""Publish discovery files and Markdown from the SAME built articles people read.

Run after Quartz and affiliate stamping. Only sitemap-listed, indexable public
articles are exported: no source JSON, drafts, account data, or share links.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, unquote, urljoin, urlsplit
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://bjjgraph.org"
CATEGORIES = ("Positions", "Transitions", "Submissions", "Principles", "Systems", "Learning")
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


class ArticleParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = ["document", {}, []]
        self.stack = [self.root]
        self.article = None
        self.title = None
        self.noindex = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta" and attrs.get("name", "").lower() == "robots":
            self.noindex |= "noindex" in attrs.get("content", "").lower()
        node = [tag, attrs, []]
        self.stack[-1][2].append(node)
        if tag == "article":
            self.article = node
        # Inline SVG icons also contain <title>; only the document title names the article.
        if tag == "title" and self.title is None:
            self.title = node
        if tag not in VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_data(self, data):
        self.stack[-1][2].append(data)


def render(node, canonical, pre=False):
    if isinstance(node, str):
        return node if pre else re.sub(r"\s+", " ", node)
    tag, attrs, children = node
    if tag in {"script", "style", "svg", "button", "template"} or "hidden" in attrs or attrs.get("aria-hidden") == "true":
        return ""
    text = "".join(render(child, canonical, pre or tag == "pre") for child in children)
    if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
        return f"\n\n{'#' * int(tag[1])} {text.strip()}\n\n"
    if tag in {"p", "div", "section", "article", "ul", "ol", "details"}:
        return f"\n\n{text.strip()}\n\n"
    if tag == "li":
        return "\n- " + text.strip().replace("\n", "\n  ") + "\n"
    if tag == "a" and attrs.get("href"):
        target = urljoin(canonical, attrs["href"])
        if urlsplit(target).scheme in {"http", "https", "mailto"}:
            return f"[{text.strip()}](<{target}>)" if text.strip() else ""
    if tag == "img" and attrs.get("src"):
        target = urljoin(canonical, attrs["src"])
        if urlsplit(target).scheme in {"http", "https"}:
            return f"![{attrs.get('alt', '')}](<{target}>)"
        return ""
    if tag in {"strong", "b"}:
        return f"**{text.strip()}**" if text.strip() else ""
    if tag in {"em", "i"}:
        return f"*{text.strip()}*" if text.strip() else ""
    if tag == "br":
        return "\n"
    if tag == "hr":
        return "\n\n---\n\n"
    if tag == "pre":
        return f"\n\n````\n{text.strip()}\n````\n\n"
    if tag == "code" and not pre:
        return f"`{text}`"
    if tag == "blockquote":
        return "\n\n" + "\n".join("> " + line for line in text.strip().splitlines()) + "\n\n"
    if tag == "table":
        rows = []
        def collect(n):
            if isinstance(n, str):
                return
            if n[0] == "tr":
                rows.append([re.sub(r"\s+", " ", render(c, canonical)).strip().replace("|", "\\|")
                             for c in n[2] if not isinstance(c, str) and c[0] in {"th", "td"}])
            else:
                for c in n[2]:
                    collect(c)
        collect(node)
        if rows:
            width = max(map(len, rows))
            rows = [row + [""] * (width - len(row)) for row in rows]
            rows.insert(1, ["---"] * width)
            return "\n\n" + "\n".join("| " + " | ".join(row) + " |" for row in rows) + "\n\n"
    return text


def public_path(path):
    return path == "/" or path in {"/terms", "/privacy"} or path.strip("/").split("/")[0] in CATEGORIES


def generate(public):
    sitemap = public / "sitemap.xml"
    tree = ET.parse(sitemap)
    markdown = public / "markdown"
    if markdown.exists():
        shutil.rmtree(markdown)
    markdown.mkdir()
    records = []
    removed = 0
    for entry in list(tree.getroot()):
        loc = entry.findtext("{*}loc", "")
        url = urlsplit(loc)
        if url.netloc != "bjjgraph.org":
            raise ValueError(f"Unexpected sitemap origin: {loc}")
        path = unquote(url.path).rstrip("/") or "/"
        if any(part in {".", ".."} for part in path.split("/")):
            raise ValueError(f"Unsafe sitemap path: {path}")
        source = public / (path.lstrip("/") + ".html" if path != "/" else "index.html")
        if not source.is_file():
            source = public / path.lstrip("/") / "index.html"
        if not source.is_file():
            raise ValueError(f"Sitemap target missing: {loc}")
        parser = ArticleParser()
        parser.feed(source.read_text(encoding="utf-8"))
        if parser.noindex:
            tree.getroot().remove(entry)
            removed += 1
            continue
        if not public_path(path) or parser.article is None:
            continue
        canonical = BASE + quote(path, safe="/-._~")
        body = render(parser.article, canonical).strip()
        if not body:
            continue
        title = render(parser.title, canonical).strip() if parser.title else path
        relative = (path.lstrip("/") if path != "/" else "index") + ".md"
        target = markdown / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(f"# {title}\n\nSource: {canonical}\n\n" + re.sub(r"\n[ \t]*\n(?:[ \t]*\n)+", "\n\n", body) + "\n", encoding="utf-8")
        records.append({"title": title, "url": canonical, "markdown": BASE + "/markdown/" + quote(relative, safe="/-._~")})
    if not any(r["url"] == BASE + "/" for r in records):
        raise ValueError("The homepage must have a public Markdown representation")
    if removed:
        ET.register_namespace("", "http://www.sitemaps.org/schemas/sitemap/0.9")
        tree.write(sitemap, encoding="utf-8", xml_declaration=True)
    shutil.copyfile(ROOT / "source/quartz/static/robots.txt", public / "robots.txt")
    for name in ("auth.md", "api.md", "openapi.json"):
        shutil.copyfile(ROOT / "site" / name, public / name)
    well_known = public / ".well-known"
    well_known.mkdir(exist_ok=True)
    (well_known / "api-catalog").write_text(json.dumps({"linkset": [{
        "anchor": BASE + "/",
        "service-desc": [{"href": BASE + "/openapi.json", "type": "application/json"}],
        "service-doc": [{"href": BASE + "/api.md", "type": "text/markdown"}],
    }]}, indent=2) + "\n")
    (public / "site-index.json").write_text(json.dumps({"name": "BJJ Graph", "pages": records}, ensure_ascii=False, indent=2) + "\n")
    # Narrow Function invocation: assets, Markdown files and discovery files remain static.
    # Derive existing Function routes so adding an endpoint cannot silently disable it.
    includes = {"/", "/terms", "/privacy"}
    for category in CATEGORIES:
        includes.update({f"/{category}", f"/{category}/*"})
    for fn in (ROOT / "functions").rglob("*.js"):
        if fn.name.startswith("_") or "onRequest" not in fn.read_text():
            continue
        parts = fn.relative_to(ROOT / "functions").with_suffix("").parts
        route = "/" + "/".join("*" if part.startswith("[") else part for part in parts)
        includes.add(route.removesuffix("/index") or "/")
    (public / "_routes.json").write_text(json.dumps({"version": 1, "include": sorted(includes), "exclude": []}, indent=2) + "\n")
    print(f"[agent_discovery] {len(records)} public Markdown pages; {removed} noindex sitemap entries removed; root discovery files published")


if __name__ == "__main__":
    args = argparse.ArgumentParser()
    args.add_argument("--public", type=Path, default=ROOT / "source/public")
    generate(args.parse_args().public)
