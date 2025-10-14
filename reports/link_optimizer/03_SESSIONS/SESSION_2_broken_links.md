# Broken Link Fix Session 2 of 3

**Status**: 🔴 Not Started (requires Session 1 completion)
**Priority**: MEDIUM
**Files**: 100 files (indices 100-199)
**Total Fixes**: 357 broken wikilinks
**Agents**: 10 parallel agents
**Est. Duration**: 12-15 minutes

---

## Overview

This session fixes broken wikilinks in files 100-199 (sorted alphabetically). These are primarily transitions and mid-range positions.

**Prerequisites**: Session 1 must be complete before starting Session 2.

---

## Agent Distribution

Each agent processes ~36 broken link fixes:

- **Agent 1**: ~36 fixes (indices 0-35)
- **Agent 2**: ~36 fixes (indices 36-71)
- **Agent 3**: ~36 fixes (indices 72-107)
- **Agent 4**: ~36 fixes (indices 108-143)
- **Agent 5**: ~36 fixes (indices 144-179)
- **Agent 6**: ~36 fixes (indices 180-215)
- **Agent 7**: ~36 fixes (indices 216-251)
- **Agent 8**: ~36 fixes (indices 252-287)
- **Agent 9**: ~36 fixes (indices 288-323)
- **Agent 10**: ~36 fixes (indices 324-356)

---

## Orchestrator Prompt

**Copy the section below and paste into Claude orchestrator:**

```
I need you to orchestrate 10 agents in parallel to fix broken wikilinks in the BJJ Graph project.

TASK: Fix broken wikilinks (Session 2 of 3)
CHUNKS: reports/link_optimizer/sessions/session_2_chunks/

Launch 10 agents with the following prompts:

---AGENT 1---
You are Broken Link Fix Agent #1 of 10 (Session 2).

Load your chunk: reports/link_optimizer/sessions/session_2_chunks/agent_01_chunk.json

Task: Fix ~36 broken wikilinks by:
1. Read the chunk JSON to see all fixes
2. For each fix: Read source file, find [[broken link]], replace with [[suggested fix]] using Edit tool
3. Track results: fixed, skipped, errors
4. Report: total processed, fixed, errors, files modified

Start fixing now.

---AGENT 2---
You are Broken Link Fix Agent #2 of 10 (Session 2).
Load: reports/link_optimizer/sessions/session_2_chunks/agent_02_chunk.json
Task: Fix ~36 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 3---
You are Broken Link Fix Agent #3 of 10 (Session 2).
Load: reports/link_optimizer/sessions/session_2_chunks/agent_03_chunk.json
Task: Fix ~36 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 4---
You are Broken Link Fix Agent #4 of 10 (Session 2).
Load: reports/link_optimizer/sessions/session_2_chunks/agent_04_chunk.json
Task: Fix ~36 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 5---
You are Broken Link Fix Agent #5 of 10 (Session 2).
Load: reports/link_optimizer/sessions/session_2_chunks/agent_05_chunk.json
Task: Fix ~36 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 6---
You are Broken Link Fix Agent #6 of 10 (Session 2).
Load: reports/link_optimizer/sessions/session_2_chunks/agent_06_chunk.json
Task: Fix ~36 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 7---
You are Broken Link Fix Agent #7 of 10 (Session 2).
Load: reports/link_optimizer/sessions/session_2_chunks/agent_07_chunk.json
Task: Fix ~36 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 8---
You are Broken Link Fix Agent #8 of 10 (Session 2).
Load: reports/link_optimizer/sessions/session_2_chunks/agent_08_chunk.json
Task: Fix ~36 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 9---
You are Broken Link Fix Agent #9 of 10 (Session 2).
Load: reports/link_optimizer/sessions/session_2_chunks/agent_09_chunk.json
Task: Fix ~36 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 10---
You are Broken Link Fix Agent #10 of 10 (Session 2).
Load: reports/link_optimizer/sessions/session_2_chunks/agent_10_chunk.json
Task: Fix ~36 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.
```

---

## Progress Tracking

Mark each agent when complete:

- [ ] Agent 1: ~36 fixes
- [ ] Agent 2: ~36 fixes
- [ ] Agent 3: ~36 fixes
- [ ] Agent 4: ~36 fixes
- [ ] Agent 5: ~36 fixes
- [ ] Agent 6: ~36 fixes
- [ ] Agent 7: ~36 fixes
- [ ] Agent 8: ~36 fixes
- [ ] Agent 9: ~36 fixes
- [ ] Agent 10: ~36 fixes

**Session Complete When**: All 10 agents report completion

---

## Expected Results

- **Fixes applied**: ~305-320 (85% success rate)
- **Files modified**: ~85-90 files
- **Common fixes**:
  - Transition file link corrections
  - Position name standardizations
  - Hyphen/slash corrections

---

## Next Steps

After Session 2 completes:
1. Mark session as complete in this file
2. Proceed to SESSION_3_broken_links.md
3. Run same orchestrator process for Session 3 (final)

**Sessions**: 2 of 3 (⚫ ⚫ ⚪)
