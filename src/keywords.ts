/**
 * ASO keyword-field linter.
 *
 * The App Store keywords field is a comma-separated, 100-character budget that
 * feeds search indexing. These rules encode widely-accepted ASO best practices
 * (they are defaults, not Apple-mandated behaviour): don't waste characters on
 * spaces, duplicates, stop words, or words Apple already indexes from the app
 * name and subtitle, and surface how much of the 100-character budget is unused.
 */

import { graphemeCount } from "./count.ts";
import type { Config, Finding, LocaleScan, RuleLevel, Severity } from "./types.ts";

function severity(config: Config, rule: string, fallback: Severity): Severity | null {
  const level: RuleLevel | undefined = config.rules[rule];
  if (level === "off") return null;
  return (level as Severity | undefined) ?? fallback;
}

/** Split arbitrary text into lowercased word tokens. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0);
}

/** Lint the keywords field of a scanned locale. */
export function lintKeywords(scan: LocaleScan, config: Config): Finding[] {
  const raw = scan.fields.keywords;
  if (raw === undefined || raw === "") return [];

  const { locale } = scan;
  const findings: Finding[] = [];
  const push = (rule: string, fallback: Severity, message: string, extra?: Partial<Finding>): void => {
    const level = severity(config, rule, fallback);
    if (!level) return;
    findings.push({ locale, field: "keywords", rule, severity: level, message, ...extra });
  };

  const rawTerms = raw.split(",");
  const hasEmptyTerm = rawTerms.some((t) => t.trim() === "");
  const terms = rawTerms.map((t) => t.trim()).filter((t) => t.length > 0);
  const lowerTerms = terms.map((t) => t.toLowerCase());

  // Space around commas wastes characters against the 100-char budget.
  let wastedSpaces = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== ",") continue;
    if (/\s/u.test(raw[i - 1] ?? "")) wastedSpaces++;
    if (/\s/u.test(raw[i + 1] ?? "")) wastedSpaces++;
  }
  if (wastedSpaces > 0) {
    push(
      "keyword-space-after-comma",
      "warning",
      `keywords waste ${wastedSpaces} character(s) on spaces around commas; Apple ignores them but they count toward the ${config.limits.keywords}-character limit`,
    );
  }

  if (hasEmptyTerm) {
    push("keyword-empty-term", "warning", "keywords contain empty terms (double or trailing commas)");
  }

  // Duplicate terms within the field.
  const seen = new Map<string, number>();
  for (const term of lowerTerms) seen.set(term, (seen.get(term) ?? 0) + 1);
  const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([t]) => t);
  if (duplicates.length > 0) {
    push("keyword-duplicate", "warning", `duplicate keyword(s): ${duplicates.join(", ")}`);
  }

  // Stop words waste budget on low-value terms.
  const stopSet = new Set(config.stopWords.map((w) => w.toLowerCase()));
  const stopHits: string[] = [];
  for (const term of lowerTerms) {
    for (const word of words(term)) {
      if (stopSet.has(word) && !stopHits.includes(word)) stopHits.push(word);
    }
  }
  if (stopHits.length > 0) {
    push("keyword-stop-word", "warning", `low-value keyword(s): ${stopHits.join(", ")}`);
  }

  // Cross-field duplication: Apple already indexes name + subtitle words.
  const titleWords = new Set([...words(scan.fields.name ?? ""), ...words(scan.fields.subtitle ?? "")]);
  if (titleWords.size > 0) {
    const covered: string[] = [];
    for (const term of lowerTerms) {
      const termWords = words(term);
      if (termWords.length > 0 && termWords.every((w) => titleWords.has(w)) && !covered.includes(term)) {
        covered.push(term);
      }
    }
    if (covered.length > 0) {
      push(
        "keyword-cross-field-duplicate",
        "warning",
        `keyword(s) already indexed from the app name or subtitle: ${covered.join(", ")}`,
      );
    }
  }

  // Unused capacity, informational.
  const limit = config.limits.keywords;
  const count = graphemeCount(raw);
  if (count <= limit) {
    push(
      "keyword-capacity",
      "info",
      `keywords use ${count}/${limit} characters (${limit - count} unused)`,
      { count, limit },
    );
  }

  return findings;
}
