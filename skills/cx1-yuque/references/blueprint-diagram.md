# 蓝图架构图

> 从原 OpenAuth 技能移植的结构与设计参考，不是公网 API 的完整稳定规范。提交使用 `doc create/update --format lake --body-file FILE`（Open API 的 `body`）；不要使用内网 `body_asl` 参数。保留已有卡片编码与未知字段。新卡片须在 Chrome 验证渲染；API 回读相同只证明存储。

在语雀中生成扁平工程蓝图（Flat Engineering Blueprint）风格的架构图、系统图、流程图。使用 board 画板卡片实现，输出为标准语雀文档。

## 触发场景

用户提到：生成蓝图、架构图、系统图、技术图纸、blueprint、扁平蓝图、工程蓝图。

## 视觉规则

核心原则：**精确、客观、高数据墨水比**。输出应像技术规格书，不像营销页面。

### 禁止

- 不使用彩色填充（仅黑白灰 + 一个语义强调色 `#dc2626`）
- 不使用 emoji 或装饰性图标
- 不使用圆角按钮样式的形状

### 强制

- 所有组件使用 `process` 矩形形状
- 连接线使用 `elbow` 折线
- **字体分层**：标题/副标题用 `system-ui,-apple-system,sans-serif`（对应 blueprinter 的 Inter），数据/标签/值用 `monospace`（对应 JetBrains Mono）
- 标签全大写、12px、宽字距（`text-transform:uppercase; letter-spacing:0.05em`）
- 布局严格网格对齐
- 每个蓝图必须有**画布边框**（canvas frame）作为底层背景

## 色板

| 用途 | 色值 | Board 属性 |
|------|------|------------|
| 画布背景 | `#FFFFFF` | canvas frame geometry `fill.color` |
| 标题区背景 | `#F8FAFC` | header geometry `fill.color` |
| 组件背景 | `#FFFFFF` | geometry `fill.color` |
| 连接线 | `#cbd5e1` | line `stroke.color` |
| 主文字 | `#0f172a` | html `color:#0f172a` |
| 次文字 / 标签 | `#64748b` | html `color:#64748b` |
| 强调色（仅错误/警告） | `#dc2626` | html `color:#dc2626` |
| 实心徽章背景 | `#0f172a` | geometry `fill.color` |
| 实心徽章文字 | `#FFFFFF` | html `color:#ffffff` |

## 元素模板

### 画布边框（Canvas Frame）

**必须有。** 这是 blueprinter 视觉的核心 — 一个白色矩形作为所有内容的底板，提供"带边框的技术图纸"观感。board 默认主题会为它渲染 1px 边框。

尺寸 = 内容区 + 四周各 30px padding。zIndex 必须为 0（最底层）。

```json
{
  "type": "geometry", "id": "canvas", "shape": "process",
  "fill": { "color": "#FFFFFF" },
  "x": -30, "y": -30, "width": 660, "height": 560,
  "zIndex": 0
}
```

> 宽度 = 内容最右边缘 + 30；高度 = 内容最底边缘 + 30。x/y 从 -30 开始提供左/上 padding。

### 标题区

宽幅矩形，浅灰背景。内部 HTML 包含 **border-bottom 分隔线**（还原 blueprinter 的 header separator）。标题用 **sans-serif 20px**，副标题用 **sans-serif 11px uppercase**。

```json
{
  "type": "geometry", "id": "hdr", "shape": "process",
  "fill": { "color": "#F8FAFC" },
  "x": 0, "y": 0, "width": 600, "height": 80,
  "html": "<div style=\"padding:8px 12px;\"><div style=\"border-bottom:1px solid #cbd5e1;padding-bottom:10px;\"><div style=\"font-size:20px;font-weight:600;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;margin-bottom:4px;\">标题</div><div style=\"font-size:11px;font-weight:500;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:system-ui,-apple-system,sans-serif;\">SUBTITLE / VERSION</div></div></div>",
  "zIndex": 1
}
```

**与 blueprinter HTML 的对应：**
- `font-size:20px` → `.diagram-title { font-size: 20px }`
- `font-weight:600` → `.diagram-title { font-weight: 600 }`
- `margin-bottom:4px` → `.diagram-title { margin-bottom: 4px }`
- `border-bottom:1px solid #cbd5e1` → `.diagram-header { border-bottom: 1px solid var(--c-border) }`
- `padding-bottom:10px` → `.diagram-header { padding-bottom: 16px }`（board 内部空间较紧，适当缩小）
- `font-family:system-ui` → `.diagram-title { font-family: var(--font-ui) }`（Inter → 系统 sans-serif）

### 组件块

白色矩形，内部有 padding 留白。上方 **12px monospace 大写标签**，下方 **14px monospace 粗体值**，两者间有 6px 间距。

