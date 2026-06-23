import { useEffect, useMemo, useState } from "react";
import {
  fetchFilteredConversationIntercepts,
  type ConversationTruncationReason,
} from "../api";
import {
  filterCacheKey,
  type ConversationRecordsFilter,
} from "../lib/conversationRecordsQuery";
import { loadSupabaseConfig } from "../lib/supabase";
import type { InterceptedFetch } from "../types";

export function useConversationRecords(
  filter: ConversationRecordsFilter,
  allPageIds: string[],
  pageIdsKey: string,
  queryToken = 0,
) {
  const cacheKey = useMemo(
    () => filterCacheKey(filter, allPageIds),
    [filter, pageIdsKey],
  );

  const [items, setItems] = useState<InterceptedFetch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [truncationReason, setTruncationReason] = useState<ConversationTruncationReason | null>(
    null,
  );

  useEffect(() => {
    if (queryToken < 1) return;

    const config = loadSupabaseConfig();
    if (!config.url || !config.key) {
      setLoading(false);
      setError(null);
      setItems([]);
      setTruncated(false);
      setTruncationReason(null);
      return;
    }

    const ac = new AbortController();
    setItems([]);
    setTruncated(false);
    setTruncationReason(null);
    setLoading(true);
    setError(null);

    fetchFilteredConversationIntercepts(filter, allPageIds, config, ac.signal)
      .then((result) => {
        if (ac.signal.aborted) return;
        setItems(result.rows);
        setTruncated(result.truncated);
        setTruncationReason(result.truncationReason);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : String(e));
        setItems([]);
        setTruncated(false);
        setTruncationReason(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => {
      ac.abort();
    };
  }, [cacheKey, pageIdsKey, queryToken, filter, allPageIds]);

  return { items, loading, error, truncated, truncationReason };
}