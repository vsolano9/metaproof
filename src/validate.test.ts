import { test } from "node:test";
import assert from "node:assert/strict";

import { validateLocale } from "./validate.ts";
import { defaultConfig } from "./config.ts";
import type { LocaleScan } from "./types.ts";

function scanOf(fields: LocaleScan["fields"]): LocaleScan {
  return { locale: "en-US", isKnownLocale: true, fields, unknownFiles: [] };
}

test("validateLocale flags a length field over its limit", () => {
  const findings = validateLocale(scanOf({ subtitle: "x".repeat(31) }), defaultConfig());
  const f = findings.find((x) => x.rule === "field-length" && x.field === "subtitle");
  assert.ok(f);
  assert.equal(f.severity, "error");
  assert.equal(f.count, 31);
  assert.equal(f.limit, 30);
});

test("validateLocale accepts a length field exactly at its limit", () => {
  const findings = validateLocale(scanOf({ name: "x".repeat(30) }), defaultConfig());
  assert.equal(findings.some((x) => x.rule === "field-length"), false);
});

test("validateLocale counts by grapheme, not UTF-16 length", () => {
  // 29 letters + one family emoji = 30 graphemes -> at limit, ok.
  const ok = validateLocale(scanOf({ name: "a".repeat(29) + "👨‍👩‍👧‍👦" }), defaultConfig());
  assert.equal(ok.some((x) => x.rule === "field-length"), false);
  // 30 letters + one emoji = 31 graphemes -> over.
  const over = validateLocale(scanOf({ name: "a".repeat(30) + "👍" }), defaultConfig());
  const f = over.find((x) => x.rule === "field-length");
  assert.equal(f?.count, 31);
});

test("validateLocale flags keywords over 100 characters", () => {
  const findings = validateLocale(scanOf({ keywords: "k".repeat(101) }), defaultConfig());
  assert.ok(findings.some((x) => x.rule === "field-length" && x.field === "keywords"));
});

test("validateLocale flags a malformed URL field", () => {
  const findings = validateLocale(scanOf({ support_url: "not a url" }), defaultConfig());
  const f = findings.find((x) => x.rule === "url-format" && x.field === "support_url");
  assert.ok(f);
  assert.equal(f.severity, "error");
});

test("validateLocale accepts a well-formed https URL", () => {
  const findings = validateLocale(scanOf({ support_url: "https://example.com/help" }), defaultConfig());
  assert.equal(findings.some((x) => x.rule === "url-format"), false);
});

test("validateLocale rejects a non-http(s) URL scheme", () => {
  const findings = validateLocale(scanOf({ privacy_url: "ftp://example.com" }), defaultConfig());
  assert.ok(findings.some((x) => x.rule === "url-format" && x.field === "privacy_url"));
});

test("validateLocale warns about leading or trailing whitespace", () => {
  const findings = validateLocale(scanOf({ name: " MyApp " }), defaultConfig());
  const f = findings.find((x) => x.rule === "leading-trailing-whitespace" && x.field === "name");
  assert.ok(f);
  assert.equal(f.severity, "warning");
});

test("validateLocale honours a rule turned off in config", () => {
  const cfg = defaultConfig();
  cfg.rules["field-length"] = "off";
  const findings = validateLocale(scanOf({ subtitle: "x".repeat(50) }), cfg);
  assert.equal(findings.some((x) => x.rule === "field-length"), false);
});

test("validateLocale stamps the locale on every finding", () => {
  const findings = validateLocale(scanOf({ subtitle: "x".repeat(40) }), defaultConfig());
  assert.ok(findings.length > 0);
  assert.ok(findings.every((x) => x.locale === "en-US"));
});
