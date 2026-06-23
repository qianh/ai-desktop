import { listPages, savePage, setPageInterceptReporting, type ApiPage } from "../api";

export const DEFAULT_PAGE_URL = "https://chat.worldwide-logistics.cn/chat";
export const DEFAULT_PAGE_DISPLAY_NAME = "Chat";

export function normalizePageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${path}${parsed.search}`;
  } catch {
    return url.trim().replace(/\/+$/, "");
  }
}

export function isDefaultChatPage(hostOrUrl: string): boolean {
  return normalizePageUrl(hostOrUrl) === normalizePageUrl(DEFAULT_PAGE_URL);
}

/** Built-in Chat uses local mitmproxy without chaining the system upstream proxy. */
export function shouldSkipSystemUpstream(hostOrUrl: string): boolean {
  return isDefaultChatPage(hostOrUrl);
}

/** @deprecated Chat no longer uses direct browse; kept for tests. */
export function shouldBrowseDirect(_hostOrUrl: string): boolean {
  return false;
}
export const DEFAULT_PAGE_SEEDED_KEY = "appscope.default_page_seeded";
export const DEFAULT_PAGE_REMOVED_KEY = "appscope.default_page_removed";

export function hasDefaultPageUrl(pages: Pick<ApiPage, "url">[]): boolean {
  return pages.some((p) => isDefaultChatPage(p.url));
}

/** Built-in Chat always has intercept reporting enabled; not user-toggleable. */
export async function ensureChatInterceptReporting(): Promise<void> {
  const pages = await listPages();
  const chat = pages.find((p) => isDefaultChatPage(p.url));
  if (chat && !chat.intercept_reporting_enabled) {
    await setPageInterceptReporting(chat.id, true);
  }
}

export function shouldEnsureDefaultPage(
  _pagesCount: number,
  hasDefault: boolean,
  alreadySeeded: boolean,
  userRemoved: boolean,
): boolean {
  if (userRemoved) return false;
  if (hasDefault) return false;
  if (alreadySeeded) return false;
  // First-install empty DB, or one-time upgrade for installs that predate the built-in Chat page.
  return true;
}

export function isDefaultPageSeeded(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(DEFAULT_PAGE_SEEDED_KEY) === "1";
}

export function isDefaultPageRemoved(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(DEFAULT_PAGE_REMOVED_KEY) === "1";
}

export function markDefaultPageSeeded(storage: Pick<Storage, "setItem">): void {
  storage.setItem(DEFAULT_PAGE_SEEDED_KEY, "1");
}

export function markDefaultPageRemoved(
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  storage.setItem(DEFAULT_PAGE_REMOVED_KEY, "1");
}

export function pickStartupPageId(
  pages: { id: string; host: string }[],
): string | null {
  const defaultPage = pages.find((p) => isDefaultChatPage(p.host));
  return defaultPage?.id ?? pages[0]?.id ?? null;
}

/** @deprecated use shouldEnsureDefaultPage */
export function shouldSeedDefaultPage(
  pagesCount: number,
  alreadySeeded: boolean,
): boolean {
  return shouldEnsureDefaultPage(pagesCount, false, alreadySeeded, false);
}

export async function ensureDefaultPage(
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): Promise<boolean> {
  const pages = await listPages();
  const hasDefault = hasDefaultPageUrl(pages);
  if (
    !shouldEnsureDefaultPage(
      pages.length,
      hasDefault,
      isDefaultPageSeeded(storage),
      isDefaultPageRemoved(storage),
    )
  ) {
    return false;
  }

  const saved = await savePage(DEFAULT_PAGE_DISPLAY_NAME, DEFAULT_PAGE_URL);
  await setPageInterceptReporting(saved.id, true);
  markDefaultPageSeeded(storage);
  return true;
}