// Deployment gate: execute authored/undated fixtures against the real transformer and
// Head, then inspect actual served output. No browser navigation or harness stubs.
// Covers publication provenance and OG/JSON-LD agreement; not first observed CDN deployment.
// The corpus guard measures UTC days, span and largest day share PER FIELD. It must catch
// both checkout publication stamps and lastmod's dormant modification build-clock fallback;
// a "recent" check passes the latter, and millisecond cardinality passes the former.
// Healthy modification has a measured 37.7% day cluster, so the ceiling is 50%, not 25%.
import { test, expect } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const requireFromSource = createRequire(path.join(ROOT, "source/package.json"));
const matter = requireFromSource("gray-matter");

test("@curated publication provenance survives clones and worktrees in the real renderer", () => {
  const output = execFileSync(
    process.execPath,
    ["--test", "tests/published_time.test.mjs", "tests/git_date_maps.test.mjs"],
    {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 30_000,
    },
  );
  expect(output).toMatch(/# pass [1-9]\d*/);
  expect(output).toContain("# fail 0");
});

test("@curated served publication metadata matches authored or followed Git evidence", async ({
  request,
}) => {
  const pages = [
    ["Positions/Mount/Top", "Positions/Mount/Top"],
    ["Principles", "Principles"],
    // Refactor sentinel: first-add says 2026-02-09; --follow reaches 2025-06-15.
    ["Transitions/100-percent-Sweep", "Transitions/100% Sweep"],
    [
      "Submissions/Anaconda-Choke/from-Dead-Orchard/Attacker",
      "Submissions/Anaconda Choke/from Dead Orchard/Attacker",
    ],
    [
      "Transitions/Mount-to-Armbar/Attacker",
      "Transitions/Mount to Armbar/Attacker",
    ],
  ];
  for (const [route, source] of pages) {
    const { data } = matter(
      fs.readFileSync(path.join(ROOT, "content", `${source}.md`), "utf8"),
    );
    const authored = data.publishDate ?? data.date;
    const oldest =
      authored === undefined
        ? execFileSync(
            "git",
            ["log", "--follow", "--format=%aI", "--", `content/${source}.md`],
            {
              cwd: ROOT,
              encoding: "utf8",
            },
          )
            .trim()
            .split("\n")
            .at(-1)
        : authored;
    const expected = oldest ? new Date(oldest).toISOString() : undefined;
    const response = await request.get(`/${route}.html`);
    expect(response.ok(), route).toBeTruthy();
    const html = await response.text();
    const publication = html.match(
      /<meta property="article:published_time" content="([^"]+)"/,
    );
    const publicationTags =
      html.match(/<meta property="article:published_time"/g) ?? [];
    expect(publicationTags.length, `${route}: publication tag count`).toBe(
      expected === undefined ? 0 : 1,
    );
    if (publication?.[1] !== expected) {
      // Keep the independent --follow oracle and date equality intact. Capture the
      // actual runner's history on failure so its cause is reproducible off CI.
      const inspectGit = (args: string[]) => {
        const result = spawnSync("git", args, {
          cwd: ROOT,
          encoding: "utf8",
          timeout: 10_000,
        });
        return {
          args,
          status: result.status,
          stdout: result.stdout,
          stderr: result.stderr,
          error: result.error?.message,
        };
      };
      await test.info().attach("publication-git-evidence", {
        contentType: "application/json",
        body: JSON.stringify(
          {
            route,
            source,
            authored,
            oldest,
            expected,
            received: publication?.[1],
            git: [
              inspectGit(["--version"]),
              inspectGit([
                "rev-parse",
                "--show-toplevel",
                "--is-shallow-repository",
                "HEAD",
              ]),
              inspectGit(["show", "-s", "--format=%H %P %aI %cI", "HEAD"]),
              inspectGit([
                "status",
                "--porcelain",
                "--",
                `content/${source}.md`,
              ]),
              inspectGit([
                "log",
                "--follow",
                "--format=%H %aI %P",
                "--",
                `content/${source}.md`,
              ]),
              inspectGit([
                "-c",
                "core.commitGraph=false",
                "log",
                "--follow",
                "--format=%H %aI %P",
                "--",
                `content/${source}.md`,
              ]),
              inspectGit([
                "config",
                "--show-origin",
                "--get-regexp",
                "^(core\\.(commitgraph|ignorecase)|diff\\.(renames|renamelimit)|log\\.follow)$",
              ]),
            ],
          },
          null,
          2,
        ),
      });
    }
    expect(publication?.[1], `${route}: publication`).toBe(expected);
    const modified = html.match(
      /<meta property="article:modified_time" content="([^"]+)"/,
    );
    expect(modified?.[1], `${route}: modification retained`).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    );
    const schemas = [
      ...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g),
    ]
      .map((match) => JSON.parse(match[1]))
      .filter((schema) =>
        ["WebPage", "Article", "CollectionPage"].includes(schema["@type"]),
      );
    expect(schemas.length, `${route}: enriched entities`).toBeGreaterThan(0);
    for (const schema of schemas) {
      expect(schema.datePublished, route).toBe(expected);
      expect(schema.dateModified, route).toBe(modified?.[1]);
    }
  }
});

test("@curated publication AND modification dates retain corpus-wide temporal spread", () => {
  // This scans the entire emit, including HTML parsing, rather than sampled metadata.
  // The shared-host control exceeded 120s; bound it without mistaking timeout for a red assertion.
  test.setTimeout(360_000);
  const result = spawnSync("python3", ["scripts/check_publication_dates.py"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 300_000,
  });
  // Preserve the real failure text: an opaque subprocess error is not a red assertion.
  expect(result.error, result.error?.message).toBeUndefined();
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(result.stdout).toContain(
    "PASS all per-field coverage, spread, and OG/JSON-LD agreement checks",
  );
});
