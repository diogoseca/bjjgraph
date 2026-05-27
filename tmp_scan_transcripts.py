#!/usr/bin/env python3
"""Scan transcripts and extract Bash command frequencies."""
import json
import os
import re
import glob
from collections import Counter

def get_leading_token(cmd: str) -> str | None:
    """Extract leading command + first arg/subcommand."""
    cmd = cmd.strip()
    if not cmd or cmd.startswith('#'):
        return None

    # Strip env-var prefixes like FOO=bar command ...
    cmd = re.sub(r'^(?:[A-Z_][A-Z0-9_]*=[^\s]* )+', '', cmd)

    # Handle sudo, timeout
    for prefix in ('sudo ', 'timeout \\d+ '):
        m = re.match(r'^' + prefix, cmd)
        if m:
            cmd = cmd[m.end():]

    tokens = cmd.split()
    if not tokens:
        return None

    lead = tokens[0]
    # For multi-word commands that commonly have subcommands
    if lead in ('git', 'gh', 'docker', 'kubectl', 'npm', 'npx', 'pip', 'pip3',
                'python3', 'python', 'node', 'bun', 'cargo', 'go', 'make'):
        if len(tokens) > 1:
            return f"{lead} {tokens[1]}"
        return lead
    return lead


# Scan project transcript
transcript_paths = glob.glob('/home/runner/.claude/projects/**/*.jsonl', recursive=True)
print(f"Found {len(transcript_paths)} transcript files")

bash_counts = Counter()
mcp_counts = Counter()
blocked_patterns = Counter()  # Commands that got approval-required

for path in transcript_paths:
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue

                msg = obj.get('message', {})
                if msg.get('role') != 'assistant':
                    continue

                for block in msg.get('content', []):
                    if not isinstance(block, dict):
                        continue
                    if block.get('type') != 'tool_use':
                        continue

                    tool = block.get('name', '')
                    inp = block.get('input', {})

                    if tool == 'Bash':
                        cmd = inp.get('command', '')
                        # Check if it was blocked (look at next lines for approval request)
                        token = get_leading_token(cmd)
                        if token:
                            bash_counts[token] += 1
                            # Store raw command for context
                            bash_counts[f'__raw__{token}'] = cmd[:100]
                    elif tool.startswith('mcp__'):
                        mcp_counts[tool] += 1

    except Exception as e:
        print(f"Error processing {path}: {e}")

print("\n=== TOP BASH COMMANDS ===")
# Filter out __raw__ entries for display
real_counts = {k: v for k, v in bash_counts.items() if not k.startswith('__raw__')}
for cmd, count in sorted(real_counts.items(), key=lambda x: -x[1])[:40]:
    raw = bash_counts.get(f'__raw__{cmd}', '')
    print(f"  {count:4d}  {cmd:40s}  [{raw[:60]}]")

print("\n=== MCP CALLS ===")
for tool, count in sorted(mcp_counts.items(), key=lambda x: -x[1])[:20]:
    print(f"  {count:4d}  {tool}")
