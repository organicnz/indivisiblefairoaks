/**
 * GitHub Actions reference scanner.
 *
 * A remote `uses:` reference must name a full 40-character commit SHA. A
 * floating major tag, a branch, or a short SHA can change what runs in CI
 * without any repository change. Local composite actions and Docker-based
 * actions are not GitHub refs and are left to their own review.
 *
 * The scanner walks the parsed workflow's job and step structure rather than
 * matching lines, so folded scalars, quoted values, and reusable-workflow
 * refs are checked without false positives from unrelated `uses` keys.
 */

const COMMIT_SHA = /^[0-9a-f]{40}$/;

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function inspectRef(ref, path, findings) {
  if (typeof ref !== 'string') {
    findings.push({ path, ref: String(ref), reason: 'not a string' });
    return;
  }

  const value = ref.trim();
  if (value.startsWith('./') || value.startsWith('docker://')) return;

  if (!value.includes('@')) {
    findings.push({ path, ref: value, reason: 'missing @ref' });
    return;
  }

  const revision = value.slice(value.lastIndexOf('@') + 1);
  if (!COMMIT_SHA.test(revision)) {
    findings.push({ path, ref: value, reason: 'not a full commit SHA' });
  }
}

export function findUnpinnedActionRefs(workflow) {
  const findings = [];
  if (!isRecord(workflow) || !isRecord(workflow.jobs)) return findings;

  for (const [jobId, job] of Object.entries(workflow.jobs)) {
    if (!isRecord(job)) continue;

    if (Object.hasOwn(job, 'uses')) {
      inspectRef(job.uses, `jobs.${jobId}.uses`, findings);
    }

    if (!Array.isArray(job.steps)) continue;
    job.steps.forEach((step, index) => {
      if (isRecord(step) && Object.hasOwn(step, 'uses')) {
        inspectRef(step.uses, `jobs.${jobId}.steps[${index}].uses`, findings);
      }
    });
  }

  return findings;
}
