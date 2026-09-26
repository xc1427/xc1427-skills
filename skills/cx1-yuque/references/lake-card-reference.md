# 卡片类型完整参考

> 从原 OpenAuth 技能移植的结构与设计参考，不是公网 API 的完整稳定规范。提交使用 `doc create/update --format lake --body-file FILE`；CLI 将正文映射到 Web API 的 `body_asl` 并发布核验。保留已有卡片编码与未知字段。新卡片须在 Chrome 验证渲染；API 回读相同只证明存储。

本文档列出所有 Lake 卡片类型的 value 字段定义，供书写时查阅。字段名均为 Lake 序列化格式中实际使用的名称（可能与内部 TypeScript 类型不同）。

## 通用字段

以下字段可出现在任意卡片的 value 中：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 卡片唯一 ID（必需） |
| `margin` | bool / object | 间距。`true` = 上下都有，`{"top": true}` = 仅上方，`{"bottom": true}` = 仅下方 |
| `height` | number | 自定义高度 |
| `widthMode` | string | `"normal"` 或 `"contain"` |

---

## 块级卡片（type="block"）

### codeblock — 代码块

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `mode` | string | 否 | 语言标识，默认 `"plain"`。常用：`javascript`、`typescript`、`python`、`java`、`go`、`rust`、`sql`、`json`、`html`、`css`、`shell`、`markdown`、`c`、`cpp` |
| `code` | string | 否 | 代码内容，换行用 `\n` |
| `autoWrap` | bool | 否 | 自动换行 |
| `lineNumbers` | bool | 否 | 显示行号，默认 `true` |
| `theme` | string | 否 | 主题，默认 `"github"` |
| `name` | string | 否 | 代码块标题 |
| `tabSize` | number | 否 | Tab 宽度 |
| `indentWithTab` | bool | 否 | 是否使用 Tab 缩进 |
| `lightLines` | number[] | 否 | 高亮行号列表 |
| `foldLines` | number[] | 否 | 折叠行号列表 |
| `collapsed` | bool | 否 | 是否折叠 |
| `hideToolbar` | bool | 否 | 是否隐藏工具栏 |
| `heightLimit` | bool | 否 | 高度限制（已废弃） |

### hr — 分隔线

无数据字段，`value="null"`。

### diagram — 图表

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 图表类型：`"mermaid"`、`"puml"`、`"flowchart"`、`"graphviz"` |
| `code` | string | 是 | 图表源代码 |
| `url` | string | 否 | 渲染后的 SVG URL |
| `collapse` | bool | 否 | 是否折叠源码 |

> 旧格式中 card name 可能直接是语言名（如 `puml`、`flowchart`、`mermaid`、`graphviz`），新格式统一用 `diagram` + `type` 字段。

### table — 表格

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `rows` | number | 是 | 行数 |
| `cols` | number | 是 | 列数 |
| `html` | string | 是 | 完整 `<table>` HTML 字符串（见下方格式说明） |
| `hideBorder` | bool | 否 | 隐藏边框 |

**html 字段的表格 HTML 格式：**

```html
<table class="lake-table" style="width: {总宽}px;">
  <colgroup>
    <col width="{列宽1}">
    <col width="{列宽2}">
  </colgroup>
  <tbody>
    <tr style="height: {行高}px;">
      <td style="background-color: #F5F5F5;"><p>表头内容</p></td>
      <td style="background-color: #F5F5F5;"><p>表头内容</p></td>
    </tr>
    <tr style="height: 33px;">
      <td><p>单元格内容</p></td>
      <td><p>单元格内容</p></td>
    </tr>
  </tbody>
</table>
```

**表格 HTML 内的元素规则：**
- `<table>` 必须有 `class="lake-table"` 和 `style="width: Npx"`
- 每列用 `<col width="N">` 定义宽度
- 每行用 `<tr style="height: Npx;">`，默认行高 33px
- 表头行的 `<td>` 通常有 `style="background-color: #F5F5F5;"`
- 单元格内容用 `<p>` 包裹（不需要 `data-lake-id`，展开后自动分配）
- 合并单元格用 `colspan` 和 `rowspan` 属性
- 单元格对齐用 `style="text-align: center;"` 和 `style="vertical-align: middle;"`