```json
{
  "type": "geometry", "id": "c-xxx", "shape": "process",
  "fill": { "color": "#FFFFFF" },
  "x": 0, "y": 120, "width": 180, "height": 90,
  "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">LABEL</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">Value</div></div>",
  "zIndex": 2
}
```

**与 blueprinter HTML 的对应：**
- `padding:10px 8px` → `.component { padding: 16px }`（board 空间较紧，适当缩小）
- `font-size:12px` → `.component-label { font-size: 12px }`
- `letter-spacing:0.05em` → `.component-label { letter-spacing: 0.05em }`
- `margin-bottom:6px` → label 与 value 之间的视觉间隔
- `font-size:14px;font-weight:500` → `.component-value { font-size: 14px; font-weight: 500 }`

#### 多行组件（含描述）

当组件需要更多信息时，增加第三行灰色小字描述：

```json
{
  "type": "geometry", "id": "c-xxx", "shape": "process",
  "fill": { "color": "#FFFFFF" },
  "x": 0, "y": 120, "width": 180, "height": 105,
  "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">LABEL</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;margin-bottom:4px;\">Value</div><div style=\"font-size:10px;color:#94a3b8;font-family:monospace;\">description line</div></div>",
  "zIndex": 2
}
```

### 层级标签（Section Label）

用于对组件分组（如 ENTRY POINTS、INFRASTRUCTURE、DISPATCH）。使用 text 元素，sans-serif 大写。

```json
{
  "type": "text", "id": "sec-xxx", "shape": "text",
  "html": "<div style=\"font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;font-family:system-ui,-apple-system,sans-serif;\">SECTION NAME</div>",
  "x": 0, "y": 100,
  "zIndex": 20
}
```

### 实线连接器

浅灰色折线，箭头终点。`connection` 方向：`E`（右）、`W`（左）、`S`（下）、`N`（上）。

`shape` 可选值：`"elbow"`（正交折线，蓝图首选）、`"straight"`（直线，适合短距离对齐连接）、`"curve"`（曲线，适合数据流）。

```json
{
  "type": "line", "id": "l-xxx", "shape": "elbow",
  "source": { "id": "源组件ID", "connection": "E" },
  "target": { "marker": "arrow", "id": "目标组件ID" },
  "stroke": { "color": "#cbd5e1", "width": 1 },
  "zIndex": 10
}
```

### 虚线连接器

用于抽象关系（异步消息、可选依赖等）。增加 `"style": "dash"`。

```json
{
  "type": "line", "id": "l-xxx", "shape": "elbow",
  "source": { "id": "源组件ID", "connection": "S" },
  "target": { "marker": "arrow", "id": "目标组件ID" },
  "stroke": { "color": "#cbd5e1", "width": 1, "style": "dash" },
  "zIndex": 10
}
```

### 无箭头连接器

用于对等关系（双向通信、对称依赖等）。`target` 中不设 `marker` 或设为 `"none"`。

```json
{
  "type": "line", "id": "l-xxx", "shape": "straight",
  "source": { "id": "源组件ID", "connection": "E" },
  "target": { "id": "目标组件ID" },
  "stroke": { "color": "#cbd5e1", "width": 1 },
  "zIndex": 10
}
```

### 连接标签

在连接线上标注协议或关系名称，使用 line 的 `html` 字段。

```json
{
  "type": "line", "id": "l-xxx", "shape": "elbow",
  "source": { "id": "c-a", "connection": "E" },
  "target": { "marker": "arrow", "id": "c-b" },
  "stroke": { "color": "#cbd5e1", "width": 1 },
  "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#64748b;\">HTTP</div>",
  "zIndex": 10
}
```

### 描边徽章

小号矩形，白底，monospace 文字。放置在组件旁标注属性。

```json
{
  "type": "geometry", "id": "badge-xxx", "shape": "process",
  "fill": { "color": "#FFFFFF" },
  "x": 0, "y": 0, "width": 70, "height": 22,
  "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#64748b;letter-spacing:0.03em;\">LABEL</div>",
  "zIndex": 20
}
```

### 实心徽章

深色背景，白色文字，用于强调状态（CRITICAL、PROD、ERROR）。

```json
{
  "type": "geometry", "id": "badge-xxx", "shape": "process",
  "fill": { "color": "#0f172a" },
  "x": 0, "y": 0, "width": 70, "height": 22,
  "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#ffffff;letter-spacing:0.03em;\">STATUS</div>",
  "zIndex": 20
}
```

### 浮动文本

独立注释文本，不在任何形状内。

```json
{
  "type": "text", "id": "t-xxx", "shape": "text",
  "html": "<div style=\"font-family:monospace;font-size:11px;color:#64748b;\">注释文本</div>",
  "x": 0, "y": 0,
  "zIndex": 15
}
```

