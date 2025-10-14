# Broken Link Fix Session 4 - Cleanup & Completion

**Status**: 🔴 Not Started
**Priority**: CRITICAL (completes missing work from Sessions 1-3)
**Total Fixes**: 462 broken wikilinks across 14 missing agent chunks
**Agents**: 10 parallel agents
**Est. Duration**: 20-25 minutes

---

## Overview

This session completes all missing work from Sessions 1-3 by processing 14 agent chunks that were never completed or didn't generate results files.

**What happened?**
- Sessions 1-3 had 14 agents that either:
  - Never ran (no results file generated)
  - Ran but didn't complete properly
  - Completed but results weren't saved

**Current Status:**
- ✅ **71 links (15.4%)** - Already fixed, just need documentation
- 🔴 **120 links (26.0%)** - Still broken, need active fixing
- ⚠️ **271 links (58.7%)** - Ambiguous (not found, needs investigation)

**This session will:**
1. Fix all 120 confirmed broken links
2. Investigate and document 271 ambiguous cases
3. Generate 14 complete results JSON files for audit trail

---

## Agent Distribution

Each agent processes 1-2 original agent chunks (balanced by workload):

| New Agent | Old Chunks | Total Fixes | Broken | Ambiguous | Already Fixed |
|-----------|------------|-------------|--------|-----------|---------------|
| **Agent 1** | session_1_agent_02 | 37 | 24 | 13 | 0 |
| **Agent 2** | session_2_agent_03, session_1_agent_10 | 73 | 25 | 24 | 24 |
| **Agent 3** | session_2_agent_09, session_3_agent_01 | 48 | 21 | 27 | 0 |
| **Agent 4** | session_2_agent_02, session_1_agent_01 | 73 | 17 | 22 | 34 |
| **Agent 5** | session_1_agent_06 | 37 | 11 | 26 | 0 |
| **Agent 6** | session_1_agent_09 | 37 | 4 | 33 | 0 |
| **Agent 7** | session_2_agent_01 | 36 | 4 | 19 | 13 |
| **Agent 8** | session_2_agent_05 | 36 | 4 | 32 | 0 |
| **Agent 9** | session_3_agent_09, session_2_agent_06 | 48 | 7 | 41 | 0 |
| **Agent 10** | session_1_agent_07 | 37 | 3 | 34 | 0 |

**Total**: 462 fixes (120 broken, 271 ambiguous, 71 already fixed)

---

## Orchestrator Prompt

**Copy the section below and paste into a NEW Claude conversation:**

