# GitHub Actions Workflow Fixes

## Issues Identified and Fixed

### 1. ⚠️ **Scheduled Workflows Auto-Disabled (PRIMARY ISSUE)**

**Problem:**  
GitHub automatically disables scheduled workflows after **60 days of repository inactivity**. This prevents workflows from running even with valid cron schedules.

**Solution:**  
- Created `keepalive.yml` workflow that runs weekly
- Commits a simple timestamp file to maintain repository activity
- Prevents workflow auto-disable by ensuring regular commits
- Uses `[skip ci]` tag to avoid triggering other workflows unnecessarily

**Reference:** [GitHub Docs - Disabling and enabling a workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)

---

### 2. 🐛 **Script Compatibility Issue (SECONDARY ISSUE)**

**Problem:**  
`scripts/select_oldest_files.sh` used BSD-style `stat` command (`stat -f`), which doesn't work on GitHub Actions runners that use Linux (GNU coreutils).

**Before:**
```bash
stat -f "%m %N" {} \;  # BSD/macOS only
```

**After:**
```bash
# Detects OS and uses correct stat syntax
if stat -c "%Y" /dev/null >/dev/null 2>&1; then
    # GNU stat (Linux)
    xargs -0 stat -c "%Y %n"
else
    # BSD stat (macOS)  
    xargs -0 stat -f "%m %N"
fi
```

**Additional Fix:**  
- Changed from `-exec` to `-print0 | xargs -0` for proper handling of filenames with spaces
- This prevents issues with filenames containing spaces (common in this repo)

---

### 3. 🔧 **Authentication Parameter Inconsistency**

**Problem:**  
`content-improvement-bot.yml` and `monthly-validation-bot.yml` used `anthropic_api_key` parameter, which is inconsistent with other working workflows.

**Solution:**  
- Changed to `claude_code_oauth_token` parameter
- Matches the parameter used in `claude.yml` and `claude-code-review.yml`
- Aligns with the secret name `CLAUDE_CODE_OAUTH_TOKEN` used across workflows

**Files Updated:**
- `.github/workflows/content-improvement-bot.yml`
- `.github/workflows/monthly-validation-bot.yml`

---

## Testing the Fixes

### Test the Script Locally
```bash
# Test selecting 3 files
./scripts/select_oldest_files.sh 3

# Test selecting 10 files (default)
./scripts/select_oldest_files.sh
```

### Test Workflow Manually
1. Go to Actions tab in GitHub repository
2. Select "Content Improvement Bot" workflow
3. Click "Run workflow" button
4. Optionally specify number of files (default: 10)
5. Watch the workflow run

### Verify Keepalive is Working
1. Check `.github/keepalive.txt` is updated weekly
2. Verify commit messages contain "[skip ci]" to avoid loops
3. Confirm scheduled workflows remain enabled

---

## Re-enabling Workflows (If Already Disabled)

If workflows were already auto-disabled by GitHub:

1. **Via GitHub UI:**
   - Go to Actions tab
   - Click on the disabled workflow
   - Click "Enable workflow" button

2. **Via GitHub CLI:**
   ```bash
   gh workflow enable content-improvement-bot.yml
   gh workflow enable monthly-validation-bot.yml
   gh workflow enable keepalive.yml
   ```

3. **Via Manual Trigger:**
   - Once enabled, trigger manually to test
   - Scheduled runs will resume on the next cron schedule

---

## Workflow Schedule Summary

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `content-improvement-bot.yml` | Daily at 8:00 AM UTC | Improves 10 random files from oldest 100 |
| `monthly-validation-bot.yml` | 1st of month at 3:00 AM UTC | Validates and fixes 20 files |
| `keepalive.yml` | Weekly on Sunday at 1:00 AM UTC | Prevents workflow auto-disable |

---

## Important Notes

1. **Default Branch Requirement:** Scheduled workflows only run on the default branch (main)
2. **Keepalive Frequency:** Weekly is sufficient to prevent 60-day auto-disable
3. **Manual Triggers:** All workflows support `workflow_dispatch` for manual testing
4. **Commit Activity:** Regular activity from these workflows will keep them enabled

---

## Monitoring Workflow Health

### Check Workflow Status
```bash
# List all workflows and their status
gh workflow list

# View recent runs
gh run list --workflow=content-improvement-bot.yml --limit 5
```

### GitHub Actions Dashboard
- Go to repository Actions tab
- Green checkmark = enabled and running
- Gray "disabled" label = needs re-enabling
- Yellow warning = may have issues

### Email Notifications
- GitHub sends email when scheduled workflows are disabled
- Check notification settings: Settings → Notifications → Actions

---

## References

- [GitHub Actions - Events that trigger workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
- [GitHub Actions - Disabling and enabling workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)
- [Claude Code Action Documentation](https://github.com/anthropics/claude-code-action)
- [Prevent scheduled GitHub Actions from becoming disabled - Stack Overflow](https://stackoverflow.com/questions/67184368/prevent-scheduled-github-actions-from-becoming-disabled)
