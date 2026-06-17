import subprocess

msg = """v1.26.0 - Add flashcards and wikilinks to 3 fundamental position pages

Enriched Mount, Back Control, and Closed Guard position files with:
- 12 flashcards each (6 per role: top/bottom) covering mechanics, timing,
  common errors, and strategic principles for the training/SRS system
- 11-16 inline wikilinks per file linking to related submissions,
  transitions, and positions throughout overview text
- bot_metadata.last_improved tracking for content freshness

Also updated TEMPLATE-DUAL.json and TEMPLATE-FAMILY.json schemas to allow
bot_metadata and flashcard fields in position files.

Discovered systemic gap: all 1,200+ JSON source files had 0 inline
wikilinks and all 83 position files had 0 flashcards.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"""

result = subprocess.run(['git', 'commit', '-m', msg], capture_output=True, text=True)
print('stdout:', result.stdout)
print('stderr:', result.stderr)
print('return code:', result.returncode)
