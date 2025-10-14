# BJJ Graph - SEO Validation Guide

## Overview
This guide provides step-by-step instructions for validating all SEO implementations on BJJ Graph.

## Quick Validation (5 minutes)

### 1. Schema Markup Validation
Use Google Rich Results Test: https://search.google.com/test/rich-results

Test these URLs after deployment:
1. Homepage: https://bjjgraph.org/
2. Position page: https://bjjgraph.org/positions/mount
3. Transition page: https://bjjgraph.org/transitions/hip-bump-sweep
4. Hub page: https://bjjgraph.org/bjj-positions

Expected results for each page type...

### 2. Meta Tag Validation
View page source and verify presence of:
- `<title>` tag
- `<meta name="description">` tag
- `<link rel="canonical">` tag
- Open Graph tags (og:title, og:description, og:image, og:url, og:type)
- Twitter Card tags (twitter:card, twitter:title, twitter:description, twitter:image)

### 3. Technical Files
Verify these URLs are accessible:
- https://bjjgraph.org/sitemap.xml
- https://bjjgraph.org/robots.txt

## Detailed Validation

### Schema Markup Deep Dive

#### Expected Schema Types by Page

**Position Pages** (e.g., /positions/mount):
- WebPage (basic page info)
- BreadcrumbList (navigation hierarchy)
- HowTo (offensive transitions as steps)
- FAQ (common errors as Q&A)
- Organization (site-wide, in every page)

**Transition Pages** (e.g., /transitions/hip-bump-sweep):
- WebPage
- BreadcrumbList
- HowTo (execution steps)
- Organization

**Hub Pages** (e.g., /bjj-positions):
- WebPage
- BreadcrumbList
- ItemList (list of positions/transitions/etc.)
- Organization

#### How to Validate Each Schema Type

**WebPage Schema:**
```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Page Title",
  "description": "Page description",
  "url": "https://bjjgraph.org/path/to/page",
  "isPartOf": {
    "@type": "WebSite",
    "name": "BJJ Graph",
    "url": "https://bjjgraph.org"
  }
}
```
✓ Checklist:
- [ ] @context is present
- [ ] @type is "WebPage"
- [ ] name matches page title
- [ ] description is meaningful
- [ ] url is correct absolute URL
- [ ] isPartOf references parent website

**BreadcrumbList Schema:**
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://bjjgraph.org/"},
    {"@type": "ListItem", "position": 2, "name": "Category", "item": "https://bjjgraph.org/category/"},
    {"@type": "ListItem", "position": 3, "name": "Page", "item": "https://bjjgraph.org/category/page"}
  ]
}
```
✓ Checklist:
- [ ] At least 2 levels (Home + current page)
- [ ] Position numbers are sequential (1, 2, 3...)
- [ ] URLs are absolute and correct
- [ ] Names are descriptive

**HowTo Schema:**
✓ Checklist:
- [ ] Has "step" array with at least 2 steps
- [ ] Each step has position, name, and text
- [ ] totalTime is present (e.g., "PT5M")
- [ ] tool/supply arrays are present

**FAQ Schema:**
✓ Checklist:
- [ ] Has "mainEntity" array
- [ ] Each entity has Question and Answer
- [ ] Questions are meaningful
- [ ] Answers are complete

**ItemList Schema** (hub pages only):
✓ Checklist:
- [ ] Has itemListElement array
- [ ] Each item has position, name, url
- [ ] URLs point to actual pages
- [ ] List is comprehensive (20-30 items)

**Organization Schema:**
✓ Checklist:
- [ ] Present on every page
- [ ] Has name, description, url
- [ ] Logo URL is valid
- [ ] sameAs has social links

### Meta Tags Validation

#### Canonical URLs
Format: `<link rel="canonical" href="https://bjjgraph.org/path/to/page" />`

✓ Checklist:
- [ ] Present on every page
- [ ] Uses absolute URL (includes https://)
- [ ] Matches actual page URL
- [ ] Only one canonical tag per page

#### Open Graph Tags
Required tags:
- og:title
- og:description
- og:image
- og:url (should match canonical)
- og:type (should be "article")
- og:site_name (should be "BJJ Graph")
- og:locale (should be "en_US")

✓ Checklist:
- [ ] All required tags present
- [ ] og:url matches canonical URL
- [ ] og:image is absolute URL
- [ ] og:type is "article"

#### Twitter Card Tags
Required tags:
- twitter:card (should be "summary_large_image")
- twitter:title
- twitter:description
- twitter:image
- twitter:image:alt

✓ Checklist:
- [ ] All required tags present
- [ ] twitter:card is "summary_large_image"
- [ ] twitter:image is absolute URL
- [ ] twitter:image:alt is descriptive

## Validation Tools

### 1. Google Rich Results Test
URL: https://search.google.com/test/rich-results
- Paste page URL
- Click "Test URL"
- Check which rich results are eligible
- Review any warnings or errors

### 2. Schema.org Validator
URL: https://validator.schema.org/
- Copy JSON-LD from page source
- Paste into validator
- Check for errors or warnings

### 3. Facebook Sharing Debugger (for Open Graph)
URL: https://developers.facebook.com/tools/debug/
- Paste page URL
- Check how Facebook sees your page
- Verify image, title, description

### 4. Twitter Card Validator
URL: https://cards-dev.twitter.com/validator
- Paste page URL
- Check how Twitter sees your card
- Verify image preview

### 5. Lighthouse SEO Audit
- Open page in Chrome
- Open DevTools (F12)
- Go to Lighthouse tab
- Run SEO audit
- Review recommendations

## Common Issues & Fixes

### Issue: Schema not showing in Rich Results Test
**Cause:** JSON syntax error
**Fix:** Copy JSON-LD to validator.schema.org, fix syntax errors

### Issue: Duplicate schemas of same type
**Cause:** Script ran multiple times
**Fix:** Manually remove duplicates from markdown files

### Issue: Canonical URL is relative, not absolute
**Cause:** Missing https:// or domain
**Fix:** Update Head.tsx to include full URL

### Issue: Missing Twitter Card image
**Cause:** Image path incorrect
**Fix:** Verify og:image path is absolute and file exists

### Issue: Sitemap not accessible
**Cause:** Not in build output or server misconfiguration
**Fix:** Check build output, verify server serves .xml files

## Coverage Verification

### Check Schema Coverage
Run this from project root:
```bash
# Count Position pages with HowTo schema
grep -r '"@type": "HowTo"' source/content/Positions/ | wc -l