> 注意：table 卡片在预处理阶段会被展开为原生 `<table>` HTML，不经过标准的卡片读取流程。

### video — 视频

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `url` | string | 是 | 视频播放 URL |
| `name` | string | 否 | 文件名 |
| `size` | number | 否 | 文件大小（字节） |
| `status` | string | 否 | `"done"` / `"pending"` / `"error"` / `"uploading"` / `"uploaded"` |
| `cover` | string | 否 | 封面图片 URL |
| `videoId` | string | 否 | 视频资源 ID |
| `taskId` | string | 否 | 上传任务 ID |
| `taskType` | string | 否 | 任务类型 |
| `message` | string | 否 | 错误信息 |

### audio — 音频

Lake 格式中 audio 使用扁平字段（与内部嵌套的 `audioInfo` 结构不同）。

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `audioId` | string | 否 | 音频资源 ID |
| `fileName` | string | 否 | 文件名 |
| `fileSize` | number | 否 | 文件大小（字节） |
| `status` | string | 否 | `"error"` / `"pending"` / `"uploading"` / `"uploaded"` / `"transcoding"` / `"transcoded"` / `"copyright"` |
| `taskId` | string | 否 | 上传任务 ID |
| `message` | string | 否 | 错误信息 |
| `download` | bool | 否 | 是否允许下载 |

### bookmarklink — 网页书签

> 注意：Lake 格式中块级书签的 card name 是 `bookmarklink`（不是 `bookmark`）。内部模型节点名为 `bookmark`，但序列化时写入的是 `bookmarklink`。

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `src` | string | 是 | 书签 URL |
| `mode` | string | 否 | `"title"` 或 `"card"` |
| `text` | string | 否 | 显示文本 |
| `detail` | object | 否 | 链接预览信息：`{ title, image, icon, belong, url, desc }` |

### vote — 投票

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `voteId` | string | 否 | 投票 ID |
| `type` | string | 否 | `"single"`（单选）或 `"multiple"`（多选） |
| `title` | string | 否 | 投票标题 |
| `items` | array | 否 | 选项列表，每项为 `{ "id": "...", "value": "选项文本" }` |
| `deadline` | string | 否 | 截止日期（ISO 日期字符串） |

### calendar — 日历

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `currentDate` | string/number | 否 | 当前月份，YYYYMMDD 格式（始终为当月 1 号） |
| `colorIndex` | number | 否 | 颜色主题索引 |
| `schedules` | object | 否 | 日程字典，key 为日期（YYYYMMDD），value 为日程数组 |

**schedules 中每个日程对象：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 日程 ID |
| `start` | number | 开始日期（YYYYMMDD） |
| `end` | number | 结束日期（YYYYMMDD） |
| `title` | string | 日程标题 |
| `desc` | string | 描述 |
| `colorIndex` | number | 颜色索引 |

### thirdparty — 第三方嵌入

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `entrance` | string | 否 | 平台标识，如 `"youku"` |
| `type` | string | 否 | 资源子类型 |
| `url` | string | 是 | 嵌入 URL |
| `src` | string | 否 | 原始 URL |
| `height` | number | 否 | iframe 高度 |

> 旧格式中 card name 可能是平台名（如 `youku`、`processon`、`riddle`），新格式统一用 `thirdparty`。

### board — 画板

画板卡片是最复杂的卡片类型之一，支持画板、思维导图、UML、流程图四种子类型。

> **数据格式**：board 内部使用 v3 格式（`version: "3.0.0"`，body 为 `Record<id, cell>`，文本用 `content` Lake 富文本，`fill`/`stroke` 为颜色字符串，line 用 `sourceId`/`targetId` 扁平字段）。但**生成时推荐使用 v2 格式**（`version: "2.0.0"`，body 为数组，文本用 `html` HTML 片段，`fill`/`stroke` 为对象，line 用嵌套 `source`/`target`），board 的 import 机制会自动将 v2 转为 v3（包括 `html` → Lake 富文本、`fill.color` → 扁平字符串、嵌套连接 → 扁平字段）。以下文档和示例均使用 **v2 格式**。

