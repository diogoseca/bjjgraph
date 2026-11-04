# P1 mutation receipts

Status: implementation verification in progress. No mutation kill is claimed until its clean
baseline passes and the concrete source mutation fails its intended named assertion with a positive
executed-test count. Build failures and browser crashes are not kills.

The [source mutation runner](ladder_p1_mutants.mjs) defines 26 concrete faults across these six
claims and restores the original sources and app build after execution. Its receipts are pending.

| Claim | Required fault families | Status |
|---|---|---|
| P1-A | Intro before card, covering footer, no first opener | Pending |
| P1-B | Entry guard, locked chevron, hidden navigation, earlier visibility, global advanced restriction | Pending |
| P1-C | Completion/goal gate, replacement session, duplicate shared credit | Pending |
| P1-D | Replacement on arrival, skipped append after engagement, repaint during press, focus theft | Pending |
| P1-E | Detached registry, Space toggles play, swipe dismisses, unwanted resume | Pending |
| P1-F | Missing checkpoint/comparison/rewards/Path, filtered advanced debt, duplicate visits | Pending |