# Count pages with BreadcrumbList schema
grep -r '"@type": "BreadcrumbList"' source/content/ | wc -l

# Count pages with WebPage schema
grep -r '"@type": "WebPage"' source/content/ | wc -l
```

Expected results:
- HowTo on Positions: 90+ pages
- HowTo on Transitions: 70+ pages
- BreadcrumbList: 215+ pages
- WebPage: 215+ pages

### Check Meta Tag Coverage
```bash
# Check for canonical tags in build output
grep -r '<link rel="canonical"' public/ | wc -l

# Check for Twitter Card tags
grep -r '<meta name="twitter:card"' public/ | wc -l
```

## Performance Monitoring

After deployment, monitor these metrics in Google Search Console:

### Week 1-2
- Pages indexed count (should increase)
- Crawl errors (should be minimal)
- Rich results eligible pages (check enhancements)

### Month 1
- Impressions (should increase 10-20%)
- Clicks (should increase 5-10%)
- Average position (should improve for target keywords)
- Click-through rate (should improve with rich results)

### Month 2-3
- Organic traffic growth (target: 30-50%)
- Rich results appearing in search
- Featured snippets eligibility
- User engagement metrics

## Maintenance

### Monthly Checks
- [ ] Run schema validation on 10 random pages
- [ ] Check Google Search Console for issues
- [ ] Verify sitemap is up to date
- [ ] Check for any broken schema

### Quarterly Tasks
- [ ] Full site schema audit
- [ ] Update hub pages with new content
- [ ] Review and optimize meta descriptions
- [ ] Check for new schema opportunities

## Summary

**Expected State After Full Implementation:**
- ✅ 215+ pages with WebPage schema
- ✅ 215+ pages with BreadcrumbList schema
- ✅ 90+ Position pages with HowTo + FAQ schema
- ✅ 70+ Transition pages with HowTo schema
- ✅ 5 hub pages with ItemList schema
- ✅ Organization schema on all pages
- ✅ Canonical URLs on all pages
- ✅ Complete Open Graph tags on all pages
- ✅ Twitter Card tags on all pages
- ✅ Sitemap.xml accessible
- ✅ Robots.txt accessible

**Coverage Goals:**
- Schema Markup: 99%+ (only template files excluded)
- Meta Tags: 100%
- Technical SEO: 100%

---

**Last Updated:** 2025-10-12
**Schema Types:** 6
**Total Pages:** 215+
**Scripts Available:** 4 automation scripts in /scripts/
