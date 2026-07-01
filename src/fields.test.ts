import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_LIMITS,
  FIELD_DEFS,
  fieldForFilename,
  lengthFields,
  urlFields,
} from "./fields.ts";

test("DEFAULT_LIMITS match Apple's documented App Store field limits", () => {
  assert.deepEqual(DEFAULT_LIMITS, {
    name: 30,
    subtitle: 30,
    keywords: 100,
    promotional_text: 170,
    description: 4000,
    release_notes: 4000,
  });
});

test("fieldForFilename maps a fastlane deliver filename to its field def", () => {
  const def = fieldForFilename("subtitle.txt");
  assert.equal(def?.id, "subtitle");
  assert.equal(def?.kind, "length");
  assert.equal(def?.limit, 30);
  assert.equal(def?.label, "Subtitle");
});

test("fieldForFilename maps url files to url fields with no limit", () => {
  const def = fieldForFilename("support_url.txt");
  assert.equal(def?.id, "support_url");
  assert.equal(def?.kind, "url");
  assert.equal(def?.limit, undefined);
});

test("fieldForFilename recognises the tvOS privacy policy url file", () => {
  assert.equal(fieldForFilename("apple_tv_privacy_policy.txt")?.kind, "url");
});

test("fieldForFilename returns undefined for unknown files", () => {
  assert.equal(fieldForFilename("copyright.txt"), undefined);
  assert.equal(fieldForFilename("random.txt"), undefined);
});

test("lengthFields returns exactly the six limited text fields", () => {
  assert.deepEqual(
    lengthFields().map((f) => f.id).sort(),
    ["description", "keywords", "name", "promotional_text", "release_notes", "subtitle"],
  );
});

test("urlFields all have url kind", () => {
  assert.ok(urlFields().length >= 3);
  assert.ok(urlFields().every((f) => f.kind === "url"));
});

test("every field def filename ends in .txt and round-trips through fieldForFilename", () => {
  for (const def of FIELD_DEFS) {
    assert.ok(def.filename.endsWith(".txt"), `${def.id} filename`);
    assert.equal(fieldForFilename(def.filename)?.id, def.id);
  }
});
