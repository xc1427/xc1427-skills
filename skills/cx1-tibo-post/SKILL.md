---
name: cx1-tibo-post
description: Read and summarize X posts by Tibo Sottiaux (@thsottiaux) from only today, yesterday, and the day before, filtered to substantive announcements. Use when a user asks what Tibo announced or posted in that three-day window, or asks to check @thsottiaux on X.
---

# cx1: Tibo Posts

默认将「Tibo」识别为 OpenAI 的 Tibo Sottiaux（[@thsottiaux](https://x.com/thsottiaux)）。用户明确给出其他 `@handle` 时按其指定；仅在歧义会改变结果时才询问。

固定查询窗口为用户所在时区的**今天、昨天和前天**。任何更早的历史帖子都不检索、不读取、不报告；用户要求更窄范围时，只从这三天中继续收窄。

## 获取路径

1. 直接使用已登录的 Chrome。默认认为没有可用的 X connector/API：不要为发现它做 tool search、connector 列表或网络探测。只有用户明确给出一个已启用的 X connector/API 时，才使用该路径。
2. 此工作流依赖 Chrome 的登录态。调用 `chrome:control-chrome` 后，按其文档选择 Chrome extension 会话；不要用 URL 自动选择或默认浏览器，以免落到未登录的 in-app Browser。完整遵循该 Skill 的初始化、认证和安全规则。
3. 若 Chrome 未登录、连接失败或 X 阻止访问，不要改用搜索引擎、第三方镜像或公开抓取路径来绕过；请用户在 Chrome 登录后重试。
4. Chrome Skill 的运行文件位于插件根目录，而不是 Skill 目录：

   ```text
   Skill:   <plugin-root>/skills/control-chrome/SKILL.md
   Runtime: <plugin-root>/scripts/browser-client.mjs
   ```

   从 `SKILL.md` 向上定位到 `<plugin-root>` 后再导入 runtime。绝不要拼成 `<plugin-root>/skills/control-chrome/scripts/browser-client.mjs`，也不要仅因这个错误路径不存在就报告插件损坏。
5. 打开 `https://x.com/thsottiaux` 的 **Posts** 时间线；只读取 Tibo 自己的原帖。

## 高效读取

1. 先在时间线一次性读取有限数量的最新 post 卡片，取得作者、可见日期、正文、状态链接及必要的配图线索。不要抓取整页正文、逐卡片机械读取，或为每个 post 都打开详情页。
2. 以用户所在时区的当前日期确定窗口。相对时间（如 `1h`）只用于定位，不能作为日期判断；遇到候选项再打开其状态详情页取得精确时间。时间线已按时间倒序时，读到第一个窗口外的**非置顶**原帖即可停止，不再继续翻历史。
3. 只为最终会报告的公告/预告打开详情页，以核对全文、精确时间和永久链接。没有正文的配图帖仅在图片可能改变其“实质信息”判定时做一次定向截图；没有必要就不要打开。
4. 指标或范围写在配图中时，先读取配图再总结。用“发帖称”或“图中称”表述该帖自身的主张；不得把合计指标改写为单产品指标，也不得从模糊数字推断统计口径。
5. 完成后关闭本次创建的查询页；若浏览器能力支持，按浏览器 Skill 的要求 finalize tabs。

## 筛选与判断

- 只筛选用户所在时区的今天、昨天和前天；不得扩展到更早的历史。不要用模糊的 `a day ago` 代替日期判断。
- 默认只报告 Tibo 自己的原帖中有实质信息的项目：产品发布、已生效的使用政策/重置、口径可读的里程碑，或明确的后续安排。
- 排除普通回复、玩笑、无新信息的转发，以及没有时间范围/统计口径的模糊数字或配图。若内容只是预告（例如“明天会有东西”），单列为「预告」，不得写成已发布。
- 一条原帖可同时包含多个相关事实，合并为同一条摘要。保留范围和限定条件：例如「Codex 与 ChatGPT Work 合计」不能改写成「Codex 单独」；“下一小时落地”应标为“已宣布、尚未确认生效”，不能写成已完成。

## 输出

先给结论，例如“过去三天有 1 条实质公告和 1 条预告”。保持简短。每条包含：

- 日期/时间（明确标为“今天”“昨天”或“前天”）
- 一句准确摘要与状态：已宣布 / 已生效 / 预告；未确认落地时明确写“已宣布，尚未确认生效”
- 原始 X 链接

没有符合条件的原帖时，直接说明这一点。需要时补一句：已排除的回复或预告为何不算正式公告。

## 例子

```text
查 Tibo 今天、昨天和前天都发了什么，只要正式公告。
Use $cx1-tibo-post to see what Tibo announced in the past three calendar days on X.
```
