#!/usr/bin/env python3
"""
Enhanced Script to add HowTo Schema markup to Transition pages (v2).
Handles multiple step formats and creates schema from various content structures.
More flexible than v1 - can extract steps from multiple formats.
"""

import os
import re
import json
from pathlib import Path
from typing import List, Dict, Optional

def extract_steps_from_numbered_sequence(content: str) -> List[Dict]:
    """Extract steps from 'Execution Steps (Numbered Sequence)' section."""
    steps = []

    # Try to find the section with various patterns
    patterns = [
        r'### Execution Steps \(Numbered Sequence\)(.*?)(?=###|##|$)',
        r'## Execution Steps \(Numbered Sequence\)(.*?)(?=###|##|$)',
        r'### Execution Steps(.*?)(?=###|##|$)',
        r'## Execution Steps(.*?)(?=###|##|$)',
    ]

    section_text = None
    for pattern in patterns:
        section_match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
        if section_match:
            section_text = section_match.group(1)
            break

    if not section_text:
        return steps

    # Try multiple formats for step extraction
    # Format 1: "1. **Step Name**: Description"
    step_matches = re.findall(r'(\d+)\.\s*\*\*(.+?)\*\*:\s*(.+?)(?=\n\d+\.|$)', section_text, re.DOTALL)
    if step_matches:
        for num, step_name, step_text in step_matches:
            steps.append({
                "@type": "HowToStep",
                "name": step_name.strip(),
                "text": step_text.strip().replace('\n', ' ')[:300],
                "position": int(num)
            })

    # Format 2: "1. Description without bold name"
    if not steps:
        step_matches = re.findall(r'(\d+)\.\s+(.+?)(?=\n\d+\.|$)', section_text, re.DOTALL)
        if step_matches:
            for num, step_text in step_matches:
                step_text_clean = step_text.strip().replace('\n', ' ')
                # Use first few words as name
                words = step_text_clean.split()[:4]
                step_name = ' '.join(words)
                steps.append({
                    "@type": "HowToStep",
                    "name": step_name,
                    "text": step_text_clean[:300],
                    "position": int(num)
                })

    return steps

def extract_steps_from_visual_sequence(content: str) -> List[Dict]:
    """Extract steps from 'Visual Execution Sequence' section."""
    steps = []

    patterns = [
        r'### Visual Execution Sequence(.*?)(?=\*\*Template\*\*|###|##|$)',
        r'## Visual Execution Sequence(.*?)(?=\*\*Template\*\*|###|##|$)',
    ]

    section_text = None
    for pattern in patterns:
        section_match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
        if section_match:
            section_text = section_match.group(1)
            break

    if not section_text:
        return steps

    # Split into sentences and extract key steps
    # Clean up extra whitespace
    section_text = re.sub(r'\s+', ' ', section_text.strip())

    # Split by periods, but be careful with abbreviations
    sentences = re.split(r'(?<=[.!?])\s+', section_text)

    # Filter sentences that look like instructions (contain action verbs)
    action_verbs = ['establish', 'control', 'shift', 'create', 'execute', 'maintain',
                   'secure', 'apply', 'drive', 'move', 'position', 'wrap', 'pull',
                   'push', 'grab', 'hold', 'place', 'insert', 'lock', 'adjust',
                   'initiate', 'complete', 'follow', 'transition', 'begin', 'start']

    step_num = 1
    for sentence in sentences[:10]:  # Limit to 10 steps
        sentence_clean = sentence.strip()
        if len(sentence_clean) < 20:  # Skip very short sentences
            continue

        # Check if sentence contains action verbs
        sentence_lower = sentence_clean.lower()
        if any(verb in sentence_lower for verb in action_verbs):
            # Extract first few words as step name
            words = sentence_clean.split()[:5]
            step_name = ' '.join(words).rstrip(',')

            steps.append({
                "@type": "HowToStep",
                "name": step_name,
                "text": sentence_clean[:300],
                "position": step_num
            })
            step_num += 1

            if step_num > 8:  # Limit to 8 steps
                break

    return steps