#### 顶层 value 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `diagramData` | object | 否 | 画板数据，含 `head`（版本/主题）和 `body`（图形元素数组） |
| `viewportOption` | string | 否 | 视口模式：`"WYSIWYG"`（默认，保持编辑时视口）或 `"adapt"`（自适应内容） |
| `viewportSetting` | object/null | 否 | 视口状态：`{ "zoom": 1, "tlCanvasPoint": [x, y, z], "width": N, "height": N }` |
| `src` | string/null | 否 | 静态快照图片 URL（HTML/Markdown 导出时降级显示） |
| `cardType` | string/null | 否 | 子类型：`"board"`（空画板）/ `"mindmap"` / `"uml"` / `"flowchart"` |
| `graphicsBBox` | object/null | 否 | 图形边界框：`{ "x": 0, "y": 0, "width": 100, "height": 100 }` |
| `search` | string/null | 否 | 搜索索引文本（画板中所有文字拼接） |
| `loading` | bool | 否 | 是否加载中 |

#### diagramData 结构

```json
{
  "head": {
    "version": "2.0.0",
    "theme": { "name": "default" },
    "rough": { "name": "default" }
  },
  "body": [ /* v2: 图形元素数组 */ ]
}
```

- `head.version`：生成时使用 `"2.0.0"`。
- `head.theme.name`：可选值 `default`、`dark`、`colorful_kano`、`van_cogh_starry_sky`、`iris`、`wuxia_qingqiu`。一般用 `"default"`。
- `head.rough.name`：`"default"` 为正常渲染，其他值启用手绘风格。
- 空画板的 `diagramData` 为 `{ "body": [] }`。

#### body 元素类型

body 数组中每个元素是一个图形对象。v2 格式使用 `html` 字段（HTML 片段），`fill`/`stroke` 使用对象语法。

##### geometry — 形状元素

```json
{
  "type": "geometry",
  "id": "d6d7a548-eb8c-42ec-afff-8bb09fc83da8",
  "shape": "process",
  "html": "<div style=\"text-align:center;\">开始</div>",
  "x": 0, "y": 0,
  "width": 120, "height": 60,
  "zIndex": 0,
  "fill": { "color": "#FFFFFF" },
  "category": "UML"
}
```

| 字段 | 说明 |
|------|------|
| `type` | 固定 `"geometry"` |
| `id` | UUID |
| `shape` | 形状名称，见下方 geometry shape 参考表 |
| `html` | 形状内文本（HTML 片段，v2 格式；import 后自动转为 Lake 富文本 `content`） |
| `x`, `y` | 画布坐标 |
| `width`, `height` | 尺寸 |
| `zIndex` | 层叠顺序 |
| `fill` | 可选，填充色 `{ "color": "#FFFFFF" }` |
| `stroke` | 可选，边框色 `{ "color": "#000000", "width": 2 }` |
| `round` | 可选，圆角半径（仅 `rounded-rect` shape），0-50 |
| `category` | 可选，分类如 `"UML"` |

##### line — 连接线元素

```json
{
  "type": "line",
  "id": "l-001",
  "shape": "elbow",
  "source": { "id": "源元素ID", "connection": "E" },
  "target": { "marker": "arrow", "id": "目标元素ID" },
  "stroke": { "color": "#595959", "width": 2, "style": "dash" },
  "html": "<div style=\"text-align:center;\">标签</div>",
  "zIndex": 10
}
```

| 字段 | 说明 |
|------|------|
| `type` | 固定 `"line"` |
| `shape` | 线型：`"elbow"`（折线/正交路由，最常用）、`"straight"`（直线）、`"curve"`（贝塞尔曲线） |
| `source` | 起点：`{ "id": "元素ID", "connection": "E/W/N/S" }`，`connection` 为锚点方向 |
| `target` | 终点：`{ "id": "元素ID", "marker": "arrow/none" }`，`marker` 控制箭头 |
| `stroke` | 可选，线条样式。`style: "dash"` 为虚线，省略为实线 |
| `controlPoints` | 可选，折线控制点坐标数组 `[[x, y, "V/H"], ...]` |
| `html` | 可选，线上的标签文本（HTML 片段） |

