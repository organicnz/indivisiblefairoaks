-- Seed data points for utility pages, global navigation, Wall-E AI assistant, and search palettes
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  -- 404 Not Found Screen
  ('notfound.badge', 'notfound', 'Not Found Error Badge', 'Error 404', 'text'),
  ('notfound.title', 'notfound', 'Not Found Headline', 'This page isn''t here', 'text'),
  ('notfound.description', 'notfound', 'Not Found Description', 'The address may be mistyped, or the page may have moved when the site moved off our old platform. The links below cover most of what people are looking for.', 'text'),
  ('notfound.btn.home', 'notfound', 'Not Found Home Button', 'Go to homepage', 'text'),
  ('notfound.btn.contact', 'notfound', 'Not Found Contact Button', 'Contact us', 'text'),
  ('notfound.popular.title', 'notfound', 'Not Found Popular Links Title', 'Popular pages', 'text'),

  -- Error Boundary Screen
  ('error.badge', 'error', 'Error Badge Symbol', '!', 'text'),
  ('error.title', 'error', 'Error Headline', 'Something Snapped', 'text'),
  ('error.description', 'error', 'Error Description', 'We encountered an unexpected issue while loading this page. Please try again, or reach out to our team if the issue persists.', 'text'),
  ('error.btn.retry', 'error', 'Error Retry Button', 'Try Again', 'text'),
  ('error.btn.contact', 'error', 'Error Contact Support Link', 'Contact Support', 'text'),

  -- Account Error Boundary
  ('account.error.title', 'account', 'Account Error Title', 'Something went wrong', 'text'),
  ('account.error.retry', 'account', 'Account Error Retry Button', 'Try again', 'text'),

  -- Header & Navigation Drawer
  ('header.donate_btn', 'header', 'Header Donate Button', 'Donate', 'text'),
  ('header.drawer.search', 'header', 'Header Drawer Quick Search', 'Quick Search…', 'text'),
  ('header.drawer.donate_cta', 'header', 'Header Drawer Support CTA', 'Support via ActBlue', 'text'),
  ('header.drawer.tagline', 'header', 'Header Drawer Tagline', 'Grassroots community organizing for democracy.', 'text'),

  -- Wall-E AI Assistant
  ('walle.badge', 'walle', 'WALL-E Status Badge', 'Online', 'text'),
  ('walle.subtitle', 'walle', 'WALL-E Subtitle', 'Your Fair Oaks guide · grounded in our site', 'text'),
  ('walle.prompt_tip', 'walle', 'WALL-E Prompt Suggestion', 'Ask about events, voter resources, partners, or gear.', 'text'),
  ('walle.starter_msg', 'walle', 'WALL-E Starter Greeting', 'Hi! I''m WALL-E. Ask me about our chapter, events, voter resources, or products.', 'text'),
  ('walle.input_placeholder', 'walle', 'WALL-E Input Placeholder', 'Ask WALL-E anything about our chapter…', 'text'),
  ('walle.btn.send', 'walle', 'WALL-E Send Button', 'Send', 'text'),
  ('walle.launcher_label', 'walle', 'WALL-E Launcher Accessible Label', 'Open WALL-E chat assistant', 'text'),
  ('walle.checking', 'walle', 'WALL-E Thinking Notice', 'WALL-E is checking the site…', 'text'),
  ('walle.source_heading', 'walle', 'WALL-E Sources Heading', 'Explore the source', 'text'),

  -- Command Palette
  ('palette.placeholder', 'palette', 'Command Palette Placeholder', 'Search actions, voter resources, events, or pages… (ESC to close)', 'text'),
  ('palette.empty.title', 'palette', 'Command Palette Empty Title', 'No civic actions or pages found', 'text'),
  ('palette.empty.desc', 'palette', 'Command Palette Empty Description', 'Try searching for voter, meeting, choir, or donate.', 'text'),

  -- Events Interactive Calendar
  ('events.search.placeholder', 'events', 'Events Search Placeholder', 'Search actions, meetings, or locations...', 'text'),
  ('events.empty.desc', 'events', 'Events Empty State', 'No events found matching your criteria. Try selecting "All Actions" or clearing the search query.', 'text'),

  -- News & Bulletins
  ('news.search.placeholder', 'news', 'News Search Placeholder', 'Search bulletins, topics, or insights...', 'text'),
  ('news.empty.desc', 'news', 'News Empty State', 'No chapter bulletins match your criteria. Try choosing "All Topics" or clearing the search bar.', 'text')
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now();
