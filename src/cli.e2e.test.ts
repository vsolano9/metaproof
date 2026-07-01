import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CLI = resolve(import.meta.dirname, "cli.ts");
const FIXTURE = resolve(import.meta.dirname, "..", "fixtures", "metadata");

function runCli(args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

async function makeTree(files: Record<string, string>): Promise<string> {
  const root = join(await mkdtemp(join(tmpdir(), "metaproof-e2e-")), "metadata");
  await mkdir(root, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, content, "utf8");
  }
  return root;
}

test("cli exits 0 and prints PASS on a clean tree", async () => {
  const root = await makeTree({ "en-US/name.txt": "Focus Timer", "en-US/keywords.txt": "pomodoro,focus,study" });
  const { status, stdout } = runCli([root, "--no-color"]);
  assert.equal(status, 0);
  assert.match(stdout, /PASS/);
});

test("cli exits 1 and prints FAIL on a broken tree", async () => {
  const root = await makeTree({ "en-US/subtitle.txt": "x".repeat(45) });
  const { status, stdout } = runCli([root, "--no-color"]);
  assert.equal(status, 1);
  assert.match(stdout, /FAIL/);
});

test("cli --version prints a semver", () => {
  const { status, stdout } = runCli(["--version"]);
  assert.equal(status, 0);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+/);
});

test("the shipped example fixture is a real failing example", () => {
  const { status, stdout } = runCli([FIXTURE, "--no-color"]);
  assert.equal(status, 1, "example fixture should intentionally contain errors");
  assert.match(stdout, /FAIL/);
});
