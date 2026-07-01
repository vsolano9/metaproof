/**
 * App Store locale codes.
 *
 * These are the localisation codes App Store Connect and fastlane deliver use
 * for `metadata/<locale>/` folders. metaproof warns when it finds a metadata
 * subfolder whose name is neither a known locale nor an intentionally skipped
 * non-locale folder. The list can be extended per project via config
 * (`locales.extra`) if Apple adds a localisation.
 */

/** Known App Store localisation codes plus the fastlane `default` fallback. */
export const KNOWN_LOCALES: ReadonlySet<string> = new Set([
  "default",
  "ar-SA",
  "ca",
  "cs",
  "da",
  "de-DE",
  "el",
  "en-AU",
  "en-CA",
  "en-GB",
  "en-US",
  "es-ES",
  "es-MX",
  "fi",
  "fr-CA",
  "fr-FR",
  "he",
  "hi",
  "hr",
  "hu",
  "id",
  "it",
  "ja",
  "ko",
  "ms",
  "nl-NL",
  "no",
  "pl",
  "pt-BR",
  "pt-PT",
  "ro",
  "ru",
  "sk",
  "sv",
  "th",
  "tr",
  "uk",
  "vi",
  "zh-Hans",
  "zh-Hant",
]);

/** Metadata subfolders that are not locales and must not be linted as locales. */
export const NON_LOCALE_FOLDERS: ReadonlySet<string> = new Set([
  "review_information",
  "trade_representative_contact_information",
]);

/** True when `name` is a built-in known App Store locale code. */
export function isKnownLocale(name: string): boolean {
  return KNOWN_LOCALES.has(name);
}
