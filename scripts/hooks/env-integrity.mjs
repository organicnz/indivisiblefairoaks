#!/usr/bin/env bun
/**
 * Env integrity check.
 *
 * Every key in .env.example must exist in .env.local.
 */

if (!(await Bun.file('.env.local').exists())) {
  console.log('');
  console.log('⚠️   .env.local not found. Copy .env.example and fill in values:');
  console.log('    cp .env.example .env.local');
  console.log('');
  process.exit(1);
}

const example = await Bun.file('.env.example').text();
const local = await Bun.file('.env.local').text();

const missing = [];
for (const line of example.split('\n')) {
  if (line.startsWith('#') || !line.trim()) continue;
  const key = line.split('=')[0];
  if (!local.includes(`${key}=`)) {
    missing.push(`  - ${key}`);
  }
}

if (missing.length > 0) {
  console.log('');
  console.log('✖  Keys in .env.example missing from .env.local:');
  for (const m of missing) console.log(m);
  console.log('');
  process.exit(1);
}
