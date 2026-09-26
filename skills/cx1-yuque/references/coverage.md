# Web API 能力覆盖与验证

核对日期：2026-09-26。运行时统一使用公网 Web session，身份、解析、正文、元数据和回读都不调用 Open API；`/api/v2/`、Token 认证和官方 CLI 兜底均已移除。下表区分适配与线上验证，不表示所有账号、权限和参数组合均已通过。

| 能力 | 命令 | Web 实现与验证范围 |
|---|---|---|
| 当前账号、探测 | auth status、user me、ping | `/api/mine`，账号绑定校验已实测 |
| 用户团队、书架、最近访问 | user groups/books/recent | Web 原生集合；团队及书架本轮读取 |
| 用户/团队库列表 | book list | 当前账号接口忽略 user_id/offset，按归属过滤后本地分页；其他用户合并受邀库与公开主页书架；本人、团队及协作用户均实测 |
| 库详情与修改 | book get/update | 网页初始化数据解析、PUT books；测试库属性修改后恢复 |
| 库创建/删除 | book create/delete | 当前网页 books 协议适配；本轮未创建/删除知识库 |
| 文档列表、读取、解析 | doc list/read/inspect、resolve | docs 与已认证页面/短链接，Lake/HTML/Markdown 原生路径已实测 |
| 创建/替换/精确编辑/追加 | doc create/update/patch/append | Lake 保存草稿后发布，HTML 属性保存，Markdown 先转换 Lake；本轮创建/更新/回读 |
| 删除、版本、发布 | doc delete/versions/version/publish | docs 与 doc_versions；版本读取、发布和测试副本删除已验证 |
| Markdown 导出 | doc read --format markdown、doc export | export 获取本站 Markdown 地址，限定路径及响应类型后下载 |
| 其他文档导出 | doc export --type lake/pdf/word | 原生 export 协议；本轮未穷举导出格式及下载地址 |
| 目录增改移除/挂载 | toc add/edit/move/remove/destroy/attach | catalog_nodes 与 docs/add_to_catalog；既有 Web 实测，本轮挂载/复制/迁移回读 |
| 跨库与批量目录 | doc copy/move、toc copy/transfer/batch | Web 原生复制迁移；核对目标内容、节点位置及源移除 |
| 搜索 | search、search web | zsearch；普通命令默认 related，scope 保持 owner/book，p 分页；本轮两页共 40 项 |
| 小记 | note list/get/create/update/tags/tag-stats | NoteController；创建响应在顶层，不能假定 data 包装；本轮创建、更新、回读 |
| 附件 | attachment upload/add | Web 上传、Lake 卡片追加、同会话保存发布与回读 |
| 评论、收藏 | comment create/list、mark list/tags | 原 Web 实现保留；2026-09-24 已验证，本轮未重复发送评论 |
| Sheet | sheet create/read/inspect/set/write/append/export | 原生 lakesheet 解包；既有 Web 创建与导出验证，本轮读写后恢复、Excel 下载 |
| 数据表记录及内容 | table read/records/record/content | 原生 TableRecord/Value/Content；既有全流程验证，本轮临时记录增改删 |
| 数据表字段/视图 | table schema/field/view | 原 Web 协议；2026-09-24 验证字段及 GRID/KANBAN/CARD/CALENDAR，未穷举高级配置 |
| 画板资源 | resource get/create/update | 精确编辑 Lake board 的 diagramData；本轮创建/更新、回读与 Chrome 渲染 |
| 团队成员 | group members/member-set/member-remove | users、group_users；本轮成员读取，未改变真实成员权限/发送邀请 |
| 团队统计 | stats group/members/books/docs | 当前网页 groupStatistics 接口适配；现有团队样本返回 404，未获得线上成功证据 |

## 数据与行为差异

- 其他用户库列表的公开部分来自其主页书架；主页未展示的公开库不能据此断言不存在。已知 URL 可直接读取。`complete` 表示这些已读取来源的分页结束。
- 文档读取默认原生格式。Markdown 写入转换为 Lake；HTML 表示可能尚未由服务端生成，缺失时报 FORMAT，不能把空字符串当成成功的转换。
- 小记纯文本替换生成一致的 source/html/abstract；富格式使用原生输入，保留未知结构。
- 画板原生 JSON 与旧资源服务文本 DSL 的语法不同。`--dsl-file` 接受 diagramData JSON；完整 value 可保留主题、viewport 等。src 为快照，更新图形后清除过时快照。旧 DSL 没有静默透传到猜测的端点。
- HTML 文件导入与 HTML 正文写入不同；原技能的内网文件导入能力不在此公网 CLI 范围。
- 目录 UUID、文档 ID、子表/记录/字段/视图 ID 不可混用。目录 visible:0 的历史样本不生效，本工具报告回读不符，不将其视为权限功能。
- 接口存在与账号获准调用是两回事。Web 也可能返回 429；明确停止，不自动重试写入、不回退 Open API。

## 验证标准

自动化测试覆盖会话账号、同源凭据限制、禁用 Open 通道、正确搜索分页、全量库列表分页、未发布草稿保护、并发冲突、部分成功/未知状态、Markdown 转换、HTML 保存、画板邻近内容保留、Sheet 保真与目录顺序。测试通过不替代线上权限和界面验证。

网络实测仅在已有测试知识库/文档中写入。接口依据来自当前语雀网页实际下发的 API 包装及既有实测；知识库创建/删除、真实成员权限和统计成功响应仍属于未测边界。不要为“完整覆盖”盲目修改真实成员或分享范围。
