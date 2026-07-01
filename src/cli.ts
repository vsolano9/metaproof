#!/usr/bin/env node
/**
 * metaproof executable. Thin wrapper over `run(argv, io)` in cli-core.ts.
 * Requires Node >= 24 (runs TypeScript directly via native type stripping).
 */

import { run, type Io } from "./cli-core.ts";

const io: Io = {
  write: (text) => void process.stdout.write(text),
  error: (text) => void process.stderr.write(text),
  cwd: process.cwd(),
  isTTY: Boolean(process.stdout.isTTY),
  env: process.env,
};

run(process.argv.slice(2), io).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    process.stderr.write(`metaproof: ${err instanceof Error ? err.stack : String(err)}\n`);
    process.exitCode = 2;
  },
);
