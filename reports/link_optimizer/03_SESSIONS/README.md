# Broken Link Fix Sessions - Master Guide

**Purpose**: Fix 847 broken wikilinks across 247 files in 4 sessions (3 original + 1 cleanup)
**Strategy**: 10 parallel agents per session
**Total Time**: ~55-70 minutes across 4 sessions

---

## Quick Start

### Session 1 (Start Here)
1. Open `SESSION_1_broken_links.md`
2. Copy the "Orchestrator Prompt" section
3. Paste into a **new Claude conversation**
4. Claude will launch 10 agents in parallel
5. Wait for completion (~15-20 minutes)
6. Mark session 1 complete in the file

### Session 2 (After Session 1)
1. Open `SESSION_2_broken_links.md`
2. Copy the orchestrator prompt
3. Paste into a **new Claude conversation**
4. Wait for completion (~12-15 minutes)
5. Mark session 2 complete

### Session 3 (After Session 2)
1. Open `SESSION_3_broken_links.md`
2. Copy the orchestrator prompt
3. Paste into a **new Claude conversation**
4. Wait for completion (~8-10 minutes)
5. Mark session 3 complete

### Session 4 - Final Cleanup (Required!)
1. Open `SESSION_4_cleanup.md`
2. Copy the orchestrator prompt
3. Paste into a **new Claude conversation**
4. Wait for completion (~20-25 minutes)
5. Mark session 4 complete

🎉 **All broken links fixed and documented!**

---

## Session Breakdown

| Session | Files | Fixes | Agents | Duration | Priority | Status |
|---------|-------|-------|--------|----------|----------|--------|
| **Session 1** | 100 | 370 | 10 | 15-20 min | HIGH | ⚠️ Partial |
| **Session 2** | 100 | 357 | 10 | 12-15 min | MEDIUM | ⚠️ Partial |
| **Session 3** | 47 | 120 | 10 | 8-10 min | LOW | ⚠️ Partial |
| **Session 4** | 14 chunks | 462 | 10 | 20-25 min | CRITICAL | 🔴 Required |
| **TOTAL** | **247** | **847** | **40** | **55-70 min** | - | - |

**Note**: Session 4 is REQUIRED to complete missing work from Sessions 1-3. Some agents in the original sessions didn't complete properly or generate results files.

---

## What Gets Fixed

**Broken links are typos/incorrect names in wikilinks:**
- `[[Defensive Base]]` → `[[Defensive Frame]]` ✓
- `[[Submission Chain]]` → `[[Submission Chains]]` ✓
- `[[50/50 Guard]]` → `[[50-50 Guard]]` ✓

**NOT creating new files** - just fixing existing wikilink names.

---

## Directory Structure

```
reports/link_optimizer/sessions/
├── README.md                           # This file
├── SESSION_1_broken_links.md           # Session 1 instructions
├── SESSION_2_broken_links.md           # Session 2 instructions
├── SESSION_3_broken_links.md           # Session 3 instructions
├── SESSION_4_cleanup.md                # Session 4 instructions (REQUIRED)
├── session_1_chunks/                   # Agent data for session 1
│   ├── agent_01_chunk.json             # ~37 fixes
│   ├── agent_02_chunk.json             # ~37 fixes
│   ├── agent_XX_results.json           # Results (some missing - Session 4 will create)
│   └── ... (agent_03 through agent_10)
├── session_2_chunks/                   # Agent data for session 2
│   └── ... (10 agent chunks, ~36 fixes each, some results missing)
└── session_3_chunks/                   # Agent data for session 3
    └── ... (10 agent chunks, ~12 fixes each, some results missing)
```

---

## Chunk File Format

Each `agent_XX_chunk.json` contains:

```json
{
  "session": 1,
  "agent": 1,
  "total_agents": 10,
  "fix_count": 37,
  "fixes": [
    {
      "source_file": "Half Guard Top",
      "target_link": "Defensive Base",
      "suggested_fix": "defensive frame",
      "confidence": 82.8
    },
    ...
  ]
}
```

---

## How Agents Work

Each agent:
1. **Loads** their chunk JSON file
2. **Reads** each source markdown file
3. **Finds** the broken wikilink `[[Old Name]]`
4. **Replaces** with suggested fix `[[New Name]]` using Edit tool
5. **Tracks** results: fixed, skipped, errors
6. **Reports** completion with statistics

---

## Progress Tracking

### Overall Progress

- [ ] **Session 1**: 100 files, 370 fixes (⚠️ Partial - 4 agents completed, 6 missing)
- [ ] **Session 2**: 100 files, 357 fixes (⚠️ Partial - 4 agents completed, 6 missing)
- [ ] **Session 3**: 47 files, 120 fixes (⚠️ Partial - 8 agents completed, 2 missing)
- [ ] **Session 4**: 14 chunks, 462 fixes (🔴 REQUIRED - completes all missing work)

