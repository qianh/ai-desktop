## 1. Upload Filtering Tests

- [x] 1.1 Add a mixed-batch test in `src/api.uploadIntercepts.test.ts` proving conversation rows are posted and non-conversation rows are omitted.
- [x] 1.2 Add an all-non-conversation test proving `uploadInterceptsToSupabase` does not call `fetch` when no conversation rows remain.
- [x] 1.3 Update the existing utility `/_serverFn` non-conversation test so it asserts omission instead of an uploaded `is_conversation=false` row.

## 2. Upload Boundary Implementation

- [x] 2.1 Update `src/api.ts` so `uploadInterceptsToSupabase` filters out rows where `classifyInterceptForStorage(item).isConversation !== true`.
- [x] 2.2 Preserve existing `sanitizeInterceptForUpload`, `preview_text`, `is_conversation`, and `conversation_id` enrichment for uploaded conversation rows.
- [x] 2.3 Return before Supabase POST when filtering leaves zero rows.

## 3. Verification

- [x] 3.1 Run `openspec validate session-content-only-reporting` and record valid output.
- [x] 3.2 Run `bun run test -- src/api.uploadIntercepts.test.ts src/lib/sanitizeForUpload.test.ts src/lib/conversationFilter.test.ts`.
- [x] 3.3 Run `bun run build`.
