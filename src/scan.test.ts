import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { scanMetadata } from "./scan.ts";
import { defaultConfig } from "./config.ts";

/** Build a metadata tree from a { "locale/file.txt": content } map. */
async function makeTree(files: Record<string, string>): Promise<string> {
  const root = join(await mkdtemp(join(tmpdir(), "metaproof-scan-")), "metadata");
  await mkdir(root, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, content, "utf8");
  }
  return root;
}

test("scanMetadata reports a missing metadata folder as an error diagnostic", async () => {
  const result = await scanMetadata(join(tmpdir(), "metaproof-nope-xyz"), defaultConfig());
  assert.equal(result.locales.length, 0);
  assert.ok(result.diagnostics.some((d) => d.rule === "missing-metadata" && d.severity === "error"));
});

test("scanMetadata reads locale field files and strips a trailing newline", async () => {
  const root = await makeTree({
    "en-US/name.txt": "MyApp\n",
    "en-US/subtitle.txt": "The great app",
  });
  const result = await scanMetadata(root, defaultConfig());
  const enUS = result.locales.find((l) => l.locale === "en-US");
  assert.ok(enUS);
  assert.equal(enUS.isKnownLocale, true);
  assert.equal(enUS.fields.name, "MyApp");
  assert.equal(enUS.fields.subtitle, "The great app");
});

test("scanMetadata skips non-locale folders like review_information", async () => {
  const root = await makeTree({
    "en-US/name.txt": "MyApp",
    "review_information/first_name.txt": "Victor",
  });
  const result = await scanMetadata(root, defaultConfig());
  assert.ok(result.skippedFolders.includes("review_information"));
  assert.equal(result.locales.some((l) => l.locale === "review_information"), false);
});

test("scanMetadata warns about an unknown locale folder but still scans its fields", async () => {
  const root = await makeTree({ "xx-YY/name.txt": "Hi" });
  const result = await scanMetadata(root, defaultConfig());
  const xx = result.locales.find((l) => l.locale === "xx-YY");
  assert.ok(xx);
  assert.equal(xx.isKnownLocale, false);
  assert.equal(xx.fields.name, "Hi");
  assert.ok(result.diagnostics.some((d) => d.rule === "unknown-locale" && d.locale === "xx-YY"));
});

test("scanMetadata records unrecognised .txt files as unknown files", async () => {
  const root = await makeTree({ "en-US/name.txt": "MyApp", "en-US/whatever.txt": "x" });
  const result = await scanMetadata(root, defaultConfig());
  const enUS = result.locales.find((l) => l.locale === "en-US");
  assert.deepEqual(enUS?.unknownFiles, ["whatever.txt"]);
  assert.ok(result.diagnostics.some((d) => d.rule === "unknown-file"));
});

test("scanMetadata flags an empty field file", async () => {
  const root = await makeTree({ "en-US/name.txt": "MyApp", "en-US/keywords.txt": "   \n" });
  const result = await scanMetadata(root, defaultConfig());
  const enUS = result.locales.find((l) => l.locale === "en-US");
  assert.equal(enUS?.fields.keywords, "");
  assert.ok(result.diagnostics.some((d) => d.rule === "empty-field" && d.field === "keywords"));
});

test("scanMetadata ignores non-txt files such as .DS_Store", async () => {
  const root = await makeTree({ "en-US/name.txt": "MyApp", "en-US/.DS_Store": "junk" });
  const result = await scanMetadata(root, defaultConfig());
  const enUS = result.locales.find((l) => l.locale === "en-US");
  assert.deepEqual(enUS?.unknownFiles, []);
});

test("scanMetadata honours config.locales.ignore", async () => {
  const cfg = defaultConfig();
  cfg.locales.ignore = ["de-DE"];
  const root = await makeTree({ "en-US/name.txt": "A", "de-DE/name.txt": "B" });
  const result = await scanMetadata(root, cfg);
  assert.ok(result.skippedFolders.includes("de-DE"));
  assert.equal(result.locales.some((l) => l.locale === "de-DE"), false);
});

test("scanMetadata treats config.locales.extra codes as known", async () => {
  const cfg = defaultConfig();
  cfg.locales.extra = ["xx-YY"];
  const root = await makeTree({ "xx-YY/name.txt": "Hi" });
  const result = await scanMetadata(root, cfg);
  const xx = result.locales.find((l) => l.locale === "xx-YY");
  assert.equal(xx?.isKnownLocale, true);
  assert.equal(result.diagnostics.some((d) => d.rule === "unknown-locale"), false);
});

test("scanMetadata returns locales sorted by name for stable output", async () => {
  const root = await makeTree({ "fr-FR/name.txt": "A", "de-DE/name.txt": "B", "en-US/name.txt": "C" });
  const result = await scanMetadata(root, defaultConfig());
  assert.deepEqual(result.locales.map((l) => l.locale), ["de-DE", "en-US", "fr-FR"]);
});
