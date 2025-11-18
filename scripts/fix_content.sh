#!/bin/bash

################################################################################
# Fill TODOs in a single BJJ Graph JSON file using Claude CLI
#
# Usage: ./scripts/fill_todos_parallel.sh <file_path>
#
# Example: ./scripts/fill_todos_parallel.sh "source/content/Principles/Spider Guard to Omoplata.json"
################################################################################

set -e

file_url="$1"

if [ -z "$file_url" ]; then
    echo "ERROR: No file path provided"
    echo "Usage: $0 <file_path>"
    exit 1
fi

if [ ! -f "$file_url" ]; then
    echo "ERROR: File not found: $file_url"
    exit 1
fi

# Extract filename
file_name=$(basename "$file_url")
filename_without_ext=$(basename "$file_url" .json)

echo "========================================"
echo "Processing: $file_name"
echo "File name (for name): $filename_without_ext"
echo "========================================"

# Step 1: Validate current state
echo "[1/7] Validating current state..."
validation_output=$(python3 scripts/validate_json.py --file "$file_url" 2>&1 || echo "INVALID")

# Check if already valid
if [[ "$validation_output" == *"Valid"* ]]; then
    echo "✓ File is already valid! No fixes needed."
    exit 0
fi

# Display validation errors
echo ""
echo "Validation errors found:"
echo "---"
echo "$validation_output"
echo "---"
echo ""

# Check if file contains TODOs
has_todos=false
if grep -q "TODO" "$file_url"; then
    has_todos=true
    echo "  File contains TODOs - will fill them"
else
    echo "  File contains no TODOs - will only validate/correct if needed"
fi

