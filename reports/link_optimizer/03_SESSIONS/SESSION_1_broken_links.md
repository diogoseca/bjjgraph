# Broken Link Fix Session 1 of 3

**Status**: 🔴 Not Started
**Priority**: HIGH (most fixes)
**Files**: 100 files (indices 0-99)
**Total Fixes**: 370 broken wikilinks
**Agents**: 10 parallel agents
**Est. Duration**: 15-20 minutes

---

## Overview

This session fixes broken wikilinks in the first 100 files (sorted alphabetically). These include the files with the highest number of fixes.

**What are broken links?**
- Broken links are TYPOS or INCORRECT NAMES in wikilinks
- Example: `[[Defensive Base]]` should be `[[Defensive Frame]]`
- Fix = Find and replace incorrect wikilink with correct one

---

## Agent Distribution

Each agent processes ~37 broken link fixes:

- **Agent 1**: ~37 fixes (indices 0-36)
- **Agent 2**: ~37 fixes (indices 37-73)
- **Agent 3**: ~37 fixes (indices 74-110)
- **Agent 4**: ~37 fixes (indices 111-147)
- **Agent 5**: ~37 fixes (indices 148-184)
- **Agent 6**: ~37 fixes (indices 185-221)
- **Agent 7**: ~37 fixes (indices 222-258)
- **Agent 8**: ~37 fixes (indices 259-295)
- **Agent 9**: ~37 fixes (indices 296-332)
- **Agent 10**: ~37 fixes (indices 333-369)

---

## Orchestrator Prompt

**Copy the section below and paste into Claude orchestrator:**

```
I need you to orchestrate 10 agents in parallel to fix broken wikilinks in the BJJ Graph project.

TASK: Fix broken wikilinks (Session 1 of 3)
CHUNKS: reports/link_optimizer/sessions/session_1_chunks/

Launch 10 agents with the following prompts:

---AGENT 1---
You are Broken Link Fix Agent #1 of 10 (Session 1).

Load your chunk: reports/link_optimizer/sessions/session_1_chunks/agent_01_chunk.json

Task: Fix ~37 broken wikilinks by:
1. Read the chunk JSON to see all fixes
2. For each fix: Read source file, find [[broken link]], replace with [[suggested fix]] using Edit tool
3. Track results: fixed, skipped, errors
4. Report: total processed, fixed, errors, files modified

Start fixing now.

---AGENT 2---
You are Broken Link Fix Agent #2 of 10 (Session 1).
Load: reports/link_optimizer/sessions/session_1_chunks/agent_02_chunk.json
Task: Fix ~37 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 3---
You are Broken Link Fix Agent #3 of 10 (Session 1).
Load: reports/link_optimizer/sessions/session_1_chunks/agent_03_chunk.json
Task: Fix ~37 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 4---
You are Broken Link Fix Agent #4 of 10 (Session 1).
Load: reports/link_optimizer/sessions/session_1_chunks/agent_04_chunk.json
Task: Fix ~37 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 5---
You are Broken Link Fix Agent #5 of 10 (Session 1).
Load: reports/link_optimizer/sessions/session_1_chunks/agent_05_chunk.json
Task: Fix ~37 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 6---
You are Broken Link Fix Agent #6 of 10 (Session 1).
Load: reports/link_optimizer/sessions/session_1_chunks/agent_06_chunk.json
Task: Fix ~37 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 7---
You are Broken Link Fix Agent #7 of 10 (Session 1).
Load: reports/link_optimizer/sessions/session_1_chunks/agent_07_chunk.json
Task: Fix ~37 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 8---
You are Broken Link Fix Agent #8 of 10 (Session 1).
Load: reports/link_optimizer/sessions/session_1_chunks/agent_08_chunk.json
Task: Fix ~37 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 9---
You are Broken Link Fix Agent #9 of 10 (Session 1).
Load: reports/link_optimizer/sessions/session_1_chunks/agent_09_chunk.json
Task: Fix ~37 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.

---AGENT 10---
You are Broken Link Fix Agent #10 of 10 (Session 1).
Load: reports/link_optimizer/sessions/session_1_chunks/agent_10_chunk.json
Task: Fix ~37 broken wikilinks. Read chunk, replace broken links, track results, report.
Start now.
```

---

## Progress Tracking

Mark each agent when complete:

- [ ] Agent 1: ~37 fixes
- [ ] Agent 2: ~37 fixes
- [ ] Agent 3: ~37 fixes
- [ ] Agent 4: ~37 fixes
- [ ] Agent 5: ~37 fixes
- [ ] Agent 6: ~37 fixes
- [ ] Agent 7: ~37 fixes
- [ ] Agent 8: ~37 fixes
- [ ] Agent 9: ~37 fixes
- [ ] Agent 10: ~37 fixes

**Session Complete When**: All 10 agents report completion

---

## Expected Results

- **Fixes applied**: ~315-350 (85% success rate)
- **Files modified**: ~85-95 files
- **Common fixes**:
  - `[[Pull Guard]]` (19 fixes in one file)
  - `[[Scarf Hold Position]]` (18 fixes)
  - `[[Armbar from Side Control]]` (16 fixes)
  - Various hyphen/capitalization corrections

---

## Troubleshooting

**If agents are cut off**:
1. Check which agents completed (look for "Agent X complete" messages)
2. Note which agents failed
3. Re-run only failed agents using same chunk files
4. Chunks are idempotent - safe to re-run

**If fixes fail**:
- Most common: Link already fixed (skip)
- Second: Target file doesn't exist (skip)
- Third: Can't find broken link in source (skip)

---

## Next Steps

After Session 1 completes:
1. Mark session as complete in this file
2. Proceed to SESSION_2_broken_links.md
3. Run same orchestrator process for Session 2

**Sessions**: 1 of 3 (⚫ ⚪ ⚪)