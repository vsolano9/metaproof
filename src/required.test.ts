import { test } from "node:test";
import assert from "node:assert/strict";

import { lintRequired } from "./required.ts";
import { defaultConfig } from "./config.ts";
import type { FieldId, LocaleScan } from "./types.ts";

function scanOf(fields: LocaleScan["fields"], locale = "en-US"): LocaleScan {
  return { locale, isKnownLocale: true, fields, unknownFiles: [] };
}

const COMPLETE: LocaleScan["fields"] = {
  name: "Focus Timer",
  keywords: "timer,focus",
  description: "A simple focus timer.",
  support_url: "https://example.com/support",
  privacy_url: "https://example.com/privacy",
};

test("lintRequired reports every missing required field", () => {
  const findings = lintRequired(scanOf({ keywords: "timer,focus" }), defaultConfig());
  assert.deepEqual(
    findings.map((f) => f.field),
    ["name", "description", "support_url", "privacy_url"],
  );
  assert.ok(findings.every((f) => f.rule === "required-field" && f.severity === "error"));
  assert.ok(findings.every((f) => f.locale === "en-US"));
});

test("lintRequired passes a locale that has every required field", () => {
  assert.deepEqual(lintRequired(scanOf(COMPLETE), defaultConfig()), []);
});

test("lintRequired reports a missing keywords field by default", () => {
  const findings = lintRequired(
    scanOf({ ...COMPLETE, keywords: undefined }),
    defaultConfig(),
  );
  assert.deepEqual(findings.map((finding) => finding.field), ["keywords"]);
  assert.match(findings[0]!.message, /Keywords are required/);
});

test("lintRequired treats an empty required file as missing, and says so", () => {
  const findings = lintRequired(scanOf({ ...COMPLETE, description: "" }), defaultConfig());
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.field, "description");
  assert.match(findings[0]!.message, /empty/);
});

test("lintRequired distinguishes an absent file from an empty one", () => {
  const absent = lintRequired(scanOf({}), defaultConfig()).find((f) => f.field === "name");
  assert.match(absent!.message, /no name\.txt/);
});

test("lintRequired treats whitespace-only values as missing", () => {
  const findings = lintRequired(scanOf({ ...COMPLETE, name: "   " }), defaultConfig());
  assert.deepEqual(findings.map((f) => f.field), ["name"]);
});

test("lintRequired accepts a value inherited from the default folder", () => {
  const findings = lintRequired(
    scanOf({ name: "Focus Timer", keywords: "timer,focus", description: "A simple focus timer." }),
    defaultConfig(),
    { support_url: "https://example.com/support", privacy_url: "https://example.com/privacy" },
  );
  assert.deepEqual(findings, []);
});

test("lintRequired ignores an inherited value that is itself empty", () => {
  const findings = lintRequired(scanOf(COMPLETE), defaultConfig(), { name: "" });
  assert.deepEqual(findings, []);
  const missing = lintRequired(scanOf({ ...COMPLETE, name: undefined }), defaultConfig(), { name: "  " });
  assert.deepEqual(missing.map((f) => f.field), ["name"]);
});

test("lintRequired reports fields in the stable report order, not config order", () => {
  const config = defaultConfig();
  config.required = ["privacy_url", "name", "description"] as FieldId[];
  const findings = lintRequired(scanOf({}), config);
  assert.deepEqual(findings.map((f) => f.field), ["name", "description", "privacy_url"]);
});

test("lintRequired honours a custom required list", () => {
  const config = defaultConfig();
  config.required = ["keywords"] as FieldId[];
  const findings = lintRequired(scanOf({ ...COMPLETE, keywords: undefined }), config);
  assert.deepEqual(findings.map((f) => f.field), ["keywords"]);
});

test("lintRequired is silent when the rule is off or the list is empty", () => {
  const off = defaultConfig();
  off.rules["required-field"] = "off";
  assert.deepEqual(lintRequired(scanOf({}), off), []);

  const none = defaultConfig();
  none.required = [];
  assert.deepEqual(lintRequired(scanOf({}), none), []);
});

test("lintRequired honours a downgraded severity", () => {
  const config = defaultConfig();
  config.rules["required-field"] = "warning";
  const findings = lintRequired(scanOf({}), config);
  assert.ok(findings.length > 0);
  assert.ok(findings.every((f) => f.severity === "warning"));
});
