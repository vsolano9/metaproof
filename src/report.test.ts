import { test } from "node:test";
import assert from "node:assert/strict";

import { exitCode, renderHuman, renderJson } from "./report.ts";
import type { Finding, LintReport, LocaleReport } from "./types.ts";

function reportOf(locales: LocaleReport[]): LintReport {
  const findings = locales.flatMap((l) => l.findings);
  return {
    root: "fastlane/metadata",
    locales,
    findings,
    errorCount: findings.filter((f) => f.severity === "error").length,
    warningCount: findings.filter((f) => f.severity === "warning").length,
    infoCount: findings.filter((f) => f.severity === "info").length,
    ok: findings.every((f) => f.severity !== "error"),
  };
}

const errFinding: Finding = {
  locale: "en-US",
  field: "name",
  rule: "field-length",
  severity: "error",
  message: "App Name is 34/30 characters (4 over the limit)",
  count: 34,
  limit: 30,
};

test("renderJson round-trips the report", () => {
  const report = reportOf([{ locale: "en-US", findings: [errFinding], ok: false }]);
  assert.deepEqual(JSON.parse(renderJson(report)), report);
});

test("renderHuman shows FAIL, the locale, and the failing field for an error report", () => {
  const report = reportOf([{ locale: "en-US", findings: [errFinding], ok: false }]);
  const out = renderHuman(report, { color: false });
  assert.match(out, /en-US/);
  assert.match(out, /error/);
  assert.match(out, /34\/30/);
  assert.match(out, /FAIL/);
});

test("renderHuman shows PASS for a clean report", () => {
  const report = reportOf([{ locale: "en-US", findings: [], ok: true }]);
  const out = renderHuman(report, { color: false });
  assert.match(out, /PASS/);
});

test("renderHuman quiet mode hides clean locales and info findings", () => {
  const info: Finding = { locale: "de-DE", field: "keywords", rule: "keyword-capacity", severity: "info", message: "keywords use 7/100 characters (93 unused)" };
  const report = reportOf([
    { locale: "en-US", findings: [errFinding], ok: false },
    { locale: "de-DE", findings: [info], ok: true },
  ]);
  const out = renderHuman(report, { color: false, quiet: true });
  assert.match(out, /en-US/);
  assert.doesNotMatch(out, /de-DE/);
  assert.doesNotMatch(out, /unused/);
});

test("exitCode is 0 for a clean report", () => {
  const report = reportOf([{ locale: "en-US", findings: [], ok: true }]);
  assert.equal(exitCode(report, false), 0);
  assert.equal(exitCode(report, true), 0);
});

test("exitCode is non-zero when there is an error", () => {
  const report = reportOf([{ locale: "en-US", findings: [errFinding], ok: false }]);
  assert.notEqual(exitCode(report, false), 0);
});

test("exitCode is 0 for warnings unless strict", () => {
  const warn: Finding = { locale: "en-US", field: "keywords", rule: "keyword-stop-word", severity: "warning", message: "low-value keyword(s): the" };
  const report = reportOf([{ locale: "en-US", findings: [warn], ok: true }]);
  assert.equal(exitCode(report, false), 0);
  assert.notEqual(exitCode(report, true), 0);
});

test("exitCode ignores info findings even in strict mode", () => {
  const info: Finding = { locale: "en-US", field: "keywords", rule: "keyword-capacity", severity: "info", message: "keywords use 7/100 characters (93 unused)" };
  const report = reportOf([{ locale: "en-US", findings: [info], ok: true }]);
  assert.equal(exitCode(report, true), 0);
});
