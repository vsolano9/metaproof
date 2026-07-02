/**
 * Public API: lint a fastlane deliver `metadata/` folder into a {@link LintReport}.
 *
 * Orchestrates the scan (filesystem), field validation (limits, URLs,
 * whitespace), and the ASO keyword linter, then rolls everything up into a
 * stable, JSON-serialisable report with per-locale status and severity counts.
 */

import { defaultConfig } from "./config.ts";
import { lintDescription } from "./description.ts";
import { lintKeywords } from "./keywords.ts";
import { scanMetadata } from "./scan.ts";
import { validateLocale } from "./validate.ts";
import type { Config, Finding, LintReport, LocaleReport } from "./types.ts";

/** Lint a metadata folder. Pass a config to override limits, rules, or locales. */
export async function lint(root: string, config: Config = defaultConfig()): Promise<LintReport> {
  const scan = await scanMetadata(root, config);

  const localeDiagnostics = new Map<string, Finding[]>();
  const reportLevel: Finding[] = [];
  for (const diagnostic of scan.diagnostics) {
    if (diagnostic.locale === "") {
      reportLevel.push(diagnostic);
    } else {
      const list = localeDiagnostics.get(diagnostic.locale) ?? [];
      list.push(diagnostic);
      localeDiagnostics.set(diagnostic.locale, list);
    }
  }

  const all: Finding[] = [...reportLevel];
  const locales: LocaleReport[] = [];

  for (const localeScan of scan.locales) {
    const findings: Finding[] = [
      ...(localeDiagnostics.get(localeScan.locale) ?? []),
      ...validateLocale(localeScan, config),
      ...lintKeywords(localeScan, config),
      ...lintDescription(localeScan, config),
    ];
    const ok = !findings.some((f) => f.severity === "error");
    locales.push({ locale: localeScan.locale, findings, ok });
    all.push(...findings);
  }

  const errorCount = all.filter((f) => f.severity === "error").length;
  const warningCount = all.filter((f) => f.severity === "warning").length;
  const infoCount = all.filter((f) => f.severity === "info").length;

  return {
    root: scan.root,
    locales,
    findings: all,
    errorCount,
    warningCount,
    infoCount,
    ok: errorCount === 0,
  };
}
