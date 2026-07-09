# metaproof

Lint your iOS App Store metadata before you submit.

`metaproof` scans a [fastlane `deliver`](https://docs.fastlane.tools/actions/deliver/) `metadata/` folder and checks every localized field against Apple's App Store Connect character limits and a set of ASO keyword best practices. It runs locally, catches problems per locale before an upload fails with a vague error, and returns a non-zero exit code so it can gate CI.

It is the text half of a submission-preflight pair: [screenproof](https://github.com/vsolano9/screenproof) lints the screenshots the same way.

- Per-locale, Unicode-correct character counting (a family emoji counts as one character, not eleven).
- Field-length checks for every App Store text field.
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
    error   subtitle           Subtitle is 51/30 characters (21 over the limit)
    error   privacy_url        Privacy Policy URL is not a valid http(s) URL: "example.de/datenschutz"
    warning keywords           keyword(s) already indexed from the app name or subtitle: timer
    info    keywords           keywords use 34/100 characters (66 unused)
✓ default  ok
✓ en-US
    warning keywords           keywords waste 6 character(s) on spaces around commas; ...
    warning keywords           duplicate keyword(s): focus
    warning keywords           low-value keyword(s): the
    warning keywords           keyword(s) already indexed from the app name or subtitle: focus, timer, pomodoro, study
    info    keywords           keywords use 55/100 characters (45 unused)

Summary: 2 errors, 5 warnings, 2 info across 3 locales — FAIL
```

## What it checks

### Field length

Character limits, from Apple's App Store Connect Help. metaproof measures user-perceived characters (grapheme clusters), which is how the field length reads to a human and in the App Store Connect editor.

| Field | File | Limit |
| --- | --- | --- |
| App Name | `name.txt` | 30 |
| Subtitle | `subtitle.txt` | 30 |
| Keywords | `keywords.txt` | 100 |
| Promotional Text | `promotional_text.txt` | 170 |
| Description | `description.txt` | 4000 |
| What's New | `release_notes.txt` | 4000 |

Sources: [App Store Connect Help - App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/) and [Creating Your Product Page](https://developer.apple.com/app-store/product-page/). Apple counts characters, not bytes, and spaces and punctuation count toward the limit. Limits are overridable in config in case Apple changes them.

URL fields (`support_url.txt`, `marketing_url.txt`, `privacy_url.txt`, `apple_tv_privacy_policy.txt`) are checked for a valid `http(s)` address.

### ASO keyword field

These are widely used App Store Optimization best practices, not Apple-mandated rules. Each is a config-tunable rule:

- `keyword-space-after-comma`: spaces around commas waste characters against the 100-character budget.
- `keyword-duplicate`: the same keyword listed twice.
- `keyword-empty-term`: empty terms from double or trailing commas.
- `keyword-stop-word`: low-value words (configurable list) that waste budget.
- `keyword-cross-field-duplicate`: keywords Apple already indexes from your app name and subtitle.
- `keyword-capacity`: how much of the 100-character budget is unused (informational).

### Description

The description does not feed keyword search, but it drives conversion. Three config-tunable rules:

- `description-word-count`: the description's word and character count (informational).
- `description-min-words`: warns when the description has fewer words than `description.minWords`. Opt-in; off until you set a threshold.
- `description-line-length`: warns when any single line exceeds `description.maxLineLength` user-perceived characters, which reads poorly on a phone. Opt-in.

Word counting splits on whitespace, so it is most meaningful for space-separated languages; for CJK text treat it as a rough signal.

### Structure

- `unknown-locale`: a metadata subfolder that is not a known App Store locale.
- `unknown-file`: an unrecognized `.txt` file inside a locale folder.
- `empty-field`: a recognized field file with no content.
- `leading-trailing-whitespace`: stray whitespace around a field value.

Non-locale folders such as `review_information/` are skipped. The `default/` fallback folder is linted like a locale.

## Fixing safely with `--fix`

`metaproof --fix` rewrites each locale's `keywords.txt` in place, applying only cleanups that cannot change what you meant:

- removes spaces around commas (each one wastes a character of the 100-character budget),
- drops empty terms left by double or trailing commas,
- removes exact duplicate terms (case-insensitive, keeping the first occurrence and its casing).

A summary of what changed goes to stderr; stdout still carries the normal report, run against the fixed tree. Judgment calls stay with you: `--fix` never removes stop words or keywords duplicated from the name/subtitle, and never truncates an over-limit field. Files that need no changes are not touched. Run it on a tree that is under version control so you can review the diff.

## A note on character counting

metaproof counts grapheme clusters (what a person sees as one character). `String.length` over-counts emoji and astral characters, and byte length over-counts everything non-ASCII, which is the classic trap that makes a field that "looks fine" fail on upload. For unusual emoji or combining-mark sequences, Apple's server-side count can still differ by a character or two, so treat a field that sits exactly on the limit as worth double-checking.

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
  "description": { "minWords": 150, "maxLineLength": 80 }
}
```

- `limits`: override any field limit (positive integers).
- `rules`: set a rule to `error`, `warning`, `info`, or `off`.
- `stopWords`: replace the default keyword stop-word list.
- `locales.allow`: when set, only these locale folders are linted. `extra`: additional valid locale codes. `ignore`: locale folders to skip.
- `description.minWords` / `description.maxLineLength`: opt-in description thresholds; `0` (the default) disables a threshold.

## GitHub Action

```yaml
- uses: vsolano9/metaproof@v0
  with:
    path: fastlane/metadata
    strict: "false"
```

`@v0` tracks the latest `0.x` release; pin to an exact tag such as `@v0.2.0` if you prefer to opt into updates deliberately. The action sets up Node 24 and runs metaproof, so a failed check blocks the workflow. See [`action.yml`](action.yml).

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
```

## Roadmap

- [x] Optional word-count and per-line description checks.
- [x] A `--fix` mode for safe keyword-field cleanups (space removal, dedupe).
- [ ] Screenshot and preview presence checks (currently out of scope).

## Contributing

Issues and pull requests are welcome. Keep the tool dependency-free, add a failing test before a change, and run `npm run lint` (typecheck plus tests) before opening a PR.

## License

MIT. See [LICENSE](LICENSE). This is an independent tool. It is not affiliated with or endorsed by Apple or fastlane; "App Store" and "iOS" are trademarks of Apple Inc., used here only to describe compatibility.
