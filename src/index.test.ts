import { test } from "node:test";
import assert from "node:assert/strict";

import * as api from "./index.ts";

test("index exposes the public API surface", () => {
  assert.equal(typeof api.lint, "function");
  assert.equal(typeof api.defaultConfig, "function");
  assert.equal(typeof api.loadConfig, "function");
  assert.equal(typeof api.mergeConfig, "function");
  assert.equal(typeof api.renderHuman, "function");
  assert.equal(typeof api.renderJson, "function");
  assert.equal(typeof api.exitCode, "function");
  assert.equal(typeof api.graphemeCount, "function");
  assert.equal(typeof api.lintKeywords, "function");
  assert.equal(typeof api.lintDescription, "function");
  assert.equal(typeof api.wordCount, "function");
  assert.equal(typeof api.fixKeywords, "function");
  assert.equal(typeof api.fixMetadata, "function");
  assert.equal(typeof api.renderFixSummary, "function");
  assert.ok(api.DEFAULT_LIMITS.name === 30);
});
