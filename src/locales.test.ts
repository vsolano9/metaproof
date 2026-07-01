import { test } from "node:test";
import assert from "node:assert/strict";

import { KNOWN_LOCALES, NON_LOCALE_FOLDERS, isKnownLocale } from "./locales.ts";

test("isKnownLocale accepts common App Store locale codes", () => {
  for (const code of ["en-US", "en-GB", "de-DE", "fr-FR", "es-ES", "ja", "ko", "zh-Hans", "zh-Hant", "pt-BR"]) {
    assert.equal(isKnownLocale(code), true, code);
  }
});

test("isKnownLocale accepts the fastlane 'default' fallback folder", () => {
  assert.equal(isKnownLocale("default"), true);
});

test("isKnownLocale rejects made-up or mis-cased codes", () => {
  assert.equal(isKnownLocale("xx-YY"), false);
  assert.equal(isKnownLocale("en_us"), false);
  assert.equal(isKnownLocale(""), false);
});

test("isKnownLocale does not treat non-locale folders as locales", () => {
  assert.equal(isKnownLocale("review_information"), false);
});

test("NON_LOCALE_FOLDERS lists fastlane's non-locale metadata folders", () => {
  assert.equal(NON_LOCALE_FOLDERS.has("review_information"), true);
  assert.equal(NON_LOCALE_FOLDERS.has("trade_representative_contact_information"), true);
});

test("KNOWN_LOCALES is a non-trivial set", () => {
  assert.ok(KNOWN_LOCALES.size >= 30);
});
