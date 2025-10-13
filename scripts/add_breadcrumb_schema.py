#!/usr/bin/env python3
"""
Script to add BreadcrumbList schema markup to all markdown pages.
Generates JSON-LD structured data for breadcrumb navigation.

This script processes:
- Position pages (Positions/)
- Transition pages (Transitions/)
- Submission pages (Submissions/)
- Concept pages (Concepts/)
- System pages (Systems/)
- Hub pages (BJJ-*.md)

Schema structure:
- Positions: Home → Positions → [Position Name]
- Transitions: Home → Transitions → [Transition Name]
- Submissions: Home → Submissions → [Submission Name]
- Concepts: Home → Concepts → [Concept Name]
- Systems: Home → Systems → [System Name]
- Hub pages: Home → [Hub Name]
"""

import os
import re
import json
from pathlib import Path

SITE_URL = "https://bjjgraph.com"

def extract_page_name(content, filename):
    """Extract page name from title or heading."""
    # Try frontmatter title first
    title_match = re.search(r'^title:\s*["\'](.+?)\s*[|"]', content, re.MULTILINE)
    if title_match:
        title = title_match.group(1).strip()
        # Clean up common patterns
        title = re.sub(r'\s*\|.*$', '', title)  # Remove anything after |
        return title

    # Fallback to heading
    heading_match = re.search(r'^# (.+)$', content, re.MULTILINE)
    if heading_match:
        heading = heading_match.group(1).strip()
        # Remove tags like #bjj #state etc
        heading = re.sub(r'#\w+', '', heading).strip()
        return heading

    # Fallback to filename
    return filename.replace('.md', '').replace('-', ' ')

def slug_from_filename(filename):
    """Convert filename to URL slug."""
    slug = filename.replace('.md', '')
    # Convert spaces and special characters to hyphens
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[-\s]+', '-', slug)
    slug = slug.lower()
    return slug

def generate_breadcrumb_schema(category, page_name, page_slug):
    """
    Generate BreadcrumbList schema JSON-LD.

    Args:
        category: One of 'positions', 'transitions', 'submissions', or None for hub pages
        page_name: Display name of the page
        page_slug: URL slug for the page

    Returns:
        dict: BreadcrumbList schema
    """
    items = [
        {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": f"{SITE_URL}/"
        }
    ]

    if category:
        # Add category breadcrumb
        category_name = category.capitalize()
        items.append({
            "@type": "ListItem",
            "position": 2,
            "name": category_name,
            "item": f"{SITE_URL}/{category}/"
        })

        # Add page breadcrumb
        items.append({
            "@type": "ListItem",
            "position": 3,
            "name": page_name,
            "item": f"{SITE_URL}/{category}/{page_slug}"
        })
    else:
        # Hub page - only Home → Hub Name
        items.append({
            "@type": "ListItem",
            "position": 2,
            "name": page_name,
            "item": f"{SITE_URL}/{page_slug}"
        })

    schema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": items
    }

    return schema

def schema_to_html(schema):
    """Convert schema dict to HTML script tag."""
    json_str = json.dumps(schema, indent=2, ensure_ascii=False)
    return f'<script type="application/ld+json">\n{json_str}\n</script>'

def has_breadcrumb_schema(content):
    """Check if file already has BreadcrumbList schema."""
    return '"@type": "BreadcrumbList"' in content or '"@type":"BreadcrumbList"' in content

def find_schema_insertion_point(content):
    """
    Find the appropriate insertion point for schema.
    Should be after existing schema or after frontmatter.
    """
    # Check if there's existing schema
    existing_schema_matches = list(re.finditer(r'<script type="application/ld\+json">.*?</script>', content, re.DOTALL))

    if existing_schema_matches:
        # Insert after the last existing schema
        last_schema = existing_schema_matches[-1]
        return last_schema.end()

    # No existing schema, insert after frontmatter
    frontmatter_match = re.match(r'^---\n.*?\n---\n', content, re.DOTALL)
    if frontmatter_match:
        return frontmatter_match.end()

    # No frontmatter, insert at beginning
    return 0

def add_breadcrumb_schema(content, category, page_name, page_slug):
    """Add breadcrumb schema to content."""
    # Generate schema
    schema = generate_breadcrumb_schema(category, page_name, page_slug)
    schema_html = schema_to_html(schema)

    # Find insertion point
    insert_pos = find_schema_insertion_point(content)

    # Check if we're after frontmatter or existing schema
    if insert_pos > 0:
        # Add proper spacing
        if content[insert_pos:insert_pos+2] == '\n\n':
            # Already has double newline
            new_content = content[:insert_pos] + '\n' + schema_html + '\n' + content[insert_pos:]
        else:
            # Add spacing
            new_content = content[:insert_pos] + '\n\n' + schema_html + '\n\n' + content[insert_pos:]
    else:
        # Beginning of file
        new_content = schema_html + '\n\n' + content

    return new_content

def process_file(filepath, category=None):
    """
    Process a single markdown file.

    Args:
        filepath: Path to the markdown file
        category: Category name ('positions', 'transitions', 'submissions', or None for hub)

    Returns:
        bool: True if file was updated, False otherwise
    """
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ❌ Error reading {filepath.name}: {e}")
        return False

    # Skip if already has breadcrumb schema
    if has_breadcrumb_schema(content):
        print(f"  ⏭️  Skipping {filepath.name} (already has BreadcrumbList)")
        return False

    # Extract page information
    page_name = extract_page_name(content, filepath.stem)
    page_slug = slug_from_filename(filepath.stem)

    # Add breadcrumb schema
    try:
        new_content = add_breadcrumb_schema(content, category, page_name, page_slug)
    except Exception as e:
        print(f"  ❌ Error adding schema to {filepath.name}: {e}")
        return False

    # Write back to file
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
    except Exception as e:
        print(f"  ❌ Error writing {filepath.name}: {e}")
        return False

    print(f"  ✅ Updated {filepath.name}")
    return True

