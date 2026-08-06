import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { lint } from "./lint.ts";

/** Fields App Store Connect requires, keyed for one locale. */
function submittable(locale: string): Record<string, string> {
  return {
    [`${locale}/name.txt`]: "Focus Timer",
    [`${locale}/description.txt`]: "A simple focus timer.",
    [`${locale}/support_url.txt`]: "https://example.com/support",
    [`${locale}/privacy_url.txt`]: "https://example.com/privacy",
  };
}

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

test("lint rejects an existing metadata folder with zero scannable locales", async () => {
  const root = await makeTree({ "review_information/first_name.txt": "Victor" });
  const report = await lint(root);
  assert.equal(report.ok, false);
  assert.equal(report.errorCount, 1);
  assert.equal(report.locales.length, 0);
  assert.ok(report.findings.some((f) => f.rule === "missing-locale"));
});

test("lint passes a clean locale", async () => {
  const root = await makeTree({
    ...submittable("en-US"),
    "en-US/subtitle.txt": "Simple pomodoro focus",
    "en-US/keywords.txt": "pomodoro,focus,timer,study,deep work",
  });
  const report = await lint(root);
  assert.equal(report.ok, true);
  assert.equal(report.errorCount, 0);
  const enUS = report.locales.find((l) => l.locale === "en-US");
  assert.equal(enUS?.ok, true);
});

test("lint fails a locale with an over-limit field", async () => {
  const root = await makeTree({
    ...submittable("en-US"),
    "en-US/subtitle.txt": "This subtitle is definitely too long to fit",
  });
  const report = await lint(root);
  assert.equal(report.ok, false);
  assert.equal(report.errorCount, 1);
  const enUS = report.locales.find((l) => l.locale === "en-US");
  assert.equal(enUS?.ok, false);
  assert.ok(enUS?.findings.some((f) => f.rule === "field-length" && f.field === "subtitle"));
});

test("lint is not ok overall if any locale fails, but marks clean locales ok", async () => {
  const root = await makeTree({
    ...submittable("en-US"),
    ...submittable("de-DE"),
    "de-DE/subtitle.txt": "x".repeat(40),
  });
  const report = await lint(root);
  assert.equal(report.ok, false);
  assert.equal(report.locales.find((l) => l.locale === "en-US")?.ok, true);
  assert.equal(report.locales.find((l) => l.locale === "de-DE")?.ok, false);
});

test("lint fails a locale that is missing a required field", async () => {
  const root = await makeTree({ "en-US/keywords.txt": "pomodoro,focus,timer" });
  const report = await lint(root);
  assert.equal(report.ok, false);
  const missing = report.findings.filter((f) => f.rule === "required-field");
  assert.deepEqual(missing.map((f) => f.field), ["name", "description", "support_url", "privacy_url"]);
});

test("lint lets the default folder satisfy a required field for every locale", async () => {
  const root = await makeTree({
    "default/support_url.txt": "https://example.com/support",
    "default/privacy_url.txt": "https://example.com/privacy",
    "en-US/name.txt": "Focus Timer",
    "en-US/description.txt": "A simple focus timer.",
    "de-DE/name.txt": "Fokus Timer",
    "de-DE/description.txt": "Ein einfacher Fokus-Timer.",
  });
  const report = await lint(root);
  assert.equal(report.findings.some((f) => f.rule === "required-field"), false);
  assert.equal(report.ok, true);
});

test("lint does not demand required fields of the default folder itself", async () => {
  const root = await makeTree({
    "default/privacy_url.txt": "https://example.com/privacy",
    ...submittable("en-US"),
  });
  const report = await lint(root);
  const onDefault = report.findings.filter((f) => f.rule === "required-field" && f.locale === "default");
  assert.deepEqual(onDefault, []);
  assert.equal(report.ok, true);
});

test("lint checks the default folder when it is the only folder in the tree", async () => {
  const root = await makeTree({ "default/name.txt": "Focus Timer" });
  const report = await lint(root);
  assert.equal(report.ok, false);
  const missing = report.findings.filter((f) => f.rule === "required-field" && f.locale === "default");
  assert.deepEqual(missing.map((f) => f.field), ["description", "support_url", "privacy_url"]);
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
