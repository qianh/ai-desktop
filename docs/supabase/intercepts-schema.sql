-- AppScope intercepts table — run in Supabase SQL editor.
-- Matches InterceptedFetch upload payload in src/types.ts + src/api.ts.

CREATE TABLE IF NOT EXISTS public.intercepts (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  req_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  req_body TEXT,
  status INTEGER NOT NULL DEFAULT 0,
  resp_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  resp_body TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  preview_text TEXT,
  is_conversation BOOLEAN NOT NULL DEFAULT false,
  conversation_id TEXT
);

-- Migrate an existing minimal table (e.g. only id/page_id/timestamp/url).
ALTER TABLE public.intercepts ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'GET';
ALTER TABLE public.intercepts ADD COLUMN IF NOT EXISTS req_headers JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.intercepts ADD COLUMN IF NOT EXISTS req_body TEXT;
ALTER TABLE public.intercepts ADD COLUMN IF NOT EXISTS status INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.intercepts ADD COLUMN IF NOT EXISTS resp_headers JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.intercepts ADD COLUMN IF NOT EXISTS resp_body TEXT;
ALTER TABLE public.intercepts ADD COLUMN IF NOT EXISTS duration_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.intercepts ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE public.intercepts ADD COLUMN IF NOT EXISTS preview_text TEXT;
ALTER TABLE public.intercepts ADD COLUMN IF NOT EXISTS is_conversation BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.intercepts ADD COLUMN IF NOT EXISTS conversation_id TEXT;

-- If timestamp was created as TEXT, convert to BIGINT (epoch ms).
-- Skip if already BIGINT.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'intercepts'
      AND column_name = 'timestamp'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE public.intercepts
      ALTER COLUMN timestamp TYPE BIGINT
      USING NULLIF(timestamp, '')::bigint;
  END IF;
END $$;

ALTER TABLE public.intercepts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_intercepts" ON public.intercepts;
CREATE POLICY "anon_select_intercepts"
  ON public.intercepts FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "anon_insert_intercepts" ON public.intercepts;
CREATE POLICY "anon_insert_intercepts"
  ON public.intercepts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_intercepts" ON public.intercepts;
CREATE POLICY "anon_update_intercepts"
  ON public.intercepts FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);