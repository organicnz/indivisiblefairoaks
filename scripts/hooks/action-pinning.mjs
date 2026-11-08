/**
 * GitHub Actions reference scanner.
 *
 * A remote `uses:` reference must name a full 40-character commit SHA. A
 * floating major tag, a branch, or a short SHA can change what runs in CI
 * without any repository change. Local composite actions and Docker-based
 * actions are not GitHub refs and are left to their own review.
 */

const ACTION_REFERENCE = /^\s*(?:-\s*)?uses:\s*(?:"([^"]+)"|'([^']+)'|(\S+))/gm;
const COMMIT_SHA = /^[0-9a-f]{40}$/;

export function findUnpinnedActionRefs(text) {
  const findings = [];

  for (const match of text.matchAll(ACTION_REFERENCE)) {
    const ref = match[1] ?? match[2] ?? match[3] ?? '';
    if (ref.startsWith('./') || ref.startsWith('docker://')) continue;

    const line = text.slice(0, match.index).split('\n').length;
    if (!ref.includes('@')) {
      findings.push({ line, ref, reason: 'missing @ref' });
      continue;
    }

    const revision = ref.slice(ref.lastIndexOf('@') + 1);
    if (!COMMIT_SHA.test(revision)) {
      findings.push({ line, ref, reason: 'not a full commit SHA' });
    }
  }

  return findings;
}
