#!/usr/bin/env python3
"""
Category Hub Page Generator for BJJ Graph

Generates category hub pages (Positions, Transitions, Submissions, Systems)
by scanning content directories and creating comprehensive markdown files with:
- SEO-optimized metadata
- ItemList schema for all content items
- Organized sections by subcategory
- Automatic link generation

Usage:
    python scripts/regenerate_category_hub_pages.py
    python scripts/regenerate_category_hub_pages.py --category Positions
    python scripts/regenerate_category_hub_pages.py --dry-run
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime
import argparse


@dataclass
class ContentItem:
    """Represents a single content item (position, transition, etc.)"""
    name: str
    slug: str
    description: str
    category: Optional[str] = None
    file_path: Optional[str] = None


class CategoryHubPageGenerator:
    """Generates category hub pages from content directories"""
    
    def __init__(self, source_dir: str = "content"):
        self.source_dir = Path(source_dir)
        self.files_needing_json_fix = []  # Track files that need JSON repair
        self.categories = {
            "Positions": {
                "dir": "Positions",
                "title": "Positions",
                "page_title": "Positions | BJJ Position Guide",
                "description": "Complete guide to all BJJ positions. Learn the positional hierarchy, point values, and transitions. From standing to submissions - master every position in Brazilian Jiu-Jitsu.",
                "url_slug": "positions",
                "keywords": "bjj positions, brazilian jiu jitsu positions, bjj position hierarchy"
            },
            "Transitions": {
                "dir": "Transitions",
                "title": "Transitions",
                "page_title": "Transitions | BJJ Technique Guide",
                "description": "Master all BJJ transitions and techniques. Complete guide to sweeps, passes, takedowns, and escapes. Learn execution steps, and success rates.",
                "url_slug": "transitions",
                "keywords": "bjj transitions, bjj techniques, bjj sweeps, guard passes"
            },
            "Submissions": {
                "dir": "Submissions",
                "title": "Submissions",
                "page_title": "Submissions | BJJ Technique Guide",
                "description": "Master all BJJ submission techniques. Complete guide to chokes, joint locks, and finishing positions. Learn setups, and escapes.",
                "url_slug": "submissions",
                "keywords": "bjj submissions, bjj chokes, bjj armlocks, submission techniques"
            },
            "Systems": {
                "dir": "Systems",
                "title": "Systems",
                "page_title": "Systems | BJJ Methodology Guide",
                "description": "Master BJJ through systematic approaches. Complete guide to guard systems, passing systems, leg lock systems, and submission chains. Learn proven methodologies from Danaher, Gordon Ryan, and Eddie Bravo.",
                "url_slug": "systems",
                "keywords": "bjj systems, bjj methodology, bjj game plan"
            },
            "Principles": {
                "dir": "Principles",
                "title": "Principles",
                "page_title": "Principles | BJJ Concept Guide",
                "description": "Master fundamental BJJ principles and concepts. Complete guide to leverage, positioning, control, and strategic thinking. Build a deep understanding of the art.",
                "url_slug": "principles",
                "keywords": "bjj principles, bjj concepts, bjj fundamentals, bjj theory"
            }
        }
    
    def infer_position_family_name(self, json_file: Path, category_base: Path, category_name: str) -> Optional[str]:
        """Infer position family name from filesystem structure for hub page sections"""
        # Only for Positions category
        if category_name != "Positions":
            return None
        
        # Get relative path from category base
        relative_path = json_file.relative_to(category_base)
        path_parts = relative_path.parts
        
        # If nested in subfolder (e.g., Half Guard/Old School.json)
        if len(path_parts) > 1:
            # Use parent folder name as the position family
            return path_parts[0]  # e.g., "Half Guard"
        
        # If top-level file, check if it's a FAMILY position
        # (has a subfolder with same name containing JSON files)
        filename = json_file.stem
        variant_folder = json_file.parent / filename
        
        if variant_folder.exists() and variant_folder.is_dir():
            json_files_in_folder = list(variant_folder.glob("*.json"))
            if len(json_files_in_folder) > 0:
                # FAMILY position - use filename as the position family
                return filename
        
        # Top-level SINGLE/DUAL file - no position family
        return None
    
    def scan_directory(self, category_name: str) -> List[ContentItem]:
        """Scan a category directory for JSON files and extract content items"""
        category_info = self.categories.get(category_name)
        if not category_info:
            print(f"Warning: Unknown category '{category_name}'")
            return []
        
        category_dir = self.source_dir / category_info["dir"]
        if not category_dir.exists():
            print(f"Warning: Directory not found: {category_dir}")
            return []
        
        items = []
        
        # Special handling for Positions - scan recursively to include variants in subfolders
        if category_name == "Positions":
            json_files = list(category_dir.glob("**/*.json"))
        else:
            json_files = list(category_dir.glob("*.json"))
        
        print(f"Found {len(json_files)} JSON files in {category_dir}")
        
        for json_file in json_files:
            # Infer position family from filesystem structure
            inferred_category = self.infer_position_family_name(json_file, category_dir, category_name)
            
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Get description and check if it's empty/whitespace
                description = data.get("description", "").strip()
                
                # If description is empty, use fallback and track for fixing
                if not description:
                    print(f"Warning: {json_file.name} has empty description, using fallback")
                    self.files_needing_json_fix.append(str(json_file))
                    description = f"⚠️ Content being updated - Learn about {data.get('name', json_file.stem)} in BJJ."
                
                item = ContentItem(
                    name=data.get("name", json_file.stem),
                    slug=data.get("slug", json_file.stem.lower().replace(" ", "-")),
                    description=description,
                    category=inferred_category,  # Use inferred category from filesystem
                    file_path=str(json_file)
                )
                items.append(item)
                
            except Exception as e:
                # JSON parsing failed - use filename as fallback
                print(f"Warning: Could not parse {json_file.name}, using filename fallback")
                
                # Track this file for the needs-fixing list
                self.files_needing_json_fix.append(str(json_file))
                
                # Create item from filename
                name = json_file.stem  # Remove .json extension
                slug = name.lower().replace(" ", "-")
                
                item = ContentItem(
                    name=name,
                    slug=slug,
                    description=f"⚠️ Content being updated - Learn about {name} in BJJ.",
                    category=inferred_category,  # Use inferred category from filesystem
                    file_path=str(json_file)
                )
                items.append(item)
        
        # Sort by name
        items.sort(key=lambda x: x.name)
        return items
    
    def generate_schema_markup(self, category_name: str, items: List[ContentItem]) -> str:
        """Generate schema.org markup for hub page"""
        category_info = self.categories[category_name]
        
        # WebPage schema
        webpage_schema = {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": category_info["page_title"],
            "description": category_info["description"],
            "url": f"https://bjjgraph.org/{category_info['url_slug']}",
            "isPartOf": {
                "@type": "WebSite",
                "name": "BJJ Graph",
                "url": "https://bjjgraph.org"
            }
        }
        
        # ItemList schema
        item_list_elements = []
        for i, item in enumerate(items, 1):
            item_list_elements.append({
                "@type": "ListItem",
                "position": i,
                "name": item.name,
                "url": f"https://bjjgraph.org/{category_info['dir']}/{item.slug}"
            })
        
        itemlist_schema = {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": f"BJJ {category_name}",
            "description": f"Complete list of BJJ {category_name.lower()} with detailed guides",
            "itemListElement": item_list_elements
        }
        
        # BreadcrumbList schema
        breadcrumb_schema = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": "https://bjjgraph.org/"
                },
                {
                    "@type": "ListItem",
                    "position": 2,
                    "name": category_info["title"],
                    "item": f"https://bjjgraph.org/{category_info['url_slug']}"
                }
            ]
        }
        
        # Combine schemas
        schemas = [
            json.dumps(webpage_schema, indent=2),
            json.dumps(itemlist_schema, indent=2),
            json.dumps(breadcrumb_schema, indent=2)
        ]
        
        return "\n\n".join([
            f'<script type="application/ld+json">\n{schema}\n</script>'
            for schema in schemas
        ])
    
    def generate_content_section(self, category_name: str, items: List[ContentItem]) -> str:
        """Generate the main content section listing all items"""
        if not items:
            return "No content items found."
        
        # Group by category if available
        categorized = {}
        uncategorized = []
        
        for item in items:
            if item.category:
                if item.category not in categorized:
                    categorized[item.category] = []
                categorized[item.category].append(item)
            else:
                uncategorized.append(item)
        
        content_lines = []
        
        # Add categorized items
        for cat, cat_items in sorted(categorized.items()):
            cat_title = cat.replace("-", " ").title()
            content_lines.append(f"## {cat_title}\n")

            for item in cat_items:
                content_lines.append(f"### [[{item.name}]]\n")
                content_lines.append(f"{item.description}\n")
            content_lines.append("")

        # Add uncategorized items
        if uncategorized:
            if categorized:
                content_lines.append("## Other Techniques\n")
            for item in uncategorized:
                content_lines.append(f"### [[{item.name}]]\n")
                content_lines.append(f"{item.description}\n")
        
        return "\n".join(content_lines)
    
    def generate_hub_page(self, category_name: str, items: List[ContentItem]) -> str:
        """Generate complete hub page markdown"""
        category_info = self.categories[category_name]

        # Generate schema markup
        schema_markup = self.generate_schema_markup(category_name, items)

        # Generate content section
        content_section = self.generate_content_section(category_name, items)

        # Count items with fallback descriptions
        fallback_count = sum(1 for item in items if "⚠️ Content being updated" in item.description)

        # Build note about content in progress if there are fallback items
        content_note = ""
        if fallback_count > 0:
            content_note = f"""
