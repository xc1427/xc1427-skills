---
name: cx1-yuque
description: 用统一自有 CLI 操作公网语雀 yuque.com 的文档、知识库、目录、小记、附件、Sheet 和数据表；直接 Open API 优先，Web API 补足并封装完整工作流，无法完成时以局部安装的最新版 yuque-open-cli 兜底。用户要求读取、搜索、创建、编辑或整理语雀内容时使用。
---

# 公网语雀

使用本技能自己的 CLI：`bash <skill-dir>/scripts/yuque.sh`，下文简写 `yq`。Node.js 22+，主路径无 npm 依赖；不调用官方 CLI。先执行 `help` 查看准确命令与参数，不要套用旧 OpenAuth 或官方 CLI 的语法。

```bash
yq() { bash /path/to/cx1-yuque/scripts/yuque.sh "$@"; }
yq auth status
yq doc read https://www.yuque.com/OWNER/BOOK/DOC --format lake --output original.json
yq doc patch https://www.yuque.com/OWNER/BOOK/DOC --input edits.json
```

Token 使用 `YUQUE_TOKEN` 或 `YUQUE_PERSONAL_TOKEN`（前者优先）。不自动加载 shell 配置，不打印凭据。需要 Web 时按 [session.md](references/session.md) 显式从 Chrome 导入会话，核验绑定账号；失效后明确停止。无后台保活、静默登录或自动换凭据。

## 按完整任务选择命令

- 常规文档、知识库、库内目录、小记、搜索、团队、统计和资源画板：直接 Open API。
- 跨库复制/移动、附件上传、评论、Sheet 写入/导出、数据表记录/字段/视图：Web API 补充。完整 Web 工作流用同一会话解析 URL、读取和回验，避免为前置解析消耗 Open API 额度。
- 附件 `attachment add DOC --file FILE` 完成上传、生成 Lake 卡片、保留原文追加、Open API 保存与回读。多个任务用 `batch --input steps.json`，共享进程、会话校验和对象缓存。
- 通道优先级服从效率与正确性。小记和 Sheet 读取可显式 `--via web`；小记更新也可选择 Web。搜索需要网页范围/筛选时用 `search web`。不对结果未知的写请求自动切换通道重放。
- 无封装接口但有确切协议时，使用 `api open/web METHOD /api/... --input FILE`。通用请求返回 `submitted`，不能替代业务封装或后置验证。

按任务读取：[命令与批处理](references/cli.md)、[目录](references/catalog.md)、[Sheet/数据表](references/tables.md)、[富格式和附件](references/lake.md)、[精确编辑](references/incremental-update.md)。完整原能力映射见 [coverage.md](references/coverage.md)。

## 保真与核验

1. 接受 URL、全局文档 ID，或 slug 加 `--book`。区分文档 ID、目录 UUID、Sheet 索引、数据表字段/记录/视图 ID。同名字段/子表不猜测，使用唯一 ID；多视图写入显式选 `--view`。
2. 已有文档保留 Lake 与未知卡片。优先 `doc patch` 精确片段或读取后最小编辑；`doc update` 是完整替换。保存前做版本回读，必要时传 `--expected-sha256`。检查并非服务端原子锁；有协作编辑时避免并发写入。
3. 读取 `status`：`verified` 表示命令指定的回读条件成立；`submitted` 只表示接受；`partial`/`unknown` 保留已完成步骤与待确认操作，先查远端再决定恢复。写入不自动重试；只读后置核验最多四次。批处理遇错停止，没有事务回滚。
4. 高级格式必须创建/更新 → API 回读 → Chrome 实际渲染检查。卡片显示不等于附件可下载；按用户目标检查预览/下载。原图、原卡片、无关内容不能被 Markdown 转换破坏。
5. 授权沿用用户请求。删除参数 `--yes` 是 CLI 防误触，不替代也不增加人工审批。除非另有明确授权，不改变可见范围、成员权限或清空回收站。新建文档默认私有。
6. 交付说明实测与未测边界；创建/更新语雀文档后给出完整 URL。

## 失败时的官方兜底

本工具无法完成操作时，**必须检查并尝试最新版官方 `yuque-open-cli` 的对应能力**。先确认失败写入是否已生效，再执行帮助与合适的命令；不盲目重放。

```bash
# --dir 只指向当前任务内的专用工具目录；绝不 npm install -g。
yq official --dir .yuque-tools/official-cli -- --help
yq official --dir .yuque-tools/official-cli -- doc --help
```

每次显式调用查询 npm registry 的 latest，仅在该局部目录安装所需固定版本后运行，并报告版本/目录。官方命令输出保持原样，不宣称已被本工具验证。官方 CLI 同样可能受 Open API 权限和限流约束；无对应能力时用 Chrome 观察真实操作，再补充已验证协议或报告产品限制。

## 已知边界

- **HTML 文件导入仅内网支持，公网不支持。** HTML/Lake 正文写入与 HTML 文件导入不是同一功能。
- Web API 是非公开接口，响应结构变化即停止；不要靠连续试写猜参数。
- 协作库文档列表为空不能推出无权限。搜索优先已知库的 scope，结合已知 URL、目录、单篇读取，必要时比较 `search web`。不承诺搜索全站所有公开内容。
- 官方新接口有公开契约不代表当前账号能用。团队权限写入、统计与新版资源接口按实际权限与读回结果报告，不能用覆盖清单冒充逐项线上实测。
