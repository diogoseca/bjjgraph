// The built-site guard must discriminate failures even in CI's no-build unit job.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("VIDEO2 built-title guard rejects empty coverage, missing pages, wrong titles and SVG-only titles", () => {
  const r = spawnSync("python3", ["-B", "-c", `
from pathlib import Path
from tempfile import TemporaryDirectory
from scripts.check_page_titles import built_title, compare
with TemporaryDirectory() as directory:
    tree = Path(directory)
    page = tree / 'Example.html'
    page.write_text('<html><head><title>Exact &amp; authored</title></head><body><svg><title>icon</title></svg></body></html>')
    assert built_title(page) == 'Exact & authored'
    assert compare(tree, [{'path': '/Example', 'title': 'Exact & authored'}]) == []
    assert len(compare(tree, [{'path': '/Example', 'title': 'hub instead of role'}])) == 1
    assert len(compare(tree, [{'path': '/Missing', 'title': 'anything'}])) == 1
    try:
        compare(tree, [])
    except ValueError as error:
        assert 'zero' in str(error)
    else:
        raise AssertionError('zero coverage passed')
    for invalid in ['<head></head><svg><title>icon</title></svg>', '<head><title></title></head>', '<head><title>A</title><title>B</title></head>']:
        page.write_text(invalid)
        try:
            built_title(page)
        except ValueError:
            pass
        else:
            raise AssertionError('invalid head title passed')
print('7 title gate discrimination cases asserted')
`], { encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /7 title gate discrimination cases asserted/);
  console.log(r.stdout.trim());
});