Mark sessions as complete:
- ⚪ Not Started
- 🟡 In Progress
- ⚠️ Partial (some agents missing)
- ✅ Complete

---

## Troubleshooting

### If Agents Are Cut Off

**Problem**: Agent ran out of tokens/context mid-task

**Solution**: Re-run the same session
- The orchestrator prompt is idempotent
- Already-fixed links will be skipped
- Agent will pick up where it left off

### If Some Agents Fail

**Problem**: 1-2 agents failed, others succeeded

**Solution**: Re-run just the failed agents
- Identify which agent number failed (e.g., Agent 3)
- Copy just that agent's prompt from the session file
- Run it individually

### If You Want to Verify Progress

**Check git status**:
```bash
git status
git diff --stat
```

**Check files modified**:
```bash
git diff source/content/ | grep "^diff" | wc -l
```

**Re-run validation**:
```bash
python3 scripts/link_optimizer/link_optimizer_cli.py --mode validate --verbose
```

---

## After All Sessions Complete

### Validation

Run link validation to measure improvement:
```bash
python3 scripts/link_optimizer/link_optimizer_cli.py --mode validate --verbose
```

**Expected results**:
- Valid links: 62.9% → 80%+
- Broken links: 4,213 → ~500
- Improvement: ~3,700 links fixed

### Optional Next Steps

1. **Process medium-confidence suggestions** (614 suggestions, 80-94% confidence)
2. **Fix remaining broken links** (those without suggested fixes)
3. **Add reciprocal links** (2,962 one-way links)
4. **Improve graph density** (current 2.23% → target 3-4%)

---

## Session Files Overview

| File | Purpose | When to Use |
|------|---------|-------------|
| `README.md` | Master guide | Start here |
| `SESSION_1_broken_links.md` | Session 1 instructions | First session |
| `SESSION_2_broken_links.md` | Session 2 instructions | Second session |
| `SESSION_3_broken_links.md` | Session 3 instructions | Third session |
| `SESSION_4_cleanup.md` | Session 4 instructions | **REQUIRED - Final cleanup** |
| `session_X_chunks/*.json` | Agent data files | Loaded by agents automatically |

---

## Tips for Success

1. **Run sessions in order** (1 → 2 → 3 → **4**)
2. **One session per Claude conversation** (avoid context overflow)
3. **Wait for all 10 agents** before marking session complete
4. **Check git diff** after each session to verify changes
5. **Commit after each session** (optional but recommended)
6. **Session 4 is REQUIRED** - Don't skip it! It completes missing work from Sessions 1-3

---

## Estimated Timeline

**Session 1**: ~15-20 minutes → Break/Commit (⚠️ Partial completion expected)
**Session 2**: ~12-15 minutes → Break/Commit (⚠️ Partial completion expected)
**Session 3**: ~8-10 minutes → Break/Commit (⚠️ Partial completion expected)
**Session 4**: ~20-25 minutes → Final Commit (✅ Completes all missing work)

**Total**: ~55-70 minutes of active work + breaks between sessions

---

## Questions?

**Q: Can I run all 3 sessions in one conversation?**
A: Not recommended - risk of token/context cutoff. Better to split.

**Q: Can I run sessions out of order?**
A: Yes, they're independent. But sequential is cleaner for tracking.

**Q: What if I want to do fewer files per session?**
A: Edit the session files to reduce scope, or run individual agent chunks.

**Q: Can I customize the number of agents?**
A: Yes, but chunks are pre-split for 10 agents. You'd need to re-run the chunking script.

---

---

## Session 4 - Why It's Required

**Problem Found**: Analysis of Sessions 1-3 revealed that 14 agent chunks never completed or didn't generate results files.

**Missing Work**:
- 6 agents from Session 1 (agents 01, 02, 06, 07, 09, 10)
- 6 agents from Session 2 (agents 01, 02, 03, 05, 06, 09)
- 2 agents from Session 3 (agents 01, 09)

**Impact**:
- 462 fixes attempted but not documented
- 120 confirmed broken links still need fixing
- 271 ambiguous cases need investigation
- 71 already-fixed links need documentation

**Solution**: Session 4 processes all 14 missing chunks with 10 new agents, ensuring complete audit trail and fixing all remaining broken links.

---

**Ready to start?**

If Sessions 1-3 already ran: Open `SESSION_4_cleanup.md` and complete the missing work!

If starting fresh: Open `SESSION_1_broken_links.md` and begin!
