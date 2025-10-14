# Link Optimizer - Next Steps

**Last Updated**: October 14, 2025

---

## Quick Action Items

### ✅ Completed
- [x] Session 4 cleanup (64 fixes applied)
- [x] Reorganize reports structure
- [x] Document all session results

### 🔄 In Progress
- [ ] Merge link optimizer docs (5 files → 1 file)
- [ ] Update README files with new structure
- [ ] Commit Session 4 changes (26 files)

### ⏳ Next Up
- [ ] Re-run link analysis on current codebase
- [ ] Apply high-confidence suggestions (>95%)
- [ ] Create human review queue

---

## Detailed Action Plan

### Phase 1: Finalize Current Work (This Week)

#### 1. Documentation Cleanup
**Status**: In Progress
**Priority**: High
**Effort**: 1 hour

- [ ] Merge 5 link optimizer docs into single comprehensive doc
- [ ] Update `docs/README.md` with new structure
- [ ] Update `reports/link_optimizer/README.md` with new organization
- [ ] Update `scripts/link_optimizer/README.md` visibility

#### 2. Commit Session 4 Changes
**Status**: Ready
**Priority**: High
**Effort**: 30 minutes

Files to commit:
```bash
# 26 modified content files from Session 4
source/content/Positions/*.md (18 files)
source/content/Submissions/*.md (7 files)
source/content/Transitions/*.md (1 file)
source/content/Concepts/*.md (3 files)
source/content/Systems/*.md (1 file)

# New reports structure
reports/link_optimizer/ (reorganized)

# Documentation updates
docs/link-optimizer.md (merged)
```

Commit message:
```
chore: Link Optimizer Session 4 - 64 wikilink fixes

- Fixed 64 broken wikilinks across 26 files
- Standardized position names (50/50 → 50-50, etc.)
- Corrected transition references
- Updated case and terminology
- Reorganized link optimizer reports structure

Session 4 processed 485 suggestions with 86.8% skip rate
(indicating excellent prior cleanup). 98%+ link consistency achieved.

See reports/link_optimizer/03_SESSIONS/session_4/ for details.
```

---

### Phase 2: Fresh Analysis (Next Week)

#### 1. Generate New Broken Links Report
**Priority**: High
**Effort**: 2 hours (mostly automated)

```bash
# Full validation
python3 scripts/link_optimizer/link_optimizer_cli.py \
  --mode validate \
  --verbose \
  --output reports/link_optimizer/01_ANALYSIS/broken_links_report_2025-10-14.json

# Generate summary
python3 scripts/link_optimizer/link_optimizer_cli.py \
  --mode validate \
  --summary-only \
  --output reports/link_optimizer/02_SUMMARIES/broken_links_summary_2025-10-14.md
```

**Expected Outcome**:
- Updated list of actual broken links (expect <100 remaining)
- Fresh suggestions with higher accuracy
- Validation of Session 4 fixes

#### 2. Filter High-Confidence Fixes
**Priority**: High
**Effort**: 30 minutes

```bash
# Extract only high-confidence (>95%) suggestions
python3 scripts/link_optimizer/create_filtered_views.py \
  --input reports/link_optimizer/01_ANALYSIS/broken_links_report_2025-10-14.json \
  --output reports/link_optimizer/01_ANALYSIS/high_confidence_fixes_2025-10-14.json \
  --min-confidence 95
```

**Expected Outcome**:
- 20-50 high-confidence fixes
- Ready for auto-application
- Low false positive rate

#### 3. Apply High-Confidence Fixes
**Priority**: High
**Effort**: 1 hour (with review)

```bash
# Apply fixes with confirmation
python3 scripts/link_optimizer/apply_suggestions.py \
  --input reports/link_optimizer/01_ANALYSIS/high_confidence_fixes_2025-10-14.json \
  --dry-run \
  --verbose

# After review, apply for real
python3 scripts/link_optimizer/apply_suggestions.py \
  --input reports/link_optimizer/01_ANALYSIS/high_confidence_fixes_2025-10-14.json \
  --verbose
```

**Expected Outcome**:
- 20-50 additional fixes applied
- Link health improved to 70%+
- Documentation of changes

