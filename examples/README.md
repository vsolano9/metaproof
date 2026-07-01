# Examples

## Try it on the bundled fixture

The repository ships a sample metadata tree at [`../fixtures/metadata`](../fixtures/metadata) that intentionally contains problems (an over-limit German subtitle, a malformed privacy URL, and several keyword-field issues).

```bash
# from the repo root
node src/cli.ts fixtures/metadata
```

It exits `1` and prints a per-locale report. Try `--strict`, `--json`, and `--quiet` to see the other output modes.

## Example config

[`metaproof.json`](metaproof.json) shows a typical override file: it turns the whitespace rule off and pins a custom stop-word list. Point at it explicitly:

```bash
node src/cli.ts fixtures/metadata --config examples/metaproof.json
```

Or copy it to your project root as `metaproof.json` and metaproof loads it automatically.
