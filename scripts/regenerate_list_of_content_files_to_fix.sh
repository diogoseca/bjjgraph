#!/bin/bash

################################################################################
# Generate list of files that need fixing
#
# Validates all JSON files and outputs:
# - Failed files to: todo/all_content_files_to_fix.txt
# - Passed files to: todo/all_content_validated_and_ready_to_hook.txt
#
# Usage: ./scripts/regenerate_list_of_content_files_to_fix.sh
################################################################################

set -e

OUTPUT_FAILED="todo/all_content_files_to_fix.txt"
OUTPUT_PASSED="todo/all_content_validated_and_ready_to_hook.txt"

echo "Counting files..."
# Count total files first
total=$(find source/content/{Positions,Transitions,Submissions,Concepts,Systems} -name "*.json" | grep -v TEMPLATE | wc -l | xargs)
echo "Found $total files to validate"
echo ""

# Clear output files
> "$OUTPUT_FAILED"
> "$OUTPUT_PASSED"

echo "Validating..."
echo ""

# Build file list first
TEMP_FILELIST="/tmp/filelist_$$.txt"
find source/content/{Positions,Transitions,Submissions,Concepts,Systems} -name "*.json" | grep -v TEMPLATE | sort > "$TEMP_FILELIST"

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
