# 精确编辑既有文档

先 `doc read DOC_URL --format lake --output original.json`；正文在 `data.body`，版本哈希在 `data.sha256`。这是 Open API 的 Lake，不是 Markdown 转换结果。

最小片段修改：

```json
{"edits":[{"find":"<span data-lake-id=\"u1\">旧文</span>","replace":"<span data-lake-id=\"u1\">新文</span>"}]}
```

```bash
yq doc patch DOC_URL --input edits.json --expected-sha256 HASH
```

每个 find 必须恰好出现一次，按序替换；0 次/多次在提交前失败。这不是 HTML DOM patch，不能用不完整或跨层级的片段修改嵌套结构。保留原 ID、编码、空白及无关节点；新增节点用新的唯一 ID。

复杂结构编辑把完整更新后的 Lake 写入 UTF-8 文件，再执行：

```bash
yq doc update DOC_URL --format lake --body-file updated.lake --expected-sha256 HASH
```

Open API 接收 `format:"lake",body:正文`，不能照搬内网的 body_asl 参数。`doc update` 是全量替换；CLI 会在写前再次读取并比较原文/updated_at，但检查与写入之间仍有竞态窗口。协作正在编辑时应先协调。

卡片先识别原编码是否含 `data:` 前缀，解码后只修改目标字段，再按原约定编码。未知卡片保持不动。追加普通 Lake 块用 `doc append --format lake --body-file FILE`。不要用 Markdown 回读结果覆盖已有分栏、附件、表格或画板。
