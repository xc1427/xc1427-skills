# 能力覆盖与证据边界

核对日期：2026-09-24。基线为原 OpenAuth 49 个命令及其 Lake/架构图/蓝图参考；其中 48 个有业务命令或等价工作流，HTML 文件导入为公网明确不支持。**这是能力映射，不是 48 个命令的所有参数组合均已线上验证。**

新实现直接调用 Open/Web API。官方 CLI 仅由显式 `official` 分支启动，查询 registry 最新版并在项目局部安装；本轮 latest 为 1.1.0。GitHub main 的 notes/resources 契约可能先于 npm 发布，不能用 npm 版本缺命令推断 API 不存在。

## 原技能映射

| 原命令 | 本 CLI | 通道 | 证据或限制 |
|---|---|---|---|
| `comment.create` | `comment create` | Web | 本轮回读和网页 |
| `comment.list` | `comment list` | Web | 本轮回读 |
| `doc.create` | `doc create` | Open | 本轮 Lake 创建与目录挂载；Markdown 基于既有实测 |
| `doc.delete` | `doc delete --yes` | Open | 已实现；本轮未重测删除 |
| `doc.get` | `doc read/inspect` | Open | 本轮读取 |
| `doc.importHtml` | `不提供伪替代` | 不支持 | 公网已知限制，仅内网支持 |
| `doc.list` | `doc list` | Open | 公开契约；分页单测 |
| `doc.markdown` | `doc read --text` | Open | 本轮读取路径 |
| `doc.publish` | `doc publish` | Web | 本轮回读 |
| `doc.update` | `doc update/append/patch` | Open | 追加本轮实测；patch 冲突与唯一匹配单测 |
| `doc.upload` | `attachment upload/add` | Web + Open | 上传嵌入、回读、Chrome 卡片 |
| `doc.versions` | `doc versions/version` | Open | 公开契约，最近100个发布版本 |
| `mark.list` | `mark list` | Web | 本轮读取 |
| `mark.tags` | `mark tags` | Web | 本轮读取 |
| `note.get` | `note get` | Open / Web | Open 数字ID读取、本轮Web URL解析 |
| `note.list` | `note list` | Open / Web | 两通道读取；offset实测 |
| `note.tagStats` | `note tag-stats` | Web | 本轮读取 |
| `note.tags` | `note tags` | Web | 本轮读取 |
| `note.update` | `note update` | Open / Web | 本轮Web写回；Open有契约，本轮未写 |
| `repo.create` | `book create` | Open | 已实现；本轮不新增用户库 |
| `repo.detail` | `book get` | Open | 本轮读取；Web工作流从库页面解析 |
| `repo.update` | `book update` | Open | 已实现；本轮不改用户库属性 |
| `search.query` | `search / search web` | Open / Web | 两通道读取；团队/用户类别走Web |
| `sheet.create` | `sheet create` | Web | 本轮创建、保存发布、回读 |
| `sheet.export` | `sheet export` | Web | 本轮xlsx下载且核对B2/AA3/A4 |
| `sheet.read` | `sheet read/inspect` | Open / Web | 两通道读取 |
| `sheet.write` | `sheet set/write/append` | Web | 本轮多字母列与追加；保留非目标结构单测 |
| `table.bulkUpdate` | `table record bulk/set` | Web | 本轮批量改单元格回读 |
| `table.create` | `table record add` | Web | 指创建记录，不是创建整张数据表；本轮回读 |
| `table.getContent` | `table content get` | Web | 本轮回读 |
| `table.putContent` | `table content set` | Web | 本轮写入、回读、Chrome |
| `table.remove` | `table record remove --yes` | Web | 本轮删除临时记录 |
| `table.show` | `table records/read` | Web / Open | 本轮读取 |
| `tableField.create` | `table field add` | Web | 本轮text/select；其余类型配置需网页样本 |
| `tableField.remove` | `table field remove --yes` | Web | 本轮删除临时字段 |
| `tableField.update` | `table field set` | Web | 本轮重命名与保留选项 |
| `tableView.create` | `table view add` | Web | 本轮GRID/KANBAN/GALLERY/CALENDAR创建；看板、画册、日历均Chrome验证 |
| `tableView.remove` | `table view remove --yes` | Web | 本轮删除临时视图 |
| `tableView.update` | `table view set` | Web | 本轮改名和保留配置 |
| `toc.batch` | `toc batch` | Web | 本轮跨库copy/move与同库move；remove/destroy继承已验证协议 |
| `toc.list` | `toc list` | Open / Web | 两通道读取 |
| `toc.moveCross` | `toc transfer/copy, doc move/copy` | Web | 本轮两库间复制与往返移动 |
| `toc.tree` | `toc tree` | Open / Web | 树由读取的parent_uuid构建 |
| `toc.update` | `toc add/edit/move/remove/destroy/attach` | Open / Web | 本轮Web四位置与属性更新、Open挂载；visible:0历史不生效，明确报告失败 |
| `user.books` | `user books / book list` | Web / Open | 本轮Web书架读取 |
| `user.groups` | `user groups` | Open | 公开契约；受团队权限约束 |
| `user.me` | `user me / auth status` | Open | 本轮身份验证 |
| `user.recent` | `user recent` | Web | 本轮读取 |
| `util.parseUrl` | `url parse / resolve` | 本地 / Open | URL解析单测、实际文档解析 |

