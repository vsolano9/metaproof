import { test } from "node:test";
import assert from "node:assert/strict";

import { KNOWN_LOCALES, NON_LOCALE_FOLDERS, isKnownLocale } from "./locales.ts";

test("isKnownLocale accepts common App Store locale codes", () => {
  for (const code of ["en-US", "en-GB", "de-DE", "fr-FR", "es-ES", "ja", "ko", "zh-Hans", "zh-Hant", "pt-BR"]) {
    assert.equal(isKnownLocale(code), true, code);
  }
});

test("isKnownLocale accepts every locale in Apple's App Store Connect API table", async (t) => {
  const appleAppStoreLocales = [
    "ar-SA",
    "bn-BD",
    "ca",
    "zh-Hans",
    "zh-Hant",
    "hr",
    "cs",
    "da",
    "nl-NL",
    "en-AU",
    "en-CA",
    "en-GB",
    "en-US",
    "fi",
    "fr-FR",
    "fr-CA",
    "de-DE",
    "el",
    "gu-IN",
    "he",
    "hi",
    "hu",
    "id",
    "it",
    "ja",
    "kn-IN",
    "ko",
    "ms",
    "ml-IN",
    "mr-IN",
    "no",
    "or-IN",
    "pl",
    "pt-BR",
    "pt-PT",
    "pa-IN",
    "ro",
    "ru",
    "sk",
    "sl-SI",
    "es-MX",
    "es-ES",
    "sv",
    "ta-IN",
    "te-IN",
    "th",
    "tr",
    "uk",
    "ur-PK",
    "vi",
  ];
  assert.equal(appleAppStoreLocales.length, 50);
  for (const code of appleAppStoreLocales) {
    await t.test(code, () => {
      assert.equal(isKnownLocale(code), true, code);
    });
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
