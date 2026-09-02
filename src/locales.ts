/**
 * App Store locale codes.
 *
 * These are the localisation codes App Store Connect and fastlane deliver use
 * for `metadata/<locale>/` folders. The set matches Apple's App Store Connect
 * API locale-shortcode table (50 codes as of 2026-09-02;
 * https://developer.apple.com/documentation/appstoreconnectapi/managing-metadata-in-your-app-by-using-locale-shortcodes)
 * plus the fastlane `default` fallback. metaproof warns when it finds a
 * metadata subfolder whose name is neither a known locale nor an intentionally
 * skipped non-locale folder. The list can be extended per project via config
 * (`locales.extra`) if Apple adds a localisation.
 */

/** Known App Store localisation codes plus the fastlane `default` fallback. */
export const KNOWN_LOCALES: ReadonlySet<string> = new Set([
  "default",
  "ar-SA",
  "bn-BD",
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
  "gu-IN",
  "he",
  "hi",
  "hr",
  "hu",
  "id",
  "it",
  "ja",
  "kn-IN",
  "ko",
  "ml-IN",
  "mr-IN",
  "ms",
  "nl-NL",
  "no",
  "or-IN",
  "pa-IN",
  "pl",
  "pt-BR",
  "pt-PT",
  "ro",
  "ru",
  "sk",
  "sl-SI",
  "sv",
  "ta-IN",
  "te-IN",
  "th",
  "tr",
  "uk",
  "ur-PK",
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