## 布局网格

严格网格对齐是蓝图风格的核心。

### 基本尺寸

| 参数 | 值 | 说明 |
|------|-----|------|
| 画布 padding | 30px | canvas frame 四周留白 |
| 组件宽 | 180px | 标准宽度，可按内容加宽至 220/260 |
| 组件高 | 90px | 标准高度，多行组件可加高至 105 |
| 水平间距 | 60px | 组件右边缘到下一组件左边缘 |
| 垂直间距 | 60px | 组件下边缘到下一组件上边缘（含可选的层级标签） |
| 标题区高 | 80px | 固定 |
| 标题下间距 | 40px | 标题区下边缘到首行组件上边缘 |
| 层级标签高 | 16px | 放置在行上方，占用垂直间距的一部分 |
| 徽章高 | 22px | 固定 |

### 坐标计算

```
画布边框:   x=-30, y=-30, width=内容宽+60, height=内容高+60

标题区:     x=0,  y=0,  width=总列宽,  height=80
首行标签:   y = 80 + 24 = 104（层级标签，可选）
首行组件:   y = 80 + 40 = 120
第二行:     y = 120 + 90 + 60 = 270
第三行:     y = 270 + 90 + 60 = 420

首列:       x = 0
第二列:     x = 180 + 60 = 240
第三列:     x = 240 + 180 + 60 = 480

标题区宽度 = 最右列 x + 组件宽
```

### 连接方向约定

- 同行左右连接：源 `"E"` → 目标自动从 `"W"` 进入
- 上下行连接：源 `"S"` → 目标自动从 `"N"` 进入
- 反向或回路：使用 `"W"` 或 `"N"`

### zIndex 分层

| 层 | 范围 | 用途 |
|---|---|---|
| 画布 | 0 | canvas frame 底板 |
| 标题 | 1 | 标题区 |
| 组件层 | 2-9 | 组件块 |
| 连接层 | 10-19 | 连接线 |
| 标注层 | 20+ | 徽章、层级标签、浮动文本 |

## 完整示例

### 示例 1：微服务架构蓝图

6 组件 + 3 层级标签，展示所有元素模板的用法：

```
+--[ canvas frame ]-----------------------------+
|                                               |
|  +========================================+   |
|  | 系统架构蓝图              [CRITICAL]    |   |
|  | SYSTEM ARCHITECTURE / v1.0             |   |
|  +────────────────────────────────────────+   |
|                                               |
|  ── ENTRY ──────────────────────────────────  |
|  [Client]  →HTTP→  [Gateway]  →gRPC→  [Auth]  |
|                        ↓                      |
|  ── SERVICE ────────────────────────────────  |
|  [User Svc]  →SQL→  [Database]                |
|       ↓ (dash)                                |
|  [Msg Queue]                                  |
|                                               |
+-----------------------------------------------+
```

#### Board Value JSON

