/**
 * Field-content validation: text limits, URL format, and stray whitespace.
 *
 * Pure over a single already-scanned locale. Only fields that are present are
 * checked (metaproof does not require optional fields to exist). Text fields
 * use grapheme-cluster counting; Apple's keywords limit uses UTF-8 bytes.
 */

import { graphemeCount, utf8ByteCount } from "./count.ts";
import { FIELD_DEFS } from "./fields.ts";
import type { Config, Finding, LocaleScan, RuleLevel, Severity } from "./types.ts";

/** Resolve a rule's active severity, or null when the rule is off. */
function severity(config: Config, rule: string, fallback: Severity): Severity | null {
  const level: RuleLevel | undefined = config.rules[rule];
  if (level === "off") return null;
  return (level as Severity | undefined) ?? fallback;
}

function isHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return url.host.length > 0;
}

/** Validate one locale's field values. Returns findings in stable field order. */
export function validateLocale(scan: LocaleScan, config: Config): Finding[] {
  const findings: Finding[] = [];
  const { locale } = scan;

  for (const def of FIELD_DEFS) {
    const value = scan.fields[def.id];
    if (value === undefined || value === "") continue;

    if (def.kind === "length") {
      const count = def.id === "keywords" ? utf8ByteCount(value) : graphemeCount(value);

      const minLevel = severity(config, "field-min-length", "error");
      const minimumCount = def.min === undefined ? count : graphemeCount(value.trim());
      if (minLevel && def.min !== undefined && minimumCount < def.min) {
        findings.push({
          locale,
          field: def.id,
          rule: "field-min-length",
          severity: minLevel,
          message: `${def.label} must be at least ${def.min} characters (${minimumCount} provided)`,
          count: minimumCount,
          limit: def.min,
        });
      }

      const level = severity(config, "field-length", "error");
      if (level) {
        const limit = config.limits[def.id as keyof Config["limits"]];
        const usesBytes = def.id === "keywords";
        if (count > limit) {
          const unit = usesBytes ? "bytes" : "characters";
          findings.push({
            locale,
            field: def.id,
            rule: "field-length",
            severity: level,
            message: `${def.label} is ${count}/${limit} ${unit} (${count - limit} over the limit)`,
            count,
            limit,
          });
        }
      }
    }

    if (def.kind === "url") {
      const level = severity(config, "url-format", "error");
      if (level && !isHttpUrl(value)) {
        findings.push({
          locale,
          field: def.id,
          rule: "url-format",
          severity: level,
          message: `${def.label} is not a valid http(s) URL: "${value}"`,
        });
      }
    }

    const wsLevel = severity(config, "leading-trailing-whitespace", "warning");
    if (wsLevel && value !== value.trim()) {
      findings.push({
        locale,
        field: def.id,
        rule: "leading-trailing-whitespace",
        severity: wsLevel,
        message: `${def.label} has leading or trailing whitespace`,
      });
    }
  }

  return findings;
}
