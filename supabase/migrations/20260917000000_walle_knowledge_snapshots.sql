-- WALL-E stores a bounded, public-only knowledge snapshot for daily refreshes.
-- RLS is intentionally enabled with no client policies: only service_role may use it.
CREATE TABLE IF NOT EXISTS public.walle_knowledge_snapshots (
    source_key text PRIMARY KEY,
    content_hash text NOT NULL,
    record_count integer NOT NULL DEFAULT 0 CHECK (record_count >= 0),
    payload jsonb NOT NULL DEFAULT '[]'::jsonb,
    refreshed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.walle_knowledge_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.walle_knowledge_snapshots FROM anon, authenticated;
GRANT ALL ON public.walle_knowledge_snapshots TO service_role;

COMMENT ON TABLE public.walle_knowledge_snapshots IS
    'Private, public-site-only snapshots used to track WALL-E knowledge refreshes. Never stores visitor conversations.';