```json
{
  "id": "bp-arch-001",
  "cardType": "board",
  "viewportOption": "adapt",
  "search": "系统架构蓝图 Client React SPA Gateway Node.js Auth Service Go User Service Java Database PostgreSQL Message Queue Redis",
  "graphicsBBox": { "x": -30, "y": -30, "width": 660, "height": 590 },
  "diagramData": {
    "head": {
      "version": "2.0.0",
      "theme": { "name": "default" },
      "rough": { "name": "default" }
    },
    "body": [
      {
        "type": "geometry", "id": "canvas", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": -30, "y": -30, "width": 660, "height": 590,
        "zIndex": 0
      },
      {
        "type": "geometry", "id": "hdr", "shape": "process",
        "fill": { "color": "#F8FAFC" },
        "x": 0, "y": 0, "width": 600, "height": 80,
        "html": "<div style=\"padding:8px 12px;\"><div style=\"border-bottom:1px solid #cbd5e1;padding-bottom:10px;\"><div style=\"font-size:20px;font-weight:600;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;margin-bottom:4px;\">系统架构蓝图</div><div style=\"font-size:11px;font-weight:500;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:system-ui,-apple-system,sans-serif;\">System Architecture / v1.0</div></div></div>",
        "zIndex": 1
      },
      {
        "type": "text", "id": "sec-entry", "shape": "text",
        "html": "<div style=\"font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;font-family:system-ui,-apple-system,sans-serif;\">ENTRY</div>",
        "x": 0, "y": 104,
        "zIndex": 20
      },
      {
        "type": "geometry", "id": "c-client", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 0, "y": 120, "width": 180, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">Client</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">React SPA</div></div>",
        "zIndex": 2
      },
      {
        "type": "geometry", "id": "c-gateway", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 240, "y": 120, "width": 180, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">Gateway</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">Node.js</div></div>",
        "zIndex": 3
      },
      {
        "type": "geometry", "id": "c-auth", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 480, "y": 120, "width": 180, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">Auth Service</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">Go</div></div>",
        "zIndex": 4
      },
      {
        "type": "text", "id": "sec-service", "shape": "text",
        "html": "<div style=\"font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;font-family:system-ui,-apple-system,sans-serif;\">SERVICE</div>",
        "x": 0, "y": 254,
        "zIndex": 20
      },
      {
        "type": "geometry", "id": "c-user", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 240, "y": 270, "width": 180, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">User Service</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">Java</div></div>",
        "zIndex": 5
      },
      {
        "type": "geometry", "id": "c-db", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 480, "y": 270, "width": 180, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">Database</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">PostgreSQL</div></div>",
        "zIndex": 6
      },
      {
        "type": "geometry", "id": "c-mq", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 240, "y": 420, "width": 180, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">Message Queue</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">Redis</div></div>",
        "zIndex": 7
      },
      {
        "type": "line", "id": "l-client-gw", "shape": "elbow",
        "source": { "id": "c-client", "connection": "E" },
        "target": { "marker": "arrow", "id": "c-gateway" },
        "stroke": { "color": "#cbd5e1", "width": 1 },
        "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#64748b;\">HTTP</div>",
        "zIndex": 10
      },
      {
        "type": "line", "id": "l-gw-auth", "shape": "elbow",
        "source": { "id": "c-gateway", "connection": "E" },
        "target": { "marker": "arrow", "id": "c-auth" },
        "stroke": { "color": "#cbd5e1", "width": 1 },
        "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#64748b;\">gRPC</div>",
        "zIndex": 11
      },
      {
        "type": "line", "id": "l-gw-user", "shape": "elbow",
        "source": { "id": "c-gateway", "connection": "S" },
        "target": { "marker": "arrow", "id": "c-user" },
        "stroke": { "color": "#cbd5e1", "width": 1 },
        "zIndex": 12
      },
      {
        "type": "line", "id": "l-user-db", "shape": "elbow",
        "source": { "id": "c-user", "connection": "E" },
        "target": { "marker": "arrow", "id": "c-db" },
        "stroke": { "color": "#cbd5e1", "width": 1 },
        "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#64748b;\">SQL</div>",
        "zIndex": 13
      },
      {
        "type": "line", "id": "l-user-mq", "shape": "elbow",
        "source": { "id": "c-user", "connection": "S" },
        "target": { "marker": "arrow", "id": "c-mq" },
        "stroke": { "color": "#cbd5e1", "width": 1, "style": "dash" },
        "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#64748b;\">ASYNC</div>",
        "zIndex": 14
      },
      {
        "type": "geometry", "id": "badge-critical", "shape": "process",
        "fill": { "color": "#0f172a" },
        "x": 590, "y": 98, "width": 70, "height": 22,
        "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#ffffff;letter-spacing:0.03em;\">CRITICAL</div>",
        "zIndex": 20
      }
    ]
  }
}
```

### 示例 2：决策流程蓝图

4 组件审批流程，展示 `decision` 菱形条件分支 + 错误路径虚线 + 回路连接。

```
+--[ canvas frame ]-------------------------------+
|                                                 |
|  +==========================================+   |
|  | 审批流程蓝图                              |   |
|  | APPROVAL WORKFLOW / v1.0                 |   |
|  +──────────────────────────────────────────+   |
|                                                 |
|  [提交申请]  →  ◇ 金额>1万?  ──是──→ [主管审批]  |
|                    ↓ 否                          |
|               [自动通过]  ──→  [归档记录]         |
|                                 ↑               |
|               [主管审批]  ──────┘               |
|                                                 |
+-------------------------------------------------+
```

