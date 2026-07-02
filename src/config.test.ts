import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defaultConfig, loadConfig, mergeConfig } from "./config.ts";
import { DEFAULT_LIMITS } from "./fields.ts";

test("defaultConfig uses Apple's default limits and non-empty rules/stopWords", () => {
  const cfg = defaultConfig();
  assert.deepEqual(cfg.limits, DEFAULT_LIMITS);
  assert.ok(Object.keys(cfg.rules).length > 0);
  assert.ok(cfg.stopWords.length > 0);
  assert.equal(cfg.locales.allow, null);
});

test("mergeConfig with no input returns an equal config", () => {
  const base = defaultConfig();
  assert.deepEqual(mergeConfig(base, undefined), base);
  assert.deepEqual(mergeConfig(base, {}), base);
});

test("mergeConfig overrides a single limit and keeps the rest", () => {
  const cfg = mergeConfig(defaultConfig(), { limits: { subtitle: 25 } });
  assert.equal(cfg.limits.subtitle, 25);
  assert.equal(cfg.limits.name, 30);
});

test("mergeConfig rejects a non-positive or non-integer limit", () => {
  assert.throws(() => mergeConfig(defaultConfig(), { limits: { subtitle: -1 } }));
  assert.throws(() => mergeConfig(defaultConfig(), { limits: { subtitle: 1.5 } }));
  assert.throws(() => mergeConfig(defaultConfig(), { limits: { subtitle: "x" } }));
});

test("mergeConfig overrides a rule level and keeps other rules", () => {
  const base = defaultConfig();
  const cfg = mergeConfig(base, { rules: { "keyword-stop-word": "off" } });
  assert.equal(cfg.rules["keyword-stop-word"], "off");
  assert.equal(cfg.rules["field-length"], base.rules["field-length"]);
});

test("mergeConfig rejects an invalid rule level", () => {
  assert.throws(() => mergeConfig(defaultConfig(), { rules: { "field-length": "loud" } }));
});

test("mergeConfig replaces stopWords when provided", () => {
  const cfg = mergeConfig(defaultConfig(), { stopWords: ["foo", "bar"] });
  assert.deepEqual(cfg.stopWords, ["foo", "bar"]);
});

test("mergeConfig rejects a non-array stopWords", () => {
  assert.throws(() => mergeConfig(defaultConfig(), { stopWords: "nope" }));
});

test("mergeConfig merges locale settings", () => {
  const cfg = mergeConfig(defaultConfig(), { locales: { ignore: ["fr-FR"], extra: ["xx-YY"] } });
  assert.deepEqual(cfg.locales.ignore, ["fr-FR"]);
  assert.deepEqual(cfg.locales.extra, ["xx-YY"]);
  assert.equal(cfg.locales.allow, null);
});

test("defaultConfig disables both description thresholds", () => {
  assert.deepEqual(defaultConfig().description, { minWords: 0, maxLineLength: 0 });
});

test("mergeConfig merges description thresholds and keeps the other", () => {
  const cfg = mergeConfig(defaultConfig(), { description: { minWords: 150 } });
  assert.equal(cfg.description.minWords, 150);
  assert.equal(cfg.description.maxLineLength, 0);
});

test("mergeConfig rejects malformed description settings", () => {
  assert.throws(() => mergeConfig(defaultConfig(), { description: "nope" }));
  assert.throws(() => mergeConfig(defaultConfig(), { description: { minWords: -1 } }));
  assert.throws(() => mergeConfig(defaultConfig(), { description: { maxLineLength: 1.5 } }));
});

test("mergeConfig rejects a non-object input", () => {
  assert.throws(() => mergeConfig(defaultConfig(), "notobject"));
  assert.throws(() => mergeConfig(defaultConfig(), 42));
});

test("loadConfig reads and merges a JSON config file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "metaproof-cfg-"));
  const file = join(dir, "metaproof.json");
  await writeFile(file, JSON.stringify({ limits: { name: 25 } }), "utf8");
  const cfg = await loadConfig(file);
  assert.equal(cfg.limits.name, 25);
  assert.equal(cfg.limits.subtitle, 30);
});

test("loadConfig rejects a missing file with a clear error", async () => {
  await assert.rejects(loadConfig(join(tmpdir(), "metaproof-does-not-exist-xyz.json")), /config/i);
});

test("loadConfig rejects malformed JSON mentioning the file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "metaproof-cfg-"));
  const file = join(dir, "bad.json");
  await writeFile(file, "{ not json", "utf8");
  await assert.rejects(loadConfig(file), (err: Error) => err.message.includes("bad.json"));
});
