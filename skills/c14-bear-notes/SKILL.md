---
name: c14-bear-notes
description: 使用 Bear Notes MCP 读取、搜索和操作 Bear 笔记。只要用户提及 Bear、Bear Notes、Bear 笔记、bear note、熊掌记，提供 Bear x-callback-url，或要求查找、查看、创建、编辑、追加、归档、恢复、加标签、管理附件等 Bear 内容时使用。
---

# C14 Bear Notes

优先使用 `bear_notes` MCP 完成 Bear 相关任务，不使用界面自动化、AppleScript 或直接读取 Bear 数据库，除非 MCP 缺少所需能力且用户同意采用替代方案。

## 工作方式

1. 若 `bear_notes` 工具尚未显示，先搜索或延迟加载对应 MCP 工具。
2. 从 `bear://x-callback-url/open-note?id=...` 中提取 `id`，并优先用 ID 定位笔记；没有 ID 时再用标题或搜索。
3. 阅读正文时使用 `get_note(includeContent=true)` 或 `read_note_content`；大笔记按 offset/limit 分段读取。
4. 正文中的 `![](filename.png)` 只代表附件引用。需要理解图片内容时，先用 `read_attachment` 读取该附件，再进行视觉检查；不要声称仅凭正文已经看过图片。
5. 写入前先读取最新内容或元数据。局部修改优先使用 `edit_note`、`append_to_note`、标签或 pin 专用工具；整篇覆盖仅在确有必要时使用，并传入最新 `baseHash`，保留未要求删除的附件引用。
6. 未经用户明确要求，只读取和分析，不修改笔记。

返回结果时说明操作对象和结果；创建或更新笔记后，附上可直接打开的完整 `bear://x-callback-url/open-note?id=<id>` 链接。
