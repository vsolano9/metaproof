/**
 * Read a fastlane deliver `metadata/` tree from disk into a structured result.
 *
 * The scan is filesystem-only: it decides which subfolders are locales, reads
 * the recognised field files, strips the trailing newline fastlane writes, and
 * emits scan-level diagnostics (missing folder, unknown locale, unknown file,
 * empty field). Field-content rules live in `validate.ts` and `keywords.ts`.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { fieldForFilename } from "./fields.ts";
import { isKnownLocale, NON_LOCALE_FOLDERS } from "./locales.ts";
import type { Config, Finding, LocaleScan, ScanResult, Severity } from "./types.ts";

function levelFor(config: Config, rule: string, fallback: Severity): Severity {
  // Callers gate on `off` before calling; return the configured severity or the fallback.
  const level = config.rules[rule];
  return level === undefined || level === "off" ? fallback : level;
}

/** Strip the trailing line terminators fastlane appends when writing a field. */
function stripTrailingNewline(value: string): string {
  return value.replace(/(\r?\n)+$/, "");
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** Scan a metadata folder into locales, skipped folders, and diagnostics. */
export async function scanMetadata(root: string, config: Config): Promise<ScanResult> {
  const result: ScanResult = { root, locales: [], skippedFolders: [], diagnostics: [] };

  if (!(await isDirectory(root))) {
    result.diagnostics.push({
      locale: "",
      rule: "missing-metadata",
      severity: "error",
      message: `metadata folder not found: ${root}`,
    });
    return result;
  }

  const entries = await readdir(root, { withFileTypes: true });
  const subdirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

  for (const name of subdirs) {
    if (NON_LOCALE_FOLDERS.has(name) || config.locales.ignore.includes(name)) {
      result.skippedFolders.push(name);
      continue;
    }
    if (config.locales.allow !== null && !config.locales.allow.includes(name)) {
      result.skippedFolders.push(name);
      continue;
    }

    const known =
      isKnownLocale(name) ||
      config.locales.extra.includes(name) ||
      (config.locales.allow !== null && config.locales.allow.includes(name));

    if (!known && config.rules["unknown-locale"] !== "off") {
      result.diagnostics.push({
        locale: name,
        rule: "unknown-locale",
        severity: levelFor(config, "unknown-locale", "warning"),
        message: `"${name}" is not a known App Store locale (add it to locales.extra if it is valid)`,
      });
    }

    const localeScan = await scanLocale(root, name, known, config, result.diagnostics);
    result.locales.push(localeScan);
  }

  return result;
}

async function scanLocale(
  root: string,
  locale: string,
  isKnown: boolean,
  config: Config,
  diagnostics: Finding[],
): Promise<LocaleScan> {
  const dir = join(root, locale);
  const scan: LocaleScan = { locale, isKnownLocale: isKnown, fields: {}, unknownFiles: [] };

  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && e.name.endsWith(".txt")).map((e) => e.name).sort();

  for (const filename of files) {
    const def = fieldForFilename(filename);
    if (!def) {
      scan.unknownFiles.push(filename);
      if (config.rules["unknown-file"] !== "off") {
        diagnostics.push({
          locale,
          rule: "unknown-file",
          severity: levelFor(config, "unknown-file", "warning"),
          message: `unrecognised metadata file "${filename}"`,
        });
      }
      continue;
    }

    const raw = await readFile(join(dir, filename), "utf8");
    // A whitespace-only field is effectively empty; otherwise preserve
    // surrounding whitespace so validate.ts can flag it.
    const trimmedForNewline = stripTrailingNewline(raw);
    const value = trimmedForNewline.trim() === "" ? "" : trimmedForNewline;
    scan.fields[def.id] = value;

    if (value === "" && config.rules["empty-field"] !== "off") {
      diagnostics.push({
        locale,
        field: def.id,
        rule: "empty-field",
        severity: levelFor(config, "empty-field", "warning"),
        message: `${def.label} (${filename}) is empty`,
      });
    }
  }

  return scan;
}
