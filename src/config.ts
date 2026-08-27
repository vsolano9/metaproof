/**
 * Configuration: built-in defaults plus a validated merge of a user config file.
 *
 * A project can drop a `metaproof.json` next to its metadata and override
 * field limits (in case Apple changes them), rule severities (including
 * turning rules `off`), the ASO stop-word list, and the locale allow/ignore
 * lists. Unknown top-level keys are ignored for forward compatibility, but
 * malformed values are rejected with a clear error.
 */

import { readFile } from "node:fs/promises";

import { DEFAULT_LIMITS, FIELD_IDS } from "./fields.ts";
import type { Config, FieldId, RuleLevel } from "./types.ts";

const RULE_LEVELS: ReadonlySet<string> = new Set(["error", "warning", "info", "off"]);

/** Default rule severities. Keys are stable rule ids used across the linter. */
const DEFAULT_RULES: Readonly<Record<string, RuleLevel>> = {
  "field-length": "error",
  "field-min-length": "error",
  "url-format": "error",
  "required-field": "error",
  "empty-field": "warning",
  "leading-trailing-whitespace": "warning",
  "unknown-locale": "warning",
  "unknown-file": "warning",
  "keyword-cross-field-duplicate": "warning",
  "keyword-duplicate": "warning",
  "keyword-space-after-comma": "warning",
  "keyword-stop-word": "warning",
  "keyword-empty-term": "warning",
  "keyword-capacity": "info",
  "description-word-count": "info",
  "description-min-words": "warning",
  "description-line-length": "warning",
};

/**
 * Rules that report that the scan validated nothing at all: the metadata folder
 * was not there, or it held no locale to lint.
 *
 * These are deliberately not configurable. Every other rule judges a value that
 * was actually read, so turning it off narrows the report to what you still care
 * about. Turning one of these off instead turns "metaproof could not look" into
 * a clean, zero-finding, exit-0 report, which is the precise failure the
 * zero-locale check was added to prevent. They are rejected with a reason rather
 * than accepted and quietly ignored.
 */
export const STRUCTURAL_RULES: ReadonlySet<string> = new Set(["missing-metadata", "missing-locale"]);

/** Levenshtein distance, bounded by the shorter of the two rule ids. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(current[j - 1]! + 1, previous[j]! + 1, substitution);
    }
    previous = current;
  }
  return previous[b.length]!;
}

/**
 * The known rule a mistyped id most likely meant, or null when nothing is close
 * enough to be worth guessing. A hyphen dropped from `keyword-stop-word` or an
 * underscore typed for a hyphen is one edit away; unrelated text is not.
 */
