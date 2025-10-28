# A/B Testing Quick Start Guide

## What's Done ✅

**Edge-based A/B testing with Dirichlet sampling** - fully implemented and ready to deploy.

**How it works:**
- Cloudflare Worker generates random section priorities per user (Dirichlet distribution)
- Sections reorder based on priorities (higher = earlier on page)
- Sections with priority < 1% are hidden
- Priorities refresh weekly per user
- PostHog tracks everything for analysis

**Files created/modified:**
- `source/functions/_middleware.ts` - Edge Worker with Dirichlet logic
- `source/quartz/components/scripts/posthog-ab-tracking.inline.ts` - Event tracking
- `source/quartz/styles/custom.scss` - Flexbox layout for reordering
- `.github/workflows/ci.yaml` - Cloudflare deployment with wrangler-action

---

## Next Steps (Manual Configuration)

### 1. Configure Cloudflare Build (In Browser)

Go to: **Cloudflare Dashboard → Pages → bjjgraph → Settings → Builds**

Set:
- Framework preset: `None`
- Build command: `cd source && npm install && npx quartz build`
- Build output: `source/public`

### 2. Deploy

```bash
git push origin main
```

GitHub Actions will deploy automatically to Cloudflare Pages.

---

## Testing & Monitoring

### Test Deployment

**URL**: https://bjjgraph.pages.dev/positions/mount?debug

**Look for in browser:**
1. **Response headers** (Network tab):
   - `X-BJJGraph-AB-Week: 43`
   - `X-BJJGraph-AB-Priorities: {...}`
2. **Page source** (`<head>`):
   - `<style id="bjjgraph-ab-styles">` with section order values
3. **Incognito test**: Open 3-5 windows → each gets different section order

### Monitor PostHog

**URL**: https://us.posthog.com/project/236155/events

**Look for these events:**
- `ab_page_view` - Has all section priorities as flat properties
- `ab_time_on_page` - Has engagement duration
- `ab_scroll_depth` - Has scroll milestones (25%, 50%, 75%, 100%)

---

## Analysis (After 2-4 Weeks)

**Create insights in PostHog to answer:**

1. **Which sections should be first?**
   - Correlate `section_decision_tree_priority` with `time_on_page`
   - Find: "When decision-tree priority > 0.20 → +15% engagement"

2. **Does visual styling help?**
   - Compare `visual_elements: "enhanced"` vs `"control"`
   - Metric: Average time on page

3. **Should we hide low-priority sections?**
   - Check if `section_*_visible: false` hurts engagement

---

## Quick Reference

**PostHog Feature Flag:** https://us.posthog.com/project/236155/feature_flags/228212
**Cloudflare Dashboard:** https://dash.cloudflare.com/

**Status**: Code complete. Deploy when ready.