```
I need you to orchestrate 10 agents in parallel to complete missing broken wikilink fixes from Sessions 1-3 of the link optimizer project.

TASK: Complete all missing link fixes (Session 4 - Final Cleanup)
ORIGINAL CHUNKS: reports/link_optimizer/sessions/session_{1,2,3}_chunks/

Each agent will process 1-2 original agent chunks that were never completed.

Launch 10 agents with the following prompts:

---AGENT 1---
You are Cleanup Agent #1 of 10 (Session 4 - Final Cleanup).

**Your Mission**: Process session_1_agent_02 chunk (37 fixes: 24 broken, 13 ambiguous)

**Instructions**:
1. Load chunk: reports/link_optimizer/sessions/session_1_chunks/agent_02_chunk.json
2. For each fix in the chunk:
   - Find source file in source/content/{Positions,Transitions,Submissions,Concepts,Systems}/
   - Search for broken wikilink [[Old Link]]
   - If found: Replace with [[New Link]] using Edit tool
   - Track result: fixed, already_fixed, not_found, error
3. Create results file: reports/link_optimizer/sessions/session_1_chunks/agent_02_results.json

**Results JSON Format**:
{
  "session": 1,
  "agent": 2,
  "total_fixes_attempted": 37,
  "fixes_completed": X,
  "fixes_skipped": Y,
  "summary": "Brief summary of work",
  "completed_fixes": [
    {
      "source_file": "File Name",
      "source_path": "/full/path/to/file.md",
      "old_link": "Old Link",
      "new_link": "New Link",
      "status": "success",
      "confidence": 80.0
    }
  ],
  "skipped_fixes": [
    {
      "source_file": "File Name",
      "target_link": "Old Link",
      "suggested_fix": "New Link",
      "reason": "Link not found in source file - may have been already fixed",
      "confidence": 80.0
    }
  ],
  "files_modified": ["/list/of/modified/files.md"],
  "validation_notes": ["Notes about fixes"],
  "completion_time": "2025-10-13",
  "agent_efficiency": "X% (Y of Z attempted fixes completed)"
}

**Ambiguous Cases**: If [[Old Link]] not found and [[New Link]] not found either, mark as skipped with reason: "Link not found in source file - may be false positive or different format"

Start now.

---AGENT 2---
You are Cleanup Agent #2 of 10 (Session 4).

**Your Mission**: Process 2 chunks:
  1. session_2_agent_03 (36 fixes: 23 broken, 13 ambiguous)
  2. session_1_agent_10 (37 fixes: 2 broken, 11 ambiguous, 24 already fixed)

**Instructions**:
1. Load first chunk: reports/link_optimizer/sessions/session_2_chunks/agent_03_chunk.json
2. Process all fixes (search, replace, track results)
3. Create results: reports/link_optimizer/sessions/session_2_chunks/agent_03_results.json
4. Load second chunk: reports/link_optimizer/sessions/session_1_chunks/agent_10_chunk.json
5. Process all fixes
6. Create results: reports/link_optimizer/sessions/session_1_chunks/agent_10_results.json

Use same results JSON format as Agent 1. Handle ambiguous cases gracefully.

Start now.

---AGENT 3---
You are Cleanup Agent #3 of 10 (Session 4).

**Your Mission**: Process 2 chunks:
  1. session_2_agent_09 (36 fixes: 19 broken, 17 ambiguous)
  2. session_3_agent_01 (12 fixes: 2 broken, 10 ambiguous)

Load chunks, process fixes, create results files:
  - reports/link_optimizer/sessions/session_2_chunks/agent_09_results.json
  - reports/link_optimizer/sessions/session_3_chunks/agent_01_results.json

Start now.

---AGENT 4---
You are Cleanup Agent #4 of 10 (Session 4).

**Your Mission**: Process 2 chunks:
  1. session_2_agent_02 (36 fixes: 17 broken, 19 ambiguous)
  2. session_1_agent_01 (37 fixes: 0 broken, 3 ambiguous, 34 already fixed)

Load chunks, process fixes, create results files:
  - reports/link_optimizer/sessions/session_2_chunks/agent_02_results.json
  - reports/link_optimizer/sessions/session_1_chunks/agent_01_results.json

Note: session_1_agent_01 is mostly already fixed, focus on documentation.

Start now.

---AGENT 5---
You are Cleanup Agent #5 of 10 (Session 4).

**Your Mission**: Process session_1_agent_06 (37 fixes: 11 broken, 26 ambiguous)

Load chunk: reports/link_optimizer/sessions/session_1_chunks/agent_06_chunk.json
Process fixes, create results: reports/link_optimizer/sessions/session_1_chunks/agent_06_results.json

Start now.

---AGENT 6---
You are Cleanup Agent #6 of 10 (Session 4).

**Your Mission**: Process session_1_agent_09 (37 fixes: 4 broken, 33 ambiguous)

Load chunk: reports/link_optimizer/sessions/session_1_chunks/agent_09_chunk.json
Process fixes, create results: reports/link_optimizer/sessions/session_1_chunks/agent_09_results.json

Note: High ambiguous count - document thoroughly why links not found.

Start now.

---AGENT 7---
You are Cleanup Agent #7 of 10 (Session 4).

**Your Mission**: Process session_2_agent_01 (36 fixes: 4 broken, 19 ambiguous, 13 already fixed)

Load chunk: reports/link_optimizer/sessions/session_2_chunks/agent_01_chunk.json
Process fixes, create results: reports/link_optimizer/sessions/session_2_chunks/agent_01_results.json

Start now.

---AGENT 8---
You are Cleanup Agent #8 of 10 (Session 4).

**Your Mission**: Process session_2_agent_05 (36 fixes: 4 broken, 32 ambiguous)

Load chunk: reports/link_optimizer/sessions/session_2_chunks/agent_05_chunk.json
Process fixes, create results: reports/link_optimizer/sessions/session_2_chunks/agent_05_results.json

Note: High ambiguous count - document thoroughly.

Start now.

---AGENT 9---
You are Cleanup Agent #9 of 10 (Session 4).

**Your Mission**: Process 2 chunks:
  1. session_3_agent_09 (12 fixes: 4 broken, 8 ambiguous)
  2. session_2_agent_06 (36 fixes: 3 broken, 33 ambiguous)

Load chunks, process fixes, create results files:
  - reports/link_optimizer/sessions/session_3_chunks/agent_09_results.json
  - reports/link_optimizer/sessions/session_2_chunks/agent_06_results.json

Start now.

---AGENT 10---
You are Cleanup Agent #10 of 10 (Session 4).

**Your Mission**: Process session_1_agent_07 (37 fixes: 3 broken, 34 ambiguous)

Load chunk: reports/link_optimizer/sessions/session_1_chunks/agent_07_chunk.json
Process fixes, create results: reports/link_optimizer/sessions/session_1_chunks/agent_07_results.json

Note: High ambiguous count - document thoroughly why links not found.

Start now.
```

---

## Progress Tracking

Mark each agent when complete:

- [ ] Agent 1: session_1_agent_02 (37 fixes)
- [ ] Agent 2: session_2_agent_03 + session_1_agent_10 (73 fixes)
- [ ] Agent 3: session_2_agent_09 + session_3_agent_01 (48 fixes)
- [ ] Agent 4: session_2_agent_02 + session_1_agent_01 (73 fixes)
- [ ] Agent 5: session_1_agent_06 (37 fixes)
- [ ] Agent 6: session_1_agent_09 (37 fixes)
- [ ] Agent 7: session_2_agent_01 (36 fixes)
- [ ] Agent 8: session_2_agent_05 (36 fixes)
- [ ] Agent 9: session_3_agent_09 + session_2_agent_06 (48 fixes)
- [ ] Agent 10: session_1_agent_07 (37 fixes)

**Session Complete When**: All 10 agents report completion + 14 results JSON files created

---

## Expected Results

**Link Fixes**:
- Confirmed broken links fixed: ~110-120 (of 120 identified)
- Already fixed (documented): ~71
- Ambiguous cases (investigated & documented): ~271

**Files**:
- Results JSON files created: 14
- Content files modified: ~90-110 files
- Total audit trail: Complete for all 847 original fixes

**Common Fix Categories**:
1. Hyphen corrections: `[[50/50 Guard]]` → `[[50-50 Guard]]`
2. Capitalization: `[[Triangle Choke]]` → `[[triangle choke side]]`
3. Specificity: `[[Closed Guard]]` → `[[Closed Guard Top]]`
4. Name corrections: `[[Defensive Base]]` → `[[Defensive Frame]]`

---

## Ambiguous Case Handling

**Ambiguous = Neither old link nor new link found in source file**

Common reasons:
1. **Already fixed differently**: Link was corrected but to different target
2. **False positive**: Similarity matching suggested wrong file
3. **Format difference**: Link exists but in different format (e.g., inside schema JSON)
4. **Link removed**: Content was refactored and link removed entirely

**How to handle**:
- Mark as `skipped` in results JSON
- Provide clear reason explaining why not found
- Example: "Link not found in source file - likely already fixed in different format or false positive from similarity matching"

---

## Results File Location

All results files go in their original session directories:

```
reports/link_optimizer/sessions/
├── session_1_chunks/
│   ├── agent_01_results.json  ← CREATE THIS
│   ├── agent_02_results.json  ← CREATE THIS
│   ├── agent_06_results.json  ← CREATE THIS
│   ├── agent_07_results.json  ← CREATE THIS
│   ├── agent_09_results.json  ← CREATE THIS
│   └── agent_10_results.json  ← CREATE THIS
├── session_2_chunks/
│   ├── agent_01_results.json  ← CREATE THIS
│   ├── agent_02_results.json  ← CREATE THIS
│   ├── agent_03_results.json  ← CREATE THIS
│   ├── agent_05_results.json  ← CREATE THIS
│   ├── agent_06_results.json  ← CREATE THIS
│   └── agent_09_results.json  ← CREATE THIS
└── session_3_chunks/
    ├── agent_01_results.json  ← CREATE THIS
    └── agent_09_results.json  ← CREATE THIS
```

---

## Validation

After session completes, verify:

1. **Results files created**: Check all 14 results JSON files exist
2. **Git diff**: Review modified files
   ```bash
   git status
   git diff --stat
   ```
3. **Link validator**: Re-run validation to measure improvement
   ```bash
   python3 scripts/link_optimizer/link_optimizer_cli.py --mode validate
   ```

**Expected improvement**:
- Before Session 4: ~4,213 broken links
- After Session 4: ~4,093 broken links (~120 fixed)
- Valid links: Should improve to 63-64% (from 62.9%)

---

## Troubleshooting

**If agents are cut off**:
1. Check which agents completed (look for results JSON files)
2. Re-run only incomplete agents
3. Safe to re-run - already-fixed links will be skipped

**If high skip rate**:
- Expected! 58.7% are ambiguous cases
- Focus on ensuring proper documentation in results JSON
- Skipped fixes are NOT failures - they're documented decisions

**If results JSON format unclear**:
- Look at existing results files for reference:
  - `session_1_chunks/agent_03_results.json`
  - `session_2_chunks/agent_04_results.json`
  - `session_3_chunks/agent_02_results.json`

---

## Success Criteria

Session 4 is complete when:
- ✅ All 10 agents have reported completion
- ✅ All 14 results JSON files created and valid
- ✅ ~110-120 broken links fixed in content files
- ✅ All ambiguous cases documented with reasons
- ✅ Git diff shows modified files match expectations

---

## After Completion

1. **Update this file** - Mark session as complete
2. **Update README.md** - Add Session 4 to progress tracking
3. **Git commit** - Commit all fixes with descriptive message
4. **Create summary** - Document total impact across all 4 sessions
5. **Optional**: Run link optimizer again to measure total improvement

---

**Ready to start?** Copy the orchestrator prompt above and paste into a new Claude conversation!

**Sessions**: 4 of 4 (Final Cleanup) 🎯
