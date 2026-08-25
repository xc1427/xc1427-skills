---
name: cx1-sagt
description: 显式将用户当前指派的工作委派给一个 GPT-5.6 Terra 子代理。仅当用户明确调用 cx1-sagt 时使用；reasoning effort 默认 high，用户显式指定时覆盖。
---

# CX1 Spawn Agent by Terra

把用户当前指派的完整工作交给一个新的 Terra 子代理执行。

## 委派

1. 调用 `spawn_agent`，将 `model` 固定为 `gpt-5.6-terra`。
2. 用户显式指定 reasoning effort 时使用该值；否则使用 `high`。
3. 优先使用 `fork_turns: "none"`，并在 `message` 中写出自包含的任务说明，包括目标、相关路径、约束、已知状态、验证要求和预期交付物。
4. 只有任务确实依赖最近对话且无法简洁转述时，才使用足以覆盖所需上下文的最小正整数 `fork_turns`。不得使用 `fork_turns: "all"`，因为完整历史 fork 不能覆盖模型或 reasoning effort。

## 收敛结果

- 主代理负责协调，不要与子代理重复实现同一工作。
- 等待子代理完成，并检查其结果及共享工作区中的实际改动。
- 若结果尚未满足原任务，使用 `followup_task` 给同一子代理补充明确的缺口；不要无故另起子代理。
- 最终答复由主代理整合，明确完成内容、验证结果和任何剩余风险。
- 委派不扩大用户授权范围；子代理仍须遵守原任务的边界和副作用限制。
