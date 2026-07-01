import { test } from "node:test";
import assert from "node:assert/strict";

import { lintKeywords } from "./keywords.ts";
import { defaultConfig } from "./config.ts";
import type { LocaleScan } from "./types.ts";

function scanOf(fields: LocaleScan["fields"]): LocaleScan {
  return { locale: "en-US", isKnownLocale: true, fields, unknownFiles: [] };
}

function ruleMessages(findings: ReturnType<typeof lintKeywords>, rule: string): string[] {
  return findings.filter((f) => f.rule === rule).map((f) => f.message);
}

test("lintKeywords returns nothing when there is no keywords field", () => {
  assert.deepEqual(lintKeywords(scanOf({ name: "MyApp" }), defaultConfig()), []);
});

test("lintKeywords flags spaces after commas as wasted characters", () => {
  const findings = lintKeywords(scanOf({ keywords: "photo, editor, camera" }), defaultConfig());
  assert.equal(findings.some((f) => f.rule === "keyword-space-after-comma"), true);
});

test("lintKeywords does not flag comma-only separators", () => {
  const findings = lintKeywords(scanOf({ keywords: "photo,editor,camera" }), defaultConfig());
  assert.equal(findings.some((f) => f.rule === "keyword-space-after-comma"), false);
});

test("lintKeywords flags a duplicate keyword case-insensitively", () => {
  const findings = lintKeywords(scanOf({ keywords: "photo,editor,Photo" }), defaultConfig());
  const msgs = ruleMessages(findings, "keyword-duplicate");
  assert.equal(msgs.length, 1);
  assert.match(msgs[0]!, /photo/i);
});

test("lintKeywords flags empty terms from double or trailing commas", () => {
  assert.equal(lintKeywords(scanOf({ keywords: "photo,,editor" }), defaultConfig()).some((f) => f.rule === "keyword-empty-term"), true);
  assert.equal(lintKeywords(scanOf({ keywords: "photo,editor," }), defaultConfig()).some((f) => f.rule === "keyword-empty-term"), true);
});

test("lintKeywords flags keywords that duplicate words already in name or subtitle", () => {
  const findings = lintKeywords(scanOf({ name: "Photo Editor", keywords: "photo,camera" }), defaultConfig());
  const msgs = ruleMessages(findings, "keyword-cross-field-duplicate");
  assert.equal(msgs.length, 1);
  assert.match(msgs[0]!, /photo/i);
  assert.doesNotMatch(msgs[0]!, /camera/i);
});

test("lintKeywords flags stop words from the configured list", () => {
  const findings = lintKeywords(scanOf({ keywords: "the,best,camera" }), defaultConfig());
  const msgs = ruleMessages(findings, "keyword-stop-word");
  assert.equal(msgs.length, 1);
  assert.match(msgs[0]!, /the/);
  assert.match(msgs[0]!, /best/);
  assert.doesNotMatch(msgs[0]!, /camera/);
});

test("lintKeywords reports unused keyword capacity as info", () => {
  const findings = lintKeywords(scanOf({ keywords: "cat,dog" }), defaultConfig());
  const f = findings.find((x) => x.rule === "keyword-capacity");
  assert.ok(f);
  assert.equal(f.severity, "info");
  assert.equal(f.count, 7);
  assert.equal(f.limit, 100);
});

test("lintKeywords respects a rule turned off in config", () => {
  const cfg = defaultConfig();
  cfg.rules["keyword-space-after-comma"] = "off";
  const findings = lintKeywords(scanOf({ keywords: "photo, editor" }), cfg);
  assert.equal(findings.some((f) => f.rule === "keyword-space-after-comma"), false);
});
