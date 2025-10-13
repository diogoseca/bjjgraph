#!/usr/bin/env python3
"""
BJJ Graph Content Validation Script

Validates markdown files against BJJ Graph content standards for:
- Positions (S### IDs) - see CONTRIBUTING-POSITIONS.md for standards
- Transitions (T### IDs) - see CONTRIBUTING-TRANSITIONS.md for standards
- Submissions (SUB### or S### IDs) - see CONTRIBUTING-SUBMISSIONS.md for standards
- Concepts (C### IDs) - see CONTRIBUTING-CONCEPTS.md for standards
- Systems (SC### IDs) - see CONTRIBUTING-SYSTEMS.md for standards

Usage:
    python validate_content.py <content_directory>
    python validate_content.py source/content/
    python validate_content.py source/content/ --verbose
    python validate_content.py source/content/ --type Positions
    python validate_content.py source/content/ --strict
"""

import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass, field
from collections import defaultdict
import argparse


@dataclass
class ValidationError:
    """Represents a single validation error."""
    severity: str  # 'error', 'warning', 'info'
    message: str
    line_number: Optional[int] = None


@dataclass
class FileValidationResult:
    """Results for a single file validation."""
    file_path: str
    content_type: str
    passed: bool = True
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)
    info: List[ValidationError] = field(default_factory=list)

    def add_error(self, message: str, line_number: Optional[int] = None):
        """Add an error."""
        self.errors.append(ValidationError('error', message, line_number))
        self.passed = False

    def add_warning(self, message: str, line_number: Optional[int] = None):
        """Add a warning."""
        self.warnings.append(ValidationError('warning', message, line_number))

    def add_info(self, message: str, line_number: Optional[int] = None):
        """Add an info message."""
        self.info.append(ValidationError('info', message, line_number))