```json
{
  "id": "bp-approval-001",
  "cardType": "board",
  "viewportOption": "adapt",
  "search": "审批流程蓝图 提交申请 金额判断 自动通过 主管审批 归档记录",
  "graphicsBBox": { "x": -30, "y": -30, "width": 660, "height": 440 },
  "diagramData": {
    "head": { "version": "2.0.0", "theme": { "name": "default" } },
    "body": [
      {
        "type": "geometry", "id": "canvas", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": -30, "y": -30, "width": 660, "height": 440,
        "zIndex": 0
      },
      {
        "type": "geometry", "id": "hdr", "shape": "process",
        "fill": { "color": "#F8FAFC" },
        "x": 0, "y": 0, "width": 600, "height": 80,
        "html": "<div style=\"padding:8px 12px;\"><div style=\"border-bottom:1px solid #cbd5e1;padding-bottom:10px;\"><div style=\"font-size:20px;font-weight:600;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;margin-bottom:4px;\">审批流程蓝图</div><div style=\"font-size:11px;font-weight:500;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:system-ui,-apple-system,sans-serif;\">APPROVAL WORKFLOW / v1.0</div></div></div>",
        "zIndex": 1
      },
      {
        "type": "geometry", "id": "c-submit", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 0, "y": 120, "width": 140, "height": 80,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">SUBMIT</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">提交申请</div></div>",
        "zIndex": 2
      },
      {
        "type": "geometry", "id": "c-check", "shape": "decision",
        "fill": { "color": "#FFFFFF" },
        "x": 210, "y": 110, "width": 120, "height": 100,
        "html": "<div style=\"text-align:center;font-size:12px;color:#0f172a;font-family:monospace;\">金额\n>1万?</div>",
        "zIndex": 3
      },
      {
        "type": "geometry", "id": "c-auto", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 210, "y": 270, "width": 140, "height": 80,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">AUTO PASS</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">自动通过</div></div>",
        "zIndex": 4
      },
      {
        "type": "geometry", "id": "c-approve", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 420, "y": 120, "width": 140, "height": 80,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">MANAGER</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">主管审批</div></div>",
        "zIndex": 5
      },
      {
        "type": "geometry", "id": "c-archive", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 420, "y": 270, "width": 140, "height": 80,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">ARCHIVE</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">归档记录</div></div>",
        "zIndex": 6
      },
      {
        "type": "line", "id": "l-submit-check", "shape": "elbow",
        "source": { "id": "c-submit", "connection": "E" },
        "target": { "marker": "arrow", "id": "c-check" },
        "stroke": { "color": "#cbd5e1", "width": 1 },
        "zIndex": 10
      },
      {
        "type": "line", "id": "l-check-approve", "shape": "elbow",
        "source": { "id": "c-check", "connection": "E" },
        "target": { "marker": "arrow", "id": "c-approve" },
        "stroke": { "color": "#cbd5e1", "width": 1 },
        "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#64748b;\">YES</div>",
        "zIndex": 11
      },
      {
        "type": "line", "id": "l-check-auto", "shape": "elbow",
        "source": { "id": "c-check", "connection": "S" },
        "target": { "marker": "arrow", "id": "c-auto" },
        "stroke": { "color": "#cbd5e1", "width": 1, "style": "dash" },
        "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#64748b;\">NO</div>",
        "zIndex": 12
      },
      {
        "type": "line", "id": "l-auto-archive", "shape": "elbow",
        "source": { "id": "c-auto", "connection": "E" },
        "target": { "marker": "arrow", "id": "c-archive" },
        "stroke": { "color": "#cbd5e1", "width": 1 },
        "zIndex": 13
      },
      {
        "type": "line", "id": "l-approve-archive", "shape": "elbow",
        "source": { "id": "c-approve", "connection": "S" },
        "target": { "marker": "arrow", "id": "c-archive" },
        "stroke": { "color": "#cbd5e1", "width": 1 },
        "zIndex": 14
      },
      {
        "type": "geometry", "id": "badge-v1", "shape": "process",
        "fill": { "color": "#0f172a" },
        "x": 0, "y": 98, "width": 55, "height": 22,
        "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#ffffff;letter-spacing:0.03em;\">ENTRY</div>",
        "zIndex": 20
      }
    ]
  }
}
```

### 示例 3：三层数据管线蓝图

9 组件 + 3 层级标签，展示纵向多行、横向多列的网格布局。

```
+--[ canvas frame ]--------------------------------------------+
|                                                              |
|  +======================================================+   |
|  | 数据管线蓝图                                [PROD]    |   |
|  | DATA PIPELINE / v2.1                                 |   |
|  +──────────────────────────────────────────────────────+   |
|                                                              |
|  ── INGEST ───────────────────────────────────────────────  |
|  [Kafka]  ──→  [Flink ETL]  ──→  [Data Lake]                |
|                                                              |
|  ── PROCESS ──────────────────────────────────────────────  |
|  [Spark Job]  ──→  [Feature Store]  ──→  [Model Registry]    |
|                                                              |
|  ── SERVE ────────────────────────────────────────────────  |
|  [API Gateway]  ──→  [Inference Svc]  ─.dash.→ [Dashboard]  |
|                                                              |
+--------------------------------------------------------------+
```

