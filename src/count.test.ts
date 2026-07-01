import { test } from "node:test";
import assert from "node:assert/strict";

import { graphemeCount, codePointCount } from "./count.ts";

test("graphemeCount counts plain ASCII by character", () => {
  assert.equal(graphemeCount("hello"), 5);
});

test("graphemeCount treats a precomposed accent as one character", () => {
  assert.equal(graphemeCount("café"), 4);
});

test("graphemeCount treats a combining-mark accent as one character", () => {
  // "cafe" + combining acute accent (U+0301) renders as "café" = 4 graphemes.
  assert.equal(graphemeCount("café"), 4);
});

test("graphemeCount counts a single emoji as one character", () => {
  assert.equal(graphemeCount("ok👍"), 3);
});

test("graphemeCount counts a ZWJ emoji sequence as one character", () => {
  assert.equal(graphemeCount("👨‍👩‍👧‍👦"), 1);
});

test("graphemeCount returns 0 for an empty string", () => {
  assert.equal(graphemeCount(""), 0);
});

test("codePointCount counts a ZWJ emoji sequence as many code points", () => {
  // The family emoji is 4 people + 3 zero-width joiners = 7 code points.
  assert.equal(codePointCount("👨‍👩‍👧‍👦"), 7);
});

test("codePointCount counts astral characters as one code point each", () => {
  // Naive string.length would report 2 (surrogate pair) for the emoji.
  assert.equal(codePointCount("a👍"), 2);
  assert.equal("a👍".length, 3);
});
