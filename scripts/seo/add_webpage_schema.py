#!/usr/bin/env python3
"""
Script to add WebPage schema to all Position, Transition, Submission, Concept, System, and hub pages.
Generates JSON-LD structured data for enhanced search appearance and SEO.
"""

import os
import re
import json
import yaml
from pathlib import Path
from typing import Dict, Optional, Tuple

# Base URL for the site
BASE_URL = "https://bjjgraph.com"

def extract_frontmatter(content: str) -> Tuple[Optional[Dict], str]:
    """Extract YAML frontmatter from content."""
    # Check if content starts with frontmatter
    if not content.startswith('---'):
        return None, content

    # Find the end of frontmatter
    end_match = re.search(r'\n---\n', content[4:])
    if not end_match:
        return None, content

    frontmatter_text = content[4:end_match.start() + 4]
    remaining_content = content[end_match.end() + 4:]

    try:
        frontmatter_data = yaml.safe_load(frontmatter_text)
        return frontmatter_data, remaining_content
    except yaml.YAMLError:
        return None, content

def extract_title(frontmatter: Optional[Dict], content: str, filename: str) -> str:
    """Extract title from frontmatter, content, or generate from filename."""
    # Try frontmatter first
    if frontmatter and 'title' in frontmatter:
        title = frontmatter['title']
        # Remove " | BJJ Graph" or similar suffixes
        title = re.sub(r'\s*\|\s*BJJ.*$', '', title)
        return title.strip()

    # Try first heading
    heading_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    if heading_match:
        return heading_match.group(1).strip()

    # Generate from filename
    name = filename.replace('.md', '').replace('-', ' ').replace('_', ' ')
    return name.title()

def extract_description(frontmatter: Optional[Dict], content: str) -> str:
    """Extract description from frontmatter or generate from content."""
    # Try frontmatter first
    if frontmatter and 'description' in frontmatter:
        return frontmatter['description'].strip()

    # Try to extract from first paragraph after heading
    # Remove frontmatter and schema markup
    clean_content = re.sub(r'<script type="application/ld\+json">.*?</script>', '', content, flags=re.DOTALL)
    clean_content = re.sub(r'<!--.*?-->', '', clean_content, flags=re.DOTALL)

    # Find first substantial paragraph
    paragraphs = re.findall(r'^(?!#)([A-Z][^#\n]+(?:\n(?!\n)[^#\n]+)*)', clean_content, re.MULTILINE)
    if paragraphs:
        desc = paragraphs[0].strip()
        # Limit to reasonable length
        if len(desc) > 200:
            desc = desc[:197] + '...'
        return desc

    # Fallback
    return "Complete guide and technical analysis for Brazilian Jiu-Jitsu."

def generate_url_from_filepath(filepath: Path, content_dir: Path) -> str:
    """Generate URL from file path."""
    # Get relative path from content directory
    try:
        rel_path = filepath.relative_to(content_dir)
    except ValueError:
        # If not under content dir, try to extract meaningful path
        rel_path = filepath

    # Convert path to URL
    path_parts = list(rel_path.parts)

    # Remove 'source/content' if present
    if 'source' in path_parts:
        path_parts = path_parts[path_parts.index('source') + 1:]
    if 'content' in path_parts:
        path_parts = path_parts[path_parts.index('content') + 1:]

    # Convert filename
    if path_parts[-1] == 'index.md':
        path_parts.pop()
    else:
        path_parts[-1] = path_parts[-1].replace('.md', '')

    # Handle hub pages (BJJ-Positions.md -> positions)
    if path_parts and path_parts[-1].startswith('BJJ-'):
        path_parts[-1] = path_parts[-1].replace('BJJ-', '').lower()

    # Build URL
    url_path = '/'.join(path_parts).lower()
    url_path = url_path.replace(' ', '-')

    return f"{BASE_URL}/{url_path}" if url_path else BASE_URL

def generate_webpage_schema(title: str, description: str, url: str) -> Dict:
    """Generate WebPage schema JSON-LD."""
    schema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": title,
        "description": description,
        "url": url,
        "isPartOf": {
            "@type": "WebSite",
            "name": "BJJ Graph",
            "url": BASE_URL
        }
    }

    return schema

def schema_to_html(schema: Dict) -> str:
    """Convert schema dict to HTML script tag."""
    json_str = json.dumps(schema, indent=2, ensure_ascii=False)
    return f'<script type="application/ld+json">\n{json_str}\n</script>'

def has_webpage_schema(content: str) -> bool:
    """Check if file already has WebPage schema."""
    # Look for WebPage schema specifically
    return '"@type": "WebPage"' in content or "'@type': 'WebPage'" in content