```json
{
  "id": "bp-pipeline-001",
  "cardType": "board",
  "viewportOption": "adapt",
  "search": "数据管线蓝图 Kafka Flink Data Lake Spark Feature Store Model Registry API Gateway Inference Dashboard",
  "graphicsBBox": { "x": -30, "y": -30, "width": 780, "height": 650 },
  "diagramData": {
    "head": { "version": "2.0.0", "theme": { "name": "default" } },
    "body": [
      {
        "type": "geometry", "id": "canvas", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": -30, "y": -30, "width": 780, "height": 650,
        "zIndex": 0
      },
      {
        "type": "geometry", "id": "hdr", "shape": "process",
        "fill": { "color": "#F8FAFC" },
        "x": 0, "y": 0, "width": 720, "height": 80,
        "html": "<div style=\"padding:8px 12px;\"><div style=\"border-bottom:1px solid #cbd5e1;padding-bottom:10px;\"><div style=\"font-size:20px;font-weight:600;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;margin-bottom:4px;\">数据管线蓝图</div><div style=\"font-size:11px;font-weight:500;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:system-ui,-apple-system,sans-serif;\">DATA PIPELINE / v2.1</div></div></div>",
        "zIndex": 1
      },
      {
        "type": "geometry", "id": "badge-prod", "shape": "process",
        "fill": { "color": "#0f172a" },
        "x": 650, "y": 12, "width": 55, "height": 22,
        "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#ffffff;letter-spacing:0.03em;\">PROD</div>",
        "zIndex": 20
      },
      {
        "type": "text", "id": "sec-ingest", "shape": "text",
        "html": "<div style=\"font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;font-family:system-ui,-apple-system,sans-serif;\">INGEST</div>",
        "x": 0, "y": 104,
        "zIndex": 20
      },
      {
        "type": "geometry", "id": "c-kafka", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 0, "y": 120, "width": 200, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">MESSAGE BROKER</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">Kafka</div></div>",
        "zIndex": 2
      },
      {
        "type": "geometry", "id": "c-flink", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 260, "y": 120, "width": 200, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">STREAM ETL</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">Flink</div></div>",
        "zIndex": 3
      },
      {
        "type": "geometry", "id": "c-lake", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 520, "y": 120, "width": 200, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">STORAGE</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">Data Lake</div><div style=\"font-size:10px;color:#94a3b8;font-family:monospace;\">OSS / Delta Lake</div></div>",
        "zIndex": 4
      },
      {
        "type": "text", "id": "sec-process", "shape": "text",
        "html": "<div style=\"font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;font-family:system-ui,-apple-system,sans-serif;\">PROCESS</div>",
        "x": 0, "y": 254,
        "zIndex": 20
      },
      {
        "type": "geometry", "id": "c-spark", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 0, "y": 270, "width": 200, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">BATCH COMPUTE</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">Spark Job</div></div>",
        "zIndex": 5
      },
      {
        "type": "geometry", "id": "c-feature", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 260, "y": 270, "width": 200, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">FEATURE STORE</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">Feature Store</div></div>",
        "zIndex": 6
      },
      {
        "type": "geometry", "id": "c-model", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 520, "y": 270, "width": 200, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">ML REGISTRY</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">Model Registry</div></div>",
        "zIndex": 7
      },
      {
        "type": "text", "id": "sec-serve", "shape": "text",
        "html": "<div style=\"font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;font-family:system-ui,-apple-system,sans-serif;\">SERVE</div>",
        "x": 0, "y": 404,
        "zIndex": 20
      },
      {
        "type": "geometry", "id": "c-apigw", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 0, "y": 420, "width": 200, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">ENTRY POINT</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">API Gateway</div></div>",
        "zIndex": 8
      },
      {
        "type": "geometry", "id": "c-infer", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 260, "y": 420, "width": 200, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">INFERENCE</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">Inference Svc</div></div>",
        "zIndex": 9
      },
      {
        "type": "geometry", "id": "c-dash", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 520, "y": 420, "width": 200, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">OBSERVABILITY</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">Dashboard</div></div>",
        "zIndex": 10
      },
      { "type": "line", "id": "l-kafka-flink", "shape": "elbow", "source": { "id": "c-kafka", "connection": "E" }, "target": { "marker": "arrow", "id": "c-flink" }, "stroke": { "color": "#cbd5e1", "width": 1 }, "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#64748b;\">STREAM</div>", "zIndex": 11 },
      { "type": "line", "id": "l-flink-lake", "shape": "elbow", "source": { "id": "c-flink", "connection": "E" }, "target": { "marker": "arrow", "id": "c-lake" }, "stroke": { "color": "#cbd5e1", "width": 1 }, "zIndex": 12 },
      { "type": "line", "id": "l-lake-spark", "shape": "elbow", "source": { "id": "c-lake", "connection": "S" }, "target": { "marker": "arrow", "id": "c-model" }, "stroke": { "color": "#cbd5e1", "width": 1, "style": "dash" }, "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#64748b;\">SCHEDULE</div>", "zIndex": 13 },
      { "type": "line", "id": "l-spark-feature", "shape": "elbow", "source": { "id": "c-spark", "connection": "E" }, "target": { "marker": "arrow", "id": "c-feature" }, "stroke": { "color": "#cbd5e1", "width": 1 }, "zIndex": 14 },
      { "type": "line", "id": "l-feature-model", "shape": "elbow", "source": { "id": "c-feature", "connection": "E" }, "target": { "marker": "arrow", "id": "c-model" }, "stroke": { "color": "#cbd5e1", "width": 1 }, "zIndex": 15 },
      { "type": "line", "id": "l-apigw-infer", "shape": "elbow", "source": { "id": "c-apigw", "connection": "E" }, "target": { "marker": "arrow", "id": "c-infer" }, "stroke": { "color": "#cbd5e1", "width": 1 }, "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#64748b;\">gRPC</div>", "zIndex": 16 },
      { "type": "line", "id": "l-infer-dash", "shape": "elbow", "source": { "id": "c-infer", "connection": "E" }, "target": { "marker": "arrow", "id": "c-dash" }, "stroke": { "color": "#cbd5e1", "width": 1, "style": "dash" }, "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#64748b;\">METRICS</div>", "zIndex": 17 },
      { "type": "line", "id": "l-model-infer", "shape": "elbow", "source": { "id": "c-model", "connection": "S" }, "target": { "marker": "arrow", "id": "c-infer" }, "stroke": { "color": "#cbd5e1", "width": 1 }, "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#64748b;\">DEPLOY</div>", "zIndex": 18 }
    ]
  }
}
```

