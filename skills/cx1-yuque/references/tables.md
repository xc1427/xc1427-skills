# Sheet 与数据表

Sheet 是 `lakesheet`，数据表是 `laketable`，两者不共用内容格式。读取和写入均使用 Web session。Sheet 从原生压缩正文解包；数据表读取 schema 和 records，保留字段/记录 UUID。`table read` 在读取记录后按 page/page-size 本地分页，返回 total 和 complete。

## Sheet

```bash
yq sheet create OWNER/BOOK --title '追踪表' --rows-file rows.json
yq sheet read DOC_URL --text
yq sheet read DOC_URL --via web --text
yq sheet inspect DOC_URL --output raw.json
yq sheet set DOC_URL --cells-file cells.json --expected-sha256 HASH
yq sheet write DOC_URL --body-file table.md
yq sheet append DOC_URL --rows-file new-rows.json
yq sheet export DOC_URL --type excel --download result.xlsx
```

rows.json 是二维标量数组，例如 `[["任务","状态"],["验证","完成"]]`。cells.json 如 `{"B2":"已完成","AA3":42,"C4":null}`。`null` 清空值，保留样式；`write` 从 A1 开始逐格覆盖输入范围，不删除范围外内容；`append` 在最后有值行之后追加。

多子表需要 `--sheet 名称/索引`，重复名称报错。Markdown 表格支持转义竖线/代码中的竖线，保持字符串，不猜测数字。目标含公式或不理解的单元格元数据时拒绝覆盖；不提供公式计算器。其他单元格、样式、备注和未知结构原样保留。

正文为 zlib + latin1 的特殊编码，工具处理 pack/unpack。写前读取 draft_version 与内容，保存再发布，回读整个解压结构；不绕过版本检查，不自动 force publish。客户端检查不能充当原子锁。

Excel 导出轮询最多 30 次。下载仅携带凭据访问本站附件，再向已验证的 OSS 临时域跳转且移除凭据；未知域停止。检查 ZIP 签名不等于核验单元格内容。

## 数据表

```bash
yq table read DOC_URL --page 1 --page-size 100
yq table schema DOC_URL
yq table records DOC_URL
yq table record add DOC_URL --view '表格视图' --values-file values.json
yq table record set DOC_URL --view VIEW_ID --record RECORD_UUID --values-file values.json
yq table record bulk DOC_URL --view VIEW_ID --input updates.json
yq table content get DOC_URL --record RECORD_UUID
yq table content set DOC_URL --record RECORD_UUID --body-file body.lake
yq table record remove DOC_URL --view VIEW_ID --record RECORD_UUID --yes
yq table field add DOC_URL --view VIEW_ID --name '状态' --type select --options '["开始","完成"]'
yq table field set DOC_URL --view VIEW_ID --field FIELD_ID --name '新名称'
yq table field remove DOC_URL --view VIEW_ID --field FIELD_ID --yes
yq table view add DOC_URL --view VIEW_ID --name '看板' --type KANBAN --group-by '状态'
yq table view add DOC_URL --view VIEW_ID --name '日历' --type CALENDAR --date-field '日期'
yq table view set DOC_URL --view VIEW_ID --name '新视图名'
yq table view remove DOC_URL --view VIEW_ID --yes
```

- 自动解析 sheetId；多个子表需要 `--sheet`。读取结构/记录不要求选视图；写入选择唯一/活动视图，仍有歧义则给 `--view`。
- values.json 为 `{"字段名":"值","FIELD_ID":{"value":"结构化值"}}`。单选/多选可用已有选项名；不会隐式新建选项。记录 UUID 来自 `table records`。
- updates.json 为 `{"records":[{"record":"UUID","values":{"字段":"值"}}]}`。先验证所有记录/字段，执行一次 bulkUpdate，逐值回读。
- 字段 `--input` 可提供 config/options；更新在原字段上合并，保留未知属性，ID 不可改。服务器补全的默认属性不算验证失败。支持原技能声称的 text/select/multiSelect/date/number/checkbox/member/link/attachment/formula/createdAt/updatedAt/creator/modifier 等类型协议；复杂配置必须先取网页原生样本，不能把枚举或 HTTP 成功当作所有类型均已渲染实测。
- 视图 GRID/KANBAN/GALLERY/CALENDAR。公网画册实际协议为 CARD，CLI 自动将 GALLERY 映射为 CARD，也接受原生 CARD。创建用实际记录 ID 建行列表；KANBAN 绑定已有 select 字段。CALENDAR 需要唯一 date 字段，或显式 --date-field；可用 --end-field/--title-field 指定结束日期和标题。`--input` 补充画册封面、筛选/排序等原生配置，嵌套对象合并、数组整体替换，保留其他字段。不能移除唯一视图。
- 内容 content 是对象，不是 JSON 字符串。`table content set --input FILE` 接受 `{format:"lake",source,html,abstract?}`。
- 行/字段/视图写入回读；不能证明复杂计算、协作并发或所有视图的视觉结果。新字段类型和布局用 Chrome 验证，实际支持清单见 coverage.md。
