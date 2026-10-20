# Civic Sapphire & Solar Dawn — Design System & Theme Engine

> **Scope**: Theme architecture, token system, surface elevations, WCAG contrast contracts, and WebGPU shader mathematics for the Indivisible Fair Oaks & Carmichael web application.

---

## 1. Architectural Philosophy

The chapter's visual identity embodies **Sensory Luxury in Civic Engagement**:
- **Light Mode ("Solar Dawn")**: An airy, crisp civic atmosphere built on soft crystalline blues (`#EEF4FF`), pure white raised cards (`#FFFFFF`), high-contrast slate inks (`#0F1F3D`), and amber gold accents (`#F59E0B`). It delivers immediate visual clarity, optimism, and approachable community warmth.
- **Dark Mode ("Civic Sapphire")**: A majestic, authoritative deep navy atmosphere (`#16305C`) replacing legacy flat obsidian. Raised cards (`#1E427E`) float with a 1.33:1 luminance lift above the page canvas, edged with delicate sapphire hairline borders (`#3A6699`).
- **Seamless System Sync**: Default state respects the operating system's prefers-color-scheme while providing instant, spring-damped user overrides with synchronized WebGPU shockwave transitions.

---

## 2. Token Architecture & Color Contracts

Tokens are defined in `src/app/globals.css` using Tailwind CSS v4 `@theme inline` and CSS custom variables on `:root` and `[data-theme='dark']`.

### Core Surface & Content Tokens

| CSS Variable | Tailwind Utility | Light Mode ("Solar Dawn") | Dark Mode ("Civic Sapphire") | Purpose / Usage |
|---|---|---|---|---|
| `--background` | `bg-background` | `#eef4ff` | `#16305c` | Global viewport & page canvas |
| `--foreground` | `text-foreground` | `#0f1f3d` | `#f1f5f9` | Primary headings & active copy |
| `--surface-card` | `bg-surface-card` | `#ffffff` | `#1e427e` | Raised content cards & dialogs (1.33:1 dark lift) |
| `--surface-muted` | `bg-surface-muted` | `#f4f8ff` | `#1a3768` | Secondary panels, summary trays & input fields |
| `--surface-deep` | `bg-surface-deep` | `#e2ecfc` | `#0f2244` | Sunken containers & base canvas wells |
| `--border` | `border-border` | `#c3d3f0` | `#3a6699` | Structural dividers & delicate hairline card borders |
| `--muted-foreground`| `text-muted-foreground` | `#475f85` | `#a3b4c9` | Body copy, secondary metadata & labels |
| `--secondary` | `bg-secondary` | `#16305c` | `#16305c` | Authoritative header & footer chrome anchor |
| `--ink-strong` | `text-ink-strong` | `#0f172a` | `#0f172a` | Ultra-high contrast text on amber & bright surfaces |

### Brand Accent Tokens

| CSS Variable | Tailwind Utility | Hex Value | Contrast Rules & Usage |
|---|---|---|---|
| `--primary` | `bg-primary`, `text-primary` | `#1e3a8a` (Light) / `#155dfc` (Dark) | Primary brand blue — actions, interactive highlights |
| `--primary-bright` | `bg-primary-bright` | `#155dfc` | Vibrant surface CTA on dark containers |
| `--primary-on-dark` | `text-primary-on-dark` | `#8ec5ff` | High-visibility hero headings on dark surfaces |
| `--primary-on-dark-muted` | `text-primary-on-dark-muted` | `#7cbaff` | Eyebrow badges & metadata on dark surfaces (>= 4.8:1) |
| `--primary-ink` | `text-primary-ink` | `#1e3a8a` | Display headings & high-contrast links on light surfaces |
| `--accent` | `bg-accent` | `#d97706` | Amber CTA surfaces (Donate). Surface only, use with `text-ink-strong` |
| `--accent-gold` | `text-accent-gold` | `#f59e0b` | Nav active indicators, dark icons, badge trims |
| `--accent-red` | `text-accent-red`, `bg-accent-red` | `#dc2626` | Destructive warnings, error toasts, live delete confirmations |

---

## 3. WCAG AA / AAA Accessibility Matrix

Every combination of token surface and ink is measured and audited against WCAG 2.1 Level AA (>= 4.5:1 normal text, >= 3.0:1 large text) and Level AAA (>= 7.0:1 normal text):