class ContentValidator:
    """Main validation class for BJJ Graph content."""

    def __init__(self, content_dir: str, verbose: bool = False, strict: bool = False):
        self.content_dir = Path(content_dir)
        self.verbose = verbose
        self.strict = strict  # In strict mode, warnings become errors
        self.all_files: Dict[str, str] = {}  # filename -> full_path
        self.all_ids: Dict[str, str] = {}  # id -> filename
        self.wikilinks: Dict[str, List[str]] = defaultdict(list)  # file -> [links]
        self.results: List[FileValidationResult] = []

    def validate_all(self, content_type: Optional[str] = None) -> Dict:
        """
        Validate all content files.

        Args:
            content_type: Optional filter for specific type (e.g., 'Positions', 'Transitions')
        """
        # First pass: collect all files and IDs
        self._collect_files(content_type)

        # Second pass: validate each file
        for file_path in self.all_files.values():
            # Skip standard/contributing files and index files
            if (file_path.endswith('.STANDARD.md') or
                file_path.endswith('-V2.md') or
                'CONTRIBUTING-' in file_path or
                file_path.endswith('index.md')):
                continue

            result = self._validate_file(file_path)
            self.results.append(result)

        # Third pass: validate wikilinks
        self._validate_wikilinks()

        return self._generate_summary()

    def _collect_files(self, content_type: Optional[str] = None):
        """Collect all markdown files and their IDs."""
        search_dirs = []

        if content_type:
            type_dir = self.content_dir / content_type
            if type_dir.exists():
                search_dirs.append(type_dir)
        else:
            # Search all subdirectories
            for subdir in ['Positions', 'Transitions', 'Submissions', 'Concepts', 'Systems']:
                type_dir = self.content_dir / subdir
                if type_dir.exists():
                    search_dirs.append(type_dir)

        for search_dir in search_dirs:
            for md_file in search_dir.glob('*.md'):
                # Skip standard/contributing files
                if (md_file.name.endswith('.STANDARD.md') or
                    md_file.name.endswith('-V2.md') or
                    md_file.name.startswith('CONTRIBUTING-')):
                    continue

                filename = md_file.stem
                self.all_files[filename] = str(md_file)

                # Extract ID if present
                content = md_file.read_text(encoding='utf-8')
                id_patterns = [
                    r'\*\*State ID\*\*:\s*(\w+)',
                    r'\*\*Transition ID\*\*:\s*(\w+)',
                    r'\*\*Submission ID\*\*:\s*(\w+)',
                    r'\*\*Concept ID\*\*:\s*(\w+)',
                    r'\*\*Chain ID\*\*:\s*(\w+)',
                ]
                for pattern in id_patterns:
                    id_match = re.search(pattern, content)
                    if id_match:
                        content_id = id_match.group(1)
                        if content_id in self.all_ids:
                            # Duplicate ID found - will be caught in validation
                            pass
                        self.all_ids[content_id] = filename
                        break

    def _validate_file(self, file_path: str) -> FileValidationResult:
        """Validate a single file."""
        path = Path(file_path)
        content_type = self._determine_content_type(path)

        result = FileValidationResult(
            file_path=str(path),
            content_type=content_type
        )

        try:
            content = path.read_text(encoding='utf-8')
        except Exception as e:
            result.add_error(f"Failed to read file: {e}")
            return result

        # Parse frontmatter and content
        frontmatter, body = self._parse_markdown(content)

        # Validate based on content type
        if content_type == 'Position':
            self._validate_position(result, frontmatter, body, content)
        elif content_type == 'Transition':
            self._validate_transition(result, frontmatter, body, content)
        elif content_type == 'Submission':
            self._validate_submission(result, frontmatter, body, content)
        elif content_type == 'Concept':
            self._validate_concept(result, frontmatter, body, content)
        elif content_type == 'System':
            self._validate_system(result, frontmatter, body, content)

        # Extract wikilinks for later validation
        filename = path.stem
        self.wikilinks[filename] = self._extract_wikilinks(body)

        # Validate SEO elements
        self._validate_seo(result, frontmatter, body, content_type)

        return result

    def _determine_content_type(self, path: Path) -> str:
        """Determine content type from file path."""
        parent = path.parent.name

        if parent == 'Positions':
            return 'Position'
        elif parent == 'Transitions':
            return 'Transition'
        elif parent == 'Submissions':
            return 'Submission'
        elif parent == 'Concepts':
            return 'Concept'
        elif parent == 'Systems':
            return 'System'
        else:
            return 'Unknown'

    def _parse_markdown(self, content: str) -> Tuple[Dict[str, str], str]:
        """Parse YAML frontmatter and body content."""
        frontmatter = {}
        body = content

        # Check for YAML frontmatter
        if content.startswith('---'):
            parts = content.split('---', 2)
            if len(parts) >= 3:
                frontmatter_text = parts[1]
                body = parts[2]

                # Parse simple YAML (key: value)
                for line in frontmatter_text.split('\n'):
                    if ':' in line:
                        key, value = line.split(':', 1)
                        frontmatter[key.strip()] = value.strip().strip('"\'')

        return frontmatter, body

    def _extract_wikilinks(self, content: str) -> List[str]:
        """Extract all [[wikilinks]] from content."""
        return re.findall(r'\[\[([^\]]+)\]\]', content)

    def _validate_position(self, result: FileValidationResult, frontmatter: Dict, body: str, content: str):
        """Validate Position content."""
        # Check for State ID
        state_id_match = re.search(r'\*\*State ID\*\*:\s*(S\d{3})', content)
        if not state_id_match:
            result.add_error("Missing or invalid State ID (format: S###)")
        else:
            state_id = state_id_match.group(1)
            if state_id in self.all_ids and self.all_ids[state_id] != Path(result.file_path).stem:
                result.add_error(f"Duplicate State ID {state_id} (also in {self.all_ids[state_id]})")

        # Check for required sections
        required_sections = [
            ('State Properties', r'##\s*State Properties'),
            ('Visual Description', r'###\s*Visual Description'),
            ('Offensive Transitions', r'##\s*Offensive Transitions'),
            ('Decision Tree', r'##\s*Decision Tree'),
            ('Expert Insights', r'##\s*Expert Insights'),
            ('Common Errors', r'##\s*Common Errors'),
        ]

        for section_name, pattern in required_sections:
            if not re.search(pattern, content):
                result.add_error(f"Missing required section: {section_name}")

        # Check for minimum transitions with success rates
        transitions_with_rates = re.findall(
            r'\[\[([^\]]+)\]\]\s*→\s*\[\[([^\]]+)\]\]\s*\(Success Rate:.*?Beginner\s*\d+%.*?Intermediate\s*\d+%.*?Advanced\s*\d+%',
            content
        )
        if len(transitions_with_rates) < 3:
            result.add_warning(f"Only {len(transitions_with_rates)} transitions with full success rates found (minimum 3 recommended)")

        # Validate success rate percentages
        self._validate_success_rates(result, content)

        # Check for expert insights from all three
        experts = ['Danaher', 'Gordon Ryan', 'Eddie Bravo']
        for expert in experts:
            if expert not in content:
                result.add_warning(f"Missing {expert} expert insight")

        # Check for state properties
        state_props = ['Point Value', 'Position Type', 'Risk Level', 'Energy Cost', 'Time Sustainability']
        for prop in state_props:
            if f'**{prop}**' not in content:
                result.add_warning(f"Missing state property: {prop}")

        # Check for Position Metrics
        metrics = ['Position Retention Rate', 'Advancement Probability', 'Submission Probability']
        for metric in metrics:
            if metric not in content:
                result.add_info(f"Missing position metric: {metric}")

        # Check visual description length (should be substantial)
        visual_desc_match = re.search(r'###\s*Visual Description\s*\n+(.*?)(?=\n##|\Z)', content, re.DOTALL)
        if visual_desc_match:
            desc_text = visual_desc_match.group(1).strip()
            if len(desc_text) < 200:
                result.add_warning("Visual Description is too short (minimum 200 characters recommended)")

    def _validate_transition(self, result: FileValidationResult, frontmatter: Dict, body: str, content: str):
        """Validate Transition content."""
        # Check for Transition ID
        trans_id_match = re.search(r'\*\*Transition ID\*\*:\s*(T\d{3})', content)
        if not trans_id_match:
            result.add_error("Missing or invalid Transition ID (format: T###)")
        else:
            trans_id = trans_id_match.group(1)
            if trans_id in self.all_ids and self.all_ids[trans_id] != Path(result.file_path).stem:
                result.add_error(f"Duplicate Transition ID {trans_id} (also in {self.all_ids[trans_id]})")

        # Check for Starting and Ending State
        if '**Starting State**' not in content:
            result.add_error("Missing Starting State")
        else:
            # Validate that starting state links exist
            starting_state_match = re.search(r'\*\*Starting State\*\*:\s*\[\[([^\]]+)\]\]', content)
            if not starting_state_match:
                result.add_warning("Starting State should be a wikilink")

        if '**Ending State**' not in content:
            result.add_error("Missing Ending State")
        else:
            # Validate that ending state links exist
            ending_state_match = re.search(r'\*\*Ending State\*\*:\s*\[\[([^\]]+)\]\]', content)
            if not ending_state_match:
                result.add_warning("Ending State should be a wikilink")

        # Check for required sections
        required_sections = [
            ('Visual Execution Sequence', r'###\s*Visual Execution Sequence'),
            ('Execution Steps', r'###\s*Execution Steps'),
            ('Common Counters', r'###\s*Common Counters'),
            ('Expert Insights', r'###\s*Expert Insights'),
            ('Common Errors', r'###\s*Common Errors'),
            ('Knowledge Assessment Questions', r'###\s*Knowledge Assessment Questions'),
        ]

        for section_name, pattern in required_sections:
            if not re.search(pattern, content):
                result.add_error(f"Missing required section: {section_name}")

        # Check for execution steps (minimum 6)
        execution_steps = re.findall(r'^\d+\.\s+\*\*', content, re.MULTILINE)
        if len(execution_steps) < 6:
            result.add_warning(f"Only {len(execution_steps)} execution steps found (minimum 6 recommended)")

        # Check for common counters (minimum 3)
        counters = re.findall(r'-\s+\*\*[^*]+\*\*:.*?→\s*\[\[([^\]]+)\]\].*?\(Success Rate:', content)
        if len(counters) < 3:
            result.add_warning(f"Only {len(counters)} common counters found (minimum 3 recommended)")

        # Check for success probabilities
        if 'Success Probability' not in content:
            result.add_error("Missing Success Probability")

        # Validate success rate percentages
        self._validate_success_rates(result, content)

        # Check for physical requirements (all 4)
        phys_reqs = ['Strength Requirements', 'Flexibility Requirements', 'Coordination Requirements', 'Speed Requirements']
        missing_reqs = [req for req in phys_reqs if f'**{req}**' not in content]
        if missing_reqs:
            result.add_warning(f"Missing physical requirements: {', '.join(missing_reqs)}")

        # Check for knowledge questions (minimum 5)
        question_patterns = [
            r'\*\*Mechanical Understanding\*\*:',
            r'\*\*Timing Recognition\*\*:',
            r'\*\*Error Prevention\*\*:',
            r'\*\*Setup Requirements\*\*:',
            r'\*\*Adaptation\*\*:',
        ]
        question_count = sum(1 for pattern in question_patterns if re.search(pattern, content))
        if question_count < 5:
            result.add_warning(f"Only {question_count} knowledge questions found (minimum 5 recommended)")

        # Check for expert insights from all three
        experts = ['Danaher', 'Gordon Ryan', 'Eddie Bravo']
        for expert in experts:
            if expert not in content:
                result.add_warning(f"Missing {expert} expert insight")

    def _validate_submission(self, result: FileValidationResult, frontmatter: Dict, body: str, content: str):
        """Validate Submission content."""
        # Check for Submission ID (SUB### or S### for legacy)
        sub_id_match = re.search(r'\*\*Submission ID\*\*:\s*(SUB\d{3}|S\d{3})', content)
        if not sub_id_match:
            result.add_error("Missing or invalid Submission ID (format: SUB### or S###)")
        else:
            sub_id = sub_id_match.group(1)
            if sub_id in self.all_ids and self.all_ids[sub_id] != Path(result.file_path).stem:
                result.add_error(f"Duplicate Submission ID {sub_id} (also in {self.all_ids[sub_id]})")

            # Recommend SUB### format
            if sub_id.startswith('S') and not sub_id.startswith('SUB'):
                result.add_info("Consider updating to SUB### format (current S### is legacy)")

        # Check for SAFETY section (mandatory for submissions)
        safety_patterns = [
            r'###?\s*Safety Considerations',
            r'##\s*Safety Considerations',
            r'###?\s*Safety',
        ]
        has_safety = any(re.search(pattern, content, re.IGNORECASE) for pattern in safety_patterns)
        if not has_safety:
            result.add_error("MANDATORY: Missing Safety Considerations section")

        # Check for required sections
        required_sections = [
            ('Visual Execution Sequence', r'###\s*Visual Execution Sequence'),
            ('Execution Steps', r'###\s*Execution Steps'),
            ('Expert Insights', r'###\s*Expert Insights'),
            ('Common Errors', r'###\s*Common Errors'),
        ]

        for section_name, pattern in required_sections:
            if not re.search(pattern, content):
                result.add_error(f"Missing required section: {section_name}")

        # Check for setup requirements/execution steps (minimum 6)
        setup_items = re.findall(r'^\d+\.\s+\*\*[^*]+\*\*:', content, re.MULTILINE)
        if len(setup_items) < 6:
            result.add_warning(f"Only {len(setup_items)} setup/execution steps found (minimum 6 recommended)")

        # Check for submission properties
        sub_props = ['Starting State', 'Ending State', 'Submission Type']
        missing_props = [prop for prop in sub_props if f'**{prop}**' not in content]
        if missing_props:
            result.add_warning(f"Missing submission properties: {', '.join(missing_props)}")

        # Validate that Ending State is "Won by Submission" for submissions
        ending_state_match = re.search(r'\*\*Ending State\*\*:\s*\[\[([^\]]+)\]\]', content)
        if ending_state_match:
            ending_state = ending_state_match.group(1)
            if ending_state != 'Won by Submission':
                result.add_warning(f"Ending State should be [[Won by Submission]], found [[{ending_state}]]")

        # Validate success rates
        self._validate_success_rates(result, content)

        # Check for expert insights from all three
        experts = ['Danaher', 'Gordon Ryan', 'Eddie Bravo']
        for expert in experts:
            if expert not in content:
                result.add_warning(f"Missing {expert} expert insight")

    def _validate_concept(self, result: FileValidationResult, frontmatter: Dict, body: str, content: str):
        """Validate Concept content."""
        # Check for Concept ID
        concept_id_match = re.search(r'\*\*Concept ID\*\*:\s*(C\d{3})', content)
        if not concept_id_match:
            result.add_warning("Missing Concept ID (format: C###) - recommended for consistency")
        else:
            concept_id = concept_id_match.group(1)
            if concept_id in self.all_ids and self.all_ids[concept_id] != Path(result.file_path).stem:
                result.add_error(f"Duplicate Concept ID {concept_id} (also in {self.all_ids[concept_id]})")

        # Check for required sections
        required_sections = [
            ('Concept Properties', r'##\s*Concept Properties'),
            ('Key Principles', r'##\s*Key Principles'),
            ('Application Contexts', r'##\s*Application Contexts'),
            ('Developmental Metrics', r'##\s*Developmental Metrics'),
            ('Expert Insights', r'##\s*Expert Insights'),
        ]

        for section_name, pattern in required_sections:
            if not re.search(pattern, content):
                result.add_warning(f"Missing recommended section: {section_name}")

        # Check that concepts DON'T have success rates (they're principles, not techniques)
        if re.search(r'Success Rate:\s*Beginner.*?Intermediate.*?Advanced', content):
            result.add_warning("Concepts should not have success rates (they are principles, not techniques)")

        # Check for concept relationships
        if not re.search(r'##\s*Concept Relationships', content):
            result.add_info("Missing Concept Relationships section - recommended for context")

        # Check for expert insights from all three
        experts = ['Danaher', 'Gordon Ryan', 'Eddie Bravo']
        for expert in experts:
            if expert not in content:
                result.add_info(f"Missing {expert} expert insight - recommended for comprehensive coverage")

    def _validate_system(self, result: FileValidationResult, frontmatter: Dict, body: str, content: str):
        """Validate System content."""
        # Check for Chain ID
        chain_id_match = re.search(r'\*\*Chain ID\*\*:\s*(SC\d{3})', content)
        if not chain_id_match:
            result.add_warning("Missing Chain ID (format: SC###) - recommended for consistency")
        else:
            chain_id = chain_id_match.group(1)
            if chain_id in self.all_ids and self.all_ids[chain_id] != Path(result.file_path).stem:
                result.add_error(f"Duplicate Chain ID {chain_id} (also in {self.all_ids[chain_id]})")

        # Check for required sections
        required_sections = [
            ('Chain Properties', r'##\s*Chain Properties'),
            ('Decision Tree', r'##\s*Decision Tree'),
            ('Submission Sequence', r'##\s*Submission Sequence'),
            ('Expert Insights', r'##\s*Expert Insights'),
        ]

        for section_name, pattern in required_sections:
            if not re.search(pattern, content):
                result.add_warning(f"Missing recommended section: {section_name}")

        # Check for primary submissions (minimum 2)
        primary_subs_match = re.search(r'\*\*Primary Submissions\*\*:\s*(.*?)(?=\n-|\n\*\*|\Z)', content, re.DOTALL)
        if primary_subs_match:
            primary_subs = re.findall(r'\[\[([^\]]+)\]\]', primary_subs_match.group(1))
            if len(primary_subs) < 2:
                result.add_warning(f"Only {len(primary_subs)} primary submissions found (minimum 2 recommended)")

        # Check for decision tree structure
        if 'If ' in content and '→' in content:
            # Good, has decision tree logic
            pass
        else:
            result.add_warning("Decision Tree section should include if/then logic with → transitions")

        # Check for expert insights
        experts = ['Danaher', 'Gordon Ryan', 'Eddie Bravo']
        expert_count = sum(1 for expert in experts if expert in content)
        if expert_count < 2:
            result.add_info("Consider adding expert insights from multiple authorities")

    def _validate_success_rates(self, result: FileValidationResult, content: str):
        """Validate success rate percentages are realistic and properly ordered."""
        # Find all success rate patterns
        rate_patterns = [
            r'Beginner\s*(\d+)%',
            r'Intermediate\s*(\d+)%',
            r'Advanced\s*(\d+)%',
        ]

        for line_num, line in enumerate(content.split('\n'), 1):
            if 'Success Rate' in line or 'Success Probability' in line:
                rates = {}
                for level, pattern in [('Beginner', rate_patterns[0]),
                                      ('Intermediate', rate_patterns[1]),
                                      ('Advanced', rate_patterns[2])]:
                    match = re.search(pattern, line)
                    if match:
                        rate = int(match.group(1))
                        rates[level] = rate

                        # Check if percentage is realistic (0-100)
                        if rate < 0 or rate > 100:
                            result.add_error(f"Invalid {level} success rate: {rate}% (must be 0-100)", line_num)

                # Check ordering (Beginner ≤ Intermediate ≤ Advanced)
                if 'Beginner' in rates and 'Intermediate' in rates:
                    if rates['Beginner'] > rates['Intermediate'] + 5:  # Allow 5% tolerance
                        result.add_info(
                            f"Unusual: Beginner rate ({rates['Beginner']}%) > Intermediate ({rates['Intermediate']}%)",
                            line_num
                        )

                if 'Intermediate' in rates and 'Advanced' in rates:
                    if rates['Intermediate'] > rates['Advanced'] + 5:
                        result.add_info(
                            f"Unusual: Intermediate rate ({rates['Intermediate']}%) > Advanced ({rates['Advanced']}%)",
                            line_num
                        )

                # Check that all three levels are present
                if len(rates) < 3:
                    result.add_warning(f"Incomplete success rates (found {len(rates)}/3 levels)", line_num)

    def _validate_seo(self, result: FileValidationResult, frontmatter: Dict, body: str, content_type: str):
        """Validate SEO elements."""
        # Check for title in frontmatter
        if 'title' not in frontmatter:
            result.add_warning("Missing title in frontmatter")
        else:
            title = frontmatter['title']
            # Validate title format based on content type
            expected_patterns = {
                'Position': r'.+\s*\|\s*BJJ Position Guide\s*\|\s*BJJ Graph',
                'Transition': r'.+\s*\|\s*BJJ Technique\s*\|\s*BJJ Graph',
                'Submission': r'.+\s*\|\s*BJJ Submission\s*\|\s*BJJ Graph',
                'Concept': r'.+\s*\|\s*BJJ Concept\s*\|\s*BJJ Graph',
                'System': r'.+\s*\|\s*BJJ System\s*\|\s*BJJ Graph',
            }

            if content_type in expected_patterns:
                if not re.search(expected_patterns[content_type], title):
                    result.add_info(f"Title doesn't follow recommended template for {content_type}")

        # Check for description in frontmatter
        if 'description' not in frontmatter:
            result.add_warning("Missing description in frontmatter")
        else:
            desc = frontmatter['description']
            # Check description length (recommended 150-160 characters)
            if len(desc) < 120:
                result.add_info(f"Description is short ({len(desc)} chars, recommended 150-160)")
            elif len(desc) > 160:
                result.add_warning(f"Description is long ({len(desc)} chars, recommended 150-160)")

            # Check if description follows template
            template_keywords = ['Master', 'Learn', 'Complete guide', 'Step-by-step', 'BJJ', 'Understand']
            has_template_keyword = any(kw in desc for kw in template_keywords)
            if not has_template_keyword:
                result.add_info("Description doesn't follow recommended template format")

            # Check for success rates in description (for positions, transitions, submissions)
            if content_type in ['Position', 'Transition', 'Submission']:
                if not re.search(r'\d+%', desc):
                    result.add_info("Description should include success rates for SEO")

    def _validate_wikilinks(self):
        """Validate all wikilinks resolve to existing files."""
        for filename, links in self.wikilinks.items():
            # Find the result for this file
            file_result = next(
                (r for r in self.results if Path(r.file_path).stem == filename),
                None
            )

            if not file_result:
                continue

            for link in links:
                # Clean the link (remove any modifiers after |)
                clean_link = link.split('|')[0].strip()

                # Skip common special cases
                if clean_link in ['Won by Submission', 'Guard Opening Sequence', 'Posture and Base']:
                    continue

                # Check if link exists in our files
                if clean_link not in self.all_files:
                    # Check if it's a state/transition ID
                    if clean_link not in self.all_ids:
                        file_result.add_warning(f"Wikilink [[{clean_link}]] does not resolve to existing file")

    def _generate_summary(self) -> Dict:
        """Generate validation summary."""
        total_files = len(self.results)
        passed_files = sum(1 for r in self.results if r.passed)
        failed_files = total_files - passed_files

        total_errors = sum(len(r.errors) for r in self.results)
        total_warnings = sum(len(r.warnings) for r in self.results)
        total_info = sum(len(r.info) for r in self.results)

        by_type = defaultdict(lambda: {'total': 0, 'passed': 0, 'failed': 0, 'errors': 0, 'warnings': 0})
        for result in self.results:
            by_type[result.content_type]['total'] += 1
            if result.passed:
                by_type[result.content_type]['passed'] += 1
            else:
                by_type[result.content_type]['failed'] += 1
            by_type[result.content_type]['errors'] += len(result.errors)
            by_type[result.content_type]['warnings'] += len(result.warnings)

        return {
            'total_files': total_files,
            'passed': passed_files,
            'failed': failed_files,
            'total_errors': total_errors,
            'total_warnings': total_warnings,
            'total_info': total_info,
            'by_type': dict(by_type),
            'results': self.results
        }


