---
task: 排查对话详情展示JSON格式而非对话格式
slug: 20260624-155606_debug-conversation-detail-json-format
effort: standard
phase: complete
progress: 4/4
mode: interactive
started: 2026-06-24T15:56:06+08:00
updated: 2026-06-24T16:10:00+08:00
---

## Context

ChatGPT GET /conversation/{id} 响应体通常超过 50K 字符。intercept 脚本的 MAX_BODY_SIZE=50000 截断 body 并追加 `...[truncated]`，导致 `parseConversationBodies` 的 JSON.parse 失败，整个 body 以 rawResp 形式显示（"响应体（未识别为对话）"）。

### Risks

正常 JSON 不受影响（只在 catch 块执行）。regex 仅匹配 ChatGPT mapping 格式。

## Criteria

- [x] ISC-1: 识别 GET /conversation 响应截断导致 JSON.parse 失败的根因
- [x] ISC-2: 在 catch 块添加 extractFromTruncatedMappingBody 函数
- [x] ISC-3: TypeScript 类型检查通过
- [x] ISC-4: 89 个测试全部通过无回归

## Decisions

- 仅修改 `src/lib/conversationFilter.ts`，精准 catch block 新增 fallback
- 不增加 MAX_BODY_SIZE（影响性能/内存）
- regex 提取最后一个 user/assistant 消息对（与现有逻辑一致）

## Verification

- `npx tsc --noEmit` 无错误
- `npx vitest run` 89 tests passed
- Node.js 手动测试：用户消息 "我codex登录时..." 正确提取

