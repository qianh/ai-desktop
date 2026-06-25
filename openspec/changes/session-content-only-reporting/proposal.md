## Why

AppScope currently uploads sanitized intercept rows to Supabase, but the payload can still include non-conversation request/response bodies. This is too broad for a cloud reporting path whose intended value is browsing conversation history.

This change narrows cloud reporting to conversation rows only while preserving the existing upload shape for rows that are already recognized as conversations.

## What Changes

- Supabase upload SHALL only POST rows that the existing conversation classification logic recognizes as conversation rows.
- Non-conversation intercepts SHALL be omitted from the Supabase POST payload entirely.
- Uploaded conversation rows SHALL continue using the existing sanitization and classification logic.
- Existing local WebView interception and InterceptPanel behavior remain unchanged.
- No Supabase schema change is introduced.

## Capabilities

### New Capabilities

- `conversation-content-reporting`: Cloud reporting that uploads only conversation rows while preserving existing conversation-row upload behavior.

### Modified Capabilities

- None. This repository has no checked-in OpenSpec baseline specs yet; existing project docs are mirrored in `docs/spec/*`.

## Impact

- Frontend upload path: `src/api.ts`
- Conversation parsing/classification: `src/lib/conversationFilter.ts`
- Upload sanitization helpers: `src/lib/sanitizeForUpload.ts` (expected to remain behavior-compatible unless tests expose a needed narrow change)
- Types, only if a helper type is needed: `src/types.ts`
- Tests: `src/api.uploadIntercepts.test.ts`, `src/lib/sanitizeForUpload.test.ts`, `src/lib/conversationFilter.test.ts`
- External system: Supabase `intercepts` table payload shape, without schema migration
- Out of scope: Rust/Tauri WebView hook, local InterceptPanel filtering, historical Supabase cleanup
