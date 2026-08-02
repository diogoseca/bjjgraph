#!/bin/bash

################################################################################
# Generate list of files that need fixing
#
# Validates all JSON files and outputs:
# - Failed files to: tests/artifacts/all_content_files_to_fix.txt
# - Passed files to: tests/artifacts/all_content_validated_and_ready_to_hook.txt
#
# Usage: ./scripts/regenerate_list_of_content_files_to_fix.sh
################################################################################

set -e

OUTPUT_FAILED="tests/artifacts/all_content_files_to_fix.txt"
OUTPUT_PASSED="tests/artifacts/all_content_validated_and_ready_to_hook.txt"

echo "Counting files..."
# Count total files first
total=$(find content/{Positions,Transitions,Submissions,Principles,Systems,Learning} -name "*.json" | grep -v TEMPLATE | wc -l | xargs)
echo "Found $total files to validate"
echo ""

# Clear output files
> "$OUTPUT_FAILED"
> "$OUTPUT_PASSED"

echo "Validating..."
echo ""

# Build file list, shuffled so candidates are analyzed in random order.
# (The pass/fail output files are re-sorted by name at the end.)
TEMP_FILELIST="/tmp/filelist_$$.txt"
if command -v shuf >/dev/null 2>&1; then
    find content/{Positions,Transitions,Submissions,Principles,Systems,Learning} -name "*.json" | grep -v TEMPLATE | shuf > "$TEMP_FILELIST"
else
    find content/{Positions,Transitions,Submissions,Principles,Systems,Learning} -name "*.json" | grep -v TEMPLATE |
        python3 -c 'import random, sys; lines = sys.stdin.readlines(); random.shuffle(lines); sys.stdout.writelines(lines)' > "$TEMP_FILELIST"
fi

# Validate all files
current=0
failed=0

while IFS= read -r file; do
    current=$((current + 1))

    # Validate file (suppress output)
    status="✓"
    if ! python3 scripts/validate_json.py --file "$file" >/dev/null 2>&1; then
        echo "$file" >> "$OUTPUT_FAILED"
        failed=$((failed + 1))
        status="✗"
    else
        echo "$file" >> "$OUTPUT_PASSED"
    fi

    # Calculate percentages
    tested_pct=$((current * 100 / total))
    succeeded=$((current - failed))
    succeeded_pct=$((current > 0 ? succeeded * 100 / current : 0))
    failed_pct=$((current > 0 ? failed * 100 / current : 0))

    # Show progress (overwrite same line)
    printf "\rtested: [%d/%d %2d%%]  succeeded: [%d/%d %2d%%]  failed: [%d/%d %2d%%]   - Current: %s %-50s" \
        $current $total $tested_pct \
        $succeeded $current $succeeded_pct \
        $failed $current $failed_pct \
        "$status" "$(basename "$file")"
done < "$TEMP_FILELIST"

# Clean up temp file list
rm "$TEMP_FILELIST"

# Re-sort output files by name in natural/numeric order ("50" before "100"),
# so the written lists are stable and readable despite the shuffled run order.
sort -V -o "$OUTPUT_FAILED" "$OUTPUT_FAILED"
sort -V -o "$OUTPUT_PASSED" "$OUTPUT_PASSED"

echo ""
echo ""

echo "========================================"
echo "Validation complete!"
echo "========================================"
echo "Total files: $total"
echo "Passed: $((total - failed))"
echo "Failed: $failed"
echo ""
echo "Failed files saved to: $OUTPUT_FAILED"
echo "Passed files saved to: $OUTPUT_PASSED"
