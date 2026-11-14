// Brand palette for contexts where CSS custom properties do not exist:
// Satori (OG image rendering), email HTML, and the global-error shell which
// paints before any stylesheet loads.
//
// `src/app/globals.css` remains the source of truth for the design system.
// These values mirror its `@theme` block — the test suite asserts they match, so
// drift fails CI instead of shipping a mismatched brand in a social card.
//
// Values that also exist as tokens (surface, ink, primary, primaryLight, amber) are
// named after their token. `lime` is the reserved dark-surface accent that has no
// token by design (AGENTS.md: raw lime is never a CSS color).

export const BRAND = {
  /** `--surface-muted` */
  surfaceMuted: '#EBE4D5',
  /** `--surface-card` */
  surfaceCard: '#FBF8F0',
  /** `--secondary` — page backgrounds and dark surfaces */
  surfaceDark: '#101827',
  /** Deepest wash, used behind dark hero art. `--surface-deep` */
  surfaceDeep: '#DDD3C0',
  /** `--primary` */
  primary: '#1D4ED8',
  /** `--primary-light` */
  primaryLight: '#2563EB',
  /** `--primary-dark` */
  primaryDark: '#1639A6',
  /** `--accent` */
  accent: '#B42318',
  /** `--accent-gold` */
  accentGold: '#E0A82E',
  /** `--accent-red` */
  accentRed: '#B42318',
  /** Body copy on dark surfaces. */
  inkOnDark: '#EDE8DE',
  /** Muted copy on dark surfaces. Retuned for WCAG AA compliance on cards. */
  inkMutedOnDark: '#B8C0CD',
  /** Body copy on light surfaces — passes AA. */
  inkOnLight: '#4F5766',
  /** Reserved accent. Never body or heading text; never on light surfaces. */
  lime: '#D1FF00',
} as const;

export type BrandColor = keyof typeof BRAND;
