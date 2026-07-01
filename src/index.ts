/**
 * metaproof public API.
 *
 * Lint a fastlane deliver `metadata/` folder for App Store field-length and ASO
 * keyword-field problems. Everything here is pure and offline.
 *
 * @example
 * import { lint, renderHuman, exitCode } from "metaproof";
 * const report = await lint("fastlane/metadata");
 * console.log(renderHuman(report));
 * process.exit(exitCode(report, false));
 */

export { lint } from "./lint.ts";
export { defaultConfig, loadConfig, mergeConfig } from "./config.ts";
export { renderHuman, renderJson, exitCode } from "./report.ts";
export { DEFAULT_LIMITS, FIELD_DEFS, fieldForFilename, lengthFields, urlFields } from "./fields.ts";
export { graphemeCount, codePointCount } from "./count.ts";
export { KNOWN_LOCALES, NON_LOCALE_FOLDERS, isKnownLocale } from "./locales.ts";

export type {
  Config,
  FieldDef,
  FieldId,
  FieldLimits,
  Finding,
  LintReport,
  LocaleReport,
  LocaleScan,
  RuleLevel,
  ScanResult,
  Severity,
} from "./types.ts";
export type { HumanOptions } from "./report.ts";