---

### Phase 3: Human Review Queue (Next 2 Weeks)

#### 1. Create Medium-Confidence Review List
**Priority**: Medium
**Effort**: 1 hour

```bash
# Extract medium-confidence (80-94%) suggestions
python3 scripts/link_optimizer/create_filtered_views.py \
  --input reports/link_optimizer/01_ANALYSIS/broken_links_report_2025-10-14.json \
  --output reports/link_optimizer/04_STATUS/manual_review_queue.json \
  --min-confidence 80 \
  --max-confidence 94
```

**Expected Outcome**:
- 100-200 suggestions requiring human judgment
- Organized by confidence score
- Ready for editorial review

#### 2. Manual Review & Application
**Priority**: Medium
**Effort**: 4-6 hours (spread over 2 weeks)

Process:
1. Review 10-20 suggestions per day
2. Apply valid fixes manually or via script
3. Document decisions for future reference
4. Track success rate for ML improvements

---

### Phase 4: Link Health Monitoring (Ongoing)

#### 1. Monthly Validation Runs
**Priority**: Low
**Effort**: 30 minutes/month (automated)

Schedule:
- **1st of month**: Full validation run
- **Mid-month**: Spot check high-traffic pages
- **End of month**: Generate trend report

Metrics to track:
- **Valid link percentage**: Target 75%+
- **Broken link count**: Target <100
- **Random walk coverage**: Target 60%+
- **Avg links per page**: Target 8-12

#### 2. Pre-Commit Hook (Optional)
**Priority**: Low
**Effort**: 2 hours (one-time setup)

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
# Validate wikilinks in staged .md files
python3 scripts/link_optimizer/validate_staged_links.py
```

**Benefits**:
- Catch broken links before commit
- Maintain link health over time
- Reduce cleanup burden

---

## Success Criteria

### Short Term (1 Month)
- ✅ Session 4 changes committed
- ✅ Documentation consolidated
- ✅ Fresh analysis generated
- ✅ 20-50 high-confidence fixes applied
- ✅ Link health: 70%+

### Medium Term (3 Months)
- ✅ Manual review queue processed
- ✅ Random walk coverage: 60%+
- ✅ Broken links: <100
- ✅ Monthly monitoring established

### Long Term (6 Months)
- ✅ Link health: 80%+
- ✅ Automated testing in CI/CD
- ✅ Pre-commit hooks active
- ✅ Link best practices documented

---

## Command Reference

### Quick Commands

```bash
# Full validation + suggestions
python3 scripts/link_optimizer/link_optimizer_cli.py --mode full --verbose

# Validation only
python3 scripts/link_optimizer/link_optimizer_cli.py --mode validate --verbose

# Random walk test
python3 scripts/link_optimizer/link_optimizer_cli.py --mode random-walk --walk-length 1000

# Apply suggestions (dry run)
python3 scripts/link_optimizer/apply_suggestions.py --dry-run --confidence 95

# Apply suggestions (for real)
python3 scripts/link_optimizer/apply_suggestions.py --confidence 95 --verbose
```

### Location Reference

```bash
# Analysis outputs
reports/link_optimizer/01_ANALYSIS/

# Human-readable summaries
reports/link_optimizer/02_SUMMARIES/

# Session results
reports/link_optimizer/03_SESSIONS/session_{1,2,3,4}/

# Status tracking
reports/link_optimizer/04_STATUS/

# Archived data
reports/link_optimizer/00_ARCHIVE/
```

---

## Questions & Decisions Needed

### Open Questions

1. **Auto-apply threshold**: Should we auto-apply >95% or >98% confidence?
2. **Review frequency**: Weekly or monthly for medium-confidence queue?
3. **CI/CD integration**: Add to GitHub Actions or keep manual?

### Recommendations

1. **Start conservative**: >98% for auto-apply, review 95-98% manually first
2. **Weekly reviews**: Process 20-30 suggestions per week to avoid backlog
3. **Manual for now**: Add CI/CD after we have 6 months of data on false positive rates

---

**Status**: 📋 Action plan ready | ⏱️ Estimated 10-15 hours total | 🎯 Link health target: 80%+
