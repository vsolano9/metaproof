import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { lint } from "./lint.ts";

async function makeTree(files: Record<string, string>): Promise<string> {
  const root = join(await mkdtemp(join(tmpdir(), "metaproof-lint-")), "metadata");
  await mkdir(root, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, content, "utf8");
  }
  return root;
}

test("lint reports a missing metadata folder as not ok", async () => {
  const report = await lint(join(tmpdir(), "metaproof-missing-abc"));
  assert.equal(report.ok, false);
  assert.ok(report.errorCount >= 1);
  assert.ok(report.findings.some((f) => f.rule === "missing-metadata"));
});

test("lint passes a clean locale", async () => {
  const root = await makeTree({
    "en-US/name.txt": "Focus Timer",
    "en-US/subtitle.txt": "Simple pomodoro focus",
    "en-US/keywords.txt": "pomodoro,focus,timer,study,deep work",
    "en-US/description.txt": "A simple focus timer.",
    "en-US/support_url.txt": "https://example.com/support",
  });
  const report = await lint(root);
  assert.equal(report.ok, true);
  assert.equal(report.errorCount, 0);
  const enUS = report.locales.find((l) => l.locale === "en-US");
  assert.equal(enUS?.ok, true);
});

test("lint fails a locale with an over-limit field", async () => {
  const root = await makeTree({
    "en-US/name.txt": "This app name is definitely too long to fit",
  });
  const report = await lint(root);
  assert.equal(report.ok, false);
  assert.equal(report.errorCount, 1);
  const enUS = report.locales.find((l) => l.locale === "en-US");
  assert.equal(enUS?.ok, false);
  assert.ok(enUS?.findings.some((f) => f.rule === "field-length" && f.field === "name"));
});

test("lint is not ok overall if any locale fails, but marks clean locales ok", async () => {
  const root = await makeTree({
    "en-US/name.txt": "Focus Timer",
    "de-DE/subtitle.txt": "x".repeat(40),
  });
  const report = await lint(root);
  assert.equal(report.ok, false);
  assert.equal(report.locales.find((l) => l.locale === "en-US")?.ok, true);
  assert.equal(report.locales.find((l) => l.locale === "de-DE")?.ok, false);
});

test("lint surfaces keyword findings and counts severities consistently", async () => {
  const root = await makeTree({
    "en-US/name.txt": "Photo Editor",
    "en-US/keywords.txt": "photo, editor, camera",
  });
  const report = await lint(root);
  assert.ok(report.findings.some((f) => f.rule === "keyword-cross-field-duplicate"));
  assert.ok(report.findings.some((f) => f.rule === "keyword-space-after-comma"));
  assert.equal(report.errorCount, report.findings.filter((f) => f.severity === "error").length);
  assert.equal(report.warningCount, report.findings.filter((f) => f.severity === "warning").length);
  assert.equal(report.infoCount, report.findings.filter((f) => f.severity === "info").length);
});
