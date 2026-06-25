## ADDED Requirements

### Requirement: Upload only conversation rows
The system SHALL include an intercepted row in the Supabase upload payload only when the existing conversation classification logic marks that row as a conversation.

#### Scenario: Conversation row
- **WHEN** `uploadInterceptsToSupabase` receives an intercept whose classification metadata has `isConversation` equal to true
- **THEN** the Supabase POST payload includes a row for that intercept

#### Scenario: Non-conversation row
- **WHEN** `uploadInterceptsToSupabase` receives an intercept whose classification metadata has `isConversation` equal to false
- **THEN** the Supabase POST payload excludes that intercept entirely

#### Scenario: Mixed batch
- **WHEN** `uploadInterceptsToSupabase` receives a batch containing both conversation and non-conversation intercepts
- **THEN** the Supabase POST payload contains only the conversation intercept rows

#### Scenario: Empty filtered batch
- **WHEN** `uploadInterceptsToSupabase` receives only non-conversation intercepts
- **THEN** the system does not send a Supabase POST request

### Requirement: Preserve existing conversation upload shape
The system SHALL keep the existing sanitization and metadata enrichment behavior for rows that are uploaded as conversations.

#### Scenario: Existing metadata retained
- **WHEN** a conversation row is uploaded
- **THEN** the row retains `id`, `page_id`, `timestamp`, `url`, `method`, `status`, `duration_ms`, `preview_text`, `is_conversation`, and `conversation_id`

#### Scenario: Existing body sanitization retained
- **WHEN** a conversation row is uploaded
- **THEN** `req_body`, `resp_body`, `req_headers`, and `resp_headers` follow the same sanitization behavior that existed before this change

### Requirement: Keep local interception unchanged
The system SHALL keep local WebView interception and local InterceptPanel display behavior unchanged.

#### Scenario: Local debug panel
- **WHEN** a page has intercept reporting enabled and local fetch intercepts are captured
- **THEN** the local InterceptPanel can still display all captured local intercepts, including non-conversation rows

#### Scenario: Cloud-only filtering
- **WHEN** a non-conversation intercept exists locally
- **THEN** it is filtered before Supabase upload without requiring Rust or WebView hook changes

### Requirement: Avoid schema migration
The system SHALL use the existing Supabase `intercepts` table columns for this change.

#### Scenario: Existing columns
- **WHEN** a conversation row is uploaded
- **THEN** the system uses the existing `intercepts` table columns

#### Scenario: No new messages column
- **WHEN** the change is implemented
- **THEN** no new Supabase `messages` or equivalent body column is required
