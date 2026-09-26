# 架构图（Architecture Diagram）

> 从原 OpenAuth 技能移植的结构与设计参考，不是公网 API 的完整稳定规范。提交使用 `doc create/update --format lake --body-file FILE`；CLI 将正文映射到 Web API 的 `body_asl` 并发布核验。保留已有卡片编码与未知字段。新卡片须在 Chrome 验证渲染；API 回读相同只证明存储。

在语雀中生成专业的架构图（Architecture Diagram）。使用 board 画板卡片实现，语义色彩区分组件类型，输出为标准语雀文档。

## 触发场景

用户提到：架构图、系统架构、architecture diagram、基础设施图、云架构图、微服务架构图、部署架构图。

注意与「蓝图」场景的区别：
- **蓝图**（blueprint）：黑白灰 + 单色强调、工程图纸风格、monospace 大写标签、无彩色填充
- **架构图**（architecture diagram）：白色背景、彩色语义编码、组件类型一目了然、适合展示系统全景

## 视觉规则

核心原则：**语义色彩 + 清晰层次**。每种组件类型有专属颜色（淡彩填充 + 饱和边框），一眼可辨。

### 强制

- 画布背景使用白色 `#FFFFFF`
- 所有组件按类型使用语义色（见色板）— 淡彩填充 + 饱和色边框
- 字体：标题用 `system-ui,-apple-system,sans-serif`，组件标签/值用 `monospace`
- 组件名 12px 深色粗体，副标签 9px `#64748b`，技术细节 8px 类型色
- 布局严格网格对齐
- 每个架构图必须有**画布边框**（canvas frame）作为底层背景
- 底部放置**图例**（legend）标注颜色含义
- 可选使用**区域边界**（region boundary）对组件分组

### 禁止

- 不使用 emoji 或装饰性图标
- 不使用全大写标签（那是蓝图的风格）

## 色板

### 组件类型色

| 组件类型 | Board `fill.color` | Board `stroke.color` | 用途 |
|----------|--------------------|--------------------|------|
| 前端 Frontend | `#ecfeff` (cyan-50) | `#06b6d4` (cyan-500) | 客户端、UI、浏览器、移动端 |
| 后端 Backend | `#ecfdf5` (emerald-50) | `#10b981` (emerald-500) | 服务端、API、微服务 |
| 数据库 Database | `#f5f3ff` (violet-50) | `#8b5cf6` (violet-500) | 数据库、存储、缓存 |
| 云服务 Cloud | `#fffbeb` (amber-50) | `#f59e0b` (amber-500) | 云服务、CDN、网关、基础设施 |
| 安全 Security | `#fff1f2` (rose-50) | `#f43f5e` (rose-500) | 认证、安全组、加密 |
| 消息总线 Message | `#fff7ed` (orange-50) | `#f97316` (orange-500) | Kafka、RabbitMQ、事件总线 |
| 外部/通用 External | `#f8fafc` (slate-50) | `#94a3b8` (slate-400) | 外部系统、用户、通用 |

### 画布与结构色

| 用途 | 色值 | 说明 |
|------|------|------|
| 画布背景 | `#FFFFFF` | 白色底板 |
| 标题区背景 | `#f8fafc` | slate-50，极浅灰 |
| 区域边界边框 | 使用类型色的中等饱和度 | 虚线边框 |
| 连接线 | `#94a3b8` | slate-400 |
| 主文字 | `#0f172a` | slate-900，深色 |
| 次文字 | `#64748b` | slate-500，副标签/注释 |
| 强调色文字 | 使用对应类型色 | 端口号、协议 |

## 元素模板

### 画布边框（Canvas Frame）

**必须有。** 白色矩形作为所有内容的底板。board 默认主题会渲染 1px 边框。zIndex 为 0。

```json
{
  "type": "geometry", "id": "canvas", "shape": "process",
  "fill": { "color": "#FFFFFF" },
  "x": -30, "y": -30, "width": 960, "height": 660,
  "zIndex": 0
}
```

### 标题区

浅灰矩形，内含标题和副标题。标题左侧带一个彩色圆点状态指示。内部用 `border-bottom` 分隔线。

```json
{
  "type": "geometry", "id": "hdr", "shape": "process",
  "fill": { "color": "#f8fafc" },
  "x": 0, "y": 0, "width": 900, "height": 70,
  "html": "<div style=\"padding:10px 16px;\"><div style=\"border-bottom:1px solid #e2e8f0;padding-bottom:8px;display:flex;align-items:center;gap:10px;\"><div style=\"width:10px;height:10px;border-radius:50%;background:#06b6d4;flex-shrink:0;\"></div><div><div style=\"font-size:18px;font-weight:700;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;letter-spacing:-0.02em;\">标题</div><div style=\"font-size:11px;color:#64748b;font-family:system-ui,-apple-system,sans-serif;margin-top:2px;\">Subtitle description</div></div></div></div>",
  "zIndex": 1
}
```

### 区域边界（Region Boundary）

虚线矩形，用于分组（如 AWS Region、Kubernetes Cluster、VPC）。淡彩填充 + 类型色虚线边框。

