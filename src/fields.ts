/**
 * App Store metadata field definitions.
 *
 * Filenames follow the fastlane deliver `metadata/<locale>/` convention. Limits
 * are Apple's documented App Store Connect character limits (re-verify against
 * Apple's current App Store Connect Help if they change; they are overridable
 * through the metaproof config file).
 *
 * Apple App Store Connect Help - App information reference:
 * https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/
 */

import type { FieldDef, FieldId, FieldLimits } from "./types.ts";

/** Apple's documented character limits for the length-limited text fields. */
export const DEFAULT_LIMITS: FieldLimits = {
  name: 30,
  subtitle: 30,
  keywords: 100,
  promotional_text: 170,
  description: 4000,
  release_notes: 4000,
};

/** All fields metaproof validates, in a stable, report-friendly order. */
export const FIELD_DEFS: readonly FieldDef[] = [
  { id: "name", filename: "name.txt", label: "App Name", kind: "length", limit: DEFAULT_LIMITS.name },
  { id: "subtitle", filename: "subtitle.txt", label: "Subtitle", kind: "length", limit: DEFAULT_LIMITS.subtitle },
  { id: "keywords", filename: "keywords.txt", label: "Keywords", kind: "length", limit: DEFAULT_LIMITS.keywords },
  { id: "promotional_text", filename: "promotional_text.txt", label: "Promotional Text", kind: "length", limit: DEFAULT_LIMITS.promotional_text },
  { id: "description", filename: "description.txt", label: "Description", kind: "length", limit: DEFAULT_LIMITS.description },
  { id: "release_notes", filename: "release_notes.txt", label: "What's New", kind: "length", limit: DEFAULT_LIMITS.release_notes },
  { id: "support_url", filename: "support_url.txt", label: "Support URL", kind: "url" },
  { id: "marketing_url", filename: "marketing_url.txt", label: "Marketing URL", kind: "url" },
  { id: "privacy_url", filename: "privacy_url.txt", label: "Privacy Policy URL", kind: "url" },
  { id: "apple_tv_privacy_policy", filename: "apple_tv_privacy_policy.txt", label: "tvOS Privacy Policy URL", kind: "url" },
];

const BY_FILENAME: ReadonlyMap<string, FieldDef> = new Map(
  FIELD_DEFS.map((def) => [def.filename, def]),
);

/** Look up a field definition by its fastlane deliver filename. */
export function fieldForFilename(filename: string): FieldDef | undefined {
  return BY_FILENAME.get(filename);
}

/** The length-limited text fields. */
export function lengthFields(): FieldDef[] {
  return FIELD_DEFS.filter((def) => def.kind === "length");
}

/** The URL fields. */
export function urlFields(): FieldDef[] {
  return FIELD_DEFS.filter((def) => def.kind === "url");
}

/** Field ids that carry a character limit, matching {@link FieldLimits}. */
export const LENGTH_FIELD_IDS: readonly FieldId[] = lengthFields().map((f) => f.id);
