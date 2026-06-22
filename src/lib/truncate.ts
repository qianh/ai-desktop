/** Aligns with intercept script MAX_BODY_SIZE (50k); UI preview cap is lower. */
export const INTERCEPT_BODY_DISPLAY_LIMIT = 4000;

export function truncateBody(
  text: string | null,
  maxLen = INTERCEPT_BODY_DISPLAY_LIMIT,
): { text: string; truncated: boolean } {
  if (!text) return { text: "—", truncated: false };
  if (text.length <= maxLen) return { text, truncated: false };
  return { text: text.slice(0, maxLen) + "…", truncated: true };
}