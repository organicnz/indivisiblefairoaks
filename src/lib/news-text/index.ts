/**
 * Shared text processing for the public news and newsletter surfaces.
 *
 * The implementation is split by concern so the normalization rules, search
 * ranking, match snippets and newsletter-specific statistics can evolve
 * independently. Import from `@/lib/news-text`; the barrel keeps every caller
 * on one public API.
 */

export * from './normalize';
export * from './search';
export * from './snippet';
export * from './newsletter';
