#!/usr/bin/env node
/**
 * Empty API route directory guard.
 */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const API_ROOT = 'src/app/api';

function walkDirs(dir, depth = 0) {
  if (depth > 2) return [];
  const dirs = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const full = path.join(dir, entry.name);
      dirs.push(full);
      dirs.push(...walkDirs(full, depth + 1));
    }
  }
  return dirs;
}

const allDirs = walkDirs(API_ROOT);
const emptyDirs = [];

for (const dir of allDirs) {
  if (dir === API_ROOT) continue;
  const hasRoute = ['route.ts', 'route.tsx', 'route.js'].some((f) =>
    existsSync(path.join(dir, f))
  );
  if (!hasRoute) {
    emptyDirs.push(`  ${dir}`);
  }
}

if (emptyDirs.length > 0) {
  console.log('');
  console.log('⚠️   API route directories with no route.ts:');
  for (const d of emptyDirs) console.log(d);
  console.log('');
  console.log('   Add a route.ts or delete the directory.');
  console.log('');
  // Warn only — directory may be an intentional scaffold
}
