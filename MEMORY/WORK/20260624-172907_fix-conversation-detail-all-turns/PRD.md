---
task: 对话详情模态框展示完整多轮历史
slug: 20260624-172907_fix-conversation-detail-all-turns
effort: standard
phase: complete
progress: 10/10
mode: interactive
started: 2026-06-24T17:29:07+08:00
updated: 2026-06-24T17:31:00+08:00
---

## Context

用户打开对话详情 Modal，看到的只有最后一轮 user/assistant 消息，之前的多轮历史不可见。
根因：`messagesFromIntercept`（conversationFilter.ts:941）对 GET /conversation（带完整 mapping JSON）只调用 `pairFromCurrentNode`，该函数从 `current_node` 向上走，找到第一对 user+assistant 后立即 break，其余历史被丢弃。
修复方案：新增 `allMessagesFromMapping`，沿 parent 链收集所有 user/assistant 节点（unshift 保证旧→新顺序），在 `messagesFromIntercept` 中优先用于有 mapping+current_node 的 resp_body。

涉及文件：`src/lib/conversationFilter.ts`（+函数 + 修改 messagesFromIntercept）

## Criteria

- [x] ISC-1: `allMessagesFromMapping` 函数存在于 conversationFilter.ts
- [x] ISC-2: `allMessagesFromMapping` 从 current_node 沿 parent 链收集全部消息节点
- [x] ISC-3: `allMessagesFromMapping` 返回数组按时间顺序（旧→新）排列
- [x] ISC-4: `allMessagesFromMapping` 只收集 role=user 或 role=assistant 的节点，跳过 system/tool
- [x] ISC-5: `allMessagesFromMapping` 在 mapping/current_node 缺失时返回空数组
- [x] ISC-6: `messagesFromIntercept` 对含 mapping+current_node 的 resp_body 优先调用 `allMessagesFromMapping`
- [x] ISC-7: `messagesFromIntercept` 无 mapping 时回退逻辑不变（使用 parseConversationBodies）
- [x] ISC-8: 新测试：2轮对话 mapping 返回 [user1, assistant1, user2, assistant2] 共4条
- [x] ISC-9: 新测试：mapping 缺 current_node 时 allMessagesFromMapping 返回 []
- [x] ISC-10: `npx vitest run` 全部测试通过无回归

## Decisions

- 不修改 `pairFromCurrentNode`（列表预览/parseConversationBodies 继续用最后一对）
- 不修改 `aggregateConversationMessages`（结构不变，messagesFromIntercept 改了内部就好）
- `allMessagesFromMapping` 放在 `pairFromCurrentNode` 附近（同一逻辑区域）

## Verification

- `npx vitest run src/lib/conversationFilter.test.ts` 全通过
- `npx vitest run` 全量通过
- `npx tsc --noEmit` 无 TypeScript 错误
