# Incident Response Playbook

**Last Updated:** October 14, 2025
**Deployment Model:** GitHub Pages (Static Site)
**CI/CD:** GitHub Actions
**Purpose:** Emergency response procedures for BJJ Graph production incidents

---

## Table of Contents

1. [Incident Classification System](#incident-classification-system)
2. [Detection & Alerting](#detection--alerting)
3. [P0 Response: Site Completely Down](#p0-response-site-completely-down)
4. [P1 Response: Major Functionality Broken](#p1-response-major-functionality-broken)
5. [P2 Response: Degraded Performance](#p2-response-degraded-performance)
6. [P3 Response: Minor Issues](#p3-response-minor-issues)
7. [Escalation Path](#escalation-path)
8. [Communication Templates](#communication-templates)
9. [Common Incidents Playbooks](#common-incidents-playbooks)
10. [Post-Incident Review](#post-incident-review)

---

## Incident Classification System

### Priority Levels

| Priority | Description | RTO | Impact | Response |
|----------|-------------|-----|--------|----------|
| **P0** | Site completely down | 10 min | All users | Immediate |
| **P1** | Major functionality broken | 30 min | Most users | Urgent |
| **P2** | Degraded performance | 4 hours | Some users | Scheduled |
| **P3** | Minor issues | 48 hours | Minimal | Normal |

---

## Detection & Alerting

### How Incidents Are Discovered

**Automated Detection:**
- GitHub Actions workflow failures (email notifications)
- Google Search Console alerts (crawl errors, security issues)
- Analytics anomaly detection (traffic drops >30%)
- Uptime monitoring services (if configured)

**Manual Detection:**
- User reports (GitHub Issues, social media)
- Routine health checks (daily/weekly maintenance)
- Random site visits by team members

**Detection Response Time:**
- **Business Hours (9am-6pm EST):** <15 minutes
- **After Hours:** <2 hours (best effort)

### Quick Health Check Commands

```bash
# 1. Site Accessibility
curl -I https://bjjgraph.org/
# Expected: HTTP/2 200

# 2. Key Pages Check
curl -I https://bjjgraph.org/Positions/Mount
curl -I https://bjjgraph.org/Transitions/Hip-Bump-Sweep
curl -I https://bjjgraph.org/Submissions/Triangle-Choke
# Expected: HTTP/2 200 for all

# 3. Sitemap
curl -I https://bjjgraph.org/sitemap.xml
# Expected: HTTP/2 200

# 4. Robots.txt
curl -I https://bjjgraph.org/robots.txt
# Expected: HTTP/2 200

# 5. Check GitHub Actions Status
# Visit: https://github.com/[username]/bjjgraph/actions
```

---

## P0 Response: Site Completely Down

**Definition:** Homepage returns 404, 500, or is completely inaccessible.

**RTO:** 10 minutes | **Impact:** 100% of users | **Response:** IMMEDIATE

### Initial Response (First 2 Minutes)

**Step 1: Confirm Outage (30 seconds)**
```bash
# Check from multiple locations
curl -I https://bjjgraph.org/
curl -I https://bjjgraph.org/index.html

# Use external service
# https://isitdownrightnow.com/bjjgraph.org
```

**Step 2: Check GitHub Pages Status (30 seconds)**
```
Visit: https://www.githubstatus.com/
```

**If GitHub Pages is down:**
- No action can be taken until GitHub resolves issue
- Skip to Communication (notify users)
- Monitor GitHub Status for updates

**If GitHub Pages is UP, proceed:**

**Step 3: Create Incident Issue (60 seconds)**
```markdown
Title: [P0] Site completely down - [Timestamp]

**Status:** INVESTIGATING
**Priority:** P0 - Critical
**Impact:** Entire site inaccessible
**Started:** 2025-10-14 14:30 UTC

## Initial Assessment
- [ ] Homepage returns [status code]
- [ ] GitHub Pages status: [UP/DOWN]
- [ ] Last successful deployment: [commit hash]
- [ ] Recent changes: [yes/no]

## Actions Taken
- [14:30] Incident confirmed
- [14:31] Investigating cause
```

### Investigation Phase (Minutes 2-5)

**Step 4: Identify Root Cause**

**Check Recent Deployments:**
```bash
# View recent commits
git log --oneline -10

# Check GitHub Actions workflow
# Visit: https://github.com/[username]/bjjgraph/actions

# Identify failed workflow or recent merge
```

**Common P0 Causes:**
1. **Build Failure** → Broken deployment
2. **Malformed Configuration** → Site won't generate
3. **DNS Issues** → Domain not resolving
4. **GitHub Pages Settings** → Accidentally changed branch/folder
5. **Critical Content Error** → Site build fails completely

**Step 5: Determine Rollback Necessity**

If cause is from recent deployment → **ROLLBACK IMMEDIATELY**

```bash
# Quick revert (if last commit is cause)
git revert HEAD
git push origin main

# Monitor workflow: https://github.com/[username]/bjjgraph/actions
```

### Resolution Phase (Minutes 5-10)

**Step 6: Execute Rollback Procedure**

Follow detailed procedures in [rollback-procedures.md](./rollback-procedures.md).

**Quick Rollback:**
```bash
# Method 1: Git Revert (preferred)
git revert HEAD
git push origin main
# Wait 5-8 minutes for deployment

# Method 2: Re-run Last Good Workflow
# 1. Visit: https://github.com/[username]/bjjgraph/actions
# 2. Find last successful workflow (green checkmark)
# 3. Click "Re-run all jobs"
# 4. Wait 5-8 minutes for deployment
```

**Step 7: Verify Restoration**
```bash
# Check site is back
curl -I https://bjjgraph.org/
# Expected: HTTP/2 200

# Test key pages
curl -I https://bjjgraph.org/Positions/Mount
curl -I https://bjjgraph.org/sitemap.xml

# Visual check
# Open in browser: https://bjjgraph.org/
```

### Communication Phase (Ongoing)

**Step 8: Update Incident Issue**

```markdown
## Resolution
- [14:35] Site restored by reverting commit [hash]
- [14:36] All pages accessible
- [14:38] Verification complete

**RTO Achieved:** 8 minutes
**Cause:** [Brief description]
**Next Steps:** Root cause analysis
```

**Step 9: Notify Stakeholders**

Use template: [Status Update - Resolved](#status-update---resolved)

### Post-Incident (Within 24 Hours)

**Step 10: Root Cause Analysis**

See [Post-Incident Review](#post-incident-review) section.

**Step 11: Prevention Measures**

Document what went wrong and how to prevent recurrence.

---

## P1 Response: Major Functionality Broken

**Definition:** Search broken, navigation fails, schema errors on 50%+ pages, major rendering issues.

**RTO:** 30 minutes | **Impact:** 70-90% of users | **Response:** URGENT

### Initial Response (First 5 Minutes)

**Step 1: Assess Impact (2 minutes)**

**Check affected functionality:**
```bash
# If search is broken
# Open site, try search functionality

# If navigation broken
# Check multiple pages for broken links

# If schema errors
# Visit: https://search.google.com/test/rich-results
# Test 5 random pages
```

**Determine severity:**
- **Affects >70% of pages?** → Proceed with P1 response
- **Affects 30-70% of pages?** → Consider P2 response
- **Affects <30% of pages?** → Downgrade to P2

**Step 2: Create Incident Issue**

```markdown
Title: [P1] [Component] broken - [Description]

**Status:** INVESTIGATING
**Priority:** P1 - High
**Impact:** [Specific functionality] broken on ~[X]% of pages
**Started:** 2025-10-14 14:30 UTC

## Symptoms
- [Describe what's broken]
- [User impact]

## Affected Pages
- [List or estimate]

## Initial Actions
- [14:30] Issue detected
- [14:32] Creating incident
```

### Investigation Phase (Minutes 5-15)

**Step 3: Identify Cause**

**Recent Changes:**
```bash
git log --oneline -10
git diff HEAD~1 HEAD  # Review last commit changes
```

**Check Logs:**
```bash
# GitHub Actions logs
# Visit: https://github.com/[username]/bjjgraph/actions
# Click on recent workflow → Review build logs
```

**Common P1 Causes:**
1. **JavaScript Errors** → Component crashes
2. **Schema Markup Errors** → Malformed JSON-LD
3. **CSS Issues** → Layout completely broken
4. **Configuration Changes** → Quartz config error
5. **Content Errors** → Malformed frontmatter in multiple files

**Step 4: Assess Rollback vs. Hotfix**

| Consider Rollback If: | Consider Hotfix If: |
|----------------------|-------------------|
| Cause is unclear | Cause is identified |
| Multiple systems affected | Single issue identified |
| Quick fix not obvious | Fix is straightforward |
| Risk of worsening issue | Can fix in <20 minutes |

**Decision Matrix:**
```
Is cause identified? → NO  → ROLLBACK
                    ↓ YES
Can fix in <15 min? → NO  → ROLLBACK
                    ↓ YES
                    HOTFIX
```

### Resolution Phase (Minutes 15-30)

**Option A: Execute Rollback**

```bash
git revert HEAD
git push origin main
# Monitor: https://github.com/[username]/bjjgraph/actions
```

**Option B: Deploy Hotfix**

```bash
# Create hotfix branch
git checkout -b hotfix/fix-[issue-name]

# Make minimal fix
# [Edit affected files]

# Validate locally
cd source
npx quartz build --serve
# Test functionality

# Commit and push
git add .
git commit -m "HOTFIX: Fix [issue description]"
git push origin hotfix/fix-[issue-name]

# Merge directly to main (P1 bypasses normal PR process)
git checkout main
git merge hotfix/fix-[issue-name]
git push origin main
```

**Step 5: Verify Resolution**

```bash
# Check deployed site (wait 5-8 minutes after push)
curl -I https://bjjgraph.org/

# Test affected functionality
# [Specific verification steps for the issue]

# Check sample pages
# Visit 5-10 random pages to ensure fix worked
```

### Communication & Closure

**Step 6: Update Incident Issue**

```markdown
## Resolution
- [14:45] [ROLLBACK/HOTFIX] deployed
- [14:50] Functionality verified restored
- [14:52] Spot checks complete

**RTO Achieved:** 22 minutes
**Cause:** [Description]
**Fix:** [What was done]
**Next Steps:** Post-incident review within 48 hours
```

---

## P2 Response: Degraded Performance

**Definition:** Slow page loads (>5s), intermittent errors, non-critical schema warnings, mobile rendering issues.

**RTO:** 4 hours | **Impact:** 30-50% of users | **Response:** SCHEDULED

### Initial Response (First 15 Minutes)

**Step 1: Verify and Document Issue**

```bash
# Test page load times
curl -w "@curl-format.txt" -o /dev/null -s https://bjjgraph.org/

# Where curl-format.txt contains:
# time_total: %{time_total}s
# time_namelookup: %{time_namelookup}s
# time_connect: %{time_connect}s
# time_starttransfer: %{time_starttransfer}s

# Run Lighthouse audit
# https://pagespeed.web.dev/
# Enter: https://bjjgraph.org/
```

**Step 2: Create Issue (Not Incident)**

```markdown
Title: [P2] Performance degradation - [Component]

**Priority:** P2 - Medium
**Impact:** [Description of performance issue]
**Started:** 2025-10-14 14:30 UTC

## Symptoms
- Page load times: [X]s (baseline: [Y]s)
- Affected components: [List]

## Measurements
- Lighthouse Performance: [Score]/100
- Time to First Byte: [X]ms
- Largest Contentful Paint: [X]s

## Next Steps
- [ ] Investigate within 4 hours
- [ ] Deploy fix within 24 hours
```

### Investigation Phase (1-2 Hours)

**Step 3: Identify Performance Bottleneck**

**Common P2 Causes:**
1. **Asset Size Issues** → Large images, unoptimized assets
2. **JavaScript Bloat** → New libraries added
3. **CSS Issues** → Inefficient selectors
4. **External Dependencies** → Slow third-party scripts
5. **Build Process** → Quartz configuration inefficiencies

**Tools to Use:**
- Chrome DevTools → Network tab, Performance tab
- Lighthouse → Detailed audit
- PageSpeed Insights → Mobile/Desktop analysis

**Step 4: Develop Fix**

```bash
# Create feature branch
git checkout -b perf/fix-[issue-name]

# Make performance improvements
# [Optimize assets, code, or configuration]

# Test locally
cd source
npx quartz build --serve

# Re-run performance tests
# Lighthouse, PageSpeed Insights

# Verify improvement >20%
```

### Resolution Phase (2-4 Hours)

**Step 5: Deploy via Standard PR Process**

```bash
# Commit changes
git add .
git commit -m "PERF: Improve [description] - reduces load time by X%"
git push origin perf/fix-[issue-name]

# Create Pull Request
# Include before/after performance metrics
# Request review (unless urgent)

# After approval, merge
git checkout main
git pull origin main
git merge perf/fix-[issue-name]
git push origin main
```

**Step 6: Verify Improvement**

```bash
# Wait for deployment (5-8 minutes)

# Re-test performance
# Lighthouse: https://pagespeed.web.dev/
# Expected: Score improvement >10 points

# Monitor for 24 hours
# Check Google Analytics for bounce rate changes
```

### Follow-Up

**Step 7: Document Resolution**

```markdown
## Resolution
- [15:30] Root cause identified: [description]
- [16:15] Fix deployed via PR #[number]
- [16:25] Performance verified improved

**Improvements:**
- Load time: [Before]s → [After]s ([X]% improvement)
- Lighthouse: [Before]/100 → [After]/100

**RTO Achieved:** 3 hours 55 minutes
```

---

## P3 Response: Minor Issues

**Definition:** Typos, single broken link, minor visual glitches, analytics tracking issues.

**RTO:** 48 hours | **Impact:** <10% of users | **Response:** NORMAL WORKFLOW

### Process

**Step 1: Create Standard Issue**

```markdown
Title: [BUG] [Brief description]

**Priority:** P3 - Low
**Type:** [Content/Visual/Technical]

## Description
[Describe the issue]

## Impact
- Affects: [Specific page or small set]
- User impact: [Minimal]

## Steps to Reproduce
1. [Step 1]
2. [Step 2]

## Expected Behavior
[What should happen]

## Actual Behavior
[What currently happens]
```

**Step 2: Fix via Normal Workflow**

- Assign to team member or self
- Fix in feature branch
- Create PR with description
- Request review
- Merge after approval
- Deploy with next regular release

**No emergency procedures needed.**

---

## Escalation Path

### Who to Contact

```
P0/P1 Incident Detected
         ↓
    Primary Contact
  [Site Administrator]
         ↓
 Unable to Resolve in 30 min?
         ↓
   Secondary Contact
   [Technical Lead]
         ↓
 Still Unable to Resolve?
         ↓
   External Support
   - GitHub Support (Pages issues)
   - Community forums
```

### Contact Information

**Primary:**
- **Role:** Site Administrator
- **Responsibility:** First responder for all incidents
- **Contact:** [GitHub Issues - Tag @[username]]
- **Response Time:** <15 minutes (business hours)

**Secondary:**
- **Role:** Technical Lead
- **Responsibility:** Complex incidents, architectural issues
- **Contact:** [Communication channel]
- **Response Time:** <1 hour

**External Support:**
- **GitHub Support:** https://support.github.com/
- **GitHub Status:** https://www.githubstatus.com/
- **Quartz Community:** https://discord.gg/cRFFHYye7t

### Escalation Triggers

**Escalate to Secondary if:**
- Cannot identify root cause within 20 minutes
- Rollback attempts fail
- Issue affects multiple systems
- Security incident suspected

**Escalate to External if:**
- GitHub Pages infrastructure issue
- Suspected platform-wide problem
- DNS or domain issues
- Security incident confirmed

---

## Communication Templates

### Status Update - Investigating

**GitHub Issue Update:**
```markdown
## Update [Timestamp]

**Status:** INVESTIGATING
**ETA:** [Time]

We're currently investigating [brief description of issue].

**Current Impact:**
- [Affected functionality]
- [Estimated % of users affected]

**Actions Taken So Far:**
- [Action 1]
- [Action 2]

**Next Update:** [Time]
```

**Twitter/Social (if applicable):**
```
🔧 We're currently experiencing issues with [component].
Our team is investigating and we expect to have more info within [X] minutes.

Status updates: [GitHub Issue URL]
```

### Status Update - Resolved

**GitHub Issue Update:**
```markdown
## ✅ RESOLVED [Timestamp]

The issue has been resolved. All functionality is now operational.

**Resolution Summary:**
- **Cause:** [Brief explanation]
- **Fix:** [What was done]
- **Verification:** [How we confirmed fix]

**Timeline:**
- [14:30] Issue detected
- [14:32] Investigation started
- [14:35] Cause identified
- [14:40] Fix deployed
- [14:45] Verification complete

**RTO Achieved:** [X] minutes

**Follow-Up Actions:**
- [ ] Post-incident review scheduled for [date]
- [ ] Prevention measures to be implemented

Thank you for your patience.
```

**Twitter/Social:**
```
✅ Issue resolved! [Component] is now fully operational.

The problem was [brief cause] and has been fixed.

Thanks for your patience! 🙏
```

### Status Update - Scheduled Maintenance

**Advance Notice (24 hours):**
```markdown
## Scheduled Maintenance - [Date Time]

**What:** [Brief description]
**When:** [Date] at [Time] UTC
**Duration:** ~[X] minutes
**Impact:** [Expected impact]

**Why This Maintenance:**
[Explanation of what's being fixed/improved]

**What to Expect:**
- Site may be briefly unavailable
- Some functionality may be temporarily limited

We'll post updates here during the maintenance window.
```

---

## Common Incidents Playbooks

### Incident: Build Failures

**Symptoms:**
- GitHub Actions workflow fails on "Build" step
- Email notification: "Workflow failed"
- Site unchanged from previous deployment

**Quick Diagnosis:**
```bash
# Check workflow logs
# Visit: https://github.com/[username]/bjjgraph/actions
# Click failed workflow → "Build" job → Expand logs

# Common error patterns:
# 1. "YAML parse error" → Malformed frontmatter
# 2. "Module not found" → Dependencies issue
# 3. "Build failed" → Quartz config error
```

**Resolution Steps:**

**If malformed content:**
```bash
# Validate content locally
python3 scripts/validate_content.py source/content/ --strict

# Fix errors reported
# Re-run validation until clean

# Commit fix
git add .
git commit -m "FIX: Resolve content validation errors"
git push origin main
```

**If dependencies issue:**
```bash
# Clear cache and rebuild
# In GitHub Actions: Re-run workflow with "Re-run jobs" → Clear cache

# Or locally
cd source
rm -rf node_modules
npm install
npx quartz build
```

**If Quartz config error:**
```bash
# Review recent config changes
git diff HEAD~1 HEAD -- quartz.config.ts quartz.layout.ts

# Revert config changes
git checkout HEAD~1 -- quartz.config.ts
git commit -m "REVERT: Restore working Quartz config"
git push origin main
```

**Prevention:**
- Add content validation to pre-commit hook
- Test builds locally before pushing
- Document configuration changes

### Incident: Schema Validation Errors

**Symptoms:**
- Google Rich Results Test shows errors
- Search Console reports structured data issues
- Rich snippets disappear from search results

**Quick Diagnosis:**
```bash
# Test sample pages
# Visit: https://search.google.com/test/rich-results
# Test: https://bjjgraph.org/Positions/Mount

# Check for:
# - "Error" (red) → Critical, must fix
# - "Warning" (yellow) → Non-critical, should fix
# - "Valid" (green) → All good

# Common errors:
# - Missing required fields
# - Invalid property values
# - Malformed JSON-LD
```

**Resolution Steps:**

**If affecting <10 pages (P3):**
```bash
# Fix manually via normal workflow
# Edit affected files
# Re-validate with Rich Results Test
# Create PR and merge
```

**If affecting 10-50 pages (P2):**
```bash
# Identify pattern in errors
# Run schema validation locally
python3 scripts/validate_content.py source/content/ --type Positions

# Fix pattern (e.g., add missing fields)
# Re-run schema scripts if needed
python3 scripts/seo/add_position_schema_v2.py

# Test 5 sample pages
# Deploy via PR
```

**If affecting >50 pages (P1):**
```bash
# Likely caused by recent schema script change
# Check recent schema script commits
git log --oneline scripts/seo/

# Rollback if recent deployment
git revert [commit-hash]
git push origin main

# OR fix script and redeploy
# Test thoroughly before pushing
```

**Prevention:**
- Always test schema changes on 5+ pages before deployment
- Use Google Rich Results Test before merging
- Monitor Search Console weekly for new errors

### Incident: Performance Degradation

**Symptoms:**
- Page load times >5 seconds
- Lighthouse performance score drops >20 points
- Users report slow loading
- Increased bounce rate in analytics

**Quick Diagnosis:**
```bash
# Run Lighthouse audit
# https://pagespeed.web.dev/
# Analyze: https://bjjgraph.org/

# Key metrics to check:
# - First Contentful Paint (FCP)
# - Largest Contentful Paint (LCP)
# - Total Blocking Time (TBT)
# - Cumulative Layout Shift (CLS)

# Chrome DevTools
# Open site → F12 → Performance tab → Record page load
# Identify slow resources
```

**Common Causes & Fixes:**

**1. Large Images:**
```bash
# Optimize images
# Use image compression tools
# Add width/height attributes
# Consider lazy loading
```

**2. JavaScript Bloat:**
```bash
# Check bundle size
npx quartz build
# Review output bundle sizes

# Remove unnecessary dependencies
# Audit package.json
```

**3. Third-Party Scripts:**
```bash
# Audit external scripts
# Check: Analytics, fonts, embeds

# Consider:
# - Self-hosting fonts
# - Deferring non-critical scripts
# - Removing unused integrations
```

**Resolution Process:**
1. Identify bottleneck (top 1-3 issues)
2. Fix highest impact issue first
3. Test improvement locally
4. Deploy and verify
5. Monitor for 24 hours

**Prevention:**
- Set performance budgets
- Monitor Core Web Vitals weekly
- Test performance before major deployments

### Incident: Indexing Issues

**Symptoms:**
- Pages indexed count drops in Search Console
- New pages not appearing in Google search
- Coverage errors increase

**Quick Diagnosis:**
```bash
# Check robots.txt
curl https://bjjgraph.org/robots.txt
# Verify it's not blocking content

# Check sitemap
curl https://bjjgraph.org/sitemap.xml
# Verify it exists and has URLs

# Check for noindex tags
curl https://bjjgraph.org/Positions/Mount | grep -i "noindex"
# Should return nothing

# Search Console → Coverage
# Check for errors: "Excluded by 'noindex' tag", "Blocked by robots.txt", etc.
```

**Resolution Steps:**

**If robots.txt blocking:**
```bash
# Check source/public/robots.txt or equivalent
# Ensure allows crawling:

User-agent: *
Allow: /
Sitemap: https://bjjgraph.org/sitemap.xml

# If wrong, fix and redeploy
```

**If sitemap issues:**
```bash
# Verify sitemap generation
npx quartz build
# Check output for sitemap.xml

# If missing, check Quartz config
# Ensure sitemap plugin is enabled

# Resubmit sitemap in Search Console
```

**If noindex tags:**
```bash
# Search for noindex in codebase
grep -r "noindex" source/

# Remove unwanted noindex tags
# Redeploy

# Request re-indexing in Search Console
```

**If temporary Google issue:**
- Wait 48-72 hours
- Monitor Search Console
- No action needed if pages reappear

**Prevention:**
- Monitor indexing status weekly
- Set up Search Console alerts
- Test robots.txt before deployment
- Verify sitemap after each deployment

---

## Post-Incident Review

### When to Conduct PIR

- **Always** for P0 incidents
- **Always** for P1 incidents
- **Optional** for P2 incidents (if interesting learnings)
- **Not needed** for P3 incidents

### PIR Template

```markdown
# Post-Incident Review: [Incident Title]

**Date:** 2025-10-14
**Priority:** P0/P1/P2
**Duration:** [Start time] to [End time] ([X] minutes)
**RTO Target:** [X] minutes
**RTO Achieved:** [X] minutes ✅/❌

---

## Incident Summary

**What happened:**
[1-2 paragraph description of the incident]

**Impact:**
- Users affected: [All/Most/Some/Few]
- Functionality affected: [Description]
- Duration: [X] minutes
- Revenue impact: [If applicable]

---

## Timeline

| Time | Event |
|------|-------|
| 14:30 | Incident begins (site goes down) |
| 14:32 | Issue detected by [person/system] |
| 14:33 | Investigation started |
| 14:35 | Root cause identified |
| 14:38 | Rollback initiated |
| 14:45 | Site restored |
| 14:48 | Verification complete |

**Total Duration:** 18 minutes
**Detection Time:** 2 minutes
**Response Time:** 3 minutes
**Resolution Time:** 10 minutes
**Verification Time:** 3 minutes

---

## Root Cause Analysis

**What caused the incident:**
[Detailed explanation of root cause]

**Why it wasn't caught earlier:**
[Pre-deployment testing gaps, monitoring blind spots, etc.]

**Contributing factors:**
- [Factor 1]
- [Factor 2]

---

## What Went Well

**Strengths demonstrated:**
- [Positive aspect 1]
- [Positive aspect 2]

**Effective procedures:**
- [What worked in our response]

---

## What Went Wrong

**Issues identified:**
- [Problem 1]
- [Problem 2]

**Process gaps:**
- [Gap 1]
- [Gap 2]

---

## Action Items

### Immediate (Within 48 hours)

- [ ] **[Owner]** - [Action item with clear deliverable]
- [ ] **[Owner]** - [Action item with clear deliverable]

### Short-term (Within 2 weeks)

- [ ] **[Owner]** - [Action item]
- [ ] **[Owner]** - [Action item]

### Long-term (Within 3 months)

- [ ] **[Owner]** - [Action item]
- [ ] **[Owner]** - [Action item]

---

## Prevention Measures

**Process improvements:**
- [Change to deployment checklist]
- [Change to validation procedures]

**Technical improvements:**
- [Add monitoring]
- [Improve testing]
- [Update CI/CD pipeline]

**Documentation updates:**
- [Update runbook]
- [Add to FAQ]
- [Update incident response playbook]

---

## Lessons Learned

**Key takeaways:**
1. [Lesson 1]
2. [Lesson 2]
3. [Lesson 3]

**Skills to develop:**
- [Area for team training]
- [Tool proficiency needed]

---

## Appendix

**Related Issues:**
- [GitHub Issue #123]

**Referenced Documentation:**
- [rollback-procedures.md](./rollback-procedures.md)
- [deployment-checklist.md](./deployment-checklist.md)

**Screenshots/Logs:**
- [Attach relevant evidence]

---

**Reviewed by:** [Name]
**Review date:** [Date]
**Approved by:** [Name]
**Approval date:** [Date]
```

### PIR Follow-Up

**Within 1 week:**
- Review PIR with team
- Assign owners to action items
- Update relevant documentation

**Within 1 month:**
- Verify action items completed
- Test improvements
- Update incident response playbook if needed

**Within 3 months:**
- Review if similar incidents have occurred
- Assess effectiveness of prevention measures
- Share learnings with broader community (if applicable)

---

## Quick Reference Card

### Emergency Contacts

```
┌─────────────────────────────────────────────┐
│         INCIDENT RESPONSE CONTACTS          │
├─────────────────────────────────────────────┤
│ GitHub Status:  githubstatus.com            │
│ GitHub Support: support.github.com          │
│ Create Issue:   github.com/[user]/bjjgraph  │
│                 /issues/new                  │
└─────────────────────────────────────────────┘
```

### Quick Rollback Commands

```bash
# EMERGENCY ROLLBACK (copy-paste ready)

# 1. Revert last commit
git revert HEAD
git push origin main

# 2. Check deployment
# Visit: https://github.com/[username]/bjjgraph/actions

# 3. Verify site restored (wait 8 minutes)
curl -I https://bjjgraph.org/

# 4. Update incident issue with results
```

### Incident Severity Decision Tree

```
Site completely down? → YES → P0 (Rollback immediately)
                     ↓ NO
Major function broken? → YES → P1 (Urgent response)
                      ↓ NO
Performance degraded? → YES → P2 (Scheduled fix)
                     ↓ NO
Minor issue? → YES → P3 (Normal workflow)
```

---

## Appendix: Testing Procedures

### Quarterly Incident Response Drill

**Schedule:** Every 3 months
**Duration:** 30 minutes
**Participants:** All team members with deployment access

**Drill Procedure:**

1. **Simulate Incident (5 min)**
   ```bash
   # Create test branch with intentional error
   git checkout -b test-incident-drill
   echo "INVALID: YAML" > source/content/test-page.md
   git add .
   git commit -m "TEST: Simulated incident for drill"
   git push origin test-incident-drill
   ```

2. **Execute Response (20 min)**
   - Detect issue (monitoring should alert)
   - Create incident issue
   - Investigate (identify intentional error)
   - Execute rollback
   - Verify resolution
   - Document timeline

3. **Debrief (5 min)**
   - Review actual RTO vs. target
   - Identify process improvements
   - Update playbook if needed

4. **Cleanup**
   ```bash
   git branch -D test-incident-drill
   git push origin --delete test-incident-drill
   ```

**Metrics to Track:**
- Time to detection
- Time to rollback execution
- Total RTO
- Issues encountered

**Success Criteria:**
- RTO < 15 minutes for P0 simulation
- All team members able to execute rollback
- Incident issue properly documented

---

## Document Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-10-14 | Initial playbook created | [Name] |

---

**Next Review:** 2026-01-14 (Quarterly)
**Document Owner:** Site Administrator
**Related Documents:**
- [rollback-procedures.md](./rollback-procedures.md)
- [deployment-checklist.md](./deployment-checklist.md)
- [seo-maintenance-guide.md](../seo/seo-maintenance-guide.md)

---

*This playbook is a living document. Update after each incident with new learnings and improved procedures.*
