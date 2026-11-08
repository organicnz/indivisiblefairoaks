// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { findUnpinnedActionRefs } from '../hooks/action-pinning.mjs';

const SHA = 'a'.repeat(40);

describe('findUnpinnedActionRefs', () => {
  it('accepts full commit SHAs and refs that are not registry actions', () => {
    const workflow = {
      jobs: {
        checks: {
          steps: [
            { uses: `actions/checkout@${SHA}` },
            { uses: './.github/actions/local' },
            { uses: 'docker://alpine:3.20' },
            { uses: `owner/repo/.github/workflows/reusable.yml@${SHA}` },
          ],
        },
        reusable: { uses: `owner/repo/.github/workflows/reusable.yml@${SHA}` },
      },
    };

    expect(findUnpinnedActionRefs(workflow)).toEqual([]);
  });

  it('reports floating tags, branches, short SHAs, missing refs, and reusable refs', () => {
    const workflow = {
      jobs: {
        checks: {
          steps: [
            { uses: 'actions/checkout@v7' },
            { uses: 'actions/cache@main' },
            { uses: 'actions/upload-artifact@abc1234' },
            { uses: 'example/action' },
            {
              uses: `actions/checkout@${SHA}`,
              with: { uses: 'actions/checkout@v7' },
            },
          ],
        },
        reusable: { uses: 'owner/repo/.github/workflows/reusable.yml@main' },
      },
    };

    expect(findUnpinnedActionRefs(workflow)).toEqual([
      {
        path: 'jobs.checks.steps[0].uses',
        ref: 'actions/checkout@v7',
        reason: 'not a full commit SHA',
      },
      {
        path: 'jobs.checks.steps[1].uses',
        ref: 'actions/cache@main',
        reason: 'not a full commit SHA',
      },
      {
        path: 'jobs.checks.steps[2].uses',
        ref: 'actions/upload-artifact@abc1234',
        reason: 'not a full commit SHA',
      },
      {
        path: 'jobs.checks.steps[3].uses',
        ref: 'example/action',
        reason: 'missing @ref',
      },
      {
        path: 'jobs.reusable.uses',
        ref: 'owner/repo/.github/workflows/reusable.yml@main',
        reason: 'not a full commit SHA',
      },
    ]);
  });

  it('reports a non-string uses field instead of silently skipping it', () => {
    const workflow = { jobs: { checks: { steps: [{ uses: null }] } } };

    expect(findUnpinnedActionRefs(workflow)).toEqual([
      { path: 'jobs.checks.steps[0].uses', ref: 'null', reason: 'not a string' },
    ]);
  });
});