> **连接方向**：`"E"` 右、`"W"` 左、`"S"` 下、`"N"` 上。源的 `connection` 决定出发方向，目标自动选择最近锚点。
>
> **v2 → v3 转换**：import 时嵌套格式自动拆解为扁平字段（`sourceId`、`targetId`、`sourceConnection`、`targetConnection`、`sourceMarker`、`targetMarker`），`"elbow"` 转为 `"polyline"`。

##### text — 文本元素

```json
{
  "type": "text",
  "id": "t-001",
  "shape": "text",
  "html": "<div style=\"font-size:14px;color:#333;\">标注文本</div>",
  "x": 100, "y": 50,
  "zIndex": 20
}
```

独立浮动文本，不在任何形状内。

##### mindmap — 思维导图根节点

```json
{
  "type": "mindmap",
  "id": "root1",
  "x": 0, "y": 0,
  "html": "中心主题",
  "border": { "fill": "#EFF0F0" },
  "rainbow": false,
  "tapered": true,
  "zIndex": 0,
  "layout": { "type": "standard-h" },
  "children": [
    {
      "id": "c1",
      "html": "分支 1",
      "treeEdge": { "stroke": "#A287E1" },
      "children": [],
      "zIndex": 1
    },
    {
      "id": "c2",
      "html": "分支 2",
      "treeEdge": { "stroke": "#6F81DB" },
      "children": [
        { "id": "c2-1", "html": "子节点", "children": [], "zIndex": 0 }
      ],
      "zIndex": 2,
      "layout": { "quadrant": 2 }
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `type` | 固定 `"mindmap"`（仅根节点） |
| `html` | 节点文本（HTML 片段） |
| `border.fill` | 节点背景色 |
| `treeEdge.stroke` | 连接线颜色（子节点字段） |
| `rainbow` | 是否彩虹色分支 |
| `tapered` | 是否锥形连线 |
| `children` | 子节点数组（递归结构） |
| `layout.type` | 布局类型：`"standard-h"`（水平双侧）、`"standard-r/l/t/b"`（单方向）、`"indent-br/bl/tr/tl"`（缩进）、`"timeline-r/l"`（时间线） |
| `layout.quadrant` | 可选，`2` 表示左侧分支（在双侧布局中） |

> **v2 → v3 转换**：import 时嵌套 `children` 展平为独立 cell，通过 `parent` 字段关联。`border.fill` → `fill`、`border.stroke` → `stroke`、`treeEdge.stroke` → `treeEdgeStroke`。

##### image — 图片元素

```json
{
  "type": "image",
  "id": "img-001",
  "x": 0, "y": 0,
  "width": 200, "height": 150,
  "href": "https://cdn.example.com/photo.png",
  "zIndex": 5
}
```

| 字段 | 说明 |
|------|------|
| `type` | 固定 `"image"` |
| `href` | 图片 URL |
| `width`, `height` | 显示尺寸 |
| `x`, `y` | 画布坐标 |

##### freehand — 手绘笔迹

```json
{
  "type": "freehand",
  "id": "fh-001",
  "shape": "pencil",
  "points": [[-33.83, 389.7, null], [-33.6, 390.39, 0.5], [0.65, 346.51, 0.5]],
  "x": -33.83, "y": 346.51,
  "width": 34.48, "height": 43.88,
  "zIndex": 8
}
```

| 字段 | 说明 |
|------|------|
| `shape` | `"pencil"`（铅笔）或 `"mark-pencil"`（马克笔/荧光笔） |
| `points` | 点坐标数组，每项为 `[x, y, pressure]`，首点 pressure 为 `null` |

##### swimlane — 泳道图

```json
{
  "type": "swimlane",
  "id": "sl-001",
  "shape": "swimlane-horizontal",
  "x": 0, "y": 0,
  "width": 600, "height": 400,
  "children": [
    { "html": "泳道 1" },
    { "html": "泳道 2" },
    { "html": "泳道 3" }
  ],
  "zIndex": 0
}
```

| 字段 | 说明 |
|------|------|
| `shape` | `"swimlane-horizontal"`（水平）或 `"swimlane-vertical"`（垂直） |
| `children` | 泳道标签数组，每项 `{ "html": "标签" }` |
| `contain` | 可选，泳道内包含的元素 ID 数组（geometry 等元素会被约束在泳道区域内） |

##### group — 分组

```json
{ "type": "group", "id": "g-001", "zIndex": 0 }
```

纯逻辑分组，无自身几何信息。组内元素的 `parent` 指向此 ID（v3 扁平格式）。v2 中分组包含的元素通过 `contain` 数组关联。

#### geometry shape 参考

`shape` 字段可选值按分类：

| 分类 | 可用 shape |
|------|-----------|
| **基础** | `rect`（矩形）、`rounded-rect`（圆角矩形，配合 `round` 字段） |
| **流程图** | `process`（处理）、`start-end`（开始/结束，圆角胶囊）、`decision`（菱形判断）、`data`（平行四边形）、`database`（圆柱数据库）、`document`（文档波浪底）、`subroutine`（子程序）、`preparation`（六边形准备）、`manual-input`（手动输入）、`manual-loop`（手动循环）、`delay`（延迟）、`display`（显示器）、`internal-storage`（内部存储）、`multi-document`（多文档）、`sort`（排序）、`merge`（合并三角）、`collate`（沙漏）、`connector`（小圆连接符）、`off-page`（离页连接）、`or`（或门）、`summing-junction`（求和节点）、`parallel`（并行线）、`loop-limit`（循环限制）、`stored-data`（存储数据）、`hard-disk`（硬盘）、`annotation`（注释括号）、`paper-tape`（纸带）、`card`（卡片） |
| **UML** | `actor`（人形）、`use-case`（椭圆用例）、`simple-class`（类）、`object`（对象）、`component`（组件）、`node`（节点）、`package`（包）、`frame`（框架）、`state`（状态圆角矩形）、`activity`（活动）、`activity-class`（活动类）、`start`（实心起点）、`finish`（同心终点）、`fork`（分叉/汇合条）、`boundary`（边界）、`control`（控制）、`entity`（实体）、`choice`（菱形选择）、`note`（折角便笺）、`constraint`（约束）、`send-signal`（发送信号五边形）、`receive-signal`（接收信号五边形）、`activation`（激活条）、`deletion`（终止叉）、`frequency`（频率）、`multiplicity`（多重性）、`history-pseudostate`（历史伪状态）、`termination-pseudostate`（终止伪状态） |

> 最常用的 shape：`process`（通用矩形，流程图/架构图首选）、`start-end`（圆角胶囊）、`decision`（菱形条件分支）、`database`（数据库）、`rounded-rect`（圆角矩形，可调 `round`）、`actor`（人物角色）、`use-case`（用例椭圆）。

#### 完整示例

**空画板：**

```json
{
  "id": "b001",
  "diagramData": { "body": [] },
  "viewportOption": "WYSIWYG",
  "viewportSetting": null,
  "search": null,
  "src": null
}
```

**流程图（含条件分支）：**

```json
{
  "id": "b002",
  "cardType": "flowchart",
  "viewportOption": "adapt",
  "graphicsBBox": { "x": 0, "y": 0, "width": 720, "height": 290 },
  "search": "开始 验证参数 处理请求 返回成功 返回错误 结束",
  "diagramData": {
    "head": { "version": "2.0.0", "theme": { "name": "default" } },
    "body": [
      { "type": "geometry", "shape": "start-end", "id": "s1", "x": 0, "y": 0, "width": 100, "height": 50, "html": "<div style=\"text-align:center;\">开始</div>", "zIndex": 0 },
      { "type": "line", "shape": "elbow", "id": "l1", "source": { "id": "s1", "connection": "E" }, "target": { "marker": "arrow", "id": "d1" }, "zIndex": 10 },
      { "type": "geometry", "shape": "decision", "id": "d1", "x": 160, "y": -10, "width": 120, "height": 70, "html": "<div style=\"text-align:center;\">参数有效?</div>", "zIndex": 1 },
      { "type": "line", "shape": "elbow", "id": "l2", "source": { "id": "d1", "connection": "E" }, "target": { "marker": "arrow", "id": "p1" }, "html": "<div style=\"text-align:center;\">是</div>", "zIndex": 11 },
      { "type": "line", "shape": "elbow", "id": "l3", "source": { "id": "d1", "connection": "S" }, "target": { "marker": "arrow", "id": "err" }, "stroke": { "color": "#DF2A3F", "width": 2, "style": "dash" }, "html": "<div style=\"text-align:center;\">否</div>", "zIndex": 12 },
      { "type": "geometry", "shape": "process", "id": "p1", "x": 340, "y": 0, "width": 120, "height": 50, "html": "<div style=\"text-align:center;\">处理请求</div>", "zIndex": 2 },
      { "type": "line", "shape": "elbow", "id": "l4", "source": { "id": "p1", "connection": "E" }, "target": { "marker": "arrow", "id": "ok" }, "zIndex": 13 },
      { "type": "geometry", "shape": "process", "id": "ok", "x": 520, "y": 0, "width": 120, "height": 50, "html": "<div style=\"text-align:center;\">返回成功</div>", "fill": { "color": "#E8F7CF" }, "zIndex": 3 },
      { "type": "line", "shape": "elbow", "id": "l5", "source": { "id": "ok", "connection": "E" }, "target": { "marker": "arrow", "id": "end" }, "zIndex": 14 },
      { "type": "geometry", "shape": "start-end", "id": "end", "x": 700, "y": 0, "width": 100, "height": 50, "html": "<div style=\"text-align:center;\">结束</div>", "zIndex": 4 },
      { "type": "geometry", "shape": "process", "id": "err", "x": 160, "y": 120, "width": 120, "height": 50, "html": "<div style=\"text-align:center;\">返回错误</div>", "fill": { "color": "#FBE4E7" }, "zIndex": 5 },
      { "type": "line", "shape": "elbow", "id": "l6", "source": { "id": "err", "connection": "E" }, "target": { "marker": "arrow", "id": "end" }, "zIndex": 15 }
    ]
  }
}
```

**思维导图（含三级节点）：**

```json
{
  "id": "b003",
  "cardType": "mindmap",
  "viewportOption": "adapt",
  "graphicsBBox": { "x": -200, "y": -100, "width": 400, "height": 250 },
  "search": "项目规划前端React Vue后端API数据库测试单元测试集成测试",
  "diagramData": {
    "head": { "version": "2.0.0", "theme": { "name": "default" } },
    "body": [
      {
        "type": "mindmap",
        "id": "root1",
        "x": 0, "y": 0,
        "html": "项目规划",
        "border": { "fill": "#EFF0F0" },
        "rainbow": false,
        "tapered": true,
        "zIndex": 0,
        "layout": { "type": "standard-h" },
        "children": [
          {
            "id": "c1", "html": "前端",
            "treeEdge": { "stroke": "#A287E1" },
            "children": [
              { "id": "c1-1", "html": "React", "children": [], "zIndex": 0 },
              { "id": "c1-2", "html": "Vue", "children": [], "zIndex": 1 }
            ],
            "zIndex": 1
          },
          {
            "id": "c2", "html": "后端",
            "treeEdge": { "stroke": "#6F81DB" },
            "children": [
              { "id": "c2-1", "html": "API", "children": [], "zIndex": 0 },
              { "id": "c2-2", "html": "数据库", "children": [], "zIndex": 1 }
            ],
            "zIndex": 2
          },
          {
            "id": "c3", "html": "测试",
            "treeEdge": { "stroke": "#6EC4C4" },
            "children": [
              { "id": "c3-1", "html": "单元测试", "children": [], "zIndex": 0 },
              { "id": "c3-2", "html": "集成测试", "children": [], "zIndex": 1 }
            ],
            "zIndex": 3,
            "layout": { "quadrant": 2 }
          }
        ]
      }
    ]
  }
}
```

**UML 用例图：**

```json
{
  "id": "b004",
  "cardType": "uml",
  "viewportOption": "adapt",
  "search": "用户 登录 注册 管理员 审核 系统",
  "diagramData": {
    "head": { "version": "2.0.0" },
    "body": [
      { "type": "geometry", "shape": "actor", "id": "u1", "x": 0, "y": 60, "width": 40, "height": 80, "html": "<div style=\"text-align:center;\">用户</div>", "zIndex": 0 },
      { "type": "geometry", "shape": "use-case", "id": "uc1", "x": 150, "y": 20, "width": 120, "height": 60, "html": "<div style=\"text-align:center;\">登录</div>", "zIndex": 1 },
      { "type": "geometry", "shape": "use-case", "id": "uc2", "x": 150, "y": 110, "width": 120, "height": 60, "html": "<div style=\"text-align:center;\">注册</div>", "zIndex": 2 },
      { "type": "geometry", "shape": "actor", "id": "u2", "x": 380, "y": 60, "width": 40, "height": 80, "html": "<div style=\"text-align:center;\">管理员</div>", "zIndex": 3 },
      { "type": "geometry", "shape": "use-case", "id": "uc3", "x": 150, "y": 200, "width": 120, "height": 60, "html": "<div style=\"text-align:center;\">审核</div>", "zIndex": 4 },
      { "type": "line", "shape": "straight", "id": "l1", "source": { "id": "u1", "connection": "E" }, "target": { "id": "uc1" }, "zIndex": 10 },
      { "type": "line", "shape": "straight", "id": "l2", "source": { "id": "u1", "connection": "E" }, "target": { "id": "uc2" }, "zIndex": 11 },
      { "type": "line", "shape": "straight", "id": "l3", "source": { "id": "u2", "connection": "W" }, "target": { "id": "uc3" }, "zIndex": 12 },
      { "type": "text", "id": "t1", "shape": "text", "html": "<div style=\"font-size:11px;color:#64748b;\">«include»</div>", "x": 150, "y": 85, "zIndex": 20 }
    ]
  }
}
```

**混合画板（geometry + image + text）：**

```json
{
  "id": "b005",
  "cardType": "board",
  "viewportOption": "adapt",
  "search": "Logo 品牌标准 主色调 辅助色",
  "diagramData": {
    "head": { "version": "2.0.0" },
    "body": [
      { "type": "text", "id": "t1", "shape": "text", "html": "<div style=\"font-size:18px;font-weight:600;color:#0f172a;\">品牌色板</div>", "x": 0, "y": 0, "zIndex": 20 },
      { "type": "geometry", "id": "c1", "shape": "rounded-rect", "fill": { "color": "#117CEE" }, "round": 8, "x": 0, "y": 40, "width": 100, "height": 100, "html": "<div style=\"text-align:center;color:#fff;font-size:12px;\">#117CEE<br>主色调</div>", "zIndex": 1 },
      { "type": "geometry", "id": "c2", "shape": "rounded-rect", "fill": { "color": "#74B602" }, "round": 8, "x": 120, "y": 40, "width": 100, "height": 100, "html": "<div style=\"text-align:center;color:#fff;font-size:12px;\">#74B602<br>成功色</div>", "zIndex": 2 },
      { "type": "geometry", "id": "c3", "shape": "rounded-rect", "fill": { "color": "#DF2A3F" }, "round": 8, "x": 240, "y": 40, "width": 100, "height": 100, "html": "<div style=\"text-align:center;color:#fff;font-size:12px;\">#DF2A3F<br>错误色</div>", "zIndex": 3 },
      { "type": "image", "id": "img1", "x": 0, "y": 170, "width": 340, "height": 80, "href": "https://cdn.example.com/brand-logo.png", "zIndex": 4 }
    ]
  }
}
```

> 旧格式（`flowchart2`、`basicDraw`、`mindmap`）的 `diagramData` 可能是 pako 压缩的字符串，读取时自动解压。新格式直接使用 JSON 对象。

### localdoc — 块级文件附件

字段与 inline `file` 卡片相同，参见下方。

---

## 内联卡片（type="inline"）

### image — 图片

Lake 格式中 image 使用扁平字段（内部的嵌套 `original` 对象在序列化时会展开）。

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `src` | string | 是 | 图片 URL |
| `name` | string | 否 | 文件名 |
| `size` | number | 否 | 文件大小（字节） |
| `width` | number | 否 | 用户设置的显示宽度 |
| `height` | number | 否 | 显示高度（由宽高比计算） |
| `originWidth` | number | 否 | 原始宽度 |
| `originHeight` | number | 否 | 原始高度 |
| `originalType` | string | 否 | `"binary"` 或 `"url"` |
| `from` | string | 否 | 来源：`"paste"` / `"url"` / `"upload"` |
| `ratio` | number | 否 | 宽高比 |
| `status` | string | 否 | `"done"` / `"pending"` / `"error"` |
| `style` | string | 否 | `"none"` |
| `link` | string | 否 | 图片超链接 |
| `linkTarget` | string | 否 | 链接 target（`"_blank"` 或 `""`） |
| `showTitle` | bool | 否 | 是否显示标题 |
| `title` | string | 否 | 图片标题/图注 |
| `rotation` | number | 否 | 旋转角度：0 / 90 / 180 / 270 |
| `crop` | number[] | 否 | 裁剪区域 [x1, y1, x2, y2]，值 0~1 |
| `search` | string | 否 | OCR 搜索文本 |
| `ocrLocations` | array | 否 | OCR 文字位置信息 |
| `errorMessage` | string | 否 | 错误信息 |
| `averageHue` | string | 否 | 平均色调 |
| `taskId` | string | 否 | 上传任务 ID |
| `clientId` | string | 否 | 客户端 ID |

### math — 数学公式

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `code` | string | 是 | LaTeX 字符串 |
| `url` | string | 否 | 渲染后的图片 URL（内部模型字段名为 `url`，lake 格式中为 `src`） |

> 注意：在 lake 格式序列化中该字段写为 `src`，但内部模型读取后映射为 `url`。书写 lake 格式时应使用 `src`。

### mention — @提及

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `login` | string | 否 | 登录名 |
| `nickName` | string | 否 | 昵称 |
| `name` | string | 否 | 姓名 |
| `userid` | string | 否 | 用户 ID |
| `workId` | string | 否 | 工号 |

### file — 文件附件

用于 inline 文件卡片。块级文件附件使用 `localdoc` 卡片名，字段相同。

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `src` | string | 是 | 文件 URL |
| `name` | string | 是 | 文件名 |
| `size` | number | 是 | 文件大小（字节） |
| `ext` | string | 是 | 扩展名 |
| `source` | string | 是 | 上传来源 |
| `status` | string | 是 | `"done"` / `"pending"` / `"error"` / `"uploading"` / `"transfering"` |
| `download` | bool | 是 | 是否允许下载 |
| `mode` | string | 否 | 显示模式：`"title"` / `"card"` / `"embed"` |
| `type` | string | 否 | `"inline"` 或 `"block"` |
| `taskId` | string | 否 | 上传任务 ID |
| `taskType` | string | 否 | 任务类型 |
| `message` | string | 否 | 错误信息 |

### label — 标签

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `label` | string | 否 | 标签文本 |
| `colorIndex` | number | 是 | 颜色索引 |

### tags — 标签组

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | string | 否 | 标签名称 |
| `url` | string | 否 | 标签链接 URL |

### unicodeEmoji — 表情

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `emoji` | string | 是 | Unicode 表情字符 |

### bookmarkInline — 内联书签

字段与块级 `bookmarklink` 相同（`mode`、`src`、`text`、`detail`）。

### dateCard — 日期

> 注意：Lake 格式中日期卡片的 card name 是 `dateCard`（不是 `date`）。

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `date` | number | 是 | Unix 时间戳（毫秒） |
| `time` | string | 否 | 时间字符串，格式 `HH:mm` |
| `reminderType` | string | 否 | 提醒类型 |

---

## 旧格式兼容 card name

以下 card name 出现在旧文档中，读取时会被映射为对应的新卡片类型：

| 旧 card name | 映射为 | 说明 |
|------|------|------|
| `mindmap` | `board` | 旧版思维导图 |
| `basicDraw` / `basicdraw` | `board` | 旧版画板 |
| `flowchart2` | `board` | 旧版流程图 |
| `puml` / `flowchart` / `graphviz` / `mermaid` | `diagram` | 旧版文本图表（直接用语言名） |
| `youku` / `processon` / `riddle` | `thirdparty` | 旧版第三方嵌入（直接用平台名） |
