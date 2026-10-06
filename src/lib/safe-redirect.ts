const INTERNAL_ORIGIN = 'https://indivisiblefairoaks.org';

function hasControlCharacters(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
}

/**
 * Whether a value carries a `..` segment, before URL parsing.
 *
 * Checked on the *input* as well as the output, because `new URL()` collapses
 * dot segments: it turns `/..//evil.example` into `//evil.example` without ever
 * reporting a different origin. Refusing the segment outright means
 * normalisation can never manufacture an authority out of a path that started as
 * clearly internal.
 */
function hasDotSegment(value: string) {
  return value.split(/[\\/]/).some((segment) => segment === '..');
}

export function getSafeNextPath(
  value: string | null,
  fallback: string | null = null
): string | null {
  if (!value) return fallback;
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    hasControlCharacters(value) ||
    hasDotSegment(value)
  ) {
    return fallback;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }

  if (
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    hasControlCharacters(decoded) ||
    hasDotSegment(decoded)
  ) {
    return fallback;
  }

  let out: string;
  try {
    const parsed = new URL(value, INTERNAL_ORIGIN);
    if (parsed.origin !== INTERNAL_ORIGIN) return fallback;
    out = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }

  /*
   * Validate what we RETURN, not only what we received.
   *
   * `new URL()` applies WHATWG dot-segment normalisation and decodes `%2e%2e` as
   * `..`, so `/..//evil.example` survives every check above — it starts with `/.`
   * rather than `//`, and the decoded copy is byte-identical — and the parser
   * then collapses it to `//evil.example`. The `origin` comparison above passes
   * because by the time the parser reports the origin, the `//` has already been
   * demoted to a path. That is the whole bug: the origin check inspects the
   * parse *input*, not the parse *output*.
   *
   * The dot-segment check on `value` closes that specific route, but the return
   * value is what every caller hands to `router.replace` or `redirect`, so it
   * gets checked directly rather than by proxy. `auth/callback/route.ts`
   * concatenates this value after an origin and is unaffected either way;
   * `/auth/mfa` passes it straight to `router.replace`, so this is the only
   * consumer where a protocol-relative result is reachable.
   */
  if (
    !out.startsWith('/') ||
    out.startsWith('//') ||
    out.includes('\\') ||
    hasControlCharacters(out)
  ) {
    return fallback;
  }

  return out;
}
