---
name: cx1-yuque
description: 用统一自有 CLI 操作公网语雀 yuque.com 的文档、知识库、目录、小记、附件、Sheet 和数据表；全部通过绑定账号的 Web API 会话完成，并做写前检查和写后回读。用户要求读取、搜索、创建、编辑或整理语雀内容时使用。
---

# 公网语雀

使用本技能自己的 CLI：`bash <skill-dir>/scripts/yuque.sh`，下文简写 `yq`。Node.js 22+，无 npm 依赖；不调用官方 CLI。先执行 `help` 查看准确命令与参数，不要套用旧 OpenAuth 或官方 CLI 的语法。

```bash
yq() { bash /path/to/cx1-yuque/scripts/yuque.sh "$@"; }
yq auth status
yq doc read https://www.yuque.com/OWNER/BOOK/DOC --format lake --output original.json
yq doc patch https://www.yuque.com/OWNER/BOOK/DOC --input edits.json
```

所有远端操作使用同一个 Web session，包括身份检查、URL 解析、读取、写入和回读。按 [session.md](references/session.md) 从 Chrome 显式导入并核验账号。CLI 不读取 `YUQUE_TOKEN`/`YUQUE_PERSONAL_TOKEN`，拒绝 `/api/v2/`，没有 Open API 或官方 CLI 降级分支。会话失效后停止，不后台保活、静默登录或自动换凭据。

## 按完整任务选择命令

- 文档、知识库、目录、小记、搜索、团队和统计均走 Web API。普通 `search` 默认“与我相关”，包含协作库和已加入团队；`--scope OWNER/BOOK` 限定范围，`--page` 映射网页的 `p`。`search web` 用于全站发现或原生筛选。
- 跨库复制/移动、附件、Sheet、数据表沿用同一个 Web 会话。`attachment add DOC --file FILE` 完成上传、生成 Lake 卡片、保留原文追加、保存发布与回读。
- 文档读取默认返回原生格式。`--format markdown` 通过网页导出读取；创建/替换 Markdown 会先转换为 Lake，再精确核验。HTML 原文可创建/更新；Lake 的 HTML 表示仅在服务端已生成时可读，缺失则明确报错。
- `resource get/create/update --doc DOC` 操作文档中的原生画板卡片。通过 `--input` 提供 `diagramData` 或完整 `value`，也可用 `--dsl-file` 输入原生 JSON。目标为卡片 id（或唯一 src），不接受旧资源服务的文本 DSL。模板见 Lake/架构图/蓝图参考。
- 多个任务用 `batch --input steps.json`，共享进程、会话校验和缓存。已有 `--via web` 参数保持兼容，其他通道被拒绝。
- 未封装但已确认协议的操作用 `api web METHOD /api/... --input FILE`。原始写入只返回 `submitted`，仍需回读与必要的 Chrome 验证。

按任务读取：[命令与批处理](references/cli.md)、[目录](references/catalog.md)、[Sheet/数据表](references/tables.md)、[富格式和附件](references/lake.md)、[精确编辑](references/incremental-update.md)。完整原能力映射见 [coverage.md](references/coverage.md)。

## 保真与核验

1. 接受 URL、全局文档 ID，或 slug 加 `--book`。区分文档 ID、目录 UUID、Sheet 索引、数据表字段/记录/视图 ID。同名字段/子表不猜测，使用唯一 ID；多视图写入显式选 `--view`。
2. 已有文档保留 Lake 与未知卡片。优先 `doc patch` 精确片段或读取后最小编辑；`doc update` 是完整替换。保存前做版本回读，必要时传 `--expected-sha256`。检查并非服务端原子锁；有协作编辑时避免并发写入。
3. 读取 `status`：`verified` 表示命令指定的回读条件成立；`submitted` 只表示接受；`partial`/`unknown` 保留已完成步骤与待确认操作，先查远端再决定恢复。写入不自动重试；只读后置核验最多四次。批处理遇错停止，没有事务回滚。
4. 高级格式必须创建/更新 → API 回读 → Chrome 实际渲染检查。卡片显示不等于附件可下载；按用户目标检查预览/下载。原图、原卡片、无关内容不能被 Markdown 转换破坏。
5. 授权沿用用户请求。删除参数 `--yes` 是 CLI 防误触，不替代也不增加人工审批。除非另有明确授权，不改变可见范围、成员权限或清空回收站。新建文档默认私有。
6. 交付说明实测与未测边界；创建/更新语雀文档后给出完整 URL。

## 接口变化与失败处理

Web 接口变化时，先在 Chrome 观察对应操作及当前网页请求，修正适配器后验证。不恢复 Open API，不安装官方 CLI 兜底，也不对结果未知的写入自动切换实现重放。Web API 也可能限流；收到 429 明确停止，不能承诺永不限流。

## 已知边界

- **HTML 文件导入仅内网支持，公网不支持。** HTML/Lake 正文写入与 HTML 文件导入不是同一功能。
- Web API 是非公开接口，响应结构变化即停止；不要靠连续试写猜参数。
- 协作库文档列表为空不能推出无权限。搜索优先已知库的 scope，结合已知 URL、目录、单篇读取，必要时比较 `search web`。不承诺搜索全站所有公开内容。
- 网页代码中存在接口不代表当前账号能用。团队权限写入与统计按实际权限和响应报告，不能用适配清单冒充逐项线上实测。
