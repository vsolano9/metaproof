/**
 * Field-content validation: character limits, URL format, and stray whitespace.
 *
 * Pure over a single already-scanned locale. Only fields that are present are
 * checked (metaproof does not require optional fields to exist). Length is
 * measured with grapheme-cluster counting so emoji and combining marks count
 * the way a human sees them.
 */

import { graphemeCount } from "./count.ts";
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
      const level = severity(config, "field-length", "error");
      if (level) {
        const limit = config.limits[def.id as keyof Config["limits"]];
        const count = graphemeCount(value);
        if (count > limit) {
          findings.push({
            locale,
            field: def.id,
            rule: "field-length",
            severity: level,
            message: `${def.label} is ${count}/${limit} characters (${count - limit} over the limit)`,
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
