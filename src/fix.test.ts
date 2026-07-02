import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { fixKeywords, fixMetadata, renderFixSummary } from "./fix.ts";

async function makeTree(files: Record<string, string>): Promise<string> {
  const root = join(await mkdtemp(join(tmpdir(), "metaproof-fix-")), "metadata");
  await mkdir(root, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, content, "utf8");
  }
  return root;
}

test("fixKeywords leaves an already-clean field unchanged", () => {
  const fix = fixKeywords("photo,editor,camera");
  assert.equal(fix.changed, false);
  assert.equal(fix.after, "photo,editor,camera");
  assert.equal(fix.charsSaved, 0);
});

test("fixKeywords removes spaces around commas but keeps phrase spaces", () => {
  const fix = fixKeywords("photo editor, camera , deep work");
  assert.equal(fix.after, "photo editor,camera,deep work");
  assert.equal(fix.changed, true);
  assert.equal(fix.charsSaved, 3);
});

test("fixKeywords drops empty terms from double and trailing commas", () => {
  const fix = fixKeywords("photo,,editor,");
  assert.equal(fix.after, "photo,editor");
  assert.equal(fix.droppedEmptyTerms, 2);
});

test("fixKeywords removes case-insensitive duplicates, keeping the first casing", () => {
  const fix = fixKeywords("Photo,editor,photo,Editor");
  assert.equal(fix.after, "Photo,editor");
  assert.deepEqual(fix.removedDuplicates, ["photo", "Editor"]);
});

test("fixKeywords combines all safe cleanups and reports characters saved", () => {
  const fix = fixKeywords("photo, editor, photo, , camera");
  assert.equal(fix.after, "photo,editor,camera");
  assert.equal(fix.droppedEmptyTerms, 1);
  assert.deepEqual(fix.removedDuplicates, ["photo"]);
  assert.equal(fix.charsSaved, "photo, editor, photo, , camera".length - "photo,editor,camera".length);
});

test("fixKeywords trims leading and trailing whitespace on the field", () => {
  assert.equal(fixKeywords("  photo, editor  ").after, "photo,editor");
});

test("fixMetadata rewrites only changed files and preserves the trailing newline", async () => {
  const root = await makeTree({
    "en-US/keywords.txt": "photo, editor, photo\n",
    "de-DE/keywords.txt": "foto,editor\n",
    "fr-FR/name.txt": "Mon App",
  });

  const result = await fixMetadata(root);

  assert.equal(result.applied.length, 1);
  assert.equal(result.applied[0]!.locale, "en-US");
  assert.equal(await readFile(join(root, "en-US/keywords.txt"), "utf8"), "photo,editor\n");
  // Unchanged file is left byte-for-byte alone (still has its newline).
  assert.equal(await readFile(join(root, "de-DE/keywords.txt"), "utf8"), "foto,editor\n");
});

test("fixMetadata handles a file with no trailing newline", async () => {
  const root = await makeTree({ "en-US/keywords.txt": "photo, editor" });
  await fixMetadata(root);
  assert.equal(await readFile(join(root, "en-US/keywords.txt"), "utf8"), "photo,editor");
});

test("fixMetadata skips locales without a keywords field", async () => {
  const root = await makeTree({ "en-US/name.txt": "Focus Timer" });
  const result = await fixMetadata(root);
  assert.equal(result.applied.length, 0);
});

test("renderFixSummary describes a no-op and applied fixes", () => {
  assert.match(renderFixSummary({ root: "/x", applied: [] }), /nothing to fix/i);

  const summary = renderFixSummary({
    root: "/x",
    applied: [
      {
        locale: "en-US",
        filename: "keywords.txt",
        fix: { before: "a, a,", after: "a", changed: true, charsSaved: 4, droppedEmptyTerms: 1, removedDuplicates: ["a"] },
      },
    ],
  });
  assert.match(summary, /en-US\/keywords\.txt/);
  assert.match(summary, /reclaimed 4 characters/);
  assert.match(summary, /removed 1 duplicate/);
  assert.match(summary, /dropped 1 empty term/);
  assert.match(summary, /fixed 1 file/);
});
