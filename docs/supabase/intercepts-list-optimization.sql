-- Session-records query optimization for Supabase/PostgREST.
-- Run in the Supabase SQL editor after deploying the app code that writes
-- preview_text, is_conversation, and conversation_id.
--
-- Safe to run more than once. The timestamp normalization update is idempotent
-- for current epoch-second values because it only touches values below 1e12.

-- 1) Columns used by indexed session-record queries.
ALTER TABLE public.intercepts ADD COLUMN IF NOT EXISTS preview_text TEXT;
ALTER TABLE public.intercepts ADD COLUMN IF NOT EXISTS is_conversation BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.intercepts ADD COLUMN IF NOT EXISTS conversation_id TEXT;

-- 2) Normalize historical epoch-second timestamps to epoch milliseconds.
-- The app now pushes timestamp filters to PostgREST, so mixed second/ms values
-- would make database-side time filtering miss old rows.
UPDATE public.intercepts
SET timestamp = timestamp * 1000
WHERE timestamp > 0
  AND timestamp < 1000000000000;

-- 3) Temporary helper for robust JSON title extraction during backfill.
CREATE OR REPLACE FUNCTION public.appscope_try_jsonb(value TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN value::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- 4) Backfill ChatGPT/OpenAI conversation rows from URL/body metadata.
WITH parsed AS (
  SELECT
    id,
    public.appscope_try_jsonb(resp_body) AS resp_json,
    public.appscope_try_jsonb(req_body) AS req_json,
    (regexp_match(url, '/backend-api/conversation/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', 'i'))[1] AS backend_api_id,
    (regexp_match(url, '/backend-anon/conversation/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', 'i'))[1] AS backend_anon_id,
    (regexp_match(url, '/api/conversation/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', 'i'))[1] AS api_id
  FROM public.intercepts
  WHERE method IN ('GET', 'POST')
    AND (
      url ~* '/backend-api/conversation'
      OR url ~* '/backend-anon/conversation'
      OR url ~* '/api/conversation'
      OR url ~* '/api/chat/?$'
      OR url ~* 'chatgpt\.com.*conversation'
      OR url ~* 'chat\.openai\.com.*conversation'
    )
    AND url !~* '/textdocs'
    AND url !~* '/stream_status'
    AND url !~* '/conversation/init'
    AND url !~* '/ces/'
    AND url !~* '/rgstr/'
)
UPDATE public.intercepts AS i
SET
  is_conversation = true,
  conversation_id = COALESCE(
    i.conversation_id,
    parsed.backend_api_id,
    parsed.backend_anon_id,
    parsed.api_id,
    NULLIF(parsed.req_json ->> 'conversation_id', ''),
    NULLIF(parsed.req_json ->> 'chatId', ''),
    NULLIF(parsed.req_json ->> 'id', '')
  ),
  preview_text = COALESCE(
    NULLIF(TRIM(i.preview_text), ''),
    NULLIF(TRIM(parsed.resp_json ->> 'title'), ''),
    NULLIF(TRIM(parsed.req_json ->> 'title'), ''),
    CASE
      WHEN i.method = 'POST' THEN '发送对话消息'
      ELSE '加载对话记录'
    END
  )
FROM parsed
WHERE i.id = parsed.id
  AND (
    i.is_conversation IS NOT TRUE
    OR i.preview_text IS NULL
    OR i.conversation_id IS NULL
  );

-- 5) Backfill built-in Chat /_serverFn rows that older uploads may have left
-- unclassified. This covers the two Seroval shapes parsed by the app:
-- chat metadata and message-thread rows.
WITH server_fn AS (
  SELECT
    id,
    COALESCE(resp_body, req_body, '') AS body_text
  FROM public.intercepts
  WHERE method IN ('GET', 'POST')
    AND url ~* '/_serverFn/'
    AND (
      COALESCE(resp_body, req_body, '') ~ '"k":\["id","userId","title"'
      OR COALESCE(resp_body, req_body, '') ~ '"k":\["id","chatId","parentId","role","parts"'
    )
)
UPDATE public.intercepts AS i
SET
  is_conversation = true,
  conversation_id = COALESCE(
    i.conversation_id,
    (regexp_match(server_fn.body_text, '"k":\["id","userId","title"[^]]*\],"v":\[\{"t":1,"s":"([^"]+)"'))[1],
    (regexp_match(server_fn.body_text, '"k":\["id","chatId","parentId"[^]]*\],"v":\[\{"t":1,"s":"[^"]*"\},\{"t":1,"s":"([^"]+)"'))[1]
  ),
  preview_text = COALESCE(
    NULLIF(TRIM(i.preview_text), ''),
    (regexp_match(server_fn.body_text, '"k":\["id","userId","title"[^]]*\],"v":\[\{"t":1,"s":"[^"]*"\},\{"t":1,"s":"[^"]*"\},\{"t":1,"s":"([^"]+)"'))[1],
    '内置 Chat 对话'
  )
FROM server_fn
WHERE i.id = server_fn.id
  AND (
    i.is_conversation IS NOT TRUE
    OR i.preview_text IS NULL
    OR i.conversation_id IS NULL
  );

-- 6) Keep obvious noise out of indexed conversation lists.
UPDATE public.intercepts
SET is_conversation = false
WHERE is_conversation IS NOT TRUE
  AND (
    url ~* '/textdocs'
    OR url ~* '/stream_status'
    OR url ~* '/conversation/init'
    OR url ~* '/ces/'
    OR url ~* '/rgstr/'
    OR url ~* '/v1/metrics'
    OR url ~* 'analytics'
    OR url ~* 'sentry'
  );

-- 7) Indexes for the optimized list queries:
--   page selected: page_id = ? AND is_conversation = true ORDER BY timestamp DESC
--   all pages:     is_conversation = true ORDER BY timestamp DESC
CREATE INDEX IF NOT EXISTS idx_intercepts_conversation_page_timestamp_desc
  ON public.intercepts (page_id, timestamp DESC)
  WHERE is_conversation = true
    AND method IN ('GET', 'POST');

CREATE INDEX IF NOT EXISTS idx_intercepts_conversation_timestamp_desc
  ON public.intercepts (timestamp DESC)
  WHERE is_conversation = true
    AND method IN ('GET', 'POST');

-- 8) Indexes for detail/thread queries:
--   conversation_id = ? [AND page_id = ?] ORDER BY timestamp ASC
CREATE INDEX IF NOT EXISTS idx_intercepts_conversation_id_page_timestamp_asc
  ON public.intercepts (conversation_id, page_id, timestamp ASC)
  WHERE conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intercepts_conversation_id_timestamp_asc
  ON public.intercepts (conversation_id, timestamp ASC)
  WHERE conversation_id IS NOT NULL;

-- 9) Optional safety net for legacy URL-only fallback queries. The optimized
-- hot path no longer depends on url ILIKE, but this keeps fallback tolerable.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_intercepts_url_trgm
  ON public.intercepts USING gin (url gin_trgm_ops)
  WHERE method IN ('GET', 'POST');

-- 10) Refresh planner statistics after bulk updates/index creation.
ANALYZE public.intercepts;

DROP FUNCTION IF EXISTS public.appscope_try_jsonb(TEXT);