function nearestRule(id: string, known: Iterable<string>): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of known) {
    const distance = editDistance(id, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best !== null && bestDistance <= 3 && bestDistance < id.length ? best : null;
}

/**
 * Default ASO keyword stop words: low-value terms that waste keyword-field
 * characters. These are best-practice defaults, not Apple-mandated behaviour.
 */
const DEFAULT_STOP_WORDS: readonly string[] = [
  "a", "an", "and", "app", "apps", "best", "for", "free", "in", "of",
  "on", "or", "the", "to", "with", "your",
];

/**
 * Default description thresholds. Both are opt-in (`0` = disabled) because there
 * is no universal minimum word count or line length for an App Store
 * description; teams enable them per project.
 */
const DEFAULT_DESCRIPTION: Readonly<Config["description"]> = {
  minWords: 0,
  maxLineLength: 0,
};

/**
 * Localized fields App Store Connect requires before a version can be
 * submitted. What's New is deliberately absent because it only applies to
 * updates; add it through `required` when linting an update-only tree.
 */
const DEFAULT_REQUIRED: readonly FieldId[] = ["name", "keywords", "description", "support_url", "privacy_url"];

/** A fresh default configuration. */
export function defaultConfig(): Config {
  return {
    limits: { ...DEFAULT_LIMITS },
    rules: { ...DEFAULT_RULES },
    stopWords: [...DEFAULT_STOP_WORDS],
    locales: { allow: null, extra: [], ignore: [] },
    description: { ...DEFAULT_DESCRIPTION },
    required: [...DEFAULT_REQUIRED],
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Merge a partial config (typically parsed from JSON) over a base config.
 * Returns a new config. Throws a clear error on malformed values.
 */
export function mergeConfig(base: Config, input: unknown): Config {
  const merged = defaultConfigFrom(base);
  if (input === undefined || input === null) return merged;
  if (!isPlainObject(input)) {
    throw new Error("config must be a JSON object");
  }

  if ("limits" in input) {
    if (!isPlainObject(input.limits)) throw new Error("config.limits must be an object");
    for (const [key, value] of Object.entries(input.limits)) {
      if (!(key in merged.limits)) continue; // ignore unknown limit keys
      if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
        throw new Error(`config.limits.${key} must be a positive integer`);
      }
      merged.limits[key as keyof Config["limits"]] = value;
    }
  }

  if ("rules" in input) {
    if (!isPlainObject(input.rules)) throw new Error("config.rules must be an object");
    for (const [key, value] of Object.entries(input.rules)) {
      // Reject an id metaproof will never read. Writing it through and ignoring
      // it produced a config that looked applied and did nothing.
      if (STRUCTURAL_RULES.has(key)) {
        throw new Error(
          `config.rules.${key} cannot be configured: it reports that metaproof validated nothing, ` +
            `so silencing or downgrading it would turn a scan that read no metadata into a clean report`,
        );
      }
      if (!(key in merged.rules)) {
        const suggestion = nearestRule(key, Object.keys(merged.rules));
        throw new Error(
          `config.rules contains unknown rule "${key}"` +
            (suggestion === null ? "" : ` (did you mean "${suggestion}"?)`),
        );
      }
      if (typeof value !== "string" || !RULE_LEVELS.has(value)) {
        throw new Error(`config.rules.${key} must be one of error, warning, info, off`);
      }
      merged.rules[key] = value as RuleLevel;
    }
  }

  if ("stopWords" in input) {
    if (!isStringArray(input.stopWords)) throw new Error("config.stopWords must be an array of strings");
    merged.stopWords = input.stopWords.map((word) => word.toLowerCase());
  }

  if ("locales" in input) {
    if (!isPlainObject(input.locales)) throw new Error("config.locales must be an object");
    const { allow, extra, ignore } = input.locales;
    if (allow !== undefined) {
      if (allow !== null && !isStringArray(allow)) throw new Error("config.locales.allow must be null or an array of strings");
      merged.locales.allow = allow;
    }
    if (extra !== undefined) {
      if (!isStringArray(extra)) throw new Error("config.locales.extra must be an array of strings");
      merged.locales.extra = extra;
    }
    if (ignore !== undefined) {
      if (!isStringArray(ignore)) throw new Error("config.locales.ignore must be an array of strings");
      merged.locales.ignore = ignore;
    }
  }

  if ("description" in input) {
    if (!isPlainObject(input.description)) throw new Error("config.description must be an object");
    for (const key of ["minWords", "maxLineLength"] as const) {
      if (!(key in input.description)) continue;
      const value = input.description[key];
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        throw new Error(`config.description.${key} must be a non-negative integer`);
      }
      merged.description[key] = value;
    }
  }

  if ("required" in input) {
    if (!isStringArray(input.required)) throw new Error("config.required must be an array of strings");
    for (const id of input.required) {
      if (!FIELD_IDS.has(id)) {
        throw new Error(`config.required contains unknown field "${id}"`);
      }
    }
    merged.required = [...new Set(input.required)] as FieldId[];
  }

  return merged;
}

function defaultConfigFrom(base: Config): Config {
  return {
    limits: { ...base.limits },
    rules: { ...base.rules },
    stopWords: [...base.stopWords],
    locales: {
      allow: base.locales.allow === null ? null : [...base.locales.allow],
      extra: [...base.locales.extra],
      ignore: [...base.locales.ignore],
    },
    description: { ...base.description },
    required: [...base.required],
  };
}

/** Read a JSON config file and merge it over the defaults. */
export async function loadConfig(filePath: string, base: Config = defaultConfig()): Promise<Config> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    throw new Error(`could not read config file "${filePath}": ${(err as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`config file "${filePath}" is not valid JSON: ${(err as Error).message}`);
  }
  return mergeConfig(base, parsed);
}
