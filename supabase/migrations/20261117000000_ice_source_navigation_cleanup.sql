-- The first crawl of StopICE's stable home URL treated five navigation pages
-- as report text before the monthly-export resolver was added. They are not
-- reports and must not be republished as if they were.
delete from public.ice_source_reports
where extraction_method = 'html'
  and source_name = 'Stop ICE Alerts Network'
  and source_url in (
    'https://stopice.net/?data=1',
    'https://stopice.net/login/?maps=1',
    'https://stopice.net/?join=1',
    'https://stopice.net/login/?events=1',
    'https://stopice.net/?rapidresponseteams=1'
  );