def extract_steps_from_plain_list(content: str) -> List[Dict]:
    """Extract steps from simple numbered list anywhere in document."""
    steps = []

    # Look for "Execution Steps" section with simpler pattern
    patterns = [
        r'## Execution Steps\n(.*?)(?=\n##|\n#|$)',
        r'### Execution Steps\n(.*?)(?=\n###|\n##|$)',
    ]

    section_text = None
    for pattern in patterns:
        section_match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
        if section_match:
            section_text = section_match.group(1)
            break

    if not section_text:
        return steps

    # Extract numbered steps
    step_matches = re.findall(r'(\d+)\.\s+(.+?)(?=\n\d+\.|\n\n|$)', section_text, re.DOTALL)

    for num, step_text in step_matches:
        step_text_clean = step_text.strip().replace('\n', ' ')
        # Extract step name if in bold
        name_match = re.match(r'\*\*(.+?)\*\*[:.]?\s*(.*)', step_text_clean)
        if name_match:
            step_name = name_match.group(1)
            step_desc = name_match.group(2) or step_name
        else:
            # Use first few words as name
            words = step_text_clean.split()[:4]
            step_name = ' '.join(words)
            step_desc = step_text_clean

        steps.append({
            "@type": "HowToStep",
            "name": step_name,
            "text": step_desc[:300],
            "position": int(num)
        })

    return steps

def create_minimal_steps(transition_name: str, states: Dict) -> List[Dict]:
    """Create minimal but valid steps when no clear structure is found."""
    steps = []

    if states['starting'] and states['ending']:
        steps = [
            {
                "@type": "HowToStep",
                "name": "Setup Position",
                "text": f"Begin in {states['starting']} position with proper control and grips established.",
                "position": 1
            },
            {
                "@type": "HowToStep",
                "name": "Execute Technique",
                "text": f"Execute the {transition_name} technique with proper timing and body mechanics.",
                "position": 2
            },
            {
                "@type": "HowToStep",
                "name": "Complete Transition",
                "text": f"Transition to {states['ending']} position and secure control.",
                "position": 3
            }
        ]
    else:
        steps = [
            {
                "@type": "HowToStep",
                "name": "Setup Position",
                "text": f"Begin the {transition_name} from the starting position.",
                "position": 1
            },
            {
                "@type": "HowToStep",
                "name": "Execute Technique",
                "text": f"Execute the {transition_name} technique with proper form and timing.",
                "position": 2
            },
            {
                "@type": "HowToStep",
                "name": "Complete Transition",
                "text": "Complete the technique and establish control.",
                "position": 3
            }
        ]

    return steps

def extract_execution_steps(content: str, transition_name: str, states: Dict) -> List[Dict]:
    """Extract execution steps using multiple methods."""
    steps = []

    # Method 1: Try numbered sequence section
    print("    Trying: Numbered Sequence section...")
    steps = extract_steps_from_numbered_sequence(content)
    if steps:
        print(f"    ✓ Found {len(steps)} steps from Numbered Sequence")
        return steps

    # Method 2: Try visual execution sequence
    print("    Trying: Visual Execution Sequence...")
    steps = extract_steps_from_visual_sequence(content)
    if steps:
        print(f"    ✓ Found {len(steps)} steps from Visual Sequence")
        return steps

    # Method 3: Try plain numbered list
    print("    Trying: Plain numbered list...")
    steps = extract_steps_from_plain_list(content)
    if steps:
        print(f"    ✓ Found {len(steps)} steps from plain list")
        return steps

    # Method 4: Create minimal steps
    print("    ⚠ No steps found, creating minimal schema...")
    steps = create_minimal_steps(transition_name, states)
    print(f"    ✓ Created {len(steps)} minimal steps")

    return steps

def extract_transition_name(content: str) -> Optional[str]:
    """Extract transition name from content."""
    # Try frontmatter first
    title_match = re.search(r'^title:\s*["\'](.+?)\s*\|', content, re.MULTILINE)
    if title_match:
        return title_match.group(1).strip()

    # Fallback to heading
    heading_match = re.search(r'^# (.+)$', content, re.MULTILINE)
    if heading_match:
        name = heading_match.group(1).strip()
        # Remove any tags
        name = re.sub(r'#\w+', '', name).strip()
        return name

    return None