```json
{
  "type": "geometry", "id": "region-aws", "shape": "process",
  "fill": { "color": "#fffdf7" },
  "stroke": { "color": "#f59e0b", "width": 1, "style": "dash" },
  "x": 160, "y": 100, "width": 720, "height": 420,
  "html": "<div style=\"padding:4px 8px;\"><div style=\"font-size:10px;font-weight:600;color:#d97706;font-family:system-ui,-apple-system,sans-serif;\">AWS Region: us-west-2</div></div>",
  "zIndex": 1
}
```

### 安全组边界（Security Group）

虚线矩形，rose 色。包裹需要安全隔离的组件。

```json
{
  "type": "geometry", "id": "sg-web", "shape": "process",
  "fill": { "color": "#FFFFFF" },
  "stroke": { "color": "#f43f5e", "width": 1, "style": "dash" },
  "x": 200, "y": 140, "width": 200, "height": 120,
  "html": "<div style=\"padding:2px 6px;\"><div style=\"font-size:8px;color:#e11d48;font-family:monospace;\">sg-web :443</div></div>",
  "zIndex": 2
}
```

### 组件块（Component Box）

核心元素。根据组件类型选择对应色彩。淡彩填充 + 饱和色边框。名称深色粗体，副标签灰色，端口号用类型色。

#### 标准组件（单行）

```json
{
  "type": "geometry", "id": "c-gateway", "shape": "process",
  "fill": { "color": "#fffbeb" },
  "stroke": { "color": "#f59e0b", "width": 1 },
  "x": 200, "y": 160, "width": 160, "height": 70,
  "html": "<div style=\"padding:8px 10px;\"><div style=\"font-size:12px;font-weight:600;color:#0f172a;font-family:monospace;margin-bottom:4px;\">CloudFront</div><div style=\"font-size:9px;color:#64748b;font-family:monospace;\">CDN</div></div>",
  "zIndex": 3
}
```

#### 多行组件（含细节）

```json
{
  "type": "geometry", "id": "c-api", "shape": "process",
  "fill": { "color": "#ecfdf5" },
  "stroke": { "color": "#10b981", "width": 1 },
  "x": 400, "y": 150, "width": 160, "height": 100,
  "html": "<div style=\"padding:8px 10px;\"><div style=\"font-size:12px;font-weight:600;color:#0f172a;font-family:monospace;margin-bottom:4px;\">API Server</div><div style=\"font-size:9px;color:#64748b;font-family:monospace;line-height:1.5;\">Node.js<br>Express<br>REST API</div><div style=\"font-size:8px;color:#10b981;font-family:monospace;margin-top:4px;\">:8080</div></div>",
  "zIndex": 3
}
```

#### 紧凑组件（消息总线/小型服务）

高度较矮，用于消息总线、队列等辅助组件。

```json
{
  "type": "geometry", "id": "c-kafka", "shape": "process",
  "fill": { "color": "#fff7ed" },
  "stroke": { "color": "#f97316", "width": 1 },
  "x": 400, "y": 260, "width": 140, "height": 30,
  "html": "<div style=\"text-align:center;font-size:8px;color:#ea580c;font-family:monospace;\">Kafka / RabbitMQ</div>",
  "zIndex": 3
}
```

### 连接线

灰色折线。

#### 标准连接（带标签）

```json
{
  "type": "line", "id": "l-user-gw", "shape": "elbow",
  "source": { "id": "c-user", "connection": "E" },
  "target": { "marker": "arrow", "id": "c-gateway" },
  "stroke": { "color": "#94a3b8", "width": 1 },
  "html": "<div style=\"text-align:center;font-family:monospace;font-size:9px;color:#64748b;\">HTTPS</div>",
  "zIndex": 10
}
```

#### 安全/认证流连接（虚线 rose 色）

```json
{
  "type": "line", "id": "l-auth-flow", "shape": "elbow",
  "source": { "id": "c-auth", "connection": "S" },
  "target": { "marker": "arrow", "id": "c-api" },
  "stroke": { "color": "#f43f5e", "width": 1, "style": "dash" },
  "html": "<div style=\"text-align:center;font-family:monospace;font-size:9px;color:#e11d48;\">JWT</div>",
  "zIndex": 10
}
```

#### 消息/事件连接（虚线 orange 色）

```json
{
  "type": "line", "id": "l-event", "shape": "elbow",
  "source": { "id": "c-svc", "connection": "S" },
  "target": { "marker": "arrow", "id": "c-kafka" },
  "stroke": { "color": "#f97316", "width": 1, "style": "dash" },
  "zIndex": 10
}
```

### 图例（Legend）

放置在画布底部，列出所有使用的组件类型及其颜色。

