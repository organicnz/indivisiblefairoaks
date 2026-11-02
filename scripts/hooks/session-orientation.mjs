#!/usr/bin/env bun
/**
 * Session orientation hook.
 *
 * Verifies local environment setup, active git branch,
 * and workspace spec status on session startup.
 */
import { runText } from '../bun-exec.mjs';

const envExists = await Bun.file('.env.local').exists();
let branch = 'unknown';
try {
  branch = (await runText(['git', 'branch', '--show-current'])).trim();
} catch {
  // detached HEAD or not in git repo
}

console.log(`🌿 Branch: ${branch} | .env.local: ${envExists ? '✅ Present' : '⚠️ Missing (see .env.example)'}`);
