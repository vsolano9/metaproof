/**
 * Configuration: built-in defaults plus a validated merge of a user config file.
 *
 * A project can drop a `metaproof.json` next to its metadata and override
 * character limits (in case Apple changes them), rule severities (including
 * turning rules `off`), the ASO stop-word list, and the locale allow/ignore
 * lists. Unknown top-level keys are ignored for forward compatibility, but
 * malformed values are rejected with a clear error.
 */

import { readFile } from "node:fs/promises";

import { DEFAULT_LIMITS } from "./fields.ts";
import type { Config, RuleLevel } from "./types.ts";

const RULE_LEVELS: ReadonlySet<string> = new Set(["error", "warning", "info", "off"]);

/** Default rule severities. Keys are stable rule ids used across the linter. */
const DEFAULT_RULES: Readonly<Record<string, RuleLevel>> = {
  "missing-metadata": "error",
  "field-length": "error",
  "url-format": "error",
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
};

/**
 * Default ASO keyword stop words: low-value terms that waste keyword-field
 * characters. These are best-practice defaults, not Apple-mandated behaviour.
 */
const DEFAULT_STOP_WORDS: readonly string[] = [
  "a", "an", "and", "app", "apps", "best", "for", "free", "in", "of",
  "on", "or", "the", "to", "with", "your",
];

/** A fresh default configuration. */
export function defaultConfig(): Config {
  return {
    limits: { ...DEFAULT_LIMITS },
    rules: { ...DEFAULT_RULES },
    stopWords: [...DEFAULT_STOP_WORDS],
    locales: { allow: null, extra: [], ignore: [] },
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