```json
{
  "type": "geometry", "id": "legend", "shape": "process",
  "fill": { "color": "#f8fafc" },
  "x": 0, "y": 540, "width": 900, "height": 40,
  "html": "<div style=\"padding:6px 16px;display:flex;align-items:center;gap:20px;\"><div style=\"font-size:10px;font-weight:600;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;margin-right:4px;\">Legend</div><div style=\"display:flex;align-items:center;gap:4px;\"><div style=\"width:12px;height:8px;background:#ecfeff;border:1px solid #06b6d4;border-radius:1px;\"></div><span style=\"font-size:8px;color:#64748b;font-family:monospace;\">Frontend</span></div><div style=\"display:flex;align-items:center;gap:4px;\"><div style=\"width:12px;height:8px;background:#ecfdf5;border:1px solid #10b981;border-radius:1px;\"></div><span style=\"font-size:8px;color:#64748b;font-family:monospace;\">Backend</span></div><div style=\"display:flex;align-items:center;gap:4px;\"><div style=\"width:12px;height:8px;background:#fffbeb;border:1px solid #f59e0b;border-radius:1px;\"></div><span style=\"font-size:8px;color:#64748b;font-family:monospace;\">Cloud</span></div><div style=\"display:flex;align-items:center;gap:4px;\"><div style=\"width:12px;height:8px;background:#f5f3ff;border:1px solid #8b5cf6;border-radius:1px;\"></div><span style=\"font-size:8px;color:#64748b;font-family:monospace;\">Database</span></div></div>",
  "zIndex": 20
}
```

> 图例只展示当前架构图中实际使用的类型。不必列出所有 7 种。

### 信息卡片组（Info Cards）

在架构图下方展示补充信息。每张卡片有彩色圆点 + 标题 + 列表。

```json
{
  "type": "geometry", "id": "card-1", "shape": "process",
  "fill": { "color": "#FFFFFF" },
  "x": 0, "y": 600, "width": 290, "height": 110,
  "html": "<div style=\"padding:10px 12px;\"><div style=\"display:flex;align-items:center;gap:6px;margin-bottom:6px;\"><div style=\"width:8px;height:8px;border-radius:50%;background:#06b6d4;\"></div><div style=\"font-size:11px;font-weight:600;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;\">Frontend Stack</div></div><div style=\"font-size:10px;color:#64748b;font-family:monospace;line-height:1.8;\">• React 18 with hooks<br>• TypeScript<br>• Tailwind CSS</div></div>",
  "zIndex": 2
}
```

### 浮动文本（注释）

```json
{
  "type": "text", "id": "t-note", "shape": "text",
  "html": "<div style=\"font-family:monospace;font-size:9px;color:#64748b;\">TLS 1.3</div>",
  "x": 300, "y": 125,
  "zIndex": 15
}
```

## 布局网格

### 基本尺寸

| 参数 | 值 | 说明 |
|------|-----|------|
| 画布 padding | 30px | canvas frame 四周留白 |
| 标题区高 | 70px | 含圆点状态指示器 |
| 标题下间距 | 30px | 标题区到首行组件或区域边界 |
| 组件宽 | 160px | 标准宽度，可按内容加宽至 180/200 |
| 组件高（标准） | 70px | 单行或双行内容 |
| 组件高（多行） | 100px | 三行以上内容 |
| 组件高（紧凑） | 30px | 消息总线/小型辅助 |
| 水平间距 | 50px | 组件间距 |
| 垂直间距 | 50px | 行间距 |
| 区域边界 padding | 20px | 区域边界内的留白 |
| 图例高 | 40px | 固定 |
| 信息卡片高 | 110px | 固定 |
| 信息卡片间距 | 15px | 卡片之间的水平间距 |

### 坐标计算

```
画布边框:     x=-30, y=-30, width=内容宽+60, height=内容高+60

标题区:       x=0, y=0, width=总宽, height=70
区域边界:     x=根据内容, y=100, width/height=包含所有子组件+padding
首行组件:     y=120（区域边界内）
第二行:       y=120+70+50=240
第三行:       y=240+70+50=360

首列:         x=0（或区域边界内 x+20）
第二列:       x=160+50=210
第三列:       x=210+160+50=420

图例:         y=区域边界底部+20
信息卡片:     y=图例底部+20

标题区宽度 = 最右组件 x + 组件宽
画布宽 = 标题区宽度 + 60
画布高 = 最底元素底部 + 60
```

### 连接方向约定

- 同行左右连接：源 `"E"` → 目标 `"W"`
- 上下行连接：源 `"S"` → 目标 `"N"`
- 反向或回路：使用 `"W"` 或 `"N"`
- 认证流（虚线）：通常从安全组件向下 `"S"` 或向右 `"E"`

### zIndex 分层

| 层 | 范围 | 用途 |
|---|---|---|
| 画布 | 0 | 白色画布底板 |
| 标题/区域边界 | 1 | 标题区 + 区域分组 |
| 安全组/信息卡片 | 2 | 安全组边界、信息卡片 |
| 组件层 | 3-9 | 组件块 |
| 连接层 | 10-19 | 连接线 |
| 标注层 | 20+ | 图例、浮动文本 |

## 完整示例

### 示例 1：Web 应用架构

三层 Web 应用架构：前端 → 后端 → 数据库，含图例和信息卡片。

