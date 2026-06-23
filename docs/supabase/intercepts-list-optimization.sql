-- Session-records list optimization: indexed preview fields + backfill.
-- Run in Supabase SQL editor after deploying the app upload changes.

-- 1) New columns
ALTER TABLE public.intercepts ADD COLUMN IF NOT EXISTS preview_text TEXT;
ALTER TABLE public.intercepts ADD COLUMN IF NOT EXISTS is_conversation BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.intercepts ADD COLUMN IF NOT EXISTS conversation_id TEXT;

-- 2) Indexes for list queries
CREATE INDEX IF NOT EXISTS idx_intercepts_is_conversation_timestamp_desc
  ON public.intercepts (is_conversation, timestamp DESC)
  WHERE is_conversation = true;

CREATE INDEX IF NOT EXISTS idx_intercepts_conversation_id_timestamp_desc
  ON public.intercepts (conversation_id, timestamp DESC)
  WHERE conversation_id IS NOT NULL;

-- 3) Backfill historical GET conversation loads (title + mapping in resp_body)
UPDATE public.intercepts
SET
  preview_text = NULLIF(TRIM(resp_body::jsonb ->> 'title'), ''),
  is_conversation = true,
  conversation_id = (
    regexp_match(url, '/backend-api/conversation/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', 'i')
  )[1]
WHERE
  method = 'GET'
  AND url ~* '/backend-api/conversation/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/?$'
  AND resp_body IS NOT NULL
  AND resp_body ~ '^\s*\{'
  AND resp_body::jsonb ? 'mapping'
  AND (is_conversation IS NOT TRUE OR preview_text IS NULL);

-- 4) Optional: mark obvious noise rows so they never appear in is_conversation=true lists
UPDATE public.intercepts
SET is_conversation = false
WHERE
  is_conversation IS NOT TRUE
  AND (
    url ~* '/textdocs'
    OR url ~* '/stream_status'
    OR url ~* '/conversation/init'
    OR url ~* '/ces/'
    OR url ~* '/rgstr/'
  );