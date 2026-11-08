// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { findUnpinnedActionRefs } from '../hooks/action-pinning.mjs';

const SHA = 'a'.repeat(40);

describe('findUnpinnedActionRefs', () => {
  it('accepts full commit SHAs and refs that are not registry actions', () => {
    const text = [
      'jobs:',
      '  checks:',
      '    steps:',
      `      - uses: actions/checkout@${SHA} # v7`,
      '      - uses: ./.github/actions/local',
      '      - uses: docker://alpine:3.20',
      `      - uses: owner/repo/.github/workflows/reusable.yml@${SHA}`,
    ].join('\n');

    expect(findUnpinnedActionRefs(text)).toEqual([]);
  });

  it('reports floating tags, branches, short SHAs, and missing refs with line numbers', () => {
    const text = [
      'jobs:',
      '  checks:',
      '    steps:',
      '      - uses: actions/checkout@v7',
      '      - uses: "actions/cache@main"',
      "      - uses: 'actions/upload-artifact@abc1234'",
      '      - uses: example/action',
    ].join('\n');

    expect(
      findUnpinnedActionRefs(text).map(({ line, ref, reason }) => ({ line, ref, reason }))
    ).toEqual([
      { line: 4, ref: 'actions/checkout@v7', reason: 'not a full commit SHA' },
      { line: 5, ref: 'actions/cache@main', reason: 'not a full commit SHA' },
      { line: 6, ref: 'actions/upload-artifact@abc1234', reason: 'not a full commit SHA' },
      { line: 7, ref: 'example/action', reason: 'missing @ref' },
    ]);
  });

  it('does not mistake comments for action references', () => {
    const text = [
      '# uses: actions/checkout@v7',
      'jobs:',
      '  checks:',
      '    steps:',
      `      - uses: actions/checkout@${SHA}`,
    ].join('\n');

    expect(findUnpinnedActionRefs(text)).toEqual([]);
  });
});