def extract_states(content: str) -> Dict:
    """Extract starting and ending states with multiple patterns."""
    states = {'starting': None, 'ending': None}

    # Try multiple patterns for starting state
    starting_patterns = [
        r'\*\*Starting State\*\*:\s*\[\[([\w\s]+)\]\]',
        r'\*\*Starting Position\*\*:\s*\[\[([\w\s,]+)\]\]',
        r'Starting State:\s*\[\[([\w\s]+)\]\]',
        r'Starting Position:\s*\[\[([\w\s,]+)\]\]',
    ]

    for pattern in starting_patterns:
        starting_match = re.search(pattern, content)
        if starting_match:
            # Handle multiple states (comma-separated)
            starting_states = starting_match.group(1).split(',')
            states['starting'] = starting_states[0].strip()
            break

    # Try multiple patterns for ending state
    ending_patterns = [
        r'\*\*Ending State\*\*:\s*\[\[([\w\s,]+)\]\]',
        r'\*\*Ending Position\*\*:\s*\[\[([\w\s,]+)\]\]',
        r'\*\*Target Position\*\*:\s*\[\[([\w\s,]+)\]\]',
        r'Ending State:\s*\[\[([\w\s,]+)\]\]',
        r'Target Position:\s*\[\[([\w\s,]+)\]\]',
    ]

    for pattern in ending_patterns:
        ending_match = re.search(pattern, content)
        if ending_match:
            endings = ending_match.group(1).split(',')
            states['ending'] = endings[0].strip()
            break

    return states

def extract_success_probability(content: str) -> Optional[Dict]:
    """Extract success probability."""
    patterns = [
        r'\*\*Success Probability\*\*:\s*Beginner\s*\((\d+)%\).*?Intermediate\s*\((\d+)%\).*?Advanced\s*\((\d+)%\)',
        r'\*\*Success Probability\*\*:\s*Beginner\s*(\d+)%.*?Intermediate\s*(\d+)%.*?Advanced\s*(\d+)%',
        r'Success Probability:\s*Beginner\s*\((\d+)%\).*?Intermediate\s*\((\d+)%\).*?Advanced\s*\((\d+)%\)',
    ]

    for pattern in patterns:
        success_match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
        if success_match:
            return {
                'beginner': success_match.group(1),
                'intermediate': success_match.group(2),
                'advanced': success_match.group(3)
            }
    return None

def generate_howto_schema(transition_name: str, steps: List[Dict], states: Dict, probability: Optional[Dict]) -> Dict:
    """Generate HowTo schema JSON-LD."""
    if not steps:
        return None

    description = f"Learn how to execute {transition_name} in Brazilian Jiu-Jitsu"
    if states['starting'] and states['ending']:
        description += f" from {states['starting']} to {states['ending']}"
    if probability:
        description += f". Success: Beginner {probability['beginner']}%, Intermediate {probability['intermediate']}%, Advanced {probability['advanced']}%"
    description += "."

    schema = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": transition_name,
        "description": description,
        "step": steps,
        "tool": ["BJJ Gi or No-Gi attire", "Training partner", "Mat space"]
    }

    # Add estimated time based on complexity
    if len(steps) <= 3:
        schema["totalTime"] = "PT2M"
    elif len(steps) <= 5:
        schema["totalTime"] = "PT3M"
    elif len(steps) <= 7:
        schema["totalTime"] = "PT5M"
    else:
        schema["totalTime"] = "PT7M"

    return schema

def schema_to_html(schema: Dict) -> str:
    """Convert schema dict to HTML script tag."""
    json_str = json.dumps(schema, indent=2, ensure_ascii=False)
    return f'<script type="application/ld+json">\n{json_str}\n</script>'

