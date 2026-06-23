import { useCallback, useEffect, useRef, useState } from "react";
import { fetchConversationIntercepts } from "../api";
import { loadSupabaseConfig } from "../lib/supabase";
import type { InterceptedFetch } from "../types";

const cache = new Map<string, InterceptedFetch[]>();

export function invalidateConversationRecords(pageId: string): void {
  cache.delete(pageId);
}

export function useConversationRecords(pageId: string, invalidateKey = 0) {
  const [items, setItems] = useState<InterceptedFetch[]>(() => cache.get(pageId) ?? []);
  const [loading, setLoading] = useState(() => !cache.has(pageId));
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (force = false) => {
      const config = loadSupabaseConfig();
      if (!config.url || !config.key) return;

      const cached = cache.get(pageId);
      if (!force && cached) {
        setItems(cached);
        setLoading(false);
        setError(null);
        return;
      }

      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchConversationIntercepts(pageId, config);
        if (id !== requestId.current) return;
        cache.set(pageId, rows);
        setItems(rows);
      } catch (e) {
        if (id !== requestId.current) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [pageId],
  );

  useEffect(() => {
    void load(false);
  }, [load, pageId, invalidateKey]);

  const refresh = useCallback(() => {
    cache.delete(pageId);
    void load(true);
  }, [load, pageId]);

  return { items, loading, error, refresh };
}