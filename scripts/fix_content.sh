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

echo "========================================"
echo "Processing: $file_name"
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
    template_file="source/templates/Positions/TEMPLATE-POSITION-FAMILY.json"
    file_category="Positions"
    ref_summarizer_guidance="This Position file will need references for these JSON fields:
- offensive_transitions[].target_position (6-15 Position names - positions you can attack/transition to)
- defensive_responses[].target_position (4-10 Position names - positions opponent escapes to)
- related_content[] (5-12 any type - conceptually related content)
- metadata.parent_variant (if child variant)
- metadata.sibling_variants (if child variant)
- metadata.child_variants (if parent position)

CRITICAL VARIANT LINKING:
- If this filename contains 'Top' or 'Bottom' (child variant), PRIORITIZE in top 10:
  1. Parent position (e.g., for 'Mount Top', include 'Mount')
  2. Sibling variants (e.g., for 'Mount Top', include 'Mount Bottom')
- If this is a base position with known variants (Mount, Side Control, Back Control, Turtle, North-South, Kesa Gatame, Knee on Belly), PRIORITIZE all child variants in top 10

Therefore, return: Position files (35-40 including variants), Transition files (5-10), Submission files (5)."
    ref_filler_guidance="- offensive_transitions[].target_position → Use Position names (6-15 most relevant). ALWAYS use specific child variants when available (e.g., 'Mount Top' not 'Mount', 'Side Control Bottom' not 'Side Control')
- defensive_responses[].target_position → Use Position names (4-10 most relevant). ALWAYS use specific child variants when available
- related_content[] → Use any content type (5-12 most relevant)

VARIANT FIELD LOGIC (check filename to determine):
- If filename ends with 'Top.json' or 'Bottom.json' (this is a CHILD variant):
  • Set parent_variant: base position name (e.g., 'Mount Top.json' → parent_variant: 'Mount')
  • Set sibling_variants: array of other children (e.g., 'Mount Top.json' → sibling_variants: ['Mount Bottom'])

- If this is a base position WITH variants (Mount, Side Control, Back Control, etc.):
  • Set child_variants: array of all children (e.g., 'Mount.json' → child_variants: ['Mount Top', 'Mount Bottom'])

- If neither applies: omit all variant fields"

elif [[ "$file_url" == *"/Submissions/"* ]]; then
    template_file="source/templates/Submissions.json"
    file_category="Submissions"
    ref_summarizer_guidance="This Submission file will need references for these JSON fields:
- from_positions[] (4-10 Position names - positions where this submission can be applied)
- related_submissions[] (6-15 Submission names - chained or similar submissions)
- related_content[] (5-12 any type - conceptually related content)

Therefore, return: Position files (25-30), Submission files (15-20), Transition/Concept files (5)."
    ref_filler_guidance="- from_positions[] → Use Position names (select 4-10 most relevant)
- related_submissions[] → Use Submission names (select 6-15 most relevant)
- related_content[] → Use any content type (select 5-12 most relevant)"

elif [[ "$file_url" == *"/Transitions/"* ]]; then
    template_file="source/templates/Transitions.json"
    file_category="Transitions"
    ref_summarizer_guidance="This Transition file will need references for these JSON fields:
- from_state (ONE Position name - the starting position)
- to_state (ONE Position name - the ending position)
- related_techniques[] (6-15 Transition/Submission names - variations or follow-up techniques)

Therefore, return: Position files (30-35), Transition files (10-15), Submission files (5-10)."
    ref_filler_guidance="- from_state → Use ONE Position name (the starting position)
- to_state → Use ONE Position name (the ending position)
- related_techniques[] → Use Transition/Submission names (select 6-15 most relevant)"

elif [[ "$file_url" == *"/Systems/"* ]]; then
    template_file="source/templates/Systems.json"
    file_category="Systems"
    ref_summarizer_guidance="This System file will need references for these JSON fields:
- related_positions[] (8-20 Position names - key positions in this system)
- related_transitions[] (8-20 Transition names - techniques used in this system)
- related_concepts[] (8-20 Concept names - underlying principles)

Therefore, return: Position files (20), Transition files (15), Concept files (15)."
    ref_filler_guidance="- related_positions[] → Use Position names (select 8-20 most relevant)
- related_transitions[] → Use Transition names (select 8-20 most relevant)
- related_concepts[] → Use Concept names (select 8-20 most relevant)"

elif [[ "$file_url" == *"/Principles/"* ]]; then
    template_file="source/templates/Principles.json"
    file_category="Concepts"
    ref_summarizer_guidance="This Concept file will need references for these JSON fields:
- concept_relationships[] (6-15 Concept names - related or dependent principles)
- application_contexts[] (8-20 Position names - positions where this concept applies)
- related_content[] (5-12 any type - conceptually related content)

Therefore, return: Concept files (30-35), Position files (15-20), Transition/Submission files (5)."
    ref_filler_guidance="- concept_relationships[] → Use Concept names (select 6-15 most relevant)
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
positions_list=$(find source/content/Positions -type f -name "*.json" | grep -v "TEMPLATE.json" | sed 's|source/content/Positions/||; s|\.json$||' | sort)
transitions_list=$(find source/content/Transitions -type f -name "*.json" | grep -v "TEMPLATE.json" | sed 's|source/content/Transitions/||; s|\.json$||' | sort)
submissions_list=$(find source/content/Submissions -type f -name "*.json" | grep -v "TEMPLATE.json" | sed 's|source/content/Submissions/||; s|\.json$||' | sort)
concepts_list=$(find source/content/Principles -type f -name "*.json" | grep -v "TEMPLATE.json" | sed 's|source/content/Principles/||; s|\.json$||' | sort)
systems_list=$(find source/content/Systems -type f -name "*.json" | grep -v "TEMPLATE.json" | sed 's|source/content/Systems/||; s|\.json$||' | sort)

