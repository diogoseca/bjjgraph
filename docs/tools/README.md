# BJJ Graph Automation Tools

**Complete documentation for all automation, validation, and optimization tools**

---

## Quick Navigation

| Tool | Purpose | Documentation |
|------|---------|---------------|
| **Link Optimizer** | Validate and optimize internal wikilinks | [link-optimizer.md](./link-optimizer.md) |
| **Content Validator** | Validate content against V2 standards | [content-validation.md](./content-validation.md) |
| **Automation Bots** | Daily improvements & monthly QA | [automation-bots.md](./automation-bots.md) |
| **SEO Automation** | Schema markup generation | [seo-automation.md](./seo-automation.md) |

---

## Getting Started

### New to the project?
Start with [automation-bots.md](./automation-bots.md) to understand daily automated operations.

### Fixing broken links?
See [link-optimizer.md](./link-optimizer.md) for comprehensive link validation and optimization.

### Validating content?
Check [content-validation.md](./content-validation.md) for validation rules and procedures.

### SEO work?
Review [seo-automation.md](./seo-automation.md) for schema markup automation.

---

## Tools by Category

### Content Quality (Daily Use)
- **Content Validator** (`validate_content.py`) - Check V2 standard compliance
- **Link Optimizer** (`link_optimizer_cli.py`) - Fix broken wikilinks
- **Content Improvement Bot** (GitHub Actions) - Automated enhancements

### Automation (Background)
- **Content Improvement Bot** - Runs hourly, improves 5 files per run
- **Monthly Validation Bot** - Runs monthly on oldest 100 files
- **File Selection Script** (`select_oldest_files.sh`) - Used by bots

### SEO & Marketing (Periodic)
- **Schema Markup Scripts** (4 scripts in `scripts/seo/`)
  - add_webpage_schema.py
  - add_breadcrumb_schema.py
  - add_position_schema_v2.py
  - add_transition_schema_v2.py

---

## Quick Commands

### Validation
```bash
python3 scripts/validate_content.py source/content/ --verbose
```

### Link Optimization
```bash
python3 scripts/link_optimizer/link_optimizer_cli.py --mode validate --verbose
```

### SEO Schema
```bash
python3 scripts/seo/add_webpage_schema.py
python3 scripts/seo/add_breadcrumb_schema.py
```

---

## Tool Status

| Tool | Coverage | Status | Last Run |
|------|----------|--------|----------|
| **Link Optimizer** | 11,351+ links | ✅ Active | Oct 14, 2025 |
| **Content Validator** | 706 files | ✅ Active | Daily |
| **Content Bot** | All files | ✅ Running | Hourly |
| **Monthly Bot** | 100 files/mo | ✅ Running | Monthly |
| **SEO Scripts** | ~270 pages | ✅ Complete | Oct 12, 2025 |

---

## Development

All tool source code is in `/scripts/`:
- `/scripts/validate_content.py` - Content validator
- `/scripts/link_optimizer/` - Link optimizer system (9 Python modules)
- `/scripts/seo/` - SEO automation scripts (4 scripts)
- `.github/workflows/` - Bot automation (2 workflows)

---

## Related Documentation

- **Scripts README**: `/scripts/README.md` - Complete script inventory
- **SEO Documentation**: `/docs/seo/` - SEO guides and strategies
- **Deployment**: `/docs/deployment/` - Deployment procedures
- **Content Standards**: `/source/content/CONTRIBUTING-YAML-SCHEMA.md`

---

**Status:** ✅ 4 Tools Documented | 🔧 8+ Tools Available | 📊 75% Documentation Coverage Target
**Last Updated:** October 14, 2025
