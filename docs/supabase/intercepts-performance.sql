-- Run in Supabase SQL editor to speed up session-records queries.
-- Schema matches InterceptedFetch upload fields (no extra classification columns).

CREATE INDEX IF NOT EXISTS idx_intercepts_page_id_timestamp_desc
  ON public.intercepts (page_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_intercepts_timestamp_desc
  ON public.intercepts (timestamp DESC);