def add_webpage_schema_to_content(content: str, schema_html: str) -> str:
    """Add WebPage schema to content after frontmatter."""
    # Find the position after frontmatter
    frontmatter_end = content.find('---\n', 4)  # Skip first ---
    if frontmatter_end != -1:
        # Insert after frontmatter
        insert_pos = frontmatter_end + 4

        # Check if there's already a schema markup comment
        next_content = content[insert_pos:insert_pos + 100]
        if '<!-- Schema Markup' in next_content:
            # Insert right after the comment line
            comment_end = content.find('\n', insert_pos + next_content.index('<!-- Schema Markup'))
            # Find the end of existing schema blocks
            schema_end = insert_pos
            temp_pos = comment_end + 1

            # Skip existing schema blocks
            while temp_pos < len(content):
                # Check if we hit another schema block
                if content[temp_pos:temp_pos + 7] == '<script':
                    # Find end of this script block
                    script_end = content.find('</script>', temp_pos)
                    if script_end != -1:
                        temp_pos = script_end + 9
                        # Skip whitespace
                        while temp_pos < len(content) and content[temp_pos] in '\n ':
                            temp_pos += 1
                        schema_end = temp_pos
                    else:
                        break
                else:
                    break

            insert_pos = schema_end
            new_content = content[:insert_pos] + schema_html + "\n\n" + content[insert_pos:]
        else:
            # Add comment and schema
            new_content = content[:insert_pos] + "\n\n<!-- Schema Markup for SEO -->\n" + schema_html + "\n" + content[insert_pos:]
    else:
        # No frontmatter, insert at beginning
        new_content = "<!-- Schema Markup for SEO -->\n" + schema_html + "\n\n" + content

    return new_content

def process_file(filepath: Path, content_dir: Path) -> bool:
    """Process a single markdown file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  Error reading {filepath.name}: {e}")
        return False

    # Skip if already has WebPage schema
    if has_webpage_schema(content):
        print(f"  Skip {filepath.name} (already has WebPage schema)")
        return False

    # Extract frontmatter and parse
    frontmatter, body = extract_frontmatter(content)

    # Extract metadata
    title = extract_title(frontmatter, content, filepath.name)
    description = extract_description(frontmatter, content)
    url = generate_url_from_filepath(filepath, content_dir)

    # Generate schema
    webpage_schema = generate_webpage_schema(title, description, url)
    schema_html = schema_to_html(webpage_schema)

    # Add schema to content
    new_content = add_webpage_schema_to_content(content, schema_html)

    # Write back to file
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"  Added {filepath.name}")
        print(f"     Title: {title}")
        print(f"     URL: {url}")
        return True
    except Exception as e:
        print(f"  Error writing {filepath.name}: {e}")
        return False

def main():
    """Main function to process all markdown files."""
    script_dir = Path(__file__).parent
    content_dir = script_dir.parent / 'source' / 'content'

    if not content_dir.exists():
        print(f"Error: Content directory not found at {content_dir}")
        return

    print(f"Processing files for WebPage schema in: {content_dir}\n")
    print("=" * 60)

    # Define directories to process
    target_dirs = [
        content_dir / 'Positions',
        content_dir / 'Transitions',
        content_dir / 'Submissions',
        content_dir / 'Concepts',
        content_dir / 'Systems',
        content_dir  # For hub pages at root
    ]

    # Hub page patterns
    hub_patterns = ['BJJ-*.md', 'index.md']

    updated_count = 0
    skipped_count = 0
    total_count = 0

    # Process each target directory
    for target_dir in target_dirs:
        if not target_dir.exists():
            print(f"Warning: Directory not found: {target_dir}")
            continue

        # Determine if this is the content root (for hub pages)
        if target_dir == content_dir:
            print(f"\nProcessing hub pages in: {target_dir.name}/")
            print("-" * 60)

            # Process only hub pages
            for pattern in hub_patterns:
                for filepath in sorted(target_dir.glob(pattern)):
                    # Skip STANDARD files
                    if 'STANDARD' in filepath.name:
                        continue

                    total_count += 1
                    if process_file(filepath, content_dir):
                        updated_count += 1
                    else:
                        skipped_count += 1
        else:
            print(f"\nProcessing {target_dir.name}/")
            print("-" * 60)

            # Get all markdown files except STANDARD files
            md_files = sorted([
                f for f in target_dir.glob('*.md')
                if 'STANDARD' not in f.name
            ])

            for filepath in md_files:
                total_count += 1
                if process_file(filepath, content_dir):
                    updated_count += 1
                else:
                    skipped_count += 1

    # Print summary
    print("\n" + "=" * 60)
    print("WebPage Schema Addition Summary:")
    print(f"  Total files processed: {total_count}")
    print(f"  Files updated with WebPage schema: {updated_count}")
    print(f"  Files skipped: {skipped_count}")
    print("=" * 60)

    if updated_count > 0:
        print("\nWebPage schema successfully added to all pages!")
        print("Each page now includes:")
        print("  - Page name (from title or filename)")
        print("  - Description (from frontmatter or content)")
        print("  - URL (generated from file path)")
        print("  - isPartOf reference to BJJ Graph website")

if __name__ == '__main__':
    main()
