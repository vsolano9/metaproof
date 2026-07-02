import { test } from "node:test";
import assert from "node:assert/strict";

import { lintDescription, wordCount } from "./description.ts";
import { defaultConfig } from "./config.ts";
import type { LocaleScan } from "./types.ts";

function scanOf(fields: LocaleScan["fields"]): LocaleScan {
  return { locale: "en-US", isKnownLocale: true, fields, unknownFiles: [] };
}

function ruleMessages(findings: ReturnType<typeof lintDescription>, rule: string): string[] {
  return findings.filter((f) => f.rule === rule).map((f) => f.message);
}

test("wordCount counts whitespace-separated words", () => {
  assert.equal(wordCount("a simple focus timer"), 4);
  assert.equal(wordCount("  padded   words \n here "), 3);
  assert.equal(wordCount(""), 0);
  assert.equal(wordCount("   \n  "), 0);
  assert.equal(wordCount("single"), 1);
});

test("lintDescription returns nothing when there is no description", () => {
  assert.deepEqual(lintDescription(scanOf({ name: "MyApp" }), defaultConfig()), []);
  assert.deepEqual(lintDescription(scanOf({ description: "" }), defaultConfig()), []);
});

test("lintDescription reports the word count as info by default", () => {
  const findings = lintDescription(scanOf({ description: "A simple focus timer for study." }), defaultConfig());
  const f = findings.find((x) => x.rule === "description-word-count");
  assert.ok(f);
  assert.equal(f.severity, "info");
  assert.equal(f.count, 6);
  assert.match(f.message, /6 words/);
  assert.match(f.message, /31\/4000 characters/);
});

test("description-word-count uses a singular label for one word", () => {
  const findings = lintDescription(scanOf({ description: "Minimal" }), defaultConfig());
  assert.match(ruleMessages(findings, "description-word-count")[0]!, /1 word \(/);
});

test("description-min-words is off by default and opt-in via config", () => {
  const short = scanOf({ description: "Too short." });
  assert.equal(lintDescription(short, defaultConfig()).some((f) => f.rule === "description-min-words"), false);

  const cfg = defaultConfig();
  cfg.description.minWords = 10;
  const findings = lintDescription(short, cfg);
  const f = findings.find((x) => x.rule === "description-min-words");
  assert.ok(f);
  assert.equal(f.severity, "warning");
  assert.equal(f.count, 2);
  assert.equal(f.limit, 10);
  assert.match(f.message, /fewer than the configured minimum of 10/);
});

test("description-min-words does not fire when the count meets the minimum", () => {
  const cfg = defaultConfig();
  cfg.description.minWords = 3;
  const findings = lintDescription(scanOf({ description: "three whole words" }), cfg);
  assert.equal(findings.some((f) => f.rule === "description-min-words"), false);
});

test("description-line-length is off by default and opt-in via config", () => {
  const desc = "short line\n" + "x".repeat(50) + "\nok";
  assert.equal(
    lintDescription(scanOf({ description: desc }), defaultConfig()).some((f) => f.rule === "description-line-length"),
    false,
  );

  const cfg = defaultConfig();
  cfg.description.maxLineLength = 40;
  const findings = lintDescription(scanOf({ description: desc }), cfg);
  const f = findings.find((x) => x.rule === "description-line-length");
  assert.ok(f);
  assert.equal(f.severity, "warning");
  assert.equal(f.limit, 40);
  assert.match(f.message, /1 line over the configured max of 40/);
  assert.match(f.message, /line 2/);
});

test("description-line-length lists every offending line and pluralizes", () => {
  const cfg = defaultConfig();
  cfg.description.maxLineLength = 5;
  const desc = "toolong1\nok\ntoolong2";
  const f = lintDescription(scanOf({ description: desc }), cfg).find((x) => x.rule === "description-line-length");
  assert.ok(f);
  assert.match(f.message, /2 lines over/);
  assert.match(f.message, /lines 1, 3/);
});

test("description-line-length measures graphemes, not code units", () => {
  const cfg = defaultConfig();
  cfg.description.maxLineLength = 3;
  // Four family emoji = 4 graphemes (over 3) but many UTF-16 code units.
  const findings = lintDescription(scanOf({ description: "👨‍👩‍👧‍👦👨‍👩‍👧‍👦👨‍👩‍👧‍👦👨‍👩‍👧‍👦" }), cfg);
  assert.equal(findings.some((f) => f.rule === "description-line-length"), true);
});

test("lintDescription respects rules turned off in config", () => {
  const cfg = defaultConfig();
  cfg.rules["description-word-count"] = "off";
  cfg.description.minWords = 10;
  cfg.rules["description-min-words"] = "off";
  const findings = lintDescription(scanOf({ description: "short" }), cfg);
  assert.equal(findings.length, 0);
});
