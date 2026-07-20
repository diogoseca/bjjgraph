# Gameplay issues found by the test-generation waves

Real bugs / UX mismatches discovered while agents played the app. Each entry pairs with a
**quarantined red spec** in this directory — a failing test that becomes the ready-made
regression proof the moment the bug is fixed (run `npm run e2e:quarantine`; a spec going
GREEN means its bug is fixed → move the spec to `e2e/gen/`, flip its ledger entry to
`accepted`, and mark the entry below Fixed).

Tags: `bug` (broken behavior) · `ux-copy` (stale/wrong copy vs actual mechanics) ·
`design-question` (behavior unclear — owner call needed).

Format per entry:

```
## QNNN — <one-line title>   [tag] [status: Open|Fixed|Wontfix]
- Spec: e2e/quarantine/<file>.spec.ts (absent for ux-copy/design-question entries)
- Found: wave N, <persona> at <feature>
- Expected: ...
- Actual: ...
- Notes: repro details, suspected cause
```

---

*(no entries yet — waves have not run)*