# Step 2: Determine template and category based on file path
echo "[2/7] Determining template and category..."
if [[ "$file_url" == *"/Positions/"* ]]; then
    file_category="Positions"

    # Detect Position template type programmatically via filesystem
    file_dir=$(dirname "$file_url")
    position_name=$(basename "$file_url" .json)
    variant_folder="$file_dir/$position_name"

    if [ ! -d "$variant_folder" ]; then
        # No folder = SINGLE
        position_template_type="SINGLE"
        template_file="source/templates/Positions/TEMPLATE-POSITION-SINGLE.json"
    elif ls "$variant_folder"/*.json >/dev/null 2>&1; then
        # Folder with .json files = FAMILY (has variant JSONs)
        position_template_type="FAMILY"
        template_file="source/templates/Positions/TEMPLATE-POSITION-FAMILY.json"
    else
        # Folder without .json files = DUAL (just .md files)
        position_template_type="DUAL"
        template_file="source/templates/Positions/TEMPLATE-POSITION-DUAL.json"
    fi

    echo "  Position template type: $position_template_type"
    ref_summarizer_guidance="This Position file will need references for these JSON fields:
- offensive_transitions[].target_position (6-15 Position names)
- defensive_responses[].target_position (4-10 Position names)
- related_content[] (5-12 any type)

For FAMILY positions ($position_template_type = FAMILY):
- variations[] (array of variant names matching .json files in subfolder)
  • Just the names - descriptions/slugs are in the variant files

Therefore, return: Position files (35-40), Transition files (5-10), Submission files (5)."
    ref_filler_guidance="DETECTED TEMPLATE TYPE: $position_template_type

REQUIRED NAME FIELDS:
- Set name = '$filename_without_ext' (MUST MATCH FILENAME EXACTLY)
- If $position_template_type = DUAL or FAMILY:
  • Set bottom.name = '$filename_without_ext Bottom'
  • Set top.name = '$filename_without_ext Top'
- DO NOT include 'title' field (auto-generated from name in jinja)

VARIANT UNIQUENESS (required, 50 char max):
- Add variant_uniqueness field at root level
- Explain WHY this position's risk/energy differs strategically
- Example: 'Higher positioning trades stability for submission proximity'
- NOT just technical description, but strategic trade-off

REFERENCES:
- offensive_transitions[].target_position → Use Position names (6-15 most relevant)
- defensive_responses[].target_position → Use Position names (4-10 most relevant)
- related_content[] → Use any content type (5-12 most relevant)
- ALWAYS use specific child variants when available (e.g., 'Mount Top' not 'Mount')"

elif [[ "$file_url" == *"/Submissions/"* ]]; then
    template_file="source/templates/Submissions.json"
    file_category="Submissions"
    ref_summarizer_guidance="This Submission file will need references for these JSON fields:
- from_positions[] (2-10 Position names - positions where this submission can be applied)
- related_submissions[] (3-15 Submission names - chained or similar submissions)
- related_content[] (3-12 any type - conceptually related content)

Therefore, return: Position files (25-30), Submission files (15-20), Transition/Principle files (5)."
    ref_filler_guidance="REQUIRED NAME FIELD:
- Set name = '$filename_without_ext' (MUST MATCH FILENAME EXACTLY)
- DO NOT include 'title' field (auto-generated from name)

REFERENCES (ALL REQUIRED for good SEO):
- from_positions[] → Array of Position name strings (2-10 positions where you can apply this submission)
- related_submissions[] → Array of Submission name strings (3-15 submissions that chain or relate)
- related_content[] → Array of objects with name/relationship (3-12 items, any type)"

elif [[ "$file_url" == *"/Transitions/"* ]]; then
    template_file="source/templates/Transitions.json"
    file_category="Transitions"
    ref_summarizer_guidance="This Transition file will need references for these JSON fields:
- from_state (ONE Position name - the starting position)
- to_state (ONE Position name - the ending position)
- related_techniques[] (6-15 Transition/Submission names - variations or follow-up techniques)

Therefore, return: Position files (30-35), Transition files (10-15), Submission files (5-10)."
    ref_filler_guidance="REQUIRED NAME FIELD:
- Set name = '$filename_without_ext' (MUST MATCH FILENAME EXACTLY)
- DO NOT include 'title' field (auto-generated from name)

REFERENCES:
- from_state → Use ONE Position name (the starting position)
- to_state → Use ONE Position name (the ending position)
- related_techniques[] → Use Transition/Submission names (select 6-15 most relevant)"

elif [[ "$file_url" == *"/Systems/"* ]]; then
    template_file="source/templates/Systems.json"
    file_category="Systems"
    ref_summarizer_guidance="This System file will need references for these JSON fields:
- related_content[] (10-30 items - mix of Positions, Transitions, Principles, other Systems)

Therefore, return: Position files (15), Transition files (10), Principle files (10), System files (5)."
    ref_filler_guidance="REQUIRED NAME FIELD:
- Set name = '$filename_without_ext' (MUST MATCH FILENAME EXACTLY)
- DO NOT include 'title' field (auto-generated from name)

REFERENCES (REQUIRED for good SEO - 10-30 items total):
- related_content[] → Array of objects with name/content_type/relationship
  • Mix of Positions (40%), Transitions (30%), Principles (20%), Systems (10%)
  • content_type must be: 'Position', 'Transition', 'Submission', 'Principle', or 'System'
  • Each relationship should explain how it connects to this system"

elif [[ "$file_url" == *"/Principles/"* ]]; then
    template_file="source/templates/Principles.json"
    file_category="Principles"
    ref_summarizer_guidance="This Principle file will need references for these JSON fields:
- principle_relationships[] (6-15 Principle names - related or dependent principles)
- application_contexts[] (8-20 Position names - positions where this principle applies)
- related_content[] (5-12 any type - principleually related content)

Therefore, return: Principle files (30-35), Position files (15-20), Transition/Submission files (5)."
    ref_filler_guidance="REQUIRED NAME FIELD:
- Set name = '$filename_without_ext' (MUST MATCH FILENAME EXACTLY)
- DO NOT include 'title' field (auto-generated from name)

REFERENCES:
- principle_relationships[] → Use Principle names (select 6-15 most relevant)
- application_contexts[] → Use Position names (select 8-20 most relevant)
- related_content[] → Use any content type (select 5-12 most relevant)"

else
    echo "ERROR: Unknown file type for: $file_url"
    exit 1
fi

if [ ! -f "$template_file" ]; then
    echo "ERROR: Template not found: $template_file"
    exit 1
fi

echo "  Category: $file_category"
echo "  Template: $template_file"

# Step 3: Read file contents
echo "[3/7] Reading file contents..."
file_content=$(<"$file_url")
template_content=$(<"$template_file")

# Step 4: Build complete valid reference lists per category
echo "[4/7] Building valid reference lists..."
# For nested files, show only the base filename (not the full path)
# Example: "Ashi Garami/Inside Ashi-Garami" becomes just "Inside Ashi-Garami"
positions_list=$(find source/content/Positions -type f -name "*.json" | grep -v "TEMPLATE.json" | while read f; do basename "$f" .json; done | sort -u)
transitions_list=$(find source/content/Transitions -type f -name "*.json" | grep -v "TEMPLATE.json" | while read f; do basename "$f" .json; done | sort -u)
submissions_list=$(find source/content/Submissions -type f -name "*.json" | grep -v "TEMPLATE.json" | while read f; do basename "$f" .json; done | sort -u)
principles_list=$(find source/content/Principles -type f -name "*.json" | grep -v "TEMPLATE.json" | while read f; do basename "$f" .json; done | sort -u)
systems_list=$(find source/content/Systems -type f -name "*.json" | grep -v "TEMPLATE.json" | while read f; do basename "$f" .json; done | sort -u)

echo "  Positions: $(echo "$positions_list" | wc -l | xargs) files"
echo "  Transitions: $(echo "$transitions_list" | wc -l | xargs) files"
echo "  Submissions: $(echo "$submissions_list" | wc -l | xargs) files"
echo "  Principles: $(echo "$principles_list" | wc -l | xargs) files"
echo "  Systems: $(echo "$systems_list" | wc -l | xargs) files"

# Get top references if we have TODOs OR validation errors (for fixing links)
needs_references=false
if [ "$has_todos" = true ] || [[ "$validation_output" == *"Broken link"* ]] || [[ "$validation_output" != *"Valid"* ]]; then
    needs_references=true
fi

if [ "$needs_references" = true ]; then
    # Step 5: Build all references combined for summarizer
    echo "[5/7] Building combined reference list for summarizer..."
    all_references=$(find source/content/{Positions,Submissions,Transitions,Systems,Principles} -type f -name "*.json" | \
        grep -v "TEMPLATE.json" | \
        grep -v "$file_url" | \
        sed 's|source/content/||; s|\.json$||' | \
        sort -u)

    # Step 6: Get top references from Claude
    echo "[6/7] Getting contextually relevant references from Claude..."
    reference_files_summarizer_prompt=$(cat <<EOF
You are an expert Brazilian Jiu-Jitsu black belt instructor trained extensively by John Danaher, Gordon Ryan, and Eddie Bravo.

Your task is to extract and summarize among the following list the most relevant references when writing content about ${file_name}.

CATEGORY-SPECIFIC GUIDANCE:
${ref_summarizer_guidance}

List the top 50 most important reference files using category/file_name format, weighted appropriately for this category. Example output:
\`\`\`
Positions/Closed Guard
Submissions/Armbar From Guard
Transitions/Guard Pass To Mount
Systems/No Gi Leg Locks
Principles/Positional Hierarchy
\`\`\`

Available references:
\`\`\`
${all_references}
\`\`\`

Output ONLY the list of references (no markdown, no explanations, just the list):
EOF
)

    echo "$reference_files_summarizer_prompt" | claude --model claude-sonnet-4-5-20250929 --output-format json | jq -r '.result' | tee /tmp/claude_refs_$$.txt
    top_references=$(<"/tmp/claude_refs_$$.txt")

    # Strip markdown code blocks if present (extract content between ``` markers)
    if echo "$top_references" | grep -q '```'; then
        top_references=$(echo "$top_references" | sed -n '/```/,/```/p' | sed '1d;$d')
    fi

    echo ""
    echo "  Top references identified: $(echo "$top_references" | wc -l | xargs) files"
else
    echo "[5/7] Skipping reference summarizer (no TODOs to fill)"
    echo "[6/7] Will proceed directly to validation/correction"
    top_references=""
fi

# Step 7: Fill TODOs and fix validation errors with Claude
if [ "$has_todos" = true ]; then
    echo "[7/7] Filling TODOs with expert content..."
    task_description="fill in the TODO placeholders AND fix any validation errors"
else
    echo "[7/7] Fixing validation errors..."
    task_description="fix all validation errors"
fi

filler_prompt=$(cat <<EOF
You are an expert Brazilian Jiu-Jitsu black belt instructor trained extensively by John Danaher, Gordon Ryan, and Eddie Bravo.

Your task is to ${task_description} in the following JSON file with comprehensive, expert-level content that matches the template structure.

CURRENT VALIDATION ERRORS (fix all of these):
\`\`\`
${validation_output}
\`\`\`

TEMPLATE STRUCTURE (follow this format exactly):
\`\`\`json
${template_content}
\`\`\`

FILE TO COMPLETE (fix TODOs and validation errors):
\`\`\`json
${file_content}
\`\`\`

VALID REFERENCES BY CATEGORY (only use names from these lists):

Positions ($(echo "$positions_list" | wc -l | xargs) available):
\`\`\`
${positions_list}
\`\`\`

Transitions ($(echo "$transitions_list" | wc -l | xargs) available):
\`\`\`
${transitions_list}
\`\`\`

Submissions ($(echo "$submissions_list" | wc -l | xargs) available):
\`\`\`
${submissions_list}
\`\`\`

Principles ($(echo "$principles_list" | wc -l | xargs) available):
\`\`\`
${principles_list}
\`\`\`

Systems ($(echo "$systems_list" | wc -l | xargs) available):
\`\`\`
${systems_list}
\`\`\`

MOST CONTEXTUALLY RELEVANT FOR THIS FILE:
\`\`\`
${top_references}
\`\`\`

REFERENCE FIELD GUIDANCE:
${ref_filler_guidance}

CRITICAL: All references MUST exist in the lists above. Do not invent or guess file names.

REFERENCE FORMAT (CRITICAL - Hub-and-Spoke Architecture):
- Use ONLY the base filename (no paths, no extensions): 'Inside Ashi-Garami', 'Deep Half Guard'
- NEVER use Category/Name format: 'Positions/Inside Ashi-Garami' ❌
- NEVER use folder paths with slashes ❌
- NEVER use parent folder prefixes ❌
- For nested files in subfolders, use ONLY the final filename part
- The validator resolves categories and nested paths automatically
- Wikilinks are flat: [[Inside Ashi-Garami]] not nested paths

EXAMPLES:
✓ CORRECT: {"name": "Inside Ashi-Garami", "content_type": "Position"}
✓ CORRECT: {"name": "Deep Half Guard", "content_type": "Position"}
✓ CORRECT: {"name": "Honey Hole", "content_type": "Position"}
✗ WRONG: {"name": "Ashi Garami/Inside Ashi-Garami", "content_type": "Position"}
✗ WRONG: {"name": "Half Guard/Deep Half Guard", "content_type": "Position"}
✗ WRONG: {"name": "Positions/Ashi Garami/Honey Hole", "content_type": "Position"}

EXPERT GUIDELINES:
1. John Danaher Perspective: Emphasize systematic technical precision, biomechanical analysis, and theoretical frameworks
2. Gordon Ryan Perspective: Focus on high-percentage techniques, competition-proven methods, and winning strategies
3. Eddie Bravo Perspective: Include innovative variations, 10th Planet methodology, and creative applications

CRITICAL DESCRIPTION RULES:
- Write descriptions in your own expert voice
- DO NOT mention "Expert insights from Danaher, Ryan, and Bravo" or similar phrases
- DO NOT reference specific instructors in the description field
- Focus on the technique/position itself, not who teaches it
- Keep descriptions concise and focused on what users will learn

REQUIREMENTS:
- Return ONLY valid JSON (no markdown, no explanations)
- Fix ALL validation errors listed above
- Fill all TODO values with realistic, expert-level content
- Fix all broken references using ONLY flat names from the valid reference lists above
- For Position references: ALWAYS use specific child variant names when available (e.g., 'Mount Top' not 'Mount')
- Match the TEMPLATE structure exactly
- All content must be technically accurate and reflect BJJ best practices
- Safety sections must be comprehensive (especially for submissions)

Output the completed JSON file (in entirety, matching template structure, with all errors fixed):
EOF
)

echo "$filler_prompt" | claude --model claude-sonnet-4-5-20250929 --output-format json | jq -r '.result' | tee /tmp/claude_output_$$.txt
filled_content=$(<"/tmp/claude_output_$$.txt")

# Strip markdown code blocks if present (extract content between ```json and ```)
if echo "$filled_content" | grep -q '```'; then
    filled_content=$(echo "$filled_content" | sed -n '/```json/,/```/p' | sed '1d;$d')
fi

# Verify output is valid JSON before writing
if ! echo "$filled_content" | python3 -m json.tool > /dev/null 2>&1; then
    echo "ERROR: Claude did not return valid JSON"
    echo "Output preview: $(echo "$filled_content" | head -c 200)..."
    exit 1
fi

# Write to temp file first, then atomic move
temp_file="${file_url}.tmp"
echo "$filled_content" > "$temp_file"
mv "$temp_file" "$file_url"
echo ""

# Validate filled content
echo ""
echo "Validating content..."
validation_output=$(python3 scripts/validate_json.py --file "$file_url" 2>&1 || echo "INVALID")

if [[ "$validation_output" == *"Valid"* ]]; then
    # Check for remaining TODOs
    if grep -q "TODO" "$file_url"; then
        echo "✗ File still contains TODOs. Manual review needed."
        exit 1
    else
        echo "✓ File is valid and contains no TODOs. Process complete!"
        exit 0
    fi
fi

# If we get here, validation failed - try up to 2 correction rounds
for attempt in 1 2; do
    echo ""
    echo "⚠ Validation failed (attempt $attempt/2). Attempting correction..."
    echo "Validation errors:"
    echo "$validation_output"
    echo ""

    correction_prompt=$(cat <<EOF
The following JSON file failed validation with the errors listed below.

VALIDATION ERRORS:
${validation_output}

CURRENT FILE CONTENT:
\`\`\`json
${filled_content}
\`\`\`

TEMPLATE STRUCTURE (you MUST match this exactly):
\`\`\`json
${template_content}
\`\`\`

VALID REFERENCES BY CATEGORY (only use names from these lists):

Positions: ${positions_list}
Transitions: ${transitions_list}
Submissions: ${submissions_list}
Principles: ${principles_list}
Systems: ${systems_list}

CRITICAL INSTRUCTIONS:
1. Fix ALL validation errors listed above
2. Fix all broken references using ONLY base filenames from the valid reference lists above
3. For nested files in subfolders, use ONLY the final filename part (no slashes)
4. NEVER use folder paths in reference names (no slashes allowed)
5. Match the template structure exactly
6. Return ONLY valid JSON (no markdown, no explanations)

REFERENCE FORMAT EXAMPLES:
✓ CORRECT: "Inside Ashi-Garami" (for nested variant file)
✓ CORRECT: "Deep Half Guard" (for nested variant file)
✗ WRONG: Any reference containing a slash character

Output the corrected JSON file:
EOF
)

    echo "$correction_prompt" | claude --model claude-sonnet-4-5-20250929 --output-format json | jq -r '.result' | tee /tmp/claude_correction_${attempt}_$$.txt
    filled_content=$(<"/tmp/claude_correction_${attempt}_$$.txt")

    # Strip markdown code blocks if present (extract content between ```json and ```)
    if echo "$filled_content" | grep -q '```'; then
        filled_content=$(echo "$filled_content" | sed -n '/```json/,/```/p' | sed '1d;$d')
    fi

    # Verify output is valid JSON before writing
    if ! echo "$filled_content" | python3 -m json.tool > /dev/null 2>&1; then
        echo "ERROR: Claude correction attempt $attempt did not return valid JSON"
        echo "Output preview: $(echo "$filled_content" | head -c 200)..."
        continue  # Try next attempt
    fi

    # Write to temp file first, then atomic move
    temp_file="${file_url}.tmp"
    echo "$filled_content" > "$temp_file"
    mv "$temp_file" "$file_url"

    # Validate again
    validation_output=$(python3 scripts/validate_json.py --file "$file_url" 2>&1 || echo "INVALID")

    if [[ "$validation_output" == *"Valid"* ]]; then
        if grep -q "TODO" "$file_url"; then
            echo "✗ File is valid but still contains TODOs. Manual review needed."
            exit 1
        else
            echo ""
            echo "✓ File is valid after correction (attempt $attempt). Process complete!"
            exit 0
        fi
    fi
done

# All attempts failed
echo ""
echo "✗ File could not be validated after 2 correction attempts. Manual review needed."
echo "Final validation errors:"
echo "$validation_output"
exit 1
