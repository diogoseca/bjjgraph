#!/bin/bash

# Select N random files from the 100 oldest content files (by git creation date)
# Prioritizes JSON files (source of truth), includes orphaned .md as fallback
# Usage: ./select_oldest_files.sh [number_of_files]
# Default: 10 files

set -e

NUM_FILES=${1:-10}
# Dedup guard: skip files a bot improved within this many days, so the Saturday
# content bot and Sunday analytics bot don't double-touch the same file in one
# quota week. Override with env SKIP_RECENT_DAYS.
SKIP_RECENT_DAYS=${SKIP_RECENT_DAYS:-14}
cd "$(dirname "$0")/.."
CONTENT_DIR="content"

if [ ! -d "$CONTENT_DIR" ]; then
    echo "Error: Content directory not found at $CONTENT_DIR" >&2
    exit 1
fi

echo "Finding 100 oldest content files by git creation date..." >&2

# Function to get git creation timestamp for a file
get_creation_timestamp() {
    local file="$1"
    # Get first commit date (creation) - returns Unix timestamp
    git log --format="%ct" --diff-filter=A -- "$file" 2>/dev/null | tail -1
}

# Returns 0 (true) if the file was bot-improved within SKIP_RECENT_DAYS.
# Reads top-level bot_metadata.last_improved (ISO date). Files without it, or
# unparseable, are treated as eligible (exit 1).
is_recently_improved() {
    python3 - "$1" "$SKIP_RECENT_DAYS" <<'PY' 2>/dev/null
import json, sys, datetime
try:
    data = json.load(open(sys.argv[1]))
    li = (data.get("bot_metadata") or {}).get("last_improved")
    if not li:
        sys.exit(1)
    dt = datetime.date.fromisoformat(str(li)[:10])
    sys.exit(0 if (datetime.date.today() - dt).days < int(sys.argv[2]) else 1)
except Exception:
    sys.exit(1)
PY
}

# Find all JSON files and get their creation dates
json_files=$(find "$CONTENT_DIR" -type f -name "*.json" \
    ! -name "CONTRIBUTING-*.json" \
    ! -name "TEMPLATE*.json" \
    ! -path "*/node_modules/*")

echo "  Collecting creation dates for JSON files..." >&2
json_with_dates=""
skipped_recent=0
while IFS= read -r file; do
    [ -z "$file" ] && continue
    if is_recently_improved "$file"; then
        skipped_recent=$((skipped_recent + 1))
        continue
    fi
    timestamp=$(get_creation_timestamp "$file")
    # If no git history, use 0 (oldest possible)
    [ -z "$timestamp" ] && timestamp=0
    json_with_dates="${json_with_dates}${timestamp} ${file}"$'\n'
done <<< "$json_files"
[ "$skipped_recent" -gt 0 ] && echo "  Skipped $skipped_recent file(s) improved within ${SKIP_RECENT_DAYS}d" >&2

# Find orphaned .md files (no .json sibling)
echo "  Collecting orphaned .md files..." >&2
md_files=$(find "$CONTENT_DIR" -type f -name "*.md" \
    ! -name "CONTRIBUTING-*.md" \
    ! -name "index.md" \
    ! -name "000.STANDARD.md" \
    ! -path "*/node_modules/*")

orphaned_md_with_dates=""
while IFS= read -r md_file; do
    [ -z "$md_file" ] && continue

    # Skip generated role pages (generated from parent JSON files)
    md_basename=$(basename "$md_file" .md)
    if [[ "$md_basename" == "Bottom" || "$md_basename" == "Top" || \
          "$md_basename" == "Attacker" || "$md_basename" == "Defender" ]]; then
        parent_dir=$(dirname "$md_file")
        parent_name=$(basename "$parent_dir")
        grandparent_dir=$(dirname "$parent_dir")
        parent_json="${grandparent_dir}/${parent_name}.json"
        if [ -f "$parent_json" ]; then
            continue
        fi
    fi

    # Check if .json sibling exists
    json_sibling="${md_file%.md}.json"
    if [ ! -f "$json_sibling" ]; then
        timestamp=$(get_creation_timestamp "$md_file")
        [ -z "$timestamp" ] && timestamp=0
        orphaned_md_with_dates="${orphaned_md_with_dates}${timestamp} ${md_file}"$'\n'
    fi
done <<< "$md_files"

# Combine and sort by timestamp (oldest first), take top 100
all_files="${json_with_dates}${orphaned_md_with_dates}"
OLDEST_100=$(echo "$all_files" | grep -v '^$' | sort -n | head -n 100 | cut -d' ' -f2-)

if [ -z "$OLDEST_100" ]; then
    echo "Error: No content files found" >&2
    exit 1
fi

FILE_COUNT=$(echo "$OLDEST_100" | wc -l | tr -d ' ')
echo "  Found $FILE_COUNT oldest files" >&2

# Randomly select N files using awk (portable)
echo "Selecting $NUM_FILES random files..." >&2
SELECTED_FILES=$(echo "$OLDEST_100" | awk 'BEGIN{srand()} {print rand() "\t" $0}' | sort -n | cut -f2- | head -n "$NUM_FILES")

# Output selected files (one per line)
echo "$SELECTED_FILES"

# Summary to stderr for logging
echo "" >&2
echo "Selected files for improvement:" >&2
echo "$SELECTED_FILES" | sed 's|^|  - |' >&2
echo "" >&2
