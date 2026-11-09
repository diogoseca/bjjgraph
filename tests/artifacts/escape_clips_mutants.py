#!/usr/bin/env python3
"""Escape-media red proofs, using the video-card source mutation runner.

Run under heavy-advisory GO and the shared build lock, nice -n 10, one worker,
with TMPDIR and a verified-free PW_PORT. Every mutant must fail its named
journey while its unaffected browser control passes. The shared runner checks
nonzero selection, exact source anchors, builds and byte-for-byte restoration.
"""
import video_cards_mutants as runner

APP = runner.APP
SPEC = "e2e/journeys/escape-clips.spec.ts"
OWN = r"escape clips: own cards"
THREAT = r"escape clips: opponent threats"
ABSENT = r"escape clips: no escapes"
TARGET = 'if (opt.action === "escape") return { node, role: "defender", key: node.t, escape: opt.label };'
FIRST = "info.perspectives?.defender?.escapes?.[target.escape]?.[0]"
FRONT = "return escapeClip?.front === true ? escapeClip : null;"

runner.MUTANTS = [
    ("escape_target", APP, TARGET, "", SPEC, OWN, ABSENT),
    ("escape_queue", APP, "if (!target?.exact && !target?.escape) return;",
     "if (!target?.exact) return;", SPEC, OWN, ABSENT),
    ("escape_label", APP, FIRST, 'info.perspectives?.defender?.escapes?.["Stack escape"]?.[0]',
     SPEC, OWN, ABSENT),
    ("escape_first", APP, FIRST, "info.perspectives?.defender?.escapes?.[target.escape]?.at(-1)",
     SPEC, OWN, ABSENT),
    ("escape_start", APP, "start: clip.start || 0, end: clip.end || undefined",
     "start: 0, end: clip.end || undefined", SPEC, OWN, ABSENT),
    ("defender_reel_fallback", APP, FIRST, f"({FIRST} || info.perspectives?.defender?.clips?.[0])",
     SPEC, r"escape clips: no label entry", OWN),
    ("escape_front", APP, FRONT, "return escapeClip || null;",
     SPEC, r"escape clips: unapproved first", OWN),
    ("escape_later", APP, FIRST, "info.perspectives?.defender?.escapes?.[target.escape]?.find(c => c.front === true)",
     SPEC, r"escape clips: approved later", OWN),
    ("escape_truthy", APP, FRONT, "return escapeClip?.front ? escapeClip : null;",
     SPEC, r"escape clips: truthy front", OWN),
    ("threat_escape_excluded", APP, TARGET, TARGET.replace('opt.action === "escape"', 'opt.action === "escape" && !opt.threat'),
     SPEC, THREAT, OWN),
]

if __name__ == "__main__":
    runner.main()
