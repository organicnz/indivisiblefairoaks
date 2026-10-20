/**
 * A `globalThis.fetch` that a test can install.
 *
 * ## Why this exists
 *
 * This project runs on Bun, and the project is typed against Bun's runtime
 * (`bun-types`, via the `types` allowlist in `tsconfig.json`). Bun's `fetch`
 * is not the DOM's `fetch`: it is the Fetch API plus a `preconnect` namespace
 * member for warming a connection ahead of a request.
 *
 * That difference is invisible until a test assigns a mock to the global. A
 * `vi.fn()` implements the *call* and nothing else, so under Bun's types it is
 * not assignable to `globalThis.fetch` — and the `as typeof fetch` cast these
 * suites already used stops being a conversion TypeScript accepts, because the
 * two types no longer sufficiently overlap. Thirty-four assignment sites
 * across six files failed for one reason.
 *
 * ## What it does
 *
 * `asFetch` completes a mock so it genuinely *is* a `typeof fetch`: the
 * `preconnect` member is added as a no-op, because no test that stubs
 * `fetch` warms a connection.
 *
 * The alternative — casting the mock into shape — is what these files were
 * already doing, one cast per site, and it says something untrue: a cast
 * asserts a shape the object does not have. Completing the object instead
 * means the type checker is describing the truth, and a future caller that
 * reaches for `fetch.preconnect` gets a working no-op rather than a
 * `TypeError`.
 *
 * ## What it is not
 *
 * Not a fetch implementation. It does not perform requests, and it says
 * nothing about the behaviour of the code under test — only about the shape
 * of the global it is installed on.
 */

/**
 * Complete a mock so it satisfies Bun's `fetch` type.
 *
 * The returned value is still the same mock: `mockResolvedValue`,
 * `mockReset`, `mock.calls` and every other Vitest mock API keep working
 * exactly as before.
 */
export function asFetch<T extends object>(mock: T): T & Pick<typeof fetch, 'preconnect'> {
  return Object.assign(mock, {
    // Bun's connection-warming extension. A no-op is the honest
    // implementation: a test that stubs `fetch` never warms a connection.
    preconnect: () => {},
  });
}

/**
 * Install a mock as the global `fetch` and return it.
 *
 * `globalThis.fetch` and `global.fetch` are the same property in Bun, so
 * this covers suites that restore `global.fetch` afterwards.
 *
 * ## The one cast
 *
 * `complete as unknown as typeof fetch` is the only place in the repository
 * that casts a fetch mock into shape, and it is here because a mock's own
 * signature is often *narrower* than `fetch`'s: a mock typed
 * `(url: string, init: { body?: unknown }) => ...` cannot accept the
 * `Request` object a real `fetch` takes, so no amount of completing the
 * object can make it assignable without a cast.
 *
 * Before this helper, that cast was made at every one of the assignment
 * sites — thirty-four of them, spread over six files, each one asserting a
 * shape the object did not have. One documented cast is a better trade than
 * thirty-four undocumented ones, and it is the only one a reader has to
 * check.
 */
export function installFetchMock<T extends object>(mock: T): T & Pick<typeof fetch, 'preconnect'> {
  const complete = asFetch(mock);
  globalThis.fetch = complete as unknown as typeof fetch;
  return complete;
}