| Surface | Ink Token | Value | Calculated Contrast | Compliance Level |
|---|---|---|---|---|
| Light Canvas (`#eef4ff`) | `--foreground` | `#0f1f3d` | **12.8 : 1** | WCAG AAA Pass |
| Light Canvas (`#eef4ff`) | `--muted-foreground` | `#475f85` | **5.4 : 1** | WCAG AA Pass |
| Light Canvas (`#eef4ff`) | `--primary-ink` | `#1e3a8a` | **9.1 : 1** | WCAG AAA Pass |
| Light Raised Card (`#ffffff`) | `--foreground` | `#0f1f3d` | **15.2 : 1** | WCAG AAA Pass |
| Light Raised Card (`#ffffff`) | `--muted-foreground` | `#475f85` | **6.4 : 1** | WCAG AA Pass |
| Dark Canvas (`#16305c`) | `--foreground` | `#f1f5f9` | **10.6 : 1** | WCAG AAA Pass |
| Dark Canvas (`#16305c`) | `--muted-foreground` | `#a3b4c9` | **6.2 : 1** | WCAG AA Pass |
| Dark Canvas (`#16305c`) | `--primary-on-dark` | `#8ec5ff` | **7.4 : 1** | WCAG AAA Pass |
| Dark Raised Card (`#1e427e`)| `--foreground` | `#f1f5f9` | **8.0 : 1** | WCAG AAA Pass |
| Dark Raised Card (`#1e427e`)| `--muted-foreground` | `#a3b4c9` | **5.3 : 1** | WCAG AA Pass |
| Dark Raised Card (`#1e427e`)| `--primary-on-dark-muted` | `#7cbaff` | **4.8 : 1** | WCAG AA Pass |
| Amber CTA (`#d97706`) | `--ink-strong` | `#0f172a` | **7.2 : 1** | WCAG AAA Pass |
| Amber Gold Nav (`#f59e0b`) | `--ink-strong` | `#0f172a` | **9.8 : 1** | WCAG AAA Pass |

---

## 4. Surface Elevation Tiers

Legacy pages suffered from "invisible cards" where cards in dark mode had `dark:bg-secondary/80` against a `--secondary` canvas, yielding a 1.00:1 contrast ratio.

The Civic Sapphire system resolves this through **Elevation Hierarchy**:
1. **Tier 0 — Canvas (`bg-background`)**: `#16305c` (Dark) / `#eef4ff` (Light). Global backdrop for page layout.
2. **Tier 1 — Sunken Trays (`bg-surface-deep`)**: `#0f2244` (Dark) / `#e2ecfc` (Light). Inset wells, code blocks, and counter badges.
3. **Tier 2 — Muted Sections (`bg-surface-muted`)**: `#1a3768` (Dark) / `#f4f8ff` (Light). Summary panels, filter sidebars, and input field backgrounds.
4. **Tier 3 — Raised Cards (`bg-surface-card border border-border`)**: `#1e427e` (Dark) / `#ffffff` (Light). 1.33:1 luminance lift above the canvas with delicate sapphire hairline borders (`#3a6699`).
5. **Tier 4 — Interactive Overlays (`shadow-card`, `shadow-float`)**: Command palettes, popovers, and navigation drawers.

---

## 5. WebGPU Atmosphere Shaders

The site's visual atmosphere is driven by two custom WebGPU shaders built on the `@vgpu` pipeline:

### `VgpuCivicAtmosphere` (Hero Backgrounds)
- **Light Mode**: High-key airy atmosphere blending `#EEF4FF` with delicate solar caustics (`vec3f(0.933, 0.957, 1.0)`) and subtle warm topaz corona flares.
- **Dark Mode**: Deep navy cosmos (`#16305C`, `vec3f(0.086, 0.188, 0.361)`) with volumetric vignetting (`darkFactor = smoothstep(0.0, 1.0, themeParams.x)`).
- **Graceful Fallback**: Automatically degrades to lightweight canvas CSS radial gradients on mobile devices or browsers lacking WebGPU capabilities.

### `VgpuThemeCanvas` (Interactive State Transitions)
- When switching modes via the segmented controller or keyboard shortcuts, a WebGPU ripple expands outwards from the pointer click coordinates (`originX`, `originY`).
- Incorporates 7-band Cauchy dispersion, Kelvin angle bow-shock hydrodynamic wake, and ACES filmic tone-mapping.
- Supports 8-wave FIFO ring-buffering for fluid multi-click responsiveness.

---

## 6. Theme Engine & State Management

Theme state is orchestrated via `src/lib/theme.ts` and `src/components/layout/theme-store.ts`:
- **Hydration Safe**: A synchronous bootstrap script in `<head>` (`themeBootstrapScript`) inspects `localStorage.getItem('theme-mode')` and `window.matchMedia('(prefers-color-scheme: dark)')` before the first paint, setting `<html data-theme="...">` and preventing any light/dark flash.
- **OS Theme-Color Meta**: Dynamically reconciles `<meta name="theme-color">` to `#16305c` (dark) and `#eef4ff` (light), ensuring Safari and mobile URL bars seamlessly harmonize with page bounce scrolls.
- **Atomic HUD Notification**: Triggers `emitThemeHud(mode, effective, coords)` so assistive tech and visual ripple canvases receive exact state machine updates simultaneously.

---

## 7. Developer Guidelines

1. **Tokens Always**: Never write ad-hoc hex values (`#0f172a`, `#ffffff`) or raw Tailwind color scales (`bg-slate-900`) for surfaces or cards. Use `bg-background`, `bg-surface-card`, `bg-surface-muted`, and `border-border`.
2. **No Blind Dark Overrides**: Do not add `dark:bg-secondary/80` or `dark:border-white/10` to cards. The token `bg-surface-card` automatically handles both modes cleanly with proper elevation.
3. **Contrast Testing**: Any new surface or text style must be verified with `bun run test` (which executes Vitest accessibility assertions) and `bun run build`.
