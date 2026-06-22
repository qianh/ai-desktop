export type SupabaseConfig = { url: string; key: string };

const STORAGE_KEY = "appscope_supabase_config";

export function loadSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { url: "", key: "" };
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}