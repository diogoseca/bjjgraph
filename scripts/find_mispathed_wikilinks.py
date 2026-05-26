#!/usr/bin/env python3
"""Find wikilinks that point to existing pages but with wrong paths.
Separates truly broken links (target exists, path wrong) from missing pages."""
import re
from pathlib import Path
from collections import defaultdict

CONTENT_DIR = Path("content")

# Build lookup: filename -> list of full paths
# e.g. "Attacker" -> ["Submissions/Loop Choke/from Mount/Attacker", ...]
file_by_name = defaultdict(list)
valid_slugs = set()

for md_file in CONTENT_DIR.rglob("*.md"):
    rel = md_file.relative_to(CONTENT_DIR)
    slug = str(rel.with_suffix(""))
    valid_slugs.add(slug)
    name = rel.stem  # just the filename without extension
    file_by_name[name].append(slug)

valid_slugs.add("game-over")

WIKILINK_RE = re.compile(r'\[\[([^\]|]+?)(?:\|([^\]]*?))?\]\]')

# Categories of broken links
mispathed = []  # Target exists at a different path
truly_missing = []  # Target doesn't exist at all

for md_file in sorted(CONTENT_DIR.rglob("*.md")):
    rel = str(md_file.relative_to(CONTENT_DIR))
    with open(md_file, 'r', encoding='utf-8') as f:
        for lineno, line in enumerate(f, 1):
            for m in WIKILINK_RE.finditer(line):
                target = m.group(1).strip()
                display = m.group(2)

                # Strip hash fragments
                base = target.split("#")[0]
                if not base:
                    continue

                # Check if target is valid
                if base in valid_slugs:
                    continue

                # Check if the last component(s) match an existing file
                parts = base.replace("\\", "/").split("/")
                leaf = parts[-1]  # e.g. "Attacker" or "Loop Choke from Mount"

                # Try to find matching files
                candidates = file_by_name.get(leaf, [])

                # For "X/Attacker" or "X/Defender" or "X/Top" or "X/Bottom",
                # check if there's a matching file where the parent context matches
                if candidates:
                    # Check if any candidate's parent path contains the expected parent
                    parent_hint = "/".join(parts[:-1]) if len(parts) > 1 else ""
                    mispathed.append({
                        "file": rel,
                        "line": lineno,
                        "wikilink": target,
                        "display": display,
                        "candidates": candidates[:5],
                        "context": line.strip()[:150]
                    })
                else:
                    # Also check if the full target name matches a filename somewhere
                    # e.g. "Loop Choke from Mount" as a filename stem
                    full_name_candidates = file_by_name.get(base.split("/")[-1] if "/" in base else base, [])
                    if full_name_candidates:
                        mispathed.append({
                            "file": rel,
                            "line": lineno,
                            "wikilink": target,
                            "display": display,
                            "candidates": full_name_candidates[:5],
                            "context": line.strip()[:150]
                        })
                    else:
                        truly_missing.append({
                            "file": rel,
                            "line": lineno,
                            "wikilink": target,
                            "display": display,
                        })

# Report mispathed links (these are the bugs!)
print(f"=== MISPATHED WIKILINKS (target exists but path is wrong): {len(mispathed)} ===\n")

by_pattern = defaultdict(list)
for m in mispathed:
    # Classify by the type of mismatch
    target = m["wikilink"]
    parts = target.split("/")
    if parts[-1] in ("Attacker", "Defender"):
        pattern = "Role link (Attacker/Defender)"
    elif parts[-1] in ("Top", "Bottom"):
        pattern = "Role link (Top/Bottom)"
    else:
        pattern = "Other mispathed"
    by_pattern[pattern].append(m)

for pattern, items in sorted(by_pattern.items()):
    print(f"\n--- {pattern}: {len(items)} occurrences ---")
    # Group by wikilink target
    by_target = defaultdict(list)
    for item in items:
        by_target[item["wikilink"]].append(item)

    shown = 0
    for target, occs in sorted(by_target.items()):
        if shown >= 20:
            remaining = len(by_target) - 20
            print(f"\n  ... and {remaining} more unique targets")
            break
        print(f"\n  [[{target}]] ({len(occs)} occurrences)")
        print(f"    Candidates: {occs[0]['candidates'][:3]}")
        for occ in occs[:2]:
            print(f"    - {occ['file']}:{occ['line']} | {occ['display'] or ''}")
        shown += 1

# Summary of truly missing
print(f"\n\n=== TRULY MISSING PAGES (no matching file at all): {len(truly_missing)} unique targets ===")
missing_targets = set(m["wikilink"] for m in truly_missing)
# Show category breakdown
cat_counts = defaultdict(int)
for t in missing_targets:
    parts = t.split("/")
    cat = parts[0] if len(parts) > 1 else "(no category)"
    cat_counts[cat] += 1

print("\nBy category prefix:")
for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
    print(f"  {cat}: {count}")
print(f"\nTotal unique missing targets: {len(missing_targets)}")
