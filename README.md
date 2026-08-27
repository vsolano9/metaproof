# metaproof

Lint your iOS App Store metadata before you submit.

`metaproof` scans a [fastlane `deliver`](https://docs.fastlane.tools/actions/deliver/) `metadata/` folder and checks every localized field against Apple's App Store Connect limits and a set of ASO keyword best practices. It runs locally, catches problems per locale before an upload fails with a vague error, and returns a non-zero exit code so it can gate CI.

It is the text half of a submission-preflight pair: [screenproof](https://github.com/vsolano9/screenproof) lints the screenshots the same way.

- Per-locale, Unicode-correct counting: user-perceived characters for ordinary text fields and UTF-8 bytes for Apple's keyword budget.
- Field-length checks for every App Store text field, including Apple's two-character minimum for App Name.
- An ASO keyword-field linter: wasted separator spaces, duplicates, stop words, cross-field duplication, and unused keyword budget.
- A `--fix` mode that applies the safe keyword cleanups (separator spaces, duplicates, empty terms) in place.
- Description checks: word count, plus opt-in minimum-word-count and per-line-length thresholds.
- URL fields checked for a valid `http(s)` address.
- **Zero runtime dependencies.** Fully offline. No network, no credentials, no telemetry.

## Requirements

Node.js 24 or newer, and zero runtime dependencies. The published package ships compiled JavaScript, so `npx metaproof` and `npm install` just work with no build step or compiler on your side. (The GitHub Action and local development run the TypeScript sources directly on Node's native type stripping.)

## Install

Run it without installing:

```bash
npx metaproof fastlane/metadata
```

Or add it to a project:

```bash
npm install --save-dev metaproof
```

## Usage

```bash
metaproof [path] [options]
```

If `path` is omitted, metaproof looks for `./fastlane/metadata`, then `./metadata`.

| Option | Description |
| --- | --- |
| `--config <file>` | JSON config to override limits, rules, stop words, and locales. |
| `--fix` | Apply safe keyword-field cleanups in place, then report the fixed tree. |
| `--strict` | Exit non-zero on warnings as well as errors. |
| `--json` | Print the report as JSON. |
| `--quiet` | Hide clean locales and info findings. |
| `--no-color` | Disable ANSI color (also respects `NO_COLOR`). |
| `-h, --help` | Show help. |
| `-v, --version` | Show the version. |

Exit codes: `0` clean, `1` lint errors (or warnings under `--strict`), `2` usage or config error.

### Example

```text
$ metaproof fastlane/metadata

✖ de-DE
    error   description        Description is required for App Store submission but is missing (no description.txt)
    error   subtitle           Subtitle is 51/30 characters (21 over the limit)
    error   privacy_url        Privacy Policy URL is not a valid http(s) URL: "example.de/datenschutz"
    warning keywords           keyword(s) already indexed from the app name or subtitle: timer
    info    keywords           keywords use 35/100 bytes (65 unused)
✓ default  ok
✓ en-US
    warning keywords           keywords waste 6 byte(s) on spaces around commas; ...
    warning keywords           duplicate keyword(s): focus
    warning keywords           low-value keyword(s): the
    warning keywords           keyword(s) already indexed from the app name or subtitle: focus, timer, pomodoro, study
    info    keywords           keywords use 55/100 bytes (45 unused)
    info    description        description has 28 words (154/4000 characters)

Summary: 3 errors, 5 warnings, 3 info across 3 locales — FAIL
```

## What it checks

### Required fields

A content linter only judges values that are there. The failure that actually
blocks a submission is the file that is missing: a locale can have valid copy
and URLs while still being rejected because `keywords.txt` is absent.

- `required-field`: a field App Store Connect requires is absent, empty, or
  whitespace-only. Error by default.

The default list is App Name, Keywords, Description, Support URL, and Privacy Policy URL —
the five localized fields Apple marks required for submission. What's New is
left out because it applies only to updates; add it through `required` when
linting an update-only tree.

A value can be inherited. fastlane deliver falls back to `metadata/default/` for
any locale without its own file, so a field set there satisfies every locale.
`default/` is not itself a submitted localisation, so it is only checked for
required fields when it is the one folder in the tree.

To turn the check off entirely, set `"rules": { "required-field": "off" }` or
`"required": []`.

### Field length

Field limits come from Apple's App Store Connect Help. metaproof measures ordinary text fields in user-perceived characters (grapheme clusters) and the Keywords field in UTF-8 bytes. `field-min-length` rejects an App Name shorter than Apple's two-character minimum; `field-length` enforces the maximums.

| Field | File | Constraint |
| --- | --- | --- |
| App Name | `name.txt` | 2–30 characters |
| Subtitle | `subtitle.txt` | Maximum 30 characters |
| Keywords | `keywords.txt` | Maximum 100 bytes |
| Promotional Text | `promotional_text.txt` | Maximum 170 characters |
| Description | `description.txt` | Maximum 4000 characters |
| What's New | `release_notes.txt` | Maximum 4000 characters |

Sources: [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/) and [Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/). Apple documents character limits for the ordinary text fields and a 100-byte limit for Keywords. Limits are overridable in config in case Apple changes them.

URL fields (`support_url.txt`, `marketing_url.txt`, `privacy_url.txt`, `apple_tv_privacy_policy.txt`) are checked for a valid `http(s)` address.

### ASO keyword field

These are widely used App Store Optimization best practices, not Apple-mandated rules. Each is a config-tunable rule:

- `keyword-space-after-comma`: spaces around commas waste bytes against the 100-byte budget.
- `keyword-duplicate`: the same keyword listed twice.
- `keyword-empty-term`: empty terms from double or trailing commas.
- `keyword-stop-word`: low-value words (configurable list) that waste budget.
- `keyword-cross-field-duplicate`: keywords Apple already indexes from your app name and subtitle.
- `keyword-capacity`: how much of the 100-byte budget is unused (informational).

### Description

The description does not feed keyword search, but it drives conversion. Three config-tunable rules:

- `description-word-count`: the description's word and character count (informational).
- `description-min-words`: warns when the description has fewer words than `description.minWords`. Opt-in; off until you set a threshold.
- `description-line-length`: warns when any single line exceeds `description.maxLineLength` user-perceived characters, which reads poorly on a phone. Opt-in.

Word counting splits on whitespace, so it is most meaningful for space-separated languages; for CJK text treat it as a rough signal.

### Structure

Two rules report that metaproof validated nothing at all. Both are always
errors, and neither can be set through `rules` — see
[Rules that cannot be turned off](#rules-that-cannot-be-turned-off).

- `missing-metadata`: the metadata folder does not exist at the path given.
- `missing-locale`: the metadata root exists but contains no scannable App Store
  locale or `default/` folder. A zero-locale scan did not validate any localized
  metadata. Filtering every locale through `locales.allow` or `locales.ignore`
  produces the same error.

The rest describe something metaproof did read, and are configurable as usual:

- `unknown-locale`: a metadata subfolder that is not a known App Store locale.
- `unknown-file`: an unrecognized `.txt` file inside a locale folder.
- `empty-field`: a recognized field file with no content.
- `leading-trailing-whitespace`: stray whitespace around a field value.

Non-locale folders such as `review_information/` are skipped. The `default/` fallback folder is linted like a locale, except for `required-field` (see [Required fields](#required-fields)).

## Fixing safely with `--fix`

`metaproof --fix` rewrites each locale's `keywords.txt` in place, applying only cleanups that cannot change what you meant:

- removes spaces around commas (each one wastes a byte of the 100-byte budget),
- drops empty terms left by double or trailing commas,
- removes exact duplicate terms (case-insensitive, keeping the first occurrence and its casing).

A summary of what changed goes to stderr; stdout still carries the normal report, run against the fixed tree. Judgment calls stay with you: `--fix` never removes stop words or keywords duplicated from the name/subtitle, and never truncates an over-limit field. Files that need no changes are not touched. Run it on a tree that is under version control so you can review the diff.

## A note on counting

For ordinary text limits, metaproof counts grapheme clusters (what a person sees as one character). `String.length` over-counts emoji and astral characters. Keywords are the exception: Apple publishes a 100-byte budget, so metaproof counts the UTF-8 bytes that the field consumes. For unusual combining-mark sequences in character-limited fields, treat a value exactly at the limit as worth double-checking.

## Configuration

Pass `--config <file>`, or drop a `metaproof.json` in your working directory and metaproof loads it automatically. Every key is optional and merges over the defaults.

```json
{
  "limits": { "subtitle": 30, "keywords": 100 },
  "rules": {
    "keyword-cross-field-duplicate": "warning",
    "leading-trailing-whitespace": "off"
  },
  "stopWords": ["the", "a", "app", "best", "free"],
  "locales": { "allow": null, "extra": ["en-IN"], "ignore": ["fr-CA"] },
  "description": { "minWords": 150, "maxLineLength": 80 },
  "required": ["name", "keywords", "description", "support_url", "privacy_url"]
}
```

- `limits`: override any field limit (positive integers).
- `rules`: set a rule to `error`, `warning`, `info`, or `off`. The rule id must
  be one metaproof ships; an unknown id is a config error rather than a setting
  that is accepted and never applied, and an obvious near miss is corrected in
  the message (`keyword-stopword` suggests `keyword-stop-word`).
- `stopWords`: replace the default keyword stop-word list.
- `locales.allow`: when set, only these locale folders are linted. `extra`: additional valid locale codes. `ignore`: locale folders to skip.
- `description.minWords` / `description.maxLineLength`: opt-in description thresholds; `0` (the default) disables a threshold.
- `required`: the fields every locale must carry. Replaces the default list, so
  include the defaults you still want. Any field name from the table above is
  valid; an unknown one is a config error. `[]` disables the check.

### Rules that cannot be turned off

`missing-metadata` and `missing-locale` are not accepted in `rules` at any
level. Every other rule judges a value metaproof actually read, so turning it
off narrows the report to the problems you still want to hear about. These two
report that there was nothing to read: the folder was not there, or it held no
locale. Silencing one would turn "metaproof could not look" into a clean,
zero-finding, exit-0 report — the failure the zero-locale check exists to
prevent. Setting either is a config error that says so.

If a tree legitimately has no locales, point metaproof at the right path or fix
`locales.allow` / `locales.ignore`, rather than silencing the check.

## GitHub Action

```yaml
- uses: vsolano9/metaproof@v0.6.0
  with:
    path: fastlane/metadata
    strict: "false"
```

The exact tag keeps CI reproducible. The moving `@v0` tag points to the
same `v0.6.0` release for users who prefer automatic compatible updates. The
action sets up Node 24 and runs metaproof, so a failed check blocks the workflow.
See [`action.yml`](action.yml).

## Programmatic API

```ts
import { lint, renderHuman, exitCode } from "metaproof";

const report = await lint("fastlane/metadata");
console.log(renderHuman(report));
process.exit(exitCode(report, false));
```

`lint(path, config?)` returns a `LintReport` with per-locale findings and severity counts. `defaultConfig()`, `mergeConfig()`, and `loadConfig()` build the config; `renderHuman()`, `renderJson()`, and `exitCode()` format and gate it.

## Validation

```bash
npm run typecheck   # tsc --noEmit
npm test            # node --test
npm run build       # compile the published package
```

## Changelog

Release history, including which changes can fail a previously clean run, is in
[CHANGELOG.md](CHANGELOG.md).

## Roadmap

- [x] Optional word-count and per-line description checks.
- [x] A `--fix` mode for safe keyword-field cleanups (space removal, dedupe).
- [x] Required-field checks for the fields App Store Connect will not submit without.
- [ ] Screenshot and preview presence checks (currently out of scope — see [screenproof](https://github.com/vsolano9/screenproof)).

## Contributing

Issues and pull requests are welcome. Keep the tool dependency-free, add a failing test before a change, and run `npm run lint` (typecheck plus tests) before opening a PR.

## Maintainer

`metaproof` and its screenshot sibling [screenproof](https://github.com/vsolano9/screenproof) are built and maintained by [Victor Solano](https://thechosenvictor.com/open-source), who runs them against twelve App Store apps before every submission.

## License

MIT. See [LICENSE](LICENSE). This is an independent tool. It is not affiliated with or endorsed by Apple or fastlane; "App Store" and "iOS" are trademarks of Apple Inc., used here only to describe compatibility.
