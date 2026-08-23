/**
 * Required-field check: the fields App Store Connect will not accept a
 * submission without.
 *
 * Every other rule in metaproof judges a value that is already there. This one
 * judges absence, which is the failure that actually blocks a submission: a
 * locale folder holding only an app name is silently "clean" to a
 * content-only linter and rejected by App Store Connect.
 *
 * The default list is the five localized fields Apple documents as required for
 * an App Store submission: App Name, Keywords, Description, Support URL, and
 * Privacy Policy URL. It is a config list (`required`), not a hard-coded one,
 * because teams localize differently and Apple's requirements change.
 *
 * A value can be inherited: fastlane deliver falls back to `metadata/default/`
 * for any locale that does not carry its own file, so a field satisfied there
 * satisfies it everywhere.
 */

import { FIELD_DEFS } from "./fields.ts";
import type { Config, Finding, FieldId, LocaleScan, RuleLevel, Severity } from "./types.ts";

function severity(config: Config, rule: string, fallback: Severity): Severity | null {
  const level: RuleLevel | undefined = config.rules[rule];
  if (level === "off") return null;
  return (level as Severity | undefined) ?? fallback;
}

/** True when a scanned value carries actual content. */
function isPresent(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== "";
}

/**
 * Check one locale for missing required fields.
 *
 * `inherited` carries the `metadata/default/` fields, which stand in for any
 * field this locale does not define. Findings come back in the same stable
 * field order the rest of the report uses, regardless of how the config lists
 * them.
 */
export function lintRequired(
  scan: LocaleScan,
  config: Config,
  inherited: Partial<Record<FieldId, string>> = {},
): Finding[] {
  const level = severity(config, "required-field", "error");
  if (!level) return [];

  const required = new Set(config.required);
  if (required.size === 0) return [];

  const findings: Finding[] = [];
  for (const def of FIELD_DEFS) {
    if (!required.has(def.id)) continue;

    const own = scan.fields[def.id];
    if (isPresent(own) || isPresent(inherited[def.id])) continue;

    const reason = own === undefined ? `missing (no ${def.filename})` : `empty`;
    const verb = def.id === "keywords" ? "are" : "is";
    findings.push({
      locale: scan.locale,
      field: def.id,
      rule: "required-field",
      severity: level,
      message: `${def.label} ${verb} required for App Store submission but ${verb} ${reason}`,
    });
  }

  return findings;
}