### 示例 4：紧凑双列对比蓝图

小型蓝图，4 组件 + 2 行 2 列对称布局，展示紧凑型设计。无层级标签，用于简单对比场景。

```
+--[ canvas frame ]-------------------+
|                                     |
|  +==============================+   |
|  | 部署对比                      |   |
|  | DEPLOYMENT / CURRENT vs NEXT |   |
|  +──────────────────────────────+   |
|                                     |
|  [Current: K8s]   [Next: Serverless]|
|       ↓                ↓            |
|  [MySQL 5.7]       [PolarDB]       |
|                                     |
+-------------------------------------+
```

```json
{
  "id": "bp-compare-001",
  "cardType": "board",
  "viewportOption": "adapt",
  "search": "部署对比 Current K8s Next Serverless MySQL PolarDB",
  "graphicsBBox": { "x": -30, "y": -30, "width": 540, "height": 380 },
  "diagramData": {
    "head": { "version": "2.0.0", "theme": { "name": "default" } },
    "body": [
      {
        "type": "geometry", "id": "canvas", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": -30, "y": -30, "width": 540, "height": 380,
        "zIndex": 0
      },
      {
        "type": "geometry", "id": "hdr", "shape": "process",
        "fill": { "color": "#F8FAFC" },
        "x": 0, "y": 0, "width": 480, "height": 80,
        "html": "<div style=\"padding:8px 12px;\"><div style=\"border-bottom:1px solid #cbd5e1;padding-bottom:10px;\"><div style=\"font-size:20px;font-weight:600;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;margin-bottom:4px;\">部署对比</div><div style=\"font-size:11px;font-weight:500;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:system-ui,-apple-system,sans-serif;\">DEPLOYMENT / CURRENT vs NEXT</div></div></div>",
        "zIndex": 1
      },
      {
        "type": "geometry", "id": "c-curr-app", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 0, "y": 120, "width": 220, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">CURRENT / COMPUTE</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">Kubernetes</div><div style=\"font-size:10px;color:#94a3b8;font-family:monospace;\">3 nodes · 16 vCPU each</div></div>",
        "zIndex": 2
      },
      {
        "type": "geometry", "id": "c-next-app", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 260, "y": 120, "width": 220, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#dc2626;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">NEXT / COMPUTE</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">Serverless</div><div style=\"font-size:10px;color:#94a3b8;font-family:monospace;\">auto-scale · pay-per-use</div></div>",
        "zIndex": 3
      },
      {
        "type": "geometry", "id": "c-curr-db", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 0, "y": 270, "width": 220, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">CURRENT / DATABASE</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">MySQL 5.7</div><div style=\"font-size:10px;color:#94a3b8;font-family:monospace;\">primary-replica · 500 GB</div></div>",
        "zIndex": 4
      },
      {
        "type": "geometry", "id": "c-next-db", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 260, "y": 270, "width": 220, "height": 90,
        "html": "<div style=\"padding:10px 8px;\"><div style=\"font-size:12px;color:#dc2626;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin-bottom:6px;\">NEXT / DATABASE</div><div style=\"font-size:14px;color:#0f172a;font-weight:500;font-family:monospace;\">PolarDB</div><div style=\"font-size:10px;color:#94a3b8;font-family:monospace;\">serverless · auto-storage</div></div>",
        "zIndex": 5
      },
      { "type": "line", "id": "l-curr-v", "shape": "elbow", "source": { "id": "c-curr-app", "connection": "S" }, "target": { "marker": "arrow", "id": "c-curr-db" }, "stroke": { "color": "#cbd5e1", "width": 1 }, "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#64748b;\">SQL</div>", "zIndex": 10 },
      { "type": "line", "id": "l-next-v", "shape": "elbow", "source": { "id": "c-next-app", "connection": "S" }, "target": { "marker": "arrow", "id": "c-next-db" }, "stroke": { "color": "#cbd5e1", "width": 1 }, "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#64748b;\">SQL</div>", "zIndex": 11 },
      { "type": "line", "id": "l-migrate-app", "shape": "straight", "source": { "id": "c-curr-app", "connection": "E" }, "target": { "marker": "arrow", "id": "c-next-app" }, "stroke": { "color": "#cbd5e1", "width": 1, "style": "dash" }, "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#dc2626;\">MIGRATE</div>", "zIndex": 12 },
      { "type": "line", "id": "l-migrate-db", "shape": "straight", "source": { "id": "c-curr-db", "connection": "E" }, "target": { "marker": "arrow", "id": "c-next-db" }, "stroke": { "color": "#cbd5e1", "width": 1, "style": "dash" }, "html": "<div style=\"text-align:center;font-family:monospace;font-size:10px;color:#dc2626;\">DTS</div>", "zIndex": 13 }
    ]
  }
}
```

