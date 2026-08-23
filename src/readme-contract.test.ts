import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function releaseDocs(): Promise<{ readme: string; version: string }> {
  const [readme, packageJson] = await Promise.all([
    readFile(new URL("README.md", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  return {
    readme,
    version: (JSON.parse(packageJson) as { version: string }).version,
  };
}

test("the GitHub Action example pins the package release", async () => {
  const { readme, version } = await releaseDocs();
  const escaped = version.replaceAll(".", "\\.");
  assert.match(readme, new RegExp(`uses: vsolano9/metaproof@v${escaped}`));
  assert.match(
    readme,
    new RegExp("moving `@v0` tag points to the\\s+same `v" + escaped + "` release"),
  );
});

test("the README states Apple's required 100-byte Keywords contract", async () => {
  const { readme } = await releaseDocs();
  assert.match(readme, /App Name, Keywords, Description, Support URL, and Privacy Policy URL/);
  assert.match(readme, /Keywords[^\n]*100 bytes/);
  assert.doesNotMatch(readme, /teams disagree about whether an empty keywords field should fail CI/);
});
