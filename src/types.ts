/**
 * Shared types for metaproof.
 *
 * All values here are plain, JSON-serialisable shapes so that `--json` output
 * and the programmatic API return the same data.
 */

export type Severity = "error" | "warning" | "info";

/** A rule level as configured by the user. `off` disables the rule. */
export type RuleLevel = Severity | "off";

/** Fields metaproof knows how to validate, keyed by fastlane deliver filename. */
export type FieldId =
  | "name"
  | "subtitle"
  | "keywords"
  | "promotional_text"
  | "description"
  | "release_notes"
  | "support_url"
  | "marketing_url"
  | "privacy_url"
  | "apple_tv_privacy_policy";

/** Length fields carry a character limit; url fields are format-checked. */
export type FieldKind = "length" | "url";

export interface FieldDef {
  /** Stable field id, also the fastlane filename without `.txt`. */
  id: FieldId;
  /** fastlane deliver filename, e.g. `name.txt`. */
  filename: string;
  /** Human label, e.g. `App Name`. */
  label: string;
  kind: FieldKind;
  /** Character limit for `length` fields. Undefined for `url` fields. */
  limit?: number;
}

export interface Finding {
  locale: string;
  /** Undefined for scan-level findings (e.g. missing metadata folder). */
  field?: FieldId;
  /** Stable rule id, e.g. `field-length`, `keyword-cross-field-duplicate`. */
  rule: string;
  severity: Severity;
  message: string;
  /** Measured character count, when relevant. */
  count?: number;
  /** Limit compared against, when relevant. */
  limit?: number;
}

export interface LocaleScan {
  locale: string;
  /** True when the folder name matches a known App Store locale (or `default`). */
  isKnownLocale: boolean;
  /** Recognised field files -> raw text (trailing newline trimmed). */
  fields: Partial<Record<FieldId, string>>;
  /** `.txt` files present in the locale folder that metaproof does not recognise. */
  unknownFiles: string[];
}

export interface ScanResult {
  root: string;
  locales: LocaleScan[];
  /** Non-locale folders that were intentionally skipped, e.g. `review_information`. */
  skippedFolders: string[];
  /** Scan-level findings (missing root, unknown locale, empty field file). */
  diagnostics: Finding[];
}

export interface LocaleReport {
  locale: string;
  findings: Finding[];
  /** True when the locale has no `error`-severity findings. */
  ok: boolean;
}

export interface LintReport {
  root: string;
  locales: LocaleReport[];
  /** Every finding, flattened and stable-ordered. */
  findings: Finding[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  /** True when there are no `error`-severity findings. */
  ok: boolean;
}

/** Character limits, overridable via config in case Apple changes them. */
export type FieldLimits = Record<
  "name" | "subtitle" | "keywords" | "promotional_text" | "description" | "release_notes",
  number
>;

export interface LocaleConfig {
  /** When set, only these locale folders are treated as valid (allow-list). */
  allow: string[] | null;
  /** Extra locale codes to treat as known, in addition to the built-in list. */
  extra: string[];
  /** Locale folders to ignore entirely. */
  ignore: string[];
}

/** Opt-in thresholds for the description checks. `0` disables a threshold. */
export interface DescriptionConfig {
  /** Warn when the description has fewer than this many words. `0` disables it. */
  minWords: number;
  /** Warn when any single description line exceeds this many characters. `0` disables it. */
  maxLineLength: number;
}

export interface Config {
  limits: FieldLimits;
  /** Rule id -> level. Missing keys fall back to built-in defaults. */
  rules: Record<string, RuleLevel>;
  /** Words treated as ASO keyword-field waste. */
  stopWords: string[];
  locales: LocaleConfig;
  /** Thresholds for the description word-count and per-line checks. */
  description: DescriptionConfig;
}
