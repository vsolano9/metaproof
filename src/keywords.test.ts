import { test } from "node:test";
import assert from "node:assert/strict";

import { lintKeywords, separatorWhitespaceBytes } from "./keywords.ts";
import { defaultConfig } from "./config.ts";
import { utf8ByteCount } from "./count.ts";
import { fixKeywords } from "./fix.ts";
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

test("lintKeywords reports keyword capacity in UTF-8 bytes", () => {
  const findings = lintKeywords(scanOf({ keywords: "猫".repeat(10) }), defaultConfig());
  const finding = findings.find((x) => x.rule === "keyword-capacity");
  assert.ok(finding);
  assert.equal(finding.count, 30);
  assert.match(finding.message, /30\/100 bytes/);
});

test("lintKeywords respects a rule turned off in config", () => {
  const cfg = defaultConfig();
  cfg.rules["keyword-space-after-comma"] = "off";
  const findings = lintKeywords(scanOf({ keywords: "photo, editor" }), cfg);
  assert.equal(findings.some((f) => f.rule === "keyword-space-after-comma"), false);
});

// --- Separator-whitespace byte accounting -----------------------------------
// The keyword budget is 100 UTF-8 bytes, so the number this rule reports has to
// be the real byte cost of the whitespace, not a count of the runs it sits in.
// `--fix` reclaims the true bytes, so a rule that reports anything else puts the
// two halves of the tool into disagreement about the same field.

function wastedBytes(keywords: string): number {
  const finding = lintKeywords(scanOf({ keywords }), defaultConfig()).find(
    (f) => f.rule === "keyword-space-after-comma",
  );
  if (!finding) return 0;
  const match = /waste (\d+) byte/.exec(finding.message);
  assert.ok(match, `no byte count in message: ${finding.message}`);
  return Number(match[1]);
}

test("separatorWhitespaceBytes charges every byte of a multi-space run", () => {
  assert.equal(separatorWhitespaceBytes("alpha,  beta"), 2);
  assert.equal(separatorWhitespaceBytes("alpha ,   beta"), 4);
  assert.equal(separatorWhitespaceBytes("alpha ,  beta ,   gamma"), 7);
});

test("separatorWhitespaceBytes charges a non-ASCII space its real UTF-8 width", () => {
  assert.equal(separatorWhitespaceBytes("alpha, beta"), 2); // NBSP is 2 bytes
  assert.equal(separatorWhitespaceBytes("alpha,　beta"), 3); // ideographic space is 3
  assert.equal(separatorWhitespaceBytes("alpha,\tbeta"), 1); // tab is still 1
});

test("separatorWhitespaceBytes charges a run between two commas once", () => {
  assert.equal(separatorWhitespaceBytes("alpha, ,beta"), 1);
  assert.equal(separatorWhitespaceBytes("alpha,   ,beta"), 3);
});

test("separatorWhitespaceBytes ignores whitespace that is not next to a comma", () => {
  assert.equal(separatorWhitespaceBytes("photo editor,camera"), 0);
  assert.equal(separatorWhitespaceBytes("photo,editor"), 0);
  assert.equal(separatorWhitespaceBytes("  photo,editor  "), 0);
});

test("lintKeywords reports the real byte cost of separator whitespace", () => {
  assert.equal(wastedBytes("alpha, beta"), 1);
  assert.equal(wastedBytes("alpha,  beta"), 2);
  assert.equal(wastedBytes("alpha ,  beta ,   gamma"), 7);
  assert.equal(wastedBytes("alpha, beta"), 2);
  assert.equal(wastedBytes("alpha,　beta"), 3);
});

test("the reported waste equals the bytes --fix reclaims on a spaces-only field", () => {
  // Fields whose only defect is separator whitespace: no empty terms, no
  // duplicates, so `--fix` reclaims exactly the bytes this rule reports.
  for (const keywords of [
    "alpha, beta",
    "alpha,  beta",
    "alpha ,  beta ,   gamma",
    "alpha, beta",
    "alpha,　beta,　delta",
    "photo editor , camera",
  ]) {
    const fix = fixKeywords(keywords);
    const reclaimed = utf8ByteCount(fix.before) - utf8ByteCount(fix.after);
    assert.equal(
      wastedBytes(keywords),
      reclaimed,
      `report and --fix disagree for ${JSON.stringify(keywords)}`,
    );
  }
});