> **📝 Note**: Some items are currently being updated. Items marked with ⚠️ will be enhanced with complete descriptions soon.

"""

        # Build complete page
        hub_page = f"""---
title: "{category_info['page_title']} | BJJ Graph"
description: "{category_info['description']}"
---

<!-- Schema Markup for SEO -->
{schema_markup}

{category_info['description']}

{content_note}

{content_section}

"""

        return hub_page
    
    def save_hub_page(self, category_name: str, content: str, dry_run: bool = False) -> None:
        """Save hub page to file"""
        output_file = self.source_dir / f"{category_name}.md"
        
        if dry_run:
            print(f"\n{'='*60}")
            print(f"DRY RUN: Would save to {output_file}")
            print(f"{'='*60}")
            print(content[:500] + "...\n")
            return
        
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✓ Generated: {output_file}")
        except Exception as e:
            print(f"✗ Error saving {output_file}: {e}")
    
    def generate_all(self, dry_run: bool = False, specific_category: Optional[str] = None):
        """Generate all hub pages or a specific category"""
        categories_to_generate = (
            [specific_category] if specific_category 
            else list(self.categories.keys())
        )
        
        for category in categories_to_generate:
            if category not in self.categories:
                print(f"Warning: Unknown category '{category}'")
                continue
            
            print(f"\n{'='*60}")
            print(f"Generating hub page for: {category}")
            print(f"{'='*60}")
            
            # Scan directory for items
            items = self.scan_directory(category)
            
            if not items:
                print(f"Warning: No items found for {category}")
                continue
            
            print(f"Found {len(items)} items")

            # Calculate statistics for console output
            fallback_count = sum(1 for item in items if "⚠️ Content being updated" in item.description)
            complete_count = len(items) - fallback_count

            # Print statistics to console for developers
            print(f"\nStatistics for {category}:")
            print(f"  - Total items: {len(items)}")
            print(f"  - Items with complete content: {complete_count}")
            print(f"  - Items needing JSON updates: {fallback_count}")
            print(f"  - Last generated: {datetime.now().strftime('%B %d, %Y')}")

            # Generate hub page
            hub_page_content = self.generate_hub_page(category, items)

            # Save to file
            self.save_hub_page(category, hub_page_content, dry_run)
        
        print(f"\n{'='*60}")
        print(f"Hub page generation complete!")
        print(f"{'='*60}\n")
        
        # Report files needing JSON fixes
        if self.files_needing_json_fix:
            print(f"⚠️  {len(self.files_needing_json_fix)} files need JSON fixes:")
            for file_path in sorted(self.files_needing_json_fix):
                print(f"   - {file_path}")
            print(f"\nFix these JSON files and re-run the generator to get complete descriptions.\n")


def main():
    parser = argparse.ArgumentParser(
        description="Generate BJJ Graph hub pages from content directories"
    )
    parser.add_argument(
        "--category",
        choices=["Positions", "Transitions", "Submissions", "Systems", "Principles"],
        help="Generate only a specific category (default: all)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be generated without writing files"
    )
    parser.add_argument(
        "--source-dir",
        default="content",
        help="Source content directory (default: content)"
    )
    
    args = parser.parse_args()
    
    generator = CategoryHubPageGenerator(source_dir=args.source_dir)
    generator.generate_all(
        dry_run=args.dry_run,
        specific_category=args.category
    )


if __name__ == "__main__":
    main()