def print_results(summary: Dict, verbose: bool = False):
    """Print validation results in a readable format."""
    print("\n" + "="*80)
    print("BJJ GRAPH CONTENT VALIDATION REPORT")
    print("="*80 + "\n")

    # Summary statistics
    print("SUMMARY:")
    print(f"  Total Files Validated: {summary['total_files']}")
    print(f"  ✓ Passed: {summary['passed']}")
    print(f"  ✗ Failed: {summary['failed']}")
    print(f"  Total Errors: {summary['total_errors']}")
    print(f"  Total Warnings: {summary['total_warnings']}")
    print(f"  Total Info: {summary['total_info']}")
    print()

    # By content type
    print("BY CONTENT TYPE:")
    for content_type, stats in sorted(summary['by_type'].items()):
        print(f"  {content_type}:")
        print(f"    Total: {stats['total']}, Passed: {stats['passed']}, Failed: {stats['failed']}")
        print(f"    Errors: {stats['errors']}, Warnings: {stats['warnings']}")
    print()

    # Detailed results
    failed_results = [r for r in summary['results'] if not r.passed]
    warned_results = [r for r in summary['results'] if r.passed and r.warnings]

    if failed_results:
        print("="*80)
        print("FILES WITH ERRORS:")
        print("="*80)
        for result in failed_results:
            print(f"\n✗ {Path(result.file_path).name}")
            print(f"  Path: {result.file_path}")
            print(f"  Type: {result.content_type}")

            for error in result.errors:
                line_info = f" (line {error.line_number})" if error.line_number else ""
                print(f"  ERROR: {error.message}{line_info}")

            if verbose:
                for warning in result.warnings:
                    line_info = f" (line {warning.line_number})" if warning.line_number else ""
                    print(f"  WARNING: {warning.message}{line_info}")

    if verbose and warned_results:
        print("\n" + "="*80)
        print("FILES WITH WARNINGS:")
        print("="*80)
        for result in warned_results:
            print(f"\n✓ {Path(result.file_path).name}")
            print(f"  Path: {result.file_path}")
            print(f"  Type: {result.content_type}")

            for warning in result.warnings:
                line_info = f" (line {warning.line_number})" if warning.line_number else ""
                print(f"  WARNING: {warning.message}{line_info}")

            for info in result.info:
                line_info = f" (line {info.line_number})" if info.line_number else ""
                print(f"  INFO: {info.message}{line_info}")

    print("\n" + "="*80)
    if summary['failed'] == 0:
        print("✓ ALL FILES PASSED VALIDATION!")
    else:
        print(f"✗ {summary['failed']} file(s) failed validation")
    print("="*80 + "\n")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Validate BJJ Graph content files against YAML schema standards',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python validate_content.py source/content/
  python validate_content.py source/content/ --verbose
  python validate_content.py source/content/ --type Positions
  python validate_content.py source/content/ --type Transitions --verbose
  python validate_content.py source/content/ --strict
        """
    )

    parser.add_argument(
        'content_dir',
        help='Path to content directory to validate'
    )

    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Show detailed output including warnings and info messages'
    )

    parser.add_argument(
        '--strict', '-s',
        action='store_true',
        help='Strict mode: treat warnings as errors'
    )

    parser.add_argument(
        '--type', '-t',
        choices=['Positions', 'Transitions', 'Submissions', 'Concepts', 'Systems'],
        help='Validate only specific content type'
    )

    args = parser.parse_args()

    # Validate content directory exists
    if not os.path.isdir(args.content_dir):
        print(f"Error: Content directory '{args.content_dir}' does not exist", file=sys.stderr)
        sys.exit(1)

    # Run validation
    validator = ContentValidator(args.content_dir, verbose=args.verbose, strict=args.strict)
    summary = validator.validate_all(content_type=args.type)

    # Print results
    print_results(summary, verbose=args.verbose)

    # Exit with appropriate code
    sys.exit(0 if summary['failed'] == 0 else 1)


if __name__ == '__main__':
    main()
