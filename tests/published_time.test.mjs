// Exercises the real transformer AND rendered Head, not a source-text approximation.
// Authored dates win; otherwise publication follows the earliest Markdown history across
// renames, copies and regeneration. Untracked notes, missing repositories and shallow
// history remain unknown. All original absence/tag-count/schema/modification assertions
// remain, now applied to genuinely unknown history rather than tracked full-history files.
// Not covered: observed first CDN deployment or shallow-history modification-date fidelity.
// The companion @curated journey guards the real corpus, including per-field date spread.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "source/package.json"));
const { tsImport } = require("tsx/esm/api");
const options = {
  parentURL: import.meta.url,
  tsconfig: path.join(ROOT, "source/tsconfig.json"),
};
const { CreatedModifiedDate } = await tsImport(
  "../source/quartz/plugins/transformers/lastmod.ts",
  options,
);
const { default: makeHead } = await tsImport(
  "../source/quartz/components/Head.tsx",
  options,
);
const { render } = require("preact-render-to-string");

const COMMITTED = "2020-02-03T04:05:06.000Z";
const AUTHORED = "2018-06-07T08:09:10.000Z";

async function transform(cwd, frontmatter = {}, filename = "Note.md") {
  const file = {
    cwd: path.join(cwd, "source"),
    data: {
      filePath: `../content/${filename}`,
      slug: "Note",
      frontmatter: { title: "Note", ...frontmatter },
      schemas: ["WebPage", "Article", "CollectionPage"].map((type) => ({
        "@type": type,
      })),
    },
  };
  await CreatedModifiedDate().markdownPlugins({})[0]()({}, file);
  return file.data;
}

function head(data) {
  const html = render(
    makeHead()({
      cfg: {
        locale: "en-US",
        baseUrl: "example.invalid",
        theme: { cdnCaching: false },
      },
      fileData: data,
      externalResources: { css: [], js: [] },
    }),
  );
  const publication = html.match(
    /<meta property="article:published_time" content="([^"]+)"/,
  );
  const publicationTags = (
    html.match(/<meta property="article:published_time"/g) ?? []
  ).length;
  const modification = html.match(
    /<meta property="article:modified_time" content="([^"]+)"/,
  );
  const schemas = [
    ...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g),
  ]
    .map((match) => JSON.parse(match[1]))
    .filter((schema) =>
      ["WebPage", "Article", "CollectionPage"].includes(schema["@type"]),
    );
  assert.equal(
    schemas.length,
    3,
    "all enriched entity types must actually be rendered",
  );
  return {
    html,
    publication: publication?.[1],
    publicationTags,
    modification: modification?.[1],
    schemas,
  };
}

function fixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "published-time-"));
  const original = path.join(tmp, "original");
  fs.mkdirSync(path.join(original, "content"), { recursive: true });
  fs.mkdirSync(path.join(original, "source"));
  fs.writeFileSync(path.join(original, "source/.keep"), "");
  fs.writeFileSync(path.join(original, "content/Note.md"), "# Note\n");
  const git = (...args) =>
    execFileSync("git", ["-C", original, ...args], {
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: COMMITTED,
        GIT_COMMITTER_DATE: COMMITTED,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
  git("init", "-q");
  git("add", "content/Note.md", "source/.keep");
  git(
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-qm",
    "Add note",
  );
  return { tmp, original, git };
}

test("unknown publication never invents checkout or build dates across repository shapes", async () => {
  const { tmp, original, git } = fixture();
  try {
    const clone = path.join(tmp, "clone");
    const worktree = path.join(tmp, "worktree");
    const shallow = path.join(tmp, "shallow");
    git("clone", "-q", original, clone);
    git("worktree", "add", "-q", "--detach", worktree);
    git("clone", "-q", "--depth=1", `file://${original}`, shallow);
    assert.ok(fs.statSync(path.join(clone, ".git")).isDirectory());
    assert.ok(fs.statSync(path.join(worktree, ".git")).isFile());
    assert.equal(
      execFileSync("git", [
        "-C",
        shallow,
        "rev-parse",
        "--is-shallow-repository",
      ])
        .toString()
        .trim(),
      "true",
    );
    for (const cwd of [original, clone, worktree, shallow]) {
      const tracked = await transform(cwd);
      assert.equal(tracked.dates.modified.toISOString(), COMMITTED, cwd);
      if (cwd === shallow) {
        assert.equal(
          head(tracked).publicationTags,
          0,
          "a shallow boundary is not publication",
        );
      }
      fs.writeFileSync(path.join(cwd, "content/Unknown.md"), "# Untracked\n");
      const data = await transform(cwd, { lastmod: COMMITTED }, "Unknown.md");
      const result = head(data);
      assert.equal(
        result.publication,
        undefined,
        "unknown publication must be omitted, not checkout birthtime",
      );
      assert.equal(
        result.publicationTags,
        0,
        "unknown publication must not leave an empty meta tag",
      );
      assert.equal(
        data.dates.published,
        undefined,
        "missing publishDate must not become the build clock",
      );
      assert.equal(result.modification, COMMITTED);
      for (const schema of result.schemas) {
        assert.equal(schema.datePublished, undefined);
        assert.equal(schema.dateModified, COMMITTED);
      }
      const authored = head(await transform(cwd, { publishDate: AUTHORED }));
      assert.equal(authored.publication, AUTHORED);
      for (const schema of authored.schemas)
        assert.equal(schema.datePublished, AUTHORED);
    }
    fs.writeFileSync(
      path.join(original, "content/Untracked.md"),
      "# Not published\n",
    );
    assert.equal(
      head(await transform(original, {}, "Untracked.md")).publication,
      undefined,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("authored publication wins over creation; missing and invalid publication stay absent", async () => {
  const { tmp, original } = fixture();
  try {
    fs.writeFileSync(
      path.join(original, "content/Unknown.md"),
      "# Untracked\n",
    );
    for (const [frontmatter, expected] of [
      [{ publishDate: AUTHORED, date: "2017-01-01" }, AUTHORED],
      [{ date: "2017-01-01" }, "2017-01-01T00:00:00.000Z"],
      [{ publishDate: "2018-06-07T10:09:10+02:00" }, AUTHORED],
      [{ publishDate: "not a date" }, undefined],
      [{}, undefined],
    ]) {
      const unknown = Object.keys(frontmatter).length === 0;
      const data = await transform(
        original,
        unknown ? { lastmod: COMMITTED } : frontmatter,
        unknown ? "Unknown.md" : "Note.md",
      );
      const result = head(data);
      assert.equal(result.publication, expected, JSON.stringify(frontmatter));
      assert.equal(result.publicationTags, expected === undefined ? 0 : 1);
      assert.equal(data.dates.published?.toISOString(), expected);
      for (const schema of result.schemas)
        assert.equal(schema.datePublished, expected);
      assert.equal(result.modification, COMMITTED);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("git publication follows a refactor, copies, and regeneration back to Markdown history", async () => {
  const { tmp, original, git } = fixture();
  const commit = (date, message) => {
    git("add", "-A");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-qm",
      message,
      "--date",
      date,
    );
  };
  try {
    fs.mkdirSync(path.join(original, "content", "Moved"));
    git("mv", "content/Note.md", "content/Moved/Note.md");
    fs.writeFileSync(
      path.join(original, "content/Moved/Note.json"),
      '{"title":"Later JSON migration"}\n',
    );
    commit("2021-03-04T05:06:07Z", "Refactor and introduce authored JSON");
    for (const cwd of [original]) {
      const result = head(await transform(cwd, {}, "Moved/Note.md"));
      assert.equal(
        result.publication,
        COMMITTED,
        "rename must preserve the pre-refactor Markdown date",
      );
      assert.equal(result.publicationTags, 1);
      for (const schema of result.schemas)
        assert.equal(schema.datePublished, COMMITTED);
    }

    // --follow also traverses deletion/regeneration; stopping at the latest A is wrong.
    git("rm", "content/Moved/Note.md");
    commit("2022-04-05T06:07:08Z", "Remove generated Markdown");
    fs.writeFileSync(path.join(original, "content/Moved/Note.md"), "# Note\n");
    commit("2023-05-06T07:08:09Z", "Regenerate Markdown");
    assert.equal(
      head(await transform(original, {}, "Moved/Note.md")).publication,
      COMMITTED,
    );

    // A real copy is part of --follow's behavior, not just R100 renames.
    const prose = Array.from(
      { length: 30 },
      (_, i) => `Original paragraph ${i}.`,
    ).join("\n");
    fs.writeFileSync(path.join(original, "content/Parent.md"), prose);
    commit("2021-01-02T03:04:05Z", "Add parent page");
    fs.writeFileSync(
      path.join(original, "content/Child.md"),
      prose + "\nChild detail.\n",
    );
    fs.appendFileSync(
      path.join(original, "content/Parent.md"),
      "\nParent detail.\n",
    );
    commit("2024-06-07T08:09:10Z", "Derive child page");
    assert.equal(
      head(await transform(original, {}, "Child.md")).publication,
      "2021-01-02T03:04:05.000Z",
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("tracked publication is identical in independent full-history checkouts", async () => {
  const { tmp, original, git } = fixture();
  try {
    const clone = path.join(tmp, "clone");
    const worktree = path.join(tmp, "worktree");
    git("clone", "-q", original, clone);
    git("worktree", "add", "-q", "--detach", worktree);
    for (const cwd of [original, clone, worktree]) {
      const result = head(await transform(cwd));
      assert.equal(result.publication, COMMITTED, cwd);
      assert.equal(result.publicationTags, 1);
      for (const schema of result.schemas)
        assert.equal(schema.datePublished, COMMITTED);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("a missing repository provides no publication date and does not abort rendering", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "published-time-no-git-"));
  try {
    fs.mkdirSync(path.join(tmp, "content"));
    fs.mkdirSync(path.join(tmp, "source"));
    fs.writeFileSync(path.join(tmp, "content/Note.md"), "# Untracked\n");
    const data = await transform(tmp);
    const result = head(data);
    assert.equal(data.dates.published, undefined);
    assert.equal(result.publicationTags, 0);
    for (const schema of result.schemas)
      assert.equal(schema.datePublished, undefined);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("git publication follows copies whose source was not modified in the copying commit", async () => {
  const { tmp, original, git } = fixture();
  try {
    fs.copyFileSync(
      path.join(original, "content/Note.md"),
      path.join(original, "content/Copy.md"),
    );
    git("add", "content/Copy.md");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-qm",
      "Copy an unchanged source",
      "--date",
      "2025-01-02T03:04:05Z",
    );
    const followed = git(
      "log",
      "--follow",
      "--format=%aI",
      "--",
      "content/Copy.md",
    )
      .toString()
      .trim()
      .split("\n")
      .at(-1);
    assert.equal(
      new Date(followed).toISOString(),
      COMMITTED,
      "fixture must actually exercise --follow's unchanged-source copy detection",
    );
    const result = head(await transform(original, {}, "Copy.md"));
    assert.equal(
      result.publication,
      COMMITTED,
      "--find-copies alone misses unchanged copy sources",
    );
    assert.equal(result.publicationTags, 1);
    for (const schema of result.schemas)
      assert.equal(schema.datePublished, COMMITTED);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
