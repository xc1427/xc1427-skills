# CLI 契约

入口 `bash <skill-dir>/scripts/yuque.sh`，用函数 `yq` 简写。`help` 是命令和可用参数的机器入口；命令采用 `对象 动作 [URL/ID]`，数据表使用 `table record/field/view 动作 DOC`。

## 输入输出

- 正文 `--body-file FILE`、画板 DSL `--dsl-file FILE`；对应 `--body`/`--dsl` 也接受带引号的文字。
- 结构化输入 `--input FILE`；行、单元格、字段值、选项分别 `--rows-file`、`--cells-file`、`--values-file`、`--options-file`。也可传 JSON 字符串 `--rows '[["a",1]]'`。文件 `-` 表示 stdin。
- 文档列表、库列表、搜索默认精简字段；`--raw` 保留完整结果。scope 使用 OWNER/BOOK 或团队 login，不是数字库 ID。
- 默认 JSON `{status,route,data,completed?}`。`--text` 输出正文或 Markdown 表格；`--output NEW_FILE` 为 0600 且拒绝覆盖，发请求前检查路径。
- 布尔用 `--flag` / `--no-flag`；未知、重复、缺值参数报错。数值参数需要整数。
- 对象接受公网 URL；库接受 `OWNER/BOOK` 或数字 ID；文档可用全局数字 ID，slug 需 `--book`。
- 同名对象拒绝猜测，错误携带候选 ID。错误不回显凭据、请求头和服务端原始错误正文。

## 主要命令

```bash
yq book list --all
yq book get OWNER/BOOK
yq doc list OWNER/BOOK --all
yq search '关键词' --scope OWNER/BOOK
yq search web '关键词' --input web-filters.json
yq doc create OWNER/BOOK --title '标题' --format lake --body-file body.lake
yq doc read DOC_URL --format lake --output original.json
yq doc inspect DOC_URL
yq doc update DOC_URL --format lake --body-file updated.lake --expected-sha256 HASH
yq doc append DOC_URL --format lake --body-file appendix.lake
yq doc patch DOC_URL --input edits.json
yq doc versions DOC_URL
yq doc version VERSION_ID
yq doc publish DOC_URL
yq doc copy DOC_URL --to OWNER/DEST
yq doc move DOC_URL --to OWNER/DEST
yq doc delete DOC_URL --yes
yq note list --all
yq note get NOTE_URL
yq note update NOTE_URL --body-file note.txt
yq note update NOTE_URL --input note-content.json --via web
yq attachment add DOC_URL --file ./report.pdf
yq comment create DOC_URL --body '评论内容'
```

`note-content.json` 为 `{source,html,abstract,status?}`，保留富内容时同时生成一致的三种表示；`--body-file` 为纯文本替换。小记 `--expected-sha256` 来自 `note get` 的 content 哈希。小记分页使用公网已验证的 offset（公开 spec 的 page 实测不推进）；`--page` 会换算为 offset。`--via web` 为兼容参数；所有操作都固定使用 Web。

`--all` 最多 100 页，重复页直接报错。没有明确 has_more 的接口保守返回下一页提示，完整读取会多读一个空页。小记链接解析找到即停，最多扫描 2000 项，超出需数字 ID。

## 批处理

输入为最多 100 项的数组，每项 `{id,command,target,options}`；options 用 camelCase 和原生 JSON 值，**不是 shell 参数串**。正文可以直接放 options.body；命令之间顺序执行，成功结果可引用。

```json
[
  {"id":"new","command":"doc create","target":"OWNER/BOOK","options":{"title":"任务记录","format":"lake","body":"<p>开始</p>"}},
  {"id":"append","command":"doc append","target":"$results.new.data.id","options":{"format":"lake","body":"<p>完成</p>"}},
  {"id":"inspect","command":"doc inspect","target":"$results.new.data.id"}
]
```

```bash
yq batch --input steps.json --output run.json
```

同一进程复用身份校验与解析缓存，写后清除可能过时的对象缓存。步骤可失败，不自动回滚或重跑；错误给出 `failedStep`、已完成结果、已接受写入。恢复时只提交尚未生效的步骤。不能把整个失败 batch 再跑一次。

## 状态含义

| 状态 | 含义 |
|---|---|
| read | 完成读取 |
| verified | 该命令指定的后置读取符合预期；不代表浏览器视觉或权限已验证 |
| submitted | 已接受；团队权限、原始 API 等仍需独立核验 |
| ready / downloaded | 导出就绪/已下载；格式检查不证明单元格正确 |
| completed | batch 完成；仍需看各步骤自己的状态 |
| failed | 尚无已接受写入，或请求被明确拒绝 |
| partial | 已接受过写入，后续步骤失败 |
| unknown | 写请求网络/非 JSON/服务故障，结果不确定 |

`RATE_LIMIT` 不自动重试。`SESSION_*` 重新显式导入；`ACCOUNT_MISMATCH` 核对 session 的绑定账号与实际账号；`CONFLICT` 重新读取并合并；`VERIFY_MISMATCH` 先查看远端，不重发。

一个进程只核验一次 Web 身份。当前账号知识库集合按归属过滤后由 CLI 本地分页；其他用户合并受邀库及公开主页书架，不能将该结果当成所有未展示公开库的索引；文档、小记、团队成员按接口 offset 分页，搜索使用 p。普通搜索默认为“与我相关”；`search web` 不附加该范围，需通过 `--scope`/`--input` 明确筛选。

## 文档与画板

`doc read` 默认原生格式，`--format markdown` 用 Web 导出，`doc export --type markdown --download NEW_FILE` 保存 Markdown。Markdown 写入先转换 Lake 再校验，读取时不要假定 format 仍为 markdown。HTML 正文更新走文档属性接口；Lake 保存使用 draft_version，发现未发布草稿即停止，避免覆盖协作修改。

`resource get --doc DOC` 列出画板；`resource update CARD_ID --doc DOC --input diagram.json` 精确替换一个卡片，保留其他内容。JSON 为 `{"diagramData":{"head":{"version":"2.0.0"},"body":[...]}}`，或 `{"value":完整卡片对象}`。`resource create --doc DOC --type flowchart --input diagram.json` 追加卡片；`--after` 可指定唯一完整 Lake 块 id。`--dsl-file` 仅接受原生 JSON，旧文本 DSL 不是此接口的输入格式。更新原生数据时清除旧 src 快照，页面重新生成前导出可能不含预览图。

## 低层请求

`api web PUT /api/... --input file.json` 固定公网同源；不能传任意主机、路径穿越或 `/api/v2/`。CLI 不读取 Open API Token，`api open` 和 `official` 已移除。遇到未覆盖的协议先查当前网页，不回退至 Open API。
