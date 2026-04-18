#!/usr/bin/env node
/**
 * Writes the version from the VERSION environment variable (or first CLI arg)
 * into package.json. Safe to run multiple times — idempotent.
 *
 * Usage (GitHub Actions):
 *   VERSION="1.2.3" node scripts/stamp-version.mjs
 *
 * Usage (local):
 *   node scripts/stamp-version.mjs 1.2.3
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root    = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = resolve(root, 'package.json');

const version = process.env.VERSION || process.argv[2];

if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`Error: invalid or missing version "${version}"`);
  console.error('Set VERSION env var or pass version as first argument.');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const prev = pkg.version;
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`version: ${prev} → ${version}`);
