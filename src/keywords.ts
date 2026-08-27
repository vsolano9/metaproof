/**
 * ASO keyword-field linter.
 *
 * The App Store keywords field is a comma-separated, 100-byte budget that
 * feeds search indexing. These rules encode widely-accepted ASO best practices
 * (they are defaults, not Apple-mandated behaviour): don't waste bytes on
 * spaces, duplicates, stop words, or words Apple already indexes from the app
 * name and subtitle, and surface how much of the 100-byte budget is unused.
 */

import { utf8ByteCount } from "./count.ts";
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

/** Matches every code point `String.prototype.trim` treats as whitespace. */
const WHITESPACE = /\s/u;

/**
 * UTF-8 bytes spent on whitespace that sits immediately beside a comma
 * separator.
 *
 * Apple ignores that whitespace when it indexes the field, but every byte of it
 * is still charged against the 100-byte budget, so the number reported has to be
 * the real byte cost rather than a count of the gaps it appears in. A run of
 * three spaces costs three bytes; a non-breaking space pasted out of a
 * spreadsheet costs two; an ideographic space in a CJK keyword list costs three.
 * A run wedged between two commas is charged once, not once per neighbour.
 *
 * This is the same whitespace `fixKeywords` removes when it trims each term, so
 * for a field whose only defect is separator whitespace the two agree exactly.
 */
export function separatorWhitespaceBytes(raw: string): number {
  let bytes = 0;
  for (let i = 0; i < raw.length; ) {
    if (!WHITESPACE.test(raw[i]!)) {
      i++;
      continue;
    }
    let end = i;
    while (end < raw.length && WHITESPACE.test(raw[end]!)) end++;
    if (raw[i - 1] === "," || raw[end] === ",") {
      bytes += utf8ByteCount(raw.slice(i, end));
    }
    i = end;
  }
  return bytes;
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

  // Whitespace beside a comma is charged against the byte budget at its real
  // UTF-8 width, so the report matches what `--fix` reclaims.
  const wastedSpaces = separatorWhitespaceBytes(raw);
  if (wastedSpaces > 0) {
    push(
      "keyword-space-after-comma",
      "warning",
      `keywords waste ${wastedSpaces} byte(s) on spaces around commas; Apple ignores them but they count toward the ${config.limits.keywords}-byte limit`,
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
  const count = utf8ByteCount(raw);
  if (count <= limit) {
    push(
      "keyword-capacity",
      "info",
      `keywords use ${count}/${limit} bytes (${limit - count} unused)`,
      { count, limit },
    );
  }

  return findings;
}
