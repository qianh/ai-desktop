## Context

AppScope captures page fetch traffic locally and can upload intercepted rows to Supabase for conversation history. The current upload function maps every intercepted row through classification and sanitization, then POSTs the full sanitized row. That allows non-conversation bodies to leave the local app.

The user clarified that this change should stay simple: determine whether each intercepted row is a conversation before upload; upload conversation rows with the existing logic; omit all other rows.

## Goals / Non-Goals

**Goals:**

- Upload only intercepts that the existing classification logic marks as conversations.
- Preserve the existing upload shape and sanitization behavior for conversation rows.
- Keep local capture/debugging unchanged.
- Avoid Supabase schema migration.

**Non-Goals:**

- Filtering the local InterceptPanel or local React state.
- Changing Rust/Tauri WebView interception.
- Cleaning historical Supabase rows.
- Adding a `messages` JSONB column.
- Reworking the conversation records UI.
- Rewriting `req_body` / `resp_body` into message-only text.
- Changing existing header/body sanitization behavior for rows that are uploaded.

## Decisions

1. **Filter at the upload boundary.**
   - Choice: filter non-conversation rows inside or just before `uploadInterceptsToSupabase`.
   - Rationale: this is the narrowest privacy boundary and leaves local debugging intact.
   - Alternative rejected: filter in the WebView hook, because it would remove local debug value and require more brittle site-specific logic.

2. **Preserve existing conversation-row upload logic.**
   - Choice: once a row is classified as conversation, keep the current `sanitizeInterceptForUpload` plus `preview_text` / `is_conversation` / `conversation_id` enrichment.
   - Rationale: the requested change is a row-level filter, not a payload-shape migration.
   - Alternative rejected: rewrite `req_body` and `resp_body` into message-only text, because that is extra behavior beyond the clarified request.

3. **Do not upload non-conversation metadata.**
   - Choice: non-conversation intercepts are omitted entirely from Supabase payload.
   - Rationale: the user asked that all other content not be reported; even metadata about non-conversation requests can reveal browsing behavior.
   - Alternative rejected: upload metadata-only rows, because it weakens the privacy promise.

## Risks / Trade-offs

- [Risk] Existing tests expect non-conversation rows to be posted with `is_conversation=false`.
  → Mitigation: update upload tests so non-conversation rows are absent from the POST body.

- [Risk] Classification bugs could drop a valid conversation row.
  → Mitigation: keep or expand classification tests for existing supported conversation formats.

- [Risk] New message-only rows may coexist with older raw rows in Supabase.
  → Mitigation: no message-only row migration is introduced; read paths remain compatible with existing uploaded rows.
