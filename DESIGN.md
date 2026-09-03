---
version: alpha
name: metaproof
description: Lint iOS App Store metadata for an indie who must know pass or fail before upload; the report should feel like a closing-credits stamp, not a gray log.
tcv:
  spec: 1
  platform: tui
  profile: tui
  audience: "iOS indie developers and CI · 80-col terminals and GitHub Actions logs · deciding whether to submit"
  status: live
  colorScheme: dark
  fonts:
    - { family: "Menlo", source: system, license: "Apple system font" }
  exports:
    - { target: ansi-ts, path: src/colors.generated.ts }
  checks: { contrast: AA, spacingScaleOnly: true, typeRolesOnly: true, maxFontFamilies: 2 }
  scenarios:
    - { id: screen-80x24, surface: src/report.ts, viewport: "80x24", modes: [dark] }
    - { id: screen-120x40, surface: src/report.ts, viewport: "120x40", modes: [dark] }
    - { id: error-state, surface: src/report.ts, viewport: "80x24", modes: [dark] }
  tui:
    roles: { bg: "{colors.canvas}", fg: "{colors.on-canvas}", muted: "{colors.on-surface-secondary}", accent: "{colors.primary}", error: "{colors.danger}", warning: "{colors.warning}", success: "{colors.success}" }
    ansi: { error: red, warning: yellow, info: cyan, success: green, muted: dim }
colors:
  canvas: "#071416"
  on-canvas: "#E8F7F9"
  surface: "#101E21"
  on-surface: "#E8F7F9"
  on-surface-secondary: "#8BB0B6"
  line: "#6B8E94"
  primary: "#2AD4E0"
  on-primary: "#032428"
  primary-surface: "#0A3C42"
  success: "#3EE08A"
  warning: "#F0C14A"
  danger: "#FF7A72"
  on-danger: "#3A0C0A"
typography:
  title: { fontFamily: "Menlo", fontSize: 13px, fontWeight: 700, lineHeight: 16px, letterSpacing: 0px }
  heading: { fontFamily: "Menlo", fontSize: 13px, fontWeight: 700, lineHeight: 16px, letterSpacing: 0px }
  body: { fontFamily: "Menlo", fontSize: 13px, fontWeight: 400, lineHeight: 16px, letterSpacing: 0px }
  body-emphasis: { fontFamily: "Menlo", fontSize: 13px, fontWeight: 700, lineHeight: 16px, letterSpacing: 0px }
  muted: { fontFamily: "Menlo", fontSize: 13px, fontWeight: 400, lineHeight: 16px, letterSpacing: 0px }
  code: { fontFamily: "Menlo", fontSize: 13px, fontWeight: 400, lineHeight: 16px, letterSpacing: 0px }
  status: { fontFamily: "Menlo", fontSize: 13px, fontWeight: 700, lineHeight: 16px, letterSpacing: 0px }
  prompt: { fontFamily: "Menlo", fontSize: 13px, fontWeight: 700, lineHeight: 16px, letterSpacing: 0px }
  timestamp: { fontFamily: "Menlo", fontSize: 13px, fontWeight: 400, lineHeight: 16px, letterSpacing: 0px }
