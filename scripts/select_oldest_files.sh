#!/bin/bash

# Script to select N random files from the 100 oldest content files
# This ensures we prioritize improving content that hasn't been updated recently
# Usage: ./select_oldest_files.sh [number_of_files]
# Default: 10 files

set -e

# Get number of files to select (default: 10)
NUM_FILES=${1:-10}

# Change to the project root directory
cd "$(dirname "$0")/.."

# Define content directory
CONTENT_DIR="source/content"

# Check if content directory exists
if [ ! -d "$CONTENT_DIR" ]; then
    echo "Error: Content directory not found at $CONTENT_DIR"
    exit 1
fi

# Find all .md files, sort by modification time (oldest first), take top 100
# Exclude CONTRIBUTING-*.md files and index.md
echo "Finding 100 oldest content files..." >&2

# Use portable stat command that works on both Linux (GNU) and macOS (BSD)
# Linux uses -c, BSD uses -f
if stat -c "%Y" /dev/null >/dev/null 2>&1; then
    # GNU stat (Linux) - use null-terminated output for filenames with spaces
    OLDEST_100=$(find "$CONTENT_DIR" -name "*.md" \
        ! -name "CONTRIBUTING-*.md" \
        ! -name "index.md" \
        ! -name "000.STANDARD.md" \
        -type f -print0 | \
        xargs -0 stat -c "%Y %n" 2>/dev/null | \
        sort -n | \
        head -n 100 | \
        cut -d' ' -f2-)
else
    # BSD stat (macOS)
    OLDEST_100=$(find "$CONTENT_DIR" -name "*.md" \
        ! -name "CONTRIBUTING-*.md" \
        ! -name "index.md" \
        ! -name "000.STANDARD.md" \
        -type f -print0 | \
        xargs -0 stat -f "%m %N" 2>/dev/null | \
        sort -n | \
        head -n 100 | \
        cut -d' ' -f2-)
fi

# Check if we found any files
if [ -z "$OLDEST_100" ]; then
    echo "Error: No content files found"
    exit 1
fi

FILE_COUNT=$(echo "$OLDEST_100" | wc -l | tr -d ' ')
echo "Found $FILE_COUNT oldest files" >&2

# Randomly select N files from the oldest 100
echo "Selecting $NUM_FILES random files..." >&2
# Use awk for portable random selection (works on macOS and Linux)
SELECTED_FILES=$(echo "$OLDEST_100" | awk 'BEGIN{srand()} {print rand() "\t" $0}' | sort -n | cut -f2- | head -n "$NUM_FILES")

# Output selected files (one per line) for use in GitHub Actions
echo "$SELECTED_FILES"

# Also output a summary to stderr for logging
echo "" >&2
echo "Selected files for improvement:" >&2
echo "$SELECTED_FILES" | sed 's|^|  - |' >&2
echo "" >&2
