# Escalations Log

The autonomous coding agent writes here when it encounters a true ambiguity that isn't covered by the per-pair tables in `~/.claude/plans/isn-t-scarf-hold-the-lazy-flame.md`, the do-not-merge list, or the decision flowchart in `docs/Synonyms.md`.

Format per entry:

```
## YYYY-MM-DD HH:MM — <short subject>
- Context: <one paragraph>
- What I tried: <bullet list>
- What I did instead: <one paragraph; the safe default>
- Recommended user action: <one sentence>
```

The user reviews this file periodically. If three or more entries accumulate in a single session, the agent must pause and surface them.

---
