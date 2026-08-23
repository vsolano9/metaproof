# Changelog

All notable changes to metaproof are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). While metaproof is
`0.x`, a new check that can fail a previously clean run ships in a minor
release, and every such change is called out below.

## [0.4.0] - 2026-08-23

### Fixed

- Keywords now use Apple's documented 100-byte budget. metaproof measures the
  field in UTF-8 bytes, so non-ASCII metadata can no longer pass locally while
  exceeding App Store Connect's limit.
- Keywords are now part of the default `required-field` list, matching Apple's
  current requirement for localized platform-version metadata.
- `--fix` reports bytes reclaimed from the keyword budget. Its public result
  retains `charsSaved` for compatibility and adds `bytesSaved` for the enforced
  budget.

### Changed

- **A tree that passed 0.3.0 can fail 0.4.0.** A missing `keywords.txt` is now an
  error, and a non-ASCII keyword field over 100 UTF-8 bytes is over limit even
  when it contains fewer than 100 user-perceived characters. Override
  `required` only when a deliberate workflow supplies Keywords elsewhere.
- The GitHub Action example pins the exact v0.4.0 release, and hosted repository
  CI was removed so project validation remains local-only.

## [0.3.0] - 2026-08-06

### Added

- `required-field`: a locale that is missing App Name, Description, Support URL,
  or Privacy Policy URL now fails. Every other rule judges a value that is
  present; this one catches the file that is not there, which is the state App
  Store Connect actually rejects.
- `required` config key: replace the default list with your own. Any known field
  name is valid, `[]` disables the check, and an unknown name is a config error.

### Changed

- **A tree that passed 0.2.0 can fail 0.3.0.** A locale folder holding only
  `keywords.txt` used to exit `0`; it now reports four errors and exits `1`. To
  keep the old behaviour, set `"rules": { "required-field": "off" }` or
  `"required": []`.
- `metadata/default/` is treated as what fastlane deliver uses it for: a
  fallback. A required field set there satisfies every locale, and `default/`
  itself is only checked for required fields when it is the one folder in the
  tree.
- The bundled example fixture now models a German localization shipped without a
  translated description, so the sample report demonstrates the new rule.

## [0.2.1] - unreleased

Superseded by 0.3.0, which carries this fix.

### Fixed

- A metadata root that exists but contains no scannable locale is an error
  (`missing-locale`) instead of an empty pass. A zero-locale run validated
  nothing and still exited `0`. Filtering every locale out through
  `locales.allow` or `locales.ignore` reports the same error.

## [0.2.0] - 2026-07-03

### Added

- `--fix`: rewrites each locale's `keywords.txt`, applying only cleanups that
  cannot change intent — trim terms, drop empty terms from double or trailing
  commas, remove case-insensitive duplicates. Stop words, cross-field
  duplicates, and over-limit truncation are deliberately left to a human.
- Description checks: `description-word-count` (informational), plus opt-in
  `description-min-words` and `description-line-length` thresholds.

## [0.1.0] - 2026-07-01

### Added

- Initial release: per-locale linting of a fastlane deliver `metadata/` tree —
  field-length limits measured in grapheme clusters, `http(s)` URL format,
  stray whitespace, unknown locales and files, empty fields, and the ASO
  keyword-field rules (`keyword-space-after-comma`, `keyword-duplicate`,
  `keyword-empty-term`, `keyword-stop-word`, `keyword-cross-field-duplicate`,
  `keyword-capacity`).
- CLI with `--strict`, `--json`, `--quiet`, `--no-color`, and `--config`, a
  programmatic `lint()` API, and a GitHub Action. Zero dependencies, fully
  offline.

[0.4.0]: https://github.com/vsolano9/metaproof/releases/tag/v0.4.0
[0.3.0]: https://github.com/vsolano9/metaproof/releases/tag/v0.3.0
[0.2.0]: https://github.com/vsolano9/metaproof/releases/tag/v0.2.0
[0.1.0]: https://www.npmjs.com/package/metaproof/v/0.1.0