## 原目录枚举逐项映射

- insert → toc add；edit → toc edit。
- prependChild/appendChild/moveBefore/moveAfter → toc move --position。
- remove/removeWithChildren → toc remove 加可选 --with-children。
- destroy/destroyWithChildren → toc destroy --yes 加可选 --with-children。
- appendByDocs/prependByDocs/insertSiblingByDocs → toc attach 的 appendChild/prependChild/moveAfter；Web 使用实际有效的 add_to_catalog，不照抄会假成功的旧接口。
- 批量四动作 batchRemove/batchDestroy/batchMove/batchCopy 均有独立语义和回读；批量回读核对成员/数量/根节点位置与顺序，复杂子树还需额外查看目录树。
- visible:0 是已有公网反例，不能宣传成隐藏或权限能力。完整文档类型矩阵、复杂子树删除及所有排序组合未全部实测。

## 官方 Open API 范围

| 能力 | 自有命令 | 当前验证范围 |
|---|---|---|
| hello、当前账号、用户团队 | ping、auth status、user me/groups | 账号实测；团队受权限约束 |
| 用户/团队库列表与 CRUD | book list/get/create/update/delete | 读取实测；写入适配公开契约，本轮未改真实库属性 |
| 文档 CRUD、版本、目录 | doc 与 toc 系列 | 本轮创建/追加/目录挂载实测，异常与冲突单测 |
| 搜索 | search | 实测；scope 为 OWNER/BOOK 或团队 login |
| 团队成员列表/角色/移除 | group members/member-set/member-remove | 契约适配，未对真实团队变更权限，写入标记 submitted |
| 团队/成员/库/文档统计 | stats group/members/books/docs | 契约适配，未声称当前账号可读取全部统计 |
| 小记列表/详情/创建/更新 | note list/get/create/update | Open读取；Web更新+回读；Open新写接口未完整实测 |
| 结构化资源画板 | resource get/create/update | 官方main契约适配；返回submitted，需读回+渲染验证 |

公开契约来源：[官方仓库](https://github.com/yuque/yuque-open-cli)、[OpenAPI spec](https://github.com/yuque/yuque-open-cli/blob/main/spec/yuque-openapi.yaml)。运行时以权限、当前服务响应及独立验证为准。

## 富格式与工作流

分栏、callout、codeblock、附件卡片已在本轮创建、精确回读并用 Chrome 验证。公网画册实际 type 为 CARD，已映射 GALLERY；日历配置绑定日期字段并显示日期网格（未穷举日期值格式）。原 Lake 书写/卡片参考和架构图/蓝图设计参考已迁移，按需加载；旧样本不是所有卡片的永久稳定规范。HTML 正文写入、资源新接口使用 submitted，不能假装已有全文等价或渲染证明。

自动化测试覆盖同源凭据约束、错误账号、无写重试、服务故障未知状态、输入校验、分页推进/停滞、并发冲突、唯一片段、目录邻接、Sheet保真与批处理。单测不替代线上权限或复杂UI证明。

## 效率选择

- 普通常规命令一个 Node 进程直达 API，无 OpenAuth/官方CLI二次启动。
- 全Web工作流用同一session解析与核验，不消耗Open额度来取得内部ID。URL比裸数字ID少一次短链接解析。
- 混合写入核对Token与Web账号；纯Web只核验正在使用的Web身份。
- batch共用校验/缓存，字段选项与记录ID自动解析；响应提供紧凑结果和恢复所需ID。
- 本轮触发过Open API 429：明确返回RATE_LIMIT，未自动重放写入。官方CLI共用同一Open API额度，不能作为限流绕过手段。
