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
  surfaceMuted: '#F4F8FF',
  /** `--surface-card` */
  surfaceCard: '#FFFFFF',
  /** `--secondary` — page backgrounds and dark surfaces */
  surfaceDark: '#16305C',
  /** Deepest wash, used behind dark hero art. `--surface-deep` */
  surfaceDeep: '#0F2244',
  /** `--primary` */
  primary: '#1E3A8A',
  /** `--primary-light` */
  primaryLight: '#2563EB',
  /** `--primary-dark` */
  primaryDark: '#172554',
  /** `--accent` */
  accent: '#D97706',
  /** `--accent-gold` */
  accentGold: '#F59E0B',
  /** `--accent-red` */
  accentRed: '#DC2626',
  /** Body copy on dark surfaces. `text-slate-600` is unreadable here (1.86:1). */
  inkOnDark: '#CBD5E1',
  /** Muted copy on dark surfaces. Retuned for WCAG AA compliance on cards. */
  inkMutedOnDark: '#A3B4C9',
  /** Body copy on light surfaces — passes AA at 7.58:1. */
  inkOnLight: '#475569',
  /** Reserved accent. Never body or heading text; never on light surfaces. */
  lime: '#D1FF00',
} as const;

export type BrandColor = keyof typeof BRAND;
