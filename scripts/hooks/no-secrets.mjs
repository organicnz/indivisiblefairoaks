#!/usr/bin/env bun
/**
 * Secret leak detection.
 *
 * Patterns: Supabase secret/publishable, Stripe live/test/webhook, Resend,
 * PRIVATE_KEY assignments, and Postgres connection strings with passwords.
 */

const PATTERNS = [
  /sb_secret_[A-Za-z0-9]{20,}/,
  /sb_publishable_[A-Za-z0-9]{40,}/,
  /sk_live_[A-Za-z0-9]{20,}/,
  /sk_test_[A-Za-z0-9]{20,}/,
  /whsec_[A-Za-z0-9]{20,}/,
  /re_[A-Za-z0-9]{20,}/,
  /PRIVATE_KEY\s*=\s*['"][^'"]{20,}/,
  /postgresql:\/\/[^@]*:[^@]{8,}@/,
];

const files = process.argv.slice(2);
const matches = [];

for (const file of files) {
  let content;
  try {
    content = await Bun.file(file).text();
  } catch {
    continue;
  }
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of PATTERNS) {
      if (pattern.test(lines[i])) {
        matches.push(`${file}:${i + 1}:${lines[i]}`);
        break;
      }
    }
  }
}

if (matches.length > 0) {
  console.log('');
  console.log('✖  Potential secret detected in staged files:');
  for (const m of matches) console.log(m);
  console.log('');
  console.log('   Remove the secret and rotate it immediately.');
  console.log('   Use .env.local for local secrets (it is gitignored).');
  console.log('');
  process.exit(1);
}
