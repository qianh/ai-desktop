-- Cleanup redundant/noise rows from public.intercepts.
--
-- Recommended order:
--   1. Run docs/supabase/intercepts-list-optimization.sql first.
--   2. Run the PREVIEW queries below and inspect counts.
--   3. Run one DELETE option. Start with Option A unless you intentionally
--      want to keep non-conversation rows for a short retention window.
--
-- Notes:
--   - Session-record list/detail now relies on is_conversation=true and
--     conversation_id-backed rows. Deleting rows where is_conversation is not
--     true removes old analytics/static/noise captures from this Supabase table.
--   - id is the primary key, so this table cannot contain exact duplicate ids.

-- ---------------------------------------------------------------------------
-- PREVIEW: run these first. They do not delete anything.
-- ---------------------------------------------------------------------------

SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE is_conversation IS TRUE) AS keep_conversation_rows,
  COUNT(*) FILTER (WHERE is_conversation IS NOT TRUE) AS delete_non_conversation_rows,
  pg_size_pretty(pg_total_relation_size('public.intercepts')) AS table_total_size;

SELECT
  CASE
    WHEN is_conversation IS TRUE THEN 'keep: conversation'
    WHEN url ~* '(analytics|sentry|/v1/metrics|/ces/|/rgstr/|/stream_status|/conversation/init|/textdocs)' THEN 'delete: known noise'
    WHEN method NOT IN ('GET', 'POST') THEN 'delete: non GET/POST'
    ELSE 'delete: other non-conversation'
  END AS bucket,
  COUNT(*) AS rows,
  MIN(to_timestamp(timestamp / 1000.0)) AS oldest_at,
  MAX(to_timestamp(timestamp / 1000.0)) AS newest_at
FROM public.intercepts
GROUP BY bucket
ORDER BY rows DESC;

-- Sample rows that would be deleted by Option A.
SELECT id, page_id, timestamp, method, url, preview_text, conversation_id
FROM public.intercepts
WHERE is_conversation IS NOT TRUE
ORDER BY timestamp DESC
LIMIT 50;

-- ---------------------------------------------------------------------------
-- DELETE Option A, recommended:
-- Delete all non-conversation rows after backfill/classification.
-- ---------------------------------------------------------------------------

BEGIN;

WITH deleted AS (
  DELETE FROM public.intercepts
  WHERE is_conversation IS NOT TRUE
  RETURNING id
)
SELECT COUNT(*) AS deleted_rows FROM deleted;

COMMIT;

VACUUM (ANALYZE) public.intercepts;

-- ---------------------------------------------------------------------------
-- DELETE Option B, conservative retention:
-- Use this instead of Option A if you want to keep recent non-conversation rows
-- temporarily. Adjust the interval as needed.
-- ---------------------------------------------------------------------------

-- BEGIN;
--
-- WITH deleted AS (
--   DELETE FROM public.intercepts
--   WHERE is_conversation IS NOT TRUE
--     AND timestamp < ((EXTRACT(EPOCH FROM now() - INTERVAL '7 days') * 1000)::bigint)
--   RETURNING id
-- )
-- SELECT COUNT(*) AS deleted_rows FROM deleted;
--
-- COMMIT;
--
-- VACUUM (ANALYZE) public.intercepts;

-- ---------------------------------------------------------------------------
-- DELETE Option C, batched cleanup for very large tables:
-- Run this block repeatedly until deleted_rows returns 0. This avoids one huge
-- transaction on large Supabase tables.
-- ---------------------------------------------------------------------------

-- WITH doomed AS (
--   SELECT id
--   FROM public.intercepts
--   WHERE is_conversation IS NOT TRUE
--   ORDER BY timestamp ASC
--   LIMIT 10000
-- ),
-- deleted AS (
--   DELETE FROM public.intercepts i
--   USING doomed
--   WHERE i.id = doomed.id
--   RETURNING i.id
-- )
-- SELECT COUNT(*) AS deleted_rows FROM deleted;
--
-- VACUUM (ANALYZE) public.intercepts;
