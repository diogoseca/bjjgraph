# Broken Link Fix Session 3 of 3 (FINAL)

**Status**: 🔴 Not Started (requires Sessions 1-2 completion)
**Priority**: LOW (cleanup)
**Files**: 47 files (indices 200-246)
**Total Fixes**: 120 broken wikilinks
**Agents**: 10 parallel agents (lighter load)
**Est. Duration**: 8-10 minutes

---

## Overview

This is the FINAL session, fixing broken wikilinks in the remaining 47 files. These are primarily concepts, systems, and remaining transitions.

**Prerequisites**: Sessions 1 and 2 must be complete before starting Session 3.

---

## Agent Distribution

Each agent processes ~12 broken link fixes (lighter load):

- **Agent 1**: ~12 fixes (indices 0-11)
- **Agent 2**: ~12 fixes (indices 12-23)
- **Agent 3**: ~12 fixes (indices 24-35)
- **Agent 4**: ~12 fixes (indices 36-47)
- **Agent 5**: ~12 fixes (indices 48-59)
- **Agent 6**: ~12 fixes (indices 60-71)
- **Agent 7**: ~12 fixes (indices 72-83)
- **Agent 8**: ~12 fixes (indices 84-95)
- **Agent 9**: ~12 fixes (indices 96-107)
- **Agent 10**: ~12 fixes (indices 108-119)

---

## Orchestrator Prompt

**Copy the section below and paste into Claude orchestrator:**

```
I need you to orchestrate 10 agents in parallel to fix broken wikilinks in the BJJ Graph project.

TASK: Fix broken wikilinks (Session 3 of 3 - FINAL SESSION)
CHUNKS: reports/link_optimizer/sessions/session_3_chunks/

Launch 10 agents with the following prompts:

---AGENT 1---
You are Broken Link Fix Agent #1 of 10 (Session 3 - FINAL).

Load your chunk: reports/link_optimizer/sessions/session_3_chunks/agent_01_chunk.json

Task: Fix ~12 broken wikilinks by:
1. Read the chunk JSON to see all fixes
2. For each fix: Read source file, find [[broken link]], replace with [[suggested fix]] using Edit tool
3. Track results: fixed, skipped, errors
4. Report: total processed, fixed, errors, files modified

Start fixing now.

---AGENT 2---
You are Broken Link Fix Agent #2 of 10 (Session 3 - FINAL).
Load: reports/link_optimizer/sessions/session_3_chunks/agent_02_chunk.json
Task: Fix ~12 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 3---
You are Broken Link Fix Agent #3 of 10 (Session 3 - FINAL).
Load: reports/link_optimizer/sessions/session_3_chunks/agent_03_chunk.json
Task: Fix ~12 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 4---
You are Broken Link Fix Agent #4 of 10 (Session 3 - FINAL).
Load: reports/link_optimizer/sessions/session_3_chunks/agent_04_chunk.json
Task: Fix ~12 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 5---
You are Broken Link Fix Agent #5 of 10 (Session 3 - FINAL).
Load: reports/link_optimizer/sessions/session_3_chunks/agent_05_chunk.json
Task: Fix ~12 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 6---
You are Broken Link Fix Agent #6 of 10 (Session 3 - FINAL).
Load: reports/link_optimizer/sessions/session_3_chunks/agent_06_chunk.json
Task: Fix ~12 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 7---
You are Broken Link Fix Agent #7 of 10 (Session 3 - FINAL).
Load: reports/link_optimizer/sessions/session_3_chunks/agent_07_chunk.json
Task: Fix ~12 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 8---
You are Broken Link Fix Agent #8 of 10 (Session 3 - FINAL).
Load: reports/link_optimizer/sessions/session_3_chunks/agent_08_chunk.json
Task: Fix ~12 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 9---
You are Broken Link Fix Agent #9 of 10 (Session 3 - FINAL).
Load: reports/link_optimizer/sessions/session_3_chunks/agent_09_chunk.json
Task: Fix ~12 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 10---
You are Broken Link Fix Agent #10 of 10 (Session 3 - FINAL).
Load: reports/link_optimizer/sessions/session_3_chunks/agent_10_chunk.json
Task: Fix ~12 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.
```

---

## Progress Tracking

Mark each agent when complete:

- [ ] Agent 1: ~12 fixes
- [ ] Agent 2: ~12 fixes
- [ ] Agent 3: ~12 fixes
- [ ] Agent 4: ~12 fixes
- [ ] Agent 5: ~12 fixes
- [ ] Agent 6: ~12 fixes
- [ ] Agent 7: ~12 fixes
- [ ] Agent 8: ~12 fixes
- [ ] Agent 9: ~12 fixes
- [ ] Agent 10: ~12 fixes

**Session Complete When**: All 10 agents report completion

---

## Expected Results

- **Fixes applied**: ~100-110 (85% success rate)
- **Files modified**: ~40-45 files
- **Focus areas**:
  - Concept files (Control Maintenance, Head Control, etc.)
  - System files (Back Attack System, Competition Strategy, etc.)
  - Remaining transition files

---

## Completion

When Session 3 completes:

🎉 **ALL 847 BROKEN LINK FIXES COMPLETE!**

### Final Impact
- **Total fixes across all 3 sessions**: ~720-760 (85% success rate)
- **Total files modified**: ~210-230 files
- **Link quality improvement**: 62.9% → 80%+ valid links

### Next Steps After Completion
1. Run validation again: `python3 scripts/link_optimizer/link_optimizer_cli.py --mode validate`
2. Compare before/after metrics
3. Review remaining broken links (if any)
4. Consider processing medium-confidence suggestions (614 remaining)

**Sessions**: 3 of 3 (⚫ ⚫ ⚫) ✅ COMPLETE