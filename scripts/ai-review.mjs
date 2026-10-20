#!/usr/bin/env bun
// AI code reviewer — sends a diff (or explicit files) to an LLM and prints
// structured findings. Zero dependencies.
//
// Usage:
//   GROQ_API_KEY=... bun scripts/ai-review.mjs --since HEAD~1
//   ZAI_API_KEY=...  bun scripts/ai-review.mjs --provider zai --files src/app/contact/actions.ts
//
// Providers:
//   groq (default) -> Groq OpenAI-compatible API, llama-3.3-70b-versatile
//   zai            -> Z.ai OpenAI-compatible API, glm-4.6
//
// Secrets are read exclusively from the environment — never pass keys as
// arguments or commit them anywhere.

const PROVIDERS = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'openai/gpt-oss-120b',
    keyEnv: 'GROQ_API_KEY',
  },
  zai: {
    url: 'https://api.z.ai/api/paas/v4/chat/completions',
    model: 'glm-4.6',
    keyEnv: 'ZAI_API_KEY',
  },
};

const SYSTEM_PROMPT = [
  'You are a meticulous senior engineer reviewing production e-commerce code',
  '(Next.js 16 App Router + Supabase + Stripe). Review the provided changes',
  'for: security issues (injection, authz, secret handling, abuse vectors),',
  'correctness bugs, race conditions, error-handling gaps, and performance.',
  'Ignore styling/nits. Respond with findings ONLY, each as:',
  '[SEVERITY: critical|high|medium|low] file:area — issue — suggested fix.',
  'If nothing significant, reply exactly: NO SIGNIFICANT FINDINGS.',
].join(' ');

function parseArgs(argv) {
  const args = { provider: 'groq', since: null, files: [], maxChars: 60_000 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--provider') args.provider = argv[++i];
    else if (argv[i] === '--since') args.since = argv[++i];
    else if (argv[i] === '--files') while (argv[i + 1] && !argv[i + 1].startsWith('--')) args.files.push(argv[++i]);
    else if (argv[i] === '--max-chars') args.maxChars = Number(argv[++i]);
  }
  return args;
}

import { runText, tryRunText } from './bun-exec.mjs';

function getDiff(args) {
  if (args.files.length > 0) {
    return runText(['git', 'diff', 'HEAD', '--', ...args.files]);
  }
  let ref = args.since ?? 'HEAD~1';
  // Accept dates ("2026-08-24T21:00") or revs; resolve dates to the last
  // commit at-or-before the cutoff so "last 24h" just works.
  // `cat-file -e` writes nothing, so the exit code is the whole answer.
  if (tryRunText(['git', 'cat-file', '-e', `${ref}^{commit}`]) === null) {
    ref = runText(['git', 'rev-list', '-n', '1', '--before', ref, 'HEAD']).trim();
    if (!ref) throw new Error(`No commits exist before ${args.since}`);
  }
  return runText(['git', 'diff', `${ref}...HEAD`]);
}

function truncate(text, max) {
  if (text.length <= max) return text;
  // Keep both ends: summaries live at the top, newest hunks at the bottom.
  const head = Math.floor(max * 0.5);
  return `${text.slice(0, head)}\n\n[...diff truncated ${text.length - max} chars...]\n\n${text.slice(-head)}`;
}

async function review(providerName, diff) {
  const p = PROVIDERS[providerName];
  const key = process.env[p.keyEnv];
  if (!key) throw new Error(`${p.keyEnv} not set in environment`);

  // Free-tier token ceilings reject large diffs outright — shrink and retry.
  const budgets = [60_000, 24_000, 8_000];
  for (let i = 0; i < budgets.length; i++) {
    try {
      return await requestReview(p, key, diff, budgets[i]);
    } catch (err) {
      const retriable = /413|too large|TPM|tokens per minute/i.test(err.message);
      if (!retriable || i === budgets.length - 1) throw err;
      console.error(`${providerName}: payload rejected (${err.message.slice(0, 120)}), retrying with ${budgets[i + 1]} char budget…`);
    }
  }
}

async function requestReview(p, key, diff, budget) {
  const res = await fetch(p.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: p.model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Review this unified diff:\n\n\`\`\`diff\n${truncate(diff, budget)}\n\`\`\`` },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '(empty response)';
}

async function main() {
  const args = parseArgs(process.argv);
  if (!PROVIDERS[args.provider]) {
    console.error(`Unknown provider: ${args.provider}. Use one of: ${Object.keys(PROVIDERS).join(', ')}`);
    process.exit(2);
  }

  let diff;
  try {
    diff = getDiff(args);
  } catch (err) {
    console.error(`Failed to collect diff: ${err.message}`);
    process.exit(2);
  }
  if (!diff.trim()) {
    console.log('NO DIFF — nothing to review.');
    return;
  }
  console.log(`Diff size: ${diff.length} chars · provider=${args.provider}`);

  try {
    const findings = await review(args.provider, diff);
    console.log('\n════════ AI REVIEW FINDINGS ════════\n');
    console.log(findings);
    if (/NO SIGNIFICANT FINDINGS/.test(findings)) process.exitCode = 0;
    // Findings are advisory: never fail CI on model output alone.
  } catch (err) {
    console.error(`AI review failed: ${err.message}`);
    process.exit(1);
  }
}

main();
