# Changelog

All notable changes to metaproof are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). While metaproof is
`0.x`, a new check that can fail a previously clean run ships in a minor
release, and every such change is called out below.

## [0.6.0] - 2026-08-27

### Fixed

- An unknown rule id under `rules` is now a config error instead of a setting
  that is accepted and never applied. `{"rules": {"keyword-stopword": "off"}}`
  used to load without complaint and leave `keyword-stop-word` switched on, so a
  single mistyped hyphen produced a config that looked applied and did nothing.
  The message names the bad id and suggests the real one when it is an obvious
  near miss. `required` already rejected unknown field names; `rules` now
  matches it.

### Changed

- **A config that loaded under 0.5.x can now exit 2.** That is the point: the
  configs that start failing are the ones that were never doing anything. Run
  metaproof once after upgrading and fix any id it names.
- `missing-metadata` and `missing-locale` are documented and enforced as
  structural rules that cannot be configured at any level. Both report that
  metaproof validated nothing — the folder was absent, or it held no locale —
  so silencing one would turn a scan that read no metadata into a clean,
  zero-finding, exit-0 report. Neither was ever configurable in practice:
  `missing-locale` was missing from the rule table entirely and both hardcoded
  `error` in the scanner, so a config setting them was silently ignored. They
  are now rejected with a reason instead.
- `defaultConfig().rules` no longer contains a `missing-metadata` key, because
  its presence implied a setting that the scanner never read. Programmatic
  consumers enumerating that object will see one fewer key.

## [0.5.2] - 2026-08-27

### Fixed

- `keyword-space-after-comma` now reports the real UTF-8 byte cost of the
  whitespace beside each comma instead of counting one byte per gap. A run of
  three spaces was reported as one wasted byte, a non-breaking space pasted from
  a spreadsheet as one instead of two, and an ideographic space in a CJK keyword
  list as one instead of three; whitespace wedged between two commas was charged
  twice. `metaproof --fix` already reclaimed the true bytes, so the report and
  the fixer disagreed about the same field — `alpha ,  beta ,   gamma` was
  reported as 4 wasted bytes while `--fix` reclaimed 7. No tree's pass/fail
  result changes: the rule fires on exactly the same fields as before, and only
  the number in its message moves.

## [0.5.1] - 2026-08-24

### Changed

- `homepage` now points at https://thechosenvictor.com/open-source, which
  documents this package, rather than back at this README. No behaviour change.
- Added a Maintainer section to the README.

## [0.5.0] - 2026-08-23

### Fixed

- App Name now enforces Apple's documented two-character minimum, measured in
  user-perceived characters. A one-character `name.txt` can no longer pass
  locally and fail later in App Store Connect.

### Changed

- **A tree that passed 0.4.0 can fail 0.5.0.** `field-min-length` is an error by
  default when App Name contains fewer than two characters. Set
  `"rules": { "field-min-length": "off" }` only for a workflow that deliberately
  validates the minimum elsewhere.
- The GitHub Action example and moving `v0` tag advance to v0.5.0.

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

[0.5.1]: https://github.com/vsolano9/metaproof/releases/tag/v0.5.1
[0.5.0]: https://github.com/vsolano9/metaproof/releases/tag/v0.5.0
[0.4.0]: https://github.com/vsolano9/metaproof/releases/tag/v0.4.0
[0.3.0]: https://github.com/vsolano9/metaproof/releases/tag/v0.3.0
[0.2.0]: https://github.com/vsolano9/metaproof/releases/tag/v0.2.0
[0.1.0]: https://www.npmjs.com/package/metaproof/v/0.1.0
