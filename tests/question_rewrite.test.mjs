import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Local data/schema tests; no inference calls. Semantic quality still needs editorial review.
test("question schemas and rewrite application preserve every role and non-question field", () => {
  const result = spawnSync("python3", ["-B", "-c", String.raw`
import copy, json, pathlib, sys, tempfile
sys.path.insert(0, 'scripts')
import jsonschema
from rewrite_questions import ROOT, CATEGORIES, question_schemas, question_limit, scan, check_rewrites, apply_rewrites
limit = question_limit()
assert limit == 100
checked = 0
for category in CATEGORIES:
    paths = list((ROOT / 'templates' / category).glob('*.json'))
    flat = ROOT / 'templates' / (category + '.json')
    if flat.exists(): paths.append(flat)
    for path in paths:
        for schema in question_schemas(json.loads(path.read_text())):
            jsonschema.validate('x' * 99 + '?', schema)
            try: jsonschema.validate('x' * 100 + '?', schema)
            except jsonschema.ValidationError: pass
            else: raise AssertionError(f'{path} permits an overlong question')
            checked += 1
assert checked >= 11, checked
with tempfile.TemporaryDirectory() as tmp:
    root = pathlib.Path(tmp)
    long = 'What should you do ' + 'in this specific position ' * 5 + '?'
    card = {'question': long, 'answer': 'Keep your elbow close to your ribs.',
            'answer_line': 'Elbow to ribs', 'distractors': {'plausible': ['Reach away']},
            'safety_critical': True}
    original = {'name': 'Fixture', 'top': {'flashcards': [card]},
                'bottom': {'flashcards': [copy.deepcopy(card)]},
                'flashcards_position': [copy.deepcopy(card)],
                'flashcards_family': [copy.deepcopy(card)],
                'probability': {'gi': 20, 'nogi': 30}}
    for category in CATEGORIES:
        folder = root / 'content' / category
        folder.mkdir(parents=True)
        data = copy.deepcopy(original)
        if category != 'Positions':
            data['attacker'] = data.pop('top'); data['defender'] = data.pop('bottom')
        (folder / 'Fixture.json').write_text(json.dumps(data))
    counts, too_long, jobs = scan(root, limit)
    assert sum(counts.values()) == len(jobs) == 12
    assert {role for _, role in counts} == {'top', 'bottom', 'attacker', 'defender', 'flashcards_position', 'flashcards_family'}
    response = {'rewrites': [{'id': j['id'], 'question': 'Where should you keep your elbow?'} for j in jobs]}
    valid = check_rewrites(jobs, response, limit)
    for bad in [ {'rewrites': response['rewrites'][:-1]},
                 {'rewrites': response['rewrites'][:-1] + [response['rewrites'][0]]},
                 {'rewrites': [dict(r, question='x' * 100 + '?') for r in response['rewrites']]},
                 {'rewrites': [dict(r, question='Where should\nyour elbow be?') for r in response['rewrites']]} ]:
        try: check_rewrites(jobs, bad, limit)
        except ValueError: pass
        else: raise AssertionError('Invalid model output accepted')
    before = {p: json.loads(p.read_text()) for p in root.rglob('*.json')}
    apply_rewrites(root, jobs, valid)
    from rewrite_questions import at
    for j in jobs:
        at(before[root / j['file']], j['path'])['question'] = valid[j['id']]
    for p, expected in before.items(): assert json.loads(p.read_text()) == expected
    assert not scan(root, limit)[2]
    try: apply_rewrites(root, jobs, valid)
    except ValueError: pass
    else: raise AssertionError('Stale source silently overwritten')
    # Duplicate questions in the same deck would share a progress key. Reject before writing.
    file = root / 'content/Positions/Duplicate.json'
    data = {'flashcards': [card, {'question': 'Where should you keep your elbow?', 'answer': 'At your ribs.'}]}
    file.write_text(json.dumps(data))
    snapshot = file.read_text()
    duplicate_jobs = scan(root, limit)[2]
    try: apply_rewrites(root, duplicate_jobs, {j['id']: 'Where should you keep your elbow?' for j in duplicate_jobs})
    except ValueError: pass
    else: raise AssertionError('Duplicate question accepted')
    assert file.read_text() == snapshot
# Check the actual inference request schema without making a network call. Every supplied
# question, including ordinary words containing r/n, must pass its output contract.
from unittest.mock import patch
from types import SimpleNamespace
from rewrite_questions import infer
with tempfile.TemporaryDirectory() as tmp:
    cache = pathlib.Path(tmp); (cache / 'tmp').mkdir()
    def fake_run(cmd, **kwargs):
        contract = json.loads(cmd[cmd.index('--json-schema') + 1])
        output = {'rewrites': {'1': 'Where should you keep your elbow?', '2': 'How do you retain your underhook?'}}
        jsonschema.validate(output, contract)
        assert cmd[cmd.index('--tools') + 1] == ''
        return SimpleNamespace(returncode=0, stdout=json.dumps({'structured_output': output}), stderr='')
    with patch('rewrite_questions.subprocess.run', side_effect=fake_run):
        result = infer(jobs[:2], limit, 'configured-model', 'low', cache, 'fixture')
    assert set(result) == {j['id'] for j in jobs[:2]}
    assert (cache / 'fixture.json').exists()
    transient = SimpleNamespace(returncode=1, stdout=json.dumps({'is_error': True, 'api_error_status': 500, 'result': 'Temporary server error'}), stderr='')
    calls = []
    def flaky_run(cmd, **kwargs):
        calls.append(cmd)
        return transient if len(calls) == 1 else fake_run(cmd, **kwargs)
    with patch('rewrite_questions.subprocess.run', side_effect=flaky_run), patch('rewrite_questions.time.sleep') as delay:
        retried = infer(jobs[:2], limit, 'configured-model', 'low', cache, 'retry')
    assert retried == result and len(calls) == 2
    delay.assert_called_once_with(10)

print(f'Validated {checked} schema boundaries and all role/tier rewrite protections')
`], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("all authored position, submission and transition questions meet the schema limit", () => {
  const result = spawnSync("python3", ["-B", "scripts/rewrite_questions.py", "--check"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /TOTAL: [1-9][0-9]* questions; 0 need rewriting/);
});
