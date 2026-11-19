/**
 * Shared text processing for the public news and newsletter surfaces.
 *
 * The implementation is split by concern so normalization, search ranking,
 * match snippets and newsletter statistics can evolve independently. Import
 * from `@/lib/news-text`; the barrel keeps callers on one public API.
 */

export * from './normalize';
export * from './topics';
export * from './search';
export * from './highlight';
export * from './snippet';
export * from './newsletter';
export * from './newsletter-topics';
export * from './newsletter-stats';
export * from './review';
