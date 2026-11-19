-- The published `copy-home-hero` snapshot predates the current HomeHero.
-- It still contains its own eyebrow pill, CTA row, and metrics band, so the
-- component rendered those duplicating the live hero around the CMS body.
-- CopyRegion owns only the headline and mission; HomeHero owns everything else.
-- Keep the row (and its visual-editor affordance), but reduce its body to that
-- slice and match the current fallback typography.
UPDATE public.content
SET
  body = $html$<div>
  <h1 data-data-point="home.hero.headline" class="mt-7 max-w-[13ch] font-display text-[clamp(3.2rem,7vw,6.4rem)] font-semibold leading-[0.9] tracking-[-0.055em] text-foreground">Democracy is not a spectator sport.</h1>
  <div class="mt-8 max-w-xl border-l-2 border-accent pl-4 sm:pl-5">
    <p data-data-point="home.hero.mission" class="civic-hero-lede">The mission of the Fair Oaks-Carmichael chapter of Indivisible is to cultivate a non-violent grassroots movement to stop the rise of authoritarianism, to support and defend democratic norms, elect bold leaders, and secure progressive policies.</p>
  </div>
</div>$html$,
  updated_at = now()
WHERE slug = 'copy-home-hero'
  AND body LIKE '%inline-flex items-center gap-2 px-3 py-1.5 rounded-full%';
