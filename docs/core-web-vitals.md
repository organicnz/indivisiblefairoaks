# Core Web Vitals — public pages

Measured locally on **2026-11-14** against production bundles of the 13 key
public routes. This is a lab measurement, not field data: the server was
localhost and the image-dependent pages were running without Supabase
credentials, so gallery/photo content was the checked-in fallback.

## Method

- **Runtime:** Bun 1.4.4, Next.js 16.4.6, Playwright 1.65, `web-vitals` 6.2.3.
- **Before bundle:** `18m75V8EX55v04PByyg02`.
- **After bundle:** `8B-QLPUQEknmm-oQXHKV7`.
- **Mobile:** 390 × 844, DPR 2, 4× CPU throttle, Slow 4G
  (1.6 Mbps down / 750 Kbps up / 150 ms RTT).
- **Desktop:** 1280 × 900, DPR 1, no network or CPU throttle.
- Each route loaded in a fresh browser context. The observer was installed
  before navigation; measurements were read after `load`, `document.fonts.ready`,
  a short settle, one heading click, and three `Tab` presses.
- LCP and CLS use the standard `web-vitals` observers. **INP is a scripted lab
  proxy**, not a field 75th-percentile value: it measures the input latency of
  the scripted interactions, and `0` means the input delay was below the
  Event Timing resolution.

Thresholds used: LCP ≤ 2,500 ms, CLS ≤ 0.1, INP ≤ 200 ms.

## Results

### Mobile — 390px, 4× CPU, Slow 4G

| Route | LCP before (ms) | LCP after (ms) | CLS before | CLS after | INP before (ms) | INP after (ms) |
|---|---:|---:|---:|---:|---:|---:|
| `/` | 1676 | 1608 | 0.0290 | 0.0000 | 32 | 24 |
| `/about` | 1380 | 1324 | 0.0000 | 0.0000 | 8 | 40 |
| `/events` | 1484 | 1348 | 0.0333 | 0.0000 | 48 | 88 |
| `/voter-info` | 1632 | 1552 | 0.0006 | 0.0006 | 8 | 8 |
| `/news` | 1420 | 1328 | 0.0333 | 0.0000 | 40 | 8 |
| `/gallery` | 1560 | 1576 | 0.0037 | 0.0001 | 24 | 8 |
| `/choir` | 1564 | 1536 | **0.1656** | **0.0000** | 8 | 0 |
| `/links` | 1396 | 1312 | 0.0000 | 0.0000 | 8 | 8 |
| `/archive` | 1612 | 1312 | 0.0003 | 0.0000 | 24 | 40 |
| `/faqs` | 1400 | 1328 | 0.0334 | 0.0000 | 48 | 48 |
| `/partners` | 1396 | 1332 | 0.0332 | 0.0000 | 40 | 48 |
| `/donate` | 1404 | 1316 | 0.0000 | 0.0000 | 40 | 40 |
| `/contact` | 1360 | 1304 | 0.0309 | 0.0000 | 16 | 40 |

### Desktop — 1280px, unthrottled

| Route | LCP before (ms) | LCP after (ms) | CLS before | CLS after | INP before (ms) | INP after (ms) |
|---|---:|---:|---:|---:|---:|---:|
| `/` | 60 | 60 | 0.00015 | 0.00015 | 0 | 8 |
| `/about` | 52 | 52 | 0.00015 | 0.00015 | 48 | 48 |
| `/events` | 56 | 56 | 0.00015 | 0.00015 | 32 | 32 |
| `/voter-info` | 56 | 52 | 0.00015 | 0.00015 | 8 | 8 |
| `/news` | 52 | 52 | 0.00015 | 0.00015 | 40 | 0 |
| `/gallery` | 52 | 52 | 0.00456 | 0.00015 | 16 | 16 |
| `/choir` | 56 | 52 | 0.00015 | 0.00015 | 48 | 40 |
| `/links` | 48 | 56 | 0.00015 | 0.00015 | 8 | 16 |
| `/archive` | 64 | 48 | 0.00015 | 0.00015 | 0 | 48 |
| `/faqs` | 48 | 44 | 0.00015 | 0.00015 | 40 | 40 |
| `/partners` | 48 | 44 | 0.00015 | 0.00015 | 8 | 8 |
| `/donate` | 48 | 48 | 0.00015 | 0.00015 | 40 | 40 |
| `/contact` | 44 | 52 | 0.00015 | 0.00015 | 32 | 48 |

### Summary

- **All 26 after measurements are in the “good” range.**
- Mobile LCP: 1,304–1,608 ms after (was 1,360–1,676 ms). The change is within
  lab run-to-run noise, not a claimed improvement.
- Mobile CLS: maximum **0.0006** after, down from **0.166** on `/choir`.
  Every mobile route was at or below one-thousandth of a CLS point after the
  change.
- Mobile INP: 0–88 ms after, all far below 200 ms.
- Desktop LCP: 44–60 ms; desktop CLS: 0.00015 on every route; desktop INP:
  0–48 ms. Desktop is unthrottled and is useful for regression comparison,
  not as a production field estimate.

## Regression fixed

The clear regression was mobile **CLS on `/choir`: 0.166 → 0.000**.

At the mobile profile, Fraunces arrived around 2 seconds after first paint.
The choir `h1` reflowed from three lines (129 px) to two lines (86 px) when the
font swapped, moving the masthead and the main content up by 69 px. The baseline
mobile run also had ~0.033 CLS on `/events`, `/news`, `/faqs`, `/partners`,
`/contact`, and 0.029 on `/`; those readings are also gone after the font
change.

`src/app/layout.tsx` now uses `display: 'optional'` for Fraunces only. This is
font/CSS configuration, not JavaScript. The font still preloads, so normal and
cached visits get it; a cold visit that cannot fetch it within the optional
window keeps the fallback instead of reflowing after the reader has started
reading. Inter and Outfit remain on `swap` because they did not produce
measurable CLS in this run.

LCP and INP had no clear regression and were not changed.

## Limits

- No Supabase environment was available for this checkout. Photo-backed content
  rendered the checked-in fallback, so production LCP for image-led pages may
  differ. In the `/choir` spot check, the mobile LCP element was a text
  paragraph, not the hero photo.
- The server was localhost and the desktop profile was unthrottled. These
  numbers are suitable for before/after comparison and CI-style regression
  checks, not for substituting for CrUX or RUM.
- The production build needs the real Supabase environment. The measurement
  bundles were made with the repository’s E2E build switches
  (`NEXT_E2E_BUILD=true`, `NEXT_SKIP_ENV_VALIDATION=1`) and placeholder public
  Supabase values so that the public routes could be built locally.
- INP was measured with scripted heading-click/Tab interactions, not real
  reader journeys.
