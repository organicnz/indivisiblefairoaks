-- Postgres full-text search for storefront /search.
--
-- Replaces the naive ILIKE %q% scan, which matched product names only,
-- ignored descriptions/body text, had no relevance ranking, and could not
-- use an index. Weighted tsvector columns are GENERATED ALWAYS, so they can
-- never drift from the source text, and a GIN index keeps lookups cheap.
--
-- Weights: name/title = A (dominant), short_description/body = B/C.
-- Ranking uses ts_rank; user input goes through websearch_to_tsquery, which
-- tolerates quotes/OR syntax and can never raise a syntax error (unlike
-- to_tsquery), so the RPC is safe to feed arbitrary search boxes.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A')
    || setweight(to_tsvector('english', coalesce(short_description, '')), 'B')
    || setweight(to_tsvector('english', left(coalesce(description, ''), 20000)), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS products_search_vector_idx ON public.products USING GIN (search_vector);

ALTER TABLE public.content ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', left(coalesce(body, ''), 50000)), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS content_search_vector_idx ON public.content USING GIN (search_vector);

-- Ranked product search. SECURITY INVOKER on purpose: products already have a
-- public SELECT policy, so the caller's own permissions apply — no definer
-- escalation surface. Returns exactly the fields the storefront renders.
CREATE OR REPLACE FUNCTION public.search_products(search_query text, max_rows int DEFAULT 24)
  RETURNS TABLE (
    id int,
    name varchar,
    slug varchar,
    price numeric,
    regular_price numeric,
    sale_price numeric,
    image_url text,
    stock_status varchar,
    rank real
  )
  LANGUAGE sql
  STABLE
  SET search_path = ''
  AS $$
    SELECT
      p.id,
      p.name,
      p.slug,
      p.price,
      p.regular_price,
      p.sale_price,
      p.image_url,
      p.stock_status,
      ts_rank(p.search_vector, websearch_to_tsquery('english', search_query)) AS rank
    FROM public.products p
    WHERE p.search_vector @@ websearch_to_tsquery('english', search_query)
      AND p.stock_status = 'instock'
    ORDER BY rank DESC, p.created_at DESC NULLS LAST
    LIMIT least(greatest(max_rows, 1), 50);
  $$;

-- Ranked content search (pages/posts), publish-status filtered server-side so
-- drafts can never leak through crafted queries.
CREATE OR REPLACE FUNCTION public.search_content(search_query text, max_rows int DEFAULT 10)
  RETURNS TABLE (
    id int,
    title varchar,
    slug varchar,
    type varchar,
    created_at timestamptz,
    rank real
  )
  LANGUAGE sql
  STABLE
  SET search_path = ''
  AS $$
    SELECT
      c.id,
      c.title,
      c.slug,
      c.type,
      c.created_at,
      ts_rank(c.search_vector, websearch_to_tsquery('english', search_query)) AS rank
    FROM public.content c
    WHERE c.search_vector @@ websearch_to_tsquery('english', search_query)
      AND c.status = 'publish'
    ORDER BY rank DESC, c.created_at DESC NULLS LAST
    LIMIT least(greatest(max_rows, 1), 50);
  $$;