def add_schema_to_content(content: str, schema: Dict) -> str:
    """Add schema markup to content."""
    schema_html = "\n\n<!-- Schema Markup for SEO -->\n"
    schema_html += schema_to_html(schema) + "\n"

    # Insert schema before first heading (after frontmatter)
    frontmatter_end = content.find('---\n', 4)  # Skip first ---
    if frontmatter_end != -1:
        insert_pos = frontmatter_end + 4
        new_content = content[:insert_pos] + "\n" + schema_html + content[insert_pos:]
    else:
        new_content = schema_html + "\n" + content

    return new_content

def has_schema_markup(content: str) -> bool:
    """Check if file already has HowTo schema markup specifically."""
    # We specifically check for HowTo schema, not just any schema
    # This way we won't skip files that only have WebPage or BreadcrumbList schema
    return '"@type": "HowTo"' in content or "'@type': 'HowTo'" in content

def process_transition_file(filepath: Path) -> bool:
    """Process a single transition file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Skip if already has schema
    if has_schema_markup(content):
        print(f"  ⏭️  Skipping {filepath.name} (already has schema)")
        return False

    print(f"\n  📄 Processing {filepath.name}...")

    # Extract transition name
    transition_name = extract_transition_name(content)
    if not transition_name:
        print(f"    ⚠️  Warning: Could not extract transition name")
        transition_name = filepath.stem  # Use filename as fallback
        print(f"    Using filename as name: {transition_name}")
    else:
        print(f"    Name: {transition_name}")

    # Extract data for schema
    states = extract_states(content)
    print(f"    States: {states['starting']} → {states['ending']}")

    probability = extract_success_probability(content)
    if probability:
        print(f"    Success: Beginner {probability['beginner']}%, Intermediate {probability['intermediate']}%, Advanced {probability['advanced']}%")

    # Extract steps using multiple methods
    steps = extract_execution_steps(content, transition_name, states)

    if not steps:
        print(f"    ❌ Could not extract or generate steps")
        return False

    # Generate schema
    schema = generate_howto_schema(transition_name, steps, states, probability)
    if not schema:
        print(f"    ❌ Failed to generate schema")
        return False

    # Add schema to content
    new_content = add_schema_to_content(content, schema)

    # Write back to file
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"    ✅ SUCCESS: Added HowTo schema with {len(steps)} steps")

    # Print step names for verification
    for step in steps[:3]:  # Show first 3 steps
        print(f"       {step['position']}. {step['name']}")
    if len(steps) > 3:
        print(f"       ... and {len(steps) - 3} more steps")

    return True

def main():
    """Main function to process all transition files."""
    script_dir = Path(__file__).parent
    transitions_dir = script_dir.parent / 'source' / 'content' / 'Transitions'

    if not transitions_dir.exists():
        print(f"❌ Error: Transitions directory not found at {transitions_dir}")
        return

    print("="*70)
    print("TRANSITION SCHEMA GENERATOR v2 - Enhanced Flexibility")
    print("="*70)
    print(f"\nProcessing Transition files in: {transitions_dir}\n")

    # Get all markdown files except the standard
    transition_files = sorted([f for f in transitions_dir.glob('*.md') if f.name != '000.STANDARD.md'])

    print(f"Found {len(transition_files)} transition files\n")
    print("="*70)

    updated_count = 0
    skipped_count = 0
    failed_count = 0

    for filepath in transition_files:
        result = process_transition_file(filepath)
        if result:
            updated_count += 1
        elif has_schema_markup(open(filepath, 'r').read()):
            skipped_count += 1
        else:
            failed_count += 1

    print("\n" + "="*70)
    print("SCHEMA MARKUP SUMMARY")
    print("="*70)
    print(f"  Total files processed:       {len(transition_files)}")
    print(f"  ✅ Updated with schema:      {updated_count}")
    print(f"  ⏭️  Skipped (already has):    {skipped_count}")
    print(f"  ❌ Failed to process:        {failed_count}")
    print("="*70)

    if updated_count > 0:
        print("\n✨ Schema markup successfully added to transition pages!")
        print("   The pages now have enhanced SEO with structured data.\n")

if __name__ == '__main__':
    main()