echo "  Positions: $(echo "$positions_list" | wc -l | xargs) files"
echo "  Transitions: $(echo "$transitions_list" | wc -l | xargs) files"
echo "  Submissions: $(echo "$submissions_list" | wc -l | xargs) files"
echo "  Concepts: $(echo "$concepts_list" | wc -l | xargs) files"
echo "  Systems: $(echo "$systems_list" | wc -l | xargs) files"

# Get top references if we have TODOs OR validation errors (for fixing links)
needs_references=false
if [ "$has_todos" = true ] || [[ "$validation_output" == *"Broken link"* ]] || [[ "$validation_output" != *"Valid"* ]]; then
    needs_references=true
fi

if [ "$needs_references" = true ]; then
    # Step 5: Build all references combined for summarizer
    echo "[5/7] Building combined reference list for summarizer..."
    all_references=$(find source/content/{Positions,Submissions,Transitions,Systems,Concepts} -type f -name "*.json" | \
        grep -v "TEMPLATE.json" | \
        grep -v "$file_url" | \
        sed 's|source/content/||; s|\.json$||' | \
        sort -u)

    # Step 6: Get top references from Claude
    echo "[6/7] Getting contextually relevant references from Claude..."
    reference_files_summarizer_prompt="You are an expert Brazilian Jiu-Jitsu black belt instructor trained extensively by John Danaher, Gordon Ryan, and Eddie Bravo.

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

Output ONLY the list of references (no markdown, no explanations, just the list):"

    echo "$reference_files_summarizer_prompt" | claude --model claude-sonnet-4-5-20250929 | tee /tmp/claude_refs_$$.txt
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

filler_prompt="You are an expert Brazilian Jiu-Jitsu black belt instructor trained extensively by John Danaher, Gordon Ryan, and Eddie Bravo.

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

Concepts ($(echo "$concepts_list" | wc -l | xargs) available):
\`\`\`
${concepts_list}
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

EXPERT GUIDELINES:
1. John Danaher Perspective: Emphasize systematic technical precision, biomechanical analysis, and theoretical frameworks
2. Gordon Ryan Perspective: Focus on high-percentage techniques, competition-proven methods, and winning strategies
3. Eddie Bravo Perspective: Include innovative variations, 10th Planet methodology, and creative applications

REQUIREMENTS:
- Return ONLY valid JSON (no markdown, no explanations)
- Fix ALL validation errors listed above
- Fill all TODO values with realistic, expert-level content
- Fix all broken references using ONLY names from the valid reference lists above
- For Position references: ALWAYS use specific child variant names when available (e.g., 'Mount Top' not 'Mount')
- CRITICALLY IMPORTANT: Match the TEMPLATE structure EXACTLY - use the same field names, same nesting structure, same required fields
- DO NOT add fields that aren't in the template
- DO NOT remove fields that are in the template
- Ensure all success rates follow proper ordering: Beginner ≤ Intermediate ≤ Advanced
- Include proper expert insights that reflect each expert's unique perspective
- Safety sections must be comprehensive (especially for submissions)
- All content must be technically accurate and reflect BJJ best practices
- All content should use language which is clear and instructive for practitioners at all levels
- The output JSON must pass validation against the schema defined in the template

Output the completed JSON file (in entirety, matching template structure, with all errors fixed):"

echo "$filler_prompt" | claude --model claude-sonnet-4-5-20250929 | tee /tmp/claude_output_$$.txt
filled_content=$(<"/tmp/claude_output_$$.txt")

# Strip markdown code blocks if present (extract content between ```json and ```)
if echo "$filled_content" | grep -q '```'; then
    filled_content=$(echo "$filled_content" | sed -n '/```json/,/```/p' | sed '1d;$d')
fi

# Write filled content to file
echo "$filled_content" > "$file_url"
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

    correction_prompt="The following JSON file failed validation with the errors listed below.

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
Concepts: ${concepts_list}
Systems: ${systems_list}

CRITICAL INSTRUCTIONS:
1. Fix ALL validation errors listed above
2. Fix all broken references using ONLY names from the valid reference lists above
3. Match the template structure EXACTLY - same field names, same nesting
4. DO NOT add fields not in the template
5. DO NOT remove required fields from the template
6. Ensure expert_insights uses keys: danaher, gordon_ryan, eddie_bravo (not 'expert' array)
7. Return ONLY valid JSON (no markdown, no explanations)

Output the corrected JSON file:"

    echo "$correction_prompt" | claude --model claude-sonnet-4-5-20250929 | tee /tmp/claude_correction_${attempt}_$$.txt
    filled_content=$(<"/tmp/claude_correction_${attempt}_$$.txt")

    # Strip markdown code blocks if present (extract content between ```json and ```)
    if echo "$filled_content" | grep -q '```'; then
        filled_content=$(echo "$filled_content" | sed -n '/```json/,/```/p' | sed '1d;$d')
    fi
    echo "$filled_content" > "$file_url"

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
