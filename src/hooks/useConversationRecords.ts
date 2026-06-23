import { useEffect, useMemo, useState } from "react";
import { fetchFilteredConversationIntercepts } from "../api";
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
  invalidateKey = 0,
) {
  const cacheKey = useMemo(
    () => filterCacheKey(filter, allPageIds),
    [filter, pageIdsKey],
  );

  const [items, setItems] = useState<InterceptedFetch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    if (queryToken < 1) return;

    const config = loadSupabaseConfig();
    if (!config.url || !config.key) {
      setLoading(false);
      setError(null);
      setItems([]);
      setTruncated(false);
      return;
    }

    const ac = new AbortController();
    setItems([]);
    setTruncated(false);
    setLoading(true);
    setError(null);

    fetchFilteredConversationIntercepts(filter, allPageIds, config, ac.signal)
      .then((result) => {
        if (ac.signal.aborted) return;
        setItems(result.rows);
        setTruncated(result.truncated);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : String(e));
        setItems([]);
        setTruncated(false);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => {
      ac.abort();
    };
  }, [cacheKey, pageIdsKey, queryToken, invalidateKey, filter, allPageIds]);

  return { items, loading, error, truncated };
}