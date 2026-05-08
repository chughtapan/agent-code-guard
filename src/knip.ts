#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const knipIndex = require.resolve("knip");
const knipBin = path.join(path.dirname(path.dirname(knipIndex)), "bin", "knip.js");
const result = spawnSync(process.execPath, [knipBin, ...process.argv.slice(2)], {
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.signal) {
  console.error(`knip exited from signal ${result.signal}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
