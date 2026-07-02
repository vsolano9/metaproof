/**
 * Description linter: word-count and per-line checks.
 *
 * The App Store description does not feed keyword search, but it drives
 * conversion, so a few checks help: surface the word count, optionally enforce a
 * minimum word count, and optionally flag over-long lines that read poorly on a
 * phone. The two thresholds are opt-in (`0` disables them) because there is no
 * universal minimum or line length; the word-count line is informational.
 *
 * Word counting splits on Unicode whitespace, so it is most meaningful for
 * space-separated languages; for CJK text a word count is a rough signal.
 */

import { graphemeCount } from "./count.ts";
import type { Config, Finding, LocaleScan, RuleLevel, Severity } from "./types.ts";

function severity(config: Config, rule: string, fallback: Severity): Severity | null {
  const level: RuleLevel | undefined = config.rules[rule];
  if (level === "off") return null;
  return (level as Severity | undefined) ?? fallback;
}

/** Count whitespace-separated words. Empty or whitespace-only text is 0. */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/u).length;
}

/** Lint the description field of a scanned locale. */
export function lintDescription(scan: LocaleScan, config: Config): Finding[] {
  const raw = scan.fields.description;
  if (raw === undefined || raw === "") return [];

  const { locale } = scan;
  const findings: Finding[] = [];
  const push = (rule: string, fallback: Severity, message: string, extra?: Partial<Finding>): void => {
    const level = severity(config, rule, fallback);
    if (!level) return;
    findings.push({ locale, field: "description", rule, severity: level, message, ...extra });
  };

  const limit = config.limits.description;
  const chars = graphemeCount(raw);
  const words = wordCount(raw);

  // Informational: how long the description is, in words and characters.
  push(
    "description-word-count",
    "info",
    `description has ${words} word${words === 1 ? "" : "s"} (${chars}/${limit} characters)`,
    { count: words },
  );

  // Opt-in: minimum word count.
  const minWords = config.description.minWords;
  if (minWords > 0 && words < minWords) {
    push(
      "description-min-words",
      "warning",
      `description has ${words} word${words === 1 ? "" : "s"}, fewer than the configured minimum of ${minWords}`,
      { count: words, limit: minWords },
    );
  }

  // Opt-in: per-line maximum length (measured in user-perceived characters).
  const maxLineLength = config.description.maxLineLength;
  if (maxLineLength > 0) {
    const lines = raw.split(/\r?\n/);
    const over: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (graphemeCount(lines[i]!) > maxLineLength) over.push(i + 1);
    }
    if (over.length > 0) {
      const shown = over.slice(0, 10).join(", ") + (over.length > 10 ? ", ..." : "");
      const plural = over.length === 1 ? "" : "s";
      push(
        "description-line-length",
        "warning",
        `description has ${over.length} line${plural} over the configured max of ${maxLineLength} characters (line${plural} ${shown})`,
        { limit: maxLineLength },
      );
    }
  }

  return findings;
}
