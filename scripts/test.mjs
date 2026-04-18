#!/usr/bin/env node
import { createRequire } from 'module';
import { spawnSync }      from 'child_process';

const require = createRequire(import.meta.url);
const jestBin = require.resolve('jest/bin/jest');
const args    = process.argv.slice(2);

const result = spawnSync(
  process.execPath,
  ['--experimental-vm-modules', jestBin, ...args],
  { stdio: 'inherit' }
);

process.exit(result.status ?? 1);
