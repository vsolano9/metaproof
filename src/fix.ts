/**
 * `--fix` support: safe, deterministic cleanups for the keywords field.
 *
 * Only cleanups that never change intent are applied: trim each term, drop empty
 * terms (from double or trailing commas), remove separator spaces, and drop
 * case-insensitive duplicate terms (keeping the first occurrence and its
 * original casing). Judgment calls that could remove real keywords - stop
 * words, cross-field duplicates, and over-limit truncation - are deliberately
 * left for a human. Fixes are applied regardless of rule severities; they are an
 * explicit, opt-in action.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { defaultConfig } from "./config.ts";
import { graphemeCount } from "./count.ts";
import { scanMetadata } from "./scan.ts";
import type { Config } from "./types.ts";

export interface KeywordFix {
  /** The original keywords value (trailing newline already stripped). */
  before: string;
  /** The cleaned keywords value. */
  after: string;
  /** True when `after` differs from `before`. */
  changed: boolean;
  /** Characters reclaimed against the keyword budget (grapheme-measured). */
  charsSaved: number;
  /** Number of empty terms removed (from double or trailing commas). */
  droppedEmptyTerms: number;
  /** Duplicate terms removed, in their original casing (first occurrence kept). */
  removedDuplicates: string[];
}

export interface AppliedFix {
  locale: string;
  filename: string;
  fix: KeywordFix;
}

export interface FixResult {
  root: string;
  applied: AppliedFix[];
}

/** Compute the safe, canonical cleanup of a keywords field value. Pure. */
export function fixKeywords(raw: string): KeywordFix {
  const rawTerms = raw.split(",");
  let droppedEmptyTerms = 0;
  const removedDuplicates: string[] = [];
  const kept: string[] = [];
  const seen = new Set<string>();

  for (const rawTerm of rawTerms) {
    const term = rawTerm.trim();
    if (term === "") {
      droppedEmptyTerms++;
      continue;
    }
    const key = term.toLowerCase();
    if (seen.has(key)) {
      removedDuplicates.push(term);
      continue;
    }
    seen.add(key);
    kept.push(term);
  }

  const after = kept.join(",");
  return {
    before: raw,
    after,
    changed: after !== raw,
    charsSaved: graphemeCount(raw) - graphemeCount(after),
    droppedEmptyTerms,
    removedDuplicates,
  };
}

/** Preserve whatever trailing newline sequence the original file ended with. */
function trailingNewline(original: string): string {
  return /(\r?\n)+$/.exec(original)?.[0] ?? "";
}

/**
 * Apply safe keyword fixes to every locale's `keywords.txt` on disk. Only files
 * whose value actually changes are rewritten; the original trailing newline is
 * preserved. Returns the fixes that were applied.
 */
export async function fixMetadata(root: string, config: Config = defaultConfig()): Promise<FixResult> {
  const scan = await scanMetadata(root, config);
  const applied: AppliedFix[] = [];

  for (const localeScan of scan.locales) {
    const value = localeScan.fields.keywords;
    if (value === undefined || value === "") continue;

    const fix = fixKeywords(value);
    if (!fix.changed) continue;

    const filePath = join(scan.root, localeScan.locale, "keywords.txt");
    const original = await readFile(filePath, "utf8");
    await writeFile(filePath, fix.after + trailingNewline(original), "utf8");
    applied.push({ locale: localeScan.locale, filename: "keywords.txt", fix });
  }

  return { root: scan.root, applied };
}

/** Render a plain-text summary of applied fixes (for stderr / CI logs). */
export function renderFixSummary(result: FixResult): string {
  if (result.applied.length === 0) return "metaproof --fix: nothing to fix";

  const lines: string[] = [];
  for (const { locale, filename, fix } of result.applied) {
    const parts: string[] = [`reclaimed ${fix.charsSaved} character${fix.charsSaved === 1 ? "" : "s"}`];
    if (fix.removedDuplicates.length > 0) {
      parts.push(`removed ${fix.removedDuplicates.length} duplicate(s): ${fix.removedDuplicates.join(", ")}`);
    }
    if (fix.droppedEmptyTerms > 0) {
      parts.push(`dropped ${fix.droppedEmptyTerms} empty term(s)`);
    }
    lines.push(`  ${locale}/${filename}  ${parts.join("; ")}`);
  }
  const n = result.applied.length;
  lines.push(`metaproof --fix: fixed ${n} file${n === 1 ? "" : "s"}`);
  return lines.join("\n");
}