rounded: { none: 0px, sm: 0px, md: 0px, lg: 0px, xl: 0px, full: 0px }
spacing: { "1": 4px, "2": 8px, "3": 12px, "4": 16px, "5": 20px, "6": 24px, "8": 32px, "10": 40px, "12": 48px, "16": 64px }
components:
  button-primary: { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", typography: "{typography.body-emphasis}" }
  button-secondary: { backgroundColor: "{colors.primary-surface}", textColor: "{colors.primary}", typography: "{typography.body}" }
  field: { backgroundColor: "{colors.surface}", textColor: "{colors.on-surface}", typography: "{typography.body}" }
  card: { backgroundColor: "{colors.surface}", textColor: "{colors.on-surface}", borderColor: "{colors.line}" }
  list-row: { backgroundColor: "{colors.canvas}", textColor: "{colors.on-canvas}", typography: "{typography.body}" }
  sheet: { backgroundColor: "{colors.surface}", textColor: "{colors.on-surface}", borderColor: "{colors.line}" }
  chip: { backgroundColor: "{colors.primary-surface}", textColor: "{colors.primary}", typography: "{typography.status}" }
  header: { backgroundColor: "{colors.canvas}", textColor: "{colors.on-canvas}", typography: "{typography.title}" }
elevation:
  level-0: { shadow: none }
  level-1: { shadow: none, border: single }
  level-2: { shadow: none, border: single }
  level-3: { shadow: none, border: double }
motion:
  duration-fast: 120ms
  duration-base: 200ms
  duration-slow: 340ms
  duration-emphasis: 480ms
  ease-standard: "cubic-bezier(0.2,0,0,1)"
  ease-entrance: "cubic-bezier(0,0,0.2,1)"
  ease-exit: "cubic-bezier(0.4,0,1,1)"
  spring-snappy: "response 0.22, damping 0.78"
  spring-smooth: "response 0.34, damping 0.86"
  reduced-motion: crossfade-120
---

## Overview

metaproof is a one-shot TypeScript CLI that lints a fastlane deliver `metadata/` tree before an App Store upload. The user is an indie or a CI job who needs a verdict in seconds, on an 80-column log, often with color stripped. The UI must make them feel cinematic certainty, not a gray log dump.

Visual thesis: a credits roll of locales. Each row opens with a severity glyph, the locale code, then findings whose severity word is washed in truecolor. The Summary line is the closing stamp — `PASS` or `FAIL` — and it is the only primary action on screen. Color is a wash over glyphs and words that already carry the meaning.

Signature decision: **severity cinema** — glyph plus color as one move (`✖`/`✓`/`!`/`·` with a truecolor wash, 16-color ANSI fallback, ASCII `x`/`+`/`!`/`.` when UTF-8 is off). `NO_COLOR` and `--no-color` drop every escape and keep the glyphs and the words.

Rejected category layout: the eslint-stylish dump (`path:line:col: message` with no verdict) and the boxed `==== FAIL ====` banner. Both waste the 80-column beat the stamp needs.

Priority ladder:

1. Preserve supplied facts, prices, units, legal text, privacy requirements, and task constraints.
2. Preserve the host stack, routes, native components, and this DESIGN.md's tokens.
3. Make the reader's job and the one primary action immediately clear.
4. Establish the product's authorship through its type, accent, spacing rhythm, and restraint.
5. Choose a composition specific to this screen; reject both generic defaults and a fixed template.
6. Refine motion, depth, and detail without weakening hierarchy.
7. metaproof: the counts (`34/30`, byte budgets) and the PASS/FAIL word outrank color; a piped log must still decide.

## Colors

Accent is electric proof-cyan, OKLCH L 0.78 / C 0.14 / h 195, hex `{colors.primary}` `#2AD4E0`. Mid-L so it survives a black terminal and a white one. Triad per the dark canvas: `primary` fill with `on-primary` `#032428` (9.01:1), `primary-surface` `#0A3C42` carrying `primary` as ink (6.67:1), `primary` as ink on `canvas` (10.34:1). Neutrals sit on the same cyan hue at very low chroma (`canvas` `#071416`, `surface` `#101E21`, `on-canvas` `#E8F7F9`). `line` `#6B8E94` clears 3:1 on both `canvas` (5.28:1) and `surface` (4.82:1). `danger` / `warning` / `success` paint severity only; they are never a second accent. Truecolor roles map onto the 16-color-safe `tcv.tui.ansi` map (`error: red`, `warning: yellow`, `info: cyan`, `success: green`, `muted: dim`). `NO_COLOR` and `--no-color` disable every escape, including on stderr.

## Typography

The terminal owns the font. Roles map to weight and color only, never to a second family: `title`/`heading`/`status`/`prompt` bold, `body` regular, `muted` in `on-surface-secondary`. Three roles on the report: `muted` header, `body` findings, `status` glyphs and the PASS/FAIL stamp. Never more than those three.

## Layout

Cell grid, single-line rows (this is a report, not a transcript). One cell between glyph and locale code; four-space indent for findings (one group); one blank line after the header and one before Summary. Wrap long messages at width minus two; never wrap `en-US`, `34/30`, or `FAIL` mid-token. Must hold at 80×24 (header + at least one locale + Summary visible). 120×40 spends extra rows on more locales, never on a second pane.

## Elevation & Depth

Tier 0. No shadows, no box drawing on the report. `level-1`/`level-2` single borders and `level-3` double borders exist so the schema validates; they are reserved for a future confirm sheet and must not appear around locale rows.

## Shapes

Radii are all 0. No corners. If a sheet ever ships, one box-drawing weight, light (`│ ─ ┌ ┐ └ ┘`), never mixed, ASCII `+|` fallback when the terminal reports no UTF-8.

## Components

| Component | Role | Notes |
| --- | --- | --- |
| button-primary | Summary stamp | `PASS` in `success` or `FAIL` in `danger`, `status` weight |
| button-secondary | `--fix` hint | stderr only, `muted`; never on the report |
| field | config path | usage errors on stderr, uncolored |
| card | locale block | no border; glyph + code, then indented findings |
| list-row | one finding | severity word in its role, field padded, message with counts |
| sheet | unused | reserved; do not box the report |
| chip | severity glyph | `✖` error, `✓` success, `!` warning, `·` info |
| header | brand line | `metaproof  <root>` in `muted` |

## Motion

One-shot. The signature effect is the severity cinema of the stamp, not a spinner. Redraws do not exist. Reduced-motion equivalent is `NO_COLOR` / `--no-color`: glyphs and words remain, escapes go. Perf budget: one render, no redraw, no spinner on a non-TTY stream (`tui-08`). Ambient loops are forbidden.

## States

- `default` — designed: header, locale rows, Summary stamp.
- `hover/press` — N/A — no interactive widgets.
- `focus-visible` — N/A — no focusable chrome.
- `disabled` — N/A — one-shot; flags either run or they do not.
- `loading` — N/A — never a spinner, including on a pipe.
- `empty` — designed: `missing-locale` / `missing-metadata` as an error row plus `FAIL`.
- `sparse` — designed: one locale still shows header and Summary.
- `error` — designed: `✖` + `error` + `FAIL`.
- `validation` — designed: usage and config errors on stderr, exit 2, uncolored.
- `permission` — N/A — no network, no credentials.
- `offline/retry` — N/A — fully offline.
- `success` — designed: `✓` + `ok` + `PASS`.
- `selected` — N/A — no selection.
- `destructive-confirm` — N/A — `--fix` rewrites only safe keyword cleanups; no confirm UI.
- `interrupted` — designed: default SIGINT; no spinner to interrupt.

## Do's and Don'ts

- Do: paint severity with the glyph and the word (`✖` plus `error`). Don't: drop the word when color is on.
- Do: honor `NO_COLOR` and `--no-color` on stdout and stderr. Don't: emit an escape when either is set.
- Do: keep `34/30` and `100 bytes` in the finding message. Don't: replace a count with a color bar.
- Do: stamp `PASS` or `FAIL` on the Summary line. Don't: omit the verdict because `--quiet` hid locales.
- Do: indent findings four spaces under the locale. Don't: box each locale with `┌─┐`.
- Do: use `✓` for a clean locale and `✖` for a failing one (ASCII `+` / `x` when UTF-8 is off). Don't: use emoji (`✅` / `❌`).
- Do: dim only the `metaproof  <root>` header. Don't: dim the Summary verdict.
- Do: paint `info` findings cyan. Don't: reuse info cyan for the brand line.
- Do: fit header, one locale, and Summary in 80 columns without wrapping `en-US` or `FAIL`. Don't: require 120 columns to read the verdict.
- Do: send the `--fix` rewrite summary to stderr and the report to stdout. Don't: mix the rewrite log into the colored report.
- Do: print usage and config failures as plain text on stderr with exit 2. Don't: color a usage error as a lint `error`.

## Anti-patterns

Inherits tcv-tui anti-patterns.

- metaproof-01 Rainbow findings: a second accent, or painting field names in `primary`.
- metaproof-02 Banner box: wrapping Summary in `====` or a double-line frame.
- metaproof-03 Quiet-blind: `--quiet` hiding the Summary stamp so a clean tree prints nothing.

## Verification

| Scenario | Command | Pass criteria |
| --- | --- | --- |
| screen-80x24 | `COLUMNS=80 node src/cli.ts fixtures/metadata` with a TTY (or `renderHuman(report, { color: true })`) captured to `_receipts/design-system/metaproof/2026-09-03/screen-80x24-dark.txt` | header, at least one locale, Summary `FAIL` visible; no wrap of `en-US` or `FAIL`; glyph plus severity word on each finding; `tr -cd '\033' \| wc -c` > 0 |
| screen-120x40 | same capture at `COLUMNS=120` to `screen-120x40-dark.txt` | extra columns do not add a pane; every locale from the fixture still in one column |
| error-state | `COLUMNS=80 node src/cli.ts` against a tree with no locales, to `error-state-dark.txt` | `missing-locale` (or equivalent) carries `✖` or `error` and Summary `FAIL` |
| NO_COLOR | `NO_COLOR=1 COLUMNS=80 node src/cli.ts fixtures/metadata --no-color` to `screen-80x24-nocolor.txt`; `grep -c $'\x1b['` is 0 | glyphs and `FAIL` remain; zero escapes |

Last verified: 2026-09-03 · receipts `_receipts/design-system/metaproof/2026-09-03/` · `designmd audit` count: 0 before wiring, 0 after. Color capture 32 ESC bytes; `NO_COLOR` capture 0. Frontmatter sha256 `a2a11edee4f3`.
