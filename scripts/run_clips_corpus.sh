#!/usr/bin/env bash
# Full-corpus YouTube clip sourcing. SAFE TO RERUN ANY TIME — every stage resumes from
# clips_sourcing/state.json (per-slot status machine), so after a credit outage, network
# failure, reboot, or Ctrl-C, just run this script again and it continues where it left
# off. Claude usage limits are handled inside claude_infer (waits for the stated reset);
# hard failures abort the stage cleanly instead of grinding.
#
#   nohup bash scripts/run_clips_corpus.sh &   # survives terminal/session close
#   tail -f clips_sourcing/run.log             # watch progress
#
# Order: Positions -> Submissions -> Transitions -> Principles (importance-first), then
# a final report. Add a shorts-retry sweep afterwards with:
#   python3 scripts/source_clips.py --stage all --redo-empty
cd "$(dirname "$0")/.."
mkdir -p clips_sourcing
exec >> clips_sourcing/run.log 2>&1

echo "=== [$(date '+%F %T')] corpus run starting (pid $$) ==="
for cat in Positions Submissions Transitions Principles; do
  echo "=== [$(date '+%F %T')] category: $cat ==="
  python3 scripts/source_clips.py --stage all --category "$cat"
done
python3 scripts/source_clips.py --stage report
echo "=== [$(date '+%F %T')] CORPUS RUN COMPLETE ==="
