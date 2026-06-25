# Session Content Only Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase upload only reports rows already classified as conversations; non-conversation intercepts are omitted entirely.

**Architecture:** Keep the existing local intercept and upload-shape behavior. Add a row-level filter inside `uploadInterceptsToSupabase` after `classifyInterceptForStorage(item)` and before constructing the POST body.

**Tech Stack:** React 18 + TypeScript + Vitest + Vite; Supabase REST payload generation in `src/api.ts`.

---

### Task 1: Lock Upload Filtering Behavior With Tests

**Files:**
- Modify: `src/api.uploadIntercepts.test.ts:29-210`
- Reference: `src/lib/conversationFilter.ts:894-935`

- [ ] **Step 1: Add a failing mixed-batch test**

Add a test to `src/api.uploadIntercepts.test.ts` proving a batch with one conversation row and one non-conversation row sends only the conversation row.

Current relevant code:

```ts
await uploadInterceptsToSupabase("page-1", [sample], config);
const body = JSON.parse(String(postedInit?.body)) as InterceptedFetch[];
expect(body[0].page_id).toBe("page-1");
```

Suggested assertion shape:

```ts
await uploadInterceptsToSupabase("page-1", [chat, noise], config);
const body = JSON.parse(postedBody) as InterceptedFetch[];
expect(body).toHaveLength(1);
expect(body[0].id).toBe(chat.id);
expect(body[0].is_conversation).toBe(true);
```

- [ ] **Step 2: Add a failing all-non-conversation test**

Add a test proving `fetch` is not called when every input row is classified as non-conversation.

Suggested assertion shape:

```ts
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
await uploadInterceptsToSupabase("page-1", [noise], config);
expect(fetchMock).not.toHaveBeenCalled();
```

- [ ] **Step 3: Update existing non-conversation expectation**

The current utility `/_serverFn` test expects a posted row with `is_conversation=false`; update it to assert absence from POST instead.

Current relevant code:

```ts
await uploadInterceptsToSupabase("page-1", [noise], config);
const row = JSON.parse(postedBody)[0] as InterceptedFetch;
expect(row.is_conversation).toBe(false);
expect(row.preview_text).toBeNull();
```

- [ ] **Step 4: Run the focused test and confirm red**

Run:

```bash
bun run test -- src/api.uploadIntercepts.test.ts
```

Expected before implementation: failures showing non-conversation rows are still posted or `fetch` is still called.

### Task 2: Filter Non-Conversation Rows Before Supabase POST

**Files:**
- Modify: `src/api.ts:339-372`
- Test: `src/api.uploadIntercepts.test.ts`

- [ ] **Step 1: Implement the minimal row filter**

Current code:

```ts
const rows = items.map((item) => {
  const meta = classifyInterceptForStorage(item);
  const sanitized = sanitizeInterceptForUpload(item);
  return {
    ...sanitized,
    page_id: pageId,
    preview_text: sanitizePostgresText(meta.previewText),
    is_conversation: meta.isConversation,
    conversation_id:
      meta.conversationId != null ? stripNullBytes(meta.conversationId) : meta.conversationId,
  };
});
```

Change it so rows with `meta.isConversation !== true` return no upload row. Preserve the existing `sanitizeInterceptForUpload` and metadata enrichment for rows that remain.

- [ ] **Step 2: Return early when nothing remains**

After filtering, if `rows.length === 0`, return before calling `fetch`.

- [ ] **Step 3: Run focused tests and confirm green**

Run:

```bash
bun run test -- src/api.uploadIntercepts.test.ts
```

Expected: all tests in `src/api.uploadIntercepts.test.ts` pass.

### Task 3: Final Verification

**Files:**
- Verify: `openspec/changes/session-content-only-reporting/specs/conversation-content-reporting/spec.md`
- Verify: `docs/spec/session-content-only-reporting/spec.md`

- [ ] **Step 1: Validate OpenSpec**

Run:

```bash
openspec validate session-content-only-reporting
```

Expected: `Change 'session-content-only-reporting' is valid`

- [ ] **Step 2: Run focused regression tests**

Run:

```bash
bun run test -- src/api.uploadIntercepts.test.ts src/lib/sanitizeForUpload.test.ts src/lib/conversationFilter.test.ts
```

Expected: all listed test files pass.

- [ ] **Step 3: Run build**

Run:

```bash
bun run build
```

Expected: TypeScript check and Vite build complete with exit code 0.