### 创建文档

```bash
# 1. 将上述 JSON 编码为 Lake 卡片
#    value = "data:" + encodeURIComponent(JSON.stringify(boardValue))
#    Lake HTML = '<card type="block" name="board" value="' + value + '"></card>'
#    将 Lake HTML 写入临时文件

# 2. 创建新文档（UTF-8 文件传递大内容）
yq doc create OWNER/BOOK --title "系统架构蓝图" \
  --body-file ./board.lake --format lake

# 或更新已有文档
yq doc update DOC_URL --body-file ./board.lake --format lake
```

## 生成流程

1. **理解需求**：确认用户要画什么系统/架构
2. **规划布局**：确定组件数量、层级关系、连接方向，按网格计算坐标
3. **构建 body 数组**：按模板依次填充 → 画布边框 → 标题区 → 层级标签 → 组件块 → 连接线 → 徽章/注释
4. **计算画布尺寸**：canvas frame 宽高 = 内容区 + 四周 30px padding
5. **组装 board value**：设置 `id`、`cardType: "board"`、`viewportOption: "adapt"`、`diagramData`、`search`、`graphicsBBox`
6. **编码为 Lake 卡片**：`JSON.stringify` → `encodeURIComponent` → 按该样本加 `data:` 前缀 → 嵌入 `<card>` 标签
7. **写入临时文件**：将 Lake HTML 写入临时文件（board 卡片通常超过 10KB）
8. **提交到语雀**：通过 `doc create`（新建）或 `doc update`（更新），使用 `--body-file` 传递大内容

## Board 与 HTML 的关键差异

生成蓝图时需注意以下 board 限制，以及对应的还原策略：

| Blueprinter HTML | Board 限制 | 还原策略 |
|---|---|---|
| `border-bottom` 仅底部边框 | geometry 四面都有边框 | 在 html 内部用 `<div style="border-bottom:...">` 实现 |
| `padding: 32px` 画布内边距 | geometry 无 padding 概念 | 用 canvas frame + 坐标偏移 30px 模拟 |
| Google Fonts (Inter) | 无外部字体加载 | 用 `system-ui,-apple-system,sans-serif` 替代 |
| Google Fonts (JetBrains Mono) | 无外部字体加载 | 用 `monospace` 替代（系统等宽字体） |
| CSS Grid 自动对齐 | 手动 x/y 坐标 | 按网格公式严格计算 |
| `stroke-width: 1` 精确控制 | board 主题影响边框 | `stroke.width: 1` 对连接线有效，geometry 边框由主题控制 |
| 无装饰 (no shadow/gradient) | board 默认主题已满足 | 使用 `default` 主题即可 |

## 注意事项

- `viewportOption` 始终用 `"adapt"`，确保蓝图自适应显示区域
- `search` 字段拼接所有可见文本（标题、标签、值），便于语雀全文搜索
- `graphicsBBox` 需包含 canvas frame 的负坐标起点（如 `x: -30, y: -30`）
- 组件 ID 使用有意义的前缀：`canvas` 画布、`hdr` 标题、`sec-` 层级标签、`c-` 组件、`l-` 连接线、`badge-` 徽章、`t-` 文本
- 标题区宽度 = 最右列 x + 组件宽，确保与内容区等宽
- 如果组件内文字较长，加宽组件并相应调整后续列的 x 坐标
- 画布边框宽高 = 标题区宽度 + 60（左右各 30px），内容最底边 + 60（上下各 30px）