```json
{
  "id": "arch-webapp-001",
  "cardType": "board",
  "viewportOption": "adapt",
  "search": "Web Application Architecture React Node.js PostgreSQL Frontend Backend Database Users",
  "graphicsBBox": { "x": -30, "y": -30, "width": 870, "height": 460 },
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
        "x": -30, "y": -30, "width": 870, "height": 460,
        "zIndex": 0
      },
      {
        "type": "geometry", "id": "hdr", "shape": "process",
        "fill": { "color": "#f8fafc" },
        "x": 0, "y": 0, "width": 810, "height": 70,
        "html": "<div style=\"padding:10px 16px;\"><div style=\"border-bottom:1px solid #e2e8f0;padding-bottom:8px;display:flex;align-items:center;gap:10px;\"><div style=\"width:10px;height:10px;border-radius:50%;background:#06b6d4;flex-shrink:0;\"></div><div><div style=\"font-size:18px;font-weight:700;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;letter-spacing:-0.02em;\">Web Application Architecture</div><div style=\"font-size:11px;color:#64748b;font-family:system-ui,-apple-system,sans-serif;margin-top:2px;\">React + Node.js + PostgreSQL stack</div></div></div></div>",
        "zIndex": 1
      },
      {
        "type": "geometry", "id": "c-users", "shape": "process",
        "fill": { "color": "#f8fafc" },
        "stroke": { "color": "#94a3b8", "width": 1 },
        "x": 0, "y": 120, "width": 130, "height": 80,
        "html": "<div style=\"padding:8px 10px;\"><div style=\"font-size:12px;font-weight:600;color:#0f172a;font-family:monospace;margin-bottom:4px;\">Users</div><div style=\"font-size:9px;color:#64748b;font-family:monospace;\">Browser</div></div>",
        "zIndex": 3
      },
      {
        "type": "geometry", "id": "c-frontend", "shape": "process",
        "fill": { "color": "#ecfeff" },
        "stroke": { "color": "#06b6d4", "width": 1 },
        "x": 200, "y": 110, "width": 160, "height": 100,
        "html": "<div style=\"padding:8px 10px;\"><div style=\"font-size:12px;font-weight:600;color:#0f172a;font-family:monospace;margin-bottom:4px;\">Frontend</div><div style=\"font-size:9px;color:#64748b;font-family:monospace;line-height:1.5;\">React<br>TypeScript<br>Tailwind CSS</div><div style=\"font-size:8px;color:#0891b2;font-family:monospace;margin-top:4px;\">:3000</div></div>",
        "zIndex": 3
      },
      {
        "type": "geometry", "id": "c-backend", "shape": "process",
        "fill": { "color": "#ecfdf5" },
        "stroke": { "color": "#10b981", "width": 1 },
        "x": 420, "y": 110, "width": 160, "height": 100,
        "html": "<div style=\"padding:8px 10px;\"><div style=\"font-size:12px;font-weight:600;color:#0f172a;font-family:monospace;margin-bottom:4px;\">Backend</div><div style=\"font-size:9px;color:#64748b;font-family:monospace;line-height:1.5;\">Node.js<br>Express<br>REST API</div><div style=\"font-size:8px;color:#059669;font-family:monospace;margin-top:4px;\">:8080</div></div>",
        "zIndex": 3
      },
      {
        "type": "geometry", "id": "c-db", "shape": "process",
        "fill": { "color": "#f5f3ff" },
        "stroke": { "color": "#8b5cf6", "width": 1 },
        "x": 640, "y": 115, "width": 160, "height": 90,
        "html": "<div style=\"padding:8px 10px;\"><div style=\"font-size:12px;font-weight:600;color:#0f172a;font-family:monospace;margin-bottom:4px;\">PostgreSQL</div><div style=\"font-size:9px;color:#64748b;font-family:monospace;\">Database</div><div style=\"font-size:8px;color:#7c3aed;font-family:monospace;margin-top:4px;\">:5432</div></div>",
        "zIndex": 3
      },
      {
        "type": "line", "id": "l-users-fe", "shape": "elbow",
        "source": { "id": "c-users", "connection": "E" },
        "target": { "marker": "arrow", "id": "c-frontend" },
        "stroke": { "color": "#94a3b8", "width": 1 },
        "html": "<div style=\"text-align:center;font-family:monospace;font-size:9px;color:#64748b;\">HTTPS</div>",
        "zIndex": 10
      },
      {
        "type": "line", "id": "l-fe-be", "shape": "elbow",
        "source": { "id": "c-frontend", "connection": "E" },
        "target": { "marker": "arrow", "id": "c-backend" },
        "stroke": { "color": "#94a3b8", "width": 1 },
        "html": "<div style=\"text-align:center;font-family:monospace;font-size:9px;color:#64748b;\">REST API</div>",
        "zIndex": 11
      },
      {
        "type": "line", "id": "l-be-db", "shape": "elbow",
        "source": { "id": "c-backend", "connection": "E" },
        "target": { "marker": "arrow", "id": "c-db" },
        "stroke": { "color": "#94a3b8", "width": 1 },
        "html": "<div style=\"text-align:center;font-family:monospace;font-size:9px;color:#64748b;\">SQL</div>",
        "zIndex": 12
      },
      {
        "type": "geometry", "id": "legend", "shape": "process",
        "fill": { "color": "#f8fafc" },
        "x": 0, "y": 260, "width": 810, "height": 36,
        "html": "<div style=\"padding:6px 16px;display:flex;align-items:center;gap:20px;\"><div style=\"font-size:10px;font-weight:600;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;margin-right:4px;\">Legend</div><div style=\"display:flex;align-items:center;gap:4px;\"><div style=\"width:12px;height:8px;background:#ecfeff;border:1px solid #06b6d4;border-radius:1px;\"></div><span style=\"font-size:8px;color:#64748b;font-family:monospace;\">Frontend</span></div><div style=\"display:flex;align-items:center;gap:4px;\"><div style=\"width:12px;height:8px;background:#ecfdf5;border:1px solid #10b981;border-radius:1px;\"></div><span style=\"font-size:8px;color:#64748b;font-family:monospace;\">Backend</span></div><div style=\"display:flex;align-items:center;gap:4px;\"><div style=\"width:12px;height:8px;background:#f5f3ff;border:1px solid #8b5cf6;border-radius:1px;\"></div><span style=\"font-size:8px;color:#64748b;font-family:monospace;\">Database</span></div></div>",
        "zIndex": 20
      },
      {
        "type": "geometry", "id": "card-fe", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 0, "y": 316, "width": 260, "height": 100,
        "html": "<div style=\"padding:10px 12px;\"><div style=\"display:flex;align-items:center;gap:6px;margin-bottom:6px;\"><div style=\"width:8px;height:8px;border-radius:50%;background:#06b6d4;\"></div><div style=\"font-size:11px;font-weight:600;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;\">Frontend Stack</div></div><div style=\"font-size:10px;color:#64748b;font-family:monospace;line-height:1.7;\">• React 18 with hooks<br>• TypeScript for type safety<br>• Tailwind CSS styling<br>• Vite build tool</div></div>",
        "zIndex": 2
      },
      {
        "type": "geometry", "id": "card-be", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 275, "y": 316, "width": 260, "height": 100,
        "html": "<div style=\"padding:10px 12px;\"><div style=\"display:flex;align-items:center;gap:6px;margin-bottom:6px;\"><div style=\"width:8px;height:8px;border-radius:50%;background:#10b981;\"></div><div style=\"font-size:11px;font-weight:600;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;\">Backend Stack</div></div><div style=\"font-size:10px;color:#64748b;font-family:monospace;line-height:1.7;\">• Node.js runtime<br>• Express framework<br>• JWT authentication<br>• REST API design</div></div>",
        "zIndex": 2
      },
      {
        "type": "geometry", "id": "card-db", "shape": "process",
        "fill": { "color": "#FFFFFF" },
        "x": 550, "y": 316, "width": 260, "height": 100,
        "html": "<div style=\"padding:10px 12px;\"><div style=\"display:flex;align-items:center;gap:6px;margin-bottom:6px;\"><div style=\"width:8px;height:8px;border-radius:50%;background:#8b5cf6;\"></div><div style=\"font-size:11px;font-weight:600;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;\">Data Layer</div></div><div style=\"font-size:10px;color:#64748b;font-family:monospace;line-height:1.7;\">• PostgreSQL database<br>• Prisma ORM<br>• Redis caching<br>• S3 file storage</div></div>",
        "zIndex": 2
      }
    ]
  }
}
```

