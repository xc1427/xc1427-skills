# 目录与跨库

库内操作直接 Open API。跨库复制/迁移/批量用 Web API，并共享同一 Web 上下文解析与回验。`toc list/tree BOOK` 返回 UUID；文档 ID 不能替代节点 UUID。

```bash
yq toc list OWNER/BOOK
yq toc tree OWNER/BOOK
yq toc add OWNER/BOOK --title '项目'
yq toc add OWNER/BOOK --title '相关链接' --url https://example.com --target PARENT_UUID
yq toc edit OWNER/BOOK --node UUID --title '新名称' --visible 1
yq toc attach OWNER/BOOK --doc DOC_ID --target PARENT_UUID
yq toc move OWNER/BOOK --node UUID --target TARGET_UUID --position moveBefore
yq toc copy OWNER/BOOK --node UUID --to OWNER/DEST
yq toc transfer OWNER/BOOK --node UUID --to OWNER/DEST --target TARGET_UUID --position appendChild
yq toc remove OWNER/BOOK --node UUID --with-children
```

- `appendChild/prependChild` 挂在目标节点下；`moveBefore/moveAfter` 插入目标同级前后。同级位置必须给目标 UUID。
- `toc copy/transfer` 默认包括子树，`--no-with-children` 只处理该节点。文档级 `doc copy/move` 只处理目标文档，不连带目录子树；没有唯一目录节点时先挂载或明确用 toc 命令。
- `toc remove` 仅移出目录，不删除文档；`doc delete --yes` 删除文档到产品可恢复区域。
- 目录挂载/库内移动核对父节点和相邻位置；跨库移动核对两侧 UUID，复制核对新节点数，文档复制另核对正文。跨库复制的附件权限/引用不因此得到独立迁移证明。
- 返回的新文档 URL 可能为稳定的 `/go/doc/ID`；移动后旧 namespace URL 可能失效，应使用新结果。

## 批量

`toc batch BOOK --input batch.json` 是一次 Web 请求，不是循环客户端命令。文件示例：

```json
{
  "batch_action":"batchCopy",
  "node_uuids":["SOURCE_UUID_A","SOURCE_UUID_B"],
  "target_book_id":123456,
  "transfer_action":"appendChild",
  "insert_to_catalog":true
}
```

动作 `batchRemove/batchDestroy/batchMove/batchCopy`。`batchDestroy` 需 `--yes`，表示文档回收站删除；不会清空回收站。支持同库及跨库批量迁移；有同级位置时需要 target_uuid。批量核对成员、数量、根节点位置与顺序，不宣称已核对每篇文档正文；复杂子树仍需回读完整树。

HTTP 200 不够。若部分结果与回读不一致，查看 completed/UUID，再查询两侧目录；禁止直接重发复制或批量移动。

库内目录命令默认 Open API；限流或需要对照网页协议时可显式 `--via web`。`toc destroy --node UUID --with-children --yes` 是 Web 删除到回收站语义；不要与 remove 混淆。visible:0 在公网历史实测未生效，本工具会报告回读不符，不将其宣称为已支持隐藏/权限操作。
