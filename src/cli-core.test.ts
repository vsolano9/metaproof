import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseArgs, run, type Io } from "./cli-core.ts";

function fakeIo(overrides: Partial<Io> = {}): Io & { out: string; err: string } {
  const io = {
    out: "",
    err: "",
    write(text: string) { this.out += text; },
    error(text: string) { this.err += text; },
    cwd: process.cwd(),
    isTTY: false,
    env: {} as Record<string, string | undefined>,
    ...overrides,
  };
  return io as Io & { out: string; err: string };
}

async function makeMetadata(files: Record<string, string>, sub = "metadata"): Promise<{ root: string; base: string }> {
  const base = await mkdtemp(join(tmpdir(), "metaproof-cli-"));
  const root = join(base, sub);
  await mkdir(root, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, content, "utf8");
  }
  return { root, base };
}

test("parseArgs parses flags, options, and a positional path", () => {
  const args = parseArgs(["fastlane/metadata", "--config=c.json", "--strict", "--json", "--quiet", "--no-color"]);
  assert.equal(args.path, "fastlane/metadata");
  assert.equal(args.config, "c.json");
  assert.equal(args.strict, true);
  assert.equal(args.json, true);
  assert.equal(args.quiet, true);
  assert.equal(args.color, false);
});

test("parseArgs parses --fix and defaults it to false", () => {
  assert.equal(parseArgs([]).fix, false);
  assert.equal(parseArgs(["--fix"]).fix, true);
});

test("parseArgs supports --config with a separate value", () => {
  assert.equal(parseArgs(["--config", "x.json"]).config, "x.json");
});

test("parseArgs throws on unknown flags and extra positionals", () => {
  assert.throws(() => parseArgs(["--bogus"]));
  assert.throws(() => parseArgs(["a", "b"]));
});

test("run --help prints usage and exits 0", async () => {
  const io = fakeIo();
  assert.equal(await run(["--help"], io), 0);
  assert.match(io.out, /Usage/);
  assert.match(io.out, /metaproof/);
});

test("run --version prints a semver and exits 0", async () => {
  const io = fakeIo();
  assert.equal(await run(["--version"], io), 0);
  assert.match(io.out, /\d+\.\d+\.\d+/);
});

test("run passes a clean tree with exit 0 and PASS", async () => {
  const { root } = await makeMetadata({
    "en-US/name.txt": "Focus Timer",
    "en-US/keywords.txt": "pomodoro,focus,study",
  });
  const io = fakeIo();
  assert.equal(await run([root], io), 0);
  assert.match(io.out, /PASS/);
});

test("run fails a broken tree with exit 1 and FAIL", async () => {
  const { root } = await makeMetadata({ "en-US/name.txt": "way too long an app name to ever fit here" });
  const io = fakeIo();
  assert.equal(await run([root], io), 1);
  assert.match(io.out, /FAIL/);
});

test("run --json emits parseable JSON", async () => {
  const { root } = await makeMetadata({ "en-US/name.txt": "Focus Timer" });
  const io = fakeIo();
  await run([root, "--json"], io);
  const parsed = JSON.parse(io.out);
  assert.equal(typeof parsed.ok, "boolean");
  assert.ok(Array.isArray(parsed.locales));
});

test("run --strict fails on warnings-only", async () => {
  const { root } = await makeMetadata({ "en-US/keywords.txt": "the,best" });
  assert.equal(await run([root], fakeIo()), 0);
  assert.equal(await run([root, "--strict"], fakeIo()), 1);
});

test("run reports a bad config path to stderr with exit 2", async () => {
  const { root } = await makeMetadata({ "en-US/name.txt": "Focus Timer" });
  const io = fakeIo();
  assert.equal(await run([root, "--config", join(tmpdir(), "nope-xyz.json")], io), 2);
  assert.match(io.err, /config/i);
});

test("run reports unknown flags to stderr with exit 2", async () => {
  const io = fakeIo();
  assert.equal(await run(["--bogus"], io), 2);
  assert.ok(io.err.length > 0);
});

test("run --no-color emits no ANSI escape codes", async () => {
  const { root } = await makeMetadata({ "en-US/name.txt": "way too long an app name to ever fit here" });
  const io = fakeIo({ isTTY: true });
  await run([root, "--no-color"], io);
  assert.equal(io.out.includes("["), false);
});

test("run auto-loads metaproof.json from the working directory", async () => {
  const { root, base } = await makeMetadata({ "en-US/subtitle.txt": "twelve chars" });
  await writeFile(join(base, "metaproof.json"), JSON.stringify({ limits: { subtitle: 10 } }), "utf8");
  // Without the config the 12-char subtitle passes the default limit of 30.
  assert.equal(await run([root], fakeIo({ cwd: process.cwd() })), 0);
  // With auto-loaded config (limit 10) it fails.
  assert.equal(await run([root], fakeIo({ cwd: base })), 1);
});

test("run --fix rewrites the keywords file, then reports the fixed tree", async () => {
  const { root } = await makeMetadata({ "en-US/keywords.txt": "photo, editor, photo\n" });
  const io = fakeIo();
  assert.equal(await run([root, "--fix"], io), 0);
  assert.equal(await readFile(join(root, "en-US/keywords.txt"), "utf8"), "photo,editor\n");
  // Summary goes to stderr; the stdout report reflects the already-fixed tree.
  assert.match(io.err, /fixed 1 file/);
  assert.doesNotMatch(io.out, /duplicate/);
  assert.match(io.out, /PASS/);
});

test("run --fix on a clean tree reports nothing to fix and leaves files alone", async () => {
  const { root } = await makeMetadata({ "en-US/keywords.txt": "photo,editor\n" });
  const io = fakeIo();
  assert.equal(await run([root, "--fix"], io), 0);
  assert.match(io.err, /nothing to fix/i);
  assert.equal(await readFile(join(root, "en-US/keywords.txt"), "utf8"), "photo,editor\n");
});

test("run auto-detects fastlane/metadata when no path is given", async () => {
  const { base } = await makeMetadata({ "en-US/name.txt": "Focus Timer" }, "fastlane/metadata");
  const io = fakeIo({ cwd: base });
  assert.equal(await run([], io), 0);
  assert.match(io.out, /PASS/);
});