### 示例 2：微服务架构（含区域边界、消息总线、安全网关）

```json
{
  "id": "arch-micro-001",
  "cardType": "board",
  "viewportOption": "adapt",
  "search": "Microservices Architecture Kubernetes Web App Mobile API Gateway Kong Auth Service User Service Go Order Service Java Product Service Python PostgreSQL MongoDB Elasticsearch Redis Kafka",
  "graphicsBBox": { "x": -30, "y": -30, "width": 1010, "height": 640 },
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
        "x": -30, "y": -30, "width": 1010, "height": 640,
        "zIndex": 0
      },
      {
        "type": "geometry", "id": "hdr", "shape": "process",
        "fill": { "color": "#f8fafc" },
        "x": 0, "y": 0, "width": 950, "height": 70,
        "html": "<div style=\"padding:10px 16px;\"><div style=\"border-bottom:1px solid #e2e8f0;padding-bottom:8px;display:flex;align-items:center;gap:10px;\"><div style=\"width:10px;height:10px;border-radius:50%;background:#10b981;flex-shrink:0;\"></div><div><div style=\"font-size:18px;font-weight:700;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;letter-spacing:-0.02em;\">Microservices Architecture</div><div style=\"font-size:11px;color:#64748b;font-family:system-ui,-apple-system,sans-serif;margin-top:2px;\">Kubernetes-orchestrated services with API Gateway</div></div></div></div>",
        "zIndex": 1
      },
      {
        "type": "geometry", "id": "region-k8s", "shape": "process",
        "fill": { "color": "#f0fdff" },
        "stroke": { "color": "#06b6d4", "width": 1, "style": "dash" },
        "x": 200, "y": 90, "width": 750, "height": 430,
        "html": "<div style=\"padding:4px 8px;\"><div style=\"font-size:10px;font-weight:600;color:#0891b2;font-family:system-ui,-apple-system,sans-serif;\">Kubernetes Cluster</div></div>",
        "zIndex": 1
      },
      {
        "type": "geometry", "id": "c-web", "shape": "process",
        "fill": { "color": "#ecfeff" },
        "stroke": { "color": "#06b6d4", "width": 1 },
        "x": 0, "y": 120, "width": 130, "height": 70,
        "html": "<div style=\"padding:8px 10px;\"><div style=\"font-size:12px;font-weight:600;color:#0f172a;font-family:monospace;margin-bottom:4px;\">Web App</div><div style=\"font-size:9px;color:#64748b;font-family:monospace;\">React SPA</div></div>",
        "zIndex": 3
      },
      {
        "type": "geometry", "id": "c-mobile", "shape": "process",
        "fill": { "color": "#ecfeff" },
        "stroke": { "color": "#06b6d4", "width": 1 },
        "x": 0, "y": 240, "width": 130, "height": 70,
        "html": "<div style=\"padding:8px 10px;\"><div style=\"font-size:12px;font-weight:600;color:#0f172a;font-family:monospace;margin-bottom:4px;\">Mobile App</div><div style=\"font-size:9px;color:#64748b;font-family:monospace;\">iOS/Android</div></div>",
        "zIndex": 3
      },
      {
        "type": "geometry", "id": "c-apigw", "shape": "process",
        "fill": { "color": "#fff1f2" },
        "stroke": { "color": "#f43f5e", "width": 1 },
        "x": 220, "y": 120, "width": 160, "height": 100,
        "html": "<div style=\"padding:8px 10px;\"><div style=\"font-size:12px;font-weight:600;color:#0f172a;font-family:monospace;margin-bottom:4px;\">API Gateway</div><div style=\"font-size:9px;color:#64748b;font-family:monospace;line-height:1.5;\">Kong / Nginx<br>Rate Limiting<br>Auth / Routing</div><div style=\"font-size:8px;color:#e11d48;font-family:monospace;margin-top:4px;\">:443</div></div>",
        "zIndex": 3
      },
      {
        "type": "geometry", "id": "c-auth", "shape": "process",
        "fill": { "color": "#fff1f2" },
        "stroke": { "color": "#f43f5e", "width": 1 },
        "x": 220, "y": 270, "width": 160, "height": 70,
        "html": "<div style=\"padding:8px 10px;\"><div style=\"font-size:12px;font-weight:600;color:#0f172a;font-family:monospace;margin-bottom:4px;\">Auth Service</div><div style=\"font-size:9px;color:#64748b;font-family:monospace;\">OAuth 2.0 / JWT</div></div>",
        "zIndex": 3
      },
      {
        "type": "geometry", "id": "c-user-svc", "shape": "process",
        "fill": { "color": "#ecfdf5" },
        "stroke": { "color": "#10b981", "width": 1 },
        "x": 450, "y": 120, "width": 140, "height": 60,
        "html": "<div style=\"padding:6px 10px;\"><div style=\"font-size:11px;font-weight:600;color:#0f172a;font-family:monospace;margin-bottom:3px;\">User Service</div><div style=\"font-size:8px;color:#64748b;font-family:monospace;\">Go :8081</div></div>",
        "zIndex": 4
      },
      {
        "type": "geometry", "id": "c-order-svc", "shape": "process",
        "fill": { "color": "#ecfdf5" },
        "stroke": { "color": "#10b981", "width": 1 },
        "x": 450, "y": 240, "width": 140, "height": 60,
        "html": "<div style=\"padding:6px 10px;\"><div style=\"font-size:11px;font-weight:600;color:#0f172a;font-family:monospace;margin-bottom:3px;\">Order Service</div><div style=\"font-size:8px;color:#64748b;font-family:monospace;\">Java :8082</div></div>",
        "zIndex": 4
      },
      {
        "type": "geometry", "id": "c-product-svc", "shape": "process",
        "fill": { "color": "#ecfdf5" },
        "stroke": { "color": "#10b981", "width": 1 },
        "x": 450, "y": 360, "width": 140, "height": 60,
        "html": "<div style=\"padding:6px 10px;\"><div style=\"font-size:11px;font-weight:600;color:#0f172a;font-family:monospace;margin-bottom:3px;\">Product Service</div><div style=\"font-size:8px;color:#64748b;font-family:monospace;\">Python :8083</div></div>",
        "zIndex": 4
      },
      {
        "type": "geometry", "id": "c-kafka", "shape": "process",
        "fill": { "color": "#fff7ed" },
        "stroke": { "color": "#f97316", "width": 1 },
        "x": 460, "y": 195, "width": 120, "height": 28,
        "html": "<div style=\"text-align:center;font-size:8px;color:#ea580c;font-family:monospace;line-height:28px;\">Kafka</div>",
        "zIndex": 5
      },
      {
        "type": "geometry", "id": "c-eventbus", "shape": "process",
        "fill": { "color": "#fff7ed" },
        "stroke": { "color": "#f97316", "width": 1 },
        "x": 460, "y": 315, "width": 120, "height": 28,
        "html": "<div style=\"text-align:center;font-size:8px;color:#ea580c;font-family:monospace;line-height:28px;\">Event Bus</div>",
        "zIndex": 5
      },
      {
        "type": "geometry", "id": "c-pg", "shape": "process",
        "fill": { "color": "#f5f3ff" },
        "stroke": { "color": "#8b5cf6", "width": 1 },
        "x": 670, "y": 120, "width": 130, "height": 60,
        "html": "<div style=\"padding:6px 10px;\"><div style=\"font-size:11px;font-weight:600;color:#0f172a;font-family:monospace;margin-bottom:3px;\">PostgreSQL</div><div style=\"font-size:8px;color:#64748b;font-family:monospace;\">Users DB</div></div>",
        "zIndex": 4
      },
      {
        "type": "geometry", "id": "c-mongo", "shape": "process",
        "fill": { "color": "#f5f3ff" },
        "stroke": { "color": "#8b5cf6", "width": 1 },
        "x": 670, "y": 240, "width": 130, "height": 60,
        "html": "<div style=\"padding:6px 10px;\"><div style=\"font-size:11px;font-weight:600;color:#0f172a;font-family:monospace;margin-bottom:3px;\">MongoDB</div><div style=\"font-size:8px;color:#64748b;font-family:monospace;\">Orders DB</div></div>",
        "zIndex": 4
      },
      {
        "type": "geometry", "id": "c-es", "shape": "process",
        "fill": { "color": "#f5f3ff" },
        "stroke": { "color": "#8b5cf6", "width": 1 },
        "x": 670, "y": 360, "width": 130, "height": 60,
        "html": "<div style=\"padding:6px 10px;\"><div style=\"font-size:11px;font-weight:600;color:#0f172a;font-family:monospace;margin-bottom:3px;\">Elasticsearch</div><div style=\"font-size:8px;color:#64748b;font-family:monospace;\">Products</div></div>",
        "zIndex": 4
      },
      {
        "type": "geometry", "id": "c-redis", "shape": "process",
        "fill": { "color": "#f5f3ff" },
        "stroke": { "color": "#8b5cf6", "width": 1 },
        "x": 830, "y": 240, "width": 100, "height": 60,
        "html": "<div style=\"padding:6px 10px;\"><div style=\"font-size:11px;font-weight:600;color:#0f172a;font-family:monospace;margin-bottom:3px;\">Redis</div><div style=\"font-size:8px;color:#64748b;font-family:monospace;\">Cache</div></div>",
        "zIndex": 4
      },
      { "type": "line", "id": "l-web-gw", "shape": "elbow", "source": { "id": "c-web", "connection": "E" }, "target": { "marker": "arrow", "id": "c-apigw" }, "stroke": { "color": "#94a3b8", "width": 1 }, "zIndex": 10 },
      { "type": "line", "id": "l-mob-auth", "shape": "elbow", "source": { "id": "c-mobile", "connection": "E" }, "target": { "marker": "arrow", "id": "c-auth" }, "stroke": { "color": "#94a3b8", "width": 1 }, "zIndex": 10 },
      { "type": "line", "id": "l-gw-user", "shape": "elbow", "source": { "id": "c-apigw", "connection": "E" }, "target": { "marker": "arrow", "id": "c-user-svc" }, "stroke": { "color": "#94a3b8", "width": 1 }, "zIndex": 11 },
      { "type": "line", "id": "l-gw-order", "shape": "elbow", "source": { "id": "c-apigw", "connection": "S" }, "target": { "marker": "arrow", "id": "c-order-svc" }, "stroke": { "color": "#94a3b8", "width": 1 }, "zIndex": 11 },
      { "type": "line", "id": "l-auth-prod", "shape": "elbow", "source": { "id": "c-auth", "connection": "E" }, "target": { "marker": "arrow", "id": "c-product-svc" }, "stroke": { "color": "#94a3b8", "width": 1 }, "zIndex": 11 },
      { "type": "line", "id": "l-user-pg", "shape": "elbow", "source": { "id": "c-user-svc", "connection": "E" }, "target": { "marker": "arrow", "id": "c-pg" }, "stroke": { "color": "#94a3b8", "width": 1 }, "zIndex": 12 },
      { "type": "line", "id": "l-order-mongo", "shape": "elbow", "source": { "id": "c-order-svc", "connection": "E" }, "target": { "marker": "arrow", "id": "c-mongo" }, "stroke": { "color": "#94a3b8", "width": 1 }, "zIndex": 12 },
      { "type": "line", "id": "l-prod-es", "shape": "elbow", "source": { "id": "c-product-svc", "connection": "E" }, "target": { "marker": "arrow", "id": "c-es" }, "stroke": { "color": "#94a3b8", "width": 1 }, "zIndex": 12 },
      { "type": "line", "id": "l-user-kafka", "shape": "elbow", "source": { "id": "c-user-svc", "connection": "S" }, "target": { "marker": "arrow", "id": "c-kafka" }, "stroke": { "color": "#f97316", "width": 1, "style": "dash" }, "zIndex": 13 },
      { "type": "line", "id": "l-kafka-order", "shape": "elbow", "source": { "id": "c-kafka", "connection": "S" }, "target": { "marker": "arrow", "id": "c-order-svc" }, "stroke": { "color": "#f97316", "width": 1, "style": "dash" }, "zIndex": 13 },
      { "type": "line", "id": "l-order-eb", "shape": "elbow", "source": { "id": "c-order-svc", "connection": "S" }, "target": { "marker": "arrow", "id": "c-eventbus" }, "stroke": { "color": "#f97316", "width": 1, "style": "dash" }, "zIndex": 13 },
      { "type": "line", "id": "l-eb-prod", "shape": "elbow", "source": { "id": "c-eventbus", "connection": "S" }, "target": { "marker": "arrow", "id": "c-product-svc" }, "stroke": { "color": "#f97316", "width": 1, "style": "dash" }, "zIndex": 13 },
      {
        "type": "geometry", "id": "legend", "shape": "process",
        "fill": { "color": "#f8fafc" },
        "x": 0, "y": 540, "width": 950, "height": 36,
        "html": "<div style=\"padding:6px 16px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;\"><div style=\"font-size:10px;font-weight:600;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;\">Legend</div><div style=\"display:flex;align-items:center;gap:4px;\"><div style=\"width:12px;height:8px;background:#ecfeff;border:1px solid #06b6d4;border-radius:1px;\"></div><span style=\"font-size:8px;color:#64748b;font-family:monospace;\">Frontend</span></div><div style=\"display:flex;align-items:center;gap:4px;\"><div style=\"width:12px;height:8px;background:#ecfdf5;border:1px solid #10b981;border-radius:1px;\"></div><span style=\"font-size:8px;color:#64748b;font-family:monospace;\">Service</span></div><div style=\"display:flex;align-items:center;gap:4px;\"><div style=\"width:12px;height:8px;background:#fff1f2;border:1px solid #f43f5e;border-radius:1px;\"></div><span style=\"font-size:8px;color:#64748b;font-family:monospace;\">Gateway</span></div><div style=\"display:flex;align-items:center;gap:4px;\"><div style=\"width:12px;height:8px;background:#f5f3ff;border:1px solid #8b5cf6;border-radius:1px;\"></div><span style=\"font-size:8px;color:#64748b;font-family:monospace;\">Database</span></div><div style=\"display:flex;align-items:center;gap:4px;\"><div style=\"width:12px;height:8px;background:#fff7ed;border:1px solid #f97316;border-radius:1px;\"></div><span style=\"font-size:8px;color:#64748b;font-family:monospace;\">Message Bus</span></div></div>",
        "zIndex": 20
      }
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
yq doc create OWNER/BOOK --title "系统架构图" \
  --body-file ./board.lake --format lake

# 或更新已有文档
yq doc update DOC_URL --body-file ./board.lake --format lake
```

