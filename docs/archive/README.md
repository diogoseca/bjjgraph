# Archive

**Historical reports and deprecated documentation**

⚠️ **Note**: This directory contains archived content that is no longer actively maintained but preserved for historical reference.

---

## Contents

### SEO Implementation Files (Archived October 14, 2025)

**seo-implementation-complete.md** and **seo-final-summary.md**

**Why archived:** These two files contained 80% duplicate content (50KB total, ~15KB redundancy). They have been consolidated into a single comprehensive `seo-implementation-report.md` in `/docs/seo/`.

**Historical Context:** Both files documented the October 2025 SEO implementation with 30 tasks tracked and 598+ schema instances deployed. The new consolidated report maintains all unique information while eliminating redundancy.

**Replacement:** See `/docs/seo/seo-implementation-report.md` for current implementation tracking.

---

### Script Documentation (Archived October 14, 2025)

**VALIDATION_SUMMARY.md** and **README_TRANSITION_SCHEMA_V2.md**

**Why archived:** Redundant with main script documentation. VALIDATION_SUMMARY.md duplicated content in `/scripts/README.md`, and README_TRANSITION_SCHEMA_V2.md duplicated examples in EXAMPLES.md.

**Historical Context:** These files provided validation rules and transition schema documentation that have been merged into primary script documentation.

**Replacement:**
- Validation: See `/scripts/README.md#validate_contentpy`
- Schema examples: See `/docs/scripts/EXAMPLES.md`

---

### validation-report-2025-10-12.md
**Comprehensive content validation report (October 12, 2025)**

Contains:
- 253 files validated
- 554 errors identified
- 5,325 warnings
- Detailed breakdown by content type
- Error examples and common issues

**Historical Context**: This report was generated during the content quality improvement phase. Most issues have since been resolved by the content-improvement-bot (automated GitHub Actions workflow).

**Current Validation**: For up-to-date validation results, run:
```bash
python3 scripts/validate_content.py source/content/ --verbose
```

---

### prompts/
**Agent prompt templates (archived)**

Contains:
- `100_new_files_continue.txt` - Continuation prompt for content generation
- `100_new_files_of_content.txt` - Batch content creation prompt

**Historical Context**: These prompts were used for early content generation experiments. They have been superseded by:
- GitHub Actions content-improvement-bot workflow (`.github/workflows/content-improvement-bot.yml`)
- CONTRIBUTING-*.md files in `/source/content/`

**Current Usage**: The content-improvement-bot now uses the CONTRIBUTING-*.md standards directly rather than these prompt templates.

---

## Why These Are Archived

### Validation Report
- **Date**: October 12, 2025
- **Why archived**: Point-in-time snapshot, most issues resolved
- **Replacement**: Run validation script on-demand for current status

### Prompts
- **Date**: October 13, 2025
- **Why archived**: Replaced by automated bot and standardized contributor guides
- **Replacement**: See `/source/content/CONTRIBUTING-*.md` for current standards

---

## Related Documentation

### Current Validation
- **Validation Script**: `/scripts/validate_content.py`
- **Validation Docs**: `/docs/scripts/VALIDATION_SUMMARY.md`
- **Content Standards**: `/source/content/CONTRIBUTING-YAML-SCHEMA.md`

### Current Content Improvement
- **Automated Bot**: `.github/workflows/content-improvement-bot.yml`
- **Standards**: `/source/content/CONTRIBUTING-POSITIONS.md` (and similar)

---

**Status**: 🗄️ Archived | 📚 Historical Reference Only | ⚠️ Not Actively Maintained