def process_directory(directory, category, label):
    """
    Process all markdown files in a directory.

    Args:
        directory: Path to directory
        category: Category name for breadcrumbs
        label: Display label for progress output

    Returns:
        tuple: (updated_count, skipped_count)
    """
    if not directory.exists():
        print(f"⚠️  Warning: {label} directory not found at {directory}")
        return 0, 0

    print(f"\n{'='*60}")
    print(f"Processing {label} files in: {directory}")
    print(f"{'='*60}\n")

    # Get all markdown files except standards
    md_files = sorted([
        f for f in directory.glob('*.md')
        if not f.name.startswith('000.STANDARD')
    ])

    if not md_files:
        print(f"No markdown files found in {label}\n")
        return 0, 0

    print(f"Found {len(md_files)} {label.lower()} files\n")

    updated_count = 0
    skipped_count = 0

    for i, filepath in enumerate(md_files, 1):
        print(f"[{i}/{len(md_files)}] Processing {filepath.name}...")
        if process_file(filepath, category):
            updated_count += 1
        else:
            skipped_count += 1

    return updated_count, skipped_count

def process_hub_pages(content_dir):
    """
    Process hub pages (BJJ-*.md files) in the content directory.

    Returns:
        tuple: (updated_count, skipped_count)
    """
    if not content_dir.exists():
        print(f"⚠️  Warning: Content directory not found at {content_dir}")
        return 0, 0

    print(f"\n{'='*60}")
    print(f"Processing Hub Pages in: {content_dir}")
    print(f"{'='*60}\n")

    # Get all BJJ-*.md files
    hub_files = sorted(content_dir.glob('BJJ-*.md'))

    if not hub_files:
        print(f"No hub pages found\n")
        return 0, 0

    print(f"Found {len(hub_files)} hub page files\n")

    updated_count = 0
    skipped_count = 0

    for i, filepath in enumerate(hub_files, 1):
        print(f"[{i}/{len(hub_files)}] Processing {filepath.name}...")
        # Hub pages don't have a category (None)
        if process_file(filepath, category=None):
            updated_count += 1
        else:
            skipped_count += 1

    return updated_count, skipped_count

def main():
    """Main function to process all markdown files."""
    # Get the content directory
    script_dir = Path(__file__).parent
    content_dir = script_dir.parent / 'source' / 'content'

    if not content_dir.exists():
        print(f"❌ Error: Content directory not found at {content_dir}")
        return

    print("="*60)
    print("BreadcrumbList Schema Markup Script")
    print("="*60)
    print(f"Content directory: {content_dir}")
    print(f"Site URL: {SITE_URL}")
    print("="*60)

    # Track overall statistics
    total_updated = 0
    total_skipped = 0
    total_files = 0

    # Process Positions
    positions_dir = content_dir / 'Positions'
    pos_updated, pos_skipped = process_directory(positions_dir, 'positions', 'Positions')
    total_updated += pos_updated
    total_skipped += pos_skipped
    total_files += pos_updated + pos_skipped

    # Process Transitions
    transitions_dir = content_dir / 'Transitions'
    trans_updated, trans_skipped = process_directory(transitions_dir, 'transitions', 'Transitions')
    total_updated += trans_updated
    total_skipped += trans_skipped
    total_files += trans_updated + trans_skipped

    # Process Submissions
    submissions_dir = content_dir / 'Submissions'
    sub_updated, sub_skipped = process_directory(submissions_dir, 'submissions', 'Submissions')
    total_updated += sub_updated
    total_skipped += sub_skipped
    total_files += sub_updated + sub_skipped

    # Process Concepts
    concepts_dir = content_dir / 'Concepts'
    con_updated, con_skipped = process_directory(concepts_dir, 'concepts', 'Concepts')
    total_updated += con_updated
    total_skipped += con_skipped
    total_files += con_updated + con_skipped

    # Process Systems
    systems_dir = content_dir / 'Systems'
    sys_updated, sys_skipped = process_directory(systems_dir, 'systems', 'Systems')
    total_updated += sys_updated
    total_skipped += sys_skipped
    total_files += sys_updated + sys_skipped

    # Process Hub Pages
    hub_updated, hub_skipped = process_hub_pages(content_dir)
    total_updated += hub_updated
    total_skipped += hub_skipped
    total_files += hub_updated + hub_skipped

    # Print summary
    print(f"\n{'='*60}")
    print("FINAL SUMMARY")
    print(f"{'='*60}")
    print(f"Total files processed: {total_files}")
    print(f"  ✅ Updated with BreadcrumbList: {total_updated}")
    print(f"  ⏭️  Skipped (already had schema): {total_skipped}")
    print(f"{'='*60}")

    if total_updated > 0:
        print(f"\n✅ Successfully added BreadcrumbList schema to {total_updated} files!")
    else:
        print(f"\nℹ️  No files needed updating (all already have BreadcrumbList schema)")

if __name__ == '__main__':
    main()
