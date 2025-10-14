# Emergency Rollback Procedures

**Last Updated:** October 14, 2025
**Deployment Model:** GitHub Pages (Static Site)
**CI/CD:** GitHub Actions
**RTO Target:** < 10 minutes for critical issues

---

## Table of Contents

1. [When to Rollback](#when-to-rollback)
2. [Pre-Rollback Assessment](#pre-rollback-assessment)
3. [Automatic Rollback (Git Revert)](#automatic-rollback-git-revert)
4. [Manual Rollback (GitHub Pages)](#manual-rollback-github-pages)
5. [Emergency Procedures](#emergency-procedures)
6. [Post-Rollback Actions](#post-rollback-actions)
7. [Recovery Time Objectives](#recovery-time-objectives)
8. [Rollback Testing](#rollback-testing)

---

## When to Rollback

### Critical Issues (Immediate Rollback Required)

**Execute rollback immediately if:**

- **Site completely down** - 404 errors on homepage or all pages
- **Build failure prevents deployment** - GitHub Actions workflow fails completely
- **Critical security vulnerability** - Exposed secrets, XSS vulnerabilities, malicious code
- **Data corruption** - Broken schema markup causing search penalties
- **Complete site breakage** - JavaScript errors preventing all functionality
- **SEO catastrophe** - All pages noindexed, robots.txt blocking everything

**RTO:** 5-10 minutes

### High-Priority Issues (Rollback Recommended)

**Consider rollback for:**

- **Major functionality broken** - Search, navigation, or graph view non-functional
- **Significant content errors** - Multiple pages with broken wikilinks (>20% of pages)
- **Schema validation failures** - Google Rich Results Test failing on most pages
- **Performance degradation** - Page load times >5 seconds
- **Mobile rendering broken** - Site unusable on mobile devices

**RTO:** 15-30 minutes (assess impact first)

### Medium-Priority Issues (Hotfix Preferred)

**Hotfix instead of rollback for:**

- **Single page errors** - One or two broken pages
- **Minor visual bugs** - CSS issues that don't block content
- **Non-critical link issues** - A few broken wikilinks
- **Analytics issues** - Plausible tracking not working
- **Schema warnings** - Non-critical schema validation warnings

**RTO:** 1-4 hours

### Low-Priority Issues (Normal Fix Cycle)

**Do NOT rollback for:**

- **Typos or content errors** - Fix in next regular deployment
- **Minor SEO improvements needed** - Update meta descriptions incrementally
- **Image optimization** - Not critical for site function
- **Documentation updates** - No user impact

---

## Pre-Rollback Assessment

### Quick Health Check (2 minutes)

Before initiating rollback, quickly verify:

```bash
# 1. Check if site is accessible
curl -I https://bjjgraph.org/

# 2. Check GitHub Pages status
# Visit: https://www.githubstatus.com/

# 3. Check recent deployment logs
# Visit: https://github.com/[username]/bjjgraph/actions

# 4. Test sample pages
curl -I https://bjjgraph.org/Positions/Mount
curl -I https://bjjgraph.org/Transitions/Hip-Bump-Sweep
curl -I https://bjjgraph.org/Submissions/Triangle-Choke
```

### Identify Last Known Good Commit

```bash
# View recent commits
git log --oneline -10

# Identify commit before the problematic deployment
# Example output:
# d04c096 (HEAD -> main) new files ← CURRENT (BROKEN)
# 5f492c1 massive content addition ← LAST GOOD
# ca35c81 simiplied indexnow to act on push
```

### Document the Issue

**Before rolling back, document:**

1. **What's broken?** - Specific error messages, affected pages
2. **When did it break?** - Commit hash, timestamp
3. **User impact?** - How many users affected, what functionality lost
4. **Evidence** - Screenshots, error logs, failed tests

**Create GitHub Issue:**
```markdown
Title: [ROLLBACK] Site broken after commit d04c096

Description:
- **Issue**: Homepage returns 404 error
- **Commit**: d04c096 "new files"
- **Time**: 2025-10-14 14:30 UTC
- **Impact**: Entire site inaccessible
- **Evidence**: [screenshot link]
- **Action**: Rolling back to 5f492c1
```

---

## Automatic Rollback (Git Revert)

### Method 1: Revert Single Commit (Preferred)

**Use when:** The problematic commit is the most recent one.

```bash
# 1. Identify problematic commit
git log --oneline -5

# 2. Revert the commit (creates new commit that undoes changes)
git revert HEAD

# 3. Push to trigger redeployment
git push origin main

# 4. Monitor GitHub Actions
# Visit: https://github.com/[username]/bjjgraph/actions
# Wait for "Build and Test" workflow to complete (5-8 minutes)

# 5. Verify site is restored
curl -I https://bjjgraph.org/
```

**Timeline:**
- Revert commit: 30 seconds
- Push and CI trigger: 10 seconds
- Build process: 3-5 minutes
- Deployment: 2-3 minutes
- **Total RTO: 6-9 minutes**

### Method 2: Revert Multiple Commits

**Use when:** Multiple recent commits are problematic.

```bash
# Revert last 3 commits (most recent first)
git revert HEAD~2..HEAD

# Or revert specific commit range
git revert abc123..def456

# Push to deploy
git push origin main
```

### Method 3: Hard Reset (Use with Caution)

**WARNING:** This rewrites history. Only use if revert fails.

```bash
# 1. Reset to last known good commit
git reset --hard 5f492c1

# 2. Force push (requires admin privileges)
git push --force origin main

# 3. Monitor redeployment
```

**⚠️ Risks:**
- Rewrites git history
- Requires force push (blocked by branch protection)
- Other developers must re-sync their local repos

---

## Manual Rollback (GitHub Pages)

### Method 1: Redeploy Previous Workflow

**Use when:** Git revert fails or you need immediate rollback.

1. **Navigate to GitHub Actions:**
   ```
   https://github.com/[username]/bjjgraph/actions
   ```

2. **Find last successful workflow:**
   - Look for workflow with ✅ green checkmark
   - Click on the workflow run from last known good commit

3. **Re-run workflow:**
   - Click "Re-run all jobs" button
   - Confirm re-run

4. **Monitor redeployment:**
   - Watch workflow progress
   - Wait for all jobs to complete (5-8 minutes)

5. **Verify site restored:**
   ```bash
   curl -I https://bjjgraph.org/
   ```

**Timeline:**
- Navigate to Actions: 30 seconds
- Re-run workflow: 10 seconds
- Workflow execution: 5-8 minutes
- **Total RTO: 6-9 minutes**

### Method 2: Manual Artifact Download

**Use when:** Automated methods fail completely.

1. **Download artifact from successful build:**
   ```
   https://github.com/[username]/bjjgraph/actions
   → Select successful workflow
   → Click "Artifacts"
   → Download "github-pages" artifact
   ```

2. **Extract artifact locally:**
   ```bash
   unzip github-pages.zip -d restored_site/
   ```

3. **Manually push to gh-pages branch** (if not using Actions):
   ```bash
   git checkout gh-pages
   rm -rf *
   cp -r restored_site/* .
   git add .
   git commit -m "Emergency rollback to working version"
   git push origin gh-pages
   ```

**Note:** BJJGraph uses automated deployment. This method is rarely needed.

---

## Emergency Procedures

### Complete Site Outage

**If GitHub Pages is completely down:**

1. **Check GitHub Status:**
   ```
   https://www.githubstatus.com/
   ```

2. **If GitHub issue, wait for resolution.**

3. **If local issue, execute emergency rollback:**
   ```bash
   # Option A: Revert last commit
   git revert HEAD
   git push origin main

   # Option B: Re-run last successful workflow
   # Via GitHub Actions UI
   ```

### Deployment Pipeline Broken

**If GitHub Actions workflow fails:**

1. **Check workflow logs:**
   ```
   https://github.com/[username]/bjjgraph/actions
   → Click failed workflow
   → Review logs for each job
   ```

2. **Common failures and fixes:**

   **Build failure:**
   ```bash
   # Check for syntax errors in content files
   npm run check

   # If Node modules corrupted, clear cache
   # Via GitHub Actions: Re-run with cache cleared
   ```

   **Deploy failure:**
   ```
   # Usually permissions issue
   # Check Settings → Actions → General → Workflow permissions
   # Ensure "Read and write permissions" is enabled
   ```

3. **If workflow is broken, manually trigger older workflow:**
   - Go to last successful workflow run
   - Click "Re-run all jobs"

### Security Incident

**If secrets exposed or malicious code detected:**

1. **IMMEDIATE ACTIONS:**
   ```bash
   # 1. Revert immediately
   git revert HEAD
   git push origin main

   # 2. Rotate all secrets
   # GitHub Settings → Secrets and variables → Actions
   # Update: INDEXNOW_KEY, ANTHROPIC_API_KEY

   # 3. Check for unauthorized access
   # Settings → Security → Access
   ```

2. **Contact GitHub Support if needed:**
   ```
   https://support.github.com/
   ```

3. **Post-incident review:**
   - How was secret exposed?
   - Update security procedures
   - Audit all commits

### Schema Validation Failure

**If Google Rich Results Test shows errors on most pages:**

1. **Quick assessment:**
   ```bash
   # Test representative pages
   curl https://bjjgraph.org/Positions/Mount | grep 'application/ld+json'
   ```

2. **If schema completely broken:**
   ```bash
   # Rollback to last known good schema
   git revert HEAD
   git push origin main
   ```

3. **If schema has warnings (not errors), don't rollback:**
   - Document warnings
   - Fix in hotfix branch
   - Test before merging

---

## Post-Rollback Actions

### Immediate Verification (< 5 minutes)

```bash
# 1. Homepage accessible
curl -I https://bjjgraph.org/ | head -n 1

# 2. Sample pages load
curl -I https://bjjgraph.org/Positions/Mount | head -n 1
curl -I https://bjjgraph.org/Transitions/Hip-Bump-Sweep | head -n 1

# 3. Sitemap accessible
curl -I https://bjjgraph.org/sitemap.xml | head -n 1

# 4. Schema validation
# Visit: https://search.google.com/test/rich-results
# Test: https://bjjgraph.org/Positions/Mount
```

### Short-Term Actions (< 1 hour)

1. **Update GitHub Issue:**
   ```markdown
   ## Rollback Complete

   - **Rolled back to:** 5f492c1
   - **Time to restore:** 7 minutes
   - **Site status:** Fully operational
   - **Next steps:** Root cause analysis
   ```

2. **Notify stakeholders** (if applicable):
   - Post in project Slack/Discord
   - Update status page
   - Notify users if significant outage

3. **Preserve broken state for analysis:**
   ```bash
   # Create branch from broken commit for investigation
   git checkout d04c096
   git checkout -b rollback-investigation
   git push origin rollback-investigation
   ```

### Root Cause Analysis (< 4 hours)

**Investigate what went wrong:**

1. **Review the problematic commit:**
   ```bash
   git show d04c096
   ```

2. **Identify specific changes that caused failure:**
   - New files added?
   - Configuration changes?
   - Schema markup errors?
   - Build script modifications?

3. **Reproduce locally:**
   ```bash
   git checkout rollback-investigation
   cd source
   npx quartz build --serve
   # Test in browser
   ```

4. **Document findings:**
   ```markdown
   ## Root Cause Analysis

   **What happened:**
   - Added 100 new position files
   - Several files had malformed YAML frontmatter
   - Build process failed silently
   - Deployed broken site

   **Why it wasn't caught:**
   - Pre-deployment validation not run
   - No automated content validation in CI

   **Prevention:**
   - Add validate_content.py to GitHub Actions workflow
   - Require validation pass before merge
   ```

### Hotfix Development (< 1 day)

1. **Create hotfix branch from rollback-investigation:**
   ```bash
   git checkout rollback-investigation
   git checkout -b hotfix/fix-yaml-errors
   ```

2. **Fix the issue:**
   ```bash
   # Fix broken YAML
   # Run validation
   python3 scripts/validate_content.py source/content/ --strict

   # Test build
   cd source
   npx quartz build
   ```

3. **Test thoroughly:**
   ```bash
   # Local testing
   npx quartz build --serve

   # Validation
   python3 scripts/validate_content.py source/content/ --verbose

   # Schema validation
   # Test with Google Rich Results Test
   ```

4. **Create pull request:**
   ```markdown
   Title: [HOTFIX] Fix YAML frontmatter errors in new position files

   Fixes issue introduced in commit d04c096.

   Changes:
   - Fixed malformed YAML in 15 files
   - Added validation to CI workflow
   - Tested locally and validated schema

   Closes #123
   ```

5. **Deploy hotfix:**
   ```bash
   # After PR approval
   git checkout main
   git merge hotfix/fix-yaml-errors
   git push origin main
   ```

### Prevention Measures

**Update CI/CD pipeline to prevent recurrence:**

```yaml
# Add to .github/workflows/ci.yaml

- name: Validate content before build
  run: |
    python3 scripts/validate_content.py source/content/ --strict
  working-directory: ./

- name: Test build locally
  run: |
    npx quartz build
    # Check for build errors
    if [ $? -ne 0 ]; then
      echo "Build failed!"
      exit 1
    fi
  working-directory: ./source
```

**Update deployment checklist:**
- Add "Run validate_content.py" to pre-deployment steps
- Add "Test schema on 5 sample pages" to checklist
- Document common failure modes

---

## Recovery Time Objectives

### Critical Issues (Site Down)

| Scenario | Detection | Rollback | Verification | Total RTO |
|----------|-----------|----------|--------------|-----------|
| Complete site outage | 1 min | 2 min | 3 min | **6 min** |
| Build failure | 5 min | 2 min | 3 min | **10 min** |
| Security incident | 2 min | 2 min | 5 min | **9 min** |

### High-Priority Issues

| Scenario | Detection | Rollback | Verification | Total RTO |
|----------|-----------|----------|--------------|-----------|
| Major functionality broken | 5 min | 2 min | 5 min | **12 min** |
| Schema validation failures | 10 min | 2 min | 10 min | **22 min** |
| Performance degradation | 15 min | 2 min | 10 min | **27 min** |

### Rollback Method Comparison

| Method | RTO | Complexity | Risk | When to Use |
|--------|-----|------------|------|-------------|
| Git revert | 6-9 min | Low | Low | First choice for most issues |
| Re-run workflow | 6-9 min | Very low | Very low | Deployment pipeline works |
| Hard reset | 6-9 min | High | High | Last resort only |
| Manual artifact | 15-20 min | High | Medium | Automated methods fail |

### Factors Affecting RTO

**Faster recovery (<5 min):**
- Simple revert of single commit
- Clear error messages in logs
- Team member with admin access available
- Well-documented issue

**Slower recovery (>15 min):**
- Multiple commits need reverting
- Complex merge conflicts
- Unclear root cause
- Requires investigation before rollback

---

## Rollback Testing

### Quarterly Rollback Drills

**Test rollback procedures every 3 months:**

1. **Simulate deployment failure:**
   ```bash
   # Create test branch with intentional error
   git checkout -b test-rollback-drill

   # Introduce breaking change
   echo "INVALID YAML" > source/content/test.md

   # Attempt deployment
   git add .
   git commit -m "TEST: Intentional break for rollback drill"
   git push origin test-rollback-drill
   ```

2. **Execute rollback procedure:**
   ```bash
   # Time the entire process
   time {
     git revert HEAD
     git push origin test-rollback-drill
   }
   ```

3. **Document results:**
   - Actual RTO achieved
   - Issues encountered
   - Process improvements needed

4. **Clean up:**
   ```bash
   git branch -D test-rollback-drill
   git push origin --delete test-rollback-drill
   ```

### Pre-Production Rollback Test

**Before major releases, test rollback in staging:**

1. Deploy to test branch
2. Verify deployment works
3. Execute rollback
4. Verify rollback completes successfully
5. Re-deploy and verify again

---

## Rollback Decision Matrix

```
                    ┌─────────────────────────────────────────┐
                    │     Is the site completely down?       │
                    └─────────────────┬───────────────────────┘
                                      │
                          ┌───────────┴───────────┐
                         YES                     NO
                          │                       │
                          ▼                       ▼
                    ┌─────────────┐       ┌─────────────────┐
                    │   ROLLBACK  │       │ Assess severity │
                    │ IMMEDIATELY │       └────────┬─────────┘
                    └─────────────┘                │
                                          ┌────────┴────────┐
                                        High             Low
                                          │                 │
                                          ▼                 ▼
                                  ┌──────────────┐  ┌──────────┐
                                  │   Consider   │  │  Hotfix  │
                                  │   rollback   │  │  instead │
                                  └──────────────┘  └──────────┘
```

---

## Quick Reference Commands

### Emergency Rollback (Copy-Paste Ready)

```bash
# 1. QUICK REVERT (Most common)
git revert HEAD
git push origin main

# 2. REVERT SPECIFIC COMMIT
git revert <commit-hash>
git push origin main

# 3. CHECK DEPLOYMENT STATUS
curl -I https://bjjgraph.org/

# 4. MONITOR GITHUB ACTIONS
# Visit: https://github.com/[username]/bjjgraph/actions

# 5. VERIFY RESTORATION
curl https://bjjgraph.org/ | grep -i "BJJ Graph"
curl https://bjjgraph.org/sitemap.xml
curl https://bjjgraph.org/Positions/Mount
```

### Who to Contact

**During rollback incident:**
- GitHub Status: https://www.githubstatus.com/
- GitHub Support: https://support.github.com/

**Post-incident:**
- Document in GitHub Issues
- Update team via communication channels

---

## Appendix: Common Failure Modes

### Schema Markup Errors

**Symptoms:**
- Google Rich Results Test fails
- Schema validation warnings/errors
- Search Console reports structured data issues

**Rollback decision:** Only if >50% of pages affected

**Prevention:**
- Run schema validation before deployment
- Test sample pages with Rich Results Test
- Use validate_content.py with --strict flag

### Content Validation Failures

**Symptoms:**
- Broken wikilinks
- Missing required sections
- Malformed YAML frontmatter

**Rollback decision:** Only if build fails or >20% content broken

**Prevention:**
- Run validate_content.py before committing
- Add validation to pre-commit hooks
- Include validation in GitHub Actions workflow

### Build Process Failures

**Symptoms:**
- GitHub Actions workflow fails on build step
- Quartz build errors
- Node module errors

**Rollback decision:** Always (no successful deployment occurred)

**Prevention:**
- Test builds locally before pushing
- Use package-lock.json for dependency consistency
- Cache node_modules in GitHub Actions

---

**Emergency Contact:** Create GitHub Issue with [EMERGENCY] tag for urgent incidents.

**Last Tested:** [Date of last rollback drill]

**Next Drill:** [Scheduled date]

---

*This document should be reviewed and updated quarterly. All team members should be familiar with rollback procedures.*