## 生成流程

1. **理解需求**：确认用户要画什么系统/架构
2. **分类组件**：为每个组件选择类型色（Frontend/Backend/Database/Cloud/Security/Message/External）
3. **规划布局**：确定组件数量、区域分组、连接方向，按网格计算坐标
4. **构建 body 数组**：按模板依次填充 → 画布边框 → 标题区 → 区域边界（可选）→ 组件块 → 消息总线 → 连接线 → 图例 → 信息卡片（可选）
5. **计算画布尺寸**：canvas frame 宽高 = 内容区 + 四周 30px padding
6. **组装 board value**：设置 `id`、`cardType: "board"`、`viewportOption: "adapt"`、`diagramData`、`search`、`graphicsBBox`
7. **编码为 Lake 卡片**：`JSON.stringify` → `encodeURIComponent` → 按该样本加 `data:` 前缀 → 嵌入 `<card>` 标签
8. **写入临时文件**：将 Lake HTML 写入临时文件
9. **提交到语雀**：通过 `doc create`（新建）或 `doc update`（更新），使用 `--body-file` 传递大内容

## 注意事项

- `viewportOption` 始终用 `"adapt"`，确保架构图自适应显示区域
- `search` 字段拼接所有可见文本（标题、组件名、技术栈），便于语雀全文搜索
- `graphicsBBox` 需包含 canvas frame 的负坐标起点（`x: -30, y: -30`）
- 组件 ID 使用有意义的前缀：`canvas` 画布、`hdr` 标题、`region-` 区域边界、`sg-` 安全组、`c-` 组件、`l-` 连接线、`legend` 图例、`card-` 信息卡片
- 标题区宽度 = 最右组件 x + 组件宽，确保与内容区等宽
- 图例只列出当前架构图实际使用的组件类型，不必列全
- 信息卡片是可选的，适合补充技术栈细节
- 组件内文字较长时，加宽组件并调整后续列 x 坐标
- 画布边框宽高 = 标题区宽度 + 60（左右各 30px），内容最底边 + 60（上下各 30px）
- 消息总线/事件总线的连接使用 orange 虚线（`#f97316` + `"dash"`），与常规数据流区分